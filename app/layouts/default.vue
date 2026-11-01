<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getAudioMuted, setAudioMuted, setBgm, unlockAudio } from "~/game/audio";
import { createTripleEscapeDetector } from "~/game/escape-shortcut";
import { useNextPlayer } from "~/composables/useNextPlayer";

const route = useRoute();
const muted = ref(false);
const nextPlayer = useNextPlayer();
const tripleEscape = createTripleEscapeDetector();

function preventContextMenu(event: MouseEvent) {
  event.preventDefault();
}

function toggleAudio() {
  const next = !muted.value;
  setAudioMuted(next);
  muted.value = next;
}

function syncRouteMusic() {
  if (!route.path.startsWith("/play/")) setBgm(route.path === "/" ? "title_adventure" : "title_loop");
}

watch(() => route.path, () => {
  tripleEscape.reset();
  syncRouteMusic();
});

function onShortcutKeydown(event: KeyboardEvent) {
  if (!tripleEscape.keydown(event)) return;
  event.preventDefault();
  nextPlayer();
}

onMounted(() => {
  muted.value = getAudioMuted();
  syncRouteMusic();
  window.addEventListener("pointerdown", unlockAudio, true);
  window.addEventListener("keydown", unlockAudio, true);
  window.addEventListener("contextmenu", preventContextMenu);
  window.addEventListener("keydown", onShortcutKeydown, true);
  window.addEventListener("blur", tripleEscape.reset);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", unlockAudio, true);
  window.removeEventListener("keydown", unlockAudio, true);
  window.removeEventListener("contextmenu", preventContextMenu);
  window.removeEventListener("keydown", onShortcutKeydown, true);
  window.removeEventListener("blur", tripleEscape.reset);
});
</script>

<template>
  <div class="game-shell" :class="{ 'game-shell--playing': route.path.startsWith('/play/'), 'game-shell--stages': route.path === '/stages' }">
    <main id="main-content" class="game-scene">
      <slot />
    </main>
    <button
      type="button"
      class="fixed bottom-4 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#aaf0d0] bg-[#172439] text-[#fffaf1] shadow-[0_4px_0_#080e1e] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#ffdc90]"
      :aria-label="muted ? '音を出す' : '音を消す'"
      :aria-pressed="!muted"
      @click="toggleAudio"
    >
      <Icon :name="muted ? 'lucide:volume-x' : 'lucide:volume-2'" class="text-xl" aria-hidden="true" />
    </button>
  </div>
</template>
