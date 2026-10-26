import { GAME, worldToScreenX, type GameState } from "./core.ts";

export type InspectedObject = { id: string; name: string };

const COLORS = { red: "あか", green: "みどり", blue: "あお", yellow: "きいろ", purple: "むらさき" };
const SHAPES = { circle: "まる", cross: "ばつ", triangle: "さんかく", square: "しかく", star: "ほし" };

export function inspectGameObject(game: GameState, screenX: number, screenY: number): InspectedObject | null {
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || screenX < 0 || screenY < 0 || screenX > GAME.width || screenY > GAME.height) return null;
  const hit = (x: number, y: number, w: number, h: number) => {
    const left = worldToScreenX(game, x);
    return screenX >= left && screenX <= left + w && screenY >= y && screenY <= y + h;
  };
  const find = <T extends { id: string }>(items: T[], matches: (item: T) => boolean, name: (item: T) => string): InspectedObject | null => {
    const item = items.find(matches);
    return item ? { id: item.id, name: name(item) } : null;
  };

  return find(game.switches, item => hit(item.x - 16, GAME.groundY - 40, 32, 40),
    item => `${COLORS[item.color]}の${SHAPES[item.shape]}ボタン`)
    ?? find(game.keys.filter(item => !item.collected), item => hit(item.x - 14, GAME.groundY - 60, 47, 34), () => "かぎ")
    ?? find(game.chests, item => hit(item.x - 24, GAME.groundY - 38, 48, 38), () => "宝箱")
    ?? find(game.coins.filter(item => !item.collected && !item.chestId), item => hit(item.x - GAME.coinRadius - 5, GAME.groundY - 35 - GAME.coinRadius - 6, GAME.coinRadius * 2 + 10, GAME.coinRadius * 2 + 12), () => "コイン")
    ?? find(game.doors, item => hit(item.x - 5, GAME.groundY - GAME.doorHeight - 6, GAME.doorWidth + 10, GAME.doorHeight + 6), () => "門")
    ?? find(game.walls, item => hit(item.x - 2, GAME.groundY - GAME.wallHeight, GAME.wallWidth + 4, GAME.wallHeight), () => "かべ")
    ?? find(game.ghosts, item => hit(item.x, GAME.groundY - GAME.ghostHeight - GAME.ghostClearance - 4, GAME.ghostWidth, GAME.ghostHeight + 16), () => "おばけ")
    ?? find(game.lasers, item => hit(item.x - 7, GAME.groundY - 132, 14, 132), () => "ひかり")
    ?? find(game.pressurePlates, item => hit(item.x, GAME.groundY - 19, item.w, 19), () => "ふむ床")
    ?? find(game.mirrors, item => hit(item.x - 20, GAME.groundY - 106, 40, 94), () => "かがみ")
    ?? find(game.portals, item => hit(item.x - 20, GAME.groundY - 90, 40, 86) || hit(item.targetX - 20, GAME.groundY - 90, 40, 86), () => "ワープ")
    ?? find(game.goals, item => hit(item.x - 4, GAME.groundY - GAME.goalHeight - 10, GAME.goalWidth + 8, GAME.goalHeight + 10), item => item.isFinal ? "ゴール" : "ちかみち")
    ?? find(game.verticalPlatforms, item => hit(item.x, item.y + GAME.epsilon - 11, item.w, 13), () => "上下する足場")
    ?? find(game.movingPlatforms, item => hit(item.x, GAME.groundY - 25, item.w, 25), () => "動く足場")
    ?? find(game.bridges, item => hit(item.x, GAME.groundY - 18, item.w, 18), () => "橋")
    ?? find(game.fragileFloors, item => hit(item.x, GAME.groundY - 15, item.w, 15), () => "こわれる床")
    ?? find(game.conveyors, item => hit(item.x, GAME.groundY - 14, item.w, 14), () => "動く床")
    ?? find(game.winds, item => hit(item.x, GAME.groundY - 150, item.w, 133), () => "風")
    ?? find(game.holes, item => hit(item.x, GAME.groundY - 6, item.w, GAME.groundHeight + 6), () => "あな");
}
