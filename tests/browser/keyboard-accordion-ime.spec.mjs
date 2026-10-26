import { createRequire } from "node:module";

const require = createRequire(new URL("../../.browser-tools/package.json", import.meta.url));
const { test, expect } = require("@playwright/test");

test("かな入力は初期状態で閉じ、開閉設定を再読み込みまで保って次の人へで消す", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/play/stage-1");
  const toggle = page.getByRole("button", { name: "かな入力" });
  const keyboard = page.getByRole("region", { name: "ひらがなキーボード" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(keyboard).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(keyboard).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("kotogram.keyboard.code"))).toBe("open");

  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(keyboard).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => sessionStorage.getItem("kotogram.keyboard.code"))).toBe("closed");

  await page.goto("/stages");
  await page.evaluate(() => sessionStorage.setItem("kotogram.keyboard.nickname", "open"));
  await page.getByRole("button", { name: /次の人へ/ }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => [
    sessionStorage.getItem("kotogram.keyboard.code"),
    sessionStorage.getItem("kotogram.keyboard.nickname"),
  ])).toEqual([null, null]);
});

test("IMEの未確定文字の入力中も確定済みのコードの色分けを維持する", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  const mirror = page.locator("[data-syntax-mirror]");
  const firstLine = "かべをみつけたらじゃんぷする";
  await editor.fill(firstLine);
  await expect(mirror).toContainText(firstLine);

  const condition = mirror.locator("span").filter({ hasText: "かべ" }).first();
  const action = mirror.locator("span").filter({ hasText: "じゃんぷ" }).first();
  await expect(condition).toHaveClass(/underline/);
  await expect(action).toHaveClass(/font-bold/);

  await editor.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "あ" }));
    element.value = "かべをみつけたらじゃんぷする\nあなを";
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText", data: "あなを", isComposing: true }));
  });
  await expect(mirror).toBeVisible();
  await expect(mirror).toContainText("あなを");
  await expect(condition).toHaveClass(/underline/);
  await expect(action).toHaveClass(/font-bold/);
  await expect(page.getByRole("button", { name: "動かす" })).toBeDisabled();

  await editor.evaluate((element) => {
    element.value = "かべをみつけたらじゃんぷする\nあなをみつけたらじゃんぷする";
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText", data: "あなをみつけたらじゃんぷする", isComposing: true }));
  });
  await expect(mirror).toContainText("あなをみつけたらじゃんぷする");
  await expect(condition).toHaveClass(/underline/);

  await editor.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "あなをみつけたらじゃんぷする" }));
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  });
  await expect(editor).toHaveValue("かべをみつけたらじゃんぷする\nあなをみつけたらじゃんぷする");
  await expect(mirror).toContainText("あなをみつけたらじゃんぷする");
  await expect(page.getByRole("button", { name: "動かす" })).toBeEnabled();
});
