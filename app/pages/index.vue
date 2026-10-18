<script setup lang="ts">
import { onMounted, ref } from "vue";
const completed = ref(0);
onMounted(() => {
  completed.value = Object.keys(useStats().getAll()).length;
});
</script>

<template>
  <div class="scene-enter mx-auto flex min-h-[calc(100vh-70px)] max-w-6xl items-center">
    <div class="grid w-full items-center gap-9 md:grid-cols-[1fr_1fr]">
      <section class="relative z-10 py-8">
        <div class="mb-5 inline-flex items-center gap-2 text-[#aaf0d0]">
          <Icon name="lucide:sparkles" class="game-icon text-2xl" aria-hidden="true" />
          <span class="text-lg font-black">ことばで 遊ぶ</span>
        </div>
        <h1 class="game-heading mb-10 text-[clamp(3.5rem,9vw,7rem)] tracking-[-.05em] text-[#fffaf1]">こと<span class="text-[#aaf0d0]">グラム</span></h1>
        <NuxtLink to="/stages" class="game-button game-button--mint min-w-[240px] text-xl" aria-label="遊ぶ">
          <Icon name="lucide:play" class="game-icon" aria-hidden="true" /> 遊ぶ
        </NuxtLink>
        <p v-if="completed" class="mt-7 flex items-center gap-2 text-base font-bold text-[#e9f6ee]"><Icon name="lucide:star" class="game-icon text-[#ffdc90]" aria-hidden="true" /> {{ completed }} ステージ クリア</p>
      </section>
      <div class="relative min-h-[330px] overflow-hidden rounded-[30px] border-[3px] border-[#7892a8] bg-[#344e6c] shadow-[0_8px_0_#080e20] sm:min-h-[440px]" aria-hidden="true">
        <div class="absolute inset-0 bg-[linear-gradient(160deg,#507c9b_0%,#91cbbb_58%,#f6d7a0_100%)]" />
        <div class="absolute right-[12%] top-[12%] h-28 w-28 rounded-full bg-[#ffe8ae] shadow-[0_0_0_24px_#fff3ce55]" />
        <div class="absolute bottom-[15%] left-[-10%] h-44 w-[80%] rounded-[50%] bg-[#518c7e]" />
        <div class="absolute bottom-[13%] right-[-12%] h-48 w-[78%] rounded-[50%] bg-[#357768]" />
        <div class="absolute bottom-0 h-[28%] w-full bg-[#8a7164]"><div class="h-4 w-full bg-[#7fc69d]"/></div>
        <div class="absolute bottom-[26%] left-[20%] h-28 w-20 rounded-[26px_26px_12px_12px] border-[5px] border-[#24334a] bg-[#ffdc90] shadow-[10px_8px_0_#293e4b]">
          <div class="absolute left-3 top-8 h-2 w-2 rounded-full bg-[#24334a]"/>
          <div class="absolute right-3 top-8 h-2 w-2 rounded-full bg-[#24334a]"/>
          <div class="absolute bottom-[-9px] left-2 h-3 w-12 rounded-full bg-[#24334a]"/>
        </div>
        <div class="absolute left-[45%] top-[33%] -rotate-6 rounded-[20px] border-[3px] border-[#29364b] bg-[#fffaf1] p-5 text-[#173c3b] shadow-[7px_8px_0_#324e5b]">
          <p class="text-2xl font-black">かべとぶ</p>
          <Icon name="lucide:arrow-up-right" class="game-icon mt-2 text-2xl text-[#1b755c]" />
        </div>
      </div>
    </div>
  </div>
</template>
