import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { SynthRoundKnob } from '@/app/components/creation/BeatLabSynthV2Knob';
import type { GrooveLabGuitarFxSettings } from '@/app/lib/creationStation/grooveLabGuitarFx';

const GUITAR_ACCENT = '#fbbf24';
const GUITAR_ACCENT_HI = '#fde68a';
const GUITAR_BORDER = '#422006';
const VIEWPORT_PAD = 6;
const DROPDOWN_W = 168;
const DROPDOWN_MAX_H = 380;

export type GrooveLabGuitarFxStripProps = {
  fx: GrooveLabGuitarFxSettings;
  onWahAmountChange: (v: number) => void;
  onWahRateHzChange: (v: number) => void;
  onFilterCutoffHzChange: (v: number) => void;
  onLowCutHzChange?: (v: number) => void;
  onHighCutHzChange?: (v: number) => void;
  onDriveChange: (v: number) => void;
  onDistortionChange: (v: number) => void;
  onLfoRateHzChange: (v: number) => void;
  onLfoDepthCentsChange: (v: number) => void;
  onGlideMsChange: (v: number) => void;
};

function computeDropdownPosition(anchor: DOMRect): { top: number; left: number } {
  const gap = 4;
  let left = anchor.left;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - DROPDOWN_W - VIEWPORT_PAD));
  let top = anchor.bottom + gap;
  if (top + DROPDOWN_MAX_H > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, anchor.top - gap - DROPDOWN_MAX_H);
  }
  return { top, left };
}

const knobCell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

/** Compact tab — opens dropdown with guitar macro knobs (saves chord-strip height). */
export function GrooveLabGuitarFxStrip({
  fx,
  onWahAmountChange,
  onWahRateHzChange,
  onFilterCutoffHzChange,
  onLowCutHzChange,
  onHighCutHzChange,
  onDriveChange,
  onDistortionChange,
  onLfoRateHzChange,
  onLfoDepthCentsChange,
  onGlideMsChange,
}: GrooveLabGuitarFxStripProps) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const repositionPanel = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    setPanelPos(computeDropdownPosition(btn.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    repositionPanel();
    window.addEventListener('resize', repositionPanel);
    window.addEventListener('scroll', repositionPanel, true);
    return () => {
      window.removeEventListener('resize', repositionPanel);
      window.removeEventListener('scroll', repositionPanel, true);
    };
  }, [open, repositionPanel]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const menu =
    open && typeof document !== 'undefined' ? (
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: panelPos.top,
          left: panelPos.left,
          width: DROPDOWN_W,
          maxHeight: DROPDOWN_MAX_H,
          overflowY: 'auto',
          zIndex: 10050,
          background: '#0a0908',
          border: `1px solid ${GUITAR_BORDER}`,
          borderRadius: 6,
          padding: '6px 4px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
        }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 7,
            fontWeight: 900,
            color: '#78716c',
            letterSpacing: 0.5,
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          GUITAR MACROS
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 2px',
            justifyItems: 'center',
          }}
        >
          <div style={knobCell}>
            <SynthRoundKnob
              label="WAH"
              value={fx.wahAmount}
              min={0}
              max={1}
              onChange={onWahAmountChange}
              size={30}
              accent={GUITAR_ACCENT}
            />
          </div>
          <div style={knobCell}>
            <SynthRoundKnob
              label="WAH RT"
              value={fx.wahRateHz}
              min={0.2}
              max={8}
              decimals={1}
              unit="Hz"
              onChange={onWahRateHzChange}
              size={30}
              accent={GUITAR_ACCENT_HI}
            />
          </div>
          <div style={knobCell}>
            <SynthRoundKnob
              label="CUT"
              value={fx.filterCutoffHz}
              min={900}
              max={14000}
              decimals={0}
              unit="Hz"
              onChange={onFilterCutoffHzChange}
              size={30}
              accent={GUITAR_ACCENT_HI}
            />
          </div>
          <div style={knobCell}>
            <SynthRoundKnob
              label="LO CUT"
              value={fx.lowCutHz}
              min={20}
              max={800}
              decimals={0}
              unit="Hz"
              onChange={onLowCutHzChange}
              size={30}
              accent="#a8a29e"
            />
          </div>
          <div style={knobCell}>
            <SynthRoundKnob
              label="HI CUT"
              value={fx.highCutHz}
              min={400}
              max={18000}
              decimals={0}
              unit="Hz"
              onChange={onHighCutHzChange}
              size={30}
              accent="#d6d3d1"
            />
          </div>
          <div style={knobCell}>
            <SynthRoundKnob
              label="DRIVE"
              value={fx.drive}
              min={0}
              max={1}
              onChange={onDriveChange}
              size={30}
              accent="#f59e0b"
            />
          </div>
          <div style={knobCell}>
            <SynthRoundKnob
              label="DIST"
              value={fx.distortion}
              min={0}
              max={1}
              onChange={onDistortionChange}
              size={30}
              accent="#ea580c"
            />
          </div>
          <div style={knobCell}>
            <SynthRoundKnob
              label="LFO"
              value={fx.leadLfoRateHz}
              min={0}
              max={12}
              decimals={1}
              unit="Hz"
              onChange={onLfoRateHzChange}
              size={30}
              accent="#c4b5fd"
            />
          </div>
          <div style={knobCell}>
            <SynthRoundKnob
              label="VIB"
              value={fx.leadLfoDepthCents}
              min={0}
              max={48}
              decimals={0}
              unit="¢"
              onChange={onLfoDepthCentsChange}
              size={30}
              accent="#a78bfa"
            />
          </div>
          <div style={{ ...knobCell, gridColumn: '1 / -1' }}>
            <SynthRoundKnob
              label="GLIDE"
              value={fx.glideMs}
              min={0}
              max={480}
              decimals={0}
              unit="ms"
              onChange={onGlideMsChange}
              size={30}
              accent={GUITAR_ACCENT}
            />
          </div>
        </div>
      </div>
    ) : null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) requestAnimationFrame(repositionPanel);
            return next;
          });
        }}
        title="Guitar wah, EQ cuts, drive, LFO — click to open macros"
        style={{
          background: open ? '#2a2410' : '#14120e',
          color: open ? '#fbbf24' : '#9ca3af',
          border: `1px solid ${open ? '#f59e0b88' : '#3d3428'}`,
          borderRadius: 5,
          padding: '3px 8px',
          fontSize: 8,
          fontWeight: 900,
          cursor: 'pointer',
          letterSpacing: 0.25,
        }}
      >
        GUITAR FX ▾
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </span>
  );
}
