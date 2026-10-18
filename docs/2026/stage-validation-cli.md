# ステージ検証CLI v1 — 制作者向け手引き

関連: [Issue #4](https://github.com/SaeKazamatsuri/Kotogram/issues/4) / [レベルデザイン](stages-and-validation.md)

## 目的

ステージ追加・障害物の配置変更・Interpreterや物理エンジンの更新によって、既存のステージがクリア不能になったり、解法のタイムが変わったりすることを自動検出する。2026年版の基準値づくりにも用いる。

本ツールは、ステージの「数学的な理論最適解」を証明するものではない。登録された候補プログラムのうちの**既知の最良結果**を報告する。

## 使い方

プロジェクトのルートでNode.js 22を使用する（TypeScript type strippingを使うため）。

~~~bash
npm run validate:stages
npm run validate:stages -- --stage stage-2
npm run validate:stages -- --json
npm test
~~~

- 何も指定しない場合は `public/stages/manifest.json` に登録された全ステージを検証。
- `--stage` で指定したステージだけ検証。
- `--json` は機械処理向けのレポート（ステージ別の各ケース、tick、文字数、警告、既知の最良値）。
- 想定と異なる成功・失敗、tickの差異、JSONスキーマ違反、解法が無効な構文の場合は終了コード1を返す。
- 「高速化解法がまだない」などのレベルデザイン上の改善余地は警告として表示し、ビルドを失敗させない。

## 入力データ

ステージ本体:
- `public/stages/stage-1.json` など従来のJSONを継続使用する。
- 使用可能なギミックは `wall` / `hole` / `ghost` / `goal`。存在しないギミックを使うと明示的に検証失敗とする。
- `goal` / `scrollSpeed` / `objects[]` の整合性を検証。
- 2025年のオブジェクトにIDがない形式を許容する。IDを付ける場合は重複禁止。
- ゲームコアが障害物の位置に合わせて勝手にゴールを遠ざけてしまう配置は検証失敗として警告する。

解法ファイル:
- `stage-checks/stage-1.json` など、同一ステージIDのJSONを作成。
- `cases[]` に解法を登録。
- `name`: ケース名（同一ファイル内で重複不可）。
- `role`: `beginner` / `short` / `fast` / `negative` / `regression`。
- `source`: 実際に書くひらがなのプログラム。複数行も可。
- `expect`: `cleared` / `failed` / `timeout`。
- `failureReason`: 失敗理由を検証する場合に指定。
- `expectedTicks`: 正確な経過ゲームtickをスナップショットとして指定。物理仕様の意図しない変更を捕捉する。
- `maxTicks`: ステージごとの実行上限。未設定時は20,000tick。

例:

~~~json
{
  "stageId": "stage-1",
  "maxTicks": 20000,
  "cases": [
    { "name": "beginner-explicit", "role": "beginner", "source": "まえにかべがあったらじゃんぷ", "expect": "cleared", "expectedTicks": 712 },
    { "name": "short-conditional", "role": "short", "source": "かべとぶ", "expect": "cleared", "expectedTicks": 712 },
    { "name": "missing-jump", "role": "negative", "source": "おばけしゃがむ", "expect": "failed", "failureReason": "wall", "expectedTicks": 164 }
  ]
}
~~~

## 自動検証内容

1. マニフェスト内のステージID・ファイル名・重複・不正パスを確認。
2. ステージの数値・障害物タイプ・大きさ・重複・ゴール位置を検査。
3. 登録された各ソースを既存の `analyzeProgram` で解析。
4. 同じ `createGame` → `runToCompletion` で2度描画なしに実行。
5. 成功 / 失敗 / タイムアウト、失敗理由、ゲーム内tickを比較。
6. ソースの全角数字・Unicode表記を正規化し、空白・改行を除外した文字数を算出（文字数ルールはランキング実装前に最終確定する）。
7. クリアした解法だけを対象に、既知の最速tick、最短文字数、最良のtick×文字数をそれぞれ独立して算出。
8. 初心者解法より短いプログラム・速いプログラムの有無をレポートする。

## 既存ステージの基準記録（2026-10-18時点のGame Core）

| ステージ | 既知のクリアtick | 既知の最短文字数 | 最良tick×文字数 |
| --- | ---: | ---: | ---: |
| stage-1 | 712 | 4 | 2848 |
| stage-2 | 983 | 7 | 6881 |
| stage-3 | 1434 | 14 | 20076 |

これは登録済みの解法候補の範囲での結果であり、理論最適値とは限らない。秒への変換は `tick / 60`。上表の「tick×文字数」は後の正式なスコア式の「秒×文字数」と換算単位が異なるが、60Hz固定では順位が変わらない。

現行エンジンに `はしる` / `あるく` による速度変更がまだ実装されていないため、3ステージに対してタイム改善解法は未登録であり警告として残している。速度変更の実装後、`fast` ケースを追加する。

## ステージを追加するとき

1. ステージ本体のJSONを追加する。
2. マニフェストへID、タイトル、ファイルパスを登録する。
3. 対応する `stage-checks/<stage-id>.json` を追加する。
4. 初心者向けにクリアできる解法、短い解法、わざと失敗する解法を登録する。
5. `npm run validate:stages` を実行し、スキーマ違反、意図しない失敗とtickを確認。
6. レベルデザイン調整後、必要に応じて `expectedTicks` を意図的に更新する。
7. 短い・速い・総合の基準値を比較し、公開前にランキング基準を別途固定する。

ステージ検証の自動探索は次の段階で拡張する。上のチェックファイルは、必ず人が意味と面白さを確認した基準解法を持つこと。
