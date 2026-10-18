<script setup lang="ts">
import { computed } from "vue";
import {
  defaultFailHint,
  failReasonLabel,
  type FailReason,
} from "~/types/game";

const props = defineProps<{
  reason: FailReason;
  hint?: string;
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const message = computed(() => failReasonLabel(props.reason));
const hintText = computed(() => {
  if (props.hint && props.hint.trim().length > 0) return props.hint;
  return defaultFailHint(props.reason);
});
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#090d23]/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ステージしっぱい" @click.self="emit('close')">
    <div class="game-panel relative w-[min(560px,96vw)] border-[#fa967b] bg-[#fff7e8] p-6 text-[#27334b] sm:p-8">
      <p class="game-kicker mb-3 text-[#ac5663]">TRY AGAIN</p>
      <div class="mb-5 flex items-center gap-4">
        <span class="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] border-[3px] border-[#35344e] bg-[#ffaf97] text-5xl" aria-hidden="true">↶</span>
        <div><h2 class="game-heading text-3xl text-[#a43d55]">ざんねん！</h2><p class="mt-1 text-sm font-bold text-[#645f76]">だいじょうぶ、なんどでも ためせるよ。</p></div>
      </div>
      <p class="mb-4 rounded-xl bg-[#ffe3d7] p-4 text-lg font-black text-[#723f4b]">{{ message }}</p>
      <div class="mb-6 rounded-xl border-2 border-[#c0ceca] bg-[#edf8f0] p-4">
        <p class="mb-2 text-xs font-black tracking-widest text-[#367660]">HINT / ヒント</p>
        <p class="text-sm font-bold leading-relaxed text-[#2e4e4d]">{{ hintText }}</p>
      </div>
      <button type="button" class="game-button game-button--coral w-full text-lg" @click="emit('close')">↶ もういちど</button>
    </div>
  </div>
</template>
