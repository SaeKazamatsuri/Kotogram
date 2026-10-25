import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("game tokens, accessible motion fallbacks and app directory class scanning stay configured", () => {
  const css = read("app/assets/css/tailwind.css");
  const tailwind = read("tailwind.config.ts");
  const layout = read("app/layouts/default.vue");
  assert.match(css, /--mint:\s*#94f0c7/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(tailwind, /\.\/app\/\*\*\/\*\.\{vue,ts\}/);
  assert.doesNotMatch(layout, /<header/);
});

test("Nuxt loads the game's real stylesheet and bundles icon components", () => {
  const config = read("nuxt.config.ts");
  assert.match(config, /css: \["~\/assets\/css\/tailwind\.css"\]/);
  assert.match(config, /serverBundle: \{ collections: \["lucide"\] \}/);
  const css = read("app/assets/css/tailwind.css");
  assert.match(css, /\.game-shell\s*\{/);
  assert.match(css, /\.game-workspace\s*\{/);
});

test("visible scenes omit English and stage titles use elementary kanji", () => {
  const files = [
    "app/pages/index.vue", "app/pages/stages.vue", "app/pages/play/[stageId].vue",
    "app/components/editor/CommandEditor.vue", "app/components/game/StageClearModal.vue",
    "app/components/game/StageFailModal.vue", "app/components/game/RankingPanel.vue",
  ];
  for (const name of files) {
    const source = read(name);
    for (const label of ["YOUR NEXT QUEST", "CODE CONSOLE", "WORLD VIEW", "MISSION COMPLETE", "TRY AGAIN", "YOUR SCORE", "Ctrl + Enter"]) {
      assert.equal(source.includes(label), false, name + ": " + label);
    }
  }
  const manifest = JSON.parse(read("public/stages/manifest.json"));
  assert.equal(manifest.stages.length, 30);
  assert.match(manifest.stages[3].title, /4回/);
  assert.match(manifest.stages[5].title, /とる/);
  assert.match(manifest.stages[6].title, /おす/);
  assert.match(manifest.stages[7].title, /色と 形/);
});

test("devtools launcher is not visible in the public game UI", () => {
  assert.match(read("nuxt.config.ts"), /devtools: \{ enabled: false \}/);
});
