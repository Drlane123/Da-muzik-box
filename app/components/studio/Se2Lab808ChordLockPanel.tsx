'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Lock } from 'lucide-react';
import { studioKeyLabel, type StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  SE2_LAB808_CHORD_LOCK_KEY_OPTIONS,
  se2Lab808ChordLockDropdownValue,
  se2Lab808ChordLockFromDropdownValue,
  se2Lab808ChordLockSourceLabel,
  se2Lab808ChordLockTrackReady,
  se2Lab808HarmonySourceCandidates,
  type Se2Lab808ChordLockHarmonyTrack,
} from '@/app/lib/studio/se2Lab808ChordLock';
import { se2DrumGenHarmonyKindLabel, se2DrumGenHarmonyOptionHint } from '@/app/lib/studio/se2DrumGeneratorTrack';
import { se2TrackNumberedName } from '@/app/lib/studio/se2StudioTrackNumber';
import type { Se2Lab808ChordLock } from '@/app/lib/studio/se2Lab808Types';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';

const ACCENT = '#7cf4c6';
const MENU_BG = '#1a1a24';
const MENU_BORDER = '#3a3a4c';
const PICKER_W = 168;

const sideLabel: CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#8a8a98',
};

function shortKind(kind: string): string {
  switch (kind) {
    case 'synthGeno':
      return 'Geno';
    case 'glideBass':
      return 'Bass';
    case 'grooveLead':
      return 'Lead';
    case 'rhythm':
      return 'Cards';
    case 'midi':
      return 'Prog+';
    case 'genoUltraSynth':
      return 'Ultra';
    case 'genoChordCreator':
    case 'chordGenie':
      return 'Chord';
    default:
      return se2DrumGenHarmonyKindLabel(kind).slice(0, 6);
  }
}

export type Se2Lab808ChordLockPanelProps = {
  lock: Se2Lab808ChordLock;
  rootCount: number;
  connected: boolean;
  disabled?: boolean;
  songKeyRoot: number;
  songKeyMode: ChordMode;
  lab808TrackId: string;
  tracks: readonly Se2Lab808ChordLockHarmonyTrack[];
  lanePad: number;
  onLockChange: (lock: Se2Lab808ChordLock) => void;
};

