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

async function saveScene(page, name) {
  await mkdir("test-artifacts", { recursive: true });
  const bounds = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  assert.ok(bounds.pageWidth <= bounds.viewport + 3, name + " has horizontal overflow: " + JSON.stringify(bounds));
  await page.screenshot({ path: "test-artifacts/ui-" + name + ".png", fullPage: true, animations: "disabled" });
}

try {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(site, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "冒険を はじめる" }).waitFor();
  await saveScene(page, "title-desktop");
  await page.getByRole("link", { name: "冒険を はじめる" }).click();
  await page.waitForURL(/\/stages$/);
  const firstStage = page.getByRole("link", { name: /かべを とびこえよう/ });
  await firstStage.waitFor();
  await saveScene(page, "map-desktop");
  await page.evaluate(() => localStorage.setItem("external.test.key", "preserved"));
  assert.equal(await page.getByRole("link", { name: /かべ と あな をよけよう/ }).count(), 0);

  await firstStage.click();
  const editor = page.locator("textarea");
  await editor.waitFor({ state: "visible" });
  await saveScene(page, "play-desktop");
  await page.getByRole("button", { name: "かな入力" }).click();
  for (const [kana, mark] of [["か", false], ["へ", true], ["と", false], ["ふ", true]]) {
    await page.getByRole("button", { name: kana + " をにゅうりょく" }).click();
    if (mark) await page.getByRole("button", { name: "゛" }).click();
  }
  assert.equal(await editor.inputValue(), "かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  await page.getByText("ステージクリア！").waitFor({ timeout: 45000 });
  await saveScene(page, "clear-desktop");
  assert.equal(await page.getByText("自分の ベスト").count(), 1);

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
  await page.getByRole("button", { name: "きろくを 送る" }).click();
  await page.getByText(/きろくを おくれなかったよ/).waitFor();
  assert.equal(rejectedFirstSave, true);
  assert.equal(await page.getByText("自分の ベスト").count(), 1);
  await page.unroute("**/api/results");
  await page.getByRole("button", { name: "きろくを 送る" }).click();
  await page.getByText(/で とうろくできたよ！/).waitFor({ timeout: 25000 });
  const guest = await page.locator("p").filter({ hasText: /ゲスト\d+.*とうろくできたよ/ }).first().innerText();
  assert.match(guest, /ゲスト\d+/);
  await page.getByRole("button", { name: "ランキングを 見る" }).click();
  await page.getByText("ランキング").waitFor();
  const tabs = page.getByRole("group", { name: "ランキングのしゅるい" });
  for (const name of ["文字数", "合計", "タイム"]) {
    const tab = tabs.getByRole("button", { name });
    await tab.click();
    assert.equal(await tab.getAttribute("aria-pressed"), "true");
  }

  await page.getByRole("button", { name: "次へ" }).click();
  await page.waitForURL(/\/play\/stage-2$/);
  await editor.waitFor({ state: "visible" });
  assert.equal(await editor.inputValue(), "");
  await page.getByRole("link", { name: /ステージへ/ }).click();
  await page.getByRole("link", { name: /かべ と あな をよけよう/ }).waitFor();

  await page.getByRole("button", { name: /次の人へ/ }).click();
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
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(site, { waitUntil: "domcontentloaded" });
  await mobile.getByRole("link", { name: "冒険を はじめる" }).waitFor();
  await saveScene(mobile, "title-mobile");
  await mobile.getByRole("link", { name: "冒険を はじめる" }).click();
  await mobile.getByRole("link", { name: /かべを とびこえよう/ }).waitFor();
  await saveScene(mobile, "map-mobile");
  await mobile.getByRole("link", { name: /かべを とびこえよう/ }).click();
  await mobile.locator("textarea").waitFor();
  await saveScene(mobile, "play-mobile");
  await mobile.close();
  console.log("Chromium scene QA passed: desktop + mobile layout snapshots, kana, score, retry, SQLite leaderboard, stage routing, reset");
 } catch (error) {
  console.error("Browser screen:", (await page.locator("body").innerText().catch(() => "")).slice(-3000));
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/browser-failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
