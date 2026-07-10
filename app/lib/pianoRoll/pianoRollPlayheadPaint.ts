/**
 * Piano Roll playhead — imperative transform (rAF). Reliable when WAAPI is unavailable.
 */
import {
  beatLabSynth2BeatToQuarterColF,
  beatLabSynth2QuarterColFToPx,
} from '@/app/lib/creationStation/beatLabSynth2PlaylineWapi';
import { CREATION_PIANO_PLAYLINE_CENTER_X } from '@/app/lib/creationStation/creationPlaylineWapi';

export function paintPianoRollPlayheadBeat(
  el: HTMLElement | null,
  beat: number,
  totalBeats: number,
  quarterCols: number,
  quarterCellW: number,
): void {
  if (!el) return;
  const colF = beatLabSynth2BeatToQuarterColF(beat, totalBeats, quarterCols);
  const x = beatLabSynth2QuarterColFToPx(colF, quarterCellW);
  el.style.transform = `translate3d(${x - CREATION_PIANO_PLAYLINE_CENTER_X}px, 0, 0)`;
  el.style.opacity = '1';
}
