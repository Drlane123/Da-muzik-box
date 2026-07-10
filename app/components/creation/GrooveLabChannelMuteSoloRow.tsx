import type { CSSProperties } from 'react';
import {
  isGrooveLabChannelMuted,
  isGrooveLabChannelSolo,
  toggleGrooveLabChannelMute,
  toggleGrooveLabChannelSolo,
} from '@/app/lib/creationStation/grooveLabChannelMuteSolo';

const MS_MINI = (active: boolean, kind: 'mute' | 'solo', accent: string): CSSProperties => ({
  width: 13,
  height: 11,
  padding: 0,
  margin: 0,
  borderRadius: 2,
  border: `1px solid ${active ? (kind === 'mute' ? '#f87171' : accent) : '#3f3f46'}`,
  background: active
    ? kind === 'mute'
      ? 'rgba(248, 113, 113, 0.18)'
      : `color-mix(in srgb, ${accent} 28%, #14141a)`
    : '#101014',
  color: active ? (kind === 'mute' ? '#fca5a5' : accent) : '#52525b',
  fontSize: 6,
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  flexShrink: 0,
});

export type GrooveLabChannelMuteSoloRowProps = {
  ch: number;
  accent: string;
  /** Channel number typography (embed vs popup mixer). */
  chFontSize?: number;
  /** Re-render when mute/solo maps change. */
  msTick?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
};

export function GrooveLabChannelMuteSoloRow({
  ch,
  accent,
  chFontSize = 14,
  msTick: _msTick = 0,
  onPointerDown,
}: GrooveLabChannelMuteSoloRowProps) {
  void _msTick;
  const muted = isGrooveLabChannelMuted(ch);
  const solo = isGrooveLabChannelSolo(ch);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        width: '100%',
        lineHeight: 1,
      }}
      role="group"
      aria-label={`CH ${ch} mute and solo`}
    >
      <button
        type="button"
        aria-pressed={muted}
        aria-label={`Mute CH ${ch}`}
        title={`Mute CH ${ch} (fader unchanged)`}
        onPointerDown={onPointerDown}
        onClick={(e) => {
          e.stopPropagation();
          toggleGrooveLabChannelMute(ch);
        }}
        style={MS_MINI(muted, 'mute', accent)}
      >
        M
      </button>
      <span
        style={{
          fontSize: chFontSize,
          fontWeight: 900,
          color: accent,
          fontFamily: 'monospace',
          letterSpacing: 0.3,
          minWidth: chFontSize >= 13 ? 18 : 16,
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        {ch}
      </span>
      <button
        type="button"
        aria-pressed={solo}
        aria-label={`Solo CH ${ch}`}
        title={`Solo CH ${ch} — silence other lanes`}
        onPointerDown={onPointerDown}
        onClick={(e) => {
          e.stopPropagation();
          toggleGrooveLabChannelSolo(ch);
        }}
        style={MS_MINI(solo, 'solo', accent)}
      >
        S
      </button>
    </div>
  );
}
