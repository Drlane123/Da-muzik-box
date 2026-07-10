'use client';

import { dbToMeterPct } from '@/app/lib/masteringBay/masteringBayMeterAnalysis';
import { METER_DB_FLOOR } from '@/app/lib/masteringBay/masteringBayMeterBallistics';
import { VU_METER_DB_TICKS } from '@/app/lib/masteringBay/masteringBayMeterIdle';

const MAJOR_DB = new Set([3, 0, -6, -12, -18, -24, -36, -48, -60]);

function formatTickDb(db: number): string {
  return db > 0 ? `+${db}` : String(db);
}

type VerticalProps = {
  floorDb?: number;
  ticks?: readonly number[];
  className?: string;
  showLabels?: boolean;
};

/** dB scale labels + horizontal grid lines inside a vertical VU strip. */
export function VerticalMeterDbGrid({
  floorDb = METER_DB_FLOOR,
  ticks = VU_METER_DB_TICKS,
  className = '',
  showLabels = true,
}: VerticalProps) {
  return (
    <div className={`mb-vu-scale mb-vu-scale--vertical ${className}`.trim()} aria-hidden>
      {showLabels && (
        <div className="mb-vu-scale__labels">
          {ticks.map((db) => (
            <span
              key={db}
              className="mb-vu-scale__label"
              style={{ bottom: `${dbToMeterPct(db, floorDb)}%` }}
            >
              {formatTickDb(db)}
            </span>
          ))}
        </div>
      )}
      <div className="mb-vu-scale__grid">
        {ticks.map((db) => (
          <span
            key={db}
            className={`mb-vu-scale__hline${MAJOR_DB.has(db) ? ' mb-vu-scale__hline--major' : ''}`}
            style={{ bottom: `${dbToMeterPct(db, floorDb)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

type HorizontalProps = {
  ticks: readonly number[];
  pctAtDb: (db: number) => number;
  className?: string;
};

/** Vertical grid lines across a horizontal level strip. */
export function HorizontalMeterDbGrid({ ticks, pctAtDb, className = '' }: HorizontalProps) {
  return (
    <div className={`mb-vu-scale mb-vu-scale--horizontal ${className}`.trim()} aria-hidden>
      {ticks.map((db) => (
        <span
          key={db}
          className={`mb-vu-scale__vline${MAJOR_DB.has(db) ? ' mb-vu-scale__vline--major' : ''}`}
          style={{ left: `${pctAtDb(db)}%` }}
        />
      ))}
    </div>
  );
}
