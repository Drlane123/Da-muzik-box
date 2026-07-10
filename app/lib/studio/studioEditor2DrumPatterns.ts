/**
 * Studio Editor 2 — drum-channel pattern starters from the Piano Roll catalog
 * (50 Trap + R&B presets, same grids as the Modules piano roll).
 */

import { beatLabProducerKitIdForPatternPreset } from '@/app/lib/creationStation/beatLabPatternPresetKits';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import {
  beatLabPatternBankIdForPresetGenre,
  type BeatLabPatternBankId,
} from '@/app/lib/creationStation/beatLabPatternBank';
import {
  DRUM_PATTERN_PRESETS,
  getPatternPresetBpm,
  type PatternPreset,
} from '@/app/lib/patternPresets';
import { studioNormalizeA2mMode } from '@/app/lib/studio/studioEditor2AudioToMidi';
import {
  studioMidiInstrumentOption,
  type StudioMidiInstrumentOption,
} from '@/app/lib/studio/studioEditor2Instruments';
import { studioTrackOutputsMidi, type StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import {
  PIANO_ROLL_DRUM_CATALOG,
  PIANO_ROLL_RNB_PRESETS,
  PIANO_ROLL_TRAP_PRESETS,
  pianoRollDrumPresetById,
  pianoRollTransportBpmForPreset,
  type PianoRollDrumCategory,
  type PianoRollDrumPreset,
} from '@/app/lib/pianoRoll/pianoRollDrumCatalog';

export type StudioDrumMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

/** patternPresets 8-row grid → GM drum pitches (Kick … Rim). */
export const STUDIO_DRUM_PATTERN_ROW_GM: readonly number[] = [36, 38, 39, 42, 46, 50, 45, 37];

export function studioTrackIsDrumChannel(
  tr: StudioEditor2MidiTrack & { midiInstrumentId?: string; a2mMode?: string; name?: string; midiChannel?: number; kind?: string },
): boolean {
  if (tr.kind === 'drumGenerator') return true;
  if (tr.kind === 'beatPads') return true;
  if (!studioTrackOutputsMidi(tr)) return false;
  if (tr.kind === 'a2m' && studioNormalizeA2mMode(tr.a2mMode) === 'drums') return true;
  const opt = studioMidiInstrumentOption(tr.midiInstrumentId ?? '');
  if (opt?.category === 'drums') return true;
  const name = tr.name?.trim().toLowerCase() ?? '';
  if (/\bdrums?\b/.test(name)) return true;
  if (typeof tr.midiChannel === 'number' && tr.midiChannel === 10) return true;
  return false;
}

/** One bar of 16th-note steps (4/4) → SE2 note list. */
export function studioDrumPatternGridToNotes(
  pattern: boolean[][],
  opts?: {
    startBeat?: number;
    velocity?: number;
    durationBeats?: number;
    stepsPerBar?: number;
    beatsPerBar?: number;
  },
): StudioDrumMidiNote[] {
  const startBeat = opts?.startBeat ?? 0;
  const velocity = opts?.velocity ?? 100;
  const durationBeats = opts?.durationBeats ?? 0.25;
  const stepsPerBar = Math.max(1, opts?.stepsPerBar ?? pattern[0]?.length ?? 16);
  const bpb = Math.max(1, opts?.beatsPerBar ?? 4);
  const stepBeats = bpb / stepsPerBar;

  const notes: StudioDrumMidiNote[] = [];
  for (let row = 0; row < pattern.length; row++) {
    const steps = pattern[row];
    if (!steps) continue;
    const pitch = STUDIO_DRUM_PATTERN_ROW_GM[row] ?? 36 + row;
    for (let col = 0; col < steps.length; col++) {
      if (!steps[col]) continue;
      notes.push({
        pitch,
        startBeat: startBeat + col * stepBeats,
        durationBeats,
        velocity,
      });
    }
  }
  return notes;
}

export function studioDrumPresetsForCategory(category: PianoRollDrumCategory): readonly PianoRollDrumPreset[] {
  return category === 'Trap' ? PIANO_ROLL_TRAP_PRESETS : PIANO_ROLL_RNB_PRESETS;
}

export {
  PIANO_ROLL_DRUM_CATALOG,
  PIANO_ROLL_TRAP_PRESETS,
  PIANO_ROLL_RNB_PRESETS,
  pianoRollDrumPresetById,
  pianoRollTransportBpmForPreset,
  type PianoRollDrumCategory,
  type PianoRollDrumPreset,
};

export type StudioDrumPatternLoadResult = {
  notes: StudioDrumMidiNote[];
  transportBpm: number;
  presetId: string;
  producerKitId: BeatLabProducerKitId;
  category: PianoRollDrumCategory;
};

export function studioBuildDrumPatternLoad(preset: PianoRollDrumPreset, beatsPerBar = 4): StudioDrumPatternLoadResult {
  return {
    notes: studioDrumPatternGridToNotes(preset.pattern, { beatsPerBar }),
    transportBpm: pianoRollTransportBpmForPreset(preset),
    presetId: preset.id,
    producerKitId: preset.kitId,
    category: preset.category,
  };
}

/** Default loop length when a Trap / R&B preset loads in Studio Editor 2. */
export const STUDIO_DRUM_PATTERN_LOOP_BARS = 4;

/** Repeat a one-bar catalog pattern across `loopBars` for a seamless 4-bar drum loop. */
export function studioTileDrumPatternNotes(
  notes: readonly StudioDrumMidiNote[],
  beatsPerBar = 4,
  loopBars = STUDIO_DRUM_PATTERN_LOOP_BARS,
): StudioDrumMidiNote[] {
  const barBeats = Math.max(1, beatsPerBar);
  const bars = Math.max(1, loopBars);
  const out: StudioDrumMidiNote[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * barBeats;
    for (const n of notes) {
      if (n.startBeat >= barBeats) continue;
      out.push({
        pitch: n.pitch,
        startBeat: n.startBeat + offset,
        durationBeats: n.durationBeats,
        velocity: n.velocity,
      });
    }
  }
  return out;
}

export function studioDrumInstrumentOptionForPreset(preset: PianoRollDrumPreset): StudioMidiInstrumentOption | undefined {
  const trap = preset.category === 'Trap';
  const prefer = trap ? 'gm:trap_drums' : 'gm:hiphop_drums';
  const fallback = 'gm:standard_drums';
  return studioMidiInstrumentOption(prefer) ?? studioMidiInstrumentOption(fallback);
}

const beatLabPresetById = new Map(DRUM_PATTERN_PRESETS.map((p) => [p.id, p]));

export function studioBeatLabPatternPresetById(id: string | undefined): PatternPreset | undefined {
  if (!id) return undefined;
  return beatLabPresetById.get(id);
}

export function studioBeatLabPatternBankIdForPreset(
  preset: PatternPreset | undefined,
): BeatLabPatternBankId | undefined {
  if (!preset) return undefined;
  return beatLabPatternBankIdForPresetGenre(preset.genre);
}

export type StudioBeatLabPatternLoadResult = {
  notes: StudioDrumMidiNote[];
  transportBpm: number;
  presetId: string;
  producerKitId: BeatLabProducerKitId;
  bankId: BeatLabPatternBankId | undefined;
};

export function studioBuildBeatLabPatternLoad(
  preset: PatternPreset,
  beatsPerBar = 4,
): StudioBeatLabPatternLoadResult {
  return {
    notes: studioDrumPatternGridToNotes(preset.pattern, { beatsPerBar }),
    transportBpm: getPatternPresetBpm(preset),
    presetId: preset.id,
    producerKitId: beatLabProducerKitIdForPatternPreset(preset),
    bankId: beatLabPatternBankIdForPresetGenre(preset.genre),
  };
}

export function studioDrumInstrumentOptionForBeatLabPreset(
  preset: PatternPreset,
): StudioMidiInstrumentOption | undefined {
  const bankId = beatLabPatternBankIdForPresetGenre(preset.genre);
  const prefer =
    bankId === 'trap'
      ? 'gm:trap_drums'
      : bankId === 'house' || bankId === 'dance' || bankId === 'disco' || bankId === 'techno'
        ? 'gm:electronic_drums'
        : bankId === 'rnb' || bankId === 'afro' || bankId === 'reggae' || bankId === 'miami'
          ? 'gm:hiphop_drums'
          : 'gm:standard_drums';
  return studioMidiInstrumentOption(prefer) ?? studioMidiInstrumentOption('gm:standard_drums');
}
