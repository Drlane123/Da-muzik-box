import type { CSSProperties } from 'react';

/** Mikron / pro-audio UI lettering — Rajdhani + spaced caps (FX Suite + Studio Editor 2). */
export const STUDIO_UI_FONT_FAMILY = '"Rajdhani", "Exo 2", system-ui, sans-serif';

/** @deprecated Use STUDIO_UI_FONT_FAMILY */
export const SUITE_FONT_FAMILY = STUDIO_UI_FONT_FAMILY;

export const studioUiTypeTitle: CSSProperties = {
  fontFamily: STUDIO_UI_FONT_FAMILY,
  fontWeight: 600,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
};

export const studioUiTypeLabel: CSSProperties = {
  fontFamily: STUDIO_UI_FONT_FAMILY,
  fontWeight: 500,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

export const studioUiTypeMicro: CSSProperties = {
  fontFamily: STUDIO_UI_FONT_FAMILY,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

export const studioUiTypeValue: CSSProperties = {
  fontFamily: STUDIO_UI_FONT_FAMILY,
  fontWeight: 600,
  letterSpacing: '0.05em',
  fontVariantNumeric: 'tabular-nums',
};

/** FX Suite aliases */
export const suiteTypeTitle = studioUiTypeTitle;
export const suiteTypeLabel = studioUiTypeLabel;
export const suiteTypeMicro = studioUiTypeMicro;
export const suiteTypeValue = studioUiTypeValue;
