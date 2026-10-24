<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CommandEditor from "~/components/editor/CommandEditor.vue";
import GameCanvas from "~/components/game/GameCanvas.vue";
import StageClearModal from "~/components/game/StageClearModal.vue";
import StageFailModal from "~/components/game/StageFailModal.vue";
import { calculateScores, countSourceCharacters, getScoreReference, LANGUAGE_VERSION, type BestRuns, type ScoredRun } from "~/scoring/score";
import { createScope, getOrCreatePlayerId, RankingClient, type RunSubmission } from "~/ranking/client";
import { useParser } from "~/composables/useParser";
import { playSe, setBgm, stageBgmName, unlockAudio } from "~/game/audio";
import type { GameProgram } from "~/game/core";
import type { SourceMap } from "~/language/parser";
import type { SustainedHighlight } from "~/game/action-highlights";
import { stageMastery, type MasteryResult } from "~/stage/mastery";
import type { StageData, StageListItem } from "~/composables/useStageLoader";
import { canPlayStage, nextStageId } from "~/stage/progression";
import {
  defaultFailHint,
  type FailPayload,
  type FailReason,
} from "~/types/game";

type Dictionary = {
  conditions: Record<string, string[]>;
  actions: Record<string, string[]>;
};

const route = useRoute();
const router = useRouter();
const stageId = computed(() => String(route.params.stageId || "stage-1"));
const stageNumber = computed(() => Number(stageId.value.replace("stage-", "")) || 1);
const hintOpen = ref(false);
const rankingApiBase = String(useRuntimeConfig().public.rankingApiBase || "");
const { loadStage, getManifest } = useStageLoader();
const { loadDictionary } = useDictionary();
const { stageStart, stageClear, getBestRecords, isCleared } = useStats();
const { parseProgram } = useParser();

const stage = ref<StageData | null>(null);
const stageItems = ref<StageListItem[]>([]);
const dict = ref<Dictionary | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const editorRef = ref<InstanceType<typeof CommandEditor> | null>(null);
const editorPanel = ref<HTMLElement | null>(null);
const gamePanel = ref<HTMLElement | null>(null);
const editorLines = ref<string[]>([]);
const program = ref<GameProgram | undefined>(undefined);
const sourceMap = ref<SourceMap | undefined>(undefined);
const executionTrace = ref<{ active: number[]; sustained: SustainedHighlight[]; waiting: number | null; repeat: number | null; progress: string | null }>({ active: [], sustained: [], waiting: null, repeat: null, progress: null });
const mastery = ref<MasteryResult | null>(null);
const running = ref(false);
const cleared = ref(false);
const failed = ref(false);
const failInfo = ref<{ reason: FailReason; hint: string } | null>(null);
const lastSeconds = ref(0);
const lastChars = ref(0);
const scoreValues = ref<{ time: number; chars: number; overall: number } | null>(null);
const bests = ref<BestRuns<ScoredRun>>({});
const stageVersion = ref("2025-10-26");
const unlocked = ref(true);
const lastRun = ref<{ source: string; elapsedTicks: number; charCount: number } | null>(null);
const runningSource = ref("");
const saving = ref(false);
const savedName = ref("");
const saveError = ref("");
const rankingRefresh = ref(0);
let pendingRunId = "";
let loadRequest = 0;
let sessionGeneration = 0;

function goNext() {
  const next = nextStageId(stageId.value, stageItems.value);
  router.push(next ? `/play/${next}` : "/stages");
}

function goMap() {
  router.push("/stages");
}

function focusSmallScreenPanel(target: HTMLElement | null) {
  if (!import.meta.client || !target || !window.matchMedia("(max-width: 960px)").matches) return;
  target.scrollTo({ top: 0, behavior: "instant" });
}

