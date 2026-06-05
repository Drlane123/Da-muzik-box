import type { CSSProperties } from 'react';

/** User-facing module name (Creation sub-nav: {@link CREATION_SUB_SCREENS} `808-lab`). */
export const LAB808_DISPLAY_NAME = '808 Lab';

/** True when the pad loads a kick/bass-drum one-shot (`…/kick/…` in smpldsnds paths). */
export function isLab808KickPad(pad: { label: string; relUrl: string }): boolean {
  return /\/kick\//i.test(pad.relUrl);
}

/** `808 Lab` + unique created name (see {@link lab808KickCatalog}). */
export function formatLab808KickDisplayLabel(createdName: string): string {
  return formatLab808SoundDisplayLabel(createdName);
}

/** Kick & bass preset / pad labels. */
export function formatLab808SoundDisplayLabel(createdName: string): string {
  const name = createdName.trim();
  if (!name) return LAB808_DISPLAY_NAME;
  return `${LAB808_DISPLAY_NAME} ${name}`;
}

/** Transport control sizing (touch-friendly — standalone drum machine page). */
export const LAB808_TRANSPORT_ICON = 22;
export const LAB808_TRANSPORT_BTN = 44;
export const LAB808_TRANSPORT_BTN_PLAY = 50;

/** Piano-roll toolbar transport — matches OrchidTransportControls / Groove Lab roll. */
export const LAB808_ROLL_TRANSPORT_BTN = 26;
export const LAB808_ROLL_TRANSPORT_PLAY_W = 32;
export const LAB808_ROLL_TRANSPORT_H = 26;
export const LAB808_ROLL_TRANSPORT_ICON = 13;

export const lab808RollTransportCluster: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 6px',
  borderRadius: 6,
  background: 'rgba(5, 8, 5, 0.92)',
  border: '1px solid #1f3a29',
  boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
  flexShrink: 0,
};

export function lab808RollTransportButtonStyle(playing?: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #1f3a29',
    borderRadius: 5,
    background: playing ? '#15321e' : '#0d120f',
    color: playing ? '#4ade80' : '#86efac',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  };
}

/** Piano-roll toolbar chips — matches GrooveLabPianoRoll actionBtn. */
export function lab808RollActionBtnStyle(bg: string, color: string, border: string): CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${border}`,
    borderRadius: 5,
    padding: '3px 8px',
    fontSize: 8,
    fontWeight: 900,
    cursor: 'pointer',
  };
}

export const lab808RollSelect: CSSProperties = {
  background: '#0a0e16',
  color: '#86efac',
  border: '1px solid #1a3a29',
  borderRadius: 4,
  padding: '2px 4px',
  fontSize: 8,
  fontWeight: 800,
};

export const lab808RollToolbarLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 8,
  color: '#71717a',
  fontWeight: 800,
};

/** Compact BPM field on piano-roll toolbars. */
export function lab808RollBpmInputStyle(opts?: { readOnly?: boolean }): CSSProperties {
  return {
    padding: '2px 4px',
    borderRadius: 4,
    border: '1px solid #1a3a29',
    background: '#0a0e16',
    color: opts?.readOnly ? '#86efac' : '#86efac',
    fontSize: 8,
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    width: 44,
    minWidth: 44,
    maxWidth: 52,
    flexShrink: 0,
    textAlign: 'center',
    boxSizing: 'border-box',
    lineHeight: '14px',
    MozAppearance: 'textfield',
    WebkitAppearance: 'textfield',
    appearance: 'textfield',
    cursor: opts?.readOnly ? 'default' : 'text',
  };
}

export const lab808RollFxLabel: CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  color: '#71717a',
  minWidth: 18,
};

export const lab808ToolbarLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: '#94a3b8',
  fontWeight: 800,
};

export const lab808BtnMini: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #52525b',
  background: '#27272f',
  color: '#fde68a',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  minHeight: 40,
};

export const lab808Select: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #3f3f46',
  background: '#12121a',
  color: '#e4e4e7',
  fontSize: 14,
  fontWeight: 800,
  minHeight: 40,
};

/** BPM number field — wide enough for 3 digits; spinners hidden so value is not covered. */
export function lab808BpmInputStyle(opts?: { readOnly?: boolean }): CSSProperties {
  return {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #3f3f46',
    background: opts?.readOnly ? '#0f0f14' : '#18181b',
    color: opts?.readOnly ? '#d4d4d8' : '#fde68a',
    fontSize: 16,
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    minHeight: 40,
    width: 76,
    minWidth: 76,
    maxWidth: 88,
    flexShrink: 0,
    textAlign: 'center',
    boxSizing: 'border-box',
    lineHeight: '24px',
    MozAppearance: 'textfield',
    WebkitAppearance: 'textfield',
    appearance: 'textfield',
    opacity: 1,
    cursor: opts?.readOnly ? 'default' : 'text',
  };
}

export const lab808ToolbarBpmRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

export const lab808BtnGhost: CSSProperties = {
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid #3f3f46',
  background: '#18181b',
  color: '#d4d4d8',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  minHeight: 44,
};

export const lab808BtnPrimary: CSSProperties = {
  padding: '12px 18px',
  borderRadius: 8,
  border: '1px solid #ca8a04',
  background: 'linear-gradient(180deg,#422006,#1c1410)',
  color: '#fde68a',
  fontWeight: 900,
  fontSize: 14,
  cursor: 'pointer',
  minHeight: 44,
};

export function lab808TransportButtonStyle(playing?: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: 'none',
    borderRadius: 8,
    background: playing ? 'rgba(0, 229, 255, 0.18)' : '#101014',
    color: playing ? '#5eead4' : '#8aa0b5',
    cursor: 'pointer',
  };
}

export const lab808FilterRangeStyle = (accent: string): CSSProperties => ({
  width: 112,
  height: 32,
  accentColor: accent,
  cursor: 'pointer',
});

export const lab808LevelRangeStyle: CSSProperties = {
  width: 88,
  height: 32,
  accentColor: '#ca8a04',
  cursor: 'pointer',
};

export const lab808FxLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#a1a1aa',
  minWidth: 28,
};

export const lab808RollChordNoteFont: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
};
