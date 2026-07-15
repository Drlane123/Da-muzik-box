import { describe, expect, it } from 'vitest';
import {
  se2Lab808ApplyHumNotesToToneGrid,
  se2Lab808FoldMidiIntoToneWindow,
} from '@/app/lib/studio/se2Lab808HumBoxApply';
import { se2Lab808DefaultVoice } from '@/app/lib/studio/se2Lab808Types';

describe('se2Lab808FoldMidiIntoToneWindow', () => {
  it('folds high hummed pitches into the 16-pad window', () => {
    const base = 36; // C1
    expect(se2Lab808FoldMidiIntoToneWindow(60, base)).toBe(48); // C4 → C2
    expect(se2Lab808FoldMidiIntoToneWindow(36, base)).toBe(36);
    expect(se2Lab808FoldMidiIntoToneWindow(51, base)).toBe(51);
  });
});

describe('se2Lab808ApplyHumNotesToToneGrid', () => {
  it('locks hummed notes into the set key and places 16th columns', () => {
    const voice = {
      ...se2Lab808DefaultVoice(),
      tonePadBaseMidi: 36,
      toneGridLoopBars: 4 as const,
    };
    // G major: G=43, A=45, B=47 — Ab=44 should snap toward G or A
    const result = se2Lab808ApplyHumNotesToToneGrid({
      notes: [
        { pitch: 43, startSec: 0, durationSec: 0.4, velocity: 100 },
        { pitch: 44, startSec: 0.5, durationSec: 0.4, velocity: 100 },
        { pitch: 47, startSec: 1.0, durationSec: 0.4, velocity: 100 },
      ],
      bpm: 120,
      voice,
      keyRoot: 7,
      keyMode: 'major',
      mode: 'replace',
    });
    expect(result.hitCount).toBeGreaterThanOrEqual(2);
    expect(result.skipped).toBe(0);
    const onCols = result.pattern.flatMap((row, lane) =>
      row.map((on, col) => (on ? { lane, col } : null)).filter(Boolean),
    );
    expect(onCols.length).toBe(result.hitCount);
    for (const hit of onCols) {
      const midi = 36 + (hit as { lane: number }).lane;
      const pc = ((midi % 12) + 12) % 12;
      // G major scale PCs
      expect([7, 9, 11, 0, 2, 4, 6]).toContain(pc);
    }
  });
});
