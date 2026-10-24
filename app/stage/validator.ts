import { GAME, createGame, runToCompletion, type GameStage } from "../game/core.ts";
import { analyzeProgram } from "../language/parser.ts";
import { countSourceCharacters } from "../scoring/score.ts";

export type ValidationIssue = { path: string; message: string };
export type CaseRole = "beginner" | "learning" | "short" | "fast" | "negative" | "regression";
export type ExpectedOutcome = "cleared" | "failed" | "timeout";
export type StageCase = {
  name: string;
  role: CaseRole;
  source: string;
  expect: ExpectedOutcome;
  failureReason?: string;
  expectedTicks?: number;
};
export type StageChecks = { stageId: string; maxTicks?: number; cases: StageCase[] };
export type CaseResult = {
  name: string;
  role: CaseRole;
  source: string;
  pass: boolean;
  expected: ExpectedOutcome;
  outcome: ExpectedOutcome | "invalid";
  elapsedTicks: number | null;
  seconds: number | null;
  characters: number;
  product: number | null;
  failureReason?: string;
  diagnostics: string[];
  errors: string[];
};
export type StageReport = {
  stageId: string;
  pass: boolean;
  issues: ValidationIssue[];
  warnings: string[];
  cases: CaseResult[];
  bestKnown: { ticks: number | null; characters: number | null; timeCharactersProduct: number | null };
  improvements: { shorterThanBeginner: boolean; fasterThanBeginner: boolean };
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isPositiveFinite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isNonnegativeFinite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const stageIdPattern = /^stage-[a-z0-9-]+$/;
const MAX_STAGE_OBJECTS = 500;
const MAX_CASES = 100;
export const DEFAULT_MAX_TICKS = 20000;

export function validateManifest(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(value)) return [{ path: "manifest", message: "JSON object required" }];
  if (typeof value.version !== "string" || !value.version.trim()) issues.push({ path: "manifest.version", message: "non-empty version required" });
  if (!Array.isArray(value.stages) || value.stages.length === 0) {
    issues.push({ path: "manifest.stages", message: "non-empty stage list required" });
    return issues;
  }
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [i, entry] of value.stages.entries()) {
    const root = `manifest.stages[${i}]`;
    if (!isObject(entry)) { issues.push({ path: root, message: "stage descriptor required" }); continue; }
    if (typeof entry.id !== "string" || !stageIdPattern.test(entry.id)) issues.push({ path: root + ".id", message: "invalid stage ID" });
    else if (ids.has(entry.id)) issues.push({ path: root + ".id", message: "duplicate stage ID" });
    else ids.add(entry.id);
    if (typeof entry.title !== "string" || !entry.title.trim()) issues.push({ path: root + ".title", message: "title required" });
    if (entry.version !== undefined && (typeof entry.version !== "string" || !/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/.test(entry.version))) {
      issues.push({ path: root + ".version", message: "invalid stage version" });
    }
    if (typeof entry.file !== "string" || !/^\/stages\/stage-[a-z0-9-]+\.json$/.test(entry.file)) {
      issues.push({ path: root + ".file", message: "file must be an absolute /stages/stage-*.json path" });
    } else if (paths.has(entry.file)) issues.push({ path: root + ".file", message: "duplicate filename" });
    else paths.add(entry.file);
    if (typeof entry.id === "string" && typeof entry.file === "string" && entry.file !== `/stages/${entry.id}.json`) {
      issues.push({ path: root + ".file", message: "filename must match stage ID" });
    }
  }
  return issues;
}

