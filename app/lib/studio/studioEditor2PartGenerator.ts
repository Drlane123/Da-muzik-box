/**
 * Studio Editor 2 — generate melody / bass / chords from an existing lane (key-locked).
 */

import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  generateGrooveLabBasslineFromChordAnchors,
  GROOVE_LAB_BASS_GROOVE_DEFAULT,
  type GrooveLabBassGrooveId,
} from '@/app/lib/creationStation/grooveLabBassGrooves';
import type { GrooveComposerColumn, GrooveComposerHarmony } from '@/app/lib/creationStation/grooveLabComposerTypes';
import { generateGrooveMelodyPart } from '@/app/lib/creationStation/grooveLabMelodyEngine';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import { mixSeed, mulberry32 } from '@/app/lib/groovePatternEngine';

export type StudioGeneratePartKind = 'melody' | 'bass' | 'chords';

export type StudioEditor2GenNoteFlexPoint = {
  beatOffset: number;
  pitch: number;
};

/** CC#11-style expression ramp within a note (0..1). */
export type StudioEditor2GenNoteExpressionPoint = {
  beatOffset: number;
  value: number;
};

export type StudioEditor2GenNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  /** Note Flex — intra-note pitch bend curve (MIDISketch / MPE-style glide). */
  flexCurve?: StudioEditor2GenNoteFlexPoint[];
  /** Soft attack override for WaveLeaf / GM playback (seconds). */
  attackSec?: number;
  /** Volume expression curve (CC#11-style), values 0..1 at beat offsets. */
  expressionCurve?: StudioEditor2GenNoteExpressionPoint[];
};

const MAJOR_TRIAD = [0, 4, 7];
const MINOR_TRIAD = [0, 3, 7];
const QUANTIZE: GrooveLabQuantize = '1/16';
const BASS_GROOVE_POOL: readonly GrooveLabBassGrooveId[] = [
  GROOVE_LAB_BASS_GROOVE_DEFAULT,
  'trap-808-slide',
  'gtr-trap-pluck',
  'drill-808',
];

function normalizeKeyRoot(root: number): number {
  return ((Math.round(root) % 12) + 12) % 12;
}

function toChordMode(mode: StudioDetectedKeyMode): ChordMode {
  return mode === 'minor' ? 'minor' : 'major';
}

function grooveSlotToBeat(slot: number, beatsPerBar: number): number {
  return (slot / GROOVE_LAB_SLOTS_PER_BAR) * beatsPerBar;
}

function grooveSustainToBeats(sustainSlots: number, beatsPerBar: number): number {
  return Math.max(1 / 16, (sustainSlots / GROOVE_LAB_SLOTS_PER_BAR) * beatsPerBar);
}

