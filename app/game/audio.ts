import { generateCelebrationWav, type CelebrationCue } from "./celebration-music";

export type BgmName = "title_adventure" | "title_loop" | "game_loop" | "result_loop" | "clear_loop";
export type SoundName =
  | "avoid" | "confirm" | "crouch" | "gameover" | "high_score"
  | "hit" | "jump" | "land" | "score" | "score_bonus"
  | "select" | "start" | "warning" | "clear_fanfare";

const STORAGE_KEY = "kotogram.audio.muted";
const EFFECT_VOLUME = 0.42;
const FANFARE_VOLUME = 0.75;
const CLEAR_BGM_VOLUME = 0.24;
const generatedUrls = new Map<CelebrationCue, string>();
const BGM_VOLUME = 0.25;
const voices = new Map<SoundName, HTMLAudioElement[]>();
const lastEffect = new Map<SoundName, number>();
let track: BgmName = "title_adventure";
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
  if ((folder === "bgm" && name === "clear_loop") || (folder === "se" && name === "clear_fanfare")) {
    const cue = name as CelebrationCue;
    const existing = generatedUrls.get(cue);
    if (existing) return existing;
    const uri = URL.createObjectURL(new Blob([generateCelebrationWav(cue)], { type: "audio/wav" }));
    generatedUrls.set(cue, uri);
    return uri;
  }
  if (folder === "bgm" && name === "title_adventure") return "/audio/bgm/title_adventure.wav";
  if (!extension) {
    extension = document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"') ? "ogg" : "mp3";
  }
  return `/audio/${folder}/${name}.${extension}`;
}

function syncMusic(): void {
  if (!onClient() || !unlocked || getAudioMuted()) return;
  if (music && currentTrack === track) {
    if (music.paused) void music.play().catch(() => {});
    return;
  }
  music?.pause();
  const next = new Audio(fileUrl("bgm", track));
  next.preload = "auto";
  next.loop = true;
  next.volume = track === "clear_loop" ? CLEAR_BGM_VOLUME : BGM_VOLUME;
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
  } catch (error) {
    if (import.meta.dev) console.warn("音声設定を保存できませんでした", error);
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
      voice.volume = name === "clear_fanfare" ? FANFARE_VOLUME : EFFECT_VOLUME;
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
