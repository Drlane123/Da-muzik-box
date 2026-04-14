#!/usr/bin/env python3
"""
Local dev server for Studio « Sound Conversion » (MusicEnhancer).

POST /enhance — multipart field "audio" (+ optional "instrument", "style").
This stub echoes the uploaded audio so the app flow (record → enhance → timeline) works.

  pip install flask flask-cors
  python scripts/music_enhancer_server.py

Optional: set VITE_MUSIC_ENHANCER_URL in .env if the server is not on http://localhost:8000
"""

from __future__ import annotations

import sys

try:
    from flask import Flask, request, Response
    from flask_cors import CORS
except ImportError:
    print("Install dependencies: pip install flask flask-cors", file=sys.stderr)
    sys.exit(1)

app = Flask(__name__)
CORS(app, resources={r"/enhance": {"origins": "*"}})


@app.route("/enhance", methods=["POST"])
def enhance():
    file = request.files.get("audio")
    if file is None or file.filename == "":
        return {"error": "missing audio field"}, 400

    data = file.read()
    if not data:
        return {"error": "empty upload"}, 400

    # Stub: return same bytes. Swap for your conversion / ML service.
    ct = file.mimetype or file.content_type or "application/octet-stream"
    if "octet-stream" in ct or not ct:
        name = (file.filename or "").lower()
        if name.endswith(".webm"):
            ct = "audio/webm"
        elif name.endswith(".wav"):
            ct = "audio/wav"
        elif name.endswith(".mp4") or name.endswith(".m4a"):
            ct = "audio/mp4"
        else:
            ct = "audio/webm"
    return Response(data, mimetype=ct)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
