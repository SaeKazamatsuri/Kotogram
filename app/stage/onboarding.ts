export const FIRST_STAGE_EXAMPLE = "かべがまえにあったらじゃんぷする";
export const FIRST_STAGE_SHORT = "かべとぶ";
export const TUTORIAL_DISMISSED_KEY = "kotogram.tutorial.introDismissed";

export function isStageOneShortForm(source: string): boolean {
  return source.normalize("NFC").replace(/[\s\u3000]/g, "") === FIRST_STAGE_SHORT;
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
