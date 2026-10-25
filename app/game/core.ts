export type SwitchColor = "red" | "green" | "blue" | "yellow" | "purple";
export type SwitchShape = "circle" | "cross" | "triangle" | "square" | "star";
export type SwitchSelector = `switch:${SwitchColor | "*"}:${SwitchShape | "*"}`;
export type GameCondition = "wall" | "enemy" | "hole" | "coin" | "ahead" | "switch" | "door" | "conveyor" | "fragileFloor" | SwitchSelector;

export const SWITCH_COLORS: readonly SwitchColor[] = ["red", "green", "blue", "yellow", "purple"];
export const SWITCH_SHAPES: readonly SwitchShape[] = ["circle", "cross", "triangle", "square", "star"];

export function switchAppearance(input: { trap: boolean; color?: SwitchColor; shape?: SwitchShape }): { color: SwitchColor; shape: SwitchShape } {
  return { color: input.color ?? (input.trap ? "red" : "green"), shape: input.shape ?? (input.trap ? "cross" : "circle") };
}
export type GameAction = "jump" | "powerJump" | "crouch" | "collect" | "run" | "sprint" | "walk" | "press" | "skip" | "breakDoor";
export type GameRule = { cond?: GameCondition; conds?: GameCondition[]; maxFires?: number; action: GameAction };

export type GameInstruction =
  | { op: "action"; action: GameAction; count: number }
  | { op: "wait"; conds: GameCondition[]; action?: GameAction; count: number }
  | { op: "repeat-start"; count: number; end: number }
  | { op: "repeat-end"; start: number };
export type GameProgram = { watchers: GameRule[]; steps: GameInstruction[] };
export type ExecutionTrace = { kind: "watcher" | "step" | "repeat"; index: number; tick: number; action?: GameAction };
export type TraceObserver = (trace: ExecutionTrace) => void;
export type LoopFrame = { start: number; remaining: number };
export type GameStatus = "ready" | "running" | "cleared" | "failed" | "timeout";
export type GameFailReason = "hole" | "wall" | "enemy" | "coin" | "door" | "trap" | "skip" | "void";

export type GameStage = {
  goal?: number;
  scrollSpeed?: number;
  requiredCoins?: number;
  requiredSkips?: number;
  optionalObjectives?: boolean;
  jumpSensorProfile?: "centered-holes";
  objects?: unknown;
  walls?: unknown;
  ghosts?: unknown;
  holes?: unknown;
};

export type Barrier = { id: string; x: number; cleared: boolean };
export type Hole = { id: string; x: number; w: number };
export type Coin = { id: string; x: number; collected: boolean };
export type Door = { id: string; x: number; open: boolean; broken: boolean; vaulted: boolean; breakable: boolean; vaultable: boolean; autoCloseTicks: number; openedUntilTick: number | null; passed: boolean };
export type Conveyor = { id: string; x: number; w: number; multiplier: number };
export type FragileFloor = { id: string; x: number; w: number; breakAfterTicks: number; firstStepTick: number | null; collapsed: boolean };
export type Switch = { id: string; x: number; targetDoorId: string; activated: boolean; skipped: boolean; trap: boolean; color: SwitchColor; shape: SwitchShape };
export type GameState = {
  status: GameStatus;
  failureReason?: GameFailReason;
  elapsedTicks: number;
  px: number;
  py: number;
  vy: number;
  vx: number;
  baseSpeed: number;
  jumpSensorProfile: "legacy" | "centered-holes";
  crouchUntilTick: number;
  jumpReadyTick: number;
  powerJumpActive: boolean;
  walls: Barrier[];
  ghosts: Barrier[];
  holes: Hole[];
  coins: Coin[];
  doors: Door[];
  switches: Switch[];
  conveyors: Conveyor[];
  fragileFloors: FragileFloor[];
  requiredCoins: number;
  requiredSkips: number;
  optionalObjectives: boolean;
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
  sprintMultiplier: 1.75,
  gravity: 0.46,
  jumpVelocity: -12.2,
  powerJumpVelocity: -16,
  jumpCooldownTicks: 32,
  crouchDurationTicks: 26,
  coinPickupRange: 48,
  switchPressRange: 48,
  doorWidth: 30,
  doorHeight: 112,
  doorBreakRange: 60,
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
    .map((object) => ({ id: object.id as string, x: object.position as number, open: false, broken: false, vaulted: false, breakable: object.breakable === true, vaultable: object.vaultable === true, autoCloseTicks: typeof object.autoCloseTicks === "number" ? object.autoCloseTicks : 0, openedUntilTick: null, passed: false }))
    .sort((a, b) => a.x - b.x);
}

