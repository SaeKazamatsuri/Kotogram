<script setup lang="ts">
import type { SoftKey } from "~/editor/text-input";

defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ (e: "press", key: SoftKey): void }>();

const rows = [
  ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"],
  ["い", "き", "し", "ち", "に", "ひ", "み", "", "り", "を"],
  ["う", "く", "す", "つ", "ぬ", "ふ", "む", "ゆ", "る", "ん"],
  ["え", "け", "せ", "て", "ね", "へ", "め", "", "れ", "ー"],
  ["お", "こ", "そ", "と", "の", "ほ", "も", "よ", "ろ", "、"],
];
const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const controls: { label: string; key: SoftKey }[] = [
  { label: "゛", key: { kind: "dakuten" } },
  { label: "゜", key: { kind: "handakuten" } },
  { label: "小", key: { kind: "small" } },
  { label: "←", key: { kind: "left" } },
  { label: "→", key: { kind: "right" } },
  { label: "けす", key: { kind: "backspace" } },
  { label: "空白", key: { kind: "insert", text: " " } },
  { label: "改行", key: { kind: "insert", text: "\n" } },
];
</script>

<template>
  <section aria-label="ひらがなキーボード" class="rounded-xl border border-sky-200 bg-white p-2">
    <p class="mb-2 text-sm text-slate-600">もじを おして かいてね</p>
    <div class="overflow-x-auto pb-1" @pointerdown.prevent>
      <div class="min-w-[430px]">
        <div class="grid grid-cols-10 gap-1">
          <template v-for="(row, i) in rows" :key="i">
            <template v-for="(kana, j) in row" :key="`${i}-${j}`">
              <button
                v-if="kana && kana !== '、'"
                type="button"
                :disabled="disabled"
                class="h-10 rounded-lg border border-sky-200 bg-sky-50 text-lg hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-40"
                :aria-label="`${kana} をにゅうりょく`"
                @click="emit('press', { kind: 'insert', text: kana })"
              >{{ kana }}</button>
              <span v-else aria-hidden="true" />
            </template>
          </template>
        </div>
        <div class="mt-2 grid grid-cols-10 gap-1">
          <button
            v-for="digit in numbers"
            :key="digit"
            type="button"
            :disabled="disabled"
            class="h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40"
            @click="emit('press', { kind: 'insert', text: digit })"
          >{{ digit }}</button>
        </div>
      </div>
    </div>
    <div class="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
      <button
        v-for="(control, i) in controls"
        :key="i"
        type="button"
        :disabled="disabled"
        class="min-h-10 rounded-lg border border-amber-200 bg-amber-50 px-2 text-sm hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:opacity-40"
        @pointerdown.prevent
        @click="emit('press', control.key)"
      >{{ control.label }}</button>
    </div>
  </section>
</template>
