/**
 * Geno Ultra ARP — key / scale / chord-type voicing (EON-style 11-row spread).
 */
import {
  GENO_ARP_ACTIVE_ROW_SPAN,
  GENO_ARP_ROWS,
  genoArpSanitizeBarLength,
  type GenoArpBarLength,
} from '@/app/lib/studio/genoUltraArpPattern';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';
import {
  neuralHumScaleMeta,
  snapMidiToNeuralHumScale,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';

export type GenoArpChordType =
  | 'maj'
  | 'min'
  | 'maj7'
  | 'min7'
  | 'dom7'
  | 'sus2'
  | 'sus4'
  | '5'
  | 'add9';

export const GENO_ARP_CHORD_TYPE_OPTIONS: readonly { id: GenoArpChordType; label: string }[] = [
  { id: 'maj', label: 'Maj' },
  { id: 'min', label: 'Min' },
  { id: 'maj7', label: 'Maj7' },
  { id: 'min7', label: 'Min7' },
  { id: 'dom7', label: 'Dom7' },
  { id: 'sus2', label: 'Sus2' },
  { id: 'sus4', label: 'Sus4' },
  { id: '5', label: '5th' },
  { id: 'add9', label: 'Add9' },
] as const;

const CHORD_SEMIS: Record<GenoArpChordType, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '5': [0, 7],
  add9: [0, 4, 7, 14],
};

export type GenoUltraArpHarmonyContext = {
  keyRoot: number;
  scaleId: NeuralHumScaleId;
  chordType: GenoArpChordType;
  chordTimeline?: readonly GenoUltraArpChordSegment[];
  /** When true, use imported MIDI voicings as-is (Geno B01/B02 / SE2 chord lane). */
  preserveImportedVoicing?: boolean;
};

/** Evenly sample sorted pitches for the vertical grid (up to 11 rows). */
export function genoArpSpreadPitchesToRows(
  pitches: readonly number[],
  targetCount = GENO_ARP_ROWS,
): number[] {
  const sorted = [...new Set(pitches.map((p) => Math.round(p)))].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  if (sorted.length <= targetCount) return sorted;
  const out: number[] = [];
  for (let i = 0; i < targetCount; i += 1) {
    const idx = Math.round((i / Math.max(1, targetCount - 1)) * (sorted.length - 1));
    out.push(sorted[idx]!);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Build chord tones in one octave for the centered preset band (6 rows). */
export function genoArpBuildVoicing(
  rootMidi: number,
  keyRoot: number,
  scaleId: NeuralHumScaleId,
  chordType: GenoArpChordType,
  targetCount = GENO_ARP_ACTIVE_ROW_SPAN,
): number[] {
  const root = snapMidiToNeuralHumScale(Math.round(rootMidi), keyRoot, scaleId);
  const semis = CHORD_SEMIS[chordType] ?? CHORD_SEMIS.maj;
  const scale = neuralHumScaleMeta(scaleId).intervals;
  const candidates: number[] = [];

  const push = (midi: number) => {
    const m = Math.max(0, Math.min(127, Math.round(midi)));
    if (!candidates.includes(m)) candidates.push(m);
  };

  for (const semi of semis) push(root + semi);

  for (const deg of scale) {
    if (deg <= 0 || deg >= 12) continue;
    push(root + deg);
  }

  candidates.sort((a, b) => a - b);
  return genoArpSpreadPitchesToRows(candidates, targetCount);
}

/** Re-voice one imported segment — keep bass root, apply scale + chord type. */
export function genoArpRevoiceSegment(
  segment: GenoUltraArpChordSegment,
  harmony: Pick<GenoUltraArpHarmonyContext, 'keyRoot' | 'scaleId' | 'chordType'>,
): GenoUltraArpChordSegment {
  const bass = segment.pitches[0] ?? harmony.keyRoot;
  const snapped = snapMidiToNeuralHumScale(bass, harmony.keyRoot, harmony.scaleId);
  const pitches = genoArpBuildVoicing(snapped, harmony.keyRoot, harmony.scaleId, harmony.chordType);
  return { ...segment, pitches };
}

/** Imported timeline — raw voicings when locked, else scale re-voice. */
export function genoArpResolveEffectiveTimeline(
  harmony: GenoUltraArpHarmonyContext,
  barLength: GenoArpBarLength,
  basePitch: number,
): GenoUltraArpChordSegment[] {
  if (harmony.chordTimeline?.length) {
    if (harmony.preserveImportedVoicing) {
      return harmony.chordTimeline.map((seg) => ({
        ...seg,
        pitches: [...seg.pitches].sort((a, b) => a - b),
      }));
    }
    return harmony.chordTimeline.map((seg) => genoArpRevoiceSegment(seg, harmony));
  }
  return [
    {
      startBeat: 0,
      durationBeats: genoArpSanitizeBarLength(barLength) * 4,
      pitches: genoArpBuildVoicing(basePitch, harmony.keyRoot, harmony.scaleId, harmony.chordType),
    },
  ];
}

export function genoArpScaleIdFromKeyMode(mode: 'major' | 'minor'): NeuralHumScaleId {
  return mode === 'minor' ? 'minor' : 'major';
}
