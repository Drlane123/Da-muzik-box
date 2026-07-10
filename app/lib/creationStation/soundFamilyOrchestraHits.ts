/**
 * Sound Families — dedicated Orchestra Hits tab (16 stabs from Orchestra · Stab Hits kit).
 * Separate from trap Perc / Hits; same WAVs as `public/samples/orchestra-hits/`.
 */

import { BEAT_LAB_ORCHESTRA_HITS_PADS } from '@/app/lib/creationStation/beatLabOrchestraHitsKit';
import {
  defaultPadSamplerPlaybackOpts,
  type PadSamplerPlaybackOpts,
} from '@/app/lib/padSampleStorage';

import type { SoundFamily } from '@/app/lib/creationStation/soundFamiliesCatalog';

export const ORCHESTRA_HITS_SOUND_FAMILY_ID = 'orchestra-hits';

function normRelFile(relFile: string): string {
  return relFile.replace(/^\//, '').replace(/\\/g, '/');
}

export function orchestraHitsPadDefForFile(relFile: string) {
  const n = normRelFile(relFile);
  return BEAT_LAB_ORCHESTRA_HITS_PADS.find((p) => p.localFile === n);
}

/** Standalone Sound Families row — last tab, 16 kit stabs only. */
export function buildOrchestraHitsSoundFamily(): SoundFamily {
  return {
    id: ORCHESTRA_HITS_SOUND_FAMILY_ID,
    label: 'Orchestra Hits',
    defaultPad: 8,
    samples: BEAT_LAB_ORCHESTRA_HITS_PADS.map((p) => ({
      file: p.localFile,
      title: p.label,
    })),
  };
}

export function orchestraHitsFamilySamplerOpts(relFile: string): PadSamplerPlaybackOpts {
  const base = defaultPadSamplerPlaybackOpts();
  const partial = orchestraHitsPadDefForFile(relFile)?.sampler;
  if (!partial) {
    return {
      ...base,
      triggerSnap: 0.34,
      trim0: 0,
      trim1: 0.98,
      maxPlaySec: 1.35,
      padLevel: 112,
    };
  }
  return {
    hpHz: partial.hpHz ?? base.hpHz,
    lpHz: partial.lpHz ?? base.lpHz,
    trim0: partial.trim0 ?? base.trim0,
    trim1: partial.trim1 ?? base.trim1,
    fineSemi: partial.fineSemi ?? base.fineSemi,
    triggerSnap: partial.triggerSnap ?? base.triggerSnap,
    maxPlaySec: partial.maxPlaySec ?? base.maxPlaySec,
    padLevel: partial.padLevel ?? base.padLevel,
  };
}
