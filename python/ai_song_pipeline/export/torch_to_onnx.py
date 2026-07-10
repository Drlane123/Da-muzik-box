"""
Layer 2 — export PyTorch conditioned synth → ONNX (FP32).

Usage:
  python -m ai_song_pipeline.export.torch_to_onnx
"""
from __future__ import annotations

import argparse
from pathlib import Path

import torch

from ai_song_pipeline.config import CACHE_DIR, HOP_SIZE, MODEL_FP32
from ai_song_pipeline.models.ddsp_conditioned import build_default_model


def export_onnx(
    output_path: Path = MODEL_FP32,
    *,
    example_frames: int = 128,
    opset: int = 17,
) -> Path:
    model = build_default_model()
    model.eval()

    f0 = torch.randn(1, example_frames).abs() * 220.0
    loudness = torch.rand(1, example_frames)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        (f0, loudness),
        str(output_path),
        input_names=["f0", "loudness"],
        output_names=["audio"],
        dynamic_axes={
            "f0": {1: "frames"},
            "loudness": {1: "frames"},
            "audio": {1: "samples"},
        },
        opset_version=max(18, opset),
        do_constant_folding=True,
        dynamo=False,
    )
    print(f"Exported FP32 ONNX -> {output_path} ({output_path.stat().st_size / 1024:.1f} KiB)")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export conditioned synth to ONNX")
    parser.add_argument("--out", type=Path, default=MODEL_FP32)
    parser.add_argument("--frames", type=int, default=128)
    args = parser.parse_args()
    export_onnx(args.out, example_frames=args.frames)
    print(f"Hop size: {HOP_SIZE} | Cache dir: {CACHE_DIR}")


if __name__ == "__main__":
    main()
