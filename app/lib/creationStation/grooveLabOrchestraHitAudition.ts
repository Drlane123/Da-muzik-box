import {
  resolveGrooveLabChannelDest,
  resumeGrooveLabAudioContext,
} from '@/app/lib/creationStation/grooveLabAudio';
import {
  grooveLabMeterPeakFromVelocity,
  scheduleGrooveLabMeterPulseAt,
} from '@/app/lib/creationStation/grooveLabChannelMeters';
import { resolveGrooveLabOrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitSoundBank';
import {
  ensureOrchestraHitBuffer,
  getOrchestraHitDef,
  playOrchestraHitSample,
  type OrchestraHitId,
} from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import { playGrooveLabLeadSound } from '@/app/lib/creationStation/grooveLabLeadSounds';
import type { GrooveLabLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadVoices';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

export type PlayGrooveLabOrchestraHitOpts = {
  hitId: OrchestraHitId | string;
  when: number;
  velocity01?: number;
  orchestraChannel: number;
  channelVolumes?: Record<number, number>;
  /** Roll / chord MIDI — pitch-shifts the sample (same idea as guitar licks). */
  targetMidi?: number;
};

export function scheduleGrooveLabOrchestraTransportHit(
  ctx: AudioContext,
  opts: PlayGrooveLabOrchestraHitOpts,
): void {
  if (ctx.state === 'closed') return;
  const hitId = resolveGrooveLabOrchestraHitId(opts.hitId);
  const def = getOrchestraHitDef(hitId);
  if (!def) return;

  const at = Math.max(opts.when, ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC);
  const vel = opts.velocity01 ?? 0.9;
  const dest = resolveGrooveLabChannelDest(ctx, opts.orchestraChannel, opts.channelVolumes);
  resumeGrooveLabAudioContext(ctx);
  const targetMidi =
    opts.targetMidi != null && Number.isFinite(opts.targetMidi)
      ? Math.round(opts.targetMidi)
      : undefined;

  void ensureOrchestraHitBuffer(ctx, def).then(() => {
    const played = playOrchestraHitSample(ctx, def, at, vel, {
      outputNode: dest,
      nativePitch: targetMidi == null,
      targetMidi: targetMidi ?? def.rootMidi,
    });
    if (!played) {
      const fallback = def.fallbackSynth as GrooveLabLeadSoundId;
      const midi = targetMidi ?? def.rootMidi;
      playGrooveLabLeadSound(ctx, midi, fallback, at, vel, 120, 1.1, {
        pitchRegister: 'melody',
        monophonic: false,
        transportClean: true,
        maxSustainSec: 1.2,
        outputNode: dest,
      });
    }
    scheduleGrooveLabMeterPulseAt(
      ctx,
      opts.orchestraChannel,
      grooveLabMeterPeakFromVelocity(vel, opts.orchestraChannel, opts.channelVolumes),
      0,
      at,
    );
  });
}

/** Preview one orchestra hit (UI pick / dropdown). */
export function auditionGrooveLabOrchestraHit(
  ctx: AudioContext,
  hitId: OrchestraHitId | string,
  orchestraChannel: number,
  channelVolumes?: Record<number, number>,
  targetMidi?: number,
): void {
  scheduleGrooveLabOrchestraTransportHit(ctx, {
    hitId,
    when: ctx.currentTime,
    velocity01: 0.95,
    orchestraChannel,
    channelVolumes,
    targetMidi,
  });
}
