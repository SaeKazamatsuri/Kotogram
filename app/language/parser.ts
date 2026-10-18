import type { GameInstruction, GameProgram } from "../game/core";
export type Condition = "wall" | "hole" | "enemy" | "ahead" | "coin";
export type Action = "jump" | "crouch" | "collect" | "run" | "walk";
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
  | "condition" | "action" | "number" | "count" | "repeat" | "end"
  | "if" | "then" | "or" | "particle" | "unknown";
export type Token = { kind: TokenKind; value: string; raw: string; line: number; column: number };
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
export type CompileResult = { rules: ExecutableRule[]; program: GameProgram; diagnostics: Diagnostic[] };

const DEFAULT_CONDITIONS: Record<Condition, string[]> = {
  wall: ["かべ"], hole: ["あな"], enemy: ["おばけ", "てき"],
  ahead: ["まえ"], coin: ["こいん"],
};
const DEFAULT_ACTIONS: Record<Action, string[]> = {
  jump: ["じゃんぷ", "とぶ"], crouch: ["しゃがむ", "かがむ"], collect: ["とる"],
  run: ["はしる"], walk: ["あるく"],
};
const CONTROL: { raw: string; kind: TokenKind }[] = [
  { raw: "くりかえす", kind: "repeat" },
  { raw: "くりかえし", kind: "repeat" },
  { raw: "くりかえ", kind: "repeat" },
  { raw: "あったら", kind: "then" },
  { raw: "おわり", kind: "end" },
  { raw: "かい", kind: "count" },
  { raw: "もし", kind: "if" },
  { raw: "なら", kind: "then" },
  { raw: "と", kind: "or" },
  { raw: "に", kind: "particle" },
  { raw: "が", kind: "particle" },
  { raw: "を", kind: "particle" },
  { raw: "の", kind: "particle" },
];
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
  const pushWords = (source: Record<string, string[]>, kind: TokenKind) => {
    for (const [value, variants] of Object.entries(source)) {
      for (const raw of variants) {
        if (raw && /^[ぁ-ゟー]+$/u.test(raw)) words.push({ raw, kind, value });
      }
    }
  };
  const allowedConditions = Object.fromEntries(Object.entries(DEFAULT_CONDITIONS).map(([key, words]) => [key, [...words, ...(vocabulary.conditions?.[key] ?? [])]]));
  const allowedActions = Object.fromEntries(Object.entries(DEFAULT_ACTIONS).map(([key, words]) => [key, [...words, ...(vocabulary.actions?.[key] ?? [])]]));
  pushWords(allowedConditions, "condition");
  pushWords(allowedActions, "action");
  for (const { raw, kind } of CONTROL) words.push({ raw, kind, value: raw });
  return words.sort((a, b) => b.raw.length - a.raw.length);
}

export function tokenizeLine(source: string, line: number, vocabulary: Vocabulary = {}): Token[] {
  const input = normalizeLine(source);
  const lexicon = createLexicon(vocabulary);
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < input.length) {
    const rest = input.slice(offset);
    const digit = rest.match(/^\d+/u)?.[0];
    if (digit) {
      tokens.push({ kind: "number", value: digit, raw: digit, line, column: offset + 1 });
      offset += digit.length;
      continue;
    }
    const match = lexicon.find((word) => rest.startsWith(word.raw));
    if (match) {
      tokens.push({ kind: match.kind, value: match.value, raw: match.raw, line, column: offset + 1 });
      offset += match.raw.length;
      continue;
    }
    tokens.push({ kind: "unknown", value: input[offset], raw: input[offset], line, column: offset + 1 });
    offset++;
  }
  return tokens;
}

const error = (code: Diagnostic["code"], message: string, token: Token | { line: number; column: number }): Diagnostic =>
  ({ code, message, line: token.line, column: token.column });
