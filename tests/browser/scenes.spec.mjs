import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../.browser-tools/package.json", import.meta.url));
const { test, expect } = require("@playwright/test");

test("ステージ画面の描画が見え、画面の横はみ出しがない", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "遊ぶ" }).click();
  await page.getByRole("link", { name: /かべで ジャンプ/ }).click();
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
  await expect(page.getByRole("link", { name: /かべで ジャンプ/ })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(7);
  expect(failedOnce).toBe(true);
});


test("エディターの例文と未対応の言葉を正しく案内する", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  const example = "かべがまえにあったらじゃんぷをする";
  await expect(editor).toHaveAttribute("placeholder", example);
  await editor.fill("かべとぶ\\nあなとぶ\\nおばけよける".replaceAll("\\n", "\n"));
  await expect(page.getByRole("alert")).toContainText("『よける』");
  await expect(page.getByRole("alert")).not.toContainText("『よ』");
  await editor.fill(example);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "動かす" })).toBeEnabled();
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
  await expect(page.getByRole("dialog", { name: "ステージクリア" }).getByText(/4字/).first()).toBeVisible();
  let submittedSource = null;
  await page.route("**/api/results", async (route) => {
    submittedSource = JSON.parse(route.request().postData() ?? "{}").source;
    await route.continue();
  });
  await page.getByRole("button", { name: "きろくを 送る" }).click();
  await expect(page.getByText(/で とうろくできたよ！/)).toBeVisible();
  expect(submittedSource).toBe("かべとぶ");
});

test("次の人へ初期化した後に前利用者の遅い送信結果が名前を復活させない", async ({ page }) => {
  test.setTimeout(60000);
  page.on("dialog", (dialog) => dialog.accept());
  let releaseResponse;
  let signalRequest;
  const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
  const requestSeen = new Promise((resolve) => { signalRequest = resolve; });

  await page.route("**/api/results", async (route) => {
    const origin = route.request().headers().origin ?? "http://127.0.0.1:3000";
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    signalRequest();
    await responseGate;
    await route.fulfill({
      status: 201,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, nickname: "ゲスト999", runId: "test", duplicate: false }),
    });
  });

  await page.goto("/play/stage-1");
  await page.getByRole("textbox", { name: "コードを書く" }).fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  await expect(page.getByRole("heading", { name: "ステージクリア！" })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "きろくを 送る" }).click();
  await requestSeen;
  await page.getByRole("link", { name: "ステージへ" }).click();
  await page.evaluate(() => localStorage.setItem("kotogram.nickname", "前の人"));
  await page.getByRole("button", { name: /次の人へ/ }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kotogram.nickname"))).toBeNull();

  const received = page.waitForResponse((response) => response.url().endsWith("/api/results") && response.request().method() === "POST");
  releaseResponse();
  await received;
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => localStorage.getItem("kotogram.nickname"))).toBeNull();
});

test("ぼうけんマップに進行状態と7つのステージが表示される", async ({ page }, testInfo) => {
  await page.goto("/stages");
  const map = page.getByRole("region", { name: "ステージマップ" });
  await expect(map).toBeVisible();
  await expect(page.getByRole("list", { name: "ステージ一覧" }).getByRole("listitem")).toHaveCount(7);
  await expect(page.locator(".map-stop.is-current")).toHaveCount(1);
  await expect(page.locator(".map-stop.is-locked")).toHaveCount(6);
  await expect(page.getByRole("link", { name: /ステージ 1 ジャンプで かべを こえる/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /ステージ 2/ })).toHaveCount(0);
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width + 3);
  await mkdir("test-artifacts", { recursive: true });
  await map.screenshot({ path: `test-artifacts/world-map-${testInfo.project.name}.png`, animations: "disabled" });
});

test("マップの入口からプレイ画面に進める", async ({ page }) => {
  await page.goto("/stages");
  await page.getByRole("link", { name: /ステージ 1 ジャンプで かべを こえる/ }).click();
  await expect(page).toHaveURL(new RegExp("/play/stage-1$"));
  await expect(page.locator("canvas")).toBeVisible();
});

test("ステージクリア後にマップへ戻ると旗と次のステージが表示される", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/play/stage-1");
  await page.getByRole("textbox", { name: "コードを書く" }).fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  await expect(page.getByRole("heading", { name: "ステージクリア！" })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "マップへ" }).click();
  await expect(page.getByRole("region", { name: "ステージマップ" })).toBeVisible();
  await expect(page.locator(".map-stop.is-cleared")).toHaveCount(1);
  await expect(page.locator(".map-stop.is-celebrating")).toHaveCount(1);
  await expect(page.locator(".map-stop.is-current").getByText("ステージ 2")).toBeVisible();
  await expect(page.getByRole("link", { name: /ステージ 2 かべと あなで ジャンプ/ })).toBeVisible();
});

