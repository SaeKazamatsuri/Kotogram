# 描画とゲーム進行の境界

- `app/game/core.ts`: 公式のtick、条件反応、物理、当たり判定を担当する。
- `app/components/game/GameCanvas.vue`: Vueライフサイクル、固定tick要求、Canvasサイズ調整、画像読み込み、イベント通知を担当する。
- `app/game/renderer.ts`: `renderGameFrame(ctx, game, palette, sprites)` で現行GameStateを読み取って描画する。

描画側から `stepGame` を呼ばず、状態を書き換えない。
背景の経過時間やキャラのフレーム表現は公式の `elapsedTicks` に紐付け、ブラウザ描画FPSによって採点を変えない。
変更の直後はNode回帰テストとPlaywrightの画面検証を通す。
