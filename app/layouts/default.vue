<script setup lang="ts">
const { fontScale, inc, dec, reset } = useUiPrefs();
</script>

<template>
  <!-- 画面幅いっぱい / 子供向け少し明るめの配色 -->
  <div class="min-h-screen w-full" :style="{ fontSize: fontScale + '%' }">
    <header
      class="w-full bg-gradient-to-r from-amber-200 via-sky-200 to-lime-200 border-b border-amber-300/60"
    >
      <div class="px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-xl font-extrabold text-slate-800"
          >ことグラム</NuxtLink
        >
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-600">文字サイズ</span>
          <button
            class="px-3 py-1.5 rounded-xl border bg-white hover:bg-amber-50 text-base"
            @click="dec()"
          >
            A−
          </button>
          <button
            class="px-3 py-1.5 rounded-xl border bg-white hover:bg-amber-50 text-base"
            @click="inc()"
          >
            A＋
          </button>
          <button
            class="px-2 py-1 rounded-xl border text-xs bg-white hover:bg-amber-50"
            @click="reset()"
          >
            リセット
          </button>
        </div>
      </div>
    </header>

    <main class="w-full p-4 md:p-6">
      <slot />
    </main>
  </div>
</template>
