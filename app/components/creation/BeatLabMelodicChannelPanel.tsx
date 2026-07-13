/**
 * CH 17–32: GM soundfont instrument picker + preview keyboard.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS,
  beatLabMelodicSlotIndex,
  startBeatLabMelodicPreview,
  subscribeBeatLabMelodicLoadProgress,
  warmupBeatLabMelodicSoundfont,
  type BeatLabMelodicInstrumentOption,
} from '../../lib/creationStation/beatLabMelodicSoundfont';
import { beatLabMelodicLanePitch } from '../../lib/creationStation/beatLabMidiRoll';
import {
  BEAT_LAB_BASS_SYNTH_PRESETS,
  beatLabBassSynthPresetById,
} from '../../lib/creationStation/beatLabMelodicSynthPresets';

const PREVIEW_KEYS: { midi: number; black?: boolean; label?: string }[] = [
  { midi: 60, label: 'C' },
  { midi: 61, black: true },
  { midi: 62, label: 'D' },
  { midi: 63, black: true },
  { midi: 64, label: 'E' },
  { midi: 65, label: 'F' },
  { midi: 66, black: true },
  { midi: 67, label: 'G' },
  { midi: 68, black: true },
  { midi: 69, label: 'A' },
  { midi: 70, black: true },
  { midi: 71, label: 'B' },
  { midi: 72, label: 'C' },
  { midi: 73, black: true },
  { midi: 74, label: 'D' },
  { midi: 75, black: true },
  { midi: 76, label: 'E' },
  { midi: 77, label: 'F' },
  { midi: 78, black: true },
  { midi: 79, label: 'G' },
  { midi: 80, black: true },
  { midi: 81, label: 'A' },
  { midi: 82, black: true },
  { midi: 83, label: 'B' },
  { midi: 84, label: 'C' },
];

export type BeatLabMelodicChannelPanelProps = {
  lane: number;
  instrumentId: string;
  synthPresetId: string;
  melodicInstruments: string[];
  channelVolumes: Record<number, number>;
  disabled?: boolean;
  getAudioContext: () => AudioContext;
  onInstrumentChange: (slotIndex: number, instrumentId: string) => void;
  onSynthPresetChange: (slotIndex: number, presetId: string) => void;
};

export function BeatLabMelodicChannelPanel({
  lane,
  instrumentId,
  synthPresetId,
  melodicInstruments,
  channelVolumes,
  disabled = false,
  getAudioContext,
  onInstrumentChange,
  onSynthPresetChange,
}: BeatLabMelodicChannelPanelProps) {
  const slot = beatLabMelodicSlotIndex(lane);
  const stopRef = useRef<(() => void) | null>(null);
  const [loadPct, setLoadPct] = useState<number | null>(null);

  useEffect(() => {
    return subscribeBeatLabMelodicLoadProgress((loaded, total) => {
      if (total <= 0) return;
      setLoadPct(Math.round((loaded / total) * 100));
    });
  }, []);

  useEffect(() => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => warmupBeatLabMelodicSoundfont(ctx, melodicInstruments));
    } else {
      void warmupBeatLabMelodicSoundfont(ctx, melodicInstruments);
    }
  }, [getAudioContext, melodicInstruments]);

  const groupedGmOptions = useMemo(() => {
    const groups = new Map<string, BeatLabMelodicInstrumentOption[]>();
    for (const opt of BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS) {
      const prev = groups.get(opt.group) ?? [];
      groups.set(opt.group, [...prev, opt]);
    }
    return [...groups.entries()];
  }, []);
  const synthPreset = useMemo(() => beatLabBassSynthPresetById(synthPresetId), [synthPresetId]);

  const stopPreview = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const playPreviewMidi = useCallback(
    (midi: number) => {
      if (disabled) return;
      stopPreview();
      const ctx = getAudioContext();
      void ctx.resume().then(() => {
        void startBeatLabMelodicPreview(ctx, {
          lane,
          midi,
          velocity: 100,
          when: ctx.currentTime + 0.01,
          durationSec: 3,
          channelVolumes,
          instrumentId,
        }).then((stop) => {
          stopRef.current = stop;
        });
      });
    },
    [channelVolumes, disabled, getAudioContext, instrumentId, lane, stopPreview],
  );

  useEffect(() => () => stopPreview(), [stopPreview]);

  return (
    <div
      style={{
        borderTop: '1px solid rgba(124, 244, 198, 0.2)',
        paddingTop: 6,
        marginTop: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            color: '#00E5FF',
            letterSpacing: 0.6,
            flexShrink: 0,
          }}
        >
          CH {lane + 1} · MELODIC
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 160px', minWidth: 0 }}>
          <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>Sound</span>
          <select
            disabled={disabled}
            value={instrumentId}
            onChange={(e) => onInstrumentChange(slot, e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 9,
              fontWeight: 700,
              padding: '3px 4px',
              borderRadius: 4,
              border: '1px solid #2a2a34',
              background: '#0a0a0e',
              color: '#e8e8f0',
            }}
          >
            {groupedGmOptions.map(([group, opts]) => (
              <optgroup key={group} label={group}>
                {opts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 190px', minWidth: 0 }}>
          <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>Bass Synth</span>
          <select
            disabled={disabled}
            value={synthPresetId}
            onChange={(e) => onSynthPresetChange(slot, e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 9,
              fontWeight: 700,
              padding: '3px 4px',
              borderRadius: 4,
              border: '1px solid #2a2a34',
              background: '#0a0a0e',
              color: '#e8e8f0',
            }}
          >
            {BEAT_LAB_BASS_SYNTH_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category})
              </option>
            ))}
          </select>
        </label>
        {loadPct != null && loadPct < 100 ? (
          <span style={{ fontSize: 7, color: '#9ca3af', fontWeight: 700 }}>Loading {loadPct}%</span>
        ) : (
          <span style={{ fontSize: 7, color: '#5a6a78', fontWeight: 700 }}>
            MusyngKite GM · Bass preset: {synthPreset.name}
          </span>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          height: 52,
          borderRadius: 6,
          background: 'linear-gradient(180deg, #121218 0%, #18181e 100%)',
          border: '1px solid #1e1e28',
          padding: '4px 6px 6px',
          userSelect: 'none',
        }}
        onMouseLeave={stopPreview}
        onPointerLeave={stopPreview}
      >
        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          {PREVIEW_KEYS.filter((k) => !k.black).map((k) => (
            <button
              key={k.midi}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                playPreviewMidi(k.midi);
              }}
              style={{
                width: 16,
                height: 40,
                borderRadius: '0 0 3px 3px',
                border: '1px solid #2a2a36',
                background: 'linear-gradient(180deg, #f0f0f8 0%, #c8c8d8 100%)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
              title={`${k.label ?? ''} (preview)`}
            />
          ))}
          {PREVIEW_KEYS.filter((k) => k.black).map((k, i) => (
            <button
              key={k.midi}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                playPreviewMidi(k.midi);
              }}
              style={{
                position: 'absolute',
                bottom: 22,
                left: 8 + i * 16 + (i >= 5 ? 16 : 0),
                width: 10,
                height: 24,
                borderRadius: '0 0 2px 2px',
                border: '1px solid #0a0a0e',
                background: 'linear-gradient(180deg, #3a3a48 0%, #1a1a24 100%)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: 0,
                zIndex: 2,
              }}
              title="Sharp (preview)"
            />
          ))}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 7,
            color: '#6a6a78',
            textAlign: 'center',
            fontWeight: 700,
          }}
        >
          Preview keyboard · base pitch {beatLabMelodicLanePitch(lane)} (MIDI)
        </div>
      </div>
    </div>
  );
}
