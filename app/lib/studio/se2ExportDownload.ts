import { audioBufferToWavBlob } from '@/app/lib/vocalLab/rvcVoiceConverter';

type SaveWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

const WAV_MIME = 'audio/wav';
const WAV_PICKER_TYPE = {
  description: 'WAV audio',
  accept: { [WAV_MIME]: ['.wav'] },
} as const;

function triggerDownload(blob: Blob, filename: string): void {
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

async function writeBlobToHandle(handle: FileSystemFileHandle, blob: Blob): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** Ask where to save one WAV — call synchronously from the click handler before async bounce. */
export async function promptSe2WavSaveLocation(
  suggestedFilename: string,
): Promise<FileSystemFileHandle | 'download' | null> {
  const name = suggestedFilename.endsWith('.wav') ? suggestedFilename : `${suggestedFilename}.wav`;
  const w = window as SaveWindow;
  if (typeof w.showSaveFilePicker !== 'function') return 'download';

  try {
    return await w.showSaveFilePicker({
      suggestedName: name,
      types: [WAV_PICKER_TYPE],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    return 'download';
  }
}

/** Ask for a folder for multiple WAV stems — before async bounce. */
export async function promptSe2StemFolderSave(): Promise<FileSystemDirectoryHandle | 'download' | null> {
  const w = window as SaveWindow;
  if (typeof w.showDirectoryPicker !== 'function') return 'download';

  try {
    return await w.showDirectoryPicker();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    return 'download';
  }
}

export async function saveSe2AudioBufferWav(
  buffer: AudioBuffer,
  suggestedFilename: string,
  target: FileSystemFileHandle | 'download',
): Promise<void> {
  const name = suggestedFilename.endsWith('.wav') ? suggestedFilename : `${suggestedFilename}.wav`;
  const blob = audioBufferToWavBlob(buffer);
  if (target === 'download') {
    triggerDownload(blob, name);
    return;
  }
  await writeBlobToHandle(target, blob);
}

export async function saveSe2StemWavs(
  stems: Array<{ name: string; buffer: AudioBuffer }>,
  baseName: string,
  folderTarget: FileSystemDirectoryHandle | 'download',
): Promise<void> {
  if (stems.length === 0) return;
  const pad = String(Math.max(2, String(stems.length).length));
  const w = window as SaveWindow;

  for (let i = 0; i < stems.length; i++) {
    const stem = stems[i]!;
    const label = se2SafeExportStem(stem.name);
    const fn = `${baseName}-${String(i + 1).padStart(Number(pad), '0')}-${label}.wav`;
    const blob = audioBufferToWavBlob(stem.buffer);

    if (folderTarget === 'download') {
      if (stems.length === 1 && typeof w.showSaveFilePicker === 'function') {
        try {
          const handle = await w.showSaveFilePicker({
            suggestedName: fn,
            types: [WAV_PICKER_TYPE],
          });
          await writeBlobToHandle(handle, blob);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }
      triggerDownload(blob, fn);
      continue;
    }

    const handle = await folderTarget.getFileHandle(fn, { create: true });
    await writeBlobToHandle(handle, blob);
  }
}

export function se2SafeExportStem(name: string): string {
  const stem = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 56);
  return stem.length > 0 ? stem : 'track';
}

export function se2ExportFilenameBase(startBar: number, endBar: number): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `se2-bars-${startBar}-${endBar}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** @deprecated Use prompt + saveSe2AudioBufferWav */
export function downloadSe2AudioBufferWav(buffer: AudioBuffer, filename: string): void {
  const name = filename.endsWith('.wav') ? filename : `${filename}.wav`;
  triggerDownload(audioBufferToWavBlob(buffer), name);
}
