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
const emit = defineEmits<{ (e: "close"): void; (e: "retry"): void }>();

const message = computed(() => failReasonLabel(props.reason));
const hintText = computed(
  () => props.hint && props.hint.trim().length > 0
    ? props.hint
    : defaultFailHint(props.reason)
);
</script>

<template>
  <div
    class="fixed inset-0 bg-black/40 grid place-items-center"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-3xl w-[min(520px,92vw)] p-6 shadow-xl border-2 border-rose-300"
    >
      <h2 class="text-2xl font-extrabold text-rose-600 mb-2">ざんねん！</h2>
      <p class="mb-4 text-lg text-slate-800">{{ message }}</p>
      <p class="mb-6 text-sm text-slate-600 leading-relaxed">{{ hintText }}</p>
      <div class="flex gap-3">
        <button
          class="rounded-2xl border-2 border-rose-600 bg-rose-400 hover:bg-rose-300 px-5 py-3 text-lg font-bold text-slate-900"
          @click="emit('retry')"
        >
          もういちど
        </button>
        <button
          class="rounded-2xl border px-5 py-3 text-lg bg-white hover:bg-gray-50"
          @click="emit('close')"
        >
          とじる
        </button>
      </div>
    </div>
  </div>
</template>
