/**
 * Groove Lab CH 33–48 stereo VU — embed rail + popup mixer (Studio Editor 2 layout).
 */
import { useEffect, type CSSProperties, type RefObject } from 'react';
import { getGrooveLabChannelMeterLevel } from '@/app/lib/creationStation/grooveLabChannelMeters';

export const GROOVE_CHANNEL_METER_ATTR = 'data-groove-channel-meter';

export function vuBarHeightPct(linear: number): number {
  const v = Math.max(0, Math.min(1, linear));
  if (v <= 1e-7) return 0;
  return Math.min(100, Math.round(Math.pow(v, 0.42) * 100));
}

export function grooveLabMeterFillGradient(levelLinear: number): string {
  const lv = Math.max(1e-6, levelLinear);
  const db = 20 * Math.log10(lv);
  if (db < 0) {
    return 'linear-gradient(to top, #00c853 0%, #00c853 100%)';
  }
  if (db < 3) {
    return 'linear-gradient(to top, #00c853 0%, #00c853 90%, #ffb020 100%)';
  }
  return 'linear-gradient(to top, #00c853 0%, #00c853 84%, #ff9f1a 94%, #ff3b3b 100%)';
}

export type GrooveLabChannelStereoVuProps = {
  ch: number;
  accent: string;
  /** embed = compact rail · strip = popup mixer (taller bars). */
  size?: 'embed' | 'strip';
  style?: CSSProperties;
};

/** L/R LED columns — painted by {@link useGrooveLabChannelMeterPaint}. */
export function GrooveLabChannelStereoVu({
  ch,
  accent,
  size = 'embed',
  style,
}: GrooveLabChannelStereoVuProps) {
  const strip = size === 'strip';
  const barW = strip ? 9 : 4;
  const gap = strip ? 5 : 3;
  const minH = strip ? 0 : 26;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap,
        height: '100%',
        flexShrink: 0,
        ...style,
      }}
      aria-label={`Channel ${ch} stereo meter`}
    >
      {(['L', 'R'] as const).map((side) => (
        <div
          key={side}
          style={{
            position: 'relative',
            width: barW,
            height: '100%',
            minHeight: minH,
            overflow: 'hidden',
            borderRadius: strip ? 3 : 2,
            background: 'linear-gradient(180deg, #0d0d14 0%, #07070f 100%)',
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 6px rgba(0,0,0,0.85)',
          }}
        >
          <div
            {...{ [GROOVE_CHANNEL_METER_ATTR]: '' }}
            data-ch={String(ch)}
            data-side={side}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '0%',
              background: grooveLabMeterFillGradient(0.5),
              boxShadow: strip ? `0 0 5px ${accent}55` : `0 0 4px ${accent}44`,
              transition: 'height 0.04s linear',
            }}
          />
          {strip ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '18%',
                pointerEvents: 'none',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 100%)',
                mixBlendMode: 'screen',
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Imperative meter paint — same rAF loop as embed rail. */
export function useGrooveLabChannelMeterPaint(
  rootRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const paintMeters = () => {
      const root = rootRef.current;
      if (root) {
        root.querySelectorAll<HTMLElement>(`[${GROOVE_CHANNEL_METER_ATTR}]`).forEach((el) => {
          const ch = Number(el.dataset.ch);
          const side = el.dataset.side;
          if (!Number.isFinite(ch)) return;
          const row = getGrooveLabChannelMeterLevel(ch);
          const linear = side === 'L' ? row.l : row.r;
          const pct = vuBarHeightPct(linear);
          el.style.height = `${pct}%`;
          el.style.background = grooveLabMeterFillGradient(Math.max(1e-6, linear));
        });
      }
      raf = requestAnimationFrame(paintMeters);
    };
    raf = requestAnimationFrame(paintMeters);
    return () => cancelAnimationFrame(raf);
  }, [active, rootRef]);
}
