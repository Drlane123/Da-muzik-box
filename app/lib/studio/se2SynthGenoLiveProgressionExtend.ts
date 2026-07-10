/**
 * Extend 4-chord Live preset seeds to 12 chromatic trigger slots (C3–B3).
 * Keeps the original 4 as the core loop, adds a bridge (5–8) and return (9–12).
 */
import {
  chordSymbolIntervalMap,
  coerceChordSymbolForMode,
  getModeDefaultChord,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';

export const SE2_SYNTH_GENO_LIVE_TARGET_CHORD_COUNT = 12;

const COERCE_MODE_FALLBACK: ChordMode[] = [
  'major',
  'minor',
  'dorian',
  'mixolydian',
  'phrygian',
  'lydian',
  'harmonicMinor',
  'melodicMinor',
];

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function validInMode(symbol: ChordSymbol, mode: ChordMode): boolean {
  return chordSymbolIntervalMap(symbol, mode) != null;
}

function resolvesAnywhere(symbol: ChordSymbol, mode: ChordMode): boolean {
  for (const m of [mode, ...COERCE_MODE_FALLBACK]) {
    if (chordSymbolIntervalMap(symbol, m)) return true;
  }
  return false;
}

function coerce(symbol: ChordSymbol, mode: ChordMode, genreId: Se2SynthGenoLiveGenreId): ChordSymbol {
  if (validInMode(symbol, mode)) return symbol;
  if (genreId === 'jazz' && resolvesAnywhere(symbol, mode)) return symbol;
  const c = coerceChordSymbolForMode(symbol, mode);
  return validInMode(c, mode) ? c : getModeDefaultChord(mode);
}

type ModeFamily = 'major' | 'minor' | 'dorian' | 'phrygian' | 'mixolydian' | 'harmonicMinor';

function modeFamily(mode: ChordMode): ModeFamily {
  if (mode === 'major' || mode === 'lydian') return 'major';
  if (mode === 'dorian') return 'dorian';
  if (mode === 'phrygian') return 'phrygian';
  if (mode === 'mixolydian') return 'mixolydian';
  if (mode === 'harmonicMinor') return 'harmonicMinor';
  return 'minor';
}

const BRIDGE_JAZZ_MAJOR: readonly (readonly ChordSymbol[])[] = [
  ['ii7', 'V7', 'iii7', 'vi7'],
  ['iii7', 'vi7', 'ii7', 'V7'],
  ['IVmaj7', 'iii7', 'vi7', 'ii7'],
  ['vi7', 'ii7', 'V7', 'Imaj7'],
];

const BRIDGE_JAZZ_MINOR: readonly (readonly ChordSymbol[])[] = [
  ['iiø7', 'V7', 'VImaj7', 'iv7'],
  ['iv7', 'V7', 'VImaj7', 'iiø7'],
  ['VImaj7', 'iiø7', 'V7', 'i7'],
  ['V7', 'i7', 'iv7', 'iiø7'],
];

const BRIDGE_MINOR: readonly (readonly ChordSymbol[])[] = [
  ['iv7', 'bIIImaj7', 'bVI', 'bVII'],
  ['V7', 'bVImaj7', 'bVII', 'i7'],
  ['bVImaj7', 'iv7', 'bVII', 'V7'],
  ['bIIImaj7', 'bVI', 'iv7', 'bVII'],
  ['VII7', 'bVI', 'bVII', 'iv7'],
  ['iv7', 'V7', 'bVI', 'bVII'],
];

const BRIDGE_MAJOR: readonly (readonly ChordSymbol[])[] = [
  ['ii7', 'V7', 'iii7', 'vi7'],
  ['IVmaj7', 'iii7', 'vi7', 'ii7'],
  ['vi7', 'ii7', 'V7', 'IVmaj7'],
  ['iii7', 'vi7', 'IVmaj7', 'V7'],
  ['ii7', 'iii7', 'vi7', 'IVmaj7'],
  ['IVmaj7', 'V7', 'vi7', 'ii7'],
];

const BRIDGE_DORIAN: readonly (readonly ChordSymbol[])[] = [
  ['IV7', 'bVIImaj7', 'ii7', 'i7'],
  ['ii7', 'IV7', 'bVII', 'i7'],
  ['bVIImaj7', 'IV7', 'ii7', 'i7'],
  ['IV7', 'ii7', 'bVII', 'i7'],
];

const BRIDGE_PHRYGIAN: readonly (readonly ChordSymbol[])[] = [
  ['bIImaj7', 'bVII', 'bVImaj7', 'i7'],
  ['bVII', 'bIImaj7', 'iv7', 'i7'],
  ['bVImaj7', 'bVII', 'bIImaj7', 'i7'],
  ['iv7', 'bIImaj7', 'bVII', 'i7'],
];

const BRIDGE_MIXO: readonly (readonly ChordSymbol[])[] = [
  ['IV7', 'bVII', 'I7', 'bVII'],
  ['bVII', 'IV7', 'I7', 'IV7'],
  ['I7', 'bVII', 'IV7', 'I7'],
];

const BRIDGE_HARMONIC: readonly (readonly ChordSymbol[])[] = [
  ['bVImaj7', 'V7', 'iv7', 'i7'],
  ['V7', 'bVImaj7', 'bVII', 'i7'],
  ['iv7', 'V7', 'bVImaj7', 'i7'],
];

const VARIATIONS: Partial<Record<ChordSymbol, readonly ChordSymbol[]>> = {
  i7: ['i7', 'iv7', 'bVImaj7', 'bIIImaj7'],
  iv7: ['iv7', 'i7', 'bVII', 'bVI'],
  'bVII': ['bVII', 'bVI', 'VII7', 'iv7'],
  bVI: ['bVI', 'bVImaj7', 'bVII', 'iv7'],
  bVImaj7: ['bVImaj7', 'bVI', 'iv7', 'bVII'],
  bIIImaj7: ['bIIImaj7', 'bVI', 'iv7', 'bVII'],
  V7: ['V7', 'VII7', 'bVII', 'iv7'],
  VII7: ['VII7', 'bVII', 'V7', 'bVI'],
  VImaj7: ['VImaj7', 'bVImaj7', 'iv7', 'bVII'],
  Imaj7: ['Imaj7', 'IVmaj7', 'vi7', 'iii7'],
  IVmaj7: ['IVmaj7', 'ii7', 'vi7', 'Imaj7'],
  vi7: ['vi7', 'ii7', 'IVmaj7', 'iii7'],
  ii7: ['ii7', 'V7', 'vi7', 'IVmaj7'],
  iii7: ['iii7', 'vi7', 'ii7', 'IVmaj7'],
  I7: ['I7', 'IV7', 'V7', 'vi7'],
  IV7: ['IV7', 'bVII', 'I7', 'ii7'],
  bVIImaj7: ['bVIImaj7', 'IV7', 'ii7', 'i7'],
  bIImaj7: ['bIImaj7', 'bVII', 'i7', 'bVImaj7'],
  'iiø7': ['iiø7', 'V7', 'i7', 'iv7'],
};

function bridgePool(mode: ChordMode, genreId: Se2SynthGenoLiveGenreId): readonly (readonly ChordSymbol[])[] {
  if (genreId === 'jazz') {
    if (mode === 'major' || mode === 'lydian') return BRIDGE_JAZZ_MAJOR;
    if (mode === 'minor' || mode === 'harmonicMinor' || mode === 'melodicMinor') return BRIDGE_JAZZ_MINOR;
  }
  const family = modeFamily(mode);
  if (family === 'major' || genreId === 'gospel' || genreId === 'rnb' || genreId === 'rnb-pop' || genreId === 'pop' || genreId === 'kpop' || genreId === 'afrobeats' || genreId === 'house-dance') {
    if (mode === 'major' || mode === 'lydian') return BRIDGE_MAJOR;
  }
  if (family === 'dorian' || genreId === 'neo-soul' || genreId === 'lofi') return BRIDGE_DORIAN;
  if (family === 'phrygian' || genreId === 'dark-cinematic' || genreId === 'plug-rage') return BRIDGE_PHRYGIAN;
  if (family === 'mixolydian') return BRIDGE_MIXO;
  if (family === 'harmonicMinor') return BRIDGE_HARMONIC;
  return BRIDGE_MINOR;
}

function pickVariation(
  roman: ChordSymbol,
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
  salt: number,
): ChordSymbol {
  const pool = VARIATIONS[roman] ?? [roman];
  const pick = pool[salt % pool.length] ?? roman;
  return coerce(pick, mode, genreId);
}

function pushUnique(
  out: ChordSymbol[],
  symbol: ChordSymbol,
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
  avoidRepeat = true,
): void {
  const c = coerce(symbol, mode, genreId);
  if (avoidRepeat && out.length > 0 && out[out.length - 1] === c) return;
  out.push(c);
}

function progressionLockedGenre(genreId: Se2SynthGenoLiveGenreId): boolean {
  return (
    genreId === 'rnb'
    || genreId === 'neo-soul'
    || genreId === 'gospel'
    || genreId === 'pop'
    || genreId === 'rnb-pop'
    || genreId === 'afrobeats'
    || genreId === 'house-dance'
    || genreId === 'jazz'
    || genreId === 'kpop'
    || genreId === 'lofi'
    || genreId === 'boom-bap'
  );
}

/**
 * Grow a seed progression to {@link SE2_SYNTH_GENO_LIVE_TARGET_CHORD_COUNT} chords.
 * Progression genres (R&B, pop, gospel…) keep musical coherence — core loop, bridge, return.
 */
export function se2SynthGenoLiveExtendRomans(
  seed: readonly ChordSymbol[],
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
  presetId = '',
  target = SE2_SYNTH_GENO_LIVE_TARGET_CHORD_COUNT,
): ChordSymbol[] {
  if (seed.length === 0) return [];
  if (seed.length >= target) {
    return seed.slice(0, target).map((r) => coerce(r, mode, genreId));
  }

  if (progressionLockedGenre(genreId)) {
    const h = hashId(`${presetId}:${genreId}:${seed.join(',')}`);
    const out: ChordSymbol[] = seed.map((r) => coerce(r, mode, genreId));
    const bridges = bridgePool(mode, genreId);
    const bridge = bridges[h % bridges.length] ?? bridges[0]!;
    for (let i = 0; i < bridge.length && out.length < 8; i += 1) {
      pushUnique(out, bridge[i]!, mode, genreId, false);
    }
    for (let i = 0; i < seed.length && out.length < target; i += 1) {
      pushUnique(out, seed[i]!, mode, genreId, false);
    }
    let guard = 0;
    while (out.length < target && guard < seed.length * 2) {
      pushUnique(out, seed[guard % seed.length]!, mode, genreId, false);
      guard += 1;
    }
    return out.slice(0, target);
  }

  const h = hashId(`${presetId}:${genreId}:${seed.join(',')}`);
  const out: ChordSymbol[] = seed.map((r) => coerce(r, mode, genreId));

  const bridges = bridgePool(mode, genreId);
  const bridge = bridges[h % bridges.length] ?? bridges[0]!;
  for (let i = 0; i < bridge.length && out.length < 8; i += 1) {
    pushUnique(out, bridge[i]!, mode, genreId, false);
  }

  let fillGuard = 0;
  while (out.length < 8 && fillGuard < 16) {
    const before = out.length;
    const src = seed[(before - 4) % seed.length]!;
    pushUnique(out, pickVariation(src, mode, genreId, h + before + fillGuard), mode, genreId, false);
    if (out.length === before) {
      pushUnique(out, coerce(bridge[fillGuard % bridge.length]!, mode, genreId), mode, genreId, false);
    }
    fillGuard += 1;
  }

  for (let i = 0; i < seed.length && out.length < target; i += 1) {
    pushUnique(out, pickVariation(seed[i]!, mode, genreId, h + 16 + i), mode, genreId, false);
  }

  let guard = 0;
  while (out.length < target && guard < 24) {
    const before = out.length;
    const src = seed[before % seed.length]!;
    pushUnique(out, pickVariation(src, mode, genreId, h + before + guard), mode, genreId, false);
    if (out.length === before) {
      pushUnique(out, coerce(bridge[guard % bridge.length]!, mode, genreId), mode, genreId, false);
    }
    guard += 1;
  }

  return out.slice(0, target);
}

export function se2SynthGenoLiveExtendedRomanLine(romans: readonly ChordSymbol[]): string {
  if (romans.length <= 4) return romans.join(' – ');
  return `${romans.slice(0, 4).join(' – ')} – … – ${romans.slice(-2).join(' – ')}`;
}

function coerceForPreset(symbol: ChordSymbol, mode: ChordMode, genreId: Se2SynthGenoLiveGenreId): ChordSymbol {
  return coerce(symbol, mode, genreId);
}

/**
 * Resolve a preset's Roman line — explicit {@link loop} wins over auto bridge fill.
 */
export function se2SynthGenoLiveResolvePresetRomans(
  def: {
    romans: readonly ChordSymbol[];
    loop?: readonly ChordSymbol[];
    romans12?: readonly ChordSymbol[];
    id?: string;
  },
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
  target = SE2_SYNTH_GENO_LIVE_TARGET_CHORD_COUNT,
): { romans: ChordSymbol[]; loopLength: number } {
  const explicit = def.loop ?? def.romans12;
  if (explicit && explicit.length > 0) {
    const coerced = explicit.map((r) => coerceForPreset(r, mode, genreId));
    const loopLength = Math.min(coerced.length, target);
    return { romans: coerced.slice(0, loopLength), loopLength };
  }
  const extended = se2SynthGenoLiveExtendRomans(def.romans, mode, genreId, def.id ?? '');
  const loopLength = Math.min(8, extended.length);
  return { romans: extended.slice(0, loopLength), loopLength };
}
