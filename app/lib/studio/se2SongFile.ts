/**
 * Da Music Box song file (.dmbox) — Studio Editor 2 session on disk.
 * JSON payload with embedded WAV base64 for timeline audio sources.
 */
import type { Se2SessionFileV1, Se2SessionWritePayload } from '@/app/lib/studio/se2SessionPersistence';
import { SE2_SESSION_VERSION } from '@/app/lib/studio/se2SessionPersistence';
import type { Se2StudioMixerSnapshot } from '@/app/lib/studio/se2StudioMixerState';

export const DA_MUSIC_BOX_SONG_FORMAT = 'da-music-box-song' as const;
export const DA_MUSIC_BOX_SONG_FILE_VERSION = 1 as const;
export const DA_MUSIC_BOX_SONG_EXTENSION = '.dmbox';
export const DA_MUSIC_BOX_SONG_MIME = 'application/vnd.da-music-box.song+json';

export type DaMusicBoxSongFileV1 = {
  format: typeof DA_MUSIC_BOX_SONG_FORMAT;
  fileVersion: typeof DA_MUSIC_BOX_SONG_FILE_VERSION;
  app: 'studio-editor-2';
  savedAt: string;
  songName: string;
  session: Se2SessionFileV1;
  mixer: Se2StudioMixerSnapshot;
  consolidateStartBar?: number;
  consolidateEndBar?: number;
};

export type Se2SongBuildInput = {
  songName: string;
  session: Se2SessionWritePayload;
  mixer: Se2StudioMixerSnapshot;
  consolidateStartBar?: number;
  consolidateEndBar?: number;
};

type FilePickerWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (opts: {
    types?: { description: string; accept: Record<string, string[]> }[];
    multiple?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
};

const PICKER_TYPE = {
  description: 'Da Music Box song',
  accept: { [DA_MUSIC_BOX_SONG_MIME]: [DA_MUSIC_BOX_SONG_EXTENSION] },
} as const;

export function se2SafeSongFileStem(name: string): string {
  const stem = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return stem.length > 0 ? stem : 'Untitled Song';
}

export function se2SongFilenameForName(songName: string): string {
  return `${se2SafeSongFileStem(songName)}${DA_MUSIC_BOX_SONG_EXTENSION}`;
}

export function buildDaMusicBoxSongFile(input: Se2SongBuildInput): DaMusicBoxSongFileV1 {
  const session: Se2SessionFileV1 = {
    version: SE2_SESSION_VERSION,
    savedAt: new Date().toISOString(),
    ...input.session,
    tracks: input.session.tracks.map((t) => ({ ...t })),
  };
  return {
    format: DA_MUSIC_BOX_SONG_FORMAT,
    fileVersion: DA_MUSIC_BOX_SONG_FILE_VERSION,
    app: 'studio-editor-2',
    savedAt: session.savedAt,
    songName: se2SafeSongFileStem(input.songName),
    session,
    mixer: input.mixer,
    consolidateStartBar: input.consolidateStartBar,
    consolidateEndBar: input.consolidateEndBar,
  };
}

export function serializeDaMusicBoxSongFile(file: DaMusicBoxSongFileV1): string {
  return JSON.stringify(file);
}

export function parseDaMusicBoxSongFile(raw: string): DaMusicBoxSongFileV1 {
  const parsed = JSON.parse(raw) as DaMusicBoxSongFileV1;
  if (
    !parsed ||
    parsed.format !== DA_MUSIC_BOX_SONG_FORMAT ||
    parsed.fileVersion !== DA_MUSIC_BOX_SONG_FILE_VERSION ||
    !parsed.session ||
    parsed.session.version !== SE2_SESSION_VERSION ||
    !Array.isArray(parsed.session.tracks) ||
    !parsed.mixer
  ) {
    throw new Error('Not a valid Da Music Box song file (.dmbox)');
  }
  return parsed;
}

export async function promptSaveDaMusicBoxSongFile(
  suggestedFilename: string,
): Promise<FileSystemFileHandle | null> {
  const w = window as FilePickerWindow;
  const name = suggestedFilename.endsWith(DA_MUSIC_BOX_SONG_EXTENSION)
    ? suggestedFilename
    : se2SongFilenameForName(suggestedFilename.replace(DA_MUSIC_BOX_SONG_EXTENSION, ''));

  if (typeof w.showSaveFilePicker !== 'function') return null;

  try {
    return await w.showSaveFilePicker({
      suggestedName: name,
      types: [PICKER_TYPE],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

export async function promptOpenDaMusicBoxSongFile(): Promise<{
  handle: FileSystemFileHandle;
  text: string;
} | null> {
  const w = window as FilePickerWindow;
  if (typeof w.showOpenFilePicker !== 'function') return null;

  try {
    const handles = await w.showOpenFilePicker({
      types: [PICKER_TYPE],
      multiple: false,
    });
    const handle = handles[0];
    if (!handle) return null;
    const file = await handle.getFile();
    const text = await file.text();
    return { handle, text };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

export async function writeDaMusicBoxSongToHandle(
  handle: FileSystemFileHandle,
  json: string,
): Promise<void> {
  const blob = new Blob([json], { type: DA_MUSIC_BOX_SONG_MIME });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function readDaMusicBoxSongFromHandle(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

/** Fallback download when Save As picker is unavailable. */
export function downloadDaMusicBoxSongFile(json: string, filename: string): void {
  const name = filename.endsWith(DA_MUSIC_BOX_SONG_EXTENSION)
    ? filename
    : se2SongFilenameForName(filename);
  const blob = new Blob([json], { type: DA_MUSIC_BOX_SONG_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
