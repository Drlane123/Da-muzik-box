import { EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI } from '@/app/lib/creationStation/eightZeroEightVoice';

export const LAB808_TONE_PAD_COUNT = 16;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function lab808TonePadMidi(baseMidi: number, padIndex: number): number {
  return Math.max(0, Math.min(127, baseMidi + padIndex));
}

export function lab808TonePadNoteLabel(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

export function lab808TonePadRangeLabel(baseMidi: number): string {
  const lo = lab808TonePadNoteLabel(baseMidi);
  const hi = lab808TonePadNoteLabel(lab808TonePadMidi(baseMidi, LAB808_TONE_PAD_COUNT - 1));
  return `${lo} – ${hi}`;
}

/** Default window: C-rooted block anchored near classic 808 roll root (C1). */
export function lab808DefaultTonePadBaseMidi(): number {
  const pc = ((EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI % 12) + 12) % 12;
  return Math.max(0, EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI - pc);
}

export function lab808ShiftTonePadBase(baseMidi: number, semitones: number): number {
  return Math.max(0, Math.min(127 - (LAB808_TONE_PAD_COUNT - 1), baseMidi + semitones));
}

export function isLab808BlackKeyMidi(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}
