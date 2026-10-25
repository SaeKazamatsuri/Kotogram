import { switchAppearance, type SwitchColor, type SwitchShape } from "../game/core.ts";

export type StageWords = {
  objects?: readonly { type: string }[];
  meta?: { dictionary?: { conditions?: string[]; actions?: string[]; examples?: string[] } };
};

const COLOR_WORDS: Record<SwitchColor, string> = {
  red: "あかいぼたん", green: "みどりのぼたん", blue: "あおいぼたん",
  yellow: "きいろいぼたん", purple: "むらさきのぼたん",
};
const SHAPE_WORDS: Record<SwitchShape, string> = {
  circle: "まるのぼたん", cross: "ばつのぼたん", triangle: "さんかくのぼたん",
  square: "しかくのぼたん", star: "ほしのぼたん",
};

export function suggestedStageWords(stage?: StageWords | null) {
  const objects = stage?.objects ?? [];
  const types = new Set(objects.map((object) => object.type));
  const obstacle = ["wall", "ghost", "hole", "fragileFloor"].some((type) => types.has(type));
  const conditions = [
    ...(types.has("wall") ? ["wall"] : []),
    ...(types.has("hole") ? ["hole"] : []),
    ...(types.has("ghost") ? ["enemy"] : []),
    ...(types.has("coin") ? ["coin"] : []),
    ...(types.has("key") ? ["key"] : []),
    ...(types.has("chest") ? ["chest"] : []),
    ...(types.has("portal") ? ["portal"] : []),
    ...(objects.filter((object) => object.type === "goal").length === 2 ? ["goal"] : []),
    ...(types.has("switch") ? ["switch"] : []),
    ...(types.has("conveyor") ? ["conveyor"] : []),
    ...(types.has("fragileFloor") ? ["fragileFloor"] : []),
    ...(types.has("wind") ? ["wind"] : []),
    ...(types.has("pressurePlate") ? ["pressurePlate"] : []),
    ...(types.has("movingPlatform") ? ["movingPlatform"] : []),
    ...(types.has("verticalPlatform") ? ["verticalPlatform"] : []),
    ...(types.has("laser") ? ["laser"] : []),
    ...(types.has("bridge") ? ["bridge"] : []),
    ...(obstacle ? ["ahead"] : []),
  ];
  const actions = [
    ...(types.has("wall") || types.has("hole") || types.has("fragileFloor") ? ["jump"] : []),
    ...(types.has("ghost") || types.has("laser") ? ["crouch"] : []),
    ...(types.has("coin") || types.has("key") ? ["collect"] : []),
    ...(types.has("chest") ? ["openChest"] : []),
    ...(types.has("portal") ? ["enterPortal"] : []),
    ...(types.has("verticalPlatform") ? ["ridePlatform"] : []),
    ...(types.has("switch") ? ["press"] : []),
    ...(objects.filter((object) => object.type === "goal").length === 2 ? ["skip"] : []),
    ...(objects.some((object) => object.type === "switch" && (object as { trap?: boolean }).trap === true) ? ["skip"] : []),
  ];
  const colors = new Set<SwitchColor>();
  const shapes = new Set<SwitchShape>();
  for (const object of objects) {
    if (object.type !== "switch") continue;
    const attributes = object as { trap?: boolean; color?: SwitchColor; shape?: SwitchShape };
    const appearance = switchAppearance({
      trap: attributes.trap === true, color: attributes.color, shape: attributes.shape,
    });
    colors.add(appearance.color);
    shapes.add(appearance.shape);
  }
  const examples = [
    ...Object.entries(COLOR_WORDS).filter(([color]) => colors.has(color as SwitchColor)).map(([, word]) => word),
    ...Object.entries(SHAPE_WORDS).filter(([shape]) => shapes.has(shape as SwitchShape)).map(([, word]) => word),
  ];
  const custom = stage?.meta?.dictionary;
  return {
    conditions: custom?.conditions ?? conditions,
    actions: custom?.actions ?? actions,
    examples: custom?.examples ?? examples,
  };
}
