export type ScenePalette = {
  skyTop: string;
  skyBottom: string;
  sunGlow: string;
  sun: string;
  stars: string;
  cloud: string;
  farHill: string;
  nearHill: string;
  trunk: string;
  trees: string;
  ground: string;
  grass: string;
  groundTile: string;
};

const palettes: Record<"day" | "sunset" | "twilight", ScenePalette> = {
  day: {
    skyTop: "#7bd1e8", skyBottom: "#ffedb8", sunGlow: "#fff4cb77", sun: "#ffe7a1",
    stars: "#ffffff88", cloud: "#e9fbf8bd", farHill: "#a3c6bb", nearHill: "#6db89d",
    trunk: "#756677", trees: "#377d72", ground: "#ac7c68", grass: "#5bae89", groundTile: "#d49b7e",
  },
  sunset: {
    skyTop: "#d889bc", skyBottom: "#ffca87", sunGlow: "#ffe6ab66", sun: "#fff1b0",
    stars: "#fff6d2a0", cloud: "#ffeac6b0", farHill: "#ad8da7", nearHill: "#8b7496",
    trunk: "#695272", trees: "#666881", ground: "#a56f75", grass: "#cba182", groundTile: "#d99c8c",
  },
  twilight: {
    skyTop: "#273665", skyBottom: "#856a99", sunGlow: "#d3caea33", sun: "#eee1cb",
    stars: "#fffffbdc", cloud: "#a9a3c16b", farHill: "#5c6896", nearHill: "#424e79",
    trunk: "#303b64", trees: "#3b6281", ground: "#71657f", grass: "#8190a1", groundTile: "#9e8da4",
  },
};

export function resolveScenePalette(bg?: string): ScenePalette {
  return palettes[bg === "sunset" || bg === "twilight" ? bg : "day"];
}

export function layerX(index: number, scroll: number, spacing: number, depth: number, width: number): number {
  const cycle = Math.max(width + spacing, spacing * Math.ceil((width + spacing) / spacing));
  return ((index * spacing - scroll * depth) % cycle + cycle) % cycle;
}
