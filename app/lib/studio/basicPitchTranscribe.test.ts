import { describe, expect, it } from 'vitest';
import {
  collapseBasicPitchToMonophonic,
  filterNotesByMinDuration,
} from '@/app/lib/studio/basicPitchTranscribe';

describe('collapseBasicPitchToMonophonic', () => {
  it('keeps non-overlapping notes', () => {
    const notes = collapseBasicPitchToMonophonic([
      { startTimeSeconds: 0, durationSeconds: 0.4, pitchMidi: 60, amplitude: 0.8 },
      { startTimeSeconds: 0.5, durationSeconds: 0.4, pitchMidi: 62, amplitude: 0.7 },
    ]);
    expect(notes).toHaveLength(2);
    expect(notes[0]?.pitch).toBe(60);
    expect(notes[1]?.pitch).toBe(62);
  });

  it('prefers louder note when overlapping', () => {
    const notes = collapseBasicPitchToMonophonic([
      { startTimeSeconds: 0, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.4 },
      { startTimeSeconds: 0.1, durationSeconds: 0.5, pitchMidi: 64, amplitude: 0.9 },
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.pitch).toBe(64);
    expect(notes[0]?.velocity).toBeGreaterThan(100);
  });

  it('drops ghost notes under min length', () => {
    const notes = collapseBasicPitchToMonophonic(
      [
        { startTimeSeconds: 0, durationSeconds: 0.03, pitchMidi: 60, amplitude: 0.9 },
        { startTimeSeconds: 0.2, durationSeconds: 0.4, pitchMidi: 62, amplitude: 0.8 },
      ],
      0.05,
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]?.pitch).toBe(62);
  });
});

describe('filterNotesByMinDuration', () => {
  it('removes sub-threshold notes', () => {
    const out = filterNotesByMinDuration(
      [
        { pitch: 60, startSec: 0, durationSec: 0.02, velocity: 80 },
        { pitch: 62, startSec: 0.1, durationSec: 0.2, velocity: 90 },
      ],
      0.05,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.pitch).toBe(62);
  });
});
