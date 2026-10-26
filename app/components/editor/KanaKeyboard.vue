<script setup lang="ts">
import { computed } from "vue";
import type { SoftKey } from "~/editor/text-input";

const props = defineProps<{ disabled?: boolean; mode?: "code" | "nickname" }>();
const emit = defineEmits<{ (e: "press", key: SoftKey): void }>();

const rows = [
  ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"],
  ["い", "き", "し", "ち", "に", "ひ", "み", "", "り", "を"],
  ["う", "く", "す", "つ", "ぬ", "ふ", "む", "ゆ", "る", "ん"],
  ["え", "け", "せ", "て", "ね", "へ", "め", "", "れ", "ー"],
  ["お", "こ", "そ", "と", "の", "ほ", "も", "よ", "ろ", "、"],
];
const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const controls: { label: string; icon?: string; key: SoftKey }[] = [
  { label: "゛", key: { kind: "dakuten" } },
  { label: "゜", key: { kind: "handakuten" } },
  { label: "小", key: { kind: "small" } },
  { label: "左", icon: "lucide:arrow-left", key: { kind: "left" } },
  { label: "右", icon: "lucide:arrow-right", key: { kind: "right" } },
  { label: "消す", icon: "lucide:delete", key: { kind: "backspace" } },
  { label: "空白", key: { kind: "insert", text: " " } },
  { label: "改行", key: { kind: "insert", text: "\n" } },
];
const visibleControls = computed(() => props.mode === "nickname" ? controls.filter((control) => control.label !== "改行") : controls);
</script>

<template>
  <section :aria-label="mode === 'nickname' ? '名前用かなキーボード' : 'ひらがなキーボード'" class="rounded-2xl border-2 p-3" :class="mode === 'nickname' ? 'border-[#98b8aa] bg-[#f7fff9] text-[#22483d]' : 'border-[#646b89] bg-[#25304d] text-[#fff7e8]'">
    <div class="overflow-x-auto pb-1" @pointerdown.prevent>
      <div :class="mode === 'nickname' ? 'min-w-0' : 'min-w-[430px]'">
        <div class="grid gap-1" :class="mode === 'nickname' ? 'grid-cols-5 sm:grid-cols-10' : 'grid-cols-10'">
          <template v-for="(row, i) in rows" :key="i">
            <template v-for="(kana, j) in row" :key="`${i}-${j}`">
              <button
                v-if="kana && kana !== '、'"
                type="button"
                :disabled="disabled"
                class="h-11 rounded-xl border-2 border-[#b7c8cb] bg-[#fff7e8] text-lg font-black text-[#25354a] shadow-[0_3px_0_#17253d] hover:bg-[#e0ffed] focus-visible:outline-2 focus-visible:outline-[#ffcd77] disabled:opacity-40"
                :aria-label="`${kana} をにゅうりょく`"
                @click="emit('press', { kind: 'insert', text: kana })"
              >{{ kana }}</button>
              <span v-else aria-hidden="true" />
            </template>
          </template>
        </div>
        <div class="mt-2 grid gap-1" :class="mode === 'nickname' ? 'grid-cols-5 sm:grid-cols-10' : 'grid-cols-10'">
          <button
            v-for="digit in numbers"
            :key="digit"
            type="button"
            :disabled="disabled"
            class="h-10 rounded-lg border border-[#8a97ac] bg-[#dae6ef] font-bold text-[#273449] hover:bg-white disabled:opacity-40"
            @click="emit('press', { kind: 'insert', text: digit })"
          >{{ digit }}</button>
        </div>
      </div>
    </div>
    <div class="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
      <button
        v-for="(control, i) in visibleControls"
        :key="i"
        type="button"
        :disabled="disabled"
        class="min-h-11 rounded-xl border-2 border-[#3b495d] bg-[#ffcd77] px-2 text-sm font-black text-[#273449] hover:bg-[#ffdf9e] focus-visible:outline-2 focus-visible:outline-[#fff7e8] disabled:opacity-40"
        @pointerdown.prevent
        @click="emit('press', control.key)"
      ><Icon v-if="control.icon" :name="control.icon" class="game-icon mr-1" aria-hidden="true"/>{{ control.label }}</button>
    </div>
  </section>
</template>
