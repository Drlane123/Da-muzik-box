/**
 * Open / separated jazz–neo voicings (FL SourceLab-style).
 * Low bass shell + gap + upper-structure cluster — not close-position bunches.
 */

/** F2 — room for low roots like the reference roll. */
export const SE2_OPEN_JAZZ_NEO_MIDI_MIN = 41;
/** C6 — upper extensions / airy tops. */
export const SE2_OPEN_JAZZ_NEO_MIDI_MAX = 84;

export function se2GenreUsesOpenJazzNeoVoicing(genreId: string | undefined | null): boolean {
  return genreId === 'rich-jazz' || genreId === 'deep-neo';
}

export function se2PresetUsesOpenJazzNeoVoicing(presetId: string | undefined | null): boolean {
  const id = (presetId ?? '').trim().toLowerCase();
  return id.startsWith('rich-jazz::') || id.startsWith('deep-neo::');
}

function placePcAbove(prev: number, pc: number, minGap: number, maxMidi: number): number | null {
  const targetPc = ((pc % 12) + 12) % 12;
  for (const gap of [minGap, Math.max(3, minGap - 2), 3, 2]) {
    let n = Math.floor((prev + gap) / 12) * 12 + targetPc;
    while (n < prev + gap) n += 12;
    if (n <= maxMidi && n > prev) return n;
  }
  return null;
}

/**
 * Rewrite a close-position stack into an open jazz/neo spread.
 * Input may be any octave; pitch classes are preserved.
 */
export function se2OpenJazzNeoVoicing(closeMidis: readonly number[]): number[] {
  const sorted = [...new Set(closeMidis.map((m) => Math.round(m)))].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  if (sorted.length === 1) {
    let n = sorted[0]!;
    while (n > 50) n -= 12;
    while (n < SE2_OPEN_JAZZ_NEO_MIDI_MIN) n += 12;
    return [Math.max(SE2_OPEN_JAZZ_NEO_MIDI_MIN, Math.min(SE2_OPEN_JAZZ_NEO_MIDI_MAX, n))];
  }

  const rootPc = ((sorted[0]! % 12) + 12) % 12;
  const rel = sorted.map((m) => m - sorted[0]!);

  let bass = 36 + rootPc;
  if (bass < SE2_OPEN_JAZZ_NEO_MIDI_MIN) bass += 12;
  if (bass > 50) bass -= 12;

  const out: number[] = [bass];

  for (let i = 1; i < rel.length; i += 1) {
    const pc = (rootPc + (((rel[i]! % 12) + 12) % 12)) % 12;
    const prev = out[out.length - 1]!;
    const fromTop = rel.length - 1 - i;
    /** Wide gaps low/mid; tighter cluster on the top (matches the FL upper structure). */
    const minGap = fromTop <= 1 ? 3 : i === 1 ? 9 : 6;
    const placed = placePcAbove(prev, pc, minGap, SE2_OPEN_JAZZ_NEO_MIDI_MAX);
    if (placed != null && !out.includes(placed)) out.push(placed);
  }

  out.sort((a, b) => a - b);

  /** Ensure the roll reads “separated” — at least an octave + major 3rd of span. */
  if (out.length >= 3 && out[out.length - 1]! - out[0]! < 16) {
    const mid = Math.ceil(out.length / 2);
    for (let i = mid; i < out.length; i += 1) {
      if (out[i]! + 12 <= SE2_OPEN_JAZZ_NEO_MIDI_MAX) out[i] = out[i]! + 12;
    }
  }

  return [...new Set(out.map((m) => Math.round(m)))]
    .filter((m) => m >= SE2_OPEN_JAZZ_NEO_MIDI_MIN && m <= SE2_OPEN_JAZZ_NEO_MIDI_MAX)
    .sort((a, b) => a - b);
}
