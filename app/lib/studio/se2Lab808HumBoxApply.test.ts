import { describe, expect, it } from 'vitest';
import {
  se2Lab808ApplyHumNotesToToneGrid,
  se2Lab808FoldMidiIntoToneWindow,
  se2Lab808PrepareHumNotesForGrid,
  stickySnapHumNotesToKeyScale,
} from '@/app/lib/studio/se2Lab808HumBoxApply';
import { se2Lab808DefaultVoice } from '@/app/lib/studio/se2Lab808Types';
import { se2Lab808ToneGridRunLengthFrom } from '@/app/lib/studio/se2Lab808ToneGridRuns';

describe('se2Lab808FoldMidiIntoToneWindow', () => {
  it('folds high hummed pitches into the 16-pad window', () => {
    const base = 36; // C1
    expect(se2Lab808FoldMidiIntoToneWindow(60, base)).toBe(48); // C4 → C2
    expect(se2Lab808FoldMidiIntoToneWindow(36, base)).toBe(36);
    expect(se2Lab808FoldMidiIntoToneWindow(51, base)).toBe(51);
  });
});

describe('stickySnapHumNotesToKeyScale', () => {
  it('keeps mid-interval chromatics locked inside a continuous phrase', () => {
    // C then C# (mid C–D) then C — must stay on C, not flip to D.
    const locked = stickySnapHumNotesToKeyScale(
      [
        { pitch: 36, startSec: 0, durationSec: 0.4, velocity: 100 },
        { pitch: 37, startSec: 0.4, durationSec: 0.35, velocity: 95 },
        { pitch: 36, startSec: 0.8, durationSec: 0.4, velocity: 100 },
      ],
      0,
      'major',
    );
    expect(locked.every((n) => n.pitch === 36)).toBe(true);
  });

  it('resets after silence so a new attack can grab a new degree', () => {
    const locked = stickySnapHumNotesToKeyScale(
      [
        { pitch: 36, startSec: 0, durationSec: 0.4, velocity: 100 },
        { pitch: 38, startSec: 0.9, durationSec: 0.4, velocity: 100 }, // gap > 0.15
      ],
      0,
      'major',
    );
    expect(locked).toHaveLength(2);
    expect(locked[0]!.pitch).toBe(36);
    expect(locked[1]!.pitch).toBe(38);
  });
});

