<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { CONTROL_WORDS, SWITCH_ATTRIBUTES, type Vocabulary } from "~/language/parser";
import { ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID } from "~/scoring/score";
import { STAGE_WORLDS } from "~/stage/world-map";

useHead({
  title: "開発資料 | ことグラム",
  meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }],
});

const { loadDictionary } = useDictionary();
const { getManifest } = useStageLoader();
const dictionary = ref<Vocabulary>({ actions: {}, conditions: {} });
const manifest = ref<{ version?: string; stages: { id: string; title: string; version?: string }[] }>({ stages: [] });
const loading = ref(true);
const error = ref("");
const controlGroups = Object.entries(CONTROL_WORDS.reduce<Record<string, string[]>>((result, token) => {
  (result[token.kind] ??= []).push(token.raw);
  return result;
}, {}));
const actionLabels: Record<string, string> = {
  jump: "ジャンプ", powerJump: "強いジャンプ", crouch: "しゃがむ", collect: "拾う", openChest: "開ける", enterPortal: "入る",
  run: "走る", sprint: "高速走行", walk: "歩く", press: "押す", skip: "見送る", breakDoor: "扉を破る",
};
const conditionLabels: Record<string, string> = {
  wall: "かべ", enemy: "おばけ", hole: "あな", ahead: "前", coin: "コイン", switch: "スイッチ", door: "扉", conveyor: "動く床", fragileFloor: "こわれる床", wind: "風", pressurePlate: "ふむ床", movingPlatform: "動く足場", laser: "ひかり", bridge: "橋", key: "かぎ", chest: "宝箱", portal: "ワープ",
};
const grammarLabels: Record<string, string> = {
  repeat: "繰り返し", end: "終わり", if: "もし", then: "条件のつなぎ", or: "または", count: "回数", particle: "助詞",
};
const actions = computed(() => Object.entries(dictionary.value.actions ?? {}).map(([key, words]) => ({
  name: actionLabels[key] ?? key, key, words,
})));
const conditions = computed(() => Object.entries(dictionary.value.conditions ?? {}).map(([key, words]) => ({
  name: conditionLabels[key] ?? key, key, words,
})));
const vocabularyCount = computed(() => actions.value.reduce((n, e) => n + e.words.length, 0)
  + conditions.value.reduce((n, e) => n + e.words.length, 0) + CONTROL_WORDS.length + SWITCH_ATTRIBUTES.length);
const worlds = computed(() => STAGE_WORLDS.map((world) => ({
  ...world, stages: manifest.value.stages.slice(world.start - 1, world.end),
})));

