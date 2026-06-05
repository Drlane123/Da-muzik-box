import type { CSSProperties } from 'react';

const MS_BTN = (active: boolean, accent: string, kind: 'mute' | 'solo'): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '3px 0',
  borderRadius: 4,
  border: `1px solid ${active ? accent : '#3f3f46'}`,
  background: active
    ? kind === 'mute'
      ? `color-mix(in srgb, ${accent} 22%, #1a1a22)`
      : `color-mix(in srgb, ${accent} 32%, #1a1a22)`
    : '#14141a',
  color: active ? accent : '#71717a',
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: '0.06em',
  lineHeight: 1,
  cursor: 'pointer',
});

export type Lab808MuteSoloButtonsProps = {
  muted: boolean;
  solo: boolean;
  accent: string;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
  /** e.g. "Kick/Bass" or "Drums" — used in aria-label only */
  bankLabel: string;
};

export function Lab808MuteSoloButtons({
  muted,
  solo,
  accent,
  onMuteToggle,
  onSoloToggle,
  bankLabel,
}: Lab808MuteSoloButtonsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 3,
        width: '100%',
        flexShrink: 0,
      }}
      role="group"
      aria-label={`${bankLabel} mute and solo`}
    >
      <button
        type="button"
        onClick={onMuteToggle}
        aria-pressed={muted}
        aria-label={`Mute ${bankLabel}`}
        title={`Mute ${bankLabel} (volume fader unchanged)`}
        style={MS_BTN(muted, '#f87171', 'mute')}
      >
        M
      </button>
      <button
        type="button"
        onClick={onSoloToggle}
        aria-pressed={solo}
        aria-label={`Solo ${bankLabel}`}
        title={`Solo ${bankLabel} — silence the other 808 bank`}
        style={MS_BTN(solo, accent, 'solo')}
      >
        S
      </button>
    </div>
  );
}
