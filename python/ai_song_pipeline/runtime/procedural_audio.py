"""
CPU procedural beat renderer — kick / snare / hat / sub-bass without ONNX clicks.

Replaces the placeholder harmonic synth for AiSongScreen previews.
"""
from __future__ import annotations

import numpy as np

from ai_song_pipeline.config import SAMPLE_RATE
from ai_song_pipeline.ingest.grid_to_midi import midi_note_to_hz
from ai_song_pipeline.schemas import MidiEvent

_KICK_PITCHES = frozenset({36})
_SNARE_PITCHES = frozenset({38, 39, 37, 40})
_HAT_PITCHES = frozenset({42, 44, 46})
_TOM_PITCHES = frozenset({45, 47, 50})


def _mix_at(buffer: np.ndarray, start: int, chunk: np.ndarray, gain: float = 1.0) -> None:
    if start >= len(buffer):
        return
    end = min(len(buffer), start + len(chunk))
    n = end - start
    if n <= 0:
        return
    buffer[start:end] += chunk[:n].astype(np.float32) * gain


def _kick(sr: int, vel: float) -> np.ndarray:
    dur = int(0.28 * sr)
    t = np.arange(dur, dtype=np.float64) / sr
    pitch = 90.0 * np.exp(-7.5 * t) + 42.0
    phase = 2.0 * np.pi * np.cumsum(pitch / sr)
    body = np.sin(phase) * np.exp(-5.5 * t)
    click_n = min(int(0.006 * sr), dur)
    click = np.zeros(dur, dtype=np.float64)
    if click_n > 0:
        click[:click_n] = np.random.randn(click_n) * np.exp(-280.0 * t[:click_n])
    out = body * 0.85 + click * 0.35
    return (out * vel * 1.15).astype(np.float32)


def _snare(sr: int, vel: float) -> np.ndarray:
    dur = int(0.16 * sr)
    t = np.arange(dur, dtype=np.float64) / sr
    noise = np.random.randn(dur)
    # Band-pass-ish: emphasize mid/high for snap
    snap = noise * np.exp(-22.0 * t)
    body = np.sin(2.0 * np.pi * 180.0 * t) * np.exp(-14.0 * t) * 0.45
    out = snap * 0.55 + body
    return (out * vel * 0.95).astype(np.float32)


def _hat(sr: int, vel: float, open_hat: bool = False) -> np.ndarray:
    dur = int((0.11 if open_hat else 0.045) * sr)
    t = np.arange(dur, dtype=np.float64) / sr
    noise = np.random.randn(dur)
    decay = 35.0 if open_hat else 70.0
    out = noise * np.exp(-decay * t)
    return (out * vel * (0.42 if open_hat else 0.32)).astype(np.float32)


def _tom(sr: int, vel: float, pitch: int) -> np.ndarray:
    dur = int(0.2 * sr)
    t = np.arange(dur, dtype=np.float64) / sr
    hz = midi_note_to_hz(pitch) * 0.55
    out = np.sin(2.0 * np.pi * hz * t) * np.exp(-9.0 * t)
    return (out * vel * 0.75).astype(np.float32)


def _sub_bass(sr: int, pitch: int, dur_sec: float, vel: float) -> np.ndarray:
    n = max(1, int(dur_sec * sr))
    t = np.arange(n, dtype=np.float64) / sr
    hz = midi_note_to_hz(pitch)
    attack = np.minimum(1.0, t / 0.018)
    release = np.exp(-2.2 * t / max(dur_sec, 0.08))
    env = attack * release
    fundamental = np.sin(2.0 * np.pi * hz * t)
    warm = 0.22 * np.sin(2.0 * np.pi * hz * 2.0 * t)
    out = (fundamental + warm) * env
    return (out * vel * 0.62).astype(np.float32)


def _pad_chord(sr: int, pitches: list[int], dur_sec: float, vel: float) -> np.ndarray:
    n = max(1, int(dur_sec * sr))
    t = np.arange(n, dtype=np.float64) / sr
    env = np.minimum(1.0, t / 0.08) * np.exp(-0.55 * t / max(dur_sec, 0.5))
    wave = np.zeros(n, dtype=np.float64)
    for p in pitches:
        hz = midi_note_to_hz(p)
        wave += np.sin(2.0 * np.pi * hz * t)
    wave /= max(len(pitches), 1)
    return (wave * env * vel * 0.18).astype(np.float32)


def render_drum_hit(pitch: int, velocity: int, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    vel = max(0.15, min(1.0, velocity / 127.0))
    if pitch in _KICK_PITCHES:
        return _kick(sample_rate, vel)
    if pitch in _SNARE_PITCHES:
        return _snare(sample_rate, vel)
    if pitch in _HAT_PITCHES:
        return _hat(sample_rate, vel, open_hat=pitch in {46})
    if pitch in _TOM_PITCHES:
        return _tom(sample_rate, vel, pitch)
    return _snare(sample_rate, vel * 0.7)


def events_to_pcm(
    events: list[MidiEvent],
    *,
    duration_sec: float,
    sample_rate: int = SAMPLE_RATE,
    pad_roots: list[int] | None = None,
    pad_every_bars: int = 4,
    bpm: float = 120.0,
) -> np.ndarray:
    """Mix all MIDI events into a single PCM buffer."""
    n_samples = max(1, int(duration_sec * sample_rate))
    mix = np.zeros(n_samples, dtype=np.float32)

    for ev in events:
        start = int(ev.start_sec * sample_rate)
        vel = ev.velocity / 127.0
        if ev.is_drum:
            chunk = render_drum_hit(ev.pitch, ev.velocity, sample_rate)
            _mix_at(mix, start, chunk, gain=1.0)
        else:
            chunk = _sub_bass(sample_rate, ev.pitch, ev.duration_sec, vel)
            _mix_at(mix, start, chunk, gain=1.0)

    if pad_roots:
        sec_per_bar = 4.0 * (60.0 / bpm)
        pad_dur = sec_per_bar * pad_every_bars * 0.92
        for bar in range(0, int(duration_sec / sec_per_bar), pad_every_bars):
            t = int(bar * sec_per_bar * sample_rate)
            pad = _pad_chord(sample_rate, pad_roots, pad_dur, 0.55)
            _mix_at(mix, t, pad, gain=1.0)

    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 1e-6:
        mix *= 0.92 / peak
    return np.tanh(mix * 1.08).astype(np.float32)