onMounted(async () => {
  try {
    const [words, stages] = await Promise.all([loadDictionary(), getManifest()]);
    dictionary.value = words;
    manifest.value = stages;
  } catch {
    error.value = "資料の読みこみに失敗しました";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 pb-12">
    <div class="space-y-2">
      <p class="game-kicker">開発者用の資料</p>
      <h1 class="game-screen-title">ことグラム 参照情報</h1>
      <p class="text-sm text-[#d8e8ee]">この画面にはゲーム内のリンクを設けていません。公開されたURLを知っていれば誰でも開けるため、秘密の設定値や個人情報を保存しないでください。</p>
    </div>

    <p v-if="loading" role="status" class="game-panel p-5">読み込み中…</p>
    <p v-else-if="error" role="alert" class="game-panel p-5">{{ error }}</p>
    <template v-else>
      <div class="grid gap-3 sm:grid-cols-3">
        <section class="game-panel p-4"><h2 class="font-black">ステージ</h2><p class="mt-1 text-3xl font-black">{{ manifest.stages.length }}</p></section>
        <section class="game-panel p-4"><h2 class="font-black">辞書の登録表記</h2><p class="mt-1 text-3xl font-black">{{ vocabularyCount }}</p></section>
        <section class="game-panel p-4"><h2 class="font-black">世界</h2><p class="mt-1 text-3xl font-black">{{ worlds.length }}</p></section>
      </div>

      <section class="game-panel space-y-4 p-5" aria-label="言葉辞書">
        <h2 class="text-xl font-black">パーサーの言葉辞書（全表記）</h2>
        <p class="text-sm">入力はひらがな・数字が基本です。色・形の記号にも対応しています。ここにはJSON辞書とパーサーの修飾語を含む全表記を掲載しています。</p>
        <div class="grid gap-5 md:grid-cols-2">
          <div>
            <h3 class="mb-2 text-lg font-black">対象・条件</h3>
            <dl class="space-y-3">
              <div v-for="entry in conditions" :key="entry.key">
                <dt class="font-black">{{ entry.name }} <span class="text-xs font-normal">({{ entry.key }})</span></dt>
                <dd class="break-words text-sm">{{ entry.words.join("、") }}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 class="mb-2 text-lg font-black">動作</h3>
            <dl class="space-y-3">
              <div v-for="entry in actions" :key="entry.key">
                <dt class="font-black">{{ entry.name }} <span class="text-xs font-normal">({{ entry.key }})</span></dt>
                <dd class="break-words text-sm">{{ entry.words.join("、") }}</dd>
              </div>
            </dl>
          </div>
        </div>
        <h3 class="border-t border-[#c9d6d8] pt-4 text-lg font-black">色・形を表す言葉</h3>
        <dl class="grid gap-3 sm:grid-cols-2">
          <div v-for="word in SWITCH_ATTRIBUTES" :key="word.raw">
            <dt class="font-black">{{ word.raw }}</dt>
            <dd class="text-sm">{{ word.value }}</dd>
          </div>
        </dl>
        <h3 class="border-t border-[#c9d6d8] pt-4 text-lg font-black">制御語・接続語</h3>
        <dl class="grid gap-3 sm:grid-cols-2">
          <div v-for="[kind, words] in controlGroups" :key="kind">
            <dt class="font-black">{{ grammarLabels[kind] ?? kind }} <span class="text-xs font-normal">({{ kind }})</span></dt>
            <dd class="text-sm">{{ words.join("、") }}</dd>
          </div>
        </dl>
      </section>

      <section class="game-panel space-y-3 p-5">
        <h2 class="text-xl font-black">構文例と注意点</h2>
        <pre class="overflow-x-auto rounded-xl bg-[#182e43] p-4 text-sm leading-7 text-white">かべをまえにみつけたらじゃんぷする
おばけがいたらしゃがむ
3かいくりかえす
こいんをとる
おわり</pre>
        <p class="text-sm">隠しコマンドは実際のパーサー辞書には含まれますが、ゲーム内の「使える言葉」には表示しません。短縮・最速解法の評価は登録済みの解法に基づき、理論上の最適を保証しません。</p>
      </section>

      <section class="game-panel space-y-4 p-5">
        <h2 class="text-xl font-black">ステージと世界の一覧</h2>
        <div v-for="world in worlds" :key="world.start" class="space-y-2">
          <h3 class="text-lg font-black">{{ world.title }}（{{ world.start }}〜{{ world.end }}）</h3>
          <div class="grid gap-2 sm:grid-cols-2">
            <div v-for="stage in world.stages" :key="stage.id" class="rounded-xl bg-[#e6eff0] px-3 py-2 text-sm">
              <span class="font-black">{{ stage.id }}：{{ stage.title }}</span>
              <span class="ml-2 text-xs">版 {{ stage.version ?? manifest.version ?? "不明" }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="game-panel space-y-3 p-5">
        <h2 class="text-xl font-black">開発・検証情報</h2>
        <dl class="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt class="font-black">シーズン</dt><dd>{{ SEASON_ID }}</dd></div>
          <div><dt class="font-black">ゲームエンジン</dt><dd>{{ ENGINE_VERSION }}</dd></div>
          <div><dt class="font-black">言語仕様</dt><dd>{{ LANGUAGE_VERSION }}</dd></div>
          <div><dt class="font-black">採点仕様</dt><dd>{{ SCORING_VERSION }}</dd></div>
        </dl>
        <h3 class="border-t border-[#c9d6d8] pt-3 font-black">追加情報用の領域</h3>
        <p class="text-sm">今後、解法の比較結果・ステージ難易度・動作検証情報などをここに集約できます。GitHub上の登録済みデータを参照し、管理者の秘密情報や利用者の記録は表示しません。</p>
      </section>
    </template>
  </div>
</template>
