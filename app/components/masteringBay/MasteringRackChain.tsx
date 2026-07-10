'use client';

import { ChevronLeft, ChevronRight, Link2, Unlink } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import type { MasteringBayRackState } from '@/app/lib/masteringBay/masteringBayPresets';
import {
  IDLE_PROCESS_LIVE,
  type ProcessLiveFeed,
} from '@/app/lib/masteringBay/masteringBayProcessLive';
import { BassOneRackUnit } from '@/app/components/masteringBay/BassOneRackUnit';
import { DaMatchRackUnit } from '@/app/components/masteringBay/DaMatchRackUnit';
import { FastMasterRackUnit } from '@/app/components/masteringBay/FastMasterRackUnit';
import { RackChainLink } from '@/app/components/masteringBay/RackChainLink';

type CoreModuleKey = 'fastMaster' | 'bassOne' | 'daMatch';

type Props = {
  rackState: MasteringBayRackState;
  onRackChange: (next: MasteringBayRackState) => void;
  live?: ProcessLiveFeed;
};

export function MasteringRackChain({
  rackState,
  onRackChange,
  live = IDLE_PROCESS_LIVE,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chainLinked, setChainLinked] = useState(true);

  const scroll = useCallback((dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const slot = el.querySelector<HTMLElement>('.mb-rack__chain-slot');
    const link = el.querySelector<HTMLElement>('.mb-chain-link');
    const step = (slot?.offsetWidth ?? 560) + (link?.offsetWidth ?? 20);
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  }, []);

  const bassOut = rackState.bassOne.power && !rackState.bassOne.bypass;
  const matchOut = rackState.daMatch.power;
  const link1 = bassOut && rackState.daMatch.power;
  const link2 = matchOut && rackState.fastMaster.power;

  const applyCorePatch = useCallback(
    (which: CoreModuleKey, patch: Record<string, unknown>) => {
      if (chainLinked && 'power' in patch && typeof patch.power === 'boolean') {
        const p = patch.power;
        onRackChange({
          ...rackState,
          fastMaster: { ...rackState.fastMaster, ...(which === 'fastMaster' ? patch : {}), power: p },
          bassOne: { ...rackState.bassOne, ...(which === 'bassOne' ? patch : {}), power: p },
          daMatch: { ...rackState.daMatch, ...(which === 'daMatch' ? patch : {}), power: p },
        });
        return;
      }
      onRackChange({ ...rackState, [which]: { ...rackState[which], ...patch } });
    },
    [chainLinked, onRackChange, rackState],
  );

  return (
    <div className="mb-rack__chain-wrap">
      <div className="mb-rack__chain-toolbar">
        <span className="mb-rack__chain-label">SIGNAL CHAIN</span>
        <button
          type="button"
          className={`mb-rack__chain-link-btn${chainLinked ? ' is-active' : ''}`}
          onClick={() => setChainLinked((v) => !v)}
          title={chainLinked ? 'Unlink Bass / Match / Master power' : 'Link Bass / Match / Master power'}
        >
          {chainLinked ? <Link2 size={12} /> : <Unlink size={12} />}
          {chainLinked ? 'LINKED' : 'UNLINKED'}
        </button>
        <span className="mb-rack__chain-hint">
          In: Bass X → DMB Match → Master X1 · De-Noise from top bar (optional)
        </span>
      </div>

      <div className="mb-rack__chain-row">
        <button type="button" className="mb-rack__chain-arrow mb-rack__chain-arrow--left" onClick={() => scroll(-1)} aria-label="Scroll chain left">
          <ChevronLeft size={18} />
        </button>

        <div className="mb-rack__chain-scroll" ref={scrollRef}>
          <div className="mb-rack__chain-track">
            <div className="mb-rack__chain-slot">
              <div className="mb-wood-trim">
                <div className="mb-wood-trim__inner">
                  <BassOneRackUnit
                    slot={1}
                    state={rackState.bassOne}
                    signalIn
                    live={live}
                    onChange={(patch) => applyCorePatch('bassOne', patch)}
                  />
                </div>
              </div>
            </div>

            <RackChainLink active={link1} />

            <div className="mb-rack__chain-slot">
              <div className="mb-wood-trim">
                <div className="mb-wood-trim__inner">
                  <DaMatchRackUnit
                    slot={2}
                    state={rackState.daMatch}
                    signalIn={bassOut}
                    live={live}
                    onChange={(patch) => applyCorePatch('daMatch', patch)}
                  />
                </div>
              </div>
            </div>

            <RackChainLink active={link2} />

            <div className="mb-rack__chain-slot">
              <div className="mb-wood-trim">
                <div className="mb-wood-trim__inner">
                  <FastMasterRackUnit
                    slot={3}
                    state={rackState.fastMaster}
                    signalIn={matchOut && bassOut}
                    live={live}
                    onChange={(patch) => applyCorePatch('fastMaster', patch)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="button" className="mb-rack__chain-arrow mb-rack__chain-arrow--right" onClick={() => scroll(1)} aria-label="Scroll chain right">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
