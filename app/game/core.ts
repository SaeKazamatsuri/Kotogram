export type GameCondition = "wall" | "enemy" | "hole" | "coin" | "ahead" | "switch";
export type GameAction = "jump" | "crouch" | "collect" | "run" | "walk" | "press";
export type GameRule = { cond?: GameCondition; conds?: GameCondition[]; maxFires?: number; action: GameAction };
/** Watchers are active from tick zero; the procedure advances in source order. */
export type GameInstruction =
  | { op: "action"; action: GameAction; count: number }
  | { op: "wait"; conds: GameCondition[]; action?: GameAction; count: number }
  | { op: "repeat-start"; count: number; end: number }
  | { op: "repeat-end"; start: number };
export type GameProgram = { watchers: GameRule[]; steps: GameInstruction[] };
export type LoopFrame = { start: number; remaining: number };
export type GameStatus = "running" | "cleared" | "failed" | "timeout";
export type GameFailReason = "hole" | "wall" | "enemy" | "coin" | "door" | "void";

export type GameStage = {
  goal?: number;
  scrollSpeed?: number;
  requiredCoins?: number;
  objects?: unknown;
  walls?: unknown;
  ghosts?: unknown;
  holes?: unknown;
};

export type Barrier = { id: string; x: number; cleared: boolean };
export type Hole = { id: string; x: number; w: number };
export type Coin = { id: string; x: number; collected: boolean };
export type Door = { id: string; x: number; open: boolean };
export type Switch = { id: string; x: number; targetDoorId: string; activated: boolean };
export type GameState = {
  status: GameStatus;
  failureReason?: GameFailReason;
  elapsedTicks: number;
  px: number;
  py: number;
  vy: number;
  vx: number;
  baseSpeed: number;
  crouchUntilTick: number;
  jumpReadyTick: number;
  walls: Barrier[];
  ghosts: Barrier[];
  holes: Hole[];
  coins: Coin[];
  doors: Door[];
  switches: Switch[];
  requiredCoins: number;
  goalX: number;
  program: GameRule[];
  fired: Set<string>[];
  steps: GameInstruction[];
  cursor: number;
  sequenceProgress: number;
  sequenceConsumed: Set<string>;
  loops: LoopFrame[];
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
  runMultiplier: 1.3,
  gravity: 0.46,
  jumpVelocity: -12.2,
  jumpCooldownTicks: 32,
  crouchDurationTicks: 26,
  coinPickupRange: 48,
  switchPressRange: 48,
  doorWidth: 30,
  doorHeight: 112,
  coinRadius: 13,
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

function makeCoins(stage: GameStage): Coin[] {
  return fromStage(stage, "coin")
    .map((object, index) => ({
      id: typeof object.id === "string" && object.id ? object.id : "coin:" + index,
      x: object.position as number,
      collected: false,
    }))
    .sort((a, b) => a.x - b.x);
}

function makeDoors(stage: GameStage): Door[] {
  return fromStage(stage, "door")
    .map((object) => ({ id: object.id as string, x: object.position as number, open: false }))
    .sort((a, b) => a.x - b.x);
}

function makeSwitches(stage: GameStage): Switch[] {
  return fromStage(stage, "switch")
    .map((object) => ({
      id: object.id as string,
      x: object.position as number,
      targetDoorId: object.targetDoorId as string,
      activated: false,
    }))
    .sort((a, b) => a.x - b.x);
}

export function createGame(stage: GameStage, program: readonly GameRule[] | GameProgram = []): GameState {
  const watchers = Array.isArray(program) ? program : (program as GameProgram).watchers;
  const steps = Array.isArray(program) ? [] : (program as GameProgram).steps;
  const walls = makeBarriers(stage, "wall", stage.walls);
  const ghosts = makeBarriers(stage, "ghost", stage.ghosts);
  const holes = makeHoles(stage);
  const coins = makeCoins(stage);
  const doors = makeDoors(stage);
  const switches = makeSwitches(stage);
  const goal = fromStage(stage, "goal")[0]?.position;
  const lastObstacle = Math.max(0, ...walls.map((o) => o.x), ...ghosts.map((o) => o.x), ...holes.map((o) => o.x), ...coins.map((o) => o.x), ...doors.map((o) => o.x), ...switches.map((o) => o.x));
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
    baseSpeed: isFiniteNumber(stage.scrollSpeed) && stage.scrollSpeed > 0 ? stage.scrollSpeed : 3,
    crouchUntilTick: -1,
    jumpReadyTick: 0,
    walls,
    ghosts,
    holes,
    coins,
    doors,
    switches,
    requiredCoins: Number.isSafeInteger(stage.requiredCoins) && stage.requiredCoins! > 0 ? stage.requiredCoins! : 0,
    goalX,
    program: watchers.map((rule) => ({ ...rule, conds: rule.conds ? [...rule.conds] : undefined })),
    fired: watchers.map(() => new Set<string>()),
    steps: steps.map((step) => ({ ...step, ...(step.op === "wait" ? { conds: [...step.conds] } : {}) })),
    cursor: 0,
    sequenceProgress: 0,
    sequenceConsumed: new Set<string>(),
    loops: [],
  };
}

export function isCrouching(game: GameState): boolean {
  return game.elapsedTicks <= game.crouchUntilTick;
}

export function worldToScreenX(game: GameState, x: number): number {
  return x - (game.px - GAME.playerScreenX);
}

function nextTarget(objects: readonly { id: string; x: number }[], px: number): { id: string; x: number } | undefined {
  return objects.find((obj) => obj.x + GAME.pad >= px);
}

