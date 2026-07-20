/**
 * Studio Editor 2 — offline Pitch Tune + vocoder for audio / A2M clips.
 */

import { scheduleVocalBoxProcessedSpeech } from '@/app/lib/creationStation/grooveLabVocalBoxProcessor';
import {
  renderStudioVocoderBuffer,
  studioVocoderParamsFromTrackFx,
} from '@/app/lib/studio/studioVocoder';
import {
  VOCALBOX_DEFAULT_SETTINGS,
  type VocalBoxSettings,
} from '@/app/lib/creationStation/grooveLabVocalBoxEngine';
import { estimateSpeechPitchHzRange } from '@/app/lib/creationStation/grooveLabVocalBoxTtsBuffer';
import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  pitchTuneParamsFromTrackFx,
  renderPitchTuneBuffer,
  type PitchTuneScaleId,
} from '@/app/lib/studio/studioPitchTune';
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import {
  studioNormalizeExclusiveVocalEngines,
  studioVocalFxSettingsFromTrack,
} from '@/app/lib/studio/studioTrackVocalFx';
import {
  resolvePitchTuneMidiTimeline,
  resolveVocoderCarrierTimeline,
  studioVocoderCarrierNotesSig,
  type StudioVocoderCarrierTrack,
} from '@/app/lib/studio/studioVocoderCarrier';

export function studioTrackSlotsHaveVocalFx(
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
): boolean {
  return slots.some((id) => id === 'autotune' || id === 'vocoder');
}

export function studioVocalFxSettingsFromSlots(
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
): VocalBoxSettings | null {
  const autotune = slots.includes('autotune');
  const vocoder = slots.includes('vocoder');
  if (!autotune && !vocoder) return null;
  if (autotune && vocoder) {
    return { ...VOCALBOX_DEFAULT_SETTINGS, autotuneStrength: 0.22, robotMix: 0.78 };
  }
  if (autotune) {
    return {
      ...VOCALBOX_DEFAULT_SETTINGS,
      autotuneStrength: 0.18,
      robotMix: 0.12,
      vibratoDepth: 0.12,
    };
  }
  return {
    ...VOCALBOX_DEFAULT_SETTINGS,
    autotuneStrength: 0.12,
    robotMix: 0.85,
    vibratoDepth: 0.08,
    style: 'talk',
  };
}

export function studioVocalFxCacheKey(
  sourceId: string,
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
): string {
  return `${sourceId}|${slots.join(',')}|${keyRoot}|${keyMode}|vc4`;
}

function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(Math.max(1, hz) / 440);
}

export type StudioVocalFxRenderOpts = {
  keyRoot?: number;
  keyMode?: StudioDetectedKeyMode;
  trackFx?: StudioTrackVocalFx;
  /** Clip placement on the timeline — required for MIDI carrier pitch mapping */
  clipStartBeat?: number;
  clipDurationBeats?: number;
  bpm?: number;
  vocalTrackIndex?: number;
  carrierTracks?: readonly StudioVocoderCarrierTrack[];
};

/**
 * Render clip through Pitch Tune OR Vocoder (exclusive engines — not DA FX Suite).
 */
