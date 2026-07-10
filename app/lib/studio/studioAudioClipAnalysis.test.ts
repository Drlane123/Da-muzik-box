import { describe, expect, test } from 'bun:test';
import { reconcileDetectedBpmToReference } from '@/app/lib/studio/studioAudioClipAnalysis';

describe('reconcileDetectedBpmToReference', () => {
  test('prefers session 140 over misread 185', () => {
    const votes = new Map<number, number>([
      [185, 6],
      [140, 1],
    ]);
    expect(reconcileDetectedBpmToReference(185, 140, votes)).toBe(140);
  });

  test('keeps strong detection when far from session', () => {
    const votes = new Map<number, number>([[128, 12]]);
    expect(reconcileDetectedBpmToReference(128, 140, votes)).toBe(128);
  });

  test('resolves double-time toward session', () => {
    const votes = new Map<number, number>([[280, 4], [140, 2]]);
    expect(reconcileDetectedBpmToReference(280, 140, votes)).toBe(140);
  });
});
