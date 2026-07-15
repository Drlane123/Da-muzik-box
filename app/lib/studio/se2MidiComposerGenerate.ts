import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { genreHasProgressionsForMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { bpmForProgressionPreset } from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import {
  SE2_AI_MIDI_GENRE_OPTIONS,
  SE2_AI_MIDI_NOTE_GRID_OPTIONS,
  SE2_AI_MIDI_TYPE_OPTIONS,
  se2AiMidiKeyRootFromName,
  type Se2ChordGenieAiMidiProvider,
} from '@/app/lib/studio/se2ChordGenieAiMidi';
import { resolveSe2ChordGenieAutoCompose } from '@/app/lib/studio/se2ChordGenieAutoCompose';
import { se2GenerateChordGenieProgression } from '@/app/lib/studio/se2ChordGenieGenerate';
import {
  buildSe2MidiComposerSystemContext,
  se2MidiComposerCallProvider,
  se2MidiComposerPayloadToNotes,
  se2MidiComposerPayloadToSteps,
} from '@/app/lib/studio/se2MidiComposerApi';
import {
  se2MidiComposerHarmonyFromSteps,
  se2MidiComposerMelodyGenre,
  se2MidiComposerQuantizeNotes,
} from '@/app/lib/studio/se2MidiComposerMelodyLock';
import { genoGenerateBassFromHarmony } from '@/app/lib/studio/se2SynthGenoBassEngine';
import { genoGenerateMelodyFromHarmony } from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import { genoStylePreset } from '@/app/lib/studio/se2SynthGenoStylePresets';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import {
  progressionStepsToChordNotes,
  studioNormalizeHarmonyLoopBars,
  type StudioHarmonyLoopBars,
} from '@/app/lib/studio/studioInstrumentHarmony';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

const GENRE_TO_COMPOSE_ID: Record<string, string> = {
  true_rnb: 'rnb-true',
  trap: 'trap',
  gospel: 'gospel',
  neo_soul: 'neo-soul-eras',
  pop: 'pop',
  afro: 'afrobeat',
  lofi: 'lofi',
  cinematic: 'ballad-80s',
};

const GENRE_TO_CHORD_STYLE: Record<string, GenoChordStyle> = {
  true_rnb: 'rnb',
  neo_soul: 'rnb',
  trap: 'trap',
  gospel: 'gospel',
  pop: 'pop',
  afro: 'dance',
  lofi: 'dark',
  cinematic: 'dark',
};

export type Se2MidiComposerGenerateRequest = {
  prompt: string;
  provider: Se2ChordGenieAiMidiProvider;
  model: string;
  apiKey?: string;
  customEndpoint?: string;
  keyName: string;
  scale: string;
  midiType: string;
  noteGrid: string;
  lengthBars: string;
  genre: string;
  beatsPerBar: number;
  fallbackGenreId: string;
  seed?: number;
  /** On Regenerate — skip the last applied preset so a new card is chosen. */
  excludePresetId?: string | null;
};

export type Se2MidiComposerGenerateResult = {
  summary: string;
  steps?: GrooveProgressionStep[];
  notes?: StudioEditor2GenNote[];
  keyRoot: number;
  keyMode: ChordMode;
  loopBars: StudioHarmonyLoopBars;
  genBars: number;
  presetId?: string;
  bpm?: number;
};

function scaleToChordMode(scale: string): ChordMode {
  if (scale === 'major' || scale === 'mixolydian') return 'major';
  return 'minor';
}

function resolveComposerBars(lengthBars: string): { genBars: number; loopBars: StudioHarmonyLoopBars } {
  const n = Math.max(4, Math.min(32, parseInt(lengthBars, 10) || 8));
  return { genBars: n, loopBars: studioNormalizeHarmonyLoopBars(n) };
}

function genreLabel(genre: string): string {
  return SE2_AI_MIDI_GENRE_OPTIONS.find((g) => g.value === genre)?.label ?? genre;
}

function noteGridLabel(noteGrid: string): string {
  return SE2_AI_MIDI_NOTE_GRID_OPTIONS.find((n) => n.value === noteGrid)?.label ?? 'Any';
}

function typeLabel(midiType: string): string {
  return SE2_AI_MIDI_TYPE_OPTIONS.find((t) => t.value === midiType)?.label ?? midiType;
}

function buildEnrichedPrompt(req: Se2MidiComposerGenerateRequest): string {
  const { genBars } = resolveComposerBars(req.lengthBars);
  const gridHint =
    req.noteGrid === 'any'
      ? ''
      : ` Use ${noteGridLabel(req.noteGrid).toLowerCase()} rhythm locked to the chord changes.`;
  return [
    req.prompt.trim(),
    `${req.keyName} ${req.scale}.`,
    `${genreLabel(req.genre)} ${typeLabel(req.midiType).toLowerCase()}.`,
    `${genBars} bars.${gridHint}`,
    'Melody and lead must stay in sync with the chords and the beat grid.',
  ]
    .filter(Boolean)
    .join(' ');
}

function resolveFallbackGenreId(req: Se2MidiComposerGenerateRequest, keyMode: ChordMode): string {
  const mapped = GENRE_TO_COMPOSE_ID[req.genre] ?? req.fallbackGenreId;
  if (genreHasProgressionsForMode(mapped, keyMode)) return mapped;
  return req.fallbackGenreId;
}

function chordNotesFromSteps(
  steps: readonly GrooveProgressionStep[],
  beatsPerBar: number,
  loopBars: StudioHarmonyLoopBars,
): StudioEditor2GenNote[] {
  const built = progressionStepsToChordNotes(steps, {
    beatsPerBar,
    barCount: loopBars,
    sustainSlots: 4,
    maxDurationBeats: Math.min(beatsPerBar * 0.92, Math.max(0.5, beatsPerBar - 0.08)),
  });
  return 'message' in built ? [] : built;
}

function mergeNotes(
  chordNotes: StudioEditor2GenNote[],
  melodicNotes: StudioEditor2GenNote[],
): StudioEditor2GenNote[] {
  return [...chordNotes, ...melodicNotes].sort(
    (a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch,
  );
}

function generateChordsLocal(
  req: Se2MidiComposerGenerateRequest,
  enriched: string,
  keyRoot: number,
  keyMode: ChordMode,
  loopBars: StudioHarmonyLoopBars,
): Se2MidiComposerGenerateResult | { error: string } {
  const genreId = resolveFallbackGenreId(req, keyMode);
  const compose = resolveSe2ChordGenieAutoCompose(enriched, {
    keyRoot,
    keyMode,
    fallbackGenreId: genreId,
    loopBars,
    excludePresetId: req.excludePresetId,
  });
  if (!compose) return { error: 'Could not match a chord pattern — try more detail in your prompt.' };

  const genKeyRoot = compose.keyRoot ?? keyRoot;
  const genKeyMode = compose.keyMode ?? keyMode;
  const genLoopBars = compose.loopBars ?? loopBars;

  const generated = se2GenerateChordGenieProgression({
    keyRoot: genKeyRoot,
    mode: genKeyMode,
    loopBars: genLoopBars,
    beatsPerBar: req.beatsPerBar,
    presetId: compose.presetId,
    seed: req.seed ?? Date.now(),
  });
  if ('message' in generated) return { error: generated.message };

  return {
    summary: compose.summary,
    steps: generated.steps,
    keyRoot: genKeyRoot,
    keyMode: genKeyMode,
    loopBars: genLoopBars,
    genBars: genLoopBars,
    presetId: generated.presetId,
    bpm: compose.bpm ?? undefined,
  };
}

/**
 * Melody / lead / bass locked to the same Chord Generator progression + note grid.
 */
function generateLockedPartFromSteps(
  req: Se2MidiComposerGenerateRequest,
  enriched: string,
  steps: readonly GrooveProgressionStep[],
  keyRoot: number,
  keyMode: ChordMode,
  barCount: number,
  seed: number,
): StudioEditor2GenNote[] {
  const songMode = keyMode === 'minor' ? 'minor' : 'major';
  const harmony = se2MidiComposerHarmonyFromSteps(steps, barCount, req.beatsPerBar, keyRoot);
  if (!harmony.columns.length) return [];

  const melodyGenre = se2MidiComposerMelodyGenre(req.genre, enriched);
  const chordStyle = GENRE_TO_CHORD_STYLE[req.genre] ?? 'default';
  const bassPattern = genoStylePreset(chordStyle).bassPattern;

  let raw: StudioEditor2GenNote[];
  if (req.midiType === 'bass') {
    raw = genoGenerateBassFromHarmony({
      harmony,
      barCount,
      beatsPerBar: req.beatsPerBar,
      pattern: bassPattern,
      seed,
      keyRoot,
      keyMode: songMode,
    });
  } else {
    /* Plugin lyrical grid path — phrase banks + chord-tone lock (R&B/neo-soul etc.). */
    raw = genoGenerateMelodyFromHarmony({
      harmony,
      barCount,
      beatsPerBar: req.beatsPerBar,
      style: melodyGenre,
      seed: seed ^ (req.midiType === 'lead' ? 0x4c4541 : 0x4d454c),
      maxLeap: melodyGenre === 'rnb' || melodyGenre === 'gospel' ? 4 : 5,
      keyRoot,
      keyMode: songMode,
      lyricalGrid: true,
    });
  }

  return se2MidiComposerQuantizeNotes(raw, {
    noteGrid: req.noteGrid,
    genre: req.genre,
    beatsPerBar: req.beatsPerBar,
    barCount,
    monophonic: req.midiType !== 'full',
  });
}

function generateMelodicLocal(
  req: Se2MidiComposerGenerateRequest,
  enriched: string,
  keyRoot: number,
  keyMode: ChordMode,
  genBars: number,
  loopBars: StudioHarmonyLoopBars,
): Se2MidiComposerGenerateResult | { error: string } {
  const chordPart = generateChordsLocal(req, enriched, keyRoot, keyMode, loopBars);
  if ('error' in chordPart || !chordPart.steps?.length) {
    return { error: 'Could not build a chord bed for the melody — try a clearer genre or key.' };
  }

  const bars = Math.max(genBars, chordPart.genBars, chordPart.loopBars);
  const notes = generateLockedPartFromSteps(
    req,
    enriched,
    chordPart.steps,
    chordPart.keyRoot,
    chordPart.keyMode,
    bars,
    req.seed ?? Date.now(),
  );
  if (!notes.length) return { error: 'No notes generated — try a clearer melody or bass prompt.' };

  const melGenre = se2MidiComposerMelodyGenre(req.genre, enriched);
  return {
    summary: `${typeLabel(req.midiType)} in ${req.keyName} ${req.scale} — ${genreLabel(req.genre)} ${melGenre}, locked to chords`,
    notes,
    keyRoot: chordPart.keyRoot,
    keyMode: chordPart.keyMode,
    loopBars: chordPart.loopBars,
    genBars: bars,
    presetId: chordPart.presetId,
    bpm: chordPart.bpm,
  };
}

export function se2MidiComposerGenerateLocal(
  req: Se2MidiComposerGenerateRequest,
): Se2MidiComposerGenerateResult | { error: string } {
  const enriched = buildEnrichedPrompt(req);
  if (!enriched.trim()) return { error: 'Enter a prompt first.' };

  const keyRoot = se2AiMidiKeyRootFromName(req.keyName);
  const keyMode = scaleToChordMode(req.scale);
  const { genBars, loopBars } = resolveComposerBars(req.lengthBars);

  if (req.midiType === 'chords') {
    return generateChordsLocal(req, enriched, keyRoot, keyMode, loopBars);
  }

  if (req.midiType === 'full') {
    const chordPart = generateChordsLocal(req, enriched, keyRoot, keyMode, loopBars);
    if ('error' in chordPart) return chordPart;
    if (!chordPart.steps?.length) return { error: 'No chord steps generated.' };

    const bars = Math.max(genBars, chordPart.genBars, chordPart.loopBars);
    const melodicNotes = generateLockedPartFromSteps(
      { ...req, midiType: 'melody' },
      enriched,
      chordPart.steps,
      chordPart.keyRoot,
      chordPart.keyMode,
      bars,
      req.seed ?? Date.now(),
    );
    const chordNotes = chordNotesFromSteps(chordPart.steps, req.beatsPerBar, chordPart.loopBars);

    return {
      summary: `${chordPart.summary} + top-line melody locked to the changes.`,
      steps: chordPart.steps,
      notes: mergeNotes(chordNotes, melodicNotes),
      keyRoot: chordPart.keyRoot,
      keyMode: chordPart.keyMode,
      loopBars: chordPart.loopBars,
      genBars: bars,
      presetId: chordPart.presetId,
      bpm: chordPart.bpm,
    };
  }

  return generateMelodicLocal(req, enriched, keyRoot, keyMode, genBars, loopBars);
}

export async function se2MidiComposerGenerate(
  req: Se2MidiComposerGenerateRequest,
): Promise<Se2MidiComposerGenerateResult | { error: string }> {
  if (req.provider === 'damusicbox') {
    return se2MidiComposerGenerateLocal(req);
  }

  const enriched = buildEnrichedPrompt(req);
  if (!enriched.trim()) return { error: 'Enter a prompt first.' };

  const keyRoot = se2AiMidiKeyRootFromName(req.keyName);
  const keyMode = scaleToChordMode(req.scale);
  const { genBars, loopBars } = resolveComposerBars(req.lengthBars);

  const systemContext = buildSe2MidiComposerSystemContext({
    keyName: req.keyName,
    scale: req.scale,
    genreLabel: genreLabel(req.genre),
    midiType: typeLabel(req.midiType),
    genBars,
    beatsPerBar: req.beatsPerBar,
    noteGridLabel: noteGridLabel(req.noteGrid),
    keyMode,
  });

  const llm = await se2MidiComposerCallProvider({
    provider: req.provider,
    model: req.model,
    apiKey: req.apiKey ?? '',
    customEndpoint: req.customEndpoint,
    prompt: enriched,
    systemContext,
  });

  if ('error' in llm) {
    const fallback = se2MidiComposerGenerateLocal(req);
    if (!('error' in fallback)) {
      return {
        ...fallback,
        summary: `${fallback.summary} (cloud unavailable — used Da Music Box engine)`,
      };
    }
    return llm;
  }

  const steps = se2MidiComposerPayloadToSteps(llm, req.beatsPerBar);
  let notes = se2MidiComposerPayloadToNotes(llm);

  if (req.midiType === 'chords' && steps.length) {
    notes = chordNotesFromSteps(steps, req.beatsPerBar, loopBars);
  } else if (req.midiType === 'full' && steps.length) {
    const chordNotes = chordNotesFromSteps(steps, req.beatsPerBar, loopBars);
    let topLine = notes;
    if (!topLine.length) {
      topLine = generateLockedPartFromSteps(
        { ...req, midiType: 'melody' },
        enriched,
        steps,
        keyRoot,
        keyMode,
        genBars,
        req.seed ?? Date.now(),
      );
    } else {
      topLine = se2MidiComposerQuantizeNotes(topLine, {
        noteGrid: req.noteGrid,
        genre: req.genre,
        beatsPerBar: req.beatsPerBar,
        barCount: genBars,
        monophonic: true,
      });
    }
    notes = mergeNotes(chordNotes, topLine);
  } else if (req.midiType !== 'chords') {
    if (!notes.length && steps.length) {
      notes = generateLockedPartFromSteps(
        req,
        enriched,
        steps,
        keyRoot,
        keyMode,
        genBars,
        req.seed ?? Date.now(),
      );
    } else if (notes.length) {
      notes = se2MidiComposerQuantizeNotes(notes, {
        noteGrid: req.noteGrid,
        genre: req.genre,
        beatsPerBar: req.beatsPerBar,
        barCount: genBars,
        monophonic: true,
      });
    }
  }

  if (!steps.length && !notes.length) {
    return se2MidiComposerGenerateLocal(req);
  }

  let bpm: number | undefined;
  if (steps.length) {
    const compose = resolveSe2ChordGenieAutoCompose(enriched, {
      keyRoot,
      keyMode,
      fallbackGenreId: resolveFallbackGenreId(req, keyMode),
      loopBars,
    });
    if (compose?.presetId) {
      bpm = compose.bpm ?? bpmForProgressionPreset(compose.presetId, keyRoot);
    }
  }

  return {
    summary: llm.summary,
    steps: steps.length ? steps : undefined,
    notes: notes.length ? notes : undefined,
    keyRoot,
    keyMode,
    loopBars,
    genBars,
    bpm,
  };
}

/** Notes for preview / apply — chord stacks from steps, or raw melody/bass notes. */
export function se2MidiComposerResolveRollNotes(
  result: Se2MidiComposerGenerateResult,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  if (result.notes?.length) {
    return [...result.notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  }
  if (!result.steps?.length) return [];
  return chordNotesFromSteps(result.steps, beatsPerBar, result.loopBars);
}
