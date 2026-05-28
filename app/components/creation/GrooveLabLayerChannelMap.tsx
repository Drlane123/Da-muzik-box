import type { CSSProperties } from 'react';

export interface GrooveLabLayerChannelStripProps {
  channels: readonly number[];
  assignedChannel: number;
  color: string;
}

function cellStyle(active: boolean, color: string): CSSProperties {
  if (!active) {
    return {
      color: '#64748b',
      background: 'transparent',
      border: '1px solid transparent',
    };
  }
  return {
    color,
    background: `${color}28`,
    border: `1px solid ${color}88`,
    boxShadow: `0 0 5px ${color}55`,
    textShadow: `0 0 4px ${color}66`,
  };
}

/** One horizontal 33–48 row — sits beside a layer dropdown. */
export function GrooveLabLayerChannelStrip({
  channels,
  assignedChannel,
  color,
}: GrooveLabLayerChannelStripProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${channels.length}, minmax(0, 1fr))`,
        gap: 1,
        padding: '0 2px',
        borderRadius: 3,
        background: 'transparent',
        border: '1px solid #1f3a2922',
        height: 13,
        alignItems: 'center',
      }}
    >
      {channels.map((ch) => {
        const active = ch === assignedChannel;
        return (
          <span
            key={ch}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 12,
              borderRadius: 2,
              fontSize: 9,
              fontWeight: 900,
              fontFamily: 'monospace',
              lineHeight: 1,
              letterSpacing: -0.35,
              ...cellStyle(active, color),
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}
