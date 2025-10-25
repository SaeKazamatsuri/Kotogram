<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  all: Record<string, { seconds: number; chars: number }>;
}>();
const emit = defineEmits<{ (e: "close"): void }>();
const stageIds = ["stage-1", "stage-2", "stage-3"];

const totals = computed(() => {
  let secondsSum = 0;
  let charsSum = 0;
  let secondsValid = true;
  let charsValid = true;

  for (const id of stageIds) {
    const record = props.all?.[id];
    if (secondsValid) {
      if (record && typeof record.seconds === "number") {
        secondsSum += record.seconds;
      } else {
        secondsValid = false;
      }
    }
    if (charsValid) {
      if (record && typeof record.chars === "number") {
        charsSum += record.chars;
      } else {
        charsValid = false;
      }
    }
  }

  return {
    seconds: secondsValid ? Number(secondsSum.toFixed(1)) : "-",
    chars: charsValid ? charsSum : "-",
  };
});
</script>

<template>
  <div
    class="fixed inset-0 bg-black/40 grid place-items-center"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-3xl w-[min(640px,94vw)] p-6 shadow-xl border-2 border-sky-300"
    >
      <h2 class="text-2xl font-extrabold text-slate-800 mb-4">
        きろく（ステージ1〜3）
      </h2>
      <table class="w-full border-collapse text-base mb-4">
        <thead>
          <tr class="bg-sky-50">
            <th class="border p-3">ステージ</th>
            <th class="border p-3">タイム（秒）</th>
            <th class="border p-3">文字数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="id in stageIds" :key="id">
            <td class="border p-3 text-center">{{ id }}</td>
            <td class="border p-3 text-center">
              {{ props.all?.[id]?.seconds ?? "-" }}
            </td>
            <td class="border p-3 text-center">
              {{ props.all?.[id]?.chars ?? "-" }}
            </td>
          </tr>
          <tr class="bg-sky-100 font-semibold">
            <td class="border p-3 text-center">ごうけい</td>
            <td class="border p-3 text-center">{{ totals.seconds }}</td>
            <td class="border p-3 text-center">{{ totals.chars }}</td>
          </tr>
        </tbody>
      </table>
      <div class="flex justify-end">
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
