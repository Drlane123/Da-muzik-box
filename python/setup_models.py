#!/usr/bin/env python3
"""One-shot: export FP32 → optimize → INT8 quantize."""
from __future__ import annotations

from ai_song_pipeline.export.optimize_onnx import optimize_onnx_graph
from ai_song_pipeline.export.torch_to_onnx import export_onnx
from ai_song_pipeline.quantize.quantize_dynamic import quantize_model
from ai_song_pipeline.config import MODEL_FP32, MODEL_OPTIMIZED, MODEL_INT8


def main() -> None:
    print("=== 1/3 Export PyTorch -> ONNX (FP32) ===")
    export_onnx(MODEL_FP32)
    print("\n=== 2/3 Optimize ONNX graph ===")
    optimize_onnx_graph(MODEL_FP32, MODEL_OPTIMIZED)
    print("\n=== 3/3 Dynamic INT8 quantization ===")
    quantize_model(MODEL_OPTIMIZED, MODEL_INT8)
    print("\nDone. Models in .cache/ai-song-models/")


if __name__ == "__main__":
    main()
