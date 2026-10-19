import { isCrouching, type GameState } from "./core.ts";
import type { SoundName } from "./audio";

export type GameAudioSnapshot = {
  vy: number;
  crouching: boolean;
  clearedWalls: Set<string>;
  clearedGhosts: Set<string>;
  collectedCoins: Set<string>;
  openDoors: Set<string>;
};

export function snapshotGameAudio(game: GameState): GameAudioSnapshot {
  return {
    vy: game.vy,
    crouching: isCrouching(game),
    clearedWalls: new Set(game.walls.filter((wall) => wall.cleared).map((wall) => wall.id)),
    clearedGhosts: new Set(game.ghosts.filter((ghost) => ghost.cleared).map((ghost) => ghost.id)),
    collectedCoins: new Set(game.coins.filter((coin) => coin.collected).map((coin) => coin.id)),
    openDoors: new Set(game.doors.filter((door) => door.open).map((door) => door.id)),
  };
}

export function gameAudioEvents(before: GameAudioSnapshot, after: GameState): SoundName[] {
  if (after.status === "failed") return ["hit"];
  const sounds: SoundName[] = [];
  if (before.vy === 0 && after.vy < 0) sounds.push("jump");
  if (!before.crouching && isCrouching(after)) sounds.push("crouch");
  if (before.vy !== 0 && after.vy === 0) sounds.push("land");
  if (after.coins.some((coin) => coin.collected && !before.collectedCoins.has(coin.id))) sounds.push("score");
  if (after.walls.some((wall) => wall.cleared && !before.clearedWalls.has(wall.id))
    || after.ghosts.some((ghost) => ghost.cleared && !before.clearedGhosts.has(ghost.id))) sounds.push("avoid");
  if (after.doors.some((door) => door.open && !before.openDoors.has(door.id))) sounds.push("confirm");
  return sounds;
}
