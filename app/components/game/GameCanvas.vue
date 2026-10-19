<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { StageData } from "~/composables/useStageLoader";
import type { FailPayload } from "~/types/game";
import { GAME, createGame, elapsedSeconds, stepGame, type GameProgram, type GameState } from "~/game/core";
import { advanceFrameClock, createFrameClock } from "~/game/frame-clock";
import { resolveScenePalette } from "~/game/scenery";
import { renderGameFrame } from "~/game/renderer";
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
let game: GameState = createGame(props.stage, props.program);
let frame = 0;
let frameClock = createFrameClock();
let idleFrame = 0;
let lastIdleDraw = 0;
const STEP_MS = 1000 / GAME.tickRate;

function draw(visualTick = game.elapsedTicks) {
  const ctx = canvas.value?.getContext("2d");
  if (!ctx) return;
  renderGameFrame(ctx, game, resolveScenePalette(props.stage.meta?.bg), visualTick, !props.running);
}

function stop() {
  cancelAnimationFrame(idleFrame);
  idleFrame = 0;
  cancelAnimationFrame(frame);
  frame = 0;
  frameClock = createFrameClock();
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

function loop(timestamp: number) {
  if (!props.running || game.status !== "running") return;
  const advanced = advanceFrameClock(frameClock, timestamp, STEP_MS);
  frameClock = advanced.clock;
  for (let step = 0; step < advanced.steps && game.status === "running"; step++) {
    const before = snapshotGameAudio(game);
    stepGame(game);
    for (const name of gameAudioEvents(before, game)) playSe(name);
  }
  draw();

  if (game.status === "cleared") {
    stop();
    emit("clear", { elapsedTicks: game.elapsedTicks, seconds: elapsedSeconds(game) });
  } else if (game.status === "failed") {
    stop();
    emit("fail", { reason: game.failureReason ?? "void" });
  } else {
    frame = requestAnimationFrame(loop);
  }
}

function start() {
  stop();
  game = createGame(props.stage, props.program);
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
    game = createGame(props.stage, props.program);
    draw();
    scheduleIdle();
  }
}, { deep: true });
watch(() => props.program, () => {
  if (props.running) start();
  else {
    game = createGame(props.stage, props.program);
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
    <canvas ref="canvas" class="w-full rounded-2xl border border-gray-200 bg-white" />
  </div>
</template>
