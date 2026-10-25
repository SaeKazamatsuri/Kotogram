import { readFileSync } from "node:fs";
import { analyzeProgram } from "../app/language/parser.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import { calculateScores, countSourceCharacters, getScoreReference } from "../app/scoring/score.ts";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const manifest = read("public/stages/manifest.json");
const unique = (items) => [...new Set(items.filter(Boolean))];
const join = (...sections) => sections.filter(Boolean).join("\n");
const loop = (count, skip, coin, press) => join(`${count}かいくりかえす`, skip, coin, press, "おわり");

export function candidatesFor(stageId) {
  const checks = read(`stage-checks/${stageId}.json`);
  const seeds = checks.cases.filter((item) => item.expect === "cleared").map((item) => item.source);
  const results = [...seeds];
  const speeds = ["", "はしる", "めっちゃはしる"];
  if (stageId === "stage-21") {
    for (const speed of speeds)
      for (const jump of ["かべとぶ", "かべ1かいすごいじゃんぷ", "かべ1かいすごいとぶ"])
        for (const enemy of ["おばけしゃがむ", "てきかがむ"])
          for (const reward of ["", "こいんとる", "かぎとる", "こいんとる\nかぎとる", "かぎとる\nたからばこあける", "こいんとる\nかぎとる\nたからばこあける"])
            results.push(join(speed, jump, enemy, reward));
  }
  if (stageId === "stage-22") {
    for (const speed of speeds)
      for (const count of [2, 3])
        for (const skip of ["すいっちみおくる", "ぼたんみおくる", "すいっちじゃんぷ"])
          for (const coin of ["", "こいんとる"])
            for (const last of ["", "とびらをやぶる"])
              results.push(join(speed, loop(count, skip, coin, "すいっちおす"), last));
    for (const speed of speeds) results.push(join(speed, "すいっちみおくる", "こいんとる", "すいっちおす"));
  }
  if (stageId === "stage-27") {
    for (const speed of speeds)
      for (const count of [2, 3])
        for (const skip of ["すいっちみおくる", "ぼたんみおくる", "すいっちじゃんぷ"])
          for (const press of ["すいっちおす", "ぼたんおす"])
            for (const last of ["", "とびらをやぶる"])
              results.push(join(speed, "かべとぶ", loop(count, skip, "", press), last));
    for (const speed of speeds) results.push(join(speed, "かべとぶ", "すいっちみおくる", "すいっちおす"));
  }
  if (stageId === "stage-28") {
    for (const speed of speeds)
      for (const portal of ["", "わーぷにはいる"])
        for (const count of [3, 4])
          for (const skip of ["すいっちみおくる", "すいっちじゃんぷ"])
            for (const coin of ["", "こいんとる"])
              for (const last of ["", "とびらをやぶる"])
                results.push(join(speed, portal, "もろいゆかとぶ", loop(count, skip, coin, "すいっちおす"), last));
  }
  return unique(results);
}

const dominates = (a, b) => {
  const timeA = a.ticks * b.bp, timeB = b.ticks * a.bp;
  const charsA = a.chars * b.bp, charsB = b.chars * a.bp;
  return timeA <= timeB && charsA <= charsB && (timeA < timeB || charsA < charsB);
};

export function exploreChoices(stageId) {
  const entry = manifest.stages.find((item) => item.id === stageId);
  if (!entry) throw new Error("unknown stage: " + stageId);
  const stage = read(`public/stages/${stageId}.json`);
  const reference = getScoreReference(stageId, entry.version ?? manifest.version);
  if (!reference) throw new Error("missing reference: " + stageId);
  const candidates = candidatesFor(stageId);
  const cleared = [];
  let invalid = 0, failed = 0;
  for (const source of candidates) {
    const result = analyzeProgram(source);
    if (result.diagnostics.length) { invalid++; continue; }
    const run = runToCompletion(createGame(stage, result.program), 20000);
    if (run.status !== "cleared") { failed++; continue; }
    const bp = objectiveProgress(run).completionBp;
    const entry = {source, ticks:run.elapsedTicks, chars:countSourceCharacters(source), bp};
    cleared.push({...entry, scores:calculateScores(reference, {elapsedTicks:entry.ticks,charCount:entry.chars,completionBp:bp})});
  }
  const front = cleared.filter((item) => !cleared.some((other) => other !== item && dominates(other, item)));
  const nonduplicate = front.filter((item, index) => !front.slice(0,index).some((other) => other.ticks*item.bp === item.ticks*other.bp && other.chars*item.bp === item.chars*other.bp));
  nonduplicate.sort((a,b) => a.ticks/a.bp-b.ticks/b.bp || a.chars/a.bp-b.chars/b.bp);
  return {stageId, explored:candidates.length, invalid, failed, clears:cleared.length, frontier:nonduplicate, knownCases:read(`stage-checks/${stageId}.json`).cases.length};
}

const calledDirectly = process.argv[1]?.replaceAll("\\","/").endsWith("/explore-p2-choices.mjs");
if (calledDirectly) {
  const rows = ["stage-21","stage-22","stage-27","stage-28"].map(exploreChoices);
  if (process.argv.includes("--markdown")) {
    console.log("# P2 上級ルートの限定探索");
    console.log("");
    console.log("登録済み解法と命令組み合わせを、固定tickの実ゲームコアで再実行。全探索による最適解の証明ではありません。");
    console.log("");
    for (const row of rows) {
      console.log(`## ${row.stageId}：候補${row.explored}、成功${row.clears}、失敗${row.failed}、無効${row.invalid}、Pareto ${row.frontier.length}`);
      console.log("");
      console.log("| tick | 文字 | 目標達成 | 総合点 | 命令 |");
      console.log("|---:|---:|---:|---:|---|");
      for (const route of row.frontier) console.log(`| ${route.ticks} | ${route.chars} | ${route.bp/100}% | ${route.scores.overall.toFixed(2)} | ${route.source.replaceAll("\n", " / ")} |`);
      console.log("");
    }
  } else console.log(JSON.stringify(rows));
}
