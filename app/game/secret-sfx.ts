/** Generated, license-free game cues for secret door routes.
 * All samples are deterministic; no media files or network dependencies are needed.
 */
export type SecretCue = "door_break" | "door_vault";
const SAMPLE_RATE = 24000;
const DURATION = 0.54;
const TAU = Math.PI * 2;

export function generateSecretCueWav(kind: SecretCue): Uint8Array {
  const count = Math.ceil(SAMPLE_RATE * DURATION);
  const data = new Uint8Array(44 + count * 2);
  const view = new DataView(data.buffer);
  const ascii = (offset: number, label: string) => {
    for (let i = 0; i < label.length; i++) view.setUint8(offset + i, label.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, data.length - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, count * 2, true);

  let seed = kind === "door_break" ? 175389 : 492143;
  let filteredNoise = 0;
  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = (seed >>> 0) / 2147483648 - 1;
    filteredNoise = 0.68 * filteredNoise + 0.32 * noise;
    let sample: number;
    if (kind === "door_break") {
      // Three short cracking transients over a falling metallic-and-bass impact.
      const transient = [0.015, 0.078, 0.156].reduce((sum, at) =>
        sum + Math.exp(-Math.abs(t - at) * 110), 0);
      const bass = Math.sin(TAU * (105 * t - 70 * t * t)) * Math.exp(-t * 12);
      const bell = Math.sin(TAU * 790 * t) * Math.exp(-t * 15)
        + 0.48 * Math.sin(TAU * 1180 * t) * Math.exp(-t * 22);
      sample = bass * 0.52 + bell * 0.19 + noise * transient * 0.24
        + filteredNoise * Math.exp(-t * 10) * 0.16;
    } else {
      // Ascending whoosh, followed by a soft double chime as the door is vaulted.
      const swoosh = noise * Math.sin(Math.PI * Math.min(1, t / 0.32)) * Math.exp(-t * 7);
      const rise = Math.sin(TAU * (230 * t + 620 * t * t)) * Math.exp(-t * 6);
      const sparkle = Math.sin(TAU * 890 * Math.max(0, t - 0.16)) * Math.exp(-Math.max(0, t - 0.16) * 14);
      sample = swoosh * 0.23 + rise * 0.26 + (t >= 0.16 ? sparkle * 0.24 : 0);
    }
    const fade = Math.min(1, t * 90, (DURATION - t) * 70);
    const normalized = Math.tanh(sample * 1.35) * Math.max(0, fade) * 0.85;
    view.setInt16(44 + i * 2, Math.round(normalized * 32767), true);
  }
  return data;
}
