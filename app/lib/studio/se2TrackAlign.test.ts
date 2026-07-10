import { describe, expect, test } from 'bun:test';
import {
  se2AudioClipPreviewScheduleKey,
  se2TrackAlignClipStretchRateFromClip,
  se2TrackAlignMaxDurationBeatsAtLockedRate,
  se2TrackAlignPlaybackForWallSegment,
  se2TrackAlignSourceOffsetBeatDelta,
  se2TrackAlignStretchRate,
} from '@/app/lib/studio/se2TrackAlign';

describe('se2TrackAlign stretch math', () => {
  test('stretch rate maps 8s buffer into 4s wall at 2:1', () => {
    expect(
      se2TrackAlignStretchRate({
        bufferDurationSec: 8,
        sourceOffsetSec: 0,
        clipWallDurationSec: 4,
      }),
    ).toBe(2);
  });

  test('left trim advances source offset by delta * stretch rate', () => {
    expect(se2TrackAlignSourceOffsetBeatDelta(2, 1.5)).toBe(3);
  });

  test('playback segment covers full wall from buffer start', () => {
    const seg = se2TrackAlignPlaybackForWallSegment({
      bufferDurationSec: 8,
      sourceOffsetSec: 0,
      clipWallDurationSec: 4,
      timelineOffsetSec: 0,
      wallRemainSec: 4,
    });
    expect(seg.bufferPlaySec).toBeCloseTo(8, 3);
    expect(seg.playbackRate).toBeCloseTo(2, 3);
  });

  test('schedule key changes when clip duration changes', () => {
    const a = se2AudioClipPreviewScheduleKey('tr1', { id: 'c1', startBeat: 0, durationBeats: 4 }, true);
    const b = se2AudioClipPreviewScheduleKey('tr1', { id: 'c1', startBeat: 0, durationBeats: 8 }, true);
    expect(a).not.toBe(b);
  });

  test('locked stretch rate keeps trim ratio', () => {
    const seg = se2TrackAlignPlaybackForWallSegment({
      bufferDurationSec: 8,
      sourceOffsetSec: 0,
      clipWallDurationSec: 2,
      timelineOffsetSec: 0,
      wallRemainSec: 2,
      lockedStretchRate: 2,
    });
    expect(seg.bufferPlaySec).toBeCloseTo(4, 3);
  });

  test('max duration at locked rate', () => {
    const beats = se2TrackAlignMaxDurationBeatsAtLockedRate(8, 0, 2, 120);
    expect(beats).toBeCloseTo(8, 3);
  });
});
