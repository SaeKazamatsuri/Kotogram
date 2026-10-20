export type CelebrationCue = "clear_loop" | "clear_fanfare";

const SAMPLE_RATE = 22050;
const BEAT = 60 / 128;

function midiPitch(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function addTone(
  samples: Float32Array,
  start: number,
  duration: number,
  midi: number,
  level: number,
  instrument: "lead" | "chord" | "bass" | "bell",
): void {
  const startSample = Math.max(0, Math.round(start * SAMPLE_RATE));
  const count = Math.min(Math.round(duration * SAMPLE_RATE), samples.length - startSample);
  if (count <= 0) return;
  const frequency = midiPitch(midi);
  const release = Math.min(instrument === "chord" ? 0.12 : 0.08, duration / 3);
  const attack = instrument === "chord" ? 0.028 : 0.006;
  for (let n = 0; n < count; n++) {
    const t = n / SAMPLE_RATE;
    const amplitude = Math.min(1, t / attack, (duration - t) / release);
    const decay = instrument === "bell" ? Math.exp(-2.2 * t) : 1;
    const phase = 2 * Math.PI * frequency * t;
    let wave = Math.sin(phase);
    if (instrument === "lead") wave += 0.24 * Math.sin(2 * phase) + 0.11 * Math.sin(3 * phase);
    if (instrument === "chord") wave += 0.2 * Math.sin(2 * phase);
    if (instrument === "bass") wave += 0.18 * Math.sin(0.5 * phase);
    if (instrument === "bell") wave += 0.52 * Math.sin(2 * phase) + 0.15 * Math.sin(4 * phase);
    samples[startSample + n] += wave * amplitude * decay * level;
  }
}

function addDrum(samples: Float32Array, start: number, kind: "kick" | "snare" | "hat"): void {
  const count = Math.min(Math.round((kind === "kick" ? 0.22 : 0.12) * SAMPLE_RATE), samples.length - Math.round(start * SAMPLE_RATE));
  const offset = Math.round(start * SAMPLE_RATE);
  let seed = 2026 + offset;
  for (let n = 0; n < count; n++) {
    const t = n / SAMPLE_RATE;
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    const wave = kind === "kick"
      ? Math.sin(2 * Math.PI * (92 * t - 120 * t * t)) * 0.28
      : noise * (kind === "snare" ? 0.085 : 0.036);
    samples[offset + n] += wave * Math.exp(-t * (kind === "kick" ? 18 : 38));
  }
}

function renderLoop(): Float32Array {
  const samples = new Float32Array(Math.round(16 * BEAT * SAMPLE_RATE));
  const chords = [
    [48, 60, 64, 67],
    [45, 57, 60, 64],
    [53, 60, 65, 69],
    [55, 62, 67, 71],
  ];
  for (let bar = 0; bar < 4; bar++) {
    const position = bar * 4 * BEAT;
    const [root, ...notes] = chords[bar];
    for (const pitch of notes) addTone(samples, position, 3.75 * BEAT, pitch, 0.056, "chord");
    for (let beat = 0; beat < 4; beat++) {
      const at = position + beat * BEAT;
      addTone(samples, at, 0.8 * BEAT, root, 0.16, "bass");
      addDrum(samples, at, "kick");
      if (beat % 2 === 1) addDrum(samples, at, "snare");
      addDrum(samples, at, "hat");
      addDrum(samples, at + 0.5 * BEAT, "hat");
    }
  }
  const melody = [
    72, 76, 79, 84, 79, 76, 74, 72,
    69, 72, 76, 81, 76, 72, 69, 72,
    77, 81, 84, 81, 79, 77, 76, 74,
    79, 83, 86, 83, 79, 76, 74, 72,
  ];
  melody.forEach((pitch, index) => {
    addTone(samples, index * 0.5 * BEAT, 0.44 * BEAT, pitch, 0.105, "lead");
  });
  return samples;
}

function renderFanfare(): Float32Array {
  const samples = new Float32Array(Math.round(3.5 * SAMPLE_RATE));
  const fanfare = [
    [0, 0.22, 72], [0.23, 0.22, 76], [0.46, 0.22, 79],
    [0.69, 0.52, 84], [1.25, 0.23, 79], [1.49, 0.23, 84],
    [1.73, 1.38, 88],
  ];
  fanfare.forEach(([start, duration, pitch]) => {
    addTone(samples, start, duration, pitch, 0.2, "lead");
    addTone(samples, start, duration, pitch - 12, 0.05, "bell");
  });
  for (const pitch of [60, 64, 67, 72]) addTone(samples, 1.73, 1.4, pitch, 0.095, "chord");
  for (let index = 0; index < 14; index++) {
    addTone(samples, 1.85 + index * 0.084, 0.26, 84 + (index % 5) * 2, 0.038, "bell");
  }
  return samples;
}

export function generateCelebrationWav(cue: CelebrationCue): ArrayBuffer {
  const samples = cue === "clear_loop" ? renderLoop() : renderFanfare();
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const header = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) bytes[offset + index] = value.charCodeAt(index);
  };
  writeText(0, "RIFF");
  header.setUint32(4, buffer.byteLength - 8, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, SAMPLE_RATE, true);
  header.setUint32(28, SAMPLE_RATE * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  writeText(36, "data");
  header.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) {
    const edge = Math.min(index / (SAMPLE_RATE * 0.018), (samples.length - 1 - index) / (SAMPLE_RATE * 0.035), 1);
    const level = Math.tanh(samples[index] * 1.15) * Math.max(0, edge);
    header.setInt16(44 + index * 2, Math.round(level * 32767), true);
  }
  return buffer;
}
