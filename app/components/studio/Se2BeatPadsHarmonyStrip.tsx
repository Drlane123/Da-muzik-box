'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Lock, Music2, RefreshCw, Sparkles, Unlock } from 'lucide-react';

import {
  SE2_DRUM_GEN_STYLE_CHIPS,
  se2DrumGenHarmonyKindLabel,
  se2DrumGenHarmonyOptionHint,
  se2SortDrumGenHarmonyCandidates,
  type Se2DrumGenStyle,
} from '@/app/lib/studio/se2DrumGeneratorTrack';
import { se2InferDrumGenStyleFromHarmonyTrack } from '@/app/lib/studio/se2DrumGeneratorEngine';
import {
  se2BeatPadsHarmonyKey,
  se2BeatPadsHarmonyReady,
  se2BeatPadsHarmonyReadyCandidates,
  se2BeatPadsHarmonySourceCandidates,
  se2BeatPadsHarmonySyncFromLane,
  type Se2BeatPadsHarmonySourceTrack,
} from '@/app/lib/studio/se2BeatPadsHarmony';
import type { Se2BeatPadsTrack } from '@/app/lib/studio/se2BeatPadsTrack';
import { studioKeyLabel } from '@/app/lib/studio/studioAudioClipAnalysis';
import { se2TrackNumberedName } from '@/app/lib/studio/se2StudioTrackNumber';

const ACCENT = '#7cf4c6';
const BEAT_PADS_LABEL_CLASS = 'text-[8px] font-extrabold uppercase tracking-wide';
/** Match-chords column title + status hint — slightly smaller to save vertical space. */
const BEAT_PADS_STRIP_TITLE_CLASS = 'text-[7px] font-extrabold uppercase tracking-wide leading-none';
const BEAT_PADS_STRIP_HINT_CLASS = 'text-[7px] font-semibold leading-tight tracking-tight';

const MENU_BG = '#1a1a24';
const MENU_BORDER = '#3a3a4c';

const PICKER_W = 118;

/** One shared chip height for the whole harmony strip row. */
const STRIP_CHIP_H = 'h-[22px]';
const STRIP_CHIP =
  `inline-flex shrink-0 items-center gap-1 rounded border box-border ${STRIP_CHIP_H} ${BEAT_PADS_LABEL_CLASS}`;

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
    default:
      return se2DrumGenHarmonyKindLabel(kind).slice(0, 6);
  }
}

type HarmonyPickerProps = {
  selectedTrackId: string;
  candidates: readonly Se2BeatPadsHarmonySourceTrack[];
  readyCount: number;
  disabled?: boolean;
  lanePad: number;
  onSelect: (trackId: string) => void;
};

