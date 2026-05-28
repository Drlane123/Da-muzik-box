import React, { useMemo, useState } from 'react';
import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import {
  BEAT_LAB_SYNTH2_GLIDE_PRESETS,
  beatLabSynthV2BuildGlidePresetVoicePatch,
  beatLabSynthV2GlidePresetGroups,
} from '@/app/lib/creationStation/beatLabSynthV2GlidePresets';

type Props = {
  layoutBars: 4 | 8;
  stepsPerBar: number;
  subdiv: number;
  hasChordRail: boolean;
  fallbackGlideDivision?: BeatLabBassSynthVoiceParams['glideDivision'];
  onApply: (patch: Partial<BeatLabBassSynthVoiceParams>) => void;
  disabled?: boolean;
  /** Compact row for glide layout strip. */
  compact?: boolean;
};

export function BeatLabSynthV2GlidePresetPicker({
  layoutBars,
  stepsPerBar,
  subdiv,
  hasChordRail,
  fallbackGlideDivision,
  onApply,
  disabled = false,
  compact = false,
}: Props) {
  const [presetId, setPresetId] = useState('deep-default');
  const groups = useMemo(() => beatLabSynthV2GlidePresetGroups(BEAT_LAB_SYNTH2_GLIDE_PRESETS), []);

  const applyPreset = (id: string) => {
    const patch = beatLabSynthV2BuildGlidePresetVoicePatch({
      presetId: id,
      layoutBars,
      stepsPerBar,
      subdiv,
      hasChordRail,
      fallbackGlideDivision,
    });
    if (patch) onApply(patch);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: compact ? 5 : 6,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: compact ? 8 : 9, color: '#c59cff', fontWeight: 800, flexShrink: 0 }}>
        Glide FX presets
      </span>
      <select
        disabled={disabled}
        value={presetId}
        onChange={(e) => {
          const id = e.target.value;
          setPresetId(id);
          applyPreset(id);
        }}
        title={`${BEAT_LAB_SYNTH2_GLIDE_PRESETS.length} glide effect recipes`}
        style={{
          fontSize: compact ? 8 : 9,
          fontWeight: 700,
          color: '#e8d8ff',
          background: '#12161e',
          border: '1px solid rgba(184,140,255,0.45)',
          borderRadius: 4,
          padding: compact ? '3px 6px' : '4px 8px',
          minWidth: compact ? 140 : 180,
          maxWidth: compact ? 220 : 280,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {groups.map((g) => (
          <optgroup key={g.category} label={g.category}>
            {g.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => applyPreset(presetId)}
        style={{
          fontSize: compact ? 7 : 8,
          fontWeight: 800,
          color: '#eeddff',
          background: 'rgba(184,140,255,0.18)',
          border: '1px solid rgba(184,140,255,0.5)',
          borderRadius: 4,
          padding: compact ? '2px 8px' : '3px 10px',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        Apply
      </button>
      <span style={{ fontSize: 7, color: '#6a7d92', fontWeight: 600 }}>
        {BEAT_LAB_SYNTH2_GLIDE_PRESETS.length} presets · pick then tweak bars / shifts
      </span>
    </div>
  );
}
