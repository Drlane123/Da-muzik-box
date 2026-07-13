import { describe, expect, test } from 'bun:test';
import { se2Lab808ProgressionRoots } from '@/app/lib/studio/se2Lab808ChordLock';
import {
  SE2_LAB808_ROOT_GEN_GENRE_ORDER,
  se2Lab808GenerateRootGridPattern,
  se2Lab808LaneForRootMidi,
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

  test('dark and scifi genres are available and stay sparse', () => {
    expect(SE2_LAB808_ROOT_GEN_GENRE_ORDER).toEqual(
      expect.arrayContaining(['dark', 'scifi']),
    );
    for (const genre of ['dark', 'scifi'] as const) {
      const kick = se2Lab808GenerateRootGridPattern({
        roots,
        loopBars: 8,
        soundLane: 'kick',
        seed: 42,
        genre,
        quantize: '1/4',
      });
      const bass = se2Lab808GenerateRootGridPattern({
        roots,
        loopBars: 8,
        soundLane: 'bass',
        seed: 42,
        genre,
        quantize: '1/8',
      });
      expect(kick.hitCount).toBeGreaterThan(0);
      expect(kick.hitCount).toBeLessThanOrEqual(roots.length * 3);
      expect(bass.hitCount).toBeGreaterThan(0);
      expect(bass.hitCount).toBeLessThanOrEqual(roots.length * 3);
      expect(kick.status).toContain(genre === 'dark' ? 'Dark' : 'Sci-fi');
    }
  });

  test('dark / scifi bass uses non-root interval lanes', () => {
    let sawNonRoot = false;
    for (const genre of ['dark', 'scifi'] as const) {
      for (const seed of [7, 19, 33, 55, 88]) {
        const r = se2Lab808GenerateRootGridPattern({
          roots,
          loopBars: 8,
          soundLane: 'bass',
          seed,
          genre,
          quantize: '1/8',
        });
        const rootLanes = new Set(
          roots
            .map((root) => se2Lab808LaneForRootMidi(r.tonePadBaseMidi, root.midi))
            .filter((l): l is number => l != null),
        );
        for (let lane = 0; lane < 16; lane++) {
          if (!r.pattern[lane]?.some(Boolean)) continue;
          if (!rootLanes.has(lane)) sawNonRoot = true;
        }
      }
    }
    expect(sawNonRoot).toBe(true);
  });
});
