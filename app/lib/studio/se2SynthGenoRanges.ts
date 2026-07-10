/**
 * Synth Geno — 61-key keyboard register map (single source of truth).
 *
 * Chords comp around Middle C (warm Rhodes / piano zone).
 * Bass stays left-hand (C2). B1 arp / melody lead sits C4–C6 (hook at C5).
 */

import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoBarChordSpec, GenoBarChopQuant } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  genoBarChopStepBeats,
} from '@/app/lib/studio/se2SynthGenoChordEngine';

function genoSnapBeatForFiller(beat: number, snapBeats: number): number {
  if (snapBeats <= 0) return beat;
  return Math.round(beat / snapBeats) * snapBeats;
}

export const GENO_KEYBOARD_61_LO = 36;
export const GENO_KEYBOARD_61_HI = 96;
export const GENO_KEYBOARD_MIDDLE_C = 60;

/** Bass — left hand C2–C3 (unchanged — correct vs chords). */
export const GENO_BASS_MIDI_MIN = 28;
export const GENO_BASS_MIDI_MAX = 48;
export const GENO_BASS_ROOT_OCTAVE_MIDI = 36;
export const GENO_BASS_REF_MIDI = GENO_BASS_ROOT_OCTAVE_MIDI;

/** Chords — comp C4–B5 (60–83) so 5–7 note stacks stay visible and separated. */
export const GENO_CHORD_MIDI_MIN = 60;
export const GENO_CHORD_MIDI_MAX = 83;
export const GENO_CHORD_ROOT_OCTAVE_MIDI = 60;
export const GENO_CHORD_CENTER_MIDI = 64;
export const GENO_CHORD_REF_MIDI = GENO_CHORD_ROOT_OCTAVE_MIDI;

/** Melody — Geno Build 1 live arp / lead hook C4–C6 (one octave below old C5–C7). */
export const GENO_MELODY_MIDI_MIN = 60;
export const GENO_MELODY_MIDI_MAX = 84;
export const GENO_MELODY_REF_MIDI = 72;

/** B2 Chord Generator melody — one octave lower (C4–C6, hook at C5). */
export const GENO_PLUGIN_MELODY_MIDI_MIN = 60;
export const GENO_PLUGIN_MELODY_MIDI_MAX = 84;
export const GENO_PLUGIN_MELODY_REF_MIDI = 72;

/** Note Filler — same comp register as melody; quieter ornamental pickups. */
export const GENO_PLUGIN_FILLER_MIDI_MIN = GENO_PLUGIN_MELODY_MIDI_MIN;
export const GENO_PLUGIN_FILLER_MIDI_MAX = GENO_PLUGIN_MELODY_MIDI_MAX;

export function genoWrapMidiToRange(midi: number, min: number, max: number): number {
  let n = Math.round(midi);
  while (n < min) n += 12;
  while (n > max) n -= 12;
  return Math.max(min, Math.min(max, n));
}

/** Shift voicing in octaves until it fits — never pulls below min. */
export function genoShiftVoicingToRange(
  pitches: readonly number[],
  min: number,
  max: number,
): number[] {
  if (pitches.length === 0) return [];
  let shift = 0;
  for (let guard = 0; guard < 8; guard += 1) {
    const shifted = pitches.map((p) => p + shift);
    const lo = Math.min(...shifted);
    const hi = Math.max(...shifted);
    if (lo >= min && hi <= max) {
      return shifted.map((p) => Math.max(min, Math.min(max, p)));
    }
    if (lo < min) shift += 12;
    else if (hi > max) shift -= 12;
    else break;
  }
  return pitches.map((p) => genoWrapMidiToRange(p + shift, min, max));
}

/** Live Chord pad — warm Rhodes / piano zone (Rip Chord / ChordPrism comp register). */
export const GENO_LIVE_CHORD_MIDI_MIN = 48;
export const GENO_LIVE_CHORD_MIDI_MAX = 72;
export const GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI = 48;

