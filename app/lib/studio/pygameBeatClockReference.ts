/**
 * Timing extracted from the pygame + `pygame.time.Clock` “beat maker” pattern
 * (e.g. Desktop `main.py`: fixed FPS, `active_length` counter, `active_beat` wrap).
 *
 * What this file **is**:
 * - BPM → **how many display frames** (at a fixed FPS) before advancing one **musical quarter**.
 * - Step index wrap: `0 … stepsInLoop - 1` (the pygame script calls that `beats` but it is **steps**, not bars).
 *
 * What this file **is not**:
 * - No `AudioContext`, no lookahead, no hardware output latency — drums/metronome in that tutorial fire
 *   from the **game loop**, not from a single audio master clock.
 * - The pygame script has **no separate metronome**; the grid hits *are* the rhythm. For a click track,
 *   use {@link quarterNoteIntervalSec} / {@link metronomeClickTimesSec} below as the **time-domain** analogue.
 *
 * Creation Station / Studio Editor 2 must keep using Web Audio scheduling — use this only where you
 * explicitly want pygame-style frame stepping (e.g. a toy preview, tests, or comparing drift).
 */

/**
 * Same integer as pygame `3600 // bpm` at 60 FPS (`fps * 60 / bpm`, floored).
 * Note: the common pygame loop `if active_length < beat_length: active_length += 1 else: …`
 * actually advances the beat every **beat_length + 1** frames; use {@link tickFrameCounter} for
 * musically exact **beat_length** frames per quarter.
 */
export function framesPerQuarterNoteFloor(bpm: number, fps: number): number {
  const safeBpm = Math.max(1, bpm);
  const safeFps = Math.max(1, fps);
  return Math.floor((safeFps * 60) / safeBpm);
}

/** Quarter-note period in seconds (metronome / musical grid). */
export function quarterNoteIntervalSec(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

/**
 * Exact “N frames per quarter” counter (fixes off‑by‑one in naive `active_length < beat_length` loops).
 * Returns `true` when the transport advances to the next step (play sounds on `true`).
 * Tutorial pygame sets `beat_changed = True` initially — fire step 0 once at start if you need parity.
 */
export function tickFrameCounter(
  state: { frameInStep: number; stepIndex: number },
  stepsInLoop: number,
  bpm: number,
  fps: number,
  playing: boolean,
): boolean {
  if (!playing) return false;
  const steps = Math.max(1, Math.floor(stepsInLoop));
  const f = Math.max(1, framesPerQuarterNoteFloor(bpm, fps));
  state.frameInStep += 1;
  if (state.frameInStep < f) return false;
  state.frameInStep = 0;
  state.stepIndex = state.stepIndex < steps - 1 ? state.stepIndex + 1 : 0;
  return true;
}

/** Mirrors the tutorial’s `if active_length < beat_length` branch exactly (longer period by one frame). */
export function tickFrameCounterTutorialQuirk(
  state: { frameInStep: number; stepIndex: number },
  stepsInLoop: number,
  bpm: number,
  fps: number,
  playing: boolean,
): boolean {
  if (!playing) return false;
  const steps = Math.max(1, Math.floor(stepsInLoop));
  const beatLength = framesPerQuarterNoteFloor(bpm, fps);
  if (state.frameInStep < beatLength) {
    state.frameInStep += 1;
    return false;
  }
  state.frameInStep = 0;
  state.stepIndex = state.stepIndex < steps - 1 ? state.stepIndex + 1 : 0;
  return true;
}

export function createPygameStyleStepClock(initialStepsInLoop: number, bpm: number, fps: number) {
  let stepsInLoop = Math.max(1, Math.floor(initialStepsInLoop));
  const state = { frameInStep: 0, stepIndex: 0 };
  let bpmMut = Math.max(1, bpm);
  let fpsMut = Math.max(1, fps);

  return {
    get stepIndex() {
      return state.stepIndex;
    },
    get stepsInLoop() {
      return stepsInLoop;
    },
    framesPerStep() {
      return framesPerQuarterNoteFloor(bpmMut, fpsMut);
    },
    setBpm(nextBpm: number) {
      bpmMut = Math.max(1, nextBpm);
    },
    setFps(nextFps: number) {
      fpsMut = Math.max(1, nextFps);
    },
    setStepsInLoop(n: number) {
      stepsInLoop = Math.max(1, Math.floor(n));
      state.stepIndex = Math.min(state.stepIndex, stepsInLoop - 1);
    },
    /** Musically exact frame stepping (recommended). */
    tick(playing: boolean): boolean {
      return tickFrameCounter(state, stepsInLoop, bpmMut, fpsMut, playing);
    },
    /** Same period length as common pygame snippet (one extra frame per step). */
    tickTutorialQuirk(playing: boolean): boolean {
      return tickFrameCounterTutorialQuirk(state, stepsInLoop, bpmMut, fpsMut, playing);
    },
    reset(atStep: number = 0) {
      state.stepIndex = Math.max(0, Math.min(stepsInLoop - 1, Math.floor(atStep)));
      state.frameInStep = 0;
    },
  };
}

/** Ideal metronome click times (seconds from t=0), first downbeat at 0 — time domain only. */
export function metronomeClickTimesSec(totalQuarters: number, bpm: number): number[] {
  const spb = quarterNoteIntervalSec(bpm);
  const out: number[] = [];
  for (let k = 0; k < totalQuarters; k++) out.push(k * spb);
  return out;
}
