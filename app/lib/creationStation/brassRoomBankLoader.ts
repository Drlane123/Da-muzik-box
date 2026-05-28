/**
 * Load Brass Room trap kit from `public/samples/brass-room/` when files are present.
 */

import { padSampleKey, type StoredPadSample } from '@/app/lib/padSampleStorage';

import { BRASS_ROOM_BANK_INDEX, BRASS_ROOM_KIT_DISPLAY_NAME } from '@/app/lib/creationStation/beatLabFolderImport';

const MANIFEST_URL = '/samples/brass-room/manifest.json';

type ManifestEntry = { pad: number; file: string; label: string };
type Manifest = {
  kitName?: string;
  bankIndex?: number;
  files: ManifestEntry[];
};

export type LoadedBrassRoomPad = {
  pad: number;
  label: string;
  buffer: AudioBuffer;
  stored: StoredPadSample;
};

async function fetchAudio(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.arrayBuffer();
}

function abToBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(binary);
}

/** Try loading shipped/public Brass Room samples. Returns pads that loaded. */
export async function loadBrassRoomBankFromPublic(
  ctx: BaseAudioContext,
): Promise<{ bankIndex: number; pads: LoadedBrassRoomPad[]; kitName: string }> {
  const manifestResp = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  if (!manifestResp.ok) throw new Error('manifest missing');
  const manifest = (await manifestResp.json()) as Manifest;
  const bankIndex =
    typeof manifest.bankIndex === 'number' ? Math.max(0, Math.min(7, manifest.bankIndex)) : BRASS_ROOM_BANK_INDEX;
  const kitName = manifest.kitName?.trim() || BRASS_ROOM_KIT_DISPLAY_NAME;
  const pads: LoadedBrassRoomPad[] = [];

  await Promise.all(
    (manifest.files ?? []).map(async (entry) => {
      const pad = Math.max(0, Math.min(15, Math.floor(entry.pad)));
      const url = `/samples/brass-room/${entry.file}`;
      try {
        const ab = await fetchAudio(url);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const mime = entry.file.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
        const stored: StoredPadSample = {
          mime,
          data: abToBase64(ab),
          label: entry.label.trim() || `Pad ${pad + 1}`,
        };
        pads.push({ pad, label: stored.label!, buffer, stored });
      } catch {
        /* file not on disk yet */
      }
    }),
  );

  pads.sort((a, b) => a.pad - b.pad);
  return { bankIndex, pads, kitName };
}

export function brassRoomBankStorageKeys(bankIndex: number): string[] {
  return Array.from({ length: 16 }, (_, pad) => padSampleKey(bankIndex, pad));
}
