import { describe, expect, it } from 'vitest';
import {
  se2InsertParallelTrackSlot,
  se2RemoveParallelTrackSlot,
} from '@/app/lib/studio/se2TrackParallelSlots';

describe('se2TrackParallelSlots', () => {
  it('removes a mid-list slot and pads the tail', () => {
    const armed = [true, false, true, false, false];
    const next = se2RemoveParallelTrackSlot(armed, 1, false, 5);
    expect(next).toEqual([true, true, false, false, false]);
  });

  it('inserts a slot and drops the last pad', () => {
    const vols = [100, 90, 80, 70, 0];
    const next = se2InsertParallelTrackSlot(vols, 1, 64, 5);
    expect(next).toEqual([100, 64, 90, 80, 70]);
  });
});
