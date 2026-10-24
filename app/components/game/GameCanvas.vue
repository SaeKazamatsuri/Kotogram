<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { StageData } from "~/composables/useStageLoader";
import type { SourceMap } from "~/language/parser";
import { createActionHighlights, monitoredSourceLines, type SustainedHighlight } from "~/game/action-highlights";
import type { FailPayload } from "~/types/game";
import { GAME, createReadyGame, startGame, elapsedSeconds, stepGame, type GameProgram, type GameState } from "~/game/core";
import { advanceFrameClock, createFrameClock } from "~/game/frame-clock";
import { resolveScenePalette } from "~/game/scenery";
import { worldPaletteForStage } from "~/stage/world-map";
import { renderGameFrame } from "~/game/renderer";
import { failureAnimationDuration } from "~/game/character";
import { gameAudioEvents, snapshotGameAudio } from "~/game/audio-events";
import { playSe, setGameBgmRate } from "~/game/audio";

const props = defineProps<{
  stage: StageData;
  program?: GameProgram;
  running?: boolean;
  sourceMap?: SourceMap;
}>();
const emit = defineEmits<{
  (e: "clear", result: { elapsedTicks: number; seconds: number }): void;
  (e: "fail", payload: FailPayload & { lastExecutedLine: number | null }): void;
  (e: "trace", payload: { active: number[]; sustained: SustainedHighlight[]; monitoring: number[]; waiting: number | null; repeat: number | null; progress: string | null }): void;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let game: GameState = createReadyGame(props.stage, props.program);
let frame = 0;
let frameClock = createFrameClock();
let idleFrame = 0;
let lastIdleDraw = 0;
let failureStartedAt: number | null = null;
let previewX = 0;
let previewDrag: { pointerId: number; clientX: number; position: number } | null = null;
let lastBgmRate = 1;
const actionHighlights = createActionHighlights();
let lastTrace = "";
function emitTrace() {
  const { active, sustained } = actionHighlights.snapshot(game);
  const monitoring = monitoredSourceLines(game, props.sourceMap);
  const step = game.steps[game.cursor];
  const waiting = step?.op === "wait" || step?.op === "action" ? props.sourceMap?.steps[game.cursor] ?? null : null;
  const boundedWatcher = game.program.findIndex((rule, index) =>
    rule.maxFires !== undefined && game.fired[index]!.size < rule.maxFires
      && props.sourceMap?.watcherLoops[index] != null);
  const repeat = game.loops.length
    ? props.sourceMap?.steps[game.loops.at(-1)!.start] ?? null
    : boundedWatcher >= 0 ? props.sourceMap?.watcherLoops[boundedWatcher] ?? null : null;
  const frame = game.loops.at(-1);
  const loopInstruction = frame ? game.steps[frame.start] : undefined;
  const loopTotal = loopInstruction?.op === "repeat-start" ? loopInstruction.count : 0;
  const boundedTotal = boundedWatcher >= 0 ? game.program[boundedWatcher]?.maxFires ?? 0 : 0;
  const progress = frame && loopTotal ? String(loopTotal - frame.remaining + 1) + "/" + loopTotal
    : boundedTotal ? String(game.fired[boundedWatcher]!.size) + "/" + boundedTotal : null;
  const payload = { active, sustained, monitoring, waiting, repeat, progress };
  const signature = JSON.stringify(payload);
  if (signature !== lastTrace) { lastTrace = signature; emit("trace", payload); }
}
const STEP_MS = 1000 / GAME.tickRate;

function draw(visualTick = props.running ? game.elapsedTicks : Math.floor(lastIdleDraw / STEP_MS), failureProgress = 1) {
  const ctx = canvas.value?.getContext("2d");
  if (!ctx) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const view = !props.running && previewX > 0 ? { ...game, px: previewX } : game;
  renderGameFrame(ctx, view, resolveScenePalette(props.stage.id ? worldPaletteForStage(props.stage.id) : props.stage.meta?.bg), visualTick, !props.running, failureProgress, reducedMotion);
}

function stop() {
  previewDrag = null;
  lastBgmRate = 1;
  actionHighlights.reset();
  if (lastTrace) {
    emit("trace", { active: [], sustained: [], monitoring: [], waiting: null, repeat: null, progress: null });
    lastTrace = "";
  }
  setGameBgmRate(1);
  cancelAnimationFrame(idleFrame);
  idleFrame = 0;
  cancelAnimationFrame(frame);
  frame = 0;
  frameClock = createFrameClock();
  failureStartedAt = null;
}

function scheduleIdle() {
  if (!props.running && canvas.value && !idleFrame) idleFrame = requestAnimationFrame(idleLoop);
}

function idleLoop(timestamp: number) {
  idleFrame = 0;
  if (props.running || !canvas.value) return;
  if (timestamp - lastIdleDraw >= 1000 / 30) {
    lastIdleDraw = timestamp;
    draw(Math.floor(timestamp / STEP_MS));
  }
  scheduleIdle();
}

function animateFailure(timestamp: number) {
  if (!props.running || game.status !== "failed") return;
  if (failureStartedAt === null) failureStartedAt = timestamp;
  const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : failureAnimationDuration(game.failureReason);
  const elapsed = Math.max(0, timestamp - failureStartedAt);
  const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
  draw(game.elapsedTicks + elapsed / STEP_MS, progress);

  if (progress >= 1) {
    const reason = game.failureReason ?? "void";
    const lastExecutedLine = actionHighlights.lastActionLine();
    stop();
    emit("fail", { reason, lastExecutedLine });
  } else {
    frame = requestAnimationFrame(animateFailure);
  }
}

function loop(timestamp: number) {
  if (!props.running || game.status !== "running") return;
  const advanced = advanceFrameClock(frameClock, timestamp, STEP_MS);
  frameClock = advanced.clock;
  for (let step = 0; step < advanced.steps && game.status === "running"; step++) {
    const before = snapshotGameAudio(game);
    stepGame(game, (event) => actionHighlights.record(event, props.sourceMap));
    const speed = game.baseSpeed > 0 ? game.vx / game.baseSpeed : 1;
    if (speed !== lastBgmRate) {
      lastBgmRate = speed;
      setGameBgmRate(speed);
    }
    for (const name of gameAudioEvents(before, game)) playSe(name);
  }
  emitTrace();
  draw(game.elapsedTicks, game.status === "failed" ? 0 : 1);

  if (game.status === "cleared") {
    stop();
    emit("clear", { elapsedTicks: game.elapsedTicks, seconds: elapsedSeconds(game) });
  } else if (game.status === "failed") {
    frame = requestAnimationFrame(animateFailure);
  } else {
    frame = requestAnimationFrame(loop);
  }
}

function start() {
  stop();
  previewX = 0;
  game = createReadyGame(props.stage, props.program);
  startGame(game);
  emitTrace();
  draw();
  frame = requestAnimationFrame(loop);
}

watch(() => props.running, (running) => {
  if (running) start();
  else {
    stop();
    scheduleIdle();
  }
}, { immediate: true });
watch(() => props.stage, () => {
  previewX = 0;
  if (props.running) start();
  else {
    game = createReadyGame(props.stage, props.program);
    draw();
    scheduleIdle();
  }
}, { deep: true });
watch(() => props.program, () => {
  if (props.running) start();
  else {
    game = createReadyGame(props.stage, props.program);
    draw();
  }
}, { deep: true });

function previewLimit(): number {
  return Math.max(0, game.goalX - 100);
}

function previewMove(position: number) {
  if (props.running) return;
  previewX = Math.max(0, Math.min(previewLimit(), position));
  draw();
}

function onPreviewPointerDown(event: PointerEvent) {
  if (props.running || !event.isPrimary || event.button !== 0) return;
  previewDrag = { pointerId: event.pointerId, clientX: event.clientX, position: previewX };
  canvas.value?.setPointerCapture(event.pointerId);
}

function onPreviewPointerMove(event: PointerEvent) {
  if (!previewDrag || event.pointerId !== previewDrag.pointerId || !canvas.value) return;
  const width = canvas.value.getBoundingClientRect().width;
  if (width <= 0) return;
  previewMove(previewDrag.position - (event.clientX - previewDrag.clientX) * GAME.width / width);
}

function onPreviewPointerEnd(event: PointerEvent) {
  if (!previewDrag || event.pointerId !== previewDrag.pointerId) return;
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId);
  previewDrag = null;
}

