#!/usr/bin/env python3
"""Launch AI Song local server (adds python/ to sys.path)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))

from ai_song_pipeline.runtime.server import main

if __name__ == "__main__":
    main()
