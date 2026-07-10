'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Se2SynthGenoSoundBankEntry } from '@/app/lib/studio/se2SynthGenoSoundBank';
import {
  se2SynthGenoLaneFilterMorphDefaults,
  type Se2SynthGenoLaneFilterMorph,
} from '@/app/lib/studio/se2SynthGenoSoundBank';
import { GrooveStyleTCapParamHorizontalFader } from '@/app/components/creation/GrooveStyleTCapVolumeFader';
import { useSe2SynthGenoLaneSoundStripGroup } from '@/app/components/studio/Se2SynthGenoLaneSoundStripGroup';

export type Se2SynthGenoLaneSoundStripProps = {
  accentHex?: string;
  disabled?: boolean;
  /** Unique id when used inside Se2SynthGenoLaneSoundStripGroup — only one panel open at a time. */
  stripId?: string;
  label: string;
  panelButtonLabel: string;
  panelTitle: string;
  entries: readonly Se2SynthGenoSoundBankEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  sanitizeId?: (id: string) => string;
  showSoundGrid?: boolean;
  showDelay?: boolean;
  morph?: Se2SynthGenoLaneFilterMorph & { delayMix?: number };
  onMorphChange?: (morph: Se2SynthGenoLaneFilterMorph & { delayMix?: number }) => void;
  morphDefaults?: (bankId: string) => Se2SynthGenoLaneFilterMorph & { delayMix?: number };
  pushRight?: boolean;
};

/** Bright panel copy — inline colors so portal text never inherits dark theme. */
const FX_PANEL_WHITE = '#ffffff';
const FX_PANEL_SOFT = '#f0f0f8';
const FX_PANEL_MUTED = '#d8d8e8';

function laneFxNeonLabel(accentHex: string): string {
  if (accentHex.toLowerCase() === '#a78bfa') return '#e8dcff';
  if (accentHex.toLowerCase() === '#fbbf24') return '#fff0c2';
  if (accentHex.toLowerCase() === '#00e5cc') return '#c8fff8';
  return FX_PANEL_SOFT;
}

/** Synth Geno typography — match panel headers + lane column labels (not heavy body bold). */
const GENO_TITLE_STYLE = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
};
const GENO_SECTION_STYLE = {
  fontSize: 7,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
};
const GENO_LABEL_STYLE = {
  fontSize: 8,
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
};
const GENO_VALUE_STYLE = {
  fontSize: 8,
  fontWeight: 400,
  letterSpacing: '0.04em',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};
const GENO_ACTION_STYLE = {
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
};

