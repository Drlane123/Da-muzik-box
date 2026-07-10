/**
 * Geno Build 1 only — lyrical / transitional phrase shapes for the live melody lane.
 * (Geno Build 2 uses se2SynthGenoMelodyPhrases.ts — do not merge.)
 */
import type { GenoPhraseTemplate } from '@/app/lib/studio/se2SynthGenoPhraseHarmony';

/** Steady bar — sing over the current chord (3rd / 5th / 7th motion). */
const LIVE_STEADY: GenoPhraseTemplate[] = [
  {
    id: 'b01-lyric-arch',
    events: [
      { beat: 0, dur: 0.55, degrees: ['fifth'] },
      { beat: 0.75, dur: 0.45, degrees: ['third'] },
      { beat: 1.5, dur: 0.85, degrees: ['root'] },
      { beat: 2.5, dur: 0.65, degrees: ['third'] },
      { beat: 3.25, dur: 0.55, degrees: ['fifth'] },
    ],
  },
  {
    id: 'b01-lyric-float',
    events: [
      { beat: 0, dur: 0.65, degrees: ['third'] },
      { beat: 1.0, dur: 0.75, degrees: ['fifth'] },
      { beat: 2.0, dur: 0.7, degrees: ['seventh'] },
      { beat: 3.0, dur: 0.75, degrees: ['fifth'] },
    ],
  },
  {
    id: 'b01-lyric-answer',
    events: [
      { beat: 0, dur: 0.45, degrees: ['root'] },
      { beat: 0.65, dur: 0.55, degrees: ['third'] },
      { beat: 1.5, dur: 1.1, degrees: ['fifth'] },
      { beat: 3.0, dur: 0.65, degrees: ['third'] },
      { beat: 3.75, dur: 0.2, degrees: ['root'] },
    ],
  },
  {
    id: 'b01-lyric-hook',
    events: [
      { beat: 0, dur: 0.35, degrees: ['fifth'] },
      { beat: 0.5, dur: 0.4, degrees: ['seventh'] },
      { beat: 1.25, dur: 0.55, degrees: ['fifth'] },
      { beat: 2.0, dur: 0.65, degrees: ['third'] },
      { beat: 3.0, dur: 0.85, degrees: ['top'] },
    ],
  },
];

/** Bar before a chord change — passive anticipation into the next harmony. */
const LIVE_PASSING: GenoPhraseTemplate[] = [
  {
    id: 'b01-pass-lean',
    events: [
      { beat: 0, dur: 0.5, degrees: ['third'] },
      { beat: 0.85, dur: 0.55, degrees: ['fifth'] },
      { beat: 1.75, dur: 0.65, degrees: ['seventh'] },
      { beat: 2.75, dur: 0.5, degrees: ['fifth'] },
      { beat: 3.35, dur: 0.35, degrees: ['third'] },
      { beat: 3.72, dur: 0.22, degrees: ['root'] },
    ],
  },
  {
    id: 'b01-pass-sigh',
    events: [
      { beat: 0, dur: 0.75, degrees: ['fifth'] },
      { beat: 1.5, dur: 0.65, degrees: ['third'] },
      { beat: 2.5, dur: 0.55, degrees: ['seventh'] },
      { beat: 3.25, dur: 0.4, degrees: ['fifth'] },
      { beat: 3.65, dur: 0.28, degrees: ['third'] },
    ],
  },
  {
    id: 'b01-pass-step',
    events: [
      { beat: 0, dur: 0.45, degrees: ['root'] },
      { beat: 0.75, dur: 0.5, degrees: ['third'] },
      { beat: 1.5, dur: 0.7, degrees: ['fifth'] },
      { beat: 2.5, dur: 0.55, degrees: ['third'] },
      { beat: 3.25, dur: 0.35, degrees: ['fifth'] },
      { beat: 3.62, dur: 0.3, degrees: ['third'] },
    ],
  },
];

