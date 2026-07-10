'use client';

import { ChevronDown, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import {
  SE2_DRUM_GEN_MODERN_GENRES,
  se2GenerateModernBankLoad,
  se2ModernBankPresetById,
  se2ModernBankPresetsForGenre,
  se2ModernBankTriggerLabel,
  se2ResolveModernGenreFromHarmony,
  type Se2DrumGenModernGenre,
  type Se2DrumGenModernPreset,
} from '@/app/lib/studio/se2DrumGenModernBank';
import type { Se2DrumGenHarmonySourceTrack, Se2DrumGenStyle } from '@/app/lib/studio/se2DrumGeneratorTrack';
import { getPatternPresetBpm } from '@/app/lib/patternPresets';

const BANK2_ACCENT = '#c77dff';

export type Se2DrumGenModernBankMenuProps = {
  chordStyle: Se2DrumGenStyle;
  harmony?: Se2DrumGenHarmonySourceTrack;
  tracks: readonly Se2DrumGenHarmonySourceTrack[];
  selectedPresetId?: string;
  seed: number;
  temperature: number;
  beatsPerBar: number;
  loopBars: number;
  onApplyGenerated: (
    load: Awaited<ReturnType<typeof se2GenerateModernBankLoad>>,
    nextSeed: number,
  ) => void;
  disabled?: boolean;
  triggerWidthPx?: number;
  triggerFontPx?: number;
  className?: string;
  title?: string;
};

export function Se2DrumGenModernBankMenu({
  chordStyle,
  harmony,
  tracks,
  selectedPresetId,
  seed,
  temperature,
  beatsPerBar,
  loopBars,
  onApplyGenerated,
  disabled = false,
  triggerWidthPx = 118,
  triggerFontPx = 11,
  className = '',
  title = 'Bank 2 — chord-matched modern grooves (Drill, Lo-Fi, Dance, K-pop)',
}: Se2DrumGenModernBankMenuProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const inferredGenre = useMemo(
    () => se2ResolveModernGenreFromHarmony(harmony, tracks, chordStyle),
    [chordStyle, harmony, tracks],
  );

  const triggerLabel = useMemo(
    () => se2ModernBankTriggerLabel(harmony, tracks, chordStyle, selectedPresetId),
    [chordStyle, harmony, selectedPresetId, tracks],
  );

  const genreLabel = SE2_DRUM_GEN_MODERN_GENRES.find((g) => g.id === inferredGenre)?.label ?? 'Bank 2';

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
    const tid = window.setTimeout(() => {
      document.addEventListener('mousedown', handler, true);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const runGenerate = useCallback(
    async (opts: { preset?: Se2DrumGenModernPreset; forceGenre?: Se2DrumGenModernGenre; bumpSeed?: boolean }) => {
      if (disabled || generating) return;
      setGenerating(true);
      try {
        const nextSeed = opts.bumpSeed
          ? seed + 1 + Math.floor(Math.random() * 997)
          : seed;
        const load = await se2GenerateModernBankLoad({
          chordStyle,
          harmony,
          allTracks: tracks,
          preset: opts.preset,
          forceGenre: opts.forceGenre,
          seed: nextSeed,
          temperature,
          beatsPerBar,
          loopBars,
        });
        onApplyGenerated(load, nextSeed);
        setOpen(false);
      } finally {
        setGenerating(false);
      }
    },
    [
      beatsPerBar,
      chordStyle,
      disabled,
      generating,
      harmony,
      loopBars,
      onApplyGenerated,
      seed,
      temperature,
      tracks,
    ],
  );

  const openMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (disabled) return;
      if (!open && typeof window !== 'undefined') {
        const r = e.currentTarget.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const minW = Math.max(triggerWidthPx, 248);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceAbove = r.top - 8;
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(380, Math.max(200, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
        const style: CSSProperties =
          spaceAbove >= spaceBelow
            ? { position: 'fixed', bottom: vh - r.top + 2, left, width: minW, maxHeight: maxH, zIndex: 30050 }
            : { position: 'fixed', top: r.bottom + 2, left, width: minW, maxHeight: maxH, zIndex: 30050 };
        setMenuStyle(style);
      }
      setOpen((o) => !o);
    },
    [disabled, open, triggerWidthPx],
  );

  const menuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label="Bank 2 modern drum generator"
        className="rounded border overflow-y-auto overflow-x-hidden shadow-2xl flex flex-col"
        style={{
          ...menuStyle,
          borderColor: '#4a3a5c',
          background: '#1a1524',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(199,125,255,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={generating}
          className="w-full text-left px-2.5 py-2 border-b outline-none transition-colors hover:bg-[#2a2238] disabled:opacity-50"
          style={{
            borderColor: '#322a42',
            background: 'linear-gradient(90deg, rgba(199,125,255,0.18), transparent)',
            color: '#f0e8ff',
            fontSize: triggerFontPx,
            fontWeight: 800,
            lineHeight: 1.35,
          }}
          onClick={() => void runGenerate({ bumpSeed: true })}
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles size={12} style={{ color: BANK2_ACCENT }} />
            {generating ? 'Generating…' : `Gen from chords · ${genreLabel}`}
          </span>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#a898c8', marginTop: 2 }}>
            Drill · Lo-Fi · Dance · K-pop — matched to linked lane
          </div>
        </button>

        {SE2_DRUM_GEN_MODERN_GENRES.map((genre) => {
          const presets = se2ModernBankPresetsForGenre(genre.id);
          if (presets.length === 0) return null;
          return (
            <div key={genre.id}>
              <div
                className="sticky top-0 px-2.5 py-1 border-b text-[8px] font-black uppercase tracking-widest"
                style={{
                  borderColor: '#2a2438',
                  background: '#221c30',
                  color: genre.id === inferredGenre ? BANK2_ACCENT : '#8a7aa8',
                }}
              >
                {genre.label}
                {genre.id === inferredGenre ? ' · chord match' : ''}
              </div>
              {presets.map((preset) => {
                const picked = selectedPresetId === preset.id;
                const bpm = preset.bpm ?? getPatternPresetBpm(preset);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="option"
                    aria-selected={picked}
                    disabled={generating}
                    className="w-full text-left px-2.5 py-1.5 border-b outline-none transition-colors hover:bg-[#2a2238] disabled:opacity-50"
                    style={{
                      borderColor: '#252030',
                      background: picked ? '#2d2640' : 'transparent',
                      lineHeight: 1.3,
                    }}
                    onClick={() => void runGenerate({ preset, bumpSeed: true })}
                  >
                    <div
                      style={{
                        fontSize: triggerFontPx,
                        fontWeight: picked ? 800 : 700,
                        color: '#f0e8ff',
                      }}
                    >
                      {preset.name}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#9a8ab0', marginTop: 1 }}>
                      {bpm} BPM · {preset.desc?.slice(0, 42) ?? genre.label}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    ) : null;

  const activePreset = se2ModernBankPresetById(selectedPresetId);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || generating}
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        className={`inline-flex shrink-0 items-center justify-between gap-1 rounded border px-2 py-1 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
        style={{
          width: triggerWidthPx,
          borderColor: open ? `${BANK2_ACCENT}88` : '#4a3a5c',
          background: '#15101e',
          color: '#f0e8ff',
          fontSize: triggerFontPx,
          fontWeight: 700,
        }}
        title={
          activePreset
            ? `${activePreset.name} — Bank 2`
            : `${title} · inferred ${genreLabel}`
        }
      >
        <span className="truncate">{generating ? '…' : triggerLabel}</span>
        <ChevronDown size={12} style={{ color: '#9a8ab0', flexShrink: 0 }} />
      </button>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </>
  );
}
