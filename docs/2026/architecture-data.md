# システム構成・Cloudflare・データ設計

## 1. 前提

既存技術: Nuxt 4、Vue 3、TypeScript、Tailwind、Canvas、JSON。基本的に継続する。2025年版の`ssr: false`構成を踏まえ、2026年は静的なクライアント + Workers API、またはNuxtサーバールートをWorkersへデプロイする構成を比較して決める。

今回のクラウド用途は、ランキングおよびプレイ結果の保存・取得。QRコードやアカウント横断の進捗引き継ぎは行わない。

## 2. 論理アーキテクチャ

~~~mermaid
flowchart TD
    Player[小学生 / スタッフ] --> Nuxt[Nuxt Vue UI]
    Nuxt --> Editor[自由入力 + ソフトキーボード]
    Editor --> Parser[言語コア]
    Parser --> Runtime[Interpreter]
    Runtime --> Engine[決定論的 Game Core]
    Nuxt --> Renderer[Canvas Renderer]
    Engine --> Renderer
    Engine --> Results[クリア結果]
    Results --> Local[ブラウザ保存]
    Results --> API[Workers API]
    API --> RankingDO[Stage Ranking Durable Object]
    API --> NamesDO[ゲスト連番の発行元]
~~~

### フロントエンド

- 表示: ステージ選択、入力、実行、失敗/クリア、3種ランキング。
- 入力: 物理キーボードとソフトキーボードで同一テキスト状態に書き込む。
- 言語コア: 正規化、Lexer、Parser、AST、Interpreter。
- ゲームコア: 固定tickシミュレーション。Web APIに直接依存させない。
- 描画: Canvas。後日アニメーション実装を差し替えられる。
- LocalStorage: 編集中のプログラム、同端末の自己ベストとプレイヤー識別の候補。共用端末モードでは体験終了時に削除。

### サーバー

- Workers API: ランキング登録、ベストの取得、ステージ別ランキングの取得、ゲスト名発行、スタッフ用の限られた運用API。
- Durable Objects（SQLite-backed）: ステージ / シーズン単位の記録と集計、トランザクションを要する連番管理。
- KV: 初期の必須依存ではない。公開ランキングの読み取りキャッシュ等が必要なら追加検討。
- D1: 複雑な横断SQL分析が必要になった場合の再評価候補。現段階では導入しない。

## 3. KVとDOの採用理由

Workers KVは高い読み取り頻度のキャッシュ向きで、同じキーへの書き込み頻度制限と結果整合性の性質がある。ランキング更新の正本にはSQLite-backed Durable Objectsが向く。DOには強い整合性とトランザクションがあり、各ステージ・シーズンの集計をSQLで管理できる。

ただしDOも無制限ではない。無料枠、リクエスト数、読み書き行数、オブジェクト当たりの負荷は運営規模に応じて計測する。特定のDOに大量アクセスが集中する場合のボトルネックにも注意する。

公式仕様:
- https://developers.cloudflare.com/kv/platform/limits/
- https://developers.cloudflare.com/kv/api/write-key-value-pairs/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

数値制限・料金は運用時点で再確認する。特定の日の無料枠数値を不変のシステム要件にはしない。

## 4. Durable Objectの分割方針

推奨:
- RankingDO: `seasonId:stageId:rankingVersion` ごとに1つの論理DO。ステージ別ランキングに対する読み書きを集約。
- CounterDO: ゲスト番号を発行する論理DO（イベント/シーズン単位）。連番の重複を避ける。
- セッション用DOは設けない。異なる端末間の復帰・QRが廃止されたため、今回は不要。

別DO間の分散トランザクションはない。ゲスト名発行後にランキング登録が失敗した場合、連番の欠番は許容する。登録処理は`runId`による冪等性を保つ設計とする。

## 5. 記録テーブルの例

SQLite-backed RankingDO内の概念スキーマ:

