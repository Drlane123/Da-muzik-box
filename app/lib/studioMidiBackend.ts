/**
 * Studio MIDI backend — Web Audio note preview + transport-locked lookahead scheduling.
 *
 * Intended for use with Studio Editor 2 (or any screen) **without** coupling to React UI:
 * pass `AudioContext`, a `GainNode` bus, transport numbers, and track/note arrays.
 *
 * Screen file `StudioEditor2Screen.tsx` is unchanged by this module; wire it when you want.
 */

/** Quarter-note length in seconds from BPM. */
export function studioSecondsPerBeat(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

export function studioMidiNoteToFreqHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Default lookahead horizon (matches metronome lookahead in studio transport). */
export const STUDIO_MIDI_PREVIEW_SCHEDULE_AHEAD_SEC = 2.5;

export type StudioMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type StudioMidiTrackForPreview = {
  id: string;
  notes: StudioMidiNote[];
};

/**
 * One-shot triangle voice on `outputBus` — Musio-style track audition, grid-aligned times.
 */
export function studioPlayScheduledMidiNote(
  ctx: AudioContext,
  outputBus: GainNode,
  t0: number,
  t1: number,
  pitch: number,
  velocity01: number,
): void {
  const dur = Math.max(0.04, t1 - t0);
  const peak = Math.min(0.2, 0.035 + Math.max(0, Math.min(1, velocity01)) * 0.16);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(studioMidiNoteToFreqHz(pitch), t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
  g.gain.linearRampToValueAtTime(peak * 0.55, t0 + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, t1);
  osc.connect(g);
  g.connect(outputBus);
  osc.start(t0);
  osc.stop(t1 + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      g.disconnect();
    } catch {
      /* */
    }
  };
}

/** Immediate key audition (e.g. piano key strip) — does not use the lookahead set. */
export function studioPreviewMidiPitchNow(
  ctx: AudioContext,
  outputBus: GainNode,
  pitch: number,
  velocity01 = 0.92,
  durationSec = 0.22,
): void {
  const t = ctx.currentTime;
  studioPlayScheduledMidiNote(ctx, outputBus, t + 0.004, t + durationSec, pitch, velocity01);
}

/**
 * One-shot key strip / UI audition wired straight to `destination` (same idea as `PianoRollScreen`
 * `playPianoRow`). Use when you want a click to always be audible regardless of preview-bus wiring.
 */
export function studioPreviewKeyBlipToDestination(
  ctx: AudioContext,
  pitch: number,
  velocity01 = 0.9,
  durationSec = 0.32,
): void {
  if (ctx.state === 'closed') return;
  try {
    const now = ctx.currentTime;
    const freq = studioMidiNoteToFreqHz(pitch);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const peak = Math.min(0.2, 0.05 + Math.max(0, Math.min(1, velocity01)) * 0.16);
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + Math.max(0.08, durationSec));
    osc.frequency.setValueAtTime(freq, now);
    osc.start(now);
    osc.stop(now + Math.max(0.1, durationSec) + 0.02);
  } catch {
    /* ignore playback errors */
  }
}

/** Create a gain node wired to `destination` for MIDI preview (keep separate from metronome bus). */
export function studioCreateMidiPreviewBus(ctx: AudioContext, linearGain = 0.32): GainNode {
  const g = ctx.createGain();
  g.gain.value = linearGain;
  g.connect(ctx.destination);
  return g;
}

export function studioMidiPreviewScheduleKey(trackId: string, noteIndex: number, startBeat: number): string {
  return `${trackId}:${noteIndex}:${startBeat}`;
}

export type StudioMidiPreviewRefillInput = {
  ctx: AudioContext;
  outputBus: GainNode;
  /** `AudioContext.currentTime` snapshot. */
  ctSnap: number;
  scheduleAheadSec: number;
  bpm: number;
  originBeat: number;
  sessionStart: number;
  tracks: StudioMidiTrackForPreview[];
  /** Caller-owned dedupe set; clear on transport stop / loop wrap / edit as needed. */
  scheduled: Set<string>;
};

/**
 * Lookahead-schedule note onsets in [ctSnap, ctSnap + scheduleAheadSec] using the same
 * `tOn = sessionStart + (startBeat - originBeat) * spb` model as the studio transport clock.
 */
export function studioRefillMidiPreviewLookahead(input: StudioMidiPreviewRefillInput): void {
  const { ctx, outputBus, ctSnap, scheduleAheadSec, bpm, originBeat, sessionStart, tracks, scheduled } = input;
  if (ctx.state === 'closed') return;
  const spb = studioSecondsPerBeat(bpm);
  const horizon = ctSnap + scheduleAheadSec;

  for (let ti = 0; ti < tracks.length; ti++) {
    const tr = tracks[ti];
    for (let ni = 0; ni < tr.notes.length; ni++) {
      const note = tr.notes[ni];
      const key = studioMidiPreviewScheduleKey(tr.id, ni, note.startBeat);
      const tOn = sessionStart + (note.startBeat - originBeat) * spb;
      const dur = Math.max(0.04, note.durationBeats * spb);
      const tOff = tOn + dur;
      if (tOff < ctSnap - 0.02) {
        scheduled.delete(key);
        continue;
      }
      if (tOn > horizon) continue;
      if (scheduled.has(key)) continue;
      scheduled.add(key);
      const tStart = Math.max(tOn, ctSnap + 0.002);
      const tEnd = Math.min(tOff, tStart + Math.min(dur, 3));
      try {
        studioPlayScheduledMidiNote(ctx, outputBus, tStart, tEnd, note.pitch, note.velocity / 127);
      } catch {
        scheduled.delete(key);
      }
    }
  }
}