export function validateStage(stageId: string, value: unknown, requireIds = false): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(value)) return [{ path: stageId, message: "stage JSON object required" }];
  if (typeof value.id === "string" && value.id !== stageId) issues.push({ path: "id", message: "stage ID differs from manifest" });
  if (requireIds && value.id !== stageId) issues.push({ path: "id", message: "explicit stage ID required" });
  if (requireIds && (!Array.isArray(value.learningObjectives) || value.learningObjectives.length === 0)) issues.push({ path: "learningObjectives", message: "at least one learning objective required" });
  if (!isPositiveFinite(value.goal)) issues.push({ path: "goal", message: "goal must be finite and positive" });
  if (!isPositiveFinite(value.scrollSpeed) || value.scrollSpeed > 25) issues.push({ path: "scrollSpeed", message: "speed must be finite and in (0,25]" });
  if (value.learningObjectives !== undefined && (
    !Array.isArray(value.learningObjectives) ||
    value.learningObjectives.length > 5 ||
    value.learningObjectives.some((item: unknown) => typeof item !== "string" || !item.trim() || item.length > 100)
  )) issues.push({ path: "learningObjectives", message: "provide up to five short learning objectives" });
  if (value.requiredCoins !== undefined && (!Number.isSafeInteger(value.requiredCoins) || (value.requiredCoins as number) < 0)) issues.push({ path: "requiredCoins", message: "requiredCoins must be a nonnegative integer" });
  if (value.requiredSkips !== undefined && (!Number.isSafeInteger(value.requiredSkips) || (value.requiredSkips as number) < 0)) issues.push({ path: "requiredSkips", message: "requiredSkips must be a nonnegative integer" });
  if (value.objects !== undefined && !Array.isArray(value.objects)) issues.push({ path: "objects", message: "objects must be an array" });
  if (Array.isArray(value.objects)) {
    if (value.objects.length > MAX_STAGE_OBJECTS) issues.push({ path: "objects", message: "too many objects" });
    const objectIds = new Set<string>();
    const placements = new Set<string>();
    const knownTypes = new Set(["wall", "ghost", "hole", "goal", "coin", "switch", "door"]);
    const doors = new Map<string, number>();
    const switches: { x: number; target: string; path: string }[] = [];
    let coinCount = 0;
    let trapSwitchCount = 0;
    let explicitGoalCount = 0;
    let furthestObstacle = 0;
    for (const [i, obj] of value.objects.entries()) {
      const path = `objects[${i}]`;
      if (!isObject(obj)) { issues.push({ path, message: "object required" }); continue; }
      if (typeof obj.type !== "string" || !knownTypes.has(obj.type)) issues.push({ path: path + ".type", message: "unsupported obstacle type" });
      if (!isNonnegativeFinite(obj.position)) issues.push({ path: path + ".position", message: "position must be finite and nonnegative" });
      if (obj.id !== undefined) {
        if (typeof obj.id !== "string" || !obj.id.trim()) issues.push({ path: path + ".id", message: "invalid object ID" });
        else if (objectIds.has(obj.id)) issues.push({ path: path + ".id", message: "duplicate object ID" });
        else objectIds.add(obj.id);
      } else if (requireIds) issues.push({ path: path + ".id", message: "explicit object ID required" });
      if (obj.type === "door" && typeof obj.id === "string" && isNonnegativeFinite(obj.position)) {
        doors.set(obj.id, obj.position);
      }
      if (obj.type === "switch") {
        if (obj.trap === true) trapSwitchCount++;
        if (obj.trap !== undefined && typeof obj.trap !== "boolean") issues.push({ path: path + ".trap", message: "trap must be boolean" });
        if (typeof obj.id !== "string" || !obj.id.trim()) issues.push({ path: path + ".id", message: "switch ID required" });
        if (typeof obj.targetDoorId !== "string" || !obj.targetDoorId.trim()) issues.push({ path: path + ".targetDoorId", message: "target door required" });
        if (isNonnegativeFinite(obj.position) && typeof obj.targetDoorId === "string") {
          switches.push({ x: obj.position, target: obj.targetDoorId, path });
        }
      }
      if (obj.type === "door" && (typeof obj.id !== "string" || !obj.id.trim())) issues.push({ path: path + ".id", message: "door ID required" });
      if (obj.type === "coin") coinCount++;
      if (obj.type === "goal") {
        explicitGoalCount++;
        if (value.goal !== undefined && obj.position !== value.goal) issues.push({ path, message: "goal position disagrees with stage.goal" });
      }
      if (obj.type === "hole") {
        if (obj.width !== undefined && !isPositiveFinite(obj.width)) issues.push({ path: path + ".width", message: "hole width must be positive" });
      } else if (obj.width !== undefined) issues.push({ path: path + ".width", message: "width is only supported for holes" });
      if (isNonnegativeFinite(obj.position) && obj.type !== "goal" && typeof obj.type === "string" && knownTypes.has(obj.type)) {
        const positionKey = `${obj.type}@${obj.position}`;
        if (placements.has(positionKey)) issues.push({ path, message: "duplicate type and position" });
        placements.add(positionKey);
        furthestObstacle = Math.max(furthestObstacle, obj.position);
      }
    }
    for (const item of switches) {
      const targetX = doors.get(item.target);
      if (targetX === undefined) issues.push({ path: item.path + ".targetDoorId", message: "target door does not exist" });
      else if (item.x >= targetX - GAME.playerWidth - GAME.switchPressRange) {
        issues.push({ path: item.path + ".position", message: "switch must provide approach space before its door" });
      }
    }
    if (Number.isSafeInteger(value.requiredCoins) && (value.requiredCoins as number) > coinCount) issues.push({ path: "requiredCoins", message: "requiredCoins exceeds available coins" });
    if (Number.isSafeInteger(value.requiredSkips) && (value.requiredSkips as number) > trapSwitchCount) issues.push({ path: "requiredSkips", message: "requiredSkips exceeds available trap switches" });
    if (explicitGoalCount > 1) issues.push({ path: "objects", message: "multiple goals" });
    if (isPositiveFinite(value.goal) && value.goal < furthestObstacle + GAME.approachBase + 160) {
      issues.push({ path: "goal", message: "goal is too close to final obstacle; engine would silently move it" });
    }
  }
  return issues;
}

