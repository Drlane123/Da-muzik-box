/**
 * Live real-time Pitch Tune + Vocoder chain for Studio Editor 2 transport preview.
 */
import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';
import { connectStudioInsertFxChain } from '@/app/lib/studio/studioInsertFxAudio';
import { normalizeFxStackOrder, type StudioFxStackSlot } from '@/app/lib/studio/studioFxStackOrder';
import { studioTrackInsertFxNeeded } from '@/app/lib/studio/studioTrackInsertFxStrip';
import {
  bindStudioPitchMonitorEngineAnalyser,
  connectStudioPitchMonitorTap,
  connectStudioVocoderMonitorTap,
  disconnectStudioVocoderMonitorTap,
  getStudioPitchMonitorActiveTrack,
  retapStudioPitchMonitorSource,
} from '@/app/lib/studio/studioPitchTuneMonitorBus';
import { attachStudioLiveVocalEnergyGate } from '@/app/lib/studio/studioLiveVocalEnergyGate';
import {
  createStudioLivePitchTuneChain,
  type StudioLivePitchTuneHandle,
} from '@/app/lib/studio/studioLivePitchTune';
import {
  registerStudioLiveVocalFx,
  type StudioLiveVocalFxRuntimeHandle,
} from '@/app/lib/studio/studioLiveVocalFxRegistry';
import { pitchTuneParamsFromTrackFx } from '@/app/lib/studio/studioPitchTune';
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import {
  scheduleStudioProVocoder,
  studioVocoderParamsFromTrackFx,
  type StudioProVocoderLiveHandle,
} from '@/app/lib/studio/studioVocoder';
import {
  resolvePitchTuneMidiTimeline,
  resolveVocoderCarrierTimeline,
  type StudioVocoderCarrierTrack,
} from '@/app/lib/studio/studioVocoderCarrier';
import type { StudioTrackInsertFxRack } from '@/app/lib/studio/studioTrackInsertFx';
import { estimateSpeechPitchHzRange } from '@/app/lib/creationStation/grooveLabVocalBoxTtsBuffer';

/** Long-lived monitor session for vocoder scheduling + pitch-track window. */
export const STUDIO_LIVE_VOCAL_FX_MONITOR_SEC = 3600;

/** Headroom after stacked FX — matches insert strip trim. */
const FX_STACK_OUTPUT_TRIM = 0.76;

function studioLiveMonitorDryBuffer(ctx: AudioContext): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate));
  return ctx.createBuffer(1, len, ctx.sampleRate);
}

export type StudioLiveVocalFxInputMonitorOpts = {
  ctx: AudioContext;
  modulator: AudioNode;
  dest: AudioNode;
  fx: StudioTrackVocalFx;
  keyRoot: number;
  vocalTrackIndex: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  bpm: number;
  clipStartBeat: number;
  clipDurationBeats: number;
  pitchMonitorTrackIndex: number;
  insertSlots: [MixerEffectId, MixerEffectId, MixerEffectId];
  insertRack: StudioTrackInsertFxRack;
  fxStackOrder?: readonly StudioFxStackSlot[];
};

/**
 * Live mic/line → Pitch Tune → Vocoder (optional) → mixer strip input (insert FX + fader).
 */
export async function connectStudioLiveVocalFxForInputMonitor(
  opts: StudioLiveVocalFxInputMonitorOpts,
): Promise<StudioLiveVocalFxClipHandle> {
  const {
    ctx,
    modulator,
    dest,
    fx,
    keyRoot,
    vocalTrackIndex,
    carrierTracks,
    bpm,
    clipStartBeat,
    clipDurationBeats,
    pitchMonitorTrackIndex,
    insertSlots,
    insertRack,
    fxStackOrder,
  } = opts;

  const tPlay = ctx.currentTime;
  const playSec = STUDIO_LIVE_VOCAL_FX_MONITOR_SEC;
  const dryBuffer = studioLiveMonitorDryBuffer(ctx);

  return connectStudioLiveVocalFxForClip({
    ctx,
    modulator,
    dest,
    tPlay,
    playSec,
    offsetSec: 0,
    clipStartBeat,
    clipDurationBeats,
    bpm,
    fx,
    keyRoot,
    vocalTrackIndex,
    carrierTracks,
    dryBuffer,
    pitchMonitorTrackIndex,
    insertSlots,
    insertRack,
    fxStackOrder,
    pitchTuneUnbounded: true,
  });
}

