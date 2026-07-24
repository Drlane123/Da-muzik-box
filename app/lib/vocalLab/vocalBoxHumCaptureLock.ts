/**
 * VocalBox Hum Melody — audio → MIDI (simple).
 *
 * Rec: mic + pre-count; scope reads pitch only (no live roll paint).
 * Analyze: pitch-track the recorded take → timed MIDI → snap onto quantize grid.
 * Optional key lock after. Just what came through the mic.
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
  minRms: 0.0022,
  silenceHoldFrames: 2,
  fMinHz: VOCALBOX_HUM_FMIN_HZ,
  fMaxHz: VOCALBOX_HUM_FMAX_HZ,
} as const;

/** Kept for callers; live roll paint is disabled. */
export const VOCALBOX_HUM_PITCH_SWITCH_SEC = 0.028;
export const VOCALBOX_HUM_LIVE_ONSET_HOLD_SEC = 0.028;
export const VOCALBOX_HUM_LIVE_DETECT_LATENCY_SEC = 0.035;

/* ── Audio → MIDI ──────────────────────────────────────────────────────── */

export const VOCALBOX_HUM_TRANSCRIBE_OPTS: BasicPitchTranscribeOpts = {
  onsetThreshold: 0.32,
  frameThreshold: 0.2,
  minNoteFrames: 3,
  minNoteSec: 0.03,
};

/** Mic pitch track — a bit more open for soft / short lilts. */
export const VOCALBOX_HUM_EXTRACT_OPTS: MonophonicPitchExtractOpts = {
  fMinHz: VOCALBOX_HUM_FMIN_HZ,
  fMaxHz: VOCALBOX_HUM_FMAX_HZ,
  minRms: 0.00115,
  minPitchClarity: 0.085,
  pitchRunTolerance: 0.8,
  // ~100 ms — bridge tiny dropouts, not whole rests between notes.
  maxVoicedGapFrames: 9,
};

export const VOCALBOX_HUM_LATENCY_SEC = 0.04;
/** Same-pitch breath hole only — stop→start stays two notes. */
export const VOCALBOX_HUM_STICKINESS_SEC = 0.03;
/** Keep short real lilts (~⅛ of a 1/16). */
export const VOCALBOX_HUM_MIN_GRID_NOTE_FRAC = 0.12;
/** Short on-beat ghosts from speaker/metro bleed (rimshot), not real hums. */
export const VOCALBOX_HUM_CLICK_REJECT_WINDOW_SEC = 0.05;
export const VOCALBOX_HUM_CLICK_REJECT_MAX_DUR_SEC = 0.048;
export const VOCALBOX_HUM_MIN_NOTE_SEC = 0.022;
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
 * Drop only true glitches — not soft / short melody lilts.
 */
