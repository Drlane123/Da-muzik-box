/**
 * Chord Generator loop — warm block voicing (same register fix as Live Chord).
 */
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import type {
  GenoBarChordSpec,
  GenoChordBuildSettings,
  GenoChordType,
  GenoExtension,
  GenoHarmony,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import { se2DiatonicTriadQuality, se2ScaleDegreeRootMidi } from '@/app/lib/studio/se2SynthGenoKeyLock';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { Se2SynthGenoChordPluginState } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import {
  se2SynthGenoPluginSpecForTimelineBar,
} from '@/app/lib/studio/se2SynthGenoPluginLoopSpec';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import {
  se2SynthGenoPluginMapPatternToBarCount,
  se2SynthGenoTileBarSpecs,
} from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import { se2SynthGenoLiveRebuildSpecForDegree } from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  GENO_LIVE_CHORD_MIDI_MAX,
  GENO_LIVE_CHORD_MIDI_MIN,
  GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI,
  genoLiftVoicingToRange,
} from '@/app/lib/studio/se2SynthGenoRanges';
import {
  se2SynthGenoDefaultVoicingDepth,
  se2SynthGenoDedenseCompVoicing,
  se2SynthGenoEnrichChordIntervals,
  se2SynthGenoEnrichForStyle,
  se2SynthGenoFinalizeVoicedMidis,
  type GenoVoicingDepth,
} from '@/app/lib/studio/se2SynthGenoVoicingDepth';

const EXT_INTERVAL: Record<GenoExtension, number> = {
  '6': 9,
  M7: 11,
  m7: 10,
  '9': 14,
  '11': 17,
  '13': 21,
};

function normalizePc(n: number): number {
  return ((Math.round(n) % 12) + 12) % 12;
}

function triadIntervals(type: GenoChordType): number[] {
  switch (type) {
    case 'min':
      return [0, 3, 7];
    case 'sus':
      return [0, 5, 7];
    case 'dim':
      return [0, 3, 6];
    case 'aug':
      return [0, 4, 8];
    default:
      return [0, 4, 7];
  }
}

function smartTypeForDegree(mode: StudioDetectedKeyMode, degree: number): GenoChordType {
  const q = se2DiatonicTriadQuality(mode, degree);
  if (q === 'dim') return 'dim';
  if (q === 'min') return 'min';
  return 'maj';
}

function applyInversion(sorted: number[], steps: number): number[] {
  if (sorted.length === 0) return sorted;
  let out = [...sorted].sort((a, b) => a - b);
  const n = ((steps % out.length) + out.length) % out.length;
  for (let i = 0; i < n; i += 1) {
    const low = out.shift()!;
    out.push(low + 12);
  }
  return out.filter((m) => m <= GENO_LIVE_CHORD_MIDI_MAX + 12);
}

function effectiveSettings(
  settings: GenoChordBuildSettings,
  spec?: GenoBarChordSpec,
): GenoChordBuildSettings {
  if (!spec) return settings;
  return {
    ...settings,
    smartMatch: spec.smartMatch ?? settings.smartMatch,
    lockedType: spec.lockedType ?? settings.lockedType,
    extensions: spec.extensions ? new Set(spec.extensions) : settings.extensions,
    inversion: spec.inversion ?? settings.inversion,
  };
}

function pluginDefaultDepth(style: GenoChordStyle): GenoVoicingDepth {
  return se2SynthGenoDefaultVoicingDepth(pluginStyleToGenre(style));
}

function intervalsForSpec(
  spec: GenoBarChordSpec,
  stylePreset: GenoChordStyle,
): number[] {
  const base = spec.chordIntervals;
  if (!base?.length) return [];
  const depth = (spec.voicingDepth ?? pluginDefaultDepth(stylePreset)) as GenoVoicingDepth;
  return se2SynthGenoEnrichChordIntervals(base, depth, pluginStyleToGenre(stylePreset));
}

function pluginCompFinish(tones: number[], depth: GenoVoicingDepth): number[] {
  return se2SynthGenoFinalizeVoicedMidis(
    se2SynthGenoDedenseCompVoicing(
      genoLiftVoicingToRange(tones, GENO_LIVE_CHORD_MIDI_MIN, GENO_LIVE_CHORD_MIDI_MAX),
      depth,
    ),
    depth,
    GENO_LIVE_CHORD_MIDI_MIN,
    GENO_LIVE_CHORD_MIDI_MAX,
  );
}

