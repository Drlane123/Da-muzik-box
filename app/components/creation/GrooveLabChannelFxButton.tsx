'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { GrooveLabChannelFxPanel } from '@/app/components/creation/GrooveLabChannelFxPanel';
import { PadSamplerFxTCapStyles } from '@/app/components/creation/PadSamplerFxWidgets';
import { useMasterClock } from '@/app/context/MasterClockContext';
import {
  GROOVE_LAB_CHANNEL_FX_CHANGED,
  grooveLabChannelFxActive,
  readGrooveLabChannelFx,
  setGrooveLabChannelFx,
  type GrooveLabChannelFxRack,
} from '@/app/lib/creationStation/grooveLabChannelFx';
import { resolveGrooveLabChannelDest } from '@/app/lib/creationStation/grooveLabAudio';

const FX_PANEL_WIDTH_PX = 320;
const FX_PANEL_EST_HEIGHT = 620;
const FX_PANEL_Z = 85_000;
const VIEW_MARGIN = 8;

export type GrooveLabChannelFxButtonProps = {
  ch: number;
  channelLabel: string;
  accent?: string;
  /** embed = full-width tab under meters; strip = compact F|X under PAN */
  variant?: 'embed' | 'strip';
  onActivate?: () => void;
};

export function GrooveLabChannelFxButton({
  ch,
  channelLabel,
  accent = '#86efac',
  variant = 'strip',
  onActivate,
}: GrooveLabChannelFxButtonProps) {
  const { getOrCreateAudioContext } = useMasterClock();
  const [open, setOpen] = useState(false);
  const [rack, setRack] = useState<GrooveLabChannelFxRack>(() => readGrooveLabChannelFx(ch));
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });

  const hasFx = grooveLabChannelFxActive(rack);

  const pushLive = useCallback(
    (next: GrooveLabChannelFxRack) => {
      setRack(next);
      try {
        const ctx = getOrCreateAudioContext();
        resolveGrooveLabChannelDest(ctx, ch);
      } catch {
        /* no audio yet */
      }
    },
    [ch, getOrCreateAudioContext],
  );

  const patchRack = useCallback(
    (patch: Parameters<typeof setGrooveLabChannelFx>[1]) => {
      const next = setGrooveLabChannelFx(ch, patch);
      pushLive(next);
    },
    [ch, pushLive],
  );

  useEffect(() => {
    setRack(readGrooveLabChannelFx(ch));
  }, [ch]);

  useEffect(() => {
    const onFx = (e: Event) => {
      const detail = (e as CustomEvent<{ ch: number; rack: GrooveLabChannelFxRack }>).detail;
      if (detail?.ch === ch) setRack(detail.rack);
    };
    window.addEventListener(GROOVE_LAB_CHANNEL_FX_CHANGED, onFx);
    return () => window.removeEventListener(GROOVE_LAB_CHANNEL_FX_CHANGED, onFx);
  }, [ch]);

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const w = Math.min(FX_PANEL_WIDTH_PX, vw - 2 * VIEW_MARGIN);
    let left = r.right - w;
    left = Math.max(VIEW_MARGIN, Math.min(left, vw - w - VIEW_MARGIN));
    let top = r.bottom + gap;
    const estH = Math.min(panelRef.current?.offsetHeight ?? FX_PANEL_EST_HEIGHT, vh - 2 * VIEW_MARGIN);
    if (top + estH > vh - VIEW_MARGIN) {
      top = Math.max(VIEW_MARGIN, r.top - gap - estH);
    }
    setPanelPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => reposition());
    return () => cancelAnimationFrame(id);
  }, [open, reposition, rack.cutoff, rack.eq, rack.compressor]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onResize = () => reposition();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, reposition]);

  const glow = open || hasFx ? accent : '#424250';
  const letterStyle = (): CSSProperties => ({
    fontSize: variant === 'embed' ? 9 : 8,
    fontWeight: 800,
    lineHeight: 1,
    color: open || hasFx ? '#f4f4ff' : '#a0a0b4',
    textShadow: open || hasFx ? `0 0 6px ${accent}` : '0 1px 1px rgba(0,0,0,0.9)',
  });

  const panel =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <PadSamplerFxTCapStyles />
        <div
          ref={panelRef}
          data-beatlab-portal-popover=""
          className="fixed rounded border shadow-xl select-none"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: FX_PANEL_WIDTH_PX,
            maxHeight: 'min(86vh, 720px)',
            overflowY: 'auto',
            padding: 12,
            zIndex: FX_PANEL_Z,
            isolation: 'isolate',
            boxSizing: 'border-box',
            background: '#0c0c12',
            borderColor: 'rgba(129, 140, 248, 0.35)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
          role="dialog"
          aria-label={`${channelLabel} effects`}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: `1px solid ${accent}33`,
            }}
          >
            <button
              type="button"
              title="Close effects"
              aria-label="Close effects"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                flexShrink: 0,
                padding: 0,
                borderRadius: 5,
                border: '1px solid rgba(248, 113, 113, 0.45)',
                background: 'rgba(24, 12, 14, 0.95)',
                color: '#fca5a5',
                cursor: 'pointer',
              }}
            >
              <X size={15} strokeWidth={2.5} aria-hidden />
            </button>
            <div
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: accent, letterSpacing: '0.08em', minWidth: 0 }}
            >
              {channelLabel} · FX
            </div>
          </div>

          <GrooveLabChannelFxPanel
            rack={rack}
            onCutoffChange={(next) => patchRack({ cutoff: next })}
            onEqChange={(next) => patchRack({ eq: next })}
            onCompChange={(next) => patchRack({ compressor: next })}
          />
        </div>
      </>,
      document.body,
    );

  const btnMinW = variant === 'embed' ? '100%' : 28;
  const btnH = variant === 'embed' ? 18 : 16;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={`${channelLabel} — channel FX (cutoff · Fat EQ · compressor)`}
        onClick={(e) => {
          onActivate?.();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="shrink-0 flex items-center justify-center gap-0"
        style={{
          width: variant === 'embed' ? '100%' : undefined,
          minWidth: btnMinW,
          height: btnH,
          padding: variant === 'embed' ? '0 4px' : '0 5px',
          borderRadius: 2,
          border: `1px solid ${open || hasFx ? accent : '#353545'}`,
          background: open ? `${accent}22` : hasFx ? `${accent}0f` : '#18181f',
          boxShadow: open ? `0 0 8px ${accent}44` : hasFx ? `0 0 4px ${accent}22` : 'none',
          cursor: 'pointer',
        }}
      >
        <span style={letterStyle()}>F</span>
        <span
          aria-hidden
          style={{
            width: 1,
            height: variant === 'embed' ? 10 : 9,
            margin: '0 2px',
            background: glow,
            opacity: 0.6,
            borderRadius: 1,
          }}
        />
        <span style={letterStyle()}>X</span>
      </button>
      {panel}
    </>
  );
}
