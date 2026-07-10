/**
 * Synth Geno Compose — resolve project / track / prompt key and lock generated MIDI to scale.
 */
import {
  studioKeyLabel,
  type StudioDetectedKeyMode,
} from '@/app/lib/studio/studioAudioClipAnalysis';
import { snapMidiToNeuralHumScale } from '@/app/lib/vocalLab/neuralHumKeyLock';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type { GenoHarmony } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  genoNormalizePartNotes,
  genoWarmNormalizeLiveChordNotes,
  genoWrapMidiToRange,
  GENO_CHORD_ROOT_OCTAVE_MIDI,
  GENO_BASS_MIDI_MAX,
  GENO_BASS_MIDI_MIN,
  GENO_MELODY_MIDI_MAX,
  GENO_MELODY_MIDI_MIN,
} from '@/app/lib/studio/se2SynthGenoRanges';

export type Se2SynthGenoComposeNote = StudioEditor2GenNote;

export type Se2ComposeKeySource = 'prompt' | 'track' | 'song';

export type Se2ComposeResolvedKey = {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  source: Se2ComposeKeySource;
  label: string;
};

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

const NOTE_PC: Record<string, number> = {
  c: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  f: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'a#': 10,
  bb: 10,
  b: 11,
};

function normalizeKeyRoot(root: number): number {
  return ((Math.round(root) % 12) + 12) % 12;
}

function scaleId(mode: StudioDetectedKeyMode): 'major' | 'minor' {
  return mode === 'minor' ? 'minor' : 'major';
}

type TriadQuality = 'maj' | 'min' | 'dim';

function triadOffsets(quality: TriadQuality): readonly [number, number, number] {
  switch (quality) {
    case 'maj':
      return [0, 4, 7];
    case 'min':
      return [0, 3, 7];
    case 'dim':
      return [0, 3, 6];
  }
}

/** Diatonic triad quality for scale degree (0 = tonic). */
export function se2DiatonicTriadQuality(
  mode: StudioDetectedKeyMode,
  degree: number,
): TriadQuality {
  const d = ((degree % 7) + 7) % 7;
  if (mode === 'minor') {
    if (d === 4) return 'maj';
    return (['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'] as const)[d]!;
  }
  return (['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'] as const)[d]!;
}

export function se2ScaleDegreeRootMidi(
  keyRoot: number,
  mode: StudioDetectedKeyMode,
  degree: number,
  octaveMidi = GENO_CHORD_ROOT_OCTAVE_MIDI,
): number {
  const scale = mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const pc = normalizeKeyRoot(keyRoot);
  const deg = ((degree % 7) + 7) % 7;
  const baseOct = Math.floor(octaveMidi / 12) * 12;
  return baseOct + pc + scale[deg]!;
}

export function se2DiatonicTriadMidis(
  keyRoot: number,
  mode: StudioDetectedKeyMode,
  degree: number,
  octaveMidi = GENO_CHORD_ROOT_OCTAVE_MIDI,
): number[] {
  const root = se2ScaleDegreeRootMidi(keyRoot, mode, degree, octaveMidi);
  const quality = se2DiatonicTriadQuality(mode, degree);
  return triadOffsets(quality).map((o) => root + o);
}

/** Per-bar diatonic progression with correctly spelled chord tones. */
export function se2BuildDiatonicProgressionHarmony(
  barCount: number,
  beatsPerBar: number,
  keyRoot: number,
  mode: StudioDetectedKeyMode,
  seed: number,
): GenoHarmony {
  const rnd = mulberry32Local(seed ^ 0x5047_524f);
  const majorProgs: readonly (readonly number[])[] = [
    [0, 4, 5, 3],
    [0, 5, 3, 4],
    [0, 3, 4, 0],
    [0, 4, 0, 5],
  ];
  const minorProgs: readonly (readonly number[])[] = [
    [0, 5, 3, 4],
    [0, 3, 4, 5],
    [0, 4, 5, 3],
    [0, 5, 4, 3],
  ];
  const pool = mode === 'minor' ? minorProgs : majorProgs;
  const progression = pool[Math.floor(rnd() * pool.length)] ?? pool[0]!;

  const columns: GenoHarmony['columns'] = [];
  for (let bar = 0; bar < barCount; bar += 1) {
    const deg = progression[bar % progression.length] ?? 0;
    const tones = se2DiatonicTriadMidis(keyRoot, mode, deg, GENO_CHORD_ROOT_OCTAVE_MIDI);
    columns.push({
      bar,
      degree: deg,
      rootMidi: tones[0]!,
      tones,
    });
  }
  void beatsPerBar;
  return { columns };
}

