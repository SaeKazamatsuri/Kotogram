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
  if (!window.confirm("コードを 全部消す？")) return;
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
function run() {
  if (analysis.value.diagnostics.length === 0) emit("run");
}
function getText() { return text.value; }
defineExpose({ getText });
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
    <div class="flex min-h-14 items-center justify-between gap-3 border-b border-[#7083a0] bg-[#243551] px-5 py-3 text-[#fffaf1]">
      <h2 class="flex items-center gap-2 text-base font-black"><Icon name="lucide:code-2" class="game-icon text-[#aaf0d0]" aria-hidden="true"/> コードを書く</h2>
      <span class="rounded-full bg-[#17263f] px-3 py-1 text-sm font-black text-white">{{ charCount }} 字</span>
    </div>
    <div class="flex flex-wrap items-center gap-2 bg-[#e3eaf1] px-3 py-2 text-[#23344e]">
      <button type="button" class="flex min-h-11 items-center gap-2 rounded-xl border border-[#95a8bd] bg-white px-3 text-sm font-black disabled:opacity-50" :disabled="!canUndo || composing" @click="undo" aria-label="もどす"><Icon name="lucide:undo-2" class="game-icon" aria-hidden="true"/> もどす</button>
      <button type="button" class="flex min-h-11 items-center gap-2 rounded-xl border border-[#95a8bd] bg-white px-3 text-sm font-black disabled:opacity-50" :disabled="!canRedo || composing" @click="redo" aria-label="やり直す"><Icon name="lucide:redo-2" class="game-icon" aria-hidden="true"/> やり直す</button>
      <button type="button" class="ml-auto flex min-h-11 items-center gap-2 rounded-xl border border-[#95a8bd] bg-white px-3 text-sm font-black disabled:opacity-50" :disabled="!text || composing" @click="clearText"><Icon name="lucide:trash-2" class="game-icon" aria-hidden="true"/> 全部消す</button>
    </div>
    <div class="flex min-h-[130px] min-w-0 flex-1 overflow-hidden bg-[#fffaf1]">
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
        class="min-h-0 min-w-0 flex-1 resize-none bg-[#fffaf1] p-4 text-[18px] font-bold leading-[1.7] text-[#172439] outline-none placeholder:text-[#62778a] focus:bg-white"
        :value="text"
        aria-label="コードを書く"
        :spellcheck="false"
        autocomplete="off"
        @input="onInput"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
        placeholder="かべがまえにあったらじゃんぷをする"
        @scroll="onScroll"
      />
    </div>
    <p v-if="firstError" role="alert" class="border-t border-[#de9ea9] bg-[#fff1ef] px-4 py-3 text-sm font-black text-[#9f203c]">{{ firstError.line }} 行目：{{ firstError.message }}</p>
    <div class="flex flex-wrap items-center gap-3 border-t-2 border-[#7083a0] bg-[#243551] p-3">
      <button type="button" class="game-button game-button--mint flex-1 text-lg disabled:opacity-50" :disabled="analysis.diagnostics.length > 0 || composing" @click="run"><Icon name="lucide:play" class="game-icon" aria-hidden="true"/> 動かす</button>
      <button type="button" class="game-button game-button--night text-sm" :aria-expanded="keyboardVisible" @click="keyboardVisible = !keyboardVisible"><Icon name="lucide:keyboard" class="game-icon" aria-hidden="true"/> かな入力</button>
    </div>
    <div v-if="keyboardVisible" class="border-t border-[#7083a0] bg-[#243551] p-3">
      <KanaKeyboard :disabled="composing" @press="onSoftKey" />
    </div>
  </div>
</template>
