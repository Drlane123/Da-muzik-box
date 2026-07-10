/**
 * R&B Soft Lead — scale pools, stepwise pitch walking, humanization.
 * Used by Geno Build 1 Groove Lead (rnb-sine / Melodio-style).
 */
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  SE2_GROOVE_LEAD_PITCH_DEFAULT_HI,
  SE2_GROOVE_LEAD_PITCH_DEFAULT_LO,
} from '@/app/lib/studio/se2GrooveLeadNotes';
import { genoWrapMidiToRange } from '@/app/lib/studio/se2SynthGenoRanges';

export type RnbSoftLeadScaleMode = 'naturalMinor' | 'dorian' | 'minorPentatonic';

/** Deep late-night keys — pitch classes (D, C, F#, Bb). */
export const RNB_SOFT_LEAD_PREFERRED_KEY_PCS = [2, 0, 6, 10] as const;

const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MINOR_PENT = [0, 3, 5, 7, 10];

/** Allowed leap sizes in semitones — P4, P5, m7. */
const ALLOWED_LEAP_SEMITONES = new Set([5, 7, 10]);

const MIDI_PPQ = 480;

export function rnbSoftLeadEffectiveKeyRoot(keyRoot: number, keyMode: StudioDetectedKeyMode): number {
  const pc = ((Math.round(keyRoot) % 12) + 12) % 12;
  if (keyMode === 'minor' && (RNB_SOFT_LEAD_PREFERRED_KEY_PCS as readonly number[]).includes(pc)) {
    return pc;
  }
  let best = RNB_SOFT_LEAD_PREFERRED_KEY_PCS[0]!;
  let bestDist = 12;
  for (const pref of RNB_SOFT_LEAD_PREFERRED_KEY_PCS) {
    const d = Math.min(Math.abs(pc - pref), 12 - Math.abs(pc - pref));
    if (d < bestDist) {
      bestDist = d;
      best = pref;
    }
  }
  return best;
}

export function rnbSoftLeadPickScaleMode(seed: number): RnbSoftLeadScaleMode {
  const modes: RnbSoftLeadScaleMode[] = ['dorian', 'naturalMinor', 'minorPentatonic'];
  return modes[Math.abs(seed) % modes.length]!;
}

function scaleIntervals(mode: RnbSoftLeadScaleMode): readonly number[] {
  switch (mode) {
    case 'dorian':
      return DORIAN;
    case 'minorPentatonic':
      return MINOR_PENT;
    default:
      return NATURAL_MINOR;
  }
}

/** Build sorted MIDI pitches in lead register for the chosen scale. */
export function rnbSoftLeadScaleMidis(
  keyRootPc: number,
  mode: RnbSoftLeadScaleMode,
  lo = SE2_GROOVE_LEAD_PITCH_DEFAULT_LO,
  hi = SE2_GROOVE_LEAD_PITCH_DEFAULT_HI,
): number[] {
  const iv = scaleIntervals(mode);
  const out: number[] = [];
  for (let m = lo; m <= hi; m += 1) {
    const rel = ((m - keyRootPc) % 12 + 12) % 12;
    if (iv.includes(rel)) out.push(m);
  }
  return out.length > 0 ? out : [genoWrapMidiToRange(76, lo, hi)];
}

