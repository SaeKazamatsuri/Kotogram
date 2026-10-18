<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CommandEditor from "~/components/editor/CommandEditor.vue";
import GameCanvas from "~/components/game/GameCanvas.vue";
import StageClearModal from "~/components/game/StageClearModal.vue";
import StageFailModal from "~/components/game/StageFailModal.vue";
import { calculateScores, countSourceCharacters, getScoreReference, type BestRuns, type ScoredRun } from "~/scoring/score";
import { createScope, getOrCreatePlayerId, RankingClient, type RunSubmission } from "~/ranking/client";
import { useParser } from "~/composables/useParser";
import type { GameProgram } from "~/game/core";
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
const editorLines = ref<string[]>([]);
const program = ref<GameProgram | undefined>(undefined);
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
}

async function loadCurrentStage() {
  const request = ++loadRequest;
  sessionGeneration++;
  const id = stageId.value;
  loading.value = true;
  stage.value = null;
  loadError.value = null;
  running.value = false;
  cleared.value = false;
  failed.value = false;
  failInfo.value = null;
  lastRun.value = null;
  saving.value = false;
  scoreValues.value = null;
  bests.value = {};
  program.value = undefined;
  editorLines.value = [];
  savedName.value = "";
  saveError.value = "";
  pendingRunId = "";
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
      loadDictionary({ version: manifest.version, ttlMs: 24 * 3600 * 1000 }),
    ]);
    if (request !== loadRequest) return;
    stage.value = stageData;
    stageVersion.value = manifest.version ?? "unknown";
    dict.value = dictionary;
  } catch (error: unknown) {
    if (request !== loadRequest) return;
    loadError.value = error instanceof Error ? error.message : "読み込みに失敗しました";
  } finally {
    if (request === loadRequest) loading.value = false;
  }
}

onMounted(() => { void loadCurrentStage(); });


function onRun() {
  const result = parseProgram(editorLines.value, dict.value ?? { conditions: {}, actions: {} });
  if (result.diagnostics.length > 0) {
    running.value = false;
    return;
  }
  sessionGeneration++;
  program.value = result.program;
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
}

function onClear(timing: { elapsedTicks: number; seconds: number }) {
  running.value = false;
  failed.value = false;
  failInfo.value = null;
  const rawText = editorRef.value?.getText() ?? "";
  const chars = countSourceCharacters(rawText);
  const reference = getScoreReference(stageId.value, stageVersion.value);
  const result = stageClear(stageId.value, chars, timing.seconds, timing.elapsedTicks, rawText, stageVersion.value);
  lastSeconds.value = result.seconds;
  lastChars.value = chars;
  lastRun.value = { source: rawText, elapsedTicks: timing.elapsedTicks, charCount: chars };
  scoreValues.value = reference ? calculateScores(reference, { elapsedTicks: timing.elapsedTicks, charCount: chars }) : null;
  bests.value = getBestRecords(stageId.value, stageVersion.value);
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
    window.localStorage.setItem("kotogram.nickname", saved.nickname);
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
}

watch(stageId, () => {
  if (import.meta.client) void loadCurrentStage();
});
</script>

<template>
  <div class="scene-enter mx-auto max-w-[1450px] pb-12">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <NuxtLink to="/stages" class="game-button game-button--night text-sm">← ステージ選択へ</NuxtLink>
      <div class="flex items-center gap-3">
        <span class="game-chip">STAGE {{ String(stageNumber).padStart(2, '0') }} / {{ stageItems.length || '—' }}</span>
        <span class="game-chip" role="status" aria-live="polite">{{ running ? '● うごいているよ' : cleared ? '★ クリア！' : failed ? '！もういちど' : '● じゅんびOK' }}</span>
      </div>
    </div>

    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="game-kicker mb-2">YOUR NEXT QUEST</p>
        <h1 class="game-heading text-3xl text-[#fff7e8] md:text-4xl">{{ stage?.meta?.title || 'ステージ ' + stageNumber }}</h1>
      </div>
      <p class="max-w-md text-sm font-bold leading-relaxed text-[#cbd6e8]">ひらがなで めいれいを かいて、ゴールを めざそう！</p>
    </div>

    <div v-if="loading" role="status" class="game-panel-dark p-8">ステージを じゅんびしているよ…</div>
    <div v-else-if="loadError" role="alert" class="game-panel bg-[#fff4e6] p-8 text-[#a63647]">{{ loadError }}</div>

    <div v-else-if="stage" class="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(400px,0.95fr)_minmax(0,1.2fr)]">
      <section class="order-2 min-w-0 space-y-5 xl:order-1" aria-label="プログラムそうさ">
        <div class="game-panel overflow-hidden">
          <CommandEditor
            :key="stageId"
            ref="editorRef"
            v-model:lines="editorLines"
            :dictionary="dict || undefined"
            @run="onRun"
          />
        </div>
        <section class="game-panel-dark p-5" aria-label="ステージのもくひょう">
          <div class="mb-3 flex items-center gap-3">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffcd77] text-xl text-[#1e2740]" aria-hidden="true">✦</span>
            <div><p class="text-[11px] font-black tracking-widest text-[#87e7cc]">MISSION</p><h2 class="font-black">このステージで まなぶこと</h2></div>
          </div>
          <ul v-if="stage.learningObjectives?.length" class="space-y-2 text-sm font-bold leading-relaxed text-[#e7e9f2]">
            <li v-for="(objective, index) in stage.learningObjectives" :key="index" class="flex items-start gap-2"><span class="text-[#ffcd77]" aria-hidden="true">◇</span>{{ objective }}</li>
          </ul>
          <p v-else class="text-sm text-[#e3e9f6]">めいれいを かいて ゴールを めざそう</p>
          <details v-if="stage.meta?.hint" class="mt-4 rounded-xl border border-[#656e90] bg-[#161f38] p-3 text-sm text-[#fff7e8]">
            <summary class="cursor-pointer font-bold">？ ヒントを みる</summary>
            <p class="mt-3 leading-relaxed">{{ stage.meta.hint }}</p>
          </details>
        </section>
      </section>
      <section class="order-1 min-w-0 overflow-hidden rounded-[30px] border-[3px] border-[#67769a] bg-[#202b4c] shadow-[0_9px_0_#0a1022] xl:order-2" aria-label="ゲームフィールド">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#49567b] bg-[#242e4c] px-5 py-3">
          <span class="text-xs font-black tracking-[.18em] text-[#ffcd77]">WORLD VIEW</span>
          <span class="rounded-full bg-[#131b34] px-3 py-1 text-xs font-bold text-[#e8ebf5]">{{ running ? '▶ プレイちゅう' : '▶ スタートを おしてね' }}</span>
        </div>
        <div class="p-2 sm:p-3">
          <GameCanvas
            :key="stageId"
            :stage="stage"
            :program="program"
            :running="running"
            @clear="onClear"
            @fail="onFail"
          />
        </div>
        <div class="flex items-center justify-between gap-3 border-t-2 border-[#49567b] bg-[#202a48] px-5 py-3 text-xs font-bold text-[#d6deeb]">
          <span>★ なんどでも ためせるよ</span><span>GOAL →</span>
        </div>
      </section>
    </div>

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
      @close="cleared = false"
      @next="goNext"
      @register="onRegister"
    />
  </div>
</template>
