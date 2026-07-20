/**
 * SE2 Chord Generator mini-roll playhead — WAAPI compositor (same pause→seek→play contract as SE2 / Groove Lab).
 * Animates `left` across the percent-based piano-roll track so React does not drive the line every frame.
 */
import type { MutableRefObject } from 'react';

import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

export type GenoLoopRollPlaylineWapiRefs = {
  animRef: MutableRefObject<Animation | null>;
};

export type GenoLoopRollPlaylineWapiOpts = {
  el: HTMLElement | null;
  fromBeat: number;
  totalBeats: number;
  bpm: number;
  play: boolean;
  loop?: boolean;
  /** Delay WAAPI `play` to match audio sessionStart (SE2 floor). */
  audioStartLeadSec?: number;
  /** Play click — start compositor immediately (audio still uses floor). */
  immediateCompositorStart?: boolean;
};

export function cancelGenoLoopRollPlaylineWapi(
  refs: GenoLoopRollPlaylineWapiRefs,
  el: HTMLElement | null,
): void {
  const anim = refs.animRef.current;
  refs.animRef.current = null;
  if (anim) {
    try {
      anim.cancel();
    } catch {
      /* already cancelled */
    }
  }
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.style.removeProperty('will-change');
}

/** Park playhead when stopped / scrubbing (no running WAAPI). */
export function setGenoLoopRollPlaylineStatic(
  el: HTMLElement | null,
  beat: number,
  totalBeats: number,
): void {
  if (!el || totalBeats <= 0) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.style.removeProperty('will-change');
  const clamped = ((beat % totalBeats) + totalBeats) % totalBeats;
  const pct = (clamped / totalBeats) * 100;
  el.style.left = `${pct}%`;
  el.style.removeProperty('transform');
}

/**
 * Compositor playline — pause → seek → play.
 * Track is percent-width; keyframes animate `left` from 0% → 100% over one loop.
 */
export function launchGenoLoopRollPlaylineWapi(
  refs: GenoLoopRollPlaylineWapiRefs,
  o: GenoLoopRollPlaylineWapiOpts,
): void {
  const { el, fromBeat, totalBeats, bpm, play } = o;
  cancelGenoLoopRollPlaylineWapi(refs, el);
  if (!el || totalBeats <= 0) return;

  const secPerBeat = 60 / Math.max(40, bpm);
  const loopSec = Math.max(secPerBeat, totalBeats * secPerBeat);
  const durationMs = Math.max(16, loopSec * 1000);
  const startBeat = ((fromBeat % totalBeats) + totalBeats) % totalBeats;
  const seekMs = (startBeat / totalBeats) * durationMs;
  const playDelayMs =
    play && !o.immediateCompositorStart
      ? Math.max(0, (o.audioStartLeadSec ?? SE2_AUDIO_START_FLOOR_SEC) * 1000)
      : 0;

  el.style.removeProperty('transform');
  if (play) el.style.willChange = 'left';
  else el.style.removeProperty('will-change');

  if (!play) {
    setGenoLoopRollPlaylineStatic(el, startBeat, totalBeats);
    return;
  }

  el.getAnimations().forEach((a) => a.cancel());
  const anim = el.animate(
    [{ left: '0%' }, { left: '100%' }],
    {
      duration: durationMs,
      delay: playDelayMs,
      easing: 'linear',
      fill: 'forwards',
      iterations: o.loop === false ? 1 : Infinity,
    },
  );
  anim.pause();
  anim.currentTime = Math.min(Math.max(seekMs, 0), durationMs - 1e-6);
  anim.play();
  void el.offsetWidth;
  refs.animRef.current = anim;
}
