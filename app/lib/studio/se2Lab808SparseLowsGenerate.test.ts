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
  it('ships at least 25 R&B and 30 Trap dark templates with 2–3 hits each', () => {
    expect(SE2_LAB808_RNB_LOWS_TEMPLATES.length).toBeGreaterThanOrEqual(25);
    expect(SE2_LAB808_TRAP_LOWS_TEMPLATES.length).toBeGreaterThanOrEqual(30);
    for (const t of [...SE2_LAB808_RNB_LOWS_TEMPLATES, ...SE2_LAB808_TRAP_LOWS_TEMPLATES]) {
      expect(t.hits.length).toBeGreaterThanOrEqual(2);
      expect(t.hits.length).toBeLessThanOrEqual(3);
    }
  });

  it('uses dark interval colors (not all-root drones)', () => {
    const withMotion = SE2_LAB808_TRAP_LOWS_TEMPLATES.filter((t) =>
      t.hits.some((h) => h.interval !== 0),
    );
    expect(withMotion.length).toBeGreaterThan(20);
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
    }
  });

  it('freelance generates without roots', () => {
    const result = se2Lab808GenerateSparseLowsPattern({
      roots: [],
      loopBars: 4,
      genre: 'rnb',
      seed: 7,
      keyRoot: 0,
    });
    expect(result.hitCount).toBeGreaterThan(0);
    expect(result.status).toMatch(/freelance/i);
  });
});
