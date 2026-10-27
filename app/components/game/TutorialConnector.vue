<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { TutorialTarget } from "~/stage/onboarding";

const props = defineProps<{ target: TutorialTarget }>();
const root = ref<HTMLElement | null>(null);
const targetBox = ref<{ left: number; top: number; width: number; height: number } | null>(null);
const connector = ref("");
let resizeObserver: ResizeObserver | null = null;

function update() {
  const container = root.value?.parentElement;
  const bubble = container?.querySelector<HTMLElement>("[data-tutorial-bubble]");
  const target = container?.querySelector<HTMLElement>(`[data-tour-target="${props.target}"]`);
  if (!container || !bubble || !target) {
    connector.value = "";
    targetBox.value = null;
    return;
  }
  const base = container.getBoundingClientRect();
  const speech = bubble.getBoundingClientRect();
  const destination = target.getBoundingClientRect();
  if (!destination.width || !destination.height || !speech.width) return;
  const left = destination.left - base.left;
  const top = destination.top - base.top;
  const tx = left + destination.width / 2;
  const ty = top + destination.height / 2;
  const bx = speech.left - base.left + speech.width / 2;
  const by = speech.top - base.top + speech.height / 2;
  let sx = bx;
  let sy = by;
  if (destination.bottom <= speech.top) sy = speech.top - base.top;
  else if (destination.top >= speech.bottom) sy = speech.bottom - base.top;
  else sx = destination.right <= speech.left ? speech.left - base.left : speech.right - base.left;
  const cx = (sx + tx) / 2;
  connector.value = `M ${sx} ${sy} Q ${cx} ${sy} ${tx} ${ty}`;
  targetBox.value = { left, top, width: destination.width, height: destination.height };
}

async function bindTargets() {
  await nextTick();
  resizeObserver?.disconnect();
  update();
  const container = root.value?.parentElement;
  if (!container || typeof ResizeObserver === "undefined") return;
  resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(container);
  const target = container.querySelector<HTMLElement>(`[data-tour-target="${props.target}"]`);
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
      <defs>
        <marker id="tour-arrow-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#ffe08b" />
        </marker>
      </defs>
      <path :d="connector" fill="none" stroke="#14263f" stroke-width="8" stroke-linecap="round" />
      <path :d="connector" fill="none" stroke="#ffe08b" stroke-width="4" stroke-linecap="round" stroke-dasharray="9 6" marker-end="url(#tour-arrow-head)" />
    </svg>
    <div v-if="targetBox" class="tutorial-connector__target" :style="{ left: targetBox.left + 'px', top: targetBox.top + 'px', width: targetBox.width + 'px', height: targetBox.height + 'px' }" />
  </div>
</template>

<style scoped>
.tutorial-connector { position: absolute; inset: 0; pointer-events: none; z-index: 12; overflow: hidden; }
.tutorial-connector__line { position: absolute; inset: 0; overflow: visible; }
.tutorial-connector__target { position: absolute; border: 3px solid #ffe08b; border-radius: 12px; box-shadow: 0 0 0 4px #17263fa8, 0 0 0 8px #ffe08b44; animation: tutorial-target-pulse 1.8s ease-in-out infinite; }
@keyframes tutorial-target-pulse { 50% { box-shadow: 0 0 0 5px #17263fcc, 0 0 0 12px #ffe08b55; } }
@media (prefers-reduced-motion: reduce) { .tutorial-connector__target { animation: none; } }
</style>
