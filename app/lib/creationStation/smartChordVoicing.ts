/**
 * Harmonimo-inspired chord voicing — extensions, spread, and voice-leading.
 * @see https://clayworksaudio.com/faq.html (Smart Voicing, Spread, Tension)
 */

import {
  chordSymbolToMidi,
  coerceChordSymbolForMode,
  chordSymbolToName,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import { expandChordVoicing, type ChordVoicingSize } from '@/app/lib/creationStation/chordVoicing';

export type ChordTension = 'low' | 'mid' | 'high';

export interface SmartVoicingOptions {
  size: ChordVoicingSize;
  /** When true, add context-aware 7ths/9ths/11ths (Harmonimo Smart Voicings). */
  smartVoicing: boolean;
  /** 0 = compact cluster; 100 = wide spread across bass + treble (Harmonimo Spread). */
  spread: number;
  tension?: ChordTension;
}

const DEFAULT_OPTS: SmartVoicingOptions = {
  size: 5,
  smartVoicing: true,
  spread: 55,
  tension: 'mid',
};

function triadIsMinor(sorted: number[]): boolean {
  if (sorted.length < 2) return false;
  const third = ((sorted[1]! - sorted[0]!) % 12 + 12) % 12;
  return third === 3;
}

/** Rough harmonic role in major/minor — drives extension color. */
function harmonicRole(symbol: ChordSymbol, mode: ChordMode): 'tonic' | 'subdominant' | 'dominant' | 'color' {
  const s = symbol.replace(/[0-9majø°+sus]/gi, '');
  if (mode === 'major' || mode === 'lydian' || mode === 'mixolydian') {
    if (/^(I|iii|vi)$/i.test(s)) return 'tonic';
    if (/^(ii|IV)$/i.test(s)) return 'subdominant';
    if (/^(V|vii)/i.test(s)) return 'dominant';
    if (/^b/.test(s)) return 'color';
    return 'tonic';
  }
  if (/^(i|iii|vi|VI)$/i.test(s)) return 'tonic';
  if (/^(ii|iv|II|IV)$/i.test(s)) return 'subdominant';
  if (/^(V|vii|VII)$/i.test(s)) return 'dominant';
  return 'color';
}

/** Add extensions before spread — respects symbol (m7, maj7) and role. */
function applySmartExtensions(
  baseMidis: number[],
  symbol: ChordSymbol,
  mode: ChordMode,
  targetSize: ChordVoicingSize,
  prevSymbol: ChordSymbol | null | undefined,
  tension: ChordTension,
): number[] {
  let notes = expandChordVoicing(baseMidis, targetSize);
  const role = harmonicRole(symbol, mode);
  const root = notes[0]!;
  const minor = triadIsMinor(notes);
  const out = new Set(notes);

  const addSemi = (semi: number) => {
    const m = root + semi;
    if (m >= 36 && m <= 96) out.add(m);
  };

  const tensionBoost = tension === 'high' ? 1 : tension === 'low' ? 0 : 0.5;

  if (targetSize >= 4 && role === 'dominant' && !/7|ø|dim/i.test(symbol)) {
    addSemi(minor ? 10 : 10);
  }
  if (targetSize >= 5) {
    if (role === 'subdominant' || /ii/i.test(symbol)) addSemi(14);
    else if (role === 'tonic' && tensionBoost >= 0.5) addSemi(14);
    else addSemi(14);
  }
  if (targetSize >= 6 && (role === 'subdominant' || tension === 'high')) {
    addSemi(17);
  }
  if (targetSize >= 7 && tension !== 'low') {
    addSemi(21);
  }

  if (prevSymbol && /V/i.test(prevSymbol) && /^I/i.test(symbol)) {
    addSemi(minor ? 10 : 11);
  }
  if (prevSymbol && /ii/i.test(prevSymbol) && /^V/i.test(symbol)) {
    addSemi(10);
  }

  notes = [...out].sort((a, b) => a - b);
  if (notes.length > targetSize) return notes.slice(0, targetSize);
  if (notes.length < targetSize) return expandChordVoicing(notes, targetSize);
  return notes;
}

/**
 * Spread notes across registers (Harmonimo-style) so 5–7 keys are audible
 * as separate pitches, not a tight cluster that reads as "3 keys".
 */
export function spreadVoicingAcrossRegister(
  midis: ReadonlyArray<number>,
  targetSize: ChordVoicingSize,
  spreadPct: number,
): number[] {
  const sorted = [...new Set(midis)].sort((a, b) => a - b);
  if (sorted.length <= 1) return sorted;
  const spread = Math.max(0, Math.min(100, spreadPct)) / 100;
  if (spread <= 0.05 || sorted.length <= 3) return sorted.slice(0, targetSize);

  const root = sorted[0]!;
  const placed: number[] = [root];
  const rest = sorted.slice(1);

  for (let i = 0; i < rest.length && placed.length < targetSize; i++) {
    let m = rest[i]!;
    const idx = i;
    if (spread >= 0.35 && idx === 0 && m - root < 7) {
      m -= 12;
      if (m < 36) m += 12;
    }
    if (spread >= 0.5 && idx >= rest.length - 2 && m < root + 12) {
      m += 12;
      if (m > 96) m -= 12;
    }
    if (spread >= 0.65 && idx === Math.floor(rest.length / 2) && m < root + 7) {
      m += 12;
      if (m > 96) m -= 12;
    }
    if (!placed.includes(m)) placed.push(m);
  }

  while (placed.length < targetSize && placed.length < sorted.length + 2) {
    const last = placed[placed.length - 1]!;
    const candidate = last + (placed.length % 2 === 0 ? 12 : 7);
    if (candidate <= 96 && !placed.includes(candidate)) placed.push(candidate);
    else break;
  }

  return [...new Set(placed)].sort((a, b) => a - b).slice(0, targetSize);
}

/** Single entry point for audition, transport, export, and piano-roll preview. */
export function buildVoicedMidiSet(
  symbol: ChordSymbol,
  keyRoot: number,
  mode: ChordMode,
  options: Partial<SmartVoicingOptions> = {},
  prevSymbol?: ChordSymbol | null,
): number[] {
  const opts = { ...DEFAULT_OPTS, ...options };
  const sym = coerceChordSymbolForMode(symbol, mode);
  const base = chordSymbolToMidi(sym, keyRoot, mode, 4);
  if (!base || base.length === 0) return [];

  let notes = opts.smartVoicing
    ? applySmartExtensions(base, sym, mode, opts.size, prevSymbol, opts.tension ?? 'mid')
    : expandChordVoicing(base, opts.size);

  notes = spreadVoicingAcrossRegister(notes, opts.size, opts.spread);
  return notes.slice(0, opts.size);
}

export function voicedChordNoteNames(
  symbol: ChordSymbol,
  keyRoot: number,
  mode: ChordMode,
  options: Partial<SmartVoicingOptions> = {},
  prevSymbol?: ChordSymbol | null,
): { name: string; notes: string[] } {
  const midis = buildVoicedMidiSet(symbol, keyRoot, mode, options, prevSymbol);
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const notes = midis.map((m) => NOTE[m % 12] ?? '?');
  return { name: chordSymbolToName(symbol, keyRoot, mode), notes };
}
