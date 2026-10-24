<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import GameCharacterSprite from "~/components/game/CharacterSprite.vue";
import { canPlayStage } from "~/stage/progression";
import { STAGE_WORLDS, currentWorldStageId, worldIndexForStage, worldMapPosition } from "~/stage/world-map";
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
const selectedWorld = ref(0);
const worldStages = computed(() => stages.value.slice(selectedWorld.value * 10, selectedWorld.value * 10 + 10));
const selectedWorldInfo = computed(() => STAGE_WORLDS[selectedWorld.value]!);
const worldClearCount = (index: number) => stages.value.slice(index * 10, index * 10 + 10).filter((stage) => isComplete(stage.id)).length;
const mapDragging = ref(false);
type MapDragState = { pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean };
let mapDragState: MapDragState | null = null;
let blockMapClick = false;
const recentlyClearedId = ref<string | null>(null);
const clearedCount = computed(() => stages.value.filter((stage) => isComplete(stage.id)).length);
const currentStageId = computed(() => currentWorldStageId(stages.value, isComplete));
const allCleared = computed(() => stages.value.length > 0 && clearedCount.value === stages.value.length);
const mapPositions = computed(() => worldStages.value.map((_, index) => worldMapPosition(index, worldStages.value.length)));
const trailWide = computed(() => mapPositions.value.map((stop, index) => `${index === 0 ? "M" : "L"} ${stop.x} ${stop.y}`).join(" "));
const trailTall = computed(() => mapPositions.value.map((stop, index) => `${index === 0 ? "M" : "L"} ${stop.mobileX} ${stop.mobileY}`).join(" "));

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
  const current = viewport?.querySelector<HTMLElement>(".map-stop.is-current") ?? viewport?.querySelector<HTMLElement>(".map-stop");
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
    selectedWorld.value = worldIndexForStage(currentWorldStageId(stages.value, isComplete) ?? undefined);
  } catch {
    stages.value = [];
    error.value = "ステージを読みこめませんでした";
  } finally {
    loading.value = false;
  }
}

