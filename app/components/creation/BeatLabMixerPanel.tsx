/**
 * Beat Lab — 32-channel mixer (CH 1–16 pads, CH 17–32 melodic / future synth).
 * Stereo VU driven by {@link beatLabChannelMeters} (audio-clock + AnalyserNode taps).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';

import {
  BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS,
} from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import {
  getBeatLabChannelMeterLevels,
  computeBeatLabMainBusStereoVu,
} from '@/app/lib/creationStation/beatLabChannelMeters';

const MIXER_CHANNELS = 32;
const PAN_STORAGE_KEY = 'beat-lab-channel-pans-v1';

/** Map linear peak → bar height % (hardware-style: quiet hits still visible). */
function vuBarHeightPct(linear: number): number {
  const v = Math.max(0, Math.min(1, linear));
  if (v <= 1e-7) return 0;
  return Math.min(100, Math.round(Math.pow(v, 0.42) * 100));
}

/** DAW-style meter colors — same law as Studio Editor 2 `meterFillGradient`. */
function meterFillGradient(levelLinear: number): string {
  const lv = Math.max(1e-6, levelLinear);
  const db = 20 * Math.log10(lv);
  if (db < 0) {
    return 'linear-gradient(to top, #00c853 0%, #00c853 100%)';
  }
  if (db < 3) {
    return 'linear-gradient(to top, #00c853 0%, #00c853 90%, #ffb020 100%)';
  }
  return 'linear-gradient(to top, #00c853 0%, #00c853 84%, #ff9f1a 94%, #ff3b3b 100%)';
}

function melodicInstrumentShortLabel(instrumentId: string): string {
  const hit = BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS.find((o) => o.id === instrumentId);
  if (hit) return hit.label;
  const t = instrumentId.trim();
  if (!t) return '—';
  return t.replace(/_/g, ' ');
}

function readStoredPans(): Record<number, number> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PAN_STORAGE_KEY) : null;
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<number, number> = {};
    for (let ch = 1; ch <= MIXER_CHANNELS; ch += 1) {
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
    for (let ch = 1; ch <= MIXER_CHANNELS; ch += 1) {
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

function BeatLabStereoVu({
  ch,
  height = 72,
}: {
  ch: number;
  height?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 4,
        width: 24,
        height,
        flexShrink: 0,
      }}
      aria-label={ch === 0 ? 'Main output stereo meter' : `Channel ${ch} stereo meter`}
    >
      {(['L', 'R'] as const).map((side) => (
        <div
          key={side}
          style={{
            position: 'relative',
            flex: 1,
            overflow: 'hidden',
            borderRadius: 2,
            background: 'linear-gradient(180deg, #0d0d14 0%, #07070f 100%)',
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 10px rgba(0,0,0,0.85)',
          }}
        >
          <div
            data-beat-lab-meter=""
            data-ch={String(ch)}
            data-side={side}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '0%',
              background: 'linear-gradient(to top, #00c853 0%, #00c853 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '18%',
              pointerEvents: 'none',
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%)',
              mixBlendMode: 'screen',
            }}
          />
        </div>
      ))}
    </div>
  );
}

function BeatLabMainStrip({
  masterLinear,
  onMasterVolumeChange,
}: {
  masterLinear: number;
  onMasterVolumeChange: (linear01: number) => void;
}) {
  const volPct = Math.round(Math.max(0, Math.min(1, masterLinear)) * 100);
  const accent = '#ffb74d';
  const faderH = 100;
  const fillPct = volPct;

  return (
    <div
      style={{
        width: 76,
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 5,
        padding: '6px 5px 8px',
        borderRadius: 6,
        border: '1px solid rgba(255, 183, 77, 0.42)',
        background: 'linear-gradient(180deg, #1a1510 0%, #0c0a08 100%)',
        boxSizing: 'border-box',
      }}
      title="Main output — approximate mix level × master trim"
    >
      <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            color: accent,
            fontFamily: 'monospace',
            letterSpacing: 0.5,
          }}
        >
          MAIN
        </div>
        <div
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: '#e8dcc8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}
        >
          Master bus
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', height: faderH, gap: 5 }}>
        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 30,
            borderRadius: 4,
            background: 'rgba(0,0,0,0.35)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: 10,
              bottom: 14,
              width: 3,
              transform: 'translateX(-50%)',
              borderRadius: 2,
              background: '#0a0a12',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,1)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 14,
              width: 3,
              height: `${fillPct}%`,
              maxHeight: 'calc(100% - 24px)',
              transform: 'translateX(-50%)',
              borderRadius: 2,
              background: accent,
              opacity: 0.55,
              transition: 'height 0.04s',
            }}
          />
          <input
            type="range"
            aria-label="Master volume"
            min={0}
            max={100}
            step={1}
            value={volPct}
            onChange={(e) => onMasterVolumeChange(Number(e.target.value) / 100)}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: faderH - 20,
              height: 26,
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              accentColor: accent,
              cursor: 'pointer',
              zIndex: 2,
            }}
          />
        </div>
        <BeatLabStereoVu ch={0} height={faderH} />
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: '#aab6c4',
          textAlign: 'center',
          fontFamily: 'monospace',
        }}
      >
        {volPct}%
      </div>
      <div style={{ fontSize: 7, fontWeight: 800, color: '#6f6e6a', textAlign: 'center', padding: '6px 2px' }}>
        Matches deck master gain
      </div>
    </div>
  );
}

