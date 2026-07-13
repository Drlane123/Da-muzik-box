import { describe, expect, test } from 'bun:test';
import { se2Lab808ProgressionRoots } from '@/app/lib/studio/se2Lab808ChordLock';
import {
  se2Lab808GenerateRootGridPattern,
  se2Lab808QuantizeGridStride,
} from '@/app/lib/studio/se2Lab808RootGridGenerate';

function patternSig(pattern: readonly (readonly boolean[])[]): string {
  return pattern.map((row) => row.map((c) => (c ? '1' : '0')).join('')).join('|');
}

function hitCount(pattern: readonly (readonly boolean[])[]): number {
  return pattern.reduce((n, row) => n + row.filter(Boolean).length, 0);
}

describe('se2Lab808GenerateRootGridPattern', () => {
  const roots = se2Lab808ProgressionRoots({
    tracks: [],
    lab808TrackId: 't-lab808',
    lock: { enabled: true, sourceKind: 'key', keyRoot: 0, keyMode: 'major' },
    songKeyRoot: 0,
    songKeyMode: 'major',
    loopBars: 8,
  });

  test('quantize strides map 1/4..1/32 onto 16th grid', () => {
    expect(se2Lab808QuantizeGridStride('1/4')).toBe(4);
    expect(se2Lab808QuantizeGridStride('1/8')).toBe(2);
    expect(se2Lab808QuantizeGridStride('1/16')).toBe(1);
    expect(se2Lab808QuantizeGridStride('1/32')).toBe(1);
  });

  test('kick regenerate seeds produce different sparse grids', () => {
    const results = [1, 2, 3, 4, 5].map((seed) =>
      se2Lab808GenerateRootGridPattern({
        roots,
        loopBars: 8,
        soundLane: 'kick',
        seed,
        keyRoot: 0,
        keyMode: 'major',
        quantize: '1/8',
      }),
    );
    expect(new Set(results.map((r) => patternSig(r.pattern))).size).toBe(5);
    // Sparse trap kick — not a melodic carpet of hits.
    for (const r of results) {
      expect(r.hitCount).toBeLessThanOrEqual(roots.length * 4);
      expect(r.hitCount).toBeGreaterThanOrEqual(roots.length);
    }
  });

  test('bass regenerate stays root-sparse (not melodic)', () => {
    const results = [1, 2, 3, 4, 5].map((seed) =>
      se2Lab808GenerateRootGridPattern({
        roots,
        loopBars: 8,
        soundLane: 'bass',
        seed,
        keyRoot: 0,
        keyMode: 'major',
        quantize: '1/8',
      }),
    );
    expect(new Set(results.map((r) => patternSig(r.pattern))).size).toBeGreaterThanOrEqual(2);
    for (const r of results) {
      // At most ~2 hits per chord block on average.
      expect(r.hitCount).toBeLessThanOrEqual(roots.length * 2);
      expect(hitCount(r.pattern)).toBe(r.hitCount);
    }
  });

  test('dance genre places denser four-on-floor kicks than trap', () => {
    const trap = se2Lab808GenerateRootGridPattern({
      roots,
      loopBars: 8,
      soundLane: 'kick',
      seed: 11,
      genre: 'trap',
      quantize: '1/4',
    });
    const dance = se2Lab808GenerateRootGridPattern({
      roots,
      loopBars: 8,
      soundLane: 'kick',
      seed: 11,
      genre: 'dance',
      quantize: '1/4',
    });
    expect(dance.hitCount).toBeGreaterThanOrEqual(trap.hitCount);
  });
});
