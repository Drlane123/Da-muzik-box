/**
 * Chord Generator — untiled loop + fresh per-slot voicing specs (no voicing import cycle).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  GENO_PROGRESSIONS,
  type GenoBarChordSpec,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoChordPluginState } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import {
  se2SynthGenoEraPresetById,
  se2SynthGenoRomanToBarSpec,
  se2SynthGenoEraCategoryLiveGenre,
  se2SynthGenoEraProgressionMode,
  se2SynthGenoPluginMapPatternToBarCount,
} from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import {
  SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE,
  se2SynthGenoLiveRomanToBarSpec,
} from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';

function pluginGenreFromStyle(style: GenoChordStyle | undefined): Se2SynthGenoLiveGenreId {
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

function pluginRomanMode(
  state: Se2SynthGenoChordPluginState,
  keyMode: StudioDetectedKeyMode,
): ChordMode {
  if (state.eraCategoryId) return se2SynthGenoEraProgressionMode(state.eraCategoryId);
  return keyMode === 'minor' ? 'minor' : 'major';
}

/** Preset cycle before mapping to the 4- or 8-bar trigger strip. */
export function se2SynthGenoPluginPatternLoop(
  state: Se2SynthGenoChordPluginState,
): GenoBarChordSpec[] {
  const preset = state.eraPresetId ? se2SynthGenoEraPresetById(state.eraPresetId) : undefined;
  const categoryId = state.eraCategoryId ?? preset?.categoryId;

  if (preset?.romans?.length && categoryId) {
    const userLoop = state.progressionLoop;
    const seedLen = preset.romans.length;
    // User appended chords beyond the preset seed — keep their shorter pattern as the seed.
    if (userLoop?.length && userLoop.length > seedLen && userLoop.length < state.barCount) {
      return userLoop.map((s) => ({ ...s }));
    }
    // Keep user loop edits (voicing depth, chop, passing tail) — do not rebuild from preset romans.
    if (userLoop?.length && userLoop.length >= seedLen) {
      return userLoop.map((s) => ({ ...s }));
    }
    return preset.romans.map((r) => se2SynthGenoRomanToBarSpec(r, categoryId));
  }

  if (state.progressionLoop?.length) {
    const loop = state.progressionLoop;
    if (loop.length <= state.barCount) {
      return loop.map((s) => ({ ...s }));
    }
    return loop.slice(0, state.barCount).map((s) => ({ ...s }));
  }
  if (state.progressionRomans?.length && categoryId) {
    return state.progressionRomans.map((r) => se2SynthGenoRomanToBarSpec(r, categoryId));
  }
  const def = GENO_PROGRESSIONS.find((p) => p.id === state.progressionId);
  if (state.barChordSpecs?.length) {
    return state.barChordSpecs.map((s) => ({ ...s }));
  }
  const degrees = def?.degrees ?? [0, 4, 5, 3];
  return degrees.map((degree) => ({ degree, smartMatch: state.smartMatch }));
}

/** Progression trigger slots — always exactly barCount (4, 8, or 12), mapped from the preset pattern. */
export function se2SynthGenoPluginBaseLoop(
  state: Se2SynthGenoChordPluginState,
): GenoBarChordSpec[] {
  return se2SynthGenoPluginMapPatternToBarCount(
    se2SynthGenoPluginPatternLoop(state),
    state.barCount,
    {
      romans: state.progressionRomans,
      eraCategoryId: state.eraCategoryId,
      presetId: state.eraPresetId,
    },
  );
}

/** Fresh genre hints every pad play — never trust stale specs baked at module load. */
export function se2SynthGenoPluginSlotSpecForVoice(
  state: Se2SynthGenoChordPluginState,
  slotIndex: number,
  keyMode: StudioDetectedKeyMode,
  overrides?: Pick<GenoBarChordSpec, 'voicingDepth' | 'chopQuant' | 'inversion'>,
): GenoBarChordSpec | null {
  const tiled = state.barChordSpecs;
  if (tiled?.length && slotIndex < tiled.length) {
    const spec = tiled[slotIndex];
    if (spec) return { ...spec, ...overrides };
  }
  const loop = se2SynthGenoPluginBaseLoop(state);
  const spec = loop[slotIndex];
  if (spec) return { ...spec, ...overrides };
  const romans = state.progressionRomans;
  if (!romans?.length) {
    return null;
  }
  const roman = romans[slotIndex];
  if (!roman) return null;
  const mode = pluginRomanMode(state, keyMode);
  const genreId = state.eraCategoryId
    ? se2SynthGenoEraCategoryLiveGenre(state.eraCategoryId)
    : pluginGenreFromStyle(state.stylePreset);
  const fresh = se2SynthGenoLiveRomanToBarSpec(roman, mode, genreId);
  const loopSpec = state.progressionLoop?.[slotIndex];
  const merged = loopSpec
    ? {
        ...fresh,
        ...loopSpec,
        voicingDepth: overrides?.voicingDepth ?? loopSpec.voicingDepth ?? fresh.voicingDepth,
        chopQuant: overrides?.chopQuant ?? loopSpec.chopQuant,
        inversion: overrides?.inversion ?? loopSpec.inversion ?? fresh.inversion,
      }
    : fresh;
  if (genreId === 'pop' || genreId === 'rnb-pop' || genreId === 'afrobeats') {
    const ref = se2SynthGenoLiveRomanToBarSpec(
      roman,
      mode,
      SE2_SYNTH_GENO_LIVE_REGISTER_REFERENCE_GENRE,
    );
    return {
      ...merged,
      inversion: overrides?.inversion ?? loopSpec?.inversion ?? ref.inversion,
      stackOctave: ref.stackOctave,
      voicingDepth: overrides?.voicingDepth ?? loopSpec?.voicingDepth ?? merged.voicingDepth,
      chopQuant: overrides?.chopQuant ?? loopSpec?.chopQuant,
    };
  }
  return {
    ...merged,
    voicingDepth: overrides?.voicingDepth ?? loopSpec?.voicingDepth ?? merged.voicingDepth,
    chopQuant: overrides?.chopQuant ?? loopSpec?.chopQuant,
    inversion: overrides?.inversion ?? loopSpec?.inversion ?? merged.inversion,
  };
}

/**
 * Spec for a timeline bar (0…barCount−1) — uses tiled barChordSpecs so bars 5–8
 * match the loop editor + chord MIDI, not raw slot index alone.
 */
export function se2SynthGenoPluginSpecForTimelineBar(
  state: Se2SynthGenoChordPluginState,
  timelineBar: number,
  keyMode: StudioDetectedKeyMode,
): GenoBarChordSpec {
  const tiled = state.barChordSpecs;
  if (tiled?.length && timelineBar < tiled.length) {
    const hit = tiled[timelineBar];
    if (hit) return { ...hit };
  }
  if (tiled?.length === state.barCount) {
    const hit = tiled[timelineBar];
    if (hit) return { ...hit };
  }
  const loop = se2SynthGenoPluginBaseLoop(state);
  const slotIdx = Math.min(timelineBar, Math.max(0, loop.length - 1));
  const loopSpec = state.progressionLoop?.[slotIdx];
  return (
    se2SynthGenoPluginSlotSpecForVoice(state, slotIdx, keyMode, {
      voicingDepth: loopSpec?.voicingDepth,
      chopQuant: loopSpec?.chopQuant,
      inversion: loopSpec?.inversion,
    })
    ?? loopSpec
    ?? { degree: state.barDegrees?.[timelineBar] ?? 0 }
  );
}
