#!/usr/bin/env python3
"""
R&B Pop chord progression reference library for Geno B01.
Structured for DAW import — mirrors se2SynthGenoLiveChordPresetsRnbPop.ts.

Sources: neo-soul/R&B theory (ii–V–I turnarounds, gospel dim passing),
moody minor pop loops (Drake/SZA/Bryson lane), Hooktheory-style chart harmony.
"""
from __future__ import annotations

from typing import Any, TypedDict


class ChordStep(TypedDict):
    chord_name: str
    midi_notes: list[int]
    duration_beats: float


class Progression(TypedDict):
    progression_name: str
    genre: str
    key: str
    romans: list[str]
    chords: list[ChordStep]


# ── C major reference voicings (7th-heavy R&B Pop stacks) ──────────────────

_C_MAJOR_VOICINGS: dict[str, list[int]] = {
    "Cmaj7": [60, 64, 67, 71],
    "Cmaj9": [60, 64, 67, 71, 74],
    "Dm7": [62, 65, 69, 72],
    "Dm9": [62, 65, 69, 72, 76],
    "Em7": [64, 67, 71, 74],
    "Fmaj7": [65, 69, 72, 76],
    "G7": [55, 59, 62, 66],
    "G9": [55, 59, 62, 66, 69],
    "Am7": [57, 60, 64, 67],
    "Am9": [57, 60, 64, 67, 71],
    "Bm7b5": [59, 62, 65, 69],
    "Bdim7": [59, 62, 65, 68],
}

# ── A minor reference voicings ─────────────────────────────────────────────

_A_MINOR_VOICINGS: dict[str, list[int]] = {
    "Am7": [57, 60, 64, 67],
    "Am9": [57, 60, 64, 67, 71],
    "Bm7b5": [59, 62, 65, 69],
    "Cmaj7": [60, 64, 67, 71],
    "Dm7": [62, 65, 69, 72],
    "Em7": [64, 67, 71, 74],
    "Fmaj7": [65, 69, 72, 76],
    "G7": [55, 59, 62, 66],
    "G7b9": [55, 59, 62, 66, 70],
    "G9": [55, 59, 62, 66, 69],
}


def _steps(
    names: list[str],
    voicing_map: dict[str, list[int]],
    durations: list[float] | None = None,
) -> list[ChordStep]:
    durs = durations or [4.0] * len(names)
    return [
        {
            "chord_name": name,
            "midi_notes": voicing_map[name],
            "duration_beats": durs[i],
        }
        for i, name in enumerate(names)
    ]


