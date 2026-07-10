/**

 * Studio Editor 2 — per audio-lane vocal FX (Pitch Tune + Vocoder).

 */



import type { VocalBoxSettings } from '@/app/lib/creationStation/grooveLabVocalBoxEngine';

import { VOCALBOX_DEFAULT_SETTINGS } from '@/app/lib/creationStation/grooveLabVocalBoxEngine';

import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';

import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';

import {

  studioAutotunePresetById,

  type StudioAutotunePresetId,

} from '@/app/lib/studio/studioAutotunePresets';

import {

  studioVocoderPresetById,

  type StudioVocoderPresetId,

} from '@/app/lib/studio/studioVocoderPresets';

import type { PitchTuneScaleId } from '@/app/lib/studio/studioPitchTune';



export type StudioTrackVocalFx = {

  autotuneOn: boolean;

  vocoderOn: boolean;

  autotunePreset: StudioAutotunePresetId;

  /** 0–1 Pitch Tune correction strength */

  autotuneStrength: number;

  /** Pitch Tune retune speed (ms) — 0 = hard robot, 25–45 natural */

  pitchRetuneMs: number;

  /** 0–1 Flex-Tune — keep intentional bends */

  pitchFlex: number;

  /** 0–1 Humanize — slower pull on held notes */

  pitchHumanize: number;

  pitchScaleId: PitchTuneScaleId;

  /** 0–1 pitch tracking sensitivity */

  pitchTracking: number;

  /** MIDI lane index for Pitch Tune target (`null` = scale / key only) */

  pitchTuneMidiTrackIndex: number | null;

  /** 0–1 wet vocoder blend (dry vocal vs processed) */

  vocoderWet: number;

  /** 0–1 robot / synth character inside the vocoder */

  vocoderRobot: number;

  vocoderPreset: StudioVocoderPresetId;

  /** 0–1 natural vibrato on vocoder carrier */

  vibratoDepth: number;

  /** Formant shift semitones (−6 … +6) */

  vocoderFormantSemis: number;

  /** Envelope attack ms */

  vocoderAttackMs: number;

  /** Envelope release ms */

  vocoderReleaseMs: number;

  /** Unvoiced / consonant noise (0–1) */

  vocoderUnvoiced: number;

  /** Band tilt 0 warm · 1 bright */

  vocoderBandFocus: number;

  /** MIDI lane index for carrier pitch (`null` = detected vocal pitch) */

  vocoderCarrierTrackIndex: number | null;

};



export const STUDIO_TRACK_VOCAL_FX_DEFAULT: StudioTrackVocalFx = {

  autotuneOn: false,

  vocoderOn: false,

  autotunePreset: 'tpain',

  autotuneStrength: 0.92,

  pitchRetuneMs: 8,

  pitchFlex: 0.12,

  pitchHumanize: 0.18,

  pitchScaleId: 'minor',

  pitchTracking: 0.5,

  pitchTuneMidiTrackIndex: null,

  vocoderWet: 0.78,

  vocoderRobot: 0.72,

  vocoderPreset: 'robot',

  vibratoDepth: 0.16,

  vocoderFormantSemis: 0,

  vocoderAttackMs: 12,

  vocoderReleaseMs: 85,

  vocoderUnvoiced: 0.35,

  vocoderBandFocus: 0.5,

  vocoderCarrierTrackIndex: null,

};



/** Back-compat when older state only stored `vocoderMix`. */

export function studioNormalizeTrackVocalFx(fx: Partial<StudioTrackVocalFx> & { vocoderMix?: number }): StudioTrackVocalFx {

  const base = { ...STUDIO_TRACK_VOCAL_FX_DEFAULT, ...fx };

  if (fx.vocoderWet == null && fx.vocoderMix != null) {

    base.vocoderWet = fx.vocoderMix;

  }

  if (fx.vocoderRobot == null && fx.vocoderMix != null) {

    base.vocoderRobot = Math.min(1, fx.vocoderMix * 0.88);

  }

  if (fx.pitchRetuneMs == null) base.pitchRetuneMs = STUDIO_TRACK_VOCAL_FX_DEFAULT.pitchRetuneMs;

  if (fx.pitchFlex == null) base.pitchFlex = STUDIO_TRACK_VOCAL_FX_DEFAULT.pitchFlex;

  if (fx.pitchHumanize == null) {

    base.pitchHumanize =

      fx.vibratoDepth != null && fx.pitchHumanize == null

        ? Math.min(1, fx.vibratoDepth * 0.85)

        : STUDIO_TRACK_VOCAL_FX_DEFAULT.pitchHumanize;

  }

  if (fx.pitchScaleId == null) base.pitchScaleId = STUDIO_TRACK_VOCAL_FX_DEFAULT.pitchScaleId;

  if (fx.pitchTracking == null) base.pitchTracking = STUDIO_TRACK_VOCAL_FX_DEFAULT.pitchTracking;

  if (fx.pitchTuneMidiTrackIndex === undefined) {
    base.pitchTuneMidiTrackIndex = STUDIO_TRACK_VOCAL_FX_DEFAULT.pitchTuneMidiTrackIndex;
  }

  if (fx.vocoderFormantSemis == null) base.vocoderFormantSemis = STUDIO_TRACK_VOCAL_FX_DEFAULT.vocoderFormantSemis;

  if (fx.vocoderAttackMs == null) base.vocoderAttackMs = STUDIO_TRACK_VOCAL_FX_DEFAULT.vocoderAttackMs;

  if (fx.vocoderReleaseMs == null) base.vocoderReleaseMs = STUDIO_TRACK_VOCAL_FX_DEFAULT.vocoderReleaseMs;

  if (fx.vocoderUnvoiced == null) base.vocoderUnvoiced = STUDIO_TRACK_VOCAL_FX_DEFAULT.vocoderUnvoiced;

  if (fx.vocoderBandFocus == null) base.vocoderBandFocus = STUDIO_TRACK_VOCAL_FX_DEFAULT.vocoderBandFocus;

  if (fx.vocoderCarrierTrackIndex === undefined) {
    base.vocoderCarrierTrackIndex = STUDIO_TRACK_VOCAL_FX_DEFAULT.vocoderCarrierTrackIndex;
  }

  return base;

}



