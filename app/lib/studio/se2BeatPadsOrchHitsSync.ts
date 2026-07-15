/**
 * Beat Pads ORCH hits Lab — persist + sync helpers (pattern survives close).
 */
import type { Se2BeatPadsTrack } from '@/app/lib/studio/se2BeatPadsTrack';
import {
  beatPadsOrchHitsDefaultVoice,
  beatPadsOrchHitsHasHits,
  beatPadsOrchHitsNormalizeLoopBars,
  cloneBeatPadsOrchHitsVoice,
  normalizeBeatPadsOrchHitsGrid,
  type BeatPadsOrchHitsLoopBars,
  type BeatPadsOrchHitsVoice,
} from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';

export {
  beatPadsOrchHitsHasHits,
  cloneBeatPadsOrchHitsVoice,
} from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';

export function se2BeatPadsOrchHitsVoiceFromTrack(
  tr: Pick<Se2BeatPadsTrack, 'beatPadsOrchHitsVoice'>,
): BeatPadsOrchHitsVoice {
  const stored = tr.beatPadsOrchHitsVoice;
  if (!stored) return beatPadsOrchHitsDefaultVoice();
  return cloneBeatPadsOrchHitsVoice(stored);
}

export function se2BeatPadsOrchHitsHasHits(voice: BeatPadsOrchHitsVoice): boolean {
  return beatPadsOrchHitsHasHits(voice.gridSteps);
}

export function se2BeatPadsOrchHitsAlignLoopBars(
  voice: BeatPadsOrchHitsVoice,
  beatPadsLoopBars: number,
): BeatPadsOrchHitsVoice {
  const target = beatPadsOrchHitsNormalizeLoopBars(beatPadsLoopBars) as BeatPadsOrchHitsLoopBars;
  if (voice.loopBars === target) return voice;
  return {
    ...voice,
    loopBars: target,
    gridSteps: normalizeBeatPadsOrchHitsGrid(voice.gridSteps, target),
  };
}