function sensedTargets(game: GameState, conditions: readonly GameCondition[]): { id: string; x: number }[] {
  const range = GAME.approachBase + game.vx * GAME.reactionFrames;
  const found = new Map<string, { id: string; x: number }>();
  for (const condition of conditions) {
    if (condition === "switch") {
      const target = nextTarget(game.switches.filter((item) => !item.activated), game.px);
      if (target && target.x - game.px <= GAME.switchPressRange) found.set(target.id, target);
      continue;
    }
    if (condition === "coin") {
      const target = nextTarget(game.coins.filter((coin) => !coin.collected), game.px);
      if (target && target.x - game.px <= GAME.coinPickupRange) found.set(target.id, target);
      continue;
    }
    const groups = condition === "ahead" ? [game.walls, game.ghosts, game.holes, game.doors.filter((door) => !door.open)]
      : condition === "wall" ? [game.walls]
      : condition === "enemy" ? [game.ghosts] : [game.holes];
    for (const objects of groups) {
      const target = nextTarget(objects, game.px);
      if (target && target.x - game.px <= range) found.set(target.id, target);
    }
  }
  return [...found.values()].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
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

/** An action is counted only when the engine accepts it. */
function acceptAction(game: GameState, action: GameAction): boolean {
  if (action === "run") {
    game.vx = game.baseSpeed * GAME.runMultiplier;
    return true;
  }
  if (action === "walk") {
    game.vx = game.baseSpeed;
    return true;
  }
  if (action === "jump") return issueJump(game);
  if (action === "crouch") {
    issueCrouch(game);
    return true;
  }
  if (action === "press") {
    const target = game.switches.find((item) =>
      !item.activated && item.x + GAME.pad >= game.px &&
      item.x - game.px <= GAME.switchPressRange
    );
    if (!target) return false;
    const door = game.doors.find((item) => item.id === target.targetDoorId);
    if (!door) return false;
    target.activated = true;
    door.open = true;
    return true;
  }
  if (action === "collect") {
    const target = game.coins.find((coin) =>
      !coin.collected && coin.x + GAME.pad >= game.px &&
      coin.x - game.px <= GAME.coinPickupRange
    );
    if (!target) return false;
    target.collected = true;
    return true;
  }
  return false;
}

function applyProgram(game: GameState) {
  for (const [index, rule] of game.program.entries()) {
    const history = game.fired[index];
    if (rule.maxFires !== undefined && history.size >= rule.maxFires) continue;
    const conditions = rule.conds?.length ? rule.conds : rule.cond ? [rule.cond] : [];
    const sensed = conditions.length ? sensedTargets(game, conditions) : [];
    if (conditions.length && !sensed.length) continue;
    const target = conditions.length ? sensed.find((item) => !history.has(item.id)) : undefined;
    if (conditions.length && !target) {
      if (rule.action === "crouch") issueCrouch(game);
      continue;
    }
    const key = target?.id ?? "unconditional";
    if (history.has(key)) continue;
    if (acceptAction(game, rule.action)) history.add(key);
  }
}

/**
 * The procedural half of the hybrid interpreter.
 *
 * - Top-level conditional rules are independent continuous watchers.
 * - In a multi-statement repeat, conditions become blocking waits for the
 *   next *distinct* obstacle. A wait consumes its event only after acceptance.
 * - Actions and nested loops follow their source order without unrolling.
 * - Multiple non-blocking commands may complete in one tick, but each wait
 *   consumes at most one event per tick. The step budget prevents spin loops.
 */
function applySequence(game: GameState): void {
  const instructionBudget = 128;
  for (let stepsTaken = 0; stepsTaken < instructionBudget && game.cursor < game.steps.length; stepsTaken++) {
    const op = game.steps[game.cursor]!;
    if (op.op === "repeat-start") {
      game.loops.push({ start: game.cursor, remaining: op.count });
      game.cursor++;
      continue;
    }
    if (op.op === "repeat-end") {
      const top = game.loops.at(-1);
      if (!top || top.start !== op.start) throw new Error("Invalid compiled repeat block");
      if (--top.remaining > 0) {
        game.cursor = op.start + 1;
        game.sequenceProgress = 0;
        return; // Run at most one iteration of this loop per tick.
      } else {
        game.loops.pop();
        game.cursor++;
      }
      game.sequenceProgress = 0;
      continue;
    }
    if (op.op === "action") {
      if (!acceptAction(game, op.action)) return; // Wait until landing / cooldown.
      if (++game.sequenceProgress >= op.count) {
        game.sequenceProgress = 0;
        game.cursor++;
      }
      // Limit repeated actions to one successful activation per tick.
      if (game.sequenceProgress > 0) return;
      continue;
    }
    const target = sensedTargets(game, op.conds).find((item) => !game.sequenceConsumed.has(item.id));
    if (!target) return;
    if (op.action && !acceptAction(game, op.action)) return;
    game.sequenceConsumed.add(target.id);
    if (++game.sequenceProgress >= op.count) {
      game.sequenceProgress = 0;
      game.cursor++;
    }
    return; // No obstacle can count twice within the same tick.
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
  applySequence(game);
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
  const door = game.doors.find((item) => !item.open && front >= item.x);
  if (door) {
    fail(game, "door");
    return game.status;
  }
  const ghost = game.ghosts.find((g) => !g.cleared && front >= g.x);
  if (ghost) {
    if (isCrouching(game)) ghost.cleared = true;
    else {
      fail(game, "enemy");
      return game.status;
    }
  }
  if (game.px >= game.goalX) {
    if (game.coins.filter((coin) => coin.collected).length < game.requiredCoins) fail(game, "coin");
    else game.status = "cleared";
  }
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