export async function renderStudioAudioVocalFx(
  source: AudioBuffer,
  settings: VocalBoxSettings | null,
  opts?: StudioVocalFxRenderOpts,
): Promise<AudioBuffer> {
  if (!settings && !opts?.trackFx?.autotuneOn && !opts?.trackFx?.vocoderOn) return source;

  /* Yield so Pitch Tune / Vocoder toggles paint before offline DSP starts. */
  await new Promise<void>((r) => setTimeout(r, 0));

  const keyRoot = opts?.keyRoot ?? 0;
  const trackFx = opts?.trackFx
    ? studioNormalizeExclusiveVocalEngines(opts.trackFx)
    : undefined;
  let working = source;

  if (trackFx?.vocoderOn && trackFx.vocoderWet > 0.02) {
    const fallbackHz = estimateSpeechPitchHzRange(working, 0, working.duration);
    const carrierTimeline =
      opts?.carrierTracks &&
      opts.vocalTrackIndex != null &&
      opts.bpm != null &&
      opts.clipStartBeat != null &&
      opts.clipDurationBeats != null
        ? resolveVocoderCarrierTimeline(
            trackFx,
            opts.carrierTracks,
            opts.vocalTrackIndex,
            opts.clipStartBeat,
            opts.clipDurationBeats,
            opts.bpm,
            fallbackHz > 40 ? fallbackHz : 220,
          )
        : null;
    working = await renderStudioVocoderBuffer(
      working,
      studioVocoderParamsFromTrackFx(trackFx, working, {
        carrierTimeline: carrierTimeline ?? undefined,
      }),
    );
  } else if (trackFx?.autotuneOn && trackFx.autotuneStrength > 0.02) {
    const midiTargetTimeline =
      opts?.carrierTracks &&
      opts.bpm != null &&
      opts.clipStartBeat != null &&
      opts.clipDurationBeats != null
        ? resolvePitchTuneMidiTimeline(
            trackFx,
            opts.carrierTracks,
            opts.clipStartBeat,
            opts.clipDurationBeats,
            opts.bpm,
          )
        : null;
    working = await renderPitchTuneBuffer(
      working,
      pitchTuneParamsFromTrackFx(
        {
          autotuneStrength: trackFx.autotuneStrength,
          pitchRetuneMs: trackFx.pitchRetuneMs,
          pitchFlex: trackFx.pitchFlex,
          pitchHumanize: trackFx.pitchHumanize,
          pitchScaleId: trackFx.pitchScaleId,
          pitchTracking: trackFx.pitchTracking,
        },
        keyRoot,
        { midiTargetTimeline: midiTargetTimeline ?? undefined },
      ),
    );
  }

  if (!settings) return working;

  // Pitch Tune / Pro Vocoder use dedicated engines — skip legacy VocalBox color pass.
  if (trackFx && (trackFx.autotuneOn || trackFx.vocoderOn)) return working;

  const dur = Math.max(0.04, working.duration);
  const srcPitch = estimateSpeechPitchHzRange(working, 0, dur);
  const targetMidi = Math.round(hzToMidi(srcPitch));
  const renderSec = dur + 0.12;
  const frames = Math.ceil(renderSec * working.sampleRate);

  const offline = new OfflineAudioContext(
    working.numberOfChannels,
    Math.max(1, frames),
    working.sampleRate,
  );

  scheduleVocalBoxProcessedSpeech(
    offline as unknown as AudioContext,
    offline.destination,
    working,
    0,
    dur,
    targetMidi,
    0.9,
    settings,
    { micMode: true, offsetSec: 0, sliceSec: dur },
  );

  const rendered = await offline.startRendering();
  if (rendered.duration < dur * 0.5) return working;
  return rendered;
}

/** Slot-based render — used when only mixer inserts are set. */
export async function renderStudioAudioVocalFxFromSlots(
  source: AudioBuffer,
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
  opts?: { keyRoot?: number; keyMode?: StudioDetectedKeyMode; trackFx?: StudioTrackVocalFx },
): Promise<AudioBuffer> {
  return renderStudioAudioVocalFx(source, studioVocalFxSettingsFromSlots(slots), opts);
}

/** Full track vocal FX render with Pitch Tune params from panel state. */
export async function renderStudioAudioVocalFxFromTrack(
  source: AudioBuffer,
  trackFx: StudioTrackVocalFx,
  opts?: StudioVocalFxRenderOpts,
): Promise<AudioBuffer> {
  return renderStudioAudioVocalFx(source, studioVocalFxSettingsFromTrack(trackFx), {
    ...opts,
    trackFx,
  });
}

export function studioVocalFxClipCacheContext(
  fx: StudioTrackVocalFx,
  clipStartBeat: number,
  carrierTracks?: readonly StudioVocoderCarrierTrack[],
): { clipStartBeat: number; carrierNotesSig?: string } {
  const sigs: string[] = [];
  let usesMidi = false;

  const ptIdx = fx.pitchTuneMidiTrackIndex;
  if (ptIdx != null && ptIdx >= 0 && carrierTracks?.[ptIdx]) {
    usesMidi = true;
    sigs.push(`pt:${studioVocoderCarrierNotesSig(carrierTracks[ptIdx]!.notes)}`);
  }

  const vocIdx = fx.vocoderCarrierTrackIndex;
  if (vocIdx != null && vocIdx >= 0 && carrierTracks?.[vocIdx]) {
    usesMidi = true;
    sigs.push(`voc:${studioVocoderCarrierNotesSig(carrierTracks[vocIdx]!.notes)}`);
  }

  return {
    clipStartBeat: usesMidi ? clipStartBeat : 0,
    carrierNotesSig: sigs.length > 0 ? sigs.join('|') : 'na',
  };
}
