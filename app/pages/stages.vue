<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { canPlayStage } from "~/stage/progression";
import { playSe, unlockAudio } from "~/game/audio";
function onChooseStage() {
  unlockAudio();
  playSe("select");
}
const { getManifest } = useStageLoader();
const { getAll, reset } = useStats();
type Item = { id: string; title: string; file: string };
const loading = ref(true);
const error = ref<string | null>(null);
const stages = ref<Item[]>([]);
const stats = ref<Record<string, { seconds: number; chars: number }>>({});
const clearedCount = computed(() => stages.value.filter((item) => isComplete(item.id)).length);
function isComplete(id: string) { return typeof stats.value[id]?.seconds === "number"; }
function stageUnlocked(id: string) { return canPlayStage(id, stages.value, isComplete); }
function onReset() {
  if (typeof window !== "undefined" && !window.confirm("つぎのひとの ために、きろくを けしても いい？")) return;
  reset();
  stats.value = {};
}
async function loadStages() {
  loading.value = true;
  error.value = null;
  try {
    const manifest = await getManifest();
    stages.value = manifest.stages;
  } catch {
    stages.value = [];
    error.value = "ステージを 読みこめませんでした";
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  stats.value = getAll();
  void loadStages();
});
</script>

<template>
  <div class="scene-enter mx-auto max-w-6xl pb-10">
    <div class="mb-7 flex flex-wrap items-center justify-between gap-4">
      <NuxtLink to="/" class="game-button game-button--night text-sm"><Icon name="lucide:arrow-left" class="game-icon" aria-hidden="true"/> タイトルへ</NuxtLink>
      <span class="game-chip"><Icon name="lucide:star" class="game-icon text-[#ffdc90]" aria-hidden="true"/> {{ clearedCount }} / {{ stages.length }}</span>
    </div>
    <h1 class="game-screen-title mb-6">ステージを えらぶ</h1>
    <p v-if="loading" role="status">読みこみ中…</p>
    <div v-else-if="error" role="alert" class="game-panel flex flex-wrap items-center justify-between gap-4 p-5 text-[#a53148]"><p class="font-bold">{{ error }}</p><button type="button" class="game-button game-button--night" @click="loadStages">もう一度 読みこむ</button></div>
    <ol v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="(stage, index) in stages" :key="stage.id">
        <NuxtLink
          v-if="stageUnlocked(stage.id)"
          :to="`/play/${stage.id}`"
          @click="onChooseStage"
          class="flex min-h-[165px] flex-col justify-between rounded-[22px] border-[3px] border-[#6f87a0] bg-[#fffaf1] p-5 text-[#172439] shadow-[0_5px_0_#080e1e] transition-transform hover:-translate-y-1"
        >
          <div class="flex items-center justify-between">
            <span class="text-base font-black text-[#405978]">ステージ {{ index + 1 }}</span>
            <Icon :name="isComplete(stage.id) ? 'lucide:check-circle-2' : 'lucide:play-circle'" class="text-3xl text-[#196d58]" aria-hidden="true"/>
          </div>
          <h2 class="game-heading mt-4 text-xl">{{ stage.title }}</h2>
        </NuxtLink>
        <div v-else aria-disabled="true" class="flex min-h-[165px] flex-col justify-between rounded-[22px] border-2 border-[#566b89] bg-[#24334f] p-5 text-[#e5ebf4]">
          <div class="flex items-center justify-between">
            <span class="text-base font-black">ステージ {{ index + 1 }}</span>
            <Icon name="lucide:lock-keyhole" class="text-2xl" aria-hidden="true"/>
          </div>
          <h2 class="game-heading mt-4 text-xl">{{ stage.title }}</h2>
        </div>
      </li>
    </ol>
    <div class="mt-8 flex justify-end">
      <button type="button" class="game-button game-button--night text-sm" @click="onReset"><Icon name="lucide:refresh-cw" class="game-icon" aria-hidden="true"/> 次の人へ</button>
    </div>
  </div>
</template>
