#!/usr/bin/env python3
"""npm run ai-song-setup — export and quantize ONNX models."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))

from setup_models import main

if __name__ == "__main__":
    main()
