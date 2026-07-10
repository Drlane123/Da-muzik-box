/**
 * Geno Ultra ARP — footer performance modes (legato + bar-anchored slide).
 */
import { genoArpStepInBar, GENO_ARP_STEPS_PER_BAR } from '@/app/lib/studio/genoUltraArpPattern';

/** 16th step at bar midpoint (beat 3 in 4/4 @ 1/16). */
export const GENO_ARP_SLIDE_MID_STEP = GENO_ARP_STEPS_PER_BAR / 2;

/** Last 16th of the bar — glide into the next bar. */
export const GENO_ARP_SLIDE_END_STEP = GENO_ARP_STEPS_PER_BAR - 1;

export type GenoArpSlideAnchor = 'mid' | 'end';

export type GenoUltraArpPerformanceGetters = {
  getArpLegato?: () => boolean;
  getArpSlide?: () => boolean;
  getArpPortamentoMs?: () => number;
  getArpSlideAnchor?: () => GenoArpSlideAnchor;
};

export function genoArpSlideShouldGlide(gridCol: number, anchor: GenoArpSlideAnchor): boolean {
  const step = genoArpStepInBar(gridCol);
  if (anchor === 'mid') return step === GENO_ARP_SLIDE_MID_STEP;
  return step === GENO_ARP_SLIDE_END_STEP;
}

export function genoArpPortamentoSec(ms: number): number {
  return Math.max(0.012, Math.min(0.55, ms / 1000));
}