test("タイトルの冒険シーンはマップとつながり、画面幅からはみ出さない", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ことグラム" })).toBeVisible();
  await expect(page.locator(".title-world__avatar")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "遊ぶ" })).toBeVisible();
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width + 3);
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: `test-artifacts/title-scene-${testInfo.project.name}.png`, animations: "disabled" });
  await page.getByRole("link", { name: "遊ぶ" }).click();
  await expect(page.getByRole("region", { name: "ステージマップ" })).toBeVisible();
});

test("プレイ画面はゲームを大きく表示し、狭い画面では一列になる", async ({ page }, testInfo) => {
  await page.goto("/play/stage-1");
  const workspace = page.locator(".game-workspace--stage");
  await expect(workspace).toBeVisible();
  const columns = await workspace.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").map((value) => Number.parseFloat(value)),
  );
  if (testInfo.project.use.viewport.width > 960) {
    expect(columns).toHaveLength(2);
    expect(columns[1]).toBeGreaterThan(columns[0]);
  } else {
    expect(columns).toHaveLength(1);
  }
  await expect(page.locator("canvas")).toBeVisible();
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: `test-artifacts/play-scene-${testInfo.project.name}.png`, animations: "disabled" });
});

test("プレイ画面はページ全体をスクロールせずに操作できる", async ({ page }) => {
  await page.goto("/play/stage-1");
  await expect(page.locator(".game-workspace--stage")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerHeight,
    document: document.documentElement.scrollHeight,
    layout: document.querySelector(".play-screen")?.getBoundingClientRect().height,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
  expect(dimensions.layout).toBeLessThanOrEqual(dimensions.viewport);
  const runButton = page.getByRole("button", { name: "動かす" });
  await expect(runButton).toBeVisible();
  const buttonBounds = await runButton.boundingBox();
  const editorBounds = await page.locator(".play-screen__editor").boundingBox();
  expect(buttonBounds).not.toBeNull();
  expect(editorBounds).not.toBeNull();
  expect(buttonBounds.y).toBeGreaterThanOrEqual(editorBounds.y);
  expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(editorBounds.y + editorBounds.height);
  expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(page.viewportSize().height);
});

test("リザルト画面で次へ・マップへ・コードを直すが常に見える", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/play/stage-1");
  await page.getByRole("textbox", { name: "コードを書く" }).fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  const dialog = page.getByRole("dialog", { name: "ステージクリア" });
  await expect(dialog).toBeVisible({ timeout: 30000 });
  await expect(dialog.locator(".celebration-confetti")).toHaveCount(96);
  await expect(dialog.getByText("やったね！")).toBeVisible();
  for (const name of ["次へ", "マップへ", "コードを直す"]) {
    const action = dialog.getByRole("button", { name });
    await expect(action).toBeVisible();
    const bounds = await action.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  }
  await dialog.getByRole("button", { name: "ランキングを 見る" }).click();
  await expect(dialog.getByRole("button", { name: "マップへ" })).toBeVisible();
});

test("次の人へで記録と直前のクリア演出を消してタイトルへ戻る", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/stages");
  await page.evaluate(() => {
    localStorage.setItem("kotogram.stats", JSON.stringify({ "stage-1": { seconds: 8, chars: 4 } }));
    localStorage.setItem("kotogram.nickname", "前の人");
    sessionStorage.setItem("kotogram.recentClear", "stage-1");
  });
  await page.reload();
  await page.getByRole("button", { name: /次の人へ/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ことグラム" })).toBeVisible();
  const previous = await page.evaluate(() => ({
    stats: localStorage.getItem("kotogram.stats"),
    nickname: localStorage.getItem("kotogram.nickname"),
    recentClear: sessionStorage.getItem("kotogram.recentClear"),
  }));
  expect(previous).toEqual({ stats: null, nickname: null, recentClear: null });
});

test("空中の木をなくしてもマップを横方向に動かせる", async ({ page }) => {
  await page.goto("/stages");
  await expect(page.locator(".map-tree")).toHaveCount(5);
  const positions = await page.locator(".map-tree").evaluateAll((trees) =>
    trees.map((tree) => Number.parseInt(tree.style.top, 10)),
  );
  expect(positions.every((y) => y >= 70)).toBe(true);
  if (page.viewportSize().width > 639) {
    const map = page.getByRole("region", { name: "ステージマップ" });
    const before = await map.evaluate((element) => element.scrollLeft);
    await page.getByRole("button", { name: "マップを右へ" }).click();
    await expect.poll(() => map.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
  }
});
