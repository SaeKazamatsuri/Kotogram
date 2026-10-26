import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProgram, tokenizeLine, normalizeLine, CONTROL_WORDS, SWITCH_ATTRIBUTES } from "../app/language/parser.ts";
import actionsDictionary from "../public/dictionary/actions.json" with { type: "json" };
import conditionsDictionary from "../public/dictionary/conditions.json" with { type: "json" };
import { createGame, runToCompletion } from "../app/game/core.ts";

function valid(source, vocabulary) {
  const parsed = analyzeProgram(source, vocabulary);
  assert.deepEqual(parsed.diagnostics, [], JSON.stringify(parsed.diagnostics));
  return parsed;
}

test("short and detailed conditional commands are equivalent", () => {
  const short = valid("かべとぶ");
  assert.deepEqual(short.rules[0].conds, ["wall"]);
  for (const phrase of ["かべならとぶ", "まえにかべならじゃんぷ", "まえにかべがあったらとぶ"]) {
    assert.deepEqual(valid(phrase).rules, short.rules);
  }
  assert.deepEqual(valid("もし まえに かべが あったら\nとぶ\nおわり").rules, short.rules);
});

test("OR conditions tokenize and execute as a single rule", () => {
  const parsed = valid("かべとあなとぶ");
  assert.equal(parsed.body[0].kind, "rule");
  assert.deepEqual(parsed.body[0].conditions, ["wall", "hole"]);
  assert.deepEqual(parsed.rules[0].conds, ["wall", "hole"]);
  assert.deepEqual(tokenizeLine("かべとあなとぶ", 1).map(t => t.kind), ["condition", "or", "condition", "action"]);
  const stage = { goal: 1800, scrollSpeed: 3, objects: [
    { type: "wall", position: 600 },
    { type: "hole", position: 1000, width: 80 },
    { type: "wall", position: 1400 }
  ]};
  const game = runToCompletion(createGame(stage, parsed.rules));
  assert.equal(game.status, "cleared");
  assert.equal(game.fired[0].size, 3);
});

test("ahead and unconditioned commands retain distinct meanings", () => {
  assert.deepEqual(valid("まえとぶ").rules[0].conds, ["ahead"]);
  assert.deepEqual(valid("まえにあながあったらとぶ").rules[0].conds, ["hole"]);
  assert.deepEqual(valid("とぶ").rules, [{ action: "jump" }]);
});

test("limited repeated conditions stop after their successful count", () => {
  const parsed = valid("かべとあな３かいとぶ");
  assert.equal(parsed.body[0].maxFires, 3);
  assert.equal(parsed.rules[0].maxFires, 3);
  const stage = { goal: 1600, scrollSpeed: 3, objects: [600, 1000, 1400].map(position => ({ type: "wall", position })) };
  const twice = runToCompletion(createGame(stage, valid("かべ2かいとぶ").rules));
  assert.equal(twice.status, "failed");
  assert.equal(twice.failureReason, "wall");
  assert.equal(twice.fired[0].size, 2);
  assert.equal(runToCompletion(createGame(stage, valid("かべ3かいとぶ").rules)).status, "cleared");
});

test("one rule repeat block becomes a bounded conditional rule", () => {
  const parsed = valid("3かいくりかえす\nかべとぶ\nおわり");
  assert.equal(parsed.body[0].kind, "repeat");
  assert.equal(parsed.body[0].repeat, 3);
  assert.deepEqual(parsed.rules, [{ action: "jump", conds: ["wall"], maxFires: 3 }]);
});

test("invalid expressions produce diagnostics and never partial output", () => {
  const invalid = [
    "かべ", "かべあなとぶ", "かべとあなと", "ほげとぶ",
    "かべ0かいとぶ", "かべ99999かいとぶ", "おわり",
    "3かいくりかえす\nかべとぶ", "かべとぶ\nわからない"
  ];
  for (const source of invalid) {
    const parsed = analyzeProgram(source);
    assert.ok(parsed.diagnostics.length > 0, source);
    assert.deepEqual(parsed.rules, [], source);
    assert.ok(parsed.diagnostics.every(d => d.line >= 1 && d.column >= 1));
  }
});