function makeSwitches(stage: GameStage): Switch[] {
  return fromStage(stage, "switch")
    .map((object) => ({
      id: object.id as string,
      x: object.position as number,
      targetDoorId: object.targetDoorId as string,
      activated: false,
      skipped: false,
      trap: object.trap === true,
      ...switchAppearance({ trap: object.trap === true, color: object.color as SwitchColor | undefined, shape: object.shape as SwitchShape | undefined }),
    }))
    .sort((a, b) => a.x - b.x);
}

function makeConveyors(stage: GameStage): Conveyor[] {
  return fromStage(stage, "conveyor").map((item, i) => ({
    id: typeof item.id === "string" ? item.id : "conveyor:" + i,
    x: item.position as number, w: typeof item.width === "number" ? item.width : 120,
    multiplier: typeof item.multiplier === "number" ? item.multiplier : 1.5,
  })).sort((a, b) => a.x - b.x);
}

function makeFragileFloors(stage: GameStage): FragileFloor[] {
  return fromStage(stage, "fragileFloor").map((item, i) => ({
    id: typeof item.id === "string" ? item.id : "fragileFloor:" + i,
    x: item.position as number, w: typeof item.width === "number" ? item.width : 120,
    breakAfterTicks: typeof item.breakAfterTicks === "number" ? item.breakAfterTicks : 25,
    firstStepTick: null, collapsed: false,
  })).sort((a, b) => a.x - b.x);
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
  const conveyors = makeConveyors(stage);
  const fragileFloors = makeFragileFloors(stage);
  const goal = fromStage(stage, "goal")[0]?.position;
  const lastObstacle = Math.max(0, ...walls.map((o) => o.x), ...ghosts.map((o) => o.x), ...holes.map((o) => o.x), ...coins.map((o) => o.x), ...doors.map((o) => o.x), ...switches.map((o) => o.x), ...conveyors.map((o) => o.x + o.w), ...fragileFloors.map((o) => o.x + o.w));
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
    jumpSensorProfile: stage.jumpSensorProfile === "centered-holes" ? "centered-holes" : "legacy",
    crouchUntilTick: -1,
    jumpReadyTick: 0,
    powerJumpActive: false,
    walls,
    ghosts,
    holes,
    coins,
    doors,
    switches,
    conveyors,
    fragileFloors,
    requiredCoins: Number.isSafeInteger(stage.requiredCoins) && stage.requiredCoins! > 0 ? stage.requiredCoins! : 0,
    requiredSkips: Number.isSafeInteger(stage.requiredSkips) && stage.requiredSkips! > 0 ? stage.requiredSkips! : 0,
    optionalObjectives: stage.optionalObjectives === true,
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

export function createReadyGame(stage: GameStage, program: readonly GameRule[] | GameProgram = []): GameState {
  const game = createGame(stage, program);
  game.status = "ready";
  return game;
}

export function startGame(game: GameState): void {
  if (game.status !== "ready") throw new Error("Only a ready game can start");
  game.status = "running";
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
    if (condition === "switch" || condition.startsWith("switch:")) {
      const [, color, shape] = condition.split(":");
      const target = nextTarget(game.switches.filter((item) =>
        !item.activated && !item.skipped &&
        (!color || color === "*" || item.color === color) &&
        (!shape || shape === "*" || item.shape === shape)
      ), game.px);
      if (target && target.x - game.px <= GAME.switchPressRange) found.set(target.id, target);
      continue;
    }
    if (condition === "door") {
      const target = nextTarget(game.doors.filter((door) => !door.open && !door.vaulted), game.px);
      if (target && target.x - game.px <= range) found.set(target.id, target);
      continue;
    }
    if (condition === "conveyor" || condition === "fragileFloor") {
      const target = nextTarget(condition === "conveyor" ? game.conveyors : game.fragileFloors, game.px);
      if (target && target.x - game.px <= range) found.set(target.id, target);
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
      const triggerRange = game.jumpSensorProfile === "centered-holes" && objects === game.holes
        ? Math.max(0, range - Math.max(0, ((game.holes.find((hole) => hole.id === target?.id)?.w ?? GAME.defaultHoleWidth) - GAME.wallWidth) / 2))
        : range;
      if (target && target.x - game.px <= triggerRange) found.set(target.id, target);
    }
  }
  return [...found.values()].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
}

