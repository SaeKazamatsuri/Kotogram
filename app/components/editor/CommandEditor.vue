<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { analyzeProgram, type Vocabulary } from "~/language/parser";
import { countSourceCharacters } from "~/scoring/score";
import LineGutter from "./LineGutter.vue";
import KanaKeyboard from "./KanaKeyboard.vue";
import { editWithSoftKey, type SoftKey, type TextSelection } from "~/editor/text-input";
import { EditorHistory } from "~/editor/history";

const props = defineProps<{ dictionary?: Vocabulary; lines?: string[] }>();
const emit = defineEmits<{ (e: "update:lines", value: string[]): void; (e: "run"): void }>();
const text = ref("");
const textarea = ref<HTMLTextAreaElement | null>(null);
const composing = ref(false);
const keyboardVisible = ref(false);
const history = new EditorHistory();
const historyRevision = ref(0);

function sanitize(input: string) {
  return (input.normalize("NFC").match(/[ぁ-ゟー0-9０-９ \u3000\r\n]/g) ?? []).join("");
}
function record(state: TextSelection) {
  history.record(state);
  historyRevision.value++;
}
function acceptInput(target: HTMLTextAreaElement) {
  const original = target.value;
  const cleaned = sanitize(original);
  const cursor = sanitize(original.slice(0, target.selectionStart ?? original.length)).length;
  text.value = cleaned;
  record({ text: cleaned, start: cursor, end: cursor });
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
const charCount = computed(() => countSourceCharacters(text.value));
const validLines = computed(() => lineStates.value.filter((state) => state === "valid" || state === "loop").length);
const taScrollTop = ref(0);
const taPaddingTop = ref(0);
const taPaddingBottom = ref(0);
const taLineHeight = ref(20);
const taClientHeight = ref(0);
const canUndo = computed(() => { void historyRevision.value; return history.canUndo; });
const canRedo = computed(() => { void historyRevision.value; return history.canRedo; });

function updateMetrics() {
  const element = textarea.value;
  if (!element) return;
  const style = getComputedStyle(element);
  const lineHeight = parseFloat(style.lineHeight);
  const fontSize = parseFloat(style.fontSize);
  taLineHeight.value = Number.isFinite(lineHeight) ? lineHeight : Math.round(fontSize * 1.6);
  taPaddingTop.value = parseFloat(style.paddingTop) || 0;
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
  if (textarea.value && typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(updateMetrics);
    observer.observe(textarea.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

function applyState(state: TextSelection) {
  const element = textarea.value;
  text.value = state.text;
  if (!element) return;
  element.value = state.text;
  nextTick(() => {
    if (textarea.value !== element) return;
    element.focus({ preventScroll: true });
    element.setSelectionRange(state.start, state.end);
    updateMetrics();
  });
}
function undo() {
  if (composing.value) return;
  const previous = history.undo();
  if (previous) { historyRevision.value++; applyState(previous); }
}
function redo() {
  if (composing.value) return;
  const next = history.redo();
  if (next) { historyRevision.value++; applyState(next); }
}
function clearText() {
  if (!text.value || composing.value) return;
  if (!window.confirm("かいた めいれいを ぜんぶ けしても いい？")) return;
  record({ text: "", start: 0, end: 0 });
  applyState({ text: "", start: 0, end: 0 });
}
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
  record({ text: normalized, start: cursor, end: cursor });
  applyState({ text: normalized, start: cursor, end: cursor });
}
function onKeydown(event: KeyboardEvent) {
  if (composing.value || event.isComposing || !(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === "enter") { event.preventDefault(); run(); }
  else if (key === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
  else if (key === "y") { event.preventDefault(); redo(); }
}
function run() {
  if (analysis.value.diagnostics.length === 0) emit("run");
}
function getText() { return text.value; }
defineExpose({ getText });
</script>

<template>
  <div class="flex min-w-0 flex-col gap-0">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#4d5773] bg-[#252e4b] px-5 py-4 text-[#fff7e8]">
      <div>
        <p class="text-[10px] font-black tracking-[.2em] text-[#82dfc2]">CODE CONSOLE / 01</p>
        <h2 class="text-xl font-black">めいれいエディタ</h2>
      </div>
      <span class="rounded-full border border-[#697595] bg-[#131d36] px-3 py-1 text-xs font-black text-[#e0e8f7]">{{ lineArray.length }}ぎょう ・ {{ charCount }}もじ</span>
    </div>
    <div class="flex flex-wrap items-center gap-2 border-b border-[#c3c3d2] bg-[#e4e5f0] px-4 py-3 text-[#30364d]">
      <button type="button" class="rounded-xl border border-[#9499b0] bg-white px-3 py-2 text-sm font-bold disabled:opacity-40" :disabled="!canUndo || composing" @click="undo" aria-label="ひとつもどす">↶ もどす</button>
      <button type="button" class="rounded-xl border border-[#9499b0] bg-white px-3 py-2 text-sm font-bold disabled:opacity-40" :disabled="!canRedo || composing" @click="redo" aria-label="やりなおす">↷ やりなおす</button>
      <button type="button" class="ml-auto rounded-xl border border-[#cfbbc4] bg-[#fff8f0] px-3 py-2 text-sm font-bold disabled:opacity-40" :disabled="!text || composing" @click="clearText">ぜんぶ けす</button>
    </div>
    <div class="flex min-w-0 overflow-hidden bg-[#f9f8f1]">
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
        class="min-h-[300px] min-w-0 flex-1 resize-y bg-[#fcfcf7] p-4 font-mono text-[17px] font-semibold leading-[1.7] text-[#213b4a] outline-none placeholder:text-[#8895a2] focus:bg-white"
        :value="text"
        aria-label="めいれいを かく"
        :spellcheck="false"
        autocomplete="off"
        @input="onInput"
        @keydown="onKeydown"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
        placeholder="れい） かべとぶ"
        @scroll="onScroll"
      />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-[#d2d4d6] bg-[#fff8e7] px-4 py-3">
      <p v-if="firstError" role="alert" class="text-sm font-bold text-[#af324b]">{{ firstError.line }}ぎょうめ：{{ firstError.message }}</p>
      <p v-else class="text-sm font-bold text-[#326957]">✓ {{ validLines }}ぎょう かけたよ ・ ひらがな と すうじを つかおう</p>
      <span class="text-xs font-bold text-[#5e667c]">Ctrl + Enter で じっこう</span>
    </div>
    <div class="space-y-3 bg-[#ecebf1] p-4">
      <button
        type="button"
        class="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-[#303750] bg-[#81e3bd] px-5 py-4 text-xl font-black text-[#193a35] shadow-[0_5px_0_#303750] transition hover:brightness-105 active:translate-y-[3px] active:shadow-[0_2px_0_#303750] disabled:opacity-50"
        :disabled="analysis.diagnostics.length > 0 || composing"
        @click="run"
      >▶ はじめる <span class="text-xs font-bold">/ じっこう</span></button>
      <button
        type="button"
        class="flex w-full items-center justify-center rounded-xl border-2 border-[#8b8faa] bg-[#fff7e8] px-4 py-3 text-sm font-black text-[#27334d]"
        :aria-expanded="keyboardVisible"
        @click="keyboardVisible = !keyboardVisible"
      >{{ keyboardVisible ? "キーボードを とじる" : "ひらがなキーボードを ひらく" }}</button>
      <KanaKeyboard v-if="keyboardVisible" :disabled="composing" @press="onSoftKey" />
    </div>
  </div>
</template>