export function rejectHumBlipNotes(
  notes: readonly TimedMonophonicNote[],
  stepSec: number,
  minNoteSec: number = VOCALBOX_HUM_MIN_NOTE_SEC,
): TimedMonophonicNote[] {
  const minAbs = Math.max(
    0.018,
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
      if (n.durationSec < minAbs) return false;
      // Ultra-quiet single-frame noise only.
      if (n.durationSec < (stepSec > 0 ? stepSec * 0.15 : 0.03) && n.velocity < 16) return false;
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
  const minSec = Math.max(0.03, Math.min(0.2, minNoteSec));
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
 * True when the take is room noise / metro bleed only (no sustained hum).
 * Metro clicks are sparse peaks — median energy stays low.
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
  const med = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  // Quiet room + optional click spikes.
  if (p90 < 0.007) return true;
  if (med < 0.0032 && p90 < 0.04) return true;
  return false;
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
 * Snap to quantize line. Mic pitch runs a hair late — through mid-cell,
 * pull to the earlier step so hummed onsets lock with the click/grid.
 */
export function snapHumTimeToStepIndex(timeSec: number, stepSec: number): number {
  if (stepSec <= 0) return 0;
  const t = Math.max(0, timeSec);
  const exact = t / stepSec;
  const floor = Math.floor(exact + 1e-9);
  const frac = exact - floor;
  if (frac <= 0.58) return Math.max(0, floor);
  return floor + 1;
}

export function snapHumTimeToGridSec(timeSec: number, stepSec: number): number {
  return snapHumTimeToStepIndex(timeSec, stepSec) * stepSec;
}

/** Whole-take nudge — onsets lock as a phrase to the nearest quantize lines. */
export function humFineGridNudge(
  notes: readonly TimedMonophonicNote[],
  stepSec: number,
): number {
  if (notes.length === 0 || !(stepSec > 0)) return 0;
  const maxNudge = stepSec * 0.49;
  const step = Math.min(0.001, stepSec * 0.02);
  let best = 0;
  let bestScore = Infinity;
  for (let n = -maxNudge; n <= maxNudge + 1e-9; n += step) {
    let score = 0;
    for (const note of notes) {
      const t = Math.max(0, note.startSec + n);
      // Score vs early-biased grid (same as final snap).
      const nearest = snapHumTimeToStepIndex(t, stepSec) * stepSec;
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
  return Math.abs(best) < 0.0008 ? 0 : best;
}

/**
 * Hard-lock each note onto quantize cells (starts + lengths = whole steps).
 * If a long note would swallow the next onset, trim the long note — don’t drop lilts.
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
    // Short rhythmic hits → one cell; longer holds round to whole steps.
    let endStep =
      n.durationSec <= stepSec * 1.35
        ? startStep + 1
        : Math.max(startStep + 1, Math.round(endSec / stepSec));

    if (out.length > 0 && startStep < prevEndStep) {
      const prev = out[out.length - 1]!;
      const prevStart = Math.round(prev.startSec / stepSec);
      if (startStep > prevStart) {
        prev.durationSec = (startStep - prevStart) * stepSec;
        prevEndStep = startStep;
      } else {
        if (n.velocity >= prev.velocity) {
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
      durationSec: Math.max(0.02, n.durationSec),
    }))
    .filter((n) => n.durationSec >= 0.02);
}

export function rejectHumNotesNearMetroClicks(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  windowSec: number = VOCALBOX_HUM_CLICK_REJECT_WINDOW_SEC,
  maxClickDurSec: number = VOCALBOX_HUM_CLICK_REJECT_MAX_DUR_SEC,
): TimedMonophonicNote[] {
  const spb = 60 / Math.max(40, Math.min(240, bpm));
  const win = Math.max(0.02, Math.min(0.09, windowSec));
  const maxDur = Math.max(0.025, Math.min(0.22, maxClickDurSec));
  return notes.filter((n) => {
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

/**
 * Mic MIDI → piano roll.
 * Light glitch trim → breath merge → optional key → hard snap to quantize.
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
  // Speaker/metro rimshots land on the beat as ultra-short “notes” — strip those only.
  notes = rejectHumNotesNearMetroClicks(notes, bpm);
  const minNoteSec = Math.max(VOCALBOX_HUM_MIN_NOTE_SEC, stepSec * VOCALBOX_HUM_MIN_GRID_NOTE_FRAC);
  notes = rejectHumBlipNotes(notes, stepSec, minNoteSec);
  notes = defragVocalBoxHumNotes(notes, minNoteSec);
  notes = enforceMonophonicHumNotes(notes, Math.min(0.035, stepSec * 0.2));

  const processed = processNeuralHumMelody(notes, lock);
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
    locked = enforceMonophonicHumNotes(locked, Math.min(0.035, stepSec * 0.2));
  }

  const nudge = humFineGridNudge(locked, stepSec);
  if (nudge !== 0) {
    locked = locked.map((n) => ({
      ...n,
      startSec: Math.max(0, n.startSec + nudge),
    }));
  }
  locked = snapTimedNotesToQuantizeCells(locked, bpm, quantize);
  // Second pass: after collision trims, re-snap so every start/length is exact grid.
  locked = locked.map((n) => {
    const startStep = snapHumTimeToStepIndex(n.startSec, stepSec);
    const endStep = Math.max(
      startStep + 1,
      Math.round((n.startSec + n.durationSec) / stepSec),
    );
    return {
      ...n,
      startSec: startStep * stepSec,
      durationSec: (endStep - startStep) * stepSec,
    };
  });
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
