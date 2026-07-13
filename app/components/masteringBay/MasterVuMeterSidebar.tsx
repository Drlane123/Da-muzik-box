'use client';

import { useMemo, useState } from 'react';

import {
  formatMeterDb,
  isNugenMeterSilent,
  VU_METER_DB_TICKS,
  VU_REDUCTION_DB_TICKS,
  type NugenMeterSnap,
} from '@/app/lib/masteringBay/masteringBayMeterIdle';
import { METER_DB_FLOOR } from '@/app/lib/masteringBay/masteringBayMeterBallistics';
import { VerticalMeterDbGrid } from '@/app/components/masteringBay/MeterDbGrid';
import { useMasteringBayNugenSnap } from '@/app/hooks/useMasteringBayMeterStore';

const DB_SCALE = VU_METER_DB_TICKS;

export type VisLmTab = 'loudness' | 'true-peak' | 'options';

export type VisLmMeterMode = 'ebu-r128' | 'itu-bs1770' | 'streaming';

export type VisLmOptions = {
  mode: VisLmMeterMode;
  /** Compliance goal for integrated loudness (LUFS). */
  targetIntegratedLufs: number;
  /** Compliance goal for true peak (dBTP). */
  targetTruePeakDb: number;
  showPeakHold: boolean;
};

const DEFAULT_VISLM_OPTIONS: VisLmOptions = {
  mode: 'streaming',
  targetIntegratedLufs: -14,
  targetTruePeakDb: -1,
  showPeakHold: true,
};

const MODE_LABELS: Record<VisLmMeterMode, string> = {
  'ebu-r128': 'EBU R128',
  'itu-bs1770': 'ITU BS.1770',
  streaming: 'Streaming −14',
};

const MODE_DEFAULTS: Record<VisLmMeterMode, Pick<VisLmOptions, 'targetIntegratedLufs' | 'targetTruePeakDb'>> = {
  'ebu-r128': { targetIntegratedLufs: -23, targetTruePeakDb: -1 },
  'itu-bs1770': { targetIntegratedLufs: -24, targetTruePeakDb: -2 },
  streaming: { targetIntegratedLufs: -14, targetTruePeakDb: -1 },
};