/** First bar on a new chord — transitional landing (common tone → color tones). */
const LIVE_TRANSITION: GenoPhraseTemplate[] = [
  {
    id: 'b01-trans-land',
    events: [
      { beat: 0, dur: 0.5, degrees: ['fifth'] },
      { beat: 0.7, dur: 0.45, degrees: ['third'] },
      { beat: 1.35, dur: 0.9, degrees: ['root'] },
      { beat: 2.5, dur: 0.6, degrees: ['third'] },
      { beat: 3.25, dur: 0.55, degrees: ['fifth'] },
    ],
  },
  {
    id: 'b01-trans-rise',
    events: [
      { beat: 0, dur: 0.4, degrees: ['third'] },
      { beat: 0.65, dur: 0.5, degrees: ['fifth'] },
      { beat: 1.35, dur: 0.75, degrees: ['seventh'] },
      { beat: 2.35, dur: 0.6, degrees: ['fifth'] },
      { beat: 3.15, dur: 0.55, degrees: ['third'] },
    ],
  },
  {
    id: 'b01-trans-resolve',
    events: [
      { beat: 0, dur: 0.55, degrees: ['seventh'] },
      { beat: 0.85, dur: 0.55, degrees: ['fifth'] },
      { beat: 1.5, dur: 1.0, degrees: ['third'] },
      { beat: 2.75, dur: 0.65, degrees: ['root'] },
      { beat: 3.5, dur: 0.35, degrees: ['third'] },
    ],
  },
  {
    id: 'b01-trans-common',
    events: [
      { beat: 0, dur: 0.6, degrees: ['fifth'] },
      { beat: 1.0, dur: 0.55, degrees: ['third'] },
      { beat: 1.75, dur: 0.75, degrees: ['root'] },
      { beat: 2.75, dur: 0.55, degrees: ['fifth'] },
      { beat: 3.4, dur: 0.45, degrees: ['seventh'] },
    ],
  },
];

/** Lush color tones — 9th / 11th tension over static harmony. */
const LIVE_COLOR: GenoPhraseTemplate[] = [
  {
    id: 'b01-color-lush',
    events: [
      { beat: 0.5, dur: 0.55, degrees: ['ninth'] },
      { beat: 1.33, dur: 0.5, degrees: ['fifth'] },
      { beat: 2.5, dur: 0.65, degrees: ['eleventh'] },
      { beat: 3.25, dur: 0.7, degrees: ['ninth'] },
    ],
  },
  {
    id: 'b01-color-sigh',
    events: [
      { beat: 0, dur: 0.6, degrees: ['third'] },
      { beat: 1.0, dur: 0.55, degrees: ['ninth'] },
      { beat: 2.0, dur: 0.75, degrees: ['fifth'] },
      { beat: 3.0, dur: 0.8, degrees: ['eleventh'] },
    ],
  },
  {
    id: 'b01-color-float',
    events: [
      { beat: 0.5, dur: 0.5, degrees: ['eleventh'] },
      { beat: 1.5, dur: 0.6, degrees: ['ninth'] },
      { beat: 2.5, dur: 0.55, degrees: ['seventh'] },
      { beat: 3.33, dur: 0.55, degrees: ['fifth'] },
    ],
  },
];

export function genoLiveMelodyPickPhraseForBar(opts: {
  loopBar: number;
  rnd: () => number;
  chordChanged: boolean;
  approachingChange: boolean;
  /** Steady bars — occasional 9th/11th color phrases. */
  colorPhrase?: boolean;
}): GenoPhraseTemplate {
  const pool = opts.approachingChange
    ? LIVE_PASSING
    : opts.chordChanged
      ? LIVE_TRANSITION
      : opts.colorPhrase
        ? LIVE_COLOR
        : LIVE_STEADY;
  const i = (opts.loopBar + Math.floor(opts.rnd() * pool.length)) % pool.length;
  return pool[i]!;
}
