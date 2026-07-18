'use client';

import { useEffect, useState } from 'react';

/** Rotating SE2 capability labels — title bar showcase while Studio Editor 2 is open. */
export const SE2_FEATURE_SHOWCASE_LABELS = [
  'Time Stretch',
  'Audio to MIDI',
  'Rhythm Edit',
  'Hits per Bar',
  'SE2 Chord Generator',
  'Beat Pads',
  '808 Lab',
  'Drum Generator',
  'Hum / Melody Capture',
  'Geno Bass Synth',
  'Groove Lead',
  'Geno Ultra Synth',
  'Synth Geno',
  'Good Tone Box',
] as const;

const ROTATE_MS = 2800;
/** Fixed width — labels swap inside so the box never shifts layout. */
const SHOWCASE_WIDTH_PX = 214;

/** Solid gold from the Da Muzik Box wordmark — no gradient, glow, or fade. */
const SHOWCASE_LABEL_COLOR = '#ffe082';

/** SE2 interior typography — Rajdhani, not heavy display faces (Studio 2 / Instrument / Grand). */
const SE2_UI_FONT = "'Rajdhani', 'Exo 2', system-ui, sans-serif";

export function Se2FeatureShowcaseTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setIndex((i) => (i + 1) % SE2_FEATURE_SHOWCASE_LABELS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(tick);
  }, []);

  const label = SE2_FEATURE_SHOWCASE_LABELS[index]!;

  return (
    <div
      data-studio-se2-feature-showcase
      title="Inside Studio Editor 2 — specialized lanes and tools"
      aria-live="polite"
      aria-atomic
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: SHOWCASE_WIDTH_PX,
        minWidth: SHOWCASE_WIDTH_PX,
        maxWidth: SHOWCASE_WIDTH_PX,
        height: 32,
        padding: '0 10px',
        marginRight: 0,
        borderRadius: 6,
        border: '1px solid rgba(255, 183, 77, 0.22)',
        background:
          'linear-gradient(135deg, rgba(255,248,236,0.06) 0%, rgba(12,12,18,0.55) 48%, rgba(255,183,77,0.04) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          fontFamily: SE2_UI_FONT,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: SHOWCASE_LABEL_COLOR,
          lineHeight: 1,
        }}
      >
        SE2
      </span>
      <span
        aria-hidden
        style={{
          width: 1,
          alignSelf: 'stretch',
          margin: '5px 0',
          background: 'rgba(255, 183, 77, 0.35)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          fontFamily: SE2_UI_FONT,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: SHOWCASE_LABEL_COLOR,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {label}
      </span>
    </div>
  );
}