/** Prefer shifting down into range — keeps quiet-storm / soul voicings warm, not shrill. */
export function genoWarmVoicingToRange(
  pitches: readonly number[],
  min: number,
  max: number,
): number[] {
  if (pitches.length === 0) return [];
  let shift = 0;
  for (let guard = 0; guard < 8; guard += 1) {
    const shifted = pitches.map((p) => p + shift);
    const lo = Math.min(...shifted);
    const hi = Math.max(...shifted);
    if (lo >= min && hi <= max) {
      return shifted.map((p) => Math.max(min, Math.min(max, p)));
    }
    if (lo < min) shift += 12;
    else if (hi > max) shift -= 12;
    else break;
  }
  return pitches.map((p) => genoWrapMidiToRange(p + shift, min, max));
}

/** Prefer shifting up into range (fixes low voicings without dragging them down). */
export function genoLiftVoicingToRange(
  pitches: readonly number[],
  min: number,
  max: number,
): number[] {
  if (pitches.length === 0) return [];
  let shift = 0;
  for (let guard = 0; guard < 8; guard += 1) {
    const shifted = pitches.map((p) => p + shift);
    const lo = Math.min(...shifted);
    const hi = Math.max(...shifted);
    if (lo >= min && hi <= max) {
      return shifted.map((p) => Math.max(min, Math.min(max, p)));
    }
    if (hi > max) shift -= 12;
    else shift += 12;
  }
  return pitches.map((p) => genoWrapMidiToRange(p + shift, min, max));
}

/** Snap a voicing to the same octave floor as a reference stack (Pop/Afro → Lo-Fi register). */
export function genoOctaveAlignVoicingToReference(
  tones: readonly number[],
  reference: readonly number[],
  min = GENO_LIVE_CHORD_MIDI_MIN,
  max = GENO_LIVE_CHORD_MIDI_MAX,
): number[] {
  if (tones.length === 0 || reference.length === 0) return [...tones];
  const curLo = Math.min(...tones);
  const refLo = Math.min(...reference);
  let bestShift = 0;
  let bestDist = Math.abs(curLo - refLo);
  for (let oct = -2; oct <= 2; oct += 1) {
    const shift = oct * 12;
    const dist = Math.abs(curLo + shift - refLo);
    if (dist < bestDist) {
      bestDist = dist;
      bestShift = shift;
    }
  }
  if (bestShift === 0) return [...tones];
  return genoLiftVoicingToRange(
    tones.map((p) => p + bestShift),
    min,
    max,
  );
}

export function genoBassPitchFromHarmonyRoot(harmonyRootMidi: number): number {
  const pc = ((Math.round(harmonyRootMidi) % 12) + 12) % 12;
  const base = Math.floor(GENO_BASS_ROOT_OCTAVE_MIDI / 12) * 12;
  return genoWrapMidiToRange(base + pc, GENO_BASS_MIDI_MIN, GENO_BASS_MIDI_MAX);
}

export function genoBassRootFromChordRoot(chordRootMidi: number): number {
  return genoBassPitchFromHarmonyRoot(chordRootMidi);
}

export function genoMelodyRootFromHarmonyRoot(harmonyRootMidi: number): number {
  const pc = ((Math.round(harmonyRootMidi) % 12) + 12) % 12;
  const base = Math.floor(GENO_MELODY_REF_MIDI / 12) * 12;
  return genoWrapMidiToRange(base + pc, GENO_MELODY_MIDI_MIN, GENO_MELODY_MIDI_MAX);
}

/** B2 melody root — warm piano lead under the chord stack (C4–C6). */
export function genoPluginMelodyRootFromHarmonyRoot(harmonyRootMidi: number): number {
  const pc = ((Math.round(harmonyRootMidi) % 12) + 12) % 12;
  const base = Math.floor(GENO_PLUGIN_MELODY_REF_MIDI / 12) * 12;
  return genoWrapMidiToRange(base + pc, GENO_PLUGIN_MELODY_MIDI_MIN, GENO_PLUGIN_MELODY_MIDI_MAX);
}

