<script setup lang="ts">
import { ref } from "vue";
import { formatBestScore } from "~/scoring/display";
import type { BestRuns, ScoredRun } from "~/scoring/score";
import RankingPanel from "./RankingPanel.vue";

const props = defineProps<{
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
  (e: "close" | "next" | "map"): void;
  (e: "register", name: string): void;
}>();
const colors = ["#ffd777", "#f7a5a5", "#77d5c0", "#a2bdf9", "#f6e9a7", "#f7b8df"];
const confetti = Array.from({ length: 96 }, (_, index) => ({
  id: index,
  style: {
    left: `${(index * 47.37) % 100}%`,
    backgroundColor: colors[index % colors.length],
    width: `${6 + (index % 4) * 2}px`,
    height: `${9 + (index % 3) * 4}px`,
    borderRadius: index % 4 === 0 ? "50%" : "2px",
    "--drift": `${(index * 31) % 151 - 75}px`,
    "--spin": `${index % 2 ? -720 : 720}deg`,
    animationDelay: `${(index * 17) % 24 * 0.055}s`,
    animationDuration: `${2600 + (index * 83) % 1400}ms`,
  },
}));
const nickname = ref("");
const showRanking = ref(false);
function bestScore(kind: "time" | "chars" | "overall") {
  return formatBestScore(props.stageId, props.stageVersion, props.bests, kind);
}
</script>

