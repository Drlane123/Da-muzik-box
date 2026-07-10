"""
Read raw pattern arrays or JSON exports from the local committee pattern generator.

Supports:
  • AiPatternClipPayload JSON (from app/lib/sessionClipContent.ts)
  • boolean[][] step grids per track
  • flat TokenStream arrays (pitch, velocity, step)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from ai_song_pipeline.config import DRUM_ROW_GM_PITCH, MELODY_BASE_MIDI, MELODY_ROW_SEMITONES
from ai_song_pipeline.schemas import CommitteePatternPayload, TokenStream


def load_committee_json(path: str | Path) -> CommitteePatternPayload:
    """Load a JSON file exported from the React app or committee runner."""
    raw = Path(path).read_text(encoding="utf-8")
    return CommitteePatternPayload.from_json(json.loads(raw))


def boolean_grid_to_tokens(
    pattern: list[list[bool]],
    *,
    bpm: float,
    loop_bars: int,
    steps_per_bar: int = 16,
    role: str = "drums",
    key_root: int = 0,
) -> TokenStream:
    """
    Convert an 8×N boolean step grid into flat token arrays.

    Row order matches patternPresets.ts / AiPatternScreen:
      drums: Kick, Snare, Clap, Hi-Hat, Open HH, Tom Hi, Tom Lo, Rim
      melody: scale degrees 0–7
    """
    pitches: list[int] = []
    velocities: list[int] = []
    steps: list[int] = []
    is_drum = role == "drums"
    total_cols = loop_bars * steps_per_bar

    for row_idx, row in enumerate(pattern):
        if not isinstance(row, list):
            continue
        for col in range(min(len(row), total_cols)):
            if not row[col]:
                continue
            if is_drum:
                pitch = DRUM_ROW_GM_PITCH[row_idx] if row_idx < len(DRUM_ROW_GM_PITCH) else 36 + row_idx
            else:
                semi = MELODY_ROW_SEMITONES[row_idx] if row_idx < len(MELODY_ROW_SEMITONES) else row_idx
                pitch = MELODY_BASE_MIDI + key_root + semi
            pitches.append(int(pitch))
            velocities.append(100 if is_drum else 90)
            steps.append(col)

    return TokenStream(
        pitches=pitches,
        velocities=velocities,
        step_indices=steps,
        steps_per_bar=steps_per_bar,
        bpm=bpm,
        loop_bars=loop_bars,
        is_drum=is_drum,
    )


def payload_to_token_streams(payload: CommitteePatternPayload) -> list[TokenStream]:
    """Expand a committee payload into one TokenStream per non-empty track."""
    steps_per_bar = max(1, payload.total_steps // max(1, payload.loop_length_bars))
    streams: list[TokenStream] = []

    for track in payload.tracks:
        pattern = track.get("pattern")
        if not pattern:
            continue
        role = str(track.get("role", "drums" if track.get("idx", 0) < 4 else "melody"))
        streams.append(
            boolean_grid_to_tokens(
                pattern,
                bpm=payload.bpm,
                loop_bars=payload.loop_length_bars,
                steps_per_bar=steps_per_bar,
                role=role,
                key_root=payload.key_root,
            )
        )
    return streams


def merge_token_streams(streams: list[TokenStream]) -> TokenStream:
    """Merge multiple tracks into one stream sorted by step index."""
    if not streams:
        return TokenStream([], [], [], bpm=120.0, loop_bars=4)
    base = streams[0]
    pitches = list(base.pitches)
    velocities = list(base.velocities)
    steps = list(base.step_indices)
    for s in streams[1:]:
        pitches.extend(s.pitches)
        velocities.extend(s.velocities)
        steps.extend(s.step_indices)
    order = np.argsort(steps)
    return TokenStream(
        pitches=[pitches[i] for i in order],
        velocities=[velocities[i] for i in order],
        step_indices=[steps[i] for i in order],
        steps_per_bar=base.steps_per_bar,
        bpm=base.bpm,
        loop_bars=base.loop_bars,
        is_drum=base.is_drum,
    )


def numpy_token_array_to_stream(
    arr: np.ndarray,
    *,
    bpm: float = 120.0,
    loop_bars: int = 4,
    steps_per_bar: int = 16,
) -> TokenStream:
    """
    Read a (N, 3) array: columns = [pitch, velocity, step_index].
    Useful when the committee generator outputs a single numeric buffer.
    """
    if arr.ndim != 2 or arr.shape[1] < 3:
        raise ValueError("Expected token array shape (N, 3+) with pitch, velocity, step")
    return TokenStream(
        pitches=[int(x) for x in arr[:, 0]],
        velocities=[int(x) for x in arr[:, 1]],
        step_indices=[int(x) for x in arr[:, 2]],
        steps_per_bar=steps_per_bar,
        bpm=bpm,
        loop_bars=loop_bars,
    )
