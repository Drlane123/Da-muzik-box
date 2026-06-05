/**
 * NEW SYNTH playhead — stable DOM node (memo). Transport drives WAAPI on this ref only.
 * Mirrors Groove Lab piano-roll playhead mount (no React playheadCol / isPlaying props).
 */
import { forwardRef, memo } from 'react';

import { CB_PIANO_LABEL_W } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';

export const BeatLabSynth2PlayheadMount = memo(
  forwardRef<HTMLDivElement>(function BeatLabSynth2PlayheadMount(_props, ref) {
    return (
      <div
        ref={ref}
        aria-hidden
        data-beat-lab-synth2-playhead
        style={{
          position: 'absolute',
          left: CB_PIANO_LABEL_W,
          top: 0,
          bottom: 0,
          width: 1,
          background: 'transparent',
          pointerEvents: 'none',
          zIndex: 30,
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

BeatLabSynth2PlayheadMount.displayName = 'BeatLabSynth2PlayheadMount';
