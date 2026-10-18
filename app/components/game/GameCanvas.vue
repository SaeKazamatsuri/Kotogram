<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { StageData } from "~/composables/useStageLoader";
import type { Rule } from "~/composables/useParser";
import type { FailPayload } from "~/types/game";
import { GAME, createGame, elapsedSeconds, isCrouching, stepGame, worldToScreenX, type GameState } from "~/game/core";

const props = defineProps<{
  stage: StageData;
  program?: Rule[];
  running?: boolean;
}>();
const emit = defineEmits<{
  (e: "clear", result: { elapsedTicks: number; seconds: number }): void;
  (e: "fail", payload: FailPayload): void;
}>();

type SpriteKey = "player" | "wall" | "ghost" | "goal";
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

function opaqueSprite(source: HTMLImageElement): CanvasImageSource {
  const width = source.naturalWidth;
  const height = source.naturalHeight;
  if (!width || !height) return source;
  const buffer = document.createElement("canvas");
  buffer.width = width;
  buffer.height = height;
  const ctx = buffer.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < image.data.length; i += 4) {
    const alpha = image.data[i];
    if (alpha === 0 || alpha === 255) continue;
    const ratio = 255 / alpha;
    for (let channel = i - 3; channel < i; channel++) {
      image.data[channel] = Math.min(255, Math.round(image.data[channel] * ratio));
    }
    image.data[i] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return buffer;
}

function loadSprite(name: SpriteKey, path: string, opaque = false): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      sprites[name] = opaque ? opaqueSprite(image) : image;
      draw();
      resolve();
    };
    image.onerror = () => {
      sprites[name] = null;
      resolve();
    };
    image.src = path;
  });
}

function draw() {
  const ctx = canvas.value?.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, GAME.width, GAME.height);

  const background = ctx.createLinearGradient(0, 0, 0, GAME.height);
  background.addColorStop(0, "#dbeafe");
  background.addColorStop(1, "#fef3c7");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, GAME.width, GAME.height);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, GAME.groundY, GAME.width, GAME.groundHeight);

  for (const hole of game.holes) {
    const left = Math.max(0, worldToScreenX(game, hole.x));
    const right = Math.min(GAME.width, worldToScreenX(game, hole.x + hole.w));
    if (right > left) {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(left, GAME.groundY, right - left, GAME.groundHeight);
    }
  }

  for (const wall of game.walls) {
    const x = worldToScreenX(game, wall.x);
    if (x < -GAME.wallWidth || x > GAME.width + GAME.wallWidth) continue;
    if (sprites.wall) ctx.drawImage(sprites.wall, x, GAME.groundY - GAME.wallHeight, GAME.wallWidth, GAME.wallHeight);
    else {
      ctx.fillStyle = "#9ca3af";
      ctx.fillRect(x, GAME.groundY - GAME.wallHeight, GAME.wallWidth, GAME.wallHeight);
    }
  }

  for (const ghost of game.ghosts) {
    const x = worldToScreenX(game, ghost.x);
    if (x < -GAME.ghostWidth || x > GAME.width + GAME.ghostWidth) continue;
    const y = GAME.groundY - GAME.ghostHeight - GAME.ghostClearance;
    if (sprites.ghost) ctx.drawImage(sprites.ghost, x, y, GAME.ghostWidth, GAME.ghostHeight);
    else {
      const center = x + GAME.ghostWidth / 2;
      const headHeight = GAME.ghostHeight * 0.65;
      const neck = y + headHeight;
      const bottom = y + GAME.ghostHeight;
      const radius = GAME.ghostWidth * 0.45;
      const arc = y + headHeight * 0.35;
      const taper = GAME.ghostWidth * 0.2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(center - radius, arc);
      ctx.quadraticCurveTo(center - radius, y, center, y);
      ctx.quadraticCurveTo(center + radius, y, center + radius, arc);
      ctx.quadraticCurveTo(center + radius * 0.92, neck, center + taper, neck);
      ctx.quadraticCurveTo(center + taper * 0.6, bottom, center, bottom);
      ctx.quadraticCurveTo(center - taper * 0.6, bottom, center - taper, neck);
      ctx.quadraticCurveTo(center - radius * 0.92, neck, center - radius, arc);
      ctx.closePath();
      ctx.fill();
    }
  }

  const playerHeight = isCrouching(game) ? GAME.crouchHeight : GAME.playerHeight;
  if (sprites.player) ctx.drawImage(sprites.player, GAME.playerScreenX, game.py - playerHeight, GAME.playerWidth, playerHeight);
  else {
    ctx.fillStyle = "#111827";
    ctx.fillRect(GAME.playerScreenX, game.py - playerHeight, GAME.playerWidth, playerHeight);
  }

  const goalX = worldToScreenX(game, game.goalX);
  if (goalX < GAME.width && goalX + GAME.goalWidth > 0) {
    if (sprites.goal) ctx.drawImage(sprites.goal, goalX, GAME.groundY - GAME.goalHeight, GAME.goalWidth, GAME.goalHeight);
    else {
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(goalX, GAME.groundY - GAME.goalHeight, GAME.goalWidth, GAME.goalHeight);
    }
  }
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

onMounted(async () => {
  if (canvas.value) {
    const dpr = window.devicePixelRatio || 1;
    canvas.value.width = GAME.width * dpr;
    canvas.value.height = GAME.height * dpr;
    canvas.value.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  await Promise.all([
    loadSprite("player", "/sprites/player.png"),
    loadSprite("wall", "/sprites/wall.png"),
    loadSprite("ghost", "/sprites/ghost.png", true),
    loadSprite("goal", "/sprites/goal.png"),
  ]);
  draw();
});
onBeforeUnmount(stop);
</script>

<template>
  <div class="flex flex-col gap-3">
    <canvas ref="canvas" class="w-full rounded-2xl border border-gray-200 bg-white" />
  </div>
</template>
