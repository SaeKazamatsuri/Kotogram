<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import GameCharacterSprite from "~/components/game/CharacterSprite.vue";
import { canPlayStage } from "~/stage/progression";
import { currentWorldStageId, worldMapPosition } from "~/stage/world-map";
import { playSe, unlockAudio } from "~/game/audio";

type Item = { id: string; title: string; file: string };

const router = useRouter();
const { getManifest } = useStageLoader();
const { getAll, reset } = useStats();
const loading = ref(true);
const error = ref<string | null>(null);
const stages = ref<Item[]>([]);
const stats = ref<Record<string, { seconds: number; chars: number }>>({});
const mapViewport = ref<HTMLElement | null>(null);
const mapDragging = ref(false);
type MapDragState = { pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean };
let mapDragState: MapDragState | null = null;
let blockMapClick = false;
const recentlyClearedId = ref<string | null>(null);
const clearedCount = computed(() => stages.value.filter((stage) => isComplete(stage.id)).length);
const currentStageId = computed(() => currentWorldStageId(stages.value, isComplete));
const allCleared = computed(() => stages.value.length > 0 && clearedCount.value === stages.value.length);

const trees = [
  { x: 26, y: 81 }, { x: 43, y: 76 }, { x: 54, y: 78 },
  { x: 74, y: 77 }, { x: 97, y: 79 },
];

function isComplete(id: string): boolean {
  return typeof stats.value[id]?.seconds === "number";
}

function stageUnlocked(id: string): boolean {
  return canPlayStage(id, stages.value, isComplete);
}

function onChooseStage() {
  unlockAudio();
  playSe("select");
}

function onReset() {
  if (typeof window !== "undefined" && !window.confirm("次の人のために、きろくを消してもいい？")) return;
  reset();
  stats.value = {};
  recentlyClearedId.value = null;
  try {
    window.sessionStorage.removeItem("kotogram.recentClear");
  } catch {
    recentlyClearedId.value = null;
  }
  void router.push("/");
}

function moveMap(direction: -1 | 1) {
  mapViewport.value?.scrollBy({ left: direction * 560, behavior: "smooth" });
}

function onMapPointerDown(event: PointerEvent) {
  const viewport = mapViewport.value;
  if (!viewport || !event.isPrimary || event.button !== 0) return;
  mapDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
    moved: false,
  };
}

function onMapPointerMove(event: PointerEvent) {
  const viewport = mapViewport.value;
  const drag = mapDragState;
  if (!viewport || !drag || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    mapDragging.value = true;
    viewport.setPointerCapture(event.pointerId);
  }
  viewport.scrollLeft = drag.scrollLeft - dx;
  viewport.scrollTop = drag.scrollTop - dy;
  event.preventDefault();
}

function onMapPointerEnd(event: PointerEvent) {
  const viewport = mapViewport.value;
  const drag = mapDragState;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.moved) {
    blockMapClick = true;
    requestAnimationFrame(() => { blockMapClick = false; });
  }
  if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  mapDragState = null;
  mapDragging.value = false;
}

function onMapClickCapture(event: MouseEvent) {
  if (!blockMapClick) return;
  event.preventDefault();
  event.stopPropagation();
  blockMapClick = false;
}

async function centerCurrentStage() {
  await nextTick();
  const viewport = mapViewport.value;
  const current = viewport?.querySelector<HTMLElement>(".map-stop.is-current");
  if (!viewport || !current) return;
  const mobile = window.matchMedia("(max-width: 639px)").matches;
  viewport.scrollTo({
    left: mobile ? 0 : Math.max(0, current.offsetLeft - viewport.clientWidth / 2 + current.clientWidth / 2),
    top: mobile ? Math.max(0, current.offsetTop - viewport.clientHeight / 2 + current.clientHeight / 2) : 0,
    behavior: "auto",
  });
}

