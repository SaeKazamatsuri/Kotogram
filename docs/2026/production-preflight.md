# 2026年 学園祭本番公開前プリフライト・運用

## 配備先と公開範囲

- 正式なフロントエンド: `https://kotogram.sae-chan.net`。Cloudflare Custom Domain は Worker `kotogram` に接続済み。
- `wrangler.jsonc` は `workers_dev: false` と `preview_urls: false` を明示し、次回デプロイで `workers.dev` とプレビューURLを閉じる。
- 2026-10-19 のCloudflare確認時点ではフロントエンドWorkerの両URLはまだ有効。APIによる直接変更は権限エラーで失敗した。コードの変更だけで本番のURLは無効化されない。
- API Worker `kotogram-api` はCloudflareに存在し、`workers.dev` とプレビューURLが有効だが、Custom Domain/Worker Route は未確認。ランキング停止を防ぐためAPIの公開URLはこのPRでは変更しない。
- API用に独自ドメインを登録し、`NUXT_PUBLIC_RANKING_API_BASE` のビルド設定を更新し、`/api/health`・CORS・ランキングの動作を検証した後でAPIの `workers.dev` を無効化する。

## デプロイ前

1. `npm ci`、`npm test`、`npm run lint`、`npm run typecheck`、`npm run validate:stages`、`npm run generate` を実行する。
2. `npm run preflight:production` でAPIのorigin、Durable Objects、開発/本番Workerの分離を確認する。
3. フロントエンドのデプロイ先は既存Worker `kotogram`、APIのデプロイ先は `kotogram-api`。同じWorkerに上書きしない。
4. Cloudflareアカウント・Custom Domain・ランキングAPIのURLを確認してから、`npm run deploy` を実行する。
5. デプロイ後、正式ドメインのステージ直アクセスとゲーム起動を確認し、フロントエンドWorkerの `workers.dev`・Preview URLs が無効であることをCloudflare APIまたはDashboardで確かめる。
6. API側の変更は独自ドメインとフロントエンドの接続確認後に別途実施する。

## 会場PC運用

- 次の体験者へ渡す前にホームの「つぎのひと」でアプリ用の個人データを初期化する。クラウドランキングは維持する。
- 記録の送信失敗時は画面を閉じずにネットワーク復帰後「きろくを とうろく」を再実行する。
- 端末に前利用者の名前やコードが残る場合は公開を停止し原因を調べる。
- 開場時は代表ステージの操作、ランキング3種類、リセットを点検する。
- 名前には本名、住所、連絡先を書かないよう案内する。

## 保留する実機検証

- 本番APIのCustom Domain割当、Durable Objectsとの導通、CORS・書込み試験。
- 大量リクエスト制限、ランキング保存期間・削除方針。
- 実機の画面倍率・IME・マウス・オフライン復帰と学園祭リハーサル。

## 警告の調査

`workers_dev` と `preview_urls` の未指定警告は明示設定で対処する。ブラウザ互換データの更新はローカルで `npx update-browserslist-db@latest`、`npm install -D baseline-browser-mapping@latest` を実行し差分とビルドを検証してから別PRにする。静的SPAの構成は警告抑制のためだけにSSRへ変更しない。

## フロントエンド配備時に必須のAPI接続先

`npm run deploy` は `npm run preflight:frontend` を最初に実行する。ここで `NUXT_PUBLIC_RANKING_API_BASE` が未設定・HTTP・開発用ホスト・パス付き・Webサイト本体のoriginと同じ場合は配備を止める。

PowerShellからデプロイする場合は、API Workerの実際の本番HTTPS originを確認し、次の形式で実行する。

```powershell
$env:NUXT_PUBLIC_RANKING_API_BASE="https://実際のランキングAPIドメイン"; npm run deploy
```

上記は形式例であり、そのままの仮ドメインでは公開できない。APIは独立したWorkerのため、フロントとAPIを同一URLとして設定しない。Custom Domainへの切り替えが完了するまで、接続済みの現行API公開URLを不用意に止めない。

`npm run generate` や `npm run dev` ではデプロイ用プリフライトを強制しないため、UIだけの開発・CIはAPI URL未設定でも実行できる。
