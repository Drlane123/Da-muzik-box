/**
 * Studio Editor 2 — offline bounce for stereo mix + per-track stems (bar range).
 */
import {
  consolidateSe2TrackClips,
  type Se2ConsolidateTrackInput,
} from '@/app/lib/studio/se2AudioClipOps';
import { mixerVolToLinearGain } from '@/app/lib/studio/se2MixerFaderScale';
import { se2TrackHasDraggableAudioClips } from '@/app/lib/studio/se2TrackAlign';

export type Se2ExportBounceTrack = Se2ConsolidateTrackInput & {
  trackIndex: number;
  name: string;
  kind: string;
};

export type Se2ExportBounceOpts = {
  bpm: number;
  rangeStartBeat: number;
  rangeEndBeat: number;
};

export type Se2ExportStemResult = {
  trackIndex: number;
  name: string;
  buffer: AudioBuffer;
};

function trackEligibleForExport(tr: Se2ExportBounceTrack): boolean {
  return se2TrackHasDraggableAudioClips(tr.kind) && tr.audioClips.length > 0;
}

async function mixBuffersToStereo(
  ctx: BaseAudioContext,
  parts: Array<{ buffer: AudioBuffer; gain: number }>,
): Promise<AudioBuffer | null> {
  if (parts.length === 0) return null;
  if (parts.length === 1 && parts[0]!.gain >= 0.999) return parts[0]!.buffer;

  const sampleRate = ctx.sampleRate;
  const maxFrames = Math.max(...parts.map((p) => p.buffer.length));
  const offline = new OfflineAudioContext(2, Math.max(1, maxFrames), sampleRate);

  for (const { buffer, gain } of parts) {
    if (gain <= 0.0001) continue;
    const src = offline.createBufferSource();
    src.buffer = buffer;
    const g = offline.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(offline.destination);
    src.start(0);
  }

  return offline.startRendering();
}

/** One stem per lane — full bar range, ignores mute/solo (classic track-out export). */
export async function bounceSe2TrackStemsInRange(
  ctx: BaseAudioContext,
  tracks: readonly Se2ExportBounceTrack[],
  buffers: ReadonlyMap<string, AudioBuffer>,
  opts: Se2ExportBounceOpts,
): Promise<Se2ExportStemResult[]> {
  const out: Se2ExportStemResult[] = [];
  for (const tr of tracks) {
    if (!trackEligibleForExport(tr)) continue;
    const bounced = await consolidateSe2TrackClips(ctx, tr, buffers, opts);
    if (!bounced) continue;
    out.push({ trackIndex: tr.trackIndex, name: tr.name, buffer: bounced.buffer });
  }
  return out;
}

/** Stereo mix — respects per-track mute/solo + fader level. */
export async function bounceSe2StereoMixInRange(
  ctx: BaseAudioContext,
  tracks: readonly Se2ExportBounceTrack[],
  buffers: ReadonlyMap<string, AudioBuffer>,
  opts: Se2ExportBounceOpts,
  mixer: {
    isMuted: (trackIndex: number) => boolean;
    vol127: (trackIndex: number) => number;
  },
): Promise<AudioBuffer | null> {
  const parts: Array<{ buffer: AudioBuffer; gain: number }> = [];

  for (const tr of tracks) {
    if (!trackEligibleForExport(tr)) continue;
    if (mixer.isMuted(tr.trackIndex)) continue;
    const bounced = await consolidateSe2TrackClips(ctx, tr, buffers, opts);
    if (!bounced) continue;
    parts.push({
      buffer: bounced.buffer,
      gain: mixerVolToLinearGain(mixer.vol127(tr.trackIndex)),
    });
  }

  return mixBuffersToStereo(ctx, parts);
}
