/**
 * Beat Pads Spread — dedicated CH 17 pitch roll (does not overwrite the 16-pad kit).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { chordSymbolToRootMidi } from '@/app/lib/creationStation/chordBuilder';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import { beatLabNoteMidi } from '@/app/lib/creationStation/beatLabMelodicSynth';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import { grooveLabClampBassRootMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  BEAT_LAB_SYNTH2_DEFAULT_HARMONY_LANE,
  BEAT_LAB_SYNTH2_LANE_MAX,
  BEAT_LAB_SYNTH2_LANE_MIN,
  beatLabMelodicChannelForLane,
  beatLabSynth2ClampLane,
  beatLabSynth2ChannelOptions,
  readStoredBeatLabSynth2Lanes,
} from '@/app/lib/creationStation/beatLabSynthV2LaneRoles';
import { beatLabSynthV2RootsFromPianoRoll } from '@/app/lib/creationStation/beatLabSynthV2BasslineGenerator';
import { se2BeatPadsKickKeySemitones } from '@/app/lib/studio/se2BeatPadsKickMatch';
import {
  beatPadsSpreadAnchorRootMidi,
  beatPadsSpreadBaseLabel,
  beatPadsSpreadRootMidi,
  type BeatPadsSpreadDirection,
} from '@/app/lib/creationStation/beatPadsHitSpread';
import {
  BEAT_PADS_STEPS_PER_BAR,
  beatPadsNewNoteId,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import type { PadSamplerFxRack } from '@/app/lib/creationStation/padSamplerFxRack';
import type { PadSamplerPlaybackOpts, StoredPadSample } from '@/app/lib/padSampleStorage';
import { playPadSampleBuffer, type PlayPadSampleBufferOpts } from '@/app/lib/creationStation/padSamplePlayback';

/** Default mixer channel for Spread — user-selectable CH 17–32. */
export const BEAT_PADS_SPREAD_MIXER_CH = 17;
export const BEAT_PADS_SPREAD_MIXER_CH_MIN = 17;
export const BEAT_PADS_SPREAD_MIXER_CH_MAX = 32;

export function clampBeatPadsSpreadMixerChannel(ch: number): number {
  return Math.max(
    BEAT_PADS_SPREAD_MIXER_CH_MIN,
    Math.min(BEAT_PADS_SPREAD_MIXER_CH_MAX, Math.round(ch)),
  );
}

export const BEAT_PADS_SPREAD_ROW_COUNT = 16;

export const BEAT_PADS_SPREAD_LOOP_BAR_CHOICES = [2, 4, 8] as const;
export type BeatPadsSpreadLoopBars = (typeof BEAT_PADS_SPREAD_LOOP_BAR_CHOICES)[number];

export type BeatPadsSpreadNote = {
  id: string;
  /** Pitch row 0–15 — row 0 = root, each row ±1 semitone per spread direction. */
  row: number;
  start: number;
  len: number;
};

export type BeatPadsSpreadVoice = {
  direction: BeatPadsSpreadDirection;
  rootMidi: number;
  baseLabel: string;
  buffer: AudioBuffer;
  sampler: PadSamplerPlaybackOpts;
  fx: PadSamplerFxRack;
  rootBpm: number;
  mixerChannel: number;
};

export type BeatPadsSpreadTrackState = {
  bank: number;
  sourcePad: number;
  direction: BeatPadsSpreadDirection;
  rootMidi: number;
  baseLabel: string;
  loopBars: BeatPadsSpreadLoopBars;
  stepsPerBar: BeatPadsGridStepsPerBar;
  mixerChannel: number;
  /** Beat Lab melodic lane (16–31) whose MIDI chords drive 808-in-key roots. */
  harmonyLane?: number;
  /** SE2 studio track index — spread-roll 808-in-key only (not harmony-strip kick lock). */
  harmonyTrackIndex?: number;
  /** Transpose spread to follow harmony-lane chord roots bar-by-bar. */
  keyLockEnabled?: boolean;
  notes: BeatPadsSpreadNote[];
  /** Persisted sample snapshot — pads on the bank are never replaced. */
  sample: StoredPadSample;
};

export function beatPadsSpreadDefaultLoopBars(): BeatPadsSpreadLoopBars {
  return 8;
}

export function clampBeatPadsSpreadLoopBars(bars: number): BeatPadsSpreadLoopBars {
  const n = Math.round(bars);
  if (n <= 2) return 2;
  if (n <= 4) return 4;
  return 8;
}

export const BEAT_PADS_SPREAD_VISIBLE_BARS_MAX = 4;

export function beatPadsSpreadRollVisibleBars(loopBars: number): number {
  return Math.min(clampBeatPadsSpreadLoopBars(loopBars), BEAT_PADS_SPREAD_VISIBLE_BARS_MAX);
}