function resolveHint(reason: FailReason): string {
  const meta = stage.value?.meta;
  const byReason = meta?.failHints?.[reason];
  if (typeof byReason === "string" && byReason.trim().length > 0) {
    return byReason;
  }
  const generic = meta?.hint;
  if (typeof generic === "string" && generic.trim().length > 0) {
    return generic;
  }
  return defaultFailHint(reason);
}

function closeFail() {
  failed.value = false;
  failInfo.value = null;
  setBgm(stageBgmName(stageId.value, "edit"));
  focusSmallScreenPanel(editorPanel.value);
}

function closeClear() {
  cleared.value = false;
  setBgm(stageBgmName(stageId.value, "edit"));
  focusSmallScreenPanel(editorPanel.value);
}

async function loadCurrentStage() {
  const request = ++loadRequest;
  sessionGeneration++;
  const id = stageId.value;
  loading.value = true;
  stage.value = null;
  loadError.value = null;
  hintOpen.value = false;
  running.value = false;
  cleared.value = false;
  failed.value = false;
  failInfo.value = null;
  lastRun.value = null;
  runningSource.value = "";
  saving.value = false;
  scoreValues.value = null;
  bests.value = {};
  program.value = undefined;
  sourceMap.value = undefined;
  executionTrace.value = { active: [], sustained: [], waiting: null, repeat: null, progress: null };
  editorLines.value = [];
  savedName.value = "";
  saveError.value = "";
  pendingRunId = "";
  setBgm(stageBgmName(stageId.value, "edit"));
  try {
    const manifest = await getManifest();
    if (request !== loadRequest) return;
    stageItems.value = manifest.stages;
    unlocked.value = canPlayStage(id, manifest.stages, isCleared);
    if (!unlocked.value) {
      router.replace("/");
      return;
    }
    const [stageData, dictionary] = await Promise.all([
      loadStage(id),
      loadDictionary({ version: LANGUAGE_VERSION, ttlMs: 24 * 3600 * 1000 }),
    ]);
    if (request !== loadRequest) return;
    stage.value = stageData;
    stageVersion.value = manifest.stages.find((item) => item.id === id)?.version ?? manifest.version ?? "unknown";
    dict.value = dictionary;
  } catch (error: unknown) {
    if (request !== loadRequest) return;
    loadError.value = error instanceof Error ? error.message : "読み込みに失敗しました";
  } finally {
    if (request === loadRequest) loading.value = false;
  }
}

onMounted(() => { void loadCurrentStage(); });
onBeforeUnmount(() => {
  sessionGeneration++;
  loadRequest++;
});


function onRun() {
  const result = parseProgram(editorLines.value, dict.value ?? { conditions: {}, actions: {} });
  if (result.diagnostics.length > 0) {
    running.value = false;
    unlockAudio();
    playSe("warning");
    return;
  }
  unlockAudio();
  setBgm(stageBgmName(stageId.value, "run"));
  playSe("start");
  sessionGeneration++;
  runningSource.value = editorRef.value?.getText() ?? editorLines.value.join("\n");
  program.value = result.program;
  sourceMap.value = result.sourceMap;
  executionTrace.value = { active: [], sustained: [], waiting: null, repeat: null, progress: null };
  mastery.value = null;
  failed.value = false;
  failInfo.value = null;
  cleared.value = false;
  lastRun.value = null;
  saving.value = false;
  savedName.value = "";
  saveError.value = "";
  pendingRunId = "";
  stageStart(stageId.value);
  running.value = true;
  focusSmallScreenPanel(gamePanel.value);
}

