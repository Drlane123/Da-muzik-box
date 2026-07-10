'use client';

import { ChainModuleShell } from '@/app/components/masteringBay/ChainModuleShell';
import { ChainParam } from '@/app/components/masteringBay/ChainParam';
import { ProcessVisual } from '@/app/components/masteringBay/ProcessVisual';
import {
  IDLE_PROCESS_LIVE,
  type ProcessLiveFeed,
} from '@/app/lib/masteringBay/masteringBayProcessLive';
import type {
  FastMasterState,
  MasterTab,
  X1LoudBoost,
} from '@/app/lib/masteringBay/masteringBayPresets';
import { useMemo } from 'react';

const LOUD_TARGETS = [-10, -9, -8, -7, -6, -5] as const;

const TABS: { id: MasterTab; label: string }[] = [
  { id: 'eq', label: 'EQ' },
  { id: 'stereo', label: 'STR' },
  { id: 'compress', label: 'COMP' },
  { id: 'transients', label: 'TAPE' },
  { id: 'limit', label: 'LIM' },
];

const TAB_PANELS: Record<MasterTab, { params: { id: string; label: string; min: number; max: number; step: number }[] }> = {
  eq: { params: [{ id: 'low', label: 'Low', min: -6, max: 6, step: 0.1 }, { id: 'mid', label: 'Mid', min: -6, max: 6, step: 0.1 }, { id: 'high', label: 'High', min: -6, max: 6, step: 0.1 }] },
  transients: { params: [{ id: 'attack', label: 'Atk', min: 0, max: 100, step: 1 }, { id: 'punch', label: 'Punch', min: 0, max: 100, step: 1 }] },
  compress: { params: [{ id: 'amount', label: 'Amt', min: 0, max: 100, step: 1 }, { id: 'threshold', label: 'Thr', min: -24, max: 0, step: 0.5 }] },
  stereo: { params: [{ id: 'width', label: 'Width', min: 0, max: 200, step: 1 }, { id: 'mono', label: 'Mono', min: 40, max: 200, step: 1 }] },
  limit: { params: [{ id: 'ceiling', label: 'Ceil', min: -3, max: 0, step: 0.1 }, { id: 'release', label: 'Rel', min: 20, max: 500, step: 5 }] },
};

type Props = {
  slot: number;
  state: FastMasterState;
  onChange: (patch: Partial<FastMasterState>) => void;
  signalIn?: boolean;
  live?: ProcessLiveFeed;
};

export function FastMasterRackUnit({
  slot,
  state,
  onChange,
  signalIn = true,
  live = IDLE_PROCESS_LIVE,
}: Props) {
  const panel = TAB_PANELS[state.activeTab];
  const paramRows = useMemo(
    () => panel.params.map((p) => ({ ...p, value: state.params[p.id] ?? p.min })),
    [panel.params, state.params],
  );
  const x1Boost: X1LoudBoost = state.x1LoudBoost ?? 0;

  const setX1Boost = (level: X1LoudBoost) => {
    // Toggle off if the same notch is pressed again; otherwise select that notch.
    onChange({ x1LoudBoost: x1Boost === level ? 0 : level });
  };

  return (
    <ChainModuleShell
      slot={slot}
      name="MASTER X1"
      variant="fast-master"
      power={state.power}
      onPower={() => onChange({ power: !state.power })}
      tabs={TABS}
      activeTab={state.activeTab}
      onTab={(id) => onChange({ activeTab: id as MasterTab })}
      signalIn={signalIn}
      signalOut={state.power}
      visual={(
        <ProcessVisual
          kind={state.activeTab}
          powered={state.power}
          live={live}
          params={{ ...state.params, driveDb: state.driveDb }}
        />
      )}
      controls={(
        <>
          <ChainParam
            label="DRV"
            min={-3}
            max={3}
            step={0.1}
            value={state.driveDb}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
            onChange={(driveDb) => onChange({ driveDb })}
          />
          {paramRows.map((p) => (
            <ChainParam
              key={p.id}
              label={p.label}
              min={p.min}
              max={p.max}
              step={p.step}
              value={p.value}
              format={(v) => v.toFixed(p.step < 1 ? 1 : 0)}
              onChange={(value) => onChange({ params: { ...state.params, [p.id]: value } })}
            />
          ))}
          {state.activeTab === 'limit' && (
            <div className="mb-chain-mod__x1-loud" role="group" aria-label="X1 loudness notches">
              <button
                type="button"
                className={`mb-chain-mod__x1-loud-btn mb-chain-mod__x1-loud-btn--loud${x1Boost === 1 ? ' is-on' : ''}`}
                onClick={() => setX1Boost(1)}
                title="X1 Loud — one notch louder into the limiter (safe ceiling)"
              >
                X1 Loud
              </button>
              <button
                type="button"
                className={`mb-chain-mod__x1-loud-btn mb-chain-mod__x1-loud-btn--louder${x1Boost === 2 ? ' is-on' : ''}`}
                onClick={() => setX1Boost(2)}
                title="X1 Louder — two notches louder into the limiter (safe ceiling)"
              >
                X1 Louder
              </button>
            </div>
          )}
          <div className="mb-chain-mod__loud">
            {LOUD_TARGETS.map((n) => (
              <button key={n} type="button" className={state.loudTarget === n ? 'is-active' : ''} onClick={() => onChange({ loudTarget: n })}>{n}</button>
            ))}
          </div>
        </>
      )}
    />
  );
}
