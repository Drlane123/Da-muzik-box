import { useEffect, useState, type CSSProperties } from 'react';
import { GrooveOctaveShiftButtons } from '@/app/components/creation/GrooveOctaveShiftButtons';
import type { GrooveComposerPart } from '@/app/lib/creationStation/grooveComposerEngine';
import { loadGuitarLickManifest } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import { GROOVE_LAB_REGISTER_LABELS } from '@/app/lib/creationStation/grooveLabPitch';
import { GROOVE_LAB_QUANTIZE_OPTIONS, type GrooveLabQuantize } from '@/app/lib/creationStation/grooveLabRoll';
import {
  getGrooveLabSampleLickGroup,
  GROOVE_LAB_LEAD_SOUND_GROUPS,
  GROOVE_LAB_LEAD_SOUNDS,
  GROOVE_LAB_RNB_SINE_GLIDE_MS,
  GROOVE_LAB_RNB_SINE_LFO_DEPTH_CENTS,
  GROOVE_LAB_RNB_SINE_LFO_RATE_HZ,
  GROOVE_LAB_RNB_SINE_UI_ENABLED,
  grooveLabSampleLickLabel,
  type GrooveLabAnyLeadSoundId,
} from '@/app/lib/creationStation/grooveLabLeadSounds';

export interface GrooveLabComposerPanelProps {
  grooveBranding?: boolean;
  /** Preview timbre for melody/riff/arp (guitar / pluck / sample lick presets). */
  melodySoundId: GrooveLabAnyLeadSoundId;
  onMelodySoundChange: (id: GrooveLabAnyLeadSoundId) => void;
  complexity: number;
  onComplexityChange: (v: number) => void;
  melodyRate: GrooveLabQuantize;
  onMelodyRateChange?: (v: GrooveLabQuantize) => void;
  riffRate: GrooveLabQuantize;
  onRiffRateChange?: (v: GrooveLabQuantize) => void;
  arpRate: GrooveLabQuantize;
  onArpRateChange?: (v: GrooveLabQuantize) => void;
  wahAmount?: number;
  onWahAmountChange?: (v: number) => void;
  wahRateHz?: number;
  onWahRateHzChange?: (v: number) => void;
  drive?: number;
  onDriveChange?: (v: number) => void;
  distortion?: number;
  onDistortionChange?: (v: number) => void;
  glideMs?: number;
  onGlideMsChange?: (v: number) => void;
  lfoRateHz?: number;
  onLfoRateHzChange?: (v: number) => void;
  lfoDepthCents?: number;
  onLfoDepthCentsChange?: (v: number) => void;
  melodyGridEnabled?: boolean;
  onMelodyGridEnabledChange?: (on: boolean) => void;
  riffGridEnabled?: boolean;
  onRiffGridEnabledChange?: (on: boolean) => void;
  linkedChordVolume?: number;
  onLinkedChordVolumeChange?: (v: number) => void;
  onGeneratePart: (part: GrooveComposerPart) => void;
  onLockChords: () => void;
  chordColumnCount: number;
  melodyNoteCount: number;
  melodyLayerNoteCount?: number;
  onClearAllMelody?: () => void;
  onMelodyOctaveDown?: () => void;
  onMelodyOctaveUp?: () => void;
}

const selectStyle: CSSProperties = {
  background: '#0a0e16',
  color: '#fbbf24',
  border: '1px solid #422006',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 8,
  fontWeight: 800,
  maxWidth: 200,
};

const btnStyle = (accent: string, border: string): CSSProperties => ({
  background: '#111820',
  color: accent,
  border: `1px solid ${border}`,
  borderRadius: 5,
  padding: '4px 10px',
  fontSize: 8,
  fontWeight: 900,
  cursor: 'pointer',
});