RNB_POP_PROGRESSIONS: list[Progression] = [
    {
        "progression_name": "Neo_Soul_Minor_9th_Turnaround",
        "genre": "R&B / Neo-Soul",
        "key": "C minor",
        "romans": ["iiø7", "V7", "im9", "bVII"],
        "chords": _steps(["Bm7b5", "G7b9", "Am9", "G7"], _A_MINOR_VOICINGS, [4, 4, 8, 4]),
    },
    {
        "progression_name": "Soulful_Major_9th_Turnaround",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["ii7", "V9", "Imaj9", "vi7"],
        "chords": _steps(["Dm9", "G9", "Cmaj9", "Am7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Radio_Soul_vi_IV_Hook",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["vi7", "IVmaj7", "Imaj7", "V7"],
        "chords": _steps(["Am7", "Fmaj7", "Cmaj7", "G7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Gospel_Dim_Passing",
        "genre": "R&B / Gospel",
        "key": "C major",
        "romans": ["Imaj7", "vii°7", "iii7", "vi7"],
        "chords": _steps(["Cmaj7", "Bdim7", "Em7", "Am7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Moody_Pop_Minor_Loop",
        "genre": "R&B Pop / Minor",
        "key": "A minor",
        "romans": ["im7", "iv7", "v7", "im7"],
        "chords": _steps(["Am7", "Dm7", "Em7", "Am7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Drake_Mood_VI_bVII",
        "genre": "R&B Pop / Minor",
        "key": "A minor",
        "romans": ["im7", "VImaj7", "bVII", "iv7"],
        "chords": _steps(["Am7", "Fmaj7", "G7", "Dm7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "SZA_Minor_iv_bVI",
        "genre": "R&B Pop / Minor",
        "key": "A minor",
        "romans": ["im7", "iv7", "bVImaj7", "bVII"],
        "chords": _steps(["Am7", "Dm7", "Fmaj7", "G7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Chart_Axis_I_V_vi_IV",
        "genre": "Pop / R&B Pop",
        "key": "C major",
        "romans": ["Imaj7", "V7", "vi7", "IVmaj7"],
        "chords": _steps(["Cmaj7", "G7", "Am7", "Fmaj7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Plagal_Soul_IV_I",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["Imaj7", "IVmaj7", "vi7", "V7"],
        "chords": _steps(["Cmaj7", "Fmaj7", "Am7", "G7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Secondary_Dominant_Chain",
        "genre": "R&B / Neo-Soul",
        "key": "C major",
        "romans": ["ii7", "V7", "iii7", "vi7"],
        "chords": _steps(["Dm7", "G7", "Em7", "Am7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Dorian_Minor_9_Vamp",
        "genre": "R&B / Neo-Soul",
        "key": "A minor (Dorian)",
        "romans": ["im7", "IVmaj7", "im7", "bVIImaj7"],
        "chords": _steps(["Am7", "Fmaj7", "Am7", "G7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Cycle_of_Fourths_Turn",
        "genre": "R&B / Jazz-Pop",
        "key": "C major",
        "romans": ["Imaj7", "IVmaj7", "vii°7", "iii7"],
        "chords": _steps(["Cmaj7", "Fmaj7", "Bdim7", "Em7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Bryson_I_iii_vi_IV",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["Imaj7", "iii7", "vi7", "IVmaj7"],
        "chords": _steps(["Cmaj7", "Em7", "Am7", "Fmaj7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "HER_vi_IV_ii_V",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["vi7", "IVmaj7", "ii7", "V7"],
        "chords": _steps(["Am7", "Fmaj7", "Dm7", "G7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Gospel_Minor_Dim_Drop",
        "genre": "R&B / Gospel",
        "key": "A minor",
        "romans": ["im7", "iiø7", "V7", "bVImaj7"],
        "chords": _steps(["Am7", "Bm7b5", "G7", "Fmaj7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Late_Night_Slow_Jam",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["Imaj7", "vi7", "ii7", "V7"],
        "chords": _steps(["Cmaj7", "Am7", "Dm7", "G7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "TikTok_Heart_vi_IV_V_I",
        "genre": "Pop / R&B Pop",
        "key": "C major",
        "romans": ["vi7", "IVmaj7", "V7", "Imaj7"],
        "chords": _steps(["Am7", "Fmaj7", "G7", "Cmaj7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "After_Hours_Minor",
        "genre": "R&B Pop / Minor",
        "key": "A minor",
        "romans": ["im7", "bVImaj7", "bVII", "iv7"],
        "chords": _steps(["Am7", "Fmaj7", "G7", "Dm7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Frank_Blend_Dream",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["Imaj7", "iii7", "vi7", "IVmaj7"],
        "chords": _steps(["Cmaj7", "Em7", "Am7", "Fmaj7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Daniel_Caesar_Turn",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["Imaj7", "IVmaj7", "ii7", "V7"],
        "chords": _steps(["Cmaj7", "Fmaj7", "Dm7", "G7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Trap_Soul_Minor",
        "genre": "R&B Pop / Trap Soul",
        "key": "A minor",
        "romans": ["im7", "bVII", "VImaj7", "iv7"],
        "chords": _steps(["Am7", "G7", "Fmaj7", "Dm7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Stevie_Groove_ii_V",
        "genre": "R&B / Soul-Pop",
        "key": "C major",
        "romans": ["Imaj7", "vi7", "ii7", "V7"],
        "chords": _steps(["Cmaj7", "Am7", "Dm7", "G7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Kiss_Cam_Stadium",
        "genre": "Pop / R&B Pop",
        "key": "C major",
        "romans": ["IVmaj7", "V7", "vi7", "Imaj7"],
        "chords": _steps(["Fmaj7", "G7", "Am7", "Cmaj7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Summer_Heart_vi_IV_I",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["vi7", "IVmaj7", "Imaj7", "V7"],
        "chords": _steps(["Am7", "Fmaj7", "Cmaj7", "G7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Bryson_Night_bVII",
        "genre": "R&B Pop / Minor",
        "key": "A minor",
        "romans": ["im7", "bVII", "VImaj7", "iv7"],
        "chords": _steps(["Am7", "G7", "Fmaj7", "Dm7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Erykah_Dorian_ii",
        "genre": "R&B / Neo-Soul",
        "key": "A minor (Dorian)",
        "romans": ["im7", "ii7", "im7", "IVmaj7"],
        "chords": _steps(["Am7", "Bm7b5", "Am7", "Fmaj7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Gospel_Pop_IV_Lift",
        "genre": "R&B Pop / Gospel",
        "key": "C major",
        "romans": ["IVmaj7", "Imaj7", "V7", "vi7"],
        "chords": _steps(["Fmaj7", "Cmaj7", "G7", "Am7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "SZA_Glide_vi_ii_V",
        "genre": "R&B Pop",
        "key": "C major",
        "romans": ["vi7", "ii7", "V7", "Imaj7"],
        "chords": _steps(["Am7", "Dm7", "G7", "Cmaj7"], _C_MAJOR_VOICINGS),
    },
    {
        "progression_name": "Soul_Plagal_Minor_iv_i",
        "genre": "R&B Pop / Minor",
        "key": "A minor",
        "romans": ["im7", "iv7", "bVImaj7", "bVII"],
        "chords": _steps(["Am7", "Dm7", "Fmaj7", "G7"], _A_MINOR_VOICINGS),
    },
    {
        "progression_name": "Dangelo_Float_Dorian",
        "genre": "R&B / Neo-Soul",
        "key": "A minor (Dorian)",
        "romans": ["im7", "IVmaj7", "iii7", "bVIImaj7"],
        "chords": _steps(["Am7", "Fmaj7", "Em7", "G7"], _A_MINOR_VOICINGS),
    },
]


def progression_count() -> int:
    return len(RNB_POP_PROGRESSIONS)


def as_json_ready() -> list[dict[str, Any]]:
    return list(RNB_POP_PROGRESSIONS)


if __name__ == "__main__":
    import json

    print(f"R&B Pop progression library: {progression_count()} entries\n")
    for p in RNB_POP_PROGRESSIONS[:3]:
        print(json.dumps(p, indent=2))
        print()
