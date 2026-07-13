import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import {
  indexTrapKitFromFiles,
  trapKitInstrumentLabel,
  type TrapKitCategory,
} from '@/app/lib/creationStation/trapKitBrowser';
import { CREATION_PAD_NAMES } from '@/app/lib/sessionChannelTracks';
import { BeatLabHelpTip } from '@/app/components/creation/BeatLabHelpHub';

export interface TrapKitBrowserPanelProps {
  open: boolean;
  files: File[];
  bankLabel: string;
  targetPad: number;
  onTargetPadChange: (pad: number) => void;
  onClose: () => void;
  onLoadSample: (file: File, pad: number, label: string) => void;
  onPreviewSample?: (file: File) => void;
}

export function TrapKitBrowserPanel({
  open,
  files,
  bankLabel,
  targetPad,
  onTargetPadChange,
  onClose,
  onLoadSample,
  onPreviewSample,
}: TrapKitBrowserPanelProps) {
  const categories = useMemo(() => indexTrapKitFromFiles(files), [files]);
  const [catId, setCatId] = useState<string | null>(null);

  useEffect(() => {
    if (open && categories[0]) setCatId(categories[0].id);
  }, [open, files, categories]);

  const activeCat: TrapKitCategory | undefined = useMemo(() => {
    if (categories.length === 0) return undefined;
    if (catId) return categories.find((c) => c.id === catId) ?? categories[0];
    return categories[0];
  }, [categories, catId]);

  if (!open || categories.length === 0) return null;

  const loadToPad = (pad: number, file: File, title: string) => {
    onLoadSample(file, pad, trapKitInstrumentLabel(pad, title));
  };

  return (
    <div
      role="dialog"
      aria-label="Trap kit browser"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(920px, 96vw)',
          maxHeight: 'min(640px, 90vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#1e1e26',
          border: '1px solid rgba(255, 200, 80, 0.35)',
          borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid #1e1e28',
            background: 'linear-gradient(180deg, #14120c 0%, #1e1e26 100%)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 900, color: '#ffd966', letterSpacing: 0.5 }}>
            KIT BROWSER
            <BeatLabHelpTip tab="kits" title="How to use Kit browser" />
          </span>
          <span style={{ fontSize: 10, color: '#8a8a9a', fontWeight: 600 }}>
            {categories.length} folders · {files.length} samples · bank {bankLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#aaa',
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid #1a1a22',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 800, color: '#6a6a78' }}>LOAD TO PAD</span>
          <select
            value={targetPad}
            onChange={(e) => onTargetPadChange(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #3a3020',
              background: '#1a1a24',
              color: '#f0e6c8',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {CREATION_PAD_NAMES.map((name, i) => (
              <option key={i} value={i}>
                {i + 1}. {name}
              </option>
            ))}
          </select>
          {activeCat ? (
            <button
              type="button"
              onClick={() => {
                onTargetPadChange(activeCat.defaultPad);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: '#1e1e26',
                color: '#7cf4c6',
                fontSize: 9,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Use {activeCat.name} default (pad {activeCat.defaultPad + 1})
            </button>
          ) : null}
          <span style={{ fontSize: 9, color: '#6a6a78', flex: '1 1 200px' }}>
            Click a sound to load it on the selected pad — pick any 808, clap, hat, or kick you want.
          </span>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div
            style={{
              width: 168,
              flexShrink: 0,
              overflowY: 'auto',
              borderRight: '1px solid #1a1a22',
              padding: '6px 4px',
            }}
          >
            {categories.map((c) => {
              const on = activeCat?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatId(c.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    marginBottom: 2,
                    borderRadius: 4,
                    border: `1px solid ${on ? 'rgba(255, 200, 80, 0.5)' : 'transparent'}`,
                    background: on ? 'rgba(255, 200, 80, 0.12)' : 'transparent',
                    color: on ? '#ffd966' : '#bbb',
                    fontSize: 10,
                    fontWeight: on ? 900 : 700,
                    cursor: 'pointer',
                  }}
                >
                  {c.name}
                  <span style={{ display: 'block', fontSize: 8, color: '#6a6a78', fontWeight: 600 }}>
                    {c.samples.length} · pad {c.defaultPad + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {activeCat ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 4,
                }}
              >
                {activeCat.samples.map((s) => (
                  <button
                    key={`${s.name}-${s.title}`}
                    type="button"
                    title={`Load on pad ${targetPad + 1} · double-click preview`}
                    onClick={() => loadToPad(targetPad, s.file, s.title)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      onPreviewSample?.(s.file);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: 4,
                      border: '1px solid #2a2a32',
                      background: '#12121a',
                      color: '#ddd',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      lineHeight: 1.3,
                    }}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
