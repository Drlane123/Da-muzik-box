/**
 * Synth Geno Compose — duo-only (2 parts max), prompt-driven pairs + genres.
 */
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  studioInferBarCountFromNotes,
  type StudioEditor2GenNote,
  type StudioGeneratePartKind,
} from '@/app/lib/studio/studioEditor2PartGenerator';
import type { Se2SynthGenoRole } from '@/app/lib/studio/se2SynthGenoTypes';
import { genoNormalizePartNotes } from '@/app/lib/studio/se2SynthGenoRanges';
import {
  se2SynthGenoLockNotesToKey,
  se2SynthGenoResolveComposeKey,
  type Se2ComposeKeySource,
  type Se2ComposeResolvedKey,
} from '@/app/lib/studio/se2SynthGenoKeyLock';
import {
  buildGenoComposePromptProfile,
  parseGenoDuoPairFromPrompt,
  se2SynthGenoWantsDuo,
  se2SynthGenoWantsChordsOnly,
  SE2_SYNTH_GENO_DUO_EXAMPLES,
  type GenoDuoPartKind,
} from '@/app/lib/studio/se2SynthGenoComposePrompt';
import { genoGenerateChordsFromStyle } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  genoCreateMusicalSession,
  genoGenerateDuo,
  genoGenerateDuoPart,
  genoMelodyStyleFromPrompt,
  genoPromptWantsStaccatoChords,
} from '@/app/lib/studio/se2SynthGenoMusicalEngine';
import { mixSeed } from '@/app/lib/groovePatternEngine';

export type Se2SynthGenoComposeNote = StudioEditor2GenNote;

/** Key + optional transport BPM sync when applying Geno stacks to SE2. */
export type Se2SynthGenoApplyStackMeta = {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  /** Chord-loop tempo from the active card / build (B01 livePreviewBpm, B02 pluginPreviewBpm). */
  chordBpm?: number;
  /** When true, SE2 transport BPM follows chordBpm on apply. */
  syncTransportBpm?: boolean;
};

export type Se2SynthGenoComposeMode = 'create' | 'extend' | 'accompany' | 'duo' | 'chords';

export type Se2SynthGenoStackRole = 'bass' | 'chords' | 'melody' | 'keys' | 'strings';

export type Se2SynthGenoStackPart = {
  role: Se2SynthGenoStackRole;
  label: string;
  notes: Se2SynthGenoComposeNote[];
  trackKind: 'midi' | 'synthGeno';
  midiInstrumentId?: string;
  synthGenoRole?: Se2SynthGenoRole;
  synthGenoBankId?: string;
  drumPatternPresetId?: string;
  drumProducerKitId?: BeatLabProducerKitId;
};

export type Se2SynthGenoComposeResult = {
  notes: Se2SynthGenoComposeNote[];
  kind: StudioGeneratePartKind;
  bars: number;
  matchedTags: string[];
  mode: Se2SynthGenoComposeMode;
  stack?: Se2SynthGenoStackPart[];
  duoLabel?: string;
  keyLabel: string;
  keySource: Se2ComposeKeySource;
  resolvedKey: Se2ComposeResolvedKey;
};

const WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  sixteen: 16,
  thirty: 30,
};

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function promptHas(tokens: string[], ...phrases: string[]): boolean {
  const joined = tokens.join(' ');
  return phrases.some((p) => joined.includes(p) || tokens.includes(p));
}

function clampBars(n: number): number {
  return Math.max(1, Math.min(32, Math.round(n)));
}

export function parseBarsFromPrompt(prompt: string, fallback = 8): number {
  const tokens = tokenize(prompt);
  const joined = tokens.join(' ');

  const digitMatch = joined.match(/\b(\d+)\s*-?\s*bars?\b/);
  if (digitMatch) return clampBars(parseInt(digitMatch[1]!, 10));

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== 'bar' && tokens[i] !== 'bars') continue;
    const prev = tokens[i - 1];
    if (!prev) continue;
    const asNum = parseInt(prev, 10);
    if (Number.isFinite(asNum) && asNum > 0) return clampBars(asNum);
    const asWord = WORD_NUM[prev];
    if (asWord) return clampBars(asWord);
  }

  for (const [word, n] of Object.entries(WORD_NUM)) {
    if (new RegExp(`\\b${word}\\s+bars?\\b`).test(joined)) return clampBars(n);
  }

  if (promptHas(tokens, 'long', 'extended')) return 8;
  return clampBars(fallback);
}

function resolveComposeBarCount(prompt: string, projectLoopBars?: number, forceDuo?: boolean): number {
  const loopFallback = Math.max(4, Math.min(16, projectLoopBars ?? 8));
  const duoDefault = Math.max(8, loopFallback);
  const fallback = forceDuo ? duoDefault : loopFallback;
  return parseBarsFromPrompt(prompt, fallback);
}

