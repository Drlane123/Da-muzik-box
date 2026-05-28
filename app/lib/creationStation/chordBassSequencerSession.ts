/**
 * DAW session lanes reserved for Chord/Bass Sequencer (Studio Editor audioTrack 33–48).
 * One lane per chord step — bass piano-roll data maps to these channels.
 */

export const CHORD_BASS_SEQ_CHANNEL_BASE = 33;
export const CHORD_BASS_SEQ_CHANNEL_COUNT = 16;

export function chordBassSeqChannelForStep(stepIndex: number): number {
  const i = ((stepIndex % CHORD_BASS_SEQ_CHANNEL_COUNT) + CHORD_BASS_SEQ_CHANNEL_COUNT) % CHORD_BASS_SEQ_CHANNEL_COUNT;
  return CHORD_BASS_SEQ_CHANNEL_BASE + i;
}

export function chordBassSeqChannelLabel(channel: number): string {
  return `CH${channel}`;
}

export function chordBassSeqStepChannelLabel(stepIndex: number): string {
  return chordBassSeqChannelLabel(chordBassSeqChannelForStep(stepIndex));
}
