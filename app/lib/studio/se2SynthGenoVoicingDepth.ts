/**
 * Rich chord voicing — expand Roman 7th spellings to 5–7 playable tones (ChordPrism-style depth).
 */
import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';

export type GenoVoicingDepth = 4 | 5 | 6 | 7;

type ChordColor = 'maj7' | 'min7' | 'dom7' | 'dim' | 'halfDim' | 'sus' | 'triad';

function normalizeIv(iv: number): number {
  return ((Math.round(iv) % 12) + 12) % 12;
}

function inferChordColor(intervals: readonly number[]): ChordColor {
  const rel = [...new Set(intervals.map(normalizeIv))].sort((a, b) => a - b);
  const has = (n: number) => rel.includes(n);
  if (has(3) && has(6) && has(10)) return 'halfDim';
  if (has(3) && has(6)) return 'dim';
  if (has(5) && !has(3) && !has(4)) return 'sus';
  if (has(4) && has(10)) return 'dom7';
  if (has(3) && has(10)) return 'min7';
  if (has(4) && has(11)) return 'maj7';
  if (has(3)) return 'min7';
  if (has(4)) return 'triad';
  return 'triad';
}

function soulGenre(genreId: Se2SynthGenoLiveGenreId): boolean {
  return (
    genreId === 'rnb'
    || genreId === 'rnb-pop'
    || genreId === 'neo-soul'
    || genreId === 'gospel'
    || genreId === 'jazz'
    || genreId === 'rich-jazz'
    || genreId === 'deep-neo'
  );
}

function jazzGenre(genreId: Se2SynthGenoLiveGenreId): boolean {
  return genreId === 'jazz' || genreId === 'rich-jazz' || genreId === 'deep-neo';
}

function lushGenre(genreId: Se2SynthGenoLiveGenreId): boolean {
  return (
    soulGenre(genreId)
    || genreId === 'pop'
    || genreId === 'kpop'
    || genreId === 'rnb-pop'
    || genreId === 'afrobeats'
    || genreId === 'house-dance'
    || genreId === 'lofi'
  );
}

function sparseGenre(genreId: Se2SynthGenoLiveGenreId): boolean {
  return (
    genreId === 'trap'
    || genreId === 'drill'
    || genreId === 'plug-rage'
    || genreId === 'jersey-bounce'
    || genreId === 'dark-cinematic'
  );
}

/** Ordered semitone additions (relative to chord root) to reach target depth. */
function enrichmentLayers(
  color: ChordColor,
  genreId: Se2SynthGenoLiveGenreId,
): number[] {
  const soul = soulGenre(genreId);
  const jazz = jazzGenre(genreId);
  const lush = lushGenre(genreId);
  const sparse = sparseGenre(genreId);

  switch (color) {
    case 'maj7':
      if (jazz) return [17, 14, 9, 21, 12, 19];
      if (genreId === 'rnb' || genreId === 'pop' || genreId === 'rnb-pop') return [14, 9];
      if (soul) return [14, 9, 12];
      if (lush) return [14, 9, 12, 19];
      if (sparse) return [14, 12];
      return [14, 12, 9];
    case 'min7':
      if (jazz) return [17, 14, 12, 9, 21];
      if (genreId === 'rnb' || genreId === 'pop' || genreId === 'rnb-pop') return [14, 12];
      if (soul) return [14, 12, 17];
      if (lush) return [14, 12, 17];
      if (sparse) return [12, 14];
      return [14, 12];
    case 'dom7':
      if (jazz) return [14, 17, 9, 13, 21];
      if (soul) return [14, 9, 12, 17];
      if (lush) return [14, 9, 12];
      if (sparse) return [14, 12];
      return [14, 9];
    case 'halfDim':
      return jazz ? [14, 9, 17, 12] : soul ? [12, 14, 9] : [12, 14];
    case 'dim':
      return soul || jazz ? [12, 14, 9] : [12, 14];
    case 'sus':
      return lush ? [14, 12, 9] : [12, 14];
    default:
      if (soul) return [14, 10, 12, 9];
      if (lush) return [14, 10, 12];
      return [12, 14];
  }
}

