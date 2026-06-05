/**
 * Groove Studio — harmony from green chords + dispatch to melody / sub engines (v2 rebuild).
 * Chord groove / progression / transport chord playback are unchanged elsewhere.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveComposerHarmony } from '@/app/lib/creationStation/grooveLabComposerTypes';
import { generateGrooveMelodyPart } from '@/app/lib/creationStation/grooveLabMelodyEngine';
import { generateGrooveSubRoots } from '@/app/lib/creationStation/grooveLabSubEngine';
import {
  GROOVE_LAB_BASS_MIDI_MAX,
  GROOVE_LAB_BASS_MIDI_MIN,
  GROOVE_LAB_CHORD_HARMONY_MIDI_MIN,
  GROOVE_LAB_MELODY_MIDI_MAX,
  GROOVE_LAB_MELODY_MIDI_MIN,
  grooveLabClampMelodyMidi,
  grooveLabIsMelodyMidi,
} from '@/app/lib/creationStation/grooveLabPitch';

export {
  grooveLabIsMelodyChannelPitch,
  grooveLabIsMelodyMidi,
  grooveLabStripMelodyLaneHits,
} from '@/app/lib/creationStation/grooveLabPitch';
import { grooveLabChordAnchorsFromHits, type GrooveLabQuantize, type GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

export type { GrooveComposerColumn, GrooveComposerHarmony } from '@/app/lib/creationStation/grooveLabComposerTypes';

export type GrooveComposerPart = 'melody' | 'riff' | 'arp' | 'bass';

export type GrooveComposerParams = {
  part: GrooveComposerPart;
  harmony: GrooveComposerHarmony;
  barCount: number;
  quantize: GrooveLabQuantize;
  keyRoot: number;
  mode: ChordMode;
  referenceMidi: number;
  complexity: number;
  rates?: Partial<Record<'melody' | 'riff' | 'arp', GrooveLabQuantize>>;
  /** @deprecated v2 melody engine ignores — kept for API compat. */
  melodyGridEnabled?: boolean;
  riffGridEnabled?: boolean;
  bpm?: number;
  seed: number;
};

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function scaleForMode(mode: ChordMode): readonly number[] {
  return mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
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
      tones.push(a.midi, a.midi + (scale[2] ?? 4), a.midi + (scale[4] ?? 7));
    }
    return { slot: a.slot, rootMidi: a.midi, tones };
  });
  return { columns };
}

export function generateGrooveComposerPart(params: GrooveComposerParams): GrooveRollHit[] {
  if (params.harmony.columns.length === 0) return [];
  switch (params.part) {
    case 'melody':
    case 'riff':
    case 'arp':
      return generateGrooveMelodyPart({
        part: params.part,
        harmony: params.harmony,
        barCount: params.barCount,
        quantize: params.quantize,
        keyRoot: params.keyRoot,
        mode: params.mode,
        referenceMidi: params.referenceMidi,
        complexity: params.complexity,
        seed: params.seed,
        rates: params.rates,
        melodyGridEnabled: params.melodyGridEnabled,
        riffGridEnabled: params.riffGridEnabled,
      });
    case 'bass':
      return generateGrooveSubRoots(params.harmony, params.quantize);
    default:
      return [];
  }
}

export function grooveLabIsBassSubMidi(midi: number): boolean {
  const m = Math.round(midi);
  return m >= GROOVE_LAB_BASS_MIDI_MIN && m <= GROOVE_LAB_BASS_MIDI_MAX;
}

export function grooveLabStripSubRootHits(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  return hits.filter((h) => !grooveLabIsBassSubMidi(h.midi));
}

export function grooveLabStripMelodyHits(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  return hits.filter((h) => !grooveLabIsMelodyMidi(h.midi));
}

export function grooveLabStripSubHitsAtMelodySlots<T extends { slot: number; midi: number }>(
  subHits: readonly T[],
  melodyHits: readonly { slot: number }[],
): T[] {
  if (melodyHits.length === 0) return [...subHits];
  const melodySlots = new Set(melodyHits.map((h) => h.slot));
  return subHits.filter((h) => !melodySlots.has(h.slot) || !grooveLabIsBassSubMidi(h.midi));
}

export function grooveComposerMergePart(
  existing: readonly GrooveRollHit[],
  part: GrooveComposerPart,
  generated: readonly GrooveRollHit[],
): GrooveRollHit[] {
  if (part === 'bass') {
    const keep = existing.filter((h) => !grooveLabIsBassSubMidi(h.midi));
    return [...keep, ...generated.filter((h) => grooveLabIsBassSubMidi(h.midi))];
  }
  return generated
    .filter((h) => grooveLabIsMelodyMidi(h.midi))
    .map((h) => ({ ...h, midi: grooveLabClampMelodyMidi(h.midi) }));
}
