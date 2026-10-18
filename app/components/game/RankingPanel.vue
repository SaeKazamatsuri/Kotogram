<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { calculateScores, getScoreReference } from "~/scoring/score";
import { createScope, RankingClient, type RankingKind, type RankingRow } from "~/ranking/client";

const props = defineProps<{
  stageId: string;
  stageVersion: string;
  apiBase: string;
  refresh: number;
}>();

const kind = ref<RankingKind>("time");
const rows = ref<RankingRow[]>([]);
const loading = ref(false);
const error = ref(false);
let generation = 0;

async function load() {
  const id = ++generation;
  if (!props.apiBase) return;
  loading.value = true;
  error.value = false;
  try {
    const result = await new RankingClient(props.apiBase).list(createScope(props.stageId, props.stageVersion), kind.value);
    if (id === generation) rows.value = result.rows;
  } catch {
    if (id === generation) error.value = true;
  } finally {
    if (id === generation) loading.value = false;
  }
}

function displayScore(row: RankingRow) {
  const reference = getScoreReference(props.stageId, props.stageVersion);
  if (!reference) return "－";
  const scores = calculateScores(reference, { elapsedTicks: row.elapsedTicks, charCount: row.charCount });
  return Math.round(scores[kind.value]).toLocaleString("ja-JP") + "てん";
}

onMounted(load);
onUnmounted(() => generation++);
watch([kind, () => props.refresh, () => props.stageId], load);
</script>

<template>
  <section class="mt-4 rounded-2xl border-2 border-[#aeb9d1] bg-[#f5f4ff] p-4" aria-label="ランキング">
    <h3 class="mb-3 text-lg font-black text-[#2e3b57]">ランキング</h3>
    <div class="mb-3 grid grid-cols-3 gap-1" role="group" aria-label="ランキングのしゅるい">
      <button
        v-for="tab in [
          { type: 'time', text: 'タイム' },
          { type: 'chars', text: '文字数' },
          { type: 'overall', text: '合計' },
        ]"
        :key="tab.type"
        type="button"
        class="rounded-xl border-2 px-2 py-3 text-sm font-bold"
        :class="kind === tab.type ? 'border-[#4c6a70] bg-[#b6f0d8]' : 'border-[#b2b9ca] bg-white'"
        :aria-pressed="kind === tab.type"
        @click="kind = tab.type as RankingKind"
      >{{ tab.text }}</button>
    </div>
    <p v-if="loading" role="status" class="text-sm">読みこみ中…</p>
    <p v-else-if="error" role="alert" class="text-sm font-bold text-[#b23350]">読みこめませんでした</p>
    <p v-else-if="rows.length === 0" class="text-sm text-[#4a536b]">きろくなし</p>
    <div v-else class="max-h-52 overflow-auto">
      <table class="w-full text-sm text-[#2e3b57]">
        <thead><tr class="text-left"><th class="p-2">順番</th><th class="p-2">名前</th><th class="p-2">点数</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.runId" class="border-t border-[#bdc4d6]">
            <td class="p-2">{{ row.rank }}</td>
            <td class="p-2 break-all">{{ row.nickname }}</td>
            <td class="p-2 whitespace-nowrap">{{ displayScore(row) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="game-button game-button--ghost mt-3 text-sm" @click="load">読み直す</button>
  </section>
</template>
