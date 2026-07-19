/**
 * Parse chord-chart style symbols (C, Am7, F#m, G/B) into MIDI voicings.
 * Used by Groove Lab progression builder — Da Music Box native, not third-party.
 */

const ROOT_LETTER_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const QUALITY_TABLE: { suffix: string; intervals: number[]; canonical: string }[] = [
  { suffix: 'maj13', intervals: [0, 4, 7, 11, 14, 17, 21], canonical: 'maj13' },
  { suffix: 'maj11', intervals: [0, 4, 7, 11, 14, 17], canonical: 'maj11' },
  { suffix: 'maj9', intervals: [0, 4, 7, 11, 14], canonical: 'maj9' },
  { suffix: 'maj7', intervals: [0, 4, 7, 11], canonical: 'maj7' },
  { suffix: 'M7', intervals: [0, 4, 7, 11], canonical: 'maj7' },
  { suffix: 'm13', intervals: [0, 3, 7, 10, 14, 17, 21], canonical: 'm13' },
  { suffix: 'm11', intervals: [0, 3, 7, 10, 14, 17], canonical: 'm11' },
  { suffix: 'm9', intervals: [0, 3, 7, 10, 14], canonical: 'm9' },
  { suffix: 'm7b5', intervals: [0, 3, 6, 10], canonical: 'm7b5' },
  { suffix: 'm7', intervals: [0, 3, 7, 10], canonical: 'm7' },
  { suffix: 'm6', intervals: [0, 3, 7, 9], canonical: 'm6' },
  { suffix: 'min', intervals: [0, 3, 7], canonical: 'm' },
  { suffix: 'dim7', intervals: [0, 3, 6, 9], canonical: 'dim7' },
  { suffix: 'dim', intervals: [0, 3, 6], canonical: 'dim' },
  { suffix: '°7', intervals: [0, 3, 6, 9], canonical: 'dim7' },
  { suffix: '°', intervals: [0, 3, 6], canonical: 'dim' },
  { suffix: 'ø7', intervals: [0, 3, 6, 10], canonical: 'm7b5' },
  { suffix: 'ø', intervals: [0, 3, 6, 10], canonical: 'm7b5' },
  { suffix: 'aug7', intervals: [0, 4, 8, 10], canonical: 'aug7' },
  { suffix: 'aug', intervals: [0, 4, 8], canonical: 'aug' },
  { suffix: '+', intervals: [0, 4, 8], canonical: 'aug' },
  { suffix: 'sus2', intervals: [0, 2, 7], canonical: 'sus2' },
  { suffix: 'sus4', intervals: [0, 5, 7], canonical: 'sus4' },
  { suffix: 'sus', intervals: [0, 5, 7], canonical: 'sus4' },
  { suffix: 'add9', intervals: [0, 4, 7, 14], canonical: 'add9' },
  { suffix: '13', intervals: [0, 4, 7, 10, 14, 17, 21], canonical: '13' },
  { suffix: '11', intervals: [0, 4, 7, 10, 14, 17], canonical: '11' },
  { suffix: '9', intervals: [0, 4, 7, 10, 14], canonical: '9' },
  { suffix: '7', intervals: [0, 4, 7, 10], canonical: '7' },
  { suffix: '6', intervals: [0, 4, 7, 9], canonical: '6' },
  { suffix: 'm', intervals: [0, 3, 7], canonical: 'm' },
  { suffix: '', intervals: [0, 4, 7], canonical: '' },
];

export type ParsedChordSymbol = {
  input: string;
  rootPc: number;
  notes: number[];
  display: string;
};

export function parseChordSymbolToken(rawToken: string): ParsedChordSymbol | null {
  const token = rawToken.trim().replace(/[()|]/g, '');
  if (!token) return null;

  const slashParts = token.split('/');
  const main = slashParts[0]!.trim();
  const bassRaw = slashParts[1]?.trim() ?? '';
  if (!main) return null;

  const letter = main[0]?.toUpperCase();
  if (!letter || !(letter in ROOT_LETTER_PC)) return null;

  let rootPc = ROOT_LETTER_PC[letter]!;
  let qualityStart = 1;
  if (main[1] === '#') {
    rootPc = (rootPc + 1) % 12;
    qualityStart = 2;
  } else if (main[1] === 'b') {
    rootPc = (rootPc + 11) % 12;
    qualityStart = 2;
  }

  const qualityStr = main.slice(qualityStart);
  let intervals: number[] = [0, 4, 7];
  let canonical = '';
  for (const q of QUALITY_TABLE) {
    if (q.suffix === '' && qualityStr === '') {
      intervals = q.intervals;
      canonical = q.canonical;
      break;
    }
    if (q.suffix && qualityStr === q.suffix) {
      intervals = q.intervals;
      canonical = q.canonical;
      break;
    }
  }
  if (qualityStr && canonical === '' && !(intervals.length === 3 && intervals[1] === 4)) {
    for (const q of QUALITY_TABLE) {
      if (q.suffix && qualityStr.startsWith(q.suffix)) {
        intervals = q.intervals;
        canonical = q.canonical;
        break;
      }
    }
  }

  const rootMidi = 60 + rootPc;
  let notes = intervals
    .map((iv) => rootMidi + iv)
    .filter((n) => n >= 36 && n <= 96)
    .sort((a, b) => a - b);
  if (notes.length < 2) return null;

  // Slash bass (C/E) — place bass tone under the stack for voice-leading / inversions.
  let displayBass = '';
  if (bassRaw) {
    const bLetter = bassRaw[0]?.toUpperCase();
    if (bLetter && bLetter in ROOT_LETTER_PC) {
      let bassPc = ROOT_LETTER_PC[bLetter]!;
      if (bassRaw[1] === '#') bassPc = (bassPc + 1) % 12;
      else if (bassRaw[1] === 'b') bassPc = (bassPc + 11) % 12;
      let bassMidi = 48 + bassPc;
      while (bassMidi >= notes[0]! - 2) bassMidi -= 12;
      if (bassMidi < 36) bassMidi += 12;
      notes = [bassMidi, ...notes.filter((n) => n % 12 !== bassPc)];
      notes.sort((a, b) => a - b);
      displayBass = `/${NOTE_LETTERS[bassPc]}`;
    }
  }

  const noteLetter = NOTE_LETTERS[rootPc] ?? '?';
  return {
    input: rawToken,
    rootPc,
    notes,
    display: `${noteLetter}${canonical}${displayBass}`,
  };
}

/** Split a progression line into chord tokens (C Am F G7, comma/space/dash separated). */
export function parseChordProgressionText(text: string): ParsedChordSymbol[] {
  const tokens = text
    .split(/[\s,;|/\n\r]+|[\u2013\u2014]+/)
    .map((t) => t.replace(/[-]+/g, ' ').trim())
    .flatMap((t) => t.split(/\s+/))
    .filter((t) => t.length > 0);

  const out: ParsedChordSymbol[] = [];
  for (const t of tokens) {
    const parsed = parseChordSymbolToken(t);
    if (parsed) out.push(parsed);
  }
  return out;
}
