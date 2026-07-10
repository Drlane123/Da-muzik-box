import { useState } from 'react';
import type { CSSProperties } from 'react';
import { X, Zap } from 'lucide-react';

import { CREATION_PAD_NAMES } from '@/app/lib/sessionChannelTracks';
import type { DrumKitGeneratorStyle } from '@/app/lib/creationStation/drumKitGenerator';

const STYLES: { id: DrumKitGeneratorStyle; label: string; hint: string }[] = [
  { id: 'house', label: 'House', hint: 'Four-on-the-floor kick, steady hats' },
  { id: 'trap', label: 'Trap', hint: 'Sparse kick, busy hats, backbeat snare' },
  { id: 'lofi', label: 'Lo-fi', hint: 'Softer kit + lighter 2 & 4 pocket' },
  { id: 'rnb', label: 'R&B', hint: 'Pocket kick, smooth 8th hats, 2 & 4 snare' },
  { id: 'dance', label: 'Dance', hint: 'Four-on-floor anthem, busy 16th hats' },
  { id: 'disco', label: 'Disco', hint: 'Classic floor kick, open hats on the &' },
];

export function DrumKitGeneratorModal({
  open,
  onClose,
  style,
  onStyleChange,
  busy,
  onApplySinglePad,
  onApplyFullKit,
  onApplyPattern,
  onApplyBoth,
}: {
  open: boolean;
  onClose: () => void;
  style: DrumKitGeneratorStyle;
  onStyleChange: (s: DrumKitGeneratorStyle) => void;
  busy: boolean;
  onApplySinglePad: (padIndex: number) => void | Promise<void>;
  onApplyFullKit: () => void | Promise<void>;
  onApplyPattern: () => void | Promise<void>;
  onApplyBoth: () => void | Promise<void>;
}) {
  const [singlePad, setSinglePad] = useState(0);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drum-kit-gen-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 12,
          border: '1px solid rgba(139, 92, 246, 0.35)',
          background: 'linear-gradient(165deg, #12101a 0%, #0a0a0f 100%)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={18} color="#fbbf24" aria-hidden />
            <div>
              <div id="drum-kit-gen-title" style={{ fontSize: 14, fontWeight: 800, color: '#f5f3ff' }}>
                Drum kit generator
              </div>
              <div style={{ fontSize: 10, color: '#7c7394', marginTop: 2 }}>
                Procedural one-shots + starter groove for the active bank → Beat Lab
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: 6,
              borderRadius: 8,
              border: '1px solid #333',
              background: '#151515',
              color: '#888',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '14px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b657d', marginBottom: 8, letterSpacing: 1 }}>
              STYLE
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onStyleChange(s.id)}
                  title={s.hint}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${style === s.id ? '#a78bfa' : '#2a2a32'}`,
                    background: style === s.id ? 'rgba(139, 92, 246, 0.22)' : '#111015',
                    color: style === s.id ? '#ede9fe' : '#8a8499',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              border: '1px solid #2a2a32',
              background: '#0e0e12',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b657d', marginBottom: 8, letterSpacing: 1 }}>
              SINGLE SOUND
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <label htmlFor="drum-kit-gen-pad" style={{ fontSize: 10, color: '#8a8499' }}>
                Pad
              </label>
              <select
                id="drum-kit-gen-pad"
                value={singlePad}
                disabled={busy}
                onChange={(e) => setSinglePad(Number(e.target.value))}
                style={{
                  flex: '1 1 160px',
                  minWidth: 0,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #333',
                  background: '#111',
                  color: '#e9d5ff',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {CREATION_PAD_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {i + 1}. {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onApplySinglePad(singlePad)}
                style={btnSingle(busy)}
              >
                {busy ? '…' : 'Generate sound'}
              </button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 10, lineHeight: 1.5, color: '#6b657d' }}>
              Replaces the sample on this pad only (active bank). Run again for a new random take.
            </p>
          </div>

          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: '#9a92ab' }}>
            <strong style={{ color: '#00ff88' }}>Full kit</strong> fills all 16 pads. <strong style={{ color: '#a78bfa' }}>Pattern</strong>{' '}
            lays a starter groove on the visible Beat Lab columns (existing steps in that range are replaced). Both use the
            active bank.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" disabled={busy} onClick={() => void onApplyFullKit()} style={btnPrimary(busy)}>
              {busy ? 'Working…' : 'Generate full kit (16 pads)'}
            </button>
            <button type="button" disabled={busy} onClick={() => void onApplyPattern()} style={btnSecondary(busy)}>
              Generate starter pattern only
            </button>
            <button type="button" disabled={busy} onClick={() => void onApplyBoth()} style={btnSecondary(busy)}>
              Generate full kit + pattern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function btnPrimary(busy: boolean): CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #fbbf2488',
    background: busy ? '#2a2418' : 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
    color: busy ? '#666' : '#1a1004',
    fontSize: 12,
    fontWeight: 800,
    cursor: busy ? 'not-allowed' : 'pointer',
  };
}

function btnSecondary(busy: boolean): CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #3f3f48',
    background: busy ? '#141418' : '#1a1822',
    color: busy ? '#555' : '#d4cff7',
    fontSize: 11,
    fontWeight: 700,
    cursor: busy ? 'not-allowed' : 'pointer',
  };
}

function btnSingle(busy: boolean): CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #00ff8866',
    background: busy ? '#0f1814' : 'rgba(0, 255, 136, 0.12)',
    color: busy ? '#555' : '#86efac',
    fontSize: 11,
    fontWeight: 800,
    cursor: busy ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
  };
}
