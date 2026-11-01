import { createRequire } from "node:module";

const require = createRequire(new URL("../../.browser-tools/package.json", import.meta.url));
const { test, expect } = require("@playwright/test");

test("マップのEsc3回で次の人へ移り、前の利用者の記録を消す", async ({ page }) => {
  let confirmations = 0;
  page.on("dialog", (dialog) => {
    confirmations++;
    void dialog.accept();
  });

  await page.goto("/stages");
  await expect(page.getByRole("region", { name: "ステージマップ" })).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem("kotogram.stats", JSON.stringify({ "stage-1": { seconds: 8, chars: 4 } }));
    localStorage.setItem("kotogram.nickname", "前の人");
    sessionStorage.setItem("kotogram.recentClear", "stage-1");
  });

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/stages\/?$/);
  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ことグラム" })).toBeVisible();
  expect(confirmations).toBe(1);
  const previous = await page.evaluate(() => ({
    stats: localStorage.getItem("kotogram.stats"),
    nickname: localStorage.getItem("kotogram.nickname"),
    recentClear: sessionStorage.getItem("kotogram.recentClear"),
  }));
  expect(previous).toEqual({ stats: null, nickname: null, recentClear: null });
});

test("プレイ中でも使え、別のキーで連続判定が切れ、取り消したら記録を残す", async ({ page }) => {
  let confirmations = 0;
  page.on("dialog", (dialog) => {
    confirmations++;
    void dialog.dismiss();
  });

  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await expect(editor).toBeVisible();
  await editor.fill("かべとぶ");
  await editor.focus();
  await page.evaluate(() => localStorage.setItem("kotogram.nickname", "前の人"));

  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  expect(confirmations).toBe(0);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/play\/stage-1\/?$/);
  await expect(editor).toHaveValue("かべとぶ");
  expect(confirmations).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("kotogram.nickname"))).toBe("前の人");
});
