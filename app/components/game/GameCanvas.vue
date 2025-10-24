<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import type { Rule } from "~/composables/useParser";
import type { FailPayload } from "~/types/game";

/** ================= スケーリング & 基本定数 ================= */
const SCALE = 2;
const S = (n: number) => Math.round(n * SCALE);
const EPS = S(4);
const PAD = S(2);
const PSCREEN_X = S(32);
const DEFAULT_HOLE_W = S(40);
const REACT_FRAMES = 14;

/** ================= 表示サイズ ================= */
const W = 720;
const H = 360;
const GROUND_H = S(40);
const GY = H - GROUND_H;

const PLAYER_W = S(22);
const PLAYER_H = S(28);
const CROUCH_H = S(18);

const WALL_W = S(14);
const WALL_H = S(40);

const GHOST_W = S(22);
const GHOST_H = S(40);
const GHOST_CLEAR = S(14);

const GOAL_W = S(16);
const GOAL_H = S(32);

const APPROACH_BASE = S(36);

/** ================= 型 & Props ================= */
type Stage = {
  goal: number;
  scrollSpeed?: number;
  walls?: number[];
  ghosts?: number[];
  holes?: (number | { x: number; w?: number })[];
  coins?: number[];
};
type WallObj = { x: number; cleared: boolean };
type GhostObj = { x: number; cleared: boolean };
type HoleObj = { x: number; w: number };

const props = defineProps<{
  stage: Stage;
  program?: Rule[];
  running?: boolean;
}>();
const emit = defineEmits<{ (e: "clear"): void; (e: "fail", payload: FailPayload): void }>();

/** ================= 可変状態 ================= */
const canvas = ref<HTMLCanvasElement | null>(null);
let raf = 0;

// 位置・速度
let px = PSCREEN_X,
  py = GY - EPS,
  vx = 0,
  vy = 0;

// ★ 滞空を増やす（前回より空中時間アップ）
let speed = 3.0,
  gravity = 0.46, // 0.48 → 0.46（滞空↑）
  jumpV = -12.2; // -11.8 → -12.2（頂点↑）

// ステージオブジェクト
let walls: WallObj[] = [];
let ghosts: GhostObj[] = [];
let holes: HoleObj[] = [];
let goalX = 800;

// アクション状態
let jumpReadyAt = 0,
  crouchUntil = 0;

/** ================= スプライト ================= */
const img: Record<string, HTMLImageElement | null> = {
  player: null,
  wall: null,
  ghost: null,
  goal: null,
};

function loadSprite(name: string, src: string) {
  return new Promise<void>((resolve) => {
    const i = new Image();
    i.src = src;
    i.onload = () => {
      img[name] = i;
      draw();
      resolve();
    };
    i.onerror = () => {
      img[name] = null;
      resolve();
    };
  });
}
async function loadSprites() {
  await Promise.all([
    loadSprite("player", "/sprites/player.png"),
    loadSprite("wall", "/sprites/wall.png"),
    loadSprite("ghost", "/sprites/ghost.png"),
    loadSprite("goal", "/sprites/goal.png"),
  ]);
}

/** ================= ステージ正規化 ================= */
function normalize() {
  const s = props.stage || { goal: 800 };
  goalX = s.goal ?? 800;
  speed = s.scrollSpeed ?? 3.0;

  walls = [...(s.walls ?? [])]
    .sort((a, b) => a - b)
    .map((x) => ({ x, cleared: false }));

  ghosts = [...(s.ghosts ?? [])]
    .sort((a, b) => a - b)
    .map((x) => ({ x, cleared: false }));

  holes = (s.holes ?? [])
    .map((h) =>
      typeof h === "number"
        ? { x: h, w: DEFAULT_HOLE_W }
        : { x: h.x, w: h.w ?? DEFAULT_HOLE_W }
    )
    .sort((a, b) => a.x - b.x);
}
watch(
  () => props.stage,
  () => {
    normalize();
    reset();
    draw();
  },
  { immediate: true, deep: true }
);
watch(
  () => props.program,
  () => {
    reset();
    draw();
  },
  { deep: true }
);

function reset() {
  px = PSCREEN_X;
  py = GY - EPS;
  vx = speed;
  vy = 0;
  jumpReadyAt = 0;
  crouchUntil = 0;

  // クリア状態をリセット
  for (const w of walls) w.cleared = false;
  for (const g of ghosts) g.cleared = false;
}

/** ================= 座標変換 ================= */
function worldToScreenX(wx: number) {
  return wx - (px - PSCREEN_X);
}

/** ================= ユーティリティ ================= */
function isOverHole(x: number) {
  return !!holes.find((h) => x >= h.x && x <= h.x + h.w);
}
function nextDistObj<T extends { x: number }>(arr: T[]) {
  const v = arr.find((o) => o.x + PAD >= px);
  return (v?.x ?? Infinity) - px;
}

/** ================= センサー ================= */
function sense() {
  const look = APPROACH_BASE + vx * REACT_FRAMES;
  const nextHoleX = holes.find((h) => h.x + PAD >= px)?.x ?? Infinity;
  return {
    wall: nextDistObj(walls) <= look,
    enemy: nextDistObj(ghosts) <= look,
    hole: nextHoleX - px <= look,
    coin: false,
  };
}

/** ================= プログラム適用 ================= */
function applyProgram() {
  const prog = props.program ?? [];
  const now = performance.now();
  const s = sense();

  for (const r of prog) {
    if (r.cond && !s[r.cond as keyof typeof s]) continue;

    if (r.action === "jump") {
      if (now >= jumpReadyAt && Math.abs(py - (GY - EPS)) < 0.1) {
        vy = jumpV;
        jumpReadyAt = now + 520;
        return;
      }
    } else if (r.action === "crouch") {
      crouchUntil = Math.max(crouchUntil, now + 420);
      return;
    } else if (r.action === "collect") {
      return;
    }
  }
}

