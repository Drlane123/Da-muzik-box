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
import { se2SynthGenoComposeFromPrompt } from '@/app/lib/studio/se2SynthGenoCompose';
import type { Se2SynthGenoRole } from '@/app/lib/studio/se2SynthGenoTypes';
import {
  progressionStepsToChordNotes,
  studioNormalizeHarmonyLoopBars,
  type StudioHarmonyLoopBars,
} from '@/app/lib/studio/studioInstrumentHarmony';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

const GENRE_TO_COMPOSE_ID: Record<string, string> = {
  true_rnb: 'rnb',
  trap: 'trap',
  gospel: 'gospel',
  neo_soul: 'rnb',
  pop: 'pop',
  afro: 'afrobeat',
  lofi: 'lofi',
  cinematic: 'ballad',
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
      : ` Use ${noteGridLabel(req.noteGrid).toLowerCase()} rhythm.`;
  return [
    req.prompt.trim(),
    `${req.keyName} ${req.scale}.`,
    `${genreLabel(req.genre)} ${typeLabel(req.midiType).toLowerCase()}.`,
    `${genBars} bars.${gridHint}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function resolveFallbackGenreId(req: Se2MidiComposerGenerateRequest, keyMode: ChordMode): string {
  const mapped = GENRE_TO_COMPOSE_ID[req.genre] ?? req.fallbackGenreId;
  if (genreHasProgressionsForMode(mapped, keyMode)) return mapped;
  return req.fallbackGenreId;
}

function synthRoleForType(midiType: string): Se2SynthGenoRole {
  if (midiType === 'bass') return 'bass';
  if (midiType === 'lead' || midiType === 'melody') return 'lead';
  return 'lead';
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

function generateMelodicLocal(
  req: Se2MidiComposerGenerateRequest,
  enriched: string,
  keyRoot: number,
  keyMode: ChordMode,
  genBars: number,
  loopBars: StudioHarmonyLoopBars,
): Se2MidiComposerGenerateResult | { error: string } {
  const songMode = keyMode === 'minor' ? 'minor' : 'major';
  const result = se2SynthGenoComposeFromPrompt({
    prompt: enriched,
    songKeyRoot: keyRoot,
    songKeyMode: songMode,
    trackKeyRoot: keyRoot,
    trackKeyMode: songMode,
    beatsPerBar: req.beatsPerBar,
    voiceRole: synthRoleForType(req.midiType),
    projectLoopBars: genBars,
    forceChords: req.midiType === 'chords',
    forceDuo: req.midiType === 'full',
    seed: req.seed,
  });

  if (!result.notes.length) return { error: 'No notes generated — try a clearer melody or bass prompt.' };

  return {
    summary: `${typeLabel(req.midiType)} in ${result.keyLabel} — ${result.matchedTags.slice(0, 3).join(', ') || 'generated'}`,
    notes: result.notes,
    keyRoot: result.resolvedKey.keyRoot,
    keyMode: result.resolvedKey.keyMode === 'minor' ? 'minor' : 'major',
    loopBars,
    genBars: result.bars,
  };
}

function mergeNotes(
  chordNotes: StudioEditor2GenNote[],
  melodicNotes: StudioEditor2GenNote[],
): StudioEditor2GenNote[] {
  return [...chordNotes, ...melodicNotes].sort(
    (a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch,
  );
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
    const melodicPart = generateMelodicLocal(
      { ...req, midiType: 'melody' },
      enriched,
      chordPart.keyRoot,
      chordPart.keyMode,
      genBars,
      loopBars,
    );
    if ('error' in melodicPart) {
      return chordPart;
    }

    let chordNotes: StudioEditor2GenNote[] = [];
    if (chordPart.steps?.length) {
      const built = progressionStepsToChordNotes(chordPart.steps, {
        beatsPerBar: req.beatsPerBar,
        barCount: chordPart.loopBars,
        sustainSlots: 4,
        maxDurationBeats: Math.min(req.beatsPerBar * 0.92, Math.max(0.5, req.beatsPerBar - 0.08)),
      });
      if (!('message' in built)) chordNotes = built;
    }

    return {
      summary: `${chordPart.summary} + top-line melody.`,
      steps: chordPart.steps,
      notes: mergeNotes(chordNotes, melodicPart.notes ?? []),
      keyRoot: chordPart.keyRoot,
      keyMode: chordPart.keyMode,
      loopBars: chordPart.loopBars,
      genBars,
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

  if (steps.length && (req.midiType === 'chords' || req.midiType === 'full')) {
    const built = progressionStepsToChordNotes(steps, {
      beatsPerBar: req.beatsPerBar,
      barCount: loopBars,
      sustainSlots: 4,
      maxDurationBeats: Math.min(req.beatsPerBar * 0.92, Math.max(0.5, req.beatsPerBar - 0.08)),
    });
    if (!('message' in built)) {
      notes = req.midiType === 'full' ? mergeNotes(built, notes) : built;
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
  const built = progressionStepsToChordNotes(result.steps, {
    beatsPerBar,
    barCount: result.loopBars,
    sustainSlots: 4,
    maxDurationBeats: Math.min(beatsPerBar * 0.92, Math.max(0.5, beatsPerBar - 0.08)),
  });
  return 'message' in built ? [] : built;
}
