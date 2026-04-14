/**
 * AI Pattern Generator — step-grid patterns for AI Pattern lanes (drums + melodic roles).
 *
 * **Primary path:** Magenta `MusicRNN` (drum_kit_rnn + basic_rnn checkpoints), lazy-loaded via
 * `magentaRnnPatterns.ts`. **Fallback:** style-aware procedural rules if the model fails, times out,
 * or returns an empty grid.
 *
 * **`@magenta/music`:** Kept as a **real dependency** in `package.json` (web + app stores).
 */

import { tryGenerateDrumPatternWithMagenta, tryGenerateMelodyPatternWithMagenta } from '@/app/lib/magentaRnnPatterns';

const ROWS = 8;
const DEFAULT_STEPS = 16;
const KICK = 0;
const SNARE = 1;
const CLAP = 2;
const HAT = 3;

/** Deterministic PRNG (Mulberry32). */
export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

/** Map UI style string to internal drum recipe id. */
export function normalizeDrumStyle(style: string): string {
  const s = style.toLowerCase().trim();
  if (/(trap|drill|arpeggio)/.test(s)) return 'trap';
  if (/boom\s*bap|boombap/.test(s)) return 'boombap';
  if (/lo-?fi|lofi/.test(s)) return 'lofi';
  if (/disco/.test(s)) return 'disco';
  if (/house/.test(s)) return 'house';
  if (/techno|industrial/.test(s)) return 'techno';
  if (/jazz/.test(s)) return 'swingish';
  if (/southern/.test(s)) return 'southern';
  if (/soul/.test(s)) return 'soul';
  if (/r&b|rnb/.test(s)) return 'rnb';
  if (/blues/.test(s)) return 'blues';
  if (/doo\s*wop|doowop/.test(s)) return 'doowop';
  if (/country/.test(s)) return 'train';
  if (/cinematic/.test(s)) return 'cinematic';
  if (/dark/.test(s)) return 'dark';
  if (/(afro|latin|dembow)/.test(s)) return 'syncopated';
  return 'trap';
}

type DrumRecipeKey = ReturnType<typeof normalizeDrumStyle>;

function placeKick(step: number, recipe: DrumRecipeKey, rng: () => number): boolean {
  const m = step % 16;
  switch (recipe) {
    case 'boombap':
      return m === 0 || m === 10 || (m === 6 && rng() > 0.55);
    case 'lofi':
      return m === 0 || (m === 8 && rng() > 0.35) || (m === 11 && rng() > 0.7);
    case 'house':
      return m % 4 === 0;
    case 'disco':
      return m % 4 === 0 || (m % 4 === 2 && rng() > 0.4);
    case 'techno':
      return m === 0 || m === 7 || m === 8 || (m % 2 === 0 && rng() > 0.55);
    case 'swingish':
      return m === 0 || m === 6 || m === 10 || (m === 14 && rng() > 0.5);
    case 'southern':
    case 'soul':
    case 'rnb':
      return m === 0 || m === 8 || (m === 5 && rng() > 0.45) || (m === 12 && rng() > 0.55);
    case 'blues':
    case 'doowop':
      return m === 0 || m === 8 || (m === 4 && rng() > 0.6);
    case 'train':
      return m === 0 || m === 8 || (m % 2 === 0 && rng() > 0.75);
    case 'cinematic':
      return m === 0 || (m === 12 && rng() > 0.4);
    case 'dark':
      return (m === 0 || m === 9) && rng() > 0.15;
    case 'syncopated':
      return m === 0 || m === 3 || m === 8 || m === 11 || (m === 6 && rng() > 0.5);
    case 'trap':
    default:
      return m === 0 || m === 8 || (m === 10 && rng() > 0.4) || (m === 14 && rng() > 0.65);
  }
}

function placeSnare(step: number, recipe: DrumRecipeKey, rng: () => number): boolean {
  const m = step % 16;
  if (recipe === 'swingish') return m === 4 || m === 12 || (m === 6 && rng() > 0.75);
  if (recipe === 'techno') return m === 4 || m === 12 || (rng() > 0.82 && m % 4 === 2);
  if (recipe === 'dark') return (m === 4 || m === 12) && rng() > 0.25;
  return m === 4 || m === 12 || (recipe === 'trap' && m === 7 && rng() > 0.65);
}

function placeClap(step: number, recipe: DrumRecipeKey, rng: () => number): boolean {
  const m = step % 16;
  if (recipe === 'house' || recipe === 'disco') return m === 4 || m === 12 || (m === 8 && rng() > 0.7);
  return (m === 4 || m === 12) && rng() > 0.45;
}

function placeHat(step: number, recipe: DrumRecipeKey, tight: number, rng: () => number): boolean {
  const m = step % 16;
  const t = Math.max(0.35, Math.min(1.35, tight));
  if (recipe === 'house' || recipe === 'fourfloor' || recipe === 'disco') {
    return step % 2 === 0 && rng() > 0.08 / t;
  }
  if (recipe === 'techno') {
    return rng() > 0.12 / t;
  }
  if (recipe === 'lofi') {
    return (step % 4 === 2 || step % 8 === 1) && rng() > 0.35 / t;
  }
  if (recipe === 'trap' || recipe === 'syncopated') {
    const roll = rng() > 0.55 / t;
    return (m % 2 === 1 && rng() > 0.18 / t) || roll;
  }
  return rng() > 0.42 / t;
}