function BeatPadsHarmonyPicker({
  selectedTrackId,
  candidates,
  readyCount,
  disabled = false,
  lanePad,
  onSelect,
}: HarmonyPickerProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = candidates.find((t) => t.id === selectedTrackId);
  const laneLabel = (t: Se2BeatPadsHarmonySourceTrack) =>
    se2TrackNumberedName(t.laneNumber, t.name, lanePad);

  const triggerLabel = selected
    ? `${laneLabel(selected)} · ${shortKind(selected.kind)}`
    : candidates.length === 0
      ? 'Add lane'
      : readyCount === 0
        ? 'Pick lane'
        : 'Auto';

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

  const toggle = useCallback(
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
          maxHeight: Math.min(280, window.innerHeight - r.bottom - 12),
          zIndex: 30050,
        });
      }
      setOpen((v) => !v);
    },
    [disabled, open],
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
        <button
          type="button"
          className={`w-full text-left px-2 py-2 border-b outline-none hover:bg-[#2a2a38] ${BEAT_PADS_LABEL_CLASS}`}
          style={{ borderColor: '#2e2e3a', color: '#f0f0f8' }}
          onClick={() => {
            onSelect('');
            setOpen(false);
          }}
        >
          {readyCount === 0 ? 'Pick a lane with chords' : 'Auto (first ready)'}
        </button>
        {candidates.map((t) => {
          const ready = se2BeatPadsHarmonyReady(t);
          const picked = selectedTrackId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className="w-full text-left px-2 py-2 border-b outline-none hover:bg-[#2a2a38]"
              style={{
                borderColor: '#252530',
                background: picked ? '#142820' : 'transparent',
              }}
              onClick={() => {
                onSelect(t.id);
                setOpen(false);
              }}
            >
              <div className={BEAT_PADS_LABEL_CLASS} style={{ fontWeight: picked ? 800 : 700, color: ready ? '#f0f0f8' : '#8a8a9a' }}>
                <span style={{ color: ready ? ACCENT : '#6a6a78' }}>{ready ? '★ ' : '○ '}</span>
                {laneLabel(t)} · {shortKind(t.kind)}
              </div>
              <div style={{ fontSize: 9, color: '#a8a8c0', marginTop: 2 }}>{se2DrumGenHarmonyOptionHint(t)}</div>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
        className={`${STRIP_CHIP} justify-between px-2 outline-none disabled:opacity-45`}
        style={{
          width: PICKER_W,
          borderColor: open ? `${ACCENT}88` : '#3a4860',
          background: '#12121a',
          color: '#f0f0f8',
        }}
        title="Match Beat Pads to your chord / card / Geno lane"
      >
        <span className={`truncate ${BEAT_PADS_LABEL_CLASS}`}>{triggerLabel}</span>
        <ChevronDown size={12} style={{ color: '#9a9ab0', flexShrink: 0 }} />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}

export type Se2BeatPadsHarmonyStripProps = {
  track: Se2BeatPadsTrack;
  tracks: readonly Se2BeatPadsHarmonySourceTrack[];
  songKeyRoot: number;
  songKeyMode: 'major' | 'minor';
  sessionBpm: number;
  sessionLoopBars: number;
  disabled?: boolean;
  kickTargetPad?: number;
  /** Instrument role for the selected pad (Snare, Kick, …) — drives Regenerate label. */
  padRoleLabel?: string;
  onHarmonyTrackIdChange: (trackId: string) => void;
  onHarmonyLockedChange: (locked: boolean) => void;
  onPatternStyleChange: (style: Se2DrumGenStyle) => void;
  onSyncFromHarmony: () => void;
  onLoadMatchedPattern: () => void;
  onKickKeyLockChange: (locked: boolean) => void;
  onRegeneratePad: () => void;
  regeneratingPad?: boolean;
  loadingPattern?: boolean;
};

export function Se2BeatPadsHarmonyStrip({
  track,
  tracks,
  songKeyRoot,
  songKeyMode,
  sessionBpm,
  sessionLoopBars,
  disabled = false,
  kickTargetPad = 0,
  padRoleLabel = 'Kick',
  onHarmonyTrackIdChange,
  onHarmonyLockedChange,
  onPatternStyleChange,
  onSyncFromHarmony,
  onLoadMatchedPattern,
  onKickKeyLockChange,
  onRegeneratePad,
  regeneratingPad = false,
  loadingPattern = false,
}: Se2BeatPadsHarmonyStripProps) {
  const lanePad = Math.max(2, String(tracks.length).length);
  const candidates = useMemo(
    () => se2SortDrumGenHarmonyCandidates(se2BeatPadsHarmonySourceCandidates(tracks, track.id)),
    [tracks, track.id],
  );
  const readyCount = useMemo(
    () => se2BeatPadsHarmonyReadyCandidates(tracks, track.id).length,
    [tracks, track.id],
  );

  const harmony = useMemo(() => {
    const want = track.beatPadsHarmonyTrackId?.trim();
    if (want) return candidates.find((t) => t.id === want);
    return se2BeatPadsHarmonyReadyCandidates(tracks, track.id)[0];
  }, [candidates, track.beatPadsHarmonyTrackId, tracks, track.id]);

  const activeStyle = track.beatPadsPatternStyle ?? 'pop';
  const linkedStyle = harmony ? se2InferDrumGenStyleFromHarmonyTrack(harmony, tracks) : null;
  const harmonyLocked = track.beatPadsHarmonyLocked ?? false;
  const syncPreview = se2BeatPadsHarmonySyncFromLane(harmony, tracks, {
    sessionBpm,
    sessionLoopBars,
    songKeyRoot,
    songKeyMode,
    styleOverride: activeStyle,
  });
  const displayKey = se2BeatPadsHarmonyKey(harmony, songKeyRoot, songKeyMode);
  const keyLabel = studioKeyLabel(displayKey.keyRoot, displayKey.keyMode);
  const kickKeyLock = track.beatPadsKickKeyLock ?? false;
  const kickPadUi = Math.max(1, Math.min(16, Math.round(kickTargetPad) + 1));

  return (
    <div
      className="shrink-0 flex flex-col gap-0.5 border-b px-2 py-1"
      style={{ borderColor: `${ACCENT}33`, background: 'rgba(6, 12, 10, 0.92)' }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className={`${BEAT_PADS_STRIP_TITLE_CLASS} shrink-0`} style={{ color: ACCENT }}>
          Match chords
        </span>
        <BeatPadsHarmonyPicker
          selectedTrackId={track.beatPadsHarmonyTrackId ?? ''}
          candidates={candidates}
          readyCount={readyCount}
          disabled={disabled}
          lanePad={lanePad}
          onSelect={onHarmonyTrackIdChange}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onHarmonyLockedChange(!harmonyLocked)}
          className={`${STRIP_CHIP} px-2`}
          style={{
            borderColor: harmonyLocked ? ACCENT : '#3a4860',
            background: harmonyLocked ? `${ACCENT}22` : '#12121a',
            color: harmonyLocked ? ACCENT : '#9090a8',
          }}
          title={
            harmonyLocked
              ? 'Locked — BPM, loop, and key follow your chord lane'
              : 'Lock Beat Pads to chord lane tempo, loop, and key'
          }
        >
          {harmonyLocked ? <Lock size={10} /> : <Unlock size={10} />}
          {harmonyLocked ? 'Locked' : 'Lock'}
        </button>
        <button
          type="button"
          disabled={disabled || !harmony}
          onClick={onSyncFromHarmony}
          className={`${STRIP_CHIP} px-2`}
          style={{ borderColor: '#3a4860', color: '#c0c0d0', background: '#12121a' }}
          title="Sync BPM, loop bars, and song key from linked lane"
        >
          <RefreshCw size={10} />
          Sync
        </button>
        <span
          className={`${STRIP_CHIP} px-2 tabular-nums`}
          style={{ borderColor: `${ACCENT}44`, color: ACCENT, background: `${ACCENT}10` }}
          title="Key from linked lane (or song key)"
        >
          <Music2 size={10} />
          {keyLabel}
        </span>
        <span
          className="hidden sm:inline shrink-0 w-px self-stretch my-0.5"
          style={{ background: `${ACCENT}33` }}
          aria-hidden
        />
        {SE2_DRUM_GEN_STYLE_CHIPS.slice(0, 6).map((c) => {
          const on = activeStyle === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onPatternStyleChange(c.id)}
              className={`${STRIP_CHIP} px-1.5`}
              style={{
                borderColor: on ? ACCENT : '#3a4860',
                background: on ? `${ACCENT}18` : '#12121a',
                color: on ? ACCENT : '#8888a0',
              }}
            >
              {c.label}
            </button>
          );
        })}
        {linkedStyle && linkedStyle !== activeStyle ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPatternStyleChange(linkedStyle)}
            className={`${STRIP_CHIP} px-1.5`}
            style={{ borderColor: '#ffb84d66', color: '#ffb84d', background: '#ffb84d10' }}
          >
            Use {linkedStyle}
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled || loadingPattern}
          onClick={onLoadMatchedPattern}
          className={`${STRIP_CHIP} px-2`}
          style={{ borderColor: `${ACCENT}88`, background: `${ACCENT}14`, color: ACCENT }}
          title={`Load a ${activeStyle} groove into the step grid`}
        >
          <Sparkles size={9} />
          {loadingPattern ? '…' : 'Load groove'}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onKickKeyLockChange(!kickKeyLock)}
          className={`${STRIP_CHIP} px-2`}
          style={{
            borderColor: kickKeyLock ? ACCENT : '#3a4860',
            background: kickKeyLock ? `${ACCENT}22` : '#12121a',
            color: kickKeyLock ? ACCENT : '#8888a0',
          }}
          title={
            kickKeyLock
              ? `Pad ${kickPadUi} tuned to ${keyLabel} — click to unlock pitch`
              : `Lock Pad ${kickPadUi} to ${keyLabel} (808 / kick sample → key root)`
          }
        >
          {kickKeyLock ? <Lock size={9} /> : <Unlock size={9} />}
          808 in key
        </button>
        <button
          type="button"
          disabled={disabled || regeneratingPad}
          onClick={onRegeneratePad}
          className={`${STRIP_CHIP} px-2`}
          style={{ borderColor: `${ACCENT}88`, background: `${ACCENT}14`, color: ACCENT }}
          title={`Regenerate ${padRoleLabel} groove on Pad ${kickPadUi} — matches this pad’s instrument (style chip picks genre pocket)`}
        >
          <RefreshCw size={9} className={regeneratingPad ? 'animate-spin' : undefined} />
          {regeneratingPad ? '…' : `Regen ${padRoleLabel} · ${kickPadUi}`}
        </button>
        <span
          className="inline-flex shrink-0 flex-col items-center self-center px-1"
          style={{
            color: ACCENT,
            cursor: 'default',
            pointerEvents: 'none',
            lineHeight: 1,
            transform: 'translateY(8px)',
          }}
          title="Sound Families — sample boxes in the row below"
          aria-label="Sound Families — points down to sample boxes below"
        >
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            SOUND FAMILIES
          </span>
          <span className="beat-pads-sf-arrow-stack" aria-hidden>
            <ChevronDown
              size={18}
              strokeWidth={2.75}
              className="beat-pads-sf-arrow--1"
            />
            <ChevronDown
              size={18}
              strokeWidth={2.75}
              className="beat-pads-sf-arrow--2"
            />
          </span>
        </span>
      </div>

      {harmony ? (
        <span className={`truncate ${BEAT_PADS_STRIP_HINT_CLASS}`} style={{ color: '#7a8a88' }}>
          {se2TrackNumberedName(harmony.laneNumber, harmony.name, lanePad)} · {syncPreview.loopBars} bars ·{' '}
          {syncPreview.style}
          {harmonyLocked ? ' · following lane' : ''}
          {kickKeyLock ? ` · Pad ${kickPadUi} → ${keyLabel}` : ''}
        </span>
      ) : (
        <span className={BEAT_PADS_STRIP_HINT_CLASS} style={{ color: '#6a7078' }}>
          Add Rhythm Edit, Progression+, or Synth Geno — then match here for in-key grooves.
        </span>
      )}
    </div>
  );
}
