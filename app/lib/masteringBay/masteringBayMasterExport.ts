/** Master export: offline render → tag → Save As / download. */

import type { MasteringBayClipEditState } from '@/app/lib/masteringBay/masteringBayClipEdit';
import { buildId3v23Tag, prependId3ToFile } from '@/app/lib/masteringBay/masteringBayId3Tag';
import {
  masterExportFilename,
  metadataToTagMap,
  validateMasterMetadata,
  type MasterExportRequest,
} from '@/app/lib/masteringBay/masteringBayMetadata';
import { renderMasteringBayOffline } from '@/app/lib/masteringBay/masteringBayOfflineRender';
import type { MasteringBayRackState } from '@/app/lib/masteringBay/masteringBayPresets';
import { encodeWavPcm24 } from '@/app/lib/masteringBay/masteringBayWavEncode';

export type MasterExportProgress = (message: string) => void;

async function saveBytesWithPicker(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<void> {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
    type: mimeType,
  });

  // Native Save As when available (Chromium).
  const w = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  };

  if (typeof w.showSaveFilePicker === 'function') {
    const ext = filename.toLowerCase().endsWith('.mp3') ? '.mp3' : '.wav';
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: ext === '.mp3' ? 'MP3 audio' : 'WAV audio',
          accept: { [mimeType]: [ext] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  // Fallback: browser download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Render mastered audio, embed ID3 metadata (incl. TSRC + APIC), then Save As.
 */
export async function exportMasteredTrack(args: {
  clipEdit: MasteringBayClipEditState;
  rackState: MasteringBayRackState;
  request: MasterExportRequest;
  onProgress?: MasterExportProgress;
}): Promise<string> {
  const { clipEdit, rackState, request, onProgress } = args;
  const err = validateMasterMetadata(request.metadata);
  if (err) throw new Error(err);

  onProgress?.('Rendering master…');
  const rendered = await renderMasteringBayOffline(clipEdit, rackState, request.sampleRate);

  onProgress?.('Encoding WAV…');
  // Primary deliverable: 24-bit PCM WAV. MP3 option falls back to WAV until an encoder is added.
  const wavBytes = encodeWavPcm24(rendered);

  onProgress?.('Embedding metadata…');
  const tags = metadataToTagMap(request.metadata);
  const id3 = buildId3v23Tag(tags, request.coverArt);
  const tagged = prependId3ToFile(id3, wavBytes);

  const filename = masterExportFilename(request.metadata, 'wav');
  onProgress?.('Saving…');
  await saveBytesWithPicker(tagged, filename, 'audio/wav');
  return filename;
}
