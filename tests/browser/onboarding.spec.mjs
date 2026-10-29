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

test("ドラッグの見本から操作すると、次のステップに進み入力欄まで案内線がつながる", async ({ page }) => {
  await page.goto("/play/stage-1");
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  const canvas = page.locator('canvas[data-tour-target="canvas"]');
  await expect(page.locator(".drag-demo")).toBeVisible();
  await expect(page.locator(".tutorial-connector__target")).toBeVisible();
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  await page.mouse.move(rect.x + rect.width * .7, rect.y + rect.height * .5);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * .3, rect.y + rect.height * .5, { steps: 10 });
  await page.mouse.up();
  await expect(guide).toContainText("2 / 5");
  await expect(guide).toContainText("かべがまえにあったらじゃんぷする");
  await expect(page.locator(".drag-demo")).toHaveCount(0);
  const highlighted = await page.locator(".tutorial-connector__target").boundingBox();
  const editor = await page.locator('textarea[data-tour-target="editor"]').boundingBox();
  expect(highlighted).not.toBeNull();
  expect(editor).not.toBeNull();
  expect(Math.abs(highlighted.x - editor.x)).toBeLessThan(4);
  expect(Math.abs(highlighted.y - editor.y)).toBeLessThan(4);
});

test("対象の名前とステージ辞書を順番に案内し、辞典リンクは表示しない", async ({ page }) => {
  await page.goto("/play/stage-1");
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  for (let step = 0; step < 3; step++) await guide.getByRole("button", { name: "つぎの ヒント" }).click();
  await expect(guide).toContainText("マウス");
  await expect(guide).toContainText("タップ");
  await guide.getByRole("button", { name: "つぎの ヒント" }).click();
  await expect(guide).toContainText("使える言葉");
  await expect(guide.getByRole("link")).toHaveCount(0);
  await page.getByRole("button", { name: "使える言葉" }).click();
  await expect(page.getByRole("region", { name: "使える言葉の辞書" })).toBeVisible();
});

test("新しいしかけを初めて遊ぶと説明を表示し、閉じてももう一度見られる", async ({ page }) => {
  await page.addInitScript(() => {
    const stats = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`stage-${index + 1}`, { seconds: 5, chars: 5 }]));
    window.localStorage.setItem("kotogram.stats", JSON.stringify(stats));
  });
  await page.goto("/play/stage-8");
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("色と 形");
  await guide.getByRole("button", { name: "つぎの ヒント" }).click();
  await expect(guide).toContainText("使える言葉");
  await guide.getByRole("button", { name: "わかった！" }).click();
  await expect(guide).toBeHidden();
  await page.reload();
  await expect(guide).toBeHidden();
  await page.getByRole("button", { name: "あんないを 見る" }).click();
  await expect(guide).toBeVisible();
});


test("矢印はフォーカスだけでは消えず、コードを入力したら消える", async ({ page }) => {
  await page.goto("/play/stage-1");
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  await guide.getByRole("button", { name: "つぎの ヒント" }).click();
  const arrow = page.locator(".tutorial-connector");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await expect(arrow).toBeVisible();
  await editor.focus();
  await expect(arrow).toBeVisible();
  await editor.fill("かべとぶ");
  await expect(arrow).toHaveCount(0);
  await expect(guide).toBeVisible();
});

test("辞書の矢印は辞書を操作したときにだけ消える", async ({ page }) => {
  await page.goto("/play/stage-1");
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  for (let index = 0; index < 4; index++) await guide.getByRole("button", { name: "つぎの ヒント" }).click();
  await expect(page.locator(".tutorial-connector")).toBeVisible();
  await page.getByRole("button", { name: "使える言葉" }).click();
  await expect(page.locator(".tutorial-connector")).toHaveCount(0);
  await expect(guide).toBeVisible();
});

test("矢印の線は先端より手前で終わる", async ({ page }) => {
  await page.goto("/play/stage-1");
  const connector = page.locator(".tutorial-connector__line");
  await expect(connector.locator("polygon")).toBeVisible();
  const tipGap = await connector.evaluate((svg) => {
    const line = svg.querySelector("path");
    const head = svg.querySelector("polygon");
    const end = line.getPointAtLength(line.getTotalLength());
    const [x, y] = head.getAttribute("points").split(" ")[0].split(",").map(Number);
    return Math.hypot(end.x - x, end.y - y);
  });
  expect(tipGap).toBeGreaterThan(10);
});

test("せまいスマホでもガイドとアイコン操作が画面内に収まる", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/play/stage-1");
  const guide = page.getByRole("region", { name: "主人公のあんない" });
  await expect(guide).toBeVisible();
  const dictionary = page.getByRole("button", { name: "使える言葉" });
  await expect(dictionary).toBeVisible();
  await expect(dictionary.locator(".editor-control-label")).toBeHidden();
  const layout = await page.evaluate(() => {
    const bubble = document.querySelector("[data-tutorial-bubble]").getBoundingClientRect();
    const game = document.querySelector(".game-playview").getBoundingClientRect();
    const dictionaryButton = document.querySelector('[data-tour-target="dictionary"]').getBoundingClientRect();
    return { bubble: { left: bubble.left, right: bubble.right, top: bubble.top, bottom: bubble.bottom },
      game: { top: game.top, bottom: game.bottom }, dictionaryButton: { right: dictionaryButton.right, width: dictionaryButton.width },
      documentWidth: document.documentElement.scrollWidth };
  });
  expect(layout.bubble.left).toBeGreaterThanOrEqual(0);
  expect(layout.bubble.right).toBeLessThanOrEqual(320);
  expect(layout.bubble.top).toBeGreaterThanOrEqual(layout.game.top);
  expect(layout.bubble.bottom).toBeLessThanOrEqual(layout.game.bottom + 1);
  expect(layout.dictionaryButton.right).toBeLessThanOrEqual(320);
  expect(layout.dictionaryButton.width).toBeLessThanOrEqual(48);
  expect(layout.documentWidth).toBeLessThanOrEqual(320);
});
