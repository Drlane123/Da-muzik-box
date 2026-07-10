#!/usr/bin/env python3
"""
Batch-rename guitar DI samples to strict fretboard layout:
  string_[1-6]_fret_[0-24].wav

Guitarist string numbers (NOT coordinator index):
  1 = high e (E4, MIDI 64)
  6 = low E  (E2, MIDI 40)

Usage:
  python rename_guitar_samples.py --scan path/to/raw/wavs
  python rename_guitar_samples.py --scan path/to/raw --apply
  python rename_guitar_samples.py --scan path/to/raw --apply --out path/to/output
"""
from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

STRING_ROOTS: dict[int, int] = {
    1: 64,  # E4 high e
    2: 59,  # B3
    3: 55,  # G3
    4: 50,  # D3
    5: 45,  # A2
    6: 40,  # E2 low E
}

NOTE_NAME_TO_PC = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
}

STRICT_NAME = re.compile(r"^string_([1-6])_fret_(\d{1,2})\.wav$", re.IGNORECASE)
MIDI_IN_NAME = re.compile(r"(?:midi|note|pitch)[_\- ]*(\d{1,3})", re.IGNORECASE)
NOTE_OCTAVE = re.compile(r"([A-Ga-g])([#b]?)(-?\d+)")


def midi_from_note_token(token: str) -> int | None:
    m = NOTE_OCTAVE.search(token)
    if not m:
        return None
    letter = m.group(1).upper()
    acc = m.group(2)
    octave = int(m.group(3))
    name = letter + acc
    pc = NOTE_NAME_TO_PC.get(name)
    if pc is None:
        return None
    return (octave + 1) * 12 + pc


def parse_source_midi(path: Path) -> int | None:
    stem = path.stem

    strict = STRICT_NAME.match(path.name)
    if strict:
        string_num = int(strict.group(1))
        fret = int(strict.group(2))
        root = STRING_ROOTS.get(string_num)
        if root is None:
            return None
        return root + fret

    midi_match = MIDI_IN_NAME.search(stem)
    if midi_match:
        value = int(midi_match.group(1))
        if 0 <= value <= 127:
            return value

    note_midi = midi_from_note_token(stem)
    if note_midi is not None and 0 <= note_midi <= 127:
        return note_midi

    digits = re.findall(r"\d{1,3}", stem)
    for d in reversed(digits):
        value = int(d)
        if 24 <= value <= 96:
            return value

    return None


def map_midi_to_string_fret(midi: int) -> tuple[int, int] | None:
    """High string first — matches FretboardCoordinator scan order."""
    for string_num in range(1, 7):
        root = STRING_ROOTS[string_num]
        fret = midi - root
        if 0 <= fret <= 24:
            return string_num, fret
    return None


def target_name(string_num: int, fret: int) -> str:
    return f"string_{string_num}_fret_{fret}.wav"


def rename_guitar_samples(folder_path: Path, out_dir: Path | None, apply: bool) -> int:
    folder_path = folder_path.resolve()
    output = (out_dir or folder_path).resolve()
    output.mkdir(parents=True, exist_ok=True)

    print(f"Targeting asset directory: {folder_path}")
    print(f"Output directory: {output}")
    print("Expected final pattern: string_[1-6]_fret_[0-24].wav")

    wav_files = sorted(folder_path.rglob("*.wav"))
    if not wav_files:
        print("No .wav files found.")
        return 1

    planned: dict[str, Path] = {}
    skipped: list[str] = []

    for src in wav_files:
        if src.parent.resolve() == output.resolve() and STRICT_NAME.match(src.name):
            planned[src.name] = src
            continue

        midi = parse_source_midi(src)
        if midi is None:
            skipped.append(f"{src.name} (could not infer MIDI)")
            continue

        mapped = map_midi_to_string_fret(midi)
        if mapped is None:
            skipped.append(f"{src.name} (MIDI {midi} outside guitar range)")
            continue

        string_num, fret = mapped
        name = target_name(string_num, fret)
        if name in planned and planned[name] != src:
            skipped.append(f"{src.name} (collision on {name})")
            continue
        planned[name] = src

    print(f"\nResolved {len(planned)} sample(s).")
    for name in sorted(planned):
        src = planned[name]
        dst = output / name
        action = "COPY" if apply else "DRY-RUN"
        print(f"  [{action}] {src.name} -> {dst}")

    if skipped:
        print(f"\nSkipped {len(skipped)} file(s):")
        for line in skipped:
            print(f"  - {line}")

    if not apply:
        print("\nRe-run with --apply to write files.")
        return 0

    for name, src in planned.items():
        dst = output / name
        if src.resolve() == dst.resolve():
            continue
        shutil.copy2(src, dst)

    print("\nDone.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Rename guitar WAVs to string_X_fret_Y.wav")
    parser.add_argument("--scan", required=True, type=Path, help="Folder containing raw .wav files")
    parser.add_argument("--out", type=Path, default=None, help="Output folder (default: same as --scan)")
    parser.add_argument("--apply", action="store_true", help="Perform copy/rename (default is dry-run)")
    args = parser.parse_args()
    return rename_guitar_samples(args.scan, args.out, args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
