<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getAudioMuted, setAudioMuted, setBgm, unlockAudio } from "~/game/audio";

const route = useRoute();
const muted = ref(false);

function toggleAudio() {
  const next = !muted.value;
  setAudioMuted(next);
  muted.value = next;
}

watch(() => route.path, () => {
  if (!route.path.startsWith("/play/")) setBgm("title_loop");
});

onMounted(() => {
  muted.value = getAudioMuted();
  setBgm("title_loop");
  window.addEventListener("pointerdown", unlockAudio, true);
  window.addEventListener("keydown", unlockAudio, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", unlockAudio, true);
  window.removeEventListener("keydown", unlockAudio, true);
});
</script>

<template>
  <div class="game-shell">
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
