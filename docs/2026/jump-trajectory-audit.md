# ジャンプ軌道の定量検証（#9）

公開ステージのGame CoreとParserをそのまま使い、描画とは独立にジャンプ開始・最高点・着地の tick と座標を記録する。公式の挙動は変更しない。

```powershell
npm run analyze:jumps
npm run analyze:jumps -- --stage=stage-3
npm run analyze:jumps -- --stage=stage-3 --fast
```

JSONの各 `jumps` には `startTick`、`peakTick`、`landingTick`、足元ではなくプレイヤー前端の `startFrontX`、`peakFrontX`、`landingFrontX`、壁/穴の左端・右端・中心、および `peakOffsetX`（最高点での前端と障害物中心の差）を出力する。

衝突検知は `GAME.approachBase + vx * GAME.reactionFrames` で共通なのに、穴は幅可変、壁は幅28なので同じトリガー距離でも `peakOffsetX` は揃わない。入力された速度と穴の幅ごとに最小余裕tick、次障害物への影響を測定してから変更する。

## 実装段階

1. 現行ステージ7件の通常/高速の軌道を比較し、壁と穴を分けた許容帯を数値化
2. 公式物理を変えない実験用stage fixtureでセンサー開始距離を調整し、成功/失敗・行動順を確認
3. 検証後に本番のエンジンバージョン、サーバー検証、ランキング分離と同時にリリース

この変更だけではジャンプ軌道やランキングの規則は変わらない。

## 実験的な補正を試す

`GameStage.jumpSensorProfile` が `centered-holes` の場合、穴の検知距離を `(holeWidth - wallWidth)/2` だけ短くする。これはジャンプ頂点のプレイヤー前端を穴中心に近づけるための実験機能であり、公開ステージ7件では`legacy`のまま。両パターンの成否・最高点位置を`tests/stage-balance-prototypes.test.mjs`で回帰する。
