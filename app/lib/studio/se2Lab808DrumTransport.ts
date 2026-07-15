/**
 * SE2 transport — schedule 808 Lab tone step grid (one track, 16 chromatic 808 lanes).
 * Consecutive ON steps coalesce into one sustained note (held hum / bass).
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
import {
  se2Lab808ToneGridIsRunStart,
  se2Lab808ToneGridRunLengthFrom,
  se2Lab808ToneGridRunStartCol,
} from '@/app/lib/studio/se2Lab808ToneGridRuns';
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
  const velocity = Math.max(1, Math.round(100 * voice.toneGridLevel * voice.output));
  const floor = ctSnap + chainFloor;

  const startK = Math.floor((beatNow - 0.25) / stepBeats);
  const endK = Math.ceil((beatNow + (horizon - ctSnap) / spb) / stepBeats);

  for (let k = startK; k <= endK; k += 1) {
    const col = ((k % totalSteps) + totalSteps) % totalSteps;
    const loopIdx = Math.floor(k / totalSteps);

    for (let lane = 0; lane < SE2_LAB808_TONE_GRID_LANES; lane += 1) {
      if (!pattern[lane]?.[col]) continue;

      const runStartCol = se2Lab808ToneGridRunStartCol(pattern, lane, col);
      const stepsIntoRun = col - runStartCol;
      const runLen = se2Lab808ToneGridRunLengthFrom(pattern, lane, runStartCol, totalSteps);
      const remainLen = Math.max(1, runLen - stepsIntoRun);
      const runStartK = k - stepsIntoRun;
      const runStartBeat = loopIdx * loopBeats + runStartCol * stepBeats;
      const runStartWhen = sessionStart + (runStartBeat - originBeat) * spb;
      const isStart = se2Lab808ToneGridIsRunStart(pattern, lane, col);

      // Kick one-shots stay punchy unless the grid paints a held run (2+ steps).
      const holdSteps = !isKick || runLen >= 2 ? remainLen : 1;
      const holdBeats = Math.max(0.2, holdSteps * stepBeats * (isKick && runLen < 2 ? 0.85 : 1));

      let when: number;
      let schedKey: string;
      let hold = holdBeats;
      const colWhen = sessionStart + (loopIdx * loopBeats + col * stepBeats - originBeat) * spb;

      if (isStart && runStartWhen >= floor) {
        when = runStartWhen;
        schedKey = `lab808:${trackId}:tone:${runStartK}:${lane}`;
      } else if (!isStart && runStartWhen >= floor) {
        // Run attack is still ahead — it will schedule on its own column.
        continue;
      } else {
        // Attack already passed the schedule floor — catch up remaining sustain once.
        when = Math.max(floor, colWhen);
        const idealEnd = colWhen + holdBeats * spb;
        hold = Math.max(0.2, (idealEnd - when) / spb);
        schedKey = `lab808:${trackId}:tone:hold:${runStartK}:${lane}`;
        // Only the first visible column of this run should catch up.
        if (!isStart && k > startK) {
          const prevCol = ((k - 1) % totalSteps + totalSteps) % totalSteps;
          if (pattern[lane]?.[prevCol]) continue;
        }
      }

      if (when > horizon) continue;
      if (scheduled.has(schedKey)) continue;
      scheduled.add(schedKey);

      const tEnd = when + hold * spb;
      const midi = se2Lab808ToneMidiForLane(voice.tonePadBaseMidi, lane);
      scheduleSe2Lab808Note(ctx, stripIn, when, tEnd, midi, velocity, voice, bpm);
    }
  }
}
