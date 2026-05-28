/**
 * Schedule voiced chords through arp + FX-aware playback path.
 */

import type { ChordInstrument } from '@/app/lib/creationStation/chordInstruments';
import { buildChordArpHits, type ChordArpSettings } from '@/app/lib/creationStation/chordArpeggiator';
import {
  delayTapOffsetsSec,
  type ChordBuilderFxSettings,
} from '@/app/lib/creationStation/chordBuilderFx';

export function scheduleVoicedChordPlayback(
  instrument: ChordInstrument,
  ctx: BaseAudioContext,
  destination: AudioNode,
  midis: ReadonlyArray<number>,
  startTime: number,
  sustainSec: number,
  bpm: number,
  arp: ChordArpSettings,
  fx: ChordBuilderFxSettings,
  options?: {
    minStartTime?: number;
    gainCollector?: GainNode[];
    delayVelocityScale?: number;
  },
): number[] {
  const floor = options?.minStartTime ?? startTime;
  const hits = buildChordArpHits(midis, startTime, sustainSec, bpm, arp);
  const delayTaps = delayTapOffsetsSec(fx.delay);
  const wet = fx.delay.enabled ? Math.max(0, Math.min(1, fx.delay.mix)) : 0;
  const sounded = new Set<number>();

  for (const hit of hits) {
    const t = Math.max(hit.startTime, floor);
    const envs = instrument.scheduleNote({
      ctx,
      destination,
      midi: hit.midi,
      startTime: t,
      sustainSec: hit.sustainSec,
      velocity: hit.velocity,
    });
    sounded.add(hit.midi);
    options?.gainCollector?.push(...envs);

    for (const off of delayTaps) {
      const envs2 = instrument.scheduleNote({
        ctx,
        destination,
        midi: hit.midi,
        startTime: t + off,
        sustainSec: Math.max(0.06, hit.sustainSec - off * 0.5),
        velocity: hit.velocity * wet * (options?.delayVelocityScale ?? 0.55),
      });
      options?.gainCollector?.push(...envs2);
    }
  }

  return [...sounded];
}
