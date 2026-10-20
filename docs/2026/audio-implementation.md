# ことグラムの音

音声は完全オリジナルのシンセサイザー音源です。音声ファイルの生成処理は `scripts/generate_audio.py` にあり、GitHub Actions が MP3 と OGG の両形式を `public/audio` に書き出します。

## BGM

- `title_adventure`: タイトル専用に新しく作曲した17.14秒のオリジナルループ（C–G–Am–F–C–Em–F–G、112 BPM）。`public/audio/bgm/title_adventure.wav` に収録し、`scripts/generate_title_adventure.mjs` で同一音源を再生成できる
- `title_loop`: ステージ選択、コード編集
- `game_loop`: プログラムの実行中
- `result_loop`: ステージクリア、失敗画面

## SE

`jump`, `crouch`, `land`, `avoid`, `score`, `score_bonus`, `hit`, `gameover`, `select`, `confirm`, `start`, `warning`, `high_score`。

ゲームの状態遷移から実際のアクションの成立を検出して鳴らします。ゲームの起動時に音声は自動再生せず、ユーザー操作で再生可能になったタイミングから鳴ります。画面右下の音量ボタンでミュートでき、ブラウザのローカルストレージに保持します。既存曲はOGGを再生できない環境ではMP3にフォールバックします。新タイトル曲はブラウザ共通対応のWAVを使用します。

## 音源の再生成

`ffmpeg` と `uv` を利用できる環境で、プロジェクトのルートから以下を実行します。

```powershell
uv run --with numpy==2.3.5 --with scipy==1.17.0 --with soundfile==0.13.1 python scripts/generate_audio.py
```

編集可能な元のPythonソースは、最初の音源生成ワークフローによって自動的にコミットされます。元データのWAVファイルは `source/wav` に生成されますがリポジトリに含めません。