export function beatPadsSpreadRollPopoverWidth(
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): number {
  const LANE_W = 102;
  const COL_W = 16;
  return LANE_W + beatPadsSpreadRollVisibleBars(loopBars) * stepsPerBar * COL_W;
}

export function beatPadsSpreadPatternCols(
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): number {
  return clampBeatPadsSpreadLoopBars(loopBars) * stepsPerBar;
}

/** Chord-rail root pitch class at a bar (carries last symbol forward). */
export function beatPadsSpreadChordRootPcAtBar(
  chordRail: BeatLabImportedChordRail | null | undefined,
  barIndex: number,
): number | null {
  if (!chordRail) return null;
  const { keyRoot, mode, timeline } = chordRail;
  let pc = ((Math.round(keyRoot) % 12) + 12) % 12;
  const bar = Math.max(0, Math.floor(barIndex));
  const limit = Math.min(bar, Math.max(0, timeline.length - 1));
  for (let b = 0; b <= limit; b += 1) {
    const symbol = timeline[b]?.chord;
    if (!symbol) continue;
    const midi = chordSymbolToRootMidi(symbol, keyRoot, mode, 2);
    if (midi != null) pc = ((Math.round(midi) % 12) + 12) % 12;
  }
  return pc;
}

/** Count audible notes on a Beat Lab melodic lane. */
export function beatPadsSpreadLaneNoteCount(
  laneNotes: readonly BeatLabMidiNote[],
  harmonyLane: number,
): number {
  const lane = beatLabSynth2ClampLane(harmonyLane);
  return laneNotes.filter((n) => n.lane === lane && !n.muted).length;
}

export function beatPadsSpreadHarmonyLaneOptions(
  laneNotes: readonly BeatLabMidiNote[],
): { lane: number; ch: number; noteCount: number }[] {
  return beatLabSynth2ChannelOptions().map(({ lane, ch }) => ({
    lane,
    ch,
    noteCount: beatPadsSpreadLaneNoteCount(laneNotes, lane),
  }));
}

/** Default match lane: stored NEW SYNTH harmony CH, else first lane with MIDI. */
export function beatPadsSpreadDefaultHarmonyLane(
  laneNotes: readonly BeatLabMidiNote[],
): number {
  const stored = readStoredBeatLabSynth2Lanes().harmonyLane;
  if (beatPadsSpreadLaneNoteCount(laneNotes, stored) > 0) {
    return beatLabSynth2ClampLane(stored);
  }
  for (let lane = BEAT_LAB_SYNTH2_LANE_MIN; lane <= BEAT_LAB_SYNTH2_LANE_MAX; lane += 1) {
    if (beatPadsSpreadLaneNoteCount(laneNotes, lane) > 0) return lane;
  }
  return BEAT_LAB_SYNTH2_DEFAULT_HARMONY_LANE;
}

export function beatPadsSpreadHarmonyLaneLabel(lane: number, noteCount?: number): string {
  const ch = beatLabMelodicChannelForLane(lane);
  if (noteCount == null) return `CH ${ch}`;
  return noteCount > 0 ? `CH ${ch} · ${noteCount} notes` : `CH ${ch} · empty`;
}

/** Root MIDI at a bar from live lane MIDI (preferred) or imported chord rail (fallback). */
export function beatPadsSpreadHarmonyRootMidiAtBar(opts: {
  laneNotes: readonly BeatLabMidiNote[];
  harmonyLane: number;
  barIndex: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
  layoutBars: number;
  keyRoot: number;
  mode: ChordMode;
  chordRail?: BeatLabImportedChordRail | null;
}): number | null {
  const lane = beatLabSynth2ClampLane(opts.harmonyLane);
  const layoutBars = Math.max(1, Math.round(opts.layoutBars));
  const bar = Math.max(0, Math.floor(opts.barIndex));
  const midiAt = (n: BeatLabMidiNote) => beatLabNoteMidi(lane, n);

  const roll = beatLabSynthV2RootsFromPianoRoll({
    notes: opts.laneNotes,
    lane,
    layoutBars,
    stepsPerBar: opts.stepsPerBar,
    midiAtNote: midiAt,
    keyRoot: opts.keyRoot,
    mode: opts.mode,
  });
  if (roll.hasHarmony) {
    return roll.roots[bar] ?? roll.roots[roll.roots.length - 1] ?? null;
  }

  if (opts.chordRail) {
    const pc = beatPadsSpreadChordRootPcAtBar(opts.chordRail, bar);
    if (pc != null) return grooveLabClampBassRootMidi(12 * 3 + pc);
  }
  return null;
}

