/**
 * VocalBox Hum Melody — audio → MIDI (singer model).
 *
 * Rec: mic + pre-count; scope reads pitch (no live roll paint).
 * Analyze: held tones until the mouth stops or pitch clearly changes →
 * timed MIDI → snap onto the quantize grid. Optional key lock after.
 */
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';
import {
  audioBufferToMonophonicTimedNotes,
  type MonophonicPitchExtractOpts,
} from '@/app/lib/studio/audioToMidiNotes';
import {
  filterNotesByMinDuration,
  transcribeAudioBufferToTimedNotes,
  type BasicPitchTranscribeOpts,
} from '@/app/lib/studio/basicPitchTranscribe';
import { grooveLabQuantizeDivisionsPerBar } from '@/app/lib/creationStation/grooveLabRoll';
import {
  enforceMonophonicHumNotes,
  processNeuralHumMelody,
  snapMidiToNeuralHumScale,
  trimShortNeuralHumNotes,
  type NeuralHumKeyLockSettings,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import {
  enforceMonophonicRollNotes,
  neuralHumQuantizeStepSlots,
  newNeuralHumRollNoteId,
  quantizeNeuralHumRollNotes,
  secPerBar,
  snapNeuralHumRollLen,
  snapNeuralHumRollSlot,
  totalRollSlots,
  type NeuralHumRollBarCount,
  type NeuralHumRollNote,
  type NeuralHumRollQuantize,
} from '@/app/lib/vocalLab/neuralHumMelodyRoll';

export const VOCALBOX_HUM_FMIN_HZ = 70;
export const VOCALBOX_HUM_FMAX_HZ = 1200;

/* ── Scope monitor (does not write the roll) ───────────────────────────── */

export const VOCALBOX_HUM_LIVE_OPTS = {
  minConfidence: 0.12,
  minRms: 0.0018,
  silenceHoldFrames: 3,
  fMinHz: VOCALBOX_HUM_FMIN_HZ,
  fMaxHz: VOCALBOX_HUM_FMAX_HZ,
} as const;

/** Kept for callers; live roll paint is disabled. */
export const VOCALBOX_HUM_PITCH_SWITCH_SEC = 0.04;
export const VOCALBOX_HUM_LIVE_ONSET_HOLD_SEC = 0.04;
export const VOCALBOX_HUM_LIVE_DETECT_LATENCY_SEC = 0.035;

/* ── Audio → MIDI ──────────────────────────────────────────────────────── */

export const VOCALBOX_HUM_TRANSCRIBE_OPTS: BasicPitchTranscribeOpts = {
  onsetThreshold: 0.35,
  frameThreshold: 0.22,
  minNoteFrames: 4,
  minNoteSec: 0.045,
};

/**
 * Singer-style mic pitch — less twitchy; only clear sung changes start a new note.
 */
export const VOCALBOX_HUM_EXTRACT_OPTS: MonophonicPitchExtractOpts = {
  fMinHz: VOCALBOX_HUM_FMIN_HZ,
  fMaxHz: VOCALBOX_HUM_FMAX_HZ,
  minRms: 0.0014,
  minPitchClarity: 0.11,
  // Wider hold so vibrato / wobble stay one note.
  pitchRunTolerance: 1.05,
  // ~175 ms — bridge dips inside a held vowel.
  maxVoicedGapFrames: 15,
  // ~45 ms stable new pitch before cutting.
  pitchChangeConfirmFrames: 4,
};

export const VOCALBOX_HUM_LATENCY_SEC = 0.04;
/** Glue same-pitch scraps only (never different pitches). */
export const VOCALBOX_HUM_STICKINESS_SEC = 0.085;
/** Drop short scraps more readily. */
export const VOCALBOX_HUM_MIN_GRID_NOTE_FRAC = 0.26;
/** Short on-beat click ghosts (rimshot bleed). */
export const VOCALBOX_HUM_CLICK_REJECT_WINDOW_SEC = 0.06;
export const VOCALBOX_HUM_CLICK_REJECT_MAX_DUR_SEC = 0.1;
export const VOCALBOX_HUM_MIN_NOTE_SEC = 0.048;
/**
 * How hard phrase nudge pulls toward the grid (0–1). Lower = looser feel.
 */
export const VOCALBOX_HUM_QUANTIZE_STRENGTH = 0.55;
/** Unused in simple path — kept for older callers. */
export const VOCALBOX_HUM_MIN_VELOCITY = 1;
/**
 * Tiny file trim past arm→green 1 (encoder preroll). Keep small so we don’t
 * chop the start of the take.
 */
export const VOCALBOX_HUM_DOWNBEAT_TRIM_SLACK_SEC = 0.02;

export type VocalBoxHumTranscribeEngine = 'acf' | 'basic-pitch' | 'acf-fallback';

export type VocalBoxHumLockResult = {
  rollNotes: NeuralHumRollNote[];
  timedNotes: TimedMonophonicNote[];
  effectiveKeyRoot: number;
  effectiveScaleId: NeuralHumScaleId;
  noteCount: number;
};

export function clampHumCaptureQuantize(q: NeuralHumRollQuantize): NeuralHumRollQuantize {
  if (q === '1/32') return '1/16';
  return q;
}

function quantizeStepSec(bpm: number, quantize: NeuralHumRollQuantize): number {
  const barSec = secPerBar(bpm);
  const divisions = grooveLabQuantizeDivisionsPerBar(clampHumCaptureQuantize(quantize));
  return barSec / Math.max(1, divisions);
}

/**
 * Drop tracking crumbs from slides between real sung pitches
 * (short ±1 st flakes between two longer notes).
 */
export function rejectHumPitchGlideScraps(
  notes: readonly TimedMonophonicNote[],
): TimedMonophonicNote[] {
  if (notes.length < 3) return notes.map((n) => ({ ...n }));
  const sorted = [...notes].sort((a, b) => a.startSec - b.startSec);
  const out: TimedMonophonicNote[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i]!;
    const prev = out[out.length - 1];
    const next = sorted[i + 1];
    if (
      prev &&
      next &&
      n.durationSec < 0.07 &&
      Math.abs(n.pitch - prev.pitch) <= 1 &&
      Math.abs(n.pitch - next.pitch) <= 1
    ) {
      continue;
    }
    out.push({ ...n });
  }
  return out;
}