const spanOf = (tokens: Token[]): Span => ({
  start: { line: tokens[0].line, column: tokens[0].column },
  end: { line: tokens.at(-1)!.line, column: tokens.at(-1)!.column + tokens.at(-1)!.raw.length },
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
  const meaningful = tokens.filter((token) => token.kind !== "particle" && token.kind !== "then" && token.kind !== "if");
  if (meaningful.length >= 2 && meaningful[0].value === "ahead" && meaningful[1].kind === "condition") meaningful.shift();
  const conditions: Condition[] = [];
  let expectCondition = true;
  for (const token of meaningful) {
    if (expectCondition && token.kind === "condition") {
      if (!conditions.includes(token.value as Condition)) conditions.push(token.value as Condition);
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
  const actionToken = tokens.at(-1);
  if (!actionToken || actionToken.kind !== "action") {
    diagnostics.push(error("action", "さいごに うごきを かいてね（れい：とぶ）", tokens.at(-1) ?? { line: 1, column: 1 }));
    return null;
  }
  const prefix = tokens.slice(0, -1);
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
    return { kind: "action", action: actionToken.value as Action, repeat, span: spanOf(tokens) };
  }
  const conditions = parseConditions(prefix, diagnostics);
  if (!conditions) return null;
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
        diagnostics.push(error("unknown", "『" + unknown.raw + "』は つかえない ことばだよ", unknown));
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
      const parsed = parseSimple(tokens, diagnostics);
      if (parsed) body.push(parsed);
    }
    if (opener) diagnostics.push(error("end", "さいごに『おわり』を かいてね", opener));
    return body;
  }
  return { body: statements(0), diagnostics, tokens: tokenLines };
}

/**
 * Compile a mixed program into two independent execution tracks:
 * 1. All top-level conditionals are always-on watchers.
 * 2. Unconditional actions and multi-command repeats form a bounded
 *    procedural bytecode stream. Rules inside those repeats wait for the
 *    next eligible obstacle, then advance to the next statement.
 *
 * A lone rule inside a top-level repeat remains an equivalent bounded
 * watcher: 3かいくりかえす / かべとぶ / おわり === かべ3かいとぶ.
 */
export function compileProgram(parsed: ParseResult): CompileResult {
  const diagnostics = [...parsed.diagnostics];
  const watchers: ExecutableRule[] = [];
  const steps: GameInstruction[] = [];
  // Backward-compatible output for simple programs; GameProgram is canonical.
  const rules: ExecutableRule[] = [];

  const watcher = (node: RuleStatement, limit?: number) => {
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
    rules.push(rule);
  };

  const procedural = (node: Statement): void => {
    if (node.kind === "action") {
      steps.push({ op: "action", action: node.action, count: node.repeat });
    } else if (node.kind === "rule") {
      steps.push({
        op: "wait",
        conds: [...node.conditions],
        action: node.action,
        count: node.maxFires ?? 1,
      });
    } else if (node.kind === "if") {
      // In a procedure, "もし" waits for the next qualifying obstacle.
      steps.push({ op: "wait", conds: [...node.conditions], count: 1 });
      for (const child of node.body) procedural(child);
    } else {
      const begin = steps.length;
      steps.push({ op: "repeat-start", count: node.repeat, end: -1 });
      for (const child of node.body) procedural(child);
      const end = steps.length;
      steps.push({ op: "repeat-end", start: begin });
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
      // A top-level if is an always-on rule, matching its one-line shorthand.
      if (node.body.length === 1 && node.body[0].kind === "action" && node.body[0].repeat === 1) {
        watcher({
          kind: "rule",
          conditions: node.conditions,
          operator: "or",
          action: node.body[0].action,
          maxFires: null,
          span: node.span,
        });
      } else {
        diagnostics.push(error("unsupported", "もしの なかは うごきを 1つ かいてね", node.span.start));
      }
    } else if (node.body.length === 1 && node.body[0].kind === "rule" && node.body[0].maxFires === null) {
      watcher(node.body[0], node.repeat);
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
  return { rules: diagnostics.length ? [] : rules, program, diagnostics };
}

export function analyzeProgram(source: string | string[], vocabulary: Vocabulary = {}) {
  const parsed = parseSource(source, vocabulary);
  return { ...parsed, ...compileProgram(parsed) };
}
