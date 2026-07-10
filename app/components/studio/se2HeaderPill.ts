/** Shared SE2 header pill — File menu, view tabs, Song key, MIDI, How-to. */
export const SE2_HEADER_PILL_BOX = {
  borderColor: '#2a2a32',
  background: 'rgba(255,255,255,0.02)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.55)',
} as const;

export function se2HeaderPillActiveStyle(active: boolean) {
  if (!active) return SE2_HEADER_PILL_BOX;
  return {
    borderColor: 'rgba(124,244,198,0.38)',
    background: 'rgba(124,244,198,0.14)',
    boxShadow:
      '0 0 0 1px rgba(124,244,198,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
  };
}

export function se2HeaderPillTextColor(active: boolean): string {
  return active ? '#7cf4c6' : '#c8c8d4';
}

export const SE2_HEADER_PILL_LABEL_COLOR = '#8a8a98';