export function genoMelodyCandidatesFromHarmony(col: {
  rootMidi: number;
  tones: readonly number[];
}): number[] {
  const rootLead = genoMelodyRootFromHarmonyRoot(col.rootMidi);
  if (col.tones.length === 0) return [rootLead];

  const shifted = col.tones.map((t) =>
    genoWrapMidiToRange(t - 12, GENO_MELODY_MIDI_MIN, GENO_MELODY_MIDI_MAX),
  );
  const inCompRange = col.tones.map((t) =>
    genoWrapMidiToRange(t, GENO_MELODY_MIDI_MIN, GENO_MELODY_MIDI_MAX),
  );
  return [...new Set([rootLead, ...shifted, ...inCompRange])].sort((a, b) => a - b);
}

/** B2 melody chord tones — shifted down one octave from comp voicing. */
export function genoPluginMelodyCandidatesFromHarmony(col: {
  rootMidi: number;
  tones: readonly number[];
}): number[] {
  const rootLead = genoPluginMelodyRootFromHarmonyRoot(col.rootMidi);
  if (col.tones.length === 0) return [rootLead];

  const shifted = col.tones.map((t) =>
    genoWrapMidiToRange(t - 12, GENO_PLUGIN_MELODY_MIDI_MIN, GENO_PLUGIN_MELODY_MIDI_MAX),
  );
  const inCompRange = col.tones.map((t) =>
    genoWrapMidiToRange(t, GENO_PLUGIN_MELODY_MIDI_MIN, GENO_PLUGIN_MELODY_MIDI_MAX),
  );
  return [...new Set([rootLead, ...shifted, ...inCompRange])].sort((a, b) => a - b);
}

export function genoMelodyCandidatesFromChordTones(
  tones: readonly number[],
  rootMidi: number,
): number[] {
  return genoMelodyCandidatesFromHarmony({ rootMidi, tones });
}

export type GenoPartRegister = 'chord' | 'melody' | 'bass';

export function genoNormalizePartNotes(
  notes: readonly StudioEditor2GenNote[],
  part: GenoPartRegister,
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];

  if (part === 'chord') {
    const byStart = new Map<number, StudioEditor2GenNote[]>();
    for (const n of notes) {
      const key = Math.round(n.startBeat * 1000) / 1000;
      const bucket = byStart.get(key) ?? [];
      bucket.push(n);
      byStart.set(key, bucket);
    }
    const out: StudioEditor2GenNote[] = [];
    for (const group of byStart.values()) {
      const lifted = genoLiftVoicingToRange(
        group.map((n) => n.pitch),
        GENO_LIVE_CHORD_MIDI_MIN,
        GENO_LIVE_CHORD_MIDI_MAX,
      );
      group.forEach((n, i) => {
        out.push({
          ...n,
          pitch:
            lifted[i]
            ?? genoWrapMidiToRange(n.pitch, GENO_LIVE_CHORD_MIDI_MIN, GENO_LIVE_CHORD_MIDI_MAX),
        });
      });
    }
    return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  }

  const range =
    part === 'bass'
      ? { min: GENO_BASS_MIDI_MIN, max: GENO_BASS_MIDI_MAX }
      : { min: GENO_MELODY_MIDI_MIN, max: GENO_MELODY_MIDI_MAX };

  return notes
    .map((n) => ({ ...n, pitch: genoWrapMidiToRange(n.pitch, range.min, range.max) }))
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

const GENO_PLUGIN_MELODY_DEFAULT_QUANT: GenoBarChopQuant = '1/16';

/**
 * One melody grid for the whole loop (8 bars, 4 bars, etc.) — never changes bar-to-bar.
 * Uses the first explicit chop quant in the loop (what you set on bar 1 or the first configured bar).
 */
export function genoPluginMelodyLoopQuant(
  barChordSpecs?: readonly GenoBarChordSpec[],
): GenoBarChopQuant {
  if (!barChordSpecs?.length) return GENO_PLUGIN_MELODY_DEFAULT_QUANT;
  const lead = barChordSpecs[0]?.chopQuant;
  if (lead && lead !== 'whole') return lead;
  for (const spec of barChordSpecs) {
    if (spec.chopQuant && spec.chopQuant !== 'whole') return spec.chopQuant;
  }
  return GENO_PLUGIN_MELODY_DEFAULT_QUANT;
}

