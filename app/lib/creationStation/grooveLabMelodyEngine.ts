/**
 * Groove Lab MELODY / RIFF / ARP — chord-locked phrases with voice-leading and 2-bar arcs.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type {
  GrooveComposerColumn,
  GrooveComposerHarmony,
} from '@/app/lib/creationStation/grooveLabComposerTypes';
import {
  GROOVE_LAB_MELODY_REFERENCE_MIDI,
  grooveLabClampMelodyMidi,
} from '@/app/lib/creationStation/grooveLabPitch';
import {
  waveLeafCandidatesForRole,
  waveLeafChordRootPc,
  waveLeafGreenStackMidisAtSlot,
  waveLeafHarmonyColumnAtSlot,
  waveLeafLeadMidisFromStackVoicing,
  waveLeafPickFromVoicing,
  type WaveLeafStackRole,
} from '@/app/lib/creationStation/waveLeafChordLock';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const STEPS_PER_16TH = GROOVE_LAB_SLOTS_PER_BAR / 16;
const PHRASE_BARS = 2;

type PhraseToneRole = 'third' | 'fifth' | 'seventh' | 'resolve' | 'color' | 'step';

type PhraseStepDef = {
  barInPhrase: 0 | 1;
  step16: number;
  dur16: number;
  role: PhraseToneRole;
  accent?: boolean;
  contour?: 'up' | 'down' | 'hold';
};

/** Lyrical 2-bar shapes — few attacks, long sustains, chord-tone voice leading. */
const MELODY_PHRASES: PhraseStepDef[][] = [
  [
    { barInPhrase: 0, step16: 3, dur16: 13, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 1, dur16: 8, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 11, dur16: 5, role: 'resolve', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 6, dur16: 9, role: 'fifth', contour: 'hold' },
    { barInPhrase: 1, step16: 0, dur16: 12, role: 'third', accent: true, contour: 'hold' },
    { barInPhrase: 1, step16: 14, dur16: 2, role: 'color', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 8, dur16: 7, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 4, dur16: 12, role: 'third', accent: true, contour: 'hold' },
  ],
  [
    { barInPhrase: 0, step16: 5, dur16: 10, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 8, dur16: 6, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 13, dur16: 3, role: 'seventh', contour: 'up' },
  ],
  [
    { barInPhrase: 0, step16: 2, dur16: 11, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 6, dur16: 9, role: 'fifth', contour: 'up' },
  ],
  [
    { barInPhrase: 0, step16: 10, dur16: 5, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 2, dur16: 13, role: 'third', accent: true, contour: 'hold' },
  ],
  [
    { barInPhrase: 0, step16: 0, dur16: 6, role: 'third', contour: 'hold' },
    { barInPhrase: 0, step16: 9, dur16: 6, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 5, dur16: 10, role: 'third', accent: true, contour: 'hold' },
  ],
  [
    { barInPhrase: 0, step16: 4, dur16: 11, role: 'fifth', contour: 'hold' },
    { barInPhrase: 1, step16: 0, dur16: 5, role: 'seventh', contour: 'up' },
    { barInPhrase: 1, step16: 8, dur16: 7, role: 'resolve', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 7, dur16: 8, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 3, dur16: 12, role: 'fifth', accent: true, contour: 'hold' },
  ],
];

/**
 * OpenBeat Mellodo–style transitional leads — lyrical arcs through the full chord stack
 * (3rd / 5th / 7th / color), pickups into downbeats, chorus lifts. SE2 Groove Lead default.
 */
