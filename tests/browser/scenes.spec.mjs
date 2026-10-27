import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../.browser-tools/package.json", import.meta.url));
const { test, expect } = require("@playwright/test");

test("ステージ画面の描画が見え、画面の横はみ出しがない", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "遊ぶ" }).click();
  await page.getByRole("link", { name: /かべで ジャンプ/ }).click();
  const canvas = page.locator(".game-playview canvas[aria-label]").first();
  await expect(canvas).toBeVisible();
  const sampleColors = () => canvas.evaluate((element) => {
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
  await expect.poll(async () => (await sampleColors())?.colorCount ?? 0).toBeGreaterThan(6);
  const image = await sampleColors();
  expect(image).not.toBeNull();
  expect(image.width).toBeGreaterThan(0);
  expect(image.height).toBeGreaterThan(0);
  expect(image.colorCount).toBeGreaterThan(6);
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width + 3);
  await mkdir("test-artifacts", { recursive: true });
  await canvas.screenshot({ path: `test-artifacts/visual-${testInfo.project.name}.png`, animations: "disabled" });
});

test("失敗後も開始地点を下見でき、オブジェクト名と色分けが見える", async ({ page }) => {
  test.setTimeout(45000);
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("かべをみつけたらじゃんぷする");
  await expect(page.locator("[data-syntax-mirror]").first()).toContainText("かべをみつけたらじゃんぷする");
  await expect(page.locator("[data-syntax-mirror] span").filter({ hasText: "かべ" }).first()).toHaveClass(/underline/);
  await expect(page.locator("[data-syntax-mirror] span").filter({ hasText: "じゃんぷ" }).first()).toHaveClass(/font-bold/);
  const canvas = page.locator(".game-playview canvas[aria-label]").first();
  const hoverWall = async () => {
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error("Missing canvas bounds");
    await page.mouse.move(bounds.x + bounds.width * 610 / 720, bounds.y + bounds.height * 234 / 360);
    await expect(page.getByRole("tooltip")).toHaveText("かべ");
  };
  await hoverWall();
  await editor.fill("あるく");
  await page.getByRole("button", { name: "動かす" }).click();
  await expect(page.getByRole("dialog", { name: "ステージしっぱい" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "コードを直す" }).click();
  await hoverWall();
});

test("マップのタップとドラッグを区別し、画面縮小時にもオブジェクト名を表示できる", async ({ page }, testInfo) => {
  await page.goto("/play/stage-1");
  const canvas = page.locator(".game-playview canvas[aria-label]").first();
  await expect(canvas).toBeVisible();
  const location = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + element.clientLeft + element.clientWidth * 610 / 720,
      y: rect.top + element.clientTop + element.clientHeight * 234 / 360,
    };
  });
  if (testInfo.project.use.hasTouch) await page.touchscreen.tap(location.x, location.y);
  else await page.mouse.click(location.x, location.y);
  await expect(page.getByRole("tooltip")).toHaveText("かべ");
  const boundary = await canvas.boundingBox();
  if (!boundary) throw new Error("Missing canvas");
  const start = { x: boundary.x + boundary.width * 0.8, y: boundary.y + boundary.height * 0.6 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - Math.min(70, boundary.width / 3), start.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("長文を折り返しても構文表示と行番号・実行帯が同じ行高になる", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("かべをまえにみつけたらじゃんぷする".repeat(6) + "\nかべとぶ");
  await expect(page.locator("[data-syntax-row]")).toHaveCount(2);
  await expect.poll(async () => page.evaluate(() => {
    const row = document.querySelector("[data-syntax-row]");
    const gutter = document.querySelector("[data-editor-gutter-row]");
    if (!(row instanceof HTMLElement) || !(gutter instanceof HTMLElement)) return -100;
    return Math.abs(row.getBoundingClientRect().height - gutter.getBoundingClientRect().height);
  })).toBeLessThan(1.5);
  const sizes = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-syntax-row]")];
    const gutters = [...document.querySelectorAll("[data-editor-gutter-row]")];
    return { rows: rows.map(row => row.getBoundingClientRect().height), gutters: gutters.map(row => row.getBoundingClientRect().height) };
  });
  expect(sizes.rows[0]).toBeGreaterThan(sizes.rows[1] * 2);
  expect(sizes.gutters.length).toBe(2);
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
  await expect(page.locator(".game-playview canvas[aria-label]").first()).toBeVisible();
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
  await expect(page.getByRole("alert")).toContainText("ステージを読みこめませんでした");
  await expect(page.getByRole("link", { name: /ステージ 1/ })).toHaveCount(0);
  await page.getByRole("button", { name: "もう一度 読みこむ" }).click();
  await expect(page.getByRole("link", { name: /かべで ジャンプ/ })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(10);
  expect(failedOnce).toBe(true);
});


