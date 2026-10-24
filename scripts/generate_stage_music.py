from pathlib import Path
import argparse
import random

from generate_audio import clean_master, export, mix_bgm

WORLDS = (
    (
        ("G", "D", "Em", "C"),
        ("G", "C", "Em", "D"),
        ("Em", "C", "G", "D"),
        ("C", "G", "D", "Em"),
        ("G", "Em", "C", "D"),
    ),
    (
        ("C", "Am", "F", "G"),
        ("Am", "F", "C", "G"),
        ("F", "C", "G", "Am"),
        ("C", "F", "Am", "G"),
        ("Am", "C", "F", "G"),
    ),
    (
        ("Em", "C", "G", "D"),
        ("Em", "D", "C", "G"),
        ("C", "Em", "D", "G"),
        ("Em", "G", "C", "D"),
        ("G", "D", "C", "Em"),
    ),
)

CHORD_NOTES = {
    "G": (67, 71, 74, 79),
    "D": (66, 69, 74, 78),
    "Em": (64, 67, 71, 76),
    "C": (64, 67, 72, 76),
    "Am": (69, 72, 76, 81),
    "F": (65, 69, 72, 77),
}

RHYTHMS = (
    (1, 0, 1, 0, 1, 1, 0, 1),
    (1, 0, 1, 1, 0, 1, 0, 1),
    (1, 1, 0, 1, 0, 1, 1, 0),
    (1, 0, 1, 0, 1, 0, 1, 1),
    (1, 1, 0, 0, 1, 1, 0, 1),
    (1, 0, 1, 1, 1, 0, 1, 0),
    (1, 0, 0, 1, 1, 0, 1, 1),
    (1, 1, 0, 1, 1, 0, 1, 0),
    (1, 0, 1, 0, 0, 1, 1, 1),
    (1, 1, 1, 0, 1, 0, 0, 1),
)


def stage_score(number):
    if not 1 <= number <= 30:
        raise ValueError("stage number must be between 1 and 30")
    world = (number - 1) // 10
    local = (number - 1) % 10
    rng = random.Random(20261025 + number * 7919)
    four_chords = WORLDS[world][local % 5]
    if local >= 5:
        four_chords = (four_chords[0], four_chords[2], four_chords[1], four_chords[3])
    chords = (*four_chords, *four_chords)
    rhythmic_shape = RHYTHMS[local]
    melody = []
    anchor = rng.randrange(4)
    contour = rng.choice((-2, -1, 1, 2))
    for bar, chord in enumerate(chords):
        notes = CHORD_NOTES[chord]
        row = []
        pattern = rhythmic_shape if bar < 4 else RHYTHMS[(local + 3) % len(RHYTHMS)]
        for slot, enabled in enumerate(pattern):
            if not enabled:
                row.append(None)
                continue
            position = (anchor + contour * slot + (bar % 4) * (1 if world == 0 else -1)) % 4
            pitch = notes[position] + (12 if position == 0 and world == 2 else 0)
            if bar >= 4 and slot in (3, 6):
                pitch = notes[(position + 1) % 4]
            row.append(pitch)
        melody.append(row)
    return chords, melody


def render_stage(number, mode):
    chords, melody = stage_score(number)
    world = (number - 1) // 10
    step = (number - 1) % 10
    editing = mode == "edit"
    bpm = (92, 100, 88)[world] + (step % 5) * 3 if editing else (128, 138, 122)[world] + (step % 5) * 4
    kind = "title" if editing else "game"
    return mix_bgm(f"stage-{number}-{mode}", bpm, chords, melody, kind)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", type=int, choices=range(1, 31))
    args = parser.parse_args()
    stages = [args.stage] if args.stage is not None else range(1, 31)
    for number in stages:
        for mode in ("edit", "run"):
            output = render_stage(number, mode)
            export(f"stage-{number}-{mode}", "bgm/stages", clean_master(output, -20.5, -3.5))
    print(f"Rendered {len(stages) * 2} stage BGM tracks", flush=True)


if __name__ == "__main__":
    main()
