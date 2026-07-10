'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { DA_MUSIC_BOX_SONG_EXTENSION } from '@/app/lib/studio/se2SongFile';
import type { StudioConsolidateTrackOption } from '@/app/components/studio/StudioNormalizeConsolidateControls';
import { SE2_HEADER_PILL_LABEL_COLOR } from '@/app/components/studio/se2HeaderPill';

export type StudioSe2ProjectMenuControlsProps = {
  disabled?: boolean;
  consolidateBusy?: boolean;
  exportBusy?: boolean;
  songSaveBusy?: boolean;
  normalizeDisabled?: boolean;
  normalizeTitle?: string;
  consolidateTracks: StudioConsolidateTrackOption[];
  maxBars?: number;
  bpm?: number;
  beatsPerBar?: number;
  startBar: number;
  endBar: number;
  rangeLabel?: string;
  rangeValid?: boolean;
  songName: string;
  songFileLabel?: string;
  lastSavedLabel?: string;
  onStartBarChange: (bar: number) => void;
  onEndBarChange: (bar: number) => void;
  onEndBarFromMinutes: (minutes: number) => void;
  onNormalize: () => void;
  onConsolidate: (trackIndices: number[], startBar: number, endBar: number) => void;
  onSaveSong: () => void;
  onSaveSongAs: () => void;
  onOpenSong: () => void;
  onExportStereoToMasteringBay: () => void;
  onSaveStereoMix: () => void;
  onExportTrackOuts: () => void;
};

type SubPanel = 'consolidate' | 'song' | 'export';

const panelShell = {
  borderColor: '#3a3a4c',
  background: '#0e0e14',
  boxShadow: '0 12px 40px rgba(0,0,0,0.92)',
} as const;

