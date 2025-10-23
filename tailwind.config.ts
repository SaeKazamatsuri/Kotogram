// tailwind.config.ts
import type { Config } from "tailwindcss";
export default <Partial<Config>>{
  content: [
    "./app.vue",
    "./pages/**/*.vue",
    "./components/**/*.vue",
    "./composables/**/*.ts",
  ],
  theme: { extend: {} },
  plugins: [],
};
