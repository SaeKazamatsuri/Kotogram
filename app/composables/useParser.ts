// 最小パーサ：行単位 + 非ネストの くりかえし
export type Cond = "wall" | "enemy" | "hole" | "coin";
export type Act = "jump" | "crouch" | "collect";
export type Rule = { cond?: Cond; action: Act };

type Dict = {
  conditions: Record<Cond, string[]>;
  actions: Record<Act, string[]>;
};

function fwToHalfDigits(s: string) {
  return s.replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0)
  );
}

export function useParser() {
  function parseProgram(lines: string[], dict: Dict): Rule[] {
    const rules: Rule[] = [];
    const condKeys: Cond[] = ["hole", "enemy", "wall", "coin"]; // 優先度の参考（上ほど強）
    const actKeys: Act[] = ["jump", "crouch", "collect"];

    const loopBuf: string[] = [];
    let looping = false;
    let loopCount = 0;

    const flushLoop = () => {
      for (let i = 0; i < loopCount; i++)
        rules.push(...parseProgram(loopBuf, dict));
      loopBuf.length = 0;
      looping = false;
      loopCount = 0;
    };

    for (let raw of lines) {
      const line = fwToHalfDigits(raw || "").trim();
      if (!line) continue;

      // ループ開始: 例) "3かい くりかえす"
      const m = line.match(
        /(\d+)\s*(?:かい|回)?\s*(?:くりかえ|くりかえす|くりかえし)/
      );
      if (m) {
        looping = true;
        loopCount = Math.max(0, parseInt(m[1] || "0", 10));
        continue;
      }

      if (looping) {
        if (/^おわり$/.test(line)) {
          flushLoop();
          continue;
        }
        loopBuf.push(line);
        continue;
      }

      // 条件と動作の抽出（どちらかが見つかればOK）
      let foundCond: Cond | undefined;
      for (const ck of condKeys) {
        const list = dict.conditions?.[ck] ?? [];
        if (list.some((w) => w && line.includes(w))) {
          foundCond = ck;
          break;
        }
      }

      let foundAct: Act | undefined;
      for (const ak of actKeys) {
        const list = dict.actions?.[ak] ?? [];
        if (list.some((w) => w && line.includes(w))) {
          foundAct = ak;
          break;
        }
      }

      if (foundAct) rules.push({ cond: foundCond, action: foundAct });
      // 動作がない行は最小実装では捨てる（余計な推測をしない）
    }

    // ループ閉じ忘れは無視（最小）
    return rules;
  }

  return { parseProgram };
}
