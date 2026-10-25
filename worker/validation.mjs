import {
  ENGINE_VERSION, PREVIOUS_ENGINE_VERSION, LANGUAGE_VERSION, PREVIOUS_LANGUAGE_VERSION, EARLIER_LANGUAGE_VERSION, LEGACY_LANGUAGE_VERSION, FIRST_LANGUAGE_VERSION, SCORING_VERSION, PREVIOUS_SCORING_VERSION, SEASON_ID,
  countSourceCharacters, getScoreReference, rankingScopeKey,
} from "../app/scoring/score.ts";
import { analyzeProgram } from "../app/language/parser.ts";
import { isValidId } from "../app/ranking/identity.ts";
import { createGame, runToCompletion } from "../app/game/core.ts";
import { objectiveProgress } from "../app/scoring/objectives.ts";
import stage1 from "../public/stages/stage-1.json" with { type: "json" };
import stage2 from "../public/stages/stage-2.json" with { type: "json" };
import stage3 from "../public/stages/stage-3.json" with { type: "json" };
import stage4 from "../public/stages/stage-4.json" with { type: "json" };
import stage5 from "../public/stages/stage-5.json" with { type: "json" };
import stage6 from "../public/stages/stage-6.json" with { type: "json" };
import stage7 from "../public/stages/stage-7.json" with { type: "json" };
import stage8 from "../public/stages/stage-8.json" with { type: "json" };
import stage9 from "../public/stages/stage-9.json" with { type: "json" };
import stage10 from "../public/stages/stage-10.json" with { type: "json" };
import stage11 from "../public/stages/stage-11.json" with { type: "json" };
import stage12 from "../public/stages/stage-12.json" with { type: "json" };
import stage13 from "../public/stages/stage-13.json" with { type: "json" };
import stage14 from "../public/stages/stage-14.json" with { type: "json" };
import stage15 from "../public/stages/stage-15.json" with { type: "json" };
import stage16 from "../public/stages/stage-16.json" with { type: "json" };
import stage17 from "../public/stages/stage-17.json" with { type: "json" };
import stage18 from "../public/stages/stage-18.json" with { type: "json" };
import stage19 from "../public/stages/stage-19.json" with { type: "json" };
import stage20 from "../public/stages/stage-20.json" with { type: "json" };
import stage21 from "../public/stages/stage-21.json" with { type: "json" };
import stage22 from "../public/stages/stage-22.json" with { type: "json" };
import stage23 from "../public/stages/stage-23.json" with { type: "json" };
import stage24 from "../public/stages/stage-24.json" with { type: "json" };
import stage25 from "../public/stages/stage-25.json" with { type: "json" };
import stage26 from "../public/stages/stage-26.json" with { type: "json" };
import stage27 from "../public/stages/stage-27.json" with { type: "json" };
import stage28 from "../public/stages/stage-28.json" with { type: "json" };
import stage29 from "../public/stages/stage-29.json" with { type: "json" };
import stage30 from "../public/stages/stage-30.json" with { type: "json" };
import manifest from "../public/stages/manifest.json" with { type: "json" };

const safeName = /^[^\p{Cc}\p{Cf}<>]*$/u;
const replayStages = new Map([
  ["stage-1", stage1],
  ["stage-2", stage2],
  ["stage-3", stage3],
  ["stage-4", stage4],
  ["stage-5", stage5],
  ["stage-6", stage6],
  ["stage-7", stage7],
  ["stage-8", stage8],
  ["stage-9", stage9],
  ["stage-10", stage10],
  ["stage-11", stage11],
  ["stage-12", stage12],
  ["stage-13", stage13],
  ["stage-14", stage14],
  ["stage-15", stage15],
  ["stage-16", stage16],
  ["stage-17", stage17],
  ["stage-18", stage18],
  ["stage-19", stage19],
  ["stage-20", stage20],
  ["stage-21", stage21],
  ["stage-22", stage22],
  ["stage-23", stage23],
  ["stage-24", stage24],
  ["stage-25", stage25],
  ["stage-26", stage26],
  ["stage-27", stage27],
  ["stage-28", stage28],
  ["stage-29", stage29],
  ["stage-30", stage30],
]);
export const replayStageIds = [...replayStages.keys()];
const currentStageVersions = new Map(manifest.stages.map((entry) => [entry.id, entry.version ?? manifest.version]));
const MAX_REPLAY_TICKS = 20000;

function requiredString(value, key) {
  if (typeof value !== "string" || value.length === 0) throw new RangeError(key + " is required");
  return value;
}

