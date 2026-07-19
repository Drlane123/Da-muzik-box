/**
 * Open / separated jazz–neo voicings (FL SourceLab-style).
 * Low bass = true chord root, then gap, then upper-structure cluster.
 * Guide tones (3rd + 7th) are kept whenever present.
 */

/** F2 — room for low roots like the reference roll. */
export const SE2_OPEN_JAZZ_NEO_MIDI_MIN = 41;
/** C6 — upper extensions / airy tops. */
export const SE2_OPEN_JAZZ_NEO_MIDI_MAX = 84;

export function se2GenreUsesOpenJazzNeoVoicing(genreId: string | undefined | null): boolean {
  return genreId === 'rich-jazz' || genreId === 'deep-neo' || genreId === 'deep-rnb';
}

export function se2PresetUsesOpenJazzNeoVoicing(presetId: string | undefined | null): boolean {
  const id = (presetId ?? '').trim().toLowerCase();
  return (
    id.startsWith('rich-jazz::')
    || id.startsWith('deep-neo::')
    || id.startsWith('deep-rnb::')
  );
}

function normPc(n: number): number {
  return ((Math.round(n) % 12) + 12) % 12;
}

/** Prefer guide tones, then color tones, when ordering upper voices. */
function openVoicePriority(relPc: number): number {
  switch (relPc) {
    case 0:
      return 0;
    case 3:
    case 4:
      return 1; // 3rd
    case 10:
    case 11:
      return 2; // 7th
    case 7:
      return 3; // 5th
    case 2:
      return 4; // 9th
    case 5:
      return 5; // 11th / sus
    case 9:
      return 6; // 13th / 6
    case 6:
      return 7; // #11 / b5
    case 1:
    case 8:
      return 8;
    default:
      return 9;
  }
}

function placePcAbove(prev: number, pc: number, minGap: number, maxMidi: number): number | null {
  const targetPc = normPc(pc);
  for (const gap of [minGap, Math.max(3, minGap - 2), 3, 2]) {
    let n = Math.floor((prev + gap) / 12) * 12 + targetPc;
    while (n < prev + gap) n += 12;
    if (n <= maxMidi && n > prev) return n;
  }
  return null;
}

export type Se2OpenJazzNeoVoicingOpts = {
  /** True chord root pitch class (0–11). When omitted, falls back to lowest note. */
  rootPc?: number;
};

/**
 * Rewrite a close-position stack into an open jazz/neo spread.
 * Pass `rootPc` from the roman/chord root — never from an inverted lowest note.
 */
export function se2OpenJazzNeoVoicing(
  closeMidis: readonly number[],
  opts?: Se2OpenJazzNeoVoicingOpts,
): number[] {
  const sorted = [...new Set(closeMidis.map((m) => Math.round(m)))].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const pcs = [...new Set(sorted.map((m) => normPc(m)))];
  const rootPc = opts?.rootPc != null ? normPc(opts.rootPc) : pcs[0]!;

  if (pcs.length === 1) {
    let n = 36 + rootPc;
    if (n < SE2_OPEN_JAZZ_NEO_MIDI_MIN) n += 12;
    if (n > 50) n -= 12;
    return [Math.max(SE2_OPEN_JAZZ_NEO_MIDI_MIN, Math.min(SE2_OPEN_JAZZ_NEO_MIDI_MAX, n))];
  }

  const relOrdered = pcs
    .map((pc) => normPc(pc - rootPc))
    .sort((a, b) => openVoicePriority(a) - openVoicePriority(b) || a - b);

  let bass = 36 + rootPc;
  if (bass < SE2_OPEN_JAZZ_NEO_MIDI_MIN) bass += 12;
  if (bass > 50) bass -= 12;

  const out: number[] = [bass];
  const upper = relOrdered.filter((r) => r !== 0);

  for (let i = 0; i < upper.length; i += 1) {
    const rel = upper[i]!;
    const pc = normPc(rootPc + rel);
    const prev = out[out.length - 1]!;
    const fromTop = upper.length - 1 - i;
    /** Wide gaps for early upper voices; tighter cluster on top (FL-style). */
    const minGap = fromTop <= 1 ? 3 : i === 0 ? 8 : 5;
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
