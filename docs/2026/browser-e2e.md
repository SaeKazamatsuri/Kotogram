# ブラウザE2E — 学園祭の操作導線

## 対象

実際のChromium上で、ひらがなソフトキーボードだけの命令入力、固定tickでのステージ1クリア、実SQLite Durable Objects APIへのゲスト登録、3つのランキングタブ、ステージ2遷移、共用端末リセットを確認する。

## CI

GitHub Actions browser-e2e ジョブで Node 22・Nuxt dev・Wrangler dev・Playwright Chromium を起動。Playwright 1.56.1 をCIで固定し、ブラウザバイナリはジョブ内で取得する。キャプチャはテスト失敗時にbrowser-e2e-failureとして保存。

## 手元で試す

1. npm ci
2. npm install --prefix .browser-tools --no-save --no-package-lock playwright@1.56.1
3. .browser-tools/node_modules/.bin/playwright install chromium
4. npm run dev:api（別ターミナル）
5. NUXT_PUBLIC_RANKING_API_BASE の値を http://127.0.0.1:8787 に設定して npm run dev
6. npm run test:browser

会場端末固有のIME挙動・高DPI・マウスドライバ・オフライン復旧については引き続き実機リハーサルが必要。ブラウザ自動化だけでは代替できない。
