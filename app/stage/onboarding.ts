export const FIRST_STAGE_EXAMPLE = "かべがまえにあったらじゃんぷする";
export const FIRST_STAGE_SHORT = "かべとぶ";
export const TUTORIAL_DISMISSED_KEY = "kotogram.tutorial.introDismissed";

export function isStageOneShortForm(source: string): boolean {
  return source.normalize("NFC").split(/\r?\n/).some(line => line.replace(/[\s\u3000]/g, "") === FIRST_STAGE_SHORT);
}

export function shouldShowFirstClearLesson(stageId: string, wasCleared: boolean, source: string): boolean {
  return stageId === "stage-1" && !wasCleared && !isStageOneShortForm(source);
}

export const failureLearningHints = {
  wall: "かべを じゃんぷして よけよう。どこで とぶかを かんがえてね。",
  hole: "あなに おちないように、あなの まえで じゃんぷしよう。",
  enemy: "おばけの 下を とおるには、しゃがんで よけよう。",
  door: "しまった門を とおるには、手前の ボタンや しかけを さがそう。",
  trap: "あぶない ボタンは おさずに、みおくる 方法を かんがえよう。",
  laser: "ひかりを よけるには、しゃがんで くぐろう。",
  coin: "こいんを とる ことばを かんがえてみよう。",
  skip: "あぶない ボタンは みおくると 点数が あがるよ。",
  void: "どこで うまくいかなかったか、ステージを 見なおそう。",
} as const;

export function failureLearningHint(reason: string): string {
  return failureLearningHints[reason as keyof typeof failureLearningHints] ?? failureLearningHints.void;
}

export type TutorialTarget = "canvas" | "editor" | "run" | "dictionary";
export type TutorialAction = "drag" | "edit" | "run" | "inspect" | "dictionary" | "preview";
export type TutorialStep = { target: TutorialTarget; action: TutorialAction; message: string; example?: string; dragDemo?: boolean };

const newGimmickLessons: Record<string, string[]> = {
  "stage-2": ["こんどは あなも あるよ。ステージを うごかして、どこに あるか たしかめよう。"],
  "stage-3": ["おばけが 出てきたよ。とぶだけでなく、下を くぐる 方法も かんがえてみよう。"],
  "stage-4": ["同じ うごきを 何回も するなら、「くりかえし」が つかえるよ。"],
  "stage-5": ["ちがう しかけが つづくよ。ひとつずつ どんな うごきが いるか 見てみよう。"],
  "stage-6": ["コインが 出てきたよ。近くに 来たら「とる」で あつめられるよ。"],
  "stage-7": ["スイッチを おすと、門が ひらくよ。どの しかけと つながるか 見よう。"],
  "stage-8": ["ボタンには 色と 形が あるよ。○や×でも みわけられるよ。"],
  "stage-9": ["色や 形の ちがいで、すすむ 方法が かわるかも。まずは 見くらべよう。"],
  "stage-10": ["時間が たつと しまる門と、速く すすむ床が あるよ。順番を かんがえよう。"],
  "stage-11": ["こわれる床は、上に いると こわれるよ。近づく前に よく 見よう。"],
  "stage-12": ["高い しかけは、いつもの ジャンプと ちがう とび方も ためせるよ。"],
  "stage-13": ["うごく床では 速さが かわるよ。走る 速さも かえて くらべてみよう。"],
  "stage-14": ["二つの 門が あるよ。色と 形を たよりに、どの ボタンを おすか かんがえよう。"],
  "stage-15": ["コインを とるか、速さを とるか。えらび方で 点数も かわるよ。"],
  "stage-16": ["うごく おばけが 出てきたよ。近づく タイミングを 見てみよう。"],
  "stage-18": ["大きな あなだよ。はしる 速さと ジャンプを 組みあわせよう。"],
  "stage-19": ["色の ちがう ボタンと おばけが つづくよ。先に どんな 道か 見よう。"],
  "stage-20": ["ボタンは おす 順番も 大切だよ。形や 色で 区別してみよう。"],
  "stage-21": ["かぎと 宝箱が あるよ。かぎを とってから 宝箱に 近づこう。", "ゴールは 二つ。どちらを めざすかも えらべるよ。"],
  "stage-22": ["スイッチを おすと 橋が つながるよ。橋が ない 場所を さがそう。"],
  "stage-23": ["上下に うごく台が あるよ。台の うごきに 合わせて とんでみよう。"],
  "stage-24": ["ふむ床は、上に いる あいだ しかけが はたらくよ。"],
  "stage-25": ["風で 速さが かわるよ。かがみに ふれると 道が かわることも あるよ。"],
  "stage-26": ["上下の うごきと 二つの ボタンが あるよ。順番に 見てみよう。"],
  "stage-27": ["いくつもの 門が あるよ。どの ボタンが どの 門を あけるか たしかめよう。"],
  "stage-28": ["ワープを つかうと ちかみちが できるよ。入口を さがしてみよう。"],
  "stage-29": ["ひかりが ついたり きえたり するよ。タイミングと くぐる うごきを ためそう。"],
};

export function hasStageTutorial(stageId: string): boolean {
  return stageId === "stage-1" || Object.hasOwn(newGimmickLessons, stageId);
}

export function tutorialStorageKey(stageId: string): string {
  return stageId === "stage-1" ? TUTORIAL_DISMISSED_KEY : `${TUTORIAL_DISMISSED_KEY}.${stageId}`;
}

export function stageTutorialSteps(stageId: string, practice = false): TutorialStep[] {
  if (stageId === "stage-1") {
    if (practice) return [{ target: "editor", action: "edit", message: "さっきの ことばを みじかく してみよう。コードを書きかえて「動かす」を おしてね。", example: FIRST_STAGE_SHORT }];
    return [
      { target: "canvas", action: "drag", message: "ここが ステージだよ。画面を おしたまま 左右に うごかすと、先が 見られるよ。", dragDemo: true },
      { target: "editor", action: "edit", message: "「コードを書く」に ことばを 入れてみよう。いつもの 日本語で いいよ。キーが むずかしければ「かな入力」も つかえるよ。", example: FIRST_STAGE_EXAMPLE },
      { target: "run", action: "run", message: "書けたら、光っている「動かす」ボタンを おしてみよう。どう うごくかな？" },
      { target: "canvas", action: "inspect", message: "かべや しかけに マウスを のせると 名前が わかるよ。タブレットなら タップしてね。" },
      { target: "dictionary", action: "dictionary", message: "「使える言葉」を おすと、この ステージで つかえる ことばが 見られるよ。まよったら 開いてみよう。" },
    ];
  }
  const lessons = newGimmickLessons[stageId];
  if (!lessons) return [];
  return [
    ...lessons.map(message => ({ target: "canvas" as const, action: "preview" as const, message })),
    { target: "dictionary", action: "dictionary", message: "書き方に まよったら「使える言葉」を おしてみてね。答えを えらぶのは きみだよ。" },
  ];
}