export function Se2Lab808ChordLockPanel({
  lock,
  rootCount,
  connected,
  disabled = false,
  songKeyRoot,
  songKeyMode,
  lab808TrackId,
  tracks,
  lanePad,
  onLockChange,
}: Se2Lab808ChordLockPanelProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(
    () => se2Lab808HarmonySourceCandidates(tracks, lab808TrackId),
    [tracks, lab808TrackId],
  );
  const readyCount = useMemo(() => candidates.filter((t) => se2Lab808ChordLockTrackReady(t)).length, [candidates]);

  const laneLabel = useCallback(
    (t: Se2Lab808ChordLockHarmonyTrack) => se2TrackNumberedName(t.laneNumber ?? 0, t.name, lanePad),
    [lanePad],
  );

  const sourceLabel = useMemo(
    () =>
      se2Lab808ChordLockSourceLabel({
        lock,
        tracks,
        lab808TrackId,
        songKeyRoot,
        songKeyMode,
        laneLabel,
      }),
    [lock, tracks, lab808TrackId, songKeyRoot, songKeyMode, laneLabel],
  );

  const dropdownValue = se2Lab808ChordLockDropdownValue(lock);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (disabled) return;
      if (!open && typeof window !== 'undefined') {
        const r = e.currentTarget.getBoundingClientRect();
        setMenuStyle({
          position: 'fixed',
          top: r.bottom + 2,
          left: Math.min(r.left, window.innerWidth - PICKER_W - 8),
          width: PICKER_W,
          maxHeight: Math.min(320, window.innerHeight - r.bottom - 12),
          zIndex: 30050,
        });
      }
      setOpen((v) => !v);
    },
    [disabled, open],
  );

  const pickValue = useCallback(
    (value: string) => {
      onLockChange(se2Lab808ChordLockFromDropdownValue(value, lock));
      setOpen(false);
    },
    [lock, onLockChange],
  );

  const menu =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="listbox"
        className="rounded border overflow-y-auto shadow-2xl"
        style={{ ...menuStyle, borderColor: MENU_BORDER, background: MENU_BG }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1 text-[7px] font-extrabold uppercase tracking-wide" style={{ color: '#6a6a78' }}>
          Song
        </div>
        <button
          type="button"
          className="w-full text-left px-2 py-1.5 border-b outline-none hover:bg-[#2a2a38] text-[8px] font-bold"
          style={{
            borderColor: '#252530',
            background: dropdownValue === 'song-key' ? '#142820' : 'transparent',
            color: '#f0f0f8',
          }}
          onClick={() => pickValue('song-key')}
        >
          Song key · {studioKeyLabel(songKeyRoot, songKeyMode as StudioDetectedKeyMode)}
          {readyCount > 0 ? ` · ${readyCount} lane${readyCount === 1 ? '' : 's'}` : ''}
        </button>

        <div className="px-2 py-1 text-[7px] font-extrabold uppercase tracking-wide border-t" style={{ color: '#6a6a78', borderColor: '#252530' }}>
          Keys
        </div>
        {SE2_LAB808_CHORD_LOCK_KEY_OPTIONS.map((opt) => {
          const value = `key:${opt.root}:${opt.mode}`;
          const picked = dropdownValue === value;
          return (
            <button
              key={value}
              type="button"
              className="w-full text-left px-2 py-1 outline-none hover:bg-[#2a2a38] text-[8px] font-bold"
              style={{ background: picked ? '#142820' : 'transparent', color: picked ? ACCENT : '#d8d8e8' }}
              onClick={() => pickValue(value)}
            >
              {studioKeyLabel(opt.root, opt.mode as StudioDetectedKeyMode)}
            </button>
          );
        })}

        <div className="px-2 py-1 text-[7px] font-extrabold uppercase tracking-wide border-t" style={{ color: '#6a6a78', borderColor: '#252530' }}>
          Tracks
        </div>
        {candidates.length === 0 ? (
          <div className="px-2 py-2 text-[8px] font-semibold" style={{ color: '#8a8a9a' }}>
            Add a chord lane in SE2 first
          </div>
        ) : (
          candidates.map((t) => {
            const value = `track:${t.id}`;
            const picked = dropdownValue === value;
            const ready = se2Lab808ChordLockTrackReady(t);
            return (
              <button
                key={t.id}
                type="button"
                className="w-full text-left px-2 py-1.5 border-b outline-none hover:bg-[#2a2a38]"
                style={{ borderColor: '#252530', background: picked ? '#142820' : 'transparent' }}
                onClick={() => pickValue(value)}
              >
                <div className="text-[8px] font-extrabold uppercase tracking-wide" style={{ color: ready ? '#f0f0f8' : '#8a8a9a' }}>
                  <span style={{ color: ready ? ACCENT : '#6a6a78' }}>{ready ? '★ ' : '○ '}</span>
                  {laneLabel(t)} · {shortKind(t.kind)}
                </div>
                <div className="text-[7px] font-semibold mt-0.5" style={{ color: '#a8a8c0' }}>
                  {se2DrumGenHarmonyOptionHint(t)}
                </div>
              </button>
            );
          })
        )}
      </div>
    ) : null;

  const lockActive = lock.enabled && connected;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span style={sideLabel}>Chord lock</span>
      <button
        type="button"
        disabled={disabled || !connected}
        onClick={() => onLockChange({ ...lock, enabled: !lock.enabled })}
        className="w-full rounded border outline-none touch-manipulation"
        style={{
          padding: '6px 8px',
          borderColor: lockActive ? `${ACCENT}aa` : '#333340',
          background: lockActive ? `${ACCENT}18` : 'rgba(255,255,255,0.03)',
          color: lockActive ? ACCENT : connected ? '#a8a8b8' : '#6a6a78',
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          cursor: disabled || !connected ? 'default' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
        aria-pressed={lock.enabled}
        title={
          connected
            ? lock.enabled
              ? `Chord lock ON — ${rootCount} root${rootCount === 1 ? '' : 's'}`
              : `Lock pads to chord roots (${rootCount})`
            : 'Pick a key or chord lane below first'
        }
      >
        <Lock size={12} strokeWidth={lock.enabled ? 2.5 : 2} />
        {lock.enabled ? '● Lock on' : '○ Lock off'}
      </button>

      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        className="w-full rounded border px-2 py-1.5 text-left outline-none touch-manipulation inline-flex items-center justify-between gap-1 min-w-0"
        style={{
          borderColor: '#333340',
          background: '#0a0a10',
          color: '#e0e0ea',
          fontSize: 9,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.45 : 1,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={sourceLabel}
      >
        <span className="truncate font-semibold">{sourceLabel}</span>
        <ChevronDown size={12} className="shrink-0 opacity-70" />
      </button>

      {menu}
    </div>
  );
}