const TRANSITIONAL_LEAD_PHRASES: PhraseStepDef[][] = [
  [
    { barInPhrase: 0, step16: 1, dur16: 2, role: 'step', contour: 'up' },
    { barInPhrase: 0, step16: 3, dur16: 12, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 2, dur16: 7, role: 'fifth', accent: true, contour: 'up' },
    { barInPhrase: 1, step16: 11, dur16: 4, role: 'third', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 4, dur16: 11, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 0, dur16: 8, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 9, dur16: 6, role: 'seventh', accent: true, contour: 'up' },
    { barInPhrase: 1, step16: 14, dur16: 2, role: 'resolve', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 6, dur16: 9, role: 'fifth', contour: 'hold' },
    { barInPhrase: 1, step16: 1, dur16: 13, role: 'third', accent: true, contour: 'hold' },
  ],
  [
    { barInPhrase: 0, step16: 2, dur16: 5, role: 'step', contour: 'up' },
    { barInPhrase: 0, step16: 8, dur16: 7, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 4, dur16: 6, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 12, dur16: 3, role: 'seventh', accent: true, contour: 'up' },
  ],
  [
    { barInPhrase: 0, step16: 5, dur16: 10, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 3, dur16: 5, role: 'step', contour: 'up' },
    { barInPhrase: 1, step16: 8, dur16: 7, role: 'fifth', accent: true, contour: 'hold' },
  ],
  [
    { barInPhrase: 0, step16: 0, dur16: 4, role: 'third', contour: 'hold' },
    { barInPhrase: 0, step16: 10, dur16: 5, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 2, dur16: 11, role: 'third', accent: true, contour: 'hold' },
    { barInPhrase: 1, step16: 14, dur16: 2, role: 'color', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 7, dur16: 8, role: 'fifth', contour: 'hold' },
    { barInPhrase: 1, step16: 0, dur16: 6, role: 'seventh', contour: 'up' },
    { barInPhrase: 1, step16: 7, dur16: 8, role: 'third', accent: true, contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 3, dur16: 12, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 5, dur16: 4, role: 'step', contour: 'up' },
    { barInPhrase: 1, step16: 10, dur16: 5, role: 'fifth', accent: true, contour: 'up' },
  ],
  [
    { barInPhrase: 0, step16: 9, dur16: 6, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 1, dur16: 8, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 11, dur16: 4, role: 'resolve', accent: true, contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 4, dur16: 11, role: 'fifth', contour: 'hold' },
    { barInPhrase: 1, step16: 0, dur16: 5, role: 'third', contour: 'down' },
    { barInPhrase: 1, step16: 6, dur16: 9, role: 'seventh', accent: true, contour: 'up' },
  ],
  [
    { barInPhrase: 0, step16: 1, dur16: 3, role: 'color', contour: 'up' },
    { barInPhrase: 0, step16: 6, dur16: 9, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 4, dur16: 11, role: 'fifth', accent: true, contour: 'hold' },
  ],
  [
    { barInPhrase: 0, step16: 8, dur16: 7, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 2, dur16: 6, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 9, dur16: 6, role: 'third', accent: true, contour: 'hold' },
  ],
];

/** Mellodo / Moog-sine flow — adjacent pool steps only (±1), optional passing tone. */
type FlowWalkStepDef = {
  at: number;
  len: number;
  delta: -1 | 0 | 1;
  pass?: boolean;
  accent?: boolean;
};

const MELLODO_LEAD_WALKS: readonly (readonly FlowWalkStepDef[])[] = [
  [
    { at: 0.06, len: 0.34, delta: 0, accent: true },
    { at: 0.44, len: 0.14, delta: 1 },
    { at: 0.6, len: 0.22, delta: 1, accent: true },
    { at: 0.84, len: 0.1, delta: -1 },
  ],
  [
    { at: 0.08, len: 0.38, delta: 0, accent: true },
    { at: 0.5, len: 0.16, delta: 1, pass: true },
    { at: 0.68, len: 0.2, delta: 0 },
  ],
  [
    { at: 0.05, len: 0.22, delta: 0 },
    { at: 0.3, len: 0.18, delta: 1, accent: true },
    { at: 0.52, len: 0.3, delta: 0, accent: true },
    { at: 0.84, len: 0.12, delta: -1 },
  ],
  [
    { at: 0.1, len: 0.28, delta: 1, accent: true },
    { at: 0.42, len: 0.2, delta: 0 },
    { at: 0.66, len: 0.14, delta: -1, pass: true },
    { at: 0.82, len: 0.12, delta: -1 },
  ],
  [
    { at: 0.04, len: 0.4, delta: 0, accent: true },
    { at: 0.48, len: 0.18, delta: 1 },
    { at: 0.7, len: 0.16, delta: 0 },
  ],
  [
    { at: 0.07, len: 0.16, delta: 0 },
    { at: 0.26, len: 0.14, delta: 1, pass: true },
    { at: 0.42, len: 0.24, delta: 1, accent: true },
    { at: 0.7, len: 0.18, delta: 0 },
  ],
  [
    { at: 0.09, len: 0.32, delta: 0, accent: true },
    { at: 0.45, len: 0.12, delta: -1 },
    { at: 0.6, len: 0.22, delta: 0 },
  ],
  [
    { at: 0.06, len: 0.2, delta: 1 },
    { at: 0.3, len: 0.26, delta: 1, accent: true },
    { at: 0.6, len: 0.2, delta: 0 },
    { at: 0.82, len: 0.1, delta: -1 },
  ],
];

