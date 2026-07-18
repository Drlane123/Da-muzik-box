/**
 * Spotify Basic Pitch (Apache-2.0) — browser audio → timed monophonic MIDI notes.
 * Model: /public/basic-pitch-model · TF.js 3.x: /public/vendor/tfjs-3.21.0
 */
import {
  audioBufferToMonophonicTimedNotes,
  type MonophonicPitchExtractOpts,
  type TimedMonophonicNote,
} from '@/app/lib/studio/audioToMidiNotes';
import {
  BASIC_PITCH_DEFAULT_THRESHOLDS,
  evaluateBasicPitchMono22050,
  type BasicPitchDecodeThresholds,
} from '@/app/lib/studio/basicPitchEngine';

const TARGET_SR = 22050;
/** Cap analyze length so a long take does not freeze the tab. */
const MAX_ANALYZE_SEC = 90;
/** Drop breath / click ghosts shorter than this (seconds). */
export const BASIC_PITCH_DEFAULT_MIN_NOTE_SEC = 0.05;

export type BasicPitchProgress = {
  /** 0..1 model inference progress */
  percent: number;
  message: string;
};

export type BasicPitchTranscribeOpts = BasicPitchDecodeThresholds & {
  /** Delete notes shorter than this many seconds (ghost filter). Default 50 ms. */
  minNoteSec?: number;
};

type TimedNoteEvent = {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
};

/** Offline resample + mixdown to mono @ 22050 Hz (Basic Pitch contract). */
async function resampleToMono22050(buffer: AudioBuffer): Promise<Float32Array> {
  const durationSec = Math.min(buffer.duration, MAX_ANALYZE_SEC);
  const frames = Math.max(1, Math.ceil(durationSec * TARGET_SR));
  const offline = new OfflineAudioContext(1, frames, TARGET_SR);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice(0);
}

/** Strip accidental breath/click blips before they hit the roll. */
export function filterNotesByMinDuration(
  notes: readonly TimedMonophonicNote[],
  minNoteSec: number = BASIC_PITCH_DEFAULT_MIN_NOTE_SEC,
): TimedMonophonicNote[] {
  const minSec = Math.max(0.01, Math.min(0.5, minNoteSec));
  return notes.filter((n) => n.durationSec >= minSec);
}

/**
 * Collapse polyphonic Basic Pitch output to one melody line:
 * when notes overlap in time, keep the louder one (ties → higher pitch).
 */
export function collapseBasicPitchToMonophonic(
  events: readonly TimedNoteEvent[],
  minNoteSec: number = BASIC_PITCH_DEFAULT_MIN_NOTE_SEC,
): TimedMonophonicNote[] {
  if (events.length === 0) return [];

  const minSec = Math.max(0.01, Math.min(0.5, minNoteSec));

  const sorted = [...events]
    .filter((e) => e.durationSeconds >= minSec && e.pitchMidi >= 21 && e.pitchMidi <= 108)
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds || b.amplitude - a.amplitude);

  const kept: TimedNoteEvent[] = [];
  for (const ev of sorted) {
    const start = ev.startTimeSeconds;
    const end = start + ev.durationSeconds;
    let conflict: TimedNoteEvent | null = null;
    for (const k of kept) {
      const kEnd = k.startTimeSeconds + k.durationSeconds;
      if (start < kEnd - 0.02 && end > k.startTimeSeconds + 0.02) {
        conflict = k;
        break;
      }
    }
    if (!conflict) {
      kept.push(ev);
      continue;
    }
    const preferNew =
      ev.amplitude > conflict.amplitude + 0.02 ||
      (Math.abs(ev.amplitude - conflict.amplitude) <= 0.02 && ev.pitchMidi > conflict.pitchMidi);
    if (preferNew) {
      const idx = kept.indexOf(conflict);
      if (idx >= 0) kept.splice(idx, 1);
      kept.push(ev);
    }
  }

  kept.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

  return kept.map((e) => ({
    pitch: Math.round(e.pitchMidi),
    startSec: Math.max(0, e.startTimeSeconds),
    durationSec: Math.max(minSec, e.durationSeconds),
    velocity: Math.max(1, Math.min(127, Math.round(e.amplitude * 127))),
  }));
}

/**
 * Prefer Basic Pitch; on any failure fall back to autocorrelation so capture never hard-breaks.
 */
export async function transcribeAudioBufferToTimedNotes(
  buffer: AudioBuffer,
  onProgress?: (p: BasicPitchProgress) => void,
  extractOpts?: MonophonicPitchExtractOpts,
  decodeOpts?: BasicPitchTranscribeOpts,
): Promise<{ notes: TimedMonophonicNote[]; engine: 'basic-pitch' | 'acf-fallback' }> {
  const minNoteSec = decodeOpts?.minNoteSec ?? BASIC_PITCH_DEFAULT_MIN_NOTE_SEC;
  const thresholds: BasicPitchDecodeThresholds = {
    onsetThreshold: decodeOpts?.onsetThreshold ?? BASIC_PITCH_DEFAULT_THRESHOLDS.onsetThreshold,
    frameThreshold: decodeOpts?.frameThreshold ?? BASIC_PITCH_DEFAULT_THRESHOLDS.frameThreshold,
    minNoteFrames: decodeOpts?.minNoteFrames ?? BASIC_PITCH_DEFAULT_THRESHOLDS.minNoteFrames,
  };

  try {
    onProgress?.({ percent: 0.02, message: 'Preparing audio…' });
    const mono = await resampleToMono22050(buffer);
    onProgress?.({ percent: 0.06, message: 'Loading Basic Pitch…' });
    const events = await evaluateBasicPitchMono22050(
      mono,
      (percent) => {
        onProgress?.({
          percent: 0.06 + percent * 0.9,
          message: 'Transcribing melody (Basic Pitch)…',
        });
      },
      thresholds,
    );
    const notes = collapseBasicPitchToMonophonic(events, minNoteSec);
    if (notes.length > 0) {
      onProgress?.({ percent: 1, message: 'Melody transcribed.' });
      return { notes, engine: 'basic-pitch' };
    }
  } catch (err) {
    console.warn('[basic-pitch] inference failed — falling back to autocorrelation', err);
  }

  onProgress?.({ percent: 0.9, message: 'Using classic pitch track…' });
  const notes = filterNotesByMinDuration(
    audioBufferToMonophonicTimedNotes(buffer, extractOpts),
    minNoteSec,
  );
  onProgress?.({ percent: 1, message: 'Melody transcribed (fallback).' });
  return { notes, engine: 'acf-fallback' };
}
