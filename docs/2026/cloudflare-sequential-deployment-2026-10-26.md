# Cloudflare Workers の直列自動デプロイ（2026-10-26）

GitHub の `master` への変更を契機として `kotogram-api` → `kotogram` の順番で更新する。

## GitHub と Workers Builds

| 対象 | 実際の Worker | Git からの自動トリガー | デプロイ後の動作 |
| --- | --- | --- | --- |
| API | `kotogram-api` | `master`、全パス | APIが成功した場合のみフロントのDeploy Hookを呼ぶ |
| フロント | `kotogram` | 通常の変更では起動しない | Deploy Hookで明示的にビルドしてから公開する |

Cloudflareアカウントの外部設定として、APIのトリガーは `master` かつ `path_includes=["*"]`、フロントのトリガーは `master` かつ `path_includes=[".cloudflare/frontend-manual-release-only"]` にする。後者のパスは通常のコミットには含めない。フロントのDeploy Hookは `master` ブランチを参照する必要がある。存在しないブランチへ本番ビルドを接続するとDeploy HookがHTTP 500になり得る。

### APIのビルド

```sh
npm run preflight:production && npm run lint && npm run typecheck && npm test && npm run validate:stages
```

### APIのデプロイ

```sh
npx wrangler deploy --config wrangler.api.jsonc --env production && node scripts/trigger-frontend-build.mjs
```

API側のWorkers Builds環境変数 `KOTOGRAM_FRONTEND_DEPLOY_HOOK` はシークレットで保存する。URLやトークンをGitへコミットしたりログに記録したりしない。

### フロントのビルド

```sh
npm run preflight:production && npm run preflight:frontend && npm run lint && npm run typecheck && npm test && npm run validate:stages && npm run generate && npm run release:wait-api
```

### フロントのデプロイ

```sh
node -e "require('node:fs').rmSync('.wrangler/deploy',{recursive:true,force:true})" && npx wrangler deploy --config wrangler.jsonc
```

フロント側は `scripts/wait-production-api.mjs` で公開30ステージの最新版ランキングを読み取れるまで待つ。APIが最新版のランキングスコープを認識しない場合はフロントを更新しない。この待機により、Workers Buildsの同時実行数が限られる環境でも更新順序が保証される。

## 運用上の注意

- Workers Buildsは接続されたWorker名へデプロイ先を上書きする場合があるため、フロントのビルド中にAPIをデプロイしてはいけない。
- `master` 変更のたびにAPIのビルド・検証を実行する。APIに変更がない場合も同じ順序を守る。
- Cloudflare上のビルド設定とDeploy HookはGit管理外であり、変更時はこの文書も同期する。
- APIデプロイ後のフック呼び出しが失敗した場合、CloudflareはAPI側ビルドを失敗扱いにする。リポジトリを更新せずリトライするときは、APIのWorkers Buildsトリガーから同じコミットを再実行する。
- 本番動作はCloudflareのビルド結果に加えて、公開URL・ランキングの取得と旧版が閲覧専用であることを確認する。
- 会場実機試験はIssue #12で別途管理する。
