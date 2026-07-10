/**
 * Brief VU hint when audio is scheduled — only used when the live analyser has not caught up yet.
 */
import type { StudioMixerStripSnapshot } from '@/app/lib/studio/studioMixerStripBus';
import { STUDIO_MIXER_NOISE_GATE_LINEAR } from '@/app/lib/studio/studioMixerMeterEngine';

const pulseUntilMs = new Map<number, number>();
const pulseStrength = new Map<number, number>();
/** True once the live analyser saw signal for this pulse — release must not hold a fake tail. */
const pulseSawLive = new Map<number, boolean>();

export function bumpSe2MixerMeterPulse(
  trackIndex: number,
  velocity01 = 0.85,
  holdMs = 140,
): void {
  const v = Math.max(0.12, Math.min(1, velocity01));
  pulseUntilMs.set(trackIndex, performance.now() + holdMs + v * 40);
  pulseStrength.set(trackIndex, v);
  pulseSawLive.delete(trackIndex);
}

export function readSe2MixerMeterPulse(
  trackIndex: number,
  snap: StudioMixerStripSnapshot | null,
): StudioMixerStripSnapshot | null {
  const until = pulseUntilMs.get(trackIndex) ?? 0;
  const now = performance.now();
  if (now >= until) {
    pulseUntilMs.delete(trackIndex);
    pulseStrength.delete(trackIndex);
    pulseSawLive.delete(trackIndex);
    return snap;
  }

  const livePeak = snap?.linearPeak ?? 0;
  if (livePeak > STUDIO_MIXER_NOISE_GATE_LINEAR) {
    pulseSawLive.set(trackIndex, true);
    return snap;
  }

  if (pulseSawLive.get(trackIndex)) {
    pulseUntilMs.delete(trackIndex);
    pulseStrength.delete(trackIndex);
    pulseSawLive.delete(trackIndex);
    return snap;
  }

  const v = pulseStrength.get(trackIndex) ?? 0.85;
  const bump = v * (0.35 + Math.min(0.45, (until - now) / 220));
  return {
    peakL: bump,
    peakR: bump,
    rmsL: bump * 0.72,
    rmsR: bump * 0.72,
    linearPeak: bump,
  };
}
