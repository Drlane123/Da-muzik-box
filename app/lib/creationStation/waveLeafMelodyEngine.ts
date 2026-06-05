/**
 * Groove Lead — chord-locked phrases; final pass snaps every note to green-stack pitch classes.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveComposerHarmony } from '@/app/lib/creationStation/grooveLabComposerTypes';
import type { GrooveComposerPart } from '@/app/lib/creationStation/grooveComposerEngine';
import {
  lockWaveLeafLaneToGreenStack,
  waveLeafComplimentEveryChordColumn,
} from '@/app/lib/creationStation/waveLeafChordLock';
import {
  generateGrooveMelodyPart,
  type GrooveMelodyGenPart,
} from '@/app/lib/creationStation/grooveLabMelodyEngine';
import type { GrooveLabQuantize, GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';
import { WAVE_LEAF_REFERENCE_MIDI, waveLeafClampMidi } from '@/app/lib/creationStation/waveLeafPitch';

export type GenerateWaveLeafMelodyParams = {
  part: GrooveComposerPart;
  harmony: GrooveComposerHarmony;
  barCount: number;
  quantize: GrooveLabQuantize;
  keyRoot: number;
  mode: ChordMode;
  complexity: number;
  seed: number;
  rates?: Partial<Record<'melody' | 'riff' | 'arp', GrooveLabQuantize>>;
  movement: number;
  chordHits: readonly GrooveRollHit[];
  /** 0–1 — higher = stricter stack lock on phrase pick (always hard-snaps at end). */
  chordFit?: number;
  phraseGrid?: boolean;
};

export function generateWaveLeafMelodyPart(params: GenerateWaveLeafMelodyParams): GrooveRollHit[] {
  const {
    part,
    harmony,
    barCount,
    quantize,
    keyRoot,
    mode,
    complexity,
    seed,
    rates,
    chordHits,
    chordFit = 0.92,
    phraseGrid = true,
  } = params;
  if (harmony.columns.length === 0 || chordHits.length === 0) return [];

  const genPart = part as GrooveMelodyGenPart;
  const usePhraseGrid =
    phraseGrid && chordFit < 0.95 && (genPart === 'arp' ? false : genPart === 'melody' || genPart === 'riff');

  const raw = generateGrooveMelodyPart({
    part: genPart,
    harmony,
    barCount,
    quantize,
    keyRoot,
    mode,
    referenceMidi: WAVE_LEAF_REFERENCE_MIDI,
    complexity,
    seed,
    rates,
    melodyGridEnabled: genPart === 'melody' ? usePhraseGrid : undefined,
    riffGridEnabled: genPart === 'riff' ? usePhraseGrid : undefined,
    stackChordTonesOnly: true,
    chordHitsForLock: chordHits,
    stackLockMaxLeap: chordFit >= 0.8 ? 3 : 4,
  });

  let lane = lockWaveLeafLaneToGreenStack(
    raw.map((h) => ({ ...h, midi: waveLeafClampMidi(h.midi) })),
    chordHits,
    harmony,
  );
  lane = waveLeafComplimentEveryChordColumn(lane, chordHits, harmony);
  lane = lockWaveLeafLaneToGreenStack(lane, chordHits, harmony);

  const bySlot = new Map<number, GrooveRollHit>();
  for (const h of lane) {
    const prev = bySlot.get(h.slot);
    if (!prev || h.midi > prev.midi) bySlot.set(h.slot, h);
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
}
