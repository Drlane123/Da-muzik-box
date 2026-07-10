#!/usr/bin/env python3
"""
Local dev server for Studio « Sound Conversion » (MusicEnhancer) + Vocal Lab RVC hook.

POST /enhance — multipart field "audio" (+ optional "instrument", "style").
POST /rvc/convert — vocal conversion (proxies to RVC when RVC_INFER_URL is set).
GET  /rvc/health  — server + optional RVC infer status.

  pip install flask flask-cors
  python scripts/music_enhancer_server.py

Optional:
  VITE_MUSIC_ENHANCER_URL in .env if the server is not on http://localhost:8000
  RVC_INFER_URL=http://127.0.0.1:7865  — your local RVC WebUI / infer API base
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request

try:
    from flask import Flask, request, Response
    from flask_cors import CORS
except ImportError:
    print("Install dependencies: pip install flask flask-cors", file=sys.stderr)
    sys.exit(1)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "expose_headers": ["X-RVC-Engine"]}})

RVC_INFER_URL = os.environ.get("RVC_INFER_URL", "").rstrip("/")


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


@app.route("/rvc/health", methods=["GET"])
def rvc_health():
    connected = False
    message = "Browser DSP fallback — server is up"
    if RVC_INFER_URL:
        try:
            with urllib.request.urlopen(f"{RVC_INFER_URL}/", timeout=2) as resp:
                connected = resp.status < 500
            message = "RVC infer endpoint reachable" if connected else "RVC URL set but not responding"
        except (urllib.error.URLError, TimeoutError, OSError):
            message = "RVC_INFER_URL set but infer service offline — browser DSP fallback"
    else:
        message = "Set RVC_INFER_URL to your local RVC WebUI for real .pth models"
    return {
        "ok": True,
        "rvc_connected": connected,
        "message": message,
    }


@app.route("/rvc/convert", methods=["POST"])
def rvc_convert():
    """
    Vocal Lab RVC convert. When RVC_INFER_URL is configured, forward audio there.
    Otherwise apply a light open-source pass-through stub (app uses browser DSP if this fails).
    """
    file = request.files.get("audio")
    if file is None or file.filename == "":
        return {"error": "missing audio field"}, 400

    data = file.read()
    if not data:
        return {"error": "empty upload"}, 400

    preset_id = request.form.get("preset_id", "soprano-angel")
    model = request.files.get("model")

    if RVC_INFER_URL:
        # Hook point: wire your local RVC WebUI / infer script here.
        # Many setups expose Gradio — POST multipart to their /api/infer or custom route.
        # Until configured, fall through to stub so the app still completes.
        try:
            infer_url = f"{RVC_INFER_URL}/api/convert"
            boundary = "----DaMusicBoxRVC"
            body_parts: list[bytes] = []

            def add_field(name: str, value: str) -> None:
                body_parts.append(f"--{boundary}\r\n".encode())
                body_parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
                body_parts.append(f"{value}\r\n".encode())

            add_field("preset_id", preset_id)
            add_field("preserve_pitch", request.form.get("preserve_pitch", "1"))
            add_field("formant_shift", request.form.get("formant_shift", "1"))
            body_parts.append(f"--{boundary}\r\n".encode())
            body_parts.append(b'Content-Disposition: form-data; name="audio"; filename="vocal.webm"\r\n')
            body_parts.append(b"Content-Type: application/octet-stream\r\n\r\n")
            body_parts.append(data)
            body_parts.append(b"\r\n")
            if model and model.filename:
                mdata = model.read()
                body_parts.append(f"--{boundary}\r\n".encode())
                body_parts.append(
                    f'Content-Disposition: form-data; name="model"; filename="{model.filename}"\r\n'.encode()
                )
                body_parts.append(b"Content-Type: application/octet-stream\r\n\r\n")
                body_parts.append(mdata)
                body_parts.append(b"\r\n")
            body_parts.append(f"--{boundary}--\r\n".encode())
            req = urllib.request.Request(
                infer_url,
                data=b"".join(body_parts),
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                out = resp.read()
                if out:
                    return Response(out, mimetype=resp.headers.get("Content-Type", "audio/wav"))
        except (urllib.error.URLError, TimeoutError, OSError):
            pass

    # Stub: echo audio — browser-side DSP in the app does the real transform by default.
    ct = file.mimetype or file.content_type or "application/octet-stream"
    if "octet-stream" in ct or not ct:
        name = (file.filename or "").lower()
        if name.endswith(".webm"):
            ct = "audio/webm"
        elif name.endswith(".wav"):
            ct = "audio/wav"
        else:
            ct = "audio/webm"
    return Response(data, mimetype=ct, headers={"X-RVC-Engine": "stub"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
