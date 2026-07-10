/**
 * Schedule Bass Glide notes on an SE2 mixer strip (mirrors Beat Lab synth2 transport).
 */
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import { beatLabSynthV2TransportDurationSec } from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';
import { scheduleBeatLabSynthV2Note } from '@/app/lib/creationStation/beatLabMelodicSynthV2Engine';
import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import {
  se2BeatLabLaneForTrack,
  se2ChordGlideSourceMidi,
  se2LegatoSourceMidi,
  type Se2MockMidiNote,
} from '@/app/lib/studio/se2GlideBassNotes';

export type Se2ScheduleGlideBassNoteOpts = {
  ctx: AudioContext;
  stripOutput: GainNode;
  trackIndex: number;
  note: Se2MockMidiNote;
  allNotes: readonly Se2MockMidiNote[];
  when: number;
  bpm: number;
  beatsPerBar: number;
  subdiv: number;
  voice: BeatLabBassSynthVoiceParams;
  chordRail?: BeatLabImportedChordRail | null;
  channelVolumes: Record<number, number>;
};

export function se2ScheduleGlideBassNote(opts: Se2ScheduleGlideBassNoteOpts): void {
  const {
    ctx,
    stripOutput,
    trackIndex,
    note,
    allNotes,
    when,
    bpm,
    beatsPerBar,
    subdiv,
    voice,
    chordRail,
    channelVolumes,
  } = opts;

  const lane = se2BeatLabLaneForTrack(trackIndex);
  const midi = Math.max(0, Math.min(127, Math.round(note.pitch)));
  const velocity = Math.max(1, Math.min(127, Math.round(note.velocity)));
  const stepCol = Math.max(0, Math.round(note.startBeat * subdiv));
  const stepLenCols = Math.max(1, Math.round(note.durationBeats * subdiv));
  const subSpb = (60 / Math.max(1, bpm)) / Math.max(1, subdiv);
  const durationSec = beatLabSynthV2TransportDurationSec(subSpb, stepLenCols, voice);

  const glideMode = voice.glideMode ?? 'mono';
  const legatoFromMidi =
    glideMode === 'legato' ? se2LegatoSourceMidi(allNotes, note.startBeat) : undefined;
  const chordFromMidi =
    glideMode === 'chord' && chordRail
      ? se2ChordGlideSourceMidi(
          allNotes,
          note.startBeat,
          midi,
          chordRail,
          beatsPerBar,
          voice.glideBarMask ?? 0xffffffff,
        )
      : undefined;

  scheduleBeatLabSynthV2Note(ctx, {
    lane,
    midi,
    velocity,
    when,
    durationSec,
    channelVolumes,
    voice,
    stripOutput,
    legatoFromMidi,
    chordFromMidi,
    bpm,
    stepCol,
    stepLenCols,
    subdiv,
    beatsPerBar,
    strictNoteOff: true,
    transportLite: true,
    keyRoot: chordRail?.keyRoot,
    keyMode: chordRail?.mode,
  });
}
