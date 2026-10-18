<script setup lang="ts">
import { ref } from "vue";
import type { BestRuns, ScoredRun } from "~/scoring/score";
import RankingPanel from "./RankingPanel.vue";

defineProps<{
  seconds: number;
  stageId: string;
  stageVersion: string;
  hasNext: boolean;
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
  <div class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#090e1d]/90 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ステージクリア" @click.self="emit('close')">
    <div class="game-panel my-4 max-h-[95vh] w-[min(640px,96vw)] overflow-y-auto p-5 sm:p-7">
      <div class="mb-5 flex items-center gap-4">
        <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#ffdc90] text-[#172439]"><Icon name="lucide:trophy" class="text-4xl" aria-hidden="true"/></div>
        <h2 class="game-heading text-3xl text-[#172439]">ステージクリア！</h2>
      </div>
      <div class="mb-4 grid grid-cols-2 gap-3">
        <div class="rounded-xl bg-[#e8f0f5] p-4"><p class="text-sm font-black text-[#41556e]">タイム</p><p class="text-2xl font-black text-[#172439]">{{ seconds.toFixed(1) }}<span class="ml-1 text-sm">秒</span></p></div>
        <div class="rounded-xl bg-[#e8f0f5] p-4"><p class="text-sm font-black text-[#41556e]">文字数</p><p class="text-2xl font-black text-[#172439]">{{ chars }}<span class="ml-1 text-sm">字</span></p></div>
      </div>
      <div v-if="scores" class="mb-4 rounded-2xl bg-[#fff0c6] p-3">
        <div class="grid grid-cols-3 gap-2" aria-label="3つの点数">
          <div v-for="item in [{ label: 'タイム', value: scores.time }, { label: '文字数', value: scores.chars }, { label: '合計', value: scores.overall }]" :key="item.label" class="rounded-xl bg-white p-2 text-center sm:p-3">
            <p class="text-xs font-black text-[#5c5470]">{{ item.label }}</p>
            <p class="break-all text-lg font-black text-[#172439] sm:text-2xl">{{ Math.round(item.value).toLocaleString('ja-JP') }}<span class="text-xs">点</span></p>
            <p v-if="item.value > 1000" class="text-xs font-black text-[#14684e]">1000点こえ！</p>
          </div>
        </div>
      </div>
      <div v-if="bests?.time || bests?.chars || bests?.overall" class="mb-4 rounded-xl border border-[#bccbd9] bg-[#f0f5f8] p-3 text-sm text-[#172439]">
        <h3 class="mb-2 flex items-center gap-2 font-black"><Icon name="lucide:medal" class="game-icon text-[#14684e]" aria-hidden="true"/> 自分の ベスト</h3>
        <div class="grid gap-2 sm:grid-cols-3">
          <p>タイム {{ bests.time ? (bests.time.elapsedTicks / 60).toFixed(2) + '秒' : '－' }}</p>
          <p>文字数 {{ bests.chars?.charCount ?? '－' }}字</p>
          <p>合計 {{ bests.overall ? bests.overall.elapsedTicks * bests.overall.charCount : '－' }}</p>
        </div>
      </div>
      <section v-if="apiBase" class="rounded-2xl border border-[#94b9ae] bg-[#e9f5ee] p-4">
        <template v-if="!savedName">
          <label for="ranking-nickname" class="mb-2 block text-sm font-black text-[#183f35]">ランキングの名前</label>
          <input id="ranking-nickname" v-model="nickname" :disabled="saving" :maxlength="16" type="text" class="w-full rounded-xl border-2 border-[#5b9c86] bg-white p-3 text-base font-semibold text-[#172439]" autocomplete="off" placeholder="名前なしなら ゲスト">
          <p class="mt-2 text-xs font-bold text-[#274d43]">本名は 書かないでね</p>
          <button type="button" :disabled="saving" class="game-button game-button--mint mt-3 text-sm disabled:opacity-50" @click="emit('register', nickname)"><Icon name="lucide:send" class="game-icon" aria-hidden="true"/>{{ saving ? '送っているよ…' : 'きろくを 送る' }}</button>
          <p v-if="saveError" role="alert" class="mt-3 text-sm font-black text-[#a53148]">{{ saveError }} もう一度 おしてね。</p>
        </template>
        <p v-else class="text-sm font-black text-[#155b44]">「{{ savedName }}」で とうろくできたよ！</p>
        <button type="button" class="game-button game-button--ghost mt-3 text-sm" @click="showRanking = !showRanking"><Icon name="lucide:list-ordered" class="game-icon" aria-hidden="true"/>{{ showRanking ? 'ランキングを とじる' : 'ランキングを 見る' }}</button>
      </section>
      <RankingPanel v-if="showRanking && apiBase" :stage-id="stageId" :stage-version="stageVersion" :api-base="apiBase" :refresh="rankingRefresh ?? 0" />
      <div class="mt-5 flex flex-wrap gap-3">
        <button type="button" class="game-button game-button--mint flex-1 text-base" @click="emit('next')"><Icon name="lucide:arrow-right" class="game-icon" aria-hidden="true"/>{{ hasNext ? '次へ' : 'ステージへ' }}</button>
        <button type="button" class="game-button game-button--ghost flex-1 text-base" @click="emit('close')"><Icon name="lucide:edit-3" class="game-icon" aria-hidden="true"/> コードを直す</button>
      </div>
    </div>
  </div>
</template>
