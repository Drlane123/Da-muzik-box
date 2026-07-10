'use client';

import { SekModule, SekOnBtn } from '@/app/components/studio/genoUltraSektorUi';
import { AnaKnob, AnaKnobRow } from '@/app/components/studio/genoUltraAnaUi';
import { useGenoUltraArpGateFx } from '@/app/components/studio/genoUltraArpGateFxContext';

/** Analog gate controls — sequencer tab only, under Oscillator B. */
export function AnaArpGateFxSekModule({ disabled }: { disabled?: boolean }) {
  const {
    gateFxOn,
    setGateFxOn,
    gateFxDepth,
    setGateFxDepth,
    gateFxAttackMs,
    setGateFxAttackMs,
    gateFxReleaseMs,
    setGateFxReleaseMs,
  } = useGenoUltraArpGateFx();

  const knobsOff = disabled || !gateFxOn;

  return (
    <SekModule title="Gate FX" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <SekOnBtn
          on={gateFxOn}
          disabled={disabled}
          onClick={() => setGateFxOn(!gateFxOn)}
          title="Analog gate on/off — chops the arp in sync with the GATE step lane"
        />
      </div>
      <AnaKnobRow>
        <AnaKnob
          label="DPTH"
          value={gateFxDepth}
          min={0}
          max={1}
          disabled={knobsOff}
          onChange={setGateFxDepth}
          title="How hard the gate closes on low GATE lane steps"
        />
        <AnaKnob
          label="ATK"
          value={gateFxAttackMs}
          min={1}
          max={40}
          decimals={0}
          unit="ms"
          disabled={knobsOff}
          onChange={(v) => setGateFxAttackMs(Math.round(v))}
          title="Gate open attack (ms)"
        />
        <AnaKnob
          label="REL"
          value={gateFxReleaseMs}
          min={5}
          max={180}
          decimals={0}
          unit="ms"
          disabled={knobsOff}
          onChange={(v) => setGateFxReleaseMs(Math.round(v))}
          title="Gate close release (ms) — pump tail"
        />
      </AnaKnobRow>
    </SekModule>
  );
}
