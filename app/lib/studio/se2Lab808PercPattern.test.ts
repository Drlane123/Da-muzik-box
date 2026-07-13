import { describe, expect, test } from 'bun:test';
import {
  normalizeSe2Lab808PercPattern,
  se2Lab808PercHasHits,
  se2Lab808PercStepNineBar,
  se2Lab808PercTwoAndFourPattern,
} from '@/app/lib/studio/se2Lab808PercPattern';
import { refillSe2Lab808PercOnTransport } from '@/app/lib/studio/se2Lab808PercTransport';
import { se2Lab808DefaultVoice } from '@/app/lib/studio/se2Lab808Types';

describe('se2Lab808 perc 1-bar loop', () => {
  test('2&4 places snare on beats 2 and 4', () => {
    const p = se2Lab808PercTwoAndFourPattern();
    expect(p.snare[4]).toBe(true);
    expect(p.snare[12]).toBe(true);
    expect(se2Lab808PercHasHits(p)).toBe(true);
  });

  test('step 9 preset hits index 8 only', () => {
    const bar = se2Lab808PercStepNineBar();
    expect(bar[8]).toBe(true);
    expect(bar.filter(Boolean)).toHaveLength(1);
  });

  test('normalize pads short arrays to 16', () => {
    const p = normalizeSe2Lab808PercPattern([true, false], undefined);
    expect(p.snare).toHaveLength(16);
    expect(p.snare[0]).toBe(true);
    expect(p.clap.every((x) => !x)).toBe(true);
  });

  test('refill schedules snare keys for repeating bars', () => {
    const voice = {
      ...se2Lab808DefaultVoice(),
      percSnareSteps: se2Lab808PercTwoAndFourPattern().snare,
    };
    const scheduled = new Set<string>();
    const ctx = {
      currentTime: 0,
      sampleRate: 44100,
      createBuffer: () => ({ getChannelData: () => new Float32Array(8) }),
      createBufferSource: () => ({
        buffer: null,
        connect: () => {},
        start: () => {},
        stop: () => {},
      }),
      createBiquadFilter: () => ({
        type: 'highpass',
        frequency: { setValueAtTime: () => {} },
        Q: { setValueAtTime: () => {} },
        connect: () => {},
      }),
      createOscillator: () => ({
        type: 'triangle',
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, value: 0 },
        connect: () => {},
        start: () => {},
        stop: () => {},
      }),
      createGain: () => ({
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
      }),
    } as unknown as AudioContext;
    const dest = { connect: () => {} } as unknown as AudioNode;

    refillSe2Lab808PercOnTransport({
      ctx,
      ctSnap: 0,
      horizon: 8,
      chainFloor: 0.008,
      trackId: 't1',
      voice,
      stripIn: dest,
      originBeat: 0,
      sessionStart: 0.01,
      spb: 0.5,
      beatsPerBar: 4,
      scheduled,
    });

    const snareKeys = [...scheduled].filter((k) => k.includes(':perc:snare:'));
    expect(snareKeys.length).toBeGreaterThan(2);
  });
});