/** Tighter rhythm but still stepwise — embellishes the harmony without random leaps. */
const RIFF_PHRASES: PhraseStepDef[][] = [
  [
    { barInPhrase: 0, step16: 2, dur16: 4, role: 'third', contour: 'hold' },
    { barInPhrase: 0, step16: 6, dur16: 3, role: 'step', contour: 'up' },
    { barInPhrase: 0, step16: 10, dur16: 4, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 2, dur16: 5, role: 'third', accent: true, contour: 'hold' },
    { barInPhrase: 1, step16: 8, dur16: 4, role: 'step', contour: 'down' },
    { barInPhrase: 1, step16: 12, dur16: 4, role: 'resolve', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 4, dur16: 5, role: 'third', contour: 'hold' },
    { barInPhrase: 0, step16: 9, dur16: 3, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 1, dur16: 6, role: 'third', accent: true, contour: 'hold' },
    { barInPhrase: 1, step16: 7, dur16: 3, role: 'step', contour: 'up' },
    { barInPhrase: 1, step16: 11, dur16: 5, role: 'fifth', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 3, dur16: 6, role: 'fifth', contour: 'hold' },
    { barInPhrase: 0, step16: 13, dur16: 3, role: 'seventh', contour: 'up' },
    { barInPhrase: 1, step16: 4, dur16: 7, role: 'third', accent: true, contour: 'hold' },
    { barInPhrase: 1, step16: 14, dur16: 2, role: 'color', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 1, dur16: 3, role: 'third', contour: 'hold' },
    { barInPhrase: 0, step16: 5, dur16: 3, role: 'fifth', contour: 'up' },
    { barInPhrase: 0, step16: 11, dur16: 4, role: 'step', contour: 'up' },
    { barInPhrase: 1, step16: 3, dur16: 6, role: 'third', accent: true, contour: 'hold' },
    { barInPhrase: 1, step16: 10, dur16: 3, role: 'fifth', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 6, dur16: 4, role: 'fifth', contour: 'hold' },
    { barInPhrase: 0, step16: 12, dur16: 3, role: 'seventh', contour: 'up' },
    { barInPhrase: 1, step16: 0, dur16: 5, role: 'third', accent: true, contour: 'hold' },
    { barInPhrase: 1, step16: 7, dur16: 4, role: 'step', contour: 'down' },
    { barInPhrase: 1, step16: 13, dur16: 3, role: 'resolve', contour: 'down' },
  ],
  [
    { barInPhrase: 0, step16: 8, dur16: 5, role: 'third', contour: 'hold' },
    { barInPhrase: 1, step16: 2, dur16: 4, role: 'fifth', contour: 'up' },
    { barInPhrase: 1, step16: 6, dur16: 3, role: 'step', contour: 'up' },
    { barInPhrase: 1, step16: 11, dur16: 5, role: 'third', accent: true, contour: 'hold' },
  ],
];

export type GrooveMelodyGenPart = 'melody' | 'riff' | 'arp';

export type GrooveMelodyGenParams = {
  part: GrooveMelodyGenPart;
  harmony: GrooveComposerHarmony;
  barCount: number;
  quantize: GrooveLabQuantize;
  keyRoot: number;
  mode: ChordMode;
  referenceMidi?: number;
  complexity?: number;
  seed: number;
  melodyGridEnabled?: boolean;
  riffGridEnabled?: boolean;
  rates?: Partial<Record<'melody' | 'riff' | 'arp', GrooveLabQuantize>>;
  /** Groove Lead: only pitch classes from the green stack (no synthetic scale 7ths). */
  stackChordTonesOnly?: boolean;
  chordHitsForLock?: readonly GrooveRollHit[];
  stackLockMaxLeap?: number;
  /** SE2 Groove Lead — Mellodo-style transitional arcs through the chord stack. */
  leadPhraseMode?: 'standard' | 'transitional';
  /** Geno B01/B02 — chord-tone walks only (no scale passing tones). */
  disablePassingTones?: boolean;
};

function phraseRoleToStackRole(role: PhraseToneRole): WaveLeafStackRole {
  switch (role) {
    case 'third':
      return 'third';
    case 'fifth':
      return 'fifth';
    case 'seventh':
      return 'extension';
    case 'resolve':
      return 'third';
    case 'color':
      return 'extension';
    case 'step':
    default:
      return 'any';
  }
}

function melodyCandidatesForStep(
  params: GrooveMelodyGenParams,
  col: GrooveComposerColumn,
  slot: number,
  role: PhraseToneRole,
  prevMidi: number | null,
): number[] {
  const ref = params.referenceMidi ?? GROOVE_LAB_MELODY_REFERENCE_MIDI;
  if (params.stackChordTonesOnly && params.chordHitsForLock && params.chordHitsForLock.length > 0) {
    const stack = waveLeafGreenStackMidisAtSlot(params.chordHitsForLock, slot, col);
    const rootPc = waveLeafChordRootPc(col, stack);
    return waveLeafCandidatesForRole(stack, phraseRoleToStackRole(role), prevMidi, rootPc);
  }
  return candidatesForRole(enrichMelodyChordTones(col, params.mode, ref), role);
}

function melodyMaxLeap(params: GrooveMelodyGenParams, part: 'melody' | 'riff'): number {
  if (params.stackLockMaxLeap != null) return params.stackLockMaxLeap;
  if (params.leadPhraseMode === 'transitional') return part === 'melody' ? 6 : 5;
  return part === 'melody' ? 5 : 4;
}

function phraseLibraryForPart(
  genParams: GrooveMelodyGenParams,
  part: 'melody' | 'riff',
): PhraseStepDef[][] {
  if (genParams.leadPhraseMode === 'transitional' && part === 'melody') {
    return TRANSITIONAL_LEAD_PHRASES;
  }
  return part === 'melody' ? MELODY_PHRASES : RIFF_PHRASES;
}

