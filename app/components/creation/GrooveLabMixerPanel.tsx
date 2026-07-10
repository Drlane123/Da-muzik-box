/**
 * Groove Lab — 16-channel mixer (CH 33–48 · CHORD · GROOVE LEAD · work lanes).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

import { GrooveLabChannelFxButton } from '@/app/components/creation/GrooveLabChannelFxButton';
import { GrooveLabChannelMuteSoloRow } from '@/app/components/creation/GrooveLabChannelMuteSoloRow';
import { GrooveLabMixerChannelFader } from '@/app/components/creation/GrooveLabMixerChannelFader';
import {
  GrooveLabChannelStereoVu,
  useGrooveLabChannelMeterPaint,
} from '@/app/components/creation/GrooveLabChannelStereoVu';
import { GROOVE_LAB_CHANNEL_MS_CHANGED } from '@/app/lib/creationStation/grooveLabChannelMuteSolo';
import {
  formatMixerFaderDb,
  grooveLabChannelVol127,
} from '@/app/lib/studio/se2MixerFaderScale';

import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  grooveLabChannelRoleLabel,
  grooveLabLayerScopeForChannel,
  GROOVE_LAB_LAYER_SCOPE_META,
} from '@/app/lib/creationStation/grooveLabPianoRollLayers';
import {
  GrooveStyleTCapPanFader,
  GrooveStyleTCapVolumeFaderStyles,
} from '@/app/components/creation/GrooveStyleTCapVolumeFader';

const PAN_STORAGE_KEY = 'groove-lab-channel-pans-v1';
const GROOVE_MIXER_DEFAULT_ACCENT = '#86efac';

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
  sampleChannel?: number,
): string {
  if (chordChannel == null || melodyChannel == null) return GROOVE_MIXER_DEFAULT_ACCENT;
  const scope = grooveLabLayerScopeForChannel(
    ch,
    chordChannel,
    melodyChannel,
    guitarChannel,
    sampleChannel,
  );
  if (scope) return GROOVE_LAB_LAYER_SCOPE_META[scope].color;
  return GROOVE_MIXER_DEFAULT_ACCENT;
}

function stripSubtitle(
  ch: number,
  chordChannel?: number,
  melodyChannel?: number,
  guitarChannel?: number,
  sampleChannel?: number,
): string {
  if (chordChannel == null || melodyChannel == null) {
    return `Lane ${ch - CHORD_BASS_SEQ_CHANNEL_BASE + 1}`;
  }
  return grooveLabChannelRoleLabel(ch, chordChannel, melodyChannel, guitarChannel, sampleChannel);
}

function GrooveLabChannelStrip({
  ch,
  accent,
  subtitle,
  vol127,
  pan,
  msTick,
  onVolumeChange,
  onPanChange,
}: {
  ch: number;
  accent: string;
  subtitle: string;
  vol127: number;
  pan: number;
  msTick: number;
  onVolumeChange: (v: number) => void;
  onPanChange: (v: number) => void;
}) {
  const faderH = 140;
  const [faderDragging, setFaderDragging] = useState(false);
  const dbLabel = formatMixerFaderDb(vol127);

  return (
    <div
      style={{
        width: 108,
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 7,
        padding: '8px 6px 10px',
        borderRadius: 8,
        border: `1px solid ${accent}55`,
        background: `linear-gradient(180deg, ${accent}1a 0%, #060806 100%)`,
        boxShadow: `0 0 10px ${accent}28, inset 0 1px 0 ${accent}18`,
        boxSizing: 'border-box',
      }}
      title={`CH ${ch} — ${subtitle}`}
    >
      <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
        <GrooveLabChannelMuteSoloRow ch={ch} accent={accent} msTick={msTick} />
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: accent,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
            textShadow: `0 0 8px ${accent}44`,
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
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 6,
          padding: '4px 6px',
          borderRadius: 4,
          background: `linear-gradient(180deg, ${accent}0c 0%, rgba(0,0,0,0.35) 100%)`,
          boxShadow: `inset 0 0 0 1px ${accent}22, 0 0 6px ${accent}14`,
        }}
      >
        <GrooveLabMixerChannelFader
          channelId={ch}
          volume127={vol127}
          accent={accent}
          height={faderH}
          onDragChange={setFaderDragging}
          onVolumeChange={onVolumeChange}
        />
        <GrooveLabChannelStereoVu ch={ch} accent={accent} size="strip" />
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: faderDragging ? accent : '#585868',
          textAlign: 'center',
          fontFamily: 'ui-monospace, SF Mono, monospace',
          textShadow: faderDragging ? `0 0 8px ${accent}55` : undefined,
          transition: 'color 0.08s',
          lineHeight: 1,
        }}
      >
        {dbLabel}
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

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -2 }}>
        <GrooveLabChannelFxButton
          ch={ch}
          channelLabel={`CH ${ch} · ${subtitle}`}
          accent={accent}
          variant="strip"
        />
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
  sampleChannel?: number;
};

export function GrooveLabMixerPanel({
  open,
  onClose,
  channelVolumes,
  setChannelVolume,
  chordChannel,
  melodyChannel,
  guitarChannel,
  sampleChannel,
}: GrooveLabMixerPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const meterRootRef = useRef<HTMLDivElement>(null);
  const [panByCh, setPanByCh] = useState<Record<number, number>>({});
  const [msTick, setMsTick] = useState(0);

  useGrooveLabChannelMeterPaint(meterRootRef, open);

  useEffect(() => {
    const bump = () => setMsTick((n) => n + 1);
    window.addEventListener(GROOVE_LAB_CHANNEL_MS_CHANGED, bump);
    return () => window.removeEventListener(GROOVE_LAB_CHANNEL_MS_CHANGED, bump);
  }, []);

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
    if (sampleChannel != null) ids.push(sampleChannel);
    return ids.sort((a, b) => a - b);
  }, [chordChannel, melodyChannel, guitarChannel, sampleChannel]);

  const extraLaneIds = useMemo(
    () =>
      channelIds.filter(
        (ch) =>
          ch !== chordChannel &&
          ch !== melodyChannel &&
          ch !== guitarChannel &&
          ch !== sampleChannel,
      ),
    [channelIds, chordChannel, melodyChannel, guitarChannel, sampleChannel],
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
    const vol127 = grooveLabChannelVol127(channelVolumes[ch]);
    const accent = stripAccent(ch, chordChannel, melodyChannel, guitarChannel, sampleChannel);
    const subtitle = stripSubtitle(ch, chordChannel, melodyChannel, guitarChannel, sampleChannel);
    return (
      <GrooveLabChannelStrip
        key={ch}
        ch={ch}
        accent={accent}
        subtitle={subtitle}
        vol127={vol127}
        pan={panByCh[ch] ?? 0}
        msTick={msTick}
        onVolumeChange={(v) => setChannelVolume(ch, v)}
        onPanChange={(p) => setPanForChannel(ch, p)}
      />
    );
  };

  if (!open) return null;

  return (
    <div
      ref={meterRootRef}
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
          gap: 8,
          padding: '5px 10px 5px 6px',
          borderBottom: '1px solid rgba(134, 239, 172, 0.2)',
          background: 'rgba(34, 197, 94, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <button
            type="button"
            title="Close mixer"
            aria-label="Close mixer"
            onClick={onClose}
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
          <SlidersHorizontal size={15} color="#86efac" aria-hidden />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#ecfdf5', letterSpacing: 0.35 }}>
              GROOVE LAB MIXER
            </div>
            <div style={{ fontSize: 9, color: '#8a9aa4', marginTop: 1, lineHeight: 1.25 }}>
              CH 33–35 pinned · scroll → CH 36–48
            </div>
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#86efac', flexShrink: 0 }}>SCROLL →</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            padding: '6px 8px 6px 10px',
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
              padding: '6px 10px 6px 8px',
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
