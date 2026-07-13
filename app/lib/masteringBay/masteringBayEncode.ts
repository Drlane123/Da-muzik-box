/**
 * Mastering Bay multi-format encoders.
 * PCM: WAV / AIFF / CAF (24-bit). Lossy: MP3 (lamejs @ bitrate), plus browser MediaRecorder for M4A / OGG / Opus / FLAC when available.
 */
import type { MasterExportBitrateKbps, MasterExportFormat } from '@/app/lib/masteringBay/masteringBayMetadata';
import { formatNeedsBitrate } from '@/app/lib/masteringBay/masteringBayMetadata';
import { encodeWavPcm24 } from '@/app/lib/masteringBay/masteringBayWavEncode';

export type EncodedMaster = {
  bytes: Uint8Array;
  mimeType: string;
  /** True when ID3v2 can be prepended (MP3 / WAV-style). */
  allowId3Prefix: boolean;
};

export { formatNeedsBitrate };

type LameMp3Encoder = {
  encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
  flush: () => Int8Array;
};

type LameMp3EncoderCtor = new (channels: number, sampleRate: number, kbps: number) => LameMp3Encoder;

let lameMp3EncoderCtor: LameMp3EncoderCtor | null = null;

/** Lazy-load LAME so opening Mastering Bay does not parse the MP3 encoder. */
async function getLameMp3EncoderCtor(): Promise<LameMp3EncoderCtor> {
  if (lameMp3EncoderCtor) return lameMp3EncoderCtor;
  const mod = await import('@/app/lib/vendor/lame.min.js');
  lameMp3EncoderCtor = mod.Mp3Encoder as LameMp3EncoderCtor;
  return lameMp3EncoderCtor;
}

function clampSample(s: number): number {
  if (s > 1) return 1;
  if (s < -1) return -1;
  return s;
}

function writeAscii(out: Uint8Array, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i) & 0xff;
}

function getChannels(buffer: AudioBuffer): Float32Array[] {
  const chs: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chs.push(buffer.getChannelData(c));
  return chs;
}

/** AIFF 24-bit PCM (big-endian), stereo/mono. */
export function encodeAiffPcm24(buffer: AudioBuffer): Uint8Array {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 3;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  // FORM + AIFF + COMM(18+8) + SSND(8+8+data)
  const commSize = 18;
  const ssndChunkSize = 8 + dataSize;
  const formSize = 4 + (8 + commSize) + (8 + ssndChunkSize);
  const out = new Uint8Array(8 + formSize);
  const view = new DataView(out.buffer);

  writeAscii(out, 0, 'FORM');
  view.setUint32(4, formSize, false);
  writeAscii(out, 8, 'AIFF');
  writeAscii(out, 12, 'COMM');
  view.setUint32(16, commSize, false);
  view.setUint16(20, numCh, false);
  view.setUint32(22, numFrames, false);
  view.setUint16(26, 24, false);
  // 80-bit IEEE extended float sample rate
  writeExtended80(view, 28, sampleRate);

  writeAscii(out, 38, 'SSND');
  view.setUint32(42, ssndChunkSize, false);
  view.setUint32(46, 0, false); // offset
  view.setUint32(50, 0, false); // block size

  const channels = getChannels(buffer);
  let o = 54;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = clampSample(channels[ch]![i] ?? 0);
      const int = Math.round(s * 8388607);
      out[o++] = (int >> 16) & 0xff;
      out[o++] = (int >> 8) & 0xff;
      out[o++] = int & 0xff;
    }
  }
  void blockAlign;
  return out;
}

/** Write 80-bit extended precision float (AIFF sample rate). */
function writeExtended80(view: DataView, offset: number, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    for (let i = 0; i < 10; i++) view.setUint8(offset + i, 0);
    return;
  }
  const sign = 0;
  let exp = Math.floor(Math.log2(value));
  let mantissa = value / 2 ** exp;
  exp += 16383;
  mantissa *= 2 ** 31;
  const hi = Math.floor(mantissa);
  const lo = Math.floor((mantissa - hi) * 2 ** 32);
  view.setUint16(offset, (sign << 15) | (exp & 0x7fff), false);
  view.setUint32(offset + 2, hi >>> 0, false);
  view.setUint32(offset + 6, lo >>> 0, false);
}

/** CAF linear PCM 24-bit little-endian (Apple Core Audio Format). */
export function encodeCafPcm24(buffer: AudioBuffer): Uint8Array {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 3;
  const bytesPerFrame = numCh * bytesPerSample;
  const dataSize = numFrames * bytesPerFrame;

  // caf header 8 + desc 4+8+32 + data 4+8+dataSize  (data chunk size = -1 for unknown OK, use exact)
  const descChunkSize = 32;
  const headerSize = 8 + 12 + descChunkSize + 12;
  const out = new Uint8Array(headerSize + dataSize);
  const view = new DataView(out.buffer);

  writeAscii(out, 0, 'caff');
  view.setUint16(4, 1, false); // file version
  view.setUint16(6, 0, false); // file flags

  writeAscii(out, 8, 'desc');
  view.setBigUint64(12, BigInt(descChunkSize), false);
  view.setFloat64(20, sampleRate, false);
  writeAscii(out, 28, 'lpcm');
  // mFormatFlags: 2 = kAudioFormatFlagIsSignedInteger (little-endian default for lpcm in CAF)
  view.setUint32(32, 2, false);
  view.setUint32(36, bytesPerFrame, false); // bytes per packet
  view.setUint32(40, 1, false); // frames per packet
  view.setUint32(44, numCh, false);
  view.setUint32(48, 24, false); // bits per channel

  writeAscii(out, 52, 'data');
  view.setBigUint64(56, BigInt(dataSize), false);

  const channels = getChannels(buffer);
  let o = 64;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = clampSample(channels[ch]![i] ?? 0);
      const int = Math.round(s * 8388607);
      out[o++] = int & 0xff;
      out[o++] = (int >> 8) & 0xff;
      out[o++] = (int >> 16) & 0xff;
    }
  }
  return out;
}

