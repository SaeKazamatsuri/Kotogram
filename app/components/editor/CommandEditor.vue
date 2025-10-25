<script setup lang="ts">
import {
  computed,
  ref,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import LineGutter from "./LineGutter.vue";

const props = defineProps<{
  dictionary?: {
    conditions: Record<string, string[]>;
    actions: Record<string, string[]>;
  };
  lines?: string[];
}>();
const emit = defineEmits<{
  (e: "update:lines", v: string[]): void;
  (e: "run"): void;
}>();

const text = ref("");
const textarea = ref<HTMLTextAreaElement | null>(null);

// ---- 入力制限（ひらがな＋数字＋空白改行） ----
function sanitizeToHiraganaDigits(input: string) {
  const allow = /[ぁ-ゟー0-9０-９ 　\r\n]/g;
  return (input.match(allow) || []).join("");
}
function onInput(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  const clean = sanitizeToHiraganaDigits(target.value);
  if (clean !== target.value) {
    const pos = target.selectionStart ?? clean.length;
    text.value = clean;
    nextTick(() => {
      if (textarea.value)
        textarea.value.selectionStart = textarea.value.selectionEnd = pos;
    });
  } else {
    text.value = clean;
  }
  updateMetrics();
}

const lineArray = computed(() => text.value.replace(/\r/g, "").split("\n"));
watch(lineArray, (v) => emit("update:lines", v), { immediate: true });

// ---- 辞書による簡易有効判定 ----
const flatWords = computed(() => {
  const d = props.dictionary;
  const c = Object.values(d?.conditions ?? {}).flat();
  const a = Object.values(d?.actions ?? {}).flat();
  return [...c, ...a].filter(Boolean);
});
const lineStates = computed(() =>
  lineArray.value.map((l) =>
    !l.trim()
      ? "empty"
      : flatWords.value.some((w) => w && l.includes(w))
      ? "valid"
      : "invalid"
  )
);

// ---- Gutter同期のためのメトリクス ----
const taScrollTop = ref(0);
const taPaddingTop = ref(0);
const taPaddingBottom = ref(0);
const taLineHeight = ref(20); // px
const taClientHeight = ref(0); // px

function updateMetrics() {
  const el = textarea.value;
  if (!el) return;
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  const fs = parseFloat(cs.fontSize);
  taLineHeight.value = Number.isFinite(lh) ? lh : Math.round(fs * 1.6);
  taPaddingTop.value = parseFloat(cs.paddingTop) - 4 || 0;
  taPaddingBottom.value = parseFloat(cs.paddingBottom) || 0;
  taClientHeight.value = el.clientHeight;
  taScrollTop.value = el.scrollTop;
}
function onScroll() {
  if (!textarea.value) return;
  taScrollTop.value = textarea.value.scrollTop;
}

// ResizeObserverでフォントサイズ変更（A±）やリサイズに追随
let ro: ResizeObserver | null = null;
onMounted(() => {
  updateMetrics();
  if (textarea.value) {
    ro = new ResizeObserver(() => updateMetrics());
    ro.observe(textarea.value);
  }
});
onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
});

// ---- 実行 ----
function run() {
  emit("run");
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
        class="rounded-2xl border-2 border-amber-500 bg-amber-400 hover:bg-amber-300 px-4 py-2 text-lg font-bold text-slate-900"
        @click="run"
      >
        ▶ はじめる
      </button>
    </div>

    <!-- ★ textarea と Gutter を並べ、Gutter に実測メトリクスを渡す -->
    <div
      class="flex rounded-2xl border border-sky-200 bg-sky-50/40 overflow-hidden"
    >
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
        @scroll="onScroll"
        placeholder="れい） まえにかべなら じゃんぷ"
      />
    </div>

    <p class="text-sm text-slate-600">
      ※ ひらがな と すうじ（半角/全角）だけ入力できます
    </p>
  </div>
</template>