function LaneFilterSlider({
  label,
  display,
  min,
  max,
  step,
  value,
  accentHex,
  disabled,
  onChange,
  compact = false,
}: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  accentHex: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col px-0.5 ${compact ? 'gap-1' : 'gap-2'}`}>
      <div className="flex justify-between items-center gap-3">
        <span style={{ ...GENO_LABEL_STYLE, color: FX_PANEL_WHITE }}>
          {label}
        </span>
        <span
          className="shrink-0"
          style={{ ...GENO_VALUE_STYLE, color: laneFxNeonLabel(accentHex) }}
        >
          {display}
        </span>
      </div>
      <GrooveStyleTCapParamHorizontalFader
        compact
        min={min}
        max={max}
        step={step}
        value={value}
        accent={accentHex}
        disabled={disabled}
        onChange={onChange}
        ariaLabel={label}
      />
    </div>
  );
}

function LaneSoundPanelPortal({
  anchorRef,
  open,
  onClose,
  estimatedWidth = 300,
  children,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  estimatedWidth?: number;
  children: ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelW = panelRef.current?.offsetWidth ?? estimatedWidth;
    const margin = 12;
    let left = rect.left;
    if (left + panelW > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - panelW - margin);
    }
    setPos({ top: rect.bottom + 6, left });
  }, [anchorRef, estimatedWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1200]"
        aria-hidden
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={panelRef}
        className="fixed z-[1201]"
        style={{ top: pos.top, left: pos.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export function Se2SynthGenoLaneSoundStrip({
  accentHex = '#00E5CC',
  disabled = false,
  stripId,
  label,
  panelButtonLabel,
  panelTitle,
  entries,
  selectedId,
  onSelect,
  sanitizeId = (id) => id,
  showSoundGrid = false,
  showDelay = false,
  morph: morphProp,
  onMorphChange,
  morphDefaults,
  pushRight = false,
}: Se2SynthGenoLaneSoundStripProps) {
  const group = useSe2SynthGenoLaneSoundStripGroup();
  const [soloOpen, setSoloOpen] = useState(false);
  const panelOpen = stripId && group ? group.isOpen(stripId) : soloOpen;
  const value = sanitizeId(selectedId);
  const defaultMorph = useCallback(
    (bankId: string) =>
      morphDefaults?.(bankId) ?? {
        ...se2SynthGenoLaneFilterMorphDefaults(entries[0]?.category ?? 'melody', bankId),
      },
    [entries, morphDefaults],
  );
  const [internalMorph, setInternalMorph] = useState(() => defaultMorph(value));
  const anchorRef = useRef<HTMLDivElement>(null);

  const morph = morphProp ?? internalMorph;
  const setMorph = useCallback(
    (next: Se2SynthGenoLaneFilterMorph & { delayMix?: number }) => {
      if (onMorphChange) onMorphChange(next);
      else setInternalMorph(next);
    },
    [onMorphChange],
  );

  useEffect(() => {
    if (morphProp) return;
    setInternalMorph(defaultMorph(value));
  }, [value, morphProp, defaultMorph]);

  const closePanel = useCallback(() => {
    if (stripId && group) group.close();
    else setSoloOpen(false);
  }, [group, stripId]);

  const togglePanel = useCallback(() => {
    if (stripId && group) group.toggle(stripId);
    else setSoloOpen((o) => !o);
  }, [group, stripId]);

  const patchMorph = (partial: Partial<Se2SynthGenoLaneFilterMorph & { delayMix?: number }>) => {
    setMorph({ ...morph, ...partial });
  };

  const panel = (
    <div
      className={`flex flex-col rounded-lg border shadow-2xl ${showSoundGrid ? 'gap-2' : 'gap-3.5'}`}
      style={{
        color: FX_PANEL_WHITE,
        borderColor: `${accentHex}aa`,
        background: 'linear-gradient(165deg, #2a2a3c 0%, #1a1a28 55%, #12121c 100%)',
        width: showSoundGrid ? 'min(360px, calc(100vw - 2rem))' : 'min(300px, calc(100vw - 2rem))',
        minWidth: showSoundGrid ? 320 : 280,
        padding: showSoundGrid ? '11px 18px' : '16px 18px',
        boxSizing: 'border-box',
        boxShadow: `0 14px 44px rgba(0,0,0,0.5), 0 0 0 1px ${accentHex}44`,
      }}
    >
      <div className="flex items-center justify-between gap-3 px-0.5">
        <span style={{ ...GENO_TITLE_STYLE, color: laneFxNeonLabel(accentHex) }}>
          {panelTitle}
        </span>
        <button
          type="button"
          style={{ ...GENO_ACTION_STYLE, color: FX_PANEL_MUTED, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          onClick={closePanel}
        >
          Close
        </button>
      </div>

      {showSoundGrid ? (
        <div className="grid grid-cols-2 gap-1 px-0.5">
          {entries.map((e) => {
            const active = e.id === value;
            return (
              <button
                key={e.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(e.id)}
                className="rounded-md border px-2.5 py-1 text-left text-[8px] leading-tight disabled:opacity-40"
                style={{
                  ...GENO_LABEL_STYLE,
                  borderColor: active ? `${accentHex}cc` : '#4a4a5c',
                  background: active ? `${accentHex}30` : 'rgba(36,36,52,0.98)',
                  color: FX_PANEL_WHITE,
                }}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className={`flex flex-col px-0.5 ${showSoundGrid ? 'gap-2 pt-1.5 border-t' : 'gap-4'}`}
        style={{ borderColor: `${accentHex}44` }}
      >
        <span
          style={{ ...GENO_SECTION_STYLE, color: FX_PANEL_WHITE }}
        >
          Filter · low &amp; high cut
        </span>

        <LaneFilterSlider
          label="Low cut"
          display={`${morph.lowCutHz} Hz`}
          min={40}
          max={400}
          step={5}
          value={morph.lowCutHz}
          accentHex={accentHex}
          disabled={disabled}
          compact={showSoundGrid}
          onChange={(v) => patchMorph({ lowCutHz: v })}
        />

        <LaneFilterSlider
          label="High cut"
          display={`${morph.highCutHz} Hz`}
          min={800}
          max={12000}
          step={50}
          value={morph.highCutHz}
          accentHex={accentHex}
          disabled={disabled}
          compact={showSoundGrid}
          onChange={(v) => patchMorph({ highCutHz: v })}
        />

        {showDelay ? (
          <LaneFilterSlider
            label="Delay"
            display={`${Math.round((morph.delayMix ?? 0) * 100)}%`}
            min={0}
            max={45}
            step={1}
            value={Math.round((morph.delayMix ?? 0) * 100)}
            accentHex={accentHex}
            disabled={disabled}
            compact={showSoundGrid}
            onChange={(v) => patchMorph({ delayMix: v / 100 })}
          />
        ) : null}

        <button
          type="button"
          disabled={disabled}
          onClick={() => setMorph(defaultMorph(value))}
          className={`self-start disabled:opacity-30 ${showSoundGrid ? '-mt-0.5' : ''}`}
          style={{ ...GENO_ACTION_STYLE, color: FX_PANEL_MUTED, background: 'transparent', border: 'none', padding: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          Reset filter
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={anchorRef}
      className={`relative flex items-end gap-1.5 shrink-0 ${pushRight ? 'ml-auto' : ''} ${panelOpen ? 'z-[10]' : ''}`}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[7px] font-bold uppercase tracking-widest opacity-45 whitespace-nowrap">
          {label}
        </span>
        <select
          disabled={disabled}
          value={value}
          onChange={(e) => onSelect(sanitizeId(e.target.value))}
          className="rounded-md border px-2 py-1 text-[9px] font-semibold outline-none disabled:opacity-40 truncate max-w-[168px]"
          style={{
            borderColor: `${accentHex}66`,
            background: '#0c0c14',
            color: '#e8e8f4',
          }}
        >
          {entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={togglePanel}
        className="rounded-md border px-2 py-1 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 shrink-0"
        style={{
          borderColor: panelOpen ? `${accentHex}99` : `${accentHex}44`,
          background: panelOpen ? `${accentHex}22` : '#0c0c14',
          color: panelOpen ? accentHex : '#c8c8d8',
        }}
        aria-expanded={panelOpen}
      >
        {panelOpen ? 'Close' : panelButtonLabel}
      </button>

      <LaneSoundPanelPortal
        anchorRef={anchorRef}
        open={panelOpen}
        onClose={closePanel}
        estimatedWidth={showSoundGrid ? 360 : 300}
      >
        {panel}
      </LaneSoundPanelPortal>
    </div>
  );
}
