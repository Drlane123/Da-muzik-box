/**
 * Map external drum filenames → Beat Lab pad indices (0–15).
 * Heuristics tuned for trap-style drum filenames.
 */

const AUDIO_EXT = /\.(wav|wave|mp3|ogg|flac|m4a|aac|aif|aiff)$/i;

/** Pad index → keyword patterns (first match wins; order = most specific first). */
const PAD_RULES: ReadonlyArray<{ pad: number; test: (n: string) => boolean }> = [
  { pad: 4, test: (n) => /open[\s_-]?(hat|hh)|\boh\d*\b|\bopen\b.*\bhat\b/.test(n) },
  { pad: 3, test: (n) => /hi[\s_-]?hat|\bhh\b|\bch\b|closed[\s_-]?hat|\bhat\b|\bhihat\b/.test(n) },
  { pad: 15, test: (n) => /808[\s_-]?(bass|sub)|\bsub[\s_-]?bass\b|\b(sub|808)\b.*\b(bass|boom)\b|\b808\b(?!.*kick)/.test(n) },
  { pad: 0, test: (n) => /\bkick\b|\bdk\b|\bbd\b|\b808[\s_-]?kick\b|\bkik\b/.test(n) },
  { pad: 1, test: (n) => /\bsnare\b|\bsnr\b|\bsd\b|\btrap[\s_-]?snare/.test(n) },
  { pad: 2, test: (n) => /\bclap\b|\bcp\b/.test(n) },
  { pad: 7, test: (n) => /\brim\b|\brimshot\b|\brs\b/.test(n) },
  { pad: 5, test: (n) => /\btom[\s_-]?hi\b|\bhi[\s_-]?tom\b|\bht\b|\bhigh[\s_-]?tom\b/.test(n) },
  { pad: 6, test: (n) => /\btom[\s_-]?lo\b|\blo[\s_-]?tom\b|\blt\b|\blow[\s_-]?tom\b|\bmt\b|\bmid[\s_-]?tom\b/.test(n) },
  { pad: 10, test: (n) => /\bcrash\b|\bcym[\s_-]?crash|\bcrash[\s_-]?cym/.test(n) },
  { pad: 11, test: (n) => /\bride\b|\bride[\s_-]?cym/.test(n) },
  { pad: 12, test: (n) => /\bshaker\b|\bshake\b|\btamb\b/.test(n) },
  { pad: 13, test: (n) => /\bcowbell\b|\bcb\b/.test(n) },
  { pad: 14, test: (n) => /\bsnap\b|\bfx[\s_-]?snap\b/.test(n) },
  { pad: 8, test: (n) => /\bperc\b|\bpercu\b|\bconga\b|\bbongo\b/.test(n) },
  { pad: 9, test: (n) => /\bperc[\s_-]?2\b|\bloop\b|\bvox[\s_-]?hit\b/.test(n) },
  { pad: 0, test: (n) => /\b808\b/.test(n) && /kick|bd|drum/.test(n) },
  { pad: 15, test: (n) => /\b808\b/.test(n) },
  { pad: 12, test: (n) => /\bfx\b|\beffect\b|\bstinger\b|\brise\b|\bimpact\b/.test(n) },
];

export function isBeatLabAudioFile(name: string): boolean {
  return AUDIO_EXT.test(name);
}

export function normalizeSampleFilename(name: string): string {
  return name
    .replace(/\.[^/.]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Guess Beat Lab pad 0–15 from filename; `null` = no confident match. */
export function guessPadIndexFromSampleFilename(filename: string): number | null {
  const n = normalizeSampleFilename(filename);
  if (!n) return null;
  for (const rule of PAD_RULES) {
    if (rule.test(n)) return rule.pad;
  }
  return null;
}

export type FolderImportAssignment = { file: File; pad: number };

/**
 * Assign folder audio files to pads. Matched files use heuristics; leftovers fill empty pads in sort order.
 */
export function assignFolderFilesToPads(files: File[]): FolderImportAssignment[] {
  const audio = files.filter((f) => isBeatLabAudioFile(f.name));
  audio.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const usedPads = new Set<number>();
  const out: FolderImportAssignment[] = [];

  for (const file of audio) {
    const guessed = guessPadIndexFromSampleFilename(file.name);
    if (guessed != null && !usedPads.has(guessed)) {
      usedPads.add(guessed);
      out.push({ file, pad: guessed });
    }
  }

  const unmatched = audio.filter((f) => !out.some((a) => a.file === f));
  let nextPad = 0;
  for (const file of unmatched) {
    while (nextPad < 16 && usedPads.has(nextPad)) nextPad++;
    if (nextPad >= 16) break;
    usedPads.add(nextPad);
    out.push({ file, pad: nextPad });
    nextPad++;
  }

  return out;
}
