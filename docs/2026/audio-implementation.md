# ことグラムの音

音声は完全オリジナルのシンセサイザー音源です。音声ファイルの生成処理は `scripts/generate_audio.py` にあり、GitHub Actions が MP3 と OGG の両形式を `public/audio` に書き出します。

## BGM

- `title_adventure`: タイトル専用に新しく作曲した17.14秒のオリジナルループ（C–G–Am–F–C–Em–F–G、112 BPM）。`public/audio/bgm/title_adventure.wav` に収録し、`scripts/generate_title_adventure.mjs` で同一音源を再生成できる
- `title_loop`: ステージ選択、コード編集
- `game_loop`: プログラムの実行中
- `result_loop`: 失敗画面
- `clear_loop`: ステージクリア専用のオリジナル勝利BGM。128 BPM・7.5秒の4小節ループ。`app/game/celebration-music.ts` がブラウザ上でWAVを生成して再生する

## SE

`jump`, `crouch`, `land`, `avoid`, `score`, `score_bonus`, `hit`, `gameover`, `select`, `confirm`, `start`, `warning`, `high_score`, `clear_fanfare`。

`clear_fanfare` はステージクリア専用の新しい3.5秒のファンファーレです。`clear_loop` と同じ生成器を使用するため外部音声ファイルを追加せず、ネットワーク接続なしでも再生できます。クリア時は専用ファンファーレとBGMを鳴らし、失敗時は既存の効果音と `result_loop` を維持します。音量・再生・停止は既存のミュート設定と連携します。

ゲームの状態遷移から実際のアクションの成立を検出して鳴らします。ゲームの起動時に音声は自動再生せず、ユーザー操作で再生可能になったタイミングから鳴ります。画面右下の音量ボタンでミュートでき、ブラウザのローカルストレージに保持します。既存曲はOGGを再生できない環境ではMP3にフォールバックします。新タイトル曲はブラウザ共通対応のWAVを使用します。

## 音源の再生成

`ffmpeg` と `uv` を利用できる環境で、プロジェクトのルートから以下を実行します。

```powershell
uv run --with numpy==2.3.5 --with scipy==1.17.0 --with soundfile==0.13.1 python scripts/generate_audio.py
```

編集可能な元のPythonソースは、最初の音源生成ワークフローによって自動的にコミットされます。元データのWAVファイルは `source/wav` に生成されますがリポジトリに含めません。
