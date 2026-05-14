/**
 * AI Pattern Generator — step-grid patterns for AI Pattern lanes.
 *
 * PRIMARY PATH: `patternPresets.ts` — every call to generateDrumPattern /
 * generateMelodyPattern picks from the hand-crafted preset library first.
 * Temperature controls how much "variation" is added on top of the base
 * preset (random ghost notes, minor step tweaks) so re-generating gives
 * a fresh variation of the same musical idea rather than a random mess.
 *
 * Fallback: `groovePatternEngine.ts` for instruments with no matching
 * presets (e.g. very unusual style combos).
 */

import {
  getPresetsForGenerate,
  instrumentToPresetRole,
} from '@/app/lib/patternPresets';
import type { PatternPreset } from '@/app/lib/patternPresets';

import {
  generateDrumGroove,
  generateBassPattern,
  generateMelodyPattern as generateMelodyFromGroove,
  generatePadPattern,
  classifyInstrument,
  mixSeed as mixSeedShared,
  mulberry32 as mulberry32Shared,
} from '@/app/lib/groovePatternEngine';

const ROWS = 8;
const KICK = 0;
const SNARE = 1;
const HAT = 3;

export const mulberry32 = mulberry32Shared;
const mixSeed = mixSeedShared;

// ── Legacy helper kept for Beat Lab callers ────────────────────────────────

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

// ── Preset-based generation with variation ─────────────────────────────────

/**
 * Pick a preset from the library for the given role + style, using `seed`
 * to select which variation. Deterministic: same seed → same preset pick.
 */
function pickPreset(
  role: PatternPreset['role'],
  style: string,
  seed: number,
): PatternPreset | null {
  const candidates = getPresetsForGenerate(role, style);
  if (candidates.length === 0) return null;
  const rng = mulberry32Shared(seed);
  const idx = Math.floor(rng() * candidates.length);
  return candidates[idx] ?? null;
}

/**
 * Apply tasteful variation on top of a base preset grid.
 * temperature=1.0 → identical to preset (no change)
 * temperature=1.5 → a few ghost notes / occasional step flip
 * temperature=2.0 → more variation but still musically grounded
 *
 * Only rows that ALREADY have at least one active step get touches —
 * new rows are never introduced so the instrumentation stays the same.
 */
function applyVariation(
  base: boolean[][],
  temperature: number,
  seed: number,
): boolean[][] {
  if (temperature <= 1.0) return base.map((r) => [...r]);
  const rng = mulberry32Shared(seed + 9999);
  const flipChance = Math.min(0.35, (temperature - 1.0) * 0.15);

  return base.map((row, ri) => {
    const active = row.some(Boolean);
    if (!active) return [...row]; // leave empty rows untouched
    return row.map((cell, si) => {
      const r = rng();
      // Ghost note: add a step adjacent to an existing hit
      if (!cell && si > 0 && row[si - 1] && r < flipChance * 0.5) return true;
      // Occasional accent: remove a step for syncopation
      if (cell && ri !== KICK && ri !== SNARE && r < flipChance * 0.3) return false;
      return cell;
    });
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

export function generateArpeggioPattern(style: string = 'balanced'): boolean[][] {
  const patterns: Record<string, boolean[][]> = {
    up: Array.from({ length: ROWS }, (_, ri) =>
      Array.from({ length: 16 }, (_, ci) => ci % 4 === ri % 4),
    ),
    down: Array.from({ length: ROWS }, (_, ri) =>
      Array.from({ length: 16 }, (_, ci) => ci % 4 === ((3 - (ri % 4)) % 4)),
    ),
    updown: Array.from({ length: ROWS }, (_, ri) =>
      Array.from({ length: 16 }, (_, ci) => {
        const p = ci % 8;
        if (p < 4) return p === ri % 4;
        return p - 4 === ((3 - (ri % 4)) % 4);
      }),
    ),
    random: Array.from({ length: ROWS }, () =>
      Array.from({ length: 16 }, () => Math.random() > 0.65),
    ),
  };
  return patterns[style] ?? patterns.up!;
}

export function generateRandomPattern(steps: number = 16, seed?: number): boolean[][] {
  const rng = mulberry32(seed ?? (Date.now() ^ (Math.random() * 1e9)));
  return Array.from({ length: ROWS }, (_, ri) =>
    Array.from({ length: steps }, (_, ci) => {
      if (ri === KICK)  return ci === 0 || ci === 8 || rng() > 0.88;
      if (ri === SNARE) return ci === 4 || ci === 12;
      if (ri === HAT)   return ci % 2 === 0 && rng() > 0.35;
      return rng() > 0.78;
    }),
  );
}

/**
 * Generate a drum pattern.
 * Primary: picks from the curated drum preset library for the style.
 * Temperature > 1.0 adds variation (ghost notes, occasional step flips).
 * Fallback: groove engine template if no preset matches.
 */
export async function generateDrumPattern(
  style?: string,
  temperature: number = 1.0,
  seed?: number,
): Promise<boolean[][]> {
  const s = seed ?? mixSeed([style ?? '', temperature, Date.now()]);
  await new Promise((r) => requestAnimationFrame(() => r(undefined)));

  const preset = pickPreset('drums', style ?? 'trap', s);
  if (preset) return applyVariation(preset.pattern, temperature, s);

  // Fallback to groove engine
  return generateDrumGroove(style ?? 'trap', s, temperature);
}

/**
 * Generate a melody / bass / pad / strings pattern.
 * Primary: picks from the curated preset library for the instrument role + style.
 * Temperature > 1.0 adds subtle variation while keeping the musical shape.
 * `drumPattern` is used when the user enables "Lock to drums" — bass notes
 * will align to kick hits for a tight pocket feel.
 */
export async function generateMelodyPattern(
  instrument: string,
  style?: string,
  temperature: number = 1.0,
  seed?: number,
  drumPattern: ReadonlyArray<ReadonlyArray<boolean>> | null = null,
): Promise<boolean[][]> {
  const s = seed ?? mixSeed([instrument, style ?? '', temperature, Date.now()]);
  await new Promise((r) => requestAnimationFrame(() => r(undefined)));

  const role = instrumentToPresetRole(instrument);

  // Percussion → treat as drums
  if (instrument.toLowerCase().includes('percussion')) {
    const preset = pickPreset('drums', style ?? 'trap', s);
    if (preset) return applyVariation(preset.pattern, temperature, s);
    return generateDrumGroove(style ?? 'trap', s, temperature);
  }

  // Bass: try preset first, then lock-to-kick fallback
  if (role === 'bass') {
    const preset = pickPreset('bass', style ?? 'trap', s);
    if (preset) return applyVariation(preset.pattern, temperature, s);
    return generateBassPattern(drumPattern, style ?? 'trap', s);
  }

  // Pad / Strings / Brass
  if (role === 'pad') {
    const preset = pickPreset('pad', style ?? 'trap', s);
    if (preset) return applyVariation(preset.pattern, temperature, s);
    return generatePadPattern(style ?? 'trap');
  }

  // Lead / Melody / Pluck / Muted Guitar
  const preset = pickPreset('melody', style ?? 'trap', s);
  if (preset) return applyVariation(preset.pattern, temperature, s);

  const cat = classifyInstrument(instrument);
  return generateMelodyFromGroove(style ?? 'trap', s, temperature);
  void cat; // suppress unused warning — cat is the groove-engine fallback path
}

export { rowToMidi, KEY_LABELS } from '@/app/lib/groovePatternEngine';
export type { KeyRoot, Mode } from '@/app/lib/groovePatternEngine';
