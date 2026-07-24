/**
 * Neural Hum key + scale lock — Dubler-style mathematical pitch quantize (no ML).
 */
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';

export type NeuralHumScaleId =
  | 'major'
  | 'minor'
  | 'harmonic-minor'
  | 'major-pentatonic'
  | 'minor-pentatonic'
  | 'blues'
  | 'dorian'
  | 'mixolydian'
  | 'phrygian'
  | 'lydian';

export type NeuralHumKeyLockMode = 'off' | 'auto' | 'manual' | 'set';

export type NeuralHumKeyLockSettings = {
  mode: NeuralHumKeyLockMode;
  /** 0 = C … 11 = B — used when mode is manual; auto overwrites after analyze. */
  keyRoot: number;
  scaleId: NeuralHumScaleId;
};

export type NeuralHumDetectedKey = {
  keyRoot: number;
  scaleId: NeuralHumScaleId;
  score: number;
};

export type NeuralHumScaleMeta = {
  id: NeuralHumScaleId;
  label: string;
  intervals: readonly number[];
};

const SCALE_DEFS: readonly NeuralHumScaleMeta[] = [
  { id: 'major', label: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', label: 'Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'harmonic-minor', label: 'Harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'major-pentatonic', label: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
  { id: 'minor-pentatonic', label: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  { id: 'blues', label: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  { id: 'dorian', label: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixolydian', label: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'phrygian', label: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', label: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
] as const;

export const NEURAL_HUM_SCALES: readonly NeuralHumScaleMeta[] = SCALE_DEFS;

export const NEURAL_HUM_KEY_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export function neuralHumScaleMeta(id: NeuralHumScaleId): NeuralHumScaleMeta {
  return SCALE_DEFS.find((s) => s.id === id) ?? SCALE_DEFS[0]!;
}

export function neuralHumKeyLabel(keyRoot: number, scaleId: NeuralHumScaleId): string {
  const root = NEURAL_HUM_KEY_NAMES[((Math.round(keyRoot) % 12) + 12) % 12] ?? 'C';
  return `${root} ${neuralHumScaleMeta(scaleId).label}`;
}

/** Pitch classes (0–11) in this key + scale. */
export function neuralHumScalePitchClasses(keyRoot: number, scaleId: NeuralHumScaleId): number[] {
  const root = ((Math.round(keyRoot) % 12) + 12) % 12;
  const intervals = neuralHumScaleMeta(scaleId).intervals;
  return intervals.map((i) => (root + i) % 12);
}

/** Snap one MIDI note to nearest scale tone (±1 octave search). */
export function snapMidiToNeuralHumScale(
  midi: number,
  keyRoot: number,
  scaleId: NeuralHumScaleId,
): number {
  const intervals = neuralHumScaleMeta(scaleId).intervals;
  const root = ((Math.round(keyRoot) % 12) + 12) % 12;
  const center = Math.round(midi);
  const baseOct = Math.floor(center / 12);
  let best = center;
  let bestDist = Infinity;
  for (let oct = baseOct - 2; oct <= baseOct + 2; oct++) {
    for (const interval of intervals) {
      const candidate = oct * 12 + root + interval;
      if (candidate < 0 || candidate > 127) continue;
      const dist = Math.abs(candidate - midi);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
  }
  return best;
}

/** Move melody to a new key root — transpose by root delta, then snap to scale. */
export function retargetNeuralHumNotesToKeyRoot(
  notes: readonly TimedMonophonicNote[],
  fromKeyRoot: number,
  toKeyRoot: number,
  scaleId: NeuralHumScaleId,
): TimedMonophonicNote[] {
  if (notes.length === 0) return [];
  const from = ((Math.round(fromKeyRoot) % 12) + 12) % 12;
  const to = ((Math.round(toKeyRoot) % 12) + 12) % 12;
  let shift = to - from;
  if (shift > 6) shift -= 12;
  if (shift < -6) shift += 12;

  const out = notes.map((n) => {
    const transposed = Math.max(0, Math.min(127, Math.round(n.pitch + shift)));
    return {
      ...n,
      pitch: snapMidiToNeuralHumScale(transposed, to, scaleId),
    };
  });
  return enforceMonophonicHumNotes(out);
}

function pitchClassWeights(notes: readonly TimedMonophonicNote[]): Float32Array {
  const w = new Float32Array(12);
  for (const n of notes) {
    const pc = ((Math.round(n.pitch) % 12) + 12) % 12;
    const weight = Math.max(0.05, n.durationSec) * (n.velocity / 127);
    w[pc]! += weight;
  }
  return w;
}

function scoreKeyScale(weights: Float32Array, keyRoot: number, scaleId: NeuralHumScaleId): number {
  const pcs = new Set(neuralHumScalePitchClasses(keyRoot, scaleId));
  let inScore = 0;
  let outPenalty = 0;
  for (let pc = 0; pc < 12; pc++) {
    const wt = weights[pc] ?? 0;
    if (wt <= 0) continue;
    if (pcs.has(pc)) inScore += wt;
    else outPenalty += wt * 0.65;
  }
  return inScore - outPenalty;
}

/** Dubler-style: infer closest key + scale from sung notes. */
export function detectNeuralHumKey(
  notes: readonly TimedMonophonicNote[],
  preferScale?: NeuralHumScaleId,
): NeuralHumDetectedKey | null {
  if (notes.length === 0) return null;
  const weights = pitchClassWeights(notes);
  let total = 0;
  for (let i = 0; i < 12; i++) total += weights[i]!;
  if (total < 0.05) return null;

  let bestKey = 0;
  let bestScale: NeuralHumScaleId = preferScale ?? 'major';
  let bestScore = -Infinity;

  const scales = preferScale
    ? [preferScale, ...SCALE_DEFS.map((s) => s.id).filter((id) => id !== preferScale)]
    : SCALE_DEFS.map((s) => s.id);

  for (const scaleId of scales) {
    for (let keyRoot = 0; keyRoot < 12; keyRoot++) {
      const score = scoreKeyScale(weights, keyRoot, scaleId);
      if (score > bestScore) {
        bestScore = score;
        bestKey = keyRoot;
        bestScale = scaleId;
      }
    }
  }

  return { keyRoot: bestKey, scaleId: bestScale, score: bestScore };
}

/** Drop ultra-short glitches only — no merging (keeps every sung note separate). */
export function trimShortNeuralHumNotes(
  notes: readonly TimedMonophonicNote[],
  minDurSec = 0.014,
): TimedMonophonicNote[] {
  return [...notes]
    .sort((a, b) => a.startSec - b.startSec || a.pitch - b.pitch)
    .filter((n) => n.durationSec >= minDurSec);
}

/** @deprecated Prefer trimShortNeuralHumNotes for loose capture. */
export function cleanNeuralHumMelodyNotes(
  notes: readonly TimedMonophonicNote[],
  minDurSec = 0.032,
  mergeGapSec = 0.09,
): TimedMonophonicNote[] {
  const trimmed = trimShortNeuralHumNotes(notes, minDurSec);
  if (mergeGapSec <= 0) return trimmed;

  const out: TimedMonophonicNote[] = [];
  let cur = trimmed[0] ? { ...trimmed[0] } : null;

  for (let i = 1; i < trimmed.length; i++) {
    const n = trimmed[i]!;
    if (!cur) {
      cur = { ...n };
      continue;
    }
    const gap = n.startSec - (cur.startSec + cur.durationSec);
    if (n.pitch === cur.pitch && gap >= 0 && gap < mergeGapSec) {
      const end = Math.max(cur.startSec + cur.durationSec, n.startSec + n.durationSec);
      cur.durationSec = end - cur.startSec;
      cur.velocity = Math.round((cur.velocity + n.velocity) / 2);
    } else {
      out.push(cur);
      cur = { ...n };
    }
  }
  if (cur) out.push(cur);
  return out;
}

export type EnforceMonophonicHumOpts = {
  /** Same-pitch restarts closer than this merge into one held note. */
  stutterGapSec?: number;
  /**
   * Onsets closer than this are treated as one voice (keep stronger).
   * Keep small for hummed phrases so fast pitch changes are not wiped.
   */
  simultaneousSec?: number;
};

/**
 * Horn-style monophonic line — one voice, no doubles.
 * Collapses analysis stutter & octave ghosts; trims overlaps when the next note starts.
 */
export function enforceMonophonicHumNotes(
  notes: readonly TimedMonophonicNote[],
  minDurSec = 0.014,
  opts?: EnforceMonophonicHumOpts,
): TimedMonophonicNote[] {
  if (notes.length === 0) return [];

  const STUTTER_GAP_SEC = opts?.stutterGapSec ?? 0.055;
  const SIMULTANEOUS_SEC = opts?.simultaneousSec ?? 0.038;

  const sorted = [...notes]
    .map((n) => ({ ...n, pitch: Math.round(n.pitch) }))
    .sort((a, b) => a.startSec - b.startSec || b.velocity - a.velocity);

  const merged: TimedMonophonicNote[] = [];
  for (const n of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...n });
      continue;
    }

    const gap = n.startSec - (prev.startSec + prev.durationSec);
    const simultaneous = Math.abs(n.startSec - prev.startSec) < SIMULTANEOUS_SEC;
    const samePitch = n.pitch === prev.pitch;
    const octaveGhost =
      simultaneous &&
      n.pitch !== prev.pitch &&
      Math.abs(n.pitch - prev.pitch) % 12 === 0;

    if (samePitch && (simultaneous || gap < STUTTER_GAP_SEC)) {
      const end = Math.max(prev.startSec + prev.durationSec, n.startSec + n.durationSec);
      prev.durationSec = end - prev.startSec;
      prev.velocity = Math.max(prev.velocity, n.velocity);
      continue;
    }

    if (octaveGhost) {
      const prevScore = prev.durationSec * prev.velocity;
      const nextScore = n.durationSec * n.velocity;
      if (nextScore > prevScore) merged[merged.length - 1] = { ...n };
      continue;
    }

    if (simultaneous && !samePitch) {
      const prevScore = prev.durationSec * prev.velocity;
      const nextScore = n.durationSec * n.velocity;
      if (nextScore > prevScore) merged[merged.length - 1] = { ...n };
      continue;
    }

    merged.push({ ...n });
  }

  const mono: TimedMonophonicNote[] = [];
  for (let i = 0; i < merged.length; i++) {
    const cur = { ...merged[i]! };
    const next = merged[i + 1];
    if (next) {
      const curEnd = cur.startSec + cur.durationSec;
      if (curEnd > next.startSec - 0.004) {
        cur.durationSec = Math.max(minDurSec, next.startSec - cur.startSec);
      }
    }
    if (cur.durationSec >= minDurSec) mono.push(cur);
  }

  const strict: TimedMonophonicNote[] = [];
  for (const n of mono) {
    const prev = strict[strict.length - 1];
    if (!prev) {
      strict.push(n);
      continue;
    }
    const prevEnd = prev.startSec + prev.durationSec;
    if (n.startSec < prevEnd - 0.003) {
      if (Math.abs(n.startSec - prev.startSec) < SIMULTANEOUS_SEC) {
        if (n.velocity > prev.velocity) strict[strict.length - 1] = n;
        continue;
      }
      prev.durationSec = Math.max(minDurSec, n.startSec - prev.startSec);
      if (prev.durationSec < minDurSec) {
        strict[strict.length - 1] = n;
        continue;
      }
    }
    strict.push(n);
  }

  return strict;
}

/** Full Dubler-style post-process: clean → optional key detect → snap to scale. */
export function processNeuralHumMelody(
  rawNotes: readonly TimedMonophonicNote[],
  lock: NeuralHumKeyLockSettings,
  monoOpts?: EnforceMonophonicHumOpts,
): {
  notes: TimedMonophonicNote[];
  detectedKey: NeuralHumDetectedKey | null;
  effectiveKeyRoot: number;
  effectiveScaleId: NeuralHumScaleId;
} {
  let notes = trimShortNeuralHumNotes(rawNotes, 0.016);
  notes = enforceMonophonicHumNotes(notes, 0.014, monoOpts);
  if (notes.length === 0) {
    return {
      notes: [],
      detectedKey: null,
      effectiveKeyRoot: lock.keyRoot,
      effectiveScaleId: lock.scaleId,
    };
  }

  if (lock.mode === 'off') {
    return {
      notes: trimShortNeuralHumNotes(notes, 0.012),
      detectedKey: null,
      effectiveKeyRoot: lock.keyRoot,
      effectiveScaleId: lock.scaleId,
    };
  }

  const detected =
    lock.mode === 'auto'
      ? detectNeuralHumKey(notes, lock.scaleId)
      : null;

  const effectiveKeyRoot = detected?.keyRoot ?? lock.keyRoot;
  const effectiveScaleId = detected?.scaleId ?? lock.scaleId;

  notes = notes.map((n) => ({
    ...n,
    pitch: snapMidiToNeuralHumScale(n.pitch, effectiveKeyRoot, effectiveScaleId),
  }));

  notes = enforceMonophonicHumNotes(notes, 0.014, monoOpts);
  notes = trimShortNeuralHumNotes(notes, 0.012);

  return {
    notes,
    detectedKey: detected,
    effectiveKeyRoot,
    effectiveScaleId,
  };
}
