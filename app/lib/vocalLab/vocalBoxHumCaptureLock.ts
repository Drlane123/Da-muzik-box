/**
 * Hum → MIDI (ACE Studio + Dubler style):
 *
 * ACE: vocal/hum → discrete MIDI notes on a piano-roll with Grid + Snap.
 * Dubler: pitch scope shows the note; key lock restricts the scale.
 *
 * Rule we follow:
 *   - Scope / pitch detect chooses WHICH note (key-snapped)
 *   - Visual quantize grid chooses WHEN (100% snap — one cell ownership)
 *   - Stickiness prevents extra flickering keys
 *   - Scope does not invent off-grid MIDI; grid is the authority for time
 */
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';
import type { MonophonicPitchExtractOpts } from '@/app/lib/studio/audioToMidiNotes';
import type { BasicPitchTranscribeOpts } from '@/app/lib/studio/basicPitchTranscribe';
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
  secPerBar,
  totalRollSlots,
  type NeuralHumRollBarCount,
  type NeuralHumRollNote,
  type NeuralHumRollQuantize,
} from '@/app/lib/vocalLab/neuralHumMelodyRoll';

export const VOCALBOX_HUM_FMIN_HZ = 80;
export const VOCALBOX_HUM_FMAX_HZ = 1100;

/** Pitch scope / MIDI filter gates — compressor lifts quiet hums into the detector. */
export const VOCALBOX_HUM_LIVE_OPTS = {
  minConfidence: 0.14,
  minRms: 0.0028,
  silenceHoldFrames: 2,
  fMinHz: 50,
  fMaxHz: 1200,
} as const;

/** Offline detect — MIDI-only hum (ACE: acapella / no bleed). */
export const VOCALBOX_HUM_TRANSCRIBE_OPTS: BasicPitchTranscribeOpts = {
  onsetThreshold: 0.32,
  frameThreshold: 0.22,
  minNoteFrames: 3,
  minNoteSec: 0.04,
};

export const VOCALBOX_HUM_EXTRACT_OPTS: MonophonicPitchExtractOpts = {
  fMinHz: 50,
  fMaxHz: VOCALBOX_HUM_FMAX_HZ,
  minRms: 0.0016,
  minPitchClarity: 0.12,
  pitchRunTolerance: 0.55,
  maxVoicedGapFrames: 4,
};

export const VOCALBOX_HUM_LATENCY_SEC = 0.04;
/** First onset paints immediately; pitch *changes* must hold this long. */
export const VOCALBOX_HUM_STICKINESS_SEC = 0.012;
/**
 * Fast 1/16 lines need a short switch — 90ms was swallowing notes under ~120 BPM.
 * (~1/3 of a 16th at 120 BPM)
 */
export const VOCALBOX_HUM_PITCH_SWITCH_SEC = 0.028;
/** Analyser / ACF lag vs aimed click (graph clock). */
export const VOCALBOX_HUM_LIVE_DETECT_LATENCY_SEC = 0.04;
/**
 * Reject short onsets that land on the quarter-note click grid (metro bleed).
 * Real hummed notes are longer / not centered on the rimshot.
 */
/** Wider than a rimshot so bleed into the mic / ACF window is dropped. */
export const VOCALBOX_HUM_CLICK_REJECT_WINDOW_SEC = 0.085;
export const VOCALBOX_HUM_CLICK_REJECT_MAX_DUR_SEC = 0.18;

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

/** Hard snap to nearest grid step — 1/16 lock (no soft in-between). */
export function snapHumTimeToStepIndex(timeSec: number, stepSec: number): number {
  if (stepSec <= 0) return 0;
  return Math.max(0, Math.round(Math.max(0, timeSec) / stepSec));
}

/** Sustain end step — keep covering the cell you're still holding. */
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
    .map((n) => {
      const startSec = Math.max(0, n.startSec - shift);
      const end = Math.max(startSec + 0.04, n.startSec + n.durationSec - shift * 0.15);
      return { ...n, startSec, durationSec: Math.max(0.04, end - startSec) };
    })
    .filter((n) => n.durationSec >= 0.04);
}

/**
 * Drop click-bleed “notes”: short blips sitting on the BPM quarter grid
 * (metronome rimshots leaking into the mic / scope).
 */
