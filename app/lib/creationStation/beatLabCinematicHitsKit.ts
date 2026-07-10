/**
 * Beat Pads — Cinematic Hits kit (14 pads).
 * Curated orchestra stabs from SE2 instrument picker: cinematic impacts (+ filtered),
 * tight strings, and sharp brass stab.
 */

import type { BeatLabProducerKitMeta, BeatLabProducerPadDef } from '@/app/lib/creationStation/beatLabProducerKits';
import type { PadSamplerPlaybackOpts } from '@/app/lib/padSampleStorage';

const CINE_WAV = 'orchestra-hits/trap-cinematic-hit.wav';

/** Short sharp one-shots — drum-pad punch. */
const CINE_STAB: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.44,
  trim0: 0,
  trim1: 0.98,
  maxPlaySec: 1.35,
  padLevel: 118,
};

const ORCH_STAB: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.36,
  trim0: 0,
  trim1: 0.98,
  maxPlaySec: 1.35,
  padLevel: 112,
};

export const BEAT_LAB_CINEMATIC_HITS_PADS: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: CINE_WAV, label: 'Cinematic Impact', rootMidi: 48, chromatic: true, sampler: CINE_STAB },
  {
    pad: 1,
    localFile: CINE_WAV,
    label: 'Cine Impact Dark',
    rootMidi: 48,
    chromatic: true,
    sampler: { ...CINE_STAB, lpHz: 1050 },
  },
  {
    pad: 2,
    localFile: CINE_WAV,
    label: 'Cine Impact Sub',
    rootMidi: 48,
    chromatic: true,
    sampler: { ...CINE_STAB, lpHz: 880, fineSemi: -1, padLevel: 122 },
  },
  {
    pad: 3,
    localFile: CINE_WAV,
    label: 'Cine Impact Bright',
    rootMidi: 48,
    chromatic: true,
    sampler: { ...CINE_STAB, hpHz: 340, padLevel: 114 },
  },
  {
    pad: 4,
    localFile: CINE_WAV,
    label: 'Cine Impact Filter',
    rootMidi: 48,
    chromatic: true,
    sampler: { ...CINE_STAB, hpHz: 480, lpHz: 1150 },
  },
  {
    pad: 5,
    localFile: 'orchestra-hits/k2000-symphony-hit.wav',
    label: 'Symphony Hit',
    rootMidi: 48,
    chromatic: true,
    sampler: ORCH_STAB,
  },
  {
    pad: 6,
    localFile: 'orchestra-hits/proteus-brass-hit.wav',
    label: 'Brass Impact',
    rootMidi: 48,
    chromatic: true,
    sampler: ORCH_STAB,
  },
  {
    pad: 7,
    localFile: 'orchestra-hits/jv2080-symphony-hit.wav',
    label: 'Big Brass Hit',
    rootMidi: 48,
    chromatic: true,
    sampler: ORCH_STAB,
  },
  {
    pad: 8,
    localFile: 'orchestra-hits/sc88-orchestra-hit.wav',
    label: 'Classic Orch Hit',
    rootMidi: 48,
    chromatic: true,
    sampler: ORCH_STAB,
  },
  {
    pad: 9,
    localFile: 'orchestra-hits/choir-stab.wav',
    label: 'Choir Stab',
    rootMidi: 60,
    chromatic: true,
    sampler: ORCH_STAB,
  },
  {
    pad: 10,
    localFile: 'orchestra-hits/trap-orchestra-stab.wav',
    label: 'Tight Low Strings',
    rootMidi: 48,
    chromatic: true,
    sampler: { ...ORCH_STAB, triggerSnap: 0.38 },
  },
  {
    pad: 11,
    localFile: 'orchestra-hits/pizz-stab.wav',
    label: 'Pizzicato Stab',
    rootMidi: 60,
    chromatic: true,
    sampler: { ...ORCH_STAB, maxPlaySec: 0.9 },
  },
  {
    pad: 12,
    localFile: 'orchestra-hits/pizz-chord-stab.wav',
    label: 'Pizz Chord',
    rootMidi: 72,
    chromatic: true,
    sampler: { ...ORCH_STAB, maxPlaySec: 1.0 },
  },
  {
    pad: 13,
    localFile: 'orchestra-hits/tg500-brass-stab.wav',
    label: 'Sharp Brass Stab',
    rootMidi: 48,
    chromatic: true,
    sampler: ORCH_STAB,
  },
];

export const BEAT_LAB_CINEMATIC_HITS_KIT_META: BeatLabProducerKitMeta = {
  id: 'cinematicHits',
  title: 'Cinematic Hits',
  tribute: '14 curated stabs — cinematic impacts, tight strings & sharp brass. Full keyboard pitch per pad.',
  pads: BEAT_LAB_CINEMATIC_HITS_PADS,
};

export const BEAT_LAB_CINEMATIC_HITS_KIT_REV = 1;

export const BEAT_LAB_CINEMATIC_HITS_ATTRIBUTION =
  'Cinematic Hits: bundled orchestra stabs (cinematic impacts, strings, brass).';
