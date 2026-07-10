/**
 * SE2 piano roll — Beat Pads lane labels + pitch range (16 pads, same GM map as Beat Pads machine).
 */
import { BEAT_PADS_LANE_GM_PITCH } from '@/app/lib/creationStation/beatPadsStudioExport';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import { pianoRollPadIndexForMidi, pianoRollPadLabelsForKit } from '@/app/lib/pianoRoll/pianoRollDrumEngine';
import { loadSe2BeatPadsPadStore, se2BeatPadsPadKey } from '@/app/lib/studio/se2BeatPadsPadStorage';

const PIANO_ROW_H_MIN = 14;

export type Se2BeatPadsPianoRollPitchView = {
  pitchLo: number;
  pitchHi: number;
  rowH: number;
  /** One row per pad (16) — avoids a 35+ row contiguous GM span that freezes the roll. */
  rowPitches: readonly number[];
};

/** Pad 16 at top, pad 1 at bottom (matches drum-lane row layout). */
export const BEAT_PADS_PIANO_ROW_PITCHES: readonly number[] = Array.from({ length: 16 }, (_, pi) =>
  BEAT_PADS_LANE_GM_PITCH[15 - pi]!,
);

/** 16-row Beat Pads grid — same lane pitches as the machine, not full MIDI 35–81 span. */
export function computeBeatPadsRollPitchView(availGridPx: number): Se2BeatPadsPianoRollPitchView {
  const rowPitches = BEAT_PADS_PIANO_ROW_PITCHES;
  const lo = Math.min(...rowPitches);
  const hi = Math.max(...rowPitches);
  const avail = Math.max(140, availGridPx);
  const rowH = Math.max(PIANO_ROW_H_MIN, Math.floor(avail / Math.max(rowPitches.length, 8)));
  return { pitchLo: lo, pitchHi: hi, rowH, rowPitches };
}

/** Pad display names — stored samples first, then producer kit meta (same order as Beat Pads machine). */
export function se2BeatPadsPadLabelsForTrack(
  trackId: string,
  kitId: BeatLabProducerKitId = 'trapDarkVault',
): string[] {
  const store = loadSe2BeatPadsPadStore();
  const labels = pianoRollPadLabelsForKit(kitId);
  const out = labels.slice(0, 16);
  while (out.length < 16) out.push(`Pad ${out.length + 1}`);
  for (let pi = 0; pi < 16; pi += 1) {
    const row = store[se2BeatPadsPadKey(trackId, pi)];
    const lb = typeof row?.label === 'string' ? row.label.trim() : '';
    if (lb) out[pi] = lb;
  }
  return out;
}

export function se2BeatPadsLaneIndexForPitch(pitch: number): number {
  const idx = BEAT_PADS_LANE_GM_PITCH.indexOf(pitch);
  if (idx >= 0) return idx;
  return pianoRollPadIndexForMidi(pitch);
}

/** Left-hand row label for SE2 piano roll on a Beat Pads lane. */
export function studioBeatPadsKeyLabelForPitch(
  pitch: number,
  trackId: string,
  kitId?: BeatLabProducerKitId,
): string | undefined {
  const labels = se2BeatPadsPadLabelsForTrack(trackId, kitId ?? 'trapDarkVault');
  const lanes: number[] = [];
  for (let i = 0; i < BEAT_PADS_LANE_GM_PITCH.length; i += 1) {
    if (BEAT_PADS_LANE_GM_PITCH[i] === pitch) lanes.push(i);
  }
  if (lanes.length === 0) {
    if (pitch < 35 || pitch > 81) return undefined;
    const padIdx = pianoRollPadIndexForMidi(pitch);
    return labels[padIdx] ?? `Pad ${padIdx + 1}`;
  }
  if (lanes.length === 1) return labels[lanes[0]!] ?? `Pad ${lanes[0]! + 1}`;
  return lanes.map((i) => labels[i] ?? `Pad ${i + 1}`).join(' · ');
}
