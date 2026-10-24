from pathlib import Path
import math
import subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
SOURCE = ROOT / "source" / "wav"
SR = 44100
RNG = np.random.default_rng(20261020)


def hz(midi):
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def envelope(n, attack=0.009, release=0.07):
    x = np.ones(n, dtype=np.float64)
    a = min(int(SR * attack), n // 2)
    r = min(int(SR * release), n // 2)
    if a:
        x[:a] *= np.sin(np.linspace(0, np.pi / 2, a, endpoint=False)) ** 2
    if r:
        x[-r:] *= np.cos(np.linspace(0, np.pi / 2, r, endpoint=False)) ** 2
    return x


def voice(note, duration, patch, velocity=1.0):
    n = max(1, int(SR * duration))
    t = np.arange(n, dtype=np.float64) / SR
    f = hz(note)
    phase = 2 * np.pi * (f * t + (0.0023 if patch == "pad" else 0.00065) * np.sin(2 * np.pi * 5.2 * t))
    if patch == "lead":
        x = np.sin(phase) + 0.34 * np.sin(2 * phase + .22) + 0.14 * np.sin(3 * phase) + 0.035 * np.sin(5 * phase)
        e = envelope(n, .007, .065) * (0.86 + 0.14 * np.exp(-t * 7))
    elif patch == "chip":
        x = np.sin(phase) + .31 * np.sin(3 * phase) + .13 * np.sin(5 * phase) + .06 * np.sin(7 * phase)
        e = envelope(n, .003, .033) * (0.78 + .22 * np.exp(-t * 7))
    elif patch == "pluck":
        x = np.sin(phase) + .42 * np.sin(2 * phase) + .21 * np.sin(4 * phase + .3)
        e = envelope(n, .003, .09) * (.26 + .74 * np.exp(-t * 8))
    elif patch == "bell":
        x = np.sin(phase) + .27 * np.sin(2.002 * phase) + .10 * np.sin(3.99 * phase)
        e = envelope(n, .002, .09) * (.15 + .85 * np.exp(-t * 7.2))
    elif patch == "pad":
        x = .7 * np.sin(phase) + .23 * np.sin(2 * phase) + .20 * np.sin(phase * 1.004)
        e = envelope(n, .10, .13) * (.86 + .14 * np.sin(np.pi * t / max(duration, .001)) ** 2)
    elif patch == "bass":
        x = np.sin(phase) + .25 * np.sin(2 * phase) + .065 * np.sin(3 * phase)
        e = envelope(n, .004, .07) * (.67 + .33 * np.exp(-t * 5.5))
    elif patch == "airy":
        x = .8 * np.sin(phase) + .18 * np.sin(2 * phase) + .13 * np.sin(phase * 1.003)
        e = envelope(n, .045, .15) * (.75 + .25 * np.exp(-t * 2.3))
    elif patch == "keys":
        x = .74 * np.sin(phase) + .23 * np.sin(2.001 * phase) + .09 * np.sin(3.003 * phase)
        e = envelope(n, .005, .14) * (.28 + .72 * np.exp(-t * 4.1))
    elif patch == "marimba":
        x = .86 * np.sin(phase) + .26 * np.sin(3.99 * phase) + .055 * np.sin(9.01 * phase)
        e = envelope(n, .003, .11) * (.09 + .91 * np.exp(-t * 7.2))
    elif patch == "flute":
        x = .87 * np.sin(phase) + .12 * np.sin(2 * phase) + .034 * np.sin(3 * phase)
        e = envelope(n, .028, .13) * (.92 + .08 * np.sin(2 * np.pi * 4.6 * t))
    elif patch == "strings":
        x = .57 * np.sin(phase) + .20 * np.sin(2 * phase) + .14 * np.sin(phase * 1.0035) + .06 * np.sin(3 * phase)
        e = envelope(n, .095, .22) * (.85 + .15 * np.sin(2 * np.pi * .38 * t))
    else:
        raise ValueError(patch)
    return (x * e * velocity).astype(np.float32)


def add(buf, signal, sec, pan=0.0, gain=1.0):
    start = round(sec * SR) % len(buf)
    pan = float(np.clip(pan, -1, 1))
    gains = np.array([math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)], dtype=np.float32) * gain
    length = len(signal)
    pos = 0
    while pos < length:
        at = (start + pos) % len(buf)
        end = min(length - pos, len(buf) - at)
        buf[at:at + end] += signal[pos:pos + end, None] * gains
        pos += end


def drum(kind, duration=.25, velocity=1.0):
    n = max(1, int(SR * duration))
    t = np.arange(n) / SR
    noise = RNG.normal(0, 1, n)
    if kind == "kick":
        freq = 47 + 100 * np.exp(-t * 27)
        phase = 2 * np.pi * np.cumsum(freq) / SR
        x = np.sin(phase) * np.exp(-t * 23)
        x += 0.06 * noise * np.exp(-t * 180)
    elif kind == "snare":
        sos = butter(2, [700, 8000], btype="bandpass", fs=SR, output="sos")
        x = .58 * sosfilt(sos, noise) * np.exp(-t * 24)
        x += .22 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 27)
    elif kind == "hat":
        sos = butter(2, 5300, btype="highpass", fs=SR, output="sos")
        x = .37 * sosfilt(sos, noise) * np.exp(-t * 70)
    elif kind == "shaker":
        sos = butter(2, 4400, btype="highpass", fs=SR, output="sos")
        x = .19 * sosfilt(sos, noise) * np.exp(-t * 40)
    else:
        raise ValueError(kind)
    x *= envelope(n, .002, .018)
    return (x * velocity).astype(np.float32)