/** MP3 via LAME (CBR bitrate kbps). */
export async function encodeMp3Lame(
  buffer: AudioBuffer,
  bitrateKbps: MasterExportBitrateKbps,
): Promise<Uint8Array> {
  const Mp3Encoder = await getLameMp3EncoderCtor();
  const numCh = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const left = buffer.getChannelData(0);
  const right = numCh > 1 ? buffer.getChannelData(1) : left;
  const encoder = new Mp3Encoder(numCh, sampleRate, bitrateKbps);
  const block = 1152;
  const parts: Uint8Array[] = [];
  const n = buffer.length;

  for (let i = 0; i < n; i += block) {
    const len = Math.min(block, n - i);
    const l = new Int16Array(len);
    const r = new Int16Array(len);
    for (let j = 0; j < len; j++) {
      l[j] = Math.max(-32768, Math.min(32767, Math.round(clampSample(left[i + j] ?? 0) * 32767)));
      r[j] = Math.max(-32768, Math.min(32767, Math.round(clampSample(right[i + j] ?? 0) * 32767)));
    }
    const chunk = numCh === 1 ? encoder.encodeBuffer(l) : encoder.encodeBuffer(l, r);
    if (chunk.length) parts.push(new Uint8Array(chunk));
  }
  const flush = encoder.flush();
  if (flush.length) parts.push(new Uint8Array(flush));

  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function pickMediaRecorderMime(format: MasterExportFormat): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates: string[] = [];
  switch (format) {
    case 'm4a':
      candidates.push('audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac');
      break;
    case 'ogg':
      candidates.push('audio/ogg;codecs=vorbis', 'audio/ogg;codecs=opus', 'audio/ogg');
      break;
    case 'opus':
      candidates.push('audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm');
      break;
    case 'flac':
      candidates.push('audio/flac', 'audio/x-flac');
      break;
    default:
      return null;
  }
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/**
 * Encode via MediaRecorder by playing the buffer into a MediaStreamDestination.
 * Used for M4A / OGG / Opus / FLAC when the browser codec is available.
 */
export async function encodeViaMediaRecorder(
  buffer: AudioBuffer,
  mimeType: string,
  bitrateKbps: MasterExportBitrateKbps,
): Promise<Uint8Array> {
  const ctx = new AudioContext({ sampleRate: buffer.sampleRate });
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);

    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(dest.stream, {
      mimeType,
      audioBitsPerSecond: bitrateKbps * 1000,
    });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve, reject) => {
      rec.onstop = () => resolve();
      rec.onerror = () => reject(new Error('MediaRecorder failed during export.'));
    });

    rec.start(250);
    await new Promise<void>((resolve) => {
      src.onended = () => resolve();
      src.start(0);
    });
    // Let the recorder flush trailing packets.
    await new Promise((r) => setTimeout(r, 120));
    if (rec.state !== 'inactive') rec.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mimeType });
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    await ctx.close().catch(() => {});
  }
}

export function formatMimeType(format: MasterExportFormat): string {
  switch (format) {
    case 'wav':
      return 'audio/wav';
    case 'aiff':
      return 'audio/aiff';
    case 'flac':
      return 'audio/flac';
    case 'caf':
      return 'audio/x-caf';
    case 'm4a':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'opus':
      return 'audio/ogg';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

export async function encodeMasterAudioBuffer(
  buffer: AudioBuffer,
  format: MasterExportFormat,
  bitrateKbps: MasterExportBitrateKbps = 320,
): Promise<EncodedMaster> {
  switch (format) {
    case 'wav':
      return { bytes: encodeWavPcm24(buffer), mimeType: 'audio/wav', allowId3Prefix: true };
    case 'aiff':
      return { bytes: encodeAiffPcm24(buffer), mimeType: 'audio/aiff', allowId3Prefix: false };
    case 'caf':
      return { bytes: encodeCafPcm24(buffer), mimeType: 'audio/x-caf', allowId3Prefix: false };
    case 'mp3':
      return {
        bytes: await encodeMp3Lame(buffer, bitrateKbps),
        mimeType: 'audio/mpeg',
        allowId3Prefix: true,
      };
    case 'm4a':
    case 'ogg':
    case 'opus':
    case 'flac': {
      const mime = pickMediaRecorderMime(format);
      if (!mime) {
        throw new Error(
          `${format.toUpperCase()} export isn’t supported in this browser. Try Chrome/Edge for M4A/Opus, or export WAV / AIFF / MP3.`,
        );
      }
      const bytes = await encodeViaMediaRecorder(buffer, mime, bitrateKbps);
      return { bytes, mimeType: formatMimeType(format), allowId3Prefix: false };
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
