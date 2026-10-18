# ローカルWorkers / SQLite DO実体テスト

GitHub ActionsのビルドジョブではWorkerのdry-runのあとに `wrangler dev` を起動し、`scripts/smoke-ranking-api.mjs` による実際のHTTP連携を検証する。

テスト範囲：
- API healthの起動応答とCORS拒否。
- `POST /api/results` → 201、リトライ → 200（冪等）、内容が異なる同一runId → 409。
- 異なるplayerIdによるゲスト名の並列発行が重複しないこと。
- 同じplayerIdが次の挑戦で元のゲスト名を保持すること。
- 最速・最短・総合で異なるrunIdが独立して選ばれること。
- 公開ランキングからソースとplayerIdが漏れないこと。

本テストはGitHub Actionsの新しい一時的なWrangler環境で実行する。本番環境・実際の複数デバイス・デプロイ済みAPIについて検証済みとはみなさない。

ローカルで再現するには、ひとつのPowerShellで `npm run dev:api` を起動し、別のPowerShellで `node --experimental-strip-types scripts/smoke-ranking-api.mjs` を実行する。実行するたびテスト記録がローカルのDOに残るので、公開用環境では実行しない。
