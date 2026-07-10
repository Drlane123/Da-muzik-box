/**
 * SE2 Guitar — standard tuning fretboard math (Ample Guitar M Lite style).
 * String 1 = high E (top), string 6 = low E (bottom).
 */

export const SE2_GUITAR_STRING_COUNT = 6;
export const SE2_GUITAR_FRET_COUNT = 12;

/** Open-string MIDI — low E through high E. */
export const SE2_GUITAR_OPEN_STRING_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64];

export const SE2_GUITAR_STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'] as const;

export type Se2GuitarFretCell = {
  stringIndex: number;
  fret: number;
  midi: number;
  label: string;
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function se2GuitarMidiAt(stringIndex: number, fret: number, capo = 0): number {
  const open = SE2_GUITAR_OPEN_STRING_MIDI[stringIndex];
  if (open == null) return 60;
  return open + fret + capo;
}

export function se2GuitarNoteLabel(midi: number): string {
  const n = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[n]}${octave}`;
}

export function se2GuitarFretCell(stringIndex: number, fret: number, capo = 0): Se2GuitarFretCell {
  const midi = se2GuitarMidiAt(stringIndex, fret, capo);
  return { stringIndex, fret, midi, label: se2GuitarNoteLabel(midi) };
}

/** Fret markers — dots at 3, 5, 7, 9, 12 (double at 12). */
export const SE2_GUITAR_FRET_MARKERS: readonly number[] = [3, 5, 7, 9, 12];

/** Map MIDI → string + fret for fretboard dots (prefers lowest fret on highest string). */
export function se2GuitarMidiToFretPosition(
  midi: number,
  capo = 0,
): { stringIndex: number; fret: number } | null {
  const target = midi - capo;
  let best: { stringIndex: number; fret: number } | null = null;
  for (let s = SE2_GUITAR_STRING_COUNT - 1; s >= 0; s -= 1) {
    const fret = target - SE2_GUITAR_OPEN_STRING_MIDI[s]!;
    if (fret < 0 || fret > SE2_GUITAR_FRET_COUNT) continue;
    if (!best || fret < best.fret) best = { stringIndex: s, fret };
  }
  return best;
}

export type Se2GuitarFretDot = { stringIndex: number; fret: number };

/** Portrait SVG (`ref-acoustic-guitar.svg`) — nut + string anchors from Inkscape paths. */
export const SE2_GUITAR_SVG_W = 350.19852;
export const SE2_GUITAR_SVG_H = 886.81561;

/** Inkscape layer1 — string paths live in this local space; art `<image>` applies it when rasterized. */
export const SE2_GUITAR_SVG_LAYER1 = { tx: -181.37553, ty: -78.490472 } as const;

/** Root viewport coords (overlay `<svg>` / pointer) → layer1 local for fretboard math. */
export function se2GuitarRootToLayerLocal(rootX: number, rootY: number): { x: number; y: number } {
  return {
    x: rootX - SE2_GUITAR_SVG_LAYER1.tx,
    y: rootY - SE2_GUITAR_SVG_LAYER1.ty,
  };
}

/** Open-string X positions — string 0 (low E) → string 5 (high e). */
const STRING_NUT_SVG: readonly { x: number; y: number }[] = [
  { x: 63.318931, y: 128.95304 },
  { x: 72.68605, y: 128.89646 },
  { x: 81.17383, y: 128.87294 },
  { x: 90.34803, y: 128.89752 },
  { x: 101.43221, y: 128.93208 },
  { x: 111.29256, y: 128.65336 },
];

/** Bridge end of each string path in the SVG. */
const STRING_BRIDGE_SVG: readonly { x: number; y: number }[] = [
  { x: 52.833934, y: 855.63663 },
  { x: 66.86538, y: 855.63239 },
  { x: 81.83734, y: 855.63187 },
  { x: 96.43622, y: 855.63125 },
  { x: 110.79898, y: 855.63096 },
  { x: 125.49528, y: 855.2738 },
];

const NUT_Y_SVG = 128.95304;

/** Fret wire Y positions (nut area + frets 1–12) from transformed SVG paths. */
const FRET_WIRE_Y_SVG: readonly number[] = [
  132.73,
  136.51456,
  178.95992,
  219.74056,
  258.83931,
  296.23788,
  331.91669,
  365.85477,
  398.02947,
  428.41628,
  456.98846,
  483.71669,
  508.56861,
];

export const SE2_GUITAR_NECK_SVG = {
  x: 52,
  y: 125,
  width: 78,
  height: FRET_WIRE_Y_SVG[12]! - 125,
} as const;

export const SE2_GUITAR_NECK_PORTRAIT = {
  left: SE2_GUITAR_NECK_SVG.x / SE2_GUITAR_SVG_W,
  top: SE2_GUITAR_NECK_SVG.y / SE2_GUITAR_SVG_H,
  width: SE2_GUITAR_NECK_SVG.width / SE2_GUITAR_SVG_W,
  height: SE2_GUITAR_NECK_SVG.height / SE2_GUITAR_SVG_H,
} as const;

/** Fraction of portrait SVG — neck bounds in source art space. */
export const SE2_GUITAR_NECK_HIT_FRAC = SE2_GUITAR_NECK_PORTRAIT;

/**
 * Neck bounds on the horizontal guitar box (`data-se2-guitar-box`).
 * Portrait art is rotated −90° for display: portrait Y → screen X, portrait X → screen Y.
 */
export const SE2_GUITAR_NECK_HORIZONTAL = {
  left: SE2_GUITAR_NECK_PORTRAIT.top,
  top: SE2_GUITAR_NECK_PORTRAIT.left,
  width: SE2_GUITAR_NECK_PORTRAIT.height,
  height: SE2_GUITAR_NECK_PORTRAIT.width,
} as const;

/** Max distance from a string centerline (layer-local SVG units) to count as a hit. */
export const SE2_GUITAR_STRING_HIT_RADIUS_SVG = 5;

/** Map layer-local Y → nearest fret (open = 0). */
export function se2GuitarFretFromLayerY(ySvg: number): number {
  if (ySvg < FRET_WIRE_Y_SVG[1]! - 10) return 0;
  let bestFret = 1;
  let bestDist = Infinity;
  for (let f = 1; f <= SE2_GUITAR_FRET_COUNT; f += 1) {
    const d = Math.abs(ySvg - FRET_WIRE_Y_SVG[f]!);
    if (d < bestDist) {
      bestDist = d;
      bestFret = f;
    }
  }
  return bestFret;
}

/** String X at a given Y — strings fan nut → bridge in the art. */
export function se2GuitarStringXSvgAtY(stringIndex: number, ySvg: number): number {
  const nut = STRING_NUT_SVG[stringIndex] ?? STRING_NUT_SVG[0]!;
  const bridge = STRING_BRIDGE_SVG[stringIndex] ?? STRING_BRIDGE_SVG[0]!;
  const span = bridge.y - nut.y;
  if (span <= 0) return nut.x;
  const t = Math.max(0, Math.min(1, (ySvg - nut.y) / span));
  return nut.x + t * (bridge.x - nut.x);
}

/** String X on a fret (follows the slanted string line). */
export function se2GuitarStringXSvgAtFret(stringIndex: number, fret: number): number {
  return se2GuitarStringXSvgAtY(stringIndex, se2GuitarFretYSvg(fret));
}

/** String center X at the nut (portrait SVG units). */
export function se2GuitarStringXSvg(stringIndex: number): number {
  return STRING_NUT_SVG[stringIndex]?.x ?? STRING_NUT_SVG[0]!.x;
}

/** Fret Y in SVG user units — snapped to real fret wires. */
export function se2GuitarFretYSvg(fret: number): number {
  const f = Math.max(0, Math.min(SE2_GUITAR_FRET_COUNT, Math.round(fret)));
  return FRET_WIRE_Y_SVG[f] ?? FRET_WIRE_Y_SVG[0]!;
}

/** String center X in portrait SVG space (0–1). */
export function se2GuitarStringXFrac(stringIndex: number): number {
  return se2GuitarStringXSvg(stringIndex) / SE2_GUITAR_SVG_W;
}

/** Fret Y in portrait SVG space (0–1). */
export function se2GuitarFretYFrac(fret: number): number {
  return se2GuitarFretYSvg(fret) / SE2_GUITAR_SVG_H;
}

function se2GuitarYSvgToFret(ySvg: number): number {
  return se2GuitarFretFromLayerY(ySvg);
}

/** Map neck click (0–1 inside neck rect) → string + fret, or null if not on a string. */
export function se2GuitarNeckRelToCell(
  relX: number,
  relY: number,
): { stringIndex: number; fret: number } | null {
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

  const absX = SE2_GUITAR_NECK_SVG.x + relX * SE2_GUITAR_NECK_SVG.width;
  const absY = SE2_GUITAR_NECK_SVG.y + relY * SE2_GUITAR_NECK_SVG.height;

  let stringIndex = 0;
  let bestDist = Infinity;
  for (let s = 0; s < SE2_GUITAR_STRING_COUNT; s += 1) {
    const expectedX = se2GuitarStringXSvgAtY(s, absY);
    const d = Math.abs(expectedX - absX);
    if (d < bestDist) {
      bestDist = d;
      stringIndex = s;
    }
  }

  if (bestDist > SE2_GUITAR_STRING_HIT_RADIUS_SVG) return null;

  return { stringIndex, fret: se2GuitarYSvgToFret(absY) };
}

/** @deprecated Prefer se2GuitarNeckRelToCell — clamps misses to the nearest edge. */
export function se2GuitarNeckPointerToCell(
  relX: number,
  relY: number,
): { stringIndex: number; fret: number } {
  const hit = se2GuitarNeckRelToCell(
    Math.max(0, Math.min(1, relX)),
    Math.max(0, Math.min(1, relY)),
  );
  if (hit) return hit;
  const absY =
    SE2_GUITAR_NECK_SVG.y +
    Math.max(0, Math.min(1, relY)) * SE2_GUITAR_NECK_SVG.height;
  return { stringIndex: 0, fret: se2GuitarYSvgToFret(absY) };
}

/** Map layer1-local SVG coords → string + fret (strict — body/back clicks return null). */
export function se2GuitarSvgPointToCell(
  xSvg: number,
  ySvg: number,
): { stringIndex: number; fret: number } | null {
  const neck = SE2_GUITAR_NECK_SVG;
  const padX = 8;
  const padY = 12;
  if (
    xSvg < neck.x - padX ||
    xSvg > neck.x + neck.width + padX ||
    ySvg < neck.y - padY ||
    ySvg > neck.y + neck.height + padY
  ) {
    return null;
  }
  const relX = (xSvg - neck.x) / neck.width;
  const relY = (ySvg - neck.y) / neck.height;
  return se2GuitarNeckRelToCell(relX, relY);
}

/** Map root viewport pointer → string + fret. */
export function se2GuitarRootSvgPointToCell(
  rootX: number,
  rootY: number,
): { stringIndex: number; fret: number } | null {
  const { x, y } = se2GuitarRootToLayerLocal(rootX, rootY);
  return se2GuitarSvgPointToCell(x, y);
}

/** Map MIDI → fret dots for the neck display (always picks a visible position when possible). */
export function se2GuitarMidisToFretDots(
  midis: readonly number[],
  capo = 0,
): Se2GuitarFretDot[] {
  const seen = new Set<string>();
  const out: Se2GuitarFretDot[] = [];
  for (const m of midis) {
    let pos = se2GuitarMidiToFretPosition(m, capo);
    if (!pos) {
      const target = m - capo;
      let best: { stringIndex: number; fret: number; score: number } | null = null;
      for (let s = 0; s < SE2_GUITAR_STRING_COUNT; s += 1) {
        const fret = target - SE2_GUITAR_OPEN_STRING_MIDI[s]!;
        const clamped = Math.max(0, Math.min(SE2_GUITAR_FRET_COUNT, fret));
        const score = Math.abs(fret - clamped);
        if (!best || score < best.score) best = { stringIndex: s, fret: clamped, score };
      }
      if (best) pos = { stringIndex: best.stringIndex, fret: best.fret };
    }
    if (!pos) continue;
    const key = `${pos.stringIndex}:${pos.fret}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pos);
  }
  return out;
}

/** SVG dot anchor in layer1-local units (same space as string paths). */
export function se2GuitarDotSvgCoords(
  stringIndex: number,
  fret: number,
  capo = 0,
): { xNut: number; yNut: number; x: number; y: number } {
  const yNut = se2GuitarFretYSvg(capo > 0 ? Math.min(capo, SE2_GUITAR_FRET_COUNT) : 0);
  const y = se2GuitarFretYSvg(fret);
  return {
    xNut: se2GuitarStringXSvgAtY(stringIndex, yNut),
    yNut,
    x: se2GuitarStringXSvgAtFret(stringIndex, fret),
    y,
  };
}
