'use client';

import type { CSSProperties } from 'react';
import { SekModule, SekOnBtn, SEKTOR } from '@/app/components/studio/genoUltraSektorUi';
import { AnaKnob, AnaKnobRow } from '@/app/components/studio/genoUltraAnaUi';
import { useGenoUltraArpGateFx } from '@/app/components/studio/genoUltraArpGateFxContext';
import {
  GENO_ARP_PUMPER_RATE_LABELS,
  genoArpSanitizePumperRateIdx,
} from '@/app/lib/studio/genoUltraArpPumper';

const rateSelectStyle: CSSProperties = {
  width: '100%',
  marginTop: 2,
  marginBottom: 6,
  padding: '3px 4px',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: SEKTOR.text,
  background: SEKTOR.bgDeep,
  border: `1px solid ${SEKTOR.border}`,
  borderRadius: 2,
  cursor: 'pointer',
};

/** Quantized sidechain pumper — sequencer tab only, under Gate FX. */
export function AnaArpPumperFxSekModule({ disabled }: { disabled?: boolean }) {
  const {
    pumperOn,
    setPumperOn,
    pumperRate,
    setPumperRate,
    pumperDepth,
    setPumperDepth,
    pumperAttackMs,
    setPumperAttackMs,
    pumperReleaseMs,
    setPumperReleaseMs,
    pumperHighFilter,
    setPumperHighFilter,
    pumperLowFilter,
    setPumperLowFilter,
  } = useGenoUltraArpGateFx();

  const knobsOff = disabled || !pumperOn;

  return (
    <SekModule title="Pumper" style={{ marginBottom: 0, marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <SekOnBtn
          on={pumperOn}
          disabled={disabled}
          onClick={() => setPumperOn(!pumperOn)}
          title="Sidechain pumper — ducks the arp bus on quantized 1/32–1/2 divisions"
        />
      </div>
      <AnaKnobRow>
        <AnaKnob
          label="HIGH"
          value={pumperHighFilter}
          min={0}
          max={1}
          disabled={disabled}
          onChange={setPumperHighFilter}
          title="High filter — turn up to cut treble"
        />
        <AnaKnob
          label="LOW"
          value={pumperLowFilter}
          min={0}
          max={1}
          disabled={disabled}
          onChange={setPumperLowFilter}
          title="Low filter — turn up to cut bass"
        />
      </AnaKnobRow>
      <span
        style={{
          fontSize: 7,
          fontWeight: 800,
          color: SEKTOR.textDim,
          letterSpacing: '0.1em',
        }}
        title="Pump quantization"
      >
        RATE
      </span>
      <select
        value={pumperRate}
        disabled={knobsOff}
        title="Pump rate — synced to bar grid"
        onChange={(e) => setPumperRate(genoArpSanitizePumperRateIdx(Number(e.target.value)))}
        style={rateSelectStyle}
      >
        {GENO_ARP_PUMPER_RATE_LABELS.map((label, i) => (
          <option key={label} value={i}>
            {label}
          </option>
        ))}
      </select>
      <AnaKnobRow>
        <AnaKnob
          label="DPTH"
          value={pumperDepth}
          min={0}
          max={1}
          disabled={knobsOff}
          onChange={setPumperDepth}
          title="How deep the bus ducks between pump hits"
        />
        <AnaKnob
          label="ATK"
          value={pumperAttackMs}
          min={1}
          max={40}
          decimals={0}
          unit="ms"
          disabled={knobsOff}
          onChange={(v) => setPumperAttackMs(Math.round(v))}
          title="Pump-up attack (ms)"
        />
        <AnaKnob
          label="REL"
          value={pumperReleaseMs}
          min={10}
          max={240}
          decimals={0}
          unit="ms"
          disabled={knobsOff}
          onChange={(v) => setPumperReleaseMs(Math.round(v))}
          title="Pump-down release (ms)"
        />
      </AnaKnobRow>
    </SekModule>
  );
}
