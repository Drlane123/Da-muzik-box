/**
 * Synth Geno Compose — prompt parsing for duo pairs + chord/melody genres.
 */

export type GenoDuoPartKind = 'chords' | 'keys' | 'bass' | 'strings' | 'melody';

export type GenoDuoPair = {
  /** Companion lane (inserted above current). */
  partA: GenoDuoPartKind;
  /** Current Synth Geno lane. */
  partB: GenoDuoPartKind;
  label: string;
};

export type GenoChordStyle =
  | 'pop'
  | 'rnb'
  | 'gospel'
  | 'trap'
  | 'dance'
  | 'disco'
  | 'dark'
  | 'bright'
  | 'major'
  | 'minor'
  | 'kpop'
  | 'jazz'
  | 'default';

export type GenoMelodyFlavor = 'pop' | 'rnb' | 'rnbFunk' | 'soul' | 'kpop' | 'default';

export type GenoComposePromptProfile = {
  pair: GenoDuoPair;
  chordStyle: GenoChordStyle;
  melodyFlavor: GenoMelodyFlavor;
  tags: string[];
};

function normalizeComposePrompt(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bcards\b/g, 'chords')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(raw: string): string {
  return normalizeComposePrompt(raw);
}

function hasPairJoin(lower: string): boolean {
  return /\b(and|with|\+|plus|over)\b/.test(lower);
}

/** Detect explicit two-part requests from the prompt. */
export function parseGenoDuoPairFromPrompt(prompt: string): GenoDuoPair {
  const lower = normalize(prompt);

  const chordsStrings =
    /\b(chords?|harmony|voicing)\s*(and|with|\+|plus)\s*(strings?|violin|pad)\b/.test(lower) ||
    /\b(strings?|violin|pad)\s*(and|with|\+|plus)\s*chords?\b/.test(lower);
  if (chordsStrings) {
    return { partA: 'strings', partB: 'chords', label: 'Strings + Chords' };
  }

  const stringsMelody =
    /\b(strings?|violin|viola|pad)\s*(and|with|\+|plus|over)\s*(melody|lead|top\s*line)\b/.test(lower) ||
    /\b(melody|lead|top\s*line)\s*(and|with|\+|plus|over)\s*strings?\b/.test(lower) ||
    /\bchords?\s*(and|with|\+|plus)\s*strings?\b/.test(lower) ||
    /\bstrings?\s*(and|with|\+|plus)\s*chords?\b/.test(lower);
  if (stringsMelody) {
    return { partA: 'strings', partB: 'melody', label: 'Strings + Melody' };
  }

  const bassMelody =
    /\b(bassline|bass|808|sub)\s*(and|with|\+|plus|over)\s*(melody|lead|top\s*line)\b/.test(lower) ||
    /\b(melody|lead|top\s*line)\s*(and|with|\+|plus|over)\s*(bassline|bass|808)\b/.test(lower);
  if (bassMelody) {
    return { partA: 'bass', partB: 'melody', label: 'Bass + Melody' };
  }

  const keysMelody =
    /\b(keys|piano|keyboard)\s*(and|with|\+|plus|over)\s*(melody|lead)\b/.test(lower) ||
    /\b(melody|lead)\s*(and|with|\+|plus|over)\s*(keys|piano)\b/.test(lower);
  if (keysMelody) {
    return { partA: 'keys', partB: 'melody', label: 'Keys + Melody' };
  }

  const chordsMelody =
    /\b(chords?|harmony|voicing|pads?)\s*(and|with|\+|plus|over)\s*(melody|lead|top\s*line)\b/.test(lower) ||
    /\b(melody|lead|top\s*line)\s*(and|with|\+|plus|over)\s*chords?\b/.test(lower) ||
    (/\b(chords?|harmony)\b/.test(lower) && /\b(melody|lead)\b/.test(lower) && hasPairJoin(lower));
  if (chordsMelody) {
    return { partA: 'chords', partB: 'melody', label: 'Chords + Melody' };
  }

  if (/\bbass\b/.test(lower) && !/\b(chords?|keys|piano)\b/.test(lower)) {
    return { partA: 'bass', partB: 'melody', label: 'Bass + Melody' };
  }

  if (/\b(strings?|violin)\b/.test(lower)) {
    return { partA: 'strings', partB: 'melody', label: 'Strings + Melody' };
  }

  if (/\b(chords?|keys|piano|harmony|pads?)\b/.test(lower)) {
    return { partA: 'chords', partB: 'melody', label: 'Chords + Melody' };
  }

  return { partA: 'chords', partB: 'melody', label: 'Chords + Melody' };
}

