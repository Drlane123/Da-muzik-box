/**
 * NEW SYNTH (V2) — assign mixer CH 17–32 roles: bass lane vs piano-roll harmony lane.
 * Channels can be adjacent (e.g. 17 bass + 18 piano); must not be the same lane.
 */
import {
  BEAT_LAB_MELODIC_LANE_START,
  BEAT_LAB_MIDI_LANES,
} from '@/app/lib/creationStation/beatLabMidiRoll';

export const BEAT_LAB_SYNTH2_LANE_MIN = BEAT_LAB_MELODIC_LANE_START;
export const BEAT_LAB_SYNTH2_LANE_MAX = BEAT_LAB_MIDI_LANES - 1;

/** Default: CH 17 = bass, CH 18 = piano roll. */
export const BEAT_LAB_SYNTH2_DEFAULT_BASS_LANE = BEAT_LAB_MELODIC_LANE_START;
export const BEAT_LAB_SYNTH2_DEFAULT_HARMONY_LANE = BEAT_LAB_MELODIC_LANE_START + 1;

const STORAGE_BASS = 'beat-lab-synth2-bass-lane';
const STORAGE_HARMONY = 'beat-lab-synth2-harmony-lane';

export function beatLabSynth2ClampLane(lane: number): number {
  return Math.max(
    BEAT_LAB_SYNTH2_LANE_MIN,
    Math.min(BEAT_LAB_SYNTH2_LANE_MAX, Math.round(lane)),
  );
}

export function beatLabMelodicChannelForLane(lane: number): number {
  return beatLabSynth2ClampLane(lane) + 1;
}

/** Mixer CH number (17–32) → lane index (16–31). */
export function beatLabSynth2LaneFromChannel(ch: number): number {
  return beatLabSynth2ClampLane(Math.round(ch) - 1);
}

export function beatLabSynth2ChannelOptions(): { lane: number; ch: number }[] {
  const out: { lane: number; ch: number }[] = [];
  for (let lane = BEAT_LAB_SYNTH2_LANE_MIN; lane <= BEAT_LAB_SYNTH2_LANE_MAX; lane += 1) {
    out.push({ lane, ch: beatLabMelodicChannelForLane(lane) });
  }
  return out;
}

export function beatLabSynth2NormalizePair(
  bassLane: number,
  harmonyLane: number,
): { bassLane: number; harmonyLane: number } {
  let bass = beatLabSynth2ClampLane(bassLane);
  let harmony = beatLabSynth2ClampLane(harmonyLane);
  if (bass === harmony) {
    harmony = bass >= BEAT_LAB_SYNTH2_LANE_MAX ? bass - 1 : bass + 1;
  }
  return { bassLane: bass, harmonyLane: harmony };
}

export function readStoredBeatLabSynth2Lanes(): {
  bassLane: number;
  harmonyLane: number;
} {
  if (typeof window === 'undefined') {
    return {
      bassLane: BEAT_LAB_SYNTH2_DEFAULT_BASS_LANE,
      harmonyLane: BEAT_LAB_SYNTH2_DEFAULT_HARMONY_LANE,
    };
  }
  try {
    const b = Number(window.localStorage.getItem(STORAGE_BASS));
    const h = Number(window.localStorage.getItem(STORAGE_HARMONY));
    const bassLane = Number.isFinite(b) ? b : BEAT_LAB_SYNTH2_DEFAULT_BASS_LANE;
    const harmonyLane = Number.isFinite(h) ? h : BEAT_LAB_SYNTH2_DEFAULT_HARMONY_LANE;
    return beatLabSynth2NormalizePair(bassLane, harmonyLane);
  } catch {
    return {
      bassLane: BEAT_LAB_SYNTH2_DEFAULT_BASS_LANE,
      harmonyLane: BEAT_LAB_SYNTH2_DEFAULT_HARMONY_LANE,
    };
  }
}

export function storeBeatLabSynth2Lanes(bassLane: number, harmonyLane: number): void {
  const pair = beatLabSynth2NormalizePair(bassLane, harmonyLane);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_BASS, String(pair.bassLane));
    window.localStorage.setItem(STORAGE_HARMONY, String(pair.harmonyLane));
  } catch {
    /* ignore */
  }
}

export function beatLabSynth2IsBassLane(lane: number, bassLane: number): boolean {
  return beatLabSynth2ClampLane(lane) === beatLabSynth2ClampLane(bassLane);
}

export function beatLabSynth2IsHarmonyLane(lane: number, harmonyLane: number): boolean {
  return beatLabSynth2ClampLane(lane) === beatLabSynth2ClampLane(harmonyLane);
}
