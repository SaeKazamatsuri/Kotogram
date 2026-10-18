# Playwright 画面検証

従来の `npm run test:browser` は登録・通信失敗・再送・画面遷移の通し検証として維持する。
`npm run test:visual` は Playwright Test による PC・モバイルの画面とCanvasの描画検査。

CIと同じブラウザを手元で利用するため、アプリの `npm ci` 後に次を実行する。

```powershell
npm install --prefix .browser-tools --no-save --no-package-lock playwright@1.56.1 @playwright/test@1.56.1
```

```powershell
npx --prefix .browser-tools playwright install chromium
```

アプリとWorkerを起動して `npm run test:visual` を実行する。
画像は `test-artifacts/visual-*.png` に保存し、ブラウザごとの状態を比較する。
ピクセル一致の基準画像はOS・フォント・GPUの差を固定できるCI内の画像をレビューしてから導入する。
描画や物理状態の固定tick検証は別途テストケースを追加する。
