import type { CSSProperties } from 'react';

/** Visual tokens shared with Chord Builder `PianoRoll` (mint on charcoal). */
export const CB_PIANO_MINT = '#7cf4c6';
export const CB_PIANO_MINT_DIM = 'rgba(124, 244, 198, 0.35)';
export const CB_PIANO_MINT_BG = 'rgba(124, 244, 198, 0.10)';
export const CB_PIANO_MINT_BORDER = 'rgba(124, 244, 198, 0.18)';
export const CB_PIANO_MINT_BORDER_STRONG = 'rgba(124, 244, 198, 0.45)';

export const CB_PIANO_BG = '#06060a';
export const CB_PIANO_ROW_H = 14;
export const CB_PIANO_LABEL_W = 56;
export const CB_PIANO_WHITE_KEY_W = CB_PIANO_LABEL_W - 4;
export const CB_PIANO_BLACK_KEY_W = Math.round(CB_PIANO_LABEL_W * 0.62);
export const CB_PIANO_RULER_H = 18;
/** Matches Chord Builder chord-block / roll horizontal density. */
export const CB_PIANO_PX_PER_BEAT = 36;
export const CB_PIANO_PX_PER_BEAT_MIN = 20;

/** 808 Lab — larger keys and wider beat cells for touch / low-end editing. */
export const LAB808_PIANO_ROW_H = 24;
export const LAB808_PIANO_LABEL_W = 84;
export const LAB808_PIANO_RULER_H = 26;
export const LAB808_PIANO_PX_PER_BEAT = 52;
export const LAB808_PIANO_PX_PER_BEAT_MIN = 30;

export interface PianoRollMetrics {
  rowH: number;
  labelW: number;
  rulerH: number;
}

export const CB_PIANO_METRICS: PianoRollMetrics = {
  rowH: CB_PIANO_ROW_H,
  labelW: CB_PIANO_LABEL_W,
  rulerH: CB_PIANO_RULER_H,
};

export const LAB808_PIANO_METRICS: PianoRollMetrics = {
  rowH: LAB808_PIANO_ROW_H,
  labelW: LAB808_PIANO_LABEL_W,
  rulerH: LAB808_PIANO_RULER_H,
};

function pianoWhiteKeyW(m: PianoRollMetrics): number {
  return m.labelW - 6;
}

function pianoBlackKeyW(m: PianoRollMetrics): number {
  return Math.round(m.labelW * 0.62);
}

