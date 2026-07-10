/**
 * SongEngine-style arp figures — dense rhythmic presets, separate from melody phrases.
 */
import type { GenoPhraseTemplate } from '@/app/lib/studio/se2SynthGenoPhraseHarmony';
import type { GenoLiveArpPattern, GenoLiveArpRate } from '@/app/lib/studio/se2SynthGenoLiveArpTypes';

const albertiFigure: GenoPhraseTemplate = {
  id: 'arp-alberti',
  events: [
    { beat: 0, dur: 0.22, degrees: ['root'], vel: 74 },
    { beat: 0.25, dur: 0.22, degrees: ['fifth'], vel: 68 },
    { beat: 0.5, dur: 0.22, degrees: ['third'], vel: 70 },
    { beat: 0.75, dur: 0.22, degrees: ['fifth'], vel: 68 },
    { beat: 1.0, dur: 0.22, degrees: ['root'], vel: 74 },
    { beat: 1.25, dur: 0.22, degrees: ['fifth'], vel: 68 },
    { beat: 1.5, dur: 0.22, degrees: ['third'], vel: 70 },
    { beat: 1.75, dur: 0.22, degrees: ['fifth'], vel: 68 },
    { beat: 2.0, dur: 0.22, degrees: ['root'], vel: 76 },
    { beat: 2.25, dur: 0.22, degrees: ['fifth'], vel: 68 },
    { beat: 2.5, dur: 0.22, degrees: ['third'], vel: 70 },
    { beat: 2.75, dur: 0.22, degrees: ['fifth'], vel: 68 },
    { beat: 3.0, dur: 0.22, degrees: ['root'], vel: 74 },
    { beat: 3.25, dur: 0.22, degrees: ['seventh'], vel: 72 },
    { beat: 3.5, dur: 0.22, degrees: ['fifth'], vel: 70 },
    { beat: 3.75, dur: 0.22, degrees: ['third'], vel: 68 },
  ],
};

const cascadeFigure: GenoPhraseTemplate = {
  id: 'arp-cascade',
  events: [
    { beat: 0, dur: 0.18, degrees: ['root'], vel: 76 },
    { beat: 0.25, dur: 0.18, degrees: ['third'], vel: 72 },
    { beat: 0.5, dur: 0.18, degrees: ['fifth'], vel: 74 },
    { beat: 0.75, dur: 0.35, degrees: ['seventh'], vel: 78 },
    { beat: 1.25, dur: 0.18, degrees: ['fifth'], vel: 72 },
    { beat: 1.5, dur: 0.18, degrees: ['third'], vel: 70 },
    { beat: 1.75, dur: 0.18, degrees: ['root'], vel: 74 },
    { beat: 2.0, dur: 0.18, degrees: ['third'], vel: 72 },
    { beat: 2.25, dur: 0.18, degrees: ['fifth'], vel: 74 },
    { beat: 2.5, dur: 0.35, degrees: ['top'], vel: 80 },
    { beat: 3.0, dur: 0.18, degrees: ['seventh'], vel: 74 },
    { beat: 3.25, dur: 0.18, degrees: ['fifth'], vel: 72 },
    { beat: 3.5, dur: 0.35, degrees: ['root', 'fifth'], vel: 76 },
  ],
};

const gospelRunFigure: GenoPhraseTemplate = {
  id: 'arp-gospel-run',
  events: [
    { beat: 0, dur: 0.15, degrees: ['root', 'third'], vel: 78 },
    { beat: 0.33, dur: 0.15, degrees: ['third'], vel: 72 },
    { beat: 0.66, dur: 0.15, degrees: ['fifth'], vel: 74 },
    { beat: 1.0, dur: 0.15, degrees: ['seventh'], vel: 76 },
    { beat: 1.33, dur: 0.15, degrees: ['top'], vel: 78 },
    { beat: 1.66, dur: 0.15, degrees: ['seventh'], vel: 74 },
    { beat: 2.0, dur: 0.15, degrees: ['fifth'], vel: 72 },
    { beat: 2.33, dur: 0.15, degrees: ['third'], vel: 70 },
    { beat: 2.66, dur: 0.15, degrees: ['root'], vel: 74 },
    { beat: 3.0, dur: 0.2, degrees: ['third', 'fifth'], vel: 76 },
    { beat: 3.5, dur: 0.25, degrees: ['root'], vel: 80 },
  ],
};