function voiceFromIntervals(
  spec: GenoBarChordSpec,
  keyRoot: number,
  stylePreset: GenoChordStyle,
  presetInversion: number,
): number[] {
  const enriched = intervalsForSpec(spec, stylePreset);
  if (!enriched.length) return [];
  const rootIv = enriched[0]!;
  const baseOct = Math.floor(GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI / 12) * 12;
  const rootMidi = baseOct + normalizePc(keyRoot) + rootIv;
  let tones = [...new Set(enriched.map((iv) => rootMidi + (iv - rootIv)))].sort((a, b) => a - b);
  tones = applyInversion(tones, spec.inversion ?? presetInversion);
  const targetDepth = spec.voicingDepth ?? tones.length;
  if (spec.stackOctave && tones.length >= 3 && tones.length < targetDepth) {
    const top = tones[tones.length - 1]!;
    if (top + 12 <= GENO_LIVE_CHORD_MIDI_MAX + 12) {
      tones = [...new Set([...tones, top + 12])].sort((a, b) => a - b);
    }
  }
  const depth = (spec.voicingDepth ?? pluginDefaultDepth(stylePreset)) as GenoVoicingDepth;
  return pluginCompFinish(tones, depth);
}

function pluginStyleToGenre(style: GenoChordStyle): Se2SynthGenoLiveGenreId {
  switch (style) {
    case 'trap':
    case 'dark':
      return 'trap';
    case 'gospel':
      return 'gospel';
    case 'disco':
    case 'dance':
      return 'house-dance';
    case 'jazz':
      return 'jazz';
    case 'kpop':
      return 'kpop';
    case 'bright':
    case 'pop':
    case 'major':
      return 'pop';
    case 'minor':
      return 'drill';
    case 'rnb':
    default:
      return 'rnb';
  }
}

function pluginChordMode(mode: StudioDetectedKeyMode): ChordMode {
  return mode === 'minor' ? 'minor' : 'major';
}

/** Rebuild Roman intervals after loop degree edits (mirrors Live Chord). */
export function se2SynthGenoPluginRebuildSpecForDegree(
  degree: number,
  keyMode: StudioDetectedKeyMode,
  stylePreset: GenoChordStyle,
  keep?: Pick<GenoBarChordSpec, 'voicingDepth' | 'chopQuant' | 'inversion'>,
): GenoBarChordSpec {
  return se2SynthGenoLiveRebuildSpecForDegree(
    degree,
    pluginChordMode(keyMode),
    pluginStyleToGenre(stylePreset),
    keep,
  );
}

function voiceFromDegree(
  keyRoot: number,
  mode: StudioDetectedKeyMode,
  degree: number,
  settings: GenoChordBuildSettings,
  spec?: GenoBarChordSpec,
): number[] {
  const eff = effectiveSettings(settings, spec);
  const style = eff.stylePreset ?? 'pop';
  const deg = spec?.degree ?? degree;
  const type =
    style === 'bright' && (deg === 0 || deg === 3)
      ? 'sus'
      : eff.smartMatch
        ? smartTypeForDegree(mode, deg)
        : eff.lockedType;
  const relIntervals = [...triadIntervals(type)];
  for (const ext of eff.extensions) {
    relIntervals.push(EXT_INTERVAL[ext]);
  }
  const depth = (spec?.voicingDepth ?? pluginDefaultDepth(style)) as GenoVoicingDepth;
  const enrichedRel = se2SynthGenoEnrichForStyle(relIntervals, depth, style);
  const rootMidi = se2ScaleDegreeRootMidi(keyRoot, mode, deg, GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI);
  const rootIv = enrichedRel[0]!;
  let tones = [...new Set(enrichedRel.map((iv) => rootMidi + (iv - rootIv)))].sort((a, b) => a - b);
  tones = applyInversion(tones, spec?.inversion ?? eff.inversion);
  const targetDepth = spec?.voicingDepth ?? tones.length;
  if (spec?.stackOctave && tones.length >= 3 && tones.length < targetDepth) {
    const top = tones[tones.length - 1]!;
    if (top + 12 <= GENO_LIVE_CHORD_MIDI_MAX + 12) {
      tones = [...new Set([...tones, top + 12])].sort((a, b) => a - b);
    }
  }
  return pluginCompFinish(tones, depth);
}

