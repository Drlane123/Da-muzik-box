"""
Layer 4 — master orchestration loop.

Pipes conditioning tensors through an ONNX Runtime InferenceSession (CPU-only)
and streams PCM to playback or WAV file.

Usage:
  python -m ai_song_pipeline.runtime.pipeline --fixture python/fixtures/sample_pattern.json
  python -m ai_song_pipeline.runtime.pipeline --play
"""
from __future__ import annotations

import argparse
import queue
import threading
import time
import wave
from pathlib import Path
from typing import Callable

import numpy as np
import onnxruntime as ort
import sounddevice as sd

from ai_song_pipeline.config import HOP_SIZE, MODEL_INT8, MODEL_OPTIMIZED, SAMPLE_RATE
from ai_song_pipeline.ingest.grid_to_midi import token_stream_to_midi_events
from ai_song_pipeline.ingest.midi_to_conditioning import conditioning_to_batch, events_to_conditioning
from ai_song_pipeline.ingest.read_committee_output import (
    load_committee_json,
    merge_token_streams,
    payload_to_token_streams,
)
from ai_song_pipeline.schemas import ConditioningTensors


class OnnxSynthSession:
    """CPU-only ONNX Runtime wrapper for the conditioned synth."""

    def __init__(self, model_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                f"ONNX model not found: {model_path}\n"
                "Run: python -m ai_song_pipeline.export.torch_to_onnx && "
                "python -m ai_song_pipeline.export.optimize_onnx && "
                "python -m ai_song_pipeline.quantize.quantize_dynamic"
            )
        self.session = ort.InferenceSession(
            str(model_path),
            providers=["CPUExecutionProvider"],
        )
        self.input_names = [i.name for i in self.session.get_inputs()]
        self.output_name = self.session.get_outputs()[0].name

    def synthesize(self, cond: ConditioningTensors) -> np.ndarray:
        feeds = conditioning_to_batch(cond)
        # Align keys with exported graph
        ort_feeds = {}
        for name in self.input_names:
            if name in feeds:
                ort_feeds[name] = feeds[name]
            elif name == "loudness" and "amplitude" in feeds:
                ort_feeds[name] = feeds["amplitude"]
        audio = self.session.run([self.output_name], ort_feeds)[0]
        pcm = np.squeeze(audio).astype(np.float32)
        return np.clip(pcm, -1.0, 1.0)


class SequentialPipeline:
    """
    Queue-based glue: conditioning chunks → inference → audio chunks.

    Uses a worker thread so token/MIDI conversion can run ahead of synthesis.
    """

    def __init__(
        self,
        model_path: Path,
        *,
        on_audio_chunk: Callable[[np.ndarray], None] | None = None,
    ) -> None:
        self.synth = OnnxSynthSession(model_path)
        self.cond_queue: queue.Queue[ConditioningTensors | None] = queue.Queue(maxsize=8)
        self.audio_queue: queue.Queue[np.ndarray | None] = queue.Queue(maxsize=8)
        self.on_audio_chunk = on_audio_chunk
        self._stop = threading.Event()

    def _infer_worker(self) -> None:
        while not self._stop.is_set():
            try:
                item = self.cond_queue.get(timeout=0.1)
            except queue.Empty:
                continue
            if item is None:
                self.audio_queue.put(None)
                break
            pcm = self.synth.synthesize(item)
            self.audio_queue.put(pcm)
            if self.on_audio_chunk:
                self.on_audio_chunk(pcm)

    def start(self) -> None:
        self._worker = threading.Thread(target=self._infer_worker, daemon=True)
        self._worker.start()

    def stop(self) -> None:
        self._stop.set()
        self.cond_queue.put(None)

    def submit(self, cond: ConditioningTensors) -> None:
        self.cond_queue.put(cond)

    def collect_audio(self) -> np.ndarray:
        chunks: list[np.ndarray] = []
        while True:
            chunk = self.audio_queue.get()
            if chunk is None:
                break
            chunks.append(chunk)
        if not chunks:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(chunks)


def committee_json_to_conditioning(path: Path) -> ConditioningTensors:
    payload = load_committee_json(path)
    streams = payload_to_token_streams(payload)
    merged = merge_token_streams(streams)
    events = token_stream_to_midi_events(merged)
    loop_sec = payload.loop_length_bars * 4.0 * (60.0 / payload.bpm)
    return events_to_conditioning(events, duration_sec=loop_sec)


def write_wav(path: Path, pcm: np.ndarray, sample_rate: int = SAMPLE_RATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm16 = (np.clip(pcm, -1.0, 1.0) * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())


def play_pcm(pcm: np.ndarray, sample_rate: int = SAMPLE_RATE) -> None:
    sd.play(pcm, sample_rate)
    sd.wait()


def run_pipeline(
    conditioning: ConditioningTensors,
    model_path: Path,
    *,
    play: bool = False,
    wav_out: Path | None = None,
) -> np.ndarray:
    pipeline = SequentialPipeline(model_path)
    pipeline.start()
    t0 = time.perf_counter()
    pipeline.submit(conditioning)
    pipeline.stop()
    pcm = pipeline.collect_audio()
    elapsed = time.perf_counter() - t0
    rtf = conditioning.duration_sec / max(elapsed, 1e-6)
    print(f"Synthesized {conditioning.duration_sec:.2f}s audio in {elapsed:.3f}s (RTF {rtf:.1f}x)")

    if wav_out:
        write_wav(wav_out, pcm)
        print(f"Wrote {wav_out}")
    if play:
        play_pcm(pcm)
    return pcm


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline AI Song sequential pipeline")
    parser.add_argument("--fixture", type=Path, help="Committee / AiPattern JSON input")
    parser.add_argument("--model", type=Path, default=MODEL_INT8 if MODEL_INT8.exists() else MODEL_OPTIMIZED)
    parser.add_argument("--out", type=Path, default=Path("python/output/ai_song_preview.wav"))
    parser.add_argument("--play", action="store_true", help="Play audio via sounddevice")
    args = parser.parse_args()

    if not args.fixture:
        raise SystemExit("Provide --fixture path to a committee pattern JSON")

    cond = committee_json_to_conditioning(args.fixture)
    run_pipeline(cond, args.model, play=args.play, wav_out=args.out)


if __name__ == "__main__":
    main()
