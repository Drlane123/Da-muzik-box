"""
Convert MIDI note events → continuous f0 and amplitude conditioning tensors.

These arrays feed the DDSP-style ONNX synthesizer (frame rate = sample_rate / hop_size).
"""
from __future__ import annotations

import numpy as np

from ai_song_pipeline.config import HOP_SIZE, SAMPLE_RATE
from ai_song_pipeline.ingest.grid_to_midi import midi_note_to_hz
from ai_song_pipeline.schemas import ConditioningTensors, MidiEvent

# Per-drum hit level + length (GM pitch → synth envelope). Drums stay unvoiced (f0=0).
_DRUM_HIT_AMP: dict[int, float] = {
    36: 1.0,   # kick
    38: 0.9,   # snare
    39: 0.75,  # clap
    42: 0.55,  # closed hat
    46: 0.6,   # open hat
    50: 0.7,   # tom hi
    45: 0.72,  # tom lo
    37: 0.65,  # rim
}
_DRUM_DUR_SCALE: dict[int, float] = {
    36: 1.4,
    38: 1.0,
    42: 0.35,
    46: 0.5,
}


def events_to_conditioning(
    events: list[MidiEvent],
    *,
    duration_sec: float | None = None,
    sample_rate: int = SAMPLE_RATE,
    hop_size: int = HOP_SIZE,
    default_f0: float = 0.0,
) -> ConditioningTensors:
    """
    Rasterize note events into frame-aligned f0 (Hz) and amplitude (0–1).

    When multiple notes overlap, keeps the highest pitch and sums velocity energy.
    """
    if duration_sec is None:
        duration_sec = max((e.start_sec + e.duration_sec for e in events), default=1.0)
    duration_sec = max(0.25, duration_sec)

    n_frames = int(np.ceil(duration_sec * sample_rate / hop_size))
    f0 = np.zeros(n_frames, dtype=np.float32)
    amp = np.zeros(n_frames, dtype=np.float32)

    for ev in events:
        dur = ev.duration_sec
        vel = ev.velocity / 127.0
        if ev.is_drum:
            dur *= _DRUM_DUR_SCALE.get(ev.pitch, 1.0)
            hit_amp = vel * _DRUM_HIT_AMP.get(ev.pitch, 0.75)
        else:
            hit_amp = vel * 0.55

        start_frame = int(ev.start_sec * sample_rate / hop_size)
        end_frame = int((ev.start_sec + dur) * sample_rate / hop_size)
        start_frame = max(0, min(n_frames - 1, start_frame))
        end_frame = max(start_frame + 1, min(n_frames, end_frame))
        sl = slice(start_frame, end_frame)

        if ev.is_drum:
            # Noise hits — do NOT map GM drum pitch to tonal f0 (was the "that that" loop).
            amp[sl] = np.maximum(amp[sl], hit_amp)
        else:
            hz = midi_note_to_hz(ev.pitch)
            f0[sl] = np.maximum(f0[sl], hz)
            amp[sl] = np.clip(amp[sl] + hit_amp, 0.0, 1.0)

    # Silence → zero f0 (model treats as unvoiced)
    silent = amp < 1e-4
    f0[silent] = default_f0

    # Simple exponential decay on amplitude between hits
    decay = 0.985
    for i in range(1, n_frames):
        if amp[i] < amp[i - 1] * decay:
            amp[i] = amp[i - 1] * decay

    return ConditioningTensors(f0=f0, amplitude=amp, sample_rate=sample_rate, hop_size=hop_size)


def conditioning_to_batch(cond: ConditioningTensors) -> dict[str, np.ndarray]:
    """ONNX Runtime input dict (batch dim = 1)."""
    return {
        "f0": cond.f0.astype(np.float32)[np.newaxis, :],
        "loudness": cond.amplitude.astype(np.float32)[np.newaxis, :],
    }