test("エディターの例文と未対応の言葉を正しく案内する", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  const example = "かべがまえにあったらじゃんぷする";
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
    const origin = route.request().headers().origin ?? "*";
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = JSON.parse(route.request().postData() ?? "{}");
    submittedSource = body.source;
    await route.fulfill({
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ ok: true, nickname: "ゲスト1", runId: body.runId, duplicate: false }),
    });
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
  await page.getByRole("dialog", { name: "ステージクリア" }).getByRole("button", { name: "マップへ" }).click();
  await page.evaluate(() => localStorage.setItem("kotogram.nickname", "前の人"));
  await page.getByRole("button", { name: /次の人へ/ }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kotogram.nickname"))).toBeNull();

  const received = page.waitForResponse((response) => response.url().endsWith("/api/results") && response.request().method() === "POST");
  releaseResponse();
  await received;
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => localStorage.getItem("kotogram.nickname"))).toBeNull();
});

test("ぼうけんマップに10個ずつ3つの世界が表示される", async ({ page }, testInfo) => {
  await page.goto("/stages");
  const map = page.getByRole("region", { name: "ステージマップ" });
  await expect(map).toBeVisible();
  await expect.poll(async () => (await map.boundingBox())?.height ?? 0).toBeGreaterThan(200);
  await expect(page.getByRole("list", { name: "ステージ一覧" }).getByRole("listitem")).toHaveCount(10);
  await expect(page.locator(".map-stop.is-current")).toHaveCount(1);
  await expect(page.locator(".map-stop.is-locked")).toHaveCount(9);
  await expect(page.getByRole("link", { name: /ステージ 1 かべで ジャンプ/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /ステージ 2/ })).toHaveCount(0);
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width + 3);
  await mkdir("test-artifacts", { recursive: true });
  await map.screenshot({ path: `test-artifacts/world-map-${testInfo.project.name}.png`, animations: "disabled" });
});

test("マップの入口からプレイ画面に進める", async ({ page }) => {
  await page.goto("/stages");
  await page.getByRole("link", { name: /ステージ 1 かべで ジャンプ/ }).click();
  await expect(page).toHaveURL(new RegExp("/play/stage-1$"));
  await expect(page.locator(".game-playview canvas[aria-label]").first()).toBeVisible();
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
  await expect(page.locator(".game-playview canvas[aria-label]").first()).toBeVisible();
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
  const rankingButton = dialog.getByRole("button", { name: "ランキングを 見る" });
  const sendButton = dialog.getByRole("button", { name: "きろくを 送る" });
  await expect(rankingButton).toBeVisible();
  await expect(sendButton).toBeVisible();
  const rankingBounds = await rankingButton.boundingBox();
  const sendBounds = await sendButton.boundingBox();
  expect(rankingBounds.x).toBeLessThan(sendBounds.x);
  if (Math.abs(rankingBounds.y - sendBounds.y) < 2) {
    expect(sendBounds.x - rankingBounds.x - rankingBounds.width).toBeGreaterThanOrEqual(8);
  }
  const mapBounds = await dialog.getByRole("button", { name: "マップへ" }).boundingBox();
  const nextBounds = await dialog.getByRole("button", { name: "次へ" }).boundingBox();
  if (Math.abs(mapBounds.y - nextBounds.y) < 2) {
    expect(mapBounds.x).toBeLessThan(nextBounds.x);
  } else {
    expect(mapBounds.y).toBeLessThan(nextBounds.y);
  }
  await rankingButton.click();
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

test("タイトルとマップでゲームと同じキャラクターの絵を使う", async ({ page }) => {
  async function getCharacterSignature(selector) {
    return page.locator(selector).evaluate((canvas) => {
      const ctx = canvas.getContext("2d");
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0;
      let filled = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 0) filled++;
        for (let j = 0; j < 4; j++) hash = (Math.imul(hash, 31) + pixels[i + j]) >>> 0;
      }
      return { hash, filled };
    });
  }

  await page.goto("/");
  await expect(page.locator(".title-world__avatar canvas")).toBeVisible();
  const title = await getCharacterSignature(".title-world__avatar canvas");
  expect(title.filled).toBeGreaterThan(1000);
  await page.getByRole("link", { name: "遊ぶ" }).click();
  await expect(page.locator(".map-hero canvas")).toBeVisible();
  const map = await getCharacterSignature(".map-hero canvas");
  expect(map).toEqual(title);
});

