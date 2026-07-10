'use client';

import { ChainModuleShell } from '@/app/components/masteringBay/ChainModuleShell';
import { ChainParam } from '@/app/components/masteringBay/ChainParam';
import { ProcessVisual } from '@/app/components/masteringBay/ProcessVisual';
import {
  IDLE_PROCESS_LIVE,
  type ProcessLiveFeed,
} from '@/app/lib/masteringBay/masteringBayProcessLive';
import type { BassOneState } from '@/app/lib/masteringBay/masteringBayPresets';

const TABS = [
  { id: 'sub', label: 'SUB' },
  { id: 'tone', label: 'TONE' },
  { id: 'drive', label: 'DRIVE' },
] as const;

type Props = {
  slot: number;
  state: BassOneState;
  onChange: (patch: Partial<BassOneState>) => void;
  signalIn?: boolean;
  live?: ProcessLiveFeed;
};

export function BassOneRackUnit({
  slot,
  state,
  onChange,
  signalIn = true,
  live = IDLE_PROCESS_LIVE,
}: Props) {
  const visualKind = state.activeTab === 'sub' ? 'sub' : state.activeTab === 'drive' ? 'drive' : 'tone';
  const powered = state.power && !state.bypass;

  return (
    <ChainModuleShell
      slot={slot}
      name="BASS X"
      variant="bass-one"
      power={state.power}
      onPower={() => onChange({ power: !state.power })}
      tabs={[...TABS]}
      activeTab={state.activeTab}
      onTab={(id) => onChange({ activeTab: id as BassOneState['activeTab'] })}
      signalIn={signalIn}
      signalOut={powered}
      visual={(
        <ProcessVisual
          kind={visualKind}
          powered={powered}
          live={live}
          params={{
            push: state.push,
            drive: state.drive,
            analog: state.analog,
            focus: state.focus * 10,
            tone: state.focus * 10,
          }}
        />
      )}
      controls={(
        <>
          {state.activeTab === 'sub' && (
            <>
              <ChainParam label="HI" min={80} max={300} step={1} value={state.hiFreq} onChange={(hiFreq) => onChange({ hiFreq })} />
              <ChainParam label="LO" min={10} max={80} step={1} value={state.loCut} onChange={(loCut) => onChange({ loCut })} />
              <ChainParam label="DEF" min={0} max={10} step={0.1} value={state.definition} format={(v) => v.toFixed(1)} onChange={(definition) => onChange({ definition })} />
              <button type="button" className={`mb-chain-mod__toggle${state.sub ? ' is-on' : ''}`} onClick={() => onChange({ sub: !state.sub })}>SUB</button>
            </>
          )}
          {state.activeTab === 'drive' && (
            <>
              <ChainParam label="PUSH" min={-15} max={15} step={0.1} value={state.push} format={(v) => v.toFixed(1)} onChange={(push) => onChange({ push })} />
              <ChainParam label="DRV" min={0} max={10} step={0.1} value={state.drive} format={(v) => v.toFixed(1)} onChange={(drive) => onChange({ drive })} />
              <ChainParam label="HAR" min={0} max={10} step={0.1} value={state.harmonics} format={(v) => v.toFixed(1)} onChange={(harmonics) => onChange({ harmonics })} />
              <button type="button" className={`mb-chain-mod__toggle${state.modeHeavy ? ' is-on' : ''}`} onClick={() => onChange({ modeHeavy: !state.modeHeavy })}>HEAVY</button>
            </>
          )}
          {state.activeTab === 'tone' && (
            <>
              <ChainParam label="OUT" min={-15} max={15} step={0.1} value={state.output} format={(v) => v.toFixed(1)} onChange={(output) => onChange({ output })} />
              <ChainParam label="ANL" min={0} max={10} step={0.1} value={state.analog} format={(v) => v.toFixed(1)} onChange={(analog) => onChange({ analog })} />
              <ChainParam label="FCU" min={1} max={10} step={0.1} value={state.focus} format={(v) => v.toFixed(1)} onChange={(focus) => onChange({ focus })} />
              <button type="button" className={`mb-chain-mod__toggle${state.bypass ? ' is-on' : ''}`} onClick={() => onChange({ bypass: !state.bypass })}>BYP</button>
            </>
          )}
        </>
      )}
    />
  );
}
