<script setup lang="ts">
import type { SustainedHighlight, SustainedAction } from "~/game/action-highlights";

const modeLabel: Record<SustainedAction, string> = {
  walk: "歩行中", run: "走行中", sprint: "高速中", crouch: "しゃがみ",
};
defineProps<{
  states: ("valid" | "invalid" | "empty" | "loop")[];
  activeLines?: number[];
  sustainedLines?: SustainedHighlight[];
  waitingLine?: number | null;
  repeatLine?: number | null;
  repeatProgress?: string | null;
  lineHeight: number;
  paddingTop: number;
  paddingBottom: number;
  scrollTop: number;
  viewportHeight: number;
}>();
</script>

<template>
  <div class="relative w-[72px] shrink-0 overflow-hidden border-r border-[#abb3c4] bg-[#e9edf0]" :style="{ height: viewportHeight + 'px' }" aria-hidden="true">
    <div class="absolute left-0 right-0" :style="{
      paddingTop: paddingTop + 'px',
      paddingBottom: paddingBottom + 'px',
      transform: `translateY(-${scrollTop}px)`,
    }">
      <div v-for="(state, index) in states" :key="index" class="flex items-center justify-between gap-1 px-1.5 font-mono text-[12px] font-bold"
        :data-execution="activeLines?.includes(index + 1) ? 'fired' : sustainedLines?.some((item) => item.line === index + 1) ? 'sustained' : waitingLine === index + 1 ? 'waiting' : repeatLine === index + 1 ? 'repeat' : null"
        :data-mode="sustainedLines?.find((item) => item.line === index + 1)?.action"
        :class="activeLines?.includes(index + 1) ? 'bg-[#aaf0d0] text-[#123a31]' : sustainedLines?.some((item) => item.line === index + 1) ? 'bg-[#dcefe3] text-[#255743]' : waitingLine === index + 1 ? 'bg-[#e3d9ff] text-[#34265f]' : 'text-[#5d667a]'" :style="{ height: lineHeight + 'px' }">
        <span>{{ index + 1 }}</span>
        <span v-if="activeLines?.includes(index + 1)" aria-label="実行中">▶</span>
        <span v-else-if="sustainedLines?.some((item) => item.line === index + 1)" class="text-[9px] font-black whitespace-nowrap" aria-label="効果が続いている">
          {{ modeLabel[sustainedLines.find((item) => item.line === index + 1)!.action] }}
        </span>
        <span v-else-if="repeatLine === index + 1" aria-label="くりかえし中">↻<span v-if="repeatProgress" class="ml-1 text-[10px]">{{ repeatProgress }}</span></span>
        <span v-else-if="waitingLine === index + 1" aria-label="まっている">…</span>
        <span v-else class="h-[7px] w-[7px] rounded-full" :class="{
          'bg-[#259d75]': state === 'valid',
          'bg-[#d34b61]': state === 'invalid',
          'bg-[#abb2bf]': state === 'empty',
          'bg-[#7561ad]': state === 'loop',
        }" />
      </div>
    </div>
  </div>
</template>