~~~sql
CREATE TABLE runs (
  run_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  stage_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  language_version TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  elapsed_ticks INTEGER NOT NULL,
  char_count INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE best_records (
  player_id TEXT PRIMARY KEY,
  best_time_run_id TEXT,
  best_chars_run_id TEXT,
  best_overall_run_id TEXT
);
~~~

- DO自体がステージ・シーズンで分離されていれば、それらの識別子はテーブル外メタデータにも保持できる。
- 同一プレイヤーの3種類のベストを独立更新。
- SQLクエリの上位N件取得を早くするため必要なインデックスを追加。
- すべての試行の無期限保存は必須でない。ベスト記録と最新試行の保持期間を運営要件から決める。
- 同一イベント参加者を識別し続けることは主目的でない。

## 6. API（案）

| Method | Path | 用途 |
| --- | --- | --- |
| GET | /api/stages/:stageId/rankings?type=time | ステージのタイム上位 |
| GET | /api/stages/:stageId/rankings?type=chars | 文字数上位 |
| GET | /api/stages/:stageId/rankings?type=overall | 総合上位 |
| POST | /api/results | クリア結果登録・ゲスト名発行・ベスト更新 |
| GET | /api/health | API / ランキング保存先の軽量な稼働確認 |

URL / ルート名は確定前。ステージのバージョンやシーズンは問い合わせ引数またはAPIのバージョン体系で指定する。

POST /api/results の最低限の検証:
- 有効なstageId / seasonId / versionのみ受理。
- programの長さ、nicknameの長さ、elapsedTicks、charCountの正値・上限を検証。
- 登録時にnicknameが空ならCounterDOへ連番要求。
- runIdの重複登録を無害化。
- 永続化に失敗した場合は適切なエラー応答を返し、クライアントに再送可能状態を保持。

## 7. 同端末の記録

学園祭の共用PC:
- 体験者ごとにplayerIdを新規発行する。
- 体験終了時に表示名・編集コード・自己ベスト等をクリアする。
- `localStorage.clear()` を使わず、`kotogram.*`などアプリ領域のキーだけ削除する。
- ゲスト登録やランキング保存に成功した記録はクラウドに残る。

自宅:
- すぐ最初から遊べる。アカウント不要。
- 同じブラウザ内の記録保持は便利機能として許容。ただし端末変更時の同期・引き継ぎは保証しない。
- 端末データ削除後は新しいプレイヤーとして始まる。

## 8. 軽量な運用・安全

- APIではサイズ上限、許可された入力値、ページサイズ、名前表示時のエスケープ等の最低限の対策を行う。
- 公開サイトに管理者の全ステージ解放処理を置きっぱなしにしない。現行`/admin`のアクセスだけで記録変更する実装は廃止 / 運営限定へ変更。
- 認証基盤や大規模なアンチチートは今年の必須対象外。
- 個人情報を要求しない設計。ニックネームには本人を特定する内容を書かないように案内する。
- 未成年に利用されるため、公開するデータ項目と保存期間を決める。運営上不要なアクセスログ / 入力履歴は保持しない。

## 9. デプロイと環境

- Nuxt 4 + Workers対応のビルド手順を1つに定義し、Wranglerの設定をリポジトリ管理する（秘密情報はGit管理しない）。
- 開発用・本番用のDO名前空間を分離。開発のダミー結果を学園祭ランキングへ混ぜない。
- 本番ステージJSONのversionを公開する際はランキング基準と整合させる。
- CIでlint、型検査、ユニットテスト、ステージ検証、ビルドを行う。
- リリース前に本番同等環境でランキング書き込み・取得・ゲスト番号採番を検証。

## 10. 決定待ち

- Workers APIをNuxtのserver/apiに統合するか、独立Workerにするか。
- SQLiteの実テーブル構造と保存件数・保持期間。
- ランキング表示件数N、更新頻度・キャッシュ。
- ゲスト番号のスコープ（2026全体か学園祭イベント単位か）。
- 運営用の軽量なアクセス制御方式。
