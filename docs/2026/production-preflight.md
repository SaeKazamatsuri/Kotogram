# 2026年 学園祭本番公開前プリフライト・運用

## 配備先と公開範囲

- 正式なフロントエンド: `https://kotogram.sae-chan.net`。Cloudflare Custom Domain は Worker `kotogram` に接続済み。
- `wrangler.jsonc` は `workers_dev: false` と `preview_urls: false` を明示し、次回デプロイで `workers.dev` とプレビューURLを閉じる。
- 2026-10-19 のCloudflare確認時点ではフロントエンドWorkerの両URLはまだ有効。APIによる直接変更は権限エラーで失敗した。コードの変更だけで本番のURLは無効化されない。
- API Worker `kotogram-api` の正式なCustom Domainは `https://kotogram-api.sae-chan.net`。Cloudflareから独自ドメインの接続設定が確認できており、`wrangler.api.jsonc` の `env.production.routes` にも宣言済み。
- `npm run deploy:api` で既存の `kotogram-api` Workerに独自ドメインを割り当てる。ランキングDB/DOの移行タグを変更しない。APIの `/api/health`、CORS、3種類のランキングを検証し、フロントエンドが新ドメインを使うことを確認した後にAPIの `workers.dev` を無効化する。

## デプロイ前

1. `npm ci`、`npm test`、`npm run lint`、`npm run typecheck`、`npm run validate:stages`、`npm run generate` を実行する。
2. `npm run preflight:production` でAPIのorigin、Durable Objects、開発/本番Workerの分離を確認する。
3. フロントエンドのデプロイ先は既存Worker `kotogram`、APIのデプロイ先は `kotogram-api`。同じWorkerに上書きしない。
4. 最初に `npm run deploy:api` で本番API Workerと新しいCustom Domainを公開し、`https://kotogram-api.sae-chan.net/api/health` が応答することを確かめる。その後 `npm run deploy` でフロントエンドを配備する。
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

`npm run deploy` は `npm run preflight:frontend` を最初に実行する。ここで `NUXT_PUBLIC_RANKING_API_BASE` が指定されている場合は `https://kotogram-api.sae-chan.net` と完全に一致するか検査する。未指定の場合も正式APIを既定値として使用する。

PowerShellからデプロイする場合は、API Workerの実際の本番HTTPS originを確認し、次の形式で実行する。

```powershell
npm run deploy:api; npm run deploy
```

APIは `kotogram-api.sae-chan.net` の別Workerとして配備する。以前のターミナルに `NUXT_PUBLIC_RANKING_API_BASE` が残っている場合は新しいURLに更新するか、`Remove-Item Env:NUXT_PUBLIC_RANKING_API_BASE` で解除する。新ドメインのヘルスチェックとCORS検証が終わるまで、現行の `workers.dev` は止めない。

`npm run generate` や `npm run dev` ではデプロイ用プリフライトを強制しないため、UIだけの開発・CIはAPI URL未設定でも実行できる。

## デプロイ後の読み取り専用検査

本番に配備したら、ローカルPowerShellで実際の本番APIのoriginを指定して確認する。

```powershell
npm run smoke:production
```

このコマンドは正式ドメインのタイトル画面・ステージ一覧・ステージ直接アクセス、公開ステージJSON、API health、CORSのOPTIONS、ステージ1のランキング3種類のGETを確認する。ランキングの書き込みやゲスト番号の発行は一切行わない。

APIがまだ別のバージョンの場合はランキングのGETで失敗する。このとき本番データを初期化せず、フロントとAPIのルールバージョンが一致しているかを確認する。テスト送信や同時登録は、事前に分離した検証環境で実施する。

## 2026-10-19 API独自ドメイン変更

- 正式なAPI URL: `https://kotogram-api.sae-chan.net`
- Cloudflare Custom Domain APIの登録は認証エラー `10000` のため、このセッションから直接完了できていない。`npm run deploy:api` をCloudflare権限のある端末で実行する。
- 新しいWorkerを作り直さず、従来の `kotogram-api` を更新する。`StageRanking` / `GuestCounter` のDurable Objectsを保持する。
- 2026-10-19 のCloudflare設定読み取りで `kotogram-api.sae-chan.net` が本番Worker `kotogram-api` に接続済み、APIの `workers.dev` とPreview URLsが無効であることを確認。GitHubの `wrangler.api.jsonc` 側も `workers_dev: false` / `preview_urls: false` に更新し、次回のデプロイで再有効化されないようにした。
- HTTP `/api/health` とランキング/CORSの独立した外部通信検証は、本セッションのネットワークの名前解決制限により確認できていない。`npm run smoke:production` で運用環境から確認する。
