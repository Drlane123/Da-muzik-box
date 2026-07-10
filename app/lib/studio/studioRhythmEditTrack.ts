/**
 * Studio Editor 2 — dedicated rhythm-edit lanes (hits-per-bar chord chopping).
 */

import {
  expandProgressionStepsForHits,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  progressionStepsToChordNotes,
  studioNormalizeHarmonyLoopBars,
  type StudioHarmonyLoopBars,
} from '@/app/lib/studio/studioInstrumentHarmony';

export type StudioRhythmEditTrack = {
  kind: 'midi' | 'audio' | 'a2m' | 'rhythm' | 'glideBass';
  rhythmSteps?: GrooveProgressionStep[];
  rhythmLoopBars?: StudioHarmonyLoopBars;
};

export function studioTrackIsRhythmChannel(tr: StudioRhythmEditTrack | undefined): boolean {
  return tr?.kind === 'rhythm';
}

/** Expand rhythm hits-per-bar, then map to editable piano-roll chord stacks. */
export function rhythmStepsToMidiNotes(
  steps: readonly GrooveProgressionStep[],
  opts: { beatsPerBar: number; barCount?: StudioHarmonyLoopBars },
) {
  const expanded = expandProgressionStepsForHits(steps);
  const barCount = studioNormalizeHarmonyLoopBars(opts.barCount);
  return progressionStepsToChordNotes(expanded, { beatsPerBar: opts.beatsPerBar, barCount });
}
