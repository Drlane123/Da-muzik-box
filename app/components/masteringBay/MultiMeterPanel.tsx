'use client';

import {
  MULTIMETER_BAND_COUNT,
  formatMeterDb,
  idleMultiMeterSnap,
  isMultiMeterSilent,
  lufsToMeterPct,
  LUFS_METER_DB_TICKS,
  VU_METER_DB_TICKS,
  type MultiMeterSnap,
} from '@/app/lib/masteringBay/masteringBayMeterIdle';
import { MasterBayHorizontalLevels } from '@/app/components/masteringBay/MasterBayHorizontalLevels';
import { VerticalMeterDbGrid } from '@/app/components/masteringBay/MeterDbGrid';
import { dbToMeterPct } from '@/app/lib/masteringBay/masteringBayMeterAnalysis';
import { useMemo, useState, memo } from 'react';

const FREQ_MARKS = [
  { hz: 16, label: '16' },
  { hz: 31, label: '31' },
  { hz: 62, label: '62' },
  { hz: 125, label: '125' },
  { hz: 250, label: '250' },
  { hz: 500, label: '500' },
  { hz: 1000, label: '1k' },
  { hz: 2000, label: '2k' },
  { hz: 4000, label: '4k' },
  { hz: 8000, label: '8k' },
  { hz: 16000, label: '16k' },
] as const;

const MIN_HZ = 16;
const MAX_HZ = 16000;

function hzToPct(hz: number): number {
  const logMin = Math.log10(MIN_HZ);
  const logMax = Math.log10(MAX_HZ);
  return ((Math.log10(Math.max(hz, MIN_HZ)) - logMin) / (logMax - logMin)) * 100;
}

function freqMarkAlign(idx: number, total: number): 'start' | 'center' | 'end' {
  if (idx === 0) return 'start';
  if (idx === total - 1) return 'end';
  return 'center';
}

const DB_SCALE = [0, -6, -12, -18, -24, -30, -36, -42, -48, -55] as const;

