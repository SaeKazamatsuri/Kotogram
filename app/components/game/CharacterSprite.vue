<script setup lang="ts">
import { onMounted, ref } from "vue";
import { drawCharacterArtwork } from "~/game/character";

const canvas = ref<HTMLCanvasElement | null>(null);

onMounted(() => {
  const element = canvas.value;
  if (!element) return;
  const scale = Math.min(window.devicePixelRatio || 1, 3);
  element.width = Math.round(96 * scale);
  element.height = Math.round(108 * scale);
  const ctx = element.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(scale * 1.5, 0, 0, scale * 1.5, scale * 48, scale * 98);
  drawCharacterArtwork(ctx, { pose: "walking", stride: 0, blink: false, stunned: false });
});
</script>

<template>
  <canvas ref="canvas" class="character-sprite" width="96" height="108" />
</template>

<style scoped>
.character-sprite {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
