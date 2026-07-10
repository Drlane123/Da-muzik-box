/**
 * Vocal FX pitch routing — one source at a time: audio analysis, A2M this lane, or external MIDI.
 */

import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';
import { studioVocoderCarrierLaneOptions } from '@/app/lib/studio/studioVocoderCarrier';

export type StudioVocalFxPitchRouteMode = 'audio' | 'a2m_lane' | 'midi_lane';

export function studioVocalFxPitchRouteMode(
  midiTrackIndex: number | null,
  vocalTrackIndex: number,
  vocalTrackKind: StudioVocoderCarrierTrack['kind'],
): StudioVocalFxPitchRouteMode {
  if (midiTrackIndex == null) return 'audio';
  if (midiTrackIndex === vocalTrackIndex && vocalTrackKind === 'a2m') return 'a2m_lane';
  return 'midi_lane';
}

export function studioVocalFxPitchRouteTrackIndex(
  mode: StudioVocalFxPitchRouteMode,
  vocalTrackIndex: number,
  externalTrackIndex: number | null,
): number | null {
  if (mode === 'audio') return null;
  if (mode === 'a2m_lane') return vocalTrackIndex;
  return externalTrackIndex;
}

/** External MIDI lanes only (not this vocal lane). */
export function studioExternalMidiLaneOptions(
  carrierTracks: readonly StudioVocoderCarrierTrack[],
  vocalTrackIndex: number,
) {
  return studioVocoderCarrierLaneOptions(carrierTracks, vocalTrackIndex).filter(
    (lane) => lane.trackIndex !== vocalTrackIndex,
  );
}

export function studioA2mLaneReady(
  vocalTrack: StudioVocoderCarrierTrack | undefined,
): { ready: boolean; noteCount: number; clipHint: boolean } {
  if (!vocalTrack || vocalTrack.kind !== 'a2m') {
    return { ready: false, noteCount: 0, clipHint: false };
  }
  const noteCount = vocalTrack.notes.length;
  return {
    ready: noteCount > 0,
    noteCount,
    clipHint: noteCount === 0,
  };
}

export const VOCAL_FX_PITCH_ROUTE_GUIDE = [
  'Pick ONE pitch source — they do not stack.',
  'From audio — Vocoder uses detected vocal pitch; Pitch Tune snaps to Scale + song key.',
  'Audio → MIDI (this lane) — drop a clip on an Audio→MIDI lane (or tap Convert on the lane). Notes drive Pitch Tune / Vocoder.',
  'MIDI from channel — any other MIDI / rhythm lane with notes drives pitch (classic MIDI Auto-Tune / vocoder carrier).',
  'Audio→MIDI and MIDI-from-channel are different: convert your vocal on this lane, OR route from a separate MIDI part.',
] as const;
