<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { analyzeProgram, type Vocabulary } from "~/language/parser";
import LineGutter from "./LineGutter.vue";
import KanaKeyboard from "./KanaKeyboard.vue";
import { editWithSoftKey, type SoftKey } from "~/editor/text-input";

const props = defineProps<{ dictionary?: Vocabulary; lines?: string[] }>();
const emit = defineEmits<{ (e: "update:lines", value: string[]): void; (e: "run"): void }>();

const text = ref("");
const textarea = ref<HTMLTextAreaElement | null>(null);
const composing = ref(false);
const keyboardVisible = ref(false);

function sanitize(input: string) {
  return (input.normalize("NFC").match(/[ぁ-ゟー0-9０-９ \u3000\r\n]/g) ?? []).join("");
}
function acceptInput(target: HTMLTextAreaElement) {
  const original = target.value;
  const cleaned = sanitize(original);
  const cursor = sanitize(original.slice(0, target.selectionStart ?? original.length)).length;
  text.value = cleaned;
  if (cleaned !== original) {
    target.value = cleaned;
    nextTick(() => {
      if (textarea.value === target) target.setSelectionRange(cursor, cursor);
    });
  }
  updateMetrics();
}
function onInput(event: Event) {
  if (!composing.value) acceptInput(event.target as HTMLTextAreaElement);
}
function onCompositionEnd(event: CompositionEvent) {
  composing.value = false;
  acceptInput(event.target as HTMLTextAreaElement);
}

const lineArray = computed(() => text.value.replace(/\r/g, "").split("\n"));
watch(lineArray, (value) => emit("update:lines", value), { immediate: true });
const analysis = computed(() => analyzeProgram(lineArray.value, props.dictionary ?? {}));
const lineStates = computed(() => {
  const states: ("valid" | "invalid" | "empty" | "loop")[] = lineArray.value.map((line) => line.trim() ? "valid" : "empty");
  for (const tokens of analysis.value.tokens) {
    if (tokens[0]?.kind === "repeat" || tokens[0]?.kind === "if" || tokens[0]?.kind === "end" || (tokens[0]?.kind === "number" && tokens[2]?.kind === "repeat")) {
      if (states[tokens[0].line - 1] === "valid") states[tokens[0].line - 1] = "loop";
    }
  }
  for (const diagnostic of analysis.value.diagnostics) {
    if (diagnostic.line <= states.length) states[diagnostic.line - 1] = "invalid";
  }
  return states;
});
const firstError = computed(() => analysis.value.diagnostics[0]);
const taScrollTop = ref(0);
const taPaddingTop = ref(0);
const taPaddingBottom = ref(0);
const taLineHeight = ref(20);
const taClientHeight = ref(0);

function updateMetrics() {
  const element = textarea.value;
  if (!element) return;
  const style = getComputedStyle(element);
  const lineHeight = parseFloat(style.lineHeight);
  const fontSize = parseFloat(style.fontSize);
  taLineHeight.value = Number.isFinite(lineHeight) ? lineHeight : Math.round(fontSize * 1.6);
  taPaddingTop.value = parseFloat(style.paddingTop) - 4 || 0;
  taPaddingBottom.value = parseFloat(style.paddingBottom) || 0;
  taClientHeight.value = element.clientHeight;
  taScrollTop.value = element.scrollTop;
}
function onScroll() {
  if (textarea.value) taScrollTop.value = textarea.value.scrollTop;
}
let observer: ResizeObserver | null = null;
onMounted(() => {
  updateMetrics();
  if (textarea.value) {
    observer = new ResizeObserver(updateMetrics);
    observer.observe(textarea.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

function onSoftKey(key: SoftKey) {
  if (composing.value || !textarea.value) return;
  const element = textarea.value;
  const result = editWithSoftKey({
    text: text.value,
    start: element.selectionStart ?? text.value.length,
    end: element.selectionEnd ?? text.value.length,
  }, key);
  const normalized = sanitize(result.text);
  const cursor = sanitize(result.text.slice(0, result.start)).length;
  text.value = normalized;
  element.value = normalized;
  nextTick(() => {
    if (textarea.value === element) {
      element.focus({ preventScroll: true });
      element.setSelectionRange(cursor, cursor);
      updateMetrics();
    }
  });
}

function run() {
  if (analysis.value.diagnostics.length === 0) emit("run");
}
function getText() {
  return text.value;
}
defineExpose({ getText });
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <strong class="font-bold text-slate-800">めいれいエディタ</strong>
      <button
        class="rounded-2xl border-2 border-amber-500 bg-amber-400 hover:bg-amber-300 px-4 py-2 text-lg font-bold text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="analysis.diagnostics.length > 0"
        @click="run"
      >
        ▶ はじめる
      </button>
    </div>
    <div class="flex rounded-2xl border border-sky-200 bg-sky-50/40 overflow-hidden">
      <LineGutter
        :states="lineStates"
        :line-height="taLineHeight"
        :padding-top="taPaddingTop"
        :padding-bottom="taPaddingBottom"
        :scroll-top="taScrollTop"
        :viewport-height="taClientHeight"
      />
      <textarea
        ref="textarea"
        class="min-h-[420px] flex-1 resize-y p-4 outline-none font-mono text-[16px] leading-[1.6] bg-white"
        :value="text"
        @input="onInput"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
        placeholder="れい） かべとあなとぶ"
        @scroll="onScroll"
      />
    </div>
    <button
      type="button"
      class="self-start rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-sky-50"
      :aria-expanded="keyboardVisible"
      @click="keyboardVisible = !keyboardVisible"
    >{{ keyboardVisible ? "キーボードを とじる" : "ひらがなキーボードを ひらく" }}</button>
    <KanaKeyboard v-if="keyboardVisible" :disabled="composing" @press="onSoftKey" />
    <p v-if="firstError" class="text-sm text-rose-700" role="alert">
      {{ firstError.line }}ぎょうめ：{{ firstError.message }}
    </p>
    <p v-else class="text-sm text-slate-600">ひらがな と すうじで かいてね</p>
  </div>
</template>