export type BeatPadsSpreadKeyLockOpts = {
  voiceRootMidi: number;
  laneNotes: readonly BeatLabMidiNote[];
  harmonyLane: number;
  gridCol: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
  loopBars: number;
  keyLockEnabled: boolean;
  chordRail?: BeatLabImportedChordRail | null;
  keyRoot: number;
  mode: ChordMode;
};

/** Semitones to add when 808-in-key follows the matched harmony lane bar-by-bar. */
export function beatPadsSpreadKeyLockSemiAtCol(opts: BeatPadsSpreadKeyLockOpts): number {
  if (!opts.keyLockEnabled) return 0;
  const stepsPerBar: BeatPadsGridStepsPerBar = opts.stepsPerBar;
  const bar = Math.floor(opts.gridCol / Math.max(1, stepsPerBar));
  const layoutBars = Math.max(clampBeatPadsSpreadLoopBars(opts.loopBars), bar + 1);
  const rootMidi = beatPadsSpreadHarmonyRootMidiAtBar({
    laneNotes: opts.laneNotes,
    harmonyLane: opts.harmonyLane,
    barIndex: bar,
    stepsPerBar,
    layoutBars,
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    chordRail: opts.chordRail,
  });
  if (rootMidi == null) return 0;
  const chordPc = ((Math.round(rootMidi) % 12) + 12) % 12;
  const voicePc = ((Math.round(opts.voiceRootMidi) % 12) + 12) % 12;
  return se2BeatPadsKickKeySemitones(chordPc, voicePc);
}

export function beatPadsSpreadRowMidi(
  rootMidi: number,
  row: number,
  direction: BeatPadsSpreadDirection,
): number {
  return beatPadsSpreadRootMidi(rootMidi, row, direction);
}

export function beatPadsSpreadRowLabel(
  baseLabel: string,
  row: number,
  rootMidi: number,
  direction: BeatPadsSpreadDirection,
): string {
  if (row <= 0) return beatPadsSpreadBaseLabel(baseLabel);
  const midi = beatPadsSpreadRowMidi(rootMidi, row, direction);
  return `${beatPadsSpreadBaseLabel(baseLabel)} · ${cbPianoMidiToNoteName(midi)}`;
}

export function beatPadsSpreadRows(rootMidi: number, direction: BeatPadsSpreadDirection): number[] {
  return Array.from({ length: BEAT_PADS_SPREAD_ROW_COUNT }, (_, row) =>
    beatPadsSpreadRowMidi(rootMidi, row, direction),
  );
}

export function beatPadsSpreadNoteAtColumn(
  notes: readonly BeatPadsSpreadNote[],
  col: number,
): BeatPadsSpreadNote | undefined {
  return notes.find((n) => col >= n.start && col < n.start + n.len);
}

export function beatPadsSpreadActiveAtStep(notes: readonly BeatPadsSpreadNote[], col: number): boolean {
  return beatPadsSpreadNoteAtColumn(notes, col) != null;
}

export function beatPadsSpreadNotesAtColumn(
  notes: readonly BeatPadsSpreadNote[],
  col: number,
): BeatPadsSpreadNote[] {
  return notes.filter((n) => col >= n.start && col < n.start + n.len);
}

function clampNote(
  note: BeatPadsSpreadNote,
  cols: number,
): BeatPadsSpreadNote | null {
  if (cols <= 0) return null;
  const row = Math.max(0, Math.min(BEAT_PADS_SPREAD_ROW_COUNT - 1, note.row));
  const start = Math.max(0, Math.min(cols - 1, note.start));
  const maxLen = cols - start;
  const len = Math.max(1, Math.min(maxLen, note.len));
  return { ...note, row, start, len };
}

export function beatPadsSpreadAddNote(
  notes: BeatPadsSpreadNote[],
  row: number,
  start: number,
  len = 1,
  cols?: number,
): BeatPadsSpreadNote[] {
  const totalCols = cols ?? beatPadsSpreadPatternCols(beatPadsSpreadDefaultLoopBars());
  const note = clampNote({ id: beatPadsNewNoteId(), row, start, len }, totalCols);
  if (!note) return notes;
  if (beatPadsSpreadNoteAtColumn(notes, note.start)) return notes;
  return [...notes, note].sort((a, b) => a.start - b.start || a.row - b.row);
}

export function beatPadsSpreadRemoveAtColumn(
  notes: BeatPadsSpreadNote[],
  col: number,
): BeatPadsSpreadNote[] {
  const hit = beatPadsSpreadNoteAtColumn(notes, col);
  if (!hit) return notes;
  return notes.filter((n) => n.id !== hit.id);
}

