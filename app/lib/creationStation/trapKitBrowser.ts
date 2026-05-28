/**
 * Index a producer drum-kit folder (808s, Claps, Kicks, …) for per-pad loading.
 */

import { CREATION_PAD_NAMES } from '@/app/lib/sessionChannelTracks';

import { fileImportSearchPath } from '@/app/lib/creationStation/beatLabFolderImport';
import { isBeatLabAudioFile } from '@/app/lib/creationStation/beatLabSampleImport';

const STRIP_BRAND_RE = /\b(lex|luger|dj\s*mustard|metro|boomin|808\s*mafia|trapaholics)\b/gi;

export type TrapKitSample = {
  name: string;
  /** Display title (brands stripped). */
  title: string;
  file: File;
};

export type TrapKitCategory = {
  id: string;
  name: string;
  defaultPad: number;
  samples: TrapKitSample[];
};

/** Suggested Beat Lab pad per kit subfolder name. */
const CATEGORY_DEFAULT_PAD: Readonly<Record<string, number>> = {
  '808s': 15,
  '808': 15,
  kicks: 0,
  kick: 0,
  snares: 1,
  snare: 1,
  claps: 2,
  clap: 2,
  'closed hats': 3,
  'closed hat': 3,
  'open hats': 4,
  'open hat': 4,
  hits: 8,
  hit: 8,
  percs: 8,
  perc: 8,
  percussion: 8,
  'crashes & cymbals': 10,
  crashes: 10,
  cymbals: 10,
  fx: 12,
  extras: 9,
  vox: 9,
  tags: 12,
};

const CATEGORY_ORDER = [
  '808s',
  'kicks',
  'snares',
  'claps',
  'closed hats',
  'open hats',
  'hits',
  'percs',
  'crashes & cymbals',
  'fx',
  'extras',
  'vox',
  'tags',
  'other',
];

function normCatKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function cleanTrapSampleTitle(filename: string): string {
  let t = filename.replace(/\.[^/.]+$/i, '').replace(/[_-]+/g, ' ').replace(STRIP_BRAND_RE, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t || filename;
}

export function defaultPadForCategory(categoryName: string): number {
  const k = normCatKey(categoryName);
  if (k in CATEGORY_DEFAULT_PAD) return CATEGORY_DEFAULT_PAD[k]!;
  if (/808/.test(k)) return 15;
  if (/kick/.test(k)) return 0;
  if (/snare/.test(k)) return 1;
  if (/clap/.test(k)) return 2;
  if (/closed/.test(k) || /ch\b/.test(k)) return 3;
  if (/open/.test(k) || /oh\b/.test(k)) return 4;
  if (/hit|stab/.test(k)) return 8;
  if (/crash|cym/.test(k)) return 10;
  if (/ride/.test(k)) return 11;
  return 8;
}

function extractCategoryFolder(file: File): string {
  const path = fileImportSearchPath(file);
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) return 'Other';
  let cat = parts[parts.length - 2]!;
  if (/drumkit|shows the screen/i.test(cat) && parts.length >= 3) {
    cat = parts[parts.length - 3]!;
  }
  return cat.trim() || 'Other';
}

export function indexTrapKitFromFiles(files: File[]): TrapKitCategory[] {
  const audio = files.filter((f) => isBeatLabAudioFile(f.name));
  const map = new Map<string, TrapKitSample[]>();

  for (const file of audio) {
    const folder = extractCategoryFolder(file);
    const key = normCatKey(folder);
    const list = map.get(key) ?? [];
    list.push({
      name: file.name,
      title: cleanTrapSampleTitle(file.name),
      file,
    });
    map.set(key, list);
  }

  const categories: TrapKitCategory[] = [];
  for (const [key, samples] of map) {
    samples.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    const displayName = samples[0]?.file
      ? extractCategoryFolder(samples[0].file)
      : key;
    categories.push({
      id: key,
      name: displayName,
      defaultPad: defaultPadForCategory(displayName),
      samples,
    });
  }

  categories.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(normCatKey(a.name));
    const ib = CATEGORY_ORDER.indexOf(normCatKey(b.name));
    const ao = ia === -1 ? 999 : ia;
    const bo = ib === -1 ? 999 : ib;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return categories;
}

export function trapKitInstrumentLabel(pad: number, sampleTitle: string): string {
  const lane = CREATION_PAD_NAMES[pad] ?? `Pad ${pad + 1}`;
  const short = sampleTitle.length > 36 ? `${sampleTitle.slice(0, 36)}…` : sampleTitle;
  return `${lane} — ${short}`;
}
