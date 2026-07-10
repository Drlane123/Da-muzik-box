# AI Song — local offline pipeline

100% local, CPU-only hybrid music pipeline: **committee pattern grids → MIDI → f0/amplitude conditioning → quantized ONNX synth → WAV**.

No cloud APIs. Models and caches live under `.cache/ai-song-models/` on the repo drive.

## Quick start

```powershell
cd E:\Da-Music-Box-v4-SOURCE-COMPLETE\python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Build ONNX models (FP32 → optimized → INT8)
python setup_models.py

# Run end-to-end on sample trap pattern
python -m ai_song_pipeline.runtime.pipeline `
  --fixture fixtures/sample_pattern.json `
  --out output/ai_song_preview.wav `
  --play

# Start HTTP server for React AiSongScreen (port 8001)
python -m ai_song_pipeline.runtime.server
```

## Four layers

| Layer | Module | Purpose |
|-------|--------|---------|
| **1. Token sequencing** | `ingest/read_committee_output.py`, `grid_to_midi.py`, `midi_to_conditioning.py` | Read `AiPatternClipPayload` JSON or boolean grids → `mido` MIDI → f0 + amplitude tensors |
| **2. ONNX export** | `export/torch_to_onnx.py`, `export/optimize_onnx.py` | DDSP-style harmonic synth → ONNX, graph cleanup |
| **3. INT8 quantize** | `quantize/quantize_dynamic.py` | `quantize_dynamic` for CPU speed + smaller RAM |
| **4. Runtime** | `runtime/pipeline.py`, `runtime/server.py` | Queue → `CPUExecutionProvider` → WAV / playback |

## Input format

Matches `AiPatternClipPayload` from `app/lib/sessionClipContent.ts`:

```json
{
  "bpm": 140,
  "loopLength": 4,
  "totalSteps": 64,
  "tracks": [{ "idx": 0, "role": "drums", "pattern": [[true, false, ...], ...] }]
}
```

Export from the browser console:

```js
JSON.stringify(JSON.parse(localStorage.getItem('da-music-box-ai-pattern-clip-data-v1')))
```

Save to `python/fixtures/my_pattern.json` and pass `--fixture`.

## React integration

```bash
# From repo root (optional npm script)
npm run ai-song-server
```

Set in `.env`:

```
VITE_AI_SONG_URL=http://127.0.0.1:8001
```

Client: `app/lib/aiSong/aiSongClient.ts` — `generateAiSongWav(payload)`.

## Replace the placeholder synth

Swap `models/ddsp_conditioned.py` with your trained DDSP/RAVE checkpoint, re-run `setup_models.py`. The ONNX I/O names stay **`f0`**, **`loudness`**, **`audio`**.

## Individual commands

```powershell
python -m ai_song_pipeline.export.torch_to_onnx
python -m ai_song_pipeline.export.optimize_onnx
python -m ai_song_pipeline.quantize.quantize_dynamic
```
