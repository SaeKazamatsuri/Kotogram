<script setup lang="ts">
import { ref } from "vue";
import type { BestRuns, ScoredRun } from "~/scoring/score";
import RankingPanel from "./RankingPanel.vue";

defineProps<{
  seconds: number;
  stageId: string;
  stageVersion: string;
  chars: number;
  scores?: { time: number; chars: number; overall: number } | null;
  bests?: BestRuns<ScoredRun>;
  apiBase?: string;
  saving?: boolean;
  savedName?: string;
  saveError?: string;
  rankingRefresh?: number;
}>();
const emit = defineEmits<{
  (e: "close" | "next"): void;
  (e: "register", name: string): void;
}>();
const nickname = ref("");
const showRanking = ref(false);
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black/40 grid place-items-center p-3" @click.self="emit('close')">
    <div class="bg-white rounded-3xl w-[min(620px,96vw)] max-h-[90vh] overflow-y-auto p-6 shadow-xl border-2 border-lime-300">
      <h2 class="text-2xl font-extrabold text-slate-800 mb-3">ステージクリア！</h2>
      <p class="mb-3 text-slate-700">
        タイム <span class="text-xl font-bold">{{ seconds.toFixed(1) }}秒</span>
        ／ もじすう <span class="text-xl font-bold">{{ chars }}もじ</span>
      </p>
      <div
        v-if="scores"
        class="grid grid-cols-3 gap-2 mb-4"
        aria-label="3しゅるいのスコア"
      >
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
      <div v-if="bests?.time || bests?.chars || bests?.overall" class="mb-4 rounded-xl border border-sky-200 p-3 text-sm text-slate-700">
        <p class="font-bold mb-2">このたんまつの じこベスト</p>
        <p>はやさ: {{ bests.time ? (bests.time.elapsedTicks / 60).toFixed(2) + 'びょう' : '－' }}</p>
        <p>みじかさ: {{ bests.chars?.charCount ?? '－' }}もじ</p>
        <p>そうごう: {{ bests.overall ? bests.overall.elapsedTicks * bests.overall.charCount : '－' }}</p>
      </div>
      <section v-if="apiBase" class="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <template v-if="!savedName">
          <label for="ranking-nickname" class="block mb-2 text-sm font-semibold">ランキングに のせる なまえ（かかなくてもOK）</label>
          <input
            id="ranking-nickname"
            v-model="nickname"
            :disabled="saving"
            :maxlength="16"
            type="text"
            class="w-full rounded-xl border border-amber-300 p-2 bg-white text-base"
            autocomplete="off"
            placeholder="からなら ゲストの なまえ"
          >
          <p class="my-2 text-xs text-slate-600">ほんとうの なまえや じゅうしょは かかないでね</p>
          <button
            type="button"
            :disabled="saving"
            class="rounded-xl bg-amber-400 px-4 py-2 font-semibold disabled:opacity-50"
            @click="emit('register', nickname)"
          >{{ saving ? "とうろくちゅう…" : "きろくを とうろく" }}</button>
          <p v-if="saveError" role="alert" class="mt-2 text-sm text-rose-700">{{ saveError }} もういちど おしてね。</p>
        </template>
        <p v-else class="text-sm text-slate-700">「{{ savedName }}」で とうろくできたよ！</p>
        <button type="button" class="mt-2 ml-2 rounded-xl border border-amber-400 bg-white px-3 py-2 text-sm" @click="showRanking = !showRanking">
          {{ showRanking ? 'ランキングを とじる' : 'ランキングを みる' }}
        </button>
      </section>
      <p v-else class="mb-3 text-sm text-slate-600">オンラインランキングは じゅんびちゅう。たんまつの きろくは のこるよ。</p>
      <RankingPanel v-if="showRanking && apiBase" :stage-id="stageId" :stage-version="stageVersion" :api-base="apiBase" :refresh="rankingRefresh ?? 0" />
      <div class="mt-4 flex flex-wrap gap-3">
        <button class="rounded-2xl border-2 border-lime-600 bg-lime-400 hover:bg-lime-300 px-5 py-3 text-lg font-bold text-slate-900" @click="emit('next')">つぎへ</button>
        <button class="rounded-2xl border px-5 py-3 text-lg bg-white hover:bg-gray-50" @click="emit('close')">コードを なおす</button>
      </div>
    </div>
  </div>
</template>
