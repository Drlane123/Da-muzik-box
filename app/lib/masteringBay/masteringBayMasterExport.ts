/** Master export: offline render → encode format → tag → Save As / download. */

import type { MasteringBayClipEditState } from '@/app/lib/masteringBay/masteringBayClipEdit';
import { encodeMasterAudioBuffer, formatMimeType } from '@/app/lib/masteringBay/masteringBayEncode';
import { buildId3v23Tag, prependId3ToFile } from '@/app/lib/masteringBay/masteringBayId3Tag';
import {
  masterExportFilename,
  metadataToTagMap,
  validateMasterMetadata,
  type MasterExportFormat,
  type MasterExportRequest,
} from '@/app/lib/masteringBay/masteringBayMetadata';
import { renderMasteringBayOffline } from '@/app/lib/masteringBay/masteringBayOfflineRender';
import type { MasteringBayRackState } from '@/app/lib/masteringBay/masteringBayPresets';

export type MasterExportProgress = (message: string) => void;

const FORMAT_ACCEPT: Record<MasterExportFormat, { description: string; mime: string; ext: string }> = {
  wav: { description: 'WAV audio', mime: 'audio/wav', ext: '.wav' },
  aiff: { description: 'AIFF audio', mime: 'audio/aiff', ext: '.aiff' },
  flac: { description: 'FLAC audio', mime: 'audio/flac', ext: '.flac' },
  caf: { description: 'CAF audio', mime: 'audio/x-caf', ext: '.caf' },
  m4a: { description: 'M4A audio', mime: 'audio/mp4', ext: '.m4a' },
  ogg: { description: 'OGG Vorbis', mime: 'audio/ogg', ext: '.ogg' },
  opus: { description: 'Opus audio', mime: 'audio/ogg', ext: '.opus' },
  mp3: { description: 'MP3 audio', mime: 'audio/mpeg', ext: '.mp3' },
};

async function saveBytesWithPicker(
  bytes: Uint8Array,
  filename: string,
  format: MasterExportFormat,
): Promise<void> {
  const accept = FORMAT_ACCEPT[format];
  const mimeType = accept.mime || formatMimeType(format);
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
    type: mimeType,
  });

  const w = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  };

  if (typeof w.showSaveFilePicker === 'function') {
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: accept.description,
          accept: { [mimeType]: [accept.ext] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

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
 * Render mastered audio, encode to the chosen format, embed ID3 when supported, then Save As.
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

  onProgress?.(`Encoding ${request.format.toUpperCase()}…`);
  const encoded = await encodeMasterAudioBuffer(
    rendered,
    request.format,
    request.bitrateKbps ?? 320,
  );

  let outBytes = encoded.bytes;
  if (encoded.allowId3Prefix) {
    onProgress?.('Embedding metadata…');
    const tags = metadataToTagMap(request.metadata);
    const id3 = buildId3v23Tag(tags, request.coverArt);
    outBytes = prependId3ToFile(id3, encoded.bytes);
  }

  const filename = masterExportFilename(request.metadata, request.format);
  onProgress?.('Saving…');
  await saveBytesWithPicker(outBytes, filename, request.format);
  return filename;
}
