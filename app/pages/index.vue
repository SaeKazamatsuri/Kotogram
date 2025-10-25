<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
const { listStages, getManifest } = useStageLoader();
const { getAll, reset } = useStats();
type Item = { id: string; title: string; file: string };
const loading = ref(true);
const error = ref<string | null>(null);
const stages = ref<Item[]>([]);
const version = ref<string | undefined>();
const stats = ref<Record<string, { seconds: number; chars: number }>>({});
const visibleStages = computed(() =>
  stages.value.filter((stage) => stageUnlocked(stage.id))
);

function stageIndexFromId(id: string): number | null {
  const match = id.match(/^stage-(\d+)$/);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return Number.isNaN(index) ? null : index;
}

function stageUnlocked(id: string): boolean {
  const index = stageIndexFromId(id);
  if (!index || index <= 1) return true;
  const prevId = `stage-${index - 1}`;
  return typeof stats.value[prevId]?.seconds === "number";
}

function onReset() {
  reset();
  stats.value = {};
  if (typeof window !== "undefined") window.location.reload();
}

onMounted(async () => {
  try {
    const manifest = await getManifest();
    version.value = manifest.version;
    stages.value = await listStages();
  } catch {
    error.value = "ステージを読み込めませんでした。プレースホルダーを表示します。";
    stages.value = await listStages();
  } finally {
    loading.value = false;
  }
  stats.value = getAll();
});
</script>

<template>
  <div class="w-full">
    <div
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3"
    >
      <p class="text-gray-700">
        ひらがなでめいれいを書いて、キャラをゴールへみちびこう
      </p>
      <button
        class="self-start rounded-full border border-slate-400 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
        @click="onReset"
      >
        リセット
      </button>
    </div>
    <div v-if="loading" class="text-gray-600">読み込み中…</div>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>

    <section class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="stage in visibleStages"
        :key="stage.id"
        :to="`/play/${stage.id}`"
        class="block rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 p-5 transition"
      >
        <h2 class="font-bold text-slate-800">{{ stage.title }}</h2>
        <p class="text-xs text-slate-600">ID: {{ stage.id }}</p>
      </NuxtLink>
    </section>

    <div v-if="version" class="mt-3 text-xs text-slate-500">
      data: {{ version }}
    </div>
  </div>
</template>
