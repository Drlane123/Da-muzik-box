'use client';

import type { ReactNode } from 'react';

type Tab = { id: string; label: string };

type Props = {
  slot: number;
  name: string;
  power: boolean;
  onPower: () => void;
  tabs: Tab[];
  activeTab: string;
  onTab: (id: string) => void;
  visual: ReactNode;
  controls: ReactNode;
  variant: 'fast-master' | 'bass-one' | 'da-match' | 'de-noise';
  signalIn?: boolean;
  signalOut?: boolean;
};

export function ChainModuleShell({
  slot,
  name,
  power,
  onPower,
  tabs,
  activeTab,
  onTab,
  visual,
  controls,
  variant,
  signalIn = true,
  signalOut = true,
}: Props) {
  return (
    <div className={`mb-chain-mod mb-chain-mod--${variant}${power ? '' : ' mb-chain-mod--off'}`}>
      <div className="mb-chain-mod__head">
        <div className="mb-chain-mod__head-left">
          <button
            type="button"
            className={`mb-unit__power${power ? ' mb-unit__power--on' : ''}`}
            onClick={onPower}
            aria-label={`Power ${name}`}
          />
          <span className="mb-chain-mod__slot">{String(slot).padStart(2, '0')}</span>
          <span className="mb-chain-mod__name">{name}</span>
        </div>
        <div className="mb-chain-mod__flow" aria-hidden>
          <span className={`mb-chain-mod__flow-node${signalIn && power ? ' is-live' : ''}`}>IN</span>
          <i className={power ? 'is-live' : ''} />
          <span className={`mb-chain-mod__flow-node${signalOut && power ? ' is-live' : ''}`}>OUT</span>
        </div>
      </div>

      <div className="mb-chain-mod__tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={activeTab === t.id ? 'is-active' : ''}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-chain-mod__body">
        <div className="mb-chain-mod__visual" role="tabpanel">
          {visual}
        </div>
        <div className="mb-chain-mod__controls">{controls}</div>
      </div>
    </div>
  );
}
