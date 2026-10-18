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
  <div class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#080c21]/85 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ステージクリア" @click.self="emit('close')">
    <div class="game-panel relative my-5 w-[min(680px,96vw)] max-h-[94vh] overflow-y-auto border-[#ffcd77] bg-[#fff9e9] p-5 shadow-[0_12px_0_#11162b] sm:p-8">
      <div class="pointer-events-none absolute -right-3 -top-5 rotate-12 text-7xl text-[#ffce72]" aria-hidden="true">✦</div>
      <p class="game-kicker text-[#557b6c]">MISSION COMPLETE</p>
      <div class="my-4 flex items-center gap-4">
        <span class="flex h-20 w-20 shrink-0 items-center justify-center rounded-[25px] border-[3px] border-[#2e3450] bg-[#ffcd77] text-5xl shadow-[0_5px_0_#2e3450]" aria-hidden="true">★</span>
        <div>
          <h2 class="game-heading text-3xl text-[#26344e] sm:text-4xl">ステージクリア！</h2>
          <p class="mt-1 text-sm font-bold text-[#647083]">じぶんの コードで ゴールしたよ！</p>
        </div>
      </div>
      <div class="mb-5 grid grid-cols-2 gap-3">
        <div class="rounded-2xl border-2 border-[#c7d4df] bg-[#e9f5fa] p-3"><p class="text-xs font-bold text-[#576a7b]">タイム</p><p class="text-2xl font-black text-[#26354e]">{{ seconds.toFixed(1) }}<span class="ml-1 text-sm">びょう</span></p></div>
        <div class="rounded-2xl border-2 border-[#c7d4df] bg-[#e9f5fa] p-3"><p class="text-xs font-bold text-[#576a7b]">コード</p><p class="text-2xl font-black text-[#26354e]">{{ chars }}<span class="ml-1 text-sm">もじ</span></p></div>
      </div>
      <div v-if="scores" class="mb-5 rounded-[22px] border-2 border-[#e2cfa7] bg-[#fff1cb] p-3">
        <p class="mb-2 pl-1 text-xs font-black tracking-widest text-[#735724]">YOUR SCORE</p>
        <div class="grid grid-cols-3 gap-2" aria-label="3しゅるいのスコア">
          <div v-for="item in [
            { label: 'タイム', value: scores.time },
            { label: 'もじすう', value: scores.chars },
            { label: 'そうごう', value: scores.overall },
          ]" :key="item.label" class="rounded-xl border border-[#e0c795] bg-white p-2 text-center sm:p-3">
            <p class="text-xs font-bold text-[#746747]">{{ item.label }}</p>
            <p class="break-all text-lg font-black text-[#35475a] sm:text-2xl">{{ Math.round(item.value).toLocaleString('ja-JP') }}<span class="text-xs">てん</span></p>
            <p v-if="item.value > 1000" class="mt-1 text-xs font-black text-[#2b8064]">★ 1000てん こえ！</p>
          </div>
        </div>
      </div>
      <p v-else class="mb-4 text-sm font-bold text-[#5f6c7b]">このステージの きじゅんてんを じゅんびちゅう</p>
      <div v-if="bests?.time || bests?.chars || bests?.overall" class="mb-5 rounded-2xl border-2 border-[#d4d7e2] bg-[#f6f4fa] p-4 text-sm text-[#39445b]">
        <p class="mb-2 font-black">★ このたんまつの じこベスト</p>
        <div class="grid gap-2 sm:grid-cols-3">
          <p>はやさ: {{ bests.time ? (bests.time.elapsedTicks / 60).toFixed(2) + 'びょう' : '－' }}</p>
          <p>みじかさ: {{ bests.chars?.charCount ?? '－' }}もじ</p>
          <p>そうごう: {{ bests.overall ? bests.overall.elapsedTicks * bests.overall.charCount : '－' }}</p>
        </div>
      </div>
      <section v-if="apiBase" class="rounded-2xl border-2 border-[#accabd] bg-[#ebf9f0] p-4">
        <template v-if="!savedName">
          <label for="ranking-nickname" class="mb-2 block text-sm font-black text-[#2b564f]">ランキングに のせる なまえ（かかなくてもOK）</label>
          <input id="ranking-nickname" v-model="nickname" :disabled="saving" :maxlength="16" type="text" class="w-full rounded-xl border-2 border-[#84b6a2] bg-white p-3 text-base font-semibold text-[#20223a]" autocomplete="off" placeholder="からなら ゲストの なまえ">
          <p class="my-2 text-xs font-bold text-[#496b62]">ほんとうの なまえや じゅうしょは かかないでね</p>
          <button type="button" :disabled="saving" class="game-button game-button--mint text-sm disabled:opacity-50" @click="emit('register', nickname)">{{ saving ? "とうろくちゅう…" : "きろくを とうろく" }}</button>
          <p v-if="saveError" role="alert" class="mt-3 text-sm font-bold text-[#b33551]">{{ saveError }} もういちど おしてね。</p>
        </template>
        <p v-else class="text-sm font-black text-[#2c6752]">「{{ savedName }}」で とうろくできたよ！</p>
        <button type="button" class="game-button game-button--ghost mt-3 text-sm" @click="showRanking = !showRanking">{{ showRanking ? 'ランキングを とじる' : 'ランキングを みる' }}</button>
      </section>
      <p v-else class="mb-3 text-sm font-bold text-[#657184]">オンラインランキングは じゅんびちゅう。たんまつの きろくは のこるよ。</p>
      <RankingPanel v-if="showRanking && apiBase" :stage-id="stageId" :stage-version="stageVersion" :api-base="apiBase" :refresh="rankingRefresh ?? 0" />
      <div class="mt-5 flex flex-wrap gap-3">
        <button type="button" class="game-button game-button--mint flex-1 text-base" @click="emit('next')">{{ hasNext ? "つぎへ" : "ステージえらびへ" }}</button>
        <button type="button" class="game-button game-button--ghost flex-1 text-base" @click="emit('close')">コードを なおす</button>
      </div>
    </div>
  </div>
</template>
