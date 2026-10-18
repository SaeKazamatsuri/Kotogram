# Workers API（Issue #6）

独立したCloudflare WorkerへAPIを分離する。Nuxtは静的サイトとして提供でき、ランキング通信不能でもGame Coreとローカル記録は動作し続ける。

設定: `wrangler.api.jsonc`。SQLite-backed `StageRanking` を `seasonId/stageId/stageVersion/engineVersion/languageVersion/scoringVersion` 単位でシャーディングし、`GuestCounter` をシーズン単位で分離する。設定済みのdev/prod Workerは別名・別namespace。デプロイ前にproductionの `ALLOWED_ORIGIN` を実サイトのOriginへ置き換える。

API:
- `GET /api/health` — バージョンを返す。
- `POST /api/results` — `runId, playerId, nickname, source, elapsedTicks, charCount` とスコープ6項目をJSONで送る。空欄名は重複しない「ゲストN」に採番。同一runIdの再送は既存結果を返す。相反する再送は409。DB失敗時は503。
- `GET /api/stages/stage-1/rankings?type=time&limit=20&seasonId=...&stageVersion=...&engineVersion=...&languageVersion=...&scoringVersion=...` — best_recordsからユーザごとの各独立ベストを取得。上限50件。返却値に入力プログラムやplayerIdは含めない。

名前は1〜16文字（空欄は自動採番）、匿名UUIDで同名ユーザーを区別。runId, stage/scope, tick, 正規化文字数、構文診断、サイズ・文字を検証。フルのゲーム再実行は行わない軽量運用前提。欠番は許容する。

ローカル:
`npm run dev:api`

検証:
`npm test` 、`npm run validate:stages`。

本番:
`npm run deploy:api` の前にCloudflare認証とOrigin・Worker公開先を設定する。プロダクションDO移行は元に戻せないので、dry-runと開発環境での登録・取得・二重登録を検証する。実クラウドの動作確認・本番デプロイはこのPRには含まれない。