function pickMelodyMidiFromCandidates(
  genParams: GrooveMelodyGenParams,
  candidates: number[],
  prevMidi: number | null,
  opts: { maxLeap: number; preferHigher?: boolean; preferLower?: boolean },
): number {
  if (candidates.length === 0) {
    return grooveLabClampMelodyMidi(GROOVE_LAB_MELODY_REFERENCE_MIDI);
  }
  if (genParams.stackChordTonesOnly) {
    return waveLeafPickFromVoicing(candidates, prevMidi, {
      higher: opts.preferHigher,
      lower: opts.preferLower,
    });
  }
  return pickVoiceLed(candidates, prevMidi, opts);
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return (): number => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function scaleSemitones(mode: ChordMode): readonly number[] {
  return mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
}

function slotsPerRate(rate: GrooveLabQuantize): number {
  switch (rate) {
    case '1/4':
      return GROOVE_LAB_SLOTS_PER_BAR / 4;
    case '1/8':
      return GROOVE_LAB_SLOTS_PER_BAR / 8;
    case '1/16':
      return GROOVE_LAB_SLOTS_PER_BAR / 16;
    case '1/32':
    default:
      return GROOVE_LAB_SLOTS_PER_BAR / 32;
  }
}

export function grooveMelodyColumnAtBar(
  harmony: GrooveComposerHarmony,
  barIndex: number,
): GrooveComposerColumn {
  const barStart = barIndex * GROOVE_LAB_SLOTS_PER_BAR;
  let col = harmony.columns[0]!;
  for (const c of harmony.columns) {
    if (c.slot <= barStart) col = c;
  }
  return col;
}

function triadMidis(rootMidi: number, mode: ChordMode): number[] {
  const scale = scaleSemitones(mode);
  const r = Math.round(rootMidi);
  return [r, r + (scale[2] ?? 4), r + (scale[4] ?? 7)];
}

export function grooveMelodyChordToneMidis(
  col: GrooveComposerColumn,
  mode: ChordMode,
  referenceMidi: number,
): number[] {
  const raw =
    col.tones.length > 0 ? col.tones.map((m) => Math.round(m)) : triadMidis(col.rootMidi, mode);
  const ref =
    referenceMidi >= 72 && referenceMidi <= 84 ? referenceMidi : GROOVE_LAB_MELODY_REFERENCE_MIDI;
  const mapped = [...new Set(raw.map((m) => grooveLabClampMelodyMidi(m, ref)))].sort((a, b) => a - b);
  return mapped.length > 0 ? mapped : [grooveLabClampMelodyMidi(ref)];
}

/** Add scale 7th in lead register when the chord stack is only a triad. */
export function enrichMelodyChordTones(
  col: GrooveComposerColumn,
  mode: ChordMode,
  referenceMidi: number,
): number[] {
  const base = grooveMelodyChordToneMidis(col, mode, referenceMidi);
  if (base.length >= 4) return base;
  const scale = scaleSemitones(mode);
  const root = grooveLabClampMelodyMidi(col.rootMidi, referenceMidi);
  const seventh = grooveLabClampMelodyMidi(root + (scale[6] ?? 10), referenceMidi);
  const merged = [...new Set([...base, seventh])].sort((a, b) => a - b);
  return merged;
}

function candidatesForRole(tones: number[], role: PhraseToneRole): number[] {
  const t = [...tones].sort((a, b) => a - b);
  switch (role) {
    case 'third':
      return t.length >= 2 ? [t[1]!] : [t[0]!];
    case 'fifth':
      return t.length >= 3 ? [t[2]!] : [t[t.length - 1]!];
    case 'seventh':
      return t.length >= 4 ? [t[3]!] : [t[t.length - 1]!];
    case 'resolve':
      return t.length >= 2 ? [t[1]!, t[0]!] : t;
    case 'color':
      return t.length > 1 ? t.slice(1) : t;
    case 'step':
    default:
      return t;
  }
}

/** Nearest chord tone with step bias — keeps lines singing instead of hopping. */
function pickVoiceLed(
  candidates: number[],
  prevMidi: number | null,
  opts: { maxLeap: number; preferHigher?: boolean; preferLower?: boolean },
): number {
  if (candidates.length === 0) {
    return prevMidi ?? grooveLabClampMelodyMidi(GROOVE_LAB_MELODY_REFERENCE_MIDI);
  }
  if (prevMidi == null) {
    return candidates[Math.min(1, candidates.length - 1)] ?? candidates[0]!;
  }
  let best = candidates[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const m of candidates) {
    const leap = Math.abs(m - prevMidi);
    let score = leap * 2.2;
    if (leap <= 2) score -= 6;
    if (leap === 0) score -= 12;
    if (leap > opts.maxLeap) score += 40;
    if (opts.preferHigher && m >= prevMidi) score -= 2.5;
    if (opts.preferLower && m <= prevMidi) score -= 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

function trimSustainsForLegato(hits: GrooveRollHit[], snap: number, legatoOverlap: boolean): GrooveRollHit[] {
  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const next = sorted[i + 1];
    if (next) {
      const gap = next.slot - cur.slot;
      cur.sustainSlots = legatoOverlap
        ? Math.max(snap, gap)
        : Math.min(cur.sustainSlots, Math.max(snap, gap));
    }
  }
  return sorted;
}

function phraseIndexForBlock(
  blockStartBar: number,
  seed: number,
  phraseCount: number,
  rnd: () => number,
): number {
  const mixed = (seed + blockStartBar * 17) >>> 0;
  const det = mixed % phraseCount;
  if (rnd() < 0.22) return Math.floor(rnd() * phraseCount);
  return det;
}

function emitPhraseBlock(
  params: {
    part: 'melody' | 'riff';
    harmony: GrooveComposerHarmony;
    blockStartBar: number;
    barCount: number;
    mode: ChordMode;
    referenceMidi: number;
    snap: number;
    complexity: number;
    seed: number;
    rnd: () => number;
    out: GrooveRollHit[];
    prevMidiRef: { value: number | null };
    genParams: GrooveMelodyGenParams;
  },
): void {
  const {
    part,
    harmony,
    blockStartBar,
    barCount,
    referenceMidi,
    snap,
    complexity,
    rnd,
    out,
    prevMidiRef,
    genParams,
  } = params;
  const library = phraseLibraryForPart(genParams, part);
  const maxLeap = melodyMaxLeap(genParams, part);
  const idx = phraseIndexForBlock(blockStartBar, params.seed, library.length, rnd);
  let steps = library[idx]!;

  if (
    complexity > 0.72
    && part === 'melody'
    && genParams.leadPhraseMode !== 'transitional'
    && rnd() > 0.55
  ) {
    steps = [
      { barInPhrase: 0, step16: 1, dur16: 2, role: 'color' as const, contour: 'up' as const },
      ...steps,
    ];
  }

  for (const step of steps) {
    const absoluteBar = blockStartBar + step.barInPhrase;
    if (absoluteBar >= barCount) continue;

    const barStart = absoluteBar * GROOVE_LAB_SLOTS_PER_BAR;
    const slot = barStart + Math.round(step.step16 * STEPS_PER_16TH);
    const col = genParams.stackChordTonesOnly
      ? waveLeafHarmonyColumnAtSlot(harmony, slot)
      : grooveMelodyColumnAtBar(harmony, absoluteBar);
    const candidates = melodyCandidatesForStep(genParams, col, slot, step.role, prevMidiRef.value);
    const midi = pickMelodyMidiFromCandidates(genParams, candidates, prevMidiRef.value, {
      maxLeap,
      preferHigher: step.contour === 'up',
      preferLower: step.contour === 'down',
    });
    prevMidiRef.value = midi;

    const durSlots = Math.max(snap, Math.round(step.dur16 * STEPS_PER_16TH));
    const sustainSlots =
      part === 'melody'
        ? Math.max(
            durSlots,
            Math.round(
              durSlots
                * (genParams.leadPhraseMode === 'transitional'
                  ? 1.12 + complexity * 0.2
                  : 1.05 + complexity * 0.15),
            ),
          )
        : Math.max(snap, durSlots);

    const baseVel =
      genParams.leadPhraseMode === 'transitional' ? 0.82 : part === 'melody' ? 0.76 : 0.8;
    const vel = Math.min(
      0.98,
      baseVel + (step.accent ? 0.1 : 0) + (step.dur16 >= 10 ? 0.06 : 0) + rnd() * 0.08,
    );

    out.push({
      slot,
      midi,
      sustainSlots,
      vel,
    });
  }
}

function emitSingleBarCoda(
  genParams: GrooveMelodyGenParams,
  harmony: GrooveComposerHarmony,
  bar: number,
  referenceMidi: number,
  snap: number,
  prevMidiRef: { value: number | null },
  out: GrooveRollHit[],
): void {
  const barStart = bar * GROOVE_LAB_SLOTS_PER_BAR;
  const slot = barStart + Math.round(4 * STEPS_PER_16TH);
  const col = genParams.stackChordTonesOnly
    ? waveLeafHarmonyColumnAtSlot(harmony, slot)
    : grooveMelodyColumnAtBar(harmony, bar);
  const candidates = melodyCandidatesForStep(genParams, col, slot, 'third', prevMidiRef.value);
  const midi = pickMelodyMidiFromCandidates(genParams, candidates, prevMidiRef.value, {
    maxLeap: melodyMaxLeap(genParams, 'melody'),
    preferLower: true,
  });
  prevMidiRef.value = midi;
  out.push({
    slot,
    midi,
    sustainSlots: Math.max(snap * 3, Math.round(11 * STEPS_PER_16TH)),
    vel: 0.82,
  });
}

/** Sorted unique chord tones in lead register (full voicing — voice-leading picks the line). */
function chordTonePoolForFlow(stackLead: readonly number[]): number[] {
  const sorted = [...new Set(stackLead.map((m) => grooveLabClampMelodyMidi(m)))].sort((a, b) => a - b);
  const out: number[] = [];
  const seenPc = new Set<number>();
  for (const m of sorted) {
    const pc = ((m % 12) + 12) % 12;
    if (seenPc.has(pc)) continue;
    seenPc.add(pc);
    out.push(m);
  }
  return out.length > 0 ? out : [grooveLabClampMelodyMidi(GROOVE_LAB_MELODY_REFERENCE_MIDI)];
}

function voiceLeadPoolIndex(pool: readonly number[], prevMidi: number | null): number {
  if (pool.length === 0) return 0;
  if (prevMidi == null) return Math.min(1, pool.length - 1);
  let bestIdx = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pool.length; i += 1) {
    const leap = Math.abs(pool[i]! - prevMidi);
    let score = leap * 2.2;
    if (leap <= 2) score -= 5;
    if (leap > 7) score += 14;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function snapMelodyToScale(midi: number, keyRoot: number, mode: ChordMode): number {
  const scale = scaleSemitones(mode);
  const rootPc = ((Math.round(keyRoot) % 12) + 12) % 12;
  const targetPc = ((Math.round(midi) % 12) + 12) % 12;
  let bestMidi = grooveLabClampMelodyMidi(midi);
  let bestDist = Number.POSITIVE_INFINITY;
  for (let oct = -2; oct <= 2; oct += 1) {
    const base = Math.round(midi) + oct * 12;
    for (const deg of scale) {
      const candidate = grooveLabClampMelodyMidi(base - targetPc + rootPc + deg);
      const dist = Math.abs(candidate - midi);
      if (dist < bestDist) {
        bestDist = dist;
        bestMidi = candidate;
      }
    }
  }
  return bestMidi;
}

function mellodoPassingToneBetween(
  fromMidi: number,
  toMidi: number,
  keyRoot: number,
  mode: ChordMode,
): number | null {
  const gap = Math.abs(toMidi - fromMidi);
  if (gap < 3 || gap > 7) return null;
  const mid = Math.round((fromMidi + toMidi) / 2);
  const snapped = snapMelodyToScale(mid, keyRoot, mode);
  const fromPc = ((fromMidi % 12) + 12) % 12;
  const toPc = ((toMidi % 12) + 12) % 12;
  const passPc = ((snapped % 12) + 12) % 12;
  if (passPc === fromPc || passPc === toPc) return null;
  return snapped;
}

function extendFluentLeadHit(out: GrooveRollHit[], slot: number, sustainSlots: number, vel: number): void {
  const last = out[out.length - 1];
  if (!last) return;
  const end = Math.max(last.slot + last.sustainSlots, slot + sustainSlots);
  last.sustainSlots = end - last.slot;
  last.vel = Math.max(last.vel, vel);
}

/** Same pitch twice in a row → one longer note (no stutter / pseudo-arpeggio). */
export function grooveLabMergeFluentLeadHits(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  const out: GrooveRollHit[] = [];
  for (const h of sorted) {
    const last = out[out.length - 1];
    if (last && last.midi === h.midi) {
      const end = Math.max(last.slot + last.sustainSlots, h.slot + h.sustainSlots);
      last.sustainSlots = end - last.slot;
      last.vel = Math.max(last.vel, h.vel);
      continue;
    }
    out.push({ ...h });
  }
  return out;
}

/**
 * Mellodo / Moog-sine lead — stepwise through chord voicing, passing tones on weak beats.
 */
function generateTransitionalChordWeave(params: GrooveMelodyGenParams): GrooveRollHit[] {
  const {
    harmony,
    barCount,
    quantize,
    seed,
    rates,
    chordHitsForLock,
    keyRoot,
    mode,
    complexity = 0.5,
  } = params;
  if (!chordHitsForLock?.length) return [];

  const rnd = mulberry32(seed ^ 0x6d2b_79f5);
  const rate = rates?.melody ?? quantize;
  const snap = Math.max(1, Math.round(slotsPerRate(rate)));
  const loopEndSlot = barCount * GROOVE_LAB_SLOTS_PER_BAR;
  const out: GrooveRollHit[] = [];
  let prevMidi: number | null = null;
  let poolIdx = 0;
  const cols = harmony.columns;
  const passChance = params.disablePassingTones ? 0 : 0.55 + complexity * 0.2;

  for (let ci = 0; ci < cols.length; ci += 1) {
    const col = cols[ci]!;
    const chordSlot = col.slot;
    if (chordSlot >= loopEndSlot) continue;

    const nextSlot = cols[ci + 1]?.slot ?? loopEndSlot;
    const windowSlots = Math.max(snap * 4, nextSlot - chordSlot);
    const stack = waveLeafGreenStackMidisAtSlot(chordHitsForLock, chordSlot, col);
    const pool = chordTonePoolForFlow(waveLeafLeadMidisFromStackVoicing(stack));
    if (pool.length === 0) continue;

    poolIdx = voiceLeadPoolIndex(pool, prevMidi);
    prevMidi = pool[poolIdx]!;

    const walkIdx =
      (seed + ci * 31 + grooveLabBarIndexFromSlot(chordSlot) * 17) % MELLODO_LEAD_WALKS.length;
    const walk = MELLODO_LEAD_WALKS[walkIdx]!;

    for (const step of walk) {
      const slot = chordSlot + Math.round(step.at * windowSlots);
      if (slot >= nextSlot - snap) break;

      let nextIdx = Math.max(0, Math.min(pool.length - 1, poolIdx + step.delta));
      if (step.delta !== 0 && nextIdx === poolIdx && pool.length > 1) {
        nextIdx = step.delta > 0
          ? Math.min(pool.length - 1, poolIdx + 1)
          : Math.max(0, poolIdx - 1);
      }
      const fromMidi = pool[poolIdx]!;
      const toMidi = pool[nextIdx]!;

      if (
        step.pass
        && step.delta !== 0
        && fromMidi !== toMidi
        && rnd() < passChance
      ) {
        const passMidi = mellodoPassingToneBetween(fromMidi, toMidi, keyRoot, mode);
        if (passMidi != null) {
          const passSlot = Math.max(chordSlot, slot - snap);
          const passDur = Math.max(snap, Math.round(step.len * windowSlots * 0.35));
          const passVel = 0.62 + rnd() * 0.08;
          if (out.length === 0 || passSlot - out[out.length - 1]!.slot >= snap) {
            out.push({
              slot: passSlot,
              midi: passMidi,
              sustainSlots: Math.min(passDur, nextSlot - passSlot),
              vel: passVel,
            });
            prevMidi = passMidi;
          }
        }
      }

      poolIdx = nextIdx;
      const midi = pool[poolIdx]!;
      const durSlots = Math.max(
        snap * (step.accent ? 3 : 2),
        Math.round(step.len * windowSlots),
      );
      const sustainSlots = Math.min(
        Math.max(durSlots, snap * 2),
        Math.max(snap * 2, nextSlot - slot),
      );
      const vel = step.accent ? 0.84 + rnd() * 0.06 : 0.7 + rnd() * 0.1;

      if (midi === prevMidi) {
        extendFluentLeadHit(out, slot, sustainSlots, vel);
        continue;
      }

      const gapOk = out.length === 0 || slot - out[out.length - 1]!.slot >= snap;
      if (!gapOk) {
        extendFluentLeadHit(out, slot, sustainSlots, vel);
        prevMidi = midi;
        continue;
      }

      prevMidi = midi;
      out.push({ slot, midi, sustainSlots, vel });
    }
  }

  const fluent = grooveLabMergeFluentLeadHits(out);
  return trimSustainsForLegato(fluent, snap, true);
}

function generateMelodyOrRiff(params: GrooveMelodyGenParams): GrooveRollHit[] {
  const {
    part,
    harmony,
    barCount,
    quantize,
    mode,
    seed,
    complexity = 0.5,
    referenceMidi = GROOVE_LAB_MELODY_REFERENCE_MIDI,
    rates,
  } = params;
  const rnd = mulberry32(seed);
  const rate = rates?.[part] ?? quantize;
  const snap = Math.max(1, Math.round(slotsPerRate(rate)));
  const out: GrooveRollHit[] = [];
  const prevMidiRef: { value: number | null } = { value: null };

  for (let bar = 0; bar < barCount; bar += PHRASE_BARS) {
    if (bar + PHRASE_BARS <= barCount) {
      emitPhraseBlock({
        part,
        harmony,
        blockStartBar: bar,
        barCount,
        mode,
        referenceMidi,
        snap,
        complexity,
        seed,
        rnd,
        out,
        prevMidiRef,
        genParams: params,
      });
    } else if (bar < barCount) {
      emitSingleBarCoda(params, harmony, bar, referenceMidi, snap, prevMidiRef, out);
    }
  }

  return trimSustainsForLegato(
    out,
    snap,
    params.leadPhraseMode === 'transitional',
  );
}

function grooveLabBarIndexFromSlot(slot: number): number {
  return Math.floor(Math.max(0, slot) / GROOVE_LAB_SLOTS_PER_BAR);
}

/** MELODY GRID off — one singing note per green chord column. */
function generateSimpleMelody(params: GrooveMelodyGenParams): GrooveRollHit[] {
  const { harmony, barCount, seed } = params;
  const rnd = mulberry32(seed ^ 0x9e37_79b9);
  const out: GrooveRollHit[] = [];
  const cols = harmony.columns;
  let prevMidi: number | null = null;

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]!;
    const nextCol = cols[i + 1];
    const barStart = grooveLabBarIndexFromSlot(col.slot) * GROOVE_LAB_SLOTS_PER_BAR;
    if (barStart >= barCount * GROOVE_LAB_SLOTS_PER_BAR) continue;

    const slot = col.slot + Math.round((1 + rnd() * 2) * STEPS_PER_16TH);
    const roleCycle: PhraseToneRole[] = ['third', 'fifth', 'seventh', 'fifth', 'third', 'color'];
    const role = roleCycle[i % roleCycle.length]!;
    const candidates = melodyCandidatesForStep(params, col, slot, role, prevMidi);
    const midi = pickVoiceLed(candidates, prevMidi, {
      maxLeap: 5,
      preferHigher: i % 2 === 0,
    });
    prevMidi = midi;
    const loopEnd = barCount * GROOVE_LAB_SLOTS_PER_BAR;
    const endSlot = nextCol ? nextCol.slot : loopEnd;
    const sustainSlots = Math.max(8, Math.min(loopEnd - slot, endSlot - slot - 2));

    out.push({
      slot,
      midi,
      sustainSlots,
      vel: 0.74 + rnd() * 0.12,
    });
  }
  return out;
}

/** RIFF GRID off — two punchy hits per chord change. */
function generateSimpleRiff(params: GrooveMelodyGenParams): GrooveRollHit[] {
  const { harmony, barCount, seed } = params;
  const rnd = mulberry32(seed ^ 0x517c_c1b7);
  const out: GrooveRollHit[] = [];
  let prevMidi: number | null = null;

  for (let i = 0; i < harmony.columns.length; i++) {
    const col = harmony.columns[i]!;
    const barStart = grooveLabBarIndexFromSlot(col.slot) * GROOVE_LAB_SLOTS_PER_BAR;
    if (barStart >= barCount * GROOVE_LAB_SLOTS_PER_BAR) continue;

    const steps = [
      { offset16: 2, role: 'third' as PhraseToneRole, dur16: 4 },
      { offset16: 8, role: 'fifth' as PhraseToneRole, dur16: 5 },
    ];

    for (const step of steps) {
      const slot = col.slot + Math.round(step.offset16 * STEPS_PER_16TH);
      const candidates = melodyCandidatesForStep(params, col, slot, step.role, prevMidi);
      const midi = pickMelodyMidiFromCandidates(params, candidates, prevMidi, {
        maxLeap: melodyMaxLeap(params, 'riff'),
        preferHigher: step.role === 'fifth',
      });
      prevMidi = midi;
      out.push({
        slot,
        midi,
        sustainSlots: Math.max(4, Math.round(step.dur16 * STEPS_PER_16TH)),
        vel: 0.78 + rnd() * 0.14,
      });
    }
  }
  return out;
}

/** Arp walks chord tones in order with tight voice-leading (not random picks). */
function generateArp(params: GrooveMelodyGenParams): GrooveRollHit[] {
  const { harmony, barCount, quantize, mode, seed, complexity = 0.5, referenceMidi, rates } = params;
  const rnd = mulberry32(seed ^ 0xc2b2_ae35);
  const rate = rates?.arp ?? quantize;
  const snap = Math.max(1, Math.round(slotsPerRate(rate)));
  const out: GrooveRollHit[] = [];
  let prevMidi: number | null = null;

  const arpPattern: PhraseToneRole[] = ['third', 'fifth', 'seventh', 'fifth'];
  const stepStarts = [3, 7, 11, 14];

  for (let bar = 0; bar < barCount; bar += 1) {
    const barStart = bar * GROOVE_LAB_SLOTS_PER_BAR;
    const col = params.stackChordTonesOnly
      ? waveLeafHarmonyColumnAtSlot(harmony, barStart)
      : grooveMelodyColumnAtBar(harmony, bar);
    const anchorSlot = params.stackChordTonesOnly ? col.slot : barStart;
    const count = Math.min(arpPattern.length, 2 + Math.round(complexity * 2));

    for (let i = 0; i < count; i += 1) {
      const role = arpPattern[i]!;
      const slot = anchorSlot + Math.round(stepStarts[i]! * STEPS_PER_16TH);
      const candidates = melodyCandidatesForStep(params, col, slot, role, prevMidi);
      const midi = pickMelodyMidiFromCandidates(params, candidates, prevMidi, {
        maxLeap: melodyMaxLeap(params, 'melody'),
      });
      prevMidi = midi;
      if (slot >= barStart + GROOVE_LAB_SLOTS_PER_BAR) break;
      out.push({
        slot,
        midi,
        sustainSlots: Math.max(snap, Math.round(snap * (1.8 + i * 0.15))),
        vel: 0.72 + rnd() * 0.14,
      });
    }
  }
  return trimSustainsForLegato(out, snap, false);
}

export function generateGrooveMelodyPart(params: GrooveMelodyGenParams): GrooveRollHit[] {
  if (params.harmony.columns.length === 0) return [];
  switch (params.part) {
    case 'melody':
      if (params.leadPhraseMode === 'transitional') return generateTransitionalChordWeave(params);
      if (params.melodyGridEnabled === false) return generateSimpleMelody(params);
      return generateMelodyOrRiff(params);
    case 'riff':
      if (params.riffGridEnabled === false) return generateSimpleRiff(params);
      return generateMelodyOrRiff(params);
    case 'arp':
      return generateArp(params);
    default:
      return [];
  }
}