function NugenBarColumn({
  title,
  channels,
  variant,
  showPeakHold,
}: {
  title: string;
  channels: { id: string; level: number; peak: number }[];
  variant: 'input' | 'reduction' | 'output';
  showPeakHold: boolean;
}) {
  const isReduction = variant === 'reduction';
  const floorDb = isReduction ? -24 : METER_DB_FLOOR;
  const ticks = isReduction ? VU_REDUCTION_DB_TICKS : DB_SCALE;

  return (
    <div className={`mb-nugen__col mb-nugen__col--${variant}`}>
      <span className="mb-nugen__col-title">{title}</span>
      <div className="mb-nugen__col-bars">
        <VerticalMeterDbGrid
          className="mb-nugen__vu-grid"
          floorDb={floorDb}
          ticks={ticks}
        />
        {channels.map((ch) => (
          <div key={ch.id} className="mb-nugen__bar-wrap">
            <div className="mb-nugen__bar">
              {ch.level > 0.25 && (
                <div
                  className={`mb-nugen__bar-fill mb-nugen__bar-fill--${variant}`}
                  style={{ height: `${Math.max(0.5, ch.level)}%` }}
                />
              )}
              {showPeakHold && ch.peak > 0 && !isReduction && (
                <div className="mb-nugen__bar-peak" style={{ bottom: `${ch.peak}%` }} aria-hidden />
              )}
            </div>
            <span className="mb-nugen__bar-ch">{ch.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadoutBox({
  label,
  unit,
  value,
  tone,
  goal,
}: {
  label: string;
  unit: string;
  value: string;
  tone?: 'source' | 'target';
  goal?: string;
}) {
  return (
    <div className={`mb-nugen__readout mb-nugen__readout--${tone ?? 'target'}`}>
      <span className="mb-nugen__readout-label">{label}</span>
      <strong className="mb-nugen__readout-value">{value}</strong>
      <em className="mb-nugen__readout-unit">{unit}</em>
      {goal ? <span className="mb-nugen__readout-goal">goal {goal}</span> : null}
    </div>
  );
}

/** Logical wave height in SVG units — CSS stretches it to the shared VisLM panel. */
const HIST_WAVE_H = 100;

function HistoryGraph({
  history,
  histogram,
  silent,
  stroke,
  fillId,
  summary,
  goalPct,
}: {
  history: number[];
  histogram: number[];
  silent: boolean;
  stroke: string;
  fillId: string;
  summary: { label: string; value: string; unit: string }[];
  goalPct?: number;
}) {
  const h = HIST_WAVE_H;
  const path = useMemo(() => {
    const w = 200;
    const pts = history.map((v, i) => {
      const x = (i / Math.max(1, history.length - 1)) * w;
      const y = h - (Math.max(0, Math.min(100, v)) / 100) * h;
      return `${x},${y}`;
    });
    return `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
  }, [h, history]);

  const line = useMemo(() => {
    const w = 200;
    return history
      .map((v, i) => {
        const x = (i / Math.max(1, history.length - 1)) * w;
        const y = h - (Math.max(0, Math.min(100, v)) / 100) * h;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }, [h, history]);

  const goalY = goalPct != null ? h - (Math.max(0, Math.min(100, goalPct)) / 100) * h : null;

  return (
    <div className="mb-nugen__hist-body">
      <div className="mb-nugen__hist-bars">
        {histogram.map((v, i) => (
          <div
            key={i}
            className="mb-nugen__hist-bar"
            style={{ height: `${Math.max(0, Math.min(100, v))}%` }}
          />
        ))}
      </div>
      <svg viewBox={`0 0 200 ${h}`} className="mb-nugen__hist-svg" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(80, 160, 255, 0.45)" />
            <stop offset="100%" stopColor="rgba(40, 80, 160, 0.05)" />
          </linearGradient>
        </defs>
        {!silent && <path d={path} fill={`url(#${fillId})`} />}
        <path d={line} fill="none" stroke={silent ? 'rgba(94, 207, 94, 0.25)' : stroke} strokeWidth="1.5" />
        {goalY != null && (
          <line
            x1={0}
            y1={goalY}
            x2={200}
            y2={goalY}
            stroke="rgba(255, 180, 60, 0.75)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        )}
      </svg>
      <div className="mb-nugen__hist-summary">
        {summary.map((row) => (
          <div key={row.label} className="mb-nugen__hist-summary-row">
            <span>{row.label}</span>
            <strong>
              {row.value}
              <em>{row.unit}</em>
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function goalToLufsPct(lufs: number): number {
  // Same mapping as loudness history: −36 … 0 → 0–100%.
  return Math.max(0, Math.min(100, ((lufs - -36) / 36) * 100));
}

function goalToTpPct(dbtp: number): number {
  return Math.max(0, Math.min(100, ((dbtp - METER_DB_FLOOR) / (3 - METER_DB_FLOOR)) * 100));
}

function complianceDelta(measured: number, goal: number): string {
  if (!Number.isFinite(measured)) return '—';
  const d = measured - goal;
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}`;
}

export function MasterVuMeterSidebar({
  snap: snapProp,
  onResetMeters,
}: {
  snap?: NugenMeterSnap;
  onResetMeters?: () => void;
}) {
  const storeSnap = useMasteringBayNugenSnap();
  const m: NugenMeterSnap = snapProp ?? storeSnap;
  const silent = isNugenMeterSilent(m);
  const [tab, setTab] = useState<VisLmTab>('loudness');
  const [options, setOptions] = useState<VisLmOptions>(DEFAULT_VISLM_OPTIONS);

  const rangeLu = useMemo(() => {
    if (!Number.isFinite(m.source.sMax) || !Number.isFinite(m.target.sMax)) return 0;
    return Math.max(0, Math.abs(m.target.sMax - m.source.sMax));
  }, [m.source.sMax, m.target.sMax]);

  const setMode = (mode: VisLmMeterMode) => {
    const defaults = MODE_DEFAULTS[mode];
    setOptions((prev) => ({
      ...prev,
      mode,
      targetIntegratedLufs: defaults.targetIntegratedLufs,
      targetTruePeakDb: defaults.targetTruePeakDb,
    }));
  };

  return (
    <aside className="mb-nugen" aria-label="Master output meters">
      <header className="mb-nugen__brand">
        <span className="mb-nugen__brand-name">DA-MUZIK BOX</span>
        <span className="mb-nugen__brand-sub">ISL · True Peak · VisLM · {MODE_LABELS[options.mode]}</span>
      </header>

      <div className="mb-nugen__isl">
        <div className="mb-nugen__isl-head">TRUE PEAK LIMITER</div>
        <div className="mb-nugen__isl-cols">
          <NugenBarColumn
            title="INPUT"
            variant="input"
            showPeakHold={options.showPeakHold}
            channels={[
              { id: 'L', level: m.l.input, peak: m.l.inputPeak },
              { id: 'R', level: m.r.input, peak: m.r.inputPeak },
            ]}
          />
          <NugenBarColumn
            title="REDUCTION"
            variant="reduction"
            showPeakHold={options.showPeakHold}
            channels={[
              { id: 'L', level: m.l.reduction, peak: m.l.reduction },
              { id: 'R', level: m.r.reduction, peak: m.r.reduction },
            ]}
          />
          <NugenBarColumn
            title="OUTPUT"
            variant="output"
            showPeakHold={options.showPeakHold}
            channels={[
              { id: 'L', level: m.l.output, peak: m.l.outputPeak },
              { id: 'R', level: m.r.output, peak: m.r.outputPeak },
            ]}
          />
        </div>
        <div className="mb-nugen__isl-footer">
          <span>Look Ahead <strong>1.50</strong> ms</span>
          <span>Ceiling <strong>{options.targetTruePeakDb.toFixed(1)}</strong> dBTP</span>
        </div>
      </div>

      <div className="mb-nugen__lm">
        <div className="mb-nugen__lm-head">
          LM-CORRECT
          <span className="mb-nugen__lm-mode">{MODE_LABELS[options.mode]}</span>
        </div>
        <div className="mb-nugen__lm-grid">
          <div className="mb-nugen__lm-col">
            <span className="mb-nugen__lm-title mb-nugen__lm-title--source">SOURCE</span>
            <ReadoutBox
              label="TPMax"
              unit="dBTP"
              value={formatMeterDb(m.source.tpMax)}
              tone="source"
              goal={tab === 'true-peak' || tab === 'options' ? options.targetTruePeakDb.toFixed(1) : undefined}
            />
            <ReadoutBox
              label="Integrated"
              unit="LUFS"
              value={formatMeterDb(m.source.integrated)}
              tone="source"
              goal={tab === 'loudness' || tab === 'options' ? options.targetIntegratedLufs.toFixed(1) : undefined}
            />
            <ReadoutBox label="SMax" unit="LUFS" value={formatMeterDb(m.source.sMax)} tone="source" />
          </div>
          <div className="mb-nugen__lm-bridge" aria-hidden>
            <span /><span /><span />
          </div>
          <div className="mb-nugen__lm-col">
            <span className="mb-nugen__lm-title mb-nugen__lm-title--target">TARGET</span>
            <ReadoutBox
              label="TPMax"
              unit="dBTP"
              value={formatMeterDb(m.target.tpMax)}
              tone="target"
              goal={options.targetTruePeakDb.toFixed(1)}
            />
            <ReadoutBox
              label="Integrated"
              unit="LUFS"
              value={formatMeterDb(m.target.integrated)}
              tone="target"
              goal={options.targetIntegratedLufs.toFixed(1)}
            />
            <ReadoutBox label="SMax" unit="LUFS" value={formatMeterDb(m.target.sMax)} tone="target" />
          </div>
        </div>
        <div className="mb-nugen__lm-delta" aria-live="polite">
          <span>
            Δ LUFS <strong>{complianceDelta(m.target.integrated, options.targetIntegratedLufs)}</strong>
          </span>
          <span>
            Δ TP <strong>{complianceDelta(m.target.tpMax, options.targetTruePeakDb)}</strong>
          </span>
        </div>
      </div>

      <div className="mb-nugen__vislm">
        <div className="mb-nugen__hist-label">
          {tab === 'loudness' && 'VisLM · Loudness'}
          {tab === 'true-peak' && 'VisLM · True-Peak'}
          {tab === 'options' && 'VisLM · Options'}
        </div>
        <div className="mb-nugen__vislm-body">
          {tab === 'loudness' && (
            <HistoryGraph
              history={m.history}
              histogram={m.histogram}
              silent={silent}
              stroke="#5ecf5e"
              fillId="mbNugenHistFillLu"
              goalPct={goalToLufsPct(options.targetIntegratedLufs)}
              summary={[
                {
                  label: 'S-term',
                  value: silent ? '—' : formatMeterDb(m.target.sMax),
                  unit: 'LUFS',
                },
                {
                  label: 'Integ',
                  value: silent ? '—' : formatMeterDb(m.target.integrated),
                  unit: 'LUFS',
                },
                {
                  label: 'Range',
                  value: silent ? '—' : rangeLu.toFixed(1),
                  unit: 'LU',
                },
              ]}
            />
          )}

          {tab === 'true-peak' && (
            <HistoryGraph
              history={m.tpHistory}
              histogram={[
                m.l.inputPeak,
                m.r.inputPeak,
                m.l.outputPeak,
                m.r.outputPeak,
                ...m.histogram.slice(0, 8),
              ]}
              silent={silent}
              stroke="#ff9a4a"
              fillId="mbNugenHistFillTp"
              goalPct={goalToTpPct(options.targetTruePeakDb)}
              summary={[
                {
                  label: 'Src TP',
                  value: silent ? '—' : formatMeterDb(m.source.tpMax),
                  unit: 'dBTP',
                },
                {
                  label: 'Out TP',
                  value: silent ? '—' : formatMeterDb(m.target.tpMax),
                  unit: 'dBTP',
                },
                {
                  label: 'Ceil',
                  value: options.targetTruePeakDb.toFixed(1),
                  unit: 'dBTP',
                },
              ]}
            />
          )}

          {tab === 'options' && (
            <div className="mb-nugen__options-body">
              <label className="mb-nugen__opt-row">
                <span>Mode</span>
                <select
                  value={options.mode}
                  onChange={(e) => setMode(e.target.value as VisLmMeterMode)}
                >
                  <option value="streaming">Streaming (−14 LUFS)</option>
                  <option value="ebu-r128">EBU R128 (−23 LUFS)</option>
                  <option value="itu-bs1770">ITU BS.1770 (−24 LUFS)</option>
                </select>
              </label>
              <label className="mb-nugen__opt-row">
                <span>Target LUFS</span>
                <input
                  type="number"
                  step={0.5}
                  min={-30}
                  max={-6}
                  value={options.targetIntegratedLufs}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      targetIntegratedLufs: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="mb-nugen__opt-row">
                <span>Target TP</span>
                <input
                  type="number"
                  step={0.1}
                  min={-3}
                  max={0}
                  value={options.targetTruePeakDb}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      targetTruePeakDb: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="mb-nugen__opt-check">
                <input
                  type="checkbox"
                  checked={options.showPeakHold}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      showPeakHold: e.target.checked,
                    }))
                  }
                />
                <span>Peak hold markers</span>
              </label>
              <button
                type="button"
                className="mb-nugen__opt-reset"
                onClick={() => onResetMeters?.()}
              >
                Reset meters
              </button>
              <p className="mb-nugen__opt-hint">
                SOURCE = dry in · TARGET = post-limiter. Goals drive Δ LUFS / Δ TP.
              </p>
            </div>
          )}
        </div>
      </div>

      <footer className="mb-nugen__foot" role="tablist" aria-label="VisLM views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'loudness'}
          className={`mb-nugen__tab${tab === 'loudness' ? ' mb-nugen__tab--active' : ''}`}
          onClick={() => setTab('loudness')}
        >
          Loudness
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'true-peak'}
          className={`mb-nugen__tab${tab === 'true-peak' ? ' mb-nugen__tab--active' : ''}`}
          onClick={() => setTab('true-peak')}
        >
          True-Peak
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'options'}
          className={`mb-nugen__tab${tab === 'options' ? ' mb-nugen__tab--active' : ''}`}
          onClick={() => setTab('options')}
        >
          Options
        </button>
      </footer>
      {/* Thin wood lip under VisLM tabs — sits beside the source-track foot. */}
      <div className="mb-nugen__wood-foot" aria-hidden />
    </aside>
  );
}
