/** 24-bit PCM WAV encoder for mastered exports. */

export function encodeWavPcm24(buffer: AudioBuffer): Uint8Array {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 3;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const out = new Uint8Array(44 + dataSize);
  const view = new DataView(out.buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i);
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 24, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));

  let o = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let s = channels[ch]![i] ?? 0;
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      const int = Math.round(s * 8388607);
      out[o++] = int & 0xff;
      out[o++] = (int >> 8) & 0xff;
      out[o++] = (int >> 16) & 0xff;
    }
  }
  return out;
}

/**
 * Digital album / CD-ready cover art (industry standard):
 * - Spotify, Apple Music, DistroKid, TuneCore: **3000 × 3000 px**, square 1:1, RGB/sRGB
 * - CD front booklet print: 4.75″ × 4.75″ @ 300 DPI ≈ 1425 × 1425 px (3000×3000 downscales cleanly)
 *
 * Any JPG/PNG is center-cropped and resized to exactly this square.
 */
export const ALBUM_COVER_SIZE_PX = 3000;

/** Resize any image to exact album-cover specs (3000×3000 JPEG, center crop). */
export async function prepareCoverArtBytes(file: File): Promise<{ mimeType: 'image/jpeg' | 'image/png'; bytes: Uint8Array }> {
  const bitmap = await createImageBitmap(file);
  const size = ALBUM_COVER_SIZE_PX;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) {
    bitmap.close();
    throw new Error('Could not process cover art.');
  }

  // Cover-fit: scale so the shorter side fills the square, then center-crop.
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Cover art encode failed.'))),
      'image/jpeg',
      0.92,
    );
  });
  const buf = new Uint8Array(await blob.arrayBuffer());
  return { mimeType: 'image/jpeg', bytes: buf };
}
