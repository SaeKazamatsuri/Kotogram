<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { canPlayStage } from "~/stage/progression";
const { listStages, getManifest } = useStageLoader();
const { getAll, reset } = useStats();
type Item = { id: string; title: string; file: string };
const loading = ref(true);
const error = ref<string | null>(null);
const stages = ref<Item[]>([]);
const stats = ref<Record<string, { seconds: number; chars: number }>>({});
const clearedCount = computed(() => stages.value.filter((item) => isComplete(item.id)).length);
const chapters = computed(() => {
  const names = ["ことばの もり", "ちょうせんの おか", "ふしぎな しま"];
  return Array.from({ length: Math.ceil(stages.value.length / 3) }, (_, index) => ({
    name: names[index] ?? "ぼうけんの つづき",
    items: stages.value.slice(index * 3, index * 3 + 3),
    index,
  }));
});
function isComplete(id: string) { return typeof stats.value[id]?.seconds === "number"; }
function stageUnlocked(id: string) { return canPlayStage(id, stages.value, isComplete); }
function onReset() {
  if (typeof window !== "undefined" && !window.confirm("つぎのひとの ために、きろくを けしても いい？")) return;
  reset();
  stats.value = {};
}
onMounted(async () => {
  try {
    await getManifest();
    stages.value = await listStages();
  } catch {
    error.value = "ステージを よみこめなかったよ。もういちど ためしてね。";
  } finally {
    loading.value = false;
  }
  stats.value = getAll();
});
</script>

<template>
  <div class="scene-enter mx-auto max-w-5xl pb-10">
    <nav class="mb-7 flex flex-wrap items-center justify-between gap-4">
      <NuxtLink to="/" class="game-button game-button--night text-sm">← タイトルへ もどる</NuxtLink>
      <span class="game-chip">★ {{ clearedCount }} / {{ stages.length }} クリア</span>
    </nav>
    <div class="mb-9">
      <p class="game-kicker mb-3">CHOOSE YOUR ADVENTURE</p>
      <h1 class="game-heading text-4xl text-[#fff7e8] sm:text-5xl">ぼうけんマップ</h1>
      <p class="mt-3 text-base font-bold text-[#d6dded]">ひとつずつ クリアして、つぎの ばしょへ すすもう！</p>
    </div>
    <p v-if="loading" role="status" class="text-[#fff7e8]">マップを ひろげているよ…</p>
    <p v-else-if="error" role="alert" class="rounded-2xl bg-[#fff7e8] p-5 text-[#9b293e]">{{ error }}</p>
    <div v-else class="space-y-8">
      <section v-for="chapter in chapters" :key="chapter.index" class="relative rounded-[32px] border-2 border-[#6f7597] bg-[#202b4c]/85 p-5 shadow-[0_8px_0_#0b1023] sm:p-7">
        <div class="mb-5 flex items-center gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#303450] bg-[#ffcd77] text-xl font-black text-[#232741]">{{ chapter.index + 1 }}</div>
          <div><p class="text-xs font-black tracking-widest text-[#81e3bd]">AREA {{ String(chapter.index + 1).padStart(2, '0') }}</p><h2 class="game-heading text-xl text-[#fff7e8] sm:text-2xl">{{ chapter.name }}</h2></div>
        </div>
        <ol class="relative grid gap-4 md:grid-cols-3">
          <li v-for="(stage, index) in chapter.items" :key="stage.id" class="relative">
            <NuxtLink
              v-if="stageUnlocked(stage.id)"
              :to="`/play/${stage.id}`"
              class="group flex min-h-[190px] flex-col justify-between rounded-[24px] border-[3px] border-[#333956] bg-[#fff7e8] p-5 text-[#22243e] shadow-[0_6px_0_#14182d] transition-transform hover:-translate-y-1 focus-visible:outline-offset-4"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-black tracking-widest text-[#6c6f81]">STAGE {{ String(chapter.index * 3 + index + 1).padStart(2,'0') }}</span>
                <span class="rounded-full px-3 py-1 text-xs font-black" :class="isComplete(stage.id) ? 'bg-[#d3f8dc] text-[#176344]' : 'bg-[#fff0be] text-[#6b4c10]'">{{ isComplete(stage.id) ? '★ クリア！' : '▶ あそべる' }}</span>
              </div>
              <h3 class="game-heading my-5 text-xl">{{ stage.title }}</h3>
              <div class="flex items-center justify-between border-t-2 border-dashed border-[#d0c9ba] pt-3 text-sm font-bold text-[#4b5778]">
                <span>{{ isComplete(stage.id) ? 'もういちど ちょうせん' : 'さあ、ぼうけんへ' }}</span><span class="text-lg" aria-hidden="true">→</span>
              </div>
            </NuxtLink>
            <div v-else aria-disabled="true" class="flex min-h-[190px] flex-col justify-between rounded-[24px] border-2 border-dashed border-[#777e99] bg-[#141a31] p-5 text-[#b7bfd3]">
              <div class="flex items-center justify-between"><span class="text-xs font-black tracking-widest">STAGE {{ String(chapter.index * 3 + index + 1).padStart(2,'0') }}</span><span aria-hidden="true">🔒</span></div>
              <h3 class="game-heading my-5 text-xl">{{ stage.title }}</h3>
              <p class="border-t border-[#4b5370] pt-3 text-sm">ひとつまえを クリアすると あそべるよ</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
    <div class="mt-12 flex flex-wrap items-center justify-between gap-5 border-t border-[#5e6786] pt-6">
      <p class="max-w-sm text-sm leading-relaxed text-[#c7cee2]">みんなで つかう たんまつだよ。あそびおわったら つぎのひとに わたしてね。</p>
      <button type="button" class="game-button game-button--ghost text-sm" @click="onReset">つぎのひと（きろくを けす）</button>
    </div>
  </div>
</template>