export function beatPadsSpreadDrawToggleAt(
  notes: BeatPadsSpreadNote[],
  row: number,
  col: number,
  cols?: number,
): BeatPadsSpreadNote[] {
  const hit = beatPadsSpreadNoteAtColumn(notes, col);
  if (hit) return beatPadsSpreadRemoveAtColumn(notes, col);
  return beatPadsSpreadAddNote(notes, row, col, 1, cols);
}

/** Keep spread notes inside the roll length when loop bars shrink. */
export function beatPadsSpreadClampNotesToLoop(
  notes: readonly BeatPadsSpreadNote[],
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): BeatPadsSpreadNote[] {
  const cols = beatPadsSpreadPatternCols(loopBars, stepsPerBar);
  return notes
    .map((n) => clampNote(n, cols))
    .filter((n): n is BeatPadsSpreadNote => n != null && n.start < cols);
}

/** Match spread column indices when the Beat Pads grid resolution changes (16 ↔ 32). */
export function beatPadsSpreadConvertNotesGridSteps(
  notes: readonly BeatPadsSpreadNote[],
  loopBars: number,
  fromSteps: BeatPadsGridStepsPerBar,
  toSteps: BeatPadsGridStepsPerBar,
): BeatPadsSpreadNote[] {
  if (fromSteps === toSteps) return [...notes];
  const toCols = beatPadsSpreadPatternCols(loopBars, toSteps);

  if (fromSteps === 16 && toSteps === 32) {
    return notes
      .map((n) =>
        clampNote(
          {
            ...n,
            id: beatPadsNewNoteId(),
            start: n.start * 2,
            len: Math.min(toCols - n.start * 2, n.len * 2),
          },
          toCols,
        ),
      )
      .filter((n): n is BeatPadsSpreadNote => n != null);
  }

  const fromCols = beatPadsSpreadPatternCols(loopBars, fromSteps);
  const byRow = new Map<number, boolean[]>();
  for (const n of notes) {
    let row = byRow.get(n.row);
    if (!row) {
      row = Array.from({ length: fromCols }, () => false);
      byRow.set(n.row, row);
    }
    for (let c = n.start; c < n.start + n.len && c < fromCols; c += 1) row[c] = true;
  }

  const out: BeatPadsSpreadNote[] = [];
  for (const [row, rowHiRes] of byRow) {
    let i = 0;
    while (i < toCols) {
      const hit = rowHiRes[i * 2] || rowHiRes[i * 2 + 1];
      if (!hit) {
        i += 1;
        continue;
      }
      const start = i;
      while (i < toCols && (rowHiRes[i * 2] || rowHiRes[i * 2 + 1])) i += 1;
      const note = clampNote({ id: beatPadsNewNoteId(), row, start, len: i - start }, toCols);
      if (note) out.push(note);
    }
  }
  return out.sort((a, b) => a.start - b.start || a.row - b.row);
}

export function buildBeatPadsSpreadVoiceFromPad(args: {
  buffer: AudioBuffer;
  label: string;
  rootMidi: number | undefined;
  chromatic: boolean | undefined;
  sampler: PadSamplerPlaybackOpts;
  fx: PadSamplerFxRack;
  rootBpm: number;
  direction: BeatPadsSpreadDirection;
  mixerChannel?: number;
}): BeatPadsSpreadVoice {
  const root = beatPadsSpreadAnchorRootMidi(
    args.rootMidi,
    args.chromatic,
    args.sampler.fineSemi ?? 0,
  );
  return {
    direction: args.direction,
    rootMidi: root,
    baseLabel: beatPadsSpreadBaseLabel(args.label),
    buffer: args.buffer,
    sampler: { ...args.sampler, fineSemi: 0 },
    fx: args.fx,
    rootBpm: args.rootBpm,
    mixerChannel: clampBeatPadsSpreadMixerChannel(args.mixerChannel ?? BEAT_PADS_SPREAD_MIXER_CH),
  };
}

export function playBeatPadsSpreadRow(
  ctx: AudioContext,
  voice: BeatPadsSpreadVoice,
  row: number,
  velocity: number,
  when: number,
  channelVolumes: Record<number, number>,
  instant = false,
  keyLockSemi = 0,
  playOpts?: PlayPadSampleBufferOpts,
): () => void {
  const strikeMidi = beatPadsSpreadRowMidi(voice.rootMidi, row, voice.direction);
  const detuneCents = (strikeMidi - voice.rootMidi + keyLockSemi) * 100;
  return playPadSampleBuffer(
    ctx,
    voice.buffer,
    clampBeatPadsSpreadMixerChannel(voice.mixerChannel),
    velocity,
    when,
    channelVolumes,
    1,
    undefined,
    voice.sampler,
    true,
    voice.fx,
    Math.max(1, voice.rootBpm),
    instant,
    detuneCents,
    playOpts,
  );
}
