export type BgmName = "title_loop" | "game_loop" | "result_loop";
export type SoundName =
  | "avoid" | "confirm" | "crouch" | "gameover" | "high_score"
  | "hit" | "jump" | "land" | "score" | "score_bonus"
  | "select" | "start" | "warning";

const STORAGE_KEY = "kotogram.audio.muted";
const EFFECT_VOLUME = 0.42;
const BGM_VOLUME = 0.25;
const voices = new Map<SoundName, HTMLAudioElement[]>();
const lastEffect = new Map<SoundName, number>();
let track: BgmName = "title_loop";
let currentTrack: BgmName | null = null;
let music: HTMLAudioElement | null = null;
let unlocked = false;
let muted = false;
let settingsLoaded = false;
let extension: "ogg" | "mp3" | null = null;

function onClient(): boolean {
  return typeof window !== "undefined";
}

export function getAudioMuted(): boolean {
  if (!settingsLoaded && onClient()) {
    settingsLoaded = true;
    try {
      muted = window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      muted = false;
    }
  }
  return muted;
}

function fileUrl(folder: "bgm" | "se", name: string): string {
  if (!extension) {
    extension = document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"') ? "ogg" : "mp3";
  }
  return `/audio/${folder}/${name}.${extension}`;
}

function syncMusic(): void {
  if (!onClient() || !unlocked || getAudioMuted()) return;
  if (music && currentTrack === track) return;
  music?.pause();
  const next = new Audio(fileUrl("bgm", track));
  next.preload = "auto";
  next.loop = true;
  next.volume = BGM_VOLUME;
  music = next;
  currentTrack = track;
  void next.play().catch(() => {
    if (music === next) currentTrack = null;
  });
}

export function unlockAudio(): void {
  if (!onClient()) return;
  unlocked = true;
  syncMusic();
}

export function setBgm(next: BgmName): void {
  track = next;
  syncMusic();
}

export function setAudioMuted(next: boolean): void {
  muted = next;
  settingsLoaded = true;
  if (!onClient()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Local storage is optional.
  }
  if (next) {
    music?.pause();
    for (const pool of voices.values()) {
      for (const voice of pool) voice.pause();
    }
  } else {
    unlocked = true;
    syncMusic();
  }
}

export function playSe(name: SoundName): void {
  if (!onClient() || !unlocked || getAudioMuted()) return;
  const now = performance.now();
  if (now - (lastEffect.get(name) ?? -Infinity) < 80) return;
  lastEffect.set(name, now);
  const pool = voices.get(name) ?? [];
  let voice = pool.find((item) => item.paused || item.ended);
  if (!voice) {
    if (pool.length < 4) {
      voice = new Audio(fileUrl("se", name));
      voice.preload = "auto";
      voice.volume = EFFECT_VOLUME;
      pool.push(voice);
      voices.set(name, pool);
    } else {
      voice = pool[0]!;
      voice.pause();
    }
  }
  try {
    voice.currentTime = 0;
  } catch {
    return;
  }
  void voice.play().catch(() => {});
}
