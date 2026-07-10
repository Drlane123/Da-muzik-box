/**
 * Studio Editor 2 — transpose MIDI notes between keys (track key → song key).
 */

import {
  detectKeyFromMidiNotes,
  studioKeyLabel,
  type StudioDetectedKeyMode,
} from '@/app/lib/studio/studioAudioClipAnalysis';
import { snapMidiToNeuralHumScale } from '@/app/lib/vocalLab/neuralHumKeyLock';

export type StudioMidiNotePitch = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type StudioResolvedTrackKey = {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
};

export function studioShortestRootShift(fromRoot: number, toRoot: number): number {
  const from = ((Math.round(fromRoot) % 12) + 12) % 12;
  const to = ((Math.round(toRoot) % 12) + 12) % 12;
  let shift = to - from;
  if (shift > 6) shift -= 12;
  if (shift < -6) shift += 12;
  return shift;
}

function normalizeKeyRoot(root: number): number {
  return ((Math.round(root) % 12) + 12) % 12;
}

/** Transpose + snap every note into the target key scale. */
export function studioConvertMidiNotesToKey<T extends { pitch: number }>(
  notes: readonly T[],
  fromRoot: number,
  _fromMode: StudioDetectedKeyMode,
  toRoot: number,
  toMode: StudioDetectedKeyMode,
): T[] {
  if (notes.length === 0) return [];
  const shift = studioShortestRootShift(fromRoot, toRoot);
  const targetRoot = normalizeKeyRoot(toRoot);
  const targetScale = toMode === 'minor' ? 'minor' : 'major';

  return notes.map((n) => {
    const transposed = Math.max(0, Math.min(127, Math.round(n.pitch + shift)));
    const snapped = snapMidiToNeuralHumScale(transposed, targetRoot, targetScale);
    return { ...n, pitch: snapped };
  });
}

export function studioResolveTrackKey(
  track: {
    trackKeyRoot?: number;
    trackKeyMode?: StudioDetectedKeyMode;
    a2mKeyRoot?: number;
    a2mKeyMode?: StudioDetectedKeyMode;
    notes: ReadonlyArray<StudioMidiNotePitch>;
  },
  bpm: number,
): StudioResolvedTrackKey | null {
  if (track.trackKeyRoot != null && track.trackKeyMode) {
    return {
      keyRoot: normalizeKeyRoot(track.trackKeyRoot),
      keyMode: track.trackKeyMode,
    };
  }
  if (track.a2mKeyRoot != null && track.a2mKeyMode) {
    return {
      keyRoot: normalizeKeyRoot(track.a2mKeyRoot),
      keyMode: track.a2mKeyMode,
    };
  }
  const detected = detectKeyFromMidiNotes(track.notes, bpm);
  if (!detected) return null;
  return {
    keyRoot: normalizeKeyRoot(detected.keyRoot),
    keyMode: detected.keyMode,
  };
}

export function studioKeysMatch(
  a: StudioResolvedTrackKey,
  b: StudioResolvedTrackKey,
): boolean {
  return a.keyRoot === b.keyRoot && a.keyMode === b.keyMode;
}

export function studioFormatKeyChangeLabel(
  from: StudioResolvedTrackKey,
  to: StudioResolvedTrackKey,
): string {
  return `${studioKeyLabel(from.keyRoot, from.keyMode)} → ${studioKeyLabel(to.keyRoot, to.keyMode)}`;
}

/** Minimal track shape for project-wide key detection (SE2 arranger lanes). */
export type StudioKeyDetectTrackInput = {
  kind?: string;
  a2mMode?: string;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
  a2mKeyRoot?: number;
  a2mKeyMode?: StudioDetectedKeyMode;
  notes: ReadonlyArray<StudioMidiNotePitch>;
};

export function studioTrackNotesEligibleForKey(tr: StudioKeyDetectTrackInput): boolean {
  if (!tr.notes.length) return false;
  if (tr.kind === 'a2m' && tr.a2mMode === 'drums') return false;
  return true;
}

/**
 * Detect project song key from all melodic SE2 tracks.
 * Prefers explicit per-track keys (weighted by note count), else analyzes merged MIDI.
 */
export function detectSongKeyFromStudioTracks(
  tracks: readonly StudioKeyDetectTrackInput[],
  bpm: number,
): StudioResolvedTrackKey | null {
  const keyed: { key: StudioResolvedTrackKey; weight: number }[] = [];
  const mergedNotes: StudioMidiNotePitch[] = [];

  for (const tr of tracks) {
    if (!studioTrackNotesEligibleForKey(tr)) continue;
    mergedNotes.push(...tr.notes);
    if (tr.trackKeyRoot != null && tr.trackKeyMode) {
      keyed.push({
        key: { keyRoot: normalizeKeyRoot(tr.trackKeyRoot), keyMode: tr.trackKeyMode },
        weight: tr.notes.length,
      });
    } else if (tr.a2mKeyRoot != null && tr.a2mKeyMode) {
      keyed.push({
        key: { keyRoot: normalizeKeyRoot(tr.a2mKeyRoot), keyMode: tr.a2mKeyMode },
        weight: tr.notes.length,
      });
    }
  }

  if (keyed.length > 0) {
    keyed.sort((a, b) => b.weight - a.weight);
    return keyed[0]!.key;
  }

  if (mergedNotes.length === 0) return null;
  const detected = detectKeyFromMidiNotes(mergedNotes, bpm);
  if (!detected) return null;
  return {
    keyRoot: normalizeKeyRoot(detected.keyRoot),
    keyMode: detected.keyMode,
  };
}

/** Map SE2 song key root (0–11) to a MIDI root for arp harmony — keeps octave when possible. */
export function studioMidiRootFromSongKey(
  songKeyRoot: number,
  preserveOctaveFrom?: number,
  defaultOctave = 4,
): number {
  const pc = normalizeKeyRoot(songKeyRoot);
  const oct =
    preserveOctaveFrom != null && Number.isFinite(preserveOctaveFrom)
      ? Math.floor(Math.max(0, preserveOctaveFrom) / 12)
      : defaultOctave;
  return Math.max(36, Math.min(84, oct * 12 + pc));
}
