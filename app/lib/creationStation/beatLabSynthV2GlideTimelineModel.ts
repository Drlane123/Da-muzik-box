import { beatLabStepColToQuarterCol } from '@/app/lib/creationStation/beatLabChordPianoRollAdapter';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import { beatLabSynthV2MonophonicLaneNotes } from '@/app/lib/creationStation/beatLabSynthV2BasslineGenerator';
import {
  beatLabSynthV2ChordGlideSourceMidi,
  beatLabSynthV2GlideSeconds,
  beatLabSynthV2LegatoSourceMidi,
  type BeatLabSynthGlideDivision,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';

export type BeatLabGlideVisKind = 'mono' | 'legato' | 'chord' | 'intra' | 'slide';

export type BeatLabGlideVisSegment = {
  id: string;
  col0: number;
  col1: number;
  fromMidi: number;
  toMidi: number;
  kind: BeatLabGlideVisKind;
  /** Quantized steps in the glide ramp (1 = smooth). */
  stutterSteps: number;
  barIdx: number;
  enabled: boolean;
};

export type BeatLabGlideTimelineModel = {
  totalBars: number;
  stepsPerBar: number;
  segments: BeatLabGlideVisSegment[];
  noteSpans: { col0: number; col1: number; midi: number }[];
};

function stepColToBarIdx(
  stepCol: number,
  subdiv: number,
  beatsPerBar: number,
  colsPerBar: number,
): number {
  const qCol = beatLabStepColToQuarterCol(stepCol, subdiv, beatsPerBar, colsPerBar);
  return Math.max(0, Math.floor(qCol / Math.max(1, colsPerBar)));
}

function stutterStepCount(glideSec: number, stutterSec: number): number {
  if (stutterSec <= 0.0005) return 1;
  return Math.max(1, Math.min(32, Math.ceil(glideSec / stutterSec)));
}

function isBarGlideEnabled(mask: number, barIdx: number): boolean {
  if (barIdx < 0 || barIdx > 31) return true;
  return (mask & (1 << barIdx)) !== 0;
}

function isBarSlideEnabled(mask: number, barIdx: number): boolean {
  if (barIdx < 0 || barIdx > 31) return true;
  return (mask & (1 << barIdx)) !== 0;
}

/** Preview glide arcs for the GLIDE FX layout graph (does not mutate transport glide state). */
export function buildBeatLabSynthV2GlideTimelineModel(opts: {
  notes: readonly BeatLabMidiNote[];
  lane: number;
  voice: BeatLabBassSynthVoiceParams;
  patternCols: number;
  subdiv: number;
  bpm: number;
  beatsPerBar: number;
  colsPerBar: number;
  chordRail?: BeatLabImportedChordRail | null;
  midiAtNote: (n: BeatLabMidiNote) => number;
  /** Only include notes / segments in this step-column window (first N bars UI). */
  maxStepCol?: number;
}): BeatLabGlideTimelineModel {
  const {
    notes,
    lane,
    voice,
    patternCols,
    subdiv,
    bpm,
    beatsPerBar,
    colsPerBar,
    chordRail,
    midiAtNote,
    maxStepCol: maxStepColIn,
  } = opts;

  const stepsPerBar = Math.max(1, Math.round(beatsPerBar * subdiv));
  const maxStepCol =
    maxStepColIn != null
      ? Math.max(1, Math.floor(maxStepColIn))
      : Math.max(1, Math.ceil(patternCols));
  const totalBars = Math.max(1, Math.ceil(Math.min(patternCols, maxStepCol) / stepsPerBar));
  const barMask = voice.glideBarMask ?? 0xffffffff;
  const slideBarMask = voice.slideBarMask ?? 0xffffffff;
  const glideSec = beatLabSynthV2GlideSeconds(voice, bpm);
  const stutterSec =
    voice.glideSync === true
      ? beatLabSynthV2GlideSeconds(
          { ...voice, glideMs: 0, glideSync: true, glideDivision: voice.glideDivision ?? '1/16' },
          bpm,
        )
      : Math.max(0.008, glideSec / 4);
  const style = voice.glideStyle ?? 'smooth';
  const mode = voice.glideMode ?? 'mono';

  const laneNotes = beatLabSynthV2MonophonicLaneNotes(notes, lane, midiAtNote, maxStepCol);

  const noteSpans = laneNotes
    .map((n, i) => {
      const nextCol = i + 1 < laneNotes.length ? laneNotes[i + 1]!.col : Number.POSITIVE_INFINITY;
      // Monophonic display: stop note at next note-on to avoid visual overlap.
      const rawEnd = n.col + Math.max(1, n.len);
      const col1 = Math.max(n.col + 1, Math.min(rawEnd, nextCol, maxStepCol));
      return {
        col0: n.col,
        col1,
        midi: midiAtNote(n),
      };
    })
    .flatMap((n) => {
    // Keep each visual note span contained to a single bar segment.
    const spans: { col0: number; col1: number; midi: number }[] = [];
    let c0 = n.col0;
    const c1 = Math.min(maxStepCol, n.col1);
    while (c0 < c1) {
      const b = Math.floor(c0 / stepsPerBar);
      const barEnd = (b + 1) * stepsPerBar;
      const segEnd = Math.min(c1, barEnd);
      if (segEnd > c0) spans.push({ col0: c0, col1: segEnd, midi: n.midi });
      c0 = segEnd;
    }
      return spans;
    });

  const segments: BeatLabGlideVisSegment[] = [];
  const lastByLane = new Map<number, { midi: number; col: number }>();
  let segId = 0;

  const pushSeg = (
    col0: number,
    col1: number,
    fromMidi: number,
    toMidi: number,
    kind: BeatLabGlideVisKind,
    barIdx: number,
    enabled: boolean,
  ) => {
    if (fromMidi === toMidi || glideSec <= 0.0005) return;
    const barStart = barIdx * stepsPerBar;
    const barEnd = barStart + stepsPerBar;
    const c0 = Math.max(col0, barStart);
    const c1 = Math.min(col1, barEnd);
    if (c1 <= c0) return;
    const steps =
      style === 'stutter' ? stutterStepCount(glideSec, stutterSec) : 1;
    segments.push({
      id: `g${segId++}`,
      col0: c0,
      col1: c1,
      fromMidi,
      toMidi,
      kind,
      stutterSteps: steps,
      barIdx,
      enabled,
    });
  };

  for (let ni = 0; ni < laneNotes.length; ni += 1) {
    const n = laneNotes[ni]!;
    const midi = midiAtNote(n);
    const barIdx = stepColToBarIdx(n.col, subdiv, beatsPerBar, colsPerBar);
    const enabled = isBarGlideEnabled(barMask, barIdx);
    const nextCol = ni + 1 < laneNotes.length ? laneNotes[ni + 1]!.col : Number.POSITIVE_INFINITY;
    const noteEnd = Math.max(n.col + 1, Math.min(n.col + Math.max(1, n.len), nextCol, maxStepCol));
    const noteLenCols = Math.max(1, noteEnd - n.col);
    const glideCols = Math.max(
      1,
      Math.round((glideSec / ((60 / Math.max(1, bpm)) / subdiv)) * 0.85),
    );
    const col1 = Math.max(n.col + 1, Math.min(n.col + glideCols, noteEnd));

    let fromMidi: number | undefined;

    if (mode === 'legato') {
      fromMidi = beatLabSynthV2LegatoSourceMidi(notes, lane, n.col, midiAtNote);
      if (fromMidi != null) {
        pushSeg(n.col, col1, fromMidi, midi, 'legato', barIdx, enabled);
      }
    } else if (mode === 'chord' && chordRail) {
      fromMidi = beatLabSynthV2ChordGlideSourceMidi(
        notes,
        lane,
        n.col,
        midi,
        chordRail,
        subdiv,
        beatsPerBar,
        colsPerBar,
      );
      if (fromMidi != null && enabled) {
        pushSeg(n.col, col1, fromMidi, midi, 'chord', barIdx, true);
      } else {
        const prev = lastByLane.get(lane);
        if (prev && prev.midi !== midi) {
          pushSeg(n.col, col1, prev.midi, midi, 'mono', barIdx, enabled);
        }
      }
    } else if (mode === 'mono') {
      const prev = lastByLane.get(lane);
      if (prev && prev.midi !== midi) {
        pushSeg(n.col, col1, prev.midi, midi, 'mono', barIdx, enabled);
      }
    }

    lastByLane.set(lane, { midi, col: n.col });

    if (voice.glideIntraNote === true && voice.glideSync === true && glideSec > 0.0005) {
      let phaseCol = Math.min(noteEnd, n.col + glideCols);
      const stepCols = Math.max(
        1,
        Math.round(
          (stutterSec / ((60 / Math.max(1, bpm)) / subdiv)) * 0.9,
        ),
      );
      let bounce = 0;
      while (phaseCol + stepCols < noteEnd && bounce < 24) {
        const dipMidi = midi - 1.25;
        pushSeg(phaseCol, phaseCol + stepCols, midi, dipMidi, 'intra', barIdx, enabled);
        pushSeg(phaseCol + stepCols, phaseCol + stepCols * 2, dipMidi, midi, 'intra', barIdx, enabled);
        phaseCol += stepCols * 2;
        bounce += 1;
      }
    }

    if (voice.slideMotionEnabled === true) {
      const frac = Math.max(0.08, Math.min(0.8, voice.slideMotionFrac ?? 0.2));
      const slideCols = Math.max(1, Math.round(noteLenCols * frac));
      const semi = Math.max(1, Math.min(12, Math.round(voice.slideMotionSemi ?? 2)));
      const signed = (voice.slideMotionDir ?? 'up') === 'down' ? -semi : semi;
      const at = voice.slideMotionAt ?? 'tail';
      const slideEnabled = isBarSlideEnabled(slideBarMask, barIdx);
      if (at === 'head' || at === 'both') {
        pushSeg(n.col, n.col + slideCols, midi, midi + signed, 'slide', barIdx, slideEnabled);
      }
      if (at === 'tail' || at === 'both') {
        pushSeg(noteEnd - slideCols, noteEnd, midi, midi + signed, 'slide', barIdx, slideEnabled);
      }
    }
  }

  return { totalBars, stepsPerBar, segments, noteSpans };
}

export function beatLabSynthV2GlideDivisionLabel(div: BeatLabSynthGlideDivision): string {
  return div;
}
