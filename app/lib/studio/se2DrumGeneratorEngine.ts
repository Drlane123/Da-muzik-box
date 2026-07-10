/**
 * Studio Editor 2 — Drum Generator engine (preset library + procedural grooves).
 */
import { beatLabProducerKitIdForPatternPreset } from '@/app/lib/creationStation/beatLabPatternPresetKits';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import { beatLabPatternBankIdForPresetGenre } from '@/app/lib/creationStation/beatLabPatternBank';
import { generateDrumPattern, mulberry32 } from '@/app/lib/magentaPatternGenerator';
import { getPresetsForGenerate, getPatternPresetBpm, type PatternPreset } from '@/app/lib/patternPresets';
import { parseGenoChordStyleFromPrompt } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import {
  studioDrumInstrumentOptionForBeatLabPreset,
  studioDrumPatternGridToNotes,
  studioTileDrumPatternNotes,
  STUDIO_DRUM_PATTERN_LOOP_BARS,
  type StudioDrumMidiNote,
} from '@/app/lib/studio/studioEditor2DrumPatterns';
import type { Se2DrumGenStyle } from '@/app/lib/studio/se2DrumGeneratorTrack';
import {
  SE2_DRUM_GEN_DEFAULT_TEMPERATURE,
  se2NormalizeDrumGenTemperature,
} from '@/app/lib/studio/se2DrumGeneratorTrack';

export type Se2DrumGeneratorLoad = {
  notes: StudioDrumMidiNote[];
  transportBpm: number;
  presetId: string;
  producerKitId: BeatLabProducerKitId;
  midiInstrumentId?: string;
  styleUsed: string;
  /** Set when load came from Bank 2 (modern chord-gen). */
  modernGenre?: string;
};

/** Map Synth Geno style chips → patternPresets / groove engine style strings. */
export function se2DrumGenStyleToGenerateStyle(style: Se2DrumGenStyle): string {
  switch (style) {
    case 'trap':
      return 'trap';
    case 'rnb':
      return 'rnb';
    case 'gospel':
      return 'soul';
    case 'dance':
      return 'house';
    case 'disco':
      return 'disco';
    case 'dark':
    case 'minor':
      return 'dark';
    case 'kpop':
    case 'pop':
    case 'major':
    case 'bright':
      return 'pop';
    default:
      return 'trap';
  }
}

export function se2InferDrumGenStyleFromHarmonyTrack(
  track: {
    kind?: string;
    synthGenoComposePrompt?: string;
    synthGenoPrompt?: string;
    glideBassHarmonyTrackId?: string;
    grooveLeadHarmonyTrackId?: string;
  },
  allTracks?: readonly {
    id: string;
    kind?: string;
    synthGenoComposePrompt?: string;
    synthGenoPrompt?: string;
    glideBassHarmonyTrackId?: string;
    grooveLeadHarmonyTrackId?: string;
  }[],
): Se2DrumGenStyle {
  const prompt = track.synthGenoComposePrompt?.trim() || track.synthGenoPrompt?.trim() || '';
  if (prompt) return parseGenoChordStyleFromPrompt(prompt);

  const linkId = track.glideBassHarmonyTrackId?.trim() || track.grooveLeadHarmonyTrackId?.trim();
  if (linkId && allTracks) {
    const linked = allTracks.find((t) => t.id === linkId);
    if (linked && linked.id !== track.id) {
      return se2InferDrumGenStyleFromHarmonyTrack(linked, allTracks);
    }
  }

  return 'pop';
}

function pickDrumPreset(style: string, seed: number): PatternPreset | null {
  const candidates = getPresetsForGenerate('drums', style);
  if (candidates.length === 0) return null;
  const rng = mulberry32(seed);
  const idx = Math.floor(rng() * candidates.length);
  return candidates[idx] ?? null;
}

/**
 * Generate a 4-bar tiled drum loop for the Drum Generator lane.
 * Uses the same preset library as AI Pattern / Beat Lab, with optional variation.
 */
export async function se2GenerateDrumGeneratorLoad(opts: {
  style: Se2DrumGenStyle;
  seed: number;
  temperature?: number;
  beatsPerBar?: number;
  loopBars?: number;
}): Promise<Se2DrumGeneratorLoad> {
  const styleStr = se2DrumGenStyleToGenerateStyle(opts.style);
  const temperature = se2NormalizeDrumGenTemperature(opts.temperature);
  const bpb = Math.max(1, opts.beatsPerBar ?? 4);
  const loopBars = Math.max(1, opts.loopBars ?? STUDIO_DRUM_PATTERN_LOOP_BARS);

  const pattern = await generateDrumPattern(styleStr, temperature, opts.seed);
  const preset = pickDrumPreset(styleStr, opts.seed);

  const oneBarNotes = studioDrumPatternGridToNotes(pattern, { beatsPerBar: bpb });
  const notes = studioTileDrumPatternNotes(oneBarNotes, bpb, loopBars);

  const producerKitId: BeatLabProducerKitId = preset
    ? beatLabProducerKitIdForPatternPreset(preset)
    : 'trapDarkVault';

  const midiInstrumentId = preset
    ? studioDrumInstrumentOptionForBeatLabPreset(preset)?.id
    : 'gm:trap_drums';

  return {
    notes,
    transportBpm: preset ? getPatternPresetBpm(preset) : 140,
    presetId: preset?.id ?? `gen-${styleStr}-${opts.seed}`,
    producerKitId,
    midiInstrumentId,
    styleUsed: styleStr,
  };
}

export function se2DrumGenBankLabelForStyle(style: Se2DrumGenStyle): string {
  const gen = se2DrumGenStyleToGenerateStyle(style);
  const bank = beatLabPatternBankIdForPresetGenre(gen === 'pop' ? 'Pop' : gen.charAt(0).toUpperCase() + gen.slice(1));
  return bank ?? 'trap';
}
