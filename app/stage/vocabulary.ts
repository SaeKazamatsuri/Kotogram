import { switchAppearance, type SwitchColor, type SwitchShape } from "../game/core.ts";

export type StageWords = {
  objects?: readonly { type: string; trap?: boolean; color?: SwitchColor; shape?: SwitchShape }[];
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
  const obstacle = ["wall", "ghost", "hole"].some((type) => types.has(type));
  const conditions = [
    ...(types.has("wall") ? ["wall"] : []),
    ...(types.has("hole") ? ["hole"] : []),
    ...(types.has("ghost") ? ["enemy"] : []),
    ...(types.has("coin") ? ["coin"] : []),
    ...(types.has("switch") ? ["switch"] : []),
    ...(obstacle ? ["ahead"] : []),
  ];
  const actions = [
    ...(types.has("wall") || types.has("hole") ? ["jump"] : []),
    ...(types.has("ghost") ? ["crouch"] : []),
    ...(types.has("coin") ? ["collect"] : []),
    ...(types.has("switch") ? ["press"] : []),
    ...(objects.some((object) => object.type === "switch" && object.trap) ? ["skip"] : []),
  ];
  const colors = new Set<SwitchColor>();
  const shapes = new Set<SwitchShape>();
  for (const object of objects) {
    if (object.type !== "switch") continue;
    const appearance = switchAppearance({
      trap: object.trap === true, color: object.color, shape: object.shape,
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