const rootPulseFigure: GenoPhraseTemplate = {
  id: 'arp-root-pulse',
  events: [
    { beat: 0, dur: 0.35, degrees: ['root'], vel: 82 },
    { beat: 0.5, dur: 0.28, degrees: ['root'], vel: 70 },
    { beat: 1.0, dur: 0.35, degrees: ['root', 'fifth'], vel: 78 },
    { beat: 1.5, dur: 0.28, degrees: ['root'], vel: 68 },
    { beat: 2.0, dur: 0.35, degrees: ['root'], vel: 80 },
    { beat: 2.5, dur: 0.28, degrees: ['root'], vel: 70 },
    { beat: 3.0, dur: 0.45, degrees: ['root', 'third'], vel: 84 },
  ],
};

const syncPopFigure: GenoPhraseTemplate = {
  id: 'arp-sync-pop',
  events: [
    { beat: 0, dur: 0.2, degrees: ['root'], vel: 74 },
    { beat: 0.5, dur: 0.2, degrees: ['third'], vel: 70 },
    { beat: 0.75, dur: 0.2, degrees: ['fifth'], vel: 72 },
    { beat: 1.0, dur: 0.2, degrees: ['third'], vel: 70 },
    { beat: 1.5, dur: 0.2, degrees: ['fifth'], vel: 74 },
    { beat: 2.0, dur: 0.2, degrees: ['seventh'], vel: 76 },
    { beat: 2.5, dur: 0.2, degrees: ['fifth'], vel: 72 },
    { beat: 3.0, dur: 0.2, degrees: ['third'], vel: 70 },
    { beat: 3.25, dur: 0.2, degrees: ['root'], vel: 74 },
    { beat: 3.5, dur: 0.35, degrees: ['root', 'fifth'], vel: 78 },
  ],
};

const sparseEighthFigure: GenoPhraseTemplate = {
  id: 'arp-sparse-8',
  events: [
    { beat: 0, dur: 0.38, degrees: ['root'], vel: 76 },
    { beat: 1.0, dur: 0.38, degrees: ['third'], vel: 72 },
    { beat: 2.0, dur: 0.38, degrees: ['fifth'], vel: 74 },
    { beat: 3.0, dur: 0.38, degrees: ['seventh'], vel: 76 },
  ],
};

const CHORD_FIGURES: GenoPhraseTemplate[] = [
  albertiFigure,
  cascadeFigure,
  gospelRunFigure,
  syncPopFigure,
];

const ROOT_FIGURES: GenoPhraseTemplate[] = [rootPulseFigure, sparseEighthFigure];

const UP_FIGURES: GenoPhraseTemplate[] = [cascadeFigure, syncPopFigure];

const DOWN_FIGURES: GenoPhraseTemplate[] = [
  {
    id: 'arp-descend',
    events: [...cascadeFigure.events].reverse().map((ev, i) => ({
      ...ev,
      beat: i * 0.25,
    })),
  },
];

const UPDOWN_FIGURES: GenoPhraseTemplate[] = [gospelRunFigure, albertiFigure];

function figuresForPattern(pattern: GenoLiveArpPattern): GenoPhraseTemplate[] {
  switch (pattern) {
    case 'root':
      return ROOT_FIGURES;
    case 'up':
      return UP_FIGURES;
    case 'down':
      return DOWN_FIGURES;
    case 'up-down':
      return UPDOWN_FIGURES;
    case 'chord':
    default:
      return CHORD_FIGURES;
  }
}

export function genoArpPickFigure(
  pattern: GenoLiveArpPattern,
  rate: GenoLiveArpRate,
  bar: number,
  rnd: () => number,
): GenoPhraseTemplate {
  const pool = figuresForPattern(pattern);
  const base = pool[(bar + Math.floor(rnd() * pool.length)) % pool.length]!;
  if (rate !== '8th') return base;

  return {
    id: `${base.id}-8th`,
    events: base.events.filter((_, i) => i % 2 === 0),
  };
}

export function genoArpDirectionForPattern(
  pattern: GenoLiveArpPattern,
): 'up' | 'down' | 'up-down' | 'hold' {
  if (pattern === 'up') return 'up';
  if (pattern === 'down') return 'down';
  if (pattern === 'up-down') return 'up-down';
  return 'hold';
}
