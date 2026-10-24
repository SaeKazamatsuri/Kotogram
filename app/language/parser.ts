import type { GameCondition, GameInstruction, GameProgram, SwitchColor, SwitchShape } from "../game/core";
import conditionsDictionary from "../../public/dictionary/conditions.json" with { type: "json" };
import actionsDictionary from "../../public/dictionary/actions.json" with { type: "json" };
export type Condition = GameCondition;
export type Action = "jump" | "powerJump" | "crouch" | "collect" | "run" | "sprint" | "walk" | "press" | "skip";
export type Vocabulary = {
  conditions?: Record<string, string[]>;
  actions?: Record<string, string[]>;
};
export type SourcePosition = { line: number; column: number };
export type Span = { start: SourcePosition; end: SourcePosition };
export type Diagnostic = {
  code: "unknown" | "syntax" | "action" | "end" | "count" | "limit" | "unsupported";
  message: string;
  line: number;
  column: number;
};
export type TokenKind =
  | "condition" | "attribute" | "action" | "number" | "count" | "repeat" | "end"
  | "if" | "then" | "or" | "particle" | "unknown";
export type Token = { kind: TokenKind; value: string; raw: string; line: number; column: number; endColumn?: number };
export type RuleStatement = {
  kind: "rule";
  conditions: Condition[];
  operator: "or";
  action: Action;
  maxFires: number | null;
  span: Span;
};
export type ActionStatement = { kind: "action"; action: Action; repeat: number; span: Span };
export type RepeatStatement = { kind: "repeat"; repeat: number; body: Statement[]; span: Span };
export type IfStatement = { kind: "if"; conditions: Condition[]; operator: "or"; body: Statement[]; span: Span };
export type Statement = RuleStatement | ActionStatement | RepeatStatement | IfStatement;
export type ParseResult = { body: Statement[]; diagnostics: Diagnostic[]; tokens: Token[][] };
export type ExecutableRule = { cond?: Condition; conds?: Condition[]; action: Action; maxFires?: number };
export type SourceMap = { watchers: number[]; watcherConditions: number[]; watcherLoops: (number | null)[]; steps: number[] };
export type CompileResult = { rules: ExecutableRule[]; program: GameProgram; sourceMap: SourceMap; diagnostics: Diagnostic[] };

const DEFAULT_CONDITIONS: Record<string, string[]> = conditionsDictionary;
export const SWITCH_ATTRIBUTES: readonly { raw: string; value: string }[] = [
  { raw: "あかい", value: "color:red" },
  { raw: "あか", value: "color:red" },
  { raw: "みどり", value: "color:green" },
  { raw: "あおい", value: "color:blue" },
  { raw: "あお", value: "color:blue" },
  { raw: "きいろい", value: "color:yellow" },
  { raw: "きいろ", value: "color:yellow" },
  { raw: "むらさき", value: "color:purple" },
  { raw: "まる", value: "shape:circle" },
  { raw: "ばつ", value: "shape:cross" },
  { raw: "ばってん", value: "shape:cross" },
  { raw: "さんかく", value: "shape:triangle" },
  { raw: "しかく", value: "shape:square" },
  { raw: "ほし", value: "shape:star" },
];
const DEFAULT_ACTIONS: Record<Action, string[]> = actionsDictionary;
const CONTROL: { raw: string; kind: TokenKind }[] = [
  { raw: "くりかえす", kind: "repeat" },
  { raw: "くりかえし", kind: "repeat" },
  { raw: "くりかえ", kind: "repeat" },
  { raw: "みつけたら", kind: "then" },
  { raw: "みつかったら", kind: "then" },
  { raw: "みつけるたびに", kind: "then" },
  { raw: "ちかづいたら", kind: "then" },
  { raw: "あらわれたら", kind: "then" },
  { raw: "みえたとき", kind: "then" },
  { raw: "ぶつかりそうなら", kind: "then" },
  { raw: "みつけると", kind: "then" },
  { raw: "みえたら", kind: "then" },
  { raw: "あったときは", kind: "then" },
  { raw: "あるときは", kind: "then" },
  { raw: "あるとき", kind: "then" },
  { raw: "あったら", kind: "then" },
  { raw: "あれば", kind: "then" },
  { raw: "いるときは", kind: "then" },
  { raw: "きたら", kind: "then" },
  { raw: "ならば", kind: "then" },
  { raw: "なら", kind: "then" },
  { raw: "ときは", kind: "then" },
  { raw: "おわり", kind: "end" },
  { raw: "かい", kind: "count" },
  { raw: "もし", kind: "if" },
  { raw: "する", kind: "particle" },
  { raw: "して", kind: "particle" },
  { raw: "または", kind: "or" },
  { raw: "あるいは", kind: "or" },
  { raw: "や", kind: "or" },
  { raw: "と", kind: "or" },
  { raw: "ください", kind: "particle" },
  { raw: "ね", kind: "particle" },
  { raw: "すぐ", kind: "particle" },
  { raw: "ここで", kind: "particle" },
  { raw: "に", kind: "particle" },
  { raw: "が", kind: "particle" },
  { raw: "を", kind: "particle" },
  { raw: "の", kind: "particle" },
  { raw: "で", kind: "particle" },
  { raw: "は", kind: "particle" },
  { raw: "へ", kind: "particle" },
  { raw: "も", kind: "particle" },
];
export const CONTROL_WORDS = CONTROL.map(({ raw, kind }) => ({ raw, kind }));

