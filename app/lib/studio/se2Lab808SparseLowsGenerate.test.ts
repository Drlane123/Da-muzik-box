import { describe, expect, it } from 'vitest';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import { SE2_LAB808_TONE_GRID_STEPS_PER_BAR } from '@/app/lib/studio/se2Lab808DrumPattern';
import { se2Lab808GenerateSparseLowsPattern } from '@/app/lib/studio/se2Lab808SparseLowsGenerate';
import {
  SE2_LAB808_RNB_LOWS_TEMPLATES,
  SE2_LAB808_TRAP_LOWS_TEMPLATES,
} from '@/app/lib/studio/se2Lab808SparseLowsPack';

const roots: Lab808ProgressionRoot[] = [
  { startBeat: 0, durBeats: 4, midi: 36, chord: 'Cm' },
  { startBeat: 4, durBeats: 4, midi: 43, chord: 'Gm' },
  { startBeat: 8, durBeats: 4, midi: 41, chord: 'Fm' },
  { startBeat: 12, durBeats: 4, midi: 38, chord: 'Ddim' },
  { startBeat: 16, durBeats: 4, midi: 36, chord: 'Cm' },
  { startBeat: 20, durBeats: 4, midi: 43, chord: 'Gm' },
  { startBeat: 24, durBeats: 4, midi: 41, chord: 'Fm' },
  { startBeat: 28, durBeats: 4, midi: 38, chord: 'Ddim' },
];

describe('se2Lab808 sparse lows pack', () => {
  it('ships at least 15 R&B and 20 Trap templates with 2–3 hits each', () => {
    expect(SE2_LAB808_RNB_LOWS_TEMPLATES.length).toBeGreaterThanOrEqual(15);
    expect(SE2_LAB808_TRAP_LOWS_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    for (const t of [...SE2_LAB808_RNB_LOWS_TEMPLATES, ...SE2_LAB808_TRAP_LOWS_TEMPLATES]) {
      expect(t.steps.length).toBeGreaterThanOrEqual(2);
      expect(t.steps.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('se2Lab808GenerateSparseLowsPattern', () => {
  it('places at most 3 hits per bar on progression roots', () => {
    const result = se2Lab808GenerateSparseLowsPattern({
      roots,
      loopBars: 8,
      genre: 'trap',
      seed: 42,
    });
    expect(result.hitCount).toBeGreaterThan(0);
    const bars = 8;
    for (let bar = 0; bar < bars; bar += 1) {
      let count = 0;
      const start = bar * SE2_LAB808_TONE_GRID_STEPS_PER_BAR;
      const end = start + SE2_LAB808_TONE_GRID_STEPS_PER_BAR;
      for (const row of result.pattern) {
        for (let c = start; c < end; c += 1) {
          if (row[c]) count += 1;
        }
      }
      expect(count).toBeLessThanOrEqual(3);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
