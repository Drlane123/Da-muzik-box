'use client';

import {
  formatMeterDb,
  HORIZONTAL_METER_DB_TICKS,
  idleMultiMeterSnap,
  isMultiMeterSilent,
  type MultiMeterSnap,
} from '@/app/lib/masteringBay/masteringBayMeterIdle';
import { dbToWaveLabPct } from '@/app/lib/masteringBay/masteringBayMeterAnalysis';
import { HorizontalMeterDbGrid } from '@/app/components/masteringBay/MeterDbGrid';

const DB_TICKS = HORIZONTAL_METER_DB_TICKS;
const BALANCE_MAX_DB = 6;
const BALANCE_TICKS_LEFT = [6, 5, 4, 3, 2, 1] as const;
const BALANCE_TICKS_RIGHT = [1, 2, 3, 4, 5, 6] as const;

function dbToPct(db: number): number {
  return dbToWaveLabPct(db);
}

/** 0 dB center; 1–6 dB outward toward each edge. */
function balanceTickPct(n: number, side: 'left' | 'right'): number {
  const frac = Math.max(0, Math.min(1, n / BALANCE_MAX_DB));
  return side === 'left' ? 50 - frac * 50 : 50 + frac * 50;
}

function MeterLineRow({
  ch,
  variant,
  valueDb,
  holdDb,
  silent,
}: {
  ch?: 'L' | 'R';
  variant: 'peak' | 'pressure';
  valueDb: number;
  holdDb?: number;
  silent: boolean;
}) {
  const isPeak = variant === 'peak';
  const widthDb = isPeak ? (holdDb ?? valueDb) : valueDb;
  const width = silent ? 0 : dbToPct(widthDb);
  const showInlineLabel = !silent && !isPeak && Number.isFinite(valueDb) && width > 14;

  return (
    <div className={`mb-hlevels__row mb-hlevels__row--${variant}`}>
      <span className="mb-hlevels__ch">{ch ?? ''}</span>
      <div className="mb-hlevels__track" aria-hidden={silent}>
        <HorizontalMeterDbGrid ticks={DB_TICKS} pctAtDb={dbToPct} className="mb-hlevels__track-grid" />
        <div
          className={`mb-hlevels__fill mb-hlevels__fill--${variant}`}
          style={{ width: `${width}%` }}
        >
          {showInlineLabel && (
            <span className="mb-hlevels__inline-db">[{formatMeterDb(valueDb)} dB]</span>
          )}
        </div>
      </div>
      <span
        className={`mb-hlevels__readout mb-hlevels__readout--${isPeak ? 'hot' : 'cool'}`}
      >
        {formatMeterDb(valueDb)}
      </span>
    </div>
  );
}

