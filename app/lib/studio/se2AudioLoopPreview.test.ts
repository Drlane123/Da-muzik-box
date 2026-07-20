import { describe, expect, test } from 'bun:test';

import {
  se2AudioClipIntersectsLoopRegion,
  se2AudioClipLoopOccurrences,
  se2AudioClipLoopSegment,
  se2AudioClipPreviewScheduleKeyLoopLap,
  se2AudioPreviewAdoptFutureLoopLapClips,
  se2AudioPreviewIsLoopLapKey,
  se2AudioPreviewLapClipHasStarted,
  se2AudioPreviewPurgeLoopLapKeys,
  se2AudioPreviewPurgeNonLapKeys,
  se2AudioPreviewClipStillAudible,
  se2GateAudioPreviewOccurrence,
} from '@/app/lib/studio/se2AudioLoopPreview';



describe('se2AudioClipLoopSegment', () => {

  test('returns intersection inside loop braces', () => {

    expect(

      se2AudioClipLoopSegment({

        clipStartBeat: 0,

        clipDurationBeats: 32,

        sourceOffsetBeats: 0,

        loopStartBeat: 0,

        loopEndBeat: 16,

      }),

    ).toEqual({

      segStartBeat: 0,

      segEndBeat: 16,

      sourceOffsetBeats: 0,

    });

  });



  test('trims clip that starts mid-loop', () => {

    expect(

      se2AudioClipLoopSegment({

        clipStartBeat: 12,

        clipDurationBeats: 8,

        sourceOffsetBeats: 2,

        loopStartBeat: 0,

        loopEndBeat: 16,

      }),

    ).toEqual({

      segStartBeat: 12,

      segEndBeat: 16,

      sourceOffsetBeats: 2,

    });

  });



  test('null when clip is outside loop', () => {

    expect(

      se2AudioClipLoopSegment({

        clipStartBeat: 20,

        clipDurationBeats: 4,

        sourceOffsetBeats: 0,

        loopStartBeat: 0,

        loopEndBeat: 16,

      }),

    ).toBeNull();

  });

});



describe('se2AudioClipIntersectsLoopRegion', () => {

  test('detects overlap when clip starts before loop end', () => {

    expect(

      se2AudioClipIntersectsLoopRegion({

        clipStartBeat: 8,

        clipDurationBeats: 12,

        loopStartBeat: 0,

        loopEndBeat: 16,

      }),

    ).toBe(true);

  });

});



describe('se2AudioClipLoopOccurrences', () => {

  test('non-loop returns one full-clip occurrence in window', () => {

    const occ = se2AudioClipLoopOccurrences({

      clipStartBeat: 4,

      clipDurationBeats: 8,

      sourceOffsetBeats: 0,

      originBeat: 0,

      sessionStart: 1,

      spb: 0.5,

      ctSnap: 1,

      horizon: 10,

      loopOn: false,

      loopStartBeat: 0,

      loopEndBeat: 16,

    });

    expect(occ).toHaveLength(1);

    expect(occ[0]?.occurrenceStartBeat).toBe(4);

    expect(occ[0]?.tOn).toBeCloseTo(3, 5);

    expect(occ[0]?.tOff).toBeCloseTo(7, 5);

  });



  test('loop trims to in-region slice and repeats in lookahead', () => {

    const occ = se2AudioClipLoopOccurrences({

      clipStartBeat: 0,

      clipDurationBeats: 32,

      sourceOffsetBeats: 0,

      originBeat: 0,

      sessionStart: 0,

      spb: 1,

      ctSnap: 0,

      horizon: 40,

      loopOn: true,

      loopStartBeat: 0,

      loopEndBeat: 16,

    });

    expect(occ).toHaveLength(1);
    expect(occ[0]?.segEndBeat).toBe(16);
    expect(occ[0]?.segStartBeat).toBe(0);
    expect(occ[0]?.repeatInLap).toBe(0);

  });



  test('loop excludes clip entirely past loop end', () => {

    expect(

      se2AudioClipLoopOccurrences({

        clipStartBeat: 20,

        clipDurationBeats: 4,

        sourceOffsetBeats: 0,

        originBeat: 0,

        sessionStart: 0,

        spb: 1,

        ctSnap: 0,

        horizon: 40,

        loopOn: true,

        loopStartBeat: 0,

        loopEndBeat: 16,

      }),

    ).toEqual([]);

  });

  test('mid-song loop while approaching from earlier beats keeps full clip audio', () => {
    const occ = se2AudioClipLoopOccurrences({
      clipStartBeat: 0,
      clipDurationBeats: 8,
      sourceOffsetBeats: 0,
      originBeat: 0,
      sessionStart: 1,
      spb: 0.5,
      ctSnap: 1,
      horizon: 20,
      loopOn: true,
      loopStartBeat: 16,
      loopEndBeat: 32,
    });
    expect(occ).toHaveLength(1);
    expect(occ[0]?.segStartBeat).toBe(0);
    expect(occ[0]?.segEndBeat).toBe(8);
    expect(occ[0]?.occurrenceStartBeat).toBe(0);
    expect(occ[0]?.tOn).toBeCloseTo(1, 5);
  });

  test('committed mid-song loop trims to braces', () => {
    const occ = se2AudioClipLoopOccurrences({
      clipStartBeat: 0,
      clipDurationBeats: 64,
      sourceOffsetBeats: 0,
      originBeat: 16,
      sessionStart: 1,
      spb: 0.5,
      ctSnap: 1,
      horizon: 20,
      loopOn: true,
      loopStartBeat: 16,
      loopEndBeat: 32,
    });
    expect(occ.length).toBeGreaterThanOrEqual(1);
    expect(occ[0]?.segStartBeat).toBe(16);
    expect(occ[0]?.segEndBeat).toBe(32);
  });

});



