/**
 * Beat Pads ORCH hits — schedule piano-grid hits on the Beat Pads / SE2 clock.
 */
import {
  ensureOrchestraHitBuffer,
  getOrchestraHitDef,
  playOrchestraHitSample,
} from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import { resolveGrooveLabOrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitSoundBank';
import {
  BEAT_PADS_ORCH_HITS_PIANO_LANES,
  BEAT_PADS_ORCH_HITS_STEPS_PER_BAR,
  beatPadsOrchHitsMidiForLane,
  beatPadsOrchHitsNormalizeLoopBars,
  beatPadsOrchHitsStepCount,
  type BeatPadsOrchHitsVoice,
} from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

export function refillBeatPadsOrchHitsOnTransport(opts: {
  ctx: AudioContext;
  ctSnap: number;
  horizon: number;
  chainFloor?: number;
  trackId: string;
  voice: BeatPadsOrchHitsVoice;
  stripIn: AudioNode;
  originBeat: number;
  sessionStart: number;
  spb: number;
  scheduled: Set<string>;
}): void {
  const { ctx, ctSnap, horizon, voice, stripIn, originBeat, sessionStart, spb, scheduled } = opts;
  if (ctx.state === 'closed' || spb <= 0 || sessionStart <= 0) return;

  const bars = beatPadsOrchHitsNormalizeLoopBars(voice.loopBars);
  const cols = beatPadsOrchHitsStepCount(bars);
  if (cols <= 0) return;

  const hitId = resolveGrooveLabOrchestraHitId(voice.hitId);
  const def = getOrchestraHitDef(hitId);
  if (!def) return;

  const chainFloor = opts.chainFloor ?? SE2_AUDIO_START_FLOOR_SEC;
  const stepBeats = 4 / BEAT_PADS_ORCH_HITS_STEPS_PER_BAR;
  const loopBeats = bars * 4;
  const vel = Math.max(0.05, Math.min(1, voice.level ?? 1)) * 0.92;

  const beatNow = originBeat + Math.max(0, ctSnap - sessionStart) / spb;
  const startBeat = beatNow - 0.05;
  const endBeat = originBeat + Math.max(0, horizon - sessionStart) / spb + 0.05;

  void ensureOrchestraHitBuffer(ctx, def);

  for (let absBeat = Math.floor(startBeat / stepBeats) * stepBeats; absBeat < endBeat; absBeat += stepBeats) {
    if (absBeat < originBeat - 1e-6) continue;
    const loopBeat = ((absBeat % loopBeats) + loopBeats) % loopBeats;
    const col = Math.round(loopBeat / stepBeats) % cols;
    const when = sessionStart + (absBeat - originBeat) * spb;
    if (when < ctSnap + chainFloor - 0.02) continue;
    if (when > horizon + 0.05) break;

    for (let lane = 0; lane < BEAT_PADS_ORCH_HITS_PIANO_LANES; lane += 1) {
      if (!voice.gridSteps[lane]?.[col]) continue;
      const midi = beatPadsOrchHitsMidiForLane(voice.baseMidi, lane);
      const key = `${opts.trackId}|orch|${hitId}|${col}|${lane}|${Math.round(absBeat * 1000)}`;
      if (scheduled.has(key)) continue;
      scheduled.add(key);

      const at = Math.max(when, ctSnap + chainFloor);
      void ensureOrchestraHitBuffer(ctx, def).then(() => {
        playOrchestraHitSample(ctx, def, at, vel, {
          outputNode: stripIn,
          nativePitch: false,
          targetMidi: midi,
        });
      });
    }
  }

  if (scheduled.size > 4000) {
    const keep = [...scheduled].slice(-2000);
    scheduled.clear();
    for (const k of keep) scheduled.add(k);
  }
}

/** Immediate audition of the selected hit at a MIDI pitch. */
export function auditionBeatPadsOrchHit(
  ctx: AudioContext,
  voice: BeatPadsOrchHitsVoice,
  dest: AudioNode,
  targetMidi?: number,
): void {
  const hitId = resolveGrooveLabOrchestraHitId(voice.hitId);
  const def = getOrchestraHitDef(hitId);
  if (!def) return;
  const midi = targetMidi ?? def.rootMidi;
  void ensureOrchestraHitBuffer(ctx, def).then(() => {
    playOrchestraHitSample(ctx, def, ctx.currentTime, 0.95, {
      outputNode: dest,
      nativePitch: false,
      targetMidi: midi,
    });
  });
}
