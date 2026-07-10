/** Beat Pads overlay — local 16-lane step sequencer (4/8/16 bars, 16th or 32nd grid). */

export const BEAT_PADS_LANE_COUNT = 16;
export const BEAT_PADS_STEPS_PER_BAR = 16;
export const BEAT_PADS_STEPS_PER_BAR_32 = 32;
export type BeatPadsGridStepsPerBar = 16 | 32;
export const BEAT_PADS_MIN_LOOP_BARS = 4;
export const BEAT_PADS_MAX_LOOP_BARS = 16;
export const BEAT_PADS_DEFAULT_LOOP_BARS = 8;

/** One note block on the 16th grid — len > 1 repeats the hit each step (hat roll). */
export type BeatPadsDrumNote = {
  id: string;
  start: number;
  len: number;
};

/** One lane = sorted note blocks (non-overlapping). */
export type BeatPadsDrumPattern = BeatPadsDrumNote[][];

let beatPadsNoteSeq = 0;

export function beatPadsNewNoteId(): string {
  beatPadsNoteSeq += 1;
  return `bp_${Date.now().toString(36)}_${beatPadsNoteSeq}`;
}

export function beatPadsLoopBarChoices(): readonly number[] {
  return [4, 8, 16] as const;
}

export function beatPadsStepsPerQuarter(stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR): number {
  return stepsPerBar / 4;
}

export function beatPadsPatternCols(
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): number {
  const bars = Math.max(
    BEAT_PADS_MIN_LOOP_BARS,
    Math.min(BEAT_PADS_MAX_LOOP_BARS, Math.round(loopBars)),
  );
  return bars * stepsPerBar;
}

export function emptyBeatPadsPattern(loopBars = BEAT_PADS_DEFAULT_LOOP_BARS): BeatPadsDrumPattern {
  return Array.from({ length: BEAT_PADS_LANE_COUNT }, () => []);
}

function isBooleanRow(row: unknown): row is boolean[] {
  return Array.isArray(row) && (row.length === 0 || typeof row[0] === 'boolean');
}

function isNoteRow(row: unknown): row is BeatPadsDrumNote[] {
  if (!Array.isArray(row) || row.length === 0) return Array.isArray(row);
  const first = row[0];
  return (
    first != null
    && typeof first === 'object'
    && 'start' in first
    && 'len' in first
  );
}

/** Import legacy boolean[][] or note lanes into normalized note pattern. */
export function normalizeBeatPadsPattern(
  pat: unknown,
  loopBars = BEAT_PADS_DEFAULT_LOOP_BARS,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): BeatPadsDrumPattern {
  const cols = beatPadsPatternCols(loopBars, stepsPerBar);
  if (!Array.isArray(pat)) return emptyBeatPadsPattern(loopBars);

  return Array.from({ length: BEAT_PADS_LANE_COUNT }, (_, pi) => {
    const row = pat[pi];
    if (isNoteRow(row)) {
      return row
        .map((n) => ({
          id: typeof n.id === 'string' ? n.id : beatPadsNewNoteId(),
          start: Math.max(0, Math.min(cols - 1, Math.round(n.start))),
          len: Math.max(1, Math.round(n.len)),
        }))
        .filter((n) => n.start < cols)
        .map((n) => ({ ...n, len: Math.min(n.len, cols - n.start) }))
        .sort((a, b) => a.start - b.start);
    }
    if (isBooleanRow(row)) {
      const notes: BeatPadsDrumNote[] = [];
      let i = 0;
      while (i < cols) {
        if (!row[i]) {
          i += 1;
          continue;
        }
        const start = i;
        while (i < cols && row[i]) i += 1;
        notes.push({ id: beatPadsNewNoteId(), start, len: i - start });
      }
      return notes;
    }
    return [];
  });
}

/** @deprecated Use beatPadsResizePatternToLoopBars from beatPadsPatternEdit.ts */
export function resizeBeatPadsPattern(
  pat: BeatPadsDrumPattern,
  nextLoopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): BeatPadsDrumPattern {
  const cols = beatPadsPatternCols(nextLoopBars, stepsPerBar);
  return Array.from({ length: BEAT_PADS_LANE_COUNT }, (_, lane) => {
    const notes = (pat[lane] ?? [])
      .map((n) => ({
        ...n,
        start: Math.max(0, Math.min(cols - 1, n.start)),
        len: Math.max(1, Math.min(cols - n.start, n.len)),
      }))
      .filter((n) => n.start < cols);
    return notes.sort((a, b) => a.start - b.start);
  });
}

/** @deprecated Use beatPadsDrawToggleAt from beatPadsPatternEdit.ts */
export function toggleBeatPadsStep(
  pat: BeatPadsDrumPattern,
  lane: number,
  col: number,
): BeatPadsDrumPattern {
  if (lane < 0 || lane >= BEAT_PADS_LANE_COUNT) return pat;
  const hit = (pat[lane] ?? []).find((n) => col >= n.start && col < n.start + n.len);
  if (hit) {
    return pat.map((row, ri) => (ri === lane ? row.filter((n) => n.id !== hit.id) : row));
  }
  const notes = [...(pat[lane] ?? []), { id: beatPadsNewNoteId(), start: col, len: 1 }];
  return pat.map((row, ri) =>
    ri === lane ? notes.sort((a, b) => a.start - b.start) : row,
  );
}

export function beatPadsStepIsDownbeat(
  col: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): boolean {
  return col % stepsPerBar === 0;
}

export function beatPadsStepIsBeat(
  col: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): boolean {
  return col % beatPadsStepsPerQuarter(stepsPerBar) === 0;
}

export function beatPadsBarIndex(
  col: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): number {
  return Math.floor(col / stepsPerBar);
}

export const BEAT_PADS_PATTERN_STORAGE_KEY = 'creationStation_beatPadsPattern_v1';

export type BeatPadsPatternStore = Record<
  string,
  { loopBars: number; pattern: BeatPadsDrumPattern; stepsPerBar?: BeatPadsGridStepsPerBar }
>;

export function loadBeatPadsPatternStore(): BeatPadsPatternStore {
  try {
    const raw = localStorage.getItem(BEAT_PADS_PATTERN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BeatPadsPatternStore;
  } catch {
    return {};
  }
}

export function saveBeatPadsPatternStore(store: BeatPadsPatternStore): void {
  try {
    localStorage.setItem(BEAT_PADS_PATTERN_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function beatPadsPatternBankKey(bankIndex: number): string {
  return String(bankIndex);
}

export const BEAT_PADS_MIN_BPM = 40;
export const BEAT_PADS_MAX_BPM = 240;

export function clampBeatPadsBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 120;
  return Math.max(BEAT_PADS_MIN_BPM, Math.min(BEAT_PADS_MAX_BPM, Math.round(bpm)));
}

/** One grid step at the given BPM (seconds). */
export function beatPadsStepDurationSec(
  bpm: number,
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): number {
  const stepsPerBeat = beatPadsStepsPerQuarter(stepsPerBar);
  return 60 / Math.max(1, clampBeatPadsBpm(bpm)) / stepsPerBeat;
}

export const BEAT_PADS_BPM_STORAGE_KEY = 'creationStation_beatPadsBpm_v1';

export type BeatPadsBpmStore = Record<string, number>;

export function loadBeatPadsBpmStore(): BeatPadsBpmStore {
  try {
    const raw = localStorage.getItem(BEAT_PADS_BPM_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BeatPadsBpmStore;
  } catch {
    return {};
  }
}

export function saveBeatPadsBpmStore(store: BeatPadsBpmStore): void {
  try {
    localStorage.setItem(BEAT_PADS_BPM_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}
