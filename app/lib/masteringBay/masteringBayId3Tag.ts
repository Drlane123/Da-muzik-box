/** Minimal ID3v2.3 writer — TIT2/TPE1/TALB/TYER/TCON/TSRC + APIC cover art. */

import type { MasterExportCoverArt, MasterMetadataTagMap } from '@/app/lib/masteringBay/masteringBayMetadata';

function encodeSynchsafe(size: number): Uint8Array {
  return new Uint8Array([
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f,
  ]);
}

function textFrame(id: string, text: string): Uint8Array {
  if (!text) return new Uint8Array(0);
  const body = new Uint8Array(1 + text.length);
  body[0] = 0x00; // ISO-8859-1
  for (let i = 0; i < text.length; i++) body[i + 1] = text.charCodeAt(i) & 0xff;
  return frame(id, body);
}

function frame(id: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(10 + body.length);
  out[0] = id.charCodeAt(0);
  out[1] = id.charCodeAt(1);
  out[2] = id.charCodeAt(2);
  out[3] = id.charCodeAt(3);
  const size = body.length;
  out[4] = (size >> 24) & 0xff;
  out[5] = (size >> 16) & 0xff;
  out[6] = (size >> 8) & 0xff;
  out[7] = size & 0xff;
  out[8] = 0;
  out[9] = 0;
  out.set(body, 10);
  return out;
}

function apicFrame(cover: MasterExportCoverArt): Uint8Array {
  const mime = cover.mimeType; // image/jpeg | image/png
  const mimeBytes = new TextEncoder().encode(mime);
  // encoding(1) + mime + \0 + picType(1) + desc\0 + image
  const body = new Uint8Array(1 + mimeBytes.length + 1 + 1 + 1 + cover.bytes.length);
  let o = 0;
  body[o++] = 0x00;
  body.set(mimeBytes, o);
  o += mimeBytes.length;
  body[o++] = 0x00;
  body[o++] = 0x03; // front cover
  body[o++] = 0x00; // empty description
  body.set(cover.bytes, o);
  return frame('APIC', body);
}

function concatFrames(frames: Uint8Array[]): Uint8Array {
  const total = frames.reduce((n, f) => n + f.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const f of frames) {
    out.set(f, o);
    o += f.length;
  }
  return out;
}

/** Build a complete ID3v2.3 tag buffer (header + frames). */
export function buildId3v23Tag(
  tags: MasterMetadataTagMap,
  coverArt: MasterExportCoverArt | null,
): Uint8Array {
  const frames: Uint8Array[] = [];
  const push = (f: Uint8Array) => {
    if (f.length) frames.push(f);
  };
  push(textFrame('TIT2', tags.TIT2));
  push(textFrame('TPE1', tags.TPE1));
  push(textFrame('TALB', tags.TALB));
  push(textFrame('TYER', tags.TYER));
  push(textFrame('TCON', tags.TCON));
  push(textFrame('TSRC', tags.TSRC));
  if (coverArt && coverArt.bytes.length > 0) push(apicFrame(coverArt));

  const body = concatFrames(frames);
  const header = new Uint8Array(10);
  header[0] = 0x49; // I
  header[1] = 0x44; // D
  header[2] = 0x33; // 3
  header[3] = 0x03; // v2.3
  header[4] = 0x00;
  header[5] = 0x00; // flags
  header.set(encodeSynchsafe(body.length), 6);
  const out = new Uint8Array(10 + body.length);
  out.set(header, 0);
  out.set(body, 10);
  return out;
}

/** Prepend ID3v2 tag to a WAV (or any) file — widely supported for tagged masters. */
export function prependId3ToFile(id3: Uint8Array, fileBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(id3.length + fileBytes.length);
  out.set(id3, 0);
  out.set(fileBytes, id3.length);
  return out;
}