def mix_bgm(name, bpm, chords, melody, kind):
    beat = 60 / bpm
    bars = len(chords)
    total = 4 * bars * beat
    n = round(total * SR)
    buf = np.zeros((n, 2), dtype=np.float32)
    progressions = {
        "G": ([55, 59, 62], 43),
        "D": ([54, 57, 62], 50),
        "Em": ([55, 59, 64], 52),
        "C": ([55, 60, 64], 48),
        "Am": ([57, 60, 64], 45),
        "F": ([57, 60, 65], 41),
    }
    for bar, chord in enumerate(chords):
        notes, root = progressions[chord]
        base = bar * beat * 4
        pad_gain = {"title": .100, "game": .052, "result": .13}[kind]
        for k, note in enumerate(notes):
            add(buf, voice(note, 4 * beat + .22, "pad" if kind != "result" else "airy", .9), base, pan=[-.34, 0, .34][k], gain=pad_gain)
        for k, note in enumerate(notes):
            if kind != "result":
                add(buf, voice(note - 12, 4 * beat, "strings", .74), base, pan=[-.48, .05, .46][k], gain=.025 if kind == "game" else .036)
        if kind != "result":
            for pulse in (0, 2):
                at = base + pulse * beat
                for k, note in enumerate(notes):
                    add(buf, voice(note, beat * .83, "keys", .80), at + .008 * k, pan=[-.24, 0, .24][k], gain=.048 if kind == "game" else .038)
        else:
            for k, note in enumerate(notes):
                add(buf, voice(note, beat * 2.8, "strings", .7), base + beat * .5, pan=[-.40, .08, .40][k], gain=.042)
        for slot in range(8):
            pos = base + beat * .5 * slot
            if kind == "result":
                if slot in [0, 3, 5]:
                    add(buf, voice(root, beat * .72, "bass", .80), pos, pan=-.10, gain=.105)
            elif kind == "title":
                if slot in [0, 4, 6]:
                    add(buf, voice(root, beat * .75, "bass", .95), pos, pan=-.1, gain=.15)
            elif kind == "game":
                if slot in [0, 2, 4, 6, 7]:
                    octave = 12 if slot == 7 else 0
                    add(buf, voice(root + octave, beat * .42, "bass", 1), pos, pan=-.12, gain=.15)
        if kind == "game":
            arp_notes = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12]
            for step in range(16):
                note = arp_notes[(step + bar) % 4]
                pan = (-.34 if step % 2 == 0 else .34)
                add(buf, voice(note, beat * .35, "marimba" if bar % 4 < 2 else "pluck", .76), base + step * beat / 4, pan=pan, gain=.064)
        elif kind == "title":
            arp_notes = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12]
            for step in range(8):
                note = arp_notes[step % 4]
                add(buf, voice(note, beat * .32, "pluck"), base + step * beat / 2, pan=(-.28 if step % 2 else .28), gain=.065)
        else:
            arp_notes = [notes[0] + 12, notes[1] + 12, notes[2] + 12]
            for step in [0, 2, 4, 6]:
                note = arp_notes[(step // 2 + bar) % 3]
                add(buf, voice(note, beat * .57, "bell", .70), base + step * beat / 2, pan=(-.32 if step % 4 == 0 else .32), gain=.065)
        for step, note in enumerate(melody[bar]):
            if note is None:
                continue
            next_note = next((j for j in range(step + 1, 8) if melody[bar][j] is not None), 8)
            steps = next_note - step
            duration = beat * .5 * min(steps * .86, 2.0)
            voice_patch = ("flute" if bar % 4 == 2 else "lead") if kind == "game" else "bell" if kind == "result" else "pluck"
            level = {"title": .18, "game": .13, "result": .16}[kind]
            sound = voice(note, duration, voice_patch, 1.0)
            at = base + step * beat / 2
            add(buf, sound, at, pan=.08, gain=level)
            if kind != "game":
                add(buf, sound, at + beat * .68, pan=-.34, gain=level * .14)
        if kind == "game" and bar % 4 in (1, 3):
            for step, note_index in ((1, 1), (5, 2)):
                add(buf, voice(notes[note_index] + 12, beat * 1.04, "flute", .75), base + step * beat * .5, pan=-.42, gain=.041)
        if kind == "title" and bar % 4 == 3:
            add(buf, voice(notes[1] + 12, beat * 1.6, "flute", .68), base + beat * 2, pan=.38, gain=.055)
        if kind == "game":
            for step in range(8):
                add(buf, drum("hat", .085, .68 if step % 2 else 1), base + step * beat * .5, pan=(-.15 if step % 2 else .15), gain=.085)
            for step in (0, 4, 7):
                add(buf, drum("kick", .26, .95), base + step * beat * .5, gain=.21)
            for step in (2, 6):
                add(buf, drum("snare", .17, .8), base + step * beat * .5, pan=.05, gain=.12)
        elif kind == "title":
            for step in range(8):
                add(buf, drum("shaker", .10, .56), base + step * beat * .5, pan=(-.2 if step % 2 else .2), gain=.075)
            for step in (0, 4):
                add(buf, drum("kick", .24, .8), base + step * beat * .5, gain=.14)
            add(buf, drum("snare", .15, .58), base + beat * 2, gain=.062)
        else:
            for step in (1, 3, 5, 7):
                add(buf, drum("shaker", .11, .45), base + step * beat * .5, pan=-.24 if step % 4 == 1 else .24, gain=.045)
    return add_room(buf, .25 if kind == "result" else .19)


def add_room(buf, wet):
    dry = buf.astype(np.float64)
    reflection = np.zeros_like(dry)
    for delay, amount in ((.067, .20), (.119, .17), (.181, .13), (.283, .09), (.397, .06)):
        delayed = np.roll(dry, round(delay * SR), axis=0)
        reflection[:, 0] += delayed[:, 1] * amount
        reflection[:, 1] += delayed[:, 0] * amount
    return (dry + reflection * wet).astype(np.float32)


def sweep(duration, start_hz, end_hz, overtone=.20, noise_amt=0, wobble=0):
    n = int(SR * duration)
    t = np.arange(n) / SR
    progress = t / duration
    frequencies = start_hz * (end_hz / start_hz) ** progress * (1 + wobble * np.sin(2 * np.pi * 26 * t) * (1 - progress))
    phase = 2 * np.pi * np.cumsum(frequencies) / SR
    x = np.sin(phase) + overtone * np.sin(2 * phase) + .08 * np.sin(3 * phase)
    if noise_amt:
        x += RNG.normal(0, noise_amt, n)
    x *= envelope(n, .004, min(.095, duration * .35))
    return x.astype(np.float32)


def se_notes(notes, patch="bell", gain=1.0, length=None):
    if length is None:
        length = max(start + duration for note, start, duration, vol in notes) + .05
    n = math.ceil(length * SR)
    buf = np.zeros(n, dtype=np.float32)
    for note, start, duration, volume in notes:
        wave = voice(note, duration, patch, volume * gain)
        i = round(start * SR)
        k = min(len(wave), n - i)
        buf[i:i+k] += wave[:k]
    return buf


def build_se():
    sounds = {}
    sounds["jump"] = sweep(.25, 365, 780, .22, 0, .012)
    sounds["crouch"] = sweep(.23, 460, 180, .16, 0, .009) * .79
    sounds["land"] = (sweep(.17, 235, 102, .12, .022) * .50)
    sounds["avoid"] = se_notes([(79, 0, .22, .60), (83, .065, .22, .48), (86, .13, .24, .57)], length=.40)
    sounds["score"] = se_notes([(79, 0, .22, .65), (83, .085, .26, .57)], length=.38)
    sounds["score_bonus"] = se_notes([(79, 0, .28, .55), (83, .105, .28, .55), (86, .21, .35, .52), (91, .35, .43, .56)], length=.83)
    sounds["hit"] = sweep(.34, 242, 73, .36, .21, .028)
    sounds["gameover"] = se_notes([(67, 0, .36, .55), (64, .21, .44, .63), (60, .48, .58, .70)], patch="chip", length=1.11)
    sounds["select"] = se_notes([(84, 0, .095, .45)], patch="bell", length=.14)
    sounds["confirm"] = se_notes([(76, 0, .20, .54), (79, .093, .24, .65)], patch="pluck", length=.37)
    sounds["start"] = se_notes([(67, 0, .25, .58), (71, .14, .24, .56), (74, .28, .26, .55), (79, .42, .34, .70)], patch="chip", length=.82)
    sounds["warning"] = se_notes([(81, 0, .115, .55), (81, .19, .12, .52)], patch="chip", length=.35)
    sounds["high_score"] = se_notes([(72, 0, .35, .55), (76, .10, .35, .55), (79, .20, .35, .55), (84, .35, .52, .69), (88, .56, .46, .46)], patch="bell", length=1.06)
    return sounds


def clean_master(arr, target_db=-21.0, peak_db=-2.5):
    a = np.array(arr, dtype=np.float64, copy=True)
    rms = float(np.sqrt(np.mean(a**2)))
    maxpeak = float(np.max(np.abs(a)))
    desired_rms = 10 ** (target_db / 20)
    ceiling = 10 ** (peak_db / 20)
    factor = min(desired_rms / max(rms, 1e-10), ceiling / max(maxpeak, 1e-10))
    a *= factor
    return a.astype(np.float32)


def export(name, group, arr):
    target = OUT / group
    master = SOURCE / group
    target.mkdir(parents=True, exist_ok=True)
    master.mkdir(parents=True, exist_ok=True)
    wav = master / f"{name}.wav"
    mp3 = target / f"{name}.mp3"
    ogg = target / f"{name}.ogg"
    sf.write(wav, arr, SR, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "160k" if group.startswith("bgm") else "128k", str(mp3)], check=True)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-codec:a", "libvorbis", "-q:a", "5" if group.startswith("bgm") else "4", str(ogg)], check=True)
    rms = float(np.sqrt(np.mean(arr.astype(np.float64)**2)))
    peak = float(np.max(np.abs(arr)))
    print(f"{group}/{name}: {len(arr) / SR:.3f}s RMS {20 * math.log10(max(rms,1e-9)):.1f} dBFS peak {20 * math.log10(max(peak,1e-9)):.1f} dBFS", flush=True)


def main():
    title = ["G", "D", "Em", "C", "G", "D", "C", "D"]
    title_mel = [
        [74, None, 76, None, 79, None, 76, 74],
        [78, None, 76, 74, 73, None, 69, None],
        [71, None, 74, 76, 79, None, 76, None],
        [76, None, 74, None, 71, 69, 67, None],
        [74, 76, 79, None, 81, None, 79, 76],
        [78, None, 76, 74, 73, None, 69, None],
        [72, 74, 76, None, 79, 76, 74, None],
        [73, 74, 76, 74, 71, None, 69, None],
    ]
    game = ["G", "D", "Em", "C"] * 4
    game_mel = [
        [74, None, 74, 76, 79, None, 76, None],
        [78, None, 76, None, 74, 73, 69, None],
        [76, None, 79, None, 81, 79, 76, 74],
        [72, None, 74, 76, 79, None, 76, None],
        [79, None, 76, 74, 79, None, 81, None],
        [78, None, 76, 74, 73, None, 74, None],
        [76, 79, 81, None, 79, 76, 74, None],
        [76, None, 72, None, 74, 76, 79, None],
        [74, None, 76, 79, 81, None, 79, 76],
        [78, None, 81, None, 78, 76, 74, None],
        [76, None, 79, 81, 83, None, 81, None],
        [79, None, 76, 74, 72, None, 74, None],
        [79, 81, 83, None, 81, None, 79, 76],
        [78, None, 76, 74, 73, 74, 76, None],
        [76, 79, 81, None, 79, 76, 74, 72],
        [74, None, 76, 79, 78, None, 74, None],
    ]
    result = ["C", "Am", "F", "G"] * 2
    result_mel = [
        [76, None, 79, None, 84, None, 79, None],
        [76, None, 72, None, 69, None, 72, None],
        [72, None, 76, None, 77, None, 76, None],
        [74, None, 79, None, 76, None, 74, None],
        [76, None, 79, 81, 84, None, 81, None],
        [76, None, 72, None, 69, None, 72, None],
        [77, None, 76, 72, 69, None, 72, None],
        [74, None, 76, 79, 76, None, 72, None],
    ]
    for name, bpm, chords, melody, kind in [
        ("title_loop", 118, title, title_mel, "title"),
        ("game_loop", 150, game, game_mel, "game"),
        ("result_loop", 100, result, result_mel, "result"),
    ]:
        buf = mix_bgm(name, bpm, chords, melody, kind)
        export(name, "bgm", clean_master(buf, -19.5, -2.8))
    se = build_se()
    for name, arr in se.items():
        target_db = -17.5 if name in ("select", "confirm", "warning") else -15.0
        export(name, "se", clean_master(arr, target_db, -3.0))


if __name__ == "__main__":
    main()