function barSpecForBar(
  settings: GenoChordBuildSettings,
  bar: number,
  degree: number,
): GenoBarChordSpec {
  const specLoop = settings.barChordSpecs;
  const specLen = specLoop?.length ?? 0;
  const barCount = settings.barCount;
  if (specLen > 0) {
    if (specLen >= barCount && bar < barCount) {
      return specLoop![bar] ?? { degree };
    }
    return specLoop![bar % specLen] ?? { degree };
  }
  return { degree };
}

/** Chord root MIDI for harmony column — always the progression root, not inverted bass note. */
export function se2SynthGenoPluginChordRootMidi(
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  settings: GenoChordBuildSettings,
  bar: number,
  degree: number,
): number {
  const spec = barSpecForBar(settings, bar, degree);
  if (spec.chordIntervals?.length) {
    const rootIv = spec.chordIntervals[0]!;
    const baseOct = Math.floor(GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI / 12) * 12;
    return baseOct + normalizePc(keyRoot) + rootIv;
  }
  return se2ScaleDegreeRootMidi(keyRoot, keyMode, degree, GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI);
}

/** Chord root label for progression triggers (E, G, D… per slot). */
export function se2SynthGenoPluginChordRootNote(
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  state: Se2SynthGenoChordPluginState,
  spec: GenoBarChordSpec,
): { rootMidi: number; noteName: string } {
  const style = state.stylePreset ?? 'pop';
  const settings = pluginSettingsFromState(state, keyRoot, keyMode);
  if (spec.chordIntervals?.length) {
    const enriched = intervalsForSpec(spec, style);
    if (enriched.length) {
      const rootIv = enriched[0]!;
      const baseOct = Math.floor(GENO_LIVE_CHORD_ROOT_OCTAVE_MIDI / 12) * 12;
      const rootMidi = baseOct + normalizePc(keyRoot) + rootIv;
      return { rootMidi, noteName: cbPianoMidiToNoteName(rootMidi).replace(/\d+$/, '') };
    }
  }
  const rootMidi = se2SynthGenoPluginChordRootMidi(keyRoot, keyMode, settings, 0, spec.degree);
  return { rootMidi, noteName: cbPianoMidiToNoteName(rootMidi).replace(/\d+$/, '') };
}

/** Voiced stack for one progression slot — trigger preview + voicing lights. */
export function se2SynthGenoVoicePluginChordFromSpec(
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  state: Se2SynthGenoChordPluginState,
  spec: GenoBarChordSpec,
): number[] {
  const settings = pluginSettingsFromState(state, keyRoot, keyMode);
  const style = state.stylePreset ?? 'pop';
  if (spec.chordIntervals?.length) {
    return voiceFromIntervals(spec, keyRoot, style, settings.inversion);
  }
  return voiceFromDegree(keyRoot, keyMode, spec.degree, settings, spec);
}

function pluginSettingsFromState(
  state: Se2SynthGenoChordPluginState,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
): GenoChordBuildSettings {
  return {
    keyRoot,
    keyMode,
    barCount: state.barCount,
    beatsPerBar: 4,
    progressionId: state.progressionId,
    smartMatch: state.smartMatch,
    lockedType: state.lockedType,
    extensions: new Set(state.extensions),
    inversion: state.inversion,
    perfMode: state.perfMode,
    staccato: state.staccato,
    repeaterQuant: state.repeaterQuant,
    includeBassRoot: state.includeBassRoot,
    barDegrees: state.barDegrees,
    barChordSpecs:
      state.barChordSpecs ??
      (state.progressionLoop?.length
        ? se2SynthGenoPluginMapPatternToBarCount(state.progressionLoop, state.barCount, {
            romans: state.progressionRomans,
            eraCategoryId: state.eraCategoryId,
            presetId: state.eraPresetId,
          })
        : undefined),
    stylePreset: state.stylePreset,
  };
}

/** Full voiced chord stack for one bar — warm C3–C5 comp register. */
export function se2SynthGenoVoicePluginChord(
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  settings: GenoChordBuildSettings,
  bar: number,
  degree: number,
): number[] {
  const spec = barSpecForBar(settings, bar, degree);
  const style = settings.stylePreset ?? 'pop';
  if (spec.chordIntervals?.length) {
    return voiceFromIntervals(spec, keyRoot, style, settings.inversion);
  }
  return voiceFromDegree(keyRoot, keyMode, degree, settings, spec);
}