function pianoKeyLabelFontSize(m: PianoRollMetrics, isC: boolean): number {
  return Math.max(9, Math.round(m.rowH * (isC ? 0.62 : 0.54)));
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Build chromatic piano-roll rows top→bottom (high→low), same algorithm as Chord Builder. */
export function buildCbPianoRows(lowOct: number, highOct: number): string[] {
  const rows: string[] = [];
  rows.push(`C${highOct}`);
  for (let oct = highOct - 1; oct >= lowOct; oct--) {
    for (let i = 11; i >= 0; i--) {
      rows.push(`${NOTE_NAMES[i]}${oct}`);
    }
  }
  return rows;
}

/** Chord Builder roll range (C3–C6). */
export const CB_PIANO_ROWS = buildCbPianoRows(3, 6);

/** 808 Lab: full chromatic keyboard C1–C6 (every key = one grid row). */
export const LAB808_PIANO_ROWS = buildCbPianoRows(1, 6);

export function cbPianoNoteNameToMidi(name: string): number {
  const m = /^([A-G]#?)(-?\d+)$/.exec(name);
  if (!m) return 0;
  const pc = NOTE_NAMES.indexOf(m[1] as (typeof NOTE_NAMES)[number]);
  if (pc < 0) return 0;
  const oct = parseInt(m[2]!, 10);
  return (oct + 1) * 12 + pc;
}

export function cbPianoMidiToNoteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

/** Nearest row on a piano-row list; tolerates small MIDI drift from voicing / import. */
export function pianoRowIndexForMidi(midi: number, rows: readonly string[]): number {
  const exact = rows.indexOf(cbPianoMidiToNoteName(midi));
  if (exact >= 0) return exact;
  let best = -1;
  let dist = 999;
  for (let i = 0; i < rows.length; i++) {
    const d = Math.abs(cbPianoNoteNameToMidi(rows[i]!) - midi);
    if (d < dist) {
      dist = d;
      best = i;
    }
  }
  return dist <= 2 ? best : -1;
}

/** Row on the chord roll keyboard (C3–C6); tolerates ±1 MIDI for rounding. */
export function chordRollRowForMidi(midi: number): number {
  return pianoRowIndexForMidi(midi, CB_PIANO_ROWS);
}

export function cbPianoIsBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export function cbPianoIsCRow(midi: number): boolean {
  return ((midi % 12) + 12) % 12 === 0;
}

/** Key-face label: C4 on C rows, single letter on naturals, C# on blacks. */
export function cbPianoKeyLabel(midi: number): string {
  const full = cbPianoMidiToNoteName(midi);
  const isBlack = full.includes('#');
  const isC = cbPianoIsCRow(midi);
  if (isC) return full;
  if (isBlack) return full.slice(0, 2);
  return full.charAt(0);
}

export function cbPianoRollContainerStyle(): CSSProperties {
  return {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: CB_PIANO_BG,
    borderRadius: 0,
    border: `1px solid ${CB_PIANO_MINT_BORDER}`,
    overflow: 'hidden',
  };
}

export function cbPianoToolbarStyle(): CSSProperties {
  return {
    flexShrink: 0,
    padding: '6px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(0,0,0,0.30)',
    fontSize: 9,
    fontWeight: 800,
    color: '#8a8a98',
    letterSpacing: 1.5,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  };
}

export function cbPianoKeyRailOuterStyle(m: PianoRollMetrics = CB_PIANO_METRICS): CSSProperties {
  return {
    boxSizing: 'border-box',
    width: m.labelW,
    flexShrink: 0,
    alignSelf: 'flex-start',
    position: 'sticky',
    left: 0,
    zIndex: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    background: '#050507',
    borderRight: `1px solid ${CB_PIANO_MINT_BORDER}`,
    userSelect: 'none',
    /** Must stay `visible` so inner keys / sticky rail participate in the scrollport (not a clipping sticky root). */
    overflow: 'visible',
  };
}

/** Key button inside the rail — rail is `position: sticky` for horizontal scroll in 808 Lab. */
export function cbPianoKeyCellStyle(m: PianoRollMetrics = CB_PIANO_METRICS): CSSProperties {
  return {
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    flexShrink: 0,
    background: '#050507',
    cursor: 'pointer',
    userSelect: 'none',
    padding: 0,
    margin: 0,
    border: 'none',
    display: 'block',
    textAlign: 'left',
  };
}

export function cbPianoKeyFaceStyle(
  midi: number,
  isActive = false,
  m: PianoRollMetrics = CB_PIANO_METRICS,
  isBassRoot = false,
): CSSProperties {
  const isBlack = cbPianoIsBlackKey(midi);
  const isC = cbPianoIsCRow(midi);
  const pressed = isActive;
  const baseBlackBg = 'linear-gradient(180deg, #25252e 0%, #0e0e14 100%)';
  const baseWhiteBg = 'linear-gradient(180deg, #e5e5ec 0%, #b6b6c0 100%)';
  const rootBlackBg = 'linear-gradient(180deg, #2e2a22 0%, #14120e 100%)';
  const rootWhiteBg = 'linear-gradient(180deg, #f0ead0 0%, #c8c0a8 100%)';
  const baseShadow = isBlack
    ? 'inset 0 -1px 1px rgba(0,0,0,0.6), inset -1px 0 1px rgba(0,0,0,0.4)'
    : 'inset 0 -1px 1px rgba(0,0,0,0.18), inset -1px 0 1px rgba(0,0,0,0.10)';
  const rootShadow = `inset 0 0 0 2px rgba(253,230,138,0.5), ${baseShadow}`;
  return {
    position: 'relative',
    height: '100%',
    minHeight: m.rowH,
    width: isBlack ? pianoBlackKeyW(m) : pianoWhiteKeyW(m),
    background: pressed
      ? `linear-gradient(180deg, ${CB_PIANO_MINT} 0%, rgba(124,244,198,0.70) 100%)`
      : isBassRoot
        ? isBlack
          ? rootBlackBg
          : rootWhiteBg
        : isBlack
          ? baseBlackBg
          : baseWhiteBg,
    boxShadow: pressed
      ? `0 0 6px ${CB_PIANO_MINT}, inset 0 0 0 1px rgba(255,255,255,0.4)`
      : isBassRoot
        ? rootShadow
        : baseShadow,
    borderRadius: '0 3px 3px 0',
    borderTop: isBlack ? 'none' : '1px solid rgba(255,255,255,0.45)',
    borderBottom: isBlack ? '1px solid #000' : isC ? '1px solid #4a4a54' : '1px solid rgba(0,0,0,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: Math.max(5, Math.round(m.labelW * 0.07)),
    fontSize: pianoKeyLabelFontSize(m, isC),
    fontWeight: isC ? 800 : 700,
    color: pressed ? '#0a0a0e' : isBassRoot ? '#fde68a' : isBlack ? '#9a9aa6' : '#1a1a22',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    letterSpacing: 0.2,
    transition: 'background 80ms linear, box-shadow 80ms linear',
  };
}

export function cbPianoPitchRowStyle(midi: number, m: PianoRollMetrics = CB_PIANO_METRICS): CSSProperties {
  const isBlack = cbPianoIsBlackKey(midi);
  const isC = cbPianoIsCRow(midi);
  return {
    display: 'flex',
    alignItems: 'stretch',
    height: m.rowH,
    background: isBlack ? CB_PIANO_ROW_BLACK : CB_PIANO_ROW_WHITE,
    borderBottom: isC ? '1px solid rgba(124,244,198,0.10)' : '1px solid rgba(255,255,255,0.02)',
  };
}

const CB_PIANO_ROW_BLACK = '#08080c';
const CB_PIANO_ROW_WHITE = '#0c0c10';

export function cbPianoGridRowStyle(midi: number): CSSProperties {
  const isBlack = cbPianoIsBlackKey(midi);
  const isC = cbPianoIsCRow(midi);
  return {
    position: 'absolute',
    left: isBlack ? '20%' : 0,
    width: isBlack ? '80%' : '100%',
    background: isBlack ? CB_PIANO_ROW_BLACK : CB_PIANO_ROW_WHITE,
    borderBottom: isC ? '1px solid rgba(124,244,198,0.10)' : '1px solid rgba(255,255,255,0.02)',
  };
}

export function cbPianoBeatLineStyle(isMeasure: boolean): CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    width: isMeasure ? 1 : 1,
    marginLeft: isMeasure ? -1 : 0,
    background: isMeasure ? CB_PIANO_MINT_BORDER : 'rgba(255,255,255,0.02)',
    opacity: 1,
  };
}

