import { createRequire } from "node:module";
const require = createRequire(new URL("../../.browser-tools/package.json", import.meta.url));
const { test, expect } = require("@playwright/test");

test("クリアしたコードはステージ移動と再読み込み後も残り、次の人へで消える", async ({ page }) => {
  test.setTimeout(60000);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/play/stage-1");
  const editor = page.getByRole("textbox", { name: "コードを書く" });
  await editor.fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  await expect(page.getByRole("dialog", { name: "ステージクリア" })).toBeVisible({ timeout: 30000 });

  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("kotogram.clearedStageCodes") ?? "{}"));
  expect(stored["stage-1"]).toBe("かべとぶ");

  await page.getByRole("dialog", { name: "ステージクリア" }).getByRole("button", { name: "マップへ" }).click();
  await page.goto("/play/stage-1");
  await expect(editor).toHaveValue("かべとぶ");
  await page.reload();
  await expect(editor).toHaveValue("かべとぶ");

  await editor.fill("はしる");
  await page.goto("/stages");
  await page.goto("/play/stage-1");
  await expect(editor).toHaveValue("かべとぶ");

  await page.goto("/stages");
  await page.getByRole("button", { name: /次の人へ/ }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => sessionStorage.getItem("kotogram.clearedStageCodes"))).toBeNull();

  await page.goto("/play/stage-1");
  await expect(editor).toHaveValue("");
});

test("クリア後のランキング名は画面内かなキーボードで入力して送信できる", async ({ page }) => {
  test.setTimeout(60000);
  let submitted = null;
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
    submitted = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 201,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, nickname: submitted.nickname, runId: submitted.runId, duplicate: false }),
    });
  });

  await page.goto("/play/stage-1");
  await page.getByRole("textbox", { name: "コードを書く" }).fill("かべとぶ");
  await page.getByRole("button", { name: "動かす" }).click();
  const modal = page.getByRole("dialog", { name: "ステージクリア" });
  await expect(modal).toBeVisible({ timeout: 30000 });
  await expect(modal.locator("#ranking-nickname")).toHaveCount(0);
  await modal.getByRole("navigation", { name: "クリアしたあとにすること" }).getByRole("button", { name: /きろく/ }).click();
  const input = modal.locator("#ranking-nickname");
  await expect(input).toHaveAttribute("readonly", "");
  await expect(input).toHaveAttribute("inputmode", "none");
  const toggle = modal.getByRole("button", { name: "かな入力" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const keyboard = modal.getByRole("region", { name: "名前用かなキーボード" });
  await keyboard.getByRole("button", { name: "か をにゅうりょく" }).click();
  await keyboard.getByRole("button", { name: "゛" }).click();
  await keyboard.getByRole("button", { name: "な をにゅうりょく" }).click();
  await expect(input).toHaveValue("がな");
  await modal.getByRole("button", { name: "きろくを 送る" }).click();
  await expect(modal.getByText("「がな」で とうろくできたよ！")).toBeVisible();
  expect(submitted?.nickname).toBe("がな");
});
