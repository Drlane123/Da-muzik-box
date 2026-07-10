/** Master export metadata — form model, validation, and file naming. */

/** ISRC: CC-XXX-YY-NNNNN e.g. US-ABC-12-34567 */
export const ISRC_REGEX = /^[A-Z]{2}-[A-Z0-9]{3}-\d{2}-\d{5}$/;

export type MasterExportFormat = 'wav' | 'mp3';

export type MasterExportMetadata = {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  isrc: string;
};

export type MasterExportCoverArt = {
  mimeType: 'image/jpeg' | 'image/png';
  bytes: Uint8Array;
};

export type MasterExportRequest = {
  metadata: MasterExportMetadata;
  coverArt: MasterExportCoverArt | null;
  format: MasterExportFormat;
  sampleRate: 44100 | 48000;
};

export const EMPTY_MASTER_METADATA: MasterExportMetadata = {
  title: '',
  artist: '',
  album: '',
  year: String(new Date().getFullYear()),
  genre: '',
  isrc: '',
};

export function normalizeIsrcInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidIsrc(raw: string): boolean {
  if (!raw.trim()) return true; // optional unless filled
  return ISRC_REGEX.test(normalizeIsrcInput(raw));
}

export function validateMasterMetadata(meta: MasterExportMetadata): string | null {
  if (!meta.title.trim()) return 'Song title is required.';
  if (!meta.artist.trim()) return 'Artist name is required.';
  if (meta.isrc.trim() && !isValidIsrc(meta.isrc)) {
    return 'ISRC must look like US-ABC-12-34567.';
  }
  if (meta.year.trim()) {
    const y = Number(meta.year);
    if (!Number.isFinite(y) || y < 1900 || y > 2100) return 'Release year looks invalid.';
  }
  return null;
}

/** Default download name: "Artist Name - Song Title (Mastered).wav" */
export function masterExportFilename(meta: MasterExportMetadata, format: MasterExportFormat): string {
  const artist = sanitizeFilenamePart(meta.artist.trim() || 'Artist');
  const title = sanitizeFilenamePart(meta.title.trim() || 'Untitled');
  const ext = format === 'mp3' ? 'mp3' : 'wav';
  return `${artist} - ${title} (Mastered).${ext}`;
}

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim() || 'Track';
}

/** Maps form fields → ID3v2 frame IDs (and RIFF INFO keys). */
export type MasterMetadataTagMap = {
  TIT2: string;
  TPE1: string;
  TALB: string;
  TYER: string;
  TCON: string;
  TSRC: string;
};

export function metadataToTagMap(meta: MasterExportMetadata): MasterMetadataTagMap {
  return {
    TIT2: meta.title.trim(),
    TPE1: meta.artist.trim(),
    TALB: meta.album.trim(),
    TYER: meta.year.trim(),
    TCON: meta.genre.trim(),
    TSRC: meta.isrc.trim() ? normalizeIsrcInput(meta.isrc) : '',
  };
}