test("procedural repetition and multi-command loops compile into bytecode", () => {
  const repeated = analyzeProgram("3かいとぶ");
  assert.deepEqual(repeated.diagnostics, []);
  assert.equal(repeated.body[0].kind, "action");
  assert.deepEqual(repeated.program.steps, [
    { op: "action", action: "jump", count: 3 }
  ]);

  const multi = analyzeProgram("3かいくりかえす\nかべとぶ\nあなとぶ\nおわり");
  assert.deepEqual(multi.diagnostics, []);
  assert.equal(multi.body[0].kind, "repeat");
  assert.deepEqual(multi.program.steps.map((s) => s.op), [
    "repeat-start", "wait", "wait", "repeat-end"
  ]);
});


test("whitespace, tab and digits normalize without indentation semantics", () => {
  assert.equal(normalizeLine(" かべ\tとぶ　"), "かべとぶ");
  assert.equal(normalizeLine("かべ３かいとぶ"), "かべ3かいとぶ");
  assert.deepEqual(valid("　かべ　とぶ　").rules, valid("かべとぶ").rules);
  assert.deepEqual(valid("かべ\tとぶ").rules, valid("かべとぶ").rules);
  assert.deepEqual(valid("カベとぶ").rules, valid("かべとぶ").rules);
  assert.equal(analyzeProgram("カベのようななにかをとぶ").diagnostics[0].code, "unknown");
});

test("vocabulary extensions work without substring guessing", () => {
  const dict = { conditions: { wall: ["うぉーる"] }, actions: { jump: ["はねる"] } };
  const parsed = valid("うぉーるはねる", dict);
  assert.deepEqual(parsed.rules[0].conds, ["wall"]);
  assert.equal(parsed.rules[0].action, "jump");
  assert.equal(tokenizeLine("とぶ", 1, dict)[0].kind, "action");
});

test("source and repetition caps reject pathological input", () => {
  assert.equal(analyzeProgram("あ".repeat(2100)).diagnostics[0].code, "limit");
  assert.equal(analyzeProgram("かべとぶ\n".repeat(120)).diagnostics[0].code, "limit");
  assert.equal(analyzeProgram("999999999999999999999かいとぶ").diagnostics[0].code, "count");
});

test("switch and press parse identically in concise and detailed forms", () => {
  const short = valid("すいっちおす");
  assert.deepEqual(short.rules[0], { action: "press", conds: ["switch"], maxFires: undefined });
  assert.deepEqual(valid("すいっちならおす").rules, short.rules);
  assert.equal(valid("すいっち2かいおす").rules[0].maxFires, 2);
});

test("natural Japanese particles, condition phrases and action inflections share an AST", () => {
  const expected = valid("かべとぶ").rules;
  for (const phrase of [
    "かべをまえにみつけたらじゃんぷする",
    "かべがあったらじゃんぷする",
    "かべをみつけたらとぶ",
    "かべのまえでとぶ",
    "かべがあるときはじゃんぷする",
    "かべがまえにあったらじゃんぷをする",
    "もし かべが あれば\nじゃんぷして\nおわり",
  ]) {
    assert.deepEqual(valid(phrase).rules, expected, phrase);
  }
  assert.deepEqual(valid("こいんをみつけたらひろう").rules, valid("こいんとる").rules);
  assert.deepEqual(valid("ぼたんがあったらおして").rules, valid("すいっちおす").rules);
  assert.deepEqual(valid("かべとあなをみつけたらとびこえる").rules, valid("かべとあなとぶ").rules);
});

test("source columns remain tied to visible input after whitespace normalization", () => {
  const tokens = tokenizeLine("  かべ　が  まえ で　とぶ", 3);
  assert.deepEqual(tokens.map((token) => token.column), [3, 6, 9, 12, 14]);
  assert.equal(tokens[0].endColumn, 5);
  const result = analyzeProgram("  かべ ほげ とぶ");
  assert.equal(result.diagnostics[0].column, 6);
});

