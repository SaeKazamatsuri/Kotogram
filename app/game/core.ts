export type GameCondition = "wall" | "enemy" | "hole" | "coin";
export type GameAction = "jump" | "crouch" | "collect";
export type GameRule = { cond?: GameCondition; action: GameAction };
export type GameStatus = "running" | "cleared" | "failed" | "timeout";
export type GameFailReason = "hole" | "wall" | "enemy" | "void";

export type GameStage = {
  goal?: number;
  scrollSpeed?: number;
  objects?: unknown;
  walls?: unknown;
  ghosts?: unknown;
  holes?: unknown;
};

export type Barrier = { id: string; x: number; cleared: boolean };
export type Hole = { id: string; x: number; w: number };
export type GameState = {
  status: GameStatus;
  failureReason?: GameFailReason;
  elapsedTicks: number;
  px: number;
  py: number;
  vy: number;
  vx: number;
  crouchUntilTick: number;
  jumpReadyTick: number;
  walls: Barrier[];
  ghosts: Barrier[];
  holes: Hole[];
  goalX: number;
  program: GameRule[];
  fired: Set<string>[];
};

export const GAME = {
  tickRate: 60,
  width: 720,
  height: 360,
  groundY: 280,
  groundHeight: 80,
  playerScreenX: 64,
  playerWidth: 44,
  playerHeight: 56,
  crouchHeight: 36,
  wallWidth: 28,
  wallHeight: 80,
  ghostWidth: 44,
  ghostHeight: 80,
  ghostClearance: 40,
  goalWidth: 32,
  goalHeight: 64,
  pad: 4,
  epsilon: 8,
  approachBase: 72,
  reactionFrames: 14,
  gravity: 0.46,
  jumpVelocity: -12.2,
  jumpCooldownTicks: 32,
  crouchDurationTicks: 26,
  defaultHoleWidth: 80,
  defaultGoal: 800,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function legacyPositions(value: unknown): number[] {
  return Array.isArray(value) ? value.filter(isFiniteNumber) : [];
}

function fromStage(stage: GameStage, type: string): Record<string, unknown>[] {
  return Array.isArray(stage.objects)
    ? stage.objects.filter(
        (obj): obj is Record<string, unknown> =>
          isRecord(obj) && obj.type === type && isFiniteNumber(obj.position),
      )
    : [];
}

function makeBarriers(stage: GameStage, type: "wall" | "ghost", legacy: unknown): Barrier[] {
  const objects = fromStage(stage, type);
  const positions = objects.length
    ? objects.map((obj) => obj.position as number)
    : legacyPositions(legacy);
  return positions
    .map((x, i) => ({ id: type + ":" + i, x, cleared: false }))
    .sort((a, b) => a.x - b.x);
}

function makeHoles(stage: GameStage): Hole[] {
  const objects = fromStage(stage, "hole");
  const source = objects.length ? objects : Array.isArray(stage.holes) ? stage.holes : [];
  const holes: Hole[] = [];
  for (const value of source) {
    if (isFiniteNumber(value)) {
      holes.push({ id: "hole:" + holes.length, x: value, w: GAME.defaultHoleWidth });
    } else if (isRecord(value)) {
      const x = isFiniteNumber(value.position) ? value.position : value.x;
      const width = isFiniteNumber(value.width) ? value.width : value.w;
      if (isFiniteNumber(x)) {
        holes.push({
          id: "hole:" + holes.length,
          x,
          w: isFiniteNumber(width) && width > 0 ? width : GAME.defaultHoleWidth,
        });
      }
    }
  }
  return holes.sort((a, b) => a.x - b.x);
}

export function createGame(stage: GameStage, program: readonly GameRule[] = []): GameState {
  const walls = makeBarriers(stage, "wall", stage.walls);
  const ghosts = makeBarriers(stage, "ghost", stage.ghosts);
  const holes = makeHoles(stage);
  const goal = fromStage(stage, "goal")[0]?.position;
  const lastObstacle = Math.max(0, ...walls.map((o) => o.x), ...ghosts.map((o) => o.x), ...holes.map((o) => o.x));
  const goalX = Math.max(
    isFiniteNumber(goal) ? goal : isFiniteNumber(stage.goal) ? stage.goal : GAME.defaultGoal,
    lastObstacle + GAME.approachBase + 160,
  );
  return {
    status: "running",
    elapsedTicks: 0,
    px: GAME.playerScreenX,
    py: GAME.groundY - GAME.epsilon,
    vy: 0,
    vx: isFiniteNumber(stage.scrollSpeed) && stage.scrollSpeed > 0 ? stage.scrollSpeed : 3,
    crouchUntilTick: -1,
    jumpReadyTick: 0,
    walls,
    ghosts,
    holes,
    goalX,
    program: program.map((rule) => ({ ...rule })),
    fired: program.map(() => new Set<string>()),
  };
}

export function isCrouching(game: GameState): boolean {
  return game.elapsedTicks <= game.crouchUntilTick;
}

export function worldToScreenX(game: GameState, x: number): number {
  return x - (game.px - GAME.playerScreenX);
}

function nextTarget<T extends { id: string; x: number }>(objects: readonly T[], px: number): T | undefined {
  return objects.find((obj) => obj.x + GAME.pad >= px);
}

function nextSensed(game: GameState, condition: GameCondition): { id: string; x: number } | undefined {
  if (condition === "coin") return undefined;
  const targets: readonly { id: string; x: number }[] = condition === "wall" ? game.walls : condition === "enemy" ? game.ghosts : game.holes;
  const next = nextTarget(targets, game.px);
  const range = GAME.approachBase + game.vx * GAME.reactionFrames;
  return next && next.x - game.px <= range ? next : undefined;
}

function issueCrouch(game: GameState) {
  game.crouchUntilTick = Math.max(game.crouchUntilTick, game.elapsedTicks + GAME.crouchDurationTicks);
}

function issueJump(game: GameState): boolean {
  if (game.elapsedTicks < game.jumpReadyTick || game.vy !== 0 || Math.abs(game.py - (GAME.groundY - GAME.epsilon)) > 0.1) return false;
  game.vy = GAME.jumpVelocity;
  game.jumpReadyTick = game.elapsedTicks + GAME.jumpCooldownTicks;
  return true;
}

function applyProgram(game: GameState) {
  for (const [index, rule] of game.program.entries()) {
    const target = rule.cond ? nextSensed(game, rule.cond) : undefined;
    if (rule.cond && !target) continue;
    const key = target?.id ?? "unconditional";
    const alreadyFired = game.fired[index].has(key);
    if (alreadyFired) {
      if (rule.action === "crouch" && target) issueCrouch(game);
      continue;
    }
    let accepted = false;
    if (rule.action === "jump") accepted = issueJump(game);
    if (rule.action === "crouch") {
      issueCrouch(game);
      accepted = true;
    }
    if (rule.action === "collect") accepted = true;
    if (accepted) game.fired[index].add(key);
  }
}

function overHole(game: GameState, x: number): boolean {
  return game.holes.some((hole) => x >= hole.x && x <= hole.x + hole.w);
}

function fail(game: GameState, reason: GameFailReason) {
  game.status = "failed";
  game.failureReason = reason;
}

export function stepGame(game: GameState): GameStatus {
  if (game.status !== "running") return game.status;
  applyProgram(game);
  game.px += game.vx;
  game.vy += GAME.gravity;
  game.py += game.vy;
  const front = game.px + GAME.playerWidth;
  if (game.py > GAME.groundY - GAME.epsilon && !overHole(game, front)) {
    game.py = GAME.groundY - GAME.epsilon;
    game.vy = 0;
  }
  game.elapsedTicks += 1;
  if (overHole(game, front) && game.py >= GAME.groundY + GAME.playerHeight / 2) {
    fail(game, "hole");
    return game.status;
  }
  const wall = game.walls.find((w) => !w.cleared && front >= w.x);
  if (wall) {
    const playerHeight = isCrouching(game) ? GAME.crouchHeight : GAME.playerHeight;
    const top = game.py - playerHeight;
    if (top > GAME.groundY - GAME.wallHeight + 12) {
      fail(game, "wall");
      return game.status;
    }
    wall.cleared = true;
  }
  const ghost = game.ghosts.find((g) => !g.cleared && front >= g.x);
  if (ghost) {
    if (isCrouching(game)) ghost.cleared = true;
    else {
      fail(game, "enemy");
      return game.status;
    }
  }
  if (game.px >= game.goalX) game.status = "cleared";
  return game.status;
}

export function runToCompletion(game: GameState, maxTicks = 100_000): GameState {
  if (!Number.isSafeInteger(maxTicks) || maxTicks < 1) throw new RangeError("maxTicks must be a positive safe integer");
  while (game.status === "running" && game.elapsedTicks < maxTicks) stepGame(game);
  if (game.status === "running") game.status = "timeout";
  return game;
}

export function elapsedSeconds(game: GameState): number {
  return game.elapsedTicks / GAME.tickRate;
}