function BeatLabChannelStrip({
  ch,
  group,
  title,
  subtitle,
  accent,
  vol,
  pan,
  onVolumeChange,
  onPanChange,
}: {
  ch: number;
  group: 'pad' | 'synth';
  title: string;
  subtitle: string;
  accent: string;
  vol: number;
  pan: number;
  onVolumeChange: (v: number) => void;
  onPanChange: (v: number) => void;
}) {
  const faderH = 100;
  const fillPct = Math.max(0, Math.min(100, vol));

  return (
    <div
      style={{
        width: 76,
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 5,
        padding: '6px 5px 8px',
        borderRadius: 6,
        border: `1px solid ${group === 'pad' ? 'rgba(124, 244, 198, 0.24)' : 'rgba(0, 229, 255, 0.32)'}`,
        background: 'linear-gradient(180deg, #0e0e16 0%, #08080c 100%)',
        boxSizing: 'border-box',
      }}
      title={`${title} — ${subtitle}`}
    >
      <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
        <div
          style={{
            fontSize: 11,
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
            fontSize: 8,
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

      {/* Fader + stereo VU — Studio Editor 2 strip layout */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          height: faderH,
          gap: 5,
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 30,
            borderRadius: 4,
            background: 'rgba(0,0,0,0.35)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: 10,
              bottom: 14,
              width: 3,
              transform: 'translateX(-50%)',
              borderRadius: 2,
              background: '#0a0a12',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,1)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 14,
              width: 3,
              height: `${fillPct}%`,
              maxHeight: 'calc(100% - 24px)',
              transform: 'translateX(-50%)',
              borderRadius: 2,
              background: accent,
              opacity: 0.55,
              transition: 'height 0.04s',
            }}
          />
          <input
            type="range"
            aria-label={`Channel ${ch} volume`}
            min={0}
            max={100}
            step={1}
            value={vol}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: faderH - 20,
              height: 26,
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              accentColor: accent,
              cursor: 'pointer',
              zIndex: 2,
            }}
          />
        </div>
        <BeatLabStereoVu ch={ch} height={faderH} />
      </div>

      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: '#aab6c4',
          textAlign: 'center',
          fontFamily: 'monospace',
        }}
      >
        {vol}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 7, fontWeight: 800, color: '#6f7e8e', textAlign: 'center' }}>PAN</span>
        <input
          type="range"
          aria-label={`Channel ${ch} pan`}
          min={-100}
          max={100}
          step={1}
          value={pan}
          onChange={(e) => onPanChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: accent, cursor: 'pointer' }}
        />
        <div style={{ fontSize: 7, fontWeight: 800, color: '#9aacbc', textAlign: 'center' }}>
          {pan === 0 ? 'C' : pan > 0 ? `R${pan}` : `L${-pan}`}
        </div>
      </div>
    </div>
  );
}

export type BeatLabMixerPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Display names for sampler lanes 0–15 → mixer CH 1–16 */
  padStripLabels: readonly string[];
  /** GM / MusyngKite ids for melodic slots 0–15 → lanes 16–31 → CH 17–32 */
  melodicInstrumentIds: readonly string[];
  /** When set (e.g. NEW SYNTH), overrides CH 17–32 strip subtitles. */
  melodicStripLabels?: readonly string[];
  channelVolumes: Record<number, number>;
  setChannelVolume: (chId: number, volume: number) => void;
  /** 0–1 app master output (same as deck master). */
  masterOutputLinear: number;
  onMasterVolumeChange: (linear01: number) => void;
};