test("マップをドラッグで横と縦に動かし、ステージの誤選択を防ぐ", async ({ page }, testInfo) => {
  await page.goto("/stages");
  const map = page.getByRole("region", { name: "ステージマップ" });
  await expect(map).toBeVisible();
  const mobile = testInfo.project.use.viewport.width <= 639;
  await map.evaluate((el, isMobile) => {
    el.scrollLeft = isMobile ? 0 : 200;
    el.scrollTop = isMobile ? 150 : 0;
  }, mobile);
  const before = await map.evaluate((el, isMobile) => isMobile ? el.scrollTop : el.scrollLeft, mobile);
  const bounds = await map.boundingBox();
  const x = bounds.x + bounds.width * 0.5;
  const y = bounds.y + bounds.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(mobile ? x : x - 110, mobile ? y - 100 : y, { steps: 8 });
  await page.mouse.up();
  const after = await map.evaluate((el, isMobile) => isMobile ? el.scrollTop : el.scrollLeft, mobile);
  expect(after).toBeGreaterThan(before + 25);
  await expect(page).toHaveURL(/\/stages\/?$/);
  await expect(map).not.toHaveClass(/is-dragging/);

  if (!mobile) {
    await map.evaluate((el) => { el.scrollLeft = 0; });
    const stage = page.getByRole("link", { name: /ステージ 1 かべで ジャンプ/ });
    const box = await stage.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 25);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 70, box.y + 25, { steps: 8 });
    await page.mouse.up();
    await expect(page).toHaveURL(/\/stages\/?$/);
    await stage.click();
    await expect(page).toHaveURL(/\/play\/stage-1$/);
  }
});


test("3つの世界を選ぶと対応する10ステージと世界観が切り替わる", async ({ page }) => {
  await page.goto("/stages");
  const stops = page.getByRole("list", { name: "ステージ一覧" }).getByRole("listitem");
  await expect(stops).toHaveCount(10);
  await expect(page.locator(".map-land--world-0")).toHaveCount(1);
  await page.getByRole("button", { name: /夕やけの谷/ }).click();
  await expect(page.locator(".map-land--world-1")).toHaveCount(1);
  await expect(stops).toHaveCount(10);
  await expect(stops.first()).toContainText("ステージ 11");
  await expect(stops.last()).toContainText("ステージ 20");
  await page.getByRole("button", { name: /星あかりの国/ }).click();
  await expect(page.locator(".map-land--world-2")).toHaveCount(1);
  await expect(stops.first()).toContainText("ステージ 21");
  await expect(stops.last()).toContainText("ステージ 30");
  await expect(page.locator(".map-stop.is-locked")).toHaveCount(10);
});

test("編集中は辞書を表示でき、キャンバスをドラッグして下見できる", async ({ page }) => {
  await page.goto("/play/stage-1");
  await expect(page.getByRole("button", { name: "使える言葉" })).toBeVisible();
  await page.getByRole("button", { name: "使える言葉" }).click();
  const guide = page.getByRole("region", { name: "使える言葉の辞書" });
  await expect(guide).toContainText("じゃんぷ");
  await expect(guide).toContainText("かべ");
  await expect(guide).not.toContainText("めっちゃはしる");
  await expect(guide).not.toContainText("すごいじゃんぷ");
  await expect(guide).not.toContainText("はねる");

  const canvas = page.locator(".game-playview canvas[aria-label]");
  await expect(canvas).toBeVisible();
  const before = await canvas.evaluate((element) => element.toDataURL());
  const box = await canvas.boundingBox();
  const x = box.x + box.width * 0.65;
  const y = box.y + box.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - box.width * 0.4, y, { steps: 8 });
  await page.mouse.up();
  const after = await canvas.evaluate((element) => element.toDataURL());
  expect(after).not.toEqual(before);
  await expect(page.getByText("ドラッグで先を見る")).toBeVisible();
});