/** Beat step for melody snap — same value on every bar in the loop. */
export function genoPluginMelodyUniformQuantStep(
  beatsPerBar: number,
  barChordSpecs?: readonly GenoBarChordSpec[],
): number {
  const bpb = Math.max(1, beatsPerBar);
  const quant = genoPluginMelodyLoopQuant(barChordSpecs);
  return Math.max(genoBarChopStepBeats(quant, bpb), bpb / 128);
}

const GENO_PLUGIN_MELODY_SNAP_EPS = 1e-6;

/** Snap a beat offset inside one bar onto the loop-wide melody quant grid. */
export function genoSnapPluginMelodyRelBeat(
  relBeat: number,
  step: number,
  beatsPerBar: number,
): number {
  const bpb = Math.max(1, beatsPerBar);
  const clamped = Math.max(0, Math.min(bpb - GENO_PLUGIN_MELODY_SNAP_EPS, relBeat));
  let rel = Math.round(clamped / step) * step;
  if (rel < step * 0.21) rel = 0;
  if (rel >= bpb - step * 0.21) rel = Math.max(0, bpb - step);
  return rel;
}

function genoQuantizePluginMelodyDuration(
  durationBeats: number,
  step: number,
  maxDur: number,
): number {
  const minDur = step * 0.5;
  let dur = Math.min(Math.max(minDur, durationBeats), maxDur);
  dur = Math.max(minDur, Math.round(dur / step) * step);
  return Math.min(dur, maxDur);
}

/** Snap an absolute beat to the B2 melody grid and keep it inside the loop. */
export function genoSnapPluginMelodyStartBeat(
  startBeat: number,
  beatsPerBar: number,
  barCount?: number,
  barChordSpecs?: readonly GenoBarChordSpec[],
): number {
  const bpb = Math.max(1, beatsPerBar);
  const step = genoPluginMelodyUniformQuantStep(bpb, barChordSpecs);
  return genoSnapMelodyStartBeat(startBeat, bpb, step, barCount);
}

/** Snap an absolute beat to the melody grid and keep it inside the loop. */
export function genoSnapMelodyStartBeat(
  startBeat: number,
  beatsPerBar: number,
  step: number,
  barCount?: number,
): number {
  const bpb = Math.max(1, beatsPerBar);
  const maxBar = barCount != null ? Math.max(0, barCount - 1) : Number.POSITIVE_INFINITY;
  const loopEnd = barCount != null ? barCount * bpb : Number.POSITIVE_INFINITY;
  let bar = Math.floor(startBeat / bpb + GENO_PLUGIN_MELODY_SNAP_EPS);
  if (bar < 0) return 0;
  if (bar > maxBar) return Math.max(0, loopEnd - step);
  const rel = genoSnapPluginMelodyRelBeat(startBeat - bar * bpb, step, bpb);
  return Math.min(loopEnd - GENO_PLUGIN_MELODY_SNAP_EPS, bar * bpb + rel);
}

/** Snap melody to a uniform quant grid and keep every note inside its bar. */
export function genoFinalizeMelodyTimingOnGrid(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
  step: number,
  barCount?: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const bpb = Math.max(1, beatsPerBar);
  const minDur = step * 0.5;
  const barGap = step * 0.25;
  const maxBarIndex = barCount != null ? Math.max(0, barCount - 1) : Number.POSITIVE_INFINITY;
  const loopEndBeat = barCount != null ? barCount * bpb : Number.POSITIVE_INFINITY;

  const out: StudioEditor2GenNote[] = [];
  for (const n of notes) {
    if (!Number.isFinite(n.startBeat)) continue;
    const bar = Math.floor(n.startBeat / bpb + GENO_PLUGIN_MELODY_SNAP_EPS);
    if (bar < 0 || bar > maxBarIndex) continue;

    const startBeat = genoSnapMelodyStartBeat(n.startBeat, bpb, step, barCount);
    if (startBeat >= loopEndBeat - GENO_PLUGIN_MELODY_SNAP_EPS) continue;
    const barEnd = Math.min((bar + 1) * bpb, loopEndBeat);
    const maxDur = Math.max(minDur, barEnd - startBeat - barGap);
    const durationBeats = genoQuantizePluginMelodyDuration(n.durationBeats, step, maxDur);
    if (durationBeats < minDur * 0.85) continue;

    out.push({ ...n, startBeat, durationBeats });
  }
  return out;
}

