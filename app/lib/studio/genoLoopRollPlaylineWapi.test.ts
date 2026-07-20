import { describe, expect, it } from 'bun:test';
import {
  cancelGenoLoopRollPlaylineWapi,
  launchGenoLoopRollPlaylineWapi,
  setGenoLoopRollPlaylineStatic,
} from '@/app/lib/studio/genoLoopRollPlaylineWapi';

describe('genoLoopRollPlaylineWapi', () => {
  it('parks static left percent from beat', () => {
    const el = {
      style: { left: '', removeProperty: () => {}, willChange: '' } as unknown as CSSStyleDeclaration,
      getAnimations: () => [],
    } as unknown as HTMLElement;
    setGenoLoopRollPlaylineStatic(el, 8, 32);
    expect(el.style.left).toBe('25%');
  });

  it('launches WAAPI with pause→seek→play and cancels cleanly', () => {
    let playCount = 0;
    let pauseCount = 0;
    let currentTime = 0;
    const anim = {
      pause: () => {
        pauseCount += 1;
      },
      play: () => {
        playCount += 1;
      },
      cancel: () => {},
      get currentTime() {
        return currentTime;
      },
      set currentTime(v: number) {
        currentTime = v;
      },
    };
    const el = {
      style: {
        left: '',
        willChange: '',
        removeProperty: () => {},
        transform: '',
      } as unknown as CSSStyleDeclaration,
      getAnimations: () => [],
      animate: () => anim,
      offsetWidth: 100,
    } as unknown as HTMLElement;

    const animRef = { current: null as Animation | null };
    launchGenoLoopRollPlaylineWapi(
      { animRef },
      {
        el,
        fromBeat: 8,
        totalBeats: 32,
        bpm: 120,
        play: true,
        loop: true,
        immediateCompositorStart: true,
      },
    );

    expect(pauseCount).toBe(1);
    expect(playCount).toBe(1);
    expect(animRef.current).toBe(anim);
    // 8/32 of 32 beats at 120bpm = 4s → 4000ms into 16000ms loop
    expect(currentTime).toBeCloseTo(4000, 0);

    cancelGenoLoopRollPlaylineWapi({ animRef }, el);
    expect(animRef.current).toBeNull();
  });
});