test("参照情報は専用URLだけで開き、全語彙と開発情報を確認できる", async ({ page }) => {
  await page.goto("/play/stage-1");
  await expect(page.locator('a[href="/reference"]')).toHaveCount(0);
  await page.goto("/reference");
  await expect(page.getByRole("heading", { name: "ことグラム 参照情報" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "パーサーの言葉辞書（全表記）" })).toBeVisible();
  await expect(page.getByText("めっちゃはしる", { exact: false })).toBeVisible();
  await expect(page.getByText("はねる", { exact: false })).toBeVisible();
  await expect(page.getByText("stage-30", { exact: false })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive");
});

test("マップの両端は看板が切れず、画面全体は縦にスクロールしない", async ({ page }) => {
  await page.goto("/stages");
  const stops = page.getByRole("list", { name: "ステージ一覧" }).getByRole("listitem");
  await expect(stops).toHaveCount(10);
  for (const name of ["こもれびの森", "夕やけの谷", "星あかりの国"]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const map = await page.locator(".map-land").boundingBox();
    for (const stop of [stops.first(), stops.last()]) {
      const sign = await stop.locator(".map-stop__sign").boundingBox();
      expect(sign.x).toBeGreaterThanOrEqual(map.x + 2);
      expect(sign.x + sign.width).toBeLessThanOrEqual(map.x + map.width - 2);
    }
    const overflow = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
      body: document.body.scrollHeight,
    }));
    expect(overflow.height).toBeLessThanOrEqual(overflow.viewport + 3);
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 3);
  }
});

test("実行中に発火した日本語命令だけがハイライトされる", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  await expect(editor).toHaveAttribute("readonly", "");
  await expect(page.getByText("▶ 動作中")).toBeVisible();
  await expect(page.locator('[data-execution="fired"]').first()).toBeVisible({ timeout: 10000 });
  await expect(editor).toHaveValue("かべとぶ");
});

test("走り続けるコード行は発動後も弱く点灯し、終了時には消える", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("はしる\nかべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  const runningLine = page.locator('[data-execution="sustained"][data-mode="run"]');
  await expect(runningLine).toBeVisible({ timeout: 7000 });
  await expect(runningLine).toContainText("走行中");
  await expect(editor).toHaveAttribute("readonly", "");
  await expect(page.getByRole("dialog", { name: "ステージクリア" })).toBeVisible({ timeout: 12000 });
  await expect(page.locator('[data-execution="sustained"]')).toHaveCount(0);
});

test("条件行を見はり中として表示し、発動した動作行と区別する", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("もしかべがあったら\nじゃんぷ\nおわり");
  await page.getByRole("button", { name: "動かす" }).click();
  const watcher = page.locator('[data-execution="monitoring"]');
  await expect(watcher).toHaveCount(1);
  await expect(watcher).toContainText("見はり");
  await expect(page.locator('[data-execution="fired"]').first()).toBeVisible({ timeout: 12000 });
  await expect(watcher).toHaveCount(1);
});

test("失敗した後はさいごに発動した命令行を残し、編集すると消す", async ({ page }) => {
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("はしる");
  await page.getByRole("button", { name: "動かす" }).click();
  await expect(page.getByRole("dialog", { name: "ステージしっぱい" })).toBeVisible({ timeout: 12000 });
  await page.getByRole("button", { name: "コードを直す" }).click();
  await expect(page.locator('[data-execution="last-action"]')).toBeVisible();
  await expect(page.getByRole("status", { name: "最後に動いたのは1行目" })).toBeVisible();
  await editor.fill("かべとぶ");
  await expect(page.locator('[data-execution="last-action"]')).toHaveCount(0);
});