describe('se2Lab808ApplyHumNotesToToneGrid', () => {
  it('locks hummed notes into the set key and places 16th columns', () => {
    const voice = {
      ...se2Lab808DefaultVoice(),
      tonePadBaseMidi: 36,
      toneGridLoopBars: 4 as const,
    };
    const result = se2Lab808ApplyHumNotesToToneGrid({
      notes: [
        { pitch: 43, startSec: 0, durationSec: 0.5, velocity: 100 },
        { pitch: 44, startSec: 0.6, durationSec: 0.5, velocity: 100 },
        { pitch: 47, startSec: 1.2, durationSec: 0.5, velocity: 100 },
      ],
      bpm: 120,
      voice,
      keyRoot: 7,
      keyMode: 'major',
      mode: 'replace',
    });
    expect(result.hitCount).toBeGreaterThanOrEqual(2);
    expect(result.skipped).toBe(0);
    const onCols = result.pattern.flatMap((row, lane) =>
      row.map((on, col) => (on ? { lane, col } : null)).filter(Boolean),
    );
    expect(onCols.length).toBe(result.hitCount);
    for (const hit of onCols) {
      const midi = 36 + (hit as { lane: number }).lane;
      const pc = ((midi % 12) + 12) % 12;
      expect([7, 9, 11, 0, 2, 4, 6]).toContain(pc);
    }
  });

  it('paints a whole-bar held hum as a continuous run (not one chopped step)', () => {
    const voice = {
      ...se2Lab808DefaultVoice(),
      soundLane: 'bass' as const,
      tonePadBaseMidi: 36,
      toneGridLoopBars: 4 as const,
    };
    // 120 BPM → 1 bar = 2s = 16 sixteenths
    const result = se2Lab808ApplyHumNotesToToneGrid({
      notes: [{ pitch: 36, startSec: 0, durationSec: 2.0, velocity: 110 }],
      bpm: 120,
      voice,
      keyRoot: 0,
      keyMode: 'major',
      mode: 'replace',
    });
    expect(result.noteCount).toBe(1);
    expect(result.hitCount).toBeGreaterThanOrEqual(14);
    const lane = result.pattern.findIndex((row) => row.some(Boolean));
    expect(lane).toBeGreaterThanOrEqual(0);
    expect(se2Lab808ToneGridRunLengthFrom(result.pattern, lane, 0, 64)).toBeGreaterThanOrEqual(14);
  });

  it('glues pitch-dropout fragments into one held note', () => {
    // Tracker flicker: same pitch with ~180ms holes — must become one sustained note.
    const prepared = se2Lab808PrepareHumNotesForGrid(
      [
        { pitch: 36, startSec: 0, durationSec: 0.35, velocity: 100 },
        { pitch: 36, startSec: 0.48, durationSec: 0.4, velocity: 95 },
        { pitch: 37, startSec: 1.0, durationSec: 0.5, velocity: 100 }, // ±1 wobble
        { pitch: 36, startSec: 1.55, durationSec: 0.45, velocity: 90 },
      ],
      120,
      0,
      'major',
    );
    expect(prepared.length).toBe(1);
    expect(prepared[0]!.durationSec).toBeGreaterThan(1.8);
  });

  it('treats a clear tone change as a new note (C → D)', () => {
    const prepared = se2Lab808PrepareHumNotesForGrid(
      [
        { pitch: 36, startSec: 0, durationSec: 0.5, velocity: 100 },
        { pitch: 38, startSec: 0.55, durationSec: 0.5, velocity: 100 },
      ],
      120,
      0,
      'major',
    );
    expect(prepared.length).toBe(2);
    expect(prepared[0]!.pitch).toBe(36);
    expect(prepared[1]!.pitch).toBe(38);
  });

  it('cuts short fragments and keeps only held notes', () => {
    const prepared = se2Lab808PrepareHumNotesForGrid(
      [
        { pitch: 36, startSec: 0, durationSec: 0.8, velocity: 100 },
        { pitch: 40, startSec: 0.85, durationSec: 0.08, velocity: 70 }, // blip
        { pitch: 38, startSec: 1.1, durationSec: 0.12, velocity: 60 }, // blip
        { pitch: 41, startSec: 1.4, durationSec: 0.7, velocity: 100 },
      ],
      120,
      0,
      'major',
    );
    expect(prepared.length).toBe(2);
    expect(prepared.map((n) => n.pitch)).toEqual([36, 41]);
    expect(prepared.every((n) => n.durationSec >= 0.28)).toBe(true);
  });

  it('keeps stop-then-start different pitches as two notes', () => {
    const prepared = se2Lab808PrepareHumNotesForGrid(
      [
        { pitch: 36, startSec: 0, durationSec: 0.5, velocity: 100 },
        { pitch: 41, startSec: 0.95, durationSec: 0.55, velocity: 100 }, // breath gap + new tone
      ],
      120,
      0,
      'major',
    );
    expect(prepared.length).toBe(2);
    expect(prepared[0]!.pitch).toBe(36);
    expect(prepared[1]!.pitch).toBe(41);

    const voice = {
      ...se2Lab808DefaultVoice(),
      tonePadBaseMidi: 36,
      toneGridLoopBars: 4 as const,
    };
    const result = se2Lab808ApplyHumNotesToToneGrid({
      notes: [
        { pitch: 36, startSec: 0, durationSec: 0.5, velocity: 100 },
        { pitch: 41, startSec: 0.95, durationSec: 0.55, velocity: 100 },
      ],
      bpm: 120,
      voice,
      keyRoot: 0,
      keyMode: 'major',
      mode: 'replace',
    });
    expect(result.noteCount).toBe(2);
    const activeLanes = result.pattern
      .map((row, lane) => (row.some(Boolean) ? lane : -1))
      .filter((l) => l >= 0);
    expect(activeLanes.length).toBe(2);
    expect(activeLanes).toContain(0);
    expect(activeLanes).toContain(5); // F
  });

  it('paints a half-note hum across ~8 sixteenths', () => {
    const voice = {
      ...se2Lab808DefaultVoice(),
      soundLane: 'bass' as const,
      tonePadBaseMidi: 36,
      toneGridLoopBars: 4 as const,
    };
    // Half note at 120 = 1s = 8 sixteenths
    const result = se2Lab808ApplyHumNotesToToneGrid({
      notes: [{ pitch: 43, startSec: 0, durationSec: 1.0, velocity: 100 }],
      bpm: 120,
      voice,
      keyRoot: 7,
      keyMode: 'major',
      mode: 'replace',
    });
    expect(result.hitCount).toBeGreaterThanOrEqual(6);
    expect(result.hitCount).toBeLessThanOrEqual(10);
  });
});