const MAX_SOURCE = 2000;
const MAX_LINES = 100;
const MAX_DEPTH = 8;
const MAX_REPEAT = 30;

export function normalizeLine(input: string): string {
  return input.normalize("NFC")
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[ \t\u3000]/g, "");
}

function createLexicon(vocabulary: Vocabulary) {
  const words: { raw: string; kind: TokenKind; value: string }[] = [];
  const seen = new Map<string, string>();
  const pushWords = (source: Record<string, string[]>, kind: TokenKind) => {
    for (const [value, variants] of Object.entries(source)) {
      for (const raw of variants) {
        if (!raw || !/^[ぁ-ゟー]+$/u.test(raw)) continue;
        const meaning = kind + ":" + value;
        const previous = seen.get(raw);
        if (previous && previous !== meaning) throw new Error("Conflicting vocabulary: " + raw);
        if (!previous) {
          seen.set(raw, meaning);
          words.push({ raw, kind, value });
        }
      }
    }
  };
  const allowedConditions = Object.fromEntries(Object.entries(DEFAULT_CONDITIONS).map(([key, words]) => [key, [...words, ...(vocabulary.conditions?.[key] ?? [])]]));
  const allowedActions = Object.fromEntries(Object.entries(DEFAULT_ACTIONS).map(([key, words]) => [key, [...words, ...(vocabulary.actions?.[key] ?? [])]]));
  pushWords(allowedConditions, "condition");
  pushWords(allowedActions, "action");
  for (const item of SWITCH_ATTRIBUTES) pushWords({ [item.value]: [item.raw] }, "attribute");
  for (const { raw, kind } of CONTROL) {
    if (seen.has(raw)) throw new Error("Vocabulary conflicts with control word: " + raw);
    seen.set(raw, kind + ":" + raw);
    words.push({ raw, kind, value: raw });
  }
  return words.sort((a, b) => b.raw.length - a.raw.length);
}

export function tokenizeLine(source: string, line: number, vocabulary: Vocabulary = {}): Token[] {
  const normalized = source.normalize("NFC").replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  const columns: number[] = [];
  for (let column = 0; column < normalized.length; column++) {
    if (!/[ \t\u3000]/u.test(normalized[column]!)) columns.push(column + 1);
  }
  const input = normalizeLine(source);
  const lexicon = createLexicon(vocabulary);
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < input.length) {
    const rest = input.slice(offset);
    const digit = rest.match(/^\d+/u)?.[0];
    if (digit) {
      tokens.push({ kind: "number", value: digit, raw: digit, line, column: columns[offset]!, endColumn: columns[offset + digit.length - 1]! + 1 });
      offset += digit.length;
      continue;
    }
    const match = lexicon.find((word) => rest.startsWith(word.raw));
    if (match) {
      tokens.push({ kind: match.kind, value: match.value, raw: match.raw, line, column: columns[offset]!, endColumn: columns[offset + match.raw.length - 1]! + 1 });
      offset += match.raw.length;
      continue;
    }
    let end = offset + 1;
    while (end < input.length && !/^\d/u.test(input.slice(end)) && !lexicon.some((word) => input.startsWith(word.raw, end))) end++;
    const raw = input.slice(offset, end);
    tokens.push({ kind: "unknown", value: raw, raw, line, column: columns[offset]!, endColumn: columns[end - 1]! + 1 });
    offset = end;
  }
  return tokens;
}

