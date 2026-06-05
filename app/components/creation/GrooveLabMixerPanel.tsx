/**
 * Groove Lab — 16-channel mixer (CH 33–48 · CHORD · GROOVE LEAD · work lanes).
 */
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  GrooveStyleTCapVolumeFader,
  GrooveStyleTCapPanFader,
  GrooveStyleTCapVolumeFaderStyles,
} from '@/app/components/creation/GrooveStyleTCapVolumeFader';

const PAN_STORAGE_KEY = 'groove-lab-channel-pans-v1';
const GROOVE_MIXER_ACCENT = '#86efac';

function readStoredPans(): Record<number, number> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PAN_STORAGE_KEY) : null;
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<number, number> = {};
    for (let i = 0; i < CHORD_BASS_SEQ_CHANNEL_COUNT; i += 1) {
      const ch = CHORD_BASS_SEQ_CHANNEL_BASE + i;
      const v = obj[String(ch)];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[ch] = Math.max(-100, Math.min(100, Math.round(v)));
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeStoredPans(pans: Record<number, number>): void {
  try {
    const flat: Record<string, number> = {};
    for (let i = 0; i < CHORD_BASS_SEQ_CHANNEL_COUNT; i += 1) {
      const ch = CHORD_BASS_SEQ_CHANNEL_BASE + i;
      flat[String(ch)] = pans[ch] ?? 0;
    }
    localStorage.setItem(PAN_STORAGE_KEY, JSON.stringify(flat));
  } catch {
    /* quota / privacy mode */
  }
}

function windowPansRef(): Record<number, number> {
  const w = window as unknown as { __daMusicChannelPans?: Record<number, number> };
  w.__daMusicChannelPans ??= {};
  return w.__daMusicChannelPans;
}

function stripAccent(
  ch: number,
  chordChannel?: number,
  melodyChannel?: number,
  guitarChannel?: number,
): string {
  if (ch === chordChannel) return '#86efac';
  if (ch === melodyChannel) return '#fbbf24';
  if (guitarChannel != null && ch === guitarChannel) return '#f59e0b';
  return GROOVE_MIXER_ACCENT;
}

function stripSubtitle(
  ch: number,
  chordChannel?: number,
  melodyChannel?: number,
  guitarChannel?: number,
): string {
  if (ch === chordChannel) return 'CHORD';
  if (ch === melodyChannel) return 'GROOVE LEAD';
  if (guitarChannel != null && ch === guitarChannel) return 'GUITAR';
  return `Lane ${ch - CHORD_BASS_SEQ_CHANNEL_BASE + 1}`;
}

function GrooveLabChannelStrip({
  ch,
  accent,
  subtitle,
  vol,
  pan,
  onVolumeChange,
  onPanChange,
}: {
  ch: number;
  accent: string;
  subtitle: string;
  vol: number;
  pan: number;
  onVolumeChange: (v: number) => void;
  onPanChange: (v: number) => void;
}) {
  const faderH = 140;

  return (
    <div
      style={{
        width: 96,
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 7,
        padding: '8px 6px 10px',
        borderRadius: 8,
        border: '1px solid rgba(134, 239, 172, 0.28)',
        background: 'linear-gradient(180deg, #0a120c 0%, #060806 100%)',
        boxSizing: 'border-box',
      }}
      title={`CH ${ch} — ${subtitle}`}
    >
      <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: accent,
            fontFamily: 'monospace',
            letterSpacing: 0.5,
          }}
        >
          {ch}
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#e0e8f0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: faderH,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          borderRadius: 4,
          background: 'rgba(0,0,0,0.2)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        <GrooveStyleTCapVolumeFader
          channelId={ch}
          volume={vol}
          accent={accent}
          onVolumeChange={onVolumeChange}
          style={{ height: '100%', minHeight: faderH - 12, width: 22 }}
        />
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: '#aab6c4',
          textAlign: 'center',
          fontFamily: 'monospace',
        }}
      >
        {vol}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#6f7e8e', textAlign: 'center' }}>PAN</span>
        <GrooveStyleTCapPanFader
          channelId={ch}
          pan={pan}
          accent={accent}
          onPanChange={onPanChange}
        />
        <div style={{ fontSize: 9, fontWeight: 800, color: '#9aacbc', textAlign: 'center' }}>
          {pan === 0 ? 'C' : pan > 0 ? `R${pan}` : `L${-pan}`}
        </div>
      </div>
    </div>
  );
}

export type GrooveLabMixerPanelProps = {
  open: boolean;
  onClose: () => void;
  channelVolumes: Record<number, number>;
  setChannelVolume: (chId: number, volume: number) => void;
  chordChannel?: number;
  melodyChannel?: number;
  guitarChannel?: number;
};

