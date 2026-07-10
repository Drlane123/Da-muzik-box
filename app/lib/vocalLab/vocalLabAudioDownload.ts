import { audioBufferToWavBlob } from '@/app/lib/vocalLab/rvcVoiceConverter';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function vocalLabBaseName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `vocal-lab-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Decode and export true 16-bit WAV (works for mic webm and imported files). */
export async function downloadVocalLabWav(blob: Blob): Promise<void> {
  if (blob.type.includes('wav')) {
    triggerDownload(blob, `${vocalLabBaseName()}.wav`);
    return;
  }
  const ctx = new AudioContext();
  try {
    const raw = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(raw.slice(0));
    triggerDownload(audioBufferToWavBlob(buffer), `${vocalLabBaseName()}.wav`);
  } finally {
    await ctx.close();
  }
}

/** Download when source is already MP3/MPEG; otherwise no-op (caller should disable the button). */
export function downloadVocalLabMp3(blob: Blob): void {
  triggerDownload(blob, `${vocalLabBaseName()}.mp3`);
}

export function vocalLabBlobIsMp3(blob: Blob): boolean {
  return /mpeg|mp3/i.test(blob.type);
}
