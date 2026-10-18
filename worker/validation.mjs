import {
  ENGINE_VERSION, LANGUAGE_VERSION, SCORING_VERSION, SEASON_ID,
  countSourceCharacters, getScoreReference, rankingScopeKey,
} from "../app/scoring/score.ts";
import { analyzeProgram } from "../app/language/parser.ts";

const identity = /^[a-f0-9]{8}-[a-f0-9-]{27,50}$/i;
const safeName = /^[^\p{Cc}\p{Cf}<>]*$/u;

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
    scope.engineVersion !== ENGINE_VERSION ||
    scope.languageVersion !== LANGUAGE_VERSION ||
    scope.scoringVersion !== SCORING_VERSION ||
    !getScoreReference(scope.stageId, scope.stageVersion)
  ) throw new RangeError("unsupported ranking scope");
  return scope;
}

export function validateRunPayload(input) {
  const scope = validateScope(input);
  const runId = requiredString(input.runId, "runId");
  const playerId = requiredString(input.playerId, "playerId");
  if (!identity.test(runId) || !identity.test(playerId)) throw new RangeError("invalid runId or playerId");
  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : "";
  if ([...nickname].length > 16 || !safeName.test(nickname)) throw new RangeError("invalid nickname");
  const source = requiredString(input.source, "source");
  if (source.length > 2000 || new TextEncoder().encode(source).length > 8192) throw new RangeError("source too long");
  if (analyzeProgram(source).diagnostics.length) throw new RangeError("invalid program");
  if (!Number.isSafeInteger(input.elapsedTicks) || input.elapsedTicks < 1 || input.elapsedTicks > 100000) throw new RangeError("invalid elapsedTicks");
  if (!Number.isSafeInteger(input.charCount) || input.charCount < 1 || input.charCount > 2000) throw new RangeError("invalid charCount");
  if (countSourceCharacters(source) !== input.charCount) throw new RangeError("charCount does not match source");
  return { ...scope, runId, playerId, nickname, source, elapsedTicks: input.elapsedTicks, charCount: input.charCount };
}

export function sameRun(a, b) {
  return a.runId === b.runId && a.playerId === b.playerId &&
    a.elapsedTicks === b.elapsedTicks && a.charCount === b.charCount && a.source === b.source;
}

export function scopeObjectId(scope) {
  return rankingScopeKey(validateScope(scope));
}