<template>
  <div class="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-[#090e1d]/90 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ステージクリア" @click.self="emit('close')">
    <div class="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      <span v-for="piece in confetti" :key="piece.id" class="celebration-confetti" :style="piece.style" />
    </div>
    <div class="game-panel celebration-panel relative z-10 flex max-h-[calc(100dvh-24px)] w-[min(640px,96vw)] min-h-0 flex-col overflow-hidden p-0">
      <div class="celebration-glow pointer-events-none absolute inset-x-0 top-0 h-36" aria-hidden="true" />
      <div class="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-3 sm:px-7 sm:pt-6">
      <div class="celebration-header mb-5 flex items-center gap-4 rounded-2xl px-2 py-3">
        <div class="celebration-trophy relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#ffdc90] text-[#172439] shadow-[0_6px_0_#d19b42]"><Icon name="lucide:trophy" class="text-5xl" aria-hidden="true"/></div>
        <div>
          <p class="text-base font-black tracking-widest text-[#a65d16]">やったね！</p>
          <h2 class="game-heading celebration-title text-3xl text-[#172439] sm:text-4xl">ステージクリア！</h2>
        </div>
      </div>
      <div class="mb-4 grid grid-cols-2 gap-3">
        <div class="rounded-xl bg-[#e8f0f5] p-4"><p class="text-sm font-black text-[#41556e]">タイム</p><p class="text-2xl font-black text-[#172439]">{{ seconds.toFixed(1) }}<span class="ml-1 text-sm">秒</span></p></div>
        <div class="rounded-xl bg-[#e8f0f5] p-4"><p class="text-sm font-black text-[#41556e]">文字数</p><p class="text-2xl font-black text-[#172439]">{{ chars }}<span class="ml-1 text-sm">字</span></p></div>
      </div>
      <div v-if="scores" class="mb-4 rounded-2xl bg-[#fff0c6] p-3">
        <div class="grid grid-cols-3 gap-2" aria-label="3つの点数">
          <div v-for="item in [{ label: 'タイム', value: scores.time }, { label: '文字数', value: scores.chars }, { label: '総合', value: scores.overall }]" :key="item.label" class="rounded-xl bg-white p-2 text-center sm:p-3">
            <p class="text-xs font-black text-[#5c5470]">{{ item.label }}</p>
            <p class="break-all text-lg font-black text-[#172439] sm:text-2xl">{{ Math.round(item.value).toLocaleString('ja-JP') }}<span class="text-xs">点</span></p>
            <p v-if="item.value > 1000" class="text-xs font-black text-[#14684e]">1000点こえ！</p>
          </div>
        </div>
      </div>
      <div v-if="bests?.time || bests?.chars || bests?.overall" class="mb-4 rounded-xl border border-[#bccbd9] bg-[#f0f5f8] p-3 text-sm text-[#172439]">
        <h3 class="mb-2 flex items-center gap-2 font-black"><Icon name="lucide:medal" class="game-icon text-[#14684e]" aria-hidden="true"/> 自分の ベスト</h3>
        <div class="grid gap-2 sm:grid-cols-3">
          <p>タイム {{ bestScore('time') }}</p>
          <p>文字数 {{ bestScore('chars') }}</p>
          <p>総合 {{ bestScore('overall') }}</p>
        </div>
      </div>
      <section v-if="apiBase" class="rounded-2xl border border-[#94b9ae] bg-[#e9f5ee] p-4">
        <template v-if="!savedName">
          <label for="ranking-nickname" class="mb-2 block text-sm font-black text-[#183f35]">ランキングの名前</label>
          <input id="ranking-nickname" v-model="nickname" :disabled="saving" :maxlength="16" type="text" class="w-full rounded-xl border-2 border-[#5b9c86] bg-white p-3 text-base font-semibold text-[#172439]" autocomplete="off" placeholder="名前なしなら ゲスト">
          <p class="mt-2 text-xs font-bold text-[#274d43]">本名は 書かないでね</p>
          <p v-if="saveError" role="alert" class="mt-3 text-sm font-black text-[#a53148]">{{ saveError }} もう一度 おしてね。</p>
        </template>
        <p v-else class="text-sm font-black text-[#155b44]">「{{ savedName }}」で とうろくできたよ！</p>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="game-button game-button--ghost text-sm" @click="showRanking = !showRanking"><Icon name="lucide:list-ordered" class="game-icon" aria-hidden="true"/>{{ showRanking ? 'ランキングを とじる' : 'ランキングを 見る' }}</button>
          <button v-if="!savedName" type="button" :disabled="saving" class="game-button game-button--mint ml-auto text-sm disabled:opacity-50" @click="emit('register', nickname)"><Icon name="lucide:send" class="game-icon" aria-hidden="true"/>{{ saving ? '送っているよ…' : 'きろくを 送る' }}</button>
        </div>
      </section>
      <RankingPanel v-if="showRanking && apiBase" :stage-id="stageId" :stage-version="stageVersion" :api-base="apiBase" :refresh="rankingRefresh ?? 0" />
      </div>
      <div class="relative z-10 shrink-0 border-t-2 border-[#c2cdd4] bg-[#fffaf1] px-4 py-3 sm:px-7"> 
      <div class="flex flex-wrap gap-3">
        <button type="button" class="game-button game-button--ghost flex-1 text-base" @click="emit('map')"><Icon name="lucide:map" class="game-icon" aria-hidden="true"/> マップへ</button>
        <button type="button" class="game-button game-button--mint flex-1 text-base" @click="emit('next')"><Icon name="lucide:arrow-right" class="game-icon" aria-hidden="true"/>{{ hasNext ? '次へ' : 'ステージへ' }}</button>
      </div>
      <button type="button" class="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 py-1 text-sm font-black text-[#405978] hover:bg-[#e8f0f5]" @click="emit('close')"><Icon name="lucide:edit-3" class="game-icon" aria-hidden="true"/> コードを直す</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.celebration-panel {
  border: 3px solid #ffd777;
  box-shadow: 0 0 0 5px rgb(255 219 122 / 13%), 0 30px 95px rgb(0 0 0 / 46%);
  animation: celebration-enter 560ms cubic-bezier(.18, 1.3, .3, 1) both;
}
.celebration-glow {
  background: radial-gradient(ellipse at 50% 0%, #fff2bc 0%, rgb(255 221 133 / 56%) 35%, transparent 78%);
}
.celebration-header {
  background: linear-gradient(100deg, #fff1c7, #fff9ec 62%, #d2f2e5);
}
.celebration-trophy {
  animation: celebration-trophy 850ms cubic-bezier(.2, 1.5, .3, 1) both;
}
.celebration-title {
  text-shadow: 2px 3px 0 rgb(255 205 112 / 60%);
}
.celebration-confetti {
  position: absolute;
  top: 0;
  display: block;
  box-shadow: 0 1px 3px rgb(0 0 0 / 16%);
  opacity: 0;
  animation-name: celebration-fall;
  animation-fill-mode: both;
  animation-timing-function: cubic-bezier(.27, .53, .47, 1);
}
@keyframes celebration-enter {
  0% { transform: translateY(30px) scale(.9); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes celebration-trophy {
  0% { transform: translateY(-35px) rotate(-19deg) scale(.45); opacity: 0; }
  70% { transform: translateY(5px) rotate(10deg) scale(1.14); opacity: 1; }
  100% { transform: translateY(0) rotate(0) scale(1); opacity: 1; }
}
@keyframes celebration-fall {
  0% { transform: translate3d(0, -12vh, 0) rotate(0); opacity: 0; }
  8% { opacity: 1; }
  80% { opacity: .95; }
  100% { transform: translate3d(var(--drift), 109vh, 0) rotate(var(--spin)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .celebration-panel, .celebration-trophy { animation: none; }
  .celebration-confetti { display: none; }
}
</style>
