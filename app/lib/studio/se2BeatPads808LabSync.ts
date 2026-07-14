/**
 * Beat Pads miniature 808 Lab — persist + sync helpers (pattern survives close).
 */
import {
  normalizeSe2Lab808ToneGridPattern,
  se2Lab808NormalizeToneGridLoopBars,
  se2Lab808ToneGridHasHits,
  type Se2Lab808ToneGridLoopBars,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import {
  se2Lab808DefaultVoice,
  se2Lab808VoiceFromTrackFields,
  type Se2Lab808VoiceParams,
} from '@/app/lib/studio/se2Lab808Types';
import type { Se2BeatPadsTrack } from '@/app/lib/studio/se2BeatPadsTrack';

export function cloneSe2Lab808VoiceParams(voice: Se2Lab808VoiceParams): Se2Lab808VoiceParams {
  return {
    ...voice,
    filterFx: { ...voice.filterFx },
    chordLock: { ...voice.chordLock },
    toneGridSteps: voice.toneGridSteps.map((row) => [...row]),
    percSnareSteps: [...voice.percSnareSteps],
    percClapSteps: [...voice.percClapSteps],
  };
}

/** Read Beat Pads 808 Lab voice from track — never invent empty over a stored pattern. */
export function se2BeatPads808LabVoiceFromTrack(
  tr: Pick<Se2BeatPadsTrack, 'beatPads808LabVoice'>,
): Se2Lab808VoiceParams {
  const stored = tr.beatPads808LabVoice;
  if (!stored) return se2Lab808DefaultVoice();
  // Re-normalize via field mirror so old sessions / partial objects stay safe.
  const normalized = se2Lab808VoiceFromTrackFields({
    lab808SoundLane: stored.soundLane,
    lab808KickPresetId: stored.kickPresetId,
    lab808BassPresetId: stored.bassPresetId,
    lab808TonePadBaseMidi: stored.tonePadBaseMidi,
    lab808ToneGridLoopBars: stored.toneGridLoopBars,
    lab808ToneGridSteps: stored.toneGridSteps,
    lab808ToneGridZoom: stored.toneGridZoom,
    lab808RootGenSeed: stored.rootGenSeed,
    lab808RootGenQuantize: stored.rootGenQuantize,
    lab808RootGenGenre: stored.rootGenGenre,
    lab808PercSnareSteps: stored.percSnareSteps,
    lab808PercClapSteps: stored.percClapSteps,
    lab808PercLevel: stored.percLevel,
    lab808ChordLockEnabled: stored.chordLock?.enabled,
    lab808ChordLockSourceKind: stored.chordLock?.sourceKind,
    lab808ChordLockHarmonyTrackId: stored.chordLock?.harmonyTrackId,
    lab808ChordLockKeyRoot: stored.chordLock?.keyRoot,
    lab808ChordLockKeyMode: stored.chordLock?.keyMode,
  });
  return {
    ...normalized,
    filterFx: stored.filterFx ? { ...stored.filterFx } : normalized.filterFx,
    output:
      typeof stored.output === 'number' && Number.isFinite(stored.output)
        ? Math.max(0.05, Math.min(1.5, stored.output))
        : normalized.output,
    toneGridLevel:
      typeof stored.toneGridLevel === 'number' && Number.isFinite(stored.toneGridLevel)
        ? Math.max(0.05, Math.min(1.5, stored.toneGridLevel))
        : normalized.toneGridLevel,
  };
}

export function se2BeatPads808LabHasHits(voice: Se2Lab808VoiceParams): boolean {
  return se2Lab808ToneGridHasHits(voice.toneGridSteps);
}

/** Snap 808 Lab loop length toward Beat Pads bars (4 / 8 / 16 only). */
export function se2BeatPads808LabAlignLoopBars(
  voice: Se2Lab808VoiceParams,
  beatPadsLoopBars: number,
): Se2Lab808VoiceParams {
  const target = se2Lab808NormalizeToneGridLoopBars(beatPadsLoopBars) as Se2Lab808ToneGridLoopBars;
  if (voice.toneGridLoopBars === target) return voice;
  return {
    ...voice,
    toneGridLoopBars: target,
    toneGridSteps: normalizeSe2Lab808ToneGridPattern(voice.toneGridSteps, target),
  };
}