export function GrooveLabMixerPanel({
  open,
  onClose,
  channelVolumes,
  setChannelVolume,
  chordChannel,
  melodyChannel,
  guitarChannel,
}: GrooveLabMixerPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [panByCh, setPanByCh] = useState<Record<number, number>>({});

  const mergePansFromWindowAndStorage = useCallback(() => {
    const wp = windowPansRef();
    const stored = readStoredPans();
    const next: Record<number, number> = {};
    for (let i = 0; i < CHORD_BASS_SEQ_CHANNEL_COUNT; i += 1) {
      const ch = CHORD_BASS_SEQ_CHANNEL_BASE + i;
      const live = wp[ch];
      if (typeof live === 'number' && Number.isFinite(live)) {
        next[ch] = Math.max(-100, Math.min(100, Math.round(live)));
      } else if (typeof stored[ch] === 'number') {
        const s = stored[ch]!;
        next[ch] = s;
        wp[ch] = s;
      } else {
        next[ch] = 0;
      }
    }
    setPanByCh(next);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    mergePansFromWindowAndStorage();
    const el = scrollRef.current;
    if (el) el.scrollLeft = 0;
  }, [open, mergePansFromWindowAndStorage]);

  const channelIds = useMemo(
    () =>
      Array.from(
        { length: CHORD_BASS_SEQ_CHANNEL_COUNT },
        (_, i) => CHORD_BASS_SEQ_CHANNEL_BASE + i,
      ),
    [],
  );

  const workLaneIds = useMemo(() => {
    const ids: number[] = [];
    if (chordChannel != null) ids.push(chordChannel);
    if (melodyChannel != null) ids.push(melodyChannel);
    if (guitarChannel != null) ids.push(guitarChannel);
    return ids;
  }, [chordChannel, melodyChannel, guitarChannel]);

  const extraLaneIds = useMemo(
    () =>
      channelIds.filter(
        (ch) => ch !== chordChannel && ch !== melodyChannel && ch !== guitarChannel,
      ),
    [channelIds, chordChannel, melodyChannel, guitarChannel],
  );

  const setPanForChannel = useCallback((chId: number, pan: number) => {
    const clamped = Math.max(-100, Math.min(100, Math.round(pan)));
    windowPansRef()[chId] = clamped;
    setPanByCh((prev) => {
      const next = { ...prev, [chId]: clamped };
      writeStoredPans(next);
      return next;
    });
  }, []);

  const renderStrip = (ch: number) => {
    const vol = channelVolumes[ch] ?? 80;
    const accent = stripAccent(ch, chordChannel, melodyChannel, guitarChannel);
    const subtitle = stripSubtitle(ch, chordChannel, melodyChannel, guitarChannel);
    return (
      <GrooveLabChannelStrip
        key={ch}
        ch={ch}
        accent={accent}
        subtitle={subtitle}
        vol={vol}
        pan={panByCh[ch] ?? 0}
        onVolumeChange={(v) => setChannelVolume(ch, v)}
        onPanChange={(p) => setPanForChannel(ch, p)}
      />
    );
  };

  if (!open) return null;

  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid rgba(74, 222, 128, 0.35)',
        background: 'linear-gradient(180deg, rgba(7, 18, 8, 0.98) 0%, #040604 100%)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
        overflow: 'hidden',
        flexShrink: 0,
        minWidth: 520,
      }}
    >
      <GrooveStyleTCapVolumeFaderStyles />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(134, 239, 172, 0.2)',
          background: 'rgba(34, 197, 94, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <SlidersHorizontal size={22} color="#86efac" aria-hidden />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#ecfdf5', letterSpacing: 0.4 }}>
              GROOVE LAB MIXER
            </div>
            <div style={{ fontSize: 11, color: '#8a9aa4', marginTop: 3, lineHeight: 1.35 }}>
              CHORD · GROOVE LEAD pinned left · scroll → for CH 36–48 work lanes
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#86efac' }}>SCROLL →</span>
          <button
            type="button"
            title="Hide mixer"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 34,
              padding: '0 14px',
              borderRadius: 7,
              border: '1px solid rgba(255, 255, 255, 0.14)',
              background: '#12121a',
              color: '#c8d0dc',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <X size={16} aria-hidden /> Close
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', minHeight: 240 }}>
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            padding: '14px 10px 14px 14px',
            borderRight: '1px solid rgba(134, 239, 172, 0.28)',
            background: 'rgba(34, 197, 94, 0.06)',
          }}
        >
          {workLaneIds.map((ch) => renderStrip(ch))}
        </div>
        <div
          ref={scrollRef}
          className="groove-lab-mixer-scroll"
          style={{
            flex: '1 1 auto',
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              gap: 8,
              padding: '14px 14px 14px 10px',
              width: 'max-content',
            }}
          >
            {extraLaneIds.map((ch) => renderStrip(ch))}
          </div>
        </div>
      </div>
    </div>
  );
}