export function GrooveLabComposerPanel({
  grooveBranding = false,
  melodySoundId,
  onMelodySoundChange,
  complexity,
  onComplexityChange,
  melodyRate,
  onMelodyRateChange,
  riffRate,
  onRiffRateChange,
  arpRate,
  onArpRateChange,
  wahAmount = 0.55,
  onWahAmountChange,
  wahRateHz = 2.2,
  onWahRateHzChange,
  drive = 0.3,
  onDriveChange,
  distortion = 0.22,
  onDistortionChange,
  glideMs = GROOVE_LAB_RNB_SINE_GLIDE_MS,
  onGlideMsChange,
  lfoRateHz = GROOVE_LAB_RNB_SINE_LFO_RATE_HZ,
  onLfoRateHzChange,
  lfoDepthCents = GROOVE_LAB_RNB_SINE_LFO_DEPTH_CENTS,
  onLfoDepthCentsChange,
  melodyGridEnabled = true,
  onMelodyGridEnabledChange,
  riffGridEnabled = false,
  onRiffGridEnabledChange,
  linkedChordVolume = 0.75,
  onLinkedChordVolumeChange,
  onGeneratePart,
  onLockChords,
  chordColumnCount,
  melodyNoteCount,
  melodyLayerNoteCount = 0,
  onClearAllMelody,
  onMelodyOctaveDown,
  onMelodyOctaveUp,
}: GrooveLabComposerPanelProps) {
  const chordBrand = grooveBranding ? 'Groove' : 'Orchid';
  const hasChords = chordColumnCount > 0;
  const disabled = !hasChords;
  const [soundGroups, setSoundGroups] = useState(() => [...GROOVE_LAB_LEAD_SOUND_GROUPS]);

  useEffect(() => {
    void loadGuitarLickManifest().then(() => {
      const sampleGroup = getGrooveLabSampleLickGroup();
      if (sampleGroup.ids.length === 0) return;
      setSoundGroups([...GROOVE_LAB_LEAD_SOUND_GROUPS, sampleGroup]);
    });
  }, []);

  const leadSoundLabel = (id: GrooveLabAnyLeadSoundId): string => {
    const synth = GROOVE_LAB_LEAD_SOUNDS.find((x) => x.id === id);
    return synth?.label ?? grooveLabSampleLickLabel(id) ?? id;
  };

  return (
    <div
      style={{
        padding: '6px 10px 8px',
        borderBottom: '1px solid #1a2e22',
        background: '#060a10',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5, color: '#fbbf24' }}>
          MELODY & RIFFS
        </span>
        <span style={{ fontSize: 7, color: '#a78bfa', fontWeight: 800 }}>
          follows green chords · {GROOVE_LAB_REGISTER_LABELS.melody} lead lane
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6b7280' }}>
          SOUND
          <select
            value={melodySoundId}
            onChange={(e) => onMelodySoundChange(e.target.value as GrooveLabAnyLeadSoundId)}
            style={selectStyle}
            title="Melody / riff preview timbre"
          >
            {soundGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.ids.map((id) => (
                  <option key={id} value={id}>
                    {leadSoundLabel(id)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8, color: '#6b7280' }}>
          COMPLEXITY
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(complexity * 100)}
            onChange={(e) => onComplexityChange(Number(e.target.value) / 100)}
            style={{ width: 72, accentColor: '#fbbf24' }}
          />
          <span style={{ color: '#fbbf24', fontWeight: 800, minWidth: 24 }}>{Math.round(complexity * 100)}%</span>
        </label>
        <button
          type="button"
          onClick={() => onMelodyGridEnabledChange?.(!melodyGridEnabled)}
          style={{
            ...btnStyle(melodyGridEnabled ? '#fde68a' : '#9ca3af', melodyGridEnabled ? '#ca8a04aa' : '#374151'),
            padding: '3px 8px',
            fontSize: 7,
          }}
          title={
            melodyGridEnabled
              ? 'Fast subdivided melody (uses MELODY RATE below)'
              : 'Simple melody — one note per chord, no 16th runs'
          }
        >
          MELODY GRID {melodyGridEnabled ? 'ON' : 'OFF'}
        </button>
        {melodyGridEnabled ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6b7280' }}>
            MELODY RATE
            <select
              value={melodyRate}
              onChange={(e) => onMelodyRateChange?.(e.target.value as GrooveLabQuantize)}
              style={selectStyle}
              title="Subdivision when you press MELODY"
            >
              {GROOVE_LAB_QUANTIZE_OPTIONS.map((q) => (
                <option key={`melody-${q}`} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => onRiffGridEnabledChange?.(!riffGridEnabled)}
          style={{
            ...btnStyle(riffGridEnabled ? '#fcd34d' : '#9ca3af', riffGridEnabled ? '#eab308aa' : '#374151'),
            padding: '3px 8px',
            fontSize: 7,
          }}
          title="Enable riff generator subdivisions"
        >
          RIFF GRID {riffGridEnabled ? 'ON' : 'OFF'}
        </button>
        {riffGridEnabled ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6b7280' }}>
            RIFF RATE
            <select
              value={riffRate}
              onChange={(e) => onRiffRateChange?.(e.target.value as GrooveLabQuantize)}
              style={selectStyle}
              title="Subdivision when you press RIFF"
            >
              {GROOVE_LAB_QUANTIZE_OPTIONS.map((q) => (
                <option key={`riff-${q}`} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6b7280' }}>
          ARP RATE
          <select
            value={arpRate}
            onChange={(e) => onArpRateChange?.(e.target.value as GrooveLabQuantize)}
            style={selectStyle}
            title="Arpeggio note rate"
          >
            {GROOVE_LAB_QUANTIZE_OPTIONS.map((q) => (
              <option key={`arp-${q}`} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>
      </div>

      {GROOVE_LAB_RNB_SINE_UI_ENABLED ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 6,
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid #422006',
          background: '#0a0e14',
        }}
      >
        <span style={{ fontSize: 7, fontWeight: 900, color: '#d97706', letterSpacing: 0.4 }}>
          R&B SINE
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#9ca3af' }}>
          GLIDE
          <input
            type="range"
            min={0}
            max={480}
            value={Math.round(glideMs)}
            onChange={(e) => onGlideMsChange?.(Number(e.target.value))}
            style={{ width: 88, accentColor: '#fbbf24' }}
            title="Portamento — slides pitch between melody notes (80s/90s urban sine lead)"
          />
          <span style={{ color: '#fde68a', minWidth: 34 }}>{Math.round(glideMs)}ms</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#9ca3af' }}>
          VIB RATE
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={Math.round(lfoRateHz * 10)}
            onChange={(e) => onLfoRateHzChange?.(Number(e.target.value) / 10)}
            style={{ width: 72, accentColor: '#c4b5fd' }}
            title="Pitch LFO speed (Hz) — ~5 Hz is classic R&B vibrato"
          />
          <span style={{ color: '#e9d5ff', minWidth: 28 }}>{lfoRateHz.toFixed(1)}Hz</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#9ca3af' }}>
          VIB DEPTH
          <input
            type="range"
            min={0}
            max={24}
            value={Math.round(lfoDepthCents)}
            onChange={(e) => onLfoDepthCentsChange?.(Number(e.target.value))}
            style={{ width: 72, accentColor: '#c4b5fd' }}
            title="Vibrato depth in cents — subtle 7–12 for silk urban lead"
          />
          <span style={{ color: '#e9d5ff', minWidth: 22 }}>{Math.round(lfoDepthCents)}¢</span>
        </label>
        <button
          type="button"
          onClick={() => {
            onMelodySoundChange('sinePureLead');
            onGlideMsChange?.(GROOVE_LAB_RNB_SINE_GLIDE_MS);
            onLfoRateHzChange?.(GROOVE_LAB_RNB_SINE_LFO_RATE_HZ);
            onLfoDepthCentsChange?.(GROOVE_LAB_RNB_SINE_LFO_DEPTH_CENTS);
          }}
          style={btnStyle('#fde68a', '#ca8a04aa')}
          title="R&B sine lead — mono glide + triangle warmth + ~5 Hz vibrato (Jodeci / Pure Sine style)"
        >
          80s/90s R&B
        </button>
      </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGeneratePart('melody')}
          style={{
            ...btnStyle('#fde68a', '#ca8a04aa'),
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          title="Lead melody from chord timeline"
        >
          MELODY
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGeneratePart('riff')}
          style={{
            ...btnStyle('#fcd34d', '#eab308aa'),
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          title="Guitar-style rhythmic cells"
        >
          RIFF
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGeneratePart('arp')}
          style={{
            ...btnStyle('#fbbf24', '#d97706aa'),
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          title="Chord-tone arpeggio fills"
        >
          ARP
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGeneratePart('melody')}
          style={{
            ...btnStyle('#a78bfa', '#7c3aed88'),
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 7,
          }}
          title="New seed — regenerates melody"
        >
          VARIATION
        </button>
        {onMelodyOctaveDown && onMelodyOctaveUp ? (
          <GrooveOctaveShiftButtons
            layerLabel="LEAD"
            accentColor="#fbbf24"
            borderColor="#d97706"
            noteCount={melodyLayerNoteCount}
            onOctaveDown={onMelodyOctaveDown}
            onOctaveUp={onMelodyOctaveUp}
            downTitle="All amber melody / riff notes — down one octave"
            upTitle="All amber melody / riff notes — up one octave"
          />
        ) : null}
        {onClearAllMelody ? (
          <button
            type="button"
            disabled={melodyLayerNoteCount === 0}
            onClick={onClearAllMelody}
            style={{
              ...btnStyle('#fbbf24', '#b45309aa'),
              opacity: melodyLayerNoteCount === 0 ? 0.45 : 1,
              cursor: melodyLayerNoteCount === 0 ? 'not-allowed' : 'pointer',
              fontSize: 7,
            }}
            title="Remove all amber melody / riff / arp notes from every channel — keeps green chords"
          >
            ERASE ALL MELODY{melodyLayerNoteCount > 0 ? ` (${melodyLayerNoteCount})` : ''}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onLockChords}
          style={btnStyle('#86efac', '#22c55e66')}
          title={`Adds green chord stacks from ${chordBrand} — optional after you have a bass column`}
        >
          MATCH CHORDS ←
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 8, color: '#4b5563', lineHeight: 1.35 }}>
        <strong style={{ color: '#fbbf24' }}>Amber lane</strong> = multi-note phrases from{' '}
        <strong style={{ color: '#4ade80' }}>green chords</strong> ({chordColumnCount} col
        {chordColumnCount === 1 ? '' : 's'}). {melodyNoteCount} melody hit
        {melodyNoteCount === 1 ? '' : 's'}. Drop chords first, then MELODY / RIFF / ARP — use VARIATION for a new phrase.
        Production bass → <strong style={{ color: '#a78bfa' }}>Beat Lab NEW SYNTH</strong> (Send from export strip).
      </p>
    </div>
  );
}
