import { readFileSync } from "node:fs";
import { evaluateStageCompetition, summarizeCompetition } from "../app/scoring/competition-audit.ts";
const read = p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const manifest=read("public/stages/manifest.json");
const rows=manifest.stages.map(entry=>evaluateStageCompetition(entry.id,entry.version??manifest.version,
  read("public/stages/"+entry.id+".json"),read("stage-checks/"+entry.id+".json").cases));
const summary=summarizeCompetition(rows);
if (rows.length!==30) throw new Error("Expected 30 verified stages");
if(process.argv.includes("--markdown")){
  const list = values=>values.length?values.map(x=>x.replace("stage-","")).join(", "):"なし";
  const line=(name,r)=>name+"："+r.ticks+"tick / "+r.characters+"文字 / 得点"+r.score.toFixed(1);
  console.log("# 全30ステージ・競技ルート比較評価");
  console.log("");
  console.log("データ：`stage-checks/stage-*.json` に登録された "+summary.registeredRoutes+" 経路を固定60Hzのゲームエンジンで再実行。成功 "+summary.successfulRoutes+" 経路。");
  console.log("注意：全ての可能なプログラムの探索ではなく、**登録済み解法の範囲内**での比較です。");
  console.log("コイン・見送りの任意目標は実績bpを使ってWorkerと同じ補正を適用。Paretoはtick/bpと文字数/bpの2軸で判定。");
  console.log("");
  console.log("## 集計");
  console.log("");
  console.log("- 複数のPareto候補："+summary.multiParetoStages.length+"面（"+list(summary.multiParetoStages)+"）");
  console.log("- 単一Pareto候補："+summary.singleFrontierStages.length+"面（"+list(summary.singleFrontierStages)+"）");
  console.log("- 最速・最短・総合が複数経路："+summary.multiObjectiveStages.length+"面（"+list(summary.multiObjectiveStages)+"）");
  console.log("- 公式overall登録経路と計算上の最良経路の不一致："+summary.registeredOverallMismatch.length+"面（"+list(summary.registeredOverallMismatch)+"）");
  console.log("- 任意目標の減点別解："+summary.scorePenaltyRoutes.length+"面（"+list(summary.scorePenaltyRoutes)+"）");
  console.log("- 初心者解法からの平均短縮：tick "+summary.averageTimeGainPct+"%、文字数 "+summary.averageCharsGainPct+"%");
  console.log("");
  console.log("## 世界ごとの比較");
  console.log("");
  console.log("| ワールド | 最速平均tick | 最短平均文字数 | 複数Pareto面数 | 減点ルートがある面数 |");
  console.log("|---|---:|---:|---:|---:|");
  for(const w of summary.worlds)console.log("| "+w.world+" | "+w.meanClearTicks+" | "+w.meanMinCharacters+" | "+w.multiPareto+" | "+w.optionalPenalty+" |");
  console.log("");
  console.log("## 全30ステージの最良経路");
  console.log("");
  console.log("| 面 | 最速 tick | 最短 文字 | 総合点 | 最速名 / 最短名 / 総合名 | Pareto | 任意目標を省く別解 |");
  console.log("|---:|---:|---:|---:|---|---:|---|");
  for(const row of rows)console.log("| "+Number(row.stageId.split("-")[1])+" | "+row.best.time.ticks+
    " | "+row.best.chars.characters+" | "+row.best.overall.score+" | "+
    [row.best.time.name,row.best.chars.name,row.best.overall.name].join(" / ")+" | "+row.frontierCount+
    " | "+(row.optionalBypass.length?row.optionalBypass.map(x=>x.name+" "+x.pct+"%").join("、"):"—")+" |");
  console.log("");
  console.log("## 解釈上の注意");
  console.log("");
  console.log("単一Paretoは選択肢が存在しないことの証明ではなく、登録済みの成功例で二軸のトレードオフが観測されなかったことを示す。");
  console.log("複数Paretoの同tick・同文字数の異なるプログラムは独立候補として列挙される。");
  console.log("実際の初見難度、入力エラー率、音・操作性は実機プレイで別途計測する必要がある。");
}else{
 console.log(JSON.stringify({scope:"30 registered stages, replayed current engine, not global optimization",summary,stages:rows},null,2));
}
