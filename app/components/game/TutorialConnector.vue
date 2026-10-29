<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { TutorialTarget } from "~/stage/onboarding";

const props = defineProps<{ target: TutorialTarget }>();
const root = ref<HTMLElement | null>(null);
const targetBox = ref<{ left: number; top: number; width: number; height: number } | null>(null);
const connector = ref("");
const arrowHead = ref("");
let resizeObserver: ResizeObserver | null = null;

function update() {
  const container = root.value?.parentElement;
  const bubble = container?.querySelector<HTMLElement>("[data-tutorial-bubble]");
  const target = container?.querySelector<HTMLElement>('[data-tour-target="' + props.target + '"]');
  if (!container || !bubble || !target) {
    connector.value = "";
    arrowHead.value = "";
    targetBox.value = null;
    return;
  }
  const base = container.getBoundingClientRect();
  const speech = bubble.getBoundingClientRect();
  const destination = target.getBoundingClientRect();
  if (!destination.width || !destination.height || !speech.width) return;
  let visible = destination;
  let ancestor = target.parentElement;
  while (ancestor && ancestor !== container) {
    const style = getComputedStyle(ancestor);
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) {
      const clip = ancestor.getBoundingClientRect();
      visible = {
        ...visible,
        left: Math.max(visible.left, clip.left),
        top: Math.max(visible.top, clip.top),
        right: Math.min(visible.right, clip.right),
        bottom: Math.min(visible.bottom, clip.bottom),
      };
    }
    ancestor = ancestor.parentElement;
  }
  if (visible.right <= visible.left || visible.bottom <= visible.top) {
    connector.value = "";
    arrowHead.value = "";
    targetBox.value = null;
    return;
  }
  const left = visible.left - base.left;
  const top = visible.top - base.top;
  const width = visible.right - visible.left;
  const height = visible.bottom - visible.top;
  targetBox.value = { left, top, width, height };
  const tx = left + width / 2;
  const ty = top + height / 2;
  const bx = speech.left - base.left + speech.width / 2;
  const by = speech.top - base.top + speech.height / 2;
  const dx = tx - bx;
  const dy = ty - by;
  const distance = Math.hypot(dx, dy);
  if (distance < 24) {
    connector.value = "";
    arrowHead.value = "";
    return;
  }
  const startScale = 1 / Math.max(Math.abs(dx) / (speech.width / 2), Math.abs(dy) / (speech.height / 2));
  const sx = bx + dx * startScale;
  const sy = by + dy * startScale;
  let tipX = tx;
  let tipY = ty;
  if (props.target !== "canvas") {
    const endScale = 1 / Math.max(Math.abs(dx) / (width / 2 + 10), Math.abs(dy) / (height / 2 + 10));
    tipX = tx - dx * endScale;
    tipY = ty - dy * endScale;
  }
  const cx = (sx + tipX) / 2;
  const cy = sy;
  const vx = tipX - cx;
  const vy = tipY - cy;
  const tangentLength = Math.hypot(vx, vy);
  if (tangentLength < 12) {
    connector.value = "";
    arrowHead.value = "";
    return;
  }
  const ux = vx / tangentLength;
  const uy = vy / tangentLength;
  const backX = tipX - ux * 13;
  const backY = tipY - uy * 13;
  connector.value = "M " + sx + " " + sy + " Q " + cx + " " + cy + " " + backX + " " + backY;
  arrowHead.value = [
    tipX + "," + tipY,
    (backX - uy * 7) + "," + (backY + ux * 7),
    (backX + uy * 7) + "," + (backY - ux * 7),
  ].join(" ");
}
async function bindTargets() {
  await nextTick();
  resizeObserver?.disconnect();
  update();
  const container = root.value?.parentElement;
  if (!container || typeof ResizeObserver === "undefined") return;
  resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(container);
  const target = container.querySelector<HTMLElement>('[data-tour-target="' + props.target + '"]');
  if (target && window.matchMedia("(max-width: 960px)").matches) target.scrollIntoView({ block: "nearest", behavior: "instant" });
  const bubble = container.querySelector<HTMLElement>("[data-tutorial-bubble]");
  if (target) resizeObserver.observe(target);
  if (bubble) resizeObserver.observe(bubble);
}

onMounted(() => {
  void bindTargets();
  window.addEventListener("resize", update);
  root.value?.parentElement?.addEventListener("scroll", update, true);
});
watch(() => props.target, () => { void bindTargets(); });
onBeforeUnmount(() => {
  window.removeEventListener("resize", update);
  root.value?.parentElement?.removeEventListener("scroll", update, true);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div ref="root" class="tutorial-connector" aria-hidden="true">
    <svg v-if="targetBox" class="tutorial-connector__line" width="100%" height="100%">
      <path v-if="connector" :d="connector" fill="none" stroke="#14263f" stroke-width="8" stroke-linecap="round" />
      <path v-if="connector" :d="connector" fill="none" stroke="#ffe08b" stroke-width="4" stroke-linecap="round" />
      <polygon v-if="arrowHead" :points="arrowHead" fill="#ffe08b" stroke="#14263f" stroke-width="3" stroke-linejoin="round" />
    </svg>
    <div v-if="targetBox" class="tutorial-connector__target" :style="{ left: targetBox.left + 'px', top: targetBox.top + 'px', width: targetBox.width + 'px', height: targetBox.height + 'px' }" />
  </div>
</template>

<style scoped>
.tutorial-connector { position: absolute; inset: 0; pointer-events: none; z-index: 12; overflow: hidden; }
.tutorial-connector__line { position: absolute; inset: 0; overflow: hidden; }
.tutorial-connector__target { position: absolute; border: 3px solid #ffe08b; border-radius: 12px; box-shadow: 0 0 0 4px #17263fa8, 0 0 0 8px #ffe08b44; animation: tutorial-target-pulse 1.8s ease-in-out infinite; }
@keyframes tutorial-target-pulse { 50% { box-shadow: 0 0 0 5px #17263fcc, 0 0 0 12px #ffe08b55; } }
@media (prefers-reduced-motion: reduce) { .tutorial-connector__target { animation: none; } }
</style>
