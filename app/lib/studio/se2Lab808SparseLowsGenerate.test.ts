import { describe, expect, it } from 'vitest';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import { SE2_LAB808_TONE_GRID_STEPS_PER_BAR } from '@/app/lib/studio/se2Lab808DrumPattern';
import { se2Lab808ScalePitchClasses } from '@/app/lib/studio/se2Lab808RootGridGenerate';
import {
  se2Lab808GenerateSparseLowsPattern,
  se2Lab808SnapMidiToKeyScale,
} from '@/app/lib/studio/se2Lab808SparseLowsGenerate';
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
  it('ships at least 25 R&B and 30 Trap templates with 2–3 hits each', () => {
    expect(SE2_LAB808_RNB_LOWS_TEMPLATES.length).toBeGreaterThanOrEqual(25);
    expect(SE2_LAB808_TRAP_LOWS_TEMPLATES.length).toBeGreaterThanOrEqual(30);
    for (const t of [...SE2_LAB808_RNB_LOWS_TEMPLATES, ...SE2_LAB808_TRAP_LOWS_TEMPLATES]) {
      expect(t.hits.length).toBeGreaterThanOrEqual(2);
      expect(t.hits.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('se2Lab808SnapMidiToKeyScale', () => {
  it('keeps G major tones in G major', () => {
    const gMajor = se2Lab808ScalePitchClasses(7, 'major'); // G
    expect(gMajor).toContain(7);
    const snapped = se2Lab808SnapMidiToKeyScale(43, 7, 'major'); // G2-ish
    expect(gMajor).toContain(((snapped % 12) + 12) % 12);
    const out = se2Lab808SnapMidiToKeyScale(44, 7, 'major'); // Ab → snap
    expect(gMajor).toContain(((out % 12) + 12) % 12);
  });
});

describe('se2Lab808GenerateSparseLowsPattern', () => {
  it('places at most 3 hits per bar and stays in key with progression', () => {
    const keyRoot = 0; // C minor-ish progression but snap to C minor
    const keyMode = 'minor' as const;
    const scale = new Set(se2Lab808ScalePitchClasses(keyRoot, keyMode));
    const result = se2Lab808GenerateSparseLowsPattern({
      roots,
      loopBars: 8,
      genre: 'trap',
      seed: 42,
      keyRoot,
      keyMode,
    });
    expect(result.hitCount).toBeGreaterThan(0);
    const base = result.tonePadBaseMidi;
    for (let bar = 0; bar < 8; bar += 1) {
      let count = 0;
      const start = bar * SE2_LAB808_TONE_GRID_STEPS_PER_BAR;
      const end = start + SE2_LAB808_TONE_GRID_STEPS_PER_BAR;
      for (let lane = 0; lane < result.pattern.length; lane += 1) {
        for (let c = start; c < end; c += 1) {
          if (!result.pattern[lane]![c]) continue;
          count += 1;
          const midi = base + lane;
          expect(scale.has(((midi % 12) + 12) % 12)).toBe(true);
        }
      }
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it('freelance G major stays in G major', () => {
    const keyRoot = 7;
    const keyMode = 'major' as const;
    const scale = new Set(se2Lab808ScalePitchClasses(keyRoot, keyMode));
    const result = se2Lab808GenerateSparseLowsPattern({
      roots: [],
      loopBars: 4,
      genre: 'rnb',
      seed: 7,
      keyRoot,
      keyMode,
    });
    expect(result.hitCount).toBeGreaterThan(0);
    expect(result.status).toMatch(/freelance/i);
    const base = result.tonePadBaseMidi;
    for (let lane = 0; lane < result.pattern.length; lane += 1) {
      for (let c = 0; c < result.pattern[lane]!.length; c += 1) {
        if (!result.pattern[lane]![c]) continue;
        const midi = base + lane;
        expect(scale.has(((midi % 12) + 12) % 12)).toBe(true);
      }
    }
  });
});
