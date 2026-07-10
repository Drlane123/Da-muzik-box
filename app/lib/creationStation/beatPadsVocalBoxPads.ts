/**
 * Beat Pads VocalBox — resolve kick / snare / hat / clap pad rows from lane labels.
 */
export type VocalBoxDrumRole = 'kick' | 'snare' | 'hat' | 'clap';

export const VOCALBOX_DRUM_ROLES: readonly VocalBoxDrumRole[] = ['kick', 'snare', 'hat', 'clap'] as const;

export type BeatPadsVocalBoxPadMap = {
  kick: number;
  snare: number;
  hat: number;
  clap: number;
};

const DEFAULT_PADS: BeatPadsVocalBoxPadMap = { kick: 0, snare: 1, hat: 3, clap: 2 };

function labelAt(labels: readonly string[], index: number): string {
  return (labels[index] ?? '').toLowerCase();
}

function findPad(labels: readonly string[], pred: (l: string) => boolean, fallback: number): number {
  for (let i = 0; i < labels.length; i += 1) {
    if (pred(labelAt(labels, i))) return i;
  }
  return fallback;
}

/** Map kit pad labels → kick / snare / hat / clap rows (trap-style fallbacks). */
export function beatPadsVocalBoxPadMapFromLabels(labels: readonly string[]): BeatPadsVocalBoxPadMap {
  if (labels.length === 0) return { ...DEFAULT_PADS };
  return {
    kick: findPad(
      labels,
      (l) =>
        l.includes('kick') ||
        l.includes('808') ||
        l.includes('sub') ||
        l.includes('bass drum') ||
        l.includes('bd'),
      DEFAULT_PADS.kick,
    ),
    snare: findPad(
      labels,
      (l) =>
        l.includes('snare') ||
        l.includes('snap') ||
        l.includes('rimshot') ||
        l.includes('rim') ||
        l.includes(' sd') ||
        l.startsWith('sd') ||
        l.includes('snr'),
      DEFAULT_PADS.snare,
    ),
    clap: findPad(
      labels,
      (l) => l.includes('clap') || l.includes('slap'),
      DEFAULT_PADS.clap,
    ),
    hat: findPad(
      labels,
      (l) =>
        l.includes('hat') ||
        l.includes('hh') ||
        l.includes('hihat') ||
        l.includes('hi-hat') ||
        l.includes('cym'),
      DEFAULT_PADS.hat,
    ),
  };
}