export const countProgramCharacters = countSourceCharacters;

export function validateChecks(stageId: string, value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(value)) return [{ path: "checks", message: "checks JSON object required" }];
  if (value.stageId !== stageId) issues.push({ path: "checks.stageId", message: "stage ID mismatch" });
  if (value.maxTicks !== undefined && (!Number.isSafeInteger(value.maxTicks) || (value.maxTicks as number) < 1 || (value.maxTicks as number) > 100000)) issues.push({ path: "checks.maxTicks", message: "must be integer in [1,100000]" });
  if (!Array.isArray(value.cases) || value.cases.length === 0 || value.cases.length > MAX_CASES) {
    issues.push({ path: "checks.cases", message: "1 to 100 test cases required" });
    return issues;
  }
  const names = new Set<string>();
  const roles = new Set(["beginner", "learning", "short", "fast", "negative", "regression"]);
  for (const [i, entry] of value.cases.entries()) {
    const path = `checks.cases[${i}]`;
    if (!isObject(entry)) { issues.push({ path, message: "test object required" }); continue; }
    if (typeof entry.name !== "string" || !entry.name.trim()) issues.push({ path: path + ".name", message: "test name required" });
    else if (names.has(entry.name)) issues.push({ path: path + ".name", message: "duplicate test name" });
    else names.add(entry.name);
    if (typeof entry.role !== "string" || !roles.has(entry.role)) issues.push({ path: path + ".role", message: "invalid test role" });
    if (typeof entry.source !== "string" || !entry.source.trim() || entry.source.length > 2000) issues.push({ path: path + ".source", message: "source must contain up to 2000 characters" });
    if (!["cleared", "failed", "timeout"].includes(entry.expect as string)) issues.push({ path: path + ".expect", message: "expected outcome is invalid" });
    if (entry.expectedTicks !== undefined && (!Number.isSafeInteger(entry.expectedTicks) || (entry.expectedTicks as number) < 1)) issues.push({ path: path + ".expectedTicks", message: "tick snapshot must be positive integer" });
  }
  return issues;
}

export function usesSecretAction(source: string): boolean {
  const program = analyzeProgram(source).program;
  const isSecret = (action: string | undefined) => action === "powerJump" || action === "sprint";
  return program.watchers.some((rule) => isSecret(rule.action))
    || program.steps.some((step) => (step.op === "action" || step.op === "wait") && isSecret(step.action));
}

