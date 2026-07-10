"""
Layer 3 — dynamic INT8 quantization for CPU inference.

Usage:
  python -m ai_song_pipeline.quantize.quantize_dynamic
"""
from __future__ import annotations

import argparse
from pathlib import Path

from onnxruntime.quantization import QuantType, quantize_dynamic

from ai_song_pipeline.config import MODEL_INT8, MODEL_OPTIMIZED


def file_kb(path: Path) -> float:
    return path.stat().st_size / 1024.0


def quantize_model(src: Path, dst: Path) -> Path:
    dst.parent.mkdir(parents=True, exist_ok=True)
    quantize_dynamic(
        model_input=str(src),
        model_output=str(dst),
        weight_type=QuantType.QInt8,
    )
    before = file_kb(src)
    after = file_kb(dst)
    reduction = (1.0 - after / before) * 100.0 if before > 0 else 0.0
    print(f"Quantized INT8 -> {dst}")
    print(f"  FP32/optimized: {before:.1f} KiB")
    print(f"  INT8:           {after:.1f} KiB  ({reduction:.1f}% smaller)")
    return dst


def main() -> None:
    parser = argparse.ArgumentParser(description="Dynamic INT8 quantize ONNX model")
    parser.add_argument("--in", dest="src", type=Path, default=MODEL_OPTIMIZED)
    parser.add_argument("--out", type=Path, default=MODEL_INT8)
    args = parser.parse_args()
    if not args.src.exists():
        raise SystemExit(f"Missing source model: {args.src} — run export + optimize first")
    quantize_model(args.src, args.out)


if __name__ == "__main__":
    main()
