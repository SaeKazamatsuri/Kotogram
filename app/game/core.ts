export type SwitchColor = "red" | "green" | "blue" | "yellow" | "purple";
export type SwitchShape = "circle" | "cross" | "triangle" | "square" | "star";
export type SwitchSelector = `switch:${SwitchColor | "*"}:${SwitchShape | "*"}`;
export type GameCondition = "wall" | "enemy" | "hole" | "coin" | "ahead" | "switch" | "door" | "conveyor" | "fragileFloor" | "wind" | "pressurePlate" | "movingPlatform" | "laser" | "bridge" | "key" | "chest" | "portal" | "goal" | "verticalPlatform" | "mirror" | SwitchSelector;

export const SWITCH_COLORS: readonly SwitchColor[] = ["red", "green", "blue", "yellow", "purple"];
export const SWITCH_SHAPES: readonly SwitchShape[] = ["circle", "cross", "triangle", "square", "star"];

export function switchAppearance(input: { trap: boolean; color?: SwitchColor; shape?: SwitchShape }): { color: SwitchColor; shape: SwitchShape } {
  return { color: input.color ?? (input.trap ? "red" : "green"), shape: input.shape ?? (input.trap ? "cross" : "circle") };
}
export type GameAction = "jump" | "powerJump" | "crouch" | "collect" | "run" | "sprint" | "walk" | "press" | "skip" | "breakDoor" | "openChest" | "enterPortal" | "ridePlatform" | "reflect";
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
export type GameFailReason = "hole" | "wall" | "enemy" | "coin" | "door" | "trap" | "skip" | "void" | "laser";

export type GameStage = {
  goal?: number;
  scrollSpeed?: number;
  requiredCoins?: number;
  requiredSkips?: number;
  optionalObjectives?: boolean;
  secretDoorRiskBp?: number;
  jumpSensorProfile?: "centered-holes";
  objects?: unknown;
  walls?: unknown;
  ghosts?: unknown;
  holes?: unknown;
};

export type Barrier = { id: string; x: number; cleared: boolean; originX?: number; patrolRange?: number; patrolPeriod?: number };
export type Hole = { id: string; x: number; w: number };
export type Coin = { id: string; x: number; collected: boolean; chestId?: string; revealAfterMirrorId?: string };
export type KeyItem = { id: string; x: number; collected: boolean };
export type Chest = { id: string; x: number; keyId: string; opened: boolean; rewardId: string };
export type Portal = { id: string; x: number; targetX: number; used: boolean };
export type Mirror = { id: string; x: number; fromDirection: 1 | -1; used: boolean };
export type GoalChoice = { id: string; x: number; bonusBp: number; isFinal: boolean; skipped: boolean; reached: boolean };
export type Door = { id: string; x: number; open: boolean; broken: boolean; vaulted: boolean; breakable: boolean; vaultable: boolean; autoCloseTicks: number; openedUntilTick: number | null; passed: boolean; sequenceLength: number; nextSequenceStep: number };
export type Conveyor = { id: string; x: number; w: number; multiplier: number };
export type WindZone = { id: string; x: number; w: number; multiplier: number };
export type PressurePlate = { id: string; x: number; w: number; holdTicks: number; heldTicks: number; targetDoorId: string; activated: boolean };
export type MovingPlatform = { id: string; x: number; originX: number; w: number; travel: number; period: number };
export type VerticalPlatform = { id: string; x: number; w: number; y: number; originY: number; travelY: number; period: number; phaseOffset: number };
export type Laser = { id: string; x: number; period: number; activeTicks: number; phaseOffset: number; passed: boolean };
export type Bridge = { id: string; x: number; w: number; targetDoorId: string };
export type FragileFloor = { id: string; x: number; w: number; breakAfterTicks: number; firstStepTick: number | null; collapsed: boolean };
export type Switch = { id: string; x: number; targetDoorId: string; activated: boolean; skipped: boolean; trap: boolean; color: SwitchColor; shape: SwitchShape; sequenceStep: number | null };
export type GameState = {
  status: GameStatus;
  failureReason?: GameFailReason;
  elapsedTicks: number;
  px: number;
  py: number;
  vy: number;
  vx: number;
  direction: 1 | -1;
  baseSpeed: number;
  jumpSensorProfile: "legacy" | "centered-holes";
  crouchUntilTick: number;
  jumpReadyTick: number;
  powerJumpActive: boolean;
  walls: Barrier[];
  ghosts: Barrier[];
  holes: Hole[];
  coins: Coin[];
  keys: KeyItem[];
  chests: Chest[];
  portals: Portal[];
  mirrors: Mirror[];
  goals: GoalChoice[];
  goalBonusBp: number;
  selectedGoalId: string | null;
  doors: Door[];
  switches: Switch[];
  conveyors: Conveyor[];
  winds: WindZone[];
  pressurePlates: PressurePlate[];
  movingPlatforms: MovingPlatform[];
  verticalPlatforms: VerticalPlatform[];
  boardingPlatformId: string | null;
  standingPlatformId: string | null;
  lasers: Laser[];
  bridges: Bridge[];
  fragileFloors: FragileFloor[];
  requiredCoins: number;
  requiredSkips: number;
  optionalObjectives: boolean;
  secretDoorRiskBp: number;
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
    .map((x, i) => {
      const source = objects[i];
      const movingGhost = type === "ghost" && source && isFiniteNumber(source.patrolRange) &&
        isFiniteNumber(source.patrolPeriod) && source.patrolRange > 0 && source.patrolPeriod >= 40;
      return {
        id: type + ":" + i,
        x,
        cleared: false,
        ...(movingGhost ? {
          originX: x, patrolRange: source.patrolRange as number,
          patrolPeriod: source.patrolPeriod as number,
        } : {}),
      };
    })
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
      ...(typeof object.revealAfterMirrorId === "string" ? { revealAfterMirrorId: object.revealAfterMirrorId } : {}),
    }))
    .sort((a, b) => a.x - b.x);
}

