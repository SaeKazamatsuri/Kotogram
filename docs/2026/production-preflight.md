# 2026年 学園祭本番公開前プリフライト・運用

## デプロイ直前の環境指定

1. 公開予定のフロントエンドの実URLを確定する。プライベートなプレビューURLや末尾スラッシュ付きURLではなく、厳密なHTTPS originを使用する。
2. wrangler.api.jsonc の env.production.vars.ALLOWED_ORIGIN をその実際のoriginに変更する。現在の configure-your-site.example のままでは公開不可。
3. npm run preflight:production を実行し、開発/本番Worker名の分離、RANKING/COUNTER binding、SQLite Durable Objects migrationsの設定を確認する。
4. NUXT_PUBLIC_RANKING_API_BASE には実際の本番Worker URLを指定してフロントエンドをビルドする。
5. 本番DBと開発DBの分離を確認し、npm run deploy:api を行う。実行前にCloudflareのログインと対象アカウントを確認する。
6. 本番フロント/Workerの配備後、/api/health のJSONとCORS、実ブラウザからのテスト投稿・ランキング取得を確認する。

このプリフライトは静的な構成検査であり、Cloudflare上の権限や実DO配備状態を確認するものではない。

## 会場PC運用

- 体験の最初にホームの「つぎのひと（きろくを けす）」で前の人のデータを消去する。クラウドランキングは維持される。
- クリア記録の送信に失敗した場合は、ページを閉じず、接続が戻ってから「きろくを とうろく」を再度押す。
- ゲーム進行だけならネットワークが一時的に切れても続けられる場合がある。初回データ読み込みが失敗した場合は回線復帰後に再読み込みする。
- 端末で前の人のコードやニックネームが残る場合は、その端末の公開を止めて原因を確認する。
- 毎日の開場時に代表的なステージを1つ遊び、ランキング3タブとリセットを確認する。
- 名前には本名・住所・連絡先を書かないように案内する。

## 未完了の公開前作業

- 本番のドメイン/配備先の確定、Cloudflare上の実DO導通、アクセス権限。
- 大量リクエスト時の制限と保管期間・削除方針。
- 実機の画面倍率、日本語IME、マウス入力、オフライン→復旧の通し練習。


## 2026年の正式な公開URL

フロントエンドの正式な origin は `https://kotogram.sae-chan.net`。Workersの本番 `ALLOWED_ORIGIN` にこれを設定する。
`NUXT_PUBLIC_RANKING_API_BASE` は実際のAPIのURLが確定してからフロントエンドに設定し、WebサイトのURLと混同しない。

次のコマンドは本番に書き込みを行わず、WebサイトのHTML応答・APIのhealth・CORSヘッダーを検査する。

```powershell
$env:PRODUCTION_RANKING_API_BASE="https://実際のAPIドメイン"; npm run smoke:production
```

本番デプロイ前に `npm run preflight:production` とCIを通し、Cloudflareのアカウント・DO migration・APIルートを確認する。
本番APIが未デプロイの場合、URLを推測して埋めない。書込み・ゲストの競合試験は別途保護された会場用ステージ・テスト条件で実施する。
今回のコード追加はデプロイそのものではない。

## 現行のCloudflare環境の確認（2026-10-19）

Cloudflareの読み取り専用確認では、`sae-chan.net` ゾーンは active、`kotogram.sae-chan.net` は既存のWorker `kotogram`（production）に紐付いている。一方、ランキングAPIのWorker `kotogram-api` は未登録。現行Workerの更新日時は2026年5月3日で、このPRの内容はまだ配信されていない。

フロントエンド用に `wrangler.jsonc` を追加し、`npm run generate` 後に既存Worker名 `kotogram` へ静的サイトを配信できる設定とした。SPAルートの直アクセスにも `single-page-application` を指定する。

本番APIの公開URL・公開ルート・Cloudflareのworkers.dev有効化状況を確認してから `NUXT_PUBLIC_RANKING_API_BASE` を指定し、ランキングが使える状態でフロントエンドを公開すること。APIをデプロイするまで、既存Workerを誤ってAPIで上書きしない。

## Wranglerの公開URL設定について

`wrangler.jsonc` では `workers_dev: true` と `preview_urls: true` を明示する。
これは既存の配信時にWranglerがデフォルトで有効化した挙動を維持するための指定であり、予期せず公開URLを閉じたり開いたりしない。
`https://kotogram.sae-chan.net` の独自ドメインへの配信は変更しない。

今後、独自ドメインだけを公開して `workers.dev` とプレビューURLの公開を止める方針を決めた場合は、この2項目を `false` に変更する。
その場合は既存の `workers.dev` URLが利用できなくなるので、事前にアクセス先を確認する。

依存データの更新案内（baseline-browser-mapping / caniuse-lite）はこの設定とは別で、次のコマンドをローカルで実行し、`package-lock.json` の変更差分を確認してからPR化する。

```powershell
npx update-browserslist-db@latest
npm install -D baseline-browser-mapping@latest
npm run generate
```

Nuxtの `ssr: false` と静的生成時の通知はSPAの設計に由来するため、警告の抑制を目的にSSRを変更しない。
Nitroの `cache-driver.js` 外部化警告は静的生成物への実影響を別途調べ、Nuxt/Nitroの依存更新は独立したPRで検証する。
