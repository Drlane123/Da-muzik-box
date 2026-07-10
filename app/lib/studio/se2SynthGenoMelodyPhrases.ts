/**
 * SongEngine-style melodic phrase presets — sparse, lyrical, polyphonic hooks.
 * Each template is authored in 4/4; degrees adapt to the bar's voiced chord.
 */
import type { GenoPhraseTemplate } from '@/app/lib/studio/se2SynthGenoPhraseHarmony';

const popPhrases: GenoPhraseTemplate[] = [
  {
    id: 'pop-lift',
    events: [
      { beat: 0, dur: 1.0, degrees: ['root'] },
      { beat: 1.25, dur: 0.75, degrees: ['third'] },
      { beat: 2.25, dur: 1.0, degrees: ['fifth', 'third'] },
      { beat: 3.5, dur: 0.5, degrees: ['seventh'] },
    ],
  },
  {
    id: 'pop-answer',
    events: [
      { beat: 0, dur: 0.5, degrees: ['fifth'] },
      { beat: 0.75, dur: 0.5, degrees: ['third'] },
      { beat: 1.5, dur: 1.75, degrees: ['root', 'third'] },
      { beat: 3.5, dur: 0.45, degrees: ['root'] },
    ],
  },
  {
    id: 'pop-arch',
    events: [
      { beat: 0, dur: 0.75, degrees: ['root'] },
      { beat: 1.0, dur: 0.5, degrees: ['third'] },
      { beat: 1.75, dur: 0.75, degrees: ['fifth'] },
      { beat: 2.75, dur: 0.75, degrees: ['top'] },
      { beat: 3.75, dur: 0.25, degrees: ['fifth'] },
    ],
  },
  {
    id: 'pop-sync',
    events: [
      { beat: 0, dur: 0.35, degrees: ['root'] },
      { beat: 0.75, dur: 0.65, degrees: ['third', 'fifth'] },
      { beat: 2.0, dur: 0.5, degrees: ['fifth'] },
      { beat: 2.75, dur: 1.0, degrees: ['third'] },
    ],
  },
];

const rnbPhrases: GenoPhraseTemplate[] = [
  {
    id: 'rnb-soul',
    events: [
      { beat: 0, dur: 0.5, degrees: ['root'] },
      { beat: 0.75, dur: 1.25, degrees: ['third'] },
      { beat: 2.25, dur: 0.75, degrees: ['fifth', 'third'] },
      { beat: 3.25, dur: 0.65, degrees: ['seventh'] },
    ],
  },
  {
    id: 'rnb-turn',
    events: [
      { beat: 0, dur: 0.35, degrees: ['fifth'] },
      { beat: 0.5, dur: 0.5, degrees: ['third'] },
      { beat: 1.25, dur: 1.5, degrees: ['root'] },
      { beat: 3.0, dur: 0.75, degrees: ['third', 'root'] },
    ],
  },
  {
    id: 'rnb-float',
    events: [
      { beat: 0, dur: 1.5, degrees: ['third'] },
      { beat: 2.0, dur: 0.75, degrees: ['fifth'] },
      { beat: 3.0, dur: 0.85, degrees: ['seventh', 'fifth'] },
    ],
  },
];

const trapPhrases: GenoPhraseTemplate[] = [
  {
    id: 'trap-space',
    events: [
      { beat: 0, dur: 0.35, degrees: ['root'] },
      { beat: 1.5, dur: 0.45, degrees: ['fifth'] },
      { beat: 3.0, dur: 0.55, degrees: ['third'] },
    ],
  },
  {
    id: 'trap-hook',
    events: [
      { beat: 0, dur: 0.25, degrees: ['root'] },
      { beat: 2.0, dur: 0.35, degrees: ['fifth', 'root'] },
      { beat: 3.25, dur: 0.4, degrees: ['third'] },
    ],
  },
];

const gospelPhrases: GenoPhraseTemplate[] = [
  {
    id: 'gospel-call',
    events: [
      { beat: 0, dur: 0.5, degrees: ['root', 'third'] },
      { beat: 1.0, dur: 0.75, degrees: ['fifth'] },
      { beat: 2.0, dur: 0.75, degrees: ['seventh'] },
      { beat: 3.0, dur: 0.85, degrees: ['top', 'seventh'] },
    ],
  },
  {
    id: 'gospel-response',
    events: [
      { beat: 0, dur: 0.65, degrees: ['fifth'] },
      { beat: 1.25, dur: 1.0, degrees: ['third', 'root'] },
      { beat: 2.75, dur: 1.0, degrees: ['root'] },
    ],
  },
];

const brightPhrases: GenoPhraseTemplate[] = [
  {
    id: 'bright-leap',
    events: [
      { beat: 0, dur: 0.5, degrees: ['third'] },
      { beat: 0.75, dur: 0.5, degrees: ['fifth'] },
      { beat: 1.5, dur: 0.75, degrees: ['top'] },
      { beat: 2.5, dur: 0.75, degrees: ['seventh', 'fifth'] },
      { beat: 3.5, dur: 0.45, degrees: ['fifth'] },
    ],
  },
];

const darkPhrases: GenoPhraseTemplate[] = [
  {
    id: 'dark-minor',
    events: [
      { beat: 0, dur: 1.25, degrees: ['root'] },
      { beat: 1.5, dur: 0.75, degrees: ['third'] },
      { beat: 2.75, dur: 0.65, degrees: ['fifth'] },
    ],
  },
];

const kpopPhrases: GenoPhraseTemplate[] = [
  {
    id: 'kpop-hook',
    events: [
      { beat: 0, dur: 0.35, degrees: ['root'] },
      { beat: 0.5, dur: 0.35, degrees: ['third'] },
      { beat: 1.0, dur: 0.35, degrees: ['fifth'] },
      { beat: 1.5, dur: 0.75, degrees: ['top', 'fifth'] },
      { beat: 2.75, dur: 0.5, degrees: ['seventh'] },
      { beat: 3.5, dur: 0.4, degrees: ['fifth'] },
    ],
  },
];

const MELODY_PHRASES: Record<string, GenoPhraseTemplate[]> = {
  pop: popPhrases,
  lyrical: popPhrases,
  major: popPhrases,
  rnb: rnbPhrases,
  rnbFunk: rnbPhrases,
  gospel: gospelPhrases,
  trap: trapPhrases,
  riff: trapPhrases,
  dark: darkPhrases,
  minor: darkPhrases,
  bright: brightPhrases,
  kpop: kpopPhrases,
  dance: brightPhrases,
  disco: brightPhrases,
};

export function genoMelodyPhraseTemplates(genre: string): GenoPhraseTemplate[] {
  return MELODY_PHRASES[genre] ?? popPhrases;
}

export function genoMelodyPickPhraseTemplate(
  genre: string,
  bar: number,
  rnd: () => number,
): GenoPhraseTemplate {
  const pool = genoMelodyPhraseTemplates(genre);
  const phraseLine = Math.floor(bar / 2) + Math.floor(rnd() * pool.length);
  return pool[phraseLine % pool.length]!;
}
