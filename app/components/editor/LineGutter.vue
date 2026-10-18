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
  <div
    class="relative w-4 bg-white border-r border-gray-200"
    :style="{ height: viewportHeight + 'px' }"
    aria-hidden="true"
  >
    <div
      class="absolute left-0 right-0"
      :style="{
        paddingTop: paddingTop + 'px',
        paddingBottom: paddingBottom + 'px',
        transform: `translateY(-${scrollTop}px)`,
      }"
    >
      <div
        v-for="(s, i) in states"
        :key="i"
        class="mx-auto my-0.5 rounded"
        :class="{
          'bg-lime-500': s === 'valid',
          'bg-rose-500': s === 'invalid',
          'bg-gray-300': s === 'empty',
          'bg-sky-500': s === 'loop',
        }"
        :style="{ width: '6px', height: lineHeight + 'px' }"
      />
    </div>
  </div>
</template>
