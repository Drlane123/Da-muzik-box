/**
 * Beat Lab — built-in sound families (bundled in the app under public/samples/sound-families/).
 */

import {
  defaultPadSamplerPlaybackOpts,
  type PadSamplerPlaybackOpts,
} from '@/app/lib/padSampleStorage';
import { CREATION_PAD_NAMES } from '@/app/lib/sessionChannelTracks';

import bundledCatalogJson from '../../../public/samples/sound-families/catalog.json';

const CATALOG_URL = '/samples/sound-families/catalog.json';
const SAMPLE_BASE = '/samples/sound-families/';

export const BUILTIN_SOUND_FAMILIES_TITLE = 'Built-in Trap Kit';
export const BUILTIN_SOUND_FAMILIES_SUBTITLE = '808s · claps · kicks · hats — always in the app';

export type SoundFamilySample = {
  file: string;
  title: string;
};

export type SoundFamily = {
  id: string;
  label: string;
  defaultPad: number;
  samples: SoundFamilySample[];
};

export type SoundFamiliesCatalog = {
  id: string;
  title: string;
  subtitle?: string;
  bankIndex: number;
  families: SoundFamily[];
  builtAt?: string;
};

/** Shipped with the app so Sound Families works without a separate build step. */
const BUNDLED_CATALOG = bundledCatalogJson as SoundFamiliesCatalog;

let cachedCatalog: SoundFamiliesCatalog | null = null;
let catalogPromise: Promise<SoundFamiliesCatalog | null> | null = null;

function normalizeCatalog(data: SoundFamiliesCatalog | null): SoundFamiliesCatalog | null {
  if (!data?.families?.length) return null;
  return {
    ...data,
    title: BUILTIN_SOUND_FAMILIES_TITLE,
    subtitle: BUILTIN_SOUND_FAMILIES_SUBTITLE,
  };
}

export async function fetchSoundFamiliesCatalog(): Promise<SoundFamiliesCatalog | null> {
  if (cachedCatalog) return cachedCatalog;
  if (!catalogPromise) {
    catalogPromise = (async () => {
      try {
        const resp = await fetch(CATALOG_URL, { cache: 'no-cache' });
        if (resp.ok) {
          const data = normalizeCatalog((await resp.json()) as SoundFamiliesCatalog);
          if (data) {
            cachedCatalog = data;
            return data;
          }
        }
      } catch {
        /* use bundled catalog */
      }
      const bundled = normalizeCatalog(BUNDLED_CATALOG);
      if (bundled) cachedCatalog = bundled;
      return bundled;
    })();
  }
  return catalogPromise;
}

export function soundFamilySampleUrl(relFile: string): string {
  return `${SAMPLE_BASE}${relFile.replace(/^\//, '')}`;
}

export function familyInstrumentLabel(pad: number, sampleTitle: string): string {
  const lane = CREATION_PAD_NAMES[pad] ?? `Pad ${pad + 1}`;
  const short = sampleTitle.length > 34 ? `${sampleTitle.slice(0, 34)}…` : sampleTitle;
  return `${lane} — ${short}`;
}

export function samplerOptsForFamily(familyId: string, pad: number): PadSamplerPlaybackOpts {
  const d = defaultPadSamplerPlaybackOpts();
  if (familyId === '808-sub' || pad === 15) {
    return { ...d, triggerSnap: 0.48, fineSemi: -5, lpHz: 2800, trim0: 0, trim1: 1 };
  }
  if (familyId === 'kick' || pad === 0) {
    return { ...d, triggerSnap: 0.38, fineSemi: -1 };
  }
  if (familyId === 'clap' || pad === 2) {
    return { ...d, triggerSnap: 0.34 };
  }
  return d;
}

export async function fetchAndDecodeFamilySample(
  relFile: string,
  ctx: BaseAudioContext,
): Promise<AudioBuffer> {
  const url = soundFamilySampleUrl(relFile);
  const resp = await fetch(url, { cache: 'force-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const ab = await resp.arrayBuffer();
  return await ctx.decodeAudioData(ab.slice(0));
}

/** Primary 808 family (main file in sound families bank). */
export function primary808Family(catalog: SoundFamiliesCatalog): SoundFamily | undefined {
  return catalog.families.find((f) => f.id === '808-sub') ?? catalog.families[0];
}