function onPreviewKeydown(event: KeyboardEvent) {
  if (props.running) return;
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    previewMove(previewX + (event.key === "ArrowRight" ? 180 : -180));
  } else if (event.key === "Home") {
    event.preventDefault();
    previewMove(0);
  }
}

onMounted(() => {
  if (canvas.value) {
    const dpr = window.devicePixelRatio || 1;
    canvas.value.width = GAME.width * dpr;
    canvas.value.height = GAME.height * dpr;
    canvas.value.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  draw();
  scheduleIdle();
});

onBeforeUnmount(stop);
</script>

<template>
  <div class="flex flex-col gap-3">
    <canvas ref="canvas" class="w-full rounded-2xl border-[3px] border-[#b7dfcd] bg-[#98cbbf] shadow-[0_8px_0_#14263f]" :class="{ 'cursor-grab touch-none active:cursor-grabbing': !running }" :tabindex="running ? -1 : 0" :aria-label="running ? 'ゲームを実行中' : 'ステージの下見。ドラッグ、または左右キーで先を見る'" @pointerdown="onPreviewPointerDown" @pointermove="onPreviewPointerMove" @pointerup="onPreviewPointerEnd" @pointercancel="onPreviewPointerEnd" @keydown="onPreviewKeydown" />
  </div>
</template>