export const MultiMeterPanel = memo(function MultiMeterPanel({ snap }: { snap?: MultiMeterSnap }) {
  const [detection, setDetection] = useState<'mono' | 'lrmax'>('mono');
  const [mode, setMode] = useState<'peak' | 'rms'>('peak');
  const m: MultiMeterSnap = snap ?? idleMultiMeterSnap();
  const silent = isMultiMeterSilent(m);

  const topDb = useMemo(() => {
    if (silent) return '-∞';
    const max = Math.max(...m.bands);
    return ((max / 100) * 5 - 0.5).toFixed(0);
  }, [m.bands, silent]);

  return (
    <div className="mb-multimeter">
      <header className="mb-multimeter__head">
        <span className="mb-multimeter__tab mb-multimeter__tab--active">ANALYZER</span>
        <span className="mb-multimeter__meta">Top: {topDb} dB · Range: 60 dB</span>
      </header>

      <div className="mb-multimeter__display">
        <div className="mb-multimeter__analyzer">
          <div className="mb-multimeter__db-scale">
            {DB_SCALE.map((db) => (
              <span key={db}>{db}</span>
            ))}
          </div>
          <div className="mb-multimeter__bars-wrap">
            <div className="mb-wood-trim mb-wood-trim--hairline mb-multimeter__bars-wood">
              <div className="mb-wood-trim__inner">
                <div className="mb-multimeter__bars">
                  <div className="mb-multimeter__grid-lines" aria-hidden>
                    {DB_SCALE.map((db) => (
                      <span key={db} />
                    ))}
                  </div>
                  <div className="mb-multimeter__freq-vlines" aria-hidden>
                    {FREQ_MARKS.map(({ hz }, idx) => {
                      const pct = hzToPct(hz);
                      const align = freqMarkAlign(idx, FREQ_MARKS.length);
                      return (
                        <span
                          key={hz}
                          className={`mb-multimeter__freq-vline mb-multimeter__freq-vline--${align}`}
                          style={{ left: `${pct}%` }}
                        />
                      );
                    })}
                  </div>
                  {m.bands.map((h, i) => (
                    <div key={i} className="mb-multimeter__bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-multimeter__freq-scale">
              {FREQ_MARKS.map(({ hz, label }, idx) => {
                const pct = hzToPct(hz);
                const align = freqMarkAlign(idx, FREQ_MARKS.length);
                return (
                  <span
                    key={hz}
                    className={`mb-multimeter__freq-mark mb-multimeter__freq-mark--${align}`}
                    style={{ left: `${pct}%` }}
                  >
                    {label}
                  </span>
                );
              })}
              <span className="mb-multimeter__freq-unit">Hz</span>
            </div>
          </div>
        </div>

        <aside className="mb-multimeter__side-meters">
          <div className="mb-multimeter__lufs-block">
            <div className="mb-multimeter__lufs-readouts">
              <div><span>LU-I</span><strong>{formatMeterDb(m.luI)}</strong></div>
              <div><span>LU-S</span><strong>{formatMeterDb(m.luS)}</strong></div>
            </div>
            <div className="mb-multimeter__lufs-meter-wrap">
              <VerticalMeterDbGrid
                className="mb-multimeter__lufs-grid"
                floorDb={-24}
                ticks={LUFS_METER_DB_TICKS}
              />
              <div className="mb-multimeter__lufs-meter">
                <div
                  className="mb-multimeter__lufs-fill"
                  style={{
                    height: `${silent ? 0 : lufsToMeterPct(m.luS)}%`,
                    opacity: silent ? 0 : 1,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mb-multimeter__lr-block">
            <VerticalMeterDbGrid
              className="mb-multimeter__lr-grid"
              floorDb={-48}
              ticks={VU_METER_DB_TICKS}
            />
            {(['L', 'R'] as const).map((ch) => {
              const peak = ch === 'L' ? m.lPeak : m.rPeak;
              const rms = ch === 'L' ? m.lRms : m.rRms;
              const peakHold = ch === 'L' ? m.lPeakHold : m.rPeakHold;
              const rmsLevel = ch === 'L' ? m.lRmsLevel : m.rRmsLevel;
              const barPct = silent ? 0 : Math.max(dbToMeterPct(peak), rmsLevel);
              const peakHoldPct = silent ? 0 : dbToMeterPct(peakHold);
              return (
                <div key={ch} className="mb-multimeter__lr-ch">
                  <div className="mb-multimeter__lr-readouts">
                    <span>{formatMeterDb(peak)}</span>
                    <span>{formatMeterDb(rms)}</span>
                  </div>
                  <div className="mb-multimeter__lr-meter">
                    <div
                      className="mb-multimeter__lr-fill"
                      style={{ height: `${barPct}%`, opacity: barPct > 0.5 ? 1 : 0 }}
                    />
                    <div
                      className="mb-multimeter__lr-peak"
                      style={{ bottom: `${peakHoldPct}%`, opacity: peakHoldPct > 0.5 ? 1 : 0 }}
                    />
                  </div>
                  <span className="mb-multimeter__lr-label">{ch}</span>
                </div>
              );
            })}
          </div>

          <div className="mb-multimeter__corr">
            <span>CORRELATION</span>
            <div className="mb-multimeter__corr-track">
              <div className="mb-multimeter__corr-needle" style={{ left: `${((m.correlation + 1) / 2) * 100}%` }} />
            </div>
          </div>
        </aside>
      </div>

      <footer className="mb-multimeter__controls">
        <div className="mb-multimeter__ctrl-group">
          <span>Detection</span>
          <div className="mb-multimeter__btns">
            {(['Left', 'Right', 'LRmax', 'Mono'] as const).map((d) => {
              const active = (d === 'Mono' && detection === 'mono') || (d === 'LRmax' && detection === 'lrmax');
              return (
                <button
                  key={d}
                  type="button"
                  className={active ? 'is-active' : ''}
                  onClick={() => setDetection(d === 'Mono' ? 'mono' : 'lrmax')}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-multimeter__ctrl-group">
          <span>Mode</span>
          <div className="mb-multimeter__btns">
            {(['RMS Slow', 'RMS Fast', 'Peak'] as const).map((label) => {
              const isPeak = label === 'Peak';
              return (
                <button
                  key={label}
                  type="button"
                  className={(isPeak && mode === 'peak') || (!isPeak && mode === 'rms') ? 'is-active' : ''}
                  onClick={() => setMode(isPeak ? 'peak' : 'rms')}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-multimeter__ctrl-group mb-multimeter__ctrl-group--nums">
          <label>Bands <em>{MULTIMETER_BAND_COUNT}</em></label>
          <label>Return <em>11.8 dB/s</em></label>
          <label>Peak <em>2 s</em></label>
          <button type="button">Hold</button>
          <button type="button">Reset</button>
        </div>
      </footer>

      <MasterBayHorizontalLevels snap={m} />
    </div>
  );
});
