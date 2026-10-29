<script setup lang="ts">
import { computed } from "vue";
import GameCharacterSprite from "~/components/game/CharacterSprite.vue";
import { stageTutorialSteps } from "~/stage/onboarding";

const props = defineProps<{ stageId: string; step: number; practice?: boolean }>();
const emit = defineEmits<{ (e: "next" | "close" | "keyboard"): void }>();

const steps = computed(() => stageTutorialSteps(props.stageId, props.practice));
const current = computed(() => steps.value[Math.min(props.step, steps.value.length - 1)]);
const last = computed(() => props.step >= steps.value.length - 1);
</script>

<template>
  <aside role="region" aria-label="主人公のあんない" class="stage-guide" data-tutorial-bubble>
    <div class="stage-guide__hero" aria-hidden="true"><GameCharacterSprite /></div>
    <div class="stage-guide__speech">
      <div class="stage-guide__header">
        <span class="stage-guide__heading">いっしょに やってみよう</span>
        <span v-if="!practice" class="stage-guide__count">{{ step + 1 }} / {{ steps.length }}</span>
      </div>
      <p aria-live="polite">{{ current?.message }}</p>
      <p v-if="current?.example" class="stage-guide__example">{{ current.example }}</p>
      <div class="stage-guide__actions">
        <button v-if="step === 1 && stageId === 'stage-1' && !practice" type="button" aria-label="かな入力を ひらく" @click="emit('keyboard')"><Icon name="lucide:keyboard" class="stage-guide__action-icon" aria-hidden="true" /><span class="stage-guide__action-text">かな入力を ひらく</span></button>
        <button v-if="!last" type="button" aria-label="つぎの ヒント" @click="emit('next')"><Icon name="lucide:arrow-right" class="stage-guide__action-icon" aria-hidden="true" /><span class="stage-guide__action-text">つぎの ヒント</span></button>
        <button type="button" class="stage-guide__dismiss"  :aria-label="practice || last ? 'わかった！' : 'あとで'" @click="emit('close')"><Icon :name="practice || last ? 'lucide:check' : 'lucide:x'" class="stage-guide__action-icon" aria-hidden="true" /><span class="stage-guide__action-text">{{ practice || last ? "わかった！" : "あとで" }}</span></button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.stage-guide { position: relative; z-index: 1; display: flex; align-items: end; gap: 10px; width: calc(100% - 24px); max-width: 670px; margin: 0 auto 12px; flex-shrink: 0; }
.stage-guide__hero { flex: 0 0 65px; width: 65px; filter: drop-shadow(2px 5px 0 #14243b); }
.stage-guide__hero :deep(canvas) { display: block; width: 100%; height: auto; }
.stage-guide__speech { flex: 1; min-width: 0; padding: 12px 14px; border: 3px solid #bcebdc; border-radius: 18px; background: #fffaf1; color: #20344c; box-shadow: 0 5px 0 #16243c; }
.stage-guide__header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; color: #22634f; font-size: 12px; font-weight: 900; }
.stage-guide__count { white-space: nowrap; }
.stage-guide__speech p { font-size: 14px; line-height: 1.6; font-weight: 800; }
.stage-guide__speech .stage-guide__example { overflow-wrap: anywhere; margin-top: 6px; padding: 6px 8px; border-radius: 8px; background: #e6f1ec; color: #183a2d; font-size: 16px; }
.stage-guide__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 8px; }
.stage-guide__actions button { display: inline-flex; align-items: center; min-height: 36px; padding: 5px 11px; border-radius: 9px; background: #25896c; color: white; font-size: 13px; font-weight: 900; }
.stage-guide__actions .stage-guide__dismiss { background: #e8edf1; color: #354b63; }
.stage-guide__actions button:focus-visible { outline: 3px solid #f4a736; outline-offset: 2px; }
@media (max-width: 639px) {
  .stage-guide { position: absolute; z-index: 14; bottom: 6px; left: 6px; right: 6px; width: auto; max-width: none; max-height: calc(100% - 12px); margin: 0; overflow-y: auto; overscroll-behavior: contain; }
  .stage-guide__hero, .stage-guide__heading, .stage-guide__action-text { display: none; }
  .stage-guide__speech { padding: 7px 9px; border-width: 2px; border-radius: 12px; box-shadow: 0 3px 0 #16243c; }
  .stage-guide__header { justify-content: flex-end; margin-bottom: 2px; font-size: 10px; }
  .stage-guide__speech p { font-size: 12px; line-height: 1.35; }
  .stage-guide__speech .stage-guide__example { margin-top: 4px; padding: 4px 6px; font-size: 12px; line-height: 1.35; }
  .stage-guide__actions { gap: 6px; margin-top: 5px; }
  .stage-guide__actions button { justify-content: center; width: 40px; height: 40px; min-height: 40px; padding: 0; }
  .stage-guide__action-icon { display: inline-block; width: 19px; height: 19px; }
}
@media (min-width: 640px) { .stage-guide__action-icon { display: none; } }
</style>
