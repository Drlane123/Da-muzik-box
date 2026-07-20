import { describe, expect, it, mock } from 'bun:test';

const scheduleMock = mock(() => {});

mock.module('@/app/lib/studio/se2ChordGeneratorAudition', () => ({
  scheduleSe2ChordGeneratorChord: scheduleMock,
}));

const {
  GENO_LOOP_ROLL_SCHEDULE_AHEAD_SEC,
  genoLoopRollBeatAtElapsed,
  genoLoopRollTotalBeats,
  genoLoopRollWrapBeat,
  refillGenoLoopRollSe2Sync,
} = await import('@/app/lib/studio/genoLoopRollAudition');

function mockCtx(currentTime = 0): AudioContext {
  return {
    currentTime,
    state: 'running',
    createGain: () => {
      const g = {
        gain: { value: 1 },
        connect: () => g,
        disconnect: () => {},
      };
      return g as unknown as GainNode;
    },
  } as unknown as AudioContext;
}

describe('genoLoopRollAudition lookahead', () => {
  it('wraps loop beat and total beats', () => {
    expect(genoLoopRollTotalBeats(8, 4)).toBe(32);
    expect(genoLoopRollWrapBeat(33, 32)).toBe(1);
    expect(genoLoopRollBeatAtElapsed(0, 40, 32, true)).toBe(8);
  });

  it('refills only hits inside the schedule-ahead window (full loop needs pump)', () => {
    scheduleMock.mockClear();

    const ctx = mockCtx(10);
    const totalBeats = 32;
    const notes = [
      { pitch: 60, startBeat: 0, durationBeats: 2, velocity: 96 },
      { pitch: 64, startBeat: 0, durationBeats: 2, velocity: 96 },
      { pitch: 60, startBeat: 16, durationBeats: 2, velocity: 96 },
      { pitch: 67, startBeat: 28, durationBeats: 2, velocity: 96 },
    ];
    const scheduled = new Set<string>();
    const bus = ctx.createGain();

    refillGenoLoopRollSe2Sync(
      ctx,
      notes,
      0,
      totalBeats,
      {
        bpm: 120,
        instrumentId: 'gm:acoustic_grand_piano',
        trackIndex: 1900,
        volume: 0.82,
        auditionBus: bus,
        chordVoice: 'grand',
        perfMode: 'block',
      },
      scheduled,
    );

    expect(GENO_LOOP_ROLL_SCHEDULE_AHEAD_SEC).toBe(3);
    const starts = scheduleMock.mock.calls.map((c) => c[2] as number);
    expect(starts.length).toBe(1);
    expect(Math.max(...starts)).toBeLessThanOrEqual(10 + GENO_LOOP_ROLL_SCHEDULE_AHEAD_SEC + 0.02);
  });

  it('schedules later chords once the playhead advances into the ahead window', () => {
    scheduleMock.mockClear();

    const ctx = mockCtx(10);
    const totalBeats = 32;
    const notes = [
      { pitch: 60, startBeat: 0, durationBeats: 2, velocity: 96 },
      { pitch: 60, startBeat: 16, durationBeats: 2, velocity: 96 },
    ];
    const scheduled = new Set<string>();
    const bus = ctx.createGain();
    const opts = {
      bpm: 120,
      instrumentId: 'gm:acoustic_grand_piano',
      trackIndex: 1900,
      volume: 0.82,
      auditionBus: bus,
      chordVoice: 'grand' as const,
      perfMode: 'block' as const,
    };

    refillGenoLoopRollSe2Sync(ctx, notes, 14, totalBeats, opts, scheduled);
    expect(scheduleMock.mock.calls.length).toBe(1);
    expect(scheduleMock.mock.calls[0]![2] as number).toBeGreaterThan(10);
  });
});