export function se2SynthGenoDefaultVoicingDepth(genreId: Se2SynthGenoLiveGenreId): GenoVoicingDepth {
  if (genreId === 'jazz' || genreId === 'rich-jazz' || genreId === 'deep-neo') return 6;
  if (genreId === 'rnb' || genreId === 'pop' || genreId === 'kpop' || genreId === 'rnb-pop' || genreId === 'afrobeats') return 5;
  if (soulGenre(genreId)) return 6;
  if (genreId === 'lofi' || genreId === 'lofi-cinematic' || genreId === 'boom-bap') return 5;
  if (sparseGenre(genreId)) return 4;
  return 5;
}

export function se2SynthGenoDefaultVoicingDepthForStyle(style: GenoChordStyle): GenoVoicingDepth {
  if (style === 'jazz') return 6;
  if (style === 'rnb' || style === 'gospel') return 5;
  if (style === 'pop' || style === 'dance' || style === 'disco' || style === 'bright' || style === 'kpop') {
    return 4;
  }
  if (style === 'trap' || style === 'dark') return 4;
  return 5;
}

function profileFromStyle(style: GenoChordStyle): Se2SynthGenoLiveGenreId {
  if (style === 'jazz') return 'jazz';
  if (style === 'rnb' || style === 'gospel') return 'rnb';
  if (style === 'pop' || style === 'bright' || style === 'major') return 'pop';
  if (style === 'kpop') return 'kpop';
  if (style === 'dance' || style === 'disco') return 'house-dance';
  if (style === 'trap' || style === 'minor') return 'trap';
  if (style === 'dark') return 'dark-cinematic';
  return 'rnb';
}

export function se2SynthGenoEnrichForStyle(
  baseIntervals: readonly number[],
  depth: GenoVoicingDepth,
  style: GenoChordStyle,
  roman?: ChordSymbol,
): number[] {
  return se2SynthGenoEnrichChordIntervals(baseIntervals, depth, profileFromStyle(style), roman);
}

/**
 * Expand base Roman intervals to the target note count using genre-aware extensions and stacks.
 */
export function se2SynthGenoEnrichChordIntervals(
  baseIntervals: readonly number[],
  depth: GenoVoicingDepth,
  genreId: Se2SynthGenoLiveGenreId,
  _roman?: ChordSymbol,
): number[] {
  if (baseIntervals.length === 0) return [];
  const rootIv = baseIntervals[0]!;
  const rel = [...new Set(baseIntervals.map((iv) => normalizeIv(iv - rootIv)))].sort((a, b) => a - b);
  const color = inferChordColor(rel);
  const layers = enrichmentLayers(color, genreId);

  const out = new Set(baseIntervals.map((iv) => Math.round(iv)));
  for (const layer of layers) {
    if (out.size >= depth) break;
    out.add(rootIv + layer);
  }

  if (out.size < depth) {
    const sorted = [...out].sort((a, b) => a - b);
    const top = sorted[sorted.length - 1]!;
    const second = sorted[sorted.length - 2] ?? top;
    if (out.size < depth) out.add(top + 12);
    if (out.size < depth) out.add(second + 12);
    if (out.size < depth) out.add(rootIv + 24);
  }

  return [...out].sort((a, b) => a - b).slice(0, depth);
}

/** Map voiced intervals to exactly `depth` unique MIDI notes in comp register. */
export function se2SynthGenoFinalizeVoicedMidis(
  tones: readonly number[],
  depth: GenoVoicingDepth,
  minMidi: number,
  maxMidi: number,
): number[] {
  const unique = [...new Set(tones.map((m) => Math.round(m)))].sort((a, b) => a - b);
  return unique
    .slice(0, depth)
    .map((m) => Math.max(minMidi, Math.min(maxMidi, m)));
}

/**
 * Thin comp stacks — drop upper extensions that sit a minor 2nd off a neighbor
 * (Rip Chord / ChordPrism-style clarity; keeps root–3rd–7th when possible).
 */
export function se2SynthGenoDedenseCompVoicing(
  tones: readonly number[],
  maxNotes = 4,
): number[] {
  let out = [...new Set(tones.map((m) => Math.round(m)))].sort((a, b) => a - b);
  if (out.length <= maxNotes) return out;
  let guard = 0;
  while (out.length > maxNotes && guard < 16) {
    guard += 1;
    let dropped = false;
    for (let i = out.length - 1; i >= 1; i -= 1) {
      const gap = out[i]! - out[i - 1]!;
      if (gap < 3) {
        out.splice(i, 1);
        dropped = true;
        break;
      }
    }
    if (!dropped) break;
  }
  return out;
}
