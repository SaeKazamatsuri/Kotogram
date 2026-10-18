<script setup lang="ts">
import { onMounted, ref } from "vue";
import { canPlayStage } from "~/stage/progression";
const { listStages, getManifest } = useStageLoader();
const { getAll, reset } = useStats();
type Item = { id: string; title: string; file: string };
const loading = ref(true);
const error = ref<string | null>(null);
const stages = ref<Item[]>([]);
const version = ref<string | undefined>();
const stats = ref<Record<string, { seconds: number; chars: number }>>({});
function stageUnlocked(id: string): boolean {
  return canPlayStage(id, stages.value, (previousId) =>
    typeof stats.value[previousId]?.seconds === "number"
  );
}

function onReset() {
  if (typeof window !== "undefined" && !window.confirm("つぎのひとの ために、きろくを けしても いい？")) return;
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
        つぎのひと（きろくを けす）
      </button>
    </div>
    <div v-if="loading" class="text-gray-600">読み込み中…</div>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>

    <section class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="stage in stages.filter((item) => stageUnlocked(item.id))"
        :key="stage.id"
        :to="`/play/${stage.id}`"
        class="block rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 p-5 transition"
      >
        <h2 class="font-bold text-slate-800">{{ stage.title }}</h2>
        <p class="text-xs text-slate-600">ID: {{ stage.id }}</p>
      </NuxtLink>
      <div
        v-for="stage in stages.filter((item) => !stageUnlocked(item.id))"
        :key="stage.id"
        class="rounded-2xl border border-slate-200 bg-slate-100 p-5 text-slate-500"
        aria-disabled="true"
      >
        <h2 class="font-bold">{{ stage.title }}</h2>
        <p class="mt-2 text-sm">ひとつまえの ステージを クリアすると あそべるよ</p>
      </div>
    </section>

    <div v-if="version" class="mt-3 text-xs text-slate-500">
      data: {{ version }}
    </div>
  </div>
</template>
