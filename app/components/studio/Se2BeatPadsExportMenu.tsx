'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  useSe2BeatPadsExportBridge,
  type Se2BeatPadsLaneExportFormat,
} from '@/app/components/studio/Se2BeatPadsExportContext';

const MINT = '#7cf4c6';

const btnBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 24,
  padding: '0 7px',
  borderRadius: 4,
  border: '1px solid rgba(124, 244, 198, 0.28)',
  background: 'rgba(124, 244, 198, 0.06)',
  color: '#b8c4bc',
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

export type Se2BeatPadsExportMenuProps = {
  accentHex?: string;
};

export function Se2BeatPadsExportMenu({ accentHex = MINT }: Se2BeatPadsExportMenuProps) {
  const bridge = useSe2BeatPadsExportBridge();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<readonly boolean[]>(() => Array(16).fill(true));
  const rootRef = useRef<HTMLDivElement>(null);

  const padLabels = bridge?.padLabels ?? Array.from({ length: 16 }, (_, i) => `Pad ${i + 1}`);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectedLanes = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      if (selected[i]) out.push(i);
    }
    return out;
  }, [selected]);

  const togglePad = useCallback((index: number) => {
    setSelected((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const setAll = useCallback((value: boolean) => {
    setSelected(Array(16).fill(value));
  }, []);

  const runExport = useCallback(
    (format: Se2BeatPadsLaneExportFormat) => {
      if (!bridge?.runLaneExport) return;
      if (selectedLanes.length === 0) return;
      void bridge.runLaneExport({ lanes: selectedLanes, format });
      setOpen(false);
    },
    [bridge, selectedLanes],
  );

  if (!bridge) return null;

  const disabled = bridge.disabled === true;

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...btnBase,
          opacity: disabled ? 0.45 : 1,
          borderColor: open ? `${accentHex}88` : 'rgba(124, 244, 198, 0.28)',
          color: open ? accentHex : '#b8c4bc',
          background: open ? `${accentHex}18` : 'rgba(124, 244, 198, 0.06)',
        }}
        title="Export selected pads to individual SE2 tracks (WAV and/or MIDI)"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Export ▾
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 40,
            width: 248,
            padding: 8,
            borderRadius: 6,
            border: `1px solid ${accentHex}44`,
            background: 'rgba(6, 8, 12, 0.98)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 8, fontWeight: 800, color: accentHex, letterSpacing: 0.5 }}>
              PADS → SE2 TRACKS
            </span>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <button type="button" onClick={() => setAll(true)} style={miniLink}>
                All
              </button>
              <button type="button" onClick={() => setAll(false)} style={miniLink}>
                None
              </button>
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              maxHeight: 168,
              overflowY: 'auto',
              marginBottom: 8,
              paddingRight: 2,
            }}
          >
            {padLabels.map((label, i) => (
              <label
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 9,
                  fontWeight: 600,
                  color: selected[i] ? '#e8e8f0' : '#7a8290',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!selected[i]}
                  onChange={() => togglePad(i)}
                  style={{ accentColor: accentHex, width: 12, height: 12 }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i + 1}. {label}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="button"
              disabled={disabled || selectedLanes.length === 0}
              onClick={() => runExport('wav')}
              style={actionBtn(accentHex, '#ffd966')}
            >
              WAV → SE2 tracks
            </button>
            <button
              type="button"
              disabled={disabled || selectedLanes.length === 0}
              onClick={() => runExport('midi')}
              style={actionBtn(accentHex, '#c4b5fd')}
            >
              MIDI → SE2 tracks
            </button>
            <button
              type="button"
              disabled={disabled || selectedLanes.length === 0}
              onClick={() => runExport('both')}
              style={actionBtn(accentHex, '#00E5FF')}
            >
              WAV + MIDI → SE2 tracks
            </button>
          </div>
          {bridge.exportStatus ? (
            <p style={{ margin: '6px 0 0', fontSize: 8, fontWeight: 700, color: '#9aa3b0', lineHeight: 1.3 }}>
              {bridge.exportStatus}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const miniLink: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#9aa3b0',
  fontSize: 8,
  fontWeight: 700,
  cursor: 'pointer',
  padding: 0,
};

function actionBtn(accentHex: string, color: string): CSSProperties {
  return {
    ...btnBase,
    width: '100%',
    justifyContent: 'center',
    height: 26,
    borderColor: `${accentHex}44`,
    color,
    background: 'rgba(255,255,255,0.03)',
  };
}
