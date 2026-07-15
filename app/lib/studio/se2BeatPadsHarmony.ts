/**
 * Beat Pads (SE2) — lock tempo, loop, key, and groove style to a harmony / card lane.
 */
import { beatLabProducerKitIdForPatternPreset } from '@/app/lib/creationStation/beatLabPatternPresetKits';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import {
  presetToBeatPadsPattern,
  type BeatLabPatternBankId,
  beatLabPatternBankIdForPresetGenre,
} from '@/app/lib/creationStation/beatLabPatternBank';
import {
  se2BeatPadsKickTargetPadIndex,
  se2BeatPadsRegeneratePadLane,
  type Se2BeatPadsRegeneratePadResult,
} from '@/app/lib/studio/se2BeatPadsKickMatch';
import {
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { mulberry32 } from '@/app/lib/magentaPatternGenerator';
import { getPresetsForGenerate, type PatternPreset } from '@/app/lib/patternPresets';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { se2HarmonySourceSteps } from '@/app/lib/studio/se2GlideBassHarmony';
import {
  se2DrumGenStyleToGenerateStyle,
  se2InferDrumGenStyleFromHarmonyTrack,
} from '@/app/lib/studio/se2DrumGeneratorEngine';
import {
  SE2_DRUM_GEN_DEFAULT_STYLE,
  se2DrumGenHarmonySourceCandidates,
  se2DrumGenTrackHarmonyReady,
  se2NormalizeDrumGenStyle,
  type Se2DrumGenHarmonySourceTrack,
  type Se2DrumGenStyle,
} from '@/app/lib/studio/se2DrumGeneratorTrack';
import { se2BeatPadsPadLabelsForTrack } from '@/app/lib/studio/se2BeatPadsPianoRoll';
import { studioNormalizeHarmonyLoopBars } from '@/app/lib/studio/studioInstrumentHarmony';
import type { Se2BeatPadsTrack } from '@/app/lib/studio/se2BeatPadsTrack';

export type Se2BeatPadsHarmonySourceTrack = Se2DrumGenHarmonySourceTrack & {
  rhythmLoopBars?: number;
  harmonyLoopBars?: number;
  trackKeyRoot?: number;
  trackKeyMode?: ChordMode;
  a2mKeyRoot?: number;
  a2mKeyMode?: ChordMode;
};

export type Se2BeatPadsHarmonySync = {
  bpm: number;
  loopBars: number;
  keyRoot?: number;
  keyMode?: ChordMode;
  style: Se2DrumGenStyle;
};

export type Se2BeatPadsMatchedPatternLoad = {
  pattern: BeatPadsDrumPattern;
  loopBars: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
  bpm: number;
  presetId: string;
  producerKitId: BeatLabProducerKitId;
  bankId?: BeatLabPatternBankId;
  styleUsed: string;
};

export function se2ResolveBeatPadsHarmonyTrack<
  T extends Se2BeatPadsHarmonySourceTrack & { beatPadsHarmonyTrackId?: string },
>(tracks: readonly T[], beatPads: Pick<Se2BeatPadsTrack, 'beatPadsHarmonyTrackId'>, beatPadsId: string): T | undefined {
  const want = beatPads.beatPadsHarmonyTrackId?.trim();
  if (want) {
    const picked = tracks.find((t) => t.id === want);
    if (picked && picked.id !== beatPadsId && picked.kind !== 'beatPads' && picked.kind !== 'audio') {
      return picked;
    }
  }
  return se2BeatPadsHarmonyReadyCandidates(tracks, beatPadsId)[0];
}

export function se2BeatPadsHarmonySourceCandidates<T extends Se2BeatPadsHarmonySourceTrack>(
  tracks: readonly T[],
  beatPadsId: string,
): T[] {
  const base = se2DrumGenHarmonySourceCandidates(tracks, beatPadsId);
  const extras = tracks.filter(
    (t) =>
      t.id !== beatPadsId &&
      t.kind === 'genoUltraSynth' &&
      !base.some((b) => b.id === t.id),
  );
  return [...base, ...extras];
}

export function se2BeatPadsHarmonyReadyCandidates<T extends Se2BeatPadsHarmonySourceTrack>(
  tracks: readonly T[],
  beatPadsId: string,
): T[] {
  return se2BeatPadsHarmonySourceCandidates(tracks, beatPadsId).filter((t) => se2BeatPadsHarmonyReady(t));
}

export function se2BeatPadsHarmonyKey(
  harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  songKeyRoot: number,
  songKeyMode: ChordMode,
): { keyRoot: number; keyMode: ChordMode } {
  if (harmony?.trackKeyRoot != null && harmony.trackKeyMode) {
    return { keyRoot: harmony.trackKeyRoot, keyMode: harmony.trackKeyMode };
  }
  if (harmony?.a2mKeyRoot != null && harmony.a2mKeyMode) {
    return { keyRoot: harmony.a2mKeyRoot, keyMode: harmony.a2mKeyMode };
  }
  return { keyRoot: songKeyRoot, keyMode: songKeyMode };
}

export function se2BeatPadsHarmonyLoopBars(
  harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  sessionLoopBars: number,
): number {
  if (harmony?.kind === 'rhythm' && harmony.rhythmLoopBars != null) {
    return studioNormalizeHarmonyLoopBars(harmony.rhythmLoopBars);
  }
  if (
    (harmony?.kind === 'midi' || harmony?.kind === 'rhythm') &&
    harmony.harmonyLoopBars != null
  ) {
    return studioNormalizeHarmonyLoopBars(harmony.harmonyLoopBars);
  }
  const session = Math.max(4, Math.min(16, Math.round(sessionLoopBars || 8)));
  return session;
}

type Se2BeatPadsHarmonyNoteLike = { startBeat?: number; durationBeats?: number };

/** C-block timing for kick follow — rhythm/progression steps, else piano-roll note onsets. */
export function se2BeatPadsHarmonySteps(
  harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  beatsPerBar: number,
  loopBars: number,
): readonly GrooveProgressionStep[] {
  if (!harmony) return [];
  const fromCards = se2HarmonySourceSteps(harmony);
  if (fromCards.length > 0) return fromCards;

  const notes = harmony.notes as readonly Se2BeatPadsHarmonyNoteLike[] | undefined;
  if (!notes?.length) return [];

  const harmonyLoopBars = se2BeatPadsHarmonyLoopBars(harmony, loopBars);
  const loopBeats = harmonyLoopBars * beatsPerBar;
  const quant = (b: number) => Math.round(b * 64) / 64;
  const starts: number[] = [];
  for (const n of notes) {
    const s = quant(n.startBeat ?? 0);
    if (s < 0 || s >= loopBeats - 1e-6) continue;
    if (!starts.some((x) => Math.abs(x - s) < 1 / 32)) starts.push(s);
  }
  starts.sort((a, b) => a - b);
  if (starts.length === 0) return [];

  return starts.map((start, i) => {
    const next = i + 1 < starts.length ? starts[i + 1]! : loopBeats;
    return {
      id: `bp-kick-harmony-${i}-${start}`,
      label: '',
      beats: Math.max(1 / 16, next - start),
    };
  });
}

export function se2BeatPadsHarmonySyncFromLane(
  harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  tracks: readonly Se2BeatPadsHarmonySourceTrack[],
  opts: {
    sessionBpm: number;
    sessionLoopBars: number;
    songKeyRoot: number;
    songKeyMode: ChordMode;
    styleOverride?: Se2DrumGenStyle;
  },
): Se2BeatPadsHarmonySync {
  const style =
    opts.styleOverride ??
    (harmony ? se2InferDrumGenStyleFromHarmonyTrack(harmony, tracks) : SE2_DRUM_GEN_DEFAULT_STYLE);
  const { keyRoot, keyMode } = se2BeatPadsHarmonyKey(harmony, opts.songKeyRoot, opts.songKeyMode);
  return {
    bpm: opts.sessionBpm,
    loopBars: se2BeatPadsHarmonyLoopBars(harmony, opts.sessionLoopBars),
    keyRoot,
    keyMode,
    style: se2NormalizeDrumGenStyle(style),
  };
}


export function se2BeatPadsRegeneratePadOnTrack(
  track: {
    id?: string;
    beatPadsPattern?: BeatPadsDrumPattern;
    beatPadsLoopBars?: number;
    beatPadsStepsPerBar?: BeatPadsGridStepsPerBar;
    beatPadsKickFollowMode?: string;
    beatPadsKickTargetPad?: number;
    beatPadsPatternStyle?: string;
    beatPadsProducerKitId?: string;
  },
  harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  beatsPerBar: number,
  targetPadIndex: number,
  seed?: number,
): Se2BeatPadsRegeneratePadResult | null {
  const loopBars = track.beatPadsLoopBars ?? 8;
  const stepsPerBar = track.beatPadsStepsPerBar ?? 16;
  const base = track.beatPadsPattern;
  if (!base) return null;
  const pad = Math.max(0, Math.min(15, Math.round(targetPadIndex)));
  const kitId = (track.beatPadsProducerKitId ?? 'trapDarkVault') as BeatLabProducerKitId;
  const padLabel =
    track.id != null
      ? (se2BeatPadsPadLabelsForTrack(track.id, kitId)[pad] ?? '')
      : '';
  return se2BeatPadsRegeneratePadLane(
    base,
    harmony,
    stepsPerBar,
    beatsPerBar,
    loopBars,
    pad,
    undefined,
    seed ?? Date.now() % 1_000_000_000,
    {
      padLabel,
      style: track.beatPadsPatternStyle,
    },
  );
}

/** @deprecated Use {@link se2BeatPadsRegeneratePadOnTrack}. */
export function se2BeatPadsApplyKickFollowOnTrack(
  track: Parameters<typeof se2BeatPadsRegeneratePadOnTrack>[0],
  harmony: Se2BeatPadsHarmonySourceTrack | undefined,
  beatsPerBar: number,
  targetPadIndex?: number,
): Se2BeatPadsRegeneratePadResult | null {
  const pad = targetPadIndex ?? se2BeatPadsKickTargetPadIndex(track);
  return se2BeatPadsRegeneratePadOnTrack(track, harmony, beatsPerBar, pad);
}

function pickBeatPadsPreset(style: Se2DrumGenStyle, seed: number): PatternPreset | null {
  const styleStr = se2DrumGenStyleToGenerateStyle(style);
  const candidates = getPresetsForGenerate('drums', styleStr);
  if (candidates.length === 0) return null;
  const rng = mulberry32(seed);
  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}

export function se2BeatPadsLoadMatchedPattern(opts: {
  style: Se2DrumGenStyle;
  seed: number;
  harmony?: Se2BeatPadsHarmonySourceTrack;
  sessionLoopBars: number;
  stepsPerBar?: BeatPadsGridStepsPerBar;
  beatsPerBar?: number;
  preset?: PatternPreset;
}): Se2BeatPadsMatchedPatternLoad | null {
  const preset = opts.preset ?? pickBeatPadsPreset(opts.style, opts.seed);
  if (!preset) return null;

  const loopBars = se2BeatPadsHarmonyLoopBars(opts.harmony, opts.sessionLoopBars);
  const stepsPerBar = opts.stepsPerBar ?? 16;
  const loaded = presetToBeatPadsPattern(preset, loopBars);
  const pattern = loaded.pattern as BeatPadsDrumPattern;

  const styleStr = se2DrumGenStyleToGenerateStyle(opts.style);
  const bankId = beatLabPatternBankIdForPresetGenre(
    styleStr === 'pop' ? 'Pop' : styleStr.charAt(0).toUpperCase() + styleStr.slice(1),
  );

  return {
    pattern,
    loopBars: loaded.loopBars,
    stepsPerBar,
    bpm: loaded.bpm,
    presetId: preset.id,
    producerKitId: beatLabProducerKitIdForPatternPreset(preset),
    bankId,
    styleUsed: styleStr,
  };
}

export function se2BeatPadsHarmonyReady(tr: Se2BeatPadsHarmonySourceTrack): boolean {
  if (tr.kind === 'genoUltraSynth') return (tr.notes?.length ?? 0) > 0;
  return se2DrumGenTrackHarmonyReady(tr);
}
