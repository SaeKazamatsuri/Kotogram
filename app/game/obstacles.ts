import { GAME, isBridgeOpen, isLaserActive, worldToScreenX, type GameState, type SwitchColor, type SwitchShape } from "./core.ts";

const SWITCH_PALETTE: Record<SwitchColor, string> = { red: "#b83250", green: "#278a74", blue: "#255caf", yellow: "#b47b16", purple: "#7e4aa0" };
const SWITCH_SYMBOLS: Record<SwitchShape, string> = { circle: "○", cross: "×", triangle: "△", square: "□", star: "☆" };

export function obstaclePhase(ticks: number, index: number, rate: number): number {
  return (ticks + index * 13) * rate;
}

export function drawHoles(ctx: CanvasRenderingContext2D, game: GameState): void {
  for (const hole of game.holes) {
    const left = Math.max(0, worldToScreenX(game, hole.x));
    const right = Math.min(GAME.width, worldToScreenX(game, hole.x + hole.w));
    if (right <= left) continue;
    const dark = ctx.createLinearGradient(0, GAME.groundY, 0, GAME.height);
    dark.addColorStop(0, "#18283d");
    dark.addColorStop(1, "#080e25");
    ctx.fillStyle = dark;
    ctx.fillRect(left, GAME.groundY, right - left, GAME.groundHeight);
    ctx.fillStyle = "#354c5d";
    ctx.fillRect(left, GAME.groundY, Math.min(6, right - left), 15);
    ctx.fillRect(Math.max(left, right - 6), GAME.groundY, Math.min(6, right - left), 15);
    ctx.strokeStyle = "#91b8aa";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left, GAME.groundY);
    ctx.lineTo(Math.min(left + 12, right), GAME.groundY);
    ctx.moveTo(Math.max(left, right - 12), GAME.groundY);
    ctx.lineTo(right, GAME.groundY);
    ctx.stroke();
    ctx.fillStyle = "#e3ecdd";
    ctx.fillRect(left, GAME.groundY + 2, 2, 16);
    ctx.fillRect(Math.max(left, right - 2), GAME.groundY + 2, 2, 16);
  }
}

