<script setup lang="ts">
defineProps<{ all: Record<string, { seconds: number; chars: number }> }>();
const emit = defineEmits<{ (e: "close"): void }>();
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
          <tr v-for="i in [1, 2, 3]" :key="i">
            <td class="border p-3 text-center">stage-{{ i }}</td>
            <td class="border p-3 text-center">
              {{ all?.[`stage-${i}`]?.seconds ?? "-" }}
            </td>
            <td class="border p-3 text-center">
              {{ all?.[`stage-${i}`]?.chars ?? "-" }}
            </td>
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