/** ================= 物理 ================= */
function physics() {
  px += vx;
  vy += gravity;
  py += vy;

  const now = performance.now();
  const playerFrontX = px + PLAYER_W;

  // 地面（穴の上では落下）
  if (py > GY - EPS && !isOverHole(playerFrontX)) {
    py = GY - EPS;
    vy = 0;
  }

  // 穴落ち
  if (isOverHole(playerFrontX) && py >= GY + PLAYER_H / 2) {
    stop();
    emit("fail", { reason: "hole" });
    return;
  }

  // 壁：初接触フレームのみ判定 → 成功なら cleared:true、失敗なら stop
  const w = walls.find((w) => !w.cleared && playerFrontX >= w.x);
  if (w) {
    const crouching = now <= crouchUntil;
    const playerHeight = crouching ? CROUCH_H : PLAYER_H;
    const playerTop = py - playerHeight;
    const wallTop = GY - WALL_H;
    const clearance = S(6);
    if (playerTop > wallTop + clearance) {
      stop();
      emit("fail", { reason: "wall" });
      return;
    }
    w.cleared = true;
  }

  // ゴースト：初接触のみ判定
  const g = ghosts.find((g) => !g.cleared && playerFrontX >= g.x);
  if (g) {
    if (now <= crouchUntil) g.cleared = true;
    else {
      stop();
      emit("fail", { reason: "enemy" });
      return;
    }
  }

  // ★ 画面外に出たものを削除（自然なデスポーン）
  walls = walls.filter((w) => worldToScreenX(w.x) > -WALL_W);
  ghosts = ghosts.filter((g) => worldToScreenX(g.x) > -GHOST_W);
  holes = holes.filter((h) => worldToScreenX(h.x + h.w) > 0); // 穴の右端が画面外左に出たら消す

  // ゴール
  if (px >= goalX) {
    stop();
    emit("clear");
    return;
  }
}

/** ================= 描画 ================= */
function draw() {
  const cvs = canvas.value;
  if (!cvs) return;
  const ctx = cvs.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  // 背景
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#dbeafe");
  grad.addColorStop(1, "#fef3c7");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 地面
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, GY, W, GROUND_H);

  // 穴（画面と交差部分のみクリア）
  for (const h of holes) {
    const sx = worldToScreenX(h.x);
    if (sx >= W || sx + h.w <= 0) continue;
    let vx_ = sx,
      vw_ = h.w;
    if (vx_ < 0) {
      vw_ += vx_;
      vx_ = 0;
    }
    if (vx_ + vw_ > W) vw_ = W - vx_;
    if (vw_ > 0)
      (ctx as CanvasRenderingContext2D).clearRect(vx_, GY, vw_, GROUND_H);
  }

  // 壁
  for (const w of walls) {
    const sx = worldToScreenX(w.x);
    if (sx < -WALL_W || sx > W + WALL_W) continue;
    if (img.wall) ctx.drawImage(img.wall, sx, GY - WALL_H, WALL_W, WALL_H);
    else {
      ctx.fillStyle = "#9ca3af";
      ctx.fillRect(sx, GY - WALL_H, WALL_W, WALL_H);
    }
  }

  // ゴースト
  for (const g of ghosts) {
    const sx = worldToScreenX(g.x);
    if (sx < -GHOST_W || sx > W + GHOST_W) continue;
    const gy = GY - (GHOST_H + GHOST_CLEAR);
    if (img.ghost) ctx.drawImage(img.ghost, sx, gy, GHOST_W, GHOST_H);
    else {
      ctx.fillStyle = "#a78bfa";
      ctx.fillRect(sx, gy, GHOST_W, GHOST_H);
    }
  }

  // プレイヤー
  const now = performance.now();
  const crouch = now <= crouchUntil;
  const ph = crouch ? CROUCH_H : PLAYER_H;
  if (img.player) ctx.drawImage(img.player, PSCREEN_X, py - ph, PLAYER_W, ph);
  else {
    ctx.fillStyle = "#111827";
    ctx.fillRect(PSCREEN_X, py - ph, PLAYER_W, ph);
  }

  // ゴール
  const gx = worldToScreenX(goalX);
  if (gx < W && gx + GOAL_W > 0) {
    if (img.goal) ctx.drawImage(img.goal, gx, GY - GOAL_H, GOAL_W, GOAL_H);
    else {
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(gx, GY - GOAL_H, GOAL_W, GOAL_H);
    }
  }
}

/** ================= ループ/制御 ================= */
function loop() {
  applyProgram();
  physics();
  draw();
  raf = requestAnimationFrame(loop);
}
function start() {
  cancelAnimationFrame(raf);
  normalize();
  reset();
  raf = requestAnimationFrame(loop);
}
function stop() {
  cancelAnimationFrame(raf);
}

/** ================= ライフサイクル ================= */
watch(
  () => props.running,
  (run) => {
    run ? start() : (stop(), draw());
  },
  { immediate: true }
);

onMounted(async () => {
  if (canvas.value) {
    const dpr = window.devicePixelRatio || 1;
    canvas.value.width = W * dpr;
    canvas.value.height = H * dpr;
    const ctx = canvas.value.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  await loadSprites();
  draw();
});
onBeforeUnmount(() => stop());
</script>

<template>
  <div class="flex flex-col gap-3">
    <canvas
      ref="canvas"
      class="w-full rounded-2xl border border-gray-200 bg-white"
    />
    <div class="text-sm text-gray-600">
      通過後は画面外で消去。滞空を強めに調整（gravity 0.46 / jumpV -12.2）。
    </div>
  </div>
</template>