export function drawWorldObjects(ctx: CanvasRenderingContext2D, game: GameState, visualTick = game.elapsedTicks): void {
  for (const bridge of game.bridges) {
    const x = worldToScreenX(game,bridge.x);
    if(x > GAME.width || x+bridge.w<0) continue;
    const active = isBridgeOpen(bridge,game.doors);
    ctx.save();
    ctx.fillStyle = active ? "#bdcdbb" : "rgba(213,225,227,0.20)";
    if(active)ctx.fillRect(x,GAME.groundY-12,bridge.w,12);
    ctx.strokeStyle = active ? "#456e65" : "#aeb7b8";
    ctx.lineWidth = 3;
    if(!active)ctx.setLineDash([9,7]);
    ctx.strokeRect(x,GAME.groundY-12,bridge.w,12);
    ctx.setLineDash([]);
    ctx.fillStyle = active ? "#213f47" : "#a3afb1";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(active ? "━ ○ ━" : "×  とじる",x+10,GAME.groundY-18);
    ctx.restore();
  }
  for(const laser of game.lasers){
    const x=worldToScreenX(game,laser.x);
    if(x < -28 || x > GAME.width+28)continue;
    const active=isLaserActive(laser,game.elapsedTicks);
    ctx.save();
    ctx.strokeStyle=active?"#f04b66":"#697689";
    ctx.lineWidth=active?5:2;
    if(!active)ctx.setLineDash([5,6]);
    ctx.beginPath();
    ctx.moveTo(x,GAME.groundY-135);
    ctx.lineTo(x,GAME.groundY-5);
    ctx.stroke();
    ctx.fillStyle=active?"#8c1731":"#32465b";
    ctx.font="bold 17px sans-serif";
    ctx.fillText(active?"！":"○",x+8,GAME.groundY-141);
    ctx.restore();
  }
  for (const wind of game.winds) {
    const x = worldToScreenX(game, wind.x);
    if (x > GAME.width || x + wind.w < 0) continue;
    ctx.fillStyle = wind.multiplier > 1 ? "rgba(61,153,174,0.14)" : "rgba(97,98,165,0.15)";
    ctx.fillRect(x, GAME.groundY - 150, wind.w, 133);
    ctx.fillStyle = wind.multiplier > 1 ? "#237b90" : "#65579f";
    ctx.font = "bold 17px sans-serif";
    const breeze = wind.multiplier > 1 ? "➜" : "←";
    for (let offset = 16; offset < wind.w; offset += 44) {
      ctx.fillText(breeze, x + offset, GAME.groundY - 55 - ((Math.floor(offset / 44) + Math.floor(visualTick / 15)) % 3) * 27);
    }
  }
  for (const plate of game.pressurePlates) {
    const x=worldToScreenX(game,plate.x);
    if(x > GAME.width || x+plate.w < 0) continue;
    ctx.fillStyle=plate.activated ? "#47ad85" : "#6e81a4";
    ctx.fillRect(x,GAME.groundY-10,plate.w,10);
    ctx.fillStyle=plate.activated ? "#c0f8dc" : "#f8df99";
    ctx.fillRect(x,GAME.groundY-18,plate.w * Math.min(1,plate.heldTicks/plate.holdTicks),5);
    ctx.fillStyle="#26334b";
    ctx.font="bold 15px sans-serif";
    ctx.fillText(plate.activated ? "○" : "ふむ",x+8,GAME.groundY-21);
  }
  for (const platform of game.movingPlatforms) {
    const x=worldToScreenX(game,platform.x);
    if(x>GAME.width || x+platform.w<0) continue;
    ctx.fillStyle="#c4dbd2";
    ctx.fillRect(x,GAME.groundY-10,platform.w,10);
    ctx.strokeStyle="#315d65";
    ctx.lineWidth=2;
    ctx.strokeRect(x,GAME.groundY-10,platform.w,10);
    ctx.fillStyle="#315d65";
    ctx.font="bold 14px sans-serif";
    ctx.fillText("⇄",x+10,GAME.groundY-15);
  }
  for (const floor of game.conveyors) {
    const x = worldToScreenX(game, floor.x);
    if (x > GAME.width || x + floor.w < 0) continue;
    ctx.fillStyle = "#d4e0de";
    ctx.fillRect(x, GAME.groundY - 10, floor.w, 10);
    ctx.fillStyle = floor.multiplier >= 1 ? "#266d91" : "#9d683f";
    for (let offset = 10; offset < floor.w; offset += 28) {
      ctx.fillText(floor.multiplier >= 1 ? "→" : "←", x + offset, GAME.groundY - 13);
    }
  }
  for (const floor of game.fragileFloors) {
    const x = worldToScreenX(game, floor.x);
    if (x > GAME.width || x + floor.w < 0) continue;
    ctx.fillStyle = floor.collapsed ? "#18283d" : "#d8b38d";
    ctx.fillRect(x, GAME.groundY - 9, floor.w, floor.collapsed ? 21 : 9);
    if (!floor.collapsed) {
      ctx.strokeStyle = "#805c46";
      for (let offset = 10; offset < floor.w; offset += 20) {
        ctx.beginPath();
        ctx.moveTo(x + offset, GAME.groundY - 9);
        ctx.lineTo(x + offset + 6, GAME.groundY);
        ctx.stroke();
      }
    }
  }
  for (const [index, coin] of game.coins.entries()) {
    if (coin.collected) continue;
    const x = worldToScreenX(game, coin.x);
    if (x < -32 || x > GAME.width + 32) continue;
    const bob = Math.sin(obstaclePhase(visualTick, index, 0.1)) * 3;
    const y = GAME.groundY - 35 + bob;
    const width = Math.max(3, GAME.coinRadius * Math.abs(Math.cos(obstaclePhase(visualTick, index, 0.08))));
    ctx.save();
    ctx.shadowColor = "#ffdf76";
    ctx.shadowBlur = 13;
    const gold = ctx.createLinearGradient(x - width, y, x + width, y);
    gold.addColorStop(0, "#e8a23a");
    gold.addColorStop(0.5, "#fff3b2");
    gold.addColorStop(1, "#c17b28");
    ctx.fillStyle = gold;
    ctx.strokeStyle = "#8e5b32";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, width, GAME.coinRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (const item of game.switches) {
    const x = worldToScreenX(game, item.x);
    if (x < -40 || x > GAME.width + 40) continue;
    const y = GAME.groundY - 32;
    ctx.fillStyle = "#324961";
    ctx.beginPath();
    ctx.roundRect(x - 15, y, 30, 31, 6);
    ctx.fill();
    ctx.fillStyle = "#f6ead1";
    ctx.beginPath();
    ctx.roundRect(x - 12, y + 3, 24, 23, 4);
    ctx.fill();
    ctx.fillStyle = item.skipped ? "#64748b" : item.activated ? "#4eaf8c" : SWITCH_PALETTE[item.color];
    ctx.beginPath();
    ctx.roundRect(x - 9, y + (item.activated ? 11 : 6), 18, item.activated ? 9 : 13, 4);
    ctx.fill();
    ctx.strokeStyle = "#354c5d";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(SWITCH_SYMBOLS[item.shape], x - 8, y + (item.activated ? 20 : 18));
    ctx.fillStyle = "#f9fcf3";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(item.skipped ? "→" : item.activated ? "○" : item.trap ? "!" : item.sequenceStep !== null ? String(item.sequenceStep) : "おす", x - (item.skipped || item.activated || item.trap || item.sequenceStep !== null ? 6 : 12), y - 7);
  }

  for (const door of game.doors) {
    const x = worldToScreenX(game, door.x);
    if (x < -GAME.doorWidth || x > GAME.width + GAME.doorWidth) continue;
    const y = GAME.groundY - GAME.doorHeight;
    ctx.fillStyle = "#4d4967";
    ctx.beginPath();
    ctx.roundRect(x - 5, y - 6, GAME.doorWidth + 10, GAME.doorHeight + 7, [12, 12, 2, 2]);
    ctx.fill();
    const width = door.open ? 5 : GAME.doorWidth - 6;
    const panel = ctx.createLinearGradient(x, 0, x + width, 0);
    panel.addColorStop(0, door.open ? "#7cd6b5" : "#9d77b5");
    panel.addColorStop(1, door.open ? "#367e70" : "#5b476f");
    ctx.fillStyle = panel;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 1, width, GAME.doorHeight - 3, 4);
    ctx.fill();
    if (door.broken) {
      ctx.fillStyle = "#ffd4a0";
      ctx.fillRect(x + 4, GAME.groundY - 18, 12, 5);
      ctx.fillRect(x + 20, GAME.groundY - 8, 9, 4);
    }
    if (door.vaulted) {
      ctx.fillStyle = "#a0efd3";
      ctx.font = "bold 17px sans-serif";
      ctx.fillText("↑", x + 10, y - 10);
    }
    if (door.open) {
      ctx.strokeStyle = "#b5f2d8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + GAME.doorWidth - 5, y + 15);
      ctx.lineTo(x + GAME.doorWidth - 5, GAME.groundY - 6);
      ctx.stroke();
    }
    if (door.sequenceLength > 0 && !door.open) {
      ctx.fillStyle = "#ffe6a1";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(String(Math.min(door.nextSequenceStep - 1, door.sequenceLength)) + "/" + String(door.sequenceLength), x + 3, y - 13);
    }
    if (door.open && door.autoCloseTicks > 0) {
      ctx.fillStyle = "#ffe6a1";
      const remaining = door.openedUntilTick === null ? 0 : Math.max(0, (door.openedUntilTick - game.elapsedTicks) / door.autoCloseTicks);
      ctx.fillRect(x + 4, y + 3, GAME.doorWidth * remaining, 5);
      ctx.fillText("⌛", x + 7, y - 9);
    }
    if (!door.open) {
      ctx.strokeStyle = "#cbb0dc";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 8, y + 12, 14, 62);
      ctx.fillStyle = "#fbe6a2";
      ctx.beginPath();
      ctx.arc(x + 23, y + 83, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const wall of game.walls) {
    const x = worldToScreenX(game, wall.x);
    if (x < -GAME.wallWidth || x > GAME.width + GAME.wallWidth) continue;
    const top = GAME.groundY - GAME.wallHeight;
    ctx.fillStyle = "#485468";
    ctx.beginPath();
    ctx.roundRect(x - 2, top, GAME.wallWidth + 4, GAME.wallHeight, 4);
    ctx.fill();
    ctx.fillStyle = "#b7aaa8";
    ctx.fillRect(x + 2, top + 3, GAME.wallWidth - 4, GAME.wallHeight - 5);
    for (let row = 0; row < 5; row++) {
      const y = top + 5 + row * 15;
      ctx.fillStyle = row % 2 === 0 ? "#d2c5b6" : "#c5ada5";
      ctx.fillRect(x + 3, y, GAME.wallWidth - 6, 13);
      ctx.strokeStyle = "#8e8090";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 13);
      ctx.lineTo(x + GAME.wallWidth - 3, y + 13);
      ctx.moveTo(x + (row % 2 ? 10 : 17), y);
      ctx.lineTo(x + (row % 2 ? 10 : 17), y + 13);
      ctx.stroke();
    }
    ctx.fillStyle = "#f0dfca";
    ctx.fillRect(x + 4, top + 1, GAME.wallWidth - 8, 5);
    ctx.strokeStyle = "#4b485c";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, top, GAME.wallWidth, GAME.wallHeight);
  }

  for (const [index, ghost] of game.ghosts.entries()) {
    const x = worldToScreenX(game, ghost.x);
    if (x < -GAME.ghostWidth || x > GAME.width + GAME.ghostWidth) continue;
    const y = GAME.groundY - GAME.ghostHeight - GAME.ghostClearance + Math.sin(obstaclePhase(visualTick, index, 0.07)) * 2;
    ctx.save();
    ctx.shadowColor = "#d8ecfc";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(240, 246, 255, 0.89)";
    ctx.strokeStyle = "#60799a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 55);
    ctx.lineTo(x + 5, y + 22);
    ctx.quadraticCurveTo(x + 5, y + 2, x + 22, y + 2);
    ctx.quadraticCurveTo(x + 39, y + 2, x + 39, y + 22);
    ctx.lineTo(x + 39, y + 55);
    for (let j = 0; j < 4; j++) {
      const xx = x + 39 - (j + 1) * 8.5;
      ctx.quadraticCurveTo(xx + 4, y + 72 + Math.sin(obstaclePhase(visualTick, index + j, 0.1)) * 3, xx, y + 57);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#344966";
    for (const eyeX of [14, 30]) {
      ctx.beginPath();
      ctx.ellipse(x + eyeX, y + 29, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawFinish(ctx: CanvasRenderingContext2D, game: GameState): void {
  const x = worldToScreenX(game, game.goalX);
  if (x >= GAME.width || x + GAME.goalWidth <= 0) return;
  const y = GAME.groundY - GAME.goalHeight;
  ctx.save();
  ctx.shadowColor = "#fce9a4";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#f8dd91";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x + 1, GAME.groundY);
  ctx.lineTo(x + 1, y + 18);
  ctx.quadraticCurveTo(x + 16, y - 10, x + 31, y + 18);
  ctx.lineTo(x + 31, GAME.groundY);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#7fd3ba";
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 24, 16, 29, 7);
  ctx.fill();
  ctx.restore();
}
