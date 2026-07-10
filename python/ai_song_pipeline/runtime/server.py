"""
Flask HTTP bridge for the React AiSongScreen (100% local, no cloud).

POST /ai-song/generate
  • JSON body: AiPatternClipPayload or { "fixture": "path" } for dev
  • Returns: audio/wav bytes

GET /ai-song/health
  • Model path + ORT provider check

Usage:
  python -m ai_song_pipeline.runtime.server
"""
from __future__ import annotations

import io
import json
import sys
import wave
from pathlib import Path

try:
    from flask import Flask, Response, request
    from flask_cors import CORS
except ImportError:
    print("pip install flask flask-cors", file=sys.stderr)
    raise

import numpy as np

from ai_song_pipeline.config import MODEL_INT8, MODEL_OPTIMIZED, REPO_ROOT, SAMPLE_RATE
from ai_song_pipeline.ingest.arrangement import (
    bass_melody_events,
    loop_duration_sec,
    merge_midi_events,
    pad_chord_pitches,
    section_fill_events,
    tile_events,
)
from ai_song_pipeline.runtime.procedural_audio import events_to_pcm
from ai_song_pipeline.ingest.grid_to_midi import token_stream_to_midi_events
from ai_song_pipeline.ingest.read_committee_output import (
    CommitteePatternPayload,
    merge_token_streams,
    payload_to_token_streams,
)
from ai_song_pipeline.runtime.pipeline import OnnxSynthSession, write_wav

USE_PROCEDURAL_RENDERER = True

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

DEFAULT_MODEL = MODEL_INT8 if MODEL_INT8.exists() else MODEL_OPTIMIZED
_synth: OnnxSynthSession | None = None


def get_synth() -> OnnxSynthSession:
    global _synth
    if _synth is None:
        _synth = OnnxSynthSession(DEFAULT_MODEL)
    return _synth


def payload_to_pcm(data: dict) -> np.ndarray:
    payload = CommitteePatternPayload.from_json(data)
    streams = payload_to_token_streams(payload)
    merged = merge_token_streams(streams)
    drum_events = token_stream_to_midi_events(merged)
    output_bars = max(payload.loop_length_bars, payload.output_bars)
    tiled = tile_events(
        drum_events,
        loop_bars=payload.loop_length_bars,
        output_bars=output_bars,
        bpm=payload.bpm,
    )
    fills = section_fill_events(
        tiled,
        output_bars=output_bars,
        bpm=payload.bpm,
        loop_bars=payload.loop_length_bars,
    )
    bass = bass_melody_events(payload, output_bars=output_bars)
    events = merge_midi_events(tiled, fills, bass)
    duration_sec = loop_duration_sec(output_bars, payload.bpm)
    if USE_PROCEDURAL_RENDERER:
        return events_to_pcm(
            events,
            duration_sec=duration_sec,
            pad_roots=pad_chord_pitches(payload),
            bpm=payload.bpm,
        )
    from ai_song_pipeline.ingest.midi_to_conditioning import events_to_conditioning

    cond = events_to_conditioning(events, duration_sec=duration_sec)
    return get_synth().synthesize(cond)


def pcm_to_wav_bytes(pcm: np.ndarray) -> bytes:
    buf = io.BytesIO()
    pcm16 = (np.clip(pcm, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm16.tobytes())
    return buf.getvalue()


@app.route("/ai-song/health", methods=["GET"])
def health():
    model_ok = DEFAULT_MODEL.exists()
    return {
        "ok": True,
        "model": str(DEFAULT_MODEL),
        "model_ready": model_ok,
        "repo_root": str(REPO_ROOT),
        "message": "Ready (procedural drums+bass)" if model_ok else "Export ONNX model first (see python/README.md)",
        "renderer": "procedural_v2",
    }


@app.route("/ai-song/generate", methods=["POST"])
def generate():
    try:
        if request.content_type and "application/json" in request.content_type:
            data = request.get_json(force=True) or {}
        else:
            raw = request.get_data(as_text=True)
            data = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {"error": "invalid JSON"}, 400

    if not DEFAULT_MODEL.exists():
        return {"error": "ONNX model not built — run python setup scripts in python/README.md"}, 503

    try:
        pcm = payload_to_pcm(data)
    except Exception as exc:
        return {"error": str(exc)}, 400

    return Response(pcm_to_wav_bytes(pcm), mimetype="audio/wav")


def main() -> None:
    port = int(__import__("os").environ.get("AI_SONG_PORT", "8001"))
    print(f"AI Song server http://127.0.0.1:{port}  model={DEFAULT_MODEL}")
    app.run(host="127.0.0.1", port=port, debug=False)


if __name__ == "__main__":
    main()
