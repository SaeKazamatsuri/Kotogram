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
  <section class="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3" aria-label="ランキング">
    <h3 class="mb-2 font-bold text-slate-800">みんなの ランキング</h3>
    <div class="mb-3 grid grid-cols-3 gap-1" role="group" aria-label="ランキングのしゅるい">
      <button
        v-for="tab in [
          { type: 'time', text: 'タイム' },
          { type: 'chars', text: 'もじすう' },
          { type: 'overall', text: 'そうごう' },
        ]"
        :key="tab.type"
        type="button"
        class="rounded-lg border px-2 py-2 text-sm"
        :class="kind === tab.type ? 'border-sky-600 bg-sky-200' : 'border-sky-200 bg-white'"
        :aria-pressed="kind === tab.type"
        @click="kind = tab.type as RankingKind"
      >{{ tab.text }}</button>
    </div>
    <p v-if="loading" role="status" class="text-sm">よみこみちゅう…</p>
    <p v-else-if="error" role="alert" class="text-sm text-rose-700">ランキングが よめないよ。あとで ためしてね。</p>
    <p v-else-if="rows.length === 0" class="text-sm text-slate-700">まだ きろくが ないよ。</p>
    <div v-else class="max-h-52 overflow-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left"><th class="p-2">じゅんい</th><th class="p-2">なまえ</th><th class="p-2">とくてん</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.runId" class="border-t border-sky-200">
            <td class="p-2">{{ row.rank }}</td>
            <td class="p-2 break-all">{{ row.nickname }}</td>
            <td class="p-2 whitespace-nowrap">{{ displayScore(row) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="mt-2 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm" @click="load">もういちど よむ</button>
  </section>
</template>
