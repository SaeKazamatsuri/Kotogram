<template>
  <div class="min-h-screen w-full">
    <header class="w-full bg-gradient-to-r from-amber-200 via-sky-200 to-lime-200 border-b border-amber-300/60">
      <div class="px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-xl font-extrabold text-slate-800">ことグラム</NuxtLink>
      </div>
    </header>
    <main class="w-full p-4 md:p-6">
      <slot />
    </main>
  </div>
</template>
