/**
 * SE2 transport — schedule 808 Lab tone step grid (one track, 16 chromatic 808 lanes).
 */
import {
  SE2_LAB808_TONE_GRID_LANES,
  normalizeSe2Lab808ToneGridPattern,
  se2Lab808NormalizeToneGridLoopBars,
  se2Lab808ToneGridHasHits,
  se2Lab808ToneGridStepCount,
  se2Lab808ToneMidiForLane,
  type Se2Lab808ToneGridPattern,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import { scheduleSe2Lab808Note } from '@/app/lib/studio/se2Lab808Preview';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';

export function refillSe2Lab808DrumOnTransport(args: {
  ctx: AudioContext;
  ctSnap: number;
  horizon: number;
  chainFloor: number;
  trackId: string;
  voice: Se2Lab808VoiceParams;
  toneGridSteps: Se2Lab808ToneGridPattern;
  stripIn: AudioNode;
  originBeat: number;
  sessionStart: number;
  spb: number;
  bpm: number;
  beatsPerBar: number;
  trackVolume127: number;
  scheduled: Set<string>;
}): void {
  const {
    ctx,
    ctSnap,
    horizon,
    chainFloor,
    trackId,
    voice,
    toneGridSteps,
    stripIn,
    originBeat,
    sessionStart,
    spb,
    bpm,
    beatsPerBar,
    scheduled,
  } = args;

  const pattern = normalizeSe2Lab808ToneGridPattern(
    toneGridSteps,
    se2Lab808NormalizeToneGridLoopBars(voice.toneGridLoopBars),
  );
  if (!se2Lab808ToneGridHasHits(pattern)) return;

  const loopBars = se2Lab808NormalizeToneGridLoopBars(voice.toneGridLoopBars);
  const totalSteps = se2Lab808ToneGridStepCount(loopBars);
  const loopBeats = loopBars * beatsPerBar;
  const stepBeats = loopBeats / totalSteps;
  const beatNow = originBeat + Math.max(0, ctSnap - sessionStart) / spb;
  const isKick = voice.soundLane === 'kick';
  const holdBeats = Math.max(0.2, stepBeats * (isKick ? 0.85 : 1.1));
  const velocity = Math.max(1, Math.round(100 * voice.toneGridLevel * voice.output));

  const startK = Math.floor((beatNow - 0.25) / stepBeats);
  const endK = Math.ceil((beatNow + (horizon - ctSnap) / spb) / stepBeats);

  for (let k = startK; k <= endK; k += 1) {
    const col = ((k % totalSteps) + totalSteps) % totalSteps;
    const loopIdx = Math.floor(k / totalSteps);
    const beatAt = loopIdx * loopBeats + col * stepBeats;
    const when = sessionStart + (beatAt - originBeat) * spb;
    const tEnd = when + holdBeats * spb;
    if (when < ctSnap + chainFloor || when > horizon) continue;

    for (let lane = 0; lane < SE2_LAB808_TONE_GRID_LANES; lane += 1) {
      if (!pattern[lane]?.[col]) continue;
      const key = `lab808:${trackId}:tone:${k}:${lane}`;
      if (scheduled.has(key)) continue;
      scheduled.add(key);
      const midi = se2Lab808ToneMidiForLane(voice.tonePadBaseMidi, lane);
      scheduleSe2Lab808Note(ctx, stripIn, when, tEnd, midi, velocity, voice, bpm);
    }
  }
}
