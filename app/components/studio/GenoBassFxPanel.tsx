'use client';

import { useCallback, useMemo, useState } from 'react';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { sanitizeGenoUltraFxParams } from '@/app/lib/studio/genoUltraSynthTypes';
import {
  AnaModernDelayDisplay,
  AnaReverbDiffuseDisplay,
  AnaTapeWaveDisplay,
  anaFxSlotButtonStyle,
} from '@/app/components/studio/genoUltraFxVisuals';
import { AnaEqPanel } from '@/app/components/studio/genoUltraAnaUi';
import { GenoBassMoogKnob, GENO_BASS_THEME } from '@/app/components/studio/genoBassWoodUi';

export type GenoBassFxSlotId = 'chorus' | 'delay' | 'reverb' | 'eq';

const FX_SLOTS: readonly { id: GenoBassFxSlotId; label: string }[] = [
  { id: 'chorus', label: 'CHORUS' },
  { id: 'delay', label: 'DELAY' },
  { id: 'reverb', label: 'REVERB' },
  { id: 'eq', label: 'EQ' },
];

function bassFxSlotStyle(active: boolean, disabled?: boolean) {
  const base = anaFxSlotButtonStyle(active, disabled);
  return {
    ...base,
    border: `1px solid ${active ? GENO_BASS_THEME.sphinxHi : GENO_BASS_THEME.border}`,
    background: active
      ? `linear-gradient(135deg, ${GENO_BASS_THEME.sphinxGlow}, rgba(18,18,22,0.95))`
      : GENO_BASS_THEME.panelInset,
    color: active ? GENO_BASS_THEME.sphinxHi : GENO_BASS_THEME.labelDim,
    boxShadow: active ? `0 0 12px ${GENO_BASS_THEME.sphinxGlow}` : 'none',
  };
}

export type GenoBassFxPanelProps = {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  onPatchVoice: (patch: Partial<GenoUltraSynthVoiceParams>) => void;
};

export function GenoBassFxPanel({ voice, disabled, onPatchVoice }: GenoBassFxPanelProps) {
  const [fxSlot, setFxSlot] = useState<GenoBassFxSlotId>('delay');
  const fx = voice.fx;

  const patchFx = useCallback(
    (partial: Partial<GenoUltraSynthVoiceParams['fx']>) => {
      onPatchVoice({ fx: sanitizeGenoUltraFxParams({ ...voice.fx, ...partial }) });
    },
    [onPatchVoice, voice.fx],
  );

  const patchDelay = useCallback(
    (partial: Partial<GenoUltraSynthVoiceParams['fx']>) => {
      const next = { ...partial };
      if (partial.delayMix !== undefined && partial.delayMix > 0.02) {
        next.delayEnabled = true;
      }
      patchFx(next);
    },
    [patchFx],
  );

  const toggleDelay = useCallback(() => {
    const nextOn = fx.delayEnabled === false;
    if (nextOn && fx.delayMix < 0.05) {
      patchFx({ delayEnabled: true, delayMix: 0.38 });
      return;
    }
    patchFx({ delayEnabled: nextOn });
  }, [fx.delayEnabled, fx.delayMix, patchFx]);

  const visual = useMemo(() => {
    switch (fxSlot) {
      case 'chorus':
        return (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.sphinxHi, letterSpacing: '0.12em' }}>
              CHORUS — MODULATED DETUNE
            </div>
            <div style={{ flex: 1, minHeight: 100 }}>
              <AnaTapeWaveDisplay mix={fx.chorusMix} height={100} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <GenoBassMoogKnob label="Mix" value={fx.chorusMix} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchFx({ chorusMix: v })} />
              <GenoBassMoogKnob label="Rate" value={fx.chorusRateHz} min={0.05} max={8} decimals={2} disabled={disabled} onChange={(v) => patchFx({ chorusRateHz: v })} />
            </div>
          </div>
        );
      case 'delay':
        return (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <AnaModernDelayDisplay
              delayTimeMs={fx.delayTimeMs}
              delayTimeMsR={Math.round(fx.delayTimeMs * 1.08)}
              feedback={fx.delayFeedback}
              mix={fx.delayMix}
              enabled={fx.delayEnabled}
              disabled={disabled}
              onPatch={patchDelay}
              onToggleEnabled={toggleDelay}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <GenoBassMoogKnob label="Mix" value={fx.delayMix} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchDelay({ delayMix: v })} />
              <GenoBassMoogKnob label="Time" value={fx.delayTimeMs} min={40} max={1200} decimals={0} disabled={disabled} onChange={(v) => patchDelay({ delayTimeMs: v })} />
              <GenoBassMoogKnob label="FB" value={fx.delayFeedback} min={0} max={0.95} decimals={2} disabled={disabled} onChange={(v) => patchDelay({ delayFeedback: v })} />
            </div>
          </div>
        );
      case 'reverb':
        return (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.sphinxHi, letterSpacing: '0.12em' }}>
              HALL REVERB — DIFFUSION
            </div>
            <div style={{ flex: 1, minHeight: 100 }}>
              <AnaReverbDiffuseDisplay decay={fx.reverbDecay} mix={fx.reverbMix} height={100} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <GenoBassMoogKnob label="Mix" value={fx.reverbMix} min={0} max={1} decimals={2} disabled={disabled} onChange={(v) => patchFx({ reverbMix: v })} />
              <GenoBassMoogKnob label="Decay" value={fx.reverbDecay} min={0.1} max={0.95} decimals={2} disabled={disabled} onChange={(v) => patchFx({ reverbDecay: v })} />
            </div>
          </div>
        );
      case 'eq':
        return (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <AnaEqPanel fx={fx} disabled={disabled} onPatchFx={patchFx} />
          </div>
        );
      default:
        return null;
    }
  }, [disabled, fx, fxSlot, patchDelay, patchFx, toggleDelay]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 2px' }}>{visual}</div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 4,
          padding: '6px 4px 2px',
          borderTop: `1px solid ${GENO_BASS_THEME.border}`,
          background: GENO_BASS_THEME.panelInset,
          flexShrink: 0,
        }}
      >
        {FX_SLOTS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => setFxSlot(s.id)}
            style={bassFxSlotStyle(fxSlot === s.id, disabled)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
