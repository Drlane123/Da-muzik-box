/**
 * Beat Pads loop → Studio Editor 2 drum MIDI handoff.
 */
import type {
  BeatPadsDrumPattern,
  BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import type { StudioDrumMidiNote } from '@/app/lib/studio/studioEditor2DrumPatterns';

/** GM drum pitch per Beat Pads lane (CREATION_PAD_NAMES order). */
export const BEAT_PADS_LANE_GM_PITCH: readonly number[] = [
  36, 38, 39, 42, 46, 50, 45, 37,
  54, 56, 49, 51, 70, 56, 40, 35,
];

export type PendingBeatPadsStudioImport = {
  notes: StudioDrumMidiNote[];
  transportBpm: number;
  loopBars: number;
  trackName?: string;
};

export function beatPadsPatternToStudioNotes(
  pattern: BeatPadsDrumPattern,
  opts: {
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    velocity?: number;
    beatsPerBar?: number;
  },
): StudioDrumMidiNote[] {
  const stepsPerBar = opts.stepsPerBar;
  const bpb = Math.max(1, opts.beatsPerBar ?? 4);
  const stepBeats = bpb / stepsPerBar;
  const durationBeats = Math.max(1 / 128, stepBeats * 0.92);
  const velocity = opts.velocity ?? 100;
  const notes: StudioDrumMidiNote[] = [];

  for (let lane = 0; lane < pattern.length; lane += 1) {
    const pitch = BEAT_PADS_LANE_GM_PITCH[lane] ?? 36 + lane;
    for (const block of pattern[lane] ?? []) {
      for (let i = 0; i < block.len; i += 1) {
        const col = block.start + i;
        notes.push({
          pitch,
          startBeat: col * stepBeats,
          durationBeats,
          velocity,
        });
      }
    }
  }

  notes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  return notes;
}

export function buildBeatPadsStudioImport(
  pattern: BeatPadsDrumPattern,
  opts: {
    loopBars: number;
    stepsPerBar: BeatPadsGridStepsPerBar;
    bpm: number;
    trackName?: string;
  },
): PendingBeatPadsStudioImport {
  return {
    notes: beatPadsPatternToStudioNotes(pattern, {
      loopBars: opts.loopBars,
      stepsPerBar: opts.stepsPerBar,
    }),
    transportBpm: Math.max(40, Math.min(240, opts.bpm)),
    loopBars: opts.loopBars,
    trackName: opts.trackName,
  };
}
