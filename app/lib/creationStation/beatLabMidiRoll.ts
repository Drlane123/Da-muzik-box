/** Beat Lab 32-channel piano roll — lane 1–16 = sampler pads, 17–32 = melodic MIDI. */

export const BEAT_LAB_PAD_LANES = 16;
export const BEAT_LAB_MELODIC_LANE_START = BEAT_LAB_PAD_LANES;
export const BEAT_LAB_MIDI_LANES = 32;
export const BEAT_LAB_ROLL_ROW_H = 17;
export const BEAT_LAB_ROLL_LABEL_W = 112;
export const BEAT_LAB_ROLL_RULER_H = 16;

export type BeatLabMidiNote = {
  /** Channel index 0–31 */
  lane: number;
  /** Pattern column (same grid as drum sequencer) */
  col: number;
  /** Length in columns (≥ 1) */
  len: number;
  /** 1–127, default 100 */
  vel?: number;
  /** Semitone offset from lane default pitch (−24…+24). FL per-note pitch / Slicex slice pitch. */
  pitchSemi?: number;
  /** Muted in pattern — still stored, not triggered (Logic/Cubase mute). */
  muted?: boolean;
};

export type BeatLabDeckFocus = 'roll' | 'sequence' | 'synth' | 'synth2';

/** Column width preset for step grid + piano roll (`min` = scrollable default, `max` = fit loop in view). */
export type BeatLabGridZoomMode = 'min' | 'max';

/** GRID view workspace layout (`default` = pads + grid, `full` = step grid editor only). */
export type BeatLabGridLayoutMode = 'default' | 'full';

export type { BeatLabEditTool } from './beatLabGridPaint';

export function beatLabMidiNoteKey(lane: number, col: number, pitchSemi = 0): string {
  return `${lane},${col},${pitchSemi}`;
}

export function normalizeBeatLabMidiNote(raw: unknown): BeatLabMidiNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<BeatLabMidiNote>;
  const lane = Math.round(Number(o.lane));
  const col = Math.round(Number(o.col));
  const len = Math.round(Number(o.len));
  if (!Number.isFinite(lane) || !Number.isFinite(col) || !Number.isFinite(len)) return null;
  if (lane < 0 || lane >= BEAT_LAB_MIDI_LANES || col < 0 || len < 1) return null;
  const vel = o.vel != null ? Math.max(1, Math.min(127, Math.round(Number(o.vel)))) : undefined;
  const pitchSemi =
    o.pitchSemi != null
      ? Math.max(-24, Math.min(24, Math.round(Number(o.pitchSemi))))
      : undefined;
  const muted = o.muted === true ? true : undefined;
  return {
    lane,
    col,
    len,
    ...(vel != null ? { vel } : {}),
    ...(pitchSemi != null ? { pitchSemi } : {}),
    ...(muted ? { muted: true } : {}),
  };
}

/** Split a note at `splitCol` (Cubase split / Logic scissors / FL slice). */
export function beatLabSplitMidiNoteAt(
  notes: BeatLabMidiNote[],
  lane: number,
  headCol: number,
  splitCol: number,
  maxCol: number,
): BeatLabMidiNote[] {
  const note = notes.find((n) => n.lane === lane && n.col === headCol);
  if (!note || splitCol <= headCol || splitCol >= headCol + note.len) return notes;
  const leftLen = splitCol - headCol;
  const rightLen = note.len - leftLen;
  const rest = notes.filter((n) => !(n.lane === lane && n.col === headCol));
  const vel = note.vel ?? 100;
  const muted = note.muted;
  return [
    ...rest,
    { lane, col: headCol, len: leftLen, vel, ...(muted ? { muted: true } : {}) },
    {
      lane,
      col: splitCol,
      len: clampBeatLabNoteLen(rightLen, splitCol, maxCol),
      vel,
      ...(muted ? { muted: true } : {}),
    },
  ];
}