export function BeatLabMixerPanel({
  open,
  onClose,
  padStripLabels,
  melodicInstrumentIds,
  melodicStripLabels,
  channelVolumes,
  setChannelVolume,
  masterOutputLinear,
  onMasterVolumeChange,
}: BeatLabMixerPanelProps) {
  const [panByCh, setPanByCh] = useState<Record<number, number>>({});
  const mixerMeterRootRef = useRef<HTMLDivElement | null>(null);
  const masterLinearRef = useRef(masterOutputLinear);
  masterLinearRef.current = masterOutputLinear;

  /** Direct DOM VU paint every frame while open (SE2-style — not batched through React state). */
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const paintMeters = () => {
      const root = mixerMeterRootRef.current;
      if (root) {
        const levels = getBeatLabChannelMeterLevels();
        const main = computeBeatLabMainBusStereoVu(masterLinearRef.current);
        root.querySelectorAll<HTMLElement>('[data-beat-lab-meter]').forEach((el) => {
          const ch = Number(el.dataset.ch);
          const side = el.dataset.side;
          let linear = 0;
          if (ch === 0) {
            linear = side === 'L' ? main.l : main.r;
          } else if (ch >= 1 && ch <= MIXER_CHANNELS) {
            const row = levels[ch];
            linear = side === 'L' ? (row?.l ?? 0) : (row?.r ?? 0);
          }
          const pct = vuBarHeightPct(linear);
          el.style.height = `${pct}%`;
          el.style.background = meterFillGradient(Math.max(1e-6, linear));
        });
      }
      raf = requestAnimationFrame(paintMeters);
    };
    raf = requestAnimationFrame(paintMeters);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const mergePansFromWindowAndStorage = useCallback(() => {
    const wp = windowPansRef();
    const stored = readStoredPans();
    const next: Record<number, number> = {};
    for (let ch = 1; ch <= MIXER_CHANNELS; ch += 1) {
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
  }, [open, mergePansFromWindowAndStorage]);

  const setPanForChannel = useCallback((chId: number, pan: number) => {
    const clamped = Math.max(-100, Math.min(100, Math.round(pan)));
    windowPansRef()[chId] = clamped;
    setPanByCh((prev) => {
      const next = { ...prev, [chId]: clamped };
      writeStoredPans(next);
      return next;
    });
  }, []);

  const strips = useMemo(() => {
    const rows: {
      ch: number;
      group: 'pad' | 'synth';
      title: string;
      subtitle: string;
    }[] = [];
    for (let pi = 0; pi < 16; pi += 1) {
      const ch = pi + 1;
      rows.push({
        ch,
        group: 'pad',
        title: `CH ${ch}`,
        subtitle: (padStripLabels[pi] ?? `Pad ${ch}`).slice(0, 18),
      });
    }
    for (let slot = 0; slot < 16; slot += 1) {
      const ch = slot + 17;
      const id = melodicInstrumentIds[slot] ?? '';
      const custom = melodicStripLabels?.[slot]?.trim();
      rows.push({
        ch,
        group: 'synth',
        title: `CH ${ch}`,
        subtitle: (custom || melodicInstrumentShortLabel(id)).slice(0, 18),
      });
    }
    return rows;
  }, [melodicInstrumentIds, melodicStripLabels, padStripLabels]);

  if (!open) return null;

  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 8,
        border: '1px solid rgba(0, 229, 255, 0.35)',
        background: 'linear-gradient(180deg, rgba(10, 14, 22, 0.96) 0%, #06060c 100%)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(124, 244, 198, 0.2)',
          background: 'rgba(0, 229, 255, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <SlidersHorizontal size={16} color="#00E5FF" aria-hidden />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#f0faf8', letterSpacing: 0.4 }}>
              BEAT LAB MIXER
            </div>
            <div style={{ fontSize: 9, color: '#8a9aa4', marginTop: 2, lineHeight: 1.3 }}>
              MAIN + 32 channels · stereo VU · CH 1–16 pads · CH 17–32 melodic
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#7cf4c6' }}>SCROLL →</span>
          <button
            type="button"
            title="Hide mixer"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.14)',
              background: '#12121a',
              color: '#c8d0dc',
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <X size={14} aria-hidden /> Close
          </button>
        </div>
      </div>

      <div
        ref={mixerMeterRootRef}
        style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 6, padding: 10 }}>
          <BeatLabMainStrip
            masterLinear={masterOutputLinear}
            onMasterVolumeChange={onMasterVolumeChange}
          />
          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              margin: '0 2px',
              background: 'linear-gradient(180deg, transparent, rgba(255,183,77,0.35), transparent)',
              flexShrink: 0,
            }}
            aria-hidden
          />
          {strips.map((row, idx) => {
            const pan = panByCh[row.ch] ?? 0;
            const vol = channelVolumes[row.ch] ?? 80;
            const padAccent = '#7cf4c6';
            const synthAccent = '#00E5FF';
            const accent = row.group === 'pad' ? padAccent : synthAccent;
            const leftDivider =
              idx === 16 ? (
                <div
                  key={`div-${row.ch}`}
                  style={{
                    width: 1,
                    alignSelf: 'stretch',
                    margin: '0 4px',
                    background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.18), transparent)',
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
              ) : null;

            return (
              <React.Fragment key={row.ch}>
                {leftDivider}
                <BeatLabChannelStrip
                  ch={row.ch}
                  group={row.group}
                  title={row.title}
                  subtitle={row.subtitle}
                  accent={accent}
                  vol={vol}
                  pan={pan}
                  onVolumeChange={(v) => setChannelVolume(row.ch, v)}
                  onPanChange={(p) => setPanForChannel(row.ch, p)}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          justifyContent: 'center',
          padding: '6px 10px 8px',
          borderTop: '1px solid rgba(124, 244, 198, 0.12)',
          color: '#5c6c7c',
          fontSize: 8,
          fontWeight: 700,
        }}
      >
        <ChevronDown size={11} aria-hidden />
        Stereo VU follows each channel and MAIN (× master) · pan splits L/R
      </div>
    </div>
  );
}
