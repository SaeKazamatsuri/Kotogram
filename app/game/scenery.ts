export type ScenePalette = {
  biome: "forest" | "canyon" | "starlight";
  skyTop: string;
  skyBottom: string;
  sunGlow: string;
  sun: string;
  stars: string;
  starCount: number;
  cloud: string;
  farHill: string;
  nearHill: string;
  trunk: string;
  trees: string;
  treeLight: string;
  groundRim: string;
  ground: string;
  grass: string;
  groundTile: string;
};

const palettes: Record<"day" | "sunset" | "twilight", ScenePalette> = {
  day: {
    biome: "forest", skyTop: "#7bd1e8", skyBottom: "#ffedb8", sunGlow: "#fff4cb77", sun: "#ffe7a1",
    stars: "#ffffff88", starCount: 0, cloud: "#e9fbf8bd", farHill: "#a3c6bb", nearHill: "#6db89d",
    trunk: "#756677", trees: "#377d72", treeLight: "#73ac8a", groundRim: "#d1b394", ground: "#ac7c68", grass: "#5bae89", groundTile: "#d49b7e",
  },
  sunset: {
    biome: "canyon", skyTop: "#d889bc", skyBottom: "#ffca87", sunGlow: "#ffe6ab66", sun: "#fff1b0",
    stars: "#fff6d2a0", starCount: 4, cloud: "#ffeac6b0", farHill: "#ad8da7", nearHill: "#8b7496",
    trunk: "#695272", trees: "#666881", treeLight: "#ab91a4", groundRim: "#e0b69b", ground: "#a56f75", grass: "#cba182", groundTile: "#d99c8c",
  },
  twilight: {
    biome: "starlight", skyTop: "#273665", skyBottom: "#856a99", sunGlow: "#d3caea33", sun: "#eee1cb",
    stars: "#fffffbdc", starCount: 12, cloud: "#a9a3c16b", farHill: "#5c6896", nearHill: "#424e79",
    trunk: "#303b64", trees: "#3b6281", treeLight: "#7792ac", groundRim: "#b29fae", ground: "#71657f", grass: "#8190a1", groundTile: "#9e8da4",
  },
};

export function resolveScenePalette(bg?: string): ScenePalette {
  return palettes[bg === "sunset" || bg === "twilight" ? bg : "day"];
}

export const PARALLAX_DEPTH = { stars: 0.06, clouds: 0.11, farHill: 0.12, nearHill: 0.24, trees: 0.28, ground: 1 } as const;

export function layerX(index: number, scroll: number, spacing: number, depth: number, width: number): number {
  const cycle = Math.max(width + spacing, spacing * Math.ceil((width + spacing) / spacing));
  return ((index * spacing - scroll * depth) % cycle + cycle) % cycle;
}
