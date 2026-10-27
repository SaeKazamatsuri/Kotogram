<script setup lang="ts">
import { ref } from "vue";
import GameCharacterSprite from "~/components/game/CharacterSprite.vue";
import { FIRST_STAGE_SHORT } from "~/stage/onboarding";

defineProps<{ chars: number; source: string }>();
const emit = defineEmits<{ (e: "practice" | "result" | "next"): void }>();
const page = ref(0);
</script>

<template>
  <div class="fixed inset-0 z-[80] grid place-items-center bg-[#090e1d]/90 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="はじめての クリア">
    <div class="game-panel flex w-[min(580px,96vw)] max-h-[calc(100dvh-24px)] min-h-0 flex-col overflow-y-auto border-2 border-[#aaf0d0] bg-[#fffaf1] p-5 text-[#21344d] sm:p-8">
      <div class="mb-4 flex items-center gap-3">
        <div class="w-[76px] shrink-0" aria-hidden="true"><GameCharacterSprite /></div>
        <div>
          <p class="text-sm font-black text-[#23765c]">いっしょに おぼえよう　{{ page + 1 }} / 3</p>
          <h2 class="text-2xl font-black sm:text-3xl">{{ page === 0 ? "ステージクリア！" : page === 1 ? "ことばを ちぢめられるよ" : "もう一度 ためしてみよう" }}</h2>
        </div>
      </div>
      <div v-if="page === 0" class="min-h-28">
        <p class="text-lg font-black leading-relaxed">やったね！ ことばを 書いて、かべを よけられたよ。</p>
        <p class="mt-3 text-base font-bold">今のコードは {{ chars }} 文字。これと 同じうごきを、もっと みじかい ことばでも 書けるんだ。</p>
      </div>
      <div v-else-if="page === 1" class="min-h-28">
        <p class="mb-2 text-sm font-black">書いた ことば</p>
        <p class="rounded-xl bg-[#edf0f5] p-3 font-black break-all">{{ source }}</p>
        <p class="my-2 text-center font-black text-[#23765c]">おなじ うごき ↓</p>
        <p class="rounded-xl bg-[#dff2e7] p-3 text-xl font-black">{{ FIRST_STAGE_SHORT }}</p>
      </div>
      <div v-else class="min-h-28">
        <p class="text-lg font-black leading-relaxed">どちらも「かべが きたら とぶ」という いみだよ。</p>
        <p class="mt-3 text-base font-bold">コードを みじかくすると、文字数の 点数を ねらえるよ。今のコードを 書きかえて、同じステージで ためそう！</p>
      </div>
      <div class="mt-5 flex items-center justify-center gap-2" aria-label="あんないの 進みぐあい">
        <span v-for="index in 3" :key="index" class="h-2 w-8 rounded-full" :class="index - 1 === page ? 'bg-[#25896c]' : 'bg-[#c9d1da]'" />
      </div>
      <div class="mt-5 flex flex-wrap items-center gap-2">
        <button v-if="page > 0" type="button" class="game-button game-button--ghost" @click="page--">もどる</button>
        <button v-if="page < 2" type="button" class="game-button game-button--mint ml-auto" @click="page++">つぎの はなし</button>
        <template v-else>
          <button type="button" class="game-button game-button--mint flex-1" @click="emit('practice')">みじかく 書いて ためす</button>
          <button type="button" class="game-button game-button--ghost" @click="emit('result')">点数を 見る</button>
        </template>
      </div>
      <button v-if="page === 2" type="button" class="mt-3 min-h-10 text-sm font-black text-[#435d79] underline" @click="emit('next')">今は ためさず 次のステージへ</button>
      <button v-else type="button" class="mt-2 min-h-10 text-sm font-black text-[#435d79] underline" @click="emit('result')">あんないを とじて 点数を 見る</button>
    </div>
  </div>
</template>
