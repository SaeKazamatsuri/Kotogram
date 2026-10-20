<script setup lang="ts">
import { onMounted, ref } from "vue";
import { playSe, unlockAudio } from "~/game/audio";
import GameCharacterSprite from "~/components/game/CharacterSprite.vue";

const completed = ref(0);

function onStart() {
  unlockAudio();
  playSe("confirm");
}

onMounted(() => {
  completed.value = Object.keys(useStats().getAll()).length;
});
</script>

<template>
  <div class="title-adventure scene-enter">
    <div class="title-world" aria-hidden="true">
      <div class="title-world__moon" />
      <div class="title-world__cloud title-world__cloud--first" />
      <div class="title-world__cloud title-world__cloud--second" />
      <div class="title-world__mountain title-world__mountain--far" />
      <div class="title-world__mountain title-world__mountain--near" />
      <div class="title-world__hill title-world__hill--far" />
      <div class="title-world__hill title-world__hill--near" />
      <div class="title-world__tree title-world__tree--one" />
      <div class="title-world__tree title-world__tree--two" />
      <div class="title-world__tree title-world__tree--three" />
      <div class="title-world__path" />
      <div class="title-world__portal"><Icon name="lucide:flag-triangle-right" /></div>
      <div class="title-world__avatar">
        <GameCharacterSprite />
      </div>
      <div class="title-world__spark title-world__spark--first" />
      <div class="title-world__spark title-world__spark--second" />
    </div>

    <section class="title-adventure__content">
      <p class="title-adventure__kicker">
        <Icon name="lucide:sparkles" class="game-icon" aria-hidden="true" />
        ことばで 遊ぶ
      </p>
      <h1 class="title-adventure__heading">こと<span>グラム</span></h1>
      <NuxtLink to="/stages" class="game-button game-button--mint title-adventure__start" aria-label="遊ぶ" @click="onStart">
        <Icon name="lucide:play" class="game-icon" aria-hidden="true" />
        遊ぶ
      </NuxtLink>
      <p v-if="completed" class="title-adventure__progress">
        <Icon name="lucide:star" class="game-icon" aria-hidden="true" />
        {{ completed }} ステージ クリア
      </p>
    </section>
  </div>
</template>