export function studioTrackVocalFxActive(fx: StudioTrackVocalFx): boolean {

  return fx.autotuneOn || fx.vocoderOn;

}



export function studioVocalFxSettingsFromTrack(fx: StudioTrackVocalFx): VocalBoxSettings | null {

  if (!studioTrackVocalFxActive(fx)) return null;

  const vocPreset = studioVocoderPresetById(fx.vocoderPreset);

  const tunePreset = studioAutotunePresetById(fx.autotunePreset);

  const tuneAmt = fx.autotuneOn ? Math.min(0.35, fx.autotuneStrength * 0.22) : 0.12;

  const robotAmt = fx.vocoderOn ? fx.vocoderRobot : fx.autotuneOn ? 0.18 : 0.08;

  const wet = fx.vocoderOn ? fx.vocoderWet : 0;

  const dry = fx.vocoderOn ? Math.max(0, 1 - fx.vocoderWet) : 1;

  return {

    ...VOCALBOX_DEFAULT_SETTINGS,

    autotuneStrength: tuneAmt,

    robotMix: robotAmt,

    vocoderWet: wet,

    dryMix: dry,

    vibratoDepth: fx.vibratoDepth,

    style: fx.vocoderOn ? vocPreset.style : fx.autotuneOn ? tunePreset.style : tunePreset.style,

    personality: fx.vocoderOn ? vocPreset.personality : 'warm',

    mode: vocPreset.mode,

  };

}



export function studioVocalFxCacheKeyFromTrack(

  sourceId: string,

  fx: StudioTrackVocalFx,

  keyRoot: number,

  keyMode: StudioDetectedKeyMode,

  clipCtx?: {

    clipStartBeat: number;

    carrierNotesSig?: string;

  },

): string {

  return [

    sourceId,

    fx.autotuneOn ? '1' : '0',

    fx.vocoderOn ? '1' : '0',

    fx.autotunePreset,

    fx.autotuneStrength.toFixed(3),

    fx.pitchRetuneMs.toFixed(1),

    fx.pitchFlex.toFixed(3),

    fx.pitchHumanize.toFixed(3),

    fx.pitchScaleId,

    fx.pitchTracking.toFixed(3),

    fx.pitchTuneMidiTrackIndex ?? 'scale',

    fx.vocoderWet.toFixed(3),

    fx.vocoderRobot.toFixed(3),

    fx.vocoderPreset,

    fx.vibratoDepth.toFixed(3),

    fx.vocoderFormantSemis.toFixed(2),

    fx.vocoderAttackMs.toFixed(1),

    fx.vocoderReleaseMs.toFixed(1),

    fx.vocoderUnvoiced.toFixed(3),

    fx.vocoderBandFocus.toFixed(3),

    fx.vocoderCarrierTrackIndex ?? 'voice',

    clipCtx?.clipStartBeat?.toFixed(3) ?? '0',

    clipCtx?.carrierNotesSig ?? 'na',

    keyRoot,

    keyMode,

    'vc4',

  ].join('|');

}



/** Mixer inserts can arm Pitch Tune / Vocoder; track panel holds the detailed settings. */

export function studioEffectiveTrackVocalFx(

  fx: StudioTrackVocalFx,

  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],

): StudioTrackVocalFx {

  const autotuneOn = fx.autotuneOn || slots.includes('autotune');

  const vocoderOn = fx.vocoderOn || slots.includes('vocoder');

  if (autotuneOn === fx.autotuneOn && vocoderOn === fx.vocoderOn) return fx;

  return { ...fx, autotuneOn, vocoderOn };

}

/** True when mixer slot + panel combo changed enough to rebuild the live vocal graph. */
export function studioVocalFxEffectiveNeedsLiveReconnect(
  prevFx: StudioTrackVocalFx,
  nextFx: StudioTrackVocalFx,
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
): boolean {
  const prev = studioEffectiveTrackVocalFx(prevFx, slots);
  const next = studioEffectiveTrackVocalFx(nextFx, slots);
  return prev.autotuneOn !== next.autotuneOn || prev.vocoderOn !== next.vocoderOn;
}

/** After Audio→MIDI conversion, route Pitch Tune + Vocoder to this lane's notes. */
export function studioWireA2mPitchRouteOnTrack(
  fx: StudioTrackVocalFx,
  trackIndex: number,
): StudioTrackVocalFx {
  return {
    ...fx,
    pitchTuneMidiTrackIndex: trackIndex,
    vocoderCarrierTrackIndex: trackIndex,
  };
}


