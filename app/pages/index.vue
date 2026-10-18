<script setup lang="ts">
import { onMounted, ref } from "vue";
const completed = ref(0);
onMounted(() => {
  completed.value = Object.keys(useStats().getAll()).length;
});
</script>

<template>
  <div class="scene-enter mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col justify-center">
    <div class="grid items-center gap-9 lg:grid-cols-[1fr_1.03fr]">
      <section class="relative z-10 max-w-xl py-8">
        <p class="game-kicker mb-5">HIRAGANA PROGRAMMING ADVENTURE</p>
        <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-100/10 px-4 py-2 text-sm font-black text-amber-100">
          <span aria-hidden="true">✦</span> ことばが ちからになる ぼうけん
        </div>
        <h1 class="game-heading mb-5 text-[clamp(3.8rem,10vw,7.5rem)] tracking-[-.04em] text-[#fff7e8]">
          こと<span class="text-[#81e3bd]">グラム</span>
        </h1>
        <p class="mb-9 max-w-lg text-lg font-bold leading-loose text-[#dce3ed] sm:text-xl">
          ひらがなで めいれいを かこう。<br>
          きみの ことばで、キャラクターが うごきだす！
        </p>
        <div class="flex flex-wrap gap-4">
          <NuxtLink to="/stages" class="game-button game-button--mint min-w-[240px] text-xl" aria-label="ぼうけんを はじめる">
            <span aria-hidden="true">▶</span> ぼうけんを はじめる
          </NuxtLink>
          <a href="#how-to-play" class="game-button game-button--night text-base">あそびかたを みる</a>
        </div>
        <p v-if="completed" class="mt-6 text-sm font-bold text-[#b3f1d9]">★ {{ completed }}ステージ クリアずみ！</p>
      </section>
      <div class="relative min-h-[350px] overflow-hidden rounded-[38px] border-2 border-[#697090] bg-[#34426b] shadow-[0_12px_0_#090e21] sm:min-h-[450px]" aria-hidden="true">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_75%_23%,#ffe29f_0_6%,transparent_6.3%),linear-gradient(160deg,#596caa_0%,#516d94_47%,#a38fa2_100%)]" />
        <div class="absolute right-[14%] top-[14%] h-32 w-32 rounded-full bg-[#ffe19b]/30 blur-xl" />
        <div class="absolute bottom-[18%] left-[-12%] h-52 w-[65%] rotate-[-12deg] rounded-[50%] bg-[#455d79]" />
        <div class="absolute bottom-[15%] right-[-12%] h-56 w-[75%] rotate-[13deg] rounded-[50%] bg-[#324961]" />
        <div class="absolute bottom-0 h-[29%] w-full bg-[repeating-linear-gradient(90deg,#2d7565_0_28px,#286858_28px_56px)]" />
        <div class="absolute bottom-[29%] left-[54%] h-20 w-5 bg-[#534d6c]"><div class="absolute -left-8 -top-6 h-16 w-20 rounded-full bg-[#5ed6ac]" /></div>
        <div class="absolute bottom-[27%] left-[21%] h-24 w-16 rounded-[20px_20px_7px_7px] border-[5px] border-[#242b4b] bg-[#ffce86] shadow-[10px_6px_0_#273f52]">
          <div class="absolute left-2 top-6 h-2 w-2 rounded-full bg-[#28283e]" />
          <div class="absolute right-2 top-6 h-2 w-2 rounded-full bg-[#28283e]" />
          <div class="absolute bottom-[-8px] left-0 h-3 w-12 rounded-full bg-[#242b4b]" />
        </div>
        <div class="absolute left-[36%] top-[27%] -rotate-6 rounded-[22px] border-[4px] border-[#20223a] bg-[#fff7e8] p-5 text-[#20223a] shadow-[8px_9px_0_#273451] sm:left-[43%]">
          <p class="mb-2 text-xs font-black tracking-widest text-[#746c91]">PROGRAM</p>
          <p class="text-xl font-black text-[#255e58]">かべとぶ</p>
          <p class="mt-1 text-sm font-bold text-[#646279]">▶ じゃんぷ！</p>
        </div>
        <div class="absolute right-5 top-5 rounded-full border-2 border-[#fff7e8]/50 bg-[#10152e]/50 px-4 py-2 text-xs font-black text-[#fff7e8]">WORLD 01</div>
      </div>
    </div>
    <section id="how-to-play" class="mt-12 grid gap-4 pb-8 md:grid-cols-3" aria-label="あそびかた">
      <div v-for="step in [
        { no: '01', title: 'ステージを えらぶ', detail: 'いろんな しかけが まっているよ。' },
        { no: '02', title: 'ひらがなで かく', detail: 'めいれいを じぶんで くみたてよう。' },
        { no: '03', title: 'うごかして ゴール！', detail: 'なんどでも なおして ためせるよ。' },
      ]" :key="step.no" class="game-panel-dark flex gap-4 p-5">
        <span class="text-3xl font-black text-[#ffcd77]">{{ step.no }}</span>
        <div><h2 class="mb-1 text-base font-black">{{ step.title }}</h2><p class="text-sm leading-relaxed text-[#d2dced]">{{ step.detail }}</p></div>
      </div>
    </section>
  </div>
</template>
