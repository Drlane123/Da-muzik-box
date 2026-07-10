/**
 * Factory — builds engine + sample map from guitar-licks bank.
 */
import { BAKED_GUITAR_LICK_MANIFEST } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import type { Se2GuitarArticulationId } from '@/app/lib/studio/se2GuitarArticulation';
import { GuitarSamplePlaybackEngine } from '@/app/lib/studio/guitarEngine/samplePlaybackEngine';
import { buildGuitarSampleMap } from '@/app/lib/studio/guitarEngine/sampleMap';
import type { GuitarEngineArticulation } from '@/app/lib/studio/guitarEngine/types';

const SE2_TO_ENGINE_ARTICULATION: Record<Se2GuitarArticulationId, GuitarEngineArticulation> = {
  sus: 'sustain',
  pm: 'palm_mute',
  hp: 'legato',
};

const LICK_ARTICULATION: Partial<Record<string, GuitarEngineArticulation>> = {
  lickSample_palmMute: 'palm_mute',
  lickSample_chimeHarmonic: 'harmonic',
  lickSample_wahClean: 'sustain',
  lickSample_cleanPick: 'sustain',
};

const engineByDest = new WeakMap<AudioNode, GuitarSamplePlaybackEngine>();

export function se2ArticulationToEngine(id: Se2GuitarArticulationId): GuitarEngineArticulation {
  return SE2_TO_ENGINE_ARTICULATION[id] ?? 'sustain';
}

export function getOrCreateGuitarSampleEngine(
  ctx: AudioContext,
  destination: AudioNode,
  instrumentId: string,
): GuitarSamplePlaybackEngine {
  let engine = engineByDest.get(destination);
  if (!engine) {
    const map = buildGuitarSampleMap({
      instrumentId,
      label: `Guitar Engine — ${instrumentId}`,
      licks: BAKED_GUITAR_LICK_MANIFEST,
      articulationByLickId: LICK_ARTICULATION,
      midiSpan: { lo: 40, hi: 84 },
    });
    engine = new GuitarSamplePlaybackEngine(ctx, destination, map, {
      sampleBlend: 0.62,
      resonanceBlend: 0.45,
      sympatheticStrings: false,
    });
    engineByDest.set(destination, engine);
  }
  return engine;
}

export function scheduleGuitarEngineNote(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  durationSec: number,
  midi: number,
  velocity127: number,
  instrumentId: string,
  articulation?: Se2GuitarArticulationId,
): boolean {
  const engine = getOrCreateGuitarSampleEngine(ctx, destination, instrumentId);
  if (articulation) {
    engine.setArticulation(se2ArticulationToEngine(articulation));
  }
  return engine.noteOn(midi, velocity127, when, durationSec);
}