function grooveHitsToSe2Notes(
  hits: readonly GrooveRollHit[],
  beatsPerBar: number,
  barCount: number,
): StudioEditor2GenNote[] {
  const maxBeat = barCount * beatsPerBar;
  const out: StudioEditor2GenNote[] = [];
  for (const h of hits) {
    const startBeat = grooveSlotToBeat(h.slot, beatsPerBar);
    if (startBeat >= maxBeat) continue;
    const dur = grooveSustainToBeats(h.sustainSlots, beatsPerBar);
    out.push({
      pitch: Math.max(0, Math.min(127, Math.round(h.midi))),
      startBeat,
      durationBeats: Math.min(dur, maxBeat - startBeat),
      velocity: Math.max(1, Math.min(127, Math.round((h.vel ?? 0.85) * 110))),
    });
  }
  return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

export function studioInferBarCountFromNotes(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
  fallbackBars = 4,
): number {
  if (notes.length === 0) return Math.max(2, Math.min(16, fallbackBars));
  let maxBeat = 0;
  for (const n of notes) {
    maxBeat = Math.max(maxBeat, n.startBeat + n.durationBeats);
  }
  const bars = Math.ceil(maxBeat / Math.max(1, beatsPerBar));
  return Math.max(2, Math.min(16, bars || fallbackBars));
}

function clampBassRoot(midi: number, keyRoot: number): number {
  let m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const targetPc = normalizeKeyRoot(keyRoot);
  m = m - pc + targetPc;
  while (m > 48) m -= 12;
  while (m < 28) m += 12;
  return m;
}

/** Per-bar harmony from source notes — bass roots + triad tones in key. */
export function studioHarmonyFromSourceNotes(
  notes: readonly StudioEditor2GenNote[],
  barCount: number,
  beatsPerBar: number,
  keyRoot: number,
  mode: StudioDetectedKeyMode,
): GrooveComposerHarmony {
  const rootPc = normalizeKeyRoot(keyRoot);
  const triad = mode === 'minor' ? MINOR_TRIAD : MAJOR_TRIAD;
  const columns: GrooveComposerColumn[] = [];

  for (let bar = 0; bar < barCount; bar += 1) {
    const barStart = bar * beatsPerBar;
    const barEnd = barStart + beatsPerBar;
    const inBar = notes.filter((n) => n.startBeat >= barStart && n.startBeat < barEnd);
    let rootMidi = clampBassRoot(36 + rootPc, rootPc);

    if (inBar.length > 0) {
      const sorted = [...inBar].sort((a, b) => a.pitch - b.pitch);
      const lowest = sorted[0]!;
      rootMidi = clampBassRoot(lowest.pitch, rootPc);
      if (sorted.length >= 3) {
        const tones = [...new Set(sorted.slice(0, 4).map((n) => Math.round(n.pitch)))].sort((a, b) => a - b);
        columns.push({
          slot: bar * GROOVE_LAB_SLOTS_PER_BAR,
          rootMidi,
          tones,
        });
        continue;
      }
    }

    columns.push({
      slot: bar * GROOVE_LAB_SLOTS_PER_BAR,
      rootMidi,
      tones: [rootMidi, rootMidi + triad[1]!, rootMidi + triad[2]!],
    });
  }

  return { columns };
}

function generateChordPart(
  harmony: GrooveComposerHarmony,
  barCount: number,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  const notes: StudioEditor2GenNote[] = [];
  for (const col of harmony.columns) {
    const bar = Math.floor(col.slot / GROOVE_LAB_SLOTS_PER_BAR);
    if (bar >= barCount) continue;
    const startBeat = bar * beatsPerBar;
    const durationBeats = beatsPerBar;
    const tones = col.tones.length >= 3 ? col.tones : [col.rootMidi, col.rootMidi + 4, col.rootMidi + 7];
    for (const pitch of tones) {
      notes.push({
        pitch: Math.max(48, Math.min(84, Math.round(pitch))),
        startBeat,
        durationBeats: Math.max(1 / 4, durationBeats),
        velocity: 78 + (bar % 2) * 6,
      });
    }
  }
  return notes;
}

function pickBassGroove(seed: number): GrooveLabBassGrooveId {
  const rnd = mulberry32(seed ^ 0x9e37_79b9);
  const idx = Math.floor(rnd() * BASS_GROOVE_POOL.length);
  return BASS_GROOVE_POOL[idx] ?? GROOVE_LAB_BASS_GROOVE_DEFAULT;
}

export function studioDefaultInstrumentForGeneratedPart(kind: StudioGeneratePartKind): string {
  switch (kind) {
    case 'bass':
      return 'bass808:trapLowBass';
    case 'chords':
      return 'gm:electric_piano_1';
    default:
      return 'gm:acoustic_grand_piano';
  }
}

export function studioInferGenerateKindFromTrack(
  notes: readonly StudioEditor2GenNote[],
  midiInstrumentId?: string,
): StudioGeneratePartKind {
  const id = (midiInstrumentId ?? '').toLowerCase();
  if (id.startsWith('bass808') || id.includes('bass')) return 'bass';
  if (notes.length === 0) return 'melody';

  let overlapPairs = 0;
  let comparisons = 0;
  for (let i = 0; i < notes.length; i += 1) {
    for (let j = i + 1; j < notes.length; j += 1) {
      const a = notes[i]!;
      const b = notes[j]!;
      if (Math.abs(a.startBeat - b.startBeat) > 0.05) continue;
      comparisons += 1;
      if (a.pitch !== b.pitch) overlapPairs += 1;
    }
  }
  const avgPitch = notes.reduce((s, n) => s + n.pitch, 0) / notes.length;
  if (comparisons > 0 && overlapPairs / comparisons > 0.35) return 'chords';
  if (avgPitch < 52) return 'bass';
  return 'melody';
}

export function studioGeneratePartLabel(kind: StudioGeneratePartKind): string {
  switch (kind) {
    case 'bass':
      return 'Bass';
    case 'chords':
      return 'Chords';
    default:
      return 'Melody';
  }
}

/** Generate MIDI notes locked to source harmony + project key. */
export function studioGenerateCompanionPart(opts: {
  kind: StudioGeneratePartKind;
  sourceNotes: readonly StudioEditor2GenNote[];
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  barCount?: number;
  seed?: number;
}): StudioEditor2GenNote[] {
  const keyRoot = normalizeKeyRoot(opts.keyRoot);
  const mode = opts.keyMode;
  const chordMode = toChordMode(mode);
  const beatsPerBar = Math.max(2, Math.min(16, Math.round(opts.beatsPerBar)));
  const barCount = opts.barCount ?? studioInferBarCountFromNotes(opts.sourceNotes, beatsPerBar);
  const seed = opts.seed ?? mixSeed([opts.kind, keyRoot, mode, barCount, Date.now()]);

  const harmony = studioHarmonyFromSourceNotes(
    opts.sourceNotes,
    barCount,
    beatsPerBar,
    keyRoot,
    mode,
  );
  if (harmony.columns.length === 0) return [];

  const refRoot = harmony.columns[0]!.rootMidi;

  switch (opts.kind) {
    case 'melody': {
      const hits = generateGrooveMelodyPart({
        part: 'melody',
        harmony,
        barCount,
        quantize: QUANTIZE,
        keyRoot,
        mode: chordMode,
        referenceMidi: 60,
        complexity: 0.52 + (mulberry32(seed)() * 0.28),
        seed,
      });
      return grooveHitsToSe2Notes(hits, beatsPerBar, barCount);
    }
    case 'bass': {
      const fallbackRoot = clampBassRoot(refRoot, keyRoot);
      const chordAnchors = harmony.columns.map((c) => ({
        slot: c.slot,
        midi: c.rootMidi,
      }));
      const hits = generateGrooveLabBasslineFromChordAnchors({
        grooveId: pickBassGroove(seed),
        chordAnchors,
        fallbackRootMidi: fallbackRoot,
        mode: chordMode as 'major' | 'minor',
        barCount,
        quantize: QUANTIZE,
        seed,
      });
      return grooveHitsToSe2Notes(hits, beatsPerBar, barCount);
    }
    case 'chords':
      return generateChordPart(harmony, barCount, beatsPerBar);
    default:
      return [];
  }
}
