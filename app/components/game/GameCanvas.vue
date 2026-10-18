<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { StageData } from "~/composables/useStageLoader";
import type { FailPayload } from "~/types/game";
import { GAME, createGame, elapsedSeconds, stepGame, type GameProgram, type GameState } from "~/game/core";
import { resolveScenePalette } from "~/game/scenery";
import { renderGameFrame } from "~/game/renderer";

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
const sprites: Record<SpriteKey, CanvasImageSource | null> = {
  player: null,
  wall: null,
  ghost: null,
  goal: null,
};
let game: GameState = createGame(props.stage, props.program);
let frame = 0;
let previousTimestamp = 0;
let accumulated = 0;
const STEP_MS = 1000 / GAME.tickRate;

function draw() {
  const ctx = canvas.value?.getContext("2d");
  if (!ctx) return;
  renderGameFrame(ctx, game, resolveScenePalette(props.stage.meta?.bg));
}

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  previousTimestamp = 0;
  accumulated = 0;
}

function loop(timestamp: number) {
  if (!props.running || game.status !== "running") return;
  accumulated += previousTimestamp ? Math.min(timestamp - previousTimestamp, 250) : STEP_MS;
  previousTimestamp = timestamp;

  let steps = 0;
  while (accumulated >= STEP_MS && steps < 5 && game.status === "running") {
    stepGame(game);
    accumulated -= STEP_MS;
    steps += 1;
  }
  if (steps === 5) accumulated = Math.min(accumulated, STEP_MS);
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
  else stop();
}, { immediate: true });
watch(() => props.stage, () => {
  if (props.running) start();
  else {
    game = createGame(props.stage, props.program);
    draw();
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
});

onBeforeUnmount(stop);
</script>

<template>
  <div class="flex flex-col gap-3">
    <canvas ref="canvas" class="w-full rounded-2xl border border-gray-200 bg-white" />
  </div>
</template>