function parseExtendBars(prompt: string, projectLoopBars?: number): number {
  return parseBarsFromPrompt(prompt, Math.max(4, Math.min(16, projectLoopBars ?? 4)));
}

type ComposeKeyOpts = {
  prompt: string;
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
};

function resolveComposeKey(opts: ComposeKeyOpts): Se2ComposeResolvedKey {
  return se2SynthGenoResolveComposeKey(opts);
}

function lockMelodyNotes(notes: readonly Se2SynthGenoComposeNote[], key: Se2ComposeResolvedKey) {
  return genoNormalizePartNotes(
    se2SynthGenoLockNotesToKey(notes, key, 'melody'),
    'melody',
  );
}

function lockBassNotes(notes: readonly Se2SynthGenoComposeNote[], key: Se2ComposeResolvedKey) {
  return genoNormalizePartNotes(
    se2SynthGenoLockNotesToKey(notes, key, 'bass'),
    'bass',
  );
}

function lockChordNotes(notes: readonly Se2SynthGenoComposeNote[], key: Se2ComposeResolvedKey) {
  return genoNormalizePartNotes(
    se2SynthGenoLockNotesToKey(notes, key, 'chord'),
    'chord',
  );
}

function lockForPart(part: GenoDuoPartKind, notes: Se2SynthGenoComposeNote[], key: Se2ComposeResolvedKey) {
  if (part === 'bass') return lockBassNotes(notes, key);
  if (part === 'melody') return lockMelodyNotes(notes, key);
  return lockChordNotes(notes, key);
}

/** @deprecated Use se2SynthGenoWantsDuo */
export function se2SynthGenoWantsFullStack(prompt: string): boolean {
  return se2SynthGenoWantsDuo(prompt);
}

export function se2SynthGenoDetectPartKind(
  prompt: string,
  voiceRole?: Se2SynthGenoRole,
): StudioGeneratePartKind {
  const tokens = tokenize(prompt);
  if (promptHas(tokens, 'bass', '808', 'sub', 'low end', 'woofer')) return 'bass';
  if (promptHas(tokens, 'chord', 'chords', 'harmony', 'pad', 'stabs', 'voicing', 'piano', 'keys', 'strings'))
    return 'chords';
  if (voiceRole === 'bass') return 'bass';
  if (voiceRole === 'pad') return 'chords';
  return 'melody';
}

function roleDefaultKind(role: Se2SynthGenoRole | undefined): StudioGeneratePartKind {
  switch (role) {
    case 'bass':
      return 'bass';
    case 'pad':
      return 'chords';
    default:
      return 'melody';
  }
}

function partToStackRole(part: GenoDuoPartKind): Se2SynthGenoStackRole {
  if (part === 'keys') return 'keys';
  if (part === 'strings') return 'strings';
  if (part === 'bass') return 'bass';
  if (part === 'chords') return 'chords';
  return 'melody';
}

function partLabel(part: GenoDuoPartKind, profile: ReturnType<typeof buildGenoComposePromptProfile>): string {
  const style = profile.chordStyle;
  switch (part) {
    case 'bass':
      return 'Bass';
    case 'strings':
      return style === 'rnb' ? 'R&B Strings' : 'Strings';
    case 'keys':
      return style === 'pop' ? 'Pop Keys' : style === 'rnb' ? 'R&B Keys' : 'Keys';
    case 'chords':
      return style === 'pop' ? 'Pop Chords' : style === 'rnb' ? 'R&B Chords' : style === 'gospel' ? 'Gospel Chords' : 'Chords';
    case 'melody':
      return profile.melodyFlavor === 'pop'
        ? 'Pop Melody'
        : profile.melodyFlavor === 'rnb'
          ? 'R&B Melody'
          : profile.melodyFlavor === 'rnbFunk'
            ? 'R&B Funk Melody'
            : 'Melody';
    default:
      return 'Part';
  }
}

function synthRoleForPart(part: GenoDuoPartKind): Se2SynthGenoRole {
  switch (part) {
    case 'bass':
      return 'bass';
    case 'strings':
      return 'pad';
    case 'keys':
    case 'chords':
      return 'keys';
    case 'melody':
      return 'pluck';
    default:
      return 'pluck';
  }
}

function collectComposeTags(
  profile: ReturnType<typeof buildGenoComposePromptProfile>,
  bars: number,
  extra: string[] = [],
): string[] {
  return [...profile.tags, `${bars} bars`, 'duo', ...extra];
}

function sortNotes(notes: Se2SynthGenoComposeNote[]): Se2SynthGenoComposeNote[] {
  return [...notes].sort((a, b) =>
    a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch,
  );
}