const error = (code: Diagnostic["code"], message: string, token: Token | { line: number; column: number }): Diagnostic =>
  ({ code, message, line: token.line, column: token.column });
const spanOf = (tokens: Token[]): Span => ({
  start: { line: tokens[0].line, column: tokens[0].column },
  end: { line: tokens.at(-1)!.line, column: tokens.at(-1)!.endColumn ?? tokens.at(-1)!.column + tokens.at(-1)!.raw.length },
});

function positiveCount(token: Token, diagnostics: Diagnostic[]): number | null {
  const value = Number(token.value);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_REPEAT) {
    diagnostics.push(error("count", "かいすうは 1から" + MAX_REPEAT + "までにしてね", token));
    return null;
  }
  return value;
}

function parseConditions(tokens: Token[], diagnostics: Diagnostic[]): Condition[] | null {
  const misplaced = tokens.find((token, index) => token.kind === "then" && tokens[index + 1]?.kind === "particle");
  if (misplaced) {
    diagnostics.push(error("syntax", "じょうけんの あとに ことばが つづいているよ", misplaced));
    return null;
  }
  const meaningful = tokens.filter((token) => token.kind !== "particle" && token.kind !== "then" && token.kind !== "if");
  if (meaningful.length >= 2 && meaningful[0].value === "ahead" && meaningful[1].kind === "condition") meaningful.shift();
  else if (meaningful.length === 2 && meaningful[0].kind === "condition" && meaningful[1].value === "ahead") meaningful.pop();
  const conditions: Condition[] = [];
  let expectCondition = true;
  let color: SwitchColor | null = null;
  let shape: SwitchShape | null = null;
  for (const token of meaningful) {
    if (expectCondition && token.kind === "attribute") {
      const [kind, value] = token.value.split(":");
      if ((kind === "color" && color !== null) || (kind === "shape" && shape !== null)) {
        diagnostics.push(error("syntax", "いろや かたちは 1つずつ えらんでね", token));
        return null;
      }
      if (kind === "color") color = value as SwitchColor;
      else shape = value as SwitchShape;
    } else if (expectCondition && token.kind === "condition") {
      if ((color || shape) && token.value !== "switch") {
        diagnostics.push(error("unsupported", "いろや かたちは ぼたんに つけてね", token));
        return null;
      }
      const condition = color || shape
        ? `switch:${color ?? "*"}:${shape ?? "*"}` as Condition
        : token.value as Condition;
      if (!conditions.includes(condition)) conditions.push(condition);
      color = null;
      shape = null;
      expectCondition = false;
    } else if (!expectCondition && token.kind === "or") {
      expectCondition = true;
    } else {
      diagnostics.push(error("syntax", "じょうけんの つなぎかたを かくにんしてね", token));
      return null;
    }
  }
  if (expectCondition || conditions.length === 0) {
    diagnostics.push(error("syntax", "じょうけんを かいてね", tokens.at(-1) ?? { line: 1, column: 1 }));
    return null;
  }
  return conditions;
}

function parseSimple(tokens: Token[], diagnostics: Diagnostic[]): RuleStatement | ActionStatement | null {
  while (tokens.at(-1)?.kind === "particle" && ["ね", "ください"].includes(tokens.at(-1)!.raw)) tokens = tokens.slice(0, -1);
  const longForm = ["をする", "をして"].includes(tokens.slice(-2).map((token) => token.raw).join(""));
  const actionIndex = longForm ? tokens.length - 3 : tokens.length - 1;
  const actionToken = tokens[actionIndex];
  if (!actionToken || actionToken.kind !== "action") {
    diagnostics.push(error("action", "さいごに うごきを かいてね（れい：とぶ）", tokens.at(-1) ?? { line: 1, column: 1 }));
    return null;
  }
  const prefix = tokens.slice(0, actionIndex);
  let repeat = 1;
  let specified = false;
  const numberPosition = prefix.findIndex((token) => token.kind === "number");
  if (numberPosition >= 0) {
    const numberToken = prefix[numberPosition];
    if (prefix[numberPosition + 1]?.kind !== "count") {
      diagnostics.push(error("count", "すうじの あとに『かい』を つけてね", numberToken));
      return null;
    }
    const count = positiveCount(numberToken, diagnostics);
    if (count === null) return null;
    repeat = count;
    specified = true;
    prefix.splice(numberPosition, 2);
  }
  if (prefix.some((token) => token.kind === "number" || token.kind === "count")) {
    diagnostics.push(error("count", "かいすうは 1つだけにしてね", prefix.find((token) => token.kind === "number" || token.kind === "count")!));
    return null;
  }
  if (prefix.length === 0 || prefix.every((token) => token.kind === "particle")) {
    if (actionToken.value === "skip") {
      diagnostics.push(error("unsupported", "みおくる ときは『すいっち』を かいてね", actionToken));
      return null;
    }
    return { kind: "action", action: actionToken.value as Action, repeat, span: spanOf(tokens) };
  }
  const conditions = parseConditions(prefix, diagnostics);
  if (!conditions) return null;
  if (actionToken.value === "skip" && (conditions.length === 0 || !conditions.every((condition) => condition === "switch" || condition.startsWith("switch:")))) {
    diagnostics.push(error("unsupported", "みおくる のは『すいっち』だけだよ", actionToken));
    return null;
  }
  return { kind: "rule", conditions, operator: "or", action: actionToken.value as Action, maxFires: specified ? repeat : null, span: spanOf(tokens) };
}