function makeKeys(stage: GameStage): KeyItem[] {
  return fromStage(stage,"key").map((item,index)=>({
    id:typeof item.id==="string"?item.id:"key:"+index,
    x:item.position as number,collected:false
  })).sort((a,b)=>a.x-b.x);
}
function makeChests(stage: GameStage): Chest[] {
  return fromStage(stage,"chest").map((item,index)=>{
    const id=typeof item.id==="string"?item.id:"chest:"+index;
    return {id,x:item.position as number,keyId:item.keyId as string,
      opened:false,rewardId:"chest-reward:"+id};
  }).sort((a,b)=>a.x-b.x);
}
function makePortals(stage: GameStage): Portal[] {
  return fromStage(stage,"portal").map((item,index)=>({
    id:typeof item.id==="string"?item.id:"portal:"+index,
    x:item.position as number,targetX:item.targetPosition as number,used:false
  })).sort((a,b)=>a.x-b.x);
}
function makeMirrors(stage: GameStage): Mirror[] {
  return fromStage(stage, "mirror").map((item, index) => ({
    id: typeof item.id === "string" ? item.id : "mirror:" + index,
    x: item.position as number,
    fromDirection: item.fromDirection === "left" ? -1 as const : 1 as const,
    used: false,
  })).sort((a, b) => a.x - b.x);
}
function makeDoors(stage: GameStage): Door[] {
  return fromStage(stage, "door")
    .map((object) => ({ id: object.id as string, x: object.position as number, open: false, broken: false, vaulted: false, breakable: object.breakable === true, vaultable: object.vaultable === true, autoCloseTicks: typeof object.autoCloseTicks === "number" ? object.autoCloseTicks : 0, openedUntilTick: null, passed: false, sequenceLength: 0, nextSequenceStep: 1 }))
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
      sequenceStep: Number.isSafeInteger(object.sequenceStep) ? object.sequenceStep as number : null,
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

function makeWinds(stage: GameStage): WindZone[] {
  return fromStage(stage, "wind").map((item, index) => ({
    id: typeof item.id === "string" ? item.id : "wind:" + index,
    x: item.position as number,
    w: typeof item.width === "number" ? item.width : 180,
    multiplier: typeof item.multiplier === "number" ? item.multiplier : 1.2,
  })).sort((a,b)=>a.x-b.x);
}

function makePressurePlates(stage: GameStage): PressurePlate[] {
  return fromStage(stage, "pressurePlate").map((item, index) => ({
    id: typeof item.id === "string" ? item.id : "pressurePlate:" + index,
    x: item.position as number,
    w: item.width as number,
    holdTicks: item.holdTicks as number,
    targetDoorId: item.targetDoorId as string,
    heldTicks: 0,
    activated: false,
  })).sort((a,b)=>a.x-b.x);
}
export function movingPlatformX(platform: Pick<MovingPlatform,"originX"|"travel"|"period">, tick: number): number {
  const phase = (tick % platform.period) / platform.period;
  return platform.originX + platform.travel * (phase <= 0.5 ? phase * 2 : 2 - phase * 2);
}
function makeMovingPlatforms(stage: GameStage): MovingPlatform[] {
  return fromStage(stage,"movingPlatform").map((item,index)=>({
    id: typeof item.id === "string" ? item.id : "movingPlatform:" + index,
    x:item.position as number,originX:item.position as number,
    w:item.width as number,travel:item.travel as number,period:item.period as number
  })).sort((a,b)=>a.x-b.x);
}
export function verticalPlatformY(platform: Pick<VerticalPlatform,"originY"|"travelY"|"period"|"phaseOffset">, tick: number): number {
  const phase = ((tick + platform.phaseOffset) % platform.period) / platform.period;
  return platform.originY - platform.travelY * (phase <= 0.5 ? phase * 2 : 2 - phase * 2);
}
function makeVerticalPlatforms(stage: GameStage): VerticalPlatform[] {
  return fromStage(stage,"verticalPlatform").map((item,index)=>({
    id:typeof item.id==="string"?item.id:"verticalPlatform:"+index,
    x:item.position as number,w:item.width as number,
    y:typeof item.topY==="number"?item.topY:GAME.groundY-GAME.epsilon,
    originY:typeof item.topY==="number"?item.topY:GAME.groundY-GAME.epsilon,
    travelY:item.travelY as number,period:item.period as number,
    phaseOffset:typeof item.phaseOffset==="number"?item.phaseOffset:0,
  })).sort((a,b)=>a.x-b.x);
}
function makeLasers(stage: GameStage): Laser[] {
  return fromStage(stage,"laser").map((item,index)=>({
    id:typeof item.id==="string"?item.id:"laser:"+index,
    x:item.position as number, period:item.period as number,
    activeTicks:item.activeTicks as number,
    phaseOffset:typeof item.phaseOffset==="number"?item.phaseOffset:0,
    passed:false,
  })).sort((a,b)=>a.x-b.x);
}
export function isLaserActive(laser: Pick<Laser,"period"|"activeTicks"|"phaseOffset">,tick:number): boolean {
  return (tick+laser.phaseOffset)%laser.period < laser.activeTicks;
}
function makeBridges(stage: GameStage): Bridge[] {
  return fromStage(stage,"bridge").map((item,index)=>({
    id: typeof item.id==="string" ? item.id : "bridge:"+index,
    x: item.position as number,w:item.width as number,
    targetDoorId: item.targetDoorId as string,
  })).sort((a,b)=>a.x-b.x);
}
export function isBridgeOpen(bridge: Pick<Bridge,"targetDoorId">, doors: readonly Door[]): boolean {
  return doors.some(door=>door.id===bridge.targetDoorId && door.open);
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
  const chests = makeChests(stage);
  const keys = makeKeys(stage);
  const portals = makePortals(stage);
  const mirrors = makeMirrors(stage);
  // Opening a chest yields exactly one coin-equivalent reward. The existing
  // score and Worker replay validation remain authoritative for its value.
  const coins = [...makeCoins(stage), ...chests.map(chest=>({
    id:chest.rewardId,x:chest.x,collected:false,chestId:chest.id
  }))].sort((a,b)=>a.x-b.x);
  const doors = makeDoors(stage);
  const switches = makeSwitches(stage);
  for (const door of doors) door.sequenceLength = switches.filter(item => item.targetDoorId === door.id && item.sequenceStep !== null).length;
  const conveyors = makeConveyors(stage);
  const winds = makeWinds(stage);
  const pressurePlates = makePressurePlates(stage);
  const movingPlatforms = makeMovingPlatforms(stage);
  const verticalPlatforms = makeVerticalPlatforms(stage);
  const lasers = makeLasers(stage);
  const bridges = makeBridges(stage);
  const fragileFloors = makeFragileFloors(stage);
  const goal = fromStage(stage, "goal").map((item) => item.position as number).sort((a, b) => a - b).at(-1);
  const lastObstacle = Math.max(0, ...walls.map((o) => o.x), ...ghosts.map((o) => o.x), ...holes.map((o) => o.x), ...coins.map((o) => o.x), ...keys.map((o) => o.x), ...chests.map((o) => o.x), ...portals.map((o) => o.targetX), ...mirrors.map((o) => o.x), ...doors.map((o) => o.x), ...switches.map((o) => o.x), ...conveyors.map((o) => o.x + o.w), ...winds.map((o) => o.x + o.w), ...pressurePlates.map((o) => o.x + o.w), ...movingPlatforms.map((o) => o.originX + o.travel + o.w), ...verticalPlatforms.map((o) => o.x + o.w), ...lasers.map((o) => o.x), ...bridges.map((o) => o.x + o.w), ...fragileFloors.map((o) => o.x + o.w));
  const goalX = Math.max(
    isFiniteNumber(goal) ? goal : isFiniteNumber(stage.goal) ? stage.goal : GAME.defaultGoal,
    lastObstacle + GAME.approachBase + 160,
  );
  const specifiedGoals = fromStage(stage, "goal").sort((a, b) => (a.position as number) - (b.position as number));
  const goals: GoalChoice[] = specifiedGoals.length === 2
    ? specifiedGoals.map((item, index) => ({ id: item.id as string, x: item.position as number,
      bonusBp: item.bonusBp as number, isFinal: index === 1, skipped: false, reached: false }))
    : [{ id: specifiedGoals[0]?.id as string || "goal-default", x: goalX, bonusBp: 10000,
      isFinal: true, skipped: false, reached: false }];
  return {
    status: "running",
    elapsedTicks: 0,
    px: GAME.playerScreenX,
    py: GAME.groundY - GAME.epsilon,
    vy: 0,
    vx: isFiniteNumber(stage.scrollSpeed) && stage.scrollSpeed > 0 ? stage.scrollSpeed : 3,
    direction: 1,
    baseSpeed: isFiniteNumber(stage.scrollSpeed) && stage.scrollSpeed > 0 ? stage.scrollSpeed : 3,
    jumpSensorProfile: stage.jumpSensorProfile === "centered-holes" ? "centered-holes" : "legacy",
    crouchUntilTick: -1,
    jumpReadyTick: 0,
    powerJumpActive: false,
    walls,
    ghosts,
    holes,
    coins,
    keys,
    chests,
    portals,
    mirrors,
    goals,
    goalBonusBp: 10000,
    selectedGoalId: null,
    doors,
    switches,
    conveyors,
    winds,
    pressurePlates,
    movingPlatforms,
    verticalPlatforms,
    boardingPlatformId: null,
    standingPlatformId: null,
    lasers,
    bridges,
    fragileFloors,
    requiredCoins: Number.isSafeInteger(stage.requiredCoins) && stage.requiredCoins! > 0 ? stage.requiredCoins! : 0,
    requiredSkips: Number.isSafeInteger(stage.requiredSkips) && stage.requiredSkips! > 0 ? stage.requiredSkips! : 0,
    optionalObjectives: stage.optionalObjectives === true,
    secretDoorRiskBp: typeof stage.secretDoorRiskBp === "number" ? stage.secretDoorRiskBp : 10000,
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

export function isCoinRevealed(game: GameState, coin: Coin): boolean {
  return !coin.revealAfterMirrorId || game.mirrors.some(mirror => mirror.id === coin.revealAfterMirrorId && mirror.used);
}
function directionalCoinInRange(game: GameState, coin: Coin): boolean {
  return game.direction === 1
    ? coin.x + GAME.pad >= game.px && coin.x - game.px <= GAME.coinPickupRange
    : coin.x <= game.px + GAME.playerWidth && game.px - coin.x <= GAME.coinPickupRange;
}
export function aimedJumpRange(speed: number, targetWidth: number, powered = false): number {
  const velocity = powered ? GAME.powerJumpVelocity : GAME.jumpVelocity;
  const ticksToPeak = Math.floor(-velocity / GAME.gravity);
  return Math.max(0, GAME.playerWidth / 2 + speed * ticksToPeak - targetWidth / 2);
}

function sensedTargets(game: GameState, conditions: readonly GameCondition[], action?: GameAction): { id: string; x: number }[] {
  const range = GAME.approachBase + game.vx * GAME.reactionFrames;
  const found = new Map<string, { id: string; x: number }>();
  for (const condition of conditions) {
    if (condition === "mirror") {
      const target = game.mirrors.find(mirror =>
        !mirror.used && mirror.fromDirection === game.direction &&
        (game.direction === 1
          ? mirror.x + GAME.pad >= game.px && mirror.x - game.px <= GAME.switchPressRange
          : mirror.x <= game.px + GAME.playerWidth && game.px - mirror.x <= GAME.switchPressRange)
      );
      if (target) found.set(target.id, target);
      continue;
    }
    if (game.direction === -1 && condition !== "coin") continue;
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
    if (condition === "goal") {
      const target = nextTarget(game.goals.filter((goal) => !goal.isFinal && !goal.skipped && !goal.reached), game.px);
      if (target && target.x - game.px <= GAME.switchPressRange) found.set(target.id, target);
      continue;
    }
    if (condition === "door") {
      const target = nextTarget(game.doors.filter((door) => !door.open && !door.vaulted), game.px);
      if (target && target.x - game.px <= range) found.set(target.id, target);
      continue;
    }
    if (condition === "pressurePlate") {
      const target = nextTarget(game.pressurePlates.filter(item=>!item.activated),game.px);
      if (target && target.x - game.px <= range) found.set(target.id,target);
      continue;
    }
    if (condition === "bridge") {
      const target=nextTarget(game.bridges,game.px);
      if(target && target.x-game.px<=range) found.set(target.id,target);
      continue;
    }
    if (condition === "laser") {
      const target=nextTarget(game.lasers.filter(x=>!x.passed),game.px);
      if(target && target.x-game.px<=range) found.set(target.id,target);
      continue;
    }
    if (condition === "verticalPlatform") {
      const target = nextTarget(game.verticalPlatforms,game.px);
      if (target && target.x - game.px <= range) found.set(target.id,target);
      continue;
    }
    if (condition === "movingPlatform") {
      const target = nextTarget(game.movingPlatforms,game.px);
      if (target && target.x - game.px <= range) found.set(target.id,target);
      continue;
    }
    if (condition === "wind") {
      const target = nextTarget(game.winds, game.px);
      if (target && target.x - game.px <= range) found.set(target.id, target);
      continue;
    }
    if (condition === "conveyor" || condition === "fragileFloor") {
      const target = nextTarget(condition === "conveyor" ? game.conveyors : game.fragileFloors, game.px);
      if (target && target.x - game.px <= range) found.set(target.id, target);
      continue;
    }
    if (condition === "portal") {
      const target=nextTarget(game.portals.filter(item=>!item.used),game.px);
      if(target && target.x-game.px<=GAME.switchPressRange) found.set(target.id,target);
      continue;
    }
    if (condition === "key") {
      const target=nextTarget(game.keys.filter(item=>!item.collected),game.px);
      if(target && target.x-game.px<=GAME.coinPickupRange) found.set(target.id,target);
      continue;
    }
    if (condition === "chest") {
      const target=nextTarget(game.chests.filter(item=>!item.opened),game.px);
      if(target && target.x-game.px<=GAME.coinPickupRange) found.set(target.id,target);
      continue;
    }
    if (condition === "coin") {
      const target = game.coins.filter(coin => !coin.collected && !coin.chestId &&
        isCoinRevealed(game, coin) && directionalCoinInRange(game, coin))
        .sort((a, b) => game.direction === 1 ? a.x - b.x : b.x - a.x)[0];
      if (target) found.set(target.id, target);
      continue;
    }
    const groups = condition === "ahead" ? [game.walls, game.ghosts, game.holes, game.doors.filter((door) => !door.open)]
      : condition === "wall" ? [game.walls]
      : condition === "enemy" ? [game.ghosts] : [game.holes];
    for (const objects of groups) {
      const target = nextTarget(objects, game.px);
      const holeWidth = objects === game.holes
        ? game.holes.find(hole => hole.id === target?.id)?.w ?? GAME.defaultHoleWidth
        : GAME.wallWidth;
      const jumping = action === "jump" || action === "powerJump";
      const triggerRange = jumping && (objects === game.walls || (objects === game.holes && game.jumpSensorProfile === "centered-holes"))
        ? aimedJumpRange(game.vx, holeWidth, action === "powerJump")
        : game.jumpSensorProfile === "centered-holes" && objects === game.holes
          ? Math.max(0, range - Math.max(0, (holeWidth - GAME.wallWidth) / 2))
          : range;
      if (target && target.x - game.px <= triggerRange) found.set(target.id, target);
    }
  }
  return [...found.values()].sort((a, b) =>
    game.direction * (a.x - b.x) || a.id.localeCompare(b.id));
}

function issueCrouch(game: GameState) {
  game.crouchUntilTick = Math.max(game.crouchUntilTick, game.elapsedTicks + GAME.crouchDurationTicks);
}

function issueJump(game: GameState, velocity: number = GAME.jumpVelocity): boolean {
  if (game.elapsedTicks < game.jumpReadyTick || game.vy !== 0 ||
    (Math.abs(game.py - (GAME.groundY - GAME.epsilon)) > 0.1 && game.standingPlatformId === null)) return false;
  game.standingPlatformId = null;
  game.vy = velocity;
  game.powerJumpActive = velocity === GAME.powerJumpVelocity;
  game.jumpReadyTick = game.elapsedTicks + GAME.jumpCooldownTicks;
  return true;
}

function acceptAction(game: GameState, action: GameAction, sensedTargetId?: string): boolean {
  if (action === "reflect") {
    const target = game.mirrors.find(mirror =>
      !mirror.used && mirror.fromDirection === game.direction &&
      (sensedTargetId === undefined || mirror.id === sensedTargetId) &&
      (game.direction === 1
        ? mirror.x + GAME.pad >= game.px && mirror.x - game.px <= GAME.switchPressRange
        : mirror.x <= game.px + GAME.playerWidth && game.px - mirror.x <= GAME.switchPressRange)
    );
    if (!target) return false;
    target.used = true;
    game.direction = game.direction === 1 ? -1 : 1;
    return true;
  }
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
  if (action === "ridePlatform") {
    const target = game.verticalPlatforms.find(item=>(sensedTargetId===undefined||item.id===sensedTargetId) &&
      item.x+item.w>=game.px && item.x-game.px<=GAME.approachBase+game.vx*GAME.reactionFrames);
    if (!target) return false;
    game.boardingPlatformId=target.id;
    return true;
  }
  if (action === "jump") return issueJump(game);
  if (action === "powerJump") return issueJump(game, GAME.powerJumpVelocity);
  if (action === "crouch") {
    issueCrouch(game);
    return true;
  }
  if (action === "skip" && sensedTargetId !== undefined) {
    const goal = game.goals.find((item) => item.id === sensedTargetId && !item.isFinal && !item.skipped &&
      item.x + GAME.pad >= game.px && item.x - game.px <= GAME.switchPressRange);
    if (goal) { goal.skipped = true; return true; }
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
    if (door.sequenceLength > 0) {
      if (target.sequenceStep !== door.nextSequenceStep) {
        fail(game, "trap");
        return true;
      }
      target.activated = true;
      door.nextSequenceStep++;
      if (door.nextSequenceStep <= door.sequenceLength) return true;
    } else {
      target.activated = true;
    }
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
  if (action === "enterPortal") {
    const portal=game.portals.find(item=>!item.used &&
      (sensedTargetId===undefined || item.id===sensedTargetId) &&
      item.x+GAME.pad>=game.px && item.x-game.px<=GAME.switchPressRange);
    if(!portal) return false;
    portal.used=true;
    // Bypassed hazards must not collide from behind immediately after a warp.
    // They are intentionally *not* credited as skipped switches or coins.
    for(const door of game.doors) if(door.x+GAME.doorWidth<portal.targetX) door.passed=true;
    for(const wall of game.walls) if(wall.x+GAME.wallWidth<portal.targetX) wall.cleared=true;
    for(const ghost of game.ghosts) if(ghost.x+GAME.ghostWidth<portal.targetX) ghost.cleared=true;
    for(const laser of game.lasers) if(laser.x<portal.targetX) laser.passed=true;
    game.px=portal.targetX;
    // Travel consumes the usual single simulation tick and does not reset
    // watcher state, elapsed time or previously collected bonus objectives.
    return true;
  }
  if (action === "openChest") {
    const target=game.chests.find(chest=>!chest.opened &&
      (sensedTargetId===undefined || chest.id===sensedTargetId) &&
      chest.x+GAME.pad>=game.px && chest.x-game.px<=GAME.coinPickupRange &&
      game.keys.some(key=>key.id===chest.keyId && key.collected));
    if(!target) return false;
    target.opened=true;
    const reward=game.coins.find(coin=>coin.id===target.rewardId);
    if(reward) reward.collected=true;
    return true;
  }
  if (action === "collect") {
    const key=game.keys.find(item=>!item.collected &&
      (sensedTargetId===undefined || item.id===sensedTargetId) &&
      item.x+GAME.pad>=game.px && item.x-game.px<=GAME.coinPickupRange);
    if(key){key.collected=true;return true;}
    const target = game.coins.find((coin) =>
      !coin.collected && !coin.chestId && isCoinRevealed(game, coin) &&
      (sensedTargetId === undefined || coin.id === sensedTargetId) && directionalCoinInRange(game, coin)
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
    const sensed = conditions.length ? sensedTargets(game, conditions, rule.action) : [];
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
    const target = sensedTargets(game, op.conds, op.action).find((item) => !game.sequenceConsumed.has(item.id));
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
  const unsafe=game.holes.some((hole)=>x>=hole.x && x<=hole.x+hole.w) ||
    game.fragileFloors.some((floor)=>floor.collapsed && x>=floor.x && x<=floor.x+floor.w);
  if(!unsafe) return false;
  const supported=game.py<=GAME.groundY-GAME.epsilon+8 &&
    (game.movingPlatforms.some(platform=>x>=platform.x && x<=platform.x+platform.w) ||
      game.bridges.some(bridge=>isBridgeOpen(bridge,game.doors) && x>=bridge.x && x<=bridge.x+bridge.w) ||
      game.verticalPlatforms.some(platform=>game.standingPlatformId===platform.id && x>=platform.x && x<=platform.x+platform.w));
  return !supported;
}

function fail(game: GameState, reason: GameFailReason) {
  game.status = "failed";
  game.failureReason = reason;
}

/** Ghost patrol positions are derived only from elapsed simulation ticks, not frame time. */
export function patrolGhostX(ghost: Barrier, tick: number): number {
  if (ghost.originX === undefined || ghost.patrolRange === undefined || ghost.patrolPeriod === undefined) return ghost.x;
  const phase = (tick % ghost.patrolPeriod) / ghost.patrolPeriod;
  const outbound = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
  return ghost.originX - ghost.patrolRange * outbound;
}

export function stepGame(game: GameState, observe?: TraceObserver): GameStatus {
  if (game.status !== "running") return game.status;
  for (const ghost of game.ghosts) {
    if (ghost.originX !== undefined) ghost.x = patrolGhostX(ghost, game.elapsedTicks);
  }
  applyProgram(game, observe);
  if (game.status !== "running") return game.status;
  applySequence(game, observe);
  if (game.status !== "running") return game.status;
  for(const platform of game.verticalPlatforms){
    const next=verticalPlatformY(platform,game.elapsedTicks+1);
    if(game.standingPlatformId===platform.id) game.py+=next-platform.y;
    platform.y=next;
  }
  for(const platform of game.movingPlatforms){
    const next=movingPlatformX(platform,game.elapsedTicks+1);
    const midpoint=game.px+GAME.playerWidth/2;
    const onPlatform=Math.abs(game.py-(GAME.groundY-GAME.epsilon))<0.1 &&
      midpoint>=platform.x && midpoint<=platform.x+platform.w &&
      game.holes.some(hole=>midpoint>=hole.x && midpoint<=hole.x+hole.w);
    if(onPlatform) game.px+=next-platform.x;
    platform.x=next;
  }
  const movingFloor = game.conveyors.find((floor) => game.px >= floor.x && game.px <= floor.x + floor.w &&
    Math.abs(game.py - (GAME.groundY - GAME.epsilon)) < 0.1);
  // Wind changes horizontal velocity only during airborne ticks.
  // Grounded movement and existing stages without wind stay bit-for-bit identical.
  const airborne = game.vy !== 0 || Math.abs(game.py - (GAME.groundY - GAME.epsilon)) > 0.1;
  const gust = airborne ? game.winds.find(zone => game.px >= zone.x && game.px <= zone.x + zone.w) : undefined;
  game.px += game.direction * game.vx * (movingFloor?.multiplier ?? 1) * (gust?.multiplier ?? 1);
  if(game.standingPlatformId!==null){
    const supporting=game.verticalPlatforms.find(platform=>platform.id===game.standingPlatformId &&
      game.px+GAME.playerWidth/2>=platform.x && game.px+GAME.playerWidth/2<=platform.x+platform.w);
    if(!supporting) game.standingPlatformId=null;
  }
  if(game.standingPlatformId===null){
    game.vy += GAME.gravity;
    game.py += game.vy;
    const middle=game.px+GAME.playerWidth/2;
    const platform=game.verticalPlatforms.find(item=>item.id===game.boardingPlatformId && middle>=item.x && middle<=item.x+item.w &&
      game.vy>=0 && game.py>=item.y-3 && game.py<=item.y+Math.max(12,game.vy+6));
    if(platform){game.py=platform.y;game.vy=0;game.standingPlatformId=platform.id;game.powerJumpActive=false;}
  }
  const front = game.direction === 1 ? game.px + GAME.playerWidth : game.px;
  if (game.standingPlatformId===null && game.py > GAME.groundY - GAME.epsilon && !overHole(game, front)) {
    game.py = GAME.groundY - GAME.epsilon;
    game.vy = 0;
    game.powerJumpActive = false;
  }
  game.elapsedTicks += 1;
  for (const plate of game.pressurePlates) {
    if (plate.activated) continue;
    const center = game.px + GAME.playerWidth / 2;
    const grounded = Math.abs(game.py - (GAME.groundY - GAME.epsilon)) < 0.1;
    plate.heldTicks = grounded && center >= plate.x && center <= plate.x + plate.w ? plate.heldTicks + 1 : 0;
    if (plate.heldTicks < plate.holdTicks) continue;
    const gate = game.doors.find(door=>door.id===plate.targetDoorId);
    if (!gate) continue;
    plate.activated = true;
    gate.open = true;
    gate.openedUntilTick = gate.autoCloseTicks ? game.elapsedTicks + gate.autoCloseTicks : null;
  }
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
  if (game.direction === 1 && game.py < GAME.groundY - GAME.epsilon - 8) {
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
  const wall = game.direction === 1 ? game.walls.find((w) => !w.cleared && front >= w.x) : undefined;
  if (wall) {
    const playerHeight = isCrouching(game) ? GAME.crouchHeight : GAME.playerHeight;
    const top = game.py - playerHeight;
    if (top > GAME.groundY - GAME.wallHeight + 12) {
      fail(game, "wall");
      return game.status;
    }
    wall.cleared = true;
  }
  const door = game.direction === 1 ? game.doors.find((item) => !item.open && !item.vaulted && !item.passed && front >= item.x) : undefined;
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
  const laser=game.direction === 1 ? game.lasers.find(item=>!item.passed && front>=item.x) : undefined;
  if(laser){
    if(isLaserActive(laser,game.elapsedTicks) && !isCrouching(game)){
      fail(game,"laser");
      return game.status;
    }
    laser.passed=true;
  }
  const ghost = game.direction === 1 ? game.ghosts.find((g) => !g.cleared && front >= g.x) : undefined;
  if (ghost) {
    if (isCrouching(game)) ghost.cleared = true;
    else {
      fail(game, "enemy");
      return game.status;
    }
  }
  const reachedGoal = game.direction === 1 ? game.goals.find((item) => !item.skipped && !item.reached && game.px >= item.x) : undefined;
  if (reachedGoal) {
    if (!game.optionalObjectives && game.coins.filter((coin) => coin.collected).length < game.requiredCoins) fail(game, "coin");
    else if (!game.optionalObjectives && game.switches.filter((item) => item.skipped && item.trap).length < game.requiredSkips) fail(game, "skip");
    else {
      reachedGoal.reached = true;
      game.selectedGoalId = reachedGoal.id;
      game.goalBonusBp = reachedGoal.bonusBp;
      game.status = "cleared";
    }
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