function mulberry32Local(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Parse "A minor", "in F# major", "key of D" from compose prompt. */
export function parseKeyFromComposePrompt(prompt: string): {
  keyRoot?: number;
  keyMode?: StudioDetectedKeyMode;
} {
  const lower = prompt.toLowerCase().replace(/\s+/g, ' ').trim();
  const patterns = [
    /\b(?:in|key of)\s+([a-g](?:#|b)?)\s*(major|min(?:or)?|maj|m)\b/,
    /\b([a-g](?:#|b)?)\s*(major|min(?:or)?|maj|m)\b/,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (!m) continue;
    const pc = NOTE_PC[m[1]!.replace(/\s/g, '')];
    if (pc == null) continue;
    const modeToken = m[2]!;
    const keyMode: StudioDetectedKeyMode =
      modeToken === 'm' || modeToken.startsWith('min') ? 'minor' : 'major';
    return { keyRoot: pc, keyMode };
  }
  return {};
}

export function se2SynthGenoResolveComposeKey(opts: {
  prompt: string;
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
}): Se2ComposeResolvedKey {
  const fromPrompt = parseKeyFromComposePrompt(opts.prompt);
  if (fromPrompt.keyRoot != null && fromPrompt.keyMode) {
    const keyRoot = normalizeKeyRoot(fromPrompt.keyRoot);
    return {
      keyRoot,
      keyMode: fromPrompt.keyMode,
      source: 'prompt',
      label: studioKeyLabel(keyRoot, fromPrompt.keyMode),
    };
  }
  if (opts.trackKeyRoot != null && opts.trackKeyMode) {
    const keyRoot = normalizeKeyRoot(opts.trackKeyRoot);
    return {
      keyRoot,
      keyMode: opts.trackKeyMode,
      source: 'track',
      label: studioKeyLabel(keyRoot, opts.trackKeyMode),
    };
  }
  const keyRoot = normalizeKeyRoot(opts.songKeyRoot);
  return {
    keyRoot,
    keyMode: opts.songKeyMode,
    source: 'song',
    label: studioKeyLabel(keyRoot, opts.songKeyMode),
  };
}

function lockChordNotesToKey(
  notes: readonly Se2SynthGenoComposeNote[],
  _key: Se2ComposeResolvedKey,
): Se2SynthGenoComposeNote[] {
  /** Chord voicings are already spelled — warm C3–C5 register, never scale-snap (destroys 7ths/sus). */
  void _key;
  return genoWarmNormalizeLiveChordNotes(notes);
}

/** Final pass — snap every pitch to key scale + sensible register (matches Groove Lab / SE2). */
export function se2SynthGenoLockNotesToKey(
  notes: readonly Se2SynthGenoComposeNote[],
  key: Se2ComposeResolvedKey,
  register: 'bass' | 'chord' | 'melody',
): Se2SynthGenoComposeNote[] {
  if (notes.length === 0) return [];
  if (register === 'chord') return lockChordNotesToKey(notes, key);
  const scale = scaleId(key.keyMode);
  const ranges = {
    bass: { min: GENO_BASS_MIDI_MIN, max: GENO_BASS_MIDI_MAX },
    melody: { min: GENO_MELODY_MIDI_MIN, max: GENO_MELODY_MIDI_MAX },
  }[register];

  return notes.map((n) => {
    const snapped = snapMidiToNeuralHumScale(n.pitch, key.keyRoot, scale);
    const pitch = genoWrapMidiToRange(snapped, ranges.min, ranges.max);
    return { ...n, pitch };
  });
}
