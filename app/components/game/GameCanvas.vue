<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { StageData } from "~/composables/useStageLoader";
import type { FailPayload } from "~/types/game";
import { GAME, createReadyGame, startGame, elapsedSeconds, stepGame, type GameProgram, type GameState } from "~/game/core";
import { advanceFrameClock, createFrameClock } from "~/game/frame-clock";
import { resolveScenePalette } from "~/game/scenery";
import { renderGameFrame } from "~/game/renderer";
import { failureAnimationDuration } from "~/game/character";
import { gameAudioEvents, snapshotGameAudio } from "~/game/audio-events";
import { playSe } from "~/game/audio";

const props = defineProps<{
  stage: StageData;
  program?: GameProgram;
  running?: boolean;
}>();
const emit = defineEmits<{
  (e: "clear", result: { elapsedTicks: number; seconds: number }): void;
  (e: "fail", payload: FailPayload): void;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let game: GameState = createReadyGame(props.stage, props.program);
let frame = 0;
let frameClock = createFrameClock();
let idleFrame = 0;
let lastIdleDraw = 0;
let failureStartedAt: number | null = null;
const STEP_MS = 1000 / GAME.tickRate;

function draw(visualTick = game.elapsedTicks, failureProgress = 1) {
  const ctx = canvas.value?.getContext("2d");
  if (!ctx) return;
  renderGameFrame(ctx, game, resolveScenePalette(props.stage.meta?.bg), visualTick, !props.running, failureProgress);
}

function stop() {
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
    stop();
    emit("fail", { reason });
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
    stepGame(game);
    for (const name of gameAudioEvents(before, game)) playSe(name);
  }
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
  game = createReadyGame(props.stage, props.program);
  startGame(game);
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
    <canvas ref="canvas" class="w-full rounded-2xl border-[3px] border-[#b7dfcd] bg-[#98cbbf] shadow-[0_8px_0_#14263f]" />
  </div>
</template>
