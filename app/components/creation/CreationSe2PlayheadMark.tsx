/**
 * Studio Editor 2 playhead mark — **2 px gradient line** (no arrow, no column square).
 * Compositor motion is applied to the parent `ref` element (SE2 `playheadGroupRef` contract).
 */
import type { CSSProperties } from 'react';

import {
  CREATION_SE2_PLAYHEAD_GRIP_W_PX,
  CREATION_SE2_PLAYHEAD_LINE_W_PX,
} from '@/app/lib/creationStation/creationPlaylineWapi';

const SE2_TIMELINE_LINE_GRADIENT =
  'linear-gradient(180deg, #9fffd8 0%, #5ee9b4 50%, #34d399 100%)';
const SE2_TIMELINE_LINE_SHADOW =
  '0 0 0 1px rgba(0,0,0,0.4), 0 0 10px rgba(52,211,153,0.4)';

type CreationSe2PlayheadMarkProps = {
  /** Drum grid: 16 px grip + centered line. Piano roll: 2 px line only. */
  variant: 'timeline' | 'piano';
  height?: number | string;
  style?: CSSProperties;
};

export function CreationSe2PlayheadMark({
  variant,
  height = '100%',
  style,
}: CreationSe2PlayheadMarkProps) {
  if (variant === 'piano') {
    return (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CREATION_SE2_PLAYHEAD_LINE_W_PX,
          height,
          background: '#7cf4c6',
          boxShadow: '0 0 6px rgba(124, 244, 198, 0.35)',
          pointerEvents: 'none',
          ...style,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: (CREATION_SE2_PLAYHEAD_GRIP_W_PX - CREATION_SE2_PLAYHEAD_LINE_W_PX) / 2,
        width: CREATION_SE2_PLAYHEAD_LINE_W_PX,
        height,
        background: SE2_TIMELINE_LINE_GRADIENT,
        boxShadow: SE2_TIMELINE_LINE_SHADOW,
        borderRadius: 1,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
