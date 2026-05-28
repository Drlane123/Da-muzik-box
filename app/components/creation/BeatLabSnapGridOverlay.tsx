/**
 * Vertical bar / beat / step lines for Beat Lab piano roll, automation lanes, and drum grid.
 */
import type { CSSProperties } from 'react';
import { beatLabSnapColumnLinesBackground } from '../../lib/creationStation/creationDrumGridAdaptive';

export type BeatLabSnapGridOverlayProps = {
  colWidthPx: number;
  qpb: number;
  subdiv: number;
  bankColOffset?: number;
  style?: CSSProperties;
};

export function BeatLabSnapGridOverlay({
  colWidthPx,
  qpb,
  subdiv,
  bankColOffset = 0,
  style,
}: BeatLabSnapGridOverlayProps) {
  return (
    <div
      aria-hidden
      style={{
        ...beatLabSnapColumnLinesBackground({
          colWidthPx,
          qpb,
          subdiv,
          bankColOffset,
        }),
        ...style,
      }}
    />
  );
}