watch([loading, currentStageId, selectedWorld], () => {
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
  <div class="stage-select scene-enter mx-auto w-full max-w-[1520px]">
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
      <nav class="world-picker" aria-label="冒険する世界">
        <button v-for="(world, index) in STAGE_WORLDS" :key="world.start" type="button" class="world-picker__button" :class="{ 'is-selected': selectedWorld === index }" :aria-pressed="selectedWorld === index" @click="selectedWorld = index">
          <span class="world-picker__title">{{ world.title }}</span>
          <span class="world-picker__progress">ステージ {{ world.start }}〜{{ world.end }} ・ {{ worldClearCount(index) }} / 10</span>
        </button>
      </nav>
      <div class="world-description" aria-live="polite">{{ selectedWorldInfo.subtitle }}</div>
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
        <div class="map-land" :class="['map-land--world-' + selectedWorld, { 'map-land--expanded': worldStages.length > 7 }]" :style="{ '--map-width': Math.max(1640, worldStages.length * 190) + 'px', '--map-height': Math.max(1400, worldStages.length * 160) + 'px' }">
          <div class="map-sun" aria-hidden="true" />
          <div class="map-cloud map-cloud--one" aria-hidden="true" />
          <div class="map-cloud map-cloud--two" aria-hidden="true" />
          <div class="map-mountain map-mountain--one" aria-hidden="true" />
          <div class="map-mountain map-mountain--two" aria-hidden="true" />
          <div class="map-mountain map-mountain--three" aria-hidden="true" />
          <div class="map-hill map-hill--far" aria-hidden="true" />
          <div class="map-hill map-hill--near" aria-hidden="true" />
          <div v-for="(tree, index) in trees" :key="index" class="map-tree" :style="{ left: tree.x + '%', top: tree.y + '%' }" aria-hidden="true" />
          <div class="map-castle" aria-hidden="true"><Icon :name="selectedWorld === 0 ? 'lucide:trees' : selectedWorld === 1 ? 'lucide:mountain' : 'lucide:castle'" /></div>

          <svg class="map-trail map-trail--wide" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path class="map-trail__edge" :d="trailWide" />
            <path class="map-trail__road" :d="trailWide" />
          </svg>
          <svg class="map-trail map-trail--tall" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path class="map-trail__edge" :d="trailTall" />
            <path class="map-trail__road" :d="trailTall" />
          </svg>

          <ol class="map-stops" aria-label="ステージ一覧">
            <li
              v-for="(stage, index) in worldStages"
              :key="stage.id"
              class="map-stop"
              :class="{
                'is-current': currentStageId === stage.id,
                'is-cleared': isComplete(stage.id),
                'is-celebrating': recentlyClearedId === stage.id,
                'is-locked': !stageUnlocked(stage.id),
              }"
              :style="{
                '--stop-x': mapPositions[index]!.x + '%',
                '--stop-y': mapPositions[index]!.y + '%',
                '--stop-mobile-x': mapPositions[index]!.mobileX + '%',
                '--stop-mobile-y': mapPositions[index]!.mobileY + '%',
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
                :aria-label="`ステージ ${selectedWorld * 10 + index + 1} ${stage.title}${isComplete(stage.id) ? ' クリア' : ' あそぶ'}`"
                @click="onChooseStage"
              >
                <span class="map-stop__circle">
                  <Icon v-if="isComplete(stage.id)" name="lucide:check" class="map-stop__icon" aria-hidden="true" />
                  <Icon v-else-if="currentStageId === stage.id" name="lucide:play" class="map-stop__icon" aria-hidden="true" />
                  <span v-else class="map-stop__number">{{ selectedWorld * 10 + index + 1 }}</span>
                </span>
                <span class="map-stop__sign">
                  <span class="map-stop__stage">ステージ {{ selectedWorld * 10 + index + 1 }}</span>
                  <span class="map-stop__title">{{ stage.title }}</span>
                </span>
              </NuxtLink>
              <div
                v-else
                class="map-stop__link map-stop__link--locked"
                aria-disabled="true"
                :aria-label="`ステージ ${selectedWorld * 10 + index + 1} ${stage.title} まだあそべません`"
              >
                <span class="map-stop__circle"><Icon name="lucide:lock-keyhole" class="map-stop__icon" aria-hidden="true" /></span>
                <span class="map-stop__sign">
                  <span class="map-stop__stage">ステージ {{ selectedWorld * 10 + index + 1 }}</span>
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
    <div class="stage-reset mt-5 flex justify-start">
      <button type="button" class="game-button game-button--night text-sm" @click="onReset">
        <Icon name="lucide:refresh-cw" class="game-icon" aria-hidden="true" /> 次の人へ
      </button>
    </div>
  </div>
</template>

<style scoped>
.stage-select { display: flex; flex: none; flex-direction: column; height: calc(100dvh - 2 * clamp(14px, 2.2vw, 32px)); min-height: 0; max-height: calc(100dvh - 2 * clamp(14px, 2.2vw, 32px)); overflow: hidden; }
.stage-select > .mb-5, .stage-select > .mb-4 { flex-shrink: 0; }
.stage-reset { flex-shrink: 0; }
.world-picker { flex-shrink: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.world-picker__button { display: flex; flex-direction: column; gap: 3px; align-items: center; justify-content: center; min-height: 70px; padding: 8px; border: 2px solid #8295ab; border-radius: 15px; background: #293c57; color: #eaf2f4; font-weight: 900; }
.world-picker__button.is-selected { background: #fff2d0; border-color: #f8c76f; color: #263a50; box-shadow: 0 4px 0 #b88353; }
.world-picker__button:focus-visible { outline: 3px solid #ffe39c; outline-offset: 3px; }
.world-picker__title { font-size: clamp(13px, 1.7vw, 20px); }
.world-picker__progress { font-size: 12px; }
.world-description { flex-shrink: 0; margin: 0 0 12px; color: #fff5db; font-size: 14px; font-weight: 800; }
.map-land--world-1 { background: radial-gradient(ellipse at 20% 14%, #ffe0a6 0%, transparent 24%), linear-gradient(110deg, #ffdea5, #e8aa88 50%, #c97598); }
.map-land--world-1::before { background: radial-gradient(ellipse at 18% 104%, #cb916b 0 20%, transparent 20.5%), radial-gradient(ellipse at 54% 103%, #bc7a72 0 26%, transparent 26.5%), radial-gradient(ellipse at 90% 102%, #a9607c 0 24%, transparent 24.5%); }
.map-land--world-1 .map-mountain { background: linear-gradient(110deg, #cc8d88 0 50%, #985e79 50%); }
.map-land--world-1 .map-hill { background: #b47e79; }
.map-land--world-1 .map-hill--far { background: #d49b7e; }
.map-land--world-1 .map-tree::before { background: linear-gradient(100deg, #54948a 50%, #376d7a 50%); clip-path: polygon(35% 0, 65% 0, 65% 55%, 80% 55%, 80% 28%, 100% 28%, 100% 70%, 65% 70%, 65% 100%, 35% 100%, 35% 73%, 0 73%, 0 37%, 20% 37%, 20% 55%, 35% 55%); }
.map-land--world-2 { background: radial-gradient(ellipse at 72% 9%, #a3a0d7 0%, transparent 20%), linear-gradient(120deg, #263c68, #584a83 52%, #966c9a); }
.map-land--world-2::before { background: radial-gradient(ellipse at 20% 100%, #40587b 0 20%, transparent 20.5%), radial-gradient(ellipse at 58% 105%, #435477 0 24%, transparent 24.5%), radial-gradient(ellipse at 95% 104%, #59496e 0 21%, transparent 21.5%); }
.map-land--world-2 .map-sun { background: #f6e8e3; box-shadow: 0 0 0 18px #d8cfef48, 0 0 0 40px #e4d6f233; }
.map-land--world-2 .map-mountain { background: linear-gradient(120deg, #536487 0 49%, #3f4e76 49%); }
.map-land--world-2 .map-hill { background: #415d78; }
.map-land--world-2 .map-hill--far { background: #526881; }
.map-land--world-2 .map-tree::before { background: linear-gradient(100deg, #8dbbdd 50%, #697fae 50%); clip-path: polygon(50% 0, 86% 37%, 75% 75%, 50% 100%, 25% 75%, 14% 37%); }
.map-land--world-2 .map-trail__road { stroke: #f8dfc6; }

.map-land--world-0 .map-mountain {
  clip-path: polygon(0 100%, 0 69%, 12% 68%, 12% 50%, 22% 50%, 22% 28%, 34% 48%, 34% 62%, 47% 36%, 58% 60%, 58% 47%, 72% 30%, 82% 56%, 100% 72%, 100% 100%);
  background: linear-gradient(115deg, #74ab8d, #43876c);
  opacity: .55;
}
.map-land--world-0 .map-trail__road { stroke: #f5dc9b; stroke-dasharray: 28 5; }
.map-land--world-0 .map-stop:not(.is-locked) .map-stop__sign {
  border-color: #785741;
  background: repeating-linear-gradient(0deg, #fff1cd 0 13px, #f7e4b6 13px 15px);
  box-shadow: 0 5px 0 #4c3c2e9c, inset 0 3px 0 #fff9e8;
}
.map-land--world-0 .map-stop:not(.is-locked):not(.is-cleared):not(.is-current) .map-stop__circle {
  border-color: #fff5d4;
  background: radial-gradient(circle at 34% 25%, #ffebb0, #f3b868 76%);
}
.map-land--world-1 .map-mountain {
  clip-path: polygon(0 100%, 0 80%, 11% 80%, 11% 54%, 21% 54%, 21% 35%, 65% 35%, 65% 50%, 86% 50%, 86% 80%, 100% 80%, 100% 100%);
  background: linear-gradient(95deg, #d08a71 0 38%, #aa5c69 38% 62%, #8a536c 62%);
  opacity: .75;
}
.map-land--world-1 .map-tree::after {
  top: 15%; left: 44%; width: 13%; height: 85%; border-radius: 10px;
  background: #397d72;
}
.map-land--world-1 .map-hill--near { background: repeating-linear-gradient(178deg, #99596c 0 26px, #b67570 27px 32px, #a66c6c 33px 63px); }
.map-land--world-1 .map-trail__edge { stroke: #874d59; }
.map-land--world-1 .map-trail__road { stroke: #f4cc9b; stroke-dasharray: 20 5; }
.map-land--world-1 .map-stop:not(.is-locked) .map-stop__sign {
  border-color: #865c61;
  background: repeating-linear-gradient(-7deg, #ffe8cf 0 16px, #eec3b0 17px 19px, #ffe8cf 20px 33px);
  box-shadow: 0 6px 0 #703c52a8, inset 0 3px 0 #fff6e7;
}
.map-land--world-1 .map-stop:not(.is-locked):not(.is-cleared):not(.is-current) .map-stop__circle {
  border-color: #ffe7be;
  background: radial-gradient(circle at 28% 20%, #ffe2b3, #db907e 80%);
}
.map-land--world-2 {
  background:
    radial-gradient(circle at 16% 15%, #ffffffa0 0 2px, transparent 3px),
    radial-gradient(circle at 35% 8%, #ffffffaa 0 3px, transparent 4px),
    radial-gradient(circle at 61% 21%, #fff4d6a6 0 2px, transparent 3px),
    radial-gradient(circle at 83% 11%, #eae3ffac 0 3px, transparent 4px),
    linear-gradient(120deg, #263c68, #584a83 52%, #966c9a);
}
.map-land--world-2 .map-mountain {
  clip-path: polygon(0 100%, 17% 55%, 32% 72%, 54% 5%, 76% 64%, 86% 42%, 100% 100%);
  background: linear-gradient(105deg, #5f8da6 0 48%, #49517e 48% 75%, #7182ab 75%);
  opacity: .75;
}
.map-land--world-2 .map-cloud { opacity: .25; }
.map-land--world-2 .map-trail__edge { stroke: #4c6388; }
.map-land--world-2 .map-trail__road { stroke: #e4e9ff; stroke-dasharray: 14 4; filter: drop-shadow(0 0 5px #8fe8ff); }
.map-land--world-2 .map-stop:not(.is-locked) .map-stop__sign {
  border-color: #617aa1;
  background: linear-gradient(137deg, #faf5ff 0%, #dce7fb 48%, #f7f0ff 100%);
  box-shadow: 0 6px 0 #344566ab, inset 0 3px 0 #ffffff;
}
.map-land--world-2 .map-stop:not(.is-locked):not(.is-cleared):not(.is-current) .map-stop__circle {
  border-color: #f0ecff;
  background: radial-gradient(circle at 30% 24%, #faf5ff, #abc8e7 55%, #9296cf);
}
.map-land--world-2 .map-stop:not(.is-locked) .map-stop__stage { color: #44577b; }
.map-land--world-0 .map-castle { color: #eaffd5; }
.map-land--world-1 .map-castle { color: #ffe4bb; }
.map-land--world-2 .map-castle { color: #f8ecff; filter: drop-shadow(0 0 12px #a1d8ff) drop-shadow(5px 7px 0 #213d5370); }
.map-stop:nth-child(5n) .map-stop__sign { position: relative; }
.map-stop:nth-child(5n) .map-stop__sign::after {
  content: "✦"; position: absolute; top: -21px; right: 5px;
  color: #fff3c0; font-size: 22px; text-shadow: 0 2px 0 #34495f, 0 0 8px #fff9d0;
}

.map-viewport {
  position: relative;
  flex: 1 1 0;
  height: 0;
  min-height: 0;
  overflow: auto;
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
  width: var(--map-width, 1640px);
  height: 560px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 11% 17%, #fff6d0 0 3%, transparent 18%),
    linear-gradient(110deg, #b6e9d9 0%, #b5e6d3 25%, #88c7b3 50%, #8abec6 75%, #7facc4 100%);
}
.map-land--expanded { height: 760px; }
@media (min-width: 640px) {
  .map-land, .map-land--expanded { height: 100%; min-height: 340px; }
}
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
.map-controls { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 15px; }
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
  .map-viewport { overflow: hidden auto; max-height: none; border-radius: 22px; }
  .map-land { width: 100%; min-width: 300px; height: var(--map-height, 1400px); background: linear-gradient(180deg, #b6e9d9 0%, #9ccfba 37%, #8ac1b1 60%, #81aebe 100%); }
  .map-land--expanded { height: var(--map-height, 1400px); }
  .map-land::before { background: radial-gradient(ellipse at 35% 18%, #83c39b 0 13%, transparent 14%), radial-gradient(ellipse at 70% 53%, #57a48f 0 20%, transparent 21%), radial-gradient(ellipse at 30% 86%, #528f99 0 18%, transparent 19%); }

  .map-land--world-1 { background: linear-gradient(180deg, #ffe0aa, #e5ae8d 46%, #b66e83); }
  .map-land--world-1::before { background: radial-gradient(ellipse at 15% 30%, #cb916b 0 18%, transparent 19%), radial-gradient(ellipse at 85% 67%, #bd7479 0 20%, transparent 21%); }
  .map-land--world-2 { background: radial-gradient(circle at 24% 11%, #ffffffac 0 2px, transparent 3px), radial-gradient(circle at 72% 55%, #fff2ef 0 2px, transparent 3px), linear-gradient(180deg, #283c68, #685781 52%, #87699a); }
  .map-land--world-2::before { background: radial-gradient(ellipse at 14% 25%, #496387 0 16%, transparent 17%), radial-gradient(ellipse at 90% 66%, #495a81 0 20%, transparent 21%); }

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
@media (max-height: 680px) {
  .stage-select > .mb-5 { margin-bottom: 6px; }
  .stage-select > .mb-4 { margin-bottom: 6px; }
  .stage-select .game-kicker { display: none; }
  .world-picker { margin-bottom: 5px; }
  .world-picker__button { min-height: 54px; }
  .world-description { margin-bottom: 5px; }
  .map-controls { margin-top: 6px; }
  .stage-reset { margin-top: 6px; }
  .stage-reset .game-button { min-height: 40px; padding-block: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .map-hero, .map-stop.is-current .map-stop__circle, .map-stop.is-celebrating .map-stop__circle, .map-stop.is-celebrating::before { animation: none; }
  .map-stop__link { transition: none; }
}
</style>