export type StudioLiveVocalFxClipOpts = {
  ctx: AudioContext;
  modulator: AudioNode;
  dest: AudioNode;
  tPlay: number;
  playSec: number;
  offsetSec: number;
  clipStartBeat: number;
  clipDurationBeats: number;
  bpm: number;
  fx: StudioTrackVocalFx;
  keyRoot: number;
  vocalTrackIndex: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  dryBuffer: AudioBuffer;
  pitchMonitorTrackIndex: number;
  insertSlots: [MixerEffectId, MixerEffectId, MixerEffectId];
  insertRack: StudioTrackInsertFxRack;
  fxStackOrder?: readonly StudioFxStackSlot[];
  pitchTuneUnbounded?: boolean;
};

export type StudioLiveVocalFxClipHandle = StudioLiveVocalFxRuntimeHandle;

function applyPitchTuneFromFx(
  pitchHandle: StudioLivePitchTuneHandle,
  fx: StudioTrackVocalFx,
  keyRoot: number,
  carrierTracks: readonly StudioVocoderCarrierTrack[],
  clipStartBeat: number,
  clipDurationBeats: number,
  bpm: number,
): void {
  const midiTargetTimeline = resolvePitchTuneMidiTimeline(
    fx,
    carrierTracks,
    clipStartBeat,
    clipDurationBeats,
    bpm,
  );
  const ptParams = pitchTuneParamsFromTrackFx(
    {
      autotuneStrength: fx.autotuneStrength,
      pitchRetuneMs: fx.pitchRetuneMs,
      pitchFlex: fx.pitchFlex,
      pitchHumanize: fx.pitchHumanize,
      pitchScaleId: fx.pitchScaleId,
      pitchTracking: fx.pitchTracking,
    },
    keyRoot,
    { midiTargetTimeline: midiTargetTimeline ?? undefined },
  );
  Object.assign(pitchHandle.params, {
    strength: ptParams.strength,
    retuneSpeedMs: ptParams.retuneSpeedMs,
    flexTune: ptParams.flexTune,
    humanize: ptParams.humanize,
    scaleId: ptParams.scaleId,
    tracking: ptParams.tracking,
    keyRoot: ptParams.keyRoot,
    midiTargetTimeline: ptParams.midiTargetTimeline,
  });
  pitchHandle.updateMix(ptParams.strength);
}

function applyVocoderFromFx(
  vocHandle: StudioProVocoderLiveHandle,
  fx: StudioTrackVocalFx,
  dryBuffer: AudioBuffer,
  carrierTracks: readonly StudioVocoderCarrierTrack[],
  vocalTrackIndex: number,
  clipStartBeat: number,
  clipDurationBeats: number,
  bpm: number,
  offsetSec: number,
  playSec: number,
): void {
  const sliceEnd = Math.min(dryBuffer.duration, offsetSec + playSec);
  const fallbackHz = estimateSpeechPitchHzRange(dryBuffer, offsetSec, sliceEnd);
  const carrierTimeline = resolveVocoderCarrierTimeline(
    fx,
    carrierTracks,
    vocalTrackIndex,
    clipStartBeat,
    clipDurationBeats,
    bpm,
    fallbackHz > 40 ? fallbackHz : 220,
  );
  const vocParams = studioVocoderParamsFromTrackFx(fx, dryBuffer, {
    carrierTimeline: carrierTimeline ?? undefined,
  });
  vocHandle.updateParams(vocParams);
}

/**
 * Wire live vocal FX: Pitch Tune worklet → Vocoder (optional) → insert FX → destination.
 */
