/**
 * Groove Lead phrase generator — chord-locked (Groove chord → lead on piano roll).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  grooveComposerHarmonyFromChordHits,
  type GrooveComposerPart,
} from '@/app/lib/creationStation/grooveComposerEngine';
import { generateWaveLeafMelodyPart } from '@/app/lib/creationStation/waveLeafMelodyEngine';
import { inferWaveLeafKeyFromChordHits } from '@/app/lib/creationStation/waveLeafKeyLock';
import { grooveLabClampBassRootMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  grooveLabChordAnchorsFromHits,
  grooveLabChordHitsForBarLeadLock,
  grooveLabInferComposerBarCount,
  sanitizeGrooveLabChordChannelHits,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import type { WaveLeafMelodyStyleDef } from '@/app/lib/creationStation/waveLeafMelodyStyles';
import { waveLeafPrepareRollHits } from '@/app/lib/creationStation/waveLeafPitch';

export type GenerateWaveLeafPhraseParams = {
  chordHits: readonly GrooveRollHit[];
  barCount: number;
  quantize: GrooveLabQuantize;
  keyRoot: number;
  mode: ChordMode;
  seed: number;
  style: WaveLeafMelodyStyleDef;
  /** Overrides style when set (Free mode tweaks). */
  movement?: number;
  chordFit?: number;
  part?: GrooveComposerPart;
  phraseGrid?: boolean;
  rate?: GrooveLabQuantize;
  complexity?: number;
  bpm?: number;
  /** Bass / keypad root for harmony column inference (not lead register). */
  bassRootMidi?: number;
  /** Keep complete melodic phrases (Studio Editor 2 piano roll). */
  fullPhrase?: boolean;
};

/** How many chord columns the lead generator can lock to. */
export function waveLeafMelodyGenColumnCount(
  chordHits: readonly GrooveRollHit[],
  opts: { barCount: number; keyRoot: number; mode: ChordMode; bassRootMidi: number },
): number {
  const lockHits = grooveLabChordHitsForBarLeadLock(chordHits);
  const lane = sanitizeGrooveLabChordChannelHits([...lockHits], opts.barCount);
  if (lane.length === 0) return 0;
  return grooveLabChordAnchorsFromHits(lane, {
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    referenceMidi: grooveLabClampBassRootMidi(opts.bassRootMidi),
  }).length;
}

export function generateWaveLeafPhraseFromChords(params: GenerateWaveLeafPhraseParams): {
  hits: GrooveRollHit[];
  loopBars: number;
  chordColumns: number;
} {
  const harmonyRef = grooveLabClampBassRootMidi(params.bassRootMidi ?? 36);
  const lockedKey = inferWaveLeafKeyFromChordHits(
    params.chordHits,
    params.keyRoot,
    params.mode,
  );
  const lockHits = grooveLabChordHitsForBarLeadLock(params.chordHits, {
    quantize: params.quantize,
  });
  const harmony = grooveComposerHarmonyFromChordHits(lockHits, {
    keyRoot: lockedKey.keyRoot,
    mode: lockedKey.mode,
    referenceMidi: harmonyRef,
  });
  const chordColumns = harmony.columns.length;
  if (chordColumns === 0) {
    return { hits: [], loopBars: params.barCount, chordColumns: 0 };
  }

  const movement = params.movement ?? params.style.movement;
  const part = params.part ?? params.style.part;
  const rate = params.rate ?? params.style.rate;
  const chordFit = params.chordFit ?? params.style.chordFit;
  const phraseGrid = params.phraseGrid ?? params.style.phraseGrid;
  const complexity = params.complexity ?? params.style.complexity * (0.65 + movement * 0.5);
  const loopBars = grooveLabInferComposerBarCount(params.chordHits, params.barCount);
  const raw = generateWaveLeafMelodyPart({
    part,
    harmony,
    barCount: loopBars,
    quantize: params.quantize,
    keyRoot: lockedKey.keyRoot,
    mode: lockedKey.mode,
    complexity: Math.max(0.15, Math.min(0.95, complexity)),
    seed: params.seed,
    rates: { melody: rate, riff: rate, arp: rate },
    movement,
    chordHits: lockHits,
    chordFit,
    phraseGrid,
    fullPhrase: params.fullPhrase,
  });

  return {
    hits: waveLeafPrepareRollHits(raw, loopBars),
    loopBars,
    chordColumns,
  };
}
