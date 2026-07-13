import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.35)';

export type GrooveLabBeatLabPadPickerProps = {
  open: boolean;
  busy?: boolean;
  title?: string;
  onPick: (padIndex: number) => void;
  onCancel: () => void;
};

function padBtn(busy: boolean): CSSProperties {
  return {
    borderRadius: 6,
    border: `1px solid ${MINT_DIM}`,
    background: 'rgba(124, 244, 198, 0.08)',
    color: MINT,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontWeight: 900,
    fontSize: 12,
    cursor: busy ? 'wait' : 'pointer',
    letterSpacing: 0.4,
    minHeight: 36,
    transition: 'background 120ms ease, box-shadow 120ms ease',
  };
}

export function GrooveLabBeatLabPadPicker({
  open,
  busy = false,
  title = 'Choose Beat Lab sampler pad',
  onPick,
  onCancel,
}: GrooveLabBeatLabPadPickerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 14000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.72)',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: 'rgba(10, 10, 14, 0.98)',
          border: `1px solid ${MINT_DIM}`,
          borderRadius: 10,
          padding: '14px 16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.75), 0 0 0 1px rgba(124,244,198,0.08) inset',
          maxWidth: '100%',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 1.2,
            color: '#fde68a',
            marginBottom: 4,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 9, color: '#8a8a98', lineHeight: 1.4 }}>
          Pads 1–16 match Beat Lab sampler lanes. Existing samples on that pad are replaced.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 44px)',
            gridTemplateRows: 'repeat(4, 40px)',
            gap: 6,
          }}
        >
          {Array.from({ length: 16 }, (_, i) => i).map((padIndex) => (
            <button
              key={padIndex}
              type="button"
              disabled={busy}
              onClick={() => onPick(padIndex)}
              title={`Load onto pad ${padIndex + 1}`}
              style={padBtn(busy)}
              onMouseEnter={(e) => {
                if (busy) return;
                e.currentTarget.style.background = 'rgba(124, 244, 198, 0.22)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(124, 244, 198, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(124, 244, 198, 0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {padIndex + 1}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              background: '#2c2c2c',
              color: '#9ca3af',
              border: '1px solid #333',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 9,
              fontWeight: 800,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
