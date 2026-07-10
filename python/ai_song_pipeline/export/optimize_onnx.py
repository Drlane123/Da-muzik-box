"""
ONNX graph cleanup — strip training nodes, fold constants, run shape inference.

Usage:
  python -m ai_song_pipeline.export.optimize_onnx
"""
from __future__ import annotations

import argparse
from pathlib import Path

import onnx
from onnx import checker, shape_inference

from ai_song_pipeline.config import MODEL_FP32, MODEL_OPTIMIZED


def optimize_onnx_graph(src: Path, dst: Path) -> Path:
    model = onnx.load(str(src))
    checker.check_model(model)

    # Shape inference helps downstream ORT fuse ops
    model = shape_inference.infer_shapes(model)

    # Remove unused initializers / dead-end nodes where possible
    try:
        from onnx import optimizer

        passes = [
            "eliminate_deadend",
            "eliminate_identity",
            "eliminate_nop_dropout",
            "eliminate_nop_monotone_argmax",
            "eliminate_nop_pad",
            "eliminate_nop_transpose",
            "eliminate_unused_initializer",
            "fuse_add_bias_into_conv",
            "fuse_bn_into_conv",
            "fuse_consecutive_concats",
            "fuse_consecutive_log_softmax",
            "fuse_consecutive_reduce_unsqueeze",
            "fuse_consecutive_squeezes",
            "fuse_consecutive_transposes",
            "fuse_matmul_add_bias_into_gemm",
            "fuse_pad_into_conv",
            "fuse_transpose_into_gemm",
        ]
        model = optimizer.optimize(model, passes)
    except Exception as exc:  # pragma: no cover — optimizer optional in some builds
        print(f"onnx.optimizer skipped ({exc}); using shape-inferred model only")

    dst.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, str(dst))
    before = src.stat().st_size
    after = dst.stat().st_size
    print(f"Optimized ONNX -> {dst} ({after / 1024:.1f} KiB, was {before / 1024:.1f} KiB)")
    return dst


def main() -> None:
    parser = argparse.ArgumentParser(description="Optimize ONNX graph for inference")
    parser.add_argument("--in", dest="src", type=Path, default=MODEL_FP32)
    parser.add_argument("--out", type=Path, default=MODEL_OPTIMIZED)
    args = parser.parse_args()
    if not args.src.exists():
        raise SystemExit(f"Missing source model: {args.src} — run torch_to_onnx first")
    optimize_onnx_graph(args.src, args.out)


if __name__ == "__main__":
    main()