function drumGridForRecipe(
  recipe: DrumRecipeKey,
  steps: number,
  temperature: number,
  rng: () => number,
): boolean[][] {
  const tight = 1.1 + (temperature - 1) * 0.35;
  return Array.from({ length: ROWS }, (_, ri) =>
    Array.from({ length: steps }, (_, ci) => {
      if (ri === KICK) return placeKick(ci, recipe, rng);
      if (ri === SNARE) return placeSnare(ci, recipe, rng);
      if (ri === CLAP) return placeClap(ci, recipe, rng);
      if (ri === HAT) return placeHat(ci, recipe, tight, rng);
      if (ri === 4 || ri === 5) return rng() > 0.88;
      if (ri === 6 || ri === 7) return rng() > 0.92;
      return rng() > 0.9;
    }),
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

export function generateArpeggioPattern(style: string = 'balanced'): boolean[][] {
  const patterns: Record<string, boolean[][]> = {
    up: Array.from({ length: ROWS }, (_, ri) =>
      Array.from({ length: 16 }, (_, ci) => {
        const beatPos = ci % 4;
        return beatPos === ri % 4;
      }),
    ),
    down: Array.from({ length: ROWS }, (_, ri) =>
      Array.from({ length: 16 }, (_, ci) => {
        const beatPos = ci % 4;
        return beatPos === ((3 - (ri % 4)) % 4);
      }),
    ),
    updown: Array.from({ length: ROWS }, (_, ri) =>
      Array.from({ length: 16 }, (_, ci) => {
        const beatPos = ci % 8;
        if (beatPos < 4) return beatPos === ri % 4;
        return beatPos - 4 === ((3 - (ri % 4)) % 4);
      }),
    ),
    random: Array.from({ length: ROWS }, () =>
      Array.from({ length: 16 }, () => Math.random() > 0.65),
    ),
  };
  return patterns[style] ?? patterns.up;
}

export function generateRandomPattern(steps: number = 16, seed?: number): boolean[][] {
  const rng = mulberry32(seed ?? (Date.now() ^ (Math.random() * 1e9)));
  return Array.from({ length: ROWS }, (_, ri) =>
    Array.from({ length: steps }, (_, ci) => {
      if (ri === KICK) return ci === 0 || ci === 8 || rng() > 0.88;
      if (ri === SNARE) return ci === 4 || ci === 12;
      if (ri === HAT) return ci % 2 === 0 && rng() > 0.35;
      return rng() > 0.78;
    }),
  );
}

export async function generateDrumPattern(
  style?: string,
  temperature: number = 1.2,
  seed?: number,
): Promise<boolean[][]> {
  const recipe = normalizeDrumStyle(style ?? 'trap');
  const s = seed ?? mixSeed([style ?? '', temperature, Date.now()]);
  const rng = mulberry32(s);
  await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  const fromMagenta = await tryGenerateDrumPatternWithMagenta(recipe, temperature, rng);
  if (fromMagenta) return fromMagenta;
  return drumGridForRecipe(recipe, DEFAULT_STEPS, temperature, rng);
}

/** Row activity bias: which rows (0–7) are allowed for this instrument role. */
function melodyRowMask(instrument: string): boolean[] {
  const ins = instrument.toLowerCase();
  const all = Array.from({ length: ROWS }, () => true);
  if (ins.includes('bass')) return [true, true, false, false, false, false, false, false];
  if (ins.includes('pad')) return [false, false, false, false, true, true, true, true];
  if (ins.includes('lead')) return [false, false, false, false, true, true, true, true];
  if (ins.includes('pluck') || ins.includes('muted guitar'))
    return [false, false, false, false, true, true, true, false];
  if (ins.includes('string') || ins.includes('brass'))
    return [false, false, false, false, true, true, true, true];
  if (ins.includes('percussion')) return [true, true, true, true, false, false, false, false];
  return all;
}

function normalizeMelodyStyle(style?: string): string {
  const s = (style ?? '').toLowerCase();
  if (/(trap|dark|techno)/.test(s)) return 'denseoff';
  if (/(jazz|soul|rnb|blues|lo-?fi|lofi)/.test(s)) return 'sparse';
  if (/(house|disco)/.test(s)) return 'pulse';
  return 'balanced';
}

export async function generateMelodyPattern(
  instrument: string,
  style?: string,
  temperature: number = 1.0,
  seed?: number,
): Promise<boolean[][]> {
  const ms = normalizeMelodyStyle(style);
  const mask = melodyRowMask(instrument);
  const dens = Math.max(0.15, Math.min(0.7, 0.32 + (temperature - 1) * 0.12 + (ms === 'denseoff' ? 0.08 : 0)));
  const s = seed ?? mixSeed([instrument, style ?? '', temperature, Date.now()]);
  const rng = mulberry32(s);

  await new Promise((r) => requestAnimationFrame(() => r(undefined)));

  const fromMagenta = await tryGenerateMelodyPatternWithMagenta(instrument, style, temperature, rng);
  if (fromMagenta) return fromMagenta;

  return Array.from({ length: ROWS }, (_, ri) => {
    if (!mask[ri]) {
      return Array.from({ length: DEFAULT_STEPS }, () => false);
    }
    return Array.from({ length: DEFAULT_STEPS }, (_, ci) => {
      const isDown = ci % 4 === 0;
      const isOff = ci % 4 === 2;
      let p = dens;
      if (ms === 'sparse') p *= isDown ? 1.25 : 0.55;
      if (ms === 'pulse') p *= isDown || ci % 4 === 2 ? 1.15 : 0.45;
      if (ms === 'denseoff') p *= isOff ? 1.2 : 0.95;
      if (isDown && ri >= 4) p += 0.12;
      p = Math.max(0.05, Math.min(0.92, p));
      return rng() < p;
    });
  });
}