function stackPartFromDuo(
  part: GenoDuoPartKind,
  notes: Se2SynthGenoComposeNote[],
  profile: ReturnType<typeof buildGenoComposePromptProfile>,
  resolvedKey: Se2ComposeResolvedKey,
): Se2SynthGenoStackPart {
  return {
    role: partToStackRole(part),
    label: partLabel(part, profile),
    notes: lockForPart(part, notes, resolvedKey),
    trackKind: 'synthGeno',
    synthGenoRole: synthRoleForPart(part),
  };
}

/** Exactly two Synth Geno lanes — companion + current track. */
function buildDuoStack(opts: {
  prompt: string;
  barCount: number;
  beatsPerBar: number;
  resolvedKey: Se2ComposeResolvedKey;
  seed: number;
}): { stack: Se2SynthGenoStackPart[]; profile: ReturnType<typeof buildGenoComposePromptProfile> } {
  const profile = buildGenoComposePromptProfile(opts.prompt);
  const session = genoCreateMusicalSession({
    barCount: opts.barCount,
    beatsPerBar: opts.beatsPerBar,
    resolvedKey: opts.resolvedKey,
    seed: opts.seed,
    profile,
    staccatoChords: genoPromptWantsStaccatoChords(opts.prompt),
  });
  const duo = genoGenerateDuo(session, profile.pair.partA, profile.pair.partB, opts.prompt);

  const stack = [
    stackPartFromDuo(duo.a.part, duo.a.notes, profile, opts.resolvedKey),
    stackPartFromDuo(duo.b.part, duo.b.notes, profile, opts.resolvedKey),
  ];
  return { stack, profile };
}

function composeResult(
  partial: Omit<Se2SynthGenoComposeResult, 'keyLabel' | 'keySource' | 'resolvedKey'>,
  resolvedKey: Se2ComposeResolvedKey,
): Se2SynthGenoComposeResult {
  return {
    ...partial,
    keyLabel: resolvedKey.label,
    keySource: resolvedKey.source,
    resolvedKey,
    matchedTags: [...partial.matchedTags, resolvedKey.label],
  };
}

function runDuoCompose(opts: {
  prompt: string;
  barCount: number;
  beatsPerBar: number;
  resolvedKey: Se2ComposeResolvedKey;
  seed: number;
  mode: Se2SynthGenoComposeMode;
  extraTags?: string[];
}): Se2SynthGenoComposeResult {
  const { stack, profile } = buildDuoStack(opts);
  const currentPart = stack.find((p) => p.role === partToStackRole(profile.pair.partB)) ?? stack[1]!;
  const primaryKind: StudioGeneratePartKind =
    profile.pair.partB === 'bass' ? 'bass' : profile.pair.partB === 'melody' ? 'melody' : 'chords';

  return composeResult(
    {
      notes: currentPart.notes,
      kind: primaryKind,
      bars: opts.barCount,
      matchedTags: collectComposeTags(profile, opts.barCount, opts.extraTags),
      mode: opts.mode,
      stack,
      duoLabel: profile.pair.label,
    },
    opts.resolvedKey,
  );
}

export function se2SynthGenoComposeFromPrompt(opts: {
  prompt: string;
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
  beatsPerBar: number;
  voiceRole?: Se2SynthGenoRole;
  seed?: number;
  forceDuo?: boolean;
  forceChords?: boolean;
  projectLoopBars?: number;
}): Se2SynthGenoComposeResult {
  const wantsChords =
    opts.forceChords || (se2SynthGenoWantsChordsOnly(opts.prompt) && !opts.forceDuo);
  const wantsDuo = !wantsChords && (opts.forceDuo || se2SynthGenoWantsDuo(opts.prompt));
  const bars = resolveComposeBarCount(opts.prompt, opts.projectLoopBars, wantsDuo || wantsChords);
  const resolvedKey = resolveComposeKey(opts);
  const seed = opts.seed ?? mixSeed([opts.prompt, resolvedKey.keyRoot, resolvedKey.keyMode, bars, Date.now()]);
  const profile = buildGenoComposePromptProfile(opts.prompt);

  if (wantsChords) {
    const staccato = genoPromptWantsStaccatoChords(opts.prompt);
    const built = genoGenerateChordsFromStyle({
      barCount: bars,
      beatsPerBar: opts.beatsPerBar,
      keyRoot: resolvedKey.keyRoot,
      keyMode: resolvedKey.keyMode,
      chordStyle: profile.chordStyle,
      seed,
      staccato,
    });
    const notes = lockChordNotes(built.notes, resolvedKey);
    return composeResult(
      {
        notes: sortNotes(notes),
        kind: 'chords',
        bars,
        matchedTags: collectComposeTags(profile, bars, ['chord generator', built.progressionId]),
        mode: 'chords',
      },
      resolvedKey,
    );
  }

  if (wantsDuo) {
    return runDuoCompose({
      prompt: opts.prompt,
      barCount: bars,
      beatsPerBar: opts.beatsPerBar,
      resolvedKey,
      seed,
      mode: 'duo',
    });
  }

  const session = genoCreateMusicalSession({
    barCount: bars,
    beatsPerBar: opts.beatsPerBar,
    resolvedKey,
    seed,
    profile,
    staccatoChords: genoPromptWantsStaccatoChords(opts.prompt),
  });
  const kind = se2SynthGenoDetectPartKind(opts.prompt, opts.voiceRole);
  const part: GenoDuoPartKind =
    kind === 'bass' ? 'bass' : kind === 'chords' ? 'chords' : 'melody';
  const notes = lockForPart(
    part,
    genoGenerateDuoPart(session, part, opts.prompt),
    resolvedKey,
  );

  return composeResult(
    {
      notes: sortNotes(notes),
      kind,
      bars,
      matchedTags: collectComposeTags(profile, bars, ['single']),
      mode: 'create',
    },
    resolvedKey,
  );
}

