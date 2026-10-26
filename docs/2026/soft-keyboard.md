# ソフトキーボード

コード編集画面とランキングの名前入力画面で使う「かな入力」は、どちらも初期状態で閉じたアコーディオン。コード用とランキング用の開閉状態をそれぞれ `sessionStorage` の `kotogram.keyboard.code`、`kotogram.keyboard.nickname` に保存し、同じタブ内で再表示・再読み込みした際に復元する。「次の人へ」で両方削除する。

50音表、数字、空白・改行・削除・左右移動、濁点・半濁点・小書きの変換が利用できる。命令の完成パーツではなく文字単位の入力。ランキング用では改行を表示しない。ランキングの名前欄は読み取り専用かつ `inputmode=none` とし、スマートフォンのOSキーボードは開かない。最大16文字、空欄のまま送信した場合はゲスト名になる。

ボタンの pointerdown では textarea の選択範囲・フォーカスを維持し、挿入/置換結果を共通の `text` 状態へ反映する。IME変換中はソフト入力を無効化し、未確定文字の内容だけを構文ハイライトのプレビューに反映する。未確定文字はコマンドとして確定・保存せず、変換確定後にサニタイズしてコードに反映する。IME変換中も構文色分けは非表示にしない。

単体テスト: `tests/soft-keyboard.test.mjs`、`tests/keyboard-preferences.test.mjs`。ブラウザテスト: `tests/browser/keyboard-accordion-ime.spec.mjs`、`tests/browser/cleared-code-and-ranking-keyboard.spec.mjs`。
