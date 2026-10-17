# ことグラム 2026 開発計画

更新基準日: 2026-10-18
対象: 2025年の学園祭プロトタイプから2026年の学園祭版への拡張
文書の位置付け: 設計・開発・検証に用いる計画書。未実装項目を実装済みとみなさない。

## 目標

小学生が、ひらがなによる自由なテキスト入力だけでプログラムを作成し、ゲームの自動実行結果を見ながら「速く」「短く」改善できる学習ゲームに進化させる。Scratchのようなブロックや命令パーツ選択UIとは差別化する。学園祭の短時間体験で使いやすく、終了後は自宅で最初から気軽に再挑戦できる設計とする。

成功体験の流れ: 命令を書く → 実行する → 成功・失敗を理解する → 命令を縮める / 動作を速くする → ステージ別ランキングを目指す。

## 設計原則

1. 小学生の理解と操作の負担を最小にする。インデント、Tabによる構造化、ログイン、アカウント登録を要求しない。
2. 命令はテキストで入力する。語彙の別名・省略形・複合条件を受け入れる。ブロックUI、命令の選択パーツは採用しない。
3. 条件付き命令は継続監視。回数が明示された場合に限り、その成功発火回数だけ有効。
4. 複数条件の結合は OR。例: `かべとあなとぶ` は壁または穴が現れるたびに跳ぶ。
5. 既存のしゃがみジャンプ（同時アクション）を維持し、速度変更によるタイム短縮と失敗リスクの両立を目指す。
6. クリアタイムは「ゲーム内でキャラクターが動き始めてからゴールまで」。エディタ操作や実世界の待ち時間を含まない。
7. ステージごとにタイム、文字数、総合の3ランキング。基準スコア1000点を超える解法も認める。
8. レベルデザインを自動検証で支える。ゲームコアは描画から独立させる。
9. 結果のQR引き継ぎや文字サイズ変更は、今年のスコープから外す。
10. 一般向け競技基盤に匹敵する不正対策・認証基盤は作らない。壊れた入力と過剰通信を避ける最低限の保護だけ行う。

## 文書一覧

| 文書 | 内容 |
| --- | --- |
| [要件定義](requirements.md) | 利用者、体験、機能 / 非機能要件、スコープ |
| [言語仕様](language-spec.md) | 語彙、自由入力、構文、AST、曖昧性、実行モデル |
| [ゲームエンジン](engine-spec.md) | tick、物理、センシング、複数アクション、状態遷移 |
| [スコアとランキング](scoring-ranking.md) | 1000点基準、ランキング、ゲスト番号、記録 |
| [ステージとレベルデザイン](stages-and-validation.md) | JSONモデル、教育設計、ギミック、探索 / 自動検証 |
| [UI・学園祭運用](ux-event-operations.md) | ソフトキーボード、画面遷移、共用端末、非対象事項 |
| [システム構成・API](architecture-data.md) | Nuxt、Workers、Durable Objects、API、データ設計 |
| [テストと品質](quality-testing.md) | テスト戦略、決定性、CI、受入・運用試験 |
| [実装計画](roadmap.md) | Phase、P0/P1/P2、依存関係、作業チェックリスト |
| [決定事項・未決事項](decisions.md) | 確定した方針、検証中の仮定、変更管理 |

## 実装バックログ（GitHub Issues）

- [#1 Game Core / 固定tick](https://github.com/SaeKazamatsuri/Kotogram/issues/1)
- [#2 Lexer・Parser・AST](https://github.com/SaeKazamatsuri/Kotogram/issues/2)
- [#3 ハイブリッドInterpreter](https://github.com/SaeKazamatsuri/Kotogram/issues/3)
- [#4 ステージ自動検証](https://github.com/SaeKazamatsuri/Kotogram/issues/4)
- [#5 3種スコア](https://github.com/SaeKazamatsuri/Kotogram/issues/5)
- [#6 Workers API・Durable Objects](https://github.com/SaeKazamatsuri/Kotogram/issues/6)
- [#7 ソフトキーボード](https://github.com/SaeKazamatsuri/Kotogram/issues/7)
- [#8 ランキングUI](https://github.com/SaeKazamatsuri/Kotogram/issues/8)
- [#9 物理バランス調整](https://github.com/SaeKazamatsuri/Kotogram/issues/9)
- [#10 ステージ・ギミック追加](https://github.com/SaeKazamatsuri/Kotogram/issues/10)
- [#11 グラフィック・演出](https://github.com/SaeKazamatsuri/Kotogram/issues/11)
- [#12 CI・運営リハーサル](https://github.com/SaeKazamatsuri/Kotogram/issues/12)

優先度・完了条件・依存関係は各Issueと [ロードマップ](roadmap.md) に記載する。Issue作成は実装完了を意味しない。

## 現行実装との関係

2025年版の主要ファイル:
- `app/components/game/GameCanvas.vue`: Canvas描画、物理、検知、実行が混在。
- `app/composables/useParser.ts`: 行単位の部分一致による解析、ループ展開。
- `app/components/editor/CommandEditor.vue`: 簡易語彙一致による状態判定。
- `app/composables/useStats.ts`: LocalStorageによる記録。
- `public/stages/*.json` と `public/dictionary/*.json`: JSONデータ。

2026年版は現行実装を一度に全置換せず、テスト可能な言語コア・ゲームコア・ステージ検証基盤から順に導入する。READMEに残る2025年のステージ説明は2026年の正式なレベルデザイン仕様ではない。

## 設計変更の扱い

「決定済み」「採用予定（要試験）」「未決定」「対象外」の4種類で管理する。数値、物理パラメータ、ステージ数、正確な文法上の境界など、利用者がまだ決定していない値を勝手に確定しない。

実装やバランス変更によりタイム・文字数に影響する場合は、ステージ、ゲームエンジン、言語仕様、採点仕様のバージョンを記録し、異なる条件のランキングを混ぜない。