describe('se2AudioPreviewPurgeLoopLapKeys', () => {
  test('removes only matching lap audio keys', () => {
    const scheduled = new Set([
      'lap0:audio:tr1:c1:r0:align0',
      'lap1:audio:tr1:c1:r0:align0',
      'lap0:tr1:0:o0.0000:r0',
    ]);
    se2AudioPreviewPurgeLoopLapKeys(scheduled, 0);
    expect(scheduled.has('lap0:audio:tr1:c1:r0:align0')).toBe(false);
    expect(scheduled.has('lap1:audio:tr1:c1:r0:align0')).toBe(true);
    expect(scheduled.has('lap0:tr1:0:o0.0000:r0')).toBe(true);
  });
});

describe('se2AudioPreviewPurgeNonLapKeys', () => {
  test('removes approach full-clip keys but keeps lap audio keys', () => {
    const scheduled = new Set([
      'tr1:c1:0:32:0:0:0',
      'lap0:audio:tr1:c1:r0:align0',
      'lap1:audio:tr1:c1:r0:align0',
    ]);
    se2AudioPreviewPurgeNonLapKeys(scheduled);
    expect(scheduled.has('tr1:c1:0:32:0:0:0')).toBe(false);
    expect(scheduled.has('lap0:audio:tr1:c1:r0:align0')).toBe(true);
    expect(scheduled.has('lap1:audio:tr1:c1:r0:align0')).toBe(true);
  });

  test('se2AudioPreviewIsLoopLapKey detects lap audio keys only', () => {
    expect(se2AudioPreviewIsLoopLapKey('lap2:audio:tr:clip:r0:align0')).toBe(true);
    expect(se2AudioPreviewIsLoopLapKey('tr1:c1:0:32:0:0:0')).toBe(false);
    expect(se2AudioPreviewIsLoopLapKey('lap0:tr1:0:o0.0000:r0')).toBe(false);
  });
});



describe('se2AudioClipPreviewScheduleKeyLoopLap', () => {

  test('includes lap, track, clip, repeat', () => {

    expect(se2AudioClipPreviewScheduleKeyLoopLap(2, 'tr', 'clip', 1, true)).toBe(

      'lap2:audio:tr:clip:r1:align1',

    );

  });

});

describe('se2AudioPreviewAdoptFutureLoopLapClips', () => {
  test('re-keys not-yet-started prev-lap lookahead onto next lap (rN → rN-1)', () => {
    const scheduled = new Set([
      'lap0:audio:tr1:c1:r0:align0',
      'lap0:audio:tr1:c1:r1:align0',
    ]);
    const clips = [
      { scheduleKey: 'lap0:audio:tr1:c1:r0:align0', startTime: 1.0 },
      { scheduleKey: 'lap0:audio:tr1:c1:r1:align0', startTime: 8.0 },
    ];
    se2AudioPreviewAdoptFutureLoopLapClips(clips, scheduled, 0, 1, 7.95);
    expect(se2AudioPreviewLapClipHasStarted(clips[0]!, 7.95)).toBe(true);
    expect(se2AudioPreviewLapClipHasStarted(clips[1]!, 7.95)).toBe(false);
    expect(clips[0]!.scheduleKey).toBe('lap0:audio:tr1:c1:r0:align0');
    expect(clips[1]!.scheduleKey).toBe('lap1:audio:tr1:c1:r0:align0');
    expect(scheduled.has('lap0:audio:tr1:c1:r1:align0')).toBe(false);
    expect(scheduled.has('lap1:audio:tr1:c1:r0:align0')).toBe(true);
  });
});

describe('se2AudioPreviewClipStillAudible', () => {
  test('returns false when source playbackState is finished', () => {
    const src = { playbackState: 3 } as AudioBufferSourceNode;
    expect(
      se2AudioPreviewClipStillAudible(
        [{ scheduleKey: 'k1', endTime: 100, src }],
        'k1',
        { currentTime: 5, state: 'running' },
      ),
    ).toBe(false);
  });
});

describe('se2GateAudioPreviewOccurrence', () => {
  test('re-schedules when dedupe key is set but BufferSource is gone', () => {
    const scheduled = new Set(['audio:tr1:c1:align0']);
    const ctx = { currentTime: 10, state: 'running' } as AudioContext;
    const occ = { tOn: 8, tOff: 40 };
    expect(
      se2GateAudioPreviewOccurrence({
        scheduled,
        tracking: [],
        key: 'audio:tr1:c1:align0',
        ctx,
        occ,
        ctSnap: 10,
        inLoopRegion: false,
        isLoopDownbeat: false,
      }),
    ).toBe('schedule');
    expect(scheduled.has('audio:tr1:c1:align0')).toBe(false);
  });

  test('skips when clip is still audible mid-occurrence', () => {
    const scheduled = new Set<string>();
    const ctx = { currentTime: 10, state: 'running' } as AudioContext;
    const occ = { tOn: 8, tOff: 40 };
    const src = { playbackState: 2 } as AudioBufferSourceNode;
    expect(
      se2GateAudioPreviewOccurrence({
        scheduled,
        tracking: [{ scheduleKey: 'audio:tr1:c1:align0', endTime: 38, src }],
        key: 'audio:tr1:c1:align0',
        ctx,
        occ,
        ctSnap: 10,
        inLoopRegion: false,
        isLoopDownbeat: false,
      }),
    ).toBe('skip');
    expect(scheduled.has('audio:tr1:c1:align0')).toBe(true);
  });
});

