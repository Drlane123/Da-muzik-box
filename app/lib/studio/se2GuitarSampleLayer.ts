/**
 * SE2 Guitar — hybrid sample engine (guitarEngine) + smplr fallback blend.
 */
import type { Se2GuitarArticulationId } from '@/app/lib/studio/se2GuitarArticulation';
import {
  se2SanitizeGuitarInstrumentId,
  type Se2GuitarInstrumentId,
} from '@/app/lib/studio/se2GuitarInstruments';
import { scheduleGuitarEngineNote } from '@/app/lib/studio/guitarEngine/factory';

const INSTRUMENT_LICK_LEGACY = {
  acoustic_guitar_nylon: 'lickSample_cleanPick',
  acoustic_guitar_steel: 'lickSample_cleanPick',
  electric_guitar_jazz: 'lickSample_neoSoulBend',
  electric_guitar_clean: 'lickSample_wahClean',
  electric_guitar_muted: 'lickSample_palmMute',
  overdriven_guitar: 'lickSample_wahDrive',
  distortion_guitar: 'lickSample_arenaHook',
  guitar_harmonics: 'lickSample_chimeHarmonic',
} as const satisfies Record<Se2GuitarInstrumentId, string>;

export type Se2GuitarSampleLayerOpts = {
  articulation?: Se2GuitarArticulationId;
  /** 0–1 blend weight for the DI sample under smplr. */
  blend?: number;
};

/**
 * Play hybrid engine note (RR × velocity zones + resonance) into FX chain input.
 */
export function scheduleSe2GuitarSampleLayer(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  durationSec: number,
  midi: number,
  velocity127: number,
  instrumentId: string,
  opts?: Se2GuitarSampleLayerOpts,
): boolean {
  const inst = se2SanitizeGuitarInstrumentId(instrumentId);
  const blend = Math.max(0.12, Math.min(0.62, opts?.blend ?? 0.38));

  const blendBus = ctx.createGain();
  blendBus.gain.value = blend;
  blendBus.connect(destination);

  const played = scheduleGuitarEngineNote(
    ctx,
    blendBus,
    when,
    durationSec,
    midi,
    velocity127,
    inst,
    opts?.articulation,
  );

  return played;
}

/** @deprecated Use guitarEngine round-robin — kept for hybrid layer pan humanize. */
export function se2GuitarRoundRobinHumanize(): { detuneCents: number; pan: number } {
  const detunes = [-4, 2, -1, 3];
  const pans = [-0.12, 0.14, -0.06, 0.08];
  const slot = Math.floor(Math.random() * 4);
  return { detuneCents: detunes[slot]!, pan: pans[slot]! };
}

export async function warmupSe2GuitarSampleLayer(ctx: AudioContext): Promise<void> {
  const { preloadGuitarLickBank } = await import('@/app/lib/creationStation/grooveLabGuitarLickBank');
  await preloadGuitarLickBank(ctx);
}

export function se2GuitarResolveSampleLick(
  instrumentId: string,
  articulation?: Se2GuitarArticulationId,
): string {
  const id = se2SanitizeGuitarInstrumentId(instrumentId);
  if (articulation === 'pm') return 'lickSample_palmMute';
  if (articulation === 'hp') return 'lickSample_cleanPick';
  return INSTRUMENT_LICK_LEGACY[id] ?? 'lickSample_cleanPick';
}
