<script setup lang="ts">
defineProps<{
  states: ("valid" | "invalid" | "empty" | "loop")[];
  lineHeight: number;
  paddingTop: number;
  paddingBottom: number;
  scrollTop: number;
  viewportHeight: number;
}>();
</script>

<template>
  <div class="relative w-12 shrink-0 overflow-hidden border-r border-[#abb3c4] bg-[#e9edf0]" :style="{ height: viewportHeight + 'px' }" aria-hidden="true">
    <div class="absolute left-0 right-0" :style="{
      paddingTop: paddingTop + 'px',
      paddingBottom: paddingBottom + 'px',
      transform: `translateY(-${scrollTop}px)`,
    }">
      <div v-for="(state, index) in states" :key="index" class="flex items-center justify-between px-2 font-mono text-[12px] font-bold text-[#5d667a]" :style="{ height: lineHeight + 'px' }">
        <span>{{ index + 1 }}</span>
        <span class="h-[7px] w-[7px] rounded-full" :class="{
          'bg-[#259d75]': state === 'valid',
          'bg-[#d34b61]': state === 'invalid',
          'bg-[#abb2bf]': state === 'empty',
          'bg-[#7561ad]': state === 'loop',
        }" />
      </div>
    </div>
  </div>
</template>
