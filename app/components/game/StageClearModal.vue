<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { getKeyboardExpanded, setKeyboardExpanded } from "~/editor/keyboard-preferences";
import KanaKeyboard from "~/components/editor/KanaKeyboard.vue";
import { editNicknameWithSoftKey } from "~/ranking/nickname-input";
import type { SoftKey } from "~/editor/text-input";
import { formatBestScore } from "~/scoring/display";
import { classifyStrategy } from "~/scoring/score";
import type { BestRuns, ScoredRun } from "~/scoring/score";
import type { MasteryResult } from "~/stage/mastery";
import type { ObjectiveProgress } from "~/scoring/objectives";
import RankingPanel from "./RankingPanel.vue";

const props = defineProps<{
  seconds: number;
  firstLesson?: boolean;
  source?: string;
  stageId: string;
  stageVersion: string;
  hasNext: boolean;
  chars: number;
  mastery?: MasteryResult | null;
  objectives?: ObjectiveProgress | null;
  goalChoice?: { label: string; bonusBp: number } | null;
  scores?: { time: number; chars: number; overall: number } | null;
  bests?: BestRuns<ScoredRun>;
  apiBase?: string;
  saving?: boolean;
  savedName?: string;
  saveError?: string;
  rankingRefresh?: number;
}>();
const emit = defineEmits<{
  (e: "close" | "next" | "map" | "practice"): void;
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
const nicknameInput = ref<HTMLInputElement | null>(null);
const keyboardVisible = ref(false);
onMounted(() => {
  keyboardVisible.value = getKeyboardExpanded("nickname");
});
function toggleKeyboard() {
  keyboardVisible.value = !keyboardVisible.value;
  setKeyboardExpanded("nickname", keyboardVisible.value);
}
const showRanking = ref(false);
const page = ref(0);
const detailsOpen = ref(false);
const scrollArea = ref<HTMLElement | null>(null);
function selectPage(value: number) {
  page.value = Math.max(0, Math.min(2, value));
  void nextTick(() => {
    scrollArea.value?.scrollTo({ top: 0 });
  });
}
const stepNames = ["クリア", "ふりかえり", "きろく"];

function onNicknameKey(key: SoftKey) {
  if (props.saving || props.savedName) return;
  const input = nicknameInput.value;
  const selection = { text: nickname.value, start: input?.selectionStart ?? nickname.value.length, end: input?.selectionEnd ?? nickname.value.length };
  const updated = editNicknameWithSoftKey(selection, key);
  nickname.value = updated.text;
  void nextTick(() => {
    if (!input || input !== nicknameInput.value) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(updated.start, updated.end);
  });
}
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
      <div ref="scrollArea" class="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-4 sm:px-7 sm:pt-6">
        <nav class="mb-4 grid grid-cols-3 gap-1.5" aria-label="クリアしたあとにすること">
          <button v-for="(name, index) in stepNames" :key="name" type="button"
            class="flex min-h-10 flex-col items-center justify-center rounded-lg px-1 py-1 text-xs font-black sm:text-sm"
            :class="page === index ? 'bg-[#244b43] text-white' : 'bg-[#e8eef3] text-[#43556b]'"
            :aria-current="page === index ? 'step' : undefined"
            @click="selectPage(index)">
            <span class="text-[11px]">{{ index + 1 }} / 3</span>{{ name }}
          </button>
        </nav>

        <section v-if="page === 0" aria-label="クリアをよろこぶ" class="flex min-h-[260px] flex-col justify-center">
          <div class="celebration-header mb-5 flex items-center gap-3 rounded-2xl px-3 py-4">
            <div class="celebration-trophy flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#ffdc90] text-[#172439] shadow-[0_6px_0_#d19b42]">
              <Icon name="lucide:trophy" class="text-4xl" aria-hidden="true"/>
            </div>
            <div>
              <p class="text-base font-black text-[#a65d16]">やったね！</p>
              <h2 class="game-heading celebration-title text-2xl text-[#172439] sm:text-4xl">ステージクリア！</h2>
            </div>
          </div>
          <p class="mb-4 text-center text-base font-black text-[#29475a]">書いた ことばで ゴールできたよ！</p>
          <div class="grid grid-cols-2 gap-3" aria-label="クリアしたきろく">
            <div class="rounded-xl bg-[#e8f0f5] p-3 text-center">
              <p class="text-sm font-black text-[#41556e]">タイム</p>
              <p class="text-2xl font-black text-[#172439]">{{ seconds.toFixed(1) }}<span class="ml-1 text-sm">秒</span></p>
            </div>
            <div class="rounded-xl bg-[#e8f0f5] p-3 text-center">
              <p class="text-sm font-black text-[#41556e]">文字数</p>
              <p class="text-2xl font-black text-[#172439]">{{ chars }}<span class="ml-1 text-sm">字</span></p>
            </div>
          </div>
        </section>

        <section v-else-if="page === 1" aria-label="クリアをふりかえる" class="flex min-h-[260px] flex-col justify-center">
          <div v-if="firstLesson" class="space-y-3">
            <h2 class="game-heading text-xl text-[#172439] sm:text-2xl">ことばを みじかく できるよ！</h2>
            <p class="font-bold text-[#29475a]">書いた ことば</p>
            <p class="break-all whitespace-pre-wrap rounded-xl bg-[#eef2f6] p-3 text-sm font-black text-[#20344c]">{{ source }}</p>
            <p class="text-center text-sm font-black text-[#23765c]">おなじ うごき ↓</p>
            <p class="rounded-xl bg-[#daf1e4] p-3 text-center text-2xl font-black text-[#174b36]">かべとぶ</p>
            <p class="text-sm font-bold leading-relaxed text-[#29475a]">どちらも かべで とぶ ことば。みじかい コードも ためしてみよう！</p>
            <button type="button" class="game-button game-button--mint w-full" @click="emit('practice')">
              <Icon name="lucide:edit-3" class="game-icon" aria-hidden="true"/> みじかく 書いて ためす
            </button>
          </div>
          <div v-else class="space-y-4">
            <h2 class="game-heading text-xl text-[#172439] sm:text-2xl">今回の てんすう</h2>
            <div v-if="scores" class="rounded-2xl bg-[#fff0c6] p-3">
              <div class="grid grid-cols-3 gap-2" aria-label="3つの点数">
                <div v-for="item in [{ label: 'タイム', value: scores.time }, { label: '文字数', value: scores.chars }, { label: '総合', value: scores.overall }]" :key="item.label" class="rounded-xl bg-white p-2 text-center">
                  <p class="text-xs font-black text-[#5c5470]">{{ item.label }}</p>
                  <p class="break-all text-lg font-black text-[#172439] sm:text-2xl">{{ Math.round(item.value).toLocaleString('ja-JP') }}<span class="text-xs">点</span></p>
                  <p v-if="item.value > 1000" class="text-xs font-black text-[#14684e]">1000点こえ！</p>
                </div>
              </div>
            </div>
            <p v-if="scores" class="rounded-xl bg-[#e6f0f2] p-3 text-sm font-black text-[#29475a]">
              <template v-if="classifyStrategy(scores) === 'speed'">はやく ゴールできたね！ つぎは みじかい コードにも ちょうせん！</template>
              <template v-else-if="classifyStrategy(scores) === 'compact'">みじかい コードで クリア！ つぎは はやさにも ちょうせん！</template>
              <template v-else>いい クリアだね！ いろいろな 書きかたを ためそう！</template>
            </p>
            <p v-else class="text-sm font-bold text-[#29475a]">ゴールできたね！ ほかの 書きかたも ためせるよ。</p>
          </div>
        </section>

        <section v-else aria-label="きろくをのこす" class="space-y-3">
          <h2 class="game-heading text-xl text-[#172439] sm:text-2xl">きろくを のこそう</h2>
          <p class="text-sm font-bold text-[#3c5468]">名前を 書かなくても 次へ すすめるよ。</p>
          <section v-if="apiBase" class="rounded-2xl border border-[#94b9ae] bg-[#e9f5ee] p-3">
            <template v-if="!savedName">
              <label for="ranking-nickname" class="mb-2 block text-sm font-black text-[#183f35]">ランキングの名前</label>
              <input id="ranking-nickname" ref="nicknameInput" :value="nickname" :disabled="saving" :maxlength="16" type="text" readonly inputmode="none" class="w-full rounded-xl border-2 border-[#5b9c86] bg-white p-3 text-base font-semibold text-[#172439]" autocomplete="off" placeholder="名前なしなら ゲスト">
              <button type="button" class="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-[#81aa9a] bg-white px-3 text-sm font-black text-[#214c40]"
                aria-controls="ranking-kana-keyboard" :aria-expanded="keyboardVisible" @click="toggleKeyboard">
                <span class="flex items-center gap-2"><Icon name="lucide:keyboard" class="game-icon" aria-hidden="true"/> かな入力</span>
                <Icon :name="keyboardVisible ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="game-icon" aria-hidden="true"/>
              </button>
              <div v-if="keyboardVisible" id="ranking-kana-keyboard" class="mt-2"><KanaKeyboard mode="nickname" :disabled="saving" @press="onNicknameKey"/></div>
              <p class="mt-2 text-xs font-bold text-[#274d43]">本名は 書かないでね</p>
              <p v-if="saveError" role="alert" class="mt-2 text-sm font-black text-[#a53148]">{{ saveError }} もう一度 おしてね。</p>
            </template>
            <p v-else class="text-sm font-black text-[#155b44]">「{{ savedName }}」で とうろくできたよ！</p>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button type="button" class="game-button game-button--ghost text-sm" @click="showRanking = !showRanking">
                <Icon name="lucide:list-ordered" class="game-icon" aria-hidden="true"/>{{ showRanking ? "ランキングを とじる" : "ランキングを 見る" }}
              </button>
              <button v-if="!savedName" type="button" :disabled="saving" class="game-button game-button--mint text-sm disabled:opacity-50" @click="emit('register', nickname)">
                <Icon name="lucide:send" class="game-icon" aria-hidden="true"/>{{ saving ? "送っているよ…" : "きろくを 送る" }}
              </button>
            </div>
          </section>
          <RankingPanel v-if="showRanking && apiBase" :stage-id="stageId" :stage-version="stageVersion" :api-base="apiBase" :refresh="rankingRefresh ?? 0" />
          <button type="button" class="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#a9bdc9] bg-[#edf3f6] px-4 text-sm font-black text-[#29475a]" :aria-expanded="detailsOpen" @click="detailsOpen = !detailsOpen">
            くわしい 点数と ベスト <Icon :name="detailsOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="game-icon" aria-hidden="true"/>
          </button>
          <div v-if="detailsOpen" class="space-y-3 rounded-xl bg-[#f0f5f8] p-3 text-sm font-bold text-[#21344d]">
            <div v-if="scores" aria-label="3つの点数">
              <p>タイム {{ Math.round(scores.time).toLocaleString('ja-JP') }} 点</p>
              <p>文字数 {{ Math.round(scores.chars).toLocaleString('ja-JP') }} 点</p>
              <p>総合 {{ Math.round(scores.overall).toLocaleString('ja-JP') }} 点</p>
            </div>
            <div v-if="bests?.time || bests?.chars || bests?.overall">
              <h3 class="font-black">自分の ベスト</h3>
              <p>タイム {{ bestScore('time') }}</p>
              <p>文字数 {{ bestScore('chars') }}</p>
              <p>総合 {{ bestScore('overall') }}</p>
            </div>
            <div v-if="goalChoice" aria-label="えらんだゴール">
              <p>{{ goalChoice.label }}ゴールに とうちゃく！</p>
              <p>ゴールの 点数倍率は {{ Math.round(goalChoice.bonusBp / 100) }}%</p>
            </div>
            <div v-if="mastery && (mastery.loopChallenge || mastery.secretFound)">
              <p v-if="mastery.loopChallenge">{{ mastery.repeatUsed ? 'くりかえしで クリア！' : '次は くりかえしでも クリアしてみよう' }}</p>
              <p v-if="mastery.secretFound">ひみつの 近道を みつけた！</p>
            </div>
            <div v-if="objectives && (objectives.coinTarget || objectives.skipTarget || objectives.secretDoorRiskBp)">
              <p v-if="objectives.coinTarget">コイン {{ objectives.collected }}/{{ objectives.coinTarget }}</p>
              <p v-if="objectives.skipTarget">見送った ボタン {{ objectives.skipped }}/{{ objectives.skipTarget }}</p>
              <p v-if="objectives.secretDoorRiskBp">ひみつのわざの 点数倍率 {{ Math.round(objectives.secretDoorRiskBp / 100) }}%</p>
              <p>合計の 点数倍率 {{ Math.round(objectives.completionBp / 100) }}%</p>
            </div>
          </div>
        </section>
      </div>

      <div class="relative z-10 shrink-0 border-t-2 border-[#c2cdd4] bg-[#fffaf1] px-4 py-3 sm:px-7">
        <div class="mb-2 flex items-center justify-between gap-2">
          <button v-if="page > 0" type="button" class="min-h-10 rounded-lg px-3 text-sm font-black text-[#405978]" @click="selectPage(page - 1)">
            <Icon name="lucide:chevron-left" class="game-icon" aria-hidden="true"/> もどる
          </button>
          <span v-else class="text-xs font-black text-[#6b7786]">1 / 3</span>
          <button v-if="page < 2" type="button" class="game-button game-button--mint text-sm" @click="selectPage(page + 1)">
            {{ page === 0 ? 'ふりかえる' : 'きろくを 見る' }} <Icon name="lucide:chevron-right" class="game-icon" aria-hidden="true"/>
          </button>
          <span v-else class="text-xs font-black text-[#6b7786]">3 / 3</span>
        </div>
        <div class="flex gap-2">
          <button type="button" class="game-button game-button--ghost min-w-0 flex-1 text-sm sm:text-base" @click="emit('map')">
            <Icon name="lucide:map" class="game-icon" aria-hidden="true"/> マップへ
          </button>
          <button type="button" class="game-button game-button--mint min-w-0 flex-1 text-sm sm:text-base" @click="emit('next')">
            <Icon name="lucide:arrow-right" class="game-icon" aria-hidden="true"/>{{ hasNext ? '次へ' : 'ステージへ' }}
          </button>
        </div>
        <button type="button" class="mt-1 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 py-1 text-sm font-black text-[#405978]" @click="emit('close')">
          <Icon name="lucide:edit-3" class="game-icon" aria-hidden="true"/> コードを直す
        </button>
      </div>
    </div>
  </div>
</template>
        <template v-else-if="classifyStrategy(scores) === 'compact'">みじかいコードで クリア！</template>
        <template v-else>バランスよく クリア！</template>
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
          <input id="ranking-nickname" ref="nicknameInput" :value="nickname" :disabled="saving" :maxlength="16" type="text" readonly inputmode="none" class="w-full rounded-xl border-2 border-[#5b9c86] bg-white p-3 text-base font-semibold text-[#172439]" autocomplete="off" placeholder="名前なしなら ゲスト">
          <button type="button" class="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-[#81aa9a] bg-white px-4 text-sm font-black text-[#214c40] hover:bg-[#f1faf4]" aria-controls="ranking-kana-keyboard" :aria-expanded="keyboardVisible" @click="toggleKeyboard"><span class="flex items-center gap-2"><Icon name="lucide:keyboard" class="game-icon" aria-hidden="true" /> かな入力</span><Icon :name="keyboardVisible ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="game-icon" aria-hidden="true" /></button>
          <div v-if="keyboardVisible" id="ranking-kana-keyboard" class="mt-2"><KanaKeyboard mode="nickname" :disabled="saving" @press="onNicknameKey" /></div>
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
