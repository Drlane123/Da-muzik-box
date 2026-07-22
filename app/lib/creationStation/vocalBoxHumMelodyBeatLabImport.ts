/**
 * Hum Melody Capture → Beat Lab SYNTH lanes (CH 17–32).
 * Melody / Bass / Lead map to fixed melodic lanes for Sync → Pads.
 */
import {
  BEAT_LAB_MELODIC_LANE_START,
  beatLabMelodicLanePitch,
  clampBeatLabNoteLen,
  normalizeBeatLabMidiNote,
  type BeatLabMidiNote,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import type {
  BeatPadsVocalBoxHumMelodyApply,
  BeatPadsVocalBoxHumRollLayer,
} from '@/app/components/creation/BeatPadsVocalBoxHumMelodyPanel';

const LAYER_LANE: Record<BeatPadsVocalBoxHumRollLayer, number> = {
  melody: BEAT_LAB_MELODIC_LANE_START,
  bass: BEAT_LAB_MELODIC_LANE_START + 1,
  lead: BEAT_LAB_MELODIC_LANE_START + 2,
};

export function vocalBoxHumLayerMelodicLane(layer: BeatPadsVocalBoxHumRollLayer): number {
  return LAYER_LANE[layer] ?? BEAT_LAB_MELODIC_LANE_START;
}

/** Convert Hum apply payload → Beat Lab midiRoll notes (1/16-friendly cols). */
export function humMelodyApplyToBeatLabNotes(
  payload: BeatPadsVocalBoxHumMelodyApply,
  opts: {
    stepsPerBar: number;
    beatsPerBar?: number;
    maxCols: number;
  },
): BeatLabMidiNote[] {
  const beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  const stepsPerBar = Math.max(1, Math.round(opts.stepsPerBar));
  const colsPerBeat = stepsPerBar / beatsPerBar;
  const lane = vocalBoxHumLayerMelodicLane(payload.layer);
  const basePitch = beatLabMelodicLanePitch(lane);
  const out: BeatLabMidiNote[] = [];

  for (const n of payload.notes) {
    const col = Math.max(0, Math.round(n.startBeat * colsPerBeat));
    if (col >= opts.maxCols) continue;
    const rawLen = Math.max(1, Math.round(n.durationBeats * colsPerBeat));
    const len = clampBeatLabNoteLen(rawLen, col, opts.maxCols);
    const pitchSemi = Math.max(-24, Math.min(24, Math.round(n.pitch) - basePitch));
    const note = normalizeBeatLabMidiNote({
      lane,
      col,
      len,
      vel: Math.max(1, Math.min(127, Math.round(n.velocity))),
      pitchSemi,
    });
    if (note) out.push(note);
  }
  return out;
}

/** Replace the layer's melodic lane notes, keep other lanes. */
export function mergeHumMelodyApplyIntoMidiRoll(
  existing: readonly BeatLabMidiNote[],
  payload: BeatPadsVocalBoxHumMelodyApply,
  opts: {
    stepsPerBar: number;
    beatsPerBar?: number;
    maxCols: number;
    replaceLane?: boolean;
  },
): BeatLabMidiNote[] {
  const lane = vocalBoxHumLayerMelodicLane(payload.layer);
  const imported = humMelodyApplyToBeatLabNotes(payload, opts);
  const keep =
    opts.replaceLane === false
      ? [...existing]
      : existing.filter((n) => n.lane !== lane);
  return [...keep, ...imported].sort(
    (a, b) => a.lane - b.lane || a.col - b.col || (a.pitchSemi ?? 0) - (b.pitchSemi ?? 0),
  );
}