/**
 * Drop tracking scraps — a sung note is longer / stronger than a glitch.
 */
export function rejectHumBlipNotes(
  notes: readonly TimedMonophonicNote[],
  stepSec: number,
  minNoteSec: number = VOCALBOX_HUM_MIN_NOTE_SEC,
): TimedMonophonicNote[] {
  const minAbs = Math.max(
    0.035,
    Math.min(minNoteSec, stepSec > 0 ? stepSec * VOCALBOX_HUM_MIN_GRID_NOTE_FRAC : minNoteSec),
  );
  return [...notes]
    .map((n) => ({
      pitch: Math.round(n.pitch),
      startSec: Math.max(0, n.startSec),
      durationSec: n.durationSec,
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
    }))
    .filter((n) => {
      if (!Number.isFinite(n.pitch) || n.pitch < 0 || n.pitch > 127) return false;
      if (n.durationSec < minAbs) return false;
      if (n.durationSec < (stepSec > 0 ? stepSec * 0.32 : 0.055) && n.velocity < 26) return false;
      return true;
    })
    .sort((a, b) => a.startSec - b.startSec);
}

/** @deprecated Prefer rejectHumBlipNotes. */
export function rejectWeakHumScraps(
  notes: readonly TimedMonophonicNote[],
  minNoteSec: number = VOCALBOX_HUM_MIN_NOTE_SEC,
): TimedMonophonicNote[] {
  return trimShortNeuralHumNotes(notes, minNoteSec);
}

/** @deprecated No-op. */
export function rejectHumParasiteNotes(
  notes: readonly TimedMonophonicNote[],
): TimedMonophonicNote[] {
  return notes.map((n) => ({ ...n }));
}

/** @deprecated No-op. */
export function rejectHumRelativeScraps(
  notes: readonly TimedMonophonicNote[],
): TimedMonophonicNote[] {
  return notes.map((n) => ({ ...n }));
}

/**
 * Merge same pitch across a tiny breath hole only.
 * Different pitches always stay separate (audio → MIDI as sung).
 */