export function parseSource(source: string | string[], vocabulary: Vocabulary = {}): ParseResult {
  const lines = Array.isArray(source) ? source : source.replace(/\r\n?/g, "\n").split("\n");
  const diagnostics: Diagnostic[] = [];
  if (lines.length > MAX_LINES || lines.join("\n").length > MAX_SOURCE) {
    diagnostics.push(error("limit", "めいれいが ながすぎるよ", { line: 1, column: 1 }));
    return { body: [], diagnostics, tokens: [] };
  }
  const tokenLines = lines.map((line, i) => tokenizeLine(line, i + 1, vocabulary));
  let index = 0;
  function statements(depth: number, opener?: Token): Statement[] {
    const body: Statement[] = [];
    while (index < tokenLines.length) {
      const tokens = tokenLines[index++];
      if (!tokens.length) continue;
      const first = tokens[0];
      const unknown = tokens.find((token) => token.kind === "unknown");
      if (unknown) {
        const message = unknown.raw === "よける"
          ? "『よける』は めいれいに つかえないよ。かべや あなには『じゃんぷ』、おばけには『しゃがむ』を つかってね"
          : "『" + unknown.raw + "』は つかえない ことばだよ";
        diagnostics.push(error("unknown", message, unknown));
        continue;
      }
      if (first.kind === "end") {
        if (tokens.length !== 1) {
          diagnostics.push(error("syntax", "『おわり』は 1ぎょうで かいてね", tokens[1]));
          continue;
        }
        if (opener) return body;
        diagnostics.push(error("end", "『おわり』に あう はじまりが ないよ", first));
        continue;
      }
      if (depth > MAX_DEPTH) {
        diagnostics.push(error("limit", "くりかえしが ふかすぎるよ", first));
        continue;
      }
      if (first.kind === "number" && tokens[1]?.kind === "count" && tokens[2]?.kind === "repeat") {
        if (tokens.length !== 3) {
          diagnostics.push(error("syntax", "『くりかえす』の あとは かいぎょうしてね", tokens[3]));
          continue;
        }
        const count = positiveCount(first, diagnostics);
        const nested = statements(depth + 1, first);
        if (count !== null && nested.length) {
          body.push({ kind: "repeat", repeat: count, body: nested, span: { start: { line: first.line, column: first.column }, end: { line: index, column: 1 } } });
        } else if (!nested.length) {
          diagnostics.push(error("syntax", "くりかえす なかみを かいてね", first));
        }
        continue;
      }
      if (first.kind === "if" && tokens.at(-1)?.kind === "then") {
        const conditions = parseConditions(tokens.slice(1, -1), diagnostics);
        const nested = statements(depth + 1, first);
        if (conditions && nested.length) {
          body.push({ kind: "if", conditions, operator: "or", body: nested, span: { start: { line: first.line, column: first.column }, end: { line: index, column: 1 } } });
        } else if (!nested.length) {
          diagnostics.push(error("syntax", "もしの あとに うごきを かいてね", first));
        }
        continue;
      }
      if (tokens.some((token) => token.kind === "repeat" || token.kind === "end")) {
        diagnostics.push(error("syntax", "くりかえす かきかたを かくにんしてね", first));
        continue;
      }
      const parsed = opener?.kind === "if" && tokens.length === 1 && first.kind === "action" && first.value === "skip"
        ? { kind: "action" as const, action: "skip" as const, repeat: 1, span: spanOf(tokens) }
        : parseSimple(tokens, diagnostics);
      if (parsed) body.push(parsed);
    }
    if (opener) diagnostics.push(error("end", "さいごに『おわり』を かいてね", opener));
    return body;
  }
  return { body: statements(0), diagnostics, tokens: tokenLines };
}

