/**
 * Studio vocoder — MIDI carrier timeline (any MIDI / A2M / rhythm lane).
 */

import { studioNormalizeA2mMode } from '@/app/lib/studio/studioEditor2AudioToMidi';
import { studioTrackOutputsMidi, studioMidiChannelForTrack } from '@/app/lib/studio/studioEditor2Midi';

export type StudioVocoderMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type StudioVocoderCarrierEvent = {
  tSec: number;
  hz: number;
  velocity: number;
};

/** Pitch Tune / Auto-Tune MIDI target events (local clip seconds). */
export type StudioMidiPitchTargetEvent = {
  tSec: number;
  pitch: number;
  velocity: number;
};

export type StudioVocoderCarrierTrack = {
  name: string;
  kind: 'midi' | 'audio' | 'a2m' | 'rhythm';
  notes: readonly StudioVocoderMidiNote[];
  a2mMode?: string;
  midiChannel?: number;
};

export type StudioVocoderCarrierLaneOption = {
  trackIndex: number;
  channel: number;
  name: string;
  kind: 'midi' | 'a2m' | 'rhythm';
  noteCount: number;
  isSelf: boolean;
};

function midiToHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Lanes that can drive a vocoder carrier (any MIDI-output track with melodic notes). */
export function studioVocoderCarrierLaneOptions(
  tracks: readonly StudioVocoderCarrierTrack[],
  vocalTrackIndex: number,
): StudioVocoderCarrierLaneOption[] {
  const out: StudioVocoderCarrierLaneOption[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i];
    if (!tr || !studioTrackOutputsMidi(tr)) continue;
    if (tr.kind === 'a2m' && studioNormalizeA2mMode(tr.a2mMode) === 'drums') continue;
    if (tr.notes.length === 0) continue;
    out.push({
      trackIndex: i,
      channel: studioMidiChannelForTrack(i, tracks),
      name: tr.name,
      kind: tr.kind === 'audio' ? 'midi' : tr.kind,
      noteCount: tr.notes.length,
      isSelf: i === vocalTrackIndex,
    });
  }
  return out;
}

/** Short signature for cache keys when carrier MIDI changes. */
export function studioVocoderCarrierNotesSig(notes: readonly StudioVocoderMidiNote[]): string {
  if (notes.length === 0) return '0';
  const head = notes[0]!;
  const tail = notes[notes.length - 1]!;
  return `${notes.length}:${head.pitch}@${head.startBeat.toFixed(3)}:${tail.pitch}@${(tail.startBeat + tail.durationBeats).toFixed(3)}`;
}

/**
 * Map MIDI lane notes onto local clip time — returns MIDI pitch events.
 * Highest active pitch wins when notes overlap (mono).
 */
export function buildMidiLanePitchTimeline(
  notes: readonly StudioVocoderMidiNote[],
  clipStartBeat: number,
  clipDurationBeats: number,
  bpm: number,
): StudioMidiPitchTargetEvent[] {
  const spb = 60 / Math.max(1, bpm);
  const clipDurSec = Math.max(0.04, clipDurationBeats * spb);
  const clipEndBeat = clipStartBeat + clipDurationBeats;

  const overlapping = notes
    .filter((n) => n.startBeat < clipEndBeat && n.startBeat + n.durationBeats > clipStartBeat)
    .sort((a, b) => a.startBeat - b.startBeat || b.pitch - a.pitch);

  if (overlapping.length === 0) return [];

  type Seg = { startSec: number; endSec: number; pitch: number; vel: number };
  const segments: Seg[] = [];
  for (const n of overlapping) {
    const localStart = Math.max(0, (n.startBeat - clipStartBeat) * spb);
    const localEnd = Math.min(clipDurSec, (n.startBeat + n.durationBeats - clipStartBeat) * spb);
    if (localEnd <= localStart + 1e-6) continue;
    segments.push({ startSec: localStart, endSec: localEnd, pitch: n.pitch, vel: n.velocity });
  }
  if (segments.length === 0) return [];

  const boundaries = new Set<number>([0, clipDurSec]);
  for (const s of segments) {
    boundaries.add(clamp(s.startSec, 0, clipDurSec));
    boundaries.add(clamp(s.endSec, 0, clipDurSec));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);

  const events: StudioMidiPitchTargetEvent[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const t0 = sorted[i]!;
    const tMid = (t0 + sorted[i + 1]!) * 0.5;
    let pitch: number | null = null;
    let vel = 100;
    for (const s of segments) {
      if (tMid >= s.startSec - 1e-6 && tMid < s.endSec - 1e-6) {
        if (pitch == null || s.pitch > pitch) {
          pitch = s.pitch;
          vel = s.vel;
        }
      }
    }
    if (pitch != null && (events.length === 0 || events[events.length - 1]!.pitch !== pitch)) {
      events.push({ tSec: t0, pitch, velocity: vel });
    }
  }
  return events;
}

/**
 * Map carrier-lane MIDI notes onto local clip time (0 … durationSec).
 * Highest active pitch wins when notes overlap (mono carrier).
 */
export function buildVocoderCarrierTimeline(
  notes: readonly StudioVocoderMidiNote[],
  clipStartBeat: number,
  clipDurationBeats: number,
  bpm: number,
  fallbackHz: number,
): StudioVocoderCarrierEvent[] {
  const fallback = Math.max(55, fallbackHz);
  const pitchEvents = buildMidiLanePitchTimeline(notes, clipStartBeat, clipDurationBeats, bpm);
  if (pitchEvents.length === 0) {
    return [{ tSec: 0, hz: fallback, velocity: 100 }];
  }
  return pitchEvents.map((ev) => ({
    tSec: ev.tSec,
    hz: midiToHz(ev.pitch),
    velocity: ev.velocity,
  }));
}

export function resolveVocoderCarrierTimeline(
  fx: { vocoderCarrierTrackIndex: number | null },
  tracks: readonly StudioVocoderCarrierTrack[],
  vocalTrackIndex: number,
  clipStartBeat: number,
  clipDurationBeats: number,
  bpm: number,
  fallbackHz: number,
): StudioVocoderCarrierEvent[] | null {
  const idx = fx.vocoderCarrierTrackIndex;
  if (idx == null || idx < 0 || idx >= tracks.length) return null;
  const carrier = tracks[idx];
  if (!carrier || carrier.notes.length === 0) return null;
  return buildVocoderCarrierTimeline(
    carrier.notes,
    clipStartBeat,
    clipDurationBeats,
    bpm,
    fallbackHz,
  );
}

export function resolvePitchTuneMidiTimeline(
  fx: { pitchTuneMidiTrackIndex: number | null },
  tracks: readonly StudioVocoderCarrierTrack[],
  clipStartBeat: number,
  clipDurationBeats: number,
  bpm: number,
): StudioMidiPitchTargetEvent[] | null {
  const idx = fx.pitchTuneMidiTrackIndex;
  if (idx == null || idx < 0 || idx >= tracks.length) return null;
  const lane = tracks[idx];
  if (!lane || lane.notes.length === 0) return null;
  const events = buildMidiLanePitchTimeline(lane.notes, clipStartBeat, clipDurationBeats, bpm);
  return events.length > 0 ? events : null;
}