export function parseGenoChordStyleFromPrompt(prompt: string): GenoChordStyle {
  const lower = normalize(prompt);
  if (/\b(disco|funk|four on the floor|70s)\b/.test(lower)) return 'disco';
  if (/\b(dance|edm|house|club|festival)\b/.test(lower)) return 'dance';
  if (/\b(k\s*pop|kpop|k-pop)\b/.test(lower)) return 'kpop';
  if (/\b(dark|moody|sad|emotional|melanchol)\b/.test(lower)) return 'dark';
  if (/\bminor\b/.test(lower) && !/\bmajor\b/.test(lower)) return 'minor';
  if (/\b(bright|happy|uplift|sunshine|feel good)\b/.test(lower)) return 'bright';
  if (/\bmajor\b/.test(lower)) return 'major';
  if (/\b(jazz|bebop|swing|standards?|ii\s*v|coltrane|bossa)\b/.test(lower)) return 'jazz';
  if (/\b(r&b|rnb|r and b|rhythm and blues|contemporary r&b)\b/.test(lower)) return 'rnb';
  if (/\b(neo\s*soul|neosoul|soulful|slow jam)\b/.test(lower)) return 'rnb';
  if (/\bgospel\b/.test(lower)) return 'gospel';
  if (/\b(pop|top\s*40|radio|hook)\s*(chords?|harmony|progression)?\b/.test(lower)) return 'pop';
  if (/\bpop\b/.test(lower)) return 'pop';
  if (/\b(trap|drill|808\s*chords?)\b/.test(lower)) return 'trap';
  return 'default';
}

export function parseGenoMelodyFlavorFromPrompt(prompt: string): GenoMelodyFlavor {
  const lower = normalize(prompt);
  if (/\b(90s\s*r&b|rnb\s*funk|funk\s*r&b|funky\s*r&b)\b/.test(lower)) return 'rnbFunk';
  if (/\b(k\s*pop|kpop|k-pop)\b/.test(lower)) return 'kpop';
  if (/\b(r&b|rnb|neo\s*soul|neosoul|soulful|soul)\b/.test(lower)) return 'rnb';
  if (/\bpop\b/.test(lower)) return 'pop';
  return 'default';
}

export function se2SynthGenoWantsChordsOnly(prompt: string): boolean {
  const lower = normalize(prompt);
  if (/\b(melody|lead|top\s*line|bassline|808|sub)\b/.test(lower) && hasPairJoin(lower)) return false;
  return (
    /\b(chords?\s*only|only\s*chords?|chord\s*generator|generate\s*chords?|chord\s*progression|progression\s*only)\b/.test(
      lower,
    ) ||
    (/\b(chords?|harmony|voicing|pads?|keys|piano)\b/.test(lower) &&
      !hasPairJoin(lower) &&
      !/\b(melody|lead|bassline|bass)\b/.test(lower))
  );
}

export function se2SynthGenoWantsDuo(prompt: string): boolean {
  if (se2SynthGenoWantsChordsOnly(prompt)) return false;
  const lower = normalize(prompt);
  return (
    /\b(duo|pair|two parts?|2 parts?|arrangement|stack|composition)\b/.test(lower) ||
    hasPairJoin(lower) ||
    /\b(chords?|bass|strings?|keys)\s*(and|with|\+)\s*(melody|lead)\b/.test(lower) ||
    (/\bpop\s*chords?\b/.test(lower) && /\b(melody|lead)\b/.test(lower)) ||
    (/\b(r&b|rnb)\s*chords?\b/.test(lower) && /\b(melody|lead)\b/.test(lower))
  );
}

export function buildGenoComposePromptProfile(prompt: string): GenoComposePromptProfile {
  const pair = parseGenoDuoPairFromPrompt(prompt);
  const chordStyle = parseGenoChordStyleFromPrompt(prompt);
  const melodyFlavor = parseGenoMelodyFlavorFromPrompt(prompt);
  const tags: string[] = [pair.label];
  if (chordStyle !== 'default') tags.push(`${chordStyle} chords`);
  if (melodyFlavor !== 'default') tags.push(`${melodyFlavor} melody`);
  return { pair, chordStyle, melodyFlavor, tags };
}

export const SE2_SYNTH_GENO_DUO_EXAMPLES: readonly string[] = [
  'pop chord progression 8 bars',
  'R&B chords only 8 bars',
  'pop chords and melody 8 bars',
  'bassline and melody 4 bars',
  'gospel chord generator 8 bars',
];
