import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("game tokens, accessible motion fallbacks and app directory class scanning stay configured", () => {
  const css = read("app/assets/css/tailwind.css");
  const tailwind = read("tailwind.config.ts");
  const layout = read("app/layouts/default.vue");
  assert.match(css, /--mint:\s*#81e3bd/);
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