export function defragVocalBoxHumNotes(
  notes: readonly TimedMonophonicNote[],
  minNoteSec: number = VOCALBOX_HUM_MIN_NOTE_SEC,
): TimedMonophonicNote[] {
  const minSec = Math.max(0.022, Math.min(0.2, minNoteSec));
  const breath = VOCALBOX_HUM_STICKINESS_SEC;
  const sorted = [...notes]
    .map((n) => ({
      pitch: Math.round(n.pitch),
      startSec: Math.max(0, n.startSec),
      durationSec: n.durationSec,
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
    }))
    .filter((n) => n.durationSec >= minSec)
    .sort((a, b) => a.startSec - b.startSec);

  if (sorted.length === 0) return [];

  const out: TimedMonophonicNote[] = [];
  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ ...n });
      continue;
    }
    const prevEnd = prev.startSec + prev.durationSec;
    const gap = n.startSec - prevEnd;
    const overlaps = n.startSec < prevEnd - 0.008;
    if (n.pitch === prev.pitch && (overlaps || gap < breath)) {
      prev.durationSec = Math.max(prevEnd, n.startSec + n.durationSec) - prev.startSec;
      prev.velocity = Math.max(prev.velocity, n.velocity);
      continue;
    }
    if (overlaps) {
      prev.durationSec = Math.max(minSec * 0.8, n.startSec - prev.startSec);
    }
    out.push({ ...n });
  }
  return out;
}

/**
 * True when the take is room noise / metro bleed only (no hummed phrase).
 * Sparse singing across many bars has a near-zero median — do NOT treat that
 * as silence; look for any sustained voiced energy.
 */
export function isHumTakeMostlySilence(buffer: AudioBuffer): boolean {
  const ch = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  if (!ch || ch.length < sr * 0.2) return true;

  const frame = Math.max(256, Math.floor(sr * 0.012));
  const hop = Math.max(128, Math.floor(frame / 2));
  const rmses: number[] = [];
  for (let i = 0; i + frame <= ch.length; i += hop) {
    let s = 0;
    for (let j = 0; j < frame; j += 1) {
      const v = ch[i + j] ?? 0;
      s += v * v;
    }
    rmses.push(Math.sqrt(s / frame));
  }
  if (rmses.length < 8) return true;

  const sorted = [...rmses].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  // Frames that look like voice (not empty room).
  const voiced = rmses.filter((r) => r >= 0.0022);
  // Truly empty take.
  if (p95 < 0.004) return true;
  // A few click spikes only — no hummed run.
  if (voiced.length < 5 && p95 < 0.035) return true;
  // Enough voiced frames somewhere in the take (sparse phrases OK).
  if (voiced.length >= 5) return false;
  // Fallback: strong peak energy but almost no voiced continuity.
  return p90 < 0.008;
}

/** Audio → MIDI: pitch-track the mic take. Basic Pitch only if ACF finds nothing. */
export async function analyzeVocalBoxHumTake(
  buffer: AudioBuffer,
  onProgress?: (percent: number, message: string) => void,
): Promise<{ rawNotes: TimedMonophonicNote[]; engine: VocalBoxHumTranscribeEngine }> {
  const minNoteSec = VOCALBOX_HUM_MIN_NOTE_SEC;
  onProgress?.(0.05, 'Audio → MIDI…');

  if (isHumTakeMostlySilence(buffer)) {
    onProgress?.(1, 'No voice in take.');
    return { rawNotes: [], engine: 'acf' };
  }

  const acf = filterNotesByMinDuration(
    audioBufferToMonophonicTimedNotes(buffer, VOCALBOX_HUM_EXTRACT_OPTS),
    minNoteSec,
  );
  if (acf.length > 0) {
    onProgress?.(1, 'Mic → MIDI.');
    return { rawNotes: acf, engine: 'acf' };
  }

  onProgress?.(0.15, 'Trying Basic Pitch…');
  const { notes, engine } = await transcribeAudioBufferToTimedNotes(
    buffer,
    (p) => onProgress?.(0.15 + p.percent * 0.85, p.message),
    VOCALBOX_HUM_EXTRACT_OPTS,
    VOCALBOX_HUM_TRANSCRIBE_OPTS,
  );
  return {
    rawNotes: filterNotesByMinDuration(notes, minNoteSec),
    engine: engine === 'basic-pitch' ? 'basic-pitch' : 'acf-fallback',
  };
}

/**
 * Snap to nearest quantize line (no early pull to the previous step).
 */
