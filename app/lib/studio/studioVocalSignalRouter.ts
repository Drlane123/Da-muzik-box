/**
 * Route live mic + clip playback through per-track Vocal DSP inserts.
 */
import { getStudioPitchMonitorActiveTrack } from '@/app/lib/studio/studioPitchTuneMonitorBus';
import { ensureStudioLivePitchTuneWorklet } from '@/app/lib/studio/studioLivePitchTune';
import { studioUseLiveVocalFxPlayback } from '@/app/lib/studio/studioLiveVocalFxChain';
import {
  ensureStudioInputMonitor,
  getStudioInputMonitorFanout,
  getStudioInputMonitorScopeTrackIndex,
  studioInputMonitorConnectDest,
} from '@/app/lib/studio/studioInputMonitor';
import {
  getStudioTrackVocalFxEntry,
  syncStudioTrackVocalFxInsert,
} from '@/app/lib/studio/studioTrackVocalFxInsert';
import type { StudioTrackInsertFxRack } from '@/app/lib/studio/studioTrackInsertFx';
import {
  STUDIO_TRACK_VOCAL_FX_DEFAULT,
  studioEffectiveTrackVocalFx,
} from '@/app/lib/studio/studioTrackVocalFx';
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';
import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';
import { emptyMixerFxSlots } from '@/app/screens/components/ChannelStripFxDropdowns';

export type StudioLiveInputLane = {
  kind: 'audio' | 'a2m';
  audioInputDeviceId?: string;
  a2mKeyRoot?: number;
};

/**
 * Which lane receives live input.
 * DAW order: mic must enter the track insert where Pitch Tune / Vocoder is ON,
 * then through Vocal DSP → mixer → (optional) record.
 */
export function resolveStudioLiveInputMonitorTarget(
  tracks: readonly StudioLiveInputLane[],
  trackRecordArmed: readonly boolean[],
  trackVocalFx: readonly StudioTrackVocalFx[],
  trackFxSlots: readonly [MixerEffectId, MixerEffectId, MixerEffectId][],
  selectedTrackIndex: number,
  projectDefaultDeviceId: string,
): { trackIndex: number; deviceId: string } | null {
  const fxForTrack = (ti: number) =>
    studioEffectiveTrackVocalFx(
      trackVocalFx[ti] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT,
      trackFxSlots[ti] ?? emptyMixerFxSlots(),
    );

  const laneDevice = (ti: number) => {
    const t = tracks[ti];
    if (!t) return projectDefaultDeviceId || 'default';
    if (t.kind === 'audio') {
      const per = t.audioInputDeviceId?.trim();
      return per || projectDefaultDeviceId || 'default';
    }
    return projectDefaultDeviceId || 'default';
  };

  const tryLane = (ti: number, requireFx: boolean) => {
    const t = tracks[ti];
    if (!t || (t.kind !== 'audio' && t.kind !== 'a2m')) return null;
    const effectiveFx = fxForTrack(ti);
    if (requireFx && !studioUseLiveVocalFxPlayback(effectiveFx)) return null;
    return { trackIndex: ti, deviceId: laneDevice(ti) };
  };

  const sel = Math.max(0, Math.min(tracks.length - 1, selectedTrackIndex));

  // 1 — Selected + record-armed audio (explicit user target: this lane gets mic)
  if (tracks[sel]?.kind === 'audio' && (trackRecordArmed[sel] ?? false)) {
    return { trackIndex: sel, deviceId: laneDevice(sel) };
  }

  const pitchScopeTi = getStudioPitchMonitorActiveTrack();

  // 2 — Vocal FX panel open on this lane (even before Pitch Tune toggled ON)
  if (pitchScopeTi != null) {
    const scopeFx = tryLane(pitchScopeTi, true);
    if (scopeFx) return scopeFx;
    const scopeDry = tryLane(pitchScopeTi, false);
    if (scopeDry) return scopeDry;
  }

  // 3 — Selected lane with Pitch Tune / Vocoder ON
  const selectedFx = tryLane(sel, true);
  if (selectedFx) return selectedFx;

  // 4 — Any record-armed audio lane with Vocal DSP ON
  for (let ti = 0; ti < tracks.length; ti++) {
    if (tracks[ti]?.kind === 'audio' && (trackRecordArmed[ti] ?? false)) {
      const armedFx = tryLane(ti, true);
      if (armedFx) return armedFx;
    }
  }

  // 5 — Any lane with Vocal DSP ON
  for (let ti = 0; ti < tracks.length; ti++) {
    const hit = tryLane(ti, true);
    if (hit) return hit;
  }

  // 6 — Dry monitor: first record-armed audio lane
  for (let ti = 0; ti < tracks.length; ti++) {
    if (tracks[ti]?.kind === 'audio' && (trackRecordArmed[ti] ?? false)) {
      return { trackIndex: ti, deviceId: laneDevice(ti) };
    }
  }

  return null;
}

