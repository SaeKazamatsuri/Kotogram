<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CommandEditor from "~/components/editor/CommandEditor.vue";
import GameCanvas from "~/components/game/GameCanvas.vue";
import StageClearModal from "~/components/game/StageClearModal.vue";
import StageFailModal from "~/components/game/StageFailModal.vue";
import StatsSummaryModal from "~/components/game/StatsSummaryModal.vue";
import { useParser, type Rule } from "~/composables/useParser";
import type { StageData } from "~/composables/useStageLoader";
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
const { loadStage, getManifest } = useStageLoader();
const { loadDictionary } = useDictionary();
const { stageStart, stageClear, getAll, isCleared } = useStats();
const { parseProgram } = useParser();

const stage = ref<StageData | null>(null);
const dict = ref<Dictionary | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const editorRef = ref<InstanceType<typeof CommandEditor> | null>(null);
const editorLines = ref<string[]>([]);
const program = ref<Rule[] | undefined>(undefined);
const running = ref(false);
const cleared = ref(false);
const failed = ref(false);
const failInfo = ref<{ reason: FailReason; hint: string } | null>(null);
const lastSeconds = ref(0);
const unlocked = ref(true);

function stageIndexFromId(id: string): number | null {
  const match = id.match(/^stage-(\d+)$/);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return Number.isNaN(index) ? null : index;
}

function isStageUnlocked(id: string): boolean {
  if (typeof window === "undefined") return true;
  const index = stageIndexFromId(id);
  if (!index || index <= 1) return true;
  return isCleared(`stage-${index - 1}`);
}

function goNext() {
  if (stageId.value === "stage-1") router.push("/play/stage-2");
  else if (stageId.value === "stage-2") router.push("/play/stage-3");
  else router.push("/");
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

onMounted(async () => {
  loading.value = true;
  unlocked.value = isStageUnlocked(stageId.value);
  if (!unlocked.value) {
    loading.value = false;
    router.replace("/");
    return;
  }
  try {
    const [manifest, stageData] = await Promise.all([
      getManifest(),
      loadStage(stageId.value),
    ]);
    stage.value = stageData;
    dict.value = await loadDictionary({
      version: manifest.version,
      ttlMs: 24 * 3600 * 1000,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "読み込みに失敗しました";
    loadError.value = message;
    stage.value = { goal: 800, scrollSpeed: 2.5 };
    dict.value = { conditions: {}, actions: {} };
  } finally {
    loading.value = false;
    running.value = false;
  }
});

function onRun() {
  try {
    program.value = parseProgram(editorLines.value, dict.value ?? { conditions: {}, actions: {} });
  } catch {
    program.value = [];
  }
  failed.value = false;
  failInfo.value = null;
  cleared.value = false;
  stageStart(stageId.value);
  running.value = true;
}

function onClear() {
  running.value = false;
  failed.value = false;
  failInfo.value = null;
  const rawText = editorRef.value?.getText() ?? "";
  const chars = rawText.replace(/\r?\n/g, "").length;
  const result = stageClear(stageId.value, chars);
  lastSeconds.value = result.seconds;
  cleared.value = true;
}

function onFail(payload: FailPayload) {
  running.value = false;
  const hint = resolveHint(payload.reason);
  failInfo.value = { reason: payload.reason, hint };
  failed.value = true;
}

watch(stageId, (value) => {
  unlocked.value = isStageUnlocked(value);
  if (!unlocked.value) router.replace("/");
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
          ref="editorRef"
          :dictionary="dict || undefined"
          v-model:lines="editorLines"
          @run="onRun"
        />
      </div>

      <div class="rounded-2xl border border-lime-200 bg-lime-50 p-4">
        <GameCanvas
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
      @close="cleared = false"
      @next="goNext"
    />
    <StatsSummaryModal
      v-if="cleared && stageId === 'stage-3'"
      :all="getAll()"
      @close="cleared = false"
    />
  </div>
</template>
