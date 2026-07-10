/**
 * Multi-sample map builder — velocity layers × round-robin zones per articulation.
 * Real Shreddage-style libraries ship one WAV per zone; this builder can expand
 * prototype assets into the full grid until DI multis are recorded.
 */
import type { GuitarLickDef } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import {
  GUITAR_ENGINE_MIN_ROUND_ROBIN,
  GUITAR_ENGINE_MIN_VELOCITY_LAYERS,
  type GuitarEngineArticulation,
  type GuitarSampleAsset,
  type GuitarSampleMap,
  type GuitarSampleZone,
} from '@/app/lib/studio/guitarEngine/types';

const VELOCITY_BREAKPOINTS: readonly [number, number][] = [
  [1, 31],
  [32, 63],
  [64, 95],
  [96, 127],
];

export type BuildSampleMapOpts = {
  instrumentId: string;
  label: string;
  licks: readonly GuitarLickDef[];
  articulationByLickId?: Partial<Record<string, GuitarEngineArticulation>>;
  midiSpan?: { lo: number; hi: number };
  velocityLayers?: number;
  roundRobin?: number;
};

function zoneId(
  articulation: GuitarEngineArticulation,
  midi: number,
  velLo: number,
  rr: number,
): string {
  return `${articulation}:${midi}:${velLo}:${rr}`;
}

/** Expand one-shots into a professional zone grid (4 vel × 4 RR minimum). */
export function buildGuitarSampleMap(opts: BuildSampleMapOpts): GuitarSampleMap {
  const velocityLayers = Math.max(GUITAR_ENGINE_MIN_VELOCITY_LAYERS, opts.velocityLayers ?? 4);
  const roundRobin = Math.max(GUITAR_ENGINE_MIN_ROUND_ROBIN, opts.roundRobin ?? 4);
  const midiLo = opts.midiSpan?.lo ?? 40;
  const midiHi = opts.midiSpan?.hi ?? 84;

  const assets: Record<string, GuitarSampleAsset> = {};
  const zones: GuitarSampleZone[] = [];

  for (const lick of opts.licks) {
    const assetId = `asset:${lick.id}`;
    assets[assetId] = {
      id: assetId,
      url: lick.url,
      rootMidi: lick.rootMidi,
      positionId: 'pos_mid',
    };

    const articulation =
      opts.articulationByLickId?.[lick.id] ??
      (lick.tag === 'rhythm' ? 'palm_mute' : lick.tag === 'clean' ? 'sustain' : 'sustain');

    const spanLo = Math.max(midiLo, lick.rootMidi - 7);
    const spanHi = Math.min(midiHi, lick.rootMidi + 7);

    for (let midi = spanLo; midi <= spanHi; midi += 1) {
      for (let layer = 0; layer < velocityLayers; layer += 1) {
        const [velLo, velHi] = VELOCITY_BREAKPOINTS[layer] ?? [
          Math.floor((layer / velocityLayers) * 127),
          Math.floor(((layer + 1) / velocityLayers) * 127),
        ];
        for (let rr = 0; rr < roundRobin; rr += 1) {
          zones.push({
            zoneId: zoneId(articulation, midi, velLo, rr),
            articulation,
            midiLo: midi,
            midiHi: midi,
            rootMidi: lick.rootMidi,
            velocityLo: velLo,
            velocityHi: velHi,
            roundRobinIndex: rr,
            assetId,
            fretAtRoot: Math.max(0, lick.rootMidi - 40),
            stringIndex: midi % 6,
            detuneCents: rr === 0 ? 0 : [-3, 2, -1, 4][rr % 4],
          });
        }
      }
    }
  }

  return {
    version: 1,
    instrumentId: opts.instrumentId,
    label: opts.label,
    assets,
    zones,
    velocityLayerCount: velocityLayers,
    roundRobinCount: roundRobin,
  };
}

/** Find all zones matching note + articulation (before RR / velocity filter). */
export function guitarZonesForNote(
  map: GuitarSampleMap,
  midi: number,
  articulation: GuitarEngineArticulation,
): GuitarSampleZone[] {
  return map.zones.filter(
    (z) =>
      z.articulation === articulation &&
      midi >= z.midiLo &&
      midi <= z.midiHi,
  );
}
