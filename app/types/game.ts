export type FailReason = "hole" | "wall" | "enemy" | "void";

export type FailPayload = { reason: FailReason };

const reasonLabels: Record<FailReason, string> = {
  hole: "あなにおちちゃった！",
  wall: "かべにぶつかっちゃった！",
  enemy: "おばけにあたっちゃった！",
  void: "おっと、うまくいかなかったよ。",
};

const reasonHints: Record<FailReason, string> = {
  hole: "「あな じゃんぷ」など、あなを見つけたらジャンプする命令を試そう。",
  wall: "「かべ じゃんぷ」と書いて、かべの前でジャンプできるようにしよう。",
  enemy: "「おばけ しゃがむ」と書くと、おばけの下をくぐれるよ。",
  void: "命令の順番や言葉を見直して、もう一度ためしてみよう。",
};

export function failReasonLabel(reason: FailReason): string {
  return reasonLabels[reason];
}

export function defaultFailHint(reason: FailReason): string {
  return reasonHints[reason];
}