export function MasterBayHorizontalLevels({ snap }: { snap?: MultiMeterSnap }) {
  const m: MultiMeterSnap = snap ?? idleMultiMeterSnap();
  const silent = isMultiMeterSilent(m);

  const balanceDb = silent ? 0 : m.balanceDb;
  const balanceLeftPct = balanceDb < 0 ? (Math.abs(balanceDb) / BALANCE_MAX_DB) * 50 : 0;
  const balanceRightPct = balanceDb > 0 ? (balanceDb / BALANCE_MAX_DB) * 50 : 0;
  const leftEdgeDb = silent ? 0 : Math.max(0, -balanceDb);
  const rightEdgeDb = silent ? 0 : Math.max(0, balanceDb);

  return (
    <section className="mb-hlevels" aria-label="Stereo horizontal level meters">
      <div className="mb-hlevels__panel">
        <div className="mb-hlevels__meters">
          <div className="mb-hlevels__scale" aria-hidden>
            {DB_TICKS.map((db) => (
              <span
                key={db}
                className="mb-hlevels__scale-tick"
                style={{ left: `${dbToPct(db)}%` }}
              >
                {db > 0 ? `+${db}` : db}
              </span>
            ))}
          </div>

          <div className="mb-hlevels__rows">
            {/* L: peak line then pressure/RMS line */}
            <MeterLineRow
              ch="L"
              variant="peak"
              valueDb={m.lPeak}
              holdDb={m.lPeakHold}
              silent={silent}
            />
            <MeterLineRow
              variant="pressure"
              valueDb={m.lRms}
              silent={silent}
            />
            {/* R: pressure/RMS line then peak line (WaveLab order) */}
            <MeterLineRow
              ch="R"
              variant="pressure"
              valueDb={m.rRms}
              silent={silent}
            />
            <MeterLineRow
              variant="peak"
              valueDb={m.rPeak}
              holdDb={m.rPeakHold}
              silent={silent}
            />
          </div>
        </div>

        <div className="mb-hlevels__balance">
          <span className="mb-hlevels__balance-title">Balance</span>
          <div className="mb-hlevels__balance-grid">
            <div className="mb-hlevels__balance-side">
              <span>{silent ? '—' : `+${leftEdgeDb.toFixed(2)} dB`}</span>
              <span>{silent ? '—' : `+${(leftEdgeDb * 0.16).toFixed(2)} dB`}</span>
            </div>
            <div className="mb-hlevels__balance-track-wrap">
              <div className="mb-hlevels__balance-track">
                <div className="mb-hlevels__balance-track-grid" aria-hidden>
                  {BALANCE_TICKS_LEFT.map((n) => (
                    <span
                      key={`gl${n}`}
                      className={`mb-hlevels__balance-vline${n === 6 || n === 3 ? ' mb-hlevels__balance-vline--major' : ''}`}
                      style={{ left: `${balanceTickPct(n, 'left')}%` }}
                    />
                  ))}
                  <span
                    className="mb-hlevels__balance-vline mb-hlevels__balance-vline--center"
                    style={{ left: '50%' }}
                  />
                  {BALANCE_TICKS_RIGHT.map((n) => (
                    <span
                      key={`gr${n}`}
                      className={`mb-hlevels__balance-vline${n === 6 || n === 3 ? ' mb-hlevels__balance-vline--major' : ''}`}
                      style={{ left: `${balanceTickPct(n, 'right')}%` }}
                    />
                  ))}
                </div>
                <div className="mb-hlevels__balance-half mb-hlevels__balance-half--left">
                  <div
                    className="mb-hlevels__balance-fill mb-hlevels__balance-fill--l"
                    style={{ width: silent ? '0%' : `${balanceLeftPct}%` }}
                  />
                </div>
                <div className="mb-hlevels__balance-center-mark" aria-hidden />
                <div className="mb-hlevels__balance-half mb-hlevels__balance-half--right">
                  <div
                    className="mb-hlevels__balance-fill mb-hlevels__balance-fill--r"
                    style={{ width: silent ? '0%' : `${balanceRightPct}%` }}
                  />
                </div>
              </div>
              <div className="mb-hlevels__balance-scale-row" aria-hidden>
                {BALANCE_TICKS_LEFT.map((n) => (
                  <span
                    key={`l${n}`}
                    className="mb-hlevels__balance-scale-tick"
                    style={{ left: `${balanceTickPct(n, 'left')}%` }}
                  >
                    {n}
                  </span>
                ))}
                <span className="mb-hlevels__balance-scale-tick mb-hlevels__balance-scale-tick--center">
                  0 dB
                </span>
                {BALANCE_TICKS_RIGHT.map((n) => (
                  <span
                    key={`r${n}`}
                    className="mb-hlevels__balance-scale-tick"
                    style={{ left: `${balanceTickPct(n, 'right')}%` }}
                  >
                    {n}
                  </span>
                ))}
              </div>
              <div className="mb-hlevels__balance-readouts">
                <span className="mb-hlevels__balance-readout mb-hlevels__balance-readout--l">
                  {silent ? '—' : `+${Math.max(0, -balanceDb).toFixed(2)}`}
                </span>
                <span className="mb-hlevels__balance-readout mb-hlevels__balance-readout--r">
                  {silent ? '—' : `+${Math.max(0, balanceDb).toFixed(2)}`}
                </span>
              </div>
            </div>
            <div className="mb-hlevels__balance-side mb-hlevels__balance-side--right">
              <span>{silent ? '—' : `+${rightEdgeDb.toFixed(2)} dB`}</span>
              <span>{silent ? '—' : `+${Math.abs(balanceDb * 0.04).toFixed(2)} dB`}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