export async function connectStudioLiveVocalFxForClip(
  opts: StudioLiveVocalFxClipOpts,
): Promise<StudioLiveVocalFxClipHandle> {
  const {
    ctx,
    modulator,
    dest,
    tPlay,
    playSec,
    offsetSec,
    clipStartBeat,
    clipDurationBeats,
    bpm,
    fx,
    keyRoot,
    vocalTrackIndex,
    carrierTracks,
    dryBuffer,
    pitchMonitorTrackIndex,
    insertSlots,
    insertRack,
    fxStackOrder,
    pitchTuneUnbounded = false,
  } = opts;

  const stackOrder = normalizeFxStackOrder(fxStackOrder ?? insertRack.fxStackOrder);
  const cleanups: Array<() => void> = [];
  let tail: AudioNode = modulator;
  let pitchHandle: StudioLivePitchTuneHandle | null = null;
  let vocHandle: StudioProVocoderLiveHandle | null = null;
  let modulatorTapNodes: AudioNode[] = [];
  let ptOut: GainNode | null = null;
  let ptGate: ReturnType<typeof attachStudioLiveVocalEnergyGate> | null = null;
  let vocoderMonitorNode: AudioNode | null = null;

  for (const slot of stackOrder) {
    if (slot === 'pitchTune' && fx.autotuneOn) {
      try {
        const midiTargetTimeline = resolvePitchTuneMidiTimeline(
          fx,
          carrierTracks,
          clipStartBeat,
          clipDurationBeats,
          bpm,
        );
        const ptParams = pitchTuneParamsFromTrackFx(
          {
            autotuneStrength: fx.autotuneStrength,
            pitchRetuneMs: fx.pitchRetuneMs,
            pitchFlex: fx.pitchFlex,
            pitchHumanize: fx.pitchHumanize,
            pitchScaleId: fx.pitchScaleId,
            pitchTracking: fx.pitchTracking,
          },
          keyRoot,
          { midiTargetTimeline: midiTargetTimeline ?? undefined },
        );
        pitchHandle = await createStudioLivePitchTuneChain(
          ctx,
          {
            strength: ptParams.strength,
            retuneSpeedMs: ptParams.retuneSpeedMs,
            flexTune: ptParams.flexTune,
            humanize: ptParams.humanize,
            scaleId: ptParams.scaleId,
            tracking: ptParams.tracking,
            keyRoot: ptParams.keyRoot,
            midiTargetTimeline: ptParams.midiTargetTimeline,
          },
          { tPlay, playSec, offsetSec, unbounded: pitchTuneUnbounded },
        );
        ptOut = ctx.createGain();
        const ptOutFull = pitchTuneUnbounded ? 1.25 : 1.35;
        ptOut.gain.value = ptOutFull;
        tail.connect(pitchHandle.analyser);
        tail.connect(pitchHandle.node);
        pitchHandle.node.connect(ptOut);
        if (pitchTuneUnbounded) {
          ptGate = attachStudioLiveVocalEnergyGate(ctx, tail, [ptOut], [ptOutFull]);
        }
        const pitchIn = tail;
        modulatorTapNodes = [pitchHandle.analyser, pitchHandle.node];
        tail = ptOut;
        cleanups.push(() => {
          for (const n of modulatorTapNodes) {
            try {
              pitchIn.disconnect(n);
            } catch {
              /* */
            }
          }
          modulatorTapNodes = [];
          if (ptOut) {
            try {
              pitchHandle?.node.disconnect(ptOut);
            } catch {
              /* */
            }
            try {
              ptOut.disconnect();
            } catch {
              /* */
            }
            ptOut = null;
          }
          pitchHandle?.stop();
          ptGate?.stop();
          ptGate = null;
        });
      } catch (e) {
        console.warn('[Studio] Pitch Tune worklet unavailable — dry pass-through.', e);
      }
    } else if (slot === 'vocoder' && fx.vocoderOn) {
      vocoderMonitorNode = tail;
      try {
        const sliceEnd = Math.min(dryBuffer.duration, offsetSec + playSec);
        const fallbackHz = estimateSpeechPitchHzRange(dryBuffer, offsetSec, sliceEnd);
        const carrierTimeline = resolveVocoderCarrierTimeline(
          fx,
          carrierTracks,
          vocalTrackIndex,
          clipStartBeat,
          clipDurationBeats,
          bpm,
          fallbackHz > 40 ? fallbackHz : 220,
        );
        const vocParams = studioVocoderParamsFromTrackFx(fx, dryBuffer, {
          carrierTimeline: carrierTimeline ?? undefined,
        });
        const vocOut = ctx.createGain();
        vocOut.gain.value = 1;
        vocHandle = scheduleStudioProVocoder(
          ctx,
          vocOut,
          tail,
          ctx.currentTime,
          playSec,
          vocParams,
          0.9,
          pitchTuneUnbounded,
        );
        tail = vocOut;
        cleanups.push(() => vocHandle?.stop());
      } catch (e) {
        console.warn('[Studio] Vocoder unavailable — pass-through.', e);
      }
    } else if (slot === 'suite' && studioTrackInsertFxNeeded(insertSlots, insertRack)) {
      const postFx = ctx.createGain();
      postFx.gain.value = 1;
      const { input, nodes } = connectStudioInsertFxChain(ctx, insertSlots, insertRack, postFx, bpm);
      tail.connect(input);
      tail = postFx;
      cleanups.push(() => {
        for (const node of nodes) {
          if (node instanceof OscillatorNode) {
            try {
              node.stop();
            } catch {
              /* */
            }
          }
          try {
            node.disconnect();
          } catch {
            /* */
          }
        }
        try {
          postFx.disconnect();
        } catch {
          /* */
        }
      });
    }
  }

  if (pitchHandle) {
    bindStudioPitchMonitorEngineAnalyser(pitchMonitorTrackIndex, modulator, pitchHandle.analyser);
  } else {
    connectStudioPitchMonitorTap(ctx, modulator, tail, pitchMonitorTrackIndex);
  }

  if (fx.vocoderOn && vocoderMonitorNode) {
    connectStudioVocoderMonitorTap(ctx, vocoderMonitorNode, pitchMonitorTrackIndex);
  } else {
    disconnectStudioVocoderMonitorTap(pitchMonitorTrackIndex);
  }

  const trim = ctx.createGain();
  trim.gain.value = FX_STACK_OUTPUT_TRIM;
  tail.connect(trim);
  trim.connect(dest);
  cleanups.push(() => {
    try {
      tail.disconnect(trim);
    } catch {
      /* */
    }
    try {
      trim.disconnect();
    } catch {
      /* */
    }
  });

  const clipCtx = {
    clipStartBeat,
    clipDurationBeats,
    bpm,
    carrierTracks,
    dryBuffer,
    vocalTrackIndex,
    offsetSec,
    playSec,
  };

  const runtimeHandle: StudioLiveVocalFxClipHandle = {
    cleanup: () => {
      disconnectStudioVocoderMonitorTap(pitchMonitorTrackIndex);
      for (const fn of cleanups) fn();
      if (getStudioPitchMonitorActiveTrack() === pitchMonitorTrackIndex) {
        retapStudioPitchMonitorSource(ctx, modulator, pitchMonitorTrackIndex);
      }
    },
    updateTrackFx: (nextFx, nextKeyRoot) => {
      if (pitchHandle) {
        applyPitchTuneFromFx(
          pitchHandle,
          nextFx,
          nextKeyRoot,
          clipCtx.carrierTracks,
          clipCtx.clipStartBeat,
          clipCtx.clipDurationBeats,
          clipCtx.bpm,
        );
        if (ptGate && ptOut) {
          const full = pitchTuneUnbounded ? 1.25 : 1.35;
          ptGate.setGains([full]);
        }
      }
      if (vocHandle) {
        applyVocoderFromFx(
          vocHandle,
          nextFx,
          clipCtx.dryBuffer,
          clipCtx.carrierTracks,
          clipCtx.vocalTrackIndex,
          clipCtx.clipStartBeat,
          clipCtx.clipDurationBeats,
          clipCtx.bpm,
          clipCtx.offsetSec,
          clipCtx.playSec,
        );
      }
    },
  };

  const unregister = registerStudioLiveVocalFx(pitchMonitorTrackIndex, runtimeHandle);
  const baseCleanup = runtimeHandle.cleanup;
  runtimeHandle.cleanup = () => {
    unregister();
    baseCleanup();
  };

  return runtimeHandle;
}

/** True when clip should use live vocal FX graph instead of offline cache. */
export function studioUseLiveVocalFxPlayback(fx: StudioTrackVocalFx): boolean {
  return fx.autotuneOn || fx.vocoderOn;
}

/**
 * True when the ordered F|X vocal stack (Pitch Tune / Vocoder) should be built.
 * DA FX Suite alone routes through `studioTrackInsertFxStrip` — not this stack.
 */
export function studioTrackFxStackActive(
  fx: StudioTrackVocalFx,
  _slots?: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
  _rack?: StudioTrackInsertFxRack,
): boolean {
  return studioUseLiveVocalFxPlayback(fx);
}
