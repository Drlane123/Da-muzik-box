/**
 * SE2 Guitar Main tab — sustain / palm-mute / hammer-on articulations (Ample-style).
 */
import type { Se2GuitarInstrumentId } from '@/app/lib/studio/se2GuitarInstruments';
import type { Se2GuitarMockNote } from '@/app/lib/studio/se2GuitarTrack';

export type Se2GuitarArticulationId = 'sus' | 'pm' | 'hp';

export type Se2GuitarArticulationDef = {
  id: Se2GuitarArticulationId;
  label: string;
  hint: string;
};

export const SE2_GUITAR_ARTICULATIONS: readonly Se2GuitarArticulationDef[] = [
  { id: 'sus', label: 'SUS', hint: 'Sustain — full note length' },
  { id: 'pm', label: 'PM', hint: 'Palm mute — short, percussive' },
  { id: 'hp', label: 'HP', hint: 'Hammer-on / pull-off — lighter, shorter' },
];

const ELECTRIC_IDS = new Set<Se2GuitarInstrumentId>([
  'electric_guitar_jazz',
  'electric_guitar_clean',
  'overdriven_guitar',
  'distortion_guitar',
]);

export type Se2GuitarArticulationVoice = {
  previewDurationSec: number;
  insertDurationBeats: number;
  velocityScale: number;
  /** When set, overrides the track instrument for this articulation. */
  instrumentOverride?: Se2GuitarInstrumentId;
};

export function se2GuitarArticulationVoice(
  articulation: Se2GuitarArticulationId,
  baseInstrument: Se2GuitarInstrumentId,
): Se2GuitarArticulationVoice {
  switch (articulation) {
    case 'pm':
      return {
        previewDurationSec: 0.14,
        insertDurationBeats: 0.18,
        velocityScale: 0.96,
        instrumentOverride: ELECTRIC_IDS.has(baseInstrument)
          ? 'electric_guitar_muted'
          : undefined,
      };
    case 'hp':
      return {
        previewDurationSec: 0.32,
        insertDurationBeats: 0.28,
        velocityScale: 0.78,
      };
    case 'sus':
    default:
      return {
        previewDurationSec: 0.55,
        insertDurationBeats: 0.5,
        velocityScale: 1,
      };
  }
}

export function se2GuitarResolvePreviewInstrument(
  articulation: Se2GuitarArticulationId,
  baseInstrument: Se2GuitarInstrumentId,
): Se2GuitarInstrumentId {
  return se2GuitarArticulationVoice(articulation, baseInstrument).instrumentOverride ?? baseInstrument;
}

export function se2GuitarApplyArticulationToVelocity(
  articulation: Se2GuitarArticulationId,
  baseInstrument: Se2GuitarInstrumentId,
  velocity127: number,
): number {
  const scale = se2GuitarArticulationVoice(articulation, baseInstrument).velocityScale;
  return Math.max(1, Math.min(127, Math.round(velocity127 * scale)));
}

export function se2GuitarArticulationInsertNote(
  articulation: Se2GuitarArticulationId,
  baseInstrument: Se2GuitarInstrumentId,
  pitch: number,
  startBeat: number,
  velocity127 = 96,
): Se2GuitarMockNote {
  const voice = se2GuitarArticulationVoice(articulation, baseInstrument);
  return {
    pitch,
    startBeat,
    durationBeats: voice.insertDurationBeats,
    velocity: se2GuitarApplyArticulationToVelocity(articulation, baseInstrument, velocity127),
  };
}