export function compileProgram(parsed: ParseResult): CompileResult {
  const diagnostics = [...parsed.diagnostics];
  const watchers: ExecutableRule[] = [];
  const steps: GameInstruction[] = [];
  const rules: ExecutableRule[] = [];
  const sourceMap: SourceMap = { watchers: [], watcherConditions: [], watcherLoops: [], steps: [] };
  const addStep = (instruction: GameInstruction, line: number) => { steps.push(instruction); sourceMap.steps.push(line); };

  const watcher = (node: RuleStatement, limit?: number, repeatLine?: number, conditionLine?: number) => {
    if (limit !== undefined && node.maxFires !== null) {
      diagnostics.push(error("unsupported", "かいすうを 2かしょに かかないでね", node.span.start));
      return;
    }
    const rule: ExecutableRule = {
      action: node.action,
      conds: [...node.conditions],
      maxFires: limit ?? node.maxFires ?? undefined,
    };
    watchers.push(rule);
    sourceMap.watchers.push(node.span.start.line);
    sourceMap.watcherConditions.push(conditionLine ?? node.span.start.line);
    sourceMap.watcherLoops.push(repeatLine ?? null);
    rules.push(rule);
  };

  const procedural = (node: Statement): void => {
    if (node.kind === "action") {
      addStep({ op: "action", action: node.action, count: node.repeat }, node.span.start.line);
    } else if (node.kind === "rule") {
      addStep({
        op: "wait",
        conds: [...node.conditions],
        action: node.action,
        count: node.maxFires ?? 1,
      }, node.span.start.line);
    } else if (node.kind === "if") {
      addStep({ op: "wait", conds: [...node.conditions], count: 1 }, node.span.start.line);
      for (const child of node.body) procedural(child);
    } else {
      const begin = steps.length;
      addStep({ op: "repeat-start", count: node.repeat, end: -1 }, node.span.start.line);
      for (const child of node.body) procedural(child);
      const end = steps.length;
      addStep({ op: "repeat-end", start: begin }, node.span.end.line);
      steps[begin] = { op: "repeat-start", count: node.repeat, end };
    }
  };

  for (const node of parsed.body) {
    if (node.kind === "rule") {
      watcher(node);
    } else if (node.kind === "action") {
      procedural(node);
      if (node.repeat === 1) rules.push({ action: node.action });
    } else if (node.kind === "if") {
      if (node.body.length === 1 && node.body[0].kind === "action" && node.body[0].repeat === 1) {
        if (node.body[0].action === "skip" && (node.conditions.length !== 1 || !(node.conditions[0] === "switch" || node.conditions[0].startsWith("switch:")))) {
          diagnostics.push(error("unsupported", "みおくる のは『すいっち』だけだよ", node.span.start));
          continue;
        }
        watcher({
          kind: "rule",
          conditions: node.conditions,
          operator: "or",
          action: node.body[0].action,
          maxFires: null,
          span: node.body[0].span,
        }, undefined, undefined, node.span.start.line);
      } else {
        diagnostics.push(error("unsupported", "もしの なかは うごきを 1つ かいてね", node.span.start));
      }
    } else if (node.body.length === 1 && node.body[0].kind === "rule" && node.body[0].maxFires === null) {
      watcher(node.body[0], node.repeat, node.span.start.line);
    } else {
      procedural(node);
    }
  }

  if (steps.length > 1024) {
    diagnostics.push(error("limit", "めいれいの くみあわせが おおすぎるよ", { line: 1, column: 1 }));
  }
  const program: GameProgram = diagnostics.length
    ? { watchers: [], steps: [] }
    : { watchers, steps };
  return { rules: diagnostics.length ? [] : rules, program, sourceMap: diagnostics.length ? { watchers: [], watcherConditions: [], watcherLoops: [], steps: [] } : sourceMap, diagnostics };
}

export function analyzeProgram(source: string | string[], vocabulary: Vocabulary = {}) {
  const parsed = parseSource(source, vocabulary);
  return { ...parsed, ...compileProgram(parsed) };
}