function issueCrouch(game: GameState) {
  game.crouchUntilTick = Math.max(game.crouchUntilTick, game.elapsedTicks + GAME.crouchDurationTicks);
}

function issueJump(game: GameState, velocity: number = GAME.jumpVelocity): boolean {
  if (game.elapsedTicks < game.jumpReadyTick || game.vy !== 0 || Math.abs(game.py - (GAME.groundY - GAME.epsilon)) > 0.1) return false;
  game.vy = velocity;
  game.powerJumpActive = velocity === GAME.powerJumpVelocity;
  game.jumpReadyTick = game.elapsedTicks + GAME.jumpCooldownTicks;
  return true;
}

function acceptAction(game: GameState, action: GameAction, sensedTargetId?: string): boolean {
  if (action === "run") {
    game.vx = game.baseSpeed * GAME.runMultiplier;
    return true;
  }
  if (action === "sprint") {
    game.vx = game.baseSpeed * GAME.sprintMultiplier;
    return true;
  }
  if (action === "walk") {
    game.vx = game.baseSpeed;
    return true;
  }
  if (action === "jump") return issueJump(game);
  if (action === "powerJump") return issueJump(game, GAME.powerJumpVelocity);
  if (action === "crouch") {
    issueCrouch(game);
    return true;
  }
  if (action === "press" || action === "skip") {
    const target = game.switches.find((item) =>
      !item.activated && !item.skipped &&
      (sensedTargetId === undefined || item.id === sensedTargetId) &&
      item.x + GAME.pad >= game.px &&
      item.x - game.px <= GAME.switchPressRange
    );
    if (!target) return false;
    if (action === "skip") {
      target.skipped = true;
      return true;
    }
    const door = game.doors.find((item) => item.id === target.targetDoorId);
    if (!door) return false;
    if (target.trap) {
      fail(game, "trap");
      return true;
    }
    target.activated = true;
    door.open = true;
    door.openedUntilTick = door.autoCloseTicks ? game.elapsedTicks + door.autoCloseTicks : null;
    return true;
  }
  if (action === "breakDoor") {
    const target = game.doors.find((door) =>
      door.breakable && !door.open && !door.vaulted &&
      (sensedTargetId === undefined || door.id === sensedTargetId) &&
      door.x + GAME.pad >= game.px &&
      door.x - game.px <= GAME.doorBreakRange
    );
    if (!target) return false;
    target.broken = true;
    target.open = true;
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

function applyProgram(game: GameState, observe?: TraceObserver) {
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
    if (acceptAction(game, rule.action, target?.id)) {
      history.add(key);
      observe?.({ kind: "watcher", index, tick: game.elapsedTicks, action: rule.action });
    }
  }
}

function applySequence(game: GameState, observe?: TraceObserver): void {
  const instructionBudget = 128;
  for (let stepsTaken = 0; stepsTaken < instructionBudget && game.cursor < game.steps.length; stepsTaken++) {
    const op = game.steps[game.cursor]!;
    if (op.op === "repeat-start") {
      observe?.({ kind: "repeat", index: game.cursor, tick: game.elapsedTicks });
      game.loops.push({ start: game.cursor, remaining: op.count });
      game.cursor++;
      continue;
    }
    if (op.op === "repeat-end") {
      const top = game.loops.at(-1);
      if (!top || top.start !== op.start) throw new Error("Invalid compiled repeat block");
      if (--top.remaining > 0) {
        observe?.({ kind: "repeat", index: op.start, tick: game.elapsedTicks });
        game.cursor = op.start + 1;
        game.sequenceProgress = 0;
        return;
      } else {
        game.loops.pop();
        game.cursor++;
      }
      game.sequenceProgress = 0;
      continue;
    }
    if (op.op === "action") {
      if (!acceptAction(game, op.action)) return;
      observe?.({ kind: "step", index: game.cursor, tick: game.elapsedTicks, action: op.action });
      if (++game.sequenceProgress >= op.count) {
        game.sequenceProgress = 0;
        game.cursor++;
      }

      if (game.sequenceProgress > 0) return;
      continue;
    }
    const target = sensedTargets(game, op.conds).find((item) => !game.sequenceConsumed.has(item.id));
    if (!target) return;
    if (op.action && !acceptAction(game, op.action, target.id)) return;
    observe?.({ kind: "step", index: game.cursor, tick: game.elapsedTicks, action: op.action });
    game.sequenceConsumed.add(target.id);
    if (++game.sequenceProgress >= op.count) {
      game.sequenceProgress = 0;
      game.cursor++;
    }
    return;
  }
}

function overHole(game: GameState, x: number): boolean {
  return game.holes.some((hole) => x >= hole.x && x <= hole.x + hole.w) ||
    game.fragileFloors.some((floor) => floor.collapsed && x >= floor.x && x <= floor.x + floor.w);
}

function fail(game: GameState, reason: GameFailReason) {
  game.status = "failed";
  game.failureReason = reason;
}

export function stepGame(game: GameState, observe?: TraceObserver): GameStatus {
  if (game.status !== "running") return game.status;
  applyProgram(game, observe);
  if (game.status !== "running") return game.status;
  applySequence(game, observe);
  if (game.status !== "running") return game.status;
  const movingFloor = game.conveyors.find((floor) => game.px >= floor.x && game.px <= floor.x + floor.w &&
    Math.abs(game.py - (GAME.groundY - GAME.epsilon)) < 0.1);
  game.px += game.vx * (movingFloor?.multiplier ?? 1);
  game.vy += GAME.gravity;
  game.py += game.vy;
  const front = game.px + GAME.playerWidth;
  if (game.py > GAME.groundY - GAME.epsilon && !overHole(game, front)) {
    game.py = GAME.groundY - GAME.epsilon;
    game.vy = 0;
    game.powerJumpActive = false;
  }
  game.elapsedTicks += 1;
  for (const door of game.doors) {
    if (door.openedUntilTick !== null && !door.broken && game.elapsedTicks >= door.openedUntilTick) {
      door.open = false;
      door.openedUntilTick = null;
    }
  }
  for (const floor of game.fragileFloors) {
    if (floor.collapsed) continue;
    const standing = game.px >= floor.x && game.px <= floor.x + floor.w &&
      Math.abs(game.py - (GAME.groundY - GAME.epsilon)) < 0.1;
    if (standing && floor.firstStepTick === null) floor.firstStepTick = game.elapsedTicks;
    if (floor.firstStepTick !== null && game.elapsedTicks - floor.firstStepTick >= floor.breakAfterTicks) {
      floor.collapsed = true;
      // A collapsing platform must hit the player while their feet are still on it.
      // Testing the front edge alone lets players bypass narrow floors without jumping.
      if (game.px <= floor.x + floor.w && game.px + GAME.playerWidth >= floor.x &&
          Math.abs(game.py - (GAME.groundY - GAME.epsilon)) < 0.1) {
        fail(game, "hole");
        return game.status;
      }
    }
  }
  if (game.py < GAME.groundY - GAME.epsilon - 8) {
    for (const item of game.switches) {
      if (!item.activated && !item.skipped && front >= item.x && game.px <= item.x + GAME.pad) {
        item.skipped = true;
      }
    }
  }
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
  const door = game.doors.find((item) => !item.open && !item.vaulted && !item.passed && front >= item.x);
  if (door) {
    if (door.vaultable && game.powerJumpActive && game.py <= GAME.groundY - GAME.doorHeight - 4) {
      door.vaulted = true;
    } else {
      fail(game, "door");
      return game.status;
    }
  }
  for (const item of game.doors) {
    if (game.px > item.x + GAME.doorWidth) item.passed = true;
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
    if (!game.optionalObjectives && game.coins.filter((coin) => coin.collected).length < game.requiredCoins) fail(game, "coin");
    else if (!game.optionalObjectives && game.switches.filter((item) => item.skipped && item.trap).length < game.requiredSkips) fail(game, "skip");
    else game.status = "cleared";
  }
  return game.status;
}

export function runToCompletion(game: GameState, maxTicks = 100_000): GameState {
  if (!Number.isSafeInteger(maxTicks) || maxTicks < 1) throw new RangeError("maxTicks must be a positive safe integer");
  if (game.status === "ready") throw new Error("Start a ready game before running it to completion");
  while (game.status === "running" && game.elapsedTicks < maxTicks) stepGame(game);
  if (game.status === "running") game.status = "timeout";
  return game;
}

export function elapsedSeconds(game: GameState): number {
  return game.elapsedTicks / GAME.tickRate;
}
