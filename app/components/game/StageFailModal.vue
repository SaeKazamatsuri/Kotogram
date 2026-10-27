<script setup lang="ts">
import { computed, ref } from "vue";
import { failureLearningHint } from "~/stage/onboarding";
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
const hintOpen = ref(false);

const message = computed(() => failReasonLabel(props.reason));
const learningHint = computed(() => failureLearningHint(props.reason));
const hintText = computed(() => {
  if (props.hint && props.hint.trim().length > 0) return props.hint;
  return defaultFailHint(props.reason);
});
</script>

<template>
  <div class="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-[#090e1d]/90 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ステージしっぱい" @click.self="emit('close')">
    <div class="game-panel max-h-[calc(100dvh-24px)] w-[min(500px,96vw)] overflow-y-auto p-5 sm:p-8">
      <div class="mb-5 flex items-center gap-4">
        <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#ffb59f] text-[#842b40]"><Icon name="lucide:rotate-ccw" class="text-4xl" aria-hidden="true"/></div>
        <h2 class="game-heading text-3xl text-[#962d47]">もう一度！</h2>
      </div>
      <p class="mb-4 rounded-xl bg-[#ffefea] p-4 text-lg font-black text-[#7d263d]">{{ message }}</p>
      <p class="mb-4 rounded-xl bg-[#e5f4ea] p-4 text-base font-black leading-relaxed text-[#235342]">{{ learningHint }}</p>
      <button type="button" class="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-[#2f5972]" :aria-expanded="hintOpen" @click="hintOpen = !hintOpen"><Icon name="lucide:lightbulb" class="game-icon" aria-hidden="true"/> もっと ヒント <Icon :name="hintOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="game-icon" aria-hidden="true"/></button>
      <p v-if="hintOpen" class="mb-4 rounded-xl bg-[#eaf4ec] p-4 text-sm font-bold leading-relaxed text-[#1b5141]">{{ hintText }}</p>
      <button type="button" class="game-button game-button--coral w-full text-lg" @click="emit('close')"><Icon name="lucide:edit-3" class="game-icon" aria-hidden="true"/> コードを直す</button>
    </div>
  </div>
</template>