export function normalizeBeatLabMidiRoll(notes: unknown): BeatLabMidiNote[] {
  if (!Array.isArray(notes)) return [];
  const out: BeatLabMidiNote[] = [];
  const seen = new Set<string>();
  for (const raw of notes) {
    const n = normalizeBeatLabMidiNote(raw);
    if (!n) continue;
    const key = beatLabMidiNoteKey(n.lane, n.col, n.pitchSemi ?? 0);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

export function clampBeatLabNoteLen(len: number, headCol: number, maxCol: number): number {
  const maxLen = Math.max(1, maxCol - headCol);
  return Math.max(1, Math.min(maxLen, Math.round(len)));
}

/** Pick a valid split column inside a note (FL slice tool). */
export function beatLabSliceColForPointer(
  headCol: number,
  len: number,
  clickCol: number,
): number | null {
  if (len <= 1) return null;
  let split = clickCol;
  if (split <= headCol) split = headCol + 1;
  if (split >= headCol + len) split = headCol + len - 1;
  return split > headCol && split < headCol + len ? split : null;
}

/** FL-style resize from note start — end column stays fixed. */
export function beatLabNoteResizeFromStartHead(
  headCol: number,
  len: number,
  newHeadCol: number,
  maxCol: number,
): { col: number; len: number } {
  const endCol = headCol + Math.max(1, len);
  const col = Math.max(0, Math.min(Math.round(newHeadCol), endCol - 1));
  return { col, len: clampBeatLabNoteLen(endCol - col, col, maxCol) };
}

/** True if placing `len` columns at `headCol` on `lane` overlaps any other note. */
export function beatLabRollNotesOverlap(
  notes: BeatLabMidiNote[],
  lane: number,
  headCol: number,
  len: number,
  excludeHead?: { lane: number; col: number },
): boolean {
  const end = headCol + Math.max(1, len);
  return notes.some((n) => {
    if (excludeHead && n.lane === excludeHead.lane && n.col === excludeHead.col) return false;
    if (n.lane !== lane) return false;
    const nEnd = n.col + Math.max(1, n.len);
    return headCol < nEnd && end > n.col;
  });
}

/** Default pitch for melodic lanes 17–32 (lane index 16–31). */
export function beatLabMelodicLanePitch(lane: number): number {
  const melodic = lane - BEAT_LAB_PAD_LANES;
  return 60 + Math.max(0, Math.min(15, melodic));
}

/**
 * Default MIDI for Synth V2 panel preview / held audition only.
 * Keeps `beatLabMelodicLanePitch` as the roll math base so saved `pitchSemi` notes do not jump octaves.
 * Register: ~C2–D#3 (bass-friendly) vs roll default C4-ish.
 */
export function beatLabMelodicSynthV2AuditionPitch(lane: number): number {
  const melodic = lane - BEAT_LAB_PAD_LANES;
  const m = Math.max(0, Math.min(15, melodic));
  return 36 + m;
}

export function beatLabLaneIsPad(lane: number): boolean {
  return lane >= 0 && lane < BEAT_LAB_PAD_LANES;
}

/**
 * Pad sample rate/detune for Beat Lab.
 * Tape (default): `playbackRate` shifts pitch + duration together.
 * Time-stretch: tempo via `playbackRate`, pitch via `detune` (Web Audio; good for moderate BPM sync).
 */
export function beatLabPadPlaybackRateDetune(
  bpmRate: number,
  fineSemi: number,
  timeStretch: boolean,
): { playbackRate: number; detuneCents: number } {
  const bpm = Math.min(4, Math.max(0.0625, bpmRate));
  const pitchMul = Math.pow(2, fineSemi / 12);
  if (!timeStretch) {
    const combined = bpm * pitchMul;
    return {
      playbackRate: Math.min(4, Math.max(0.0625, combined)),
      detuneCents: 0,
    };
  }
  const detuneCents = 1200 * Math.log2(pitchMul / bpm);
  return {
    playbackRate: bpm,
    detuneCents: Math.max(-2400, Math.min(2400, detuneCents)),
  };
}
