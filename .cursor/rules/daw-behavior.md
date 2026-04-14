# DAW Behavior Model

**Audience:** developers and AI assistants only — not end-user documentation.

Treat this app as a **Digital Audio Workstation**. Changes to recording, transport, timeline, clips, or persistence must satisfy the rules below.

## Core model

- **Studio Editor** is the multitrack timeline.
- **Transport** (play / record / stop) is **global** and **authoritative**.
- **Recording** produces **real audio takes**, not transport-only state changes.
- **Clips** hold **real audio** and must be **playable**.
- The **timeline** is **bar-based** and **position-accurate**.
- **Save / load** must preserve **full session state** (tracks, clips, positions, audio where supported).

## Recording rules

- **Record** only when **Studio Editor** is the active context (arm / pipeline required).
- **Mic permission** must be requested **before** recording transport starts.
- Capture **continuous** audio for the duration of the take.
- **Stop** must finalize a **real clip** (blob → decode → timeline).
- Clip **start bar** matches **record start** (playhead / tick), not an arbitrary stop position.
- New clips must be **playable** immediately after stop (same transport + playback path).
- **No fake recording** — no “success” that is only transport or UI state.

## Playback rules

- **Play** must produce **audible** output when clips are in range.
- Clips play **only** within their **bar range** on the timeline.
- Playback must **align** with transport timing (BPM, bars, ticks).
- **No silent success** — no meters-only or visual-only “playback” without audio when a clip should sound.

## Timeline rules

- Clips reflect **real duration** (from audio / defined length).
- Clip **position** is tied to **bar / playhead** semantics used by the app.
- **Copy / paste / duplicate** must preserve **audio** and **timing** where applicable.

## Persistence rules

- Projects must **restore** timeline state: tracks, clips, positions.
- **Audio clips** must remain **playable after reload** when the format supports it (e.g. serialized buffers).

## Development constraints

- Do **not** rebuild or redesign **UI** for DAW fixes.
- Do **not** replace **architecture** to satisfy a feature.
- Prefer **logic fixes** that match the DAW behavior above.
- Avoid **generic web-app** shortcuts (state-only “recording”, fake success) for DAW features.
