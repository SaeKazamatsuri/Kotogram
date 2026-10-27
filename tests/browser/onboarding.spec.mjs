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
  const lesson = page.getByRole("dialog", { name: "ステージクリア" });
  await expect(lesson).toBeVisible({ timeout: 30000 });
  await expect(lesson.getByRole("textbox", { name: "ランキングの名前" })).toHaveCount(0);
  await lesson.getByRole("button", { name: "ふりかえる" }).click();
  await expect(lesson).toContainText("かべとぶ");
  await expect(lesson).toContainText("かべがまえにあったらじゃんぷする");
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
  await expect(dialog).toContainText("じゃんぷする ことば");
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

test("案内から かな入力を ひらけるが 初期状態は とじている", async ({ page }) => {
  await page.goto("/play/stage-1");
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  const keyboard = page.getByRole("button", { name: /かな入力/ }).first();
  await expect(keyboard).toHaveAttribute("aria-expanded", "false");
  await guide.getByRole("button", { name: "つぎの ヒント" }).click();
  await guide.getByRole("button", { name: "かな入力を ひらく" }).click();
  await expect(keyboard).toHaveAttribute("aria-expanded", "true");
});

test("通常クリアは 3画面内で簡潔に表示し、くわしい結果とランキングは任意で見る", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/play/stage-1");
  await page.getByRole("textbox", { name: "コードを書く" }).fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  const dialog = page.getByRole("dialog", { name: "ステージクリア" });
  await expect(dialog).toBeVisible({ timeout: 30000 });
  await expect(dialog.getByRole("region", { name: "クリアをよろこぶ" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "ランキングを 見る" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "きろくを 送る" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "ふりかえる" }).click();
  await expect(dialog.getByRole("region", { name: "クリアをふりかえる" })).toBeVisible();
  await dialog.getByRole("button", { name: "きろくを 見る" }).click();
  await expect(dialog.getByRole("region", { name: "きろくをのこす" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "きろくを 送る" })).toBeVisible();
  await expect(dialog.getByText("自分の ベスト")).toHaveCount(0);
  await dialog.getByRole("button", { name: /くわしい 点数と ベスト/ }).click();
  await expect(dialog.getByText("自分の ベスト")).toBeVisible();
  for(const name of ["マップへ", "次へ", "コードを直す"]) {
    const element = dialog.getByRole("button", { name });
    await expect(element).toBeVisible();
    const rect = await element.boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize().height);
  }
});