/** Rewrite harmony column tones to warm plugin voicing (bass/melody lock to these). */
export function se2SynthGenoSyncPluginHarmonyVoicing(
  harmony: GenoHarmony,
  settings: GenoChordBuildSettings,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  state?: Se2SynthGenoChordPluginState,
): void {
  for (const col of harmony.columns) {
    const spec = state
      ? se2SynthGenoPluginSpecForTimelineBar(state, col.bar, keyMode)
      : barSpecForBar(settings, col.bar, col.degree);
    const degree = spec.degree ?? col.degree;
    const tones = state
      ? se2SynthGenoVoicePluginChordFromSpec(keyRoot, keyMode, state, spec)
      : se2SynthGenoVoicePluginChord(keyRoot, keyMode, settings, col.bar, degree);
    if (tones.length > 0) {
      col.tones = tones;
      col.degree = degree;
      col.rootMidi = se2SynthGenoPluginChordRootMidi(keyRoot, keyMode, settings, col.bar, degree);
    } else if (col.rootMidi != null) {
      col.tones = [col.rootMidi];
    }
  }
}

/** Full timeline harmony — one column per bar from tiled barChordSpecs (8-bar loops stay in sync). */
export function se2SynthGenoPluginHarmonyFromState(
  state: Se2SynthGenoChordPluginState,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  beatsPerBar: number,
  bpm: number,
): GenoHarmony {
  const settings: GenoChordBuildSettings = {
    ...pluginSettingsFromState(state, keyRoot, keyMode),
    beatsPerBar,
    bpm,
    barCount: state.barCount,
    barChordSpecs:
      state.barChordSpecs ??
      (state.progressionLoop?.length
        ? se2SynthGenoPluginMapPatternToBarCount(state.progressionLoop, state.barCount, {
            romans: state.progressionRomans,
            eraCategoryId: state.eraCategoryId,
            presetId: state.eraPresetId,
          })
        : undefined),
  };
  const columns = Array.from({ length: state.barCount }, (_, bar) => {
    const spec = se2SynthGenoPluginSpecForTimelineBar(state, bar, keyMode);
    const degree = spec.degree ?? 0;
    const tones = se2SynthGenoVoicePluginChordFromSpec(keyRoot, keyMode, state, spec);
    const rootMidi = se2SynthGenoPluginChordRootMidi(keyRoot, keyMode, settings, bar, degree);
    return {
      bar,
      degree,
      rootMidi,
      tones: tones.length > 0 ? tones : [rootMidi],
    };
  });
  return { columns };
}

/** Block polyphony chord lane — same voicing path as progression trigger pads. */
export function se2SynthGenoPluginDraftChordNotesFromBarSpecs(
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  state: Se2SynthGenoChordPluginState,
  barCount: number,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  const notes: StudioEditor2GenNote[] = [];
  const barDur = Math.max(0.5, beatsPerBar * 0.92);
  for (let bar = 0; bar < barCount; bar += 1) {
    const spec = se2SynthGenoPluginSpecForTimelineBar(state, bar, keyMode);
    const tones = se2SynthGenoVoicePluginChordFromSpec(keyRoot, keyMode, state, spec);
    const startBeat = bar * beatsPerBar;
    for (const pitch of tones) {
      notes.push({
        pitch,
        startBeat,
        durationBeats: barDur,
        velocity: 88 - (bar % 2) * 4,
      });
    }
  }
  return notes;
}

/** Block polyphony chord lane — all tones strike together per hit (Rip Chord / Live Chord style). */
export function se2SynthGenoPluginDraftChordNotes(
  settings: GenoChordBuildSettings,
  harmony: GenoHarmony,
): StudioEditor2GenNote[] {
  const bpb = settings.beatsPerBar;
  const barDur = Math.max(0.5, bpb * 0.92);
  const notes: StudioEditor2GenNote[] = [];
  for (const col of harmony.columns) {
    const startBeat = col.bar * bpb;
    for (const pitch of col.tones) {
      notes.push({
        pitch,
        startBeat,
        durationBeats: barDur,
        velocity: 88 - (col.bar % 2) * 4,
      });
    }
  }
  return notes;
}

/** Strum / chop / repeater — perf hits. Otherwise use block draft chords (Live Chord sound). */
export function se2SynthGenoPluginUsesPerfChordHits(settings: GenoChordBuildSettings): boolean {
  if (settings.perfMode === 'repeater') return true;
  if (settings.perfMode !== 'block') return true;
  return settings.barChordSpecs?.some((s) => s.chopQuant && s.chopQuant !== 'whole') ?? false;
}
