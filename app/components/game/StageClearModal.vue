<script setup lang="ts">
defineProps<{ seconds: number; stageId: string }>();
const emit = defineEmits<{ (e: "close"): void; (e: "next"): void }>();
</script>

<template>
  <div
    class="fixed inset-0 bg-black/40 grid place-items-center"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-3xl w-[min(520px,92vw)] p-6 shadow-xl border-2 border-lime-300"
    >
      <h2 class="text-2xl font-extrabold text-slate-800 mb-2">
        ステージクリア！
      </h2>
      <p class="mb-5 text-lg">
        タイム：<strong class="text-2xl text-slate-900">{{
          seconds.toFixed(1)
        }}</strong>
        秒
      </p>
      <div class="flex gap-3">
        <button
          class="rounded-2xl border-2 border-lime-600 bg-lime-400 hover:bg-lime-300 px-5 py-3 text-lg font-bold text-slate-900"
          @click="emit('next')"
        >
          つぎへ
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
