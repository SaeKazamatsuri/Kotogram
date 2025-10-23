<script setup lang="ts">
import { onMounted, ref } from "vue";
const { listStages, getManifest } = useStageLoader();
type Item = { id: string; title: string; file: string };
const loading = ref(true);
const error = ref<string | null>(null);
const stages = ref<Item[]>([]);
const version = ref<string | undefined>();
onMounted(async () => {
  try {
    const m = await getManifest();
    version.value = m.version;
    stages.value = await listStages();
  } catch {
    error.value = "ステージを読み込めません（プレースホルダ）";
    stages.value = await listStages();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="w-full">
    <p class="text-gray-700 mb-3">
      ひらがなでめいれいを書いて、キャラをゴールへ！
    </p>
    <div v-if="loading" class="text-gray-600">読み込み中…</div>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>

    <section class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="s in stages"
        :key="s.id"
        :to="`/play/${s.id}`"
        class="block rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 p-5 transition"
      >
        <h2 class="font-bold text-slate-800">{{ s.title }}</h2>
        <p class="text-xs text-slate-600">ID: {{ s.id }}</p>
      </NuxtLink>
    </section>

    <div v-if="version" class="mt-3 text-xs text-slate-500">
      data: {{ version }}
    </div>
  </div>
</template>