async function loadStages() {
  loading.value = true;
  error.value = null;
  try {
    const manifest = await getManifest();
    stages.value = manifest.stages;
  } catch {
    stages.value = [];
    error.value = "ステージを読みこめませんでした";
  } finally {
    loading.value = false;
  }
}

watch([loading, currentStageId], () => {
  if (!loading.value && currentStageId.value && import.meta.client) void centerCurrentStage();
});

onMounted(() => {
  stats.value = getAll();
  try {
    const lastClear = window.sessionStorage.getItem("kotogram.recentClear");
    window.sessionStorage.removeItem("kotogram.recentClear");
    recentlyClearedId.value = lastClear && isComplete(lastClear) ? lastClear : null;
  } catch {
    recentlyClearedId.value = null;
  }
  void loadStages();
});
</script>

<template>
  <div class="scene-enter mx-auto max-w-[1520px] pb-8">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <NuxtLink to="/" class="game-button game-button--night text-sm">
        <Icon name="lucide:arrow-left" class="game-icon" aria-hidden="true" /> タイトルへ
      </NuxtLink>
      <span class="game-chip" aria-label="クリアしたステージ数">
        <Icon name="lucide:star" class="game-icon text-[#ffdc90]" aria-hidden="true" />
        {{ clearedCount }} / {{ stages.length }}
      </span>
    </div>
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="game-kicker mb-1">ことばで進む、ぼうけんの道</p>
        <h1 class="game-screen-title">ステージを えらぶ</h1>
      </div>
      <p v-if="allCleared" class="map-congratulations">
        <Icon name="lucide:trophy" class="game-icon" aria-hidden="true" /> 全ステージ クリア！
      </p>
    </div>

    <p v-if="loading" role="status" class="game-surface p-6">読みこみ中…</p>
    <div v-else-if="error" role="alert" class="game-panel flex flex-wrap items-center justify-between gap-4 p-5 text-[#a53148]">
      <p class="font-bold">{{ error }}</p>
      <button type="button" class="game-button game-button--night" @click="loadStages">もう一度 読みこむ</button>
    </div>
    <template v-else>
      <div
        ref="mapViewport"
        class="map-viewport scrollbar-hidden"
        :class="{ 'is-dragging': mapDragging }"
        role="region"
        aria-label="ステージマップ"
        tabindex="0"
        @pointerdown="onMapPointerDown"
        @pointermove="onMapPointerMove"
        @pointerup="onMapPointerEnd"
        @pointercancel="onMapPointerEnd"
        @click.capture="onMapClickCapture"
        @dragstart.prevent
      >
        <div class="map-land" :class="{ 'map-land--expanded': stages.length > 7 }">
          <div class="map-sun" aria-hidden="true" />
          <div class="map-cloud map-cloud--one" aria-hidden="true" />
          <div class="map-cloud map-cloud--two" aria-hidden="true" />
          <div class="map-mountain map-mountain--one" aria-hidden="true" />
          <div class="map-mountain map-mountain--two" aria-hidden="true" />
          <div class="map-mountain map-mountain--three" aria-hidden="true" />
          <div class="map-hill map-hill--far" aria-hidden="true" />
          <div class="map-hill map-hill--near" aria-hidden="true" />
          <div v-for="(tree, index) in trees" :key="index" class="map-tree" :style="{ left: tree.x + '%', top: tree.y + '%' }" aria-hidden="true" />
          <div class="map-castle" aria-hidden="true"><Icon name="lucide:castle" /></div>

          <svg class="map-trail map-trail--wide" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
            <path class="map-trail__edge" d="M 80 354 C 145 354 150 166 220 166 S 303 322 360 322 S 447 125 500 125 S 592 338 650 338 S 727 182 790 182 S 895 250 940 250 C 960 320 945 410 900 426" />
            <path class="map-trail__road" d="M 80 354 C 145 354 150 166 220 166 S 303 322 360 322 S 447 125 500 125 S 592 338 650 338 S 727 182 790 182 S 895 250 940 250" />
          </svg>
          <svg class="map-trail map-trail--tall" viewBox="0 0 380 1100" preserveAspectRatio="none" aria-hidden="true">
            <path class="map-trail__edge" d="M 103 99 C 185 99 190 242 274 242 S 190 385 110 385 S 185 528 270 528 S 185 671 106 671 S 187 770 270 770 S 265 880 190 880 S 190 1001 270 1001" />
            <path class="map-trail__road" d="M 103 99 C 185 99 190 242 274 242 S 190 385 110 385 S 185 528 270 528 S 185 671 106 671 S 187 814 270 814 S 265 957 190 957" />
          </svg>

          <ol class="map-stops" aria-label="ステージ一覧">
            <li
              v-for="(stage, index) in stages"
              :key="stage.id"
              class="map-stop"
              :class="{
                'is-current': currentStageId === stage.id,
                'is-cleared': isComplete(stage.id),
                'is-celebrating': recentlyClearedId === stage.id,
                'is-locked': !stageUnlocked(stage.id),
              }"
              :style="{
                '--stop-x': worldMapPosition(index).x + '%',
                '--stop-y': worldMapPosition(index).y + '%',
                '--stop-mobile-x': worldMapPosition(index).mobileX + '%',
                '--stop-mobile-y': worldMapPosition(index).mobileY + '%',
              }"
            >
              <div v-if="currentStageId === stage.id" class="map-hero" aria-hidden="true">
                <GameCharacterSprite />
              </div>
              <span v-if="isComplete(stage.id)" class="map-stop__flag" aria-hidden="true"><Icon name="lucide:flag-triangle-right" /></span>
              <NuxtLink
                v-if="stageUnlocked(stage.id)"
                class="map-stop__link"
                :to="`/play/${stage.id}`"
                :aria-label="`ステージ ${index + 1} ${stage.title}${isComplete(stage.id) ? ' クリア' : ' あそぶ'}`"
                @click="onChooseStage"
              >
                <span class="map-stop__circle">
                  <Icon v-if="isComplete(stage.id)" name="lucide:check" class="map-stop__icon" aria-hidden="true" />
                  <Icon v-else-if="currentStageId === stage.id" name="lucide:play" class="map-stop__icon" aria-hidden="true" />
                  <span v-else class="map-stop__number">{{ index + 1 }}</span>
                </span>
                <span class="map-stop__sign">
                  <span class="map-stop__stage">ステージ {{ index + 1 }}</span>
                  <span class="map-stop__title">{{ stage.title }}</span>
                </span>
              </NuxtLink>
              <div
                v-else
                class="map-stop__link map-stop__link--locked"
                aria-disabled="true"
                :aria-label="`ステージ ${index + 1} ${stage.title} まだあそべません`"
              >
                <span class="map-stop__circle"><Icon name="lucide:lock-keyhole" class="map-stop__icon" aria-hidden="true" /></span>
                <span class="map-stop__sign">
                  <span class="map-stop__stage">ステージ {{ index + 1 }}</span>
                  <span class="map-stop__title">{{ stage.title }}</span>
                </span>
              </div>
            </li>
          </ol>
        </div>
      </div>
      <div class="map-controls">
        <div class="map-legend" aria-label="ステージのしるし">
          <span><Icon name="lucide:play-circle" aria-hidden="true" /> つぎ</span>
          <span><Icon name="lucide:check-circle-2" aria-hidden="true" /> クリア</span>
          <span><Icon name="lucide:lock-keyhole" aria-hidden="true" /> まだ</span>
        </div>
        <div class="map-arrows">
          <button type="button" aria-label="マップを左へ" @click="moveMap(-1)">
            <Icon name="lucide:chevron-left" aria-hidden="true" />
          </button>
          <button type="button" aria-label="マップを右へ" @click="moveMap(1)">
            <Icon name="lucide:chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </template>
    <div class="mt-5 flex justify-start">
      <button type="button" class="game-button game-button--night text-sm" @click="onReset">
        <Icon name="lucide:refresh-cw" class="game-icon" aria-hidden="true" /> 次の人へ
      </button>
    </div>
  </div>
