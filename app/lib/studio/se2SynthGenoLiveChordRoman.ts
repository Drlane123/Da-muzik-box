/**
 * Roman numeral → GenoBarChordSpec for Live Chord presets (genre-tuned 7th voicings).
 */
import {
  chordSymbolIntervalMap,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { se2SynthGenoDefaultVoicingDepth } from '@/app/lib/studio/se2SynthGenoVoicingDepth';

/** Bump when voicing hints / register change — Live panel re-resolves pad specs. */
export const SE2_SYNTH_GENO_LIVE_VOICING_REVISION = 18;

/** Bump when Chord Generator voicing pipeline changes — era pad specs re-resolve. */
export const SE2_SYNTH_GENO_PLUGIN_VOICING_REVISION = 2;

/** User-verified comp register reference for Pop / Afrobeats octave lock. */
export const SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE: Se2SynthGenoLiveGenreId = 'lofi';

const ROMAN_DEGREE: Record<string, number> = {
  I: 0,
  Imaj7: 0,
  Imaj9: 0,
  Imaj13: 0,
  I69: 0,
  'Imaj7#11': 0,
  I7: 0,
  Isus4: 0,
  'i(maj7)': 0,
  i: 0,
  i7: 0,
  i9: 0,
  i11: 0,
  i69: 0,
  ii: 1,
  II7: 1,
  ii7: 1,
  ii9: 1,
  ii11: 1,
  'ii°': 1,
  'iiø7': 1,
  iii: 2,
  iii7: 2,
  iii9: 2,
  iii11: 2,
  bIII: 2,
  bIIImaj7: 2,
  bIIImaj9: 2,
  IV: 3,
  IVmaj7: 3,
  IVmaj9: 3,
  IVmaj13: 3,
  IV69: 3,
  IV7: 3,
  IV9: 3,
  IV13: 3,
  iv: 3,
  iv7: 3,
  iv9: 3,
  iv11: 3,
  V: 4,
  V7: 4,
  V9: 4,
  V11: 4,
  V13: 4,
  Vsus4: 4,
  V13sus: 4,
  v: 4,
  vi: 5,
  vi7: 5,
  vi9: 5,
  vi11: 5,
  bVI: 5,
  bVImaj7: 5,
  bVImaj9: 5,
  VI: 5,
  VImaj7: 5,
  VImaj9: 5,
  bVII: 6,
  bVIImaj7: 6,
  bVIImaj9: 6,
  bVII7: 6,
  VII: 6,
  VII7: 6,
  'vii°': 6,
  'vii°7': 6,
  bII: 1,
  bIImaj7: 1,
};

const LIVE_ROMAN_MODE_FALLBACK: ChordMode[] = [
  'minor',
  'major',
  'dorian',
  'mixolydian',
  'phrygian',
  'lydian',
  'harmonicMinor',
  'melodicMinor',
];

function liveRomanIntervals(roman: ChordSymbol, mode: ChordMode): readonly number[] | null {
  for (const m of [mode, ...LIVE_ROMAN_MODE_FALLBACK]) {
    const iv = chordSymbolIntervalMap(roman, m);
    if (iv) return iv;
  }
  return null;
}

function liveVoicingHints(
  roman: ChordSymbol,
  genreId: Se2SynthGenoLiveGenreId,
): Pick<GenoBarChordSpec, 'lockedType' | 'inversion' | 'stackOctave' | 'smartMatch'> {
  const openNeo = genreId === 'rich-jazz' || genreId === 'deep-neo' || genreId === 'deep-rnb';
  const jazz = genreId === 'jazz' || openNeo;
  const soul =
    genreId === 'rnb'
    || genreId === 'rnb-pop'
    || genreId === 'neo-soul'
    || genreId === 'gospel'
    || genreId === 'deep-rnb'
    || jazz;
  const trap =
    genreId === 'trap'
    || genreId === 'hip-hop'
    || genreId === 'drill'
    || genreId === 'latin-trap'
    || genreId === 'plug-rage'
    || genreId === 'jersey-bounce';
  const dark = genreId === 'dark-cinematic' || genreId === 'lofi-cinematic';
  const lofi = genreId === 'lofi' || genreId === 'lofi-cinematic';
  const pop = genreId === 'pop' || genreId === 'rnb-pop' || genreId === 'kpop' || genreId === 'afrobeats';
  const dance = genreId === 'house-dance' || genreId === 'jersey-bounce';
  const boom = genreId === 'boom-bap';
  /** Same comp register as hip-hop / neo-soul / lo-fi — not the low R&B maj7 root stack. */
  const brightComp = trap || soul || lofi || boom || dance || pop;

  if (roman === 'Isus4' || roman === 'Vsus4') {
    return { lockedType: 'sus', smartMatch: false, inversion: 0 };
  }
  if (roman === 'iiø7' || roman === 'vii°7' || roman === 'ii°' || roman === 'vii°' || roman === 'iø7') {
    return {
      lockedType: 'dim',
      smartMatch: false,
      inversion: openNeo ? 0 : jazz ? 2 : dark ? 0 : 1,
      stackOctave: !openNeo && (jazz || dark),
    };
  }
  if (roman === 'i(maj7)') {
    return { lockedType: 'min', smartMatch: false, inversion: 0, stackOctave: dark };
  }
  if (
    roman.includes('maj7')
    || roman.includes('maj9')
    || roman.includes('maj13')
    || roman.endsWith('69')
    || roman === 'VImaj7'
    || roman === 'bVImaj7'
    || roman === 'bIIImaj7'
  ) {
    return {
      lockedType: 'maj',
      smartMatch: false,
      inversion: openNeo ? 0 : jazz ? 2 : genreId === 'rnb' || genreId === 'rnb-pop' ? 0 : brightComp ? 1 : 1,
      stackOctave: openNeo
        ? false
        : genreId === 'rnb' || genreId === 'rnb-pop'
          ? false
          : brightComp || jazz || dark,
    };
  }
  if (
    roman === 'ii7'
    || roman === 'ii9'
    || roman === 'ii11'
    || roman === 'iii7'
    || roman === 'iii9'
    || roman === 'iii11'
    || roman === 'vi7'
    || roman === 'vi9'
    || roman === 'vi11'
    || roman === 'i7'
    || roman === 'i9'
    || roman === 'i11'
    || roman === 'i69'
    || roman === 'iv7'
    || roman === 'iv9'
    || roman === 'iv11'
  ) {
    return {
      lockedType: 'min',
      smartMatch: false,
      inversion: openNeo
        ? 0
        : jazz
          ? 2
          : genreId === 'rnb' || genreId === 'rnb-pop'
            ? 1
            : soul
              ? 1
              : lofi
                ? 1
                : boom
                  ? 1
                  : 1,
      stackOctave: openNeo
        ? false
        : genreId === 'rnb' || genreId === 'rnb-pop'
          ? false
          : brightComp || jazz,
    };
  }
  if (
    roman === 'I7'
    || roman === 'V7'
    || roman === 'V9'
    || roman === 'V11'
    || roman === 'V13'
    || roman === 'V13sus'
    || roman === 'IV7'
    || roman === 'IV9'
    || roman === 'IV13'
    || roman === 'II7'
    || roman === 'VII7'
    || roman === 'bVII7'
  ) {
    return {
      lockedType: 'maj',
      smartMatch: false,
      inversion: openNeo
        ? 0
        : jazz
          ? 1
          : genreId === 'rnb' || genreId === 'rnb-pop'
            ? 0
            : soul
              ? 1
              : pop
                ? 1
                : dance
                  ? 0
                  : 0,
      stackOctave: openNeo
        ? false
        : genreId === 'rnb' || genreId === 'rnb-pop'
          ? false
          : brightComp || jazz || dark || dance,
    };
  }
  if (roman === 'bVII' || roman === 'bVI' || roman === 'bIII' || roman === 'VII' || roman === 'VI') {
    return { lockedType: 'maj', smartMatch: false, inversion: 0, stackOctave: brightComp };
  }
  if (roman === 'bII' || roman === 'bIImaj7') {
    return {
      lockedType: 'maj',
      smartMatch: false,
      inversion: jazz ? 2 : 0,
      stackOctave: jazz || dark,
    };
  }
  if (roman === 'iv') {
    return { lockedType: 'min', smartMatch: false, inversion: 1, stackOctave: trap };
  }
  return { smartMatch: false, inversion: 0, stackOctave: brightComp || soul || dance };
}

export function se2SynthGenoLiveRomanToBarSpec(
  roman: ChordSymbol,
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
): GenoBarChordSpec {
  const intervals = liveRomanIntervals(roman, mode);
  const hints = liveVoicingHints(roman, genreId);
  const degree = ROMAN_DEGREE[roman] ?? 0;

  if (intervals) {
    return {
      degree,
      chordIntervals: [...intervals],
      smartMatch: false,
      lockedType: hints.lockedType,
      inversion: hints.inversion ?? 0,
      stackOctave: hints.stackOctave,
      voicingDepth: se2SynthGenoDefaultVoicingDepth(genreId),
    };
  }

  return {
    degree,
    smartMatch: hints.smartMatch ?? false,
    lockedType: hints.lockedType,
    inversion: hints.inversion ?? 0,
    stackOctave: hints.stackOctave,
    voicingDepth: se2SynthGenoDefaultVoicingDepth(genreId),
  };
}

export function se2SynthGenoLiveRomansToSpecs(
  romans: readonly ChordSymbol[],
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
): GenoBarChordSpec[] {
  return romans.map((r) => se2SynthGenoLiveRomanToBarSpec(r, mode, genreId));
}

/** Fresh genre hints every play — never trust stale {@link chordSpecs} baked at preset load. */
export function se2SynthGenoLiveSlotSpecForVoice(
  preset: {
    romans: readonly ChordSymbol[];
    mode: ChordMode;
    genreId: Se2SynthGenoLiveGenreId;
  },
  slotIndex: number,
  overrides?: Pick<GenoBarChordSpec, 'voicingDepth' | 'chopQuant'>,
): GenoBarChordSpec | null {
  const roman = preset.romans[slotIndex];
  if (!roman) return null;
  const fresh = se2SynthGenoLiveRomanToBarSpec(roman, preset.mode, preset.genreId);
  if (preset.genreId === 'pop' || preset.genreId === 'rnb-pop' || preset.genreId === 'kpop' || preset.genreId === 'afrobeats') {
    const ref = se2SynthGenoLiveRomanToBarSpec(
      roman,
      preset.mode,
      SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE,
    );
    return {
      ...fresh,
      inversion: ref.inversion,
      stackOctave: ref.stackOctave,
      ...overrides,
    };
  }
  return { ...fresh, ...overrides };
}

export function se2SynthGenoLiveChordModeToKeyMode(mode: ChordMode): 'major' | 'minor' {
  if (mode === 'major' || mode === 'lydian' || mode === 'mixolydian') return 'major';
  return 'minor';
}

const LIVE_MAJOR_ROMAN: ChordSymbol[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const LIVE_MINOR_ROMAN: ChordSymbol[] = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

export function se2SynthGenoLiveRomanForDegree(degree: number, mode: ChordMode): ChordSymbol {
  const d = ((Math.round(degree) % 7) + 7) % 7;
  const romans =
    se2SynthGenoLiveChordModeToKeyMode(mode) === 'minor' ? LIVE_MINOR_ROMAN : LIVE_MAJOR_ROMAN;
  return romans[d] ?? 'I';
}

/** Rebuild chord intervals after loop-editor degree edits — keeps voicing depth / chop. */
export function se2SynthGenoLiveRebuildSpecForDegree(
  degree: number,
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
  keep?: Pick<GenoBarChordSpec, 'voicingDepth' | 'chopQuant' | 'inversion'>,
): GenoBarChordSpec {
  const rebuilt = se2SynthGenoLiveRomanToBarSpec(se2SynthGenoLiveRomanForDegree(degree, mode), mode, genreId);
  return {
    ...rebuilt,
    degree,
    voicingDepth: keep?.voicingDepth ?? rebuilt.voicingDepth,
    chopQuant: keep?.chopQuant,
    inversion: keep?.inversion ?? rebuilt.inversion,
  };
}
