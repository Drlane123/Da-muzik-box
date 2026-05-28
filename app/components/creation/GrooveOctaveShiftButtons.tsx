import type { CSSProperties } from 'react';

export interface GrooveOctaveShiftButtonsProps {
  layerLabel: string;
  accentColor: string;
  borderColor: string;
  noteCount: number;
  onOctaveDown: () => void;
  onOctaveUp: () => void;
  downTitle?: string;
  upTitle?: string;
}

const btnStyle = (
  accent: string,
  border: string,
  disabled: boolean,
): CSSProperties => ({
  background: disabled ? '#111' : '#0d1218',
  color: disabled ? '#4b5563' : accent,
  border: `1px solid ${disabled ? '#1a1a1a' : border}`,
  borderRadius: 5,
  padding: '2px 7px',
  fontSize: 8,
  fontWeight: 900,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
});

export function GrooveOctaveShiftButtons({
  layerLabel,
  accentColor,
  borderColor,
  noteCount,
  onOctaveDown,
  onOctaveUp,
  downTitle = 'Down one octave',
  upTitle = 'Up one octave',
}: GrooveOctaveShiftButtonsProps) {
  const disabled = noteCount === 0;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 5px',
        borderRadius: 5,
        border: `1px solid ${borderColor}44`,
        background: '#0a0e12',
      }}
      title={`Move ${layerLabel} notes up or down one octave`}
    >
      <span style={{ fontSize: 7, fontWeight: 800, color: accentColor }}>{layerLabel}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onOctaveDown}
        style={btnStyle(accentColor, borderColor, disabled)}
        title={downTitle}
      >
        OCT −
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onOctaveUp}
        style={btnStyle(accentColor, borderColor, disabled)}
        title={upTitle}
      >
        OCT +
      </button>
    </div>
  );
}
