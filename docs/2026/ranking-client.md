# ランキング画面・API接続

`NUXT_PUBLIC_RANKING_API_BASE` に独立WorkerのURLを指定すると、クリア画面からランキング登録と3タブ表示が可能。未設定でもローカルの3スコア・自己ベストとゲーム進行は使用できる。

ローカル開発は二つのPowerShellからそれぞれ実行する。

`npm run dev:api`

`$env:NUXT_PUBLIC_RANKING_API_BASE="http://localhost:8787"; npm run dev`

クリア後はニックネームを入力でき、未入力時はサーバーが「ゲストN」を一意発行する。playerIdはブラウザ内でUUIDを保持。保存完了後はランキングを表示でき、タイム/文字数/総合を切り替える。表示名はtext interpolationのみ。再送は同一runIdで行い、保存失敗時もゲーム進行とローカル記録は保たれる。

本番はCloudflare Workerをデプロイし、`wrangler.api.jsonc` production `ALLOWED_ORIGIN` を実フロントエンドOriginへ、Nuxtの `NUXT_PUBLIC_RANKING_API_BASE` を本番APIへ設定する。`localhost`のままでは通信できない。

要手動確認：端末から新しいゲスト名が保存できること、空欄名で採番されること、同じニックネームでも別プレイヤーであること、通信遮断でプレイできること、送信失敗から再送できること、3種のランキングで並びが異なること。