test("unsupported phrases are not silently ignored", () => {
  for (const source of ["かべをよける", "かべとあなならのとぶ", "かべをみつけたらよける"]) {
    assert.notEqual(analyzeProgram(source).diagnostics.length, 0, source);
  }
});

test("browser dictionary and bundled parser vocabulary stay consistent", () => {
  for (const source of ["おかねをひろう", "かいぶつがきたらしゃがむ", "ぼたんをおして", "かべではねる"]) {
    const base = valid(source);
    const withDictionary = valid(source, {
      conditions: { wall: ["かべ"], enemy: ["かいぶつ"], coin: ["おかね"], switch: ["ぼたん"] },
      actions: { jump: ["はねる"], crouch: ["しゃがむ"], collect: ["ひろう"], press: ["おして"] },
    });
    assert.deepEqual(base.program, withDictionary.program);
  }
});

test("switch skip language binds to switches and rejects other objects", () => {
  const canonical = valid("すいっちみおくる");
  for (const phrase of ["すいっちをみおくる", "ぼたんをおさない", "すいっちをみすごす", "すいっちをむしする"]) {
    assert.deepEqual(valid(phrase).program, canonical.program, phrase);
  }
  const loop = valid("3かいくりかえす\nすいっちをみおくる\nこいんをとる\nすいっちをおす\nおわり");
  assert.deepEqual(loop.program.steps.map(step => step.op), ["repeat-start", "wait", "wait", "wait", "repeat-end"]);
  assert.equal(loop.program.steps[1].action, "skip");
  for (const invalid of ["みおくる", "かべみおくる", "こいんをおさない"]) {
    assert.ok(analyzeProgram(invalid).diagnostics.length, invalid);
  }
});

test("if blocks only allow skip on switches", () => {
  const accepted = valid("もしすいっちがあったら\nみおくる\nおわり");
  assert.deepEqual(accepted.program.watchers[0]?.conds, ["switch"]);
  assert.equal(accepted.program.watchers[0]?.action, "skip");
  const invalid = analyzeProgram("もしかべがあったら\nみおくる\nおわり");
  assert.ok(invalid.diagnostics.some(item => item.code === "unsupported"));
  assert.deepEqual(invalid.program, { watchers: [], steps: [] });
});

test("joined switch colors and shapes expand to precise OR conditions", () => {
  const cases = [
    ["みどりとあかのぼたんをおす", ["switch:green:*", "switch:red:*"]],
    ["みどりのぼたんとあかいぼたんをおす", ["switch:green:*", "switch:red:*"]],
    ["みどりとあかのまるのぼたんをおす", ["switch:green:circle", "switch:red:circle"]],
    ["みどりのまるとあかいばつのぼたんをおす", ["switch:green:circle", "switch:red:cross"]],
    ["みどりのまるとばつのぼたんをおす", ["switch:green:circle", "switch:green:cross"]],
    ["あかいぼたんとおばけがきたらしゃがむ", ["switch:red:*", "enemy"]],
  ];
  for (const [phrase, expected] of cases) {
    assert.deepEqual(valid(phrase).rules[0].conds, expected, phrase);
  }
  for (const phrase of ["みどりとぼたんをおす", "みどりとあかのまるとばつのぼたんをおす"]) {
    assert.ok(analyzeProgram(phrase).diagnostics.length > 0, phrase);
  }
});

test("grouped switch colors press both switches without pressing unlisted traps", () => {
  const stage = {
    goal: 1550,
    scrollSpeed: 3,
    objects: [
      { id: "green", type: "switch", position: 320, targetDoorId: "door-green", color: "green", shape: "circle" },
      { id: "door-green", type: "door", position: 580 },
      { id: "blue", type: "switch", position: 760, targetDoorId: "door-blue", trap: true, color: "blue", shape: "cross" },
      { id: "red", type: "switch", position: 950, targetDoorId: "door-red", color: "red", shape: "circle" },
      { id: "door-red", type: "door", position: 1200 },
    ],
  };
  const result = runToCompletion(createGame(stage, valid("みどりとあかのぼたんをおす").rules));
  assert.equal(result.status, "cleared");
  assert.deepEqual(result.switches.filter((item) => item.activated).map((item) => item.id), ["green", "red"]);
  assert.equal(result.switches.find((item) => item.id === "blue").activated, false);
});

