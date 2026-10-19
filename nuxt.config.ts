export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  app: { head: { title: "ことグラム" } },
  modules: ["@nuxt/eslint", "@nuxt/icon", "@nuxtjs/tailwindcss"],
  css: ["~/assets/css/tailwind.css"],
  tailwindcss: { cssPath: "~/assets/css/tailwind.css" },
  icon: { mode: "svg", serverBundle: { collections: ["lucide"] } },
  runtimeConfig: {
    public: {
      rankingApiBase: process.env.NUXT_PUBLIC_RANKING_API_BASE ?? "https://kotogram-api.sae-chan.net",
    },
  },
});
