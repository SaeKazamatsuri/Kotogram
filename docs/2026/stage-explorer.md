# 制限付きステージ解法探索CLI

Issue #10 / #9 のレベルデザイン支援として、既存Game CoreとParserを使う候補探索を導入。数学的な最適性の証明ではない。

## 使い方

- `npm run explore:stages` — manifest掲載ステージの既知の最良候補を出力
- `npm run explore:stages -- --stage stage-4 --json` — 特定ステージをJSON表示
- `npm run explore:stages -- --max-candidates=20 --max-ticks=5000 --max-characters=40 --max-ms=2000` — コスト上限を指定

候補は条件ジャンプ・複合条件・おばけしゃがみ・回数制限・はしるの組み合わせから生成する。候補数、最大tick、最大文字数、時間予算を必ず制限する。時間予算に達した場合はtruncatedが真になる。最速・最短・最良tick×文字数を独立出力する。

本探索は新たに検証した範囲の参考解を示すだけで、公開中のT_ref/C_ref/P_refやランキングのバージョンを自動更新しない。候補語彙の拡張やスイッチ/コイン対応は今後のIssue #10の作業。