export function validateScope(input) {
  if (!input || typeof input !== "object") throw new RangeError("scope is required");
  const scope = {
    seasonId: requiredString(input.seasonId, "seasonId"),
    stageId: requiredString(input.stageId, "stageId"),
    stageVersion: requiredString(input.stageVersion, "stageVersion"),
    engineVersion: requiredString(input.engineVersion, "engineVersion"),
    languageVersion: requiredString(input.languageVersion, "languageVersion"),
    scoringVersion: requiredString(input.scoringVersion, "scoringVersion"),
  };
  if (
    scope.seasonId !== SEASON_ID ||
    ![ENGINE_VERSION, PREVIOUS_ENGINE_VERSION].includes(scope.engineVersion) ||
    ![LANGUAGE_VERSION, PREVIOUS_LANGUAGE_VERSION, EARLIER_LANGUAGE_VERSION, LEGACY_LANGUAGE_VERSION, FIRST_LANGUAGE_VERSION].includes(scope.languageVersion) ||
    ![SCORING_VERSION, PREVIOUS_SCORING_VERSION].includes(scope.scoringVersion) ||
    !getScoreReference(scope.stageId, scope.stageVersion, scope.scoringVersion)
  ) throw new RangeError("unsupported ranking scope");
  return scope;
}

export function validateRunPayload(input) {
  const scope = validateScope(input);
  if (scope.stageVersion !== currentStageVersions.get(scope.stageId)) throw new RangeError("old stage version is read-only");
  if (scope.languageVersion !== LANGUAGE_VERSION) throw new RangeError("old language version is read-only");
  if (scope.engineVersion !== ENGINE_VERSION) throw new RangeError("old engine version is read-only");
  if (scope.scoringVersion !== SCORING_VERSION) throw new RangeError("old scoring version is read-only");
  const runId = requiredString(input.runId, "runId");
  const playerId = requiredString(input.playerId, "playerId");
  if (!isValidId(runId) || !isValidId(playerId)) throw new RangeError("invalid runId or playerId");
  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : "";
  if ([...nickname].length > 16 || !safeName.test(nickname)) throw new RangeError("invalid nickname");
  const source = requiredString(input.source, "source");
  if (source.length > 2000 || new TextEncoder().encode(source).length > 8192) throw new RangeError("source too long");
  if (analyzeProgram(source).diagnostics.length) throw new RangeError("invalid program");
  if (!Number.isSafeInteger(input.elapsedTicks) || input.elapsedTicks < 1 || input.elapsedTicks > 100000) throw new RangeError("invalid elapsedTicks");
  if (!Number.isSafeInteger(input.charCount) || input.charCount < 1 || input.charCount > 2000) throw new RangeError("invalid charCount");
  if (countSourceCharacters(source) !== input.charCount) throw new RangeError("charCount does not match source");
  const completionBp = input.completionBp ?? 10000;
  if (!Number.isSafeInteger(completionBp) || completionBp < 1200 || completionBp > 10000) throw new RangeError("invalid completionBp");
  return { ...scope, runId, playerId, nickname, source, elapsedTicks: input.elapsedTicks, charCount: input.charCount, completionBp };
}

export function verifyStageRunResult(stage, input) {
  const parsed = analyzeProgram(input.source);
  if (parsed.diagnostics.length) throw new RangeError("invalid program");
  const game = runToCompletion(createGame(stage, parsed.program), MAX_REPLAY_TICKS);
  if (game.status !== "cleared" || game.elapsedTicks !== input.elapsedTicks) {
    throw new RangeError("run does not match verified clear time");
  }
  if (input.completionBp !== undefined && objectiveProgress(game).completionBp !== input.completionBp) throw new RangeError("objective progress does not match replay");
  if (input.completionBp === undefined && objectiveProgress(game).completionBp !== 10000) throw new RangeError("missing objective progress");
  return game.elapsedTicks;
}

export function verifyRunResult(input) {
  const stage = replayStages.get(input.stageId);
  if (!stage) throw new RangeError("unknown stage for replay");
  return verifyStageRunResult(stage, input);
}

export function sameRun(a, b) {
  return a.runId === b.runId && a.playerId === b.playerId &&
    a.elapsedTicks === b.elapsedTicks && a.charCount === b.charCount && a.source === b.source &&
    (a.completionBp ?? 10000) === (b.completionBp ?? 10000);
}

export function scopeObjectId(scope) {
  return rankingScopeKey(validateScope(scope));
}
