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
  router.push(next ? `/play/${next}` : "/");
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
  } catch {
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
  <div class="w-full">
    <header class="flex items-center gap-3 mb-3">
      <NuxtLink to="/" class="text-sm text-slate-600 hover:underline">
        ← ステージ選択へ
      </NuxtLink>
      <h1 class="text-xl font-extrabold text-slate-800">
        ステージ: {{ stageId }}
      </h1>
    </header>

    <div v-if="loading" class="text-gray-600">読み込み中…</div>
    <p v-else-if="loadError" class="text-red-600">{{ loadError }}</p>

    <section v-else-if="stage" class="grid gap-4 md:grid-cols-2">
      <div class="rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <CommandEditor
          :key="stageId"
          ref="editorRef"
          v-model:lines="editorLines"
          :dictionary="dict || undefined"
          @run="onRun"
        />
      </div>

      <div class="rounded-2xl border border-lime-200 bg-lime-50 p-4">
        <GameCanvas
          :key="stageId"
          :stage="stage"
          :program="program"
          :running="running"
          @clear="onClear"
          @fail="onFail"
        />
      </div>
    </section>

    <StageFailModal
      v-if="failed && failInfo"
      :reason="failInfo.reason"
      :hint="failInfo.hint"
      @close="closeFail"
    />

    <StageClearModal
      v-if="cleared"
      :seconds="lastSeconds"
      :stage-id="String(stageId)"
      :stage-version="stageVersion"
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
