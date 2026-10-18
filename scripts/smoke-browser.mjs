import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const browserRequire = createRequire(new URL("../.browser-tools/package.json", import.meta.url));
const { chromium } = browserRequire("playwright");

const site = process.env.BROWSER_SITE_BASE ?? "http://localhost:3000";
const api = process.env.WORKER_API_BASE ?? "http://127.0.0.1:8787";

async function waitForServer(url) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Server did not become ready: " + url);
}

await Promise.all([waitForServer(site), waitForServer(api + "/api/health")]);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(20000);
page.on("requestfailed", (request) => console.error("Request failed:", request.url(), request.failure()?.errorText));
page.on("pageerror", (error) => console.error("Browser page error:", error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.error("Browser console error:", message.text());
});
page.on("response", (response) => {
  if (response.url().includes(":8787")) console.log("API response:", response.status(), response.url());
});


try {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(site, { waitUntil: "domcontentloaded" });
  const firstStage = page.getByRole("link", { name: /かべを とびこえよう/ });
  await firstStage.waitFor();
  await page.evaluate(() => localStorage.setItem("external.test.key", "preserved"));
  assert.equal(await page.getByRole("link", { name: /かべ と あな をよけよう/ }).count(), 0);

  await firstStage.click();
  const editor = page.locator("textarea");
  await editor.waitFor({ state: "visible" });
  await page.getByRole("button", { name: "ひらがなキーボードを ひらく" }).click();
  for (const [kana, mark] of [["か", false], ["へ", true], ["と", false], ["ふ", true]]) {
    await page.getByRole("button", { name: kana + " をにゅうりょく" }).click();
    if (mark) await page.getByRole("button", { name: "゛" }).click();
  }
  assert.equal(await editor.inputValue(), "かべとぶ");
  await page.getByRole("button", { name: /はじめる/ }).click();
  await page.getByText("ステージクリア！").waitFor({ timeout: 45000 });
  assert.equal(await page.getByText("このたんまつの じこベスト").count(), 1);

  const browserApiHealth = await page.evaluate(async (base) => {
    try {
      const response = await fetch(base + "/api/health");
      return { status: response.status, body: await response.text() };
    } catch (error) {
      return { error: String(error) };
    }
  }, api);
  console.log("Browser API health:", JSON.stringify(browserApiHealth));
  console.log("Browser security and crypto:", await page.evaluate(() => ({
    secure: window.isSecureContext,
    randomUUID: typeof crypto.randomUUID,
    rankingConfig: window.__NUXT__?.config?.public?.rankingApiBase ?? "not exposed",
  })));

  let rejectedFirstSave = false;
  await page.route("**/api/results", async (route) => {
    if (!rejectedFirstSave) {
      rejectedFirstSave = true;
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
  await page.getByRole("button", { name: "きろくを とうろく" }).click();
  await page.getByText(/きろくを おくれなかったよ/).waitFor();
  assert.equal(rejectedFirstSave, true);
  assert.equal(await page.getByText("このたんまつの じこベスト").count(), 1);
  await page.unroute("**/api/results");
  await page.getByRole("button", { name: "きろくを とうろく" }).click();
  await page.getByText(/で とうろくできたよ！/).waitFor({ timeout: 25000 });
  const guest = await page.locator("p").filter({ hasText: /ゲスト\d+.*とうろくできたよ/ }).first().innerText();
  assert.match(guest, /ゲスト\d+/);
  await page.getByRole("button", { name: "ランキングを みる" }).click();
  await page.getByText("みんなの ランキング").waitFor();
  const tabs = page.getByRole("group", { name: "ランキングのしゅるい" });
  for (const name of ["もじすう", "そうごう", "タイム"]) {
    const tab = tabs.getByRole("button", { name });
    await tab.click();
    assert.equal(await tab.getAttribute("aria-pressed"), "true");
  }

  await page.getByRole("button", { name: "つぎへ" }).click();
  await page.waitForURL(/\/play\/stage-2$/);
  await editor.waitFor({ state: "visible" });
  assert.equal(await editor.inputValue(), "");
  await page.getByRole("link", { name: /ステージ選択へ/ }).click();
  await page.getByRole("link", { name: /かべ と あな をよけよう/ }).waitFor();

  await page.getByRole("button", { name: /つぎのひと/ }).click();
  await firstStage.waitFor();
  assert.equal(await page.getByRole("link", { name: /かべ と あな をよけよう/ }).count(), 0);
  const storage = await page.evaluate(() => ({
    external: localStorage.getItem("external.test.key"),
    player: localStorage.getItem("kotogram.player"),
    nickname: localStorage.getItem("kotogram.nickname"),
    stats: localStorage.getItem("kotogram.stats"),
    bests: localStorage.getItem("kotogram.bests"),
  }));
  assert.equal(storage.external, "preserved");
  for (const field of ["player", "nickname", "stats", "bests"]) assert.equal(storage[field], null);
  console.log("Chromium venue smoke passed: mouse kana, score, offline save retry, SQLite ranking, tabs, stage transition, reset");
 } catch (error) {
  console.error("Browser screen:", (await page.locator("body").innerText().catch(() => "")).slice(-3000));
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/browser-failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