/** Single File menu — Normalize, Consolidate, Song file, Export with flyout sub-panels. */
export function StudioSe2ProjectMenuControls({
  disabled = false,
  consolidateBusy = false,
  exportBusy = false,
  songSaveBusy = false,
  normalizeDisabled = false,
  normalizeTitle = 'Normalize selected audio — boost quiet waveforms to peak level',
  consolidateTracks,
  maxBars = 1800,
  bpm = 120,
  beatsPerBar = 4,
  startBar,
  endBar,
  rangeLabel = '',
  rangeValid = false,
  songName,
  songFileLabel,
  lastSavedLabel,
  onStartBarChange,
  onEndBarChange,
  onEndBarFromMinutes,
  onNormalize,
  onConsolidate,
  onSaveSong,
  onSaveSongAs,
  onOpenSong,
  onExportStereoToMasteringBay,
  onSaveStereoMix,
  onExportTrackOuts,
}: StudioSe2ProjectMenuControlsProps) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<SubPanel | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  const busy = consolidateBusy || exportBusy || songSaveBusy;
  const consolidatable = consolidateTracks.filter((t) => t.canConsolidate);

  const closeAll = useCallback(() => {
    setOpen(false);
    setSub(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (
        triggerRef.current?.contains(t) ||
        mainRef.current?.contains(t) ||
        subRef.current?.contains(t)
      ) {
        return;
      }
      closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sub) setSub(null);
        else closeAll();
      }
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [closeAll, open, sub]);

  const openMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (disabled || busy) return;
      if (!open && triggerRef.current && typeof window !== 'undefined') {
        const r = triggerRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const minW = 168;
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const vh = window.innerHeight;
        const spaceBelow = vh - r.bottom - 8;
        setMenuStyle({
          position: 'fixed',
          top: r.bottom + 2,
          left,
          minWidth: minW,
          maxHeight: Math.min(420, spaceBelow),
          zIndex: 30050,
        });
        setPicked(new Set(consolidatable.map((t) => t.trackIndex)));
      }
      setOpen((o) => {
        if (o) setSub(null);
        return !o;
      });
    },
    [busy, consolidatable, disabled, open],
  );

  const openSub = (panel: SubPanel) => {
    if (panel === 'consolidate' && (consolidatable.length === 0 || consolidateBusy)) return;
    setSub(panel);
  };

  const togglePick = (idx: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const runConsolidate = () => {
    const indices = [...picked].sort((a, b) => a - b);
    if (indices.length === 0) return;
    onConsolidate(indices, startBar, endBar);
    closeAll();
  };

  const run = (fn: () => void) => {
    fn();
    closeAll();
  };

  const subFlyoutStyle: CSSProperties =
    open && sub && mainRef.current && typeof window !== 'undefined'
      ? (() => {
          const r = mainRef.current!.getBoundingClientRect();
          const vw = window.innerWidth;
          const subW = sub === 'consolidate' ? 248 : 220;
          let left = r.right + 4;
          if (left + subW > vw - 8) left = Math.max(8, r.left - subW - 4);
          const vh = window.innerHeight;
          const spaceBelow = vh - r.top - 8;
          return {
            position: 'fixed',
            top: r.top,
            left,
            minWidth: subW,
            maxHeight: Math.min(sub === 'consolidate' ? 380 : 320, spaceBelow),
            zIndex: 30051,
          };
        })()
      : {};

  const mainMenuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={mainRef}
        data-studio-se2-project-menu
        data-studio-se2-dropdown
        className="rounded border overflow-hidden shadow-2xl flex flex-col"
        style={{ ...menuStyle, ...panelShell }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 border-b" style={{ borderColor: '#2a2a34' }}>
          <p className="se2-dd-caption">File</p>
        </div>
        <div className="py-0.5">
          <button
            type="button"
            disabled={normalizeDisabled}
            title={normalizeTitle}
            className="se2-dd-item"
            style={{ color: '#ffb84d' }}
            onClick={() => run(onNormalize)}
          >
            Normalize
          </button>
          <button
            type="button"
            disabled={consolidatable.length === 0 || consolidateBusy}
            className="se2-dd-item"
            style={{
              color: sub === 'consolidate' ? '#7cf4c6' : '#c8c8d4',
              background: sub === 'consolidate' ? 'rgba(124,244,198,0.08)' : 'transparent',
            }}
            onClick={() => openSub('consolidate')}
          >
            <span className="flex-1 min-w-0 truncate">Consolidate tracks</span>
            <ChevronRight size={10} className="shrink-0 opacity-60" aria-hidden />
          </button>
          <button
            type="button"
            disabled={songSaveBusy}
            className="se2-dd-item"
            style={{
              color: sub === 'song' ? '#e8b84d' : '#c8c8d4',
              background: sub === 'song' ? 'rgba(232,184,77,0.08)' : 'transparent',
            }}
            onClick={() => openSub('song')}
          >
            <span className="flex-1 min-w-0 truncate">Song file</span>
            <ChevronRight size={10} className="shrink-0 opacity-60" aria-hidden />
          </button>
          <button
            type="button"
            disabled={exportBusy}
            className="se2-dd-item"
            style={{
              color: sub === 'export' ? '#9dd9ff' : '#c8c8d4',
              background: sub === 'export' ? 'rgba(157,217,255,0.08)' : 'transparent',
            }}
            onClick={() => openSub('export')}
          >
            <span className="flex-1 min-w-0 truncate">Export</span>
            <ChevronRight size={10} className="shrink-0 opacity-60" aria-hidden />
          </button>
        </div>
      </div>
    ) : null;

  const consolidateSubEl =
    open && sub === 'consolidate' && typeof document !== 'undefined' ? (
      <div
        ref={subRef}
        data-studio-consolidate-menu
        data-studio-se2-dropdown
        className="rounded border overflow-hidden shadow-2xl flex flex-col"
        style={{ ...subFlyoutStyle, ...panelShell }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 border-b space-y-1.5" style={{ borderColor: '#2a2a34' }}>
          <p className="se2-dd-caption">Consolidate range</p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1 se2-dd-hint">
              Start
              <input
                type="number"
                min={1}
                max={maxBars}
                value={startBar}
                onChange={(e) => onStartBarChange(Number(e.target.value) || 1)}
                className="se2-dd-input"
                aria-label="Consolidate start bar"
              />
            </label>
            <label className="flex items-center gap-1 se2-dd-hint">
              End
              <input
                type="number"
                min={startBar}
                max={maxBars}
                value={endBar}
                onChange={(e) => onEndBarChange(Number(e.target.value) || startBar)}
                className="se2-dd-input"
                aria-label="Consolidate end bar"
              />
            </label>
            <span className="se2-dd-hint tabular-nums">/ {maxBars}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4].map((min) => (
              <button
                key={min}
                type="button"
                className="se2-dd-chip"
                title={`Set end bar for ~${min} min at ${bpm} BPM (${beatsPerBar}/4)`}
                onClick={() => onEndBarFromMinutes(min)}
              >
                {min}m
              </button>
            ))}
          </div>
          <p className="se2-dd-hint tabular-nums" style={{ color: rangeValid ? '#7cf4c6' : '#ffb080' }}>
            {rangeValid ? rangeLabel : 'End bar must be after start bar'}
          </p>
        </div>
        <div className="px-2 py-1 border-b" style={{ borderColor: '#2a2a34' }}>
          <p className="se2-dd-caption">Tracks</p>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0 py-0.5 max-h-[180px]">
          {consolidateTracks.length === 0 ? (
            <p className="px-2 py-2 se2-dd-hint">No tracks in this project.</p>
          ) : (
            consolidateTracks.map((tr) => (
              <label
                key={tr.trackIndex}
                className="flex items-center gap-2 px-2 py-1 cursor-pointer"
                style={{
                  opacity: tr.canConsolidate ? 1 : 0.45,
                  cursor: tr.canConsolidate ? 'pointer' : 'not-allowed',
                }}
              >
                <input
                  type="checkbox"
                  disabled={!tr.canConsolidate}
                  checked={picked.has(tr.trackIndex)}
                  onChange={() => {
                    if (tr.canConsolidate) togglePick(tr.trackIndex);
                  }}
                  className="shrink-0"
                  style={{ accentColor: '#7cf4c6' }}
                />
                <span className="se2-dd-track-label truncate min-w-0 flex-1">{tr.label}</span>
                <span className="se2-dd-track-meta shrink-0">
                  {tr.canConsolidate ? `${tr.clipCount} clip${tr.clipCount !== 1 ? 's' : ''}` : 'no audio'}
                </span>
              </label>
            ))
          )}
        </div>
        <div className="px-2 py-1.5 border-t flex gap-1.5" style={{ borderColor: '#2a2a34' }}>
          <button type="button" className="se2-dd-action" onClick={() => setSub(null)}>
            Back
          </button>
          <button
            type="button"
            disabled={picked.size === 0 || consolidateBusy || !rangeValid}
            className="se2-dd-action se2-dd-action--primary disabled:opacity-40"
            onClick={runConsolidate}
          >
            {consolidateBusy ? 'Working…' : 'Consolidate'}
          </button>
        </div>
      </div>
    ) : null;

  const songSubEl =
    open && sub === 'song' && typeof document !== 'undefined' ? (
      <div
        ref={subRef}
        data-studio-se2-song-menu
        data-studio-se2-dropdown
        className="rounded border overflow-hidden shadow-2xl flex flex-col"
        style={{ ...subFlyoutStyle, ...panelShell }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 border-b" style={{ borderColor: '#2a2a34' }}>
          <p className="se2-dd-caption">Da Music Box song</p>
          <p className="se2-dd-hint tabular-nums mt-0.5 truncate" style={{ color: '#c8c8d4' }}>
            {songFileLabel ?? `${songName}${DA_MUSIC_BOX_SONG_EXTENSION}`}
          </p>
          {lastSavedLabel ? <p className="se2-dd-hint mt-0.5">{lastSavedLabel}</p> : null}
        </div>
        <div className="py-0.5">
          <button type="button" disabled={songSaveBusy} className="se2-dd-item" onClick={() => run(onSaveSong)}>
            Save song
          </button>
          <button type="button" disabled={songSaveBusy} className="se2-dd-item" onClick={() => run(onSaveSongAs)}>
            Save song as…
          </button>
          <button type="button" disabled={songSaveBusy} className="se2-dd-item" onClick={() => run(onOpenSong)}>
            Open song…
          </button>
        </div>
        <p className="px-2 py-1 se2-dd-footnote border-t" style={{ borderColor: '#2a2a34' }}>
          {DA_MUSIC_BOX_SONG_EXTENSION} · auto-save after Save As
        </p>
      </div>
    ) : null;

  const exportSubEl =
    open && sub === 'export' && typeof document !== 'undefined' ? (
      <div
        ref={subRef}
        data-studio-se2-export-menu
        data-studio-se2-dropdown
        className="rounded border overflow-hidden shadow-2xl flex flex-col"
        style={{ ...subFlyoutStyle, ...panelShell }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 border-b" style={{ borderColor: '#2a2a34' }}>
          <p className="se2-dd-caption">Export range</p>
          <p className="se2-dd-hint tabular-nums mt-0.5" style={{ color: rangeValid ? '#7cf4c6' : '#ffb080' }}>
            {rangeValid ? rangeLabel : 'Set consolidate bar range first'}
          </p>
        </div>
        <div className="py-0.5">
          <button
            type="button"
            disabled={!rangeValid || exportBusy}
            className="se2-dd-item"
            onClick={() => run(onExportStereoToMasteringBay)}
          >
            Stereo mix → Mastering Bay
          </button>
          <button
            type="button"
            disabled={!rangeValid || exportBusy}
            className="se2-dd-item"
            onClick={() => run(onSaveStereoMix)}
          >
            Save stereo mix (WAV)…
          </button>
          <button
            type="button"
            disabled={!rangeValid || exportBusy}
            className="se2-dd-item"
            onClick={() => run(onExportTrackOuts)}
          >
            Export track outs (choose folder)…
          </button>
        </div>
        <p className="px-2 py-1 se2-dd-footnote border-t" style={{ borderColor: '#2a2a34' }}>
          WAV · pick save location
        </p>
      </div>
    ) : null;

  return (
    <>
      <div
        data-studio-se2-header-pill
        data-studio-se2-file-menu-chip
        className="box-border"
      >
        <span className="se2-file-menu-label shrink-0" style={{ color: SE2_HEADER_PILL_LABEL_COLOR }}>
          File
        </span>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled || busy}
          title="Normalize, consolidate, save song, export"
          aria-label="File menu"
          aria-expanded={open}
          onClick={openMenu}
          className="se2-header-pill-action disabled:opacity-35 transition-opacity hover:opacity-90"
        >
          {busy ? '…' : 'Menu'}
          <ChevronDown size={12} aria-hidden className="opacity-65" />
        </button>
      </div>
      {mainMenuEl ? createPortal(mainMenuEl, document.body) : null}
      {consolidateSubEl ? createPortal(consolidateSubEl, document.body) : null}
      {songSubEl ? createPortal(songSubEl, document.body) : null}
      {exportSubEl ? createPortal(exportSubEl, document.body) : null}
    </>
  );
}
