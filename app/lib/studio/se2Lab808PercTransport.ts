/**
 * SE2 transport / local preview — schedule 1-bar snare+clap repeating every bar.
 */
import {
  SE2_LAB808_PERC_STEPS_PER_BAR,
  normalizeSe2Lab808PercPattern,
  se2Lab808PercHasHits,
} from '@/app/lib/studio/se2Lab808PercPattern';
import { playSe2Lab808Clap, playSe2Lab808Snare } from '@/app/lib/studio/se2Lab808PercVoice';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';

export function refillSe2Lab808PercOnTransport(args: {
  ctx: AudioContext;
  ctSnap: number;
  horizon: number;
  chainFloor: number;
  trackId: string;
  voice: Se2Lab808VoiceParams;
  stripIn: AudioNode;
  originBeat: number;
  sessionStart: number;
  spb: number;
  beatsPerBar: number;
  scheduled: Set<string>;
}): void {
  const {
    ctx,
    ctSnap,
    horizon,
    chainFloor,
    trackId,
    voice,
    stripIn,
    originBeat,
    sessionStart,
    spb,
    beatsPerBar,
    scheduled,
  } = args;

  const pattern = normalizeSe2Lab808PercPattern(voice.percSnareSteps, voice.percClapSteps);
  if (!se2Lab808PercHasHits(pattern)) return;

  const bpb = Math.max(1, beatsPerBar);
  const stepBeats = bpb / SE2_LAB808_PERC_STEPS_PER_BAR;
  const beatNow = originBeat + Math.max(0, ctSnap - sessionStart) / spb;
  const velocity = Math.max(0.08, Math.min(1.2, voice.percLevel * voice.output));

  const startK = Math.floor((beatNow - 0.25) / stepBeats);
  const endK = Math.ceil((beatNow + (horizon - ctSnap) / spb) / stepBeats);

  for (let k = startK; k <= endK; k += 1) {
    const step = ((k % SE2_LAB808_PERC_STEPS_PER_BAR) + SE2_LAB808_PERC_STEPS_PER_BAR) % SE2_LAB808_PERC_STEPS_PER_BAR;
    const when = sessionStart + (k * stepBeats - originBeat) * spb;
    if (when < ctSnap + chainFloor || when > horizon) continue;

    if (pattern.snare[step]) {
      const key = `lab808:${trackId}:perc:snare:${k}`;
      if (!scheduled.has(key)) {
        scheduled.add(key);
        playSe2Lab808Snare(ctx, stripIn, when, velocity);
      }
    }
    if (pattern.clap[step]) {
      const key = `lab808:${trackId}:perc:clap:${k}`;
      if (!scheduled.has(key)) {
        scheduled.add(key);
        playSe2Lab808Clap(ctx, stripIn, when, velocity * 0.95);
      }
    }
  }
}
