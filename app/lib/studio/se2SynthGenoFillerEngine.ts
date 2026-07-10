/**
 * Synth Geno — Note Filler lane (Geno Build 1 & 2).
 * Short connective pickups on every chord bar — quieter than the arp / melody lane.
 */
import { mulberry32 } from '@/app/lib/groovePatternEngine';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoHarmony } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  GENO_PLUGIN_FILLER_MIDI_MAX,
  GENO_PLUGIN_FILLER_MIDI_MIN,
  genoNormalizePluginFillerNotes,
  genoPluginMelodyCandidatesFromHarmony,
  genoWrapMidiToRange,
} from '@/app/lib/studio/se2SynthGenoRanges';

export type GenoFillerQuant = '4th' | '8th' | '16th';

export const GENO_FILLER_QUANT_OPTIONS: readonly { id: GenoFillerQuant; label: string }[] = [
  { id: '4th', label: '1/4' },
  { id: '8th', label: '1/8' },
  { id: '16th', label: '1/16' },
];

/** Snap grid for filler generation + piano-roll edit (4/4 → 1 beat, ½ beat, ¼ beat). */
export function genoFillerQuantStep(quant: GenoFillerQuant, beatsPerBar: number): number {
  const scale = beatsPerBar / 4;
  switch (quant) {
    case '4th':
      return 1 * scale;
    case '16th':
      return 0.25 * scale;
    default:
      return 0.5 * scale;
  }
}

function genoSnapBeat(beat: number, snapBeats: number): number {
  if (snapBeats <= 0) return beat;
  return Math.round(beat / snapBeats) * snapBeats;
}

function clampFiller(m: number): number {
  return genoWrapMidiToRange(m, GENO_PLUGIN_FILLER_MIDI_MIN, GENO_PLUGIN_FILLER_MIDI_MAX);
}

function fillerBeatSlots(beatsPerBar: number, step: number): number[] {
  const slots: number[] = [];
  for (let t = 0; t < beatsPerBar - 1e-6; t += step) {
    slots.push(Math.round(t * 10000) / 10000);
  }
  return slots;
}

function pickFillerPitch(
  rng: () => number,
  candidates: readonly number[],
  prev: number | null,
): number {
  if (candidates.length === 0) return clampFiller(72);
  if (prev == null) return candidates[Math.floor(rng() * candidates.length)]!;
  const neighbors = candidates.filter((p) => Math.abs(p - prev) <= 5);
  const pool = neighbors.length > 0 ? neighbors : candidates;
  return pool[Math.floor(rng() * pool.length)]!;
}

export function genoGenerateLiveFillerFromHarmony(opts: {
  harmony: GenoHarmony;
  barCount: number;
  beatsPerBar: number;
  seed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  quant?: GenoFillerQuant;
}): StudioEditor2GenNote[] {
  void opts.keyRoot;
  void opts.keyMode;
  const rng = mulberry32((opts.seed ^ 0x46494c4c) >>> 0);
  const notes: StudioEditor2GenNote[] = [];
  const bpb = Math.max(1, opts.beatsPerBar);
  const quant = opts.quant ?? '8th';
  const step = genoFillerQuantStep(quant, bpb);
  let prevPitch: number | null = null;

  for (let bar = 0; bar < opts.barCount; bar += 1) {
    const col = opts.harmony.columns[bar];
    if (!col) continue;
    const barStart = bar * bpb;
    const candidates = genoPluginMelodyCandidatesFromHarmony(col).map(clampFiller);
    if (candidates.length === 0) continue;

    const slots = fillerBeatSlots(bpb, step);
    const hitsPerBar = Math.min(
      slots.length,
      Math.max(2, Math.floor(slots.length * (0.45 + rng() * 0.25))),
    );
    for (let i = slots.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [slots[i], slots[j]] = [slots[j]!, slots[i]!];
    }
    const chosen = slots.slice(0, hitsPerBar).sort((a, b) => a - b);

    for (const relBeat of chosen) {
      const snappedRel = genoSnapBeat(relBeat, step);
      if (snappedRel >= bpb - step * 0.5) continue;
      const pitch = pickFillerPitch(rng, candidates, prevPitch);
      prevPitch = pitch;
      const dur = Math.max(step * 0.85, step * (0.7 + rng() * 0.2));
      notes.push({
        pitch,
        startBeat: barStart + snappedRel,
        durationBeats: Math.min(dur, bpb - snappedRel - 0.02),
        velocity: Math.round(64 + rng() * 20),
      });
    }
  }

  return genoNormalizePluginFillerNotes(notes, bpb, opts.barCount, step);
}
