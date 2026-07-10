/**
 * Retrologue-style ARP CTRL lanes — per-step modulation destinations.
 */
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { GENO_ULTRA_FILTER_OPEN_HZ } from '@/app/lib/studio/genoUltraSynthTypes';

export type GenoArpCtrlDest =
  | 'filterCutoff'
  | 'filterRes'
  | 'ampLevel'
  | 'osc1Pitch';

export const GENO_ARP_CTRL_DEST_OPTIONS: readonly { id: GenoArpCtrlDest; label: string }[] = [
  { id: 'filterCutoff', label: 'Cutoff' },
  { id: 'filterRes', label: 'Resonance' },
  { id: 'ampLevel', label: 'Amp' },
  { id: 'osc1Pitch', label: 'Pitch' },
];

export type GenoArpCtrlLaneMod = {
  /** 0–1 step level × depth (already scaled). */
  amount: number;
  dest: GenoArpCtrlDest;
  enabled: boolean;
};

/**
 * Apply Retrologue CTRL lane values onto a dry voice for one ARP step.
 * Dry baseline stays open/clean; CTRL bars open filter / add movement from a dark floor.
 */
export function genoUltraApplyArpCtrlLanes(
  voice: GenoUltraSynthVoiceParams,
  lanes: readonly GenoArpCtrlLaneMod[],
): GenoUltraSynthVoiceParams {
  /** Start from the dry body’s cutoff/res — CTRL bars open/brighten from there. */
  let cutoff = voice.filterCutoffHz;
  let res = voice.filterResonanceQ;
  let ampMul = 1;
  let pitchCents = 0;
  let any = false;
  const cutFloor = Math.max(80, voice.filterCutoffHz);
  const resFloor = Math.max(0.1, voice.filterResonanceQ);

  for (const lane of lanes) {
    if (!lane.enabled || lane.amount < 0.001) continue;
    any = true;
    const a = Math.max(0, Math.min(1, lane.amount));
    switch (lane.dest) {
      case 'filterCutoff':
        cutoff = cutFloor + a * (GENO_ULTRA_FILTER_OPEN_HZ - cutFloor);
        break;
      case 'filterRes':
        res = resFloor + a * (4.5 - resFloor);
        break;
      case 'ampLevel':
        ampMul *= 0.35 + a * 0.65;
        break;
      case 'osc1Pitch':
        pitchCents += a * 700;
        break;
      default:
        break;
    }
  }

  if (!any) return voice;

  const osc1 = { ...voice.osc1 };
  if (Math.abs(pitchCents) > 0.5) {
    osc1.fineCents = (osc1.fineCents ?? 0) + pitchCents;
  }

  return {
    ...voice,
    filterMode: 'lowpass',
    filterCutoffHz: Math.max(80, Math.min(GENO_ULTRA_FILTER_OPEN_HZ, cutoff)),
    filterResonanceQ: Math.max(0.1, Math.min(8, res)),
    /** Keep Odyssey filter-env punch from the dry body; CTRL only shifts the floor. */
    outputLevel: Math.max(0.05, Math.min(1, (voice.outputLevel ?? 0.65) * ampMul)),
    osc1,
  };
}

/** Extra semitones from pitch CTRL (for scheduler midi offset). */
export function genoUltraArpCtrlPitchSemis(lanes: readonly GenoArpCtrlLaneMod[]): number {
  let cents = 0;
  for (const lane of lanes) {
    if (!lane.enabled || lane.dest !== 'osc1Pitch') continue;
    cents += Math.max(0, Math.min(1, lane.amount)) * 700;
  }
  return cents / 100;
}
