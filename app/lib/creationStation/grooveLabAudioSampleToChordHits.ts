/**
 * Audio sample → green chord roll (Harmony Match / Chord Builder FILE flow).
 * Monophonic pitch track → bar chords → progression steps → stacked GrooveRollHit[].
 */
import { chordSymbolToName, type ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  analyzeMelodyToProgressions,
  expandProgressionToBars,
  extractPitchEventsFromAudioBuffer,
} from '@/app/lib/creationStation/melodyToChordProgression';
import {
  newProgressionStepId,
  progressionStepsToGrooveHits,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import type { GrooveLabBarCount, GrooveLabQuantize, GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

export type GrooveLabSampleToChordHitsResult =
  | {
      hits: GrooveRollHit[];
      keyRoot: number;
      mode: ChordMode;
      barCount: GrooveLabBarCount;
      label: string;
    }
  | { error: string };

export function grooveLabChordHitsFromAudioSample(
  buffer: AudioBuffer,
  opts: {
    bpm: number;
    quantize: GrooveLabQuantize;
    barCount: GrooveLabBarCount;
    sustainSlots: number;
    keyRoot?: number;
    mode?: ChordMode;
  },
): GrooveLabSampleToChordHitsResult {
  const events = extractPitchEventsFromAudioBuffer(buffer);
  if (events.length < 8) {
    return {
      error: 'Not enough pitch in that sample — use a clear chord loop or strum (3+ seconds).',
    };
  }

  const analysis = analyzeMelodyToProgressions(events, opts.bpm, {
    keyRootHint: opts.keyRoot,
    modeHint: opts.mode,
    maxBars: opts.barCount,
    topK: 4,
  });
  if (!analysis || analysis.candidates.length === 0) {
    return { error: 'Could not read chords from that audio — try another take or a cleaner loop.' };
  }

  const best = analysis.candidates[0]!;
  const tiled = expandProgressionToBars(best.chords, analysis.barCount);
  const steps: GrooveProgressionStep[] = tiled.map((sym) => ({
    id: newProgressionStepId(),
    label: chordSymbolToName(sym, analysis.keyRoot, analysis.mode),
    beats: 4,
  }));

  const built = progressionStepsToGrooveHits(steps, {
    quantize: opts.quantize,
    barCount: Math.max(opts.barCount, analysis.barCount) as GrooveLabBarCount,
    sustainSlots: opts.sustainSlots,
  });
  if ('message' in built) {
    return { error: built.message };
  }

  return {
    hits: built.chordHits,
    keyRoot: analysis.keyRoot,
    mode: analysis.mode,
    barCount: built.barCount,
    label: best.label,
  };
}
