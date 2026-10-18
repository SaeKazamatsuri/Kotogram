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
