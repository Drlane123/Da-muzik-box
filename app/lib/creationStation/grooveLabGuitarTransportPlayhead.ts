/**
 * Guitar lick transport — fires on playhead slot crossing.
 * Uses the same audio path as GUITAR ▾ / roll key preview (`runWithGrooveLabAudio`).
 */
import { playGrooveLabGuitarNoteScheduled } from '@/app/lib/creationStation/grooveLabGuitarAudition';
import { isGuitarLickSampleId } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import { resumeGrooveLabAudioContext } from '@/app/lib/creationStation/grooveLabAudio';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';
import type { GrooveLabGuitarFxSettings } from '@/app/lib/creationStation/grooveLabGuitarFx';
import { resolveGrooveLabGuitarSoundId } from '@/app/lib/creationStation/grooveLabGuitarSoundBank';
import type { GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

export function grooveLabCrossedRollSlot(
  prevSlot: number,
  currSlot: number,
  hitSlot: number,
  loopSlots: number,
): boolean {
  if (loopSlots <= 0) return false;
  const prev = prevSlot;
  const curr = Math.max(0, currSlot);
  const hit = Math.max(0, Math.floor(hitSlot));
  if (curr < prev) {
    return hit <= curr || hit > prev;
  }
  return prev < hit && curr >= hit;
}

/** One slot before `origin` so bar-0 licks fire when Play starts at the top. */
export function grooveLabGuitarPlayheadPrevSlot(origin: number): number {
  const o = Math.max(0, Math.floor(origin));
  return o > 0 ? o - 1 : -1;
}

/** Audio-grid time for a roll slot in `cycle` (same formula as `refillGrooveLabTransport`). */
export function grooveLabGuitarWhenAtHit(
  sessionStart: number,
  originSlot: number,
  hitSlot: number,
  cycle: number,
  loopSlots: number,
  secPerSlot: number,
): number {
  const loopSec = Math.max(secPerSlot, loopSlots * secPerSlot);
  const origin = Math.max(0, Math.floor(originSlot));
  const slot = Math.max(0, Math.floor(hitSlot));
  const delta = (slot - origin + loopSlots) % Math.max(1, loopSlots);
  return sessionStart + cycle * loopSec + delta * secPerSlot;
}

export type GrooveLabGuitarPlayheadFireOpts = {
  bpm: number;
  sessionStart: number;
  originSlot: number;
  guitarSoundId?: string | null;
  guitarFx?: GrooveLabGuitarFxSettings;
  guitarChannel: number;
  channelVolumes?: Record<number, number>;
  loopSlots: number;
  secPerSlot: number;
};

export function fireGrooveLabGuitarOnPlayheadCrossing(
  getAudioContext: () => AudioContext,
  prevSlot: number,
  currSlot: number,
  hits: readonly GrooveRollHit[],
  firedKeys: Set<string>,
  cycle: number,
  opts: GrooveLabGuitarPlayheadFireOpts,
): void {
  if (hits.length === 0) return;
  const gSound = resolveGrooveLabGuitarSoundId(opts.guitarSoundId);
  const lickBar = isGuitarLickSampleId(gSound);

  for (const hit of hits) {
    if (!grooveLabCrossedRollSlot(prevSlot, currSlot, hit.slot, opts.loopSlots)) continue;
    const key = `${cycle}|g|${hit.slot}|${Math.round(hit.midi)}`;
    if (firedKeys.has(key)) continue;

    const sustainSec = lickBar
      ? Math.min(8, Math.max(0.45, hit.sustainSlots * opts.secPerSlot * 0.98))
      : Math.min(2.8, Math.max(0.28, hit.sustainSlots * opts.secPerSlot * 0.96));

    let ctx: AudioContext;
    try {
      ctx = getAudioContext();
    } catch {
      return;
    }
    if (ctx.state === 'closed') return;
    resumeGrooveLabAudioContext(ctx);
    const gridWhen = grooveLabGuitarWhenAtHit(
      opts.sessionStart,
      opts.originSlot,
      hit.slot,
      cycle,
      opts.loopSlots,
      opts.secPerSlot,
    );
    const when = Math.max(gridWhen, ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC);
    const played = playGrooveLabGuitarNoteScheduled(ctx, {
      midi: hit.midi,
      soundId: gSound,
      when,
      velocity01: Math.min(1, Math.max(0.05, hit.vel)) * 0.9,
      bpm: opts.bpm,
      sustainSec,
      guitarFx: opts.guitarFx,
      guitarChannel: opts.guitarChannel,
      channelVolumes: opts.channelVolumes,
      route: 'channel',
    });
    if (played) firedKeys.add(key);
  }
}
