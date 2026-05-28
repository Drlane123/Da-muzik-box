/**
 * Groove Studio — chord-following melody / riff / arp composer (replaces MIDI bassline library UI).
 * Harmony comes from green chord columns only; optional sub-bass is separate.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  GROOVE_LAB_BASS_MIDI_MAX,
  GROOVE_LAB_BASS_MIDI_MIN,
  GROOVE_LAB_CHORD_HARMONY_MIDI_MIN,
  GROOVE_LAB_MELODY_MIDI_MAX,
  GROOVE_LAB_MELODY_MIDI_MIN,
  GROOVE_LAB_MELODY_REFERENCE_MIDI,
  grooveLabClampBassRootMidi,
  grooveLabClampMelodyMidi,
  grooveLabIsMelodyMidi,
} from '@/app/lib/creationStation/grooveLabPitch';

export { grooveLabIsMelodyMidi } from '@/app/lib/creationStation/grooveLabPitch';
import { grooveLabChordAnchorsFromHits, grooveLabSlotsPerCell, type GrooveLabQuantize, type GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

export type GrooveComposerPart = 'melody' | 'riff' | 'arp' | 'bass';

export type GrooveComposerColumn = {
  slot: number;
  rootMidi: number;
  /** Chord tones (MIDI) at this column when available. */
  tones: number[];
};

export type GrooveComposerHarmony = {
  columns: GrooveComposerColumn[];
};

export type GrooveComposerParams = {
  part: GrooveComposerPart;
  harmony: GrooveComposerHarmony;
  barCount: number;
  quantize: GrooveLabQuantize;
  keyRoot: number;
  mode: ChordMode;
  referenceMidi: number;
  /** 0..1 — density and rhythmic busyness. */
  complexity: number;
  seed: number;
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return (): number => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function scaleForMode(mode: ChordMode): readonly number[] {
  return mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
}

/** Lift a pitch class into the mid lead lane (C4–B4) — never the sub register. */
export function grooveComposerPitchClassToMelody(pc: number, referenceMidi: number, rnd: () => number): number {
  const ref =
    referenceMidi >= GROOVE_LAB_MELODY_MIDI_MIN && referenceMidi <= GROOVE_LAB_MELODY_MIDI_MAX
      ? referenceMidi
      : GROOVE_LAB_MELODY_REFERENCE_MIDI;
  let midi = GROOVE_LAB_MELODY_MIDI_MIN + (((pc % 12) - (GROOVE_LAB_MELODY_MIDI_MIN % 12) + 12) % 12);
  const jitter = rnd() < 0.22 ? 12 : 0;
  return grooveLabClampMelodyMidi(midi + jitter, ref);
}

/** Build harmony columns from green chord hits (does not read blue bass). */
export function grooveComposerHarmonyFromChordHits(
  chordHits: readonly GrooveRollHit[],
  opts: { keyRoot: number; mode: ChordMode; referenceMidi: number },
): GrooveComposerHarmony {
  const anchors = grooveLabChordAnchorsFromHits([...chordHits], {
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    referenceMidi: opts.referenceMidi,
  });
  const bySlot = new Map<number, number[]>();
  for (const h of chordHits) {
    if (h.midi < GROOVE_LAB_CHORD_HARMONY_MIDI_MIN) continue;
    const list = bySlot.get(h.slot) ?? [];
    list.push(h.midi);
    bySlot.set(h.slot, list);
  }
  const columns: GrooveComposerColumn[] = anchors.map((a) => {
    const raw = bySlot.get(a.slot) ?? [];
    const tones = [...new Set(raw.map((m) => Math.round(m)))].sort((x, y) => x - y);
    if (tones.length === 0) {
      const scale = scaleForMode(opts.mode);
      const rootPc = a.midi % 12;
      tones.push(
        a.midi,
        a.midi + (scale[2] ?? 4),
        a.midi + (scale[4] ?? 7),
      );
    }
    return { slot: a.slot, rootMidi: a.midi, tones };
  });
  return { columns };
}

function trimSustains(hits: GrooveRollHit[], snap: number): GrooveRollHit[] {
  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const next = sorted[i + 1];
    if (next) {
      const gap = next.slot - cur.slot;
      cur.sustainSlots = Math.min(cur.sustainSlots, Math.max(snap, gap));
    }
  }
  return sorted;
}

