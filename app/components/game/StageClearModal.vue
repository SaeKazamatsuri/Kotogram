<script setup lang="ts">
import type { BestRuns, ScoredRun } from "~/scoring/score";

defineProps<{
  seconds: number;
  stageId: string;
  chars: number;
  scores?: { time: number; chars: number; overall: number } | null;
  bests?: BestRuns<ScoredRun>;
}>();
const emit = defineEmits<{ (e: "close"): void; (e: "next"): void }>();
</script>

<template>
  <div
    class="fixed inset-0 z-40 bg-black/40 grid place-items-center p-3"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-3xl w-[min(620px,96vw)] max-h-[90vh] overflow-y-auto p-6 shadow-xl border-2 border-lime-300">
      <h2 class="text-2xl font-extrabold text-slate-800 mb-3">ステージクリア！</h2>
      <p class="mb-3 text-slate-700">
        タイム <span class="text-xl font-bold">{{ seconds.toFixed(1) }}秒</span>
        ／ もじすう <span class="text-xl font-bold">{{ chars }}もじ</span>
      </p>
      <div v-if="scores" class="grid grid-cols-3 gap-2 mb-4" aria-label="3しゅるいのスコア">
        <div v-for="item in [
          { label: 'タイム', value: scores.time },
          { label: 'もじすう', value: scores.chars },
          { label: 'そうごう', value: scores.overall },
        ]" :key="item.label" class="rounded-xl border border-lime-200 bg-lime-50 p-3 text-center">
          <p class="text-sm text-slate-700">{{ item.label }}</p>
          <p class="text-xl font-extrabold text-slate-900 break-all">{{ Math.round(item.value).toLocaleString('ja-JP') }}<span class="text-xs">てん</span></p>
        </div>
      </div>
      <p v-else class="mb-4 text-sm text-slate-600">このステージの きじゅんてんを じゅんびちゅう</p>
      <div v-if="bests?.time || bests?.chars || bests?.overall" class="mb-5 rounded-xl border border-sky-200 p-3 text-sm text-slate-700">
        <p class="font-bold mb-2">このたんまつの じこベスト</p>
        <p>はやさ: {{ bests.time ? (bests.time.elapsedTicks / 60).toFixed(2) + 'びょう' : '－' }}</p>
        <p>みじかさ: {{ bests.chars?.charCount ?? '－' }}もじ</p>
        <p>そうごう: {{ bests.overall ? bests.overall.elapsedTicks * bests.overall.charCount : '－' }}</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <button
          class="rounded-2xl border-2 border-lime-600 bg-lime-400 hover:bg-lime-300 px-5 py-3 text-lg font-bold text-slate-900"
          @click="emit('next')"
        >つぎへ</button>
        <button
          class="rounded-2xl border px-5 py-3 text-lg bg-white hover:bg-gray-50"
          @click="emit('close')"
        >コードを なおす</button>
      </div>
    </div>
  </div>
</template>
