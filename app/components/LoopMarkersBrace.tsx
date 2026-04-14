/**
 * DAW-style loop region markers: horizontal “brace” on the ruler ([ ] vs ▶ ◀ caps by variant).
 * Neon light blue fill, caps, and vertical guides; non-interactive — loop edits stay elsewhere.
 */

import type { CSSProperties } from 'react';

type Variant = 'purple' | 'dark';

const capSize = 4;

/** Bright neon cyan — app accent, pumped for visibility on dark rulers */
const NEON = '#5FFBFF';
const NEON_CORE = '#00E5FF';
const NEON_SOFT = '#B8FEFF';
const NEON_GLOW =
  '0 0 4px rgba(190, 255, 255, 0.95), 0 0 12px rgba(0, 245, 255, 0.75), 0 0 24px rgba(0, 230, 255, 0.5)';

function TriangleInRight() {
  return (
    <div
      aria-hidden
      style={{
        width: 0,
        height: 0,
        flexShrink: 0,
        borderTop: `${capSize}px solid transparent`,
        borderBottom: `${capSize}px solid transparent`,
        borderLeft: `7px solid ${NEON_SOFT}`,
        filter: `drop-shadow(0 0 4px ${NEON_CORE}) drop-shadow(0 0 8px rgba(0, 245, 255, 0.85)) drop-shadow(0 0 1px rgba(0,0,0,0.5))`,
      }}
    />
  );
}

function TriangleInLeft() {
  return (
    <div
      aria-hidden
      style={{
        width: 0,
        height: 0,
        flexShrink: 0,
        borderTop: `${capSize}px solid transparent`,
        borderBottom: `${capSize}px solid transparent`,
        borderRight: `7px solid ${NEON_SOFT}`,
        filter: `drop-shadow(0 0 4px ${NEON_CORE}) drop-shadow(0 0 8px rgba(0, 245, 255, 0.85)) drop-shadow(0 0 1px rgba(0,0,0,0.5))`,
      }}
    />
  );
}

export default function LoopMarkersBrace({
  visible,
  leftPx,
  widthPx,
  height,
  variant = 'dark',
  zIndex = 11,
}: {
  visible: boolean;
  leftPx: number;
  widthPx: number;
  height: number;
  variant?: Variant;
  zIndex?: number;
}) {
  if (!visible || widthPx < 4) return null;

  const barBg =
    variant === 'purple'
      ? 'linear-gradient(180deg, rgba(120, 255, 255, 0.78) 0%, rgba(0, 229, 255, 0.58) 55%, rgba(0, 200, 255, 0.48) 100%)'
      : 'linear-gradient(180deg, rgba(110, 252, 255, 0.68) 0%, rgba(0, 229, 255, 0.52) 50%, rgba(0, 195, 245, 0.42) 100%)';

  /** Thin horizontal strip only (caps stay readable; side vertical guides are separate). */
  const barThickness = Math.max(4, Math.min(5, Math.round(height * 0.17)));

  return (
    <div
      className="absolute pointer-events-none flex items-center"
      style={{
        left: leftPx,
        width: widthPx,
        height,
        top: 0,
        zIndex,
        boxSizing: 'border-box',
        padding: '0 1px',
      }}
      title="Loop region"
    >
      <div
        className="flex items-center justify-center w-full min-w-0"
        style={{ height: '100%' }}
      >
        {variant === 'purple' ? (
          <span
            className="shrink-0 font-black leading-none select-none"
            style={{
              color: NEON,
              textShadow: `${NEON_GLOW}, 0 0 2px rgba(255,255,255,0.55), 0 0 1px rgba(0,0,0,0.45)`,
              fontSize: Math.min(12, height * 0.42),
              marginRight: 1,
            }}
          >
            [
          </span>
        ) : (
          <TriangleInRight />
        )}
        <div
          className="min-w-0 flex-1 rounded-sm self-center"
          style={{
            height: barThickness,
            minHeight: barThickness,
            maxHeight: barThickness,
            background: barBg,
            boxShadow:
              variant === 'purple'
                ? `inset 0 1px 0 rgba(255,255,255,0.5), ${NEON_GLOW}, 0 1px 2px rgba(0,0,0,0.25)`
                : `inset 0 1px 0 rgba(255,255,255,0.38), ${NEON_GLOW}, 0 1px 2px rgba(0,0,0,0.3)`,
            border:
              variant === 'purple'
                ? '1px solid rgba(200, 255, 255, 0.95)'
                : '1px solid rgba(170, 252, 255, 0.88)',
          }}
        />
        {variant === 'purple' ? (
          <span
            className="shrink-0 font-black leading-none select-none"
            style={{
              color: NEON,
              textShadow: `${NEON_GLOW}, 0 0 2px rgba(255,255,255,0.55), 0 0 1px rgba(0,0,0,0.45)`,
              fontSize: Math.min(12, height * 0.42),
              marginLeft: 1,
            }}
          >
            ]
          </span>
        ) : (
          <TriangleInLeft />
        )}
      </div>
    </div>
  );
}

/** Thin vertical lines at loop start / end (extends through a grid below the ruler). */
export function LoopVerticalGuides({
  visible,
  leftPx,
  widthPx,
  height,
  topPx = 0,
  zIndex = 4,
}: {
  visible: boolean;
  leftPx: number;
  widthPx: number;
  height: number;
  /** Offset from the top of the positioning ancestor (e.g. below a sticky ruler). */
  topPx?: number;
  zIndex?: number;
}) {
  if (!visible || height <= 0 || widthPx < 2) return null;
  const lineStyle: CSSProperties = {
    position: 'absolute',
    top: topPx,
    width: 1.5,
    height,
    background: 'linear-gradient(180deg, rgba(210, 255, 255, 0.98) 0%, rgba(0, 240, 255, 0.95) 100%)',
    boxShadow: `${NEON_GLOW}, 0 0 3px rgba(200, 255, 255, 1), 0 0 1px rgba(0, 200, 255, 1)`,
    pointerEvents: 'none',
    zIndex,
  };
  return (
    <>
      <div style={{ ...lineStyle, left: leftPx }} />
      <div style={{ ...lineStyle, left: leftPx + widthPx - 1.5 }} />
    </>
  );
}
