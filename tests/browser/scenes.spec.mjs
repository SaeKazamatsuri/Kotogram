import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../.browser-tools/package.json", import.meta.url));
const { test, expect } = require("@playwright/test");

test("ステージ画面の描画が見え、画面の横はみ出しがない", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "遊ぶ" }).click();
  await page.getByRole("link", { name: /ジャンプで かべを こえる/ }).click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const image = await canvas.evaluate((element) => {
    const ctx = element.getContext("2d");
    if (!ctx) return null;
    const { width, height } = element;
    const sample = ctx.getImageData(0, 0, width, height).data;
    const colors = new Set();
    for (let y = 0; y < height; y += 32) {
      for (let x = 0; x < width; x += 32) {
        const i = (y * width + x) * 4;
        colors.add(sample[i] + "," + sample[i + 1] + "," + sample[i + 2]);
      }
    }
    return { width, height, colorCount: colors.size };
  });
  expect(image).not.toBeNull();
  expect(image.width).toBeGreaterThan(0);
  expect(image.height).toBeGreaterThan(0);
  expect(image.colorCount).toBeGreaterThan(6);
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width + 3);
  await mkdir("test-artifacts", { recursive: true });
  await canvas.screenshot({ path: `test-artifacts/visual-${testInfo.project.name}.png`, animations: "disabled" });
});

test("ステージの通信失敗後に画面から再読みこみできる", async ({ page }) => {
  let failedOnce = false;
  await page.route("**/stages/stage-1.json", async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.goto("/play/stage-1");
  await expect(page.getByRole("alert")).toContainText("ステージを読みこめませんでした");
  await page.getByRole("button", { name: "もう一度 読みこむ" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  expect(failedOnce).toBe(true);
});

test("ステージ一覧の初回通信失敗で偽のステージを出さず再試行できる", async ({ page }) => {
  let failedOnce = false;
  await page.route("**/stages/manifest.json", async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.goto("/stages");
  await expect(page.getByRole("alert")).toContainText("ステージを 読みこめませんでした");
  await expect(page.getByRole("link", { name: /ステージ 1/ })).toHaveCount(0);
  await page.getByRole("button", { name: "もう一度 読みこむ" }).click();
  await expect(page.getByRole("link", { name: /ジャンプで かべを こえる/ })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(7);
  expect(failedOnce).toBe(true);
});

test("ゲーム中にコードを編集しても開始時のプログラムで採点・登録する", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await expect(editor).toBeVisible();
  await editor.fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  await editor.fill("はしる");
  await expect(page.getByRole("heading", { name: "ステージクリア！" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("4", { exact: true }).first()).toBeVisible();
  let submittedSource = null;
  await page.route("**/api/results", async (route) => {
    submittedSource = JSON.parse(route.request().postData() ?? "{}").source;
    await route.continue();
  });
  await page.getByRole("button", { name: "きろくを 送る" }).click();
  await expect(page.getByText(/で とうろくできたよ！/)).toBeVisible();
  expect(submittedSource).toBe("かべとぶ");
});