function onClear(timing: { elapsedTicks: number; seconds: number }) {
  running.value = false;
  failed.value = false;
  failInfo.value = null;
  const rawText = runningSource.value;
  mastery.value = stageMastery(stageId.value, rawText);
  const chars = countSourceCharacters(rawText);
  const reference = getScoreReference(stageId.value, stageVersion.value);
  const result = stageClear(stageId.value, chars, timing.seconds, timing.elapsedTicks, rawText, stageVersion.value);
  lastSeconds.value = result.seconds;
  lastChars.value = chars;
  try {
    window.sessionStorage.setItem("kotogram.recentClear", stageId.value);
  } catch {
    if (import.meta.dev) console.warn("Could not retain recent stage clear for map feedback");
  }
  lastRun.value = { source: rawText, elapsedTicks: timing.elapsedTicks, charCount: chars };
  scoreValues.value = reference ? calculateScores(reference, { elapsedTicks: timing.elapsedTicks, charCount: chars }) : null;
  bests.value = getBestRecords(stageId.value, stageVersion.value);
  setBgm("clear_loop");
  playSe("clear_fanfare");
  if (scoreValues.value && scoreValues.value.overall > 1000) playSe("score_bonus");
  cleared.value = true;
}

async function onRegister(nickname: string) {
  if (saving.value || savedName.value || !lastRun.value || !rankingApiBase) return;
  const session = sessionGeneration;
  saving.value = true;
  saveError.value = "";
  try {
    if (!pendingRunId) pendingRunId = crypto.randomUUID();
    const playerId = getOrCreatePlayerId(window.localStorage, () => crypto.randomUUID());
    const input: RunSubmission = {
      ...createScope(stageId.value, stageVersion.value),
      ...lastRun.value,
      runId: pendingRunId,
      playerId,
      nickname: nickname.trim(),
    };
    const saved = await new RankingClient(rankingApiBase).submit(input);
    if (session !== sessionGeneration) return;
    savedName.value = saved.nickname;
    try {
      window.localStorage.setItem("kotogram.nickname", saved.nickname);
    } catch {
      if (import.meta.dev) console.warn("Nickname could not be cached locally");
    }
    rankingRefresh.value++;
  } catch (error) {
    if (import.meta.dev) console.error("Ranking registration failed:", error instanceof Error ? error.message : "unknown error");
    if (session === sessionGeneration) saveError.value = "きろくを おくれなかったよ。";
  } finally {
    if (session === sessionGeneration) saving.value = false;
  }
}

function onFail(payload: FailPayload) {
  running.value = false;
  const hint = resolveHint(payload.reason);
  failInfo.value = { reason: payload.reason, hint };
  failed.value = true;
  setBgm("result_loop");
  playSe("gameover");
}

watch(stageId, () => {
  if (import.meta.client) void loadCurrentStage();
});
</script>

