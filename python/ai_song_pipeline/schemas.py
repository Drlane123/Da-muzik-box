"""Data contracts shared across ingest, export, and runtime."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class MidiEvent:
    """Single note event with absolute time in seconds."""

    pitch: int
    velocity: int
    start_sec: float
    duration_sec: float
    is_drum: bool = False


@dataclass
class ConditioningTensors:
    """Frame-rate f0 (Hz) and amplitude (0–1) for the neural synthesizer."""

    f0: np.ndarray  # shape (frames,)
    amplitude: np.ndarray  # shape (frames,)
    sample_rate: int
    hop_size: int

    @property
    def duration_sec(self) -> float:
        return len(self.f0) * self.hop_size / self.sample_rate

    @property
    def frame_count(self) -> int:
        return int(self.f0.shape[0])


@dataclass
class CommitteePatternPayload:
    """
    Mirrors `AiPatternClipPayload` from app/lib/sessionClipContent.ts
    plus optional per-track role hints from the committee generator.
    """

    bpm: float
    loop_length_bars: int
    total_steps: int
    tracks: list[dict[str, Any]] = field(default_factory=list)
    key_root: int = 0
    mode: str = "minor"
    genre: str = "hip-hop"
    mood: str = "chill"
    output_bars: int = 32

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "CommitteePatternPayload":
        loop = int(data.get("loopLength", data.get("loop_length_bars", 4)))
        out_bars = int(data.get("outputBars", data.get("output_bars", 32)))
        out_bars = max(loop, min(64, out_bars))
        return cls(
            bpm=float(data.get("bpm", 120)),
            loop_length_bars=loop,
            total_steps=int(data.get("totalSteps", data.get("total_steps", loop * 16))),
            tracks=list(data.get("tracks", [])),
            key_root=int(data.get("keyRoot", data.get("key_root", 0))),
            mode=str(data.get("mode", "minor")),
            genre=str(data.get("genre", "hip-hop")),
            mood=str(data.get("mood", "chill")),
            output_bars=out_bars,
        )


@dataclass
class TokenStream:
    """Raw token rows from a local committee generator (alternative ingest)."""

    pitches: list[int]
    velocities: list[int]
    step_indices: list[int]
    steps_per_bar: int = 16
    bpm: float = 120.0
    loop_bars: int = 4
    is_drum: bool = False
