<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import CommandEditor from "~/components/editor/CommandEditor.vue";
import GameCanvas from "~/components/game/GameCanvas.vue";
import StageClearModal from "~/components/game/StageClearModal.vue";
import StatsSummaryModal from "~/components/game/StatsSummaryModal.vue";
import { useParser, type Rule } from "~/composables/useParser";

const route = useRoute();
const router = useRouter();
const stageId = computed(() => String(route.params.stageId || "stage-1"));
const { loadStage, getManifest } = useStageLoader();
const { loadDictionary } = useDictionary();
const { stageStart, stageClear, getAll } = useStats();
const { parseProgram } = useParser();

const stage = ref<any>(null);
const dict = ref<any>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const editorRef = ref<InstanceType<typeof CommandEditor> | null>(null);
const editorLines = ref<string[]>([]);
const program = ref<Rule[] | undefined>(undefined);

// ★ 実行フラグ（これで GameCanvas を制御）
const running = ref(false);

const cleared = ref(false);
const lastSeconds = ref<number>(0);

function goNext() {
  if (stageId.value === "stage-1") router.push("/play/stage-2");
  else if (stageId.value === "stage-2") router.push("/play/stage-3");
  else router.push("/");
}

onMounted(async () => {
  loading.value = true;
  try {
    const [m, st] = await Promise.all([
      getManifest(),
      loadStage(stageId.value),
    ]);
    stage.value = st;
    dict.value = await loadDictionary({
      version: m.version,
      ttlMs: 24 * 3600 * 1000,
    });
  } catch (e: any) {
    loadError.value = e?.message || "読み込みに失敗しました";
    stage.value = { goal: 800, scrollSpeed: 2.5 };
    dict.value = { conditions: {}, actions: {} };
  } finally {
    loading.value = false;
    running.value = false; // ★ 初期は停止
  }
});

function onRun() {
  try {
    program.value = parseProgram(editorLines.value, dict.value);
  } catch {
    program.value = [];
  }
  stageStart(stageId.value); // ★ 計測はRun時にスタート
  running.value = true; // ★ 実行開始
}

function onClear() {
  running.value = false;
  const chars = editorRef.value?.getText().length ?? 0;
  const rec = stageClear(stageId.value, chars);
  lastSeconds.value = rec.seconds;
  cleared.value = true;
}

function onFail() {
  running.value = false;
  // 再実行は「▶ 実行」ボタンで
}
</script>

<template>
  <div class="w-full">
    <header class="flex items-center gap-3 mb-3">
      <NuxtLink to="/" class="text-sm text-slate-600 hover:underline"
        >← ステージ選択へ</NuxtLink
      >
      <h1 class="text-xl font-extrabold text-slate-800">
        ステージ: {{ stageId }}
      </h1>
    </header>

    <div v-if="loading" class="text-gray-600">読み込み中…</div>
    <p v-else-if="loadError" class="text-red-600">{{ loadError }}</p>

    <section v-if="stage" class="grid gap-4 md:grid-cols-2">
      <div class="rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <CommandEditor
          ref="editorRef"
          :dictionary="dict || undefined"
          v-model:lines="editorLines"
          @run="onRun"
        />
      </div>

      <div class="rounded-2xl border border-lime-200 bg-lime-50 p-4">
        <!-- ★ running を渡す -->
        <GameCanvas
          :stage="stage"
          :program="program"
          :running="running"
          @clear="onClear"
          @fail="onFail"
        />
      </div>
    </section>

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