export function cbPianoRulerStyle(m: PianoRollMetrics = CB_PIANO_METRICS): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'stretch',
    height: m.rulerH,
    position: 'sticky',
    top: 0,
    zIndex: 4,
    background: 'rgba(8, 8, 12, 0.98)',
    borderBottom: `1px solid ${CB_PIANO_MINT_BG}`,
    userSelect: 'none',
  };
}

export function cbPianoRulerLabelStyle(m: PianoRollMetrics = CB_PIANO_METRICS): CSSProperties {
  return {
    boxSizing: 'border-box',
    width: m.labelW,
    flexShrink: 0,
    background: '#08080c',
    borderRight: `1px solid ${CB_PIANO_MINT_BORDER}`,
    position: 'sticky',
    left: 0,
    zIndex: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.max(8, Math.round(m.rulerH * 0.36)),
    fontWeight: 700,
    color: 'rgba(255,255,255,0.30)',
    letterSpacing: 0.6,
    fontFamily: 'monospace',
  };
}

export function cbPianoRulerBarStyle(barW: number, m: PianoRollMetrics = CB_PIANO_METRICS): CSSProperties {
  return {
    boxSizing: 'border-box',
    width: barW,
    flexShrink: 0,
    borderRight: `1px solid ${CB_PIANO_MINT_BG}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 4,
    fontSize: Math.max(8, Math.round(m.rulerH * 0.36)),
    fontWeight: 700,
    color: 'rgba(255,255,255,0.30)',
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  };
}

export function cbPianoManualNoteBodyStyle(): CSSProperties {
  return {
    background: 'linear-gradient(180deg, #a8ffd9 0%, #5feab1 100%)',
    boxShadow: '0 0 6px rgba(124, 244, 198, 0.55)',
    color: '#0a0a0e',
  };
}

export function cbPianoManualNoteResizeStyle(): CSSProperties {
  return {
    background: 'linear-gradient(180deg, #7cf4c6 0%, #34d399 100%)',
    borderLeft: '1px solid rgba(0,0,0,0.25)',
  };
}