</template>

<style scoped>
.map-viewport {
  position: relative;
  overflow: auto hidden;
  border: 4px solid #718fa0;
  border-radius: 28px;
  background: #9ad6c7;
  box-shadow: 0 9px 0 #090f21, 0 18px 42px #050b1c77;
  scrollbar-width: none;
  isolation: isolate;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.map-viewport.is-dragging {
  cursor: grabbing;
}
.map-land {
  position: relative;
  width: 1640px;
  height: 560px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 11% 17%, #fff6d0 0 3%, transparent 18%),
    linear-gradient(110deg, #b6e9d9 0%, #b5e6d3 25%, #88c7b3 50%, #8abec6 75%, #7facc4 100%);
}
.map-land--expanded { height: 760px; }
.map-land::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  content: "";
  background:
    radial-gradient(ellipse at 10% 95%, #7cc49a 0 15%, transparent 15.3%),
    radial-gradient(ellipse at 28% 110%, #76b88c 0 22%, transparent 22.3%),
    radial-gradient(ellipse at 51% 96%, #4c9b86 0 20%, transparent 20.3%),
    radial-gradient(ellipse at 78% 105%, #5c999e 0 25%, transparent 25.3%),
    radial-gradient(ellipse at 96% 95%, #4d899c 0 21%, transparent 21.3%);
  opacity: .9;
}
.map-land::after {
  position: absolute;
  z-index: 0;
  inset: auto 0 0;
  height: 27px;
  content: "";
  background: repeating-linear-gradient(110deg, #376f64 0 17px, #538c72 17px 34px);
  border-top: 6px solid #a3d5a1;
}
.map-sun {
  position: absolute;
  left: 2%;
  top: 9%;
  width: 92px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #fff2b8;
  box-shadow: 0 0 0 21px #fff1ae48, 0 0 0 48px #fff1ae30;
}
.map-cloud {
  position: absolute;
  width: 130px;
  height: 33px;
  border-radius: 40px;
  background: #ffffffa6;
  box-shadow: 26px -18px 0 6px #ffffff9c, 67px -6px 0 -2px #ffffffb8;
}
.map-cloud--one { left: 22%; top: 11%; }
.map-cloud--two { left: 71%; top: 8%; transform: scale(.75); }
.map-mountain {
  position: absolute;
  z-index: 0;
  bottom: 25%;
  width: 320px;
  height: 280px;
  clip-path: polygon(0 100%, 48% 8%, 100% 100%);
  background: linear-gradient(120deg, #71979a 0 49%, #507c86 49% 100%);
  opacity: .7;
}
.map-mountain--one { left: 25%; }
.map-mountain--two { left: 58%; transform: scale(1.45); bottom: 19%; background: linear-gradient(110deg, #799da0 0 49%, #597c89 49%); }
.map-mountain--three { left: 84%; transform: scale(.95); }
.map-hill {
  position: absolute;
  z-index: 1;
  height: 190px;
  width: 58%;
  border-radius: 50% 50% 0 0;
  bottom: -135px;
  background: #3e9984;
}
.map-hill--far { left: -9%; background: #74b890; transform: rotate(-5deg); }
.map-hill--near { left: 49%; background: #3b877c; transform: rotate(8deg); }
.map-tree {
  position: absolute;
  z-index: 1;
  width: 54px;
  height: 92px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.map-tree::before {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 78%;
  content: "";
  background: linear-gradient(110deg, #2d806c 50%, #1b675e 50%);
  clip-path: polygon(50% 0, 88% 45%, 70% 45%, 100% 100%, 0 100%, 30% 45%, 12% 45%);
  filter: drop-shadow(3px 5px 0 #1b544580);
}
.map-tree::after {
  position: absolute;
  top: 70%;
  left: 45%;
  width: 11%;
  height: 30%;
  content: "";
  background: #705942;
}
.map-castle {
  position: absolute;
  z-index: 1;
  right: 1%;
  top: 13%;
  display: grid;
  place-items: center;
  width: 125px;
  height: 125px;
  border-radius: 50%;
  color: #fff0d5;
  font-size: 98px;
  filter: drop-shadow(5px 7px 0 #213d5370);
}
.map-trail { position: absolute; z-index: 2; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.map-trail path { fill: none; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.map-trail__edge { stroke: #37675e; stroke-width: 36; }
.map-trail__road { stroke: #fae5ac; stroke-width: 25; stroke-dasharray: 3 0; }
.map-trail--tall { display: none; }
.map-stops { position: absolute; z-index: 3; inset: 0; margin: 0; padding: 0; list-style: none; }
.map-stop { position: absolute; left: var(--stop-x); top: var(--stop-y); width: 162px; transform: translate(-50%, -44px); text-align: center; }
.map-stop__link {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-direction: column;
  text-decoration: none;
  outline-offset: 8px;
  transition: transform .18s ease, filter .18s ease;
}
.map-stop__link:hover, .map-stop__link:focus-visible { transform: translateY(-6px); }
.map-stop__circle {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border: 6px solid #fef6da;
  border-radius: 50%;
  background: #ffd57a;
  color: #243852;
  box-shadow: 0 6px 0 #37515b, 0 9px 0 2px #243c4e59;
}
.map-stop__icon { width: 36px; height: 36px; stroke-width: 3; }
.map-stop__number { font-size: 34px; font-weight: 900; }
.map-stop__sign {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 1px;
  width: 176px;
  min-height: 61px;
  margin-top: 11px;
  padding: 7px 9px;
  border: 3px solid #405869;
  border-radius: 12px;
  background: #fff8e9;
  color: #1d3045;
  box-shadow: 0 5px 0 #2b4c4e8c;
}
.map-stop__stage { color: #48647a; font-size: 13px; font-weight: 900; line-height: 1.3; }
.map-stop__title { font-size: 15px; font-weight: 900; line-height: 1.35; overflow-wrap: anywhere; }
.map-stop.is-current { z-index: 5; }
.map-stop.is-current .map-stop__circle {
  background: #93f1c7;
  box-shadow: 0 0 0 8px #fff4ca9c, 0 7px 0 #37515b, 0 0 32px #fff4b8;
  animation: map-breathe 2.6s ease-in-out infinite;
}
.map-stop.is-cleared .map-stop__circle { background: #8ce9be; color: #164f44; }
.map-stop__flag { position: absolute; z-index: 3; right: 13px; top: -20px; color: #ffedbd; font-size: 30px; filter: drop-shadow(2px 3px 0 #37515b); pointer-events: none; }
.map-stop.is-celebrating .map-stop__circle { animation: map-level-up .8s ease-out 2; }
.map-stop.is-celebrating::before { position: absolute; z-index: -1; left: 30%; top: -30px; width: 70px; height: 70px; border-radius: 50%; content: ""; box-shadow: -45px -8px 0 -31px #fff3b5, 53px 13px 0 -29px #ffd67b, -16px -30px 0 -28px #fff3b5, 30px -27px 0 -29px #fff3b5; animation: map-sparkle 1.2s ease-out both; pointer-events: none; }
.map-stop.is-locked .map-stop__circle { background: #60748a; color: #fff8eb; border-color: #b9c1c4; box-shadow: 0 6px 0 #334559; }
.map-stop.is-locked .map-stop__sign { background: #e1e4dc; color: #4b5a61; border-color: #798994; }
.map-stop.is-locked .map-stop__stage { color: #4b5a61; }
.map-stop__link--locked { cursor: not-allowed; }
.map-hero {
  position: absolute;
  z-index: 2;
  left: 0;
  top: -38px;
  width: 52px;
  height: 71px;
  transform: rotate(-11deg);
  filter: drop-shadow(3px 5px 0 #20384b6b);
  pointer-events: none;
  animation: map-hop 2s ease-in-out infinite;
}
.map-controls { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 15px; }
.map-legend { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; color: #f7f5e8; font-size: 14px; font-weight: 800; }
.map-legend span { display: inline-flex; align-items: center; gap: 4px; }
.map-legend svg { width: 18px; height: 18px; }
.map-arrows { display: flex; align-items: center; gap: 10px; }
.map-arrows button { display: grid; place-items: center; width: 48px; height: 45px; border: 2px solid #8fa6ad; border-radius: 14px; background: #354e63; color: #fff8e5; font-size: 25px; }
.map-arrows button:hover { background: #476d7f; }
.map-congratulations { display: inline-flex; align-items: center; gap: 8px; color: #ffdc90; font-size: 18px; font-weight: 900; }
@keyframes map-level-up { 0% { transform: scale(.75); } 40% { transform: scale(1.22); } 100% { transform: scale(1); } }
@keyframes map-sparkle { from { transform: scale(.3); opacity: 0; } 30% { opacity: 1; } to { transform: scale(1.3); opacity: 0; } }
@keyframes map-breathe { 50% { box-shadow: 0 0 0 13px #fff4ca57, 0 7px 0 #37515b, 0 0 38px #fff4b8; } }
@keyframes map-hop { 50% { transform: translateY(-9px) rotate(-6deg); } }
@media (max-width: 639px) {
  .map-viewport { overflow: hidden auto; max-height: min(69vh, 700px); border-radius: 22px; }
  .map-land { width: 100%; min-width: 300px; height: 1100px; background: linear-gradient(180deg, #b6e9d9 0%, #9ccfba 37%, #8ac1b1 60%, #81aebe 100%); }
  .map-land--expanded { height: 1400px; }
  .map-land::before { background: radial-gradient(ellipse at 35% 18%, #83c39b 0 13%, transparent 14%), radial-gradient(ellipse at 70% 53%, #57a48f 0 20%, transparent 21%), radial-gradient(ellipse at 30% 86%, #528f99 0 18%, transparent 19%); }
  .map-sun { left: 8%; top: 2%; width: 52px; }
  .map-cloud--one { left: 18%; top: 31%; transform: scale(.55); }
  .map-cloud--two { left: 32%; top: 70%; transform: scale(.55); }
  .map-mountain { width: 160px; height: 200px; left: 0; bottom: 23%; opacity: .35; }
  .map-mountain--two { left: 45%; bottom: 7%; transform: none; }
  .map-mountain--three { left: 57%; bottom: 51%; transform: none; }
  .map-hill { width: 100%; height: 170px; }
  .map-hill--near { left: 45%; }
  .map-tree { width: 35px; height: 65px; opacity: .8; }
  .map-castle { top: 84%; right: 3%; width: 78px; height: 78px; font-size: 62px; }
  .map-trail--wide { display: none; }
  .map-trail--tall { display: block; }
  .map-trail__edge { stroke-width: 31; }
  .map-trail__road { stroke-width: 22; }
  .map-stop { left: var(--stop-mobile-x); top: var(--stop-mobile-y); width: 130px; transform: translate(-50%, -31px); }
  .map-stop__circle { width: 64px; height: 64px; border-width: 4px; }
  .map-stop__icon { width: 29px; height: 29px; }
  .map-stop__number { font-size: 26px; }
  .map-stop__sign { width: 133px; min-height: 56px; margin-top: 8px; padding: 5px; border-width: 2px; }
  .map-stop__stage { font-size: 11px; }
  .map-stop__title { font-size: 13px; }
  .map-hero { left: -5px; top: -44px; transform: scale(.8); }
  .map-arrows { display: none; }
  .map-legend { justify-content: center; width: 100%; font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .map-hero, .map-stop.is-current .map-stop__circle, .map-stop.is-celebrating .map-stop__circle, .map-stop.is-celebrating::before { animation: none; }
  .map-stop__link { transition: none; }
}
</style>
