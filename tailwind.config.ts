// tailwind.config.ts
import type { Config } from "tailwindcss";
export default <Partial<Config>>{
  content: [
    "./app.vue",
    "./app/**/*.{vue,ts}",
    "./pages/**/*.vue",
    "./components/**/*.vue",
    "./composables/**/*.ts",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hiragino Maru Gothic ProN"', '"BIZ UDPGothic"', '"Yu Gothic"', "Meiryo", "sans-serif"],
      },
    },
  },
  plugins: [],
};
