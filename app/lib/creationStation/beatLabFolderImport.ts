/**
 * Trap / producer drum-folder import — map files to Beat Lab pads + clean instrument names.
 * Uses fictional kit name only in labels (no real producer names in the UI).
 */

import { CREATION_PAD_NAMES } from '@/app/lib/sessionChannelTracks';
import {
  defaultPadSamplerPlaybackOpts,
  type PadSamplerPlaybackOpts,
} from '@/app/lib/padSampleStorage';

import {
  assignFolderFilesToPads,
  isBeatLabAudioFile,
  normalizeSampleFilename,
  type FolderImportAssignment,
} from '@/app/lib/creationStation/beatLabSampleImport';

/** Default sampler bank for built-in / imported trap drums (Bank B). */
export const BRASS_ROOM_BANK_INDEX = 1;

export const BRASS_ROOM_KIT_DISPLAY_NAME = 'Built-in Kit';

/** Strip brand tokens from display labels. */
const STRIP_BRAND_RE =
  /\b(lex|luger|lexluger|dj\s*mustard|mustard|metro|boomin|tm88|spinz|zaytoven|southside|808\s*mafia|trapaholics|trapa\s*holics|cassius|thugger|deedot)\b/gi;

export function fileImportSearchPath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return rel ? rel.replace(/\\/g, '/') : file.name;
}

/** Guess pad from folder path + filename (producer drum pack layout). */
export function guessPadIndexFromImportFile(file: File): number | null {
  const path = fileImportSearchPath(file);
  const pathLower = path.toLowerCase();
  const n = normalizeSampleFilename(path.split('/').pop() ?? file.name);
  const full = normalizeSampleFilename(path.replace(/\//g, ' '));

  if (/\/claps?\b|\/claps?\//.test(pathLower) || /^claps?\b/.test(full)) return 2;
  if (/\/snares?\b|\/snares?\//.test(pathLower)) return 1;
  if (/\/open[\s_-]?h|\/oh\b|\/open hh/.test(pathLower) || /\bopen\b.*\bhat\b/.test(n)) return 4;
  if (/\/hihat|\/hh\b|\/hats?\b|\/closed/.test(pathLower)) return 3;
  if (/\/808s?\b|\/subs?\b|\/sub[\s_-]?bass/.test(pathLower)) {
    if (/long|haul|tail|max|low|sub\b/.test(n) || /long|haul/.test(full)) return 15;
    if (/kick|bd|knock/.test(n)) return 0;
    return 15;
  }
  if (/\/kicks?\b|\/kick/.test(pathLower)) return /sub|808|long/.test(n) ? 15 : 0;
  if (/\/perc|\/fx|\/hits?\b|\/stabs?\b/.test(pathLower)) return 8;
  if (/\/cym|\/crash/.test(pathLower)) return 10;
  if (/\/ride/.test(pathLower)) return 11;
  if (/\/rim/.test(pathLower)) return 7;
  if (/\/cow/.test(pathLower)) return 13;
  if (/\/tamb|\/shake/.test(pathLower)) return 12;

  if (/\b808\b.*\b(long|haul|tail|sub|bass)\b|\b(long|haul)\b.*\b808\b/.test(full)) return 15;
  if (/\b808\b.*\b(kick|bd)\b|\bkick\b.*\b808\b/.test(full)) return 0;
  if (/\bclap\b/.test(n)) return 2;
  if (/\bsnare\b|\bsnr\b/.test(n)) return 1;
  if (/\bopen\b.*\bhat\b|\boh\b/.test(n)) return 4;
  if (/\bhat\b|\bhh\b|\bch\b/.test(n)) return 3;
  if (/\b808\b/.test(n) && !/kick|snare|clap|hat/.test(n)) return 15;
  if (/\bkick\b|\bdk\b|\bbd\b/.test(n)) return 0;
  if (/\bhit\b|\bstab\b|\bfx\b/.test(n)) return 9;
  if (/\bsnap\b/.test(n)) return 14;

  return null;
}

export type TrapFolderAssignment = FolderImportAssignment & {
  /** Clean instrument name for sampler + sequencer lane. */
  label: string;
};

/**
 * Map folder → pads with trap-style paths; leftovers fill empty pads.
 * Labels use lane name + shortened file title (brands stripped).
 */
export function assignTrapDrumFolderToPads(files: File[], kitName = BRASS_ROOM_KIT_DISPLAY_NAME): TrapFolderAssignment[] {
  const audio = files.filter((f) => isBeatLabAudioFile(f.name));
  audio.sort((a, b) => fileImportSearchPath(a).localeCompare(fileImportSearchPath(b), undefined, { sensitivity: 'base' }));

  const usedPads = new Set<number>();
  const out: TrapFolderAssignment[] = [];

  for (const file of audio) {
    const guessed = guessPadIndexFromImportFile(file);
    if (guessed != null && !usedPads.has(guessed)) {
      usedPads.add(guessed);
      out.push({
        file,
        pad: guessed,
        label: beatLabInstrumentLabel(guessed, file, kitName),
      });
    }
  }

  const unmatched = audio.filter((f) => !out.some((a) => a.file === f));
  let nextPad = 0;
  for (const file of unmatched) {
    while (nextPad < 16 && usedPads.has(nextPad)) nextPad++;
    if (nextPad >= 16) break;
    usedPads.add(nextPad);
    out.push({
      file,
      pad: nextPad,
      label: beatLabInstrumentLabel(nextPad, file, kitName),
    });
    nextPad++;
  }

  return out;
}

/** Display label: `Kick — 808 long` (lane + cleaned filename). */
export function beatLabInstrumentLabel(
  pad: number,
  file: File,
  kitName = BRASS_ROOM_KIT_DISPLAY_NAME,
): string {
  const lane = CREATION_PAD_NAMES[pad] ?? `Pad ${pad + 1}`;
  let raw = file.name.replace(/\.[^/.]+$/i, '').replace(/[_-]+/g, ' ').replace(STRIP_BRAND_RE, '').trim();
  raw = raw.replace(/\s+/g, ' ');
  if (!raw || raw.length < 2) return `${lane} · ${kitName}`;
  const short = raw.length > 32 ? `${raw.slice(0, 32)}…` : raw;
  return `${lane} — ${short}`;
}

/** Fallback when only filenames are available (no webkitRelativePath). */
export function assignFolderFilesToPadsWithLabels(
  files: File[],
  kitName = BRASS_ROOM_KIT_DISPLAY_NAME,
): TrapFolderAssignment[] {
  const base = assignFolderFilesToPads(files);
  return base.map(({ file, pad }) => ({
    file,
    pad,
    label: beatLabInstrumentLabel(pad, file, kitName),
  }));
}

/** Sampler shaping when importing trap 808 / clap folders. */
export function trapPadSamplerOpts(pad: number): PadSamplerPlaybackOpts {
  const d = defaultPadSamplerPlaybackOpts();
  if (pad === 0) return { ...d, triggerSnap: 0.4, fineSemi: -1, trim0: 0, trim1: 1 };
  if (pad === 15) return { ...d, triggerSnap: 0.48, fineSemi: -6, lpHz: 2800, trim0: 0, trim1: 1 };
  if (pad === 2) return { ...d, triggerSnap: 0.34 };
  if (pad === 1 || pad === 14) return { ...d, triggerSnap: 0.28 };
  return d;
}