function generateMelody(params: GrooveComposerParams): GrooveRollHit[] {
  const { harmony, quantize, complexity, seed, referenceMidi, mode, keyRoot } = params;
  const rnd = mulberry32(seed ^ 0x9e37_79b9);
  const snap = grooveLabSlotsPerCell(quantize);
  const scale = scaleForMode(mode);
  const out: GrooveRollHit[] = [];

  for (const col of harmony.columns) {
    if (rnd() > 0.35 + complexity * 0.55) continue;
    const tonePool = col.tones.length > 0 ? col.tones : [col.rootMidi];
    const pick = tonePool[Math.floor(rnd() * tonePool.length)]!;
    const pc = ((pick % 12) + 12) % 12;
    let midi = grooveComposerPitchClassToMelody(pc, referenceMidi, rnd);
    if (rnd() < complexity * 0.35) {
      const step = scale[Math.floor(rnd() * scale.length)] ?? 0;
      midi = grooveComposerPitchClassToMelody((keyRoot + step) % 12, referenceMidi, rnd);
    }
    const len = Math.max(snap, Math.round((1 + rnd() * 2) * snap * (0.6 + complexity * 0.5)));
    out.push({
      slot: col.slot,
      midi,
      sustainSlots: len,
      vel: Math.round(78 + rnd() * 42),
    });
  }
  return trimSustains(out, snap);
}

function generateRiff(params: GrooveComposerParams): GrooveRollHit[] {
  const { harmony, quantize, complexity, seed, referenceMidi } = params;
  const rnd = mulberry32(seed ^ 0x85eb_ca6b);
  const snap = grooveLabSlotsPerCell(quantize);
  const out: GrooveRollHit[] = [];

  for (const col of harmony.columns) {
    const rootPc = col.rootMidi % 12;
    const fifthPc = (rootPc + 7) % 12;
    const cells = complexity > 0.55 ? [0, snap, snap * 2] : [0, snap];
    for (const off of cells) {
      if (off > 0 && rnd() > complexity) continue;
      const pc = off === snap && rnd() > 0.4 ? fifthPc : rootPc;
      out.push({
        slot: col.slot + off,
        midi: grooveComposerPitchClassToMelody(pc, referenceMidi, rnd),
        sustainSlots: snap,
        vel: Math.round(88 + rnd() * 28),
      });
    }
  }
  return trimSustains(out, snap);
}

function generateArp(params: GrooveComposerParams): GrooveRollHit[] {
  const { harmony, quantize, complexity, seed, referenceMidi } = params;
  const rnd = mulberry32(seed ^ 0xc2b2_ae35);
  const snap = grooveLabSlotsPerCell(quantize);
  const out: GrooveRollHit[] = [];

  for (const col of harmony.columns) {
    const tones = col.tones.length > 0 ? col.tones : [col.rootMidi, col.rootMidi + 4, col.rootMidi + 7];
    const steps = complexity > 0.6 ? tones.length : Math.min(3, tones.length);
    for (let i = 0; i < steps; i += 1) {
      const tone = tones[i % tones.length]!;
      const pc = tone % 12;
      out.push({
        slot: col.slot + i * snap,
        midi: grooveComposerPitchClassToMelody(pc, referenceMidi, rnd),
        sustainSlots: snap,
        vel: Math.round(72 + rnd() * 36),
      });
    }
  }
  return trimSustains(out, snap);
}

function generateOptionalBass(params: GrooveComposerParams): GrooveRollHit[] {
  const { harmony, quantize, seed } = params;
  const rnd = mulberry32(seed ^ 0x27d4_eb2f);
  const snap = grooveLabSlotsPerCell(quantize);
  const out: GrooveRollHit[] = [];
  for (const col of harmony.columns) {
    if (rnd() > 0.92) continue;
    out.push({
      slot: col.slot,
      midi: grooveLabClampBassRootMidi(col.rootMidi),
      sustainSlots: Math.max(snap, Math.round(snap * (1.5 + rnd()))),
      vel: Math.round(90 + rnd() * 20),
    });
  }
  return trimSustains(out, snap);
}

export function generateGrooveComposerPart(params: GrooveComposerParams): GrooveRollHit[] {
  if (params.harmony.columns.length === 0) return [];
  switch (params.part) {
    case 'melody':
      return generateMelody(params);
    case 'riff':
      return generateRiff(params);
    case 'arp':
      return generateArp(params);
    case 'bass':
      return generateOptionalBass(params);
    default:
      return [];
  }
}

export function grooveLabIsBassSubMidi(midi: number): boolean {
  const m = Math.round(midi);
  return m >= GROOVE_LAB_BASS_MIDI_MIN && m <= GROOVE_LAB_BASS_MIDI_MAX;
}

/** Remove blue 808 sub-root lane only — keeps amber melody and green chords. */
export function grooveLabStripSubRootHits(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  return hits.filter((h) => !grooveLabIsBassSubMidi(h.midi));
}

/** Merge generated part into bass-channel hits without touching chords or other layers. */
export function grooveComposerMergePart(
  existing: readonly GrooveRollHit[],
  part: GrooveComposerPart,
  generated: readonly GrooveRollHit[],
): GrooveRollHit[] {
  const keep = existing.filter((h) => {
    if (part === 'bass') return !grooveLabIsBassSubMidi(h.midi);
    return !grooveLabIsMelodyMidi(h.midi);
  });
  if (part === 'bass') {
    return [...keep, ...generated.filter((h) => grooveLabIsBassSubMidi(h.midi))];
  }
  return [...keep, ...generated.filter((h) => grooveLabIsMelodyMidi(h.midi))];
}
