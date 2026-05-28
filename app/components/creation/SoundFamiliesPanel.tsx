import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  BUILTIN_SOUND_FAMILIES_SUBTITLE,
  BUILTIN_SOUND_FAMILIES_TITLE,
  familyInstrumentLabel,
  fetchSoundFamiliesCatalog,
  primary808Family,
  type SoundFamiliesCatalog,
  type SoundFamily,
} from '@/app/lib/creationStation/soundFamiliesCatalog';
import { soundFamilySampleDisplayTitle } from '@/app/lib/creationStation/soundFamilySampleTitles';
import { CREATION_PAD_NAMES } from '@/app/lib/sessionChannelTracks';

export interface SoundFamiliesPanelProps {
  bankLabel: string;
  targetPad: number;
  onTargetPadChange: (pad: number) => void;
  onLoadSample: (args: {
    familyId: string;
    pad: number;
    label: string;
    relFile: string;
  }) => void;
  onLoadFamilyDefault?: (family: SoundFamily) => void;
}

export function SoundFamiliesPanel({
  bankLabel,
  targetPad,
  onTargetPadChange,
  onLoadSample,
  onLoadFamilyDefault,
}: SoundFamiliesPanelProps) {
  const [catalog, setCatalog] = useState<SoundFamiliesCatalog | null>(null);
  const [missing, setMissing] = useState(false);
  const [familyId, setFamilyId] = useState<string>('808-sub');

  useEffect(() => {
    void fetchSoundFamiliesCatalog().then((c) => {
      if (!c) {
        setMissing(true);
        return;
      }
      setCatalog(c);
      const primary = primary808Family(c);
      if (primary) setFamilyId(primary.id);
    });
  }, []);

  const activeFamily = useMemo(
    () => catalog?.families.find((f) => f.id === familyId) ?? catalog?.families[0],
    [catalog, familyId],
  );

  const loadSample = useCallback(
    (relFile: string, sampleIndex: number) => {
      if (!activeFamily) return;
      const pad = targetPad;
      const title = soundFamilySampleDisplayTitle(activeFamily.id, sampleIndex);
      onLoadSample({
        familyId: activeFamily.id,
        pad,
        label: familyInstrumentLabel(pad, title),
        relFile,
      });
    },
    [activeFamily, targetPad, onLoadSample],
  );

  if (missing) {
    return (
      <div style={{ fontSize: 9, color: '#f6a9a9', lineHeight: 1.4 }}>
        Built-in drum library is unavailable. Reinstall the app or contact support.
      </div>
    );
  }

  if (!catalog) {
    return <div style={{ fontSize: 9, color: '#6a6a78' }}>Loading sound families…</div>;
  }

  const primary = primary808Family(catalog);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 800, letterSpacing: 0.6 }}>
          SOUND FAMILIES
        </span>
        <span style={{ fontSize: 8, color: '#6a6a78', fontFamily: 'monospace' }} title={BUILTIN_SOUND_FAMILIES_SUBTITLE}>
          {BUILTIN_SOUND_FAMILIES_TITLE} · bank {bankLabel}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {catalog.families.map((f) => {
          const on = f.id === familyId;
          const is808 = f.id === '808-sub';
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFamilyId(f.id)}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                border: `1px solid ${on ? (is808 ? 'rgba(255, 200, 80, 0.65)' : 'rgba(52, 211, 153, 0.55)') : 'rgba(45, 212, 191, 0.22)'}`,
                background: on
                  ? is808
                    ? 'rgba(255, 200, 80, 0.18)'
                    : 'rgba(15, 50, 40, 0.85)'
                  : 'rgba(15, 30, 28, 0.5)',
                color: on ? (is808 ? '#ffd966' : '#a7f3d0') : '#7a9a8a',
                fontSize: 8,
                fontWeight: on ? 900 : 700,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {f.label}
              <span style={{ opacity: 0.75 }}> ({f.samples.length})</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: '#666', fontWeight: 700 }}>PAD</span>
        <select
          value={targetPad}
          onChange={(e) => onTargetPadChange(Number(e.target.value))}
          style={{
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid #2a3a32',
            background: '#0c1210',
            color: '#a7f3d0',
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          {CREATION_PAD_NAMES.map((name, i) => (
            <option key={i} value={i}>
              {i + 1}. {name}
            </option>
          ))}
        </select>
        {activeFamily ? (
          <button
            type="button"
            onClick={() => onTargetPadChange(activeFamily.defaultPad)}
            style={{
              padding: '2px 6px',
              fontSize: 8,
              fontWeight: 800,
              borderRadius: 4,
              border: '1px solid rgba(52, 211, 153, 0.35)',
              background: '#0a0f0e',
              color: '#6ee7b7',
              cursor: 'pointer',
            }}
          >
            Default pad {activeFamily.defaultPad + 1}
          </button>
        ) : null}
        {primary && activeFamily?.id === '808-sub' ? (
          <button
            type="button"
            onClick={() => onLoadFamilyDefault?.(primary)}
            style={{
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              borderRadius: 4,
              border: '1px solid rgba(255, 200, 80, 0.5)',
              background: 'rgba(40, 32, 8, 0.5)',
              color: '#ffd966',
              cursor: 'pointer',
            }}
            title="Load first sample from each family onto bank pads"
          >
            Load full bank
          </button>
        ) : null}
      </div>

      {activeFamily ? (
        <div
          style={{
            maxHeight: 88,
            overflowY: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            padding: '4px 0',
          }}
        >
          {activeFamily.samples.map((s, i) => (
            <button
              key={s.file}
              type="button"
              title={`Load on pad ${targetPad + 1}`}
              onClick={() => loadSample(s.file, i)}
              style={{
                padding: '3px 6px',
                borderRadius: 4,
                border: '1px solid #1e2e28',
                background: activeFamily.id === '808-sub' ? '#1a1810' : '#101820',
                color: activeFamily.id === '808-sub' ? '#f0e6c8' : '#b8c8d8',
                fontSize: 8,
                fontWeight: 600,
                cursor: 'pointer',
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {soundFamilySampleDisplayTitle(activeFamily.id, i)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
