'use client';

import { ChainModuleShell } from '@/app/components/masteringBay/ChainModuleShell';
import { ChainParam } from '@/app/components/masteringBay/ChainParam';
import { ProcessVisual } from '@/app/components/masteringBay/ProcessVisual';
import {
  IDLE_PROCESS_LIVE,
  type ProcessLiveFeed,
} from '@/app/lib/masteringBay/masteringBayProcessLive';
import type { DaMatchState } from '@/app/lib/masteringBay/masteringBayPresets';

const REFERENCES = [
  { id: 'streaming', label: 'Streaming -14' },
  { id: 'club', label: 'Club Punch' },
  { id: 'vintage', label: 'Vintage Warm' },
  { id: 'cd', label: 'CD Master' },
] as const;

const TABS = [
  { id: 'match', label: 'MATCH' },
  { id: 'tone', label: 'TONE' },
  { id: 'ref', label: 'WIDTH' },
] as const;

type Props = {
  slot: number;
  state: DaMatchState;
  onChange: (patch: Partial<DaMatchState>) => void;
  signalIn?: boolean;
  live?: ProcessLiveFeed;
};

export function DaMatchRackUnit({
  slot,
  state,
  onChange,
  signalIn = true,
  live = IDLE_PROCESS_LIVE,
}: Props) {
  const visualKind =
    state.activeTab === 'ref' ? 'stereo' : state.activeTab === 'tone' ? 'tone' : 'match';

  return (
    <ChainModuleShell
      slot={slot}
      name="DMB MATCH"
      variant="da-match"
      power={state.power}
      onPower={() => onChange({ power: !state.power })}
      tabs={[...TABS]}
      activeTab={state.activeTab}
      onTab={(id) => onChange({ activeTab: id as DaMatchState['activeTab'] })}
      signalIn={signalIn}
      signalOut={state.power}
      visual={(
        <ProcessVisual
          kind={visualKind}
          powered={state.power}
          live={live}
          params={{
            matchAmount: state.matchAmount,
            width: state.width,
            tone: state.tone,
            loudness: state.loudness,
            dynamics: state.dynamics,
          }}
        />
      )}
      controls={(
        <>
          <ChainParam label="MATCH" min={0} max={100} step={1} value={state.matchAmount} format={(v) => `${v}%`} onChange={(matchAmount) => onChange({ matchAmount })} />
          <ChainParam label="WID" min={0} max={100} step={1} value={state.width} format={(v) => `${v}%`} onChange={(width) => onChange({ width })} />
          <ChainParam label="DYN" min={0} max={100} step={1} value={state.dynamics} format={(v) => `${v}%`} onChange={(dynamics) => onChange({ dynamics })} />
          <ChainParam label="LOUD" min={0} max={100} step={1} value={state.loudness} format={(v) => `${v}%`} onChange={(loudness) => onChange({ loudness })} />
          {state.activeTab === 'ref' && (
            <label className="mb-chain-mod__select">
              <span>REF</span>
              <select value={state.referenceId} onChange={(e) => onChange({ referenceId: e.target.value })}>
                {REFERENCES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
          )}
          {state.activeTab === 'tone' && (
            <ChainParam label="TONE" min={0} max={100} step={1} value={state.tone} format={(v) => `${v}%`} onChange={(tone) => onChange({ tone })} />
          )}
        </>
      )}
    />
  );
}
