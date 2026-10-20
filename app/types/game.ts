export type FailReason = "hole" | "wall" | "enemy" | "coin" | "door" | "trap" | "void";

export type FailPayload = { reason: FailReason };

const reasonLabels: Record<FailReason, string> = {
  hole: "あなにおちちゃった！",
  wall: "かべにぶつかっちゃった！",
  enemy: "おばけにあたっちゃった！",
  coin: "こいんを あつめきれなかったよ！",
  door: "とびらが しまっているよ！",
  trap: "ちがう スイッチを おしちゃった！",
  void: "おっと、うまくいかなかったよ。",
};

const reasonHints: Record<FailReason, string> = {
  hole: "「あな じゃんぷ」など、あなを見つけたらジャンプしよう。",
  wall: "「かべ じゃんぷ」と書いて、かべの前でジャンプできるようにしよう。",
  enemy: "「おばけ しゃがむ」と書くと、おばけの下をくぐれるよ。",
  coin: "「こいんとる」で こいんを あつめよう。",
  door: "「すいっちおす」で とびらを あけよう。",
  trap: "コインを とったあとに スイッチを おそう。",
  void: "もう一度ためしてみよう。",
};

export function failReasonLabel(reason: FailReason): string {
  return reasonLabels[reason];
}

export function defaultFailHint(reason: FailReason): string {
  return reasonHints[reason];
}
