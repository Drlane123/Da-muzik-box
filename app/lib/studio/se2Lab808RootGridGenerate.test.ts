import { describe, expect, test } from 'bun:test';
import { se2Lab808ProgressionRoots } from '@/app/lib/studio/se2Lab808ChordLock';
import { se2Lab808GenerateRootGridPattern } from '@/app/lib/studio/se2Lab808RootGridGenerate';

function patternSig(pattern: readonly (readonly boolean[])[]): string {
  return pattern.map((row) => row.map((c) => (c ? '1' : '0')).join('')).join('|');
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

  test('kick regenerate seeds produce different grids', () => {
    const sigs = [1, 2, 3, 4, 5].map((seed) =>
      patternSig(
        se2Lab808GenerateRootGridPattern({
          roots,
          loopBars: 8,
          soundLane: 'kick',
          seed,
          keyRoot: 0,
          keyMode: 'major',
        }).pattern,
      ),
    );
    expect(new Set(sigs).size).toBe(5);
  });

  test('bass regenerate seeds produce different grids', () => {
    const sigs = [1, 2, 3, 4, 5].map((seed) =>
      patternSig(
        se2Lab808GenerateRootGridPattern({
          roots,
          loopBars: 8,
          soundLane: 'bass',
          seed,
          keyRoot: 0,
          keyMode: 'major',
        }).pattern,
      ),
    );
    expect(new Set(sigs).size).toBe(5);
  });
});