export function se2SynthGenoExtendNotes(opts: {
  prompt: string;
  existingNotes: readonly Se2SynthGenoComposeNote[];
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
  beatsPerBar: number;
  voiceRole?: Se2SynthGenoRole;
  seed?: number;
}): Se2SynthGenoComposeResult {
  const beatsPerBar = Math.max(2, opts.beatsPerBar);
  const resolvedKey = resolveComposeKey(opts);
  const existingBars = studioInferBarCountFromNotes(opts.existingNotes, beatsPerBar, 4);
  const extendBars = parseExtendBars(opts.prompt);
  const kind = se2SynthGenoDetectPartKind(opts.prompt, opts.voiceRole);
  const seed = opts.seed ?? mixSeed([opts.prompt, existingBars, extendBars, Date.now()]);
  const offsetBeat = existingBars * beatsPerBar;
  const profile = buildGenoComposePromptProfile(opts.prompt);

  const session = genoCreateMusicalSession({
    barCount: extendBars,
    beatsPerBar,
    resolvedKey,
    seed,
    profile,
    existingHarmonyNotes: opts.existingNotes,
  });
  const part: GenoDuoPartKind =
    kind === 'bass' ? 'bass' : kind === 'chords' ? 'chords' : 'melody';

  let extension = genoGenerateDuoPart(session, part, opts.prompt).map((n) => ({
    ...n,
    startBeat: n.startBeat + offsetBeat,
  }));
  extension = lockForPart(part, extension, resolvedKey);

  return composeResult(
    {
      notes: sortNotes([...opts.existingNotes, ...extension]),
      kind,
      bars: existingBars + extendBars,
      matchedTags: collectComposeTags(profile, extendBars, ['extend']),
      mode: 'extend',
    },
    resolvedKey,
  );
}

export function se2SynthGenoAccompanyNotes(opts: {
  prompt: string;
  existingNotes: readonly Se2SynthGenoComposeNote[];
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
  beatsPerBar: number;
  voiceRole?: Se2SynthGenoRole;
  seed?: number;
}): Se2SynthGenoComposeResult {
  const beatsPerBar = Math.max(2, opts.beatsPerBar);
  const resolvedKey = resolveComposeKey(opts);
  const bars = parseBarsFromPrompt(
    opts.prompt,
    studioInferBarCountFromNotes(
      opts.existingNotes.length ? opts.existingNotes : [],
      beatsPerBar,
      4,
    ),
  );
  const kind =
    opts.existingNotes.length > 0
      ? roleDefaultKind(opts.voiceRole)
      : se2SynthGenoDetectPartKind(opts.prompt, opts.voiceRole);
  const seed = opts.seed ?? mixSeed([opts.prompt, 'accompany', Date.now()]);
  const profile = buildGenoComposePromptProfile(opts.prompt);

  const session = genoCreateMusicalSession({
    barCount: bars,
    beatsPerBar,
    resolvedKey,
    seed,
    profile,
    existingHarmonyNotes: opts.existingNotes,
  });
  const part: GenoDuoPartKind =
    kind === 'bass' ? 'bass' : kind === 'chords' ? 'chords' : 'melody';
  const notes = lockForPart(part, genoGenerateDuoPart(session, part, opts.prompt), resolvedKey);

  return composeResult(
    {
      notes: sortNotes(notes),
      kind,
      bars,
      matchedTags: collectComposeTags(profile, bars, ['vary']),
      mode: 'accompany',
    },
    resolvedKey,
  );
}

export const SE2_SYNTH_GENO_COMPOSE_EXAMPLES = SE2_SYNTH_GENO_DUO_EXAMPLES;

export { parseGenoDuoPairFromPrompt, buildGenoComposePromptProfile };

export { genoBuildMusicalHarmony as buildGenoProgressionHarmony } from '@/app/lib/studio/se2SynthGenoMusicalEngine';