export function validateStageCases(stageId: string, stage: unknown, checks: unknown): StageReport {
  const issues = [...validateStage(stageId, stage, true), ...validateChecks(stageId, checks)];
  const report: StageReport = {
    stageId, pass: false, issues, warnings: [], cases: [],
    bestKnown: { ticks: null, characters: null, timeCharactersProduct: null },
    improvements: { shorterThanBeginner: false, fasterThanBeginner: false },
  };
  if (issues.length) return report;
  const data = checks as StageChecks;
  const source = stage as GameStage;
  const maxTicks = data.maxTicks ?? DEFAULT_MAX_TICKS;
  for (const entry of data.cases) {
    const errors: string[] = [];
    const analysis = analyzeProgram(entry.source);
    const diagnostics = analysis.diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`);
    const characters = countProgramCharacters(entry.source);
    if (characters === 0) errors.push("empty program cannot be ranked");
    let outcome: CaseResult["outcome"] = "invalid";
    let elapsedTicks: number | null = null;
    let failureReason: string | undefined;
    if (diagnostics.length) errors.push("program has syntax/semantic errors");
    if (entry.role === "learning" && usesSecretAction(entry.source)) errors.push("learning route must not require secret actions");
    if (errors.length === 0) {
      const run = runToCompletion(createGame(source, analysis.program), maxTicks);
      if (run.status === "ready") throw new Error("Headless validation cannot finish in ready state");
      outcome = run.status === "running" ? "timeout" : run.status;
      elapsedTicks = run.elapsedTicks;
      failureReason = run.failureReason;
      if (outcome !== entry.expect) errors.push(`expected ${entry.expect}, observed ${outcome}`);
      if (entry.failureReason !== undefined && failureReason !== entry.failureReason) errors.push(`expected ${entry.failureReason} failure, observed ${failureReason ?? "none"}`);
      if (entry.expectedTicks !== undefined && elapsedTicks !== entry.expectedTicks) errors.push(`expected ${entry.expectedTicks} ticks, observed ${elapsedTicks}`);
      const replay = runToCompletion(createGame(source, analysis.program), maxTicks);
      if (replay.status !== outcome || replay.elapsedTicks !== elapsedTicks || replay.failureReason !== failureReason) errors.push("non-deterministic replay");
    }
    report.cases.push({
      name: entry.name, role: entry.role, source: entry.source, expected: entry.expect,
      pass: errors.length === 0, outcome, elapsedTicks,
      seconds: elapsedTicks === null ? null : elapsedTicks / GAME.tickRate,
      characters, product: outcome !== "cleared" || elapsedTicks === null ? null : elapsedTicks * characters,
      ...(failureReason ? { failureReason } : {}), errors, diagnostics,
    });
  }
  const cleared = report.cases.filter((entry) => entry.pass && entry.outcome === "cleared" && entry.elapsedTicks !== null && entry.characters > 0);
  if (!cleared.length) report.issues.push({ path: "checks.cases", message: "no verified clearing solution" });
  else {
    report.bestKnown.ticks = Math.min(...cleared.map((entry) => entry.elapsedTicks!));
    report.bestKnown.characters = Math.min(...cleared.map((entry) => entry.characters));
    report.bestKnown.timeCharactersProduct = Math.min(...cleared.map((entry) => entry.product!));
  }
  if (data.cases.some((entry) => entry.role === "learning") && !cleared.some((entry) => entry.role === "learning")) {
    report.issues.push({ path: "checks.cases", message: "learning route must clear without secret actions" });
  }
  const beginner = cleared.find((entry) => entry.role === "beginner");
  if (!beginner) report.issues.push({ path: "checks.cases", message: "at least one clearing beginner example required" });
  else {
    report.improvements.shorterThanBeginner = cleared.some((entry) => entry.characters < beginner.characters);
    report.improvements.fasterThanBeginner = cleared.some((entry) => entry.elapsedTicks! < beginner.elapsedTicks!);
    if (!report.improvements.shorterThanBeginner) report.warnings.push("no tested solution is shorter than the beginner example");
    if (!report.improvements.fasterThanBeginner) report.warnings.push("no tested solution is faster than the beginner example");
  }
  if (!report.cases.some((entry) => entry.role === "negative")) report.warnings.push("no negative test case registered");
  report.pass = !report.issues.length && report.cases.every((entry) => entry.pass);
  return report;
}