test("hints can be expressed using alternative obstacle names", () => {
  assert.deepEqual(valid("もんをすごいじゃんぷ").rules[0].conds, ["door"]);
  assert.deepEqual(valid("おそいゆかをあるく").rules[0].conds, ["conveyor"]);
  assert.deepEqual(valid("ひびがみえたらとぶ").rules[0].conds, ["fragileFloor"]);
});

test("hiragana, katakana and printed symbols share the same switch rule", () => {
  const base = valid("みどりとあかのぼたんをおす").rules;
  for (const source of [
    "みどりとあかのボタンをおす",
    "ミドリとアカのボタンをオス",
  ]) {
    assert.deepEqual(valid(source).rules, base, source);
  }
  assert.deepEqual(valid("あおい☆のボタンをおす").rules, valid("あおいほしのぼたんをおす").rules);
  assert.deepEqual(valid("あかい×のボタンをみおくる").rules, valid("あかいばつのぼたんをみおくる").rules);
});

test("every registered vocabulary phrase is free of kanji", () => {
  const registered = [
    ...Object.values(conditionsDictionary).flat(),
    ...Object.values(actionsDictionary).flat(),
    ...CONTROL_WORDS.map(word => word.raw),
    ...SWITCH_ATTRIBUTES.map(word => word.raw),
  ];
  for (const word of registered) {
    assert.doesNotMatch(word, /[一-龯々]/u, word);
  }
});

test("ふせる is a synonym of しゃがむ in standalone and conditional commands", () => {
  assert.ok(actionsDictionary.crouch.includes("ふせる"));
  assert.deepEqual(valid("ふせる").program, valid("しゃがむ").program);
  assert.deepEqual(valid("おばけがきたらふせる").rules, valid("おばけがきたらしゃがむ").rules);
});

test("kanji aliases are not part of the parser dictionary, including extensions", () => {
  for (const input of [
    "壁をとぶ",
    "緑と赤のぼたんをおす",
    "赤いばつのぼたんをみおくる",
    "門をすごいじゃんぷ",
    "宝箱をあける",
  ]) {
    assert.ok(analyzeProgram(input).diagnostics.length > 0, input);
  }
  const extension = { conditions: { wall: ["壁"] }, actions: { crouch: ["伏せる"] } };
  assert.ok(analyzeProgram("壁をとぶ", extension).diagnostics.length > 0);
  assert.ok(analyzeProgram("伏せる", extension).diagnostics.length > 0);
});

test("independent switch colors and shapes are OR, not an implicit combination", () => {
  const cases = [
    ["あかとほしぼたんみおくる", ["switch:red:*", "switch:*:star"]],
    ["まるときいろぼたんおす", ["switch:*:circle", "switch:yellow:*"]],
    ["あかのまるときいろぼたんおす", ["switch:red:circle", "switch:yellow:*"]],
    ["まるときいろのばつぼたんみおくる", ["switch:*:circle", "switch:yellow:cross"]],
    ["みどりとあかのまるのぼたんおす", ["switch:green:circle", "switch:red:circle"]],
    ["みどりのまるとばつのぼたんおす", ["switch:green:circle", "switch:green:cross"]],
    ["あかのまるとみどりのばつのぼたんおす", ["switch:red:circle", "switch:green:cross"]],
  ];
  for (const [source, expected] of cases) {
    assert.deepEqual(valid(source).rules[0].conds, expected, source);
  }
  const ambiguous = analyzeProgram("みどりとあかのまるとばつのぼたんをおす");
  assert.ok(ambiguous.diagnostics.length > 0);
});