/** One monophonic hit per quant slot — keeps the longest note when overlaps collide. */
export function genoTrimMelodyMonophonic(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
  step: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const bpb = Math.max(1, beatsPerBar);
  const minDur = step * 0.5;
  const hitGap = step * 0.25;
  const barGap = step * 0.5;

  const byBar = new Map<number, StudioEditor2GenNote[]>();
  for (const n of notes) {
    const bar = Math.floor(n.startBeat / bpb + GENO_PLUGIN_MELODY_SNAP_EPS);
    const bucket = byBar.get(bar) ?? [];
    bucket.push(n);
    byBar.set(bar, bucket);
  }

  const out: StudioEditor2GenNote[] = [];
  for (const [bar, group] of byBar) {
    const barStart = bar * bpb;
    const barEnd = (bar + 1) * bpb;
    const slotBuckets = new Map<number, StudioEditor2GenNote>();
    for (const n of group) {
      const rel = n.startBeat - barStart;
      const slotKey = Math.round(genoSnapPluginMelodyRelBeat(rel, step, bpb) * 1000);
      const existing = slotBuckets.get(slotKey);
      if (!existing || n.durationBeats > existing.durationBeats) {
        slotBuckets.set(slotKey, n);
      }
    }
    const sorted = [...slotBuckets.values()].sort((a, b) => a.startBeat - b.startBeat);
    for (let i = 0; i < sorted.length; i += 1) {
      const n = sorted[i]!;
      const startBeat = genoSnapMelodyStartBeat(n.startBeat, bpb, step);
      let nextStart = barEnd - barGap;
      if (i + 1 < sorted.length) nextStart = sorted[i + 1]!.startBeat - hitGap;
      nextStart = Math.min(nextStart, barEnd - barGap);
      const maxDur = Math.max(minDur, nextStart - startBeat);
      out.push({
        ...n,
        startBeat,
        durationBeats: genoQuantizePluginMelodyDuration(n.durationBeats, step, maxDur),
      });
    }
  }
  return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

/** Snap B2 melody to the loop-wide quant grid and keep every note inside its bar. */
export function genoFinalizePluginMelodyTiming(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
  barCount?: number,
  barChordSpecs?: readonly GenoBarChordSpec[],
): StudioEditor2GenNote[] {
  const step = genoPluginMelodyUniformQuantStep(beatsPerBar, barChordSpecs);
  const snapped = genoFinalizeMelodyTimingOnGrid(notes, beatsPerBar, step, barCount);
  return genoTrimPluginMelodyBarOverlaps(snapped, beatsPerBar, barChordSpecs);
}

const GENO_MELODY_POLY_START_EPS = 1 / 512;

/** Sequential hits in a bar stop before the next hit; dyads at the same beat stay polyphonic. */
export function genoTrimPluginMelodyBarOverlaps(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
  barChordSpecs?: readonly GenoBarChordSpec[],
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const bpb = Math.max(1, beatsPerBar);
  const step = genoPluginMelodyUniformQuantStep(bpb, barChordSpecs);
  const minDur = step * 0.5;
  const hitGap = step * 0.25;
  const barGap = step * 0.5;

  const byBar = new Map<number, StudioEditor2GenNote[]>();
  for (const n of notes) {
    const bar = Math.floor(n.startBeat / bpb);
    const bucket = byBar.get(bar) ?? [];
    bucket.push(n);
    byBar.set(bar, bucket);
  }

  const out: StudioEditor2GenNote[] = [];
  for (const [bar, group] of byBar) {
    const barStart = bar * bpb;
    const barEnd = (bar + 1) * bpb;
    const unified = genoUnifyPluginMelodyPolyStarts(group, step);
    const sorted = [...unified].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
    let i = 0;
    while (i < sorted.length) {
      const startBeat = sorted[i]!.startBeat;
      const poly: StudioEditor2GenNote[] = [sorted[i]!];
      let j = i + 1;
      while (
        j < sorted.length
        && Math.abs(sorted[j]!.startBeat - startBeat) <= GENO_MELODY_POLY_START_EPS
      ) {
        poly.push(sorted[j]!);
        j += 1;
      }
      let nextStart = barEnd - barGap;
      if (j < sorted.length) nextStart = sorted[j]!.startBeat - hitGap;
      nextStart = Math.min(nextStart, barEnd - barGap);
      for (const n of poly) {
        const maxDur = Math.max(minDur, nextStart - n.startBeat);
        out.push({
          ...n,
          startBeat,
          durationBeats: genoQuantizePluginMelodyDuration(n.durationBeats, step, maxDur),
        });
      }
      i = j;
    }
  }
  return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

/** Dyads at the same hit share one start time so preview plays them polyphonically. */
function genoUnifyPluginMelodyPolyStarts(
  notes: readonly StudioEditor2GenNote[],
  quantStep: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const matchEps = Math.max(quantStep * 0.25, 1 / 512);
  const buckets = new Map<number, StudioEditor2GenNote[]>();
  for (const n of notes) {
    const bucketKey = Math.round(n.startBeat / matchEps);
    const bucket = buckets.get(bucketKey) ?? [];
    bucket.push(n);
    buckets.set(bucketKey, bucket);
  }
  const out: StudioEditor2GenNote[] = [];
  for (const group of buckets.values()) {
    const startBeat = group.reduce((min, n) => Math.min(min, n.startBeat), group[0]!.startBeat);
    for (const n of group) {
      out.push({ ...n, startBeat });
    }
  }
  return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

export function genoNormalizePluginMelodyNotes(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar?: number,
  barCount?: number,
  barChordSpecs?: readonly GenoBarChordSpec[],
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const timed =
    beatsPerBar != null
      ? (() => {
          const step = genoPluginMelodyUniformQuantStep(beatsPerBar, barChordSpecs);
          const snapped = genoFinalizeMelodyTimingOnGrid(notes, beatsPerBar, step, barCount);
          return genoTrimMelodyMonophonic(snapped, beatsPerBar, step);
        })()
      : notes;
  return timed
    .map((n) => ({
      ...n,
      pitch: genoWrapMidiToRange(n.pitch, GENO_PLUGIN_MELODY_MIDI_MIN, GENO_PLUGIN_MELODY_MIDI_MAX),
    }))
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

/** B1 live melody — prelude-style quant snap + monophonic trim. */
export function genoNormalizeLiveMelodyNotes(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
  barCount: number,
  quantStep: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const snapped = genoFinalizeMelodyTimingOnGrid(notes, beatsPerBar, quantStep, barCount);
  const mono = genoTrimMelodyMonophonic(snapped, beatsPerBar, quantStep);
  return mono
    .map((n) => ({
      ...n,
      pitch: genoWrapMidiToRange(n.pitch, GENO_MELODY_MIDI_MIN, GENO_MELODY_MIDI_MAX),
    }))
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

export function genoNormalizePluginFillerNotes(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar?: number,
  barCount?: number,
  quantStep?: number,
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const bpb = beatsPerBar ?? 4;
  const bars = barCount ?? Math.ceil(
    (Math.max(...notes.map((n) => n.startBeat + n.durationBeats)) + 0.001) / bpb,
  );
  const step = quantStep ?? genoFillerQuantStepFromBeatsPerBar(bpb);
  return notes
    .map((n) => {
      const startBeat = genoSnapBeatForFiller(
        Math.max(0, Math.min(bpb * bars - step, n.startBeat)),
        step,
      );
      const maxDur = Math.max(step * 0.5, bpb * bars - startBeat);
      const durationBeats = genoSnapBeatForFiller(
        Math.max(step * 0.5, Math.min(maxDur, n.durationBeats)),
        step,
      );
      return {
        ...n,
        startBeat,
        durationBeats,
        pitch: genoWrapMidiToRange(n.pitch, GENO_PLUGIN_FILLER_MIDI_MIN, GENO_PLUGIN_FILLER_MIDI_MAX),
      };
    })
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

function genoFillerQuantStepFromBeatsPerBar(beatsPerBar: number): number {
  return beatsPerBar / 8;
}

export function genoNormalizePluginDraftNotes(
  draft: {
    chordNotes: StudioEditor2GenNote[];
    melodyNotes: StudioEditor2GenNote[];
    bassNotes: StudioEditor2GenNote[];
    fillerNotes?: StudioEditor2GenNote[];
  },
  beatsPerBar?: number,
  barCount?: number,
  barChordSpecs?: readonly GenoBarChordSpec[],
): void {
  draft.chordNotes = genoNormalizePluginChordNotes(draft.chordNotes);
  draft.melodyNotes = genoNormalizePluginMelodyNotes(
    draft.melodyNotes,
    beatsPerBar,
    barCount,
    barChordSpecs,
  );
  draft.bassNotes = genoNormalizePartNotes(draft.bassNotes, 'bass');
  if (draft.fillerNotes) {
    draft.fillerNotes = genoNormalizePluginFillerNotes(draft.fillerNotes, beatsPerBar, barCount);
  }
}

export function genoLiveBrightCompBump(pitches: readonly number[]): number[] {
  if (pitches.length === 0) return [];
  const sorted = [...pitches].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? GENO_LIVE_CHORD_MIDI_MIN;
  if (median >= 55) return sorted;
  return genoLiftVoicingToRange(
    sorted.map((p) => p + 12),
    GENO_LIVE_CHORD_MIDI_MIN,
    GENO_LIVE_CHORD_MIDI_MAX,
  );
}

/** Chord Generator comp lane — Soul Classic register (C3–C5, lift when below C3). */
export function genoNormalizePluginChordNotes(
  notes: readonly StudioEditor2GenNote[],
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const byStart = new Map<number, StudioEditor2GenNote[]>();
  for (const n of notes) {
    const key = Math.round(n.startBeat * 1000) / 1000;
    const bucket = byStart.get(key) ?? [];
    bucket.push(n);
    byStart.set(key, bucket);
  }
  const out: StudioEditor2GenNote[] = [];
  for (const group of byStart.values()) {
    const lifted = genoLiftVoicingToRange(
      group.map((n) => n.pitch),
      GENO_LIVE_CHORD_MIDI_MIN,
      GENO_LIVE_CHORD_MIDI_MAX,
    );
    group.forEach((n, i) => {
      out.push({
        ...n,
        pitch:
          lifted[i]
          ?? genoWrapMidiToRange(n.pitch, GENO_LIVE_CHORD_MIDI_MIN, GENO_LIVE_CHORD_MIDI_MAX),
      });
    });
  }
  return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

/** Warm C3–C5 voicing for Live Chord loop preview — matches one-key pad register. */
export function genoWarmNormalizeLiveChordNotes(
  notes: readonly StudioEditor2GenNote[],
): StudioEditor2GenNote[] {
  if (notes.length === 0) return [];
  const byStart = new Map<number, StudioEditor2GenNote[]>();
  for (const n of notes) {
    const key = Math.round(n.startBeat * 1000) / 1000;
    const bucket = byStart.get(key) ?? [];
    bucket.push(n);
    byStart.set(key, bucket);
  }
  const out: StudioEditor2GenNote[] = [];
  for (const group of byStart.values()) {
    const warmed = genoWarmVoicingToRange(
      group.map((n) => n.pitch),
      GENO_LIVE_CHORD_MIDI_MIN,
      GENO_LIVE_CHORD_MIDI_MAX,
    );
    group.forEach((n, i) => {
      out.push({
        ...n,
        pitch:
          warmed[i]
          ?? genoWrapMidiToRange(n.pitch, GENO_LIVE_CHORD_MIDI_MIN, GENO_LIVE_CHORD_MIDI_MAX),
      });
    });
  }
  return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}
