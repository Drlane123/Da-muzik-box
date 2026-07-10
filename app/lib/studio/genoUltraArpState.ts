/**
 * Geno Ultra ARP — serializable pattern snapshot (panel → timeline export).
 */
import type { GenoArpBarLength, GenoArpBarOctShift, GenoArpGlobalOctShift } from '@/app/lib/studio/genoUltraArpPattern';
import type { GenoArpChordType } from '@/app/lib/studio/genoUltraArpHarmony';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { NeuralHumScaleId } from '@/app/lib/vocalLab/neuralHumKeyLock';

/** One chord voicing in time — EON-Arp spreads these degrees on the vertical grid. */
export type GenoUltraArpChordSegment = {
  startBeat: number;
  durationBeats: number;
  /** Sorted low → high (chord degrees). */
  pitches: number[];
  label?: string;
};

/** Standalone ARP tempo — never SE2 session BPM unless SYNC SE2 is on. */
export const GENO_ULTRA_ARP_DEFAULT_BPM = 120;

export function clampGenoUltraArpBpm(n: number | undefined, fallback = GENO_ULTRA_ARP_DEFAULT_BPM): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(40, Math.min(300, Math.round(v)));
}

export type GenoUltraArpSnapshot = {
  grid: boolean[][];
  barLength: GenoArpBarLength;
  rateIdx: number;
  gate: number;
  swing: number;
  /** Local arp tempo for this pattern (independent of SE2 session BPM). */
  bpm?: number;
  octShift: GenoArpGlobalOctShift;
  barOctShifts: GenoArpBarOctShift[];
  mod1Levels: number[];
  mod2Levels: number[];
  mod3Levels?: number[];
  velLevels: number[];
  /** Retrologue CTRL lane enable. */
  ctrl1On?: boolean;
  ctrl2On?: boolean;
  ctrl3On?: boolean;
  /** Retrologue CTRL destinations. */
  ctrl1Dest?: string;
  ctrl2Dest?: string;
  ctrl3Dest?: string;
  /** Retrologue CTRL depth 0–1. */
  ctrl1Depth?: number;
  ctrl2Depth?: number;
  ctrl3Depth?: number;
  /** Analog gate FX — drawable lane + pump controls under CTRL 2. */
  gateLevels?: number[];
  gateFxOn?: boolean;
  gateFxDepth?: number;
  gateFxAttackMs?: number;
  gateFxReleaseMs?: number;
  /** Sidechain pumper — sequencer-only bus duck. */
  pumperOn?: boolean;
  pumperRate?: number;
  pumperDepth?: number;
  pumperAttackMs?: number;
  pumperReleaseMs?: number;
  pumperHighFilter?: number;
  pumperLowFilter?: number;
  /** Retrologue step operator — lit dots fire. */
  stepMask?: boolean[];
  /** Per-step hit count 0–4 (how many times each step fires). */
  stepHits?: number[];
  /** How many steps are in the loop (phrase length). */
  phraseSteps?: number;
  /** Root MIDI for row 0 (already in target key / chord). */
  basePitch: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  /** ARP harmony scale (Neural Hum scales). */
  arpScaleId?: NeuralHumScaleId;
  /** Default voicing quality when building / re-voicing chords. */
  arpChordType?: GenoArpChordType;
  chordLabel?: string;
  stylePresetId?: string;
  /** Imported chord progression — rows map to chord degrees when set. */
  chordTimeline?: GenoUltraArpChordSegment[];
  totalPatternBeats?: number;
  importSourceTrackId?: string;
  /** Timeline placement — default 0. */
  startBeat?: number;
  /** Logic-style variation (0–3). */
  arpVariation?: 0 | 1 | 2 | 3;
  /** Logic Oct Range — spread across 1–4 octaves. */
  octRange?: 1 | 2 | 3 | 4;
  /** Logic Inversions — flip chord-tone order within the preset band. */
  orderInversion?: boolean;
};