export function rejectHumNotesNearMetroClicks(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  windowSec: number = VOCALBOX_HUM_CLICK_REJECT_WINDOW_SEC,
  maxClickDurSec: number = VOCALBOX_HUM_CLICK_REJECT_MAX_DUR_SEC,
): TimedMonophonicNote[] {
  const spb = 60 / Math.max(40, Math.min(240, bpm));
  const win = Math.max(0.02, Math.min(0.09, windowSec));
  const maxDur = Math.max(0.06, Math.min(0.22, maxClickDurSec));
  return notes.filter((n) => {
    if (n.durationSec >= maxDur) return true;
    const phase = ((n.startSec % spb) + spb) % spb;
    const dist = Math.min(phase, spb - phase);
    return dist > win;
  });
}

/** True when musical time is on a quarter click (skip live scope paint). */
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

/** Stickiness — absorb pitch flickers so extra keys don’t appear. */
export function applyHumPitchStickiness(
  notes: readonly TimedMonophonicNote[],
  stickinessSec: number = VOCALBOX_HUM_STICKINESS_SEC,
): TimedMonophonicNote[] {
  if (notes.length === 0) return [];
  const stick = Math.max(0.012, Math.min(0.28, stickinessSec));
  const sorted = [...notes].sort((a, b) => a.startSec - b.startSec || b.velocity - a.velocity);
  const out: TimedMonophonicNote[] = [];

  for (const n of sorted) {
    if (n.durationSec < 0.04) continue;
    const pitch = Math.round(n.pitch);
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ pitch, startSec: n.startSec, durationSec: n.durationSec, velocity: n.velocity });
      continue;
    }

    const prevEnd = prev.startSec + prev.durationSec;
    const gap = n.startSec - prevEnd;
    const pitchDelta = Math.abs(pitch - prev.pitch);

    if (n.startSec < prev.startSec + stick || (gap < stick * 0.9 && pitchDelta <= 2)) {
      if (pitch === prev.pitch || n.durationSec * n.velocity <= prev.durationSec * prev.velocity) {
        prev.durationSec = Math.max(prev.durationSec, n.startSec + n.durationSec - prev.startSec);
        prev.velocity = Math.max(prev.velocity, n.velocity);
        continue;
      }
      if (n.startSec > prev.startSec + stick * 0.7) {
        prev.durationSec = Math.max(0.05, n.startSec - prev.startSec);
        out.push({ pitch, startSec: n.startSec, durationSec: n.durationSec, velocity: n.velocity });
        continue;
      }
      prev.durationSec = Math.max(prev.durationSec, n.startSec + n.durationSec - prev.startSec);
      prev.velocity = Math.max(prev.velocity, n.velocity);
      continue;
    }

    if (n.startSec < prevEnd) {
      prev.durationSec = Math.max(0.05, n.startSec - prev.startSec);
    }
    out.push({ pitch, startSec: n.startSec, durationSec: n.durationSec, velocity: n.velocity });
  }
  return out;
}

/**
 * ACE Studio Grid+Snap: pitch chooses the note, visual quantize grid owns time.
 * Exactly one MIDI note per occupied grid cell — notes sit on snap lines.
 */
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

  for (const n of notes) {
    if (n.durationSec < 0.035) continue;
    const startStep = Math.max(0, snapHumTimeToStepIndex(n.startSec, stepSec));
    const endStep = Math.max(
      startStep + 1,
      snapHumTimeToStepIndex(n.startSec + n.durationSec, stepSec),
    );
    // Always keep hold length — short blips stay 1 step; long hums span multiple 1/16s.
    const lenSteps = Math.max(1, endStep - startStep);
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

  return {
    timedNotes,
    rollNotes: enforceMonophonicRollNotes(rollNotes),
  };
}

/**
 * Place / sustain a scope-locked pitch on the visual grid.
 * Same pitch while holding extends one MIDI note from onset → current time.
 * Pass `stepSec` from the metro `spb` grid so paint never drifts from the click tempo.
 */
