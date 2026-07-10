/**
 * Beat Pads spread roll — one hit per bar on the spread row that matches each bar's chord root.
 * With 808-in-key enabled, notes stay on row 0 (playback transpose handles pitch).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import type { BeatPadsSpreadDirection } from '@/app/lib/creationStation/beatPadsHitSpread';
import {
  BEAT_PADS_STEPS_PER_BAR,
  beatPadsNewNoteId,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  BEAT_PADS_SPREAD_ROW_COUNT,
  beatPadsSpreadHarmonyRootMidiAtBar,
  beatPadsSpreadPatternCols,
  beatPadsSpreadRowMidi,
  clampBeatPadsSpreadLoopBars,
  type BeatPadsSpreadLoopBars,
  type BeatPadsSpreadNote,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import {
  se2BeatPadsSpreadRootMidiAtBar,
  type Se2BeatPadsSpreadSourceTrack,
} from '@/app/lib/studio/se2BeatPadsSpreadHarmony';

/** Spread row whose strike MIDI matches target pitch class (± octave within 16 rows). */
export function beatPadsSpreadRowForTargetMidi(
  voiceRootMidi: number,
  targetMidi: number,
  direction: BeatPadsSpreadDirection,
  variationSeed = 0,
): number {
  const targetPc = ((Math.round(targetMidi) % 12) + 12) % 12;
  const matches: number[] = [];
  for (let row = 0; row < BEAT_PADS_SPREAD_ROW_COUNT; row += 1) {
    const midi = beatPadsSpreadRowMidi(voiceRootMidi, row, direction);
    if (((Math.round(midi) % 12) + 12) % 12 === targetPc) matches.push(row);
  }
  if (matches.length === 0) return 0;
  return matches[Math.abs(variationSeed) % matches.length]!;
}

export type BeatPadsSpreadChordGenerateOpts = {
  voiceRootMidi: number;
  direction: BeatPadsSpreadDirection;
  loopBars: BeatPadsSpreadLoopBars;
  stepsPerBar?: BeatPadsGridStepsPerBar;
  keyLockEnabled: boolean;
  variationSeed?: number;
  /** Beat Lab — melodic lane + optional chord rail. */
  laneNotes?: readonly BeatLabMidiNote[];
  harmonyLane?: number;
  chordRail?: BeatLabImportedChordRail | null;
  keyRoot?: number;
  mode?: ChordMode;
  /** SE2 — studio MIDI match track. */
  harmonyTrack?: Se2BeatPadsSpreadSourceTrack;
  beatsPerBar?: number;
  songKeyRoot?: number;
  songKeyMode?: ChordMode;
};

/** Downbeat spread notes — one per bar aligned to matched chord roots. */
export function generateBeatPadsSpreadChordRootNotes(
  opts: BeatPadsSpreadChordGenerateOpts,
): BeatPadsSpreadNote[] {
  const loopBars = clampBeatPadsSpreadLoopBars(opts.loopBars);
  const stepsPerBar = opts.stepsPerBar ?? BEAT_PADS_STEPS_PER_BAR;
  const cols = beatPadsSpreadPatternCols(loopBars, stepsPerBar);
  const seed = opts.variationSeed ?? 0;
  const notes: BeatPadsSpreadNote[] = [];

  for (let bar = 0; bar < loopBars; bar += 1) {
    const col = bar * stepsPerBar;
    if (col >= cols) break;

    let chordRootMidi: number | null = null;
    if (opts.harmonyTrack) {
      chordRootMidi = se2BeatPadsSpreadRootMidiAtBar({
        track: opts.harmonyTrack,
        barIndex: bar,
        beatsPerBar: opts.beatsPerBar ?? 4,
        layoutBars: loopBars,
        songKeyRoot: opts.songKeyRoot ?? 0,
        songKeyMode: opts.songKeyMode ?? 'major',
      });
    } else if (opts.harmonyLane != null) {
      chordRootMidi = beatPadsSpreadHarmonyRootMidiAtBar({
        laneNotes: opts.laneNotes ?? [],
        harmonyLane: opts.harmonyLane,
        barIndex: bar,
        stepsPerBar,
        layoutBars: loopBars,
        keyRoot: opts.keyRoot ?? 0,
        mode: opts.mode ?? 'major',
        chordRail: opts.chordRail,
      });
    }

    if (chordRootMidi == null) continue;

    const row = opts.keyLockEnabled
      ? beatPadsSpreadRowForTargetMidi(opts.voiceRootMidi, opts.voiceRootMidi, opts.direction, seed + bar)
      : beatPadsSpreadRowForTargetMidi(
          opts.voiceRootMidi,
          chordRootMidi,
          opts.direction,
          seed + bar,
        );

    notes.push({
      id: beatPadsNewNoteId(),
      row,
      start: col,
      len: 1,
    });
  }

  return notes;
}