function nearestScaleIndex(scale: readonly number[], midi: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < scale.length; i += 1) {
    const d = Math.abs(scale[i]! - midi);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function snapToScale(midi: number, scale: readonly number[]): number {
  if (scale.length === 0) return midi;
  return scale[nearestScaleIndex(scale, midi)]!;
}

function isStepOnScale(from: number, to: number, scale: readonly number[]): boolean {
  const fi = nearestScaleIndex(scale, from);
  const ti = nearestScaleIndex(scale, to);
  return Math.abs(ti - fi) === 1;
}

function leapSemitones(from: number, to: number): number {
  return Math.abs(to - from);
}

function colorNinth(barRoot: number, scale: readonly number[]): number {
  const target = barRoot + 14;
  return snapToScale(genoWrapMidiToRange(target, scale[0]!, scale[scale.length - 1]!), scale);
}

function colorEleventh(barRoot: number, scale: readonly number[]): number {
  const target = barRoot + 17;
  return snapToScale(genoWrapMidiToRange(target, scale[0]!, scale[scale.length - 1]!), scale);
}

export function rnbSoftLeadDegreePitch(
  degree: string,
  barRoot: number,
  chordTones: readonly number[],
  scale: readonly number[],
): number {
  const lo = scale[0] ?? SE2_GROOVE_LEAD_PITCH_DEFAULT_LO;
  const hi = scale[scale.length - 1] ?? SE2_GROOVE_LEAD_PITCH_DEFAULT_HI;
  const n = Math.max(1, chordTones.length);
  const i1 = Math.min(1, n - 1);
  const i2 = Math.min(2, n - 1);
  const i3 = Math.min(3, n - 1);
  switch (degree) {
    case 'root':
      return snapToScale(genoWrapMidiToRange(barRoot, lo, hi), scale);
    case 'third':
      return snapToScale(chordTones[i1] ?? barRoot, scale);
    case 'fifth':
      return snapToScale(chordTones[i2] ?? chordTones[i1] ?? barRoot, scale);
    case 'seventh':
      return snapToScale(chordTones[i3] ?? chordTones[n - 1] ?? barRoot, scale);
    case 'top':
      return snapToScale(chordTones[n - 1] ?? barRoot, scale);
    case 'ninth':
      return colorNinth(barRoot, scale);
    case 'eleventh':
      return colorEleventh(barRoot, scale);
    default:
      return snapToScale(chordTones[i1] ?? barRoot, scale);
  }
}

type WalkState = { mustResolve: boolean; leapDirection: -1 | 0 | 1 };

function pickPitchWithRules(
  prev: number | null,
  hint: number,
  scale: readonly number[],
  chordTones: readonly number[],
  state: WalkState,
  rnd: () => number,
  stepBias: number,
): { pitch: number; state: WalkState } {
  const lo = scale[0] ?? SE2_GROOVE_LEAD_PITCH_DEFAULT_LO;
  const hi = scale[scale.length - 1] ?? SE2_GROOVE_LEAD_PITCH_DEFAULT_HI;
  const hintSnap = snapToScale(genoWrapMidiToRange(hint, lo, hi), scale);

  if (prev == null) {
    return { pitch: hintSnap, state: { mustResolve: false, leapDirection: 0 } };
  }

  const prevIdx = nearestScaleIndex(scale, prev);
  const candidates: number[] = [];

  if (state.mustResolve && state.leapDirection !== 0) {
    const resolveIdx = prevIdx + state.leapDirection;
    if (resolveIdx >= 0 && resolveIdx < scale.length) {
      candidates.push(scale[resolveIdx]!);
    }
  }

  if (candidates.length === 0) {
    for (let i = 0; i < scale.length; i += 1) {
      candidates.push(scale[i]!);
    }
  }

  const preferStep = rnd() < stepBias;
  let best = hintSnap;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const c of candidates) {
    const leap = leapSemitones(prev, c);
    let score = Math.abs(c - hintSnap) * 1.6;

    if (isStepOnScale(prev, c, scale)) {
      score -= preferStep ? 18 : 10;
    } else if (ALLOWED_LEAP_SEMITONES.has(leap)) {
      score += preferStep ? 8 : -2;
    } else {
      score += 22;
    }

    if (chordTones.includes(c)) score -= 4;
    if (state.mustResolve && isStepOnScale(prev, c, scale)) score -= 14;

    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }

  const usedLeap = !isStepOnScale(prev, best, scale);
  const nextState: WalkState = { mustResolve: false, leapDirection: 0 };
  if (usedLeap && ALLOWED_LEAP_SEMITONES.has(leapSemitones(prev, best))) {
    nextState.mustResolve = true;
    nextState.leapDirection = best > prev ? -1 : 1;
  }

  return { pitch: best, state: nextState };
}

