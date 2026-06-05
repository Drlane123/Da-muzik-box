import {
  resolveGrooveLabAudioDest,
  resolveGrooveLabChannelDest,
  resumeGrooveLabAudioContext,
  runWithGrooveLabAudio,
} from '@/app/lib/creationStation/grooveLabAudio';
import {
  grooveLabMeterPeakFromVelocity,
  scheduleGrooveLabMeterPulseAt,
} from '@/app/lib/creationStation/grooveLabChannelMeters';
import { grooveLabClampGuitarMidi } from '@/app/lib/creationStation/grooveLabPitch';
import { resolveGrooveLabGuitarSoundId } from '@/app/lib/creationStation/grooveLabGuitarSoundBank';
import type { GrooveLabAnyLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadSounds';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';
import {
  ensureGuitarLickBuffer,
  getGuitarLickDef,
  grooveLabGuitarBarSec,
  type GuitarLickId,
} from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import {
  GROOVE_LAB_GUITAR_FX_DEFAULTS,
  mergeGuitarPlaybackFx,
  type GrooveLabGuitarFxSettings,
} from '@/app/lib/creationStation/grooveLabGuitarFx';
import { GROOVE_LAB_GUITAR_MONO_GROUP } from '@/app/lib/creationStation/grooveLabLeadMono';
import { playGrooveLabLeadSound } from '@/app/lib/creationStation/grooveLabLeadSounds';

export type AuditionGrooveLabGuitarResult = 'played' | 'no-ctx';

export type PlayGrooveLabGuitarNoteOpts = {
  midi: number;
  soundId: GrooveLabAnyLeadSoundId | string;
  when: number;
  velocity01?: number;
  bpm: number;
  sustainSec: number;
  guitarFx?: GrooveLabGuitarFxSettings;
  guitarChannel?: number;
  channelVolumes?: Record<number, number>;
  /** Channel strip (default when guitarChannel set). Master = debug / export only. */
  route?: 'master' | 'channel';
};

function resolveGuitarNoteDest(ctx: AudioContext, opts: PlayGrooveLabGuitarNoteOpts): AudioNode {
  const ch = opts.guitarChannel;
  const useChannel =
    opts.route !== 'master' && ch != null && Number.isFinite(ch);
  if (useChannel) {
    return resolveGrooveLabChannelDest(ctx, ch!, opts.channelVolumes);
  }
  return resolveGrooveLabAudioDest(ctx);
}

function defaultGuitarRoute(opts: {
  route?: 'master' | 'channel';
  guitarChannel?: number;
}): 'master' | 'channel' {
  if (opts.route) return opts.route;
  return opts.guitarChannel != null && Number.isFinite(opts.guitarChannel) ? 'channel' : 'master';
}

/**
 * Schedule one guitar hit. Returns false if the context is not running (no fake meter).
 * Caller must preload lick buffers before transport/preview when possible.
 */
export function playGrooveLabGuitarNoteScheduled(
  ctx: AudioContext,
  opts: PlayGrooveLabGuitarNoteOpts,
): boolean {
  if (ctx.state === 'closed') return false;
  const soundId = resolveGrooveLabGuitarSoundId(opts.soundId);
  const midi = grooveLabClampGuitarMidi(opts.midi);
  const sustainSec = Math.max(0.12, opts.sustainSec);
  const holdBeats = Math.max(0.35, sustainSec * (opts.bpm / 60));
  const playFx = mergeGuitarPlaybackFx(soundId, sustainSec, opts.guitarFx ?? GROOVE_LAB_GUITAR_FX_DEFAULTS);
  const at = Math.max(opts.when, ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC);
  const dest = resolveGuitarNoteDest(ctx, { ...opts, route: defaultGuitarRoute(opts) });
  const vel = opts.velocity01 ?? 0.88;
  resumeGrooveLabAudioContext(ctx);
  const played = playGrooveLabLeadSound(ctx, midi, soundId, at, vel, opts.bpm, holdBeats, {
    ...playFx,
    outputNode: dest,
    transportClean: false,
    monoGroup: GROOVE_LAB_GUITAR_MONO_GROUP,
    maxSustainSec: sustainSec,
  });
  if (played && opts.guitarChannel != null && Number.isFinite(opts.guitarChannel)) {
    scheduleGrooveLabMeterPulseAt(
      ctx,
      opts.guitarChannel,
      grooveLabMeterPeakFromVelocity(vel, opts.guitarChannel, opts.channelVolumes),
      0,
      at,
    );
  }
  return played;
}

export type ScheduleGrooveLabGuitarTransportHitOpts = {
  midi: number;
  soundId: GrooveLabAnyLeadSoundId | string;
  when: number;
  velocity01?: number;
  bpm: number;
  sustainSec: number;
  guitarFx?: GrooveLabGuitarFxSettings;
  guitarChannel: number;
  channelVolumes?: Record<number, number>;
};

/**
 * Transport playhead — same voice path as GUITAR ▾ bank preview, routed through the
 * GUITAR channel strip (CH 33–48) so the line mixer matches chords / Groove Lead.
 */
export function scheduleGrooveLabGuitarTransportHit(
  ctx: AudioContext,
  opts: ScheduleGrooveLabGuitarTransportHitOpts,
): boolean {
  if (ctx.state === 'closed') return false;
  const soundId = resolveGrooveLabGuitarSoundId(opts.soundId);
  const midi = grooveLabClampGuitarMidi(opts.midi);
  const sustainSec = Math.max(0.12, opts.sustainSec);
  const holdBeats = Math.max(0.35, sustainSec * (opts.bpm / 60));
  const playFx = mergeGuitarPlaybackFx(soundId, sustainSec, opts.guitarFx ?? GROOVE_LAB_GUITAR_FX_DEFAULTS);
  const now = ctx.currentTime;
  const at = opts.when >= now - 0.002 ? opts.when : Math.max(opts.when, now + 0.001);
  const vel = opts.velocity01 ?? 0.88;
  const dest = resolveGrooveLabChannelDest(ctx, opts.guitarChannel, opts.channelVolumes);
  resumeGrooveLabAudioContext(ctx);
  const played = playGrooveLabLeadSound(ctx, midi, soundId, at, vel, opts.bpm, holdBeats, {
    ...playFx,
    outputNode: dest,
    transportClean: false,
    monoGroup: GROOVE_LAB_GUITAR_MONO_GROUP,
    maxSustainSec: sustainSec,
  });
  if (played) {
    scheduleGrooveLabMeterPulseAt(
      ctx,
      opts.guitarChannel,
      grooveLabMeterPeakFromVelocity(vel, opts.guitarChannel, opts.channelVolumes),
      0,
      at,
    );
  }
  return played;
}

/** Piano-roll — same unlock/play path as chord preview (`runWithGrooveLabAudio`). */
export function previewGrooveLabGuitarRollNote(
  getAudioContext: () => AudioContext | null,
  opts: Omit<PlayGrooveLabGuitarNoteOpts, 'when'> & { bars?: number },
): void {
  if (!getAudioContext) return;
  const soundId = resolveGrooveLabGuitarSoundId(opts.soundId);
  const bars =
    opts.bars ??
    Math.max(0.25, opts.sustainSec / Math.max(0.01, grooveLabGuitarBarSec(opts.bpm, 1)));
  const sustainSec = grooveLabGuitarBarSec(opts.bpm, bars);
  const vel = opts.velocity01 ?? 0.88;
  try {
    runWithGrooveLabAudio(getAudioContext, (ctx, when) => {
      playGrooveLabGuitarNoteScheduled(ctx, {
        midi: opts.midi,
        soundId,
        when,
        velocity01: vel,
        bpm: opts.bpm,
        sustainSec,
        guitarFx: opts.guitarFx,
        guitarChannel: opts.guitarChannel,
        channelVolumes: opts.channelVolumes,
        route: defaultGuitarRoute(opts),
      });
    });
    const def = getGuitarLickDef(soundId);
    if (def) void ensureGuitarLickBuffer(getAudioContext(), def);
  } catch {
    /* */
  }
}

export type AuditionGrooveLabGuitarOpts = {
  getAudioContext?: () => AudioContext | null;
  lickId: GuitarLickId;
  targetMidi: number;
  bpm: number;
  bars?: number;
  velocity01?: number;
  route?: 'master' | 'channel';
  guitarChannel?: number;
  channelVolumes?: Record<number, number>;
  guitarFx?: GrooveLabGuitarFxSettings;
};

/** GUITAR ▾ bank preview — chord-style `runWithGrooveLabAudio` + synth fallback if sample missing. */
export async function auditionGrooveLabGuitarLick(
  opts: AuditionGrooveLabGuitarOpts,
): Promise<AuditionGrooveLabGuitarResult> {
  const rawGet = opts.getAudioContext;
  if (!rawGet) return 'no-ctx';
  try {
    previewGrooveLabGuitarRollNote(rawGet, {
      midi: opts.targetMidi,
      soundId: opts.lickId,
      velocity01: opts.velocity01 ?? 0.92,
      bpm: opts.bpm,
      bars: opts.bars ?? 1,
      guitarFx: opts.guitarFx,
      guitarChannel: opts.guitarChannel,
      channelVolumes: opts.channelVolumes,
      route: defaultGuitarRoute(opts),
    });
    return 'played';
  } catch {
    return 'no-ctx';
  }
}
