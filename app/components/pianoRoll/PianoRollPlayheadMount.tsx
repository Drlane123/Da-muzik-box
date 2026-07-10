import { forwardRef, memo } from 'react';

/** SE2-style playhead — WAAPI drives transform; no React position props while playing. */
export const PianoRollPlayheadMount = memo(
  forwardRef<HTMLDivElement, { keyW: number }>(function PianoRollPlayheadMount({ keyW }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden
        data-piano-roll-playhead
        style={{
          position: 'absolute',
          left: keyW,
          top: 0,
          height: '100%',
          width: 1,
          background: 'transparent',
          pointerEvents: 'none',
          zIndex: 30,
          opacity: 1,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: -4,
            top: 0,
            width: 8,
            height: 12,
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            background: '#7cf4c6',
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 12,
            bottom: 0,
            width: 1,
            background: 'rgba(124, 244, 198, 0.45)',
          }}
        />
      </div>
    );
  }),
);

PianoRollPlayheadMount.displayName = 'PianoRollPlayheadMount';
