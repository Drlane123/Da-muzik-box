/**
 * Beat Pads — Orchestra stabs / hits kit (16 pads).
 * Short sharp one-shots: brass stabs, symphony hits, pizzicato, cinematic impacts.
 * Bundled WAVs under `public/samples/orchestra-hits/` (sampler-style stabs, not sustains).
 */

import type { BeatLabProducerKitMeta, BeatLabProducerPadDef } from '@/app/lib/creationStation/beatLabProducerKits';
import type { PadSamplerPlaybackOpts } from '@/app/lib/padSampleStorage';

/** Already short stabs — light punch, full sample tail capped for drum-pad feel. */
const ORCH_STAB: Partial<PadSamplerPlaybackOpts> = {
  triggerSnap: 0.34,
  trim0: 0,
  trim1: 0.98,
  maxPlaySec: 1.35,
  padLevel: 112,
};

export const BEAT_LAB_ORCHESTRA_HITS_PADS: readonly BeatLabProducerPadDef[] = [
  { pad: 0, localFile: 'orchestra-hits/k2000-symphony-hit.wav', label: 'K2000 sym', rootMidi: 48, chromatic: true, sampler: ORCH_STAB },
  { pad: 1, localFile: 'orchestra-hits/proteus-brass-hit.wav', label: 'Proteus brs', rootMidi: 48, chromatic: true, sampler: ORCH_STAB },
  { pad: 2, localFile: 'orchestra-hits/jv2080-symphony-hit.wav', label: 'JV2080 hit', rootMidi: 48, chromatic: true, sampler: ORCH_STAB },
  { pad: 3, localFile: 'orchestra-hits/sc88-orchestra-hit.wav', label: 'SC-88 orch', rootMidi: 48, chromatic: true, sampler: ORCH_STAB },
  { pad: 4, localFile: 'orchestra-hits/trap-orchestra-stab.wav', label: 'Orch stab', rootMidi: 48, chromatic: true, sampler: { ...ORCH_STAB, triggerSnap: 0.38 } },
  { pad: 5, localFile: 'orchestra-hits/trap-brass-stab.wav', label: 'Brass stab', rootMidi: 48, chromatic: true, sampler: { ...ORCH_STAB, triggerSnap: 0.4 } },
  { pad: 6, localFile: 'orchestra-hits/pizz-stab.wav', label: 'Pizzicato', rootMidi: 60, chromatic: true, sampler: { ...ORCH_STAB, maxPlaySec: 0.9 } },
  { pad: 7, localFile: 'orchestra-hits/pizz-chord-stab.wav', label: 'Pizz chord', rootMidi: 72, chromatic: true, sampler: { ...ORCH_STAB, maxPlaySec: 1.0 } },
  { pad: 8, localFile: 'orchestra-hits/tg500-brass-stab.wav', label: 'TG brass', rootMidi: 48, chromatic: true, sampler: ORCH_STAB },
  { pad: 9, localFile: 'orchestra-hits/ensoniq-hit-hard.wav', label: 'Hard hit', rootMidi: 48, chromatic: true, sampler: { ...ORCH_STAB, triggerSnap: 0.42 } },
  { pad: 10, localFile: 'orchestra-hits/ensoniq-smack-hit.wav', label: 'Smack hit', rootMidi: 48, chromatic: true, sampler: { ...ORCH_STAB, triggerSnap: 0.4 } },
  { pad: 11, localFile: 'orchestra-hits/ensoniq-hop-hit.wav', label: 'Hop hit', rootMidi: 48, chromatic: true, sampler: ORCH_STAB },
  { pad: 12, localFile: 'orchestra-hits/choir-stab.wav', label: 'Choir stab', rootMidi: 60, chromatic: true, sampler: ORCH_STAB },
  { pad: 13, localFile: 'orchestra-hits/trap-orchestra-crash.wav', label: 'Orch crash', rootMidi: 48, chromatic: true, sampler: { ...ORCH_STAB, maxPlaySec: 1.6 } },
  { pad: 14, localFile: 'orchestra-hits/trap-symphony-crash.wav', label: 'Sym crash', rootMidi: 48, chromatic: true, sampler: { ...ORCH_STAB, maxPlaySec: 1.6 } },
  { pad: 15, localFile: 'orchestra-hits/trap-cinematic-hit.wav', label: 'Cinematic', rootMidi: 48, chromatic: true, sampler: { ...ORCH_STAB, triggerSnap: 0.44, padLevel: 118 } },
];

export const BEAT_LAB_ORCHESTRA_HITS_KIT_META: BeatLabProducerKitMeta = {
  id: 'orchestraHits',
  title: 'Orchestra · Stab Hits',
  tribute: '16 sampler stabs — brass, pizz, symphony & cinematic hits. Full keyboard pitch per pad.',
  pads: BEAT_LAB_ORCHESTRA_HITS_PADS,
};

/** Bump when pad WAVs change — invalidates in-memory producer kit cache. */
export const BEAT_LAB_ORCHESTRA_HITS_KIT_REV = 2;

export const BEAT_LAB_ORCHESTRA_HITS_ATTRIBUTION =
  'Orchestra stabs: bundled one-shots (K2000 / Ensoniq / trap brass & pizz hits).';