<template>
  <div class="play-screen scene-enter mx-auto w-full max-w-[1460px]">
    <div class="play-screen__navigation flex shrink-0 items-center justify-between gap-3">
      <NuxtLink to="/stages" class="game-button game-button--night text-sm"><Icon name="lucide:arrow-left" class="game-icon" aria-hidden="true"/> ステージへ</NuxtLink>
      <span class="game-chip" aria-label="ステージ番号">ステージ {{ stageNumber }} / {{ stageItems.length || '—' }}</span>
    </div>

    <h1 class="game-screen-title play-screen__title shrink-0">{{ stage?.meta?.title || 'ステージ ' + stageNumber }}</h1>
    <div v-if="loading" role="status" class="game-surface p-6">読みこみ中…</div>
    <div v-else-if="loadError" role="alert" class="game-surface-light flex flex-wrap items-center justify-between gap-4 p-6 text-[#a53148]">
      <p class="font-bold">ステージを読みこめませんでした</p>
      <button type="button" class="game-button game-button--night" @click="loadCurrentStage">もう一度 読みこむ</button>
    </div>

    <div v-else-if="stage" class="game-surface play-screen__surface min-h-0 flex-1 overflow-hidden">
      <div class="game-workspace game-workspace--stage h-full min-h-0 gap-0">
        <section ref="editorPanel" class="play-screen__editor min-h-0 min-w-0 overflow-y-auto border-b-2 border-[#647b9b] bg-[#243551] lg:border-b-0 lg:border-r-2" aria-label="コードを書く">
          <CommandEditor
            :key="stageId"
            ref="editorRef"
            v-model:lines="editorLines"
            :dictionary="dict || undefined"
            :running="running"
            :active-lines="executionTrace.active"
            :sustained-lines="executionTrace.sustained"
            :waiting-line="executionTrace.waiting"
            :repeat-line="executionTrace.repeat"
            :repeat-progress="executionTrace.progress"
            @run="onRun"
          />
        </section>
        <section ref="gamePanel" class="game-playview relative flex min-h-0 min-w-0 flex-col overflow-y-auto" aria-label="ゲーム画面">
          <span v-if="running" role="status" class="absolute right-5 top-5 z-10 rounded-full border border-[#aaf0d0] bg-[#172439] px-3 py-1 text-sm font-black text-[#aaf0d0]">動いているよ</span>
          <span v-if="!running" class="pointer-events-none absolute right-5 top-5 z-10 rounded-full border border-[#f8dca5] bg-[#172439] px-3 py-1 text-xs font-black text-[#fff0cf]">ドラッグで先を見る</span>
          <div class="flex min-h-0 flex-1 items-center p-3 sm:p-5">
            <GameCanvas
              :key="stageId"
              :stage="stage"
              :program="program"
              :running="running"
              :source-map="sourceMap"
              @trace="executionTrace = $event"
              @clear="onClear"
              @fail="onFail"
            />
          </div>
          <div v-if="stage.meta?.hint" class="border-t border-[#647b9b] px-4 py-3">
            <button type="button" class="flex min-h-9 items-center gap-2 rounded-xl px-3 text-sm font-black text-[#fffaf1] hover:bg-[#425575]" :aria-expanded="hintOpen" @click="hintOpen = !hintOpen">
              <Icon name="lucide:lightbulb" class="game-icon text-[#ffdc90]" aria-hidden="true"/> ヒント
              <Icon :name="hintOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="game-icon" aria-hidden="true"/>
            </button>
            <p v-if="hintOpen" class="mt-3 rounded-xl bg-[#17263f] p-4 text-sm font-bold leading-relaxed text-white">{{ stage.meta.hint }}</p>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <StageFailModal v-if="failed && failInfo" :reason="failInfo.reason" :hint="failInfo.hint" @close="closeFail" />
    <StageClearModal
      v-if="cleared"
      :seconds="lastSeconds"
      :stage-id="String(stageId)"
      :stage-version="stageVersion"
      :has-next="nextStageId(stageId, stageItems) !== null"
      :api-base="rankingApiBase"
      :saving="saving"
      :saved-name="savedName"
      :save-error="saveError"
      :ranking-refresh="rankingRefresh"
      :chars="lastChars"
      :scores="scoreValues"
      :bests="bests"
      :mastery="mastery"
      @close="closeClear"
      @next="goNext"
      @map="goMap"
      @register="onRegister"
    />
    </Teleport>
  </div>
</template>

<style scoped>
.play-screen {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.play-screen__navigation { margin-bottom: 10px; }
.play-screen__navigation .game-button { min-height: 42px; padding-block: 6px; }
.play-screen__title { margin-bottom: 10px; font-size: clamp(1.2rem, 2vw, 1.75rem); }
.play-screen__surface { min-height: 0; }
.game-workspace--stage {
  grid-template-columns: minmax(340px, .8fr) minmax(0, 1.2fr);
}
.play-screen__editor { overscroll-behavior: contain; }
.game-playview { overscroll-behavior: contain; }
.game-playview {
  background: radial-gradient(ellipse at 50% -10%, #41677a 0%, #263d58 52%, #1d2f4d 100%);
}
@media (max-width: 960px) {
  .game-workspace--stage {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1.15fr) minmax(0, .85fr);
  }
  .play-screen__navigation { margin-bottom: 6px; }
  .play-screen__title { margin-bottom: 6px; }
  .play-screen__editor { border-right: 0; }
  .game-playview { border-top: 2px solid #647b9b; }
}
</style>
