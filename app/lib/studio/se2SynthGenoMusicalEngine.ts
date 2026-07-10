/**
 * Synth Geno — musical duo engine (shared progression, 2 parts max).
 * Uses only standalone Synth Geno chord / melody / bass engines — no Groove Lab or Orchid.
 */
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import type {
  GenoChordStyle,
  GenoComposePromptProfile,
} from '@/app/lib/studio/se2SynthGenoComposePrompt';
import {
  genoGenerateChordsFromStyle,
  genoHarmonyToNotes,
  type GenoHarmony,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import { genoGenerateMelodyFromHarmony } from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import { genoGenerateBassFromHarmony, type GenoBassPattern } from '@/app/lib/studio/se2SynthGenoBassEngine';
import { genoStylePreset } from '@/app/lib/studio/se2SynthGenoStylePresets';
import { se2ScaleDegreeRootMidi, type Se2ComposeResolvedKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import {
  GENO_BASS_MIDI_MAX,
  GENO_BASS_MIDI_MIN,
  GENO_CHORD_MIDI_MAX,
  GENO_CHORD_MIDI_MIN,
  GENO_CHORD_ROOT_OCTAVE_MIDI,
  genoBassPitchFromHarmonyRoot,
  genoWrapMidiToRange,
} from '@/app/lib/studio/se2SynthGenoRanges';

export type GenoMusicalSession = {
  harmony: GenoHarmony;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  barCount: number;
  seed: number;
  chordStyle: GenoChordStyle;
};

function normalizeKeyRoot(root: number): number {
  return ((Math.round(root) % 12) + 12) % 12;
}

function clampBassMidi(midi: number, keyRoot: number): number {
  const pc = normalizeKeyRoot(keyRoot);
  let m = Math.round(midi);
  m = m - (((m % 12) + 12) % 12) + pc;
  return genoWrapMidiToRange(m, GENO_BASS_MIDI_MIN, GENO_BASS_MIDI_MAX);
}

function wideStringVoicing(tones: number[]): number[] {
  const sorted = [...tones].sort((a, b) => a - b);
  if (sorted.length === 0) return sorted;
  const root = sorted[0]!;
  const top = sorted[sorted.length - 1]!;
  return [...new Set([root, ...sorted, top + 12])]
    .sort((a, b) => a - b)
    .slice(0, 5)
    .filter((n) => n >= GENO_CHORD_MIDI_MIN && n <= GENO_CHORD_MIDI_MAX + 12);
}

function inferHarmonyFromAnchors(
  notes: readonly StudioEditor2GenNote[],
  barCount: number,
  beatsPerBar: number,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
): GenoHarmony {
  const columns: GenoHarmony['columns'] = [];
  for (let bar = 0; bar < barCount; bar += 1) {
    const barStart = bar * beatsPerBar;
    const inBar = notes.filter((n) => n.startBeat >= barStart && n.startBeat < barStart + beatsPerBar);
    const rootMidi =
      inBar.length > 0
        ? clampBassMidi(genoBassPitchFromHarmonyRoot(Math.min(...inBar.map((n) => n.pitch))), keyRoot)
        : clampBassMidi(se2ScaleDegreeRootMidi(keyRoot, keyMode, 0, GENO_CHORD_ROOT_OCTAVE_MIDI - 12), keyRoot);
    const tones =
      inBar.length >= 2
        ? [...new Set(inBar.map((n) => n.pitch))].sort((a, b) => a - b).slice(0, 5)
        : [rootMidi + 12, rootMidi + 16, rootMidi + 19];
    columns.push({ bar, degree: 0, rootMidi, tones });
  }
  return { columns };
}

export function genoCreateMusicalSession(opts: {
  barCount: number;
  beatsPerBar: number;
  resolvedKey: Se2ComposeResolvedKey;
  seed: number;
  profile?: GenoComposePromptProfile;
  existingHarmonyNotes?: readonly StudioEditor2GenNote[];
  staccatoChords?: boolean;
}): GenoMusicalSession {
  const keyRoot = normalizeKeyRoot(opts.resolvedKey.keyRoot);
  const chordStyle = opts.profile?.chordStyle ?? 'default';

  const harmony =
    opts.existingHarmonyNotes && opts.existingHarmonyNotes.length > 0
      ? inferHarmonyFromAnchors(
          opts.existingHarmonyNotes,
          opts.barCount,
          opts.beatsPerBar,
          keyRoot,
          opts.resolvedKey.keyMode,
        )
      : genoGenerateChordsFromStyle({
          barCount: opts.barCount,
          beatsPerBar: opts.beatsPerBar,
          keyRoot,
          keyMode: opts.resolvedKey.keyMode,
          chordStyle,
          seed: opts.seed,
          staccato: opts.staccatoChords,
        }).harmony;

  return {
    harmony,
    keyRoot,
    keyMode: opts.resolvedKey.keyMode,
    beatsPerBar: opts.beatsPerBar,
    barCount: opts.barCount,
    seed: opts.seed,
    chordStyle,
  };
}

function melodyMaxLeap(session: GenoMusicalSession): number {
  const flavor = session.chordStyle;
  if (flavor === 'rnb' || flavor === 'gospel') return 4;
  return 5;
}

export function genoGenerateMelodyPart(
  session: GenoMusicalSession,
  promptStyle?: 'lyrical' | 'riff' | 'arp',
): StudioEditor2GenNote[] {
  return genoGenerateMelodyFromHarmony({
    harmony: session.harmony,
    barCount: session.barCount,
    beatsPerBar: session.beatsPerBar,
    style: promptStyle === 'arp' ? 'arp' : promptStyle === 'riff' ? 'trap' : 'pop',
    seed: session.seed,
    maxLeap: melodyMaxLeap(session),
    keyRoot: session.keyRoot,
    keyMode: session.keyMode,
  });
}

export function genoGenerateChordsPart(session: GenoMusicalSession, staccato = false): StudioEditor2GenNote[] {
  const built = genoGenerateChordsFromStyle({
    barCount: session.barCount,
    beatsPerBar: session.beatsPerBar,
    keyRoot: session.keyRoot,
    keyMode: session.keyMode,
    chordStyle: session.chordStyle,
    seed: session.seed,
    staccato: staccato || session.chordStyle === 'trap',
  });
  return built.notes;
}

/** Re-render chords from session harmony (same progression, current voicing path). */
export function genoBuildMusicalHarmony(
  barCount: number,
  beatsPerBar: number,
  keyRoot: number,
  mode: StudioDetectedKeyMode,
  seed: number,
  chordStyle: GenoChordStyle = 'default',
): GenoHarmony {
  void beatsPerBar;
  return genoGenerateChordsFromStyle({
    barCount,
    beatsPerBar,
    keyRoot,
    keyMode: mode,
    chordStyle,
    seed,
  }).harmony;
}

export function genoGenerateChordsFromSessionHarmony(
  session: GenoMusicalSession,
  staccato = false,
): StudioEditor2GenNote[] {
  const styleBuilt = genoGenerateChordsFromStyle({
    barCount: session.barCount,
    beatsPerBar: session.beatsPerBar,
    keyRoot: session.keyRoot,
    keyMode: session.keyMode,
    chordStyle: session.chordStyle,
    seed: session.seed,
    staccato,
  });
  return genoHarmonyToNotes(
    {
      keyRoot: session.keyRoot,
      keyMode: session.keyMode,
      barCount: session.barCount,
      beatsPerBar: session.beatsPerBar,
      progressionId: styleBuilt.progressionId,
      smartMatch: true,
      lockedType: session.keyMode === 'minor' ? 'min' : 'maj',
      extensions: new Set(),
      inversion: 0,
      perfMode: 'block',
      staccato,
      repeaterQuant: '1/8',
      includeBassRoot: false,
    },
    session.harmony,
  );
}

export function genoGenerateStringsPart(session: GenoMusicalSession): StudioEditor2GenNote[] {
  const notes: StudioEditor2GenNote[] = [];
  const bpb = session.beatsPerBar;
  for (const col of session.harmony.columns) {
    if (col.bar >= session.barCount) continue;
    const startBeat = col.bar * bpb;
    for (const pitch of wideStringVoicing(col.tones)) {
      notes.push({
        pitch: Math.max(GENO_CHORD_MIDI_MIN, Math.min(GENO_CHORD_MIDI_MAX + 12, pitch)),
        startBeat,
        durationBeats: bpb * 0.98,
        velocity: 52 + (col.bar % 2) * 5,
      });
    }
  }
  return notes;
}

function bassPatternForStyle(style: GenoChordStyle): GenoBassPattern {
  return genoStylePreset(style).bassPattern;
}

export function genoGenerateBassPart(session: GenoMusicalSession): StudioEditor2GenNote[] {
  return genoGenerateBassFromHarmony({
    harmony: session.harmony,
    barCount: session.barCount,
    beatsPerBar: session.beatsPerBar,
    pattern: bassPatternForStyle(session.chordStyle),
    seed: session.seed,
    keyRoot: session.keyRoot,
    keyMode: session.keyMode,
  });
}

export function genoMelodyStyleFromPrompt(prompt: string): 'lyrical' | 'riff' | 'arp' {
  const lower = prompt.toLowerCase();
  if (/\b(arp|arpeggio|pluck)\b/.test(lower)) return 'arp';
  if (/\b(riff|bounce|funky|trap|drill|stab|staccato)\b/.test(lower)) return 'riff';
  return 'lyrical';
}

export function genoPromptWantsStaccatoChords(prompt: string): boolean {
  return /\b(stab|staccato|short|pluck)\b/.test(prompt.toLowerCase());
}

export type GenoDuoPartOutput = {
  part: 'chords' | 'keys' | 'bass' | 'strings' | 'melody';
  notes: StudioEditor2GenNote[];
};

export function genoGenerateDuoPart(
  session: GenoMusicalSession,
  part: GenoDuoPartOutput['part'],
  prompt: string,
): StudioEditor2GenNote[] {
  switch (part) {
    case 'bass':
      return genoGenerateBassPart(session);
    case 'strings':
      return genoGenerateStringsPart(session);
    case 'keys':
    case 'chords':
      return genoGenerateChordsPart(session, genoPromptWantsStaccatoChords(prompt));
    case 'melody':
      return genoGenerateMelodyPart(session, genoMelodyStyleFromPrompt(prompt));
    default:
      return genoGenerateMelodyPart(session);
  }
}

export function genoGenerateDuo(
  session: GenoMusicalSession,
  partA: GenoDuoPartOutput['part'],
  partB: GenoDuoPartOutput['part'],
  prompt: string,
): { a: GenoDuoPartOutput; b: GenoDuoPartOutput } {
  return {
    a: { part: partA, notes: genoGenerateDuoPart(session, partA, prompt) },
    b: { part: partB, notes: genoGenerateDuoPart(session, partB, prompt) },
  };
}

export const genoGenerateKeysPart = genoGenerateChordsPart;
export const genoGenerateLyricalMelody = genoGenerateMelodyPart;
