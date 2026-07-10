/**
 * Beat Pads — per-lane (pad) export helpers for SE2 individual tracks.
 */
import { beatPadsLaneActiveAtStep } from '@/app/lib/creationStation/beatPadsPatternEdit';
import {
  beatPadsPatternCols,
  normalizeBeatPadsPattern,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  BEAT_PADS_LANE_GM_PITCH,
  beatPadsPatternToStudioNotes,
} from '@/app/lib/creationStation/beatPadsStudioExport';
import type { StudioDrumMidiNote } from '@/app/lib/studio/studioEditor2DrumPatterns';

export function beatPadsLaneHasHits(
  pattern: BeatPadsDrumPattern,
  lane: number,
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar,
): boolean {
  if (lane < 0 || lane > 15) return false;
  const normalized = normalizeBeatPadsPattern(pattern, loopBars, stepsPerBar);
  const cols = beatPadsPatternCols(loopBars, stepsPerBar);
  for (let col = 0; col < cols; col += 1) {
    if (beatPadsLaneActiveAtStep(normalized[lane], col)) return true;
  }
  return false;
}

export function beatPadsLanesWithHits(
  pattern: BeatPadsDrumPattern,
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar,
): number[] {
  const out: number[] = [];
  for (let lane = 0; lane < 16; lane += 1) {
    if (beatPadsLaneHasHits(pattern, lane, loopBars, stepsPerBar)) out.push(lane);
  }
  return out;
}

export function beatPadsLaneToStudioNotes(
  pattern: BeatPadsDrumPattern,
  lane: number,
  opts: {
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    velocity?: number;
    beatsPerBar?: number;
  },
): StudioDrumMidiNote[] {
  const pitch = BEAT_PADS_LANE_GM_PITCH[lane] ?? 36 + lane;
  return beatPadsPatternToStudioNotes(pattern, opts).filter((n) => n.pitch === pitch);
}
