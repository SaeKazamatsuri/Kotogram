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

test("濁点と半濁点の記号を大きく表示し、スマートフォンでも文字を変換できる", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/play/stage-1");
  await page.getByRole("button", { name: "かな入力" }).click();

  const keyboard = page.getByRole("region", { name: "ひらがなキーボード" });
  for (const name of ["゛", "゜"]) {
    const key = keyboard.getByRole("button", { name });
    const symbol = key.locator("svg");
    await expect(symbol).toBeVisible();
    await expect(symbol).toHaveCSS("width", "32px");
    await expect(symbol).toHaveCSS("height", "32px");
    const box = await key.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }

  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("か");
  await editor.evaluate(element => element.setSelectionRange(1, 1));
  await keyboard.getByRole("button", { name: "゛" }).click();
  await expect(editor).toHaveValue("が");

  await editor.fill("は");
  await editor.evaluate(element => element.setSelectionRange(1, 1));
  await keyboard.getByRole("button", { name: "゜" }).click();
  await expect(editor).toHaveValue("ぱ");
});

test("画面をスクロールせずにコード欄とかな入力を操作できる", async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 600 },
    { width: 960, height: 540 },
    { width: 390, height: 844 },
    { width: 390, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/play/stage-1");
    const toggle = page.getByRole("button", { name: "かな入力" });
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const keyboard = page.getByRole("region", { name: "ひらがなキーボード" });
    await expect(keyboard).toBeVisible();
    const result = await page.evaluate(() => {
      const editor = document.querySelector('textarea[aria-label="コードを書く"]');
      const dock = document.querySelector("#code-kana-keyboard");
      const keyboard = dock?.querySelector('section[aria-label="ひらがなキーボード"]');
      const visibleKeys = Array.from(keyboard?.querySelectorAll("button") ?? []).filter(key => key.getBoundingClientRect().height > 0);
      const inside = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top >= -2 && rect.bottom <= window.innerHeight + 2 && rect.left >= -2 && rect.right <= window.innerWidth + 2;
      };
      return {
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        editorVisible: editor && inside(editor) && editor.getBoundingClientRect().height >= 70,
        dockVisible: dock && inside(dock) && dock.scrollHeight <= dock.clientHeight + 2,
        keyboardVisible: keyboard && inside(keyboard),
        allKeysVisible: visibleKeys.every(inside),
      };
    });
    expect(result, JSON.stringify(viewport)).toMatchObject({
      editorVisible: true,
      dockVisible: true,
      keyboardVisible: true,
      allKeysVisible: true,
    });
    expect(result.pageHeight).toBeLessThanOrEqual(result.viewportHeight + 2);
    if (viewport.width < 1151) {
      await keyboard.getByRole("button", { name: "は〜わ" }).click();
      await keyboard.getByRole("button", { name: "は をにゅうりょく" }).click();
      await keyboard.getByRole("button", { name: "数字" }).click();
      await keyboard.getByRole("button", { name: "1 をにゅうりょく" }).click();
    } else {
      await keyboard.getByRole("button", { name: "は をにゅうりょく" }).click();
    }
    await expect(page.getByRole("textbox", { name: "コードを書く" })).toHaveValue(viewport.width < 1151 ? "は1" : "は");
    await page.getByRole("button", { name: "ゲームを見る" }).click();
    await expect(page.locator('.game-playview canvas[data-tour-target="canvas"]')).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
});

test("ゲームと入力欄の右クリックでコンテキストメニューを開かない", async ({ page }) => {
  await page.goto("/play/stage-1");
  await expect(page.locator('.game-playview canvas[data-tour-target="canvas"]')).toBeVisible();
  await expect(page.getByRole("textbox", { name: "コードを書く" })).toBeVisible();
  const prevented = await page.evaluate(() => {
    const targets = [
      document.querySelector(".game-playview canvas"),
      document.querySelector('textarea[aria-label="コードを書く"]'),
      document.body,
    ];
    return targets.map(target => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
      target?.dispatchEvent(event);
      return event.defaultPrevented;
    });
  });
  expect(prevented).toEqual([true, true, true]);
});
