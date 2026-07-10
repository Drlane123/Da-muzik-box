'use client';

import { useCallback, useEffect, useState } from 'react';

import { useMasterClock } from '@/app/context/MasterClockContext';
import { useSettings } from '@/app/context/SettingsContext';
import {
  AUDIO_LATENCY_HINT_OPTIONS,
  formatMs,
  readAudioDeviceStats,
} from '@/app/lib/audioDeviceInfo';
import {
  nextSe2LatencyHint,
  readSe2PerformanceDebug,
  readSe2PerformanceLoadPct,
  se2CpuLoadColor,
  se2LatencyHintShortLabel,
} from '@/app/lib/studio/se2PerformanceMonitor';

const STRIP_WIDTH_PX = 168;
const STRIP_HEIGHT_PX = 32;
const SE2_UI_FONT = "'Rajdhani', 'Exo 2', system-ui, sans-serif";
const ACCENT = '#8ec8ff';

export function Se2PerformanceStrip() {
  const { getOrCreateAudioContext } = useMasterClock();
  const { settings, updateSetting } = useSettings();
  const [cpuPct, setCpuPct] = useState(0);
  const [debug, setDebug] = useState({ transportMs: 0, meterMs: 0, playing: false });
  const [totalLatencyMs, setTotalLatencyMs] = useState(0);
  const [blockSize, setBlockSize] = useState(0);
  const [contextState, setContextState] = useState('—');

  const refreshAudio = useCallback(() => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'closed') return;
      const stats = readAudioDeviceStats(ctx, settings.audioLatencyHint);
      setTotalLatencyMs(stats.totalOutputLatencyMs);
      setBlockSize(stats.estimatedBlockSize);
      setContextState(stats.contextState);
    } catch {
      /* context not ready */
    }
  }, [getOrCreateAudioContext, settings.audioLatencyHint]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCpuPct(readSe2PerformanceLoadPct());
      setDebug(readSe2PerformanceDebug());
    }, 350);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    refreshAudio();
    const id = window.setInterval(refreshAudio, 1200);
    return () => window.clearInterval(id);
  }, [refreshAudio]);

  const cycleBuffer = useCallback(() => {
    const next = nextSe2LatencyHint(settings.audioLatencyHint);
    updateSetting('audioLatencyHint', next);
    window.setTimeout(refreshAudio, 120);
  }, [refreshAudio, settings.audioLatencyHint, updateSetting]);

  const hintGuide =
    AUDIO_LATENCY_HINT_OPTIONS.find((o) => o.value === settings.audioLatencyHint)?.guide ?? '';
  const barFill = Math.max(2, Math.round((cpuPct / 100) * 52));
  const loadColor = se2CpuLoadColor(cpuPct);
  const latencyLabel =
    totalLatencyMs > 0 ? formatMs(totalLatencyMs, totalLatencyMs < 10 ? 2 : 1) : '—';
  const blockLabel = blockSize > 0 ? String(blockSize) : '—';

  return (
    <div
      data-studio-se2-performance-strip
      title={[
        'Performance — SE2 transport + meter work per frame (not Windows Task Manager %)',
        `Load ${cpuPct}%${debug.playing ? ' · Play' : ' · Stop'}`,
        `Transport tick ~${debug.transportMs} ms · meters ~${debug.meterMs} ms`,
        'Spikes on Play are normal — raise buffer (click block #) if you hear glitches',
        `Out latency ${latencyLabel} · ~${blockLabel} samples/block`,
        `Buffer: ${se2LatencyHintShortLabel(settings.audioLatencyHint)} (${hintGuide})`,
        `Engine: ${contextState} · click block # to cycle Low / Med / High`,
      ].join('\n')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
        width: STRIP_WIDTH_PX,
        minWidth: STRIP_WIDTH_PX,
        maxWidth: STRIP_WIDTH_PX,
        height: STRIP_HEIGHT_PX,
        padding: '0 8px',
        borderRadius: 6,
        border: '1px solid rgba(142, 200, 255, 0.22)',
        background:
          'linear-gradient(135deg, rgba(142,200,255,0.06) 0%, rgba(12,12,18,0.55) 48%, rgba(100,160,220,0.04) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.45)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span
          style={{
            flexShrink: 0,
            fontFamily: SE2_UI_FONT,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: ACCENT,
            lineHeight: 1,
          }}
        >
          Perf
        </span>
        <div
          aria-hidden
          style={{
            position: 'relative',
            width: 52,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.08)',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: barFill,
              height: '100%',
              borderRadius: 2,
              background: loadColor,
              boxShadow: cpuPct >= 44 ? `0 0 6px ${loadColor}88` : undefined,
              transition: 'width 0.35s ease, background 0.25s ease',
            }}
          />
        </div>
        <span
          style={{
            flexShrink: 0,
            fontFamily: SE2_UI_FONT,
            fontSize: 10,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: loadColor,
            lineHeight: 1,
            minWidth: 28,
          }}
        >
          {cpuPct}%
        </span>
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            fontFamily: SE2_UI_FONT,
            fontSize: 10,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: '#a8b8c8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1,
          }}
        >
          {latencyLabel}
        </span>
        <button
          type="button"
          onClick={cycleBuffer}
          title={`Buffer ${se2LatencyHintShortLabel(settings.audioLatencyHint)} — click to cycle (${hintGuide})`}
          style={{
            flexShrink: 0,
            margin: 0,
            padding: '1px 4px',
            borderRadius: 3,
            border: '1px solid rgba(142, 200, 255, 0.28)',
            background: 'rgba(0,0,0,0.25)',
            color: ACCENT,
            fontFamily: SE2_UI_FONT,
            fontSize: 9,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
            cursor: 'pointer',
          }}
        >
          {blockLabel}
        </button>
      </div>
    </div>
  );
}