export function paintScopePitchOnGridCell(opts: {
  existing: readonly NeuralHumRollNote[];
  timeSec: number;
  /** Musical onset of this sustained pitch (defaults to timeSec). */
  onsetSec?: number;
  pitch: number;
  velocity: number;
  bpm: number;
  bars: NeuralHumRollBarCount;
  quantize: NeuralHumRollQuantize;
  /** Metro grid step (e.g. spb/4 for 1/16) — must match scheduled clicks. */
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
  const startSlot = startStep * stepSlots;
  if (startSlot >= maxSlot) return [...opts.existing];

  const pitch = Math.max(0, Math.min(127, Math.round(opts.pitch)));
  const velocity = Math.max(1, Math.min(127, Math.round(opts.velocity)));
  let lenSlots = Math.max(stepSlots, (endStep - startStep) * stepSlots);
  lenSlots = Math.min(lenSlots, maxSlot - startSlot);
  if (lenSlots < stepSlots) lenSlots = stepSlots;
  const endSlot = startSlot + lenSlots;

  const extending = opts.existing.find((n) => n.pitch === pitch && n.startSlot === startSlot);
  const id = extending?.id ?? newNeuralHumRollNoteId();

  const others = opts.existing.filter((n) => {
    if (extending && n.id === extending.id) return false;
    const nEnd = n.startSlot + n.lenSlots;
    return !(n.startSlot < endSlot && nEnd > startSlot);
  });

  return enforceMonophonicRollNotes([
    ...others,
    {
      id,
      pitch,
      startSlot,
      lenSlots: extending ? Math.max(extending.lenSlots, lenSlots) : lenSlots,
      velocity: Math.max(velocity, extending?.velocity ?? 0),
    },
  ]);
}

export function lockVocalBoxHumCapture(opts: {
  rawNotes: readonly TimedMonophonicNote[];
  lock: NeuralHumKeyLockSettings;
  bpm: number;
  bars: NeuralHumRollBarCount;
  quantize: NeuralHumRollQuantize;
  latencySec?: number;
  stickinessSec?: number;
  /** Optional live-painted roll notes (scope→grid). Prefer these cells when present. */
  liveGridNotes?: readonly NeuralHumRollNote[];
}): VocalBoxHumLockResult {
  const { rawNotes, lock, bpm, bars } = opts;
  const quantize = clampHumCaptureQuantize(opts.quantize);
  const latencySec = opts.latencySec ?? VOCALBOX_HUM_LATENCY_SEC;
  const stickinessSec = opts.stickinessSec ?? VOCALBOX_HUM_STICKINESS_SEC;

  let notes = correctHumCaptureLatency(rawNotes, latencySec);
  // Do NOT reject on-beat melody notes as “metro clicks” — that was dropping sung 1/16s.
  notes = trimShortNeuralHumNotes(notes, 0.035);
  notes = applyHumPitchStickiness(notes, stickinessSec);
  notes = enforceMonophonicHumNotes(notes, 0.03);

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
    locked = applyHumPitchStickiness(locked, stickinessSec * 0.8);
    locked = enforceMonophonicHumNotes(locked, 0.04);
  }

  // ACE: snap everything onto the visual grid.
  const fromAudio = lockHumNotesToVisualGrid(locked, bpm, bars, quantize);

  // Live scope→grid is the timing authority (WYSIWYG). Audio fill only when live empty.
  let rollNotes = fromAudio.rollNotes;
  let timedNotes = fromAudio.timedNotes;
  // Live notes already filtered → MIDI on the roll — keep WYSIWYG pitches (no hard re-snap).
  if (opts.liveGridNotes && opts.liveGridNotes.length > 0) {
    const step = neuralHumQuantizeStepSlots(quantize);
    const maxSlot = totalRollSlots(bars);
    const liveSnapped = enforceMonophonicRollNotes(
      opts.liveGridNotes.map((n) => {
        const startSlot = Math.max(
          0,
          Math.min(maxSlot - step, Math.round(n.startSlot / step) * step),
        );
        const end = Math.round((n.startSlot + n.lenSlots) / step) * step;
        return {
          ...n,
          startSlot,
          lenSlots: Math.max(step, Math.min(maxSlot - startSlot, end - startSlot)),
          pitch: Math.max(0, Math.min(127, Math.round(n.pitch))),
        };
      }),
    );
    rollNotes = liveSnapped;
    const stepSec = quantizeStepSec(bpm, quantize);
    const slotStep = neuralHumQuantizeStepSlots(quantize);
    timedNotes = rollNotes.map((n) => ({
      pitch: n.pitch,
      startSec: (n.startSlot / slotStep) * stepSec,
      durationSec: (n.lenSlots / slotStep) * stepSec,
      velocity: n.velocity,
    }));
  }

  return {
    rollNotes,
    timedNotes,
    effectiveKeyRoot: processed.effectiveKeyRoot,
    effectiveScaleId: processed.effectiveScaleId,
    noteCount: rollNotes.length,
  };
}
