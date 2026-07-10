/**
 * SE2 808 Lab chrome — matches `.beat-pads-fx-suite-viz-chrome` (HP/LP filter viz grid).
 */
export const SE2_LAB808_GRID_ZOOM_ACCENT = '#58c4ff';

/** Da Muzik Box wordmark gold — 808 Lab dock tagline. */
export const SE2_LAB808_WORDMARK_GOLD_GRADIENT =
  'linear-gradient(135deg, #fff8ec 0%, #ffe082 42%, #ffb74d 78%, #ff8a65 100%)';

export const SE2_LAB808_DOCK_TAGLINE =
  'Low 808 Follow';

export const SE2_LAB808_DOCK_TECH_LABEL = 'Chord Lock Technology';

export const SE2_LAB808_DOCK_TAGLINE_TITLE =
  'Follow any track or chord progression with low 808 kicks and bass — trap, house, and pop trunk-shake for modern hits. Chord Lock Technology keeps roots on your harmony. Tap ? for the full guide.';

export const SE2_LAB808_FILTER_VIZ_SURFACE = {
  /** Same gradient as the HP/LP readout panel in touch.css */
  background:
    'linear-gradient(180deg, rgba(8, 8, 14, 0.72) 0%, rgba(4, 4, 8, 0.88) 100%)',
  /** Opaque equivalent for full-panel fills */
  backgroundOpaque: 'linear-gradient(180deg, #08080e 0%, #040408 100%)',
  fill: '#06060a',
  fillHi: '#08080e',
  border: 'rgba(58, 58, 72, 0.9)',
  borderHex: '#3a3a48',
  insetShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.45)',
} as const;
