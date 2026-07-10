'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

import type { MasteringBayClipEditState } from '@/app/lib/masteringBay/masteringBayClipEdit';
import { exportMasteredTrack } from '@/app/lib/masteringBay/masteringBayMasterExport';
import {
  EMPTY_MASTER_METADATA,
  ISRC_REGEX,
  isValidIsrc,
  normalizeIsrcInput,
  validateMasterMetadata,
  type MasterExportCoverArt,
  type MasterExportMetadata,
} from '@/app/lib/masteringBay/masteringBayMetadata';
import type { MasteringBayRackState } from '@/app/lib/masteringBay/masteringBayPresets';
import { ALBUM_COVER_SIZE_PX, prepareCoverArtBytes } from '@/app/lib/masteringBay/masteringBayWavEncode';

type Props = {
  open: boolean;
  onClose: () => void;
  clipEdit: MasteringBayClipEditState | null;
  rackState: MasteringBayRackState;
};

export function MasteringBayExportModal({ open, onClose, clipEdit, rackState }: Props) {
  const [meta, setMeta] = useState<MasterExportMetadata>(EMPTY_MASTER_METADATA);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverArt, setCoverArt] = useState<MasterExportCoverArt | null>(null);
  const [sampleRate, setSampleRate] = useState<44100 | 48000>(48000);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<MasterExportMetadata>) => setMeta((m) => ({ ...m, ...p }));

  const loadCover = useCallback(async (file: File) => {
    if (!/^image\/(jpeg|png)$/i.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      setError('Cover art must be a square JPG or PNG.');
      return;
    }
    setError(null);
    try {
      const prepared = await prepareCoverArtBytes(file);
      setCoverArt(prepared);
      const ab = prepared.bytes.buffer.slice(
        prepared.bytes.byteOffset,
        prepared.bytes.byteOffset + prepared.bytes.byteLength,
      );
      setCoverPreview(URL.createObjectURL(new Blob([ab], { type: prepared.mimeType })));
    } catch {
      setError('Could not read that image.');
    }
  }, []);

  const onExport = async () => {
    if (!clipEdit || clipEdit.clips.length === 0) {
      setError('Load and edit a source track before exporting.');
      return;
    }
    const v = validateMasterMetadata(meta);
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    setStatus('Starting…');
    try {
      const filename = await exportMasteredTrack({
        clipEdit,
        rackState,
        request: {
          metadata: {
            ...meta,
            isrc: meta.isrc.trim() ? normalizeIsrcInput(meta.isrc) : '',
          },
          coverArt,
          format: 'wav',
          sampleRate,
        },
        onProgress: setStatus,
      });
      setStatus(`Saved ${filename}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed.';
      if (msg.includes('abort') || msg.includes('Abort')) {
        setStatus(null);
      } else {
        setError(msg);
        setStatus(null);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const isrcOk = isValidIsrc(meta.isrc);

  return (
    <div className="mb-export-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="mb-export-modal__panel" role="dialog" aria-label="Save New Master">
        <header className="mb-export-modal__head">
          <div>
            <h2>Save New Master</h2>
            <p>Tag and export your mastered track (24-bit WAV)</p>
          </div>
          <button type="button" className="mb-export-modal__close" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="mb-export-modal__body">
          <div className="mb-export-modal__form">
            <label>
              <span>Song Title</span>
              <input value={meta.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Song title" disabled={busy} />
            </label>
            <label>
              <span>Artist Name</span>
              <input value={meta.artist} onChange={(e) => patch({ artist: e.target.value })} placeholder="Artist" disabled={busy} />
            </label>
            <label>
              <span>Album Title</span>
              <input value={meta.album} onChange={(e) => patch({ album: e.target.value })} placeholder="Album" disabled={busy} />
            </label>
            <div className="mb-export-modal__row">
              <label>
                <span>Release Year</span>
                <input value={meta.year} onChange={(e) => patch({ year: e.target.value })} placeholder="2026" disabled={busy} />
              </label>
              <label>
                <span>Genre</span>
                <input value={meta.genre} onChange={(e) => patch({ genre: e.target.value })} placeholder="Hip-Hop" disabled={busy} />
              </label>
            </div>
            <label>
              <span>ISRC</span>
              <input
                value={meta.isrc}
                onChange={(e) => patch({ isrc: e.target.value.toUpperCase() })}
                placeholder="US-ABC-12-34567"
                disabled={busy}
                className={!isrcOk ? 'is-invalid' : ''}
                pattern={ISRC_REGEX.source}
              />
              <em>Optional · format US-ABC-12-34567 · written to TSRC</em>
            </label>
            <label>
              <span>Sample Rate</span>
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(Number(e.target.value) as 44100 | 48000)}
                disabled={busy}
              >
                <option value={48000}>48 kHz · 24-bit WAV</option>
                <option value={44100}>44.1 kHz · 24-bit WAV</option>
              </select>
            </label>
          </div>

          <div
            className={`mb-export-modal__art${dragOver ? ' is-drag' : ''}${coverPreview ? ' has-art' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void loadCover(f);
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="Album artwork preview" />
            ) : (
              <>
                <ImagePlus size={28} />
                <strong>Album artwork</strong>
                <span>Drop any JPG / PNG — auto-resized to {ALBUM_COVER_SIZE_PX}×{ALBUM_COVER_SIZE_PX}</span>
                <em>Digital album / CD-ready square (Spotify, Apple, DistroKid)</em>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadCover(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {(error || status) && (
          <p className={`mb-export-modal__status${error ? ' is-error' : ''}`} role="status">
            {error ?? status}
          </p>
        )}

        <footer className="mb-export-modal__foot">
          <button type="button" className="mb-export-modal__ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="mb-export-modal__primary" onClick={() => void onExport()} disabled={busy}>
            {busy ? 'Exporting…' : 'Export Master'}
          </button>
        </footer>
      </div>
    </div>
  );
}