export function studioLiveInputMonitorKey(
  target: { trackIndex: number; deviceId: string } | null,
  trackVocalFx: readonly StudioTrackVocalFx[],
  trackFxSlots: readonly [MixerEffectId, MixerEffectId, MixerEffectId][],
  selectedTrackIndex: number,
): string {
  if (!target) return '';
  const fx = studioEffectiveTrackVocalFx(
    trackVocalFx[target.trackIndex] ?? STUDIO_TRACK_VOCAL_FX_DEFAULT,
    trackFxSlots[target.trackIndex] ?? emptyMixerFxSlots(),
  );
  const pitchTi = getStudioPitchMonitorActiveTrack();
  return `${target.trackIndex}:${target.deviceId}:${fx.autotuneOn ? 1 : 0}:${fx.vocoderOn ? 1 : 0}:scope${pitchTi ?? -1}:sel${selectedTrackIndex}`;
}

/** Open mic (if needed), sync F|X stack, connect mic → entry. */
export async function routeStudioVocalLiveSignal(opts: {
  ctx: AudioContext;
  trackIndex: number;
  deviceId: string;
  preStrip: GainNode;
  stripIn: GainNode;
  fx: StudioTrackVocalFx;
  keyRoot: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  bpm: number;
  clipStartBeat: number;
  connectMic: boolean;
  slots: [MixerEffectId, MixerEffectId, MixerEffectId];
  rack: StudioTrackInsertFxRack;
}): Promise<GainNode | null> {
  const {
    ctx,
    trackIndex,
    deviceId,
    preStrip,
    stripIn,
    fx,
    keyRoot,
    carrierTracks,
    bpm,
    clipStartBeat,
    connectMic,
    slots,
    rack,
  } = opts;

  if (connectMic) {
    const micOk = await ensureStudioInputMonitor(ctx, deviceId);
    if (!micOk) {
      console.warn(
        '[Studio] Microphone not available — allow mic access (browser prompt or Settings → Audio Input).',
      );
      return null;
    }
  }

  if (fx.autotuneOn) {
    await ensureStudioLivePitchTuneWorklet(ctx);
  }

  const entry = await syncStudioTrackVocalFxInsert({
    ctx,
    trackIndex,
    preStrip,
    stripIn,
    fx,
    keyRoot,
    carrierTracks,
    bpm,
    clipStartBeat,
    clipDurationBeats: 128,
    slots,
    rack,
  });

  if (connectMic) {
    studioInputMonitorConnectDest(entry, trackIndex);
  }

  return entry;
}

/**
 * Re-attach live mic to this lane only when it already owns the monitor scope.
 * Prevents per-track Vocal DSP sync from stealing the mic onto the wrong entry
 * (breaks Pitch Tune / Vocoder in the headphones while recording).
 */
export function reconnectStudioVocalLiveMicIfCached(
  trackIndex: number,
  destOverride?: AudioNode | null,
): void {
  if (!getStudioInputMonitorFanout()) return;
  if (getStudioInputMonitorScopeTrackIndex() !== trackIndex) return;
  const dest = destOverride ?? getStudioTrackVocalFxEntry(trackIndex);
  if (!dest) return;
  studioInputMonitorConnectDest(dest, trackIndex);
}
