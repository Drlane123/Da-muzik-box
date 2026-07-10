"""Shared paths and audio constants (all assets stay under repo .cache/)."""
from __future__ import annotations

from pathlib import Path

# Repo root: python/ai_song_pipeline/config.py → parents[2]
REPO_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = REPO_ROOT / ".cache" / "ai-song-models"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_RATE = 44_100
HOP_SIZE = 512
FRAME_RATE = SAMPLE_RATE / HOP_SIZE  # ~86 Hz conditioning frames
N_HARMONICS = 16

# Default ONNX artifacts
MODEL_FP32 = CACHE_DIR / "conditioned_synth_fp32.onnx"
MODEL_OPTIMIZED = CACHE_DIR / "conditioned_synth_optimized.onnx"
MODEL_INT8 = CACHE_DIR / "conditioned_synth_int8.onnx"

# GM drum pitches for 8-row committee / AI Pattern drum grids (matches TS presets)
DRUM_ROW_GM_PITCH = (36, 38, 39, 42, 46, 50, 45, 37)

# Melody rows map to scale degrees; default C minor pentatonic base
MELODY_BASE_MIDI = 60
MELODY_ROW_SEMITONES = (0, 2, 3, 5, 7, 9, 10, 12)
