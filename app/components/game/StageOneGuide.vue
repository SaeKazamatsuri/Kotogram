<script setup lang="ts">
import { computed } from "vue";
import GameCharacterSprite from "~/components/game/CharacterSprite.vue";
import { FIRST_STAGE_EXAMPLE, FIRST_STAGE_SHORT } from "~/stage/onboarding";

const props = defineProps<{ step: number; practice?: boolean }>();
const emit = defineEmits<{ (e: "next" | "close"): void }>();

const messages = [
  "ここが ステージだよ。かべが あるね。ドラッグすると 先も 見られるよ。",
  "「コードを書く」に ことばを 入れてみよう。まずは いつもの 日本語で いいよ。キーが むずかしければ「かな入力」も つかえるよ。",
  "書けたら「動かす」を おしてみよう。ことばどおりに うごくかな？",
];
const message = computed(() => props.practice
  ? "さっきの ことばを みじかく してみよう。コードを書きかえて「動かす」を おしてね。"
  : messages[Math.min(props.step, messages.length - 1)]);
const example = computed(() => props.practice ? FIRST_STAGE_SHORT : props.step === 1 ? FIRST_STAGE_EXAMPLE : null);
</script>

<template>
  <aside role="region" aria-label="主人公のあんない" class="stage-guide">
    <div class="stage-guide__hero" aria-hidden="true"><GameCharacterSprite /></div>
    <div class="stage-guide__speech">
      <div class="stage-guide__header">
        <span>いっしょに やってみよう</span>
        <span v-if="!practice" class="stage-guide__count">{{ step + 1 }} / 3</span>
      </div>
      <p>{{ message }}</p>
      <p v-if="example" class="stage-guide__example">{{ example }}</p>
      <div class="stage-guide__actions">
        <button v-if="!practice && step < 2" type="button" @click="emit('next')">つぎの ヒント</button>
        <button type="button" class="stage-guide__dismiss" @click="emit('close')">{{ practice ? "わかった！" : "あとで" }}</button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.stage-guide { position: absolute; z-index: 12; bottom: 12px; left: 12px; right: 12px; display: flex; align-items: end; gap: 10px; max-width: 670px; pointer-events: none; }
.stage-guide__hero { flex: 0 0 65px; width: 65px; filter: drop-shadow(2px 5px 0 #14243b); }
.stage-guide__hero :deep(canvas) { display: block; width: 100%; height: auto; }
.stage-guide__speech { flex: 1; min-width: 0; padding: 12px 14px; border: 3px solid #bcebdc; border-radius: 18px; background: #fffaf1; color: #20344c; box-shadow: 0 5px 0 #16243c; pointer-events: auto; }
.stage-guide__header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; color: #22634f; font-size: 12px; font-weight: 900; }
.stage-guide__count { white-space: nowrap; }
.stage-guide__speech p { font-size: 14px; line-height: 1.6; font-weight: 800; }
.stage-guide__speech .stage-guide__example { overflow-wrap: anywhere; margin-top: 6px; padding: 6px 8px; border-radius: 8px; background: #e6f1ec; color: #183a2d; font-size: 16px; }
.stage-guide__actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 8px; }
.stage-guide__actions button { min-height: 36px; padding: 5px 11px; border-radius: 9px; background: #25896c; color: white; font-size: 13px; font-weight: 900; }
.stage-guide__actions .stage-guide__dismiss { background: #e8edf1; color: #354b63; }
@media (max-width: 639px) { .stage-guide { left: 7px; right: 7px; bottom: 7px; gap: 4px; } .stage-guide__hero { flex-basis: 45px; width: 45px; } .stage-guide__speech { padding: 9px; } .stage-guide__speech p { font-size: 12px; } .stage-guide__speech .stage-guide__example { font-size: 13px; } }
</style>
