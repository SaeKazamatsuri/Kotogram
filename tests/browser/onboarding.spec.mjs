import { createRequire } from "node:module";

const require = createRequire(new URL("../../.browser-tools/package.json", import.meta.url));
const { test, expect } = require("@playwright/test");

test("初回は主人公が自然文を案内し、クリア後に同じステージで短縮を練習できる", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "つぎの ヒント" }).click();
  await expect(guide).toContainText("かべがまえにあったらじゃんぷする");
  await editor.fill("かべがまえにあったらじゃんぷする");
  await page.getByRole("button", { name: "動かす" }).click();
  const lesson = page.getByRole("dialog", { name: "はじめての クリア" });
  await expect(lesson).toBeVisible({ timeout: 30000 });
  await lesson.getByRole("button", { name: "つぎの はなし" }).click();
  await expect(lesson).toContainText("かべとぶ");
  await lesson.getByRole("button", { name: "つぎの はなし" }).click();
  await lesson.getByRole("button", { name: "みじかく 書いて ためす" }).click();
  await expect(editor).toHaveValue("かべがまえにあったらじゃんぷする");
  await expect(guide).toContainText("かべとぶ");
  await editor.fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  await expect(page.getByRole("dialog", { name: "ステージクリア" })).toBeVisible({ timeout: 30000 });
});

test("初回ガイドは閉じて再表示でき、次の人へで初期化される", async ({ page }) => {
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/play/stage-1");
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "あとで" }).click();
  await expect(guide).toBeHidden();
  await page.reload();
  await expect(guide).toBeHidden();
  await page.getByRole("button", { name: "あんないを 見る" }).click();
  await expect(guide).toBeVisible();
  await page.goto("/stages");
  await page.getByRole("button", { name: "次の人へ" }).click();
  await page.goto("/play/stage-1");
  await expect(guide).toBeVisible();
});

test("失敗した対象と次に試す動作が見える", async ({ page }) => {
  test.setTimeout(45000);
  await page.goto("/play/stage-1");
  await page.getByRole("textbox", { name: "コードを書く" }).fill("あるく");
  await page.getByRole("button", { name: "動かす" }).click();
  const dialog = page.getByRole("dialog", { name: "ステージしっぱい" });
  await expect(dialog).toBeVisible({ timeout: 20000 });
  await expect(dialog).toContainText("かべを じゃんぷして よけよう");
  await dialog.getByRole("button", { name: "もっと ヒント" }).click();
  await expect(dialog).toContainText("じゃんぷする めいれい");
});

test("かたかなは ひらがなに直し、つかえない文字は理由を示す", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("カベトブ");
  await expect(editor).toHaveValue("かべとぶ");
  await expect(page.getByRole("status").filter({ hasText: "かたかなを ひらがな" })).toBeVisible();
  await editor.fill("壁をジャンプ");
  await expect(editor).toHaveValue("をじゃんぷ");
  await expect(page.getByRole("status").filter({ hasText: "つかえない もじ" })).toBeVisible();
});