<style scoped>
.title-adventure {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: clamp(540px, calc(100svh - 68px), 820px);
  overflow: hidden;
  border-radius: 32px;
  background: linear-gradient(170deg, #253f5c 0%, #497b88 48%, #93bfa3 100%);
  box-shadow: 0 8px 0 #080e20;
}
.title-world {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(ellipse at 75% 20%, #adcbd180 0, transparent 37%), linear-gradient(115deg, #1a2c4c 0%, #4d7989 55%, #b7d7b2 100%);
}
.title-world__moon {
  position: absolute;
  right: 17%;
  top: 11%;
  width: 118px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #ffedbb;
  box-shadow: 0 0 0 24px #ffedbb24, 0 0 0 58px #ffedbb15;
}
.title-world__cloud {
  position: absolute;
  width: 130px;
  height: 30px;
  border-radius: 28px;
  background: #d3f0e5bc;
  box-shadow: 30px -20px 0 5px #d3f0e5bc, 70px -6px 0 #d3f0e5bc;
}
.title-world__cloud--first { right: 42%; top: 18%; }
.title-world__cloud--second { right: 7%; top: 37%; transform: scale(.8); }
.title-world__mountain {
  position: absolute;
  bottom: 16%;
  width: 52%;
  height: 62%;
  clip-path: polygon(0 100%, 51% 9%, 100% 100%);
}
.title-world__mountain--far {
  right: 3%;
  background: linear-gradient(110deg, #80a3a0 0 51%, #5c8b91 51% 100%);
  opacity: .75;
}
.title-world__mountain--near {
  right: -19%;
  bottom: 14%;
  height: 52%;
  background: linear-gradient(115deg, #769b91 0 52%, #4b7881 52% 100%);
}
.title-world__hill {
  position: absolute;
  height: 50%;
  width: 90%;
  bottom: -36%;
  border-radius: 50% 50% 0 0;
}
.title-world__hill--far { left: -15%; background: #4e9987; transform: rotate(8deg); }
.title-world__hill--near { right: -36%; bottom: -29%; background: #387d72; transform: rotate(-10deg); }
.title-world__path {
  position: absolute;
  right: -19%;
  bottom: -32%;
  width: 93%;
  height: 58%;
  border: 22px solid #44756e;
  border-radius: 65% 50% 20% 20%;
  background: #efd9a4;
  transform: rotate(-13deg);
  box-shadow: inset 0 0 0 10px #f9e9b7;
}
.title-world__tree {
  position: absolute;
  width: 98px;
  height: 164px;
  background: linear-gradient(90deg, #2a7168 0 50%, #1c565c 50%);
  clip-path: polygon(50% 0, 87% 42%, 75% 42%, 100% 80%, 58% 80%, 58% 100%, 42% 100%, 42% 80%, 0 80%, 25% 42%, 13% 42%);
  filter: drop-shadow(6px 8px 0 #213b4770);
}
.title-world__tree--one { right: 43%; bottom: 12%; transform: scale(.68); }
.title-world__tree--two { right: 2%; bottom: 4%; transform: scale(1.15); }
.title-world__tree--three { right: 57%; bottom: 3%; transform: scale(.52); }
.title-world__portal {
  position: absolute;
  z-index: 1;
  right: 8%;
  bottom: 42%;
  display: grid;
  place-items: center;
  width: 100px;
  height: 100px;
  border: 7px solid #fff4d6;
  border-radius: 50%;
  background: #92e8bf;
  color: #1a6051;
  font-size: 53px;
  box-shadow: 0 9px 0 #214d54, 0 0 0 11px #fff4d650;
}
.title-world__avatar {
  position: absolute;
  z-index: 2;
  right: 29%;
  bottom: 18%;
  width: 140px;
  height: 177px;
  filter: drop-shadow(12px 13px 0 #213e4d68);
  animation: title-hero-float 3s ease-in-out infinite;
}
.title-world__spark {
  position: absolute;
  width: 14px;
  aspect-ratio: 1;
  background: #fff1bf;
  clip-path: polygon(50% 0, 65% 38%, 100% 50%, 65% 62%, 50% 100%, 35% 62%, 0 50%, 35% 38%);
  animation: title-spark 3.5s ease-in-out infinite;
}
.title-world__spark--first { right: 25%; top: 20%; }
.title-world__spark--second { right: 48%; top: 52%; animation-delay: 1.5s; }
.title-adventure__content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: inherit;
  width: 100%;
  padding: clamp(32px, 6vw, 90px);
  background: linear-gradient(90deg, #101a33eb 0%, #162743cb 34%, #16274320 67%, transparent 100%);
}
.title-adventure__kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 23px;
  color: #b8f5d4;
  font-size: clamp(16px, 2vw, 21px);
  font-weight: 900;
}
.title-adventure__heading {
  margin: 0 0 37px;
  color: #fff8e8;
  font-size: clamp(54px, 8vw, 122px);
  font-weight: 900;
  letter-spacing: -.065em;
  line-height: 1.18;
  white-space: nowrap;
  text-shadow: 0 7px 0 #101b33a6;
}
.title-adventure__heading span { color: #aaf0d0; }
.title-adventure__start { min-width: 230px; font-size: 23px; }
.title-adventure__progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 29px;
  color: #fff4d4;
  font-weight: 900;
}
.title-adventure__progress svg { color: #ffdc90; }
@keyframes title-hero-float { 50% { transform: translateY(-12px) rotate(-2deg); } }
@keyframes title-spark { 50% { transform: scale(1.45); opacity: .5; } }
@media (max-width: 639px) {
  .title-adventure { min-height: min(780px, calc(100svh - 40px)); border-radius: 24px; }
  .title-adventure__content {
    align-items: center;
    justify-content: flex-start;
    padding: 64px 18px 25px;
    text-align: center;
    background: linear-gradient(180deg, #101a33f5 0%, #14223dd9 35%, #14223d24 67%, transparent 100%);
  }
  .title-adventure__kicker { margin-bottom: 18px; }
  .title-adventure__heading { margin-bottom: 25px; font-size: clamp(39px, 10.7vw, 67px); }
  .title-adventure__start { min-width: 215px; }
  .title-world__moon { width: 86px; right: 13%; top: 43%; }
  .title-world__avatar { right: 22%; bottom: 11%; transform: scale(.75); transform-origin: bottom right; animation: none; }
  .title-world__portal { right: 7%; bottom: 37%; width: 72px; height: 72px; font-size: 36px; }
  .title-world__mountain { width: 105%; bottom: 12%; height: 36%; }
  .title-world__mountain--far { right: 0; }
  .title-world__mountain--near { right: -54%; }
  .title-world__path { width: 145%; height: 38%; right: -62%; bottom: -20%; }
  .title-world__tree--one { right: 76%; bottom: 8%; }
  .title-world__tree--two { right: -10%; bottom: 1%; transform: scale(.75); }
  .title-world__tree--three { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .title-world__avatar, .title-world__spark { animation: none; }
}
</style>
