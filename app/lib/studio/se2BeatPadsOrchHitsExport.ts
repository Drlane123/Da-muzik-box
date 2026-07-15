/**
 * Beat Pads ORCH hits — piano grid → SE2 roll / MIDI notes.
 */
import {
  BEAT_PADS_ORCH_HITS_PIANO_LANES,
  beatPadsOrchHitsMidiForLane,
  beatPadsOrchHitsNormalizeLoopBars,
  beatPadsOrchHitsStepCount,
  normalizeBeatPadsOrchHitsGrid,
  type BeatPadsOrchHitsVoice,
} from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';

export type BeatPadsOrchHitsRollNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export function beatPadsOrchHitsToRollNotes(voice: BeatPadsOrchHitsVoice): BeatPadsOrchHitsRollNote[] {
  const loopBars = beatPadsOrchHitsNormalizeLoopBars(voice.loopBars);
  const pattern = normalizeBeatPadsOrchHitsGrid(voice.gridSteps, loopBars);
  const stepCount = beatPadsOrchHitsStepCount(loopBars);
  const loopBeats = loopBars * 4;
  const stepBeats = loopBeats / Math.max(1, stepCount);
  const durBeats = Math.max(0.25, stepBeats * 1.5);
  const velocity = Math.max(1, Math.min(127, Math.round((voice.level ?? 1) * 110)));

  const out: BeatPadsOrchHitsRollNote[] = [];
  for (let lane = 0; lane < BEAT_PADS_ORCH_HITS_PIANO_LANES; lane += 1) {
    for (let col = 0; col < stepCount; col += 1) {
      if (!pattern[lane]?.[col]) continue;
      out.push({
        pitch: beatPadsOrchHitsMidiForLane(voice.baseMidi, lane),
        startBeat: col * stepBeats,
        durationBeats: durBeats,
        velocity,
      });
    }
  }
  out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  return out;
}