export function snapHumTimeToStepIndex(timeSec: number, stepSec: number): number {
  if (stepSec <= 0) return 0;
  return Math.max(0, Math.round(Math.max(0, timeSec) / stepSec));
}

export function snapHumTimeToGridSec(timeSec: number, stepSec: number): number {
  return snapHumTimeToStepIndex(timeSec, stepSec) * stepSec;
}

/**
 * Soft whole-take nudge — light phrase align only (scaled by quantize strength).
 */
export function humFineGridNudge(
  notes: readonly TimedMonophonicNote[],
  stepSec: number,
  strength: number = VOCALBOX_HUM_QUANTIZE_STRENGTH,
): number {
  if (notes.length === 0 || !(stepSec > 0)) return 0;
  const s = Math.max(0, Math.min(1, strength));
  const maxNudge = stepSec * (0.12 + 0.2 * s);
  const step = Math.min(0.001, stepSec * 0.025);
  let best = 0;
  let bestScore = Infinity;
  for (let n = -maxNudge; n <= maxNudge + 1e-9; n += step) {
    let score = 0;
    for (const note of notes) {
      const t = Math.max(0, note.startSec + n);
      const nearest = Math.round(t / stepSec) * stepSec;
      const weight =
        0.55 +
        (note.velocity / 127) * 0.35 +
        Math.min(1, note.durationSec / Math.max(stepSec, 1e-6)) * 0.25;
      score += Math.abs(t - nearest) * weight;
    }
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  const raw = Math.abs(best) < 0.0015 ? 0 : best;
  return raw * s;
}

/**
 * Place sung notes on the quantize grid — nearest step, natural lengths.
 * Less “brick wall” than early-bias hard lock; keeps more of how you sang.
 */
export function snapTimedNotesToQuantizeCells(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  quantize: NeuralHumRollQuantize,
): TimedMonophonicNote[] {
  const q = clampHumCaptureQuantize(quantize);
  const stepSec = quantizeStepSec(bpm, q);
  if (!(stepSec > 0) || notes.length === 0) return notes.map((n) => ({ ...n }));

  const out: TimedMonophonicNote[] = [];
  let prevEndStep = 0;

  const sorted = [...notes].sort((a, b) => a.startSec - b.startSec);
  for (const n of sorted) {
    if (n.durationSec < stepSec * VOCALBOX_HUM_MIN_GRID_NOTE_FRAC) continue;

    let startStep = snapHumTimeToStepIndex(n.startSec, stepSec);
    const endSec = n.startSec + n.durationSec;
    // Short hits → one step; longer holds follow sung length (rounded).
    let endStep =
      n.durationSec <= stepSec * 1.55
        ? startStep + 1
        : Math.max(startStep + 1, Math.round(endSec / stepSec));

    if (out.length > 0 && startStep < prevEndStep) {
      const prev = out[out.length - 1]!;
      const prevStart = Math.round(prev.startSec / stepSec);
      if (startStep > prevStart) {
        prev.durationSec = Math.max(stepSec, (startStep - prevStart) * stepSec);
        prevEndStep = startStep;
      } else if (Math.round(n.pitch) === prev.pitch) {
        prev.velocity = Math.max(prev.velocity, n.velocity);
        prev.durationSec = Math.max(prev.durationSec, (endStep - prevStart) * stepSec);
        prevEndStep = Math.max(
          prevEndStep,
          Math.round((prev.startSec + prev.durationSec) / stepSec),
        );
        continue;
      } else if (n.durationSec >= stepSec * 0.7) {
        const lenSteps = Math.max(1, endStep - startStep);
        startStep = prevStart + 1;
        endStep = startStep + lenSteps;
        prev.durationSec = Math.max(stepSec, (startStep - prevStart) * stepSec);
        prevEndStep = startStep;
      } else {
        const score = n.velocity + n.durationSec * 80;
        const prevScore = prev.velocity + prev.durationSec * 80;
        if (score >= prevScore) {
          prev.pitch = Math.round(n.pitch);
          prev.velocity = Math.max(prev.velocity, n.velocity);
          prev.durationSec = Math.max(prev.durationSec, (endStep - prevStart) * stepSec);
          prevEndStep = Math.max(
            prevEndStep,
            Math.round((prev.startSec + prev.durationSec) / stepSec),
          );
        }
        continue;
      }
    }

    out.push({
      pitch: Math.round(n.pitch),
      startSec: startStep * stepSec,
      durationSec: (endStep - startStep) * stepSec,
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
    });
    prevEndStep = endStep;
  }
  return out;
}

function humSustainEndStep(timeSec: number, stepSec: number, startStep: number): number {
  if (stepSec <= 0) return startStep + 1;
  const cur = Math.floor(Math.max(0, timeSec) / stepSec + 1e-6);
  return Math.max(startStep + 1, cur + 1);
}

export function correctHumCaptureLatency(
  notes: readonly TimedMonophonicNote[],
  latencySec: number = VOCALBOX_HUM_LATENCY_SEC,
): TimedMonophonicNote[] {
  const shift = Math.max(0, Math.min(0.2, latencySec));
  if (shift <= 0) return notes.map((n) => ({ ...n }));
  return notes
    .map((n) => ({
      ...n,
      startSec: Math.max(0, n.startSec - shift),
      durationSec: Math.max(0.04, n.durationSec),
    }))
    .filter((n) => n.durationSec >= 0.04);
}

export function rejectHumNotesNearMetroClicks(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  windowSec: number = VOCALBOX_HUM_CLICK_REJECT_WINDOW_SEC,
  maxClickDurSec: number = VOCALBOX_HUM_CLICK_REJECT_MAX_DUR_SEC,
): TimedMonophonicNote[] {
  const spb = 60 / Math.max(40, Math.min(240, bpm));
  const win = Math.max(0.02, Math.min(0.09, windowSec));
  const maxDur = Math.max(0.04, Math.min(0.22, maxClickDurSec));
  return notes.filter((n) => {
    if (!Number.isFinite(n.pitch)) return false;
    // Rimshot / click harmonics are short + high — never keep as melody.
    if (n.durationSec < 0.11 && n.pitch >= 78) return false;
    if (n.durationSec >= maxDur) return true;
    const phase = ((n.startSec % spb) + spb) % spb;
    const dist = Math.min(phase, spb - phase);
    return dist > win;
  });
}

export function isHumTimeOnMetroClick(
  timeSec: number,
  bpm: number,
  windowSec: number = VOCALBOX_HUM_CLICK_REJECT_WINDOW_SEC,
): boolean {
  const spb = 60 / Math.max(40, Math.min(240, bpm));
  const win = Math.max(0.02, Math.min(0.09, windowSec));
  const phase = ((timeSec % spb) + spb) % spb;
  return Math.min(phase, spb - phase) <= win;
}

export function applyHumPitchStickiness(
  notes: readonly TimedMonophonicNote[],
  stickinessSec: number = VOCALBOX_HUM_STICKINESS_SEC,
): TimedMonophonicNote[] {
  return defragVocalBoxHumNotes(notes, VOCALBOX_HUM_MIN_NOTE_SEC);
}

/** Place already-timed MIDI on the visual grid (starts/lengths already quantized). */
export function lockHumNotesToVisualGrid(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  bars: NeuralHumRollBarCount,
  quantize: NeuralHumRollQuantize,
): { rollNotes: NeuralHumRollNote[]; timedNotes: TimedMonophonicNote[] } {
  const q = clampHumCaptureQuantize(quantize);
  const stepSec = quantizeStepSec(bpm, q);
  const stepSlots = neuralHumQuantizeStepSlots(q);
  const maxSlot = totalRollSlots(bars);
  if (stepSec <= 0 || stepSlots <= 0) return { rollNotes: [], timedNotes: [] };

  type Cell = { pitch: number; velocity: number; lenSteps: number; score: number };
  const cells = new Map<number, Cell>();
  const minCellDur = stepSec * VOCALBOX_HUM_MIN_GRID_NOTE_FRAC;

  for (const n of notes) {
    if (n.durationSec < minCellDur) continue;
    // Trust pre-snapped times — don’t re-round in a way that walks notes around.
    const startStep = Math.max(0, Math.round(n.startSec / stepSec));
    const lenSteps = Math.max(1, Math.round(n.durationSec / stepSec));
    const pitch = Math.round(n.pitch);
    const velocity = Math.max(1, Math.min(127, Math.round(n.velocity)));
    const score = velocity + n.durationSec * 100;

    const existing = cells.get(startStep);
    if (!existing || score > existing.score) {
      cells.set(startStep, { pitch, velocity, lenSteps, score });
    } else if (existing.pitch === pitch) {
      existing.lenSteps = Math.max(existing.lenSteps, lenSteps);
      existing.velocity = Math.max(existing.velocity, velocity);
      existing.score = Math.max(existing.score, score);
    }
  }

  const ordered = [...cells.entries()].sort((a, b) => a[0] - b[0]);
  const timedNotes: TimedMonophonicNote[] = [];
  const rollNotes: NeuralHumRollNote[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const [startStep, cell] = ordered[i]!;
    const nextStep = ordered[i + 1]?.[0];
    let lenSteps = cell.lenSteps;
    if (nextStep != null && startStep + lenSteps > nextStep) {
      lenSteps = Math.max(1, nextStep - startStep);
    }
    const startSlot = startStep * stepSlots;
    if (startSlot >= maxSlot) continue;
    let lenSlots = lenSteps * stepSlots;
    lenSlots = Math.min(lenSlots, maxSlot - startSlot);
    if (lenSlots < stepSlots) lenSlots = stepSlots;

    timedNotes.push({
      pitch: cell.pitch,
      startSec: startStep * stepSec,
      durationSec: lenSteps * stepSec,
      velocity: cell.velocity,
    });
    rollNotes.push({
      id: newNeuralHumRollNoteId(),
      pitch: cell.pitch,
      startSlot,
      lenSlots,
      velocity: cell.velocity,
    });
  }

  return { timedNotes, rollNotes };
}

/** Glue touching same-pitch cells into one sustained note. */
export function mergeAdjacentSamePitchRollNotes(
  notes: readonly NeuralHumRollNote[],
  quantize: NeuralHumRollQuantize,
  bars: NeuralHumRollBarCount,
): NeuralHumRollNote[] {
  const q = clampHumCaptureQuantize(quantize);
  const step = neuralHumQuantizeStepSlots(q);
  const maxSlot = totalRollSlots(bars);
  if (step <= 0 || notes.length === 0) return notes.map((n) => ({ ...n }));

  const sorted = [...notes].sort(
    (a, b) => a.startSlot - b.startSlot || b.lenSlots - a.lenSlots,
  );
  const out: NeuralHumRollNote[] = [];

  for (const n of sorted) {
    const pitch = Math.round(n.pitch);
    const startSlot = Math.max(0, n.startSlot);
    let lenSlots = Math.max(step, n.lenSlots);
    if (startSlot >= maxSlot) continue;
    lenSlots = Math.min(lenSlots, maxSlot - startSlot);

    const prev = out[out.length - 1];
    if (prev && prev.pitch === pitch) {
      const prevEnd = prev.startSlot + prev.lenSlots;
      if (startSlot <= prevEnd) {
        prev.lenSlots = Math.max(prevEnd, startSlot + lenSlots) - prev.startSlot;
        prev.velocity = Math.max(prev.velocity, n.velocity);
        continue;
      }
    }

    out.push({
      id: n.id || newNeuralHumRollNoteId(),
      pitch,
      startSlot,
      lenSlots,
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
    });
  }

  return enforceMonophonicRollNotes(out);
}

export function paintScopePitchOnGridCell(opts: {
  existing: readonly NeuralHumRollNote[];
  timeSec: number;
  onsetSec?: number;
  pitch: number;
  velocity: number;
  bpm: number;
  bars: NeuralHumRollBarCount;
  quantize: NeuralHumRollQuantize;
  stepSec?: number;
}): NeuralHumRollNote[] {
  const q = clampHumCaptureQuantize(opts.quantize);
  const stepSec = opts.stepSec && opts.stepSec > 0 ? opts.stepSec : quantizeStepSec(opts.bpm, q);
  const stepSlots = neuralHumQuantizeStepSlots(q);
  const maxSlot = totalRollSlots(opts.bars);
  if (stepSec <= 0 || stepSlots <= 0) return [...opts.existing];

  const onsetSec = opts.onsetSec ?? opts.timeSec;
  const startStep = Math.max(0, snapHumTimeToStepIndex(onsetSec, stepSec));
  const endStep = humSustainEndStep(opts.timeSec, stepSec, startStep);
  let startSlot = snapNeuralHumRollSlot(startStep * stepSlots, q, maxSlot);
  startSlot = Math.round(startSlot / stepSlots) * stepSlots;
  if (startSlot >= maxSlot) return [...opts.existing];

  const pitch = Math.max(0, Math.min(127, Math.round(opts.pitch)));
  const velocity = Math.max(1, Math.min(127, Math.round(opts.velocity)));
  let lenSlots = Math.max(stepSlots, (endStep - startStep) * stepSlots);
  lenSlots = snapNeuralHumRollLen(lenSlots, q, maxSlot - startSlot);
  const endSlot = startSlot + lenSlots;

  const extending = opts.existing.find((n) => n.pitch === pitch && n.startSlot === startSlot);
  const id = extending?.id ?? newNeuralHumRollNoteId();

  const others = opts.existing.filter((n) => {
    if (extending && n.id === extending.id) return false;
    const nEnd = n.startSlot + n.lenSlots;
    return !(n.startSlot < endSlot && nEnd > startSlot);
  });

  return enforceMonophonicRollNotes(
    quantizeNeuralHumRollNotes(
      [
        ...others,
        {
          id,
          pitch,
          startSlot,
          lenSlots: extending ? Math.max(extending.lenSlots, lenSlots) : lenSlots,
          velocity: Math.max(velocity, extending?.velocity ?? 0),
        },
      ],
      q,
      opts.bars,
    ),
  );
}

export function finalizeLiveHumRollNotes(opts: {
  liveNotes: readonly NeuralHumRollNote[];
  lock: NeuralHumKeyLockSettings;
  bpm: number;
  bars: NeuralHumRollBarCount;
  quantize: NeuralHumRollQuantize;
}): {
  rollNotes: NeuralHumRollNote[];
  timedNotes: TimedMonophonicNote[];
  effectiveKeyRoot: number;
  effectiveScaleId: NeuralHumScaleId;
} {
  const quantize = clampHumCaptureQuantize(opts.quantize);
  const step = neuralHumQuantizeStepSlots(quantize);
  const maxSlot = totalRollSlots(opts.bars);
  const keyRoot = opts.lock.keyRoot;
  const scaleId = opts.lock.scaleId;

  let rollNotes = opts.liveNotes
    .map((n) => {
      const startSlot = Math.max(
        0,
        Math.min(maxSlot - step, Math.round(n.startSlot / step) * step),
      );
      const end = Math.round((n.startSlot + n.lenSlots) / step) * step;
      let pitch = Math.max(0, Math.min(127, Math.round(n.pitch)));
      if (opts.lock.mode !== 'off') {
        pitch = snapMidiToNeuralHumScale(pitch, keyRoot, scaleId);
      }
      return {
        ...n,
        startSlot,
        lenSlots: Math.max(step, Math.min(maxSlot - startSlot, end - startSlot)),
        pitch,
        velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
      };
    })
    .filter((n) => n.startSlot < maxSlot && n.lenSlots >= step);

  rollNotes = quantizeNeuralHumRollNotes(rollNotes, quantize, opts.bars);
  rollNotes = enforceMonophonicRollNotes(rollNotes);

  const slotStep = Math.max(1, step);
  const gridStepSec = quantizeStepSec(opts.bpm, quantize);
  const timedNotes = rollNotes.map((n) => ({
    pitch: n.pitch,
    startSec: (n.startSlot / slotStep) * gridStepSec,
    durationSec: (n.lenSlots / slotStep) * gridStepSec,
    velocity: n.velocity,
  }));

  return {
    rollNotes,
    timedNotes,
    effectiveKeyRoot: keyRoot,
    effectiveScaleId: scaleId,
  };
}

export function fillHumRollGapsFromOffline(
  liveRoll: readonly NeuralHumRollNote[],
  offlineRoll: readonly NeuralHumRollNote[],
  quantize: NeuralHumRollQuantize,
  bars: NeuralHumRollBarCount,
): NeuralHumRollNote[] {
  const step = neuralHumQuantizeStepSlots(clampHumCaptureQuantize(quantize));
  const occupied = new Set<number>();
  for (const n of liveRoll) {
    const end = n.startSlot + n.lenSlots;
    for (let s = n.startSlot; s < end; s += step) occupied.add(s);
  }

  const extras: NeuralHumRollNote[] = [];
  for (const n of offlineRoll) {
    const end = n.startSlot + n.lenSlots;
    let hitsLive = false;
    for (let s = n.startSlot; s < end; s += step) {
      if (occupied.has(s)) {
        hitsLive = true;
        break;
      }
    }
    if (hitsLive) continue;
    extras.push({ ...n, id: newNeuralHumRollNoteId() });
    for (let s = n.startSlot; s < end; s += step) occupied.add(s);
  }

  return enforceMonophonicRollNotes(
    quantizeNeuralHumRollNotes([...liveRoll, ...extras], quantize, bars),
  );
}

/** Prefer held tones; only clear doubles / same-pitch stutter merge. */
const HUM_CAPTURE_MONO_OPTS = {
  stutterGapSec: 0.065,
  simultaneousSec: 0.025,
} as const;

/**
 * Mic MIDI → piano roll (singer model).
 * Hold until the mouth stops or the pitch changes → optional key lock → grid.
 */
export function lockVocalBoxHumCapture(opts: {
  rawNotes: readonly TimedMonophonicNote[];
  lock: NeuralHumKeyLockSettings;
  bpm: number;
  bars: NeuralHumRollBarCount;
  quantize: NeuralHumRollQuantize;
  latencySec?: number;
  stickinessSec?: number;
  liveGridNotes?: readonly NeuralHumRollNote[];
}): VocalBoxHumLockResult {
  const { rawNotes, lock, bpm, bars } = opts;
  const quantize = clampHumCaptureQuantize(opts.quantize);
  const latencySec = opts.latencySec ?? VOCALBOX_HUM_LATENCY_SEC;
  const stepSec = quantizeStepSec(bpm, quantize);

  let notes = correctHumCaptureLatency(rawNotes, latencySec);
  notes = rejectHumNotesNearMetroClicks(notes, bpm);
  const minNoteSec = Math.max(
    VOCALBOX_HUM_MIN_NOTE_SEC,
    stepSec * VOCALBOX_HUM_MIN_GRID_NOTE_FRAC,
  );
  notes = rejectHumBlipNotes(notes, stepSec, minNoteSec);
  notes = rejectHumPitchGlideScraps(notes);
  notes = defragVocalBoxHumNotes(notes, minNoteSec);
  notes = enforceMonophonicHumNotes(
    notes,
    Math.min(0.045, stepSec * 0.24),
    HUM_CAPTURE_MONO_OPTS,
  );

  // Key lock first so scale snap (G major, etc.) owns pitch before grid lock.
  const processed = processNeuralHumMelody(notes, lock, HUM_CAPTURE_MONO_OPTS);
  let locked = processed.notes;

  if (lock.mode !== 'off') {
    locked = locked.map((n) => ({
      ...n,
      pitch: snapMidiToNeuralHumScale(
        n.pitch,
        processed.effectiveKeyRoot,
        processed.effectiveScaleId,
      ),
    }));
    locked = defragVocalBoxHumNotes(locked, minNoteSec);
    locked = enforceMonophonicHumNotes(
      locked,
      Math.min(0.045, stepSec * 0.24),
      HUM_CAPTURE_MONO_OPTS,
    );
  }

  const nudge = humFineGridNudge(locked, stepSec);
  if (nudge !== 0) {
    locked = locked.map((n) => ({
      ...n,
      startSec: Math.max(0, n.startSec + nudge),
    }));
  }
  locked = snapTimedNotesToQuantizeCells(locked, bpm, quantize);
  const fromAudio = lockHumNotesToVisualGrid(locked, bpm, bars, quantize);
  let rollNotes = quantizeNeuralHumRollNotes(fromAudio.rollNotes, quantize, bars);
  rollNotes = enforceMonophonicRollNotes(rollNotes);

  const slotStep = neuralHumQuantizeStepSlots(quantize);
  const gridStepSec = quantizeStepSec(bpm, quantize);
  const timedNotes = rollNotes.map((n) => ({
    pitch: n.pitch,
    startSec: (n.startSlot / slotStep) * gridStepSec,
    durationSec: (n.lenSlots / slotStep) * gridStepSec,
    velocity: n.velocity,
  }));

  return {
    rollNotes,
    timedNotes,
    effectiveKeyRoot: processed.effectiveKeyRoot,
    effectiveScaleId: processed.effectiveScaleId,
    noteCount: rollNotes.length,
  };
}