/** Walk rendered phrase pitches through scale + stepwise / leap-resolve rules. */
export function rnbSoftLeadWalkPitches(
  notes: StudioEditor2GenNote[],
  barRoots: Map<number, number>,
  barChordTones: Map<number, number[]>,
  scale: readonly number[],
  beatsPerBar: number,
  stepBias: number,
  rnd: () => number,
): StudioEditor2GenNote[] {
  const bpb = Math.max(1, beatsPerBar);
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const out: StudioEditor2GenNote[] = [];
  let prev: number | null = null;
  let walk: WalkState = { mustResolve: false, leapDirection: 0 };

  for (const n of sorted) {
    const bar = Math.floor(n.startBeat / bpb + 1e-9);
    const barRoot = barRoots.get(bar) ?? n.pitch;
    const tones = barChordTones.get(bar) ?? [barRoot];
    const hint = snapToScale(n.pitch, scale);
    const { pitch, state } = pickPitchWithRules(prev, hint, scale, tones, walk, rnd, stepBias);
    walk = state;
    prev = pitch;
    out.push({ ...n, pitch });
  }

  return out;
}

const BREATH_GAP_BEATS = 0.035;

/** Legato sustain — ties notes across bar lines when room allows. */
export function rnbSoftLeadLegatoSustain(
  notes: StudioEditor2GenNote[],
  totalBeats: number,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0) return notes;
  const minHold = beatsPerBar * 0.42;
  const out = notes.map((n) => ({ ...n }));

  for (let i = 0; i < out.length; i += 1) {
    const cur = out[i]!;
    const next = out[i + 1];
    if (next) {
      const span = next.startBeat - cur.startBeat - BREATH_GAP_BEATS;
      cur.durationBeats = Math.max(minHold, Math.min(span, beatsPerBar * 1.85));
    } else {
      cur.durationBeats = Math.max(minHold, totalBeats - cur.startBeat - BREATH_GAP_BEATS * 0.5);
    }
  }

  return out;
}

/** Cap density, velocity 80–110, behind-the-beat, flex glide on long notes. */
export function rnbSoftLeadHumanize(
  notes: StudioEditor2GenNote[],
  beatsPerBar: number,
  maxPerBar: number,
  rnd: () => number,
): StudioEditor2GenNote[] {
  const bpb = Math.max(1, beatsPerBar);
  const byBar = new Map<number, StudioEditor2GenNote[]>();

  for (const n of notes) {
    const bar = Math.floor(n.startBeat / bpb);
    const list = byBar.get(bar) ?? [];
    list.push(n);
    byBar.set(bar, list);
  }

  const out: StudioEditor2GenNote[] = [];

  for (const [, barNotes] of byBar) {
    const sorted = [...barNotes].sort((a, b) => a.startBeat - b.startBeat);
    const kept =
      sorted.length <= maxPerBar
        ? sorted
        : sorted.filter((_, i) => i === 0 || i >= sorted.length - (maxPerBar - 1));

    for (const n of kept) {
      const lateTicks = 5 + Math.floor(rnd() * 11);
      const lateBeats = lateTicks / MIDI_PPQ;
      const vel = 80 + Math.floor(rnd() * 31);
      const longNote = n.durationBeats >= bpb * 0.72;
      const humanized: StudioEditor2GenNote = {
        ...n,
        startBeat: n.startBeat + lateBeats,
        velocity: Math.min(110, vel),
      };
      if (longNote) {
        humanized.flexCurve = [
          { beatOffset: 0, pitch: n.pitch - 0.35 },
          { beatOffset: Math.min(0.12, n.durationBeats * 0.15), pitch: n.pitch },
        ];
      }
      out.push(humanized);
    }
  }

  return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}
