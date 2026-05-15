import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Download, Eraser, Link2, Pause, Play, Plus, Sparkles, Square, Volume2, Wand2, X } from 'lucide-react';

import {
  GENRES,
  KEY_ROOTS,
  MODE_LABELS,
  MODES_BY_FAMILY,
  PATTERNS,
  buildChordEvents,
  chordSymbolToMidi,
  chordSymbolToName,
  findProgressionsWithChord,
  getGenre,
  getModePads,
  getPattern,
  suggestLikelyNextChords,
  suggestNextChord,
  type ChordEventOut,
  type ChordMode,
  type ChordSymbol,
  type GenreDef,
  type ProgressionDef,
} from '@/app/lib/creationStation/chordBuilder';
import { renderChordTimelineToWav, renderSongToWav } from '@/app/lib/creationStation/chordRender';
import {
  CHORD_INSTRUMENTS,
  DEFAULT_CHORD_INSTRUMENT_ID,
  getChordInstrument,
  type ChordInstrumentId,
} from '@/app/lib/creationStation/chordInstruments';
import {
  generateSongPlan,
  type GeneratedSection,
} from '@/app/lib/creationStation/chordSongBuilder';
import {
  buildStandardMidiFile,
  downloadBytes,
  safeFilename,
  type MidiNoteEvent,
} from '@/app/lib/creationStation/midiExport';
import {
  CHORD_SUGGESTER_BACKENDS,
  DEFAULT_CHORD_SUGGESTER_ID,
  getAvailableChordSuggesterBackends,
  getChordSuggester,
  type ChordSuggester,
  type ChordSuggesterId,
  type ChordSuggestion,
} from '@/app/lib/creationStation/chordSuggester';
import {
  MAX_BLOCK_BEATS,
  MIN_BLOCK_BEATS,
  appendBlock,
  blocksToTimeline,
  cumulativeStartBeats,
  newBlockId,
  removeBlock,
  reorderBlock,
  replaceBlockChord,
  resizeBlock,
  timelineToBlocks,
  totalBlockBeats,
  type ChordBlock,
} from '@/app/lib/creationStation/chordBlocks';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.35)';
const MINT_BG  = 'rgba(124, 244, 198, 0.10)';
const MINT_BG_STRONG = 'rgba(124, 244, 198, 0.18)';

/** Custom MIME used to mark drag payloads coming from chord pads. */
const DND_CHORD_MIME = 'application/x-da-music-chord';

const PIANO_ROW_H = 14;
const PIANO_LABEL_W = 56;
const BAR_LABEL_H = 28;
/** Chord-block grid pixels per beat. Hoisted to module scope so the
 *  parent's rAF playhead animator can drive the grid's playhead element
 *  directly via DOM transform without having to ask the child for its
 *  internal pixel-per-beat constant. */
const GRID_PX_PER_BEAT = 36;
/** Height of the transport-ruler strip above the bar-header. Click / drag
 *  inside this strip positions the playhead. Kept narrow so it doesn't eat
 *  vertical space on the piano-roll itself. */
const RULER_H = 18;
const PIANO_BAR_MIN_W = 96;
/** Visible white-key length. Black keys are shorter, so the white key behind
 *  them is visible on the right side — matches a real piano viewed sideways. */
const PIANO_WHITE_KEY_W = PIANO_LABEL_W - 4;
const PIANO_BLACK_KEY_W = Math.round(PIANO_LABEL_W * 0.62);

const NOTE_NAMES_CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Piano-roll pitch range — 3 full octaves (C3..C6). Wide enough that 7th chords
 *  and high-root keys don't have to octave-compress their voicings to display. */
const PIANO_HIGH_OCT = 6;
const PIANO_LOW_OCT = 3;
const PREVIEW_BAND_LOW = (PIANO_LOW_OCT + 1) * 12;  // MIDI 48 (C3)
const PREVIEW_BAND_HIGH = (PIANO_HIGH_OCT + 1) * 12; // MIDI 84 (C6)

const PIANO_ROWS: string[] = (() => {
  const rows: string[] = [];
  rows.push(`C${PIANO_HIGH_OCT}`);
  for (let oct = PIANO_HIGH_OCT - 1; oct >= PIANO_LOW_OCT; oct--) {
    for (let i = 11; i >= 0; i--) {
      rows.push(`${NOTE_NAMES_CHROMATIC[i]}${oct}`);
    }
  }
  return rows;
})();

const PIANO_BLACK_ROWS = new Set<string>(
  PIANO_ROWS.filter((n) => n.includes('#')),
);

function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES_CHROMATIC[midi % 12]!;
  const oct = Math.floor(midi / 12) - 1;
  return `${name}${oct}`;
}

function noteNameToMidi(name: string): number {
  const m = /^([A-G]#?)(-?\d+)$/.exec(name);
  if (!m) return -1;
  const idx = NOTE_NAMES_CHROMATIC.indexOf(m[1]!);
  if (idx < 0) return -1;
  return (parseInt(m[2]!, 10) + 1) * 12 + idx;
}

export interface ChordBuilderTabProps {
  active: boolean;
  /** Triggered when user clicks the close (×) button or hits Escape. Host should switch tab. */
  onClose: () => void;
  /** Project BPM — drives the in-panel playback tempo. */
  bpm: number;
  /** Quarter-note columns per bar (matches Creation Station MEASURES_PER_BAR). */
  colsPerBar: number;
  /** Optional audio context for audition (chord preview). If null, audition is silent. */
  getAudioContext: () => AudioContext | null;
  /**
   * Bounce the active progression to a WAV and drop it on a Beat-Lab
   * sample pad (1–16). The host is responsible for actually persisting the
   * sample, decoding it into the running buffer map, and updating any
   * presence / label state. Omit to hide the "Export WAV to Pad" button.
   */
  onExportToPad?: (args: {
    /** 0-based pad index — Beat-Lab lane 1 == 0. */
    padIndex: number;
    /** Complete RIFF/WAVE bytes. The host can persist these as-is. */
    wavBytes: Uint8Array;
    /** Display label suggested by the builder (chord list, etc.). */
    label: string;
    /** BPM the chord was rendered at — useful for tape-style tempo sync
     *  inside Beat Lab's sampler. */
    rootBpm: number;
  }) => void;
}

interface TimelineSlot {
  chord: ChordSymbol | null;
}

/** Quarter-notes per bar in 4/4 time. Matches the piano roll's `colsPerBar`
 *  (4 quarter-note columns) and the ChordSeqAI timeline convention (a beat
 *  is the natural snap unit). Used everywhere the chord-block model needs
 *  to convert between bars and beats. */
const BEATS_PER_BAR = 4;

/**
 * Active progression in Chord Builder.
 *
 * `blocks` is the source of truth for chord identity AND duration —
 * beat-precise so the chord-block grid can resize freely. `timeline` is
 * a bar-precise mirror that the piano roll consumes; it's regenerated by
 * `updateActive` whenever `blocks` changes, and (for legacy callers that
 * still write `timeline` directly) `updateActive` also derives `blocks`
 * back from the timeline at bar precision.
 *
 * Migration: progressions persisted before the blocks model existed only
 * have `timeline`. The {@link migrateProgression} helper backfills
 * `blocks` from `timeline` on first read so we never carry around a
 * Progression with `blocks: undefined`.
 */
interface Progression {
  id: string;
  name: string;
  blocks: ChordBlock[];
  timeline: TimelineSlot[];
  totalBars: number;
  barsPerChord: number;
  patternId: string;
}

let progressionCounter = 0;
function newProgressionId(): string {
  progressionCounter += 1;
  return `cb-prog-${Date.now().toString(36)}-${progressionCounter}`;
}

function emptyTimeline(bars: number): TimelineSlot[] {
  return Array.from({ length: bars }, () => ({ chord: null }));
}

function createProgression(name: string): Progression {
  return {
    id: newProgressionId(),
    name,
    blocks: [],
    timeline: emptyTimeline(8),
    totalBars: 8,
    barsPerChord: 1,
    patternId: PATTERNS[0]!.id,
  };
}

/** Backfill `blocks` for any Progression that pre-dates the blocks model.
 *  Pure function — returns the same object reference if no change needed
 *  so the React state doesn't churn on every render. */
function migrateProgression(p: Progression): Progression {
  if (p.blocks && p.blocks.length > 0) return p;
  // Either missing or empty `blocks` — derive from timeline. (An
  // intentionally-cleared progression has empty blocks AND empty
  // timeline, which is also a no-op.)
  const blocks = timelineToBlocks(p.timeline, BEATS_PER_BAR);
  if (blocks.length === 0 && (!p.blocks || p.blocks.length === 0)) {
    // Nothing to derive — make sure `blocks` is at least an empty array,
    // not undefined, so future writes don't have to null-check.
    return p.blocks === undefined ? { ...p, blocks: [] } : p;
  }
  return { ...p, blocks };
}

export function ChordBuilderTab({
  active,
  onClose,
  bpm,
  colsPerBar,
  getAudioContext,
  onExportToPad,
}: ChordBuilderTabProps) {
  const [keyRoot, setKeyRoot] = useState(0);
  const [mode, setMode] = useState<ChordMode>('major');
  const [genreId, setGenreId] = useState(GENRES[0]!.id);
  const [selectedPad, setSelectedPad] = useState<ChordSymbol>('I');
  const [progressions, setProgressions] = useState<Progression[]>(() => [
    createProgression('Verse'),
  ]);
  const [activeId, setActiveId] = useState<string>(() => progressions[0]?.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  /** The playhead lives at a specific *column* of the timeline (one column
   *  per 1/N-of-a-bar subdivision — typically 1/16 notes). This is finer
   *  than per-bar so the user can drop it anywhere inside a bar, like a
   *  real DAW. Always ≥ 0; pause preserves position, Stop resets it to 0. */
  const [playheadCol, setPlayheadCol] = useState<number>(0);
  const playheadColRef = useRef(0);
  // Only sync React state → ref when NOT playing. During playback the rAF
  // loop owns this ref (writes the live audio-clock position into it every
  // frame). Resetting the ref from stale React state on every parent
  // re-render would yank the playhead backward whenever something like
  // `setPlayingMidis` ticks mid-playback.
  if (!isPlaying) {
    playheadColRef.current = playheadCol;
  }

  // ── Direct-DOM playhead animator refs ────────────────────────────────
  // The playhead is the only thing on screen that needs to update at
  // ~60 fps. Driving it through React `setState` per frame re-renders
  // the entire Chord Builder tree (header, toolbar, tabs, piano roll,
  // chord-block grid) and the per-frame cost is enough to make the line
  // look like it skips. Instead we keep React state mostly stationary
  // during playback and write `transform: translateX(...)` straight onto
  // the playhead DOM nodes from a requestAnimationFrame loop. The child
  // components attach their playhead `<div>` elements to these refs.
  const pianoPlayheadElRef = useRef<HTMLDivElement | null>(null);
  const gridPlayheadElRef = useRef<HTMLDivElement | null>(null);
  /** Bumped whenever the user repositions the playhead while playback is
   *  active. Adding this to the play-effect deps causes the effect to tear
   *  down and re-run so the tick loop restarts from the new playhead column
   *  (otherwise the next setTimeout tick would overwrite the scrub). */
  const [playStartKey, setPlayStartKey] = useState(0);
  const [dragTargetBar, setDragTargetBar] = useState<number | null>(null);
  const [localBpm, setLocalBpm] = useState<number>(() => Math.max(20, Math.min(300, Math.round(bpm))));
  /** When true, the chord-builder preview tempo mirrors the project BPM
   *  (the `bpm` prop from Creation Station). Toggled OFF automatically when
   *  the user does anything tempo-related here (types a BPM, clicks ± or
   *  tap-tempos) so the local override sticks until they re-sync. */
  const [syncToProject, setSyncToProject] = useState<boolean>(true);
  /** Currently selected Sound Bank voice id. Drives both the live audition
   *  path (`playMidiSet`) and the offline WAV bouncer. Mirrored into a ref so
   *  the playback callback can read it without taking it as a dep. */
  const [instrumentId, setInstrumentId] = useState<ChordInstrumentId>(DEFAULT_CHORD_INSTRUMENT_ID);
  const instrumentIdRef = useRef<ChordInstrumentId>(instrumentId);
  instrumentIdRef.current = instrumentId;
  // While Sync is on, keep `localBpm` in lockstep with the host project BPM.
  // Without this effect, changing the project BPM in Beat Lab wouldn't be
  // reflected here even with the sync indicator lit.
  useEffect(() => {
    if (!syncToProject) return;
    const clamped = Math.max(20, Math.min(300, Math.round(bpm)));
    setLocalBpm((prev) => (prev === clamped ? prev : clamped));
  }, [bpm, syncToProject]);
  /** Set the local BPM AND turn off Sync — used by the user-facing tempo
   *  inputs (+ / − buttons, input field, Tap Tempo). The user expressing a
   *  tempo preference here always trumps "follow project BPM". */
  const setLocalBpmAndUnsync = useCallback((v: number) => {
    setLocalBpm(Math.max(20, Math.min(300, Math.round(v))));
    setSyncToProject(false);
  }, []);
  /** Tap-tempo: ring of recent tap timestamps. Resets after a 2-second
   *  pause so the user can re-tap with a clean slate. */
  const tapTimesRef = useRef<number[]>([]);
  const onTapTempo = useCallback(() => {
    const now = performance.now();
    const last = tapTimesRef.current[tapTimesRef.current.length - 1] ?? -Infinity;
    if (now - last > 2000) tapTimesRef.current = [];
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 8) tapTimesRef.current.shift();
    if (tapTimesRef.current.length < 2) return;
    const arr = tapTimesRef.current;
    let sum = 0;
    for (let i = 1; i < arr.length; i++) sum += arr[i]! - arr[i - 1]!;
    const avgMs = sum / (arr.length - 1);
    const tappedBpm = Math.round(60000 / avgMs);
    if (tappedBpm >= 20 && tappedBpm <= 300) setLocalBpmAndUnsync(tappedBpm);
  }, [setLocalBpmAndUnsync]);
  // Manual note edits, keyed by progression id. `added` and `removed` are
  // sets of "row,col" cell keys where the user has explicitly added a note
  // not in the chord, or removed a note the chord would otherwise have.
  // `lengths` is a map from cell-key → column length (≥ 1) for notes the
  // user has stretched out via the right-edge resize handle (slow blues,
  // sustained ballads, etc.). Default length is 1 (a single cell); lengths
  // are capped at the end of the note's bar so a note never crosses bars.
  // Layered on top of the chord-derived preview events so the chord
  // abstraction stays intact while the user is free to fine-tune voicings.
  const [manualEditsById, setManualEditsById] = useState<
    Record<
      string,
      {
        added: ReadonlySet<string>;
        removed: ReadonlySet<string>;
        lengths: ReadonlyMap<string, number>;
      }
    >
  >({});

  const genre = useMemo<GenreDef>(() => getGenre(genreId) ?? GENRES[0]!, [genreId]);
  const padsForMode = useMemo(() => getModePads(mode), [mode]);

  // Map every chord that's currently placed in the active progression to its
  // first-appearance step number (1-based) and an "appears N times" count.
  // The Chord-Scale strip uses this to keep those pads visually LIT so the
  // user can scan them as a mini-progression and tap each one in order to
  // audition the song's chord set ("press each one of 'em and listen to 'em
  // as they change"). Recomputed when the active progression's timeline
  // changes — switching progressions automatically updates the highlight.
  const progressionPadInfo = useMemo(() => {
    const stepByChord = new Map<ChordSymbol, number>();
    const countByChord = new Map<ChordSymbol, number>();
    let nextStep = 1;
    const timeline = progressions.find((p) => p.id === activeId)?.timeline ?? [];
    for (const slot of timeline) {
      if (!slot.chord) continue;
      countByChord.set(slot.chord, (countByChord.get(slot.chord) ?? 0) + 1);
      if (!stepByChord.has(slot.chord)) {
        stepByChord.set(slot.chord, nextStep);
        nextStep += 1;
      }
    }
    return { stepByChord, countByChord };
  // We intentionally rebuild whenever the active progression list changes;
  // `progressions` is the only thing the find depends on (the chosen id is
  // stable across edits).
  }, [progressions, activeId]);

  // Keep the selected chord pad valid for the active mode. When the user
  // switches modes the old pad symbol (e.g. "vii°" in major) might not exist
  // in the new mode (e.g. dorian), so snap to that mode's tonic.
  useEffect(() => {
    if (!padsForMode.includes(selectedPad)) {
      setSelectedPad(padsForMode[0] ?? 'I');
    }
  }, [padsForMode, selectedPad]);

  const activeProg = progressions.find((p) => p.id === activeId) ?? progressions[0]!;
  const pattern = useMemo(() => getPattern(activeProg.patternId) ?? PATTERNS[0]!, [activeProg.patternId]);


  /**
   * Apply a patch to the active progression and auto-sync the
   * blocks ↔ timeline relationship.
   *
   * Sync rules:
   *  - Patch contains `blocks` → re-derive `timeline` from those blocks
   *    at bar precision. New `totalBars` defaults to the larger of the
   *    existing value and the bars needed to fit the blocks.
   *  - Patch contains `timeline` (legacy callers) → re-derive `blocks`
   *    from that timeline at bar precision.
   *  - Patch contains BOTH → trust the caller, run no derivation.
   *  - Patch contains neither → plain merge (e.g. renaming the prog).
   *
   * This keeps the chord-block grid and the piano roll talking to the
   * same data without forcing every call site to know about both sides.
   */
  const updateActive = useCallback(
    (patch: Partial<Progression>) => {
      setProgressions((prev) =>
        prev.map((p) => {
          if (p.id !== activeProg.id) return p;
          const merged: Progression = { ...p, ...patch };
          const blocksInPatch = 'blocks' in patch;
          const timelineInPatch = 'timeline' in patch;
          if (blocksInPatch && !timelineInPatch) {
            // Blocks-only write — derive timeline + grow totalBars to fit.
            const beats = totalBlockBeats(merged.blocks);
            const barsNeeded = Math.max(
              1,
              Math.ceil(beats / BEATS_PER_BAR),
            );
            const nextTotalBars = Math.max(merged.totalBars, barsNeeded);
            merged.totalBars = nextTotalBars;
            merged.timeline = blocksToTimeline(
              merged.blocks,
              nextTotalBars,
              BEATS_PER_BAR,
            );
          } else if (timelineInPatch && !blocksInPatch) {
            // Legacy timeline write — re-derive blocks at bar precision.
            merged.blocks = timelineToBlocks(merged.timeline, BEATS_PER_BAR);
          }
          return merged;
        }),
      );
    },
    [activeProg.id],
  );

  useEffect(() => {
    if (!activeProg) return;
    if (activeProg.timeline.length === activeProg.totalBars) return;
    const next = Array.from({ length: activeProg.totalBars }, (_, i) => activeProg.timeline[i] ?? { chord: null });
    updateActive({ timeline: next });
  }, [activeProg, updateActive]);

  function onGenreChange(id: string) {
    const next = getGenre(id);
    if (!next) return;
    setGenreId(id);
    setMode(next.mode);
    setSelectedPad(getModePads(next.mode)[0] ?? 'I');
  }

  function placeChordAt(barIdx: number, chord: ChordSymbol | null) {
    const tl = activeProg.timeline.slice();
    while (tl.length <= barIdx) tl.push({ chord: null });
    tl[barIdx] = { chord };
    const newTotal = Math.max(activeProg.totalBars, tl.length);
    updateActive({ timeline: tl, totalBars: newTotal });
  }

  function onPickPreset(progression: ChordSymbol[]) {
    const newBarsTotal = Math.max(progression.length, activeProg.totalBars);
    const newTimeline: TimelineSlot[] = Array.from({ length: newBarsTotal }, (_, i) => ({
      chord: progression[i] ?? null,
    }));
    updateActive({ timeline: newTimeline, totalBars: newBarsTotal });
  }

  /** Find the bar index *after* the last placed chord. Used by every
   *  "append" path (Likely Next chips, double-click pad, Suggest Next) so
   *  proposed chords always continue the progression as a "bridge" rather
   *  than jumping back to the first empty bar at the start of the timeline. */
  function bridgeIndex(): number {
    const tl = activeProg.timeline;
    for (let i = tl.length - 1; i >= 0; i--) {
      if (tl[i]!.chord) return i + 1;
    }
    return 0;
  }

  /** Append a single chord to the active progression. Used by the "Likely
   *  Next" suggestion chips — clicking one drops the proposed chord into the
   *  bar after your last placed chord (growing the timeline if needed). */
  function appendChord(chord: ChordSymbol) {
    const tl = activeProg.timeline;
    const targetIdx = bridgeIndex();
    if (targetIdx >= tl.length) {
      updateActive({
        timeline: [...tl, { chord }],
        totalBars: tl.length + 1,
      });
    } else {
      const cp = tl.slice();
      cp[targetIdx] = { chord };
      updateActive({ timeline: cp });
    }
    setSelectedPad(chord);
    auditionChord(chord);
  }

  /** Append the highest-confidence next chord from the active suggester
   *  backend. Uses the freshly computed `suggestions` state when available
   *  (top entry), and falls back to the legacy `suggestNextChord` mining
   *  helper when the strip is still loading — same chord space, same data
   *  source, so the fallback never produces an out-of-mode pick. */
  function onSuggestNext() {
    const tl = activeProg.timeline;
    let last: ChordSymbol | null = null;
    for (let i = tl.length - 1; i >= 0; i--) {
      if (tl[i]!.chord) {
        last = tl[i]!.chord;
        break;
      }
    }
    const nextChord = suggestions[0]?.chord ?? suggestNextChord(last, genre);
    const targetIdx = bridgeIndex();
    if (targetIdx >= tl.length) {
      updateActive({
        timeline: [...tl, { chord: nextChord }],
        totalBars: tl.length + 1,
      });
    } else {
      const cp = tl.slice();
      cp[targetIdx] = { chord: nextChord };
      updateActive({ timeline: cp });
    }
  }

  function onGenerateProgression() {
    const length = Math.max(4, Math.min(activeProg.totalBars, 8));
    let prev: ChordSymbol | null = null;
    const out: TimelineSlot[] = [];
    for (let i = 0; i < length; i++) {
      const next = suggestNextChord(prev, genre);
      out.push({ chord: next });
      prev = next;
    }
    while (out.length < activeProg.totalBars) out.push({ chord: null });
    updateActive({ timeline: out });
  }

  function onClearTimeline() {
    updateActive({ timeline: emptyTimeline(activeProg.totalBars) });
  }

  function onBarLabelClick(barIdx: number) {
    const existing = activeProg.timeline[barIdx]?.chord ?? null;
    placeChordAt(barIdx, existing === selectedPad ? null : selectedPad);
  }

  function onTotalBarsChange(v: number) {
    const clamped = Math.max(1, Math.min(64, v));
    updateActive({ totalBars: clamped });
  }

  function onBarsPerChordChange(v: number) {
    updateActive({ barsPerChord: v });
  }

  function onPatternChange(id: string) {
    updateActive({ patternId: id });
  }

  function onAddProgression() {
    const n = progressions.length + 1;
    const presetNames = ['Verse', 'Chorus', 'Bridge', 'Pre-Chorus', 'Intro', 'Outro'];
    const name = presetNames[n - 1] ?? `Section ${n}`;
    const created = createProgression(name);
    setProgressions((prev) => [...prev, created]);
    setActiveId(created.id);
  }

  function onRemoveProgression(id: string) {
    if (progressions.length <= 1) return;
    setProgressions((prev) => prev.filter((p) => p.id !== id));
    if (id === activeId) {
      const remaining = progressions.filter((p) => p.id !== id);
      if (remaining.length > 0) setActiveId(remaining[0]!.id);
    }
  }

  function onRenameProgression(id: string, name: string) {
    setProgressions((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  // ── Chord-block grid state ────────────────────────────────────────────
  // The new beat-precise chord grid (below the AI Suggestions strip)
  // tracks its own "selected block" cursor separate from `selectedPad`
  // (which is a chord symbol on the chord-scale rail). Selecting a block
  // also re-selects its chord on the scale, so the two strips stay
  // visually in sync.
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // ── Piano roll size mode ──────────────────────────────────────────────
  // The piano roll is the largest panel in Chord Builder; users want to
  // be able to bring it forward when they're tweaking note details and
  // tuck it out of the way when they're arranging chords up in the grid.
  //
  //   compact  → in-flow, ~140 px tall (just shows the chord-voicing rows)
  //   normal   → in-flow, flex:1 (default, fills remaining viewport)
  //   expanded → overlay, ~80vh covering the strips above — best for
  //              focused note editing; collapse button returns it to normal
  const [pianoRollMode, setPianoRollMode] = useState<
    'compact' | 'normal' | 'expanded'
  >('normal');

  // ── AI panel collapse ─────────────────────────────────────────────────
  // The AI Suggestions strip + Chord Block Grid combine into a single
  // collapsible "AI / Grid" tab. Default is collapsed so the piano roll
  // gets more vertical room and the user sees their chord progressions
  // applied to the roll as soon as they pick chords. Click the tab to
  // open it when you want suggestions or beat-precise grid editing.
  const [aiPanelOpen, setAiPanelOpen] = useState(false);


  /** Replace the chord-symbol of an existing block (preserves duration).
   *  Used by the grid when the user drops a different chord pad onto a
   *  block, or when the AI Suggestions strip picks for the selected
   *  block. */
  function onGridReplaceBlockChord(blockId: string, chord: ChordSymbol) {
    updateActive({ blocks: replaceBlockChord(activeProg.blocks, blockId, chord) });
    setSelectedPad(chord);
    auditionChord(chord);
  }

  /** Resize a block to a new beat-count. Called on every mouse move
   *  during a drag, so callers should clamp + snap before invoking. */
  function onGridResizeBlock(blockId: string, durationBeats: number) {
    updateActive({ blocks: resizeBlock(activeProg.blocks, blockId, durationBeats) });
  }

  /** Remove the currently-selected block. Bound to Delete / Backspace
   *  while the grid (or one of its blocks) has focus. */
  function onGridRemoveBlock(blockId: string) {
    updateActive({ blocks: removeBlock(activeProg.blocks, blockId) });
    setSelectedBlockId((prev) => (prev === blockId ? null : prev));
  }

  /** Append a brand-new block at the end of the progression. Default
   *  duration is one bar so the user has somewhere visible to drag-
   *  resize from. Auto-selects the new block so subsequent chord-pad
   *  drops target it. */
  function onGridAppendBlock(chord: ChordSymbol) {
    const next = appendBlock(activeProg.blocks, chord, BEATS_PER_BAR);
    updateActive({ blocks: next });
    setSelectedBlockId(next[next.length - 1]?.id ?? null);
    setSelectedPad(chord);
    auditionChord(chord);
  }

  /** Move a block to a new index in the progression. Wired by the grid's
   *  drag-to-reorder handler. */
  function onGridReorderBlock(fromIndex: number, toIndex: number) {
    updateActive({ blocks: reorderBlock(activeProg.blocks, fromIndex, toIndex) });
  }

  /** Status toast for the Auto-Generate Song button. Cleared automatically
   *  after a short delay so it doesn't permanently take up tab-strip space. */
  const [autoGenStatus, setAutoGenStatus] = useState<string | null>(null);
  const autoGenStatusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (autoGenStatusTimerRef.current != null) {
        window.clearTimeout(autoGenStatusTimerRef.current);
        autoGenStatusTimerRef.current = null;
      }
    };
  }, []);

  // ── AI Suggestions backend ────────────────────────────────────────────
  // The "AI SUGGESTIONS" strip below the chord-scale renders top-K next
  // chords from a pluggable backend (rule-based today, ChordSeqAI ONNX
  // later — see chordSuggester.ts). Backend selection lives in component
  // state so future model-picker UI can switch engines at runtime.
  const [suggesterId, setSuggesterId] = useState<ChordSuggesterId>(DEFAULT_CHORD_SUGGESTER_ID);
  const [suggester, setSuggester] = useState<ChordSuggester | null>(null);
  const [suggestions, setSuggestions] = useState<ChordSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggesterError, setSuggesterError] = useState<string | null>(null);
  // Bump on every recompute so a stale in-flight resolve can't clobber a
  // newer result (rule-based resolves sync but ONNX won't, and we want the
  // same guard in both paths so swapping backends is risk-free).
  const suggestRequestIdRef = useRef(0);

  // Load (or reload) the backend whenever the picker selection changes.
  useEffect(() => {
    let cancelled = false;
    setSuggesterError(null);
    void getChordSuggester(suggesterId)
      .then((s) => {
        if (!cancelled) setSuggester(s);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setSuggesterError(msg);
        // Fall back to rule-based so the strip never goes dark.
        if (suggesterId !== DEFAULT_CHORD_SUGGESTER_ID) {
          setSuggesterId(DEFAULT_CHORD_SUGGESTER_ID);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [suggesterId]);

  // Timeline context the suggester sees — the chord-symbol slice of the
  // active progression so far. Stable identity via useMemo so the
  // downstream recompute effect doesn't fire on every re-render.
  const timelineContext = useMemo<ChordSymbol[]>(
    () =>
      activeProg.timeline
        .map((s) => s.chord)
        .filter((c): c is ChordSymbol => Boolean(c)),
    [activeProg.timeline],
  );

  // Recompute the top-K suggestions whenever the backend, context, genre,
  // mode, or key changes. Top-K = 6 mirrors the existing "LIKELY NEXT"
  // chip row so the two strips visually balance each other.
  useEffect(() => {
    if (!suggester) return;
    const requestId = ++suggestRequestIdRef.current;
    setSuggestionsLoading(true);
    void suggester
      .suggest({
        context: timelineContext,
        genre,
        mode,
        keyRoot,
        topK: 6,
      })
      .then((result) => {
        if (suggestRequestIdRef.current !== requestId) return;
        setSuggestions(result);
        setSuggestionsLoading(false);
      })
      .catch((err) => {
        if (suggestRequestIdRef.current !== requestId) return;
        const msg = err instanceof Error ? err.message : String(err);
        setSuggesterError(msg);
        setSuggestions([]);
        setSuggestionsLoading(false);
      });
  }, [suggester, timelineContext, genre, mode, keyRoot]);

  /** Auto-Generate Song. Reads the active progression's timeline as the
   *  seed, asks `generateSongPlan` for Intro / Pre-Chorus / Chorus / Bridge
   *  / Outro section chord lists, then APPENDS each as a new progression
   *  tab. The active tab is never modified — the user's verse stays put,
   *  and the auto-generated sections sit next to it for review / editing.
   *
   *  If a section's name collides with an existing tab, we suffix with a
   *  number ("Intro 2", "Chorus 3") so the user can run auto-gen multiple
   *  times without losing prior attempts. */
  function onAutoGenerateSong() {
    const seed = activeProg.timeline
      .map((s) => s.chord)
      .filter((c): c is ChordSymbol => Boolean(c));
    if (seed.length === 0) {
      flashAutoGenStatus('Add chords to the active tab first, then auto-generate.');
      return;
    }
    let plan: GeneratedSection[];
    try {
      plan = generateSongPlan({ seed, mode });
    } catch (err) {
      flashAutoGenStatus(err instanceof Error ? err.message : 'Auto-generate failed.');
      return;
    }

    // Disambiguate section names against existing tabs so repeated runs
    // don't silently overwrite anything. We build the new list in one go
    // so name lookups stay consistent across all 5 new sections.
    const existingNames = new Set(progressions.map((p) => p.name));
    function uniqueName(base: string): string {
      if (!existingNames.has(base)) {
        existingNames.add(base);
        return base;
      }
      let n = 2;
      while (existingNames.has(`${base} ${n}`)) n += 1;
      const candidate = `${base} ${n}`;
      existingNames.add(candidate);
      return candidate;
    }

    // Each generated section becomes a new Progression. Bars-per-chord
    // matches the active tab so timing feels consistent across sections;
    // totalBars sizes to `chords.length * barsPerChord`.
    const barsPerChord = activeProg.barsPerChord;
    const patternId = activeProg.patternId;
    const newProgressions: Progression[] = plan.map((section) => {
      const totalBars = Math.max(1, section.chords.length * barsPerChord);
      const timeline: TimelineSlot[] = [];
      for (let i = 0; i < totalBars; i++) timeline.push({ chord: null });
      // Place each chord at the start of its allotted barsPerChord block.
      for (let i = 0; i < section.chords.length; i++) {
        const slotIdx = i * barsPerChord;
        if (slotIdx < timeline.length) {
          timeline[slotIdx] = { chord: section.chords[i]! };
        }
      }
      // Build the matching blocks sequence — one block per chord, each
      // spanning the section's `barsPerChord` so playback and the grid
      // see the same durations the timeline implies.
      const blocks: ChordBlock[] = section.chords.map((chord) => ({
        id: newBlockId(),
        chord,
        durationBeats: barsPerChord * BEATS_PER_BAR,
      }));
      return {
        id: newProgressionId(),
        name: uniqueName(section.name),
        blocks,
        timeline,
        totalBars,
        barsPerChord,
        patternId,
      };
    });

    const firstNewId = newProgressions[0]?.id ?? activeId;
    setProgressions((prev) => [...prev, ...newProgressions]);
    setActiveId(firstNewId); // jump to the first generated section so they see it immediately
    flashAutoGenStatus(
      `Generated ${newProgressions.length} sections: ${newProgressions
        .map((p) => p.name)
        .join(' · ')}`,
    );
  }

  function flashAutoGenStatus(msg: string): void {
    setAutoGenStatus(msg);
    if (autoGenStatusTimerRef.current != null) {
      window.clearTimeout(autoGenStatusTimerRef.current);
    }
    autoGenStatusTimerRef.current = window.setTimeout(() => {
      setAutoGenStatus(null);
      autoGenStatusTimerRef.current = null;
    }, 6000);
  }

  const auditionTimerRef = useRef<number | null>(null);
  const auditionGainsRef = useRef<GainNode[]>([]);
  const highlightTimerRef = useRef<number | null>(null);
  /** MIDI numbers currently being sounded — drives piano-key highlight. */
  const [playingMidis, setPlayingMidis] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );

  // Stash the parent's inline-arrow callbacks (CreationStationScreen creates
  // a fresh function reference on every parent render) in refs. Without this,
  // every Chord Builder effect that closes over them would tear down + re-run
  // on every parent re-render — including the Beat Lab playback updates that
  // re-render the parent dozens of times per second. That churn is enough to
  // perturb the shared AudioContext and is the most likely cause of the
  // Beat Lab metronome "skipping / pausing" you can see after using Chord
  // Builder. Refs make the prop identity stable for Chord Builder's internal
  // dep-tracking without losing the live behavior of the callbacks.
  const getAudioContextRef = useRef(getAudioContext);
  getAudioContextRef.current = getAudioContext;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onExportToPadRef = useRef(onExportToPad);
  onExportToPadRef.current = onExportToPad;
  /** Stable wrapper that reads the live `onClose` from the ref. Same surface
   *  area as the original prop, but the function identity never changes so
   *  effects depending on it never re-run unnecessarily. */
  const stableOnClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  /** Trigger oscillator(s) for a fixed set of MIDI pitches and light up the
   *  corresponding piano keys for the duration of `sustain` seconds.
   *
   *  Routes through the currently selected Sound Bank voice (`instrumentIdRef`)
   *  so the chord audition sounds identical to the WAV bounce.
   *
   *  Reads `getAudioContext` from a ref so this callback's identity stays
   *  stable across parent re-renders — important because it's transitively
   *  in the dep list of the chord-playback effect. */
  const playMidiSet = useCallback(
    (midis: number[], sustain: number) => {
      const ctx = getAudioContextRef.current();
      if (!ctx || midis.length === 0) return;
      if (ctx.state === 'suspended') void ctx.resume();
      if (auditionTimerRef.current != null) {
        window.clearTimeout(auditionTimerRef.current);
        auditionTimerRef.current = null;
      }
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      // Cancel envelopes from the previous trigger so back-to-back pad taps
      // don't pile up into a wall of overlapping voices. setTargetAtTime
      // with a 40 ms time-constant produces an inaudible fade-out — works
      // for both percussive and sustained envelope shapes.
      auditionGainsRef.current.forEach((g) => {
        try {
          g.gain.cancelScheduledValues(ctx.currentTime);
          g.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
        } catch {
          /* noop */
        }
      });
      auditionGainsRef.current = [];
      const now = ctx.currentTime + 0.005;
      const master = (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain ?? null;
      const dest: AudioNode = master ?? ctx.destination;
      const instrument = getChordInstrument(instrumentIdRef.current);
      for (const midi of midis) {
        const envs = instrument.scheduleNote({
          ctx,
          destination: dest,
          midi,
          startTime: now,
          sustainSec: sustain,
        });
        for (const env of envs) auditionGainsRef.current.push(env);
      }
      setPlayingMidis(new Set(midis));
      const ms = sustain * 1000;
      auditionTimerRef.current = window.setTimeout(() => {
        auditionGainsRef.current = [];
        auditionTimerRef.current = null;
      }, ms + 100);
      highlightTimerRef.current = window.setTimeout(() => {
        setPlayingMidis(new Set());
        highlightTimerRef.current = null;
      }, ms);
    },
    [],
  );

  const auditionChord = useCallback(
    (symbol: ChordSymbol) => {
      const midis = chordSymbolToMidi(symbol, keyRoot, mode, 4);
      if (!midis || midis.length === 0) return;
      playMidiSet(midis, 1.0);
    },
    [keyRoot, mode, playMidiSet],
  );

  /** Audition a single piano-key pitch with a short, snappy envelope. */
  const playPitch = useCallback(
    (midi: number) => {
      playMidiSet([midi], 0.4);
    },
    [playMidiSet],
  );

  function onPadClick(symbol: ChordSymbol) {
    setSelectedPad(symbol);
    auditionChord(symbol);
  }

  function onPadDoubleClick(symbol: ChordSymbol) {
    const tl = activeProg.timeline;
    const targetIdx = bridgeIndex();
    if (targetIdx >= tl.length) {
      updateActive({
        timeline: [...tl, { chord: symbol }],
        totalBars: tl.length + 1,
      });
    } else {
      const cp = tl.slice();
      cp[targetIdx] = { chord: symbol };
      updateActive({ timeline: cp });
    }
    setSelectedPad(symbol);
  }

  function onBarDrop(barIdx: number, symbol: ChordSymbol) {
    placeChordAt(barIdx, symbol);
    setSelectedPad(symbol);
    auditionChord(symbol);
  }

  const playTimerRef = useRef<number | null>(null);

  /** Pause playback without moving the playhead. Used by Pause toggle and by
   *  internal cleanup paths (empty progression, tab closes, scrubbing). */
  const pausePlayback = useCallback(() => {
    if (playTimerRef.current != null) {
      window.clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  /** Stop button: stop playback AND return the playhead to column 0 (DAW
   *  convention — Stop = "rewind to start"). */
  const stopAndReset = useCallback(() => {
    pausePlayback();
    setPlayheadCol(0);
  }, [pausePlayback]);

  useEffect(() => {
    if (!isPlaying) return;
    // Beat-precise chord scheduler — walks the block sequence (which is
    // the source of truth for chord identity AND duration) and fires each
    // chord at its cumulative beat offset. 1 beat = 1 piano-roll column
    // because `colsPerBar === BEATS_PER_BAR === 4`, so playhead math stays
    // in column units throughout.
    const blocks = activeProg.blocks;
    if (blocks.length === 0) {
      pausePlayback();
      return;
    }
    const audioCtx = getAudioContextRef.current();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    // Audio-clock anchored. Same self-correcting pattern as the previous
    // bar-precise scheduler: a single anchor (`beatZeroAt`) defines when
    // beat 0 of the progression should fire, and every `setTimeout`
    // recomputes its delay from the live audio clock — so even if a
    // timer fires 20 ms late, the next one fires 20 ms earlier and
    // cumulative drift can never grow.
    const secPerBeat = 60 / Math.max(1, localBpm);
    const startBeats = cumulativeStartBeats(blocks);
    const totalLoopBeats = totalBlockBeats(blocks);
    // Pick up wherever the playhead is. If it's sitting mid-block, jump
    // to the block that starts at or after the playhead column.
    const playheadBeat = playheadColRef.current;
    let startStep = 0;
    for (let i = startBeats.length - 1; i >= 0; i--) {
      if (startBeats[i]! <= playheadBeat) {
        startStep = i;
        break;
      }
    }
    // Solve for `beatZeroAt` so `beatZeroAt + startBeats[startStep] *
    // secPerBeat === firstChordAt`. That way the first scheduled chord
    // lands at `firstChordAt` and every following chord stays on-grid
    // relative to beat 0.
    const firstChordAt = audioCtx.currentTime + 0.05;
    const beatZeroAt = firstChordAt - startBeats[startStep]! * secPerBeat;
    let step = startStep;
    let cancelled = false;
    function fireAndScheduleNext() {
      if (cancelled) return;
      const ctx = audioCtx!;
      const blockIdx = step % blocks.length;
      const block = blocks[blockIdx]!;
      // No `setPlayheadCol` here — the rAF loop below drives the
      // playhead from the live audio clock so the line glides smoothly
      // between chord boundaries instead of snapping per chord.
      auditionChord(block.chord);
      step += 1;
      const nextBlockIdx = step % blocks.length;
      const loops = Math.floor(step / blocks.length);
      const nextAbsBeat = startBeats[nextBlockIdx]! + loops * totalLoopBeats;
      const nextTargetTime = beatZeroAt + nextAbsBeat * secPerBeat;
      const delayMs = Math.max(0, (nextTargetTime - ctx.currentTime) * 1000);
      playTimerRef.current = window.setTimeout(fireAndScheduleNext, delayMs);
    }
    const initialDelayMs = Math.max(0, (firstChordAt - audioCtx.currentTime) * 1000);
    playTimerRef.current = window.setTimeout(fireAndScheduleNext, initialDelayMs);

    // ── Smooth playhead via direct DOM ──────────────────────────────
    // Read the audio clock every animation frame and write
    // `transform: translateX(...)` straight onto each playhead `<div>`
    // via refs handed in by `PianoRoll` / `ChordBlockGrid`. translateX
    // is GPU-composited, so the only main-thread cost per frame is a
    // few math ops + a style write — no React reconciliation, no
    // layout/paint of unrelated nodes. This is the same pattern a DAW
    // uses to keep transport visuals smooth when the editor view is
    // heavy.
    const cellWForPiano = Math.max(20, Math.floor(PIANO_BAR_MIN_W / colsPerBar));
    let rafId = 0;
    let lastPaintedBeat = -1;
    function paintPlayhead() {
      if (cancelled) return;
      const ctx = audioCtx!;
      // `beatZeroAt` was solved so that beat 0 of the progression maps
      // to a specific audio-clock time. `elapsedBeats` may be slightly
      // negative for the first ~50 ms (we schedule with a look-ahead).
      const elapsedBeats = (ctx.currentTime - beatZeroAt) / secPerBeat;
      let pos: number;
      if (elapsedBeats < 0) {
        pos = startBeats[startStep]!;
      } else if (totalLoopBeats > 0) {
        pos = elapsedBeats % totalLoopBeats;
      } else {
        pos = elapsedBeats;
      }
      const maxBeats = Math.max(0, activeProg.totalBars * colsPerBar);
      if (maxBeats > 0 && pos >= maxBeats) pos = pos % maxBeats;
      // Skip frames where the playhead didn't move enough to be
      // visible — avoids burning GPU work when nothing changed.
      if (Math.abs(pos - lastPaintedBeat) >= 0.005) {
        const pianoEl = pianoPlayheadElRef.current;
        if (pianoEl) {
          pianoEl.style.transform = `translateX(${pos * cellWForPiano}px)`;
        }
        const gridEl = gridPlayheadElRef.current;
        if (gridEl) {
          gridEl.style.transform = `translateX(${pos * GRID_PX_PER_BEAT}px)`;
        }
        // Keep the ref in sync for scrub / restart logic which reads
        // `playheadColRef.current` to seed the next play position.
        playheadColRef.current = pos;
        lastPaintedBeat = pos;
      }
      rafId = window.requestAnimationFrame(paintPlayhead);
    }
    rafId = window.requestAnimationFrame(paintPlayhead);

    return () => {
      cancelled = true;
      if (playTimerRef.current != null) {
        window.clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
    // playheadCol intentionally not in deps — we capture its value at effect
    // start via ref; mid-playback scrubs bump playStartKey to force a clean
    // restart from the new position.
  }, [
    isPlaying,
    playStartKey,
    activeProg.blocks,
    activeProg.totalBars,
    colsPerBar,
    localBpm,
    auditionChord,
    pausePlayback,
  ]);

  useEffect(() => {
    if (active) return;
    // ── Hard cleanup when Chord Builder closes ────────────────────────
    // Critical for not bleeding into Beat Lab's audio. The shared
    // AudioContext stays alive between tabs (Beat Lab owns it), so any
    // Chord Builder audio nodes or scheduled gain ramps that haven't
    // been fully torn down would keep consuming the context's
    // scheduling lanes — which is the most plausible cause of the
    // Beat Lab metronome "stopping / pausing / skipping" you've seen
    // after using Chord Builder. We:
    //   1. Stop chord-sequence playback (clears playTimerRef).
    //   2. Hard-cancel every audition gain envelope so any in-flight
    //      ramps stop scheduling new automation points.
    //   3. Clear the audition + highlight timeouts so no late state
    //      writes happen after the tab has switched.
    //   4. Clear the status-message timers (saveMidi / songExport /
    //      autoGenStatus / exportStatus) so they can't fire after
    //      switching tabs and force a Chord Builder re-render at a
    //      sensitive moment in Beat Lab playback.
    pausePlayback();
    const ctx = getAudioContextRef.current();
    if (ctx) {
      auditionGainsRef.current.forEach((g) => {
        try {
          g.gain.cancelScheduledValues(ctx.currentTime);
          g.gain.setValueAtTime(0, ctx.currentTime);
        } catch {
          /* node already disposed — ignore */
        }
      });
    }
    auditionGainsRef.current = [];
    if (auditionTimerRef.current != null) {
      window.clearTimeout(auditionTimerRef.current);
      auditionTimerRef.current = null;
    }
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    if (autoGenStatusTimerRef.current != null) {
      window.clearTimeout(autoGenStatusTimerRef.current);
      autoGenStatusTimerRef.current = null;
    }
    if (saveMidiStatusTimerRef.current != null) {
      window.clearTimeout(saveMidiStatusTimerRef.current);
      saveMidiStatusTimerRef.current = null;
    }
    if (songExportStatusTimerRef.current != null) {
      window.clearTimeout(songExportStatusTimerRef.current);
      songExportStatusTimerRef.current = null;
    }
    if (exportStatusTimerRef.current != null) {
      window.clearTimeout(exportStatusTimerRef.current);
      exportStatusTimerRef.current = null;
    }
    setPlayingMidis(new Set());
  }, [active, pausePlayback]);

  function onTogglePlay() {
    if (isPlaying) {
      pausePlayback();
    } else {
      setIsPlaying(true);
    }
  }

  /** Move the playhead to column `col` (clamped to the current progression).
   *  If playback is running, restart from the new position so the user hears
   *  the music advance from where they clicked, not where the previous tick
   *  was. */
  const setPlayhead = useCallback(
    (col: number) => {
      const maxCol = Math.max(0, activeProg.totalBars * colsPerBar - 1);
      const clamped = Math.max(0, Math.min(maxCol, Math.floor(col)));
      setPlayheadCol(clamped);
      // Mirror the scrub into the ref so the rAF loop, if it's running,
      // sees the new starting beat on the next iteration. Without this
      // the rAF cleanup would later write the stale rAF-tracked position
      // back to state, overriding the user's scrub.
      playheadColRef.current = clamped;
      if (isPlaying) setPlayStartKey((k) => k + 1);
    },
    [activeProg.totalBars, colsPerBar, isPlaying],
  );

  // When switching progressions, snap the playhead to the start of the new one.
  useEffect(() => {
    setPlayheadCol(0);
  }, [activeId]);

  // If the active progression shrinks below the current playhead, clamp it
  // so the playhead doesn't sit beyond the visible timeline.
  useEffect(() => {
    const maxCol = Math.max(0, activeProg.totalBars * colsPerBar - 1);
    if (playheadCol > maxCol) setPlayheadCol(maxCol);
  }, [activeProg.totalBars, colsPerBar, playheadCol]);

  /** Lookup the manual-edit overlay for the currently active progression. */
  const editsForActive = useMemo(
    () =>
      manualEditsById[activeProg.id] ?? {
        added: new Set<string>(),
        removed: new Set<string>(),
        lengths: new Map<string, number>(),
      },
    [manualEditsById, activeProg.id],
  );

  /** Toggle a single note cell at (row, col) on the piano roll. `isAutoNote`
   *  tells us whether the chord at that bar already generates a note here:
   *    - auto note + click → add a "removed" override (hides the chord note)
   *    - removed override + click → clear the override (chord note returns)
   *    - empty cell + click → add a manual note overlay
   *    - manual note + click → remove the manual note overlay */
  function toggleNote(row: number, col: number, isAutoNote: boolean) {
    const key = `${row},${col}`;
    const cur = editsForActive;
    const newAdded = new Set(cur.added);
    const newRemoved = new Set(cur.removed);
    let didAdd = false;
    if (isAutoNote) {
      if (newRemoved.has(key)) newRemoved.delete(key);
      else newRemoved.add(key);
    } else if (newAdded.has(key)) {
      newAdded.delete(key);
    } else {
      newRemoved.delete(key);
      newAdded.add(key);
      didAdd = true;
    }
    // Trimming the lengths map: if we removed a manual note that had been
    // stretched, drop its length entry too so a future re-add starts at 1.
    const newLengths = new Map(cur.lengths);
    if (!isAutoNote && !newAdded.has(key)) newLengths.delete(key);
    if (isAutoNote && newRemoved.has(key)) newLengths.delete(key);
    setManualEditsById((prev) => ({
      ...prev,
      [activeProg.id]: { added: newAdded, removed: newRemoved, lengths: newLengths },
    }));
    if (didAdd) {
      const noteName = PIANO_ROWS[row];
      if (noteName) {
        const midi = noteNameToMidi(noteName);
        if (midi > 0) playPitch(midi);
      }
    }
  }

  function onClearEdits() {
    setManualEditsById((prev) => ({
      ...prev,
      [activeProg.id]: {
        added: new Set<string>(),
        removed: new Set<string>(),
        lengths: new Map<string, number>(),
      },
    }));
  }

  /** Move a note from one cell to another. If the origin was a chord-derived
   *  auto note, the move silences the chord note at the origin (adds it to
   *  `removed`) and writes a manual override at the destination. If the
   *  origin was already a manual note, we just relocate it within `added`. */
  function moveNote(
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    wasAuto: boolean,
  ) {
    const fromKey = `${fromRow},${fromCol}`;
    const toKey = `${toRow},${toCol}`;
    if (fromKey === toKey) return;
    const cur = editsForActive;
    const newAdded = new Set(cur.added);
    const newRemoved = new Set(cur.removed);
    if (wasAuto) {
      newRemoved.add(fromKey);
      newRemoved.delete(toKey);
      newAdded.add(toKey);
    } else {
      newAdded.delete(fromKey);
      newRemoved.delete(toKey);
      newAdded.add(toKey);
    }
    // Carry the source note's length to its new home so a stretched note
    // stays stretched after the user drags it elsewhere.
    const newLengths = new Map(cur.lengths);
    const moved = newLengths.get(fromKey);
    if (moved !== undefined) {
      newLengths.delete(fromKey);
      newLengths.set(toKey, moved);
    }
    setManualEditsById((prev) => ({
      ...prev,
      [activeProg.id]: { added: newAdded, removed: newRemoved, lengths: newLengths },
    }));
    const noteName = PIANO_ROWS[toRow];
    if (noteName) {
      const midi = noteNameToMidi(noteName);
      if (midi > 0) playPitch(midi);
    }
  }

  /** Set the length (in columns) of the note whose head sits at (row, col).
   *  `len` is clamped to ≥ 1 and to the remaining columns in that bar so a
   *  note never spills past its own bar boundary. Length 1 is the default
   *  and is removed from the map to keep state lean. */
  function resizeNote(row: number, col: number, len: number) {
    const barIdx = Math.floor(col / colsPerBar);
    const colsLeftInBar = (barIdx + 1) * colsPerBar - col;
    const clamped = Math.max(1, Math.min(colsLeftInBar, Math.floor(len)));
    const key = `${row},${col}`;
    const cur = editsForActive;
    const newLengths = new Map(cur.lengths);
    if (clamped <= 1) newLengths.delete(key);
    else newLengths.set(key, clamped);
    setManualEditsById((prev) => ({
      ...prev,
      [activeProg.id]: { added: cur.added, removed: cur.removed, lengths: newLengths },
    }));
  }

  /** Tick resolution for the exported Standard MIDI File. 480 PPQ is the
   *  near-universal default — divides cleanly by 1/2/3/4/5/6/8/12/16 and
   *  imports identically in every DAW we tested. */
  const SMF_TICKS_PER_QUARTER = 480;

  /** Transient feedback for the Save-MIDI button (mirrors the WAV
   *  export's status pill). `null` = no toast. */
  const [saveMidiStatus, setSaveMidiStatus] = useState<string | null>(null);
  const saveMidiStatusTimerRef = useRef<number | null>(null);

  function onSaveMidiClick() {
    const progression = activeProg.timeline
      .map((s) => s.chord)
      .filter((c): c is ChordSymbol => Boolean(c));
    if (progression.length === 0 && editsForActive.added.size === 0) {
      flashSaveMidi('Add at least one chord first.');
      return;
    }

    // Re-derive the cell-key set the user has been editing in (C3..C6
    // preview band) so manual add / remove / length edits are honoured
    // exactly the way they look on the piano roll. We DON'T octave-clamp
    // afterward — the SMF should carry the real pitches so external DAWs
    // can render the full chord voicings.
    const previewBandEvents = progression.length > 0
      ? buildChordEvents({
          progression,
          keyRoot,
          mode,
          pattern,
          barsPerChord: activeProg.barsPerChord,
          startCol: 0,
          colsPerBar,
          bandLow: PREVIEW_BAND_LOW,
          bandHigh: PREVIEW_BAND_HIGH,
        })
      : [];

    const cellKeys = new Set<string>();
    for (const ev of previewBandEvents) {
      const noteName = midiToNoteName(ev.midi);
      const row = PIANO_ROWS.indexOf(noteName);
      if (row < 0) continue;
      const key = `${row},${ev.col}`;
      if (!editsForActive.removed.has(key)) cellKeys.add(key);
    }
    for (const key of editsForActive.added) cellKeys.add(key);

    // Convert each (row, col) cell into a single MidiNoteEvent with the
    // user-set length. `col` is in quarter-note units (matches the project
    // grid), so we scale by `SMF_TICKS_PER_QUARTER` to get absolute SMF
    // ticks. Held notes become one note-on / note-off span rather than
    // N re-triggers, which is what every external DAW expects.
    const notes: MidiNoteEvent[] = [];
    for (const key of cellKeys) {
      const [rowStr, colStr] = key.split(',');
      const row = parseInt(rowStr ?? '-1', 10);
      const col = parseInt(colStr ?? '-1', 10);
      const noteName = PIANO_ROWS[row];
      if (!noteName) continue;
      const midi = noteNameToMidi(noteName);
      if (midi <= 0) continue;
      const length = editsForActive.lengths.get(key) ?? 1;
      notes.push({
        midi,
        startTick: col * SMF_TICKS_PER_QUARTER,
        durationTicks: Math.max(1, length) * SMF_TICKS_PER_QUARTER,
        velocity: 100,
      });
    }

    if (notes.length === 0) {
      flashSaveMidi('No notes to save — try adding chords or notes.');
      return;
    }

    // Build a descriptive label: e.g. "C · Am · F · G". Falls back to the
    // progression's name if every slot is empty (shouldn't happen — we
    // bailed above — but keeps the filename sane in edge cases).
    const chordList = activeProg.timeline
      .map((s) => s.chord)
      .filter((c): c is ChordSymbol => Boolean(c))
      .map((sym) => chordSymbolToName(sym, keyRoot, mode))
      .join(' · ');
    const trackName = chordList || activeProg.name || 'Chord Builder';

    try {
      const bytes = buildStandardMidiFile({
        notes,
        bpm: localBpm,
        ticksPerQuarter: SMF_TICKS_PER_QUARTER,
        trackName,
      });
      const filenameBase = chordList
        ? `ChordBuilder · ${chordList}`
        : activeProg.name || 'ChordBuilder';
      downloadBytes(bytes, `${safeFilename(filenameBase)}.mid`, 'audio/midi');
      flashSaveMidi(`✓ Saved ${notes.length} note${notes.length === 1 ? '' : 's'} → .mid`);
    } catch (err) {
      console.debug('Save MIDI failed:', err);
      flashSaveMidi(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  // Show a small status pill under the Save-MIDI button for 3 seconds.
  function flashSaveMidi(msg: string) {
    if (saveMidiStatusTimerRef.current != null) {
      window.clearTimeout(saveMidiStatusTimerRef.current);
    }
    setSaveMidiStatus(msg);
    saveMidiStatusTimerRef.current = window.setTimeout(() => {
      setSaveMidiStatus(null);
      saveMidiStatusTimerRef.current = null;
    }, 3000);
  }

  useEffect(() => {
    return () => {
      if (saveMidiStatusTimerRef.current != null) {
        window.clearTimeout(saveMidiStatusTimerRef.current);
        saveMidiStatusTimerRef.current = null;
      }
    };
  }, []);

  // ── Whole-song export (every Progression tab, back-to-back) ─────────
  //
  // Status pill + cleanup timer shared by both song-export buttons. We
  // collapse them into a single transient toast — only one operation can
  // really be in flight at a time (both block on `await`) and showing two
  // separate toasts side-by-side adds clutter without information.
  const [songExportStatus, setSongExportStatus] = useState<string | null>(null);
  const [songExportBusy, setSongExportBusy] = useState<false | 'wav' | 'midi'>(false);
  const songExportStatusTimerRef = useRef<number | null>(null);
  function flashSongExport(msg: string): void {
    if (songExportStatusTimerRef.current != null) {
      window.clearTimeout(songExportStatusTimerRef.current);
    }
    setSongExportStatus(msg);
    songExportStatusTimerRef.current = window.setTimeout(() => {
      setSongExportStatus(null);
      songExportStatusTimerRef.current = null;
    }, 4000);
  }
  useEffect(() => {
    return () => {
      if (songExportStatusTimerRef.current != null) {
        window.clearTimeout(songExportStatusTimerRef.current);
        songExportStatusTimerRef.current = null;
      }
    };
  }, []);

  /** Are there ANY chords laid down across ALL Progression tabs? Drives
   *  the disabled state of the song-export buttons. */
  const songHasContent = useMemo(
    () => progressions.some((p) => p.timeline.some((s) => Boolean(s.chord))),
    [progressions],
  );

  /** Human-readable listing of the sections that'll be included, in order.
   *  Surfaces in the button tooltip + the post-export status toast so the
   *  user can sanity-check what they bounced. */
  const songSectionsLabel = useMemo(
    () =>
      progressions
        .filter((p) => p.timeline.some((s) => Boolean(s.chord)))
        .map((p) => p.name)
        .join(' → ') || '(no content)',
    [progressions],
  );

  /** Bounce every populated Progression tab to a single WAV file and
   *  trigger a browser download. Empty tabs are skipped — they don't
   *  consume song time and don't show up in the filename. */
  const onSaveSongWavClick = useCallback(async () => {
    if (songExportBusy) return;
    const populated = progressions.filter((p) => p.timeline.some((s) => Boolean(s.chord)));
    if (populated.length === 0) {
      flashSongExport('Add chords to at least one section first.');
      return;
    }
    setSongExportBusy('wav');
    setSongExportStatus('Rendering whole song…');
    try {
      const { wavBytes, durationSec } = await renderSongToWav({
        sections: populated.map((p) => ({
          timeline: p.timeline,
          barsPerChord: p.barsPerChord,
          totalBars: p.totalBars,
        })),
        keyRoot,
        mode,
        bpm: localBpm,
        instrumentId,
      });
      const sectionNames = populated.map((p) => p.name).join(' · ');
      const filenameBase = `ChordBuilder Song · ${sectionNames}`;
      downloadBytes(wavBytes, `${safeFilename(filenameBase)}.wav`, 'audio/wav');
      flashSongExport(
        `✓ Saved ${populated.length} section${populated.length === 1 ? '' : 's'} (${durationSec.toFixed(1)}s) → .wav`,
      );
    } catch (err) {
      console.debug('Song WAV export failed:', err);
      flashSongExport(err instanceof Error ? err.message : 'Song WAV export failed.');
    } finally {
      setSongExportBusy(false);
    }
  }, [songExportBusy, progressions, keyRoot, mode, localBpm, instrumentId]);

  /** Save every populated Progression tab as one Standard MIDI File. Each
   *  section is placed sequentially on the timeline (offset by the cumulative
   *  bar count of all prior sections) so the MIDI plays end-to-end in any
   *  DAW. Per-section manual edits (added / removed / lengthened notes) are
   *  preserved — same fidelity as the single-section Save MIDI. */
  const onSaveSongMidiClick = useCallback(() => {
    if (songExportBusy) return;
    const populated = progressions.filter((p) => p.timeline.some((s) => Boolean(s.chord)));
    if (populated.length === 0) {
      flashSongExport('Add chords to at least one section first.');
      return;
    }
    setSongExportBusy('midi');
    try {
      const allNotes: MidiNoteEvent[] = [];
      // Cursor advances in QUARTER-NOTE columns (matches `colsPerBar` math
      // throughout Chord Builder — typically 4 cols per bar in 4/4).
      let cursorCol = 0;
      for (const prog of populated) {
        const progChords = prog.timeline
          .map((s) => s.chord)
          .filter((c): c is ChordSymbol => Boolean(c));
        const sectionEdits = manualEditsById[prog.id] ?? {
          added: new Set<string>(),
          removed: new Set<string>(),
          lengths: new Map<string, number>(),
        };

        // Re-derive the lit-cell set the same way `onSaveMidiClick` does
        // for a single section, but reusing the per-section pattern +
        // barsPerChord so each section keeps its own feel.
        const sectionPattern = getPattern(prog.patternId) ?? PATTERNS[0]!;
        const previewEvents = progChords.length > 0
          ? buildChordEvents({
              progression: progChords,
              keyRoot,
              mode,
              pattern: sectionPattern,
              barsPerChord: prog.barsPerChord,
              startCol: 0,
              colsPerBar,
              bandLow: PREVIEW_BAND_LOW,
              bandHigh: PREVIEW_BAND_HIGH,
            })
          : [];
        const cellKeys = new Set<string>();
        for (const ev of previewEvents) {
          const noteName = midiToNoteName(ev.midi);
          const row = PIANO_ROWS.indexOf(noteName);
          if (row < 0) continue;
          const key = `${row},${ev.col}`;
          if (!sectionEdits.removed.has(key)) cellKeys.add(key);
        }
        for (const key of sectionEdits.added) cellKeys.add(key);

        // Convert each lit cell into a MidiNoteEvent, offset by the
        // song cursor so the section lands at the right point in time.
        for (const key of cellKeys) {
          const [rowStr, colStr] = key.split(',');
          const row = parseInt(rowStr ?? '-1', 10);
          const col = parseInt(colStr ?? '-1', 10);
          const noteName = PIANO_ROWS[row];
          if (!noteName) continue;
          const midi = noteNameToMidi(noteName);
          if (midi <= 0) continue;
          const length = sectionEdits.lengths.get(key) ?? 1;
          allNotes.push({
            midi,
            startTick: (cursorCol + col) * SMF_TICKS_PER_QUARTER,
            durationTicks: Math.max(1, length) * SMF_TICKS_PER_QUARTER,
            velocity: 100,
          });
        }
        // The section's footprint is its visible bar count — keeps empty
        // bars in the section as silence in the timeline (matches WAV).
        cursorCol += prog.totalBars * colsPerBar;
      }

      if (allNotes.length === 0) {
        flashSongExport('No notes to save — try adding chords or notes.');
        return;
      }
      const sectionNames = populated.map((p) => p.name).join(' · ');
      const trackName = `Chord Builder Song · ${sectionNames}`;
      const bytes = buildStandardMidiFile({
        notes: allNotes,
        bpm: localBpm,
        ticksPerQuarter: SMF_TICKS_PER_QUARTER,
        trackName,
      });
      downloadBytes(
        bytes,
        `${safeFilename(`ChordBuilder Song · ${sectionNames}`)}.mid`,
        'audio/midi',
      );
      flashSongExport(
        `✓ Saved ${allNotes.length} note${allNotes.length === 1 ? '' : 's'} across ${populated.length} section${populated.length === 1 ? '' : 's'} → .mid`,
      );
    } catch (err) {
      console.debug('Song MIDI export failed:', err);
      flashSongExport(err instanceof Error ? err.message : 'Song MIDI export failed.');
    } finally {
      setSongExportBusy(false);
    }
  }, [songExportBusy, progressions, manualEditsById, keyRoot, mode, localBpm, colsPerBar]);

  // ── WAV export to Beat Lab sample pad ────────────────────────────────
  //
  // The user can bounce the active progression to a one-shot WAV and drop
  // it on any of Beat Lab's 16 sample pads. Pad picker is a small popover
  // anchored to the export button; while it's open the user clicks a
  // numbered slot, we render → encode → hand the bytes to the host.
  //
  // `exportBusy` disables the button mid-render so impatient clicks don't
  // stack offline contexts. `exportPickerOpen` toggles the slot grid.
  // `exportStatus` shows a transient confirmation under the button once
  // the host has accepted the WAV (clears after ~3 s).
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const exportStatusTimerRef = useRef<number | null>(null);

  // Human-readable chord list (e.g. "C · Am · F · G"). Used both as the
  // sample's label inside Beat Lab and as a confirmation toast under the
  // export button so the user knows exactly which chords just landed on
  // their pad.
  const exportLabelChords = useMemo(() => {
    return activeProg.timeline
      .map((s) => s.chord)
      .filter((c): c is ChordSymbol => Boolean(c))
      .map((sym) => chordSymbolToName(sym, keyRoot, mode))
      .join(' · ');
  }, [activeProg.timeline, keyRoot, mode]);

  const onExportToPadClick = useCallback(
    async (padIndex: number) => {
      const exportFn = onExportToPadRef.current;
      if (!exportFn) return;
      if (exportBusy) return;
      setExportBusy(true);
      setExportStatus(null);
      try {
        const { wavBytes } = await renderChordTimelineToWav({
          timeline: activeProg.timeline,
          keyRoot,
          mode,
          bpm: localBpm,
          barsPerChord: activeProg.barsPerChord,
          instrumentId,
        });
        const label = exportLabelChords
          ? `Chord · ${exportLabelChords}`
          : 'Chord Builder Bounce';
        exportFn({ padIndex, wavBytes, label, rootBpm: localBpm });
        setExportPickerOpen(false);
        if (exportStatusTimerRef.current != null) {
          window.clearTimeout(exportStatusTimerRef.current);
        }
        setExportStatus(`✓ Pad ${padIndex + 1} ← ${label}`);
        exportStatusTimerRef.current = window.setTimeout(() => {
          setExportStatus(null);
          exportStatusTimerRef.current = null;
        }, 3000);
      } catch (err) {
        console.debug('Chord export failed:', err);
        setExportStatus(
          err instanceof Error ? err.message : 'Export failed — try adding chords first.',
        );
        if (exportStatusTimerRef.current != null) {
          window.clearTimeout(exportStatusTimerRef.current);
        }
        exportStatusTimerRef.current = window.setTimeout(() => {
          setExportStatus(null);
          exportStatusTimerRef.current = null;
        }, 4000);
      } finally {
        setExportBusy(false);
      }
    },
    [
      // onExportToPad is read from `onExportToPadRef.current` so we don't
      // need it as a dep — keeps this callback's identity stable across
      // parent re-renders (and thus stable in any descendant deps).
      exportBusy,
      activeProg.timeline,
      activeProg.barsPerChord,
      keyRoot,
      mode,
      localBpm,
      exportLabelChords,
      instrumentId,
    ],
  );

  // Clean up the toast timer if the component unmounts mid-toast.
  useEffect(() => {
    return () => {
      if (exportStatusTimerRef.current != null) {
        window.clearTimeout(exportStatusTimerRef.current);
        exportStatusTimerRef.current = null;
      }
    };
  }, []);

  const chordCount = activeProg.timeline.filter((s) => s.chord).length;

  const previewEvents = useMemo<ChordEventOut[]>(() => {
    const progression = activeProg.timeline
      .map((s) => s.chord)
      .filter((c): c is ChordSymbol => Boolean(c));
    if (progression.length === 0) return [];
    // Preview uses the wider chord-builder piano-roll band (C3..C6) so 7th chords,
    // sus voicings, and high-key roots all display their full voicing without
    // being octave-compressed. Commit still uses the host's narrower band.
    return buildChordEvents({
      progression,
      keyRoot,
      mode,
      pattern,
      barsPerChord: activeProg.barsPerChord,
      startCol: 0,
      colsPerBar,
      bandLow: PREVIEW_BAND_LOW,
      bandHigh: PREVIEW_BAND_HIGH,
    });
  }, [activeProg.timeline, activeProg.barsPerChord, keyRoot, mode, pattern, colsPerBar]);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Two-tier ESC: when the piano roll is in MAX overlay mode, the
        // first press just exits the overlay (so users who hit MAX by
        // mistake have a reliable way out — the MIN/FIT buttons can be
        // hard to spot when the overlay covers most of the screen).
        // A second ESC then closes Chord Builder as before.
        if (pianoRollMode === 'expanded') {
          setPianoRollMode('normal');
          return;
        }
        pausePlayback();
        onCloseRef.current();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `onCloseRef` is a ref — explicitly NOT in deps. Without this, the parent's
    // inline-arrow `onClose` re-attaches the keydown listener on every parent
    // render (which happens dozens of times per second while Beat Lab plays).
  }, [active, pausePlayback, pianoRollMode]);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3500,
        background: '#050505',
        color: '#c8c8d0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        .cb-select { color-scheme: dark; }
        .cb-select option { background-color: #0a0a0e; color: #dcdce4; }
        .cb-select optgroup {
          background-color: #050507;
          color: #7cf4c6;
          font-weight: 800;
          font-style: normal;
          letter-spacing: 0.6px;
        }
      `}</style>

      <Header onClose={() => { pausePlayback(); onCloseRef.current(); }} />

      <TopToolbar
        keyRoot={keyRoot}
        onKeyRoot={setKeyRoot}
        mode={mode}
        onMode={setMode}
        genreId={genreId}
        onGenre={onGenreChange}
        patternId={activeProg.patternId}
        onPattern={onPatternChange}
        barsPerChord={activeProg.barsPerChord}
        onBarsPerChord={onBarsPerChordChange}
        totalBars={activeProg.totalBars}
        onTotalBars={onTotalBarsChange}
        chordCount={chordCount}
        isPlaying={isPlaying}
        bpm={localBpm}
        onBpm={setLocalBpmAndUnsync}
        instrumentId={instrumentId}
        onPickInstrument={(id) => {
          setInstrumentId(id);
          const midis = chordSymbolToMidi(selectedPad, keyRoot, mode, 4);
          if (midis && midis.length > 0) {
            instrumentIdRef.current = id;
            playMidiSet(midis, 1.0);
          }
        }}
        syncToProject={syncToProject}
        onToggleSync={() => setSyncToProject((p) => !p)}
        onTapTempo={onTapTempo}
        onTogglePlay={onTogglePlay}
        onStop={stopAndReset}
        onGenerate={onGenerateProgression}
        onSuggestNext={onSuggestNext}
        onClear={onClearTimeline}
        onSaveMidi={onSaveMidiClick}
        saveMidiStatus={saveMidiStatus}
        canExportToPad={Boolean(onExportToPad)}
        exportPickerOpen={exportPickerOpen}
        onToggleExportPicker={() =>
          setExportPickerOpen((open) => (chordCount === 0 ? false : !open))
        }
        onPickExportPad={onExportToPadClick}
        exportBusy={exportBusy}
        exportStatus={exportStatus}
        onSaveSongWav={onSaveSongWavClick}
        onSaveSongMidi={onSaveSongMidiClick}
        canSaveSong={songHasContent}
        songExportBusy={songExportBusy}
        songExportStatus={songExportStatus}
        songSectionsLabel={songSectionsLabel}
      />

      <ProgressionTabStrip
        progressions={progressions}
        activeId={activeId}
        onSwitch={setActiveId}
        onAdd={onAddProgression}
        onRemove={onRemoveProgression}
        onRename={onRenameProgression}
        onAutoGenerate={onAutoGenerateSong}
        autoGenStatus={autoGenStatus}
        canAutoGenerate={
          activeProg.timeline.some((s) => Boolean(s.chord))
        }
      />

      <PresetStrip
        genre={genre}
        keyRoot={keyRoot}
        mode={mode}
        onPickPreset={onPickPreset}
      />

      <ChordScaleStrip
        pads={padsForMode}
        keyRoot={keyRoot}
        mode={mode}
        selectedPad={selectedPad}
        progressionStep={progressionPadInfo.stepByChord}
        progressionCount={progressionPadInfo.countByChord}
        onPadClick={onPadClick}
        onPadDoubleClick={onPadDoubleClick}
      />

      <AiGridTab
        open={aiPanelOpen}
        onToggle={() => setAiPanelOpen((o) => !o)}
        suggestionCount={suggestions.length}
        blockCount={activeProg.blocks.length}
      />

      {aiPanelOpen && (
        <>
          <AiSuggestionsStrip
            suggester={suggester}
            suggesterId={suggesterId}
            onPickBackend={setSuggesterId}
            suggestions={suggestions}
            loading={suggestionsLoading}
            error={suggesterError}
            contextLength={timelineContext.length}
            keyRoot={keyRoot}
            mode={mode}
            onAppendChord={appendChord}
          />

          <ChordBlockGrid
            blocks={activeProg.blocks}
            keyRoot={keyRoot}
            mode={mode}
            playheadCol={playheadCol}
            isPlaying={isPlaying}
            playheadElRef={gridPlayheadElRef}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onReplaceBlockChord={onGridReplaceBlockChord}
            onResizeBlock={onGridResizeBlock}
            onRemoveBlock={onGridRemoveBlock}
            onAppendBlock={onGridAppendBlock}
            onReorderBlock={onGridReorderBlock}
            onPlayheadChange={setPlayhead}
            selectedPad={selectedPad}
          />
        </>
      )}

      <ChordSuggestionsStrip
        selectedPad={selectedPad}
        genre={genre}
        keyRoot={keyRoot}
        mode={mode}
        onAppendChord={appendChord}
        onPickPreset={onPickPreset}
      />

      <PianoRoll
        timeline={activeProg.timeline}
        previewEvents={previewEvents}
        totalBars={activeProg.totalBars}
        colsPerBar={colsPerBar}
        keyRoot={keyRoot}
        mode={mode}
        playheadCol={playheadCol}
        isPlaying={isPlaying}
        playheadElRef={pianoPlayheadElRef}
        dragTargetBar={dragTargetBar}
        playingMidis={playingMidis}
        manualAdded={editsForActive.added}
        manualRemoved={editsForActive.removed}
        noteLengths={editsForActive.lengths}
        onPlayPitch={playPitch}
        onPlayheadChange={setPlayhead}
        onToggleNote={toggleNote}
        onMoveNote={moveNote}
        onResizeNote={resizeNote}
        onBarLabelClick={onBarLabelClick}
        onBarDrop={onBarDrop}
        onBarDragOver={setDragTargetBar}
        onBarDragLeave={() => setDragTargetBar(null)}
        onClearEdits={onClearEdits}
        hasEdits={editsForActive.added.size > 0 || editsForActive.removed.size > 0}
        sizeMode={pianoRollMode}
        onSizeModeChange={setPianoRollMode}
      />
    </div>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        flexShrink: 0,
        height: 28,
        padding: '0 14px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.18)',
        background: 'linear-gradient(180deg, rgba(20, 20, 26, 0.98) 0%, rgba(10, 10, 14, 1) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: MINT, letterSpacing: 3.5 }}>🎼 CHORD BUILDER</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#8a8a98', letterSpacing: 0.4 }}>
          drag a chord pad onto any bar of the piano roll · ESC to close
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        title="Close Chord Builder (Esc)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 10px',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(255,255,255,0.04)',
          color: '#dcdce4',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: 'pointer',
        }}
      >
        <X size={12} />
        Close
      </button>
    </div>
  );
}

function TopToolbar({
  keyRoot,
  onKeyRoot,
  mode,
  onMode,
  genreId,
  onGenre,
  patternId,
  onPattern,
  barsPerChord,
  onBarsPerChord,
  totalBars,
  onTotalBars,
  chordCount,
  isPlaying,
  bpm,
  onBpm,
  instrumentId,
  onPickInstrument,
  syncToProject,
  onToggleSync,
  onTapTempo,
  onTogglePlay,
  onStop,
  onGenerate,
  onSuggestNext,
  onClear,
  onSaveMidi,
  saveMidiStatus,
  canExportToPad,
  exportPickerOpen,
  onToggleExportPicker,
  onPickExportPad,
  exportBusy,
  exportStatus,
  onSaveSongWav,
  onSaveSongMidi,
  canSaveSong,
  songExportBusy,
  songExportStatus,
  songSectionsLabel,
}: {
  keyRoot: number;
  onKeyRoot: (v: number) => void;
  mode: ChordMode;
  onMode: (v: ChordMode) => void;
  genreId: string;
  onGenre: (id: string) => void;
  patternId: string;
  onPattern: (v: string) => void;
  barsPerChord: number;
  onBarsPerChord: (v: number) => void;
  totalBars: number;
  onTotalBars: (v: number) => void;
  chordCount: number;
  isPlaying: boolean;
  bpm: number;
  onBpm: (v: number) => void;
  /** Currently selected sound-bank voice. The full bank lives in
   *  `CHORD_INSTRUMENTS`; the dropdown is rendered inline next to the
   *  tempo cluster (replaces the dedicated Sound Bank strip so the piano
   *  roll keeps maximum vertical real estate). */
  instrumentId: ChordInstrumentId;
  onPickInstrument: (id: ChordInstrumentId) => void;
  /** True if the preview tempo mirrors the project BPM (clicking the Sync
   *  button toggles this). When true the input is read-only and the ± /
   *  Tap buttons are disabled. */
  syncToProject: boolean;
  onToggleSync: () => void;
  onTapTempo: () => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onGenerate: () => void;
  onSuggestNext: () => void;
  onClear: () => void;
  /** Save the active progression as a Standard MIDI File (.mid) download. */
  onSaveMidi: () => void;
  /** Transient status string for the Save-MIDI button. `null` = idle. */
  saveMidiStatus: string | null;
  /** True iff the host supplied an `onExportToPad` handler. Hides the WAV
   *  export button entirely when running in a context that doesn't accept
   *  rendered audio (e.g. screens other than Creation Station). */
  canExportToPad: boolean;
  exportPickerOpen: boolean;
  onToggleExportPicker: () => void;
  onPickExportPad: (padIndex: number) => void;
  /** True while a render is in flight — the picker stays open but slots
   *  show a "rendering…" cursor and ignore further clicks. */
  exportBusy: boolean;
  /** Toast string shown under the export cluster after a successful drop
   *  (or after a render error). `null` = no toast. */
  exportStatus: string | null;
  /** Bounce every populated Progression tab back-to-back into one .wav
   *  download. The single-section "WAV → Pad" stays in place — this is
   *  the full-song variant. */
  onSaveSongWav: () => void;
  /** Save every populated Progression tab back-to-back into one .mid
   *  download. Mirrors `onSaveSongWav` but emits MIDI instead of audio. */
  onSaveSongMidi: () => void;
  /** True iff at least one Progression tab has at least one chord placed. */
  canSaveSong: boolean;
  /** While a song render is in flight: 'wav' or 'midi' (so the right
   *  button can show "Rendering…"). `false` when idle. */
  songExportBusy: false | 'wav' | 'midi';
  /** Toast string shown next to the song-export cluster after a save (or
   *  on error). `null` = no toast. */
  songExportStatus: string | null;
  /** Friendly "Verse → Pre-Chorus → Chorus" preview, used as the song-
   *  export button's tooltip body so the user knows what's about to land
   *  in their downloads folder. */
  songSectionsLabel: string;
}) {
  const canSave = chordCount > 0;
  const canExport = canSave && canExportToPad;
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '5px 12px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
        background: 'linear-gradient(180deg, rgba(20, 20, 26, 0.95) 0%, rgba(10, 10, 14, 0.98) 100%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        rowGap: 4,
      }}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        title={isPlaying ? 'Pause preview' : 'Play progression preview'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 28,
          borderRadius: 4,
          border: `1px solid ${isPlaying ? MINT : MINT_DIM}`,
          background: isPlaying ? MINT_BG_STRONG : MINT_BG,
          color: MINT,
          cursor: chordCount > 0 ? 'pointer' : 'not-allowed',
          opacity: chordCount > 0 ? 1 : 0.4,
        }}
        disabled={chordCount === 0}
      >
        {isPlaying ? <Pause size={13} /> : <Play size={13} />}
      </button>

      <button
        type="button"
        onClick={onStop}
        title="Stop & return to bar 1"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 28,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(255,255,255,0.04)',
          color: isPlaying ? MINT : '#cfd0d8',
          cursor: 'pointer',
        }}
      >
        <Square size={11} />
      </button>

      {/* Tempo control group: − [BPM number] +, with Tap Tempo + Sync next
          to it. When Sync is on, the manual controls dim/disable so it's
          obvious the tempo is driven by the project. */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'stretch',
            borderRadius: 6,
            border: `1px solid ${syncToProject ? MINT : MINT_DIM}`,
            background: 'rgba(255,255,255,0.04)',
            overflow: 'hidden',
            boxShadow: syncToProject ? `0 0 6px rgba(124,244,198,0.30)` : 'none',
          }}
          title={
            syncToProject
              ? 'Tempo is synced to project BPM — Sync OFF to override'
              : 'Preview tempo · click − / + or type to nudge · click Sync to follow project'
          }
        >
          <button
            type="button"
            onClick={() => onBpm(bpm - 1)}
            disabled={syncToProject}
            title="Slower (−1 BPM)"
            style={{
              width: 26,
              padding: 0,
              border: 'none',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              color: syncToProject ? '#54545e' : MINT,
              fontSize: 16,
              fontWeight: 900,
              lineHeight: 1,
              cursor: syncToProject ? 'not-allowed' : 'pointer',
            }}
          >
            −
          </button>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px',
              minWidth: 100,
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 800, color: MINT, letterSpacing: 0.6 }}>BPM</span>
            <input
              // `type="text"` + `inputMode="numeric"` so we don't get the
              // native gray spinner arrows that Chrome/Safari draw on
              // `type="number"` — those sat on top of the right-aligned
              // 3-digit value and visually clipped the "0" in 120.
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={bpm}
              readOnly={syncToProject}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                if (raw === '') return;
                const n = Number(raw);
                if (!Number.isNaN(n)) onBpm(n);
              }}
              style={{
                width: 46,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: syncToProject ? '#cfd0d8' : '#dcdce4',
                fontSize: 16,
                fontWeight: 800,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                textAlign: 'center',
                padding: '4px 4px',
                cursor: syncToProject ? 'default' : 'text',
                MozAppearance: 'textfield',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => onBpm(bpm + 1)}
            disabled={syncToProject}
            title="Faster (+1 BPM)"
            style={{
              width: 26,
              padding: 0,
              border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              color: syncToProject ? '#54545e' : MINT,
              fontSize: 16,
              fontWeight: 900,
              lineHeight: 1,
              cursor: syncToProject ? 'not-allowed' : 'pointer',
            }}
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onTapTempo}
          disabled={syncToProject}
          title="Tap Tempo — click 2+ times to the beat and the BPM follows"
          style={{
            padding: '5px 9px',
            borderRadius: 4,
            border: `1px solid ${syncToProject ? 'rgba(255,255,255,0.10)' : MINT_DIM}`,
            background: syncToProject ? 'rgba(255,255,255,0.02)' : MINT_BG,
            color: syncToProject ? '#54545e' : MINT,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            cursor: syncToProject ? 'not-allowed' : 'pointer',
          }}
        >
          TAP
        </button>
        <button
          type="button"
          onClick={onToggleSync}
          title={
            syncToProject
              ? 'Sync ON — preview tempo follows the project BPM. Click to override locally.'
              : 'Sync OFF — using local preview tempo. Click to snap back to project BPM.'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 9px',
            borderRadius: 4,
            border: `1px solid ${syncToProject ? MINT : 'rgba(255,255,255,0.18)'}`,
            background: syncToProject ? MINT_BG_STRONG : 'rgba(255,255,255,0.04)',
            color: syncToProject ? MINT : '#cfd0d8',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            cursor: 'pointer',
          }}
        >
          <Link2 size={11} />
          {syncToProject ? 'SYNCED' : 'SYNC'}
        </button>
      </div>

      {/* Sound Bank — compact dropdown next to the tempo cluster. The
          old SoundBankStrip is gone; this gives the piano roll ~30 px
          back per chord-builder session. Picking a voice immediately
          auditions the currently-selected chord with the new timbre.
          Voices are grouped by category so 14 entries stay scannable. */}
      <ToolbarSelect
        label="Sound"
        value={instrumentId}
        onChange={(v) => onPickInstrument(v as ChordInstrumentId)}
      >
        {(['Piano', 'Keys', 'Strings', 'Pad', 'Bass', 'Pluck', 'Bell', 'Brass', 'Lead'] as const).map((cat) => {
          const inCat = CHORD_INSTRUMENTS.filter((i) => i.category === cat);
          if (inCat.length === 0) return null;
          return (
            <optgroup key={cat} label={cat}>
              {inCat.map((inst) => (
                <option key={inst.id} value={inst.id} title={inst.description}>
                  {inst.glyph} {inst.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </ToolbarSelect>

      <ToolbarSelect label="Key" value={String(keyRoot)} onChange={(v) => onKeyRoot(Number(v))}>
        {KEY_ROOTS.map((k) => (
          <option key={k.value} value={k.value}>{k.label}</option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect label="Mode" value={mode} onChange={(v) => onMode(v as ChordMode)}>
        <optgroup label="Major">
          {MODES_BY_FAMILY.major.map((id) => (
            <option key={id} value={id}>
              {MODE_LABELS[id]}
            </option>
          ))}
        </optgroup>
        <optgroup label="Minor">
          {MODES_BY_FAMILY.minor.map((id) => (
            <option key={id} value={id}>
              {MODE_LABELS[id]}
            </option>
          ))}
        </optgroup>
        <optgroup label="Other / Standalone">
          {MODES_BY_FAMILY.other.map((id) => (
            <option key={id} value={id}>
              {MODE_LABELS[id]}
            </option>
          ))}
        </optgroup>
      </ToolbarSelect>

      <ToolbarSelect label="Genre" value={genreId} onChange={onGenre}>
        {GENRES.map((g) => (
          <option key={g.id} value={g.id}>{g.label}</option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect label="Pattern" value={patternId} onChange={onPattern}>
        {PATTERNS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect label="Bars/Chord" value={String(barsPerChord)} onChange={(v) => onBarsPerChord(Number(v))}>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="4">4</option>
      </ToolbarSelect>

      <ToolbarSelect label="Total Bars" value={String(totalBars)} onChange={(v) => onTotalBars(Number(v))}>
        {[4, 8, 12, 16, 24, 32].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </ToolbarSelect>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 10, color: '#8a8a98' }}>{chordCount}/{totalBars} bars filled</span>

      <ToolbarButton onClick={onGenerate} icon={<Wand2 size={11} />} label="Generate" primary />
      <ToolbarButton onClick={onSuggestNext} icon={<Sparkles size={11} />} label="Suggest Next" />
      <ToolbarButton onClick={onClear} icon={<Eraser size={11} />} label="Clear" subdued />

      {/* Two-way "send" cluster: Save MIDI → .mid file download,
          WAV bounce → a Beat-Lab sample pad. The export side opens a
          4×4 pad picker so the user can target one of the 16 tracks. */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <ToolbarButton
          onClick={onSaveMidi}
          icon={<Download size={11} />}
          label="Save MIDI"
          primary
          disabled={!canSave}
        />
        {saveMidiStatus ? (
          <div
            role="status"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              whiteSpace: 'nowrap',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.3,
              color: saveMidiStatus.startsWith('✓') ? MINT : '#ffb4b4',
              background: 'rgba(10, 10, 14, 0.95)',
              border: `1px solid ${saveMidiStatus.startsWith('✓') ? MINT_DIM : 'rgba(255, 180, 180, 0.35)'}`,
              borderRadius: 4,
              padding: '4px 8px',
              pointerEvents: 'none',
              zIndex: 25,
            }}
          >
            {saveMidiStatus}
          </div>
        ) : null}
      </div>
      {canExportToPad ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <ToolbarButton
            onClick={onToggleExportPicker}
            icon={<Download size={11} />}
            label={
              exportBusy
                ? 'Rendering…'
                : exportPickerOpen
                  ? 'Choose Pad…'
                  : 'WAV → Pad'
            }
            disabled={!canExport || exportBusy}
          />
          {exportPickerOpen ? (
            <div
              role="dialog"
              aria-label="Choose Beat Lab pad for WAV export"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                zIndex: 30,
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${MINT_DIM}`,
                background: 'rgba(10, 10, 14, 0.98)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,244,198,0.10) inset',
                minWidth: 188,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  color: '#8a8a98',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Drop WAV onto Beat Lab Pad
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 38px)',
                  gridTemplateRows: 'repeat(4, 32px)',
                  gap: 4,
                }}
              >
                {Array.from({ length: 16 }, (_, i) => i).map((padIndex) => (
                  <button
                    key={padIndex}
                    type="button"
                    onClick={() => onPickExportPad(padIndex)}
                    disabled={exportBusy}
                    title={`Bounce progression to Pad ${padIndex + 1} (replaces any existing sample on that pad)`}
                    style={{
                      borderRadius: 4,
                      border: `1px solid ${MINT_DIM}`,
                      background: 'rgba(124, 244, 198, 0.08)',
                      color: MINT,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontWeight: 900,
                      fontSize: 11,
                      cursor: exportBusy ? 'wait' : 'pointer',
                      letterSpacing: 0.4,
                      transition: 'background 120ms ease, box-shadow 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (exportBusy) return;
                      e.currentTarget.style.background = 'rgba(124, 244, 198, 0.22)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(124, 244, 198, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(124, 244, 198, 0.08)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {padIndex + 1}
                  </button>
                ))}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 9,
                  color: '#8a8a98',
                  lineHeight: 1.35,
                  maxWidth: 168,
                }}
              >
                Click a pad to bounce the current progression as a one-shot WAV. Existing pad samples are replaced.
              </div>
            </div>
          ) : null}
          {exportStatus ? (
            <div
              role="status"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                whiteSpace: 'nowrap',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.3,
                color: exportStatus.startsWith('✓') ? MINT : '#ffb4b4',
                background: 'rgba(10, 10, 14, 0.95)',
                border: `1px solid ${exportStatus.startsWith('✓') ? MINT_DIM : 'rgba(255, 180, 180, 0.35)'}`,
                borderRadius: 4,
                padding: '4px 8px',
                pointerEvents: 'none',
                zIndex: 25,
              }}
            >
              {exportStatus}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Whole-song export cluster — bounces every populated Progression
          tab back-to-back as a single .wav or .mid file to the user's
          Downloads folder. Both buttons share one status pill so the
          toolbar doesn't get cluttered. */}
      <SongExportCluster
        onSaveSongWav={onSaveSongWav}
        onSaveSongMidi={onSaveSongMidi}
        canSaveSong={canSaveSong}
        songExportBusy={songExportBusy}
        songExportStatus={songExportStatus}
        songSectionsLabel={songSectionsLabel}
      />
    </div>
  );
}

/** Two-button cluster + shared status toast for the whole-song export
 *  (.wav / .mid downloads). Visually separated from the per-section
 *  Save MIDI / WAV → Pad cluster by a divider so the user can tell at a
 *  glance which buttons act on the active tab vs. the whole song. */
function SongExportCluster({
  onSaveSongWav,
  onSaveSongMidi,
  canSaveSong,
  songExportBusy,
  songExportStatus,
  songSectionsLabel,
}: {
  onSaveSongWav: () => void;
  onSaveSongMidi: () => void;
  canSaveSong: boolean;
  songExportBusy: false | 'wav' | 'midi';
  songExportStatus: string | null;
  songSectionsLabel: string;
}) {
  const wavBusy = songExportBusy === 'wav';
  const midiBusy = songExportBusy === 'midi';
  const tipBase = canSaveSong
    ? `Sections (in order): ${songSectionsLabel}`
    : 'Add chords to at least one tab first.';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 8,
        marginLeft: 4,
        borderLeft: '1px solid rgba(255,255,255,0.10)',
        position: 'relative',
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 900, color: '#8a8a98', letterSpacing: 1.4 }}>
        SONG
      </span>
      <ToolbarButton
        onClick={onSaveSongWav}
        icon={<Download size={11} />}
        label={wavBusy ? 'Rendering…' : 'Song → WAV'}
        primary
        disabled={!canSaveSong || songExportBusy !== false}
        title={
          canSaveSong
            ? `Save the WHOLE SONG (all tabs back-to-back) as a .wav file.\n${tipBase}`
            : tipBase
        }
      />
      <ToolbarButton
        onClick={onSaveSongMidi}
        icon={<Download size={11} />}
        label={midiBusy ? 'Saving…' : 'Song → MIDI'}
        disabled={!canSaveSong || songExportBusy !== false}
        title={
          canSaveSong
            ? `Save the WHOLE SONG (all tabs back-to-back) as a .mid file.\n${tipBase}`
            : tipBase
        }
      />
      {songExportStatus ? (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            whiteSpace: 'nowrap',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
            color: songExportStatus.startsWith('✓') ? MINT : '#ffb4b4',
            background: 'rgba(10, 10, 14, 0.95)',
            border: `1px solid ${songExportStatus.startsWith('✓') ? MINT_DIM : 'rgba(255, 180, 180, 0.35)'}`,
            borderRadius: 4,
            padding: '4px 8px',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        >
          {songExportStatus}
        </div>
      ) : null}
    </div>
  );
}

function ProgressionTabStrip({
  progressions,
  activeId,
  onSwitch,
  onAdd,
  onRemove,
  onRename,
  onAutoGenerate,
  autoGenStatus,
  canAutoGenerate,
}: {
  progressions: Progression[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** Fire to build a 5-section song plan from the active tab's chords. */
  onAutoGenerate: () => void;
  /** Transient explainer toast shown after auto-generate fires. */
  autoGenStatus: string | null;
  /** True only when the active tab has at least one chord placed. */
  canAutoGenerate: boolean;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '3px 8px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.08)',
        background: 'rgba(8, 8, 12, 0.85)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        overflowX: 'auto',
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 800, color: '#8a8a98', letterSpacing: 1.5, marginRight: 8, flexShrink: 0 }}>
        PROGRESSION
      </span>
      {progressions.map((p) => {
        const isActive = p.id === activeId;
        const canRemove = progressions.length > 1;
        return (
          <div
            key={p.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: '4px 4px 4px 8px',
              borderRadius: 4,
              border: `1px solid ${isActive ? MINT_DIM : 'rgba(255,255,255,0.08)'}`,
              background: isActive ? MINT_BG : 'rgba(255,255,255,0.03)',
              color: isActive ? MINT : '#cfd0d8',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onClick={() => onSwitch(p.id)}
            onDoubleClick={() => {
              const next = window.prompt('Rename progression:', p.name);
              if (next != null && next.trim().length > 0) onRename(p.id, next.trim());
            }}
            title="Click to switch · Double-click to rename"
          >
            <span>{p.name}</span>
            {canRemove ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete progression "${p.name}"?`)) onRemove(p.id);
                }}
                title="Delete progression"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  borderRadius: 2,
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  opacity: 0.6,
                  cursor: 'pointer',
                }}
              >
                <X size={10} />
              </button>
            ) : (
              <span style={{ width: 6 }} />
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        title="Add new progression section"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 8px',
          borderRadius: 4,
          border: `1px solid ${MINT_DIM}`,
          background: MINT_BG,
          color: MINT,
          fontSize: 10,
          fontWeight: 800,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Plus size={11} />
        New
      </button>

      {/* Auto-Generate Song — builds Intro, Pre-Chorus, Chorus, Bridge,
          Outro tabs from the chords already on the active tab. Disabled
          (and labelled accordingly) when the active tab is empty. */}
      <button
        type="button"
        onClick={onAutoGenerate}
        disabled={!canAutoGenerate}
        title={
          canAutoGenerate
            ? 'Auto-generate a full song plan (Intro · Pre-Chorus · Chorus · Bridge · Outro) from this tab\u2019s chords'
            : 'Add at least one chord to this tab first, then auto-generate.'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          marginLeft: 4,
          borderRadius: 4,
          border: `1px solid ${canAutoGenerate ? 'rgba(124, 244, 198, 0.7)' : 'rgba(255,255,255,0.08)'}`,
          background: canAutoGenerate
            ? 'linear-gradient(180deg, rgba(124, 244, 198, 0.25) 0%, rgba(10, 10, 14, 0.85) 100%)'
            : 'rgba(255,255,255,0.03)',
          color: canAutoGenerate ? MINT : '#54545e',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.3,
          cursor: canAutoGenerate ? 'pointer' : 'not-allowed',
          flexShrink: 0,
          boxShadow: canAutoGenerate
            ? '0 0 12px rgba(124, 244, 198, 0.25)'
            : 'none',
        }}
      >
        <Sparkles size={11} />
        AUTO-GENERATE SONG
      </button>

      {/* Inline status pill — surfaces what the auto-gen just did, or any
          error it ran into. Auto-dismisses after a few seconds. */}
      {autoGenStatus ? (
        <span
          role="status"
          style={{
            marginLeft: 8,
            padding: '3px 8px',
            borderRadius: 4,
            background: 'rgba(124, 244, 198, 0.10)',
            border: '1px solid rgba(124, 244, 198, 0.30)',
            color: '#cfd0d8',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 480,
            flexShrink: 1,
          }}
          title={autoGenStatus}
        >
          {autoGenStatus}
        </span>
      ) : null}
    </div>
  );
}

function PresetStrip({
  genre,
  keyRoot,
  mode,
  onPickPreset,
}: {
  genre: GenreDef;
  keyRoot: number;
  mode: ChordMode;
  onPickPreset: (chords: ChordSymbol[]) => void;
}) {
  /** Shorten very long progressions (e.g. 12-bar blues = 12 chords) so the
   *  preview chord-name strip doesn't run off the button. */
  function previewChain(chords: ChordSymbol[]): string {
    const names = chords.map((c) => chordSymbolToName(c, keyRoot, mode));
    if (names.length <= 6) return names.join(' · ');
    return `${names.slice(0, 6).join(' · ')} · …`;
  }
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '5px 12px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.18)',
        background:
          'linear-gradient(180deg, rgba(124, 244, 198, 0.06) 0%, rgba(10, 10, 14, 0.85) 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: '#7cf4c6',
            letterSpacing: 1.4,
            textShadow: '0 0 8px rgba(124, 244, 198, 0.35)',
          }}
        >
          🎼 CHORD PROGRESSIONS
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#a8a8b4', letterSpacing: 0.4 }}>
          · {genre.label.toUpperCase()}
        </span>
        <span style={{ fontSize: 8, fontWeight: 600, color: '#54545e', marginLeft: 'auto' }}>
          tap to load onto the piano roll
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {genre.progressions.map((p) => {
          const chain = previewChain(p.chords);
          const romans = p.chords.length <= 8 ? p.chords.join(' · ') : `${p.chords.slice(0, 8).join(' · ')} · …`;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPickPreset(p.chords)}
              title={`${p.name}\n${p.chords.join(' · ')}\n${p.chords
                .map((c) => chordSymbolToName(c, keyRoot, mode))
                .join(' · ')}`}
              style={{
                flexShrink: 0,
                minWidth: 140,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid rgba(124, 244, 198, 0.28)',
                background:
                  'linear-gradient(180deg, rgba(124, 244, 198, 0.08) 0%, rgba(10, 10, 14, 0.85) 100%)',
                color: '#dcdce4',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.4) inset',
                transition: 'background 80ms linear, box-shadow 80ms linear',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  'linear-gradient(180deg, rgba(124, 244, 198, 0.18) 0%, rgba(10, 10, 14, 0.85) 100%)';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(124, 244, 198, 0.30)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  'linear-gradient(180deg, rgba(124, 244, 198, 0.08) 0%, rgba(10, 10, 14, 0.85) 100%)';
                e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.4) inset';
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#dcdce4',
                  letterSpacing: 0.2,
                  lineHeight: 1.1,
                }}
              >
                {p.name.split(' (')[0]}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#7cf4c6',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  lineHeight: 1.1,
                }}
              >
                {chain}
              </span>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  color: '#6a6a78',
                  fontFamily: 'monospace',
                  letterSpacing: 0.2,
                  lineHeight: 1.1,
                }}
              >
                {romans}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Horizontal "sound bank" picker — sits in the same band as the Chord
 *  Progressions and Suggestions strips. Each button is a tiny voice card:
 *  glyph + label + category tag, with the active voice rendered in the
 *  bright mint state so you can spot it at a glance.
 *
 *  Clicking a card swaps the active voice. The audition of the currently-
 *  selected chord pad happens in the parent handler so the user hears the
 *  new timbre instantly — same pattern as the chord progression presets. */
function SoundBankStrip({
  instrumentId,
  onPickInstrument,
}: {
  instrumentId: ChordInstrumentId;
  onPickInstrument: (id: ChordInstrumentId) => void;
}) {
  const active = CHORD_INSTRUMENTS.find((i) => i.id === instrumentId) ?? CHORD_INSTRUMENTS[0]!;
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '5px 12px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.18)',
        background:
          'linear-gradient(180deg, rgba(124, 244, 198, 0.06) 0%, rgba(10, 10, 14, 0.85) 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: '#7cf4c6',
            letterSpacing: 1.4,
            textShadow: '0 0 8px rgba(124, 244, 198, 0.35)',
          }}
        >
          🎵 SOUND BANK
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#a8a8b4', letterSpacing: 0.4 }}>
          · {active.label.toUpperCase()}
        </span>
        <span style={{ fontSize: 8, fontWeight: 600, color: '#54545e', marginLeft: 'auto' }}>
          tap to switch the chord voice
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label="Chord voice"
        style={{ display: 'flex', alignItems: 'stretch', gap: 6, overflowX: 'auto', paddingBottom: 2 }}
      >
        {CHORD_INSTRUMENTS.map((inst) => {
          const isActive = inst.id === instrumentId;
          return (
            <button
              key={inst.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onPickInstrument(inst.id)}
              title={inst.description}
              style={{
                flexShrink: 0,
                minWidth: 120,
                padding: '6px 10px',
                borderRadius: 6,
                border: isActive
                  ? '1px solid rgba(124, 244, 198, 0.75)'
                  : '1px solid rgba(124, 244, 198, 0.28)',
                background: isActive
                  ? 'linear-gradient(180deg, rgba(124, 244, 198, 0.22) 0%, rgba(10, 10, 14, 0.85) 100%)'
                  : 'linear-gradient(180deg, rgba(124, 244, 198, 0.08) 0%, rgba(10, 10, 14, 0.85) 100%)',
                color: '#dcdce4',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                boxShadow: isActive
                  ? '0 0 12px rgba(124, 244, 198, 0.32), 0 0 0 1px rgba(0,0,0,0.4) inset'
                  : '0 0 0 1px rgba(0,0,0,0.4) inset',
                transition: 'background 80ms linear, box-shadow 80ms linear, border-color 80ms linear',
              }}
              onMouseEnter={(e) => {
                if (isActive) return;
                e.currentTarget.style.background =
                  'linear-gradient(180deg, rgba(124, 244, 198, 0.18) 0%, rgba(10, 10, 14, 0.85) 100%)';
                e.currentTarget.style.boxShadow =
                  '0 0 10px rgba(124, 244, 198, 0.30), 0 0 0 1px rgba(0,0,0,0.4) inset';
              }}
              onMouseLeave={(e) => {
                if (isActive) return;
                e.currentTarget.style.background =
                  'linear-gradient(180deg, rgba(124, 244, 198, 0.08) 0%, rgba(10, 10, 14, 0.85) 100%)';
                e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.4) inset';
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  color: isActive ? '#7cf4c6' : '#dcdce4',
                  letterSpacing: 0.2,
                  lineHeight: 1.1,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: isActive ? '#7cf4c6' : '#a8a8b4',
                    textShadow: isActive ? '0 0 6px rgba(124, 244, 198, 0.5)' : 'none',
                  }}
                >
                  {inst.glyph}
                </span>
                <span>{inst.label}</span>
              </span>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: isActive ? 'rgba(124, 244, 198, 0.75)' : '#6a6a78',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}
              >
                {inst.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Chord-block grid — ChordSeqAI-style horizontal lane of resizable chord
 * blocks. Sits between the AI Suggestions strip and the piano roll, and
 * is the primary surface for **arranging** a progression (the piano roll
 * stays the primary surface for surgical note edits).
 *
 * Visual layout, left to right:
 *   ╭───────────────────────────────────────────────╮
 *   │ bar numbers + beat ticks                       │
 *   │ ┌────────┐ ┌──────────────┐ ┌────┐             │
 *   │ │  Am7   │ │    F maj     │ │ G  │             │
 *   │ │   vi   │ │     IV       │ │ V  │             │
 *   │ └────────┘ └──────────────┘ └────┘             │
 *   │ ▲playhead                                      │
 *   ╰───────────────────────────────────────────────╯
 *
 * Interactions:
 *   • Click block → select it (drives selection-aware suggestion context)
 *   • Drag right-edge resize handle → resize duration, snaps to beats
 *   • Drop a chord pad onto a block → replace its chord, preserve length
 *   • Drop a chord pad onto empty space → append a new block at the end
 *   • Click empty space → append a new block using `selectedPad`
 *   • Click a tick in the ruler → move playhead to that beat
 *   • Delete / Backspace while focused → remove selected block
 *
 * Sizing constants live as local consts so they're easy to tweak; the
 * grid is fully responsive to the surrounding panel width because it
 * scrolls horizontally.
 */
function ChordBlockGrid({
  blocks,
  keyRoot,
  mode,
  playheadCol,
  isPlaying,
  playheadElRef,
  selectedBlockId,
  onSelectBlock,
  onReplaceBlockChord,
  onResizeBlock,
  onRemoveBlock,
  onAppendBlock,
  onReorderBlock: _onReorderBlock,
  onPlayheadChange,
  selectedPad,
}: {
  blocks: ChordBlock[];
  keyRoot: number;
  mode: ChordMode;
  playheadCol: number;
  /** True while the parent's rAF loop owns the playhead `transform`. */
  isPlaying: boolean;
  /** Parent-owned ref to the playhead element — the parent rAF writes
   *  `transform: translateX(...)` directly to it during playback so the
   *  line glides without re-rendering the whole grid each frame. */
  playheadElRef?: React.MutableRefObject<HTMLDivElement | null>;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onReplaceBlockChord: (id: string, chord: ChordSymbol) => void;
  onResizeBlock: (id: string, durationBeats: number) => void;
  onRemoveBlock: (id: string) => void;
  onAppendBlock: (chord: ChordSymbol) => void;
  onReorderBlock: (fromIndex: number, toIndex: number) => void;
  onPlayheadChange: (col: number) => void;
  selectedPad: ChordSymbol;
}) {
  const PX_PER_BEAT = GRID_PX_PER_BEAT; // hoisted so parent rAF can use it
  const BAR_LABEL_H_GRID = 22;       // bar numbers row
  const TICK_ROW_H = 14;             // beat ticks row directly above the lane
  const BLOCK_LANE_H = 64;           // chord block lane height
  const RESIZE_HANDLE_W = 8;         // right-edge grab area
  const MIN_GRID_BARS = 8;           // always show at least 8 bars wide

  const startBeats = useMemo(() => cumulativeStartBeats(blocks), [blocks]);
  const totalBeats = useMemo(() => totalBlockBeats(blocks), [blocks]);
  // Show enough bars to cover either the placed content or the minimum.
  const totalBars = Math.max(
    MIN_GRID_BARS,
    Math.ceil(totalBeats / BEATS_PER_BAR) + 1,
  );
  const totalGridBeats = totalBars * BEATS_PER_BAR;
  const gridPxWidth = totalGridBeats * PX_PER_BEAT;

  // Drag-resize state. Stored in a ref so React re-renders never recreate
  // the listeners mid-drag (the listeners attach to `window` for the
  // duration of the drag and detach on mouseup).
  const resizeStateRef = useRef<
    | {
        blockId: string;
        startMouseX: number;
        startBeats: number;
      }
    | null
  >(null);
  // Container ref so we can imperatively focus the grid after any block
  // click. Without this, Delete/Backspace only works if the user
  // *separately* clicks the grid background first — confusing UX.
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The grid pixel width during a drag is captured at drag start so the
  // resize hit math doesn't shift as the block grows.
  const [previewResizeBeats, setPreviewResizeBeats] = useState<{
    blockId: string;
    durationBeats: number;
  } | null>(null);

  function onResizeMouseDown(e: React.MouseEvent, block: ChordBlock) {
    e.preventDefault();
    e.stopPropagation();
    resizeStateRef.current = {
      blockId: block.id,
      startMouseX: e.clientX,
      startBeats: block.durationBeats,
    };
    setPreviewResizeBeats({ blockId: block.id, durationBeats: block.durationBeats });
    const onMove = (ev: MouseEvent) => {
      const s = resizeStateRef.current;
      if (!s) return;
      const deltaPx = ev.clientX - s.startMouseX;
      const deltaBeatsRaw = deltaPx / PX_PER_BEAT;
      // Snap to whole beats so the user always lands on the tick grid.
      const snapped = Math.round(s.startBeats + deltaBeatsRaw);
      const clamped = Math.max(MIN_BLOCK_BEATS, Math.min(MAX_BLOCK_BEATS, snapped));
      setPreviewResizeBeats({ blockId: s.blockId, durationBeats: clamped });
    };
    const onUp = () => {
      const s = resizeStateRef.current;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (s) {
        // Commit the latest preview to state.
        setPreviewResizeBeats((prev) => {
          if (prev && prev.blockId === s.blockId) {
            onResizeBlock(s.blockId, prev.durationBeats);
          }
          return null;
        });
      }
      resizeStateRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onBlockClick(e: React.MouseEvent, block: ChordBlock) {
    // Don't steal selection during a resize commit.
    if (resizeStateRef.current) return;
    e.stopPropagation();
    onSelectBlock(block.id);
    // Pull focus into the grid container so Delete / Backspace / Esc
    // work immediately. Without this the keydown handler on the
    // container only fires after the user separately clicks the grid
    // background, which is a confusing extra step.
    containerRef.current?.focus({ preventScroll: true });
  }

  /** Right-click anywhere on a block → delete it. Standard DAW gesture
   *  for "kill this clip"; also covers users who never noticed the
   *  Delete-key shortcut. We swallow the browser's default context menu
   *  so we don't get a "Reload / Inspect" popup over the chord. */
  function onBlockContextMenu(e: React.MouseEvent, block: ChordBlock) {
    e.preventDefault();
    e.stopPropagation();
    onRemoveBlock(block.id);
  }

  function onLaneClick(e: React.MouseEvent) {
    // Clicking dead space in the lane appends a new block using the
    // currently-selected chord pad. Cheap "make this chord live now" UX
    // that pairs with the AI Suggestions strip below.
    if ((e.target as HTMLElement).closest('[data-cb-block]')) return;
    if ((e.target as HTMLElement).closest('[data-cb-tick-row]')) return;
    onAppendBlock(selectedPad);
  }

  function onTickRowMouseDown(e: React.MouseEvent) {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = Math.max(0, Math.round(x / PX_PER_BEAT));
    onPlayheadChange(beat);
  }

  function onBlockDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(DND_CHORD_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function onBlockDrop(e: React.DragEvent, block: ChordBlock) {
    if (!e.dataTransfer.types.includes(DND_CHORD_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    const chord = e.dataTransfer.getData(DND_CHORD_MIME);
    if (!chord) return;
    onReplaceBlockChord(block.id, chord);
    onSelectBlock(block.id);
  }

  function onLaneDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(DND_CHORD_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function onLaneDrop(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(DND_CHORD_MIME)) return;
    if ((e.target as HTMLElement).closest('[data-cb-block]')) return;
    e.preventDefault();
    e.stopPropagation();
    const chord = e.dataTransfer.getData(DND_CHORD_MIME);
    if (!chord) return;
    onAppendBlock(chord);
  }

  function onContainerKeyDown(e: React.KeyboardEvent) {
    if (!selectedBlockId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onRemoveBlock(selectedBlockId);
    } else if (e.key === 'Escape') {
      onSelectBlock(null);
    }
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Chord block grid"
      tabIndex={0}
      onKeyDown={onContainerKeyDown}
      style={{
        flexShrink: 0,
        padding: '8px 12px 10px 12px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.18)',
        background:
          'linear-gradient(180deg, rgba(124, 244, 198, 0.04) 0%, rgba(8, 8, 12, 0.92) 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        outline: 'none',
      }}
    >
      {/* Title row. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            color: '#7cf4c6',
            letterSpacing: 1.2,
            textShadow: '0 0 6px rgba(124, 244, 198, 0.35)',
          }}
        >
          🎼 CHORD GRID
        </span>
        <span style={{ fontSize: 9, color: '#7a7a86', fontWeight: 700, letterSpacing: 0.4 }}>
          drag right edge to resize · drop a chord pad to add · click ticks to scrub · right-click or × to delete
        </span>
        <span style={{ flex: 1 }} />
        {blocks.length > 0 ? (
          <span style={{ fontSize: 9, color: '#a8a8b4', fontWeight: 700 }}>
            {blocks.length} block{blocks.length === 1 ? '' : 's'} · {totalBeats} beat
            {totalBeats === 1 ? '' : 's'} ({(totalBeats / BEATS_PER_BAR).toFixed(2)} bars)
          </span>
        ) : (
          <span style={{ fontSize: 9, color: '#54545e', fontStyle: 'italic' }}>
            empty — drop a chord pad or click an empty bar to begin
          </span>
        )}
      </div>

      {/* Scrollable grid. */}
      <div
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          borderRadius: 6,
          border: '1px solid rgba(124, 244, 198, 0.18)',
          background: '#06060a',
        }}
        onClick={onLaneClick}
        onDragOver={onLaneDragOver}
        onDrop={onLaneDrop}
      >
        <div style={{ position: 'relative', width: gridPxWidth, minWidth: '100%' }}>
          {/* Bar numbers. */}
          <div
            style={{
              height: BAR_LABEL_H_GRID,
              display: 'flex',
              borderBottom: '1px solid rgba(124, 244, 198, 0.08)',
            }}
          >
            {Array.from({ length: totalBars }, (_, b) => (
              <div
                key={b}
                style={{
                  width: BEATS_PER_BAR * PX_PER_BEAT,
                  borderRight: '1px solid rgba(124, 244, 198, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#7cf4c6',
                  letterSpacing: 0.8,
                }}
              >
                Bar {b + 1}
              </div>
            ))}
          </div>

          {/* Beat ticks + playhead-scrub strip. */}
          <div
            data-cb-tick-row
            onMouseDown={onTickRowMouseDown}
            style={{
              height: TICK_ROW_H,
              position: 'relative',
              cursor: 'pointer',
              background: 'rgba(124, 244, 198, 0.03)',
              borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
            }}
          >
            {Array.from({ length: totalGridBeats + 1 }, (_, i) => {
              const isBar = i % BEATS_PER_BAR === 0;
              return (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: i * PX_PER_BEAT,
                    top: isBar ? 2 : 5,
                    bottom: 0,
                    width: 1,
                    background: isBar
                      ? 'rgba(124, 244, 198, 0.55)'
                      : 'rgba(124, 244, 198, 0.18)',
                  }}
                />
              );
            })}
            {/* Playhead — `left: 0` is the static anchor; the parent's
                rAF loop writes `transform: translateX(...)` straight to
                this node so the line moves smoothly without triggering
                React re-renders. While playing we omit `transform` from
                the React-managed style so React doesn't reset the
                rAF-written value on unrelated re-renders. */}
            <div
              ref={playheadElRef}
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                ...(isPlaying
                  ? null
                  : { transform: `translateX(${playheadCol * PX_PER_BEAT}px)` }),
                willChange: 'transform',
                top: 0,
                bottom: -BLOCK_LANE_H,
                width: 1,
                background: '#ff6b35',
                boxShadow: '0 0 6px rgba(255, 107, 53, 0.55)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Chord block lane. */}
          <div
            style={{
              height: BLOCK_LANE_H,
              position: 'relative',
              background:
                'repeating-linear-gradient(' +
                'to right, rgba(124, 244, 198, 0.05) 0, rgba(124, 244, 198, 0.05) 1px, ' +
                'transparent 1px, transparent ' + (PX_PER_BEAT * BEATS_PER_BAR) + 'px)',
            }}
          >
            {blocks.map((b, idx) => {
              const left = startBeats[idx]! * PX_PER_BEAT;
              // During an active drag, show the preview width instead of
              // the committed width so the resize feels live.
              const previewBeats =
                previewResizeBeats && previewResizeBeats.blockId === b.id
                  ? previewResizeBeats.durationBeats
                  : b.durationBeats;
              const width = Math.max(MIN_BLOCK_BEATS, previewBeats) * PX_PER_BEAT;
              const isSelected = b.id === selectedBlockId;
              const chordName = chordSymbolToName(b.chord, keyRoot, mode);
              const color = chordColorFromSymbol(b.chord);
              return (
                <div
                  key={b.id}
                  data-cb-block
                  onClick={(e) => onBlockClick(e, b)}
                  onContextMenu={(e) => onBlockContextMenu(e, b)}
                  onDragOver={onBlockDragOver}
                  onDrop={(e) => onBlockDrop(e, b)}
                  title={`${chordName} (${b.chord}) · ${b.durationBeats} beat${b.durationBeats === 1 ? '' : 's'} — click to select, drag right edge to resize, right-click to delete`}
                  style={{
                    position: 'absolute',
                    left,
                    top: 4,
                    width: width - 2,
                    height: BLOCK_LANE_H - 8,
                    borderRadius: 4,
                    border: isSelected
                      ? `2px solid ${color.accent}`
                      : `1px solid ${color.border}`,
                    background: `linear-gradient(180deg, ${color.fill} 0%, ${color.fillDim} 100%)`,
                    color: '#fff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    boxShadow: isSelected
                      ? `0 0 14px ${color.accent}, inset 0 0 0 1px rgba(255, 255, 255, 0.15)`
                      : 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'box-shadow 120ms ease-out',
                    userSelect: 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: 14,
                      fontWeight: 900,
                      color: '#fff',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
                      letterSpacing: 0.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                      padding: '0 6px',
                    }}
                  >
                    {chordName}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: 'rgba(255, 255, 255, 0.85)',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      letterSpacing: 0.8,
                    }}
                  >
                    {b.chord}
                  </span>
                  {/* Delete button — only rendered on the selected block
                      so the lane stays uncluttered. Stops propagation so
                      the click doesn't also re-select the block (which
                      would just put us right back to step 1). Sized to be
                      tappable but small enough that it doesn't compete
                      with the chord name. */}
                  {isSelected && (
                    <button
                      type="button"
                      aria-label={`Delete ${chordName}`}
                      title={`Delete ${chordName}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveBlock(b.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: 3,
                        right: RESIZE_HANDLE_W + 3,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        border: '1px solid rgba(255, 255, 255, 0.35)',
                        background: 'rgba(0, 0, 0, 0.55)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 800,
                        lineHeight: '14px',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
                      }}
                    >
                      ×
                    </button>
                  )}
                  {/* Right-edge resize handle. */}
                  <span
                    aria-hidden
                    onMouseDown={(e) => onResizeMouseDown(e, b)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: RESIZE_HANDLE_W,
                      cursor: 'ew-resize',
                      background:
                        'linear-gradient(' +
                        'to right, transparent 0%, rgba(255, 255, 255, 0.18) 100%)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Build a stable color palette for a chord symbol. The grid uses these
 *  for block fills so adjacent identical chords visually merge while
 *  different chords clearly contrast. Hash function is the cheap
 *  unsigned-32-bit string hash — no cryptographic guarantees needed; just
 *  consistency between renders. */
function chordColorFromSymbol(symbol: ChordSymbol): {
  fill: string;
  fillDim: string;
  border: string;
  accent: string;
} {
  let hash = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    hash ^= symbol.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  // 14 distinct hues in the cool half of the wheel — looks coherent with
  // the Chord Builder mint/lavender palette while still distinguishable.
  const palette = [
    { fill: '#7c3aed', fillDim: '#3b1f7a', border: '#a78bfa', accent: '#c4b5fd' },
    { fill: '#0ea5e9', fillDim: '#0c4a6e', border: '#38bdf8', accent: '#7dd3fc' },
    { fill: '#10b981', fillDim: '#064e3b', border: '#34d399', accent: '#6ee7b7' },
    { fill: '#f59e0b', fillDim: '#78350f', border: '#fbbf24', accent: '#fcd34d' },
    { fill: '#ef4444', fillDim: '#7f1d1d', border: '#f87171', accent: '#fca5a5' },
    { fill: '#ec4899', fillDim: '#831843', border: '#f472b6', accent: '#f9a8d4' },
    { fill: '#8b5cf6', fillDim: '#4c1d95', border: '#a78bfa', accent: '#c4b5fd' },
    { fill: '#06b6d4', fillDim: '#164e63', border: '#22d3ee', accent: '#67e8f9' },
    { fill: '#84cc16', fillDim: '#3f6212', border: '#a3e635', accent: '#bef264' },
    { fill: '#f97316', fillDim: '#7c2d12', border: '#fb923c', accent: '#fdba74' },
    { fill: '#14b8a6', fillDim: '#134e4a', border: '#2dd4bf', accent: '#5eead4' },
    { fill: '#6366f1', fillDim: '#312e81', border: '#818cf8', accent: '#a5b4fc' },
    { fill: '#e11d48', fillDim: '#881337', border: '#fb7185', accent: '#fda4af' },
    { fill: '#22c55e', fillDim: '#14532d', border: '#4ade80', accent: '#86efac' },
  ];
  return palette[hash % palette.length]!;
}

/**
 * AI Suggestions strip — top-K next-chord candidates from the active
 * suggester backend (rule-based today, ChordSeqAI ONNX later). Reads the
 * progression-so-far from the active tab's timeline (not the currently
 * selected chord pad — that's the role of `ChordSuggestionsStrip` below)
 * so the rankings update as the user lays down chords.
 *
 * Visual: each candidate is a chip with the chord name, Roman-numeral
 * symbol, and a confidence bar across the bottom. Confidence values come
 * from the suggester normalised over the top-K, so the bars in the strip
 * always add up to 100%.
 *
 * The backend pill at the top-right shows which engine is talking. Once
 * the ONNX backends are flagged `isAvailable`, this picker becomes a
 * dropdown — the data is already in `CHORD_SUGGESTER_BACKENDS`.
 */

/**
 * A thin always-visible tab strip that toggles the AI Suggestions + Chord
 * Block Grid panels open and closed. Default state is collapsed so the
 * piano roll keeps maximum vertical room while the user picks chord
 * progressions. Mounting the tab itself (rather than the heavy panels)
 * keeps the feature discoverable without paying its layout cost.
 *
 * `suggestionCount` and `blockCount` surface as small chip counters so the
 * user can see, at a glance, whether the AI has anything to suggest and
 * how many blocks are sitting in the grid — even while the panel is shut.
 */
function AiGridTab({
  open,
  onToggle,
  suggestionCount,
  blockCount,
}: {
  open: boolean;
  onToggle: () => void;
  suggestionCount: number;
  blockCount: number;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '4px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: open
          ? 'linear-gradient(180deg, rgba(124, 244, 198, 0.10) 0%, rgba(124, 244, 198, 0.04) 100%)'
          : 'linear-gradient(180deg, rgba(20, 20, 26, 0.95) 0%, rgba(10, 10, 14, 0.98) 100%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        title={
          open
            ? 'Hide AI suggestions and the chord block grid (gives the piano roll more room)'
            : 'Show AI chord suggestions and the beat-precise chord block grid'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          border: `1px solid ${open ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.10)'}`,
          borderRadius: 4,
          background: open
            ? 'rgba(124, 244, 198, 0.14)'
            : 'rgba(255, 255, 255, 0.03)',
          color: open ? '#7cf4c6' : '#c8c8d0',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.0,
          cursor: 'pointer',
        }}
      >
        <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>
          {open ? '▾' : '▸'}
        </span>
        <span>AI SUGGESTIONS &amp; CHORD GRID</span>
        {suggestionCount > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 14,
              padding: '0 5px',
              borderRadius: 7,
              background: 'rgba(124, 244, 198, 0.20)',
              color: '#7cf4c6',
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.4,
            }}
            title={`${suggestionCount} AI suggestion${suggestionCount === 1 ? '' : 's'} ready`}
          >
            AI · {suggestionCount}
          </span>
        )}
        {blockCount > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 14,
              padding: '0 5px',
              borderRadius: 7,
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#c8c8d0',
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.4,
            }}
            title={`${blockCount} chord block${blockCount === 1 ? '' : 's'} in the grid`}
          >
            GRID · {blockCount}
          </span>
        )}
      </button>
      <span
        style={{
          fontSize: 8,
          fontWeight: 600,
          color: '#54545e',
          letterSpacing: 0.4,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {open
          ? 'click chips to append a chord · drag blocks to resize · right-click or Delete to remove'
          : 'closed — chord progressions still apply to the piano roll below'}
      </span>
    </div>
  );
}

function AiSuggestionsStrip({
  suggester,
  suggesterId,
  onPickBackend,
  suggestions,
  loading,
  error,
  contextLength,
  keyRoot,
  mode,
  onAppendChord,
}: {
  suggester: ChordSuggester | null;
  suggesterId: ChordSuggesterId;
  onPickBackend: (id: ChordSuggesterId) => void;
  suggestions: ChordSuggestion[];
  loading: boolean;
  error: string | null;
  contextLength: number;
  keyRoot: number;
  mode: ChordMode;
  onAppendChord: (chord: ChordSymbol) => void;
}) {
  const availableBackends = useMemo(
    () => getAvailableChordSuggesterBackends(),
    [],
  );
  const showPicker = availableBackends.length > 1;
  const backendInfo = CHORD_SUGGESTER_BACKENDS.find((b) => b.id === suggesterId);
  const backendLabel = backendInfo?.displayName ?? 'Suggester';
  const hasContext = contextLength > 0;
  // Top confidence used to size the bars relatively — if the highest
  // candidate is only 30%, scaling against 1.0 makes the strip look weak,
  // so we scale against the top entry to keep the bars meaningful.
  const topConfidence = suggestions[0]?.confidence ?? 0;
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '6px 12px 8px 12px',
        borderBottom: '1px solid rgba(167, 139, 250, 0.22)',
        background:
          'linear-gradient(180deg, rgba(167, 139, 250, 0.05) 0%, rgba(10, 10, 14, 0.85) 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            color: '#c4b5fd',
            letterSpacing: 1.2,
            textShadow: '0 0 6px rgba(167, 139, 250, 0.35)',
          }}
        >
          🧠 AI SUGGESTIONS
        </span>
        <span style={{ fontSize: 9, color: '#7a7a86', fontWeight: 700, letterSpacing: 0.4 }}>
          {hasContext
            ? `Based on ${contextLength} chord${contextLength === 1 ? '' : 's'} placed`
            : 'Place a chord — predictions update live'}
        </span>
        <span style={{ flex: 1 }} />
        {/* Backend label / picker. Renders as a dropdown once more than
            one backend is available (i.e. once ONNX is wired up); until
            then it's a static pill so users still know what's running. */}
        {showPicker ? (
          <select
            className="cb-select"
            value={suggesterId}
            onChange={(e) => onPickBackend(e.target.value as ChordSuggesterId)}
            title="Switch the AI engine that powers these suggestions"
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.5,
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid rgba(167, 139, 250, 0.45)',
              background: 'rgba(167, 139, 250, 0.12)',
              color: '#c4b5fd',
              cursor: 'pointer',
            }}
          >
            {availableBackends.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        ) : (
          <span
            title={backendInfo?.description ?? backendLabel}
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.5,
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid rgba(167, 139, 250, 0.45)',
              background: 'rgba(167, 139, 250, 0.12)',
              color: '#c4b5fd',
            }}
          >
            {backendLabel}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            fontSize: 9,
            color: '#fca5a5',
            fontStyle: 'italic',
            padding: '2px 0',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, overflowX: 'auto' }}>
        {loading && !suggester ? (
          <span style={{ fontSize: 9, color: '#54545e', fontStyle: 'italic' }}>
            Loading suggester…
          </span>
        ) : suggestions.length === 0 ? (
          <span style={{ fontSize: 9, color: '#54545e', fontStyle: 'italic' }}>
            {hasContext
              ? 'No high-confidence next chord — try a different genre or clear and start fresh.'
              : 'Place your first chord on the timeline to see predictions.'}
          </span>
        ) : (
          suggestions.map((s, idx) => {
            const chordName = chordSymbolToName(s.chord, keyRoot, mode);
            const pct = Math.round(s.confidence * 100);
            // Scale bar width against the top entry so users can see
            // ranking at a glance — the #1 chip always reads as "full".
            const barFill = topConfidence > 0 ? Math.max(0.08, s.confidence / topConfidence) : 0;
            const isTop = idx === 0;
            return (
              <button
                key={`${s.chord}-${idx}`}
                type="button"
                onClick={() => onAppendChord(s.chord)}
                title={`${s.chord} (${chordName}) — ${pct}% confidence${s.rationale ? `\n${s.rationale}` : ''}`}
                style={{
                  flexShrink: 0,
                  position: 'relative',
                  padding: '5px 12px 12px 12px',
                  borderRadius: 4,
                  border: `1px solid ${isTop ? 'rgba(196, 181, 253, 0.7)' : 'rgba(167, 139, 250, 0.4)'}`,
                  background: isTop
                    ? 'linear-gradient(180deg, rgba(167, 139, 250, 0.22) 0%, rgba(10, 10, 14, 0.85) 100%)'
                    : 'linear-gradient(180deg, rgba(167, 139, 250, 0.10) 0%, rgba(10, 10, 14, 0.85) 100%)',
                  color: '#dcdce4',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  minWidth: 64,
                }}
              >
                <span
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: isTop ? '#e9d5ff' : '#c4b5fd',
                  }}
                >
                  {chordName}
                </span>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#8a8a98' }}>
                  {s.chord} · {pct}%
                </span>
                {/* Confidence bar pinned to the bottom edge of the chip. */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 4,
                    right: 4,
                    bottom: 3,
                    height: 3,
                    borderRadius: 2,
                    background: 'rgba(255, 255, 255, 0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: `${barFill * 100}%`,
                      height: '100%',
                      background: isTop
                        ? 'linear-gradient(90deg, #c4b5fd 0%, #7cf4c6 100%)'
                        : 'rgba(196, 181, 253, 0.6)',
                      boxShadow: isTop
                        ? '0 0 6px rgba(196, 181, 253, 0.5)'
                        : 'none',
                      transition: 'width 0.2s ease-out',
                    }}
                  />
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Live "what goes with this chord" suggestion strip. Watches the currently
 *  selected chord pad and surfaces (a) the chords that statistically follow
 *  it most often in the active genre's curated data, and (b) full curated
 *  progressions that contain that chord, so the user can swap an idea in
 *  with one tap. */
function ChordSuggestionsStrip({
  selectedPad,
  genre,
  keyRoot,
  mode,
  onAppendChord,
  onPickPreset,
}: {
  selectedPad: ChordSymbol;
  genre: GenreDef;
  keyRoot: number;
  mode: ChordMode;
  onAppendChord: (chord: ChordSymbol) => void;
  onPickPreset: (chords: ChordSymbol[]) => void;
}) {
  const likely = useMemo(
    () => suggestLikelyNextChords(selectedPad, genre, 6),
    [selectedPad, genre],
  );
  const matching: ProgressionDef[] = useMemo(
    () => findProgressionsWithChord(selectedPad, genre).slice(0, 6),
    [selectedPad, genre],
  );
  const selectedName = chordSymbolToName(selectedPad, keyRoot, mode);
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '4px 12px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.18)',
        background:
          'linear-gradient(180deg, rgba(124, 244, 198, 0.04) 0%, rgba(10, 10, 14, 0.85) 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            color: '#7cf4c6',
            letterSpacing: 1.2,
            textShadow: '0 0 6px rgba(124, 244, 198, 0.30)',
          }}
        >
          🔗 GOES WITH
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#dcdce4' }}>{selectedName}</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: '#54545e', letterSpacing: 0.4 }}>
          ({selectedPad})
        </span>
        <span style={{ fontSize: 8, fontWeight: 600, color: '#54545e', marginLeft: 'auto' }}>
          tap a chord chip to append · tap a card to load
        </span>
      </div>

      {/* Likely Next chord chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
        <span style={{ fontSize: 8, fontWeight: 800, color: '#7a7a86', letterSpacing: 1, flexShrink: 0 }}>
          LIKELY NEXT:
        </span>
        {likely.length === 0 ? (
          <span style={{ fontSize: 9, color: '#54545e', fontStyle: 'italic' }}>
            no curated transitions for this chord in {genre.label}
          </span>
        ) : (
          likely.map(({ chord, weight }) => {
            const chordName = chordSymbolToName(chord, keyRoot, mode);
            return (
              <button
                key={chord}
                type="button"
                onClick={() => onAppendChord(chord)}
                title={`${chord} (${chordName}) — appears ${weight} time${weight === 1 ? '' : 's'} after ${selectedPad} in this genre`}
                style={{
                  flexShrink: 0,
                  padding: '4px 9px',
                  borderRadius: 4,
                  border: '1px solid rgba(124, 244, 198, 0.35)',
                  background:
                    'linear-gradient(180deg, rgba(124, 244, 198, 0.12) 0%, rgba(10, 10, 14, 0.85) 100%)',
                  color: '#dcdce4',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: '#7cf4c6',
                  }}
                >
                  {chordName}
                </span>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#8a8a98' }}>
                  {chord}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Curated progressions that include the selected chord */}
      {matching.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, overflowX: 'auto' }}>
          <span
            style={{
              fontSize: 8,
              fontWeight: 800,
              color: '#7a7a86',
              letterSpacing: 1,
              flexShrink: 0,
              alignSelf: 'center',
            }}
          >
            PROGRESSIONS USING IT:
          </span>
          {matching.map((p) => {
            const chain = p.chords.map((c) => chordSymbolToName(c, keyRoot, mode));
            const chainLabel = chain.length <= 5 ? chain.join(' · ') : `${chain.slice(0, 5).join(' · ')} · …`;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPickPreset(p.chords)}
                title={`${p.name}\n${p.chords.join(' · ')}\n${chain.join(' · ')}`}
                style={{
                  flexShrink: 0,
                  padding: '4px 8px',
                  borderRadius: 5,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#cfd0d8',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  lineHeight: 1.1,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800, color: '#dcdce4' }}>
                  {p.name.split(' (')[0]}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#7cf4c6',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  }}
                >
                  {chainLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChordScaleStrip({
  pads,
  keyRoot,
  mode,
  selectedPad,
  progressionStep,
  progressionCount,
  onPadClick,
  onPadDoubleClick,
}: {
  pads: ChordSymbol[];
  keyRoot: number;
  mode: ChordMode;
  selectedPad: ChordSymbol;
  /** Maps each chord-symbol currently used in the active progression to its
   *  first-appearance step (1-based). Pads with an entry here render in a
   *  "lit / in progression" state with the step badge so the user can scan
   *  the strip top-to-bottom and audition the song's chord set in order. */
  progressionStep: ReadonlyMap<ChordSymbol, number>;
  /** Count of how many bars each chord occupies — surfaced as a small
   *  multiplier label ("×3") when a chord repeats. */
  progressionCount: ReadonlyMap<ChordSymbol, number>;
  onPadClick: (symbol: ChordSymbol) => void;
  onPadDoubleClick: (symbol: ChordSymbol) => void;
}) {
  const progressionTotal = progressionStep.size;
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '5px 12px',
        borderBottom: '1px solid rgba(124, 244, 198, 0.10)',
        background: 'rgba(8, 8, 12, 0.85)',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          color: '#8a8a98',
          letterSpacing: 1.5,
          marginBottom: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        CHORD SCALE
        <span style={{ fontSize: 8, fontWeight: 600, color: '#54545e', letterSpacing: 0.4 }}>
          click to audition · double-click to add · drag to a piano-roll bar
        </span>
        {progressionTotal > 0 ? (
          <span
            style={{
              fontSize: 8,
              fontWeight: 800,
              color: MINT,
              letterSpacing: 0.5,
              marginLeft: 'auto',
              padding: '2px 6px',
              borderRadius: 3,
              border: `1px solid ${MINT_DIM}`,
              background: MINT_BG,
            }}
            title="Pads with a numbered badge are part of the current progression — click them in numeric order to audition the song's chord set."
          >
            {progressionTotal === 1
              ? '1 CHORD IN PROGRESSION · TAP THE LIT PAD TO HEAR IT'
              : `${progressionTotal} CHORDS IN PROGRESSION · TAP LIT PADS 1→${progressionTotal} TO HEAR THE SET`}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {pads.map((sym) => {
          const isSel = sym === selectedPad;
          const step = progressionStep.get(sym);
          const count = progressionCount.get(sym) ?? 0;
          const inProg = step !== undefined;
          const name = chordSymbolToName(sym, keyRoot, mode);
          // Three visual tiers:
          //   1. selected         — brightest mint (current audition target)
          //   2. in-progression   — softer mint glow + step badge (lit but not focused)
          //   3. neutral          — grey, unused
          const border = isSel
            ? MINT_DIM
            : inProg
              ? 'rgba(124, 244, 198, 0.55)'
              : 'rgba(255,255,255,0.10)';
          const bg = isSel
            ? MINT_BG_STRONG
            : inProg
              ? MINT_BG
              : 'rgba(255,255,255,0.03)';
          const fg = isSel ? MINT : inProg ? '#d5fbe8' : '#cfd0d8';
          const shadow = isSel
            ? `0 0 0 1px ${MINT_DIM}, 0 0 12px rgba(124, 244, 198, 0.15)`
            : inProg
              ? `0 0 8px rgba(124, 244, 198, 0.18)`
              : 'inset 0 -1px 0 rgba(0,0,0,0.3)';
          const tooltip = inProg
            ? `${name} (${sym}) — step ${step} of progression${count > 1 ? ` · plays ${count}× across the timeline` : ''} · click: audition · double-click: append`
            : `${name} (${sym}) — click: audition · double-click: add · drag: drop on any bar`;
          return (
            <div
              key={sym}
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_CHORD_MIME, sym);
                e.dataTransfer.setData('text/plain', sym);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onPadClick(sym)}
              onDoubleClick={() => onPadDoubleClick(sym)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPadClick(sym);
                }
              }}
              title={tooltip}
              style={{
                position: 'relative',
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                minWidth: 64,
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${border}`,
                background: bg,
                color: fg,
                cursor: 'grab',
                flexShrink: 0,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                boxShadow: shadow,
                transition:
                  'background 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
              }}
            >
              {/* Step badge — pinned INSIDE the pad's top-left corner so
                  the scroll-strip's `overflow-x: auto` (which implicitly
                  clips overflow-y) can't cut the number off behind the
                  gray header. Auto-sized with min-width + horizontal
                  padding so two-digit steps ("10"…"16") fit cleanly. */}
              {inProg ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: 3,
                    minWidth: 16,
                    height: 14,
                    padding: '0 4px',
                    boxSizing: 'border-box',
                    borderRadius: 7,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSel ? MINT : MINT_BG_STRONG,
                    color: isSel ? '#0a0a0e' : MINT,
                    border: `1px solid ${MINT}`,
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    pointerEvents: 'none',
                    boxShadow: '0 0 4px rgba(124,244,198,0.55)',
                  }}
                >
                  {step}
                </span>
              ) : null}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  letterSpacing: 0.4,
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}
              >
                {name}
              </span>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  opacity: 0.6,
                  fontFamily: 'monospace',
                  lineHeight: 1.1,
                  pointerEvents: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {sym}
                {/* When this chord repeats in the progression we show a tiny
                    "×N" multiplier next to the symbol so the user knows the
                    chord carries weight in the song. */}
                {inProg && count > 1 ? (
                  <span
                    style={{
                      fontWeight: 900,
                      color: MINT,
                      letterSpacing: 0,
                    }}
                  >
                    ×{count}
                  </span>
                ) : null}
                <Volume2 size={8} aria-hidden style={{ opacity: 0.55 }} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PianoRoll({
  timeline,
  previewEvents,
  totalBars,
  colsPerBar,
  keyRoot,
  mode,
  playheadCol,
  dragTargetBar,
  playingMidis,
  manualAdded,
  manualRemoved,
  noteLengths,
  onPlayPitch,
  onPlayheadChange,
  onToggleNote,
  onMoveNote,
  onResizeNote,
  onBarLabelClick,
  onBarDrop,
  onBarDragOver,
  onBarDragLeave,
  onClearEdits,
  hasEdits,
  sizeMode,
  onSizeModeChange,
  isPlaying,
  playheadElRef,
}: {
  timeline: TimelineSlot[];
  previewEvents: ChordEventOut[];
  totalBars: number;
  colsPerBar: number;
  keyRoot: number;
  mode: ChordMode;
  /** Column position of the playhead (0..totalCols-1). Finer than per-bar so
   *  the user can drop it inside a bar at any subdivision. */
  playheadCol: number;
  /** True while the parent's rAF loop owns the playhead `transform`. We
   *  omit the inline `transform` in that case so React doesn't keep
   *  overwriting the rAF-written position on every unrelated re-render. */
  isPlaying: boolean;
  /** Parent-owned ref pointing at the playhead `<div>`. The parent rAF
   *  loop writes `style.transform` directly to it during playback so
   *  the line glides without React re-renders per frame. */
  playheadElRef?: React.MutableRefObject<HTMLDivElement | null>;
  dragTargetBar: number | null;
  playingMidis: ReadonlySet<number>;
  /** Cell keys ("row,col") that the user has manually added on top of the
   *  chord-derived auto notes. */
  manualAdded: ReadonlySet<string>;
  /** Cell keys ("row,col") that the user has manually removed from what the
   *  chord would otherwise generate. */
  manualRemoved: ReadonlySet<string>;
  /** Per-note length overrides keyed by cell head ("row,col") → length in
   *  columns (≥ 1). Notes without an entry are length 1 (single-cell). */
  noteLengths: ReadonlyMap<string, number>;
  onPlayPitch: (midi: number) => void;
  /** Position the playhead at column `col`. Triggered by click / drag on
   *  the ruler. */
  onPlayheadChange: (col: number) => void;
  onToggleNote: (row: number, col: number, isAutoNote: boolean) => void;
  onMoveNote: (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    wasAuto: boolean,
  ) => void;
  /** Stretch the note whose head sits at (row, col) to span `len` columns
   *  (clamped to ≥ 1 and to the bar's remaining columns by the parent). */
  onResizeNote: (row: number, col: number, len: number) => void;
  onBarLabelClick: (barIdx: number) => void;
  onBarDrop: (barIdx: number, symbol: ChordSymbol) => void;
  onBarDragOver: (barIdx: number | null) => void;
  onBarDragLeave: () => void;
  onClearEdits: () => void;
  hasEdits: boolean;
  /** Current size mode. `'compact'` keeps the piano roll tucked away
   *  (~140 px). `'normal'` is the default flex:1 fill. `'expanded'` floats
   *  the piano roll as an overlay covering ~80 % of the viewport for
   *  focused note editing — visually covers the strips above but doesn't
   *  unmount them so any state in those strips is preserved. */
  sizeMode: 'compact' | 'normal' | 'expanded';
  onSizeModeChange: (mode: 'compact' | 'normal' | 'expanded') => void;
}) {
  const totalCols = totalBars * colsPerBar;
  /** Cells produced by the chord progression itself, before user overrides. */
  const autoNoteSet = useMemo(() => {
    const set = new Set<string>();
    for (const { midi, col } of previewEvents) {
      const noteName = midiToNoteName(midi);
      const row = PIANO_ROWS.indexOf(noteName);
      if (row >= 0 && col >= 0 && col < totalCols) {
        set.add(`${row},${col}`);
      }
    }
    return set;
  }, [previewEvents, totalCols]);

  const cellW = Math.max(20, Math.floor(PIANO_BAR_MIN_W / colsPerBar));
  const barW = cellW * colsPerBar;

  // Center the scroll view on the C4..C5 chord-voicing zone the first time the
  // panel renders so users don't have to scroll down past empty high octaves
  // to find where the chord notes actually appear.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const c5Idx = PIANO_ROWS.indexOf('C5');
    if (c5Idx < 0) return;
    const target = Math.max(0, c5Idx * PIANO_ROW_H - 24);
    el.scrollTop = target;
    didInitialScroll.current = true;
  }, []);

  /** Hit-test a viewport-space (clientX, clientY) coordinate against the
   *  piano-roll grid and return the (row, col) of the cell underneath. Used
   *  by the drag-to-move handler to translate pointer position into a target
   *  cell while the mouse is moving. Accounts for sticky key column + sticky
   *  bar header offsets and current scroll position. */
  const cellAt = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } | null => {
      const el = scrollRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left + el.scrollLeft - PIANO_LABEL_W;
      const localY = clientY - rect.top + el.scrollTop - (RULER_H + BAR_LABEL_H);
      if (localX < 0 || localY < 0) return null;
      const col = Math.floor(localX / cellW);
      const row = Math.floor(localY / PIANO_ROW_H);
      if (col < 0 || col >= totalCols) return null;
      if (row < 0 || row >= PIANO_ROWS.length) return null;
      return { row, col };
    },
    [cellW, totalCols],
  );

  /** Per-mousedown drag context. Populated on mousedown over a lit cell and
   *  cleared on mouseup. `moved` flips to true once the pointer has traveled
   *  past the 3-px threshold so the subsequent click event knows to skip its
   *  toggle (the click is the drag's mouseup-completion, not an intent-to-toggle). */
  const dragRef = useRef<{
    fromRow: number;
    fromCol: number;
    wasAuto: boolean;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  /** Set by the drag-end mouseup so the immediately-following click handler
   *  on the lifted-over cell skips its toggle action. Cleared on next click. */
  const justDraggedRef = useRef(false);
  /** Live drag-target cell for the hover outline while dragging. */
  const [dragTargetCell, setDragTargetCell] = useState<{ row: number; col: number } | null>(null);

  /** Active resize-handle context. Populated on mousedown over a note's
   *  right-edge grabber and cleared on mouseup. Drives mousemove → length
   *  updates so the note grows / shrinks in real time as the pointer moves. */
  const resizeRef = useRef<{
    row: number;
    headCol: number;
    startX: number;
    startLen: number;
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = resizeRef.current;
      if (!r) return;
      const deltaX = e.clientX - r.startX;
      const deltaCols = Math.round(deltaX / cellW);
      const nextLen = Math.max(1, r.startLen + deltaCols);
      onResizeNote(r.row, r.headCol, nextLen);
    }
    function onUp() {
      if (resizeRef.current) justDraggedRef.current = true;
      resizeRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cellW, onResizeNote]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      drag.moved = true;
      const cell = cellAt(e.clientX, e.clientY);
      setDragTargetCell(cell);
    }
    function onUp(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.moved) {
        const cell = cellAt(e.clientX, e.clientY);
        if (cell && (cell.row !== drag.fromRow || cell.col !== drag.fromCol)) {
          onMoveNote(drag.fromRow, drag.fromCol, cell.row, cell.col, drag.wasAuto);
        }
        justDraggedRef.current = true;
      }
      dragRef.current = null;
      setDragTargetCell(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cellAt, onMoveNote]);

  // Piano roll outer container style is driven by the current size mode.
  // Compact + Normal stay in the natural flex flow so other strips slot
  // above them as usual. Expanded mode lifts the panel out of flow as an
  // overlay (position: absolute, inset:0 within Chord Builder) so it can
  // cover the strips without forcing them to shrink or unmount.
  const containerStyle: React.CSSProperties =
    sizeMode === 'expanded'
      ? {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 92,  // leaves the Chord Builder header + top toolbar visible
          bottom: 0,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          background: '#06060a',
          borderTop: '1px solid rgba(124, 244, 198, 0.35)',
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.55)',
        }
      : sizeMode === 'compact'
        ? {
            flex: '0 0 140px',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#06060a',
          }
        : {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#06060a',
          };

  /** Tiny size-toggle button used three times in the header. Style stays
   *  inline so this file doesn't need a stylesheet for a feature the user
   *  only touches occasionally. */
  function SizeButton({
    mode: m,
    label,
    glyph,
    title,
  }: {
    mode: 'compact' | 'normal' | 'expanded';
    label: string;
    glyph: string;
    title: string;
  }) {
    const isActive = sizeMode === m;
    return (
      <button
        type="button"
        onClick={() => onSizeModeChange(m)}
        title={title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9,
          fontWeight: 800,
          color: isActive ? '#7cf4c6' : '#8a8a98',
          background: isActive
            ? 'rgba(124, 244, 198, 0.14)'
            : 'rgba(255, 255, 255, 0.04)',
          border: `1px solid ${isActive ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 4,
          padding: '3px 7px',
          cursor: 'pointer',
          letterSpacing: 0.4,
        }}
      >
        <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>{glyph}</span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          flexShrink: 0,
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.30)',
          fontSize: 9,
          fontWeight: 800,
          color: '#8a8a98',
          letterSpacing: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>PIANO ROLL</span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 600,
            color: '#54545e',
            letterSpacing: 0.4,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          click / drag ruler = playhead  ·  click bar header = place chord  ·  click cell = add / remove  ·  drag note = move  ·  drag right edge = resize
        </span>
        {/* Size-mode toggles. Three explicit buttons rather than a
            single cycle button so the active mode is always visible and
            users can jump directly to any size without cycling through
            the others. */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <SizeButton
            mode="compact"
            label="MIN"
            glyph="▁"
            title="Minimize the piano roll — tuck it out of the way while arranging chords above"
          />
          <SizeButton
            mode="normal"
            label="FIT"
            glyph="▣"
            title="Fit the piano roll to the remaining viewport space (default)"
          />
          <SizeButton
            mode="expanded"
            label="MAX"
            glyph="▔"
            title="Expand the piano roll as an overlay — covers the strips above for focused note editing"
          />
        </div>
        {hasEdits && (
          <button
            type="button"
            onClick={onClearEdits}
            title="Revert all per-note edits on the active progression and restore the chord-derived notes"
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: '#7cf4c6',
              background: 'rgba(124, 244, 198, 0.10)',
              border: '1px solid rgba(124, 244, 198, 0.30)',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
              letterSpacing: 0.4,
              flexShrink: 0,
            }}
          >
            ↺ RESET NOTE EDITS
          </button>
        )}
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 'fit-content',
            position: 'relative',
          }}
        >
          {/* Single playhead line — a 2-px vertical mint stripe that spans
              the entire scrollable content (ruler, chord-name header, and
              every pitch row). Positioned absolutely so it sits *between*
              cells at column-precise X with no per-bar background glow.
              `pointer-events: none` keeps clicks falling through to the
              cells below, and a high z-index ensures it draws above the
              sticky ruler + bar header so the line stays visually continuous. */}
          <div
            ref={playheadElRef}
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              // Base offset stays on `left` (sticky-friendly). Beat
              // position is driven via `transform: translateX(...)`:
              // translateX is GPU-composited and the parent's rAF loop
              // writes directly to it without paint or layout reflow.
              // While playing we omit `transform` from the React-managed
              // style so React doesn't reset the rAF-written value on
              // unrelated re-renders.
              left: PIANO_LABEL_W,
              ...(isPlaying
                ? null
                : { transform: `translateX(${playheadCol * cellW}px)` }),
              willChange: 'transform',
              width: 2,
              background: 'rgba(124, 244, 198, 0.88)',
              boxShadow: '0 0 5px rgba(124, 244, 198, 0.50)',
              zIndex: 5,
              pointerEvents: 'none',
            }}
          />
          {/* Transport ruler — click or drag anywhere inside a bar to drop
              the playhead at that exact column (1/N-note resolution). Sticks
              to the top of the scroller so it's always reachable. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: RULER_H,
              position: 'sticky',
              top: 0,
              zIndex: 4,
              background: 'rgba(8, 8, 12, 0.98)',
              borderBottom: '1px solid rgba(124, 244, 198, 0.10)',
              userSelect: 'none',
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              const el = scrollRef.current;
              if (!el) return;
              function applyAt(clientX: number) {
                const node = scrollRef.current;
                if (!node) return;
                const rect = node.getBoundingClientRect();
                const localX = clientX - rect.left + node.scrollLeft - PIANO_LABEL_W;
                // localX < 0 means the click landed on the sticky "BAR" label
                // column on the left — ignore so the playhead doesn't snap to
                // col 0 every time the user grazes the label.
                if (localX < 0) return;
                const col = Math.floor(localX / cellW);
                onPlayheadChange(col);
              }
              applyAt(e.clientX);
              function onMove(ev: MouseEvent) {
                applyAt(ev.clientX);
              }
              function onUp() {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              }
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            title="Click or drag anywhere to position the playhead"
          >
            <div
              style={{
                boxSizing: 'border-box',
                width: PIANO_LABEL_W,
                flexShrink: 0,
                background: '#08080c',
                borderRight: '1px solid rgba(124,244,198,0.18)',
                position: 'sticky',
                left: 0,
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.30)',
                letterSpacing: 0.6,
                fontFamily: 'monospace',
              }}
            >
              BAR
            </div>
            {Array.from({ length: totalBars }).map((_, i) => (
              <div
                key={i}
                style={{
                  boxSizing: 'border-box',
                  width: barW,
                  flexShrink: 0,
                  position: 'relative',
                  borderRight: '1px solid rgba(124, 244, 198, 0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingLeft: 4,
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.30)',
                  fontFamily: 'monospace',
                  letterSpacing: 0.3,
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
          {/* Bar label header (drop zone + chord names) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: BAR_LABEL_H,
              position: 'sticky',
              top: RULER_H,
              zIndex: 3,
              background: 'rgba(10, 10, 14, 0.95)',
              borderBottom: '1px solid rgba(124, 244, 198, 0.16)',
            }}
          >
            <div
              style={{
                boxSizing: 'border-box',
                width: PIANO_LABEL_W,
                flexShrink: 0,
                background: '#0a0a10',
                borderRight: '1px solid rgba(124,244,198,0.18)',
                position: 'sticky',
                left: 0,
                zIndex: 4,
              }}
            />
            {Array.from({ length: totalBars }).map((_, i) => {
              const slot = timeline[i] ?? { chord: null };
              const isDragTarget = i === dragTargetBar;
              const filled = slot.chord != null;
              const chordName = filled ? chordSymbolToName(slot.chord!, keyRoot, mode) : '';
              return (
                <div
                  key={i}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    onBarDragOver(i);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                    if (dragTargetBar !== i) onBarDragOver(i);
                  }}
                  onDragLeave={(e) => {
                    const rt = e.relatedTarget as Node | null;
                    if (!rt || !(e.currentTarget as Node).contains(rt)) onBarDragLeave();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sym = e.dataTransfer.getData(DND_CHORD_MIME) || e.dataTransfer.getData('text/plain');
                    onBarDragLeave();
                    if (sym) onBarDrop(i, sym as ChordSymbol);
                  }}
                  onClick={() => onBarLabelClick(i)}
                  style={{
                    boxSizing: 'border-box',
                    width: barW,
                    flexShrink: 0,
                    borderRight: '1px solid rgba(124, 244, 198, 0.10)',
                    background: isDragTarget
                      ? 'rgba(124, 244, 198, 0.22)'
                      : filled
                        ? 'rgba(124, 244, 198, 0.08)'
                        : 'rgba(255,255,255,0.02)',
                    color: filled ? MINT : '#54545e',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    position: 'relative',
                    transition: 'background 80ms ease-out, color 80ms ease-out',
                  }}
                  title={filled ? `Bar ${i + 1}: ${chordName} (${slot.chord}) — click to clear` : `Bar ${i + 1} — drop a chord here`}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: 4,
                      fontSize: 8,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.35)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {i + 1}
                  </span>
                  {filled ? (
                    <>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          lineHeight: 1,
                        }}
                      >
                        {chordName}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          opacity: 0.6,
                          fontFamily: 'monospace',
                          lineHeight: 1,
                        }}
                      >
                        {slot.chord}
                      </span>
                    </>
                  ) : (
                    '·'
                  )}
                </div>
              );
            })}
          </div>

          {/* Pitch rows */}
          {PIANO_ROWS.map((noteName, ri) => {
            const isBlack = PIANO_BLACK_ROWS.has(noteName);
            const isC = noteName.startsWith('C') && !noteName.startsWith('C#');
            const rowMidi = noteNameToMidi(noteName);
            const isActiveKey = playingMidis.has(rowMidi);
            // Build the row's "note layout": for each lit cell, look up its
            // stretched length and mark the trailing columns as `skipCols`
            // so they won't render their own cell (the head cell expands to
            // visually cover them). `headLens` carries the final clamped
            // length per head column. Lengths never cross a bar boundary —
            // the parent already enforces this on writes, but we re-clamp
            // here as a defensive net.
            const rowSkipCols = new Set<number>();
            const rowHeadLens = new Map<number, number>();
            for (let col = 0; col < totalCols; col++) {
              if (rowSkipCols.has(col)) continue;
              const k = `${ri},${col}`;
              const isAuto = autoNoteSet.has(k);
              const isAdded = manualAdded.has(k);
              const isRemoved = manualRemoved.has(k);
              const isLit = (isAuto && !isRemoved) || isAdded;
              if (!isLit) continue;
              const rawLen = noteLengths.get(k) ?? 1;
              const barIdxForCol = Math.floor(col / colsPerBar);
              const maxLen = (barIdxForCol + 1) * colsPerBar - col;
              const len = Math.max(1, Math.min(rawLen, maxLen));
              if (len > 1) {
                rowHeadLens.set(col, len);
                for (let c = col + 1; c < col + len; c++) rowSkipCols.add(c);
              }
            }
            // Pitch letter shown on the key. Naturals get full name on the C
            // octave anchor (e.g. "C4") and a single letter on the rest.
            // Black keys carry the sharp letter (e.g. "C#") without the octave
            // digit so the narrow ~35px key surface stays readable.
            const keyLabel = isC
              ? noteName
              : isBlack
                ? noteName.slice(0, 2)
                : noteName.charAt(0);
            return (
              <div
                key={noteName}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  height: PIANO_ROW_H,
                  background: isBlack ? '#08080c' : '#0c0c10',
                  borderBottom: isC
                    ? '1px solid rgba(124,244,198,0.10)'
                    : '1px solid rgba(255,255,255,0.02)',
                }}
              >
                {/* Piano key — vertical real-piano keyboard on the left side.
                 *   White keys: full-width, ivory gradient.
                 *   Black keys: ~62% width, dark gradient — leaves the white-key
                 *   surface visible to the right, mirroring a real keyboard.
                 *   `position: sticky` keeps the keyboard pinned to the viewport
                 *   left edge while the bars scroll horizontally. */}
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (rowMidi > 0) onPlayPitch(rowMidi);
                  }}
                  title={`${noteName} · click to audition`}
                  style={{
                    boxSizing: 'border-box',
                    width: PIANO_LABEL_W,
                    flexShrink: 0,
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: '#050507',
                    borderRight: '1px solid rgba(124,244,198,0.18)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: isBlack ? PIANO_BLACK_KEY_W : PIANO_WHITE_KEY_W,
                      background: isActiveKey
                        ? `linear-gradient(180deg, ${MINT} 0%, rgba(124,244,198,0.70) 100%)`
                        : isBlack
                          ? 'linear-gradient(180deg, #25252e 0%, #0e0e14 100%)'
                          : 'linear-gradient(180deg, #e5e5ec 0%, #b6b6c0 100%)',
                      boxShadow: isActiveKey
                        ? `0 0 6px ${MINT}, inset 0 0 0 1px rgba(255,255,255,0.4)`
                        : isBlack
                          ? 'inset 0 -1px 1px rgba(0,0,0,0.6), inset -1px 0 1px rgba(0,0,0,0.4)'
                          : 'inset 0 -1px 1px rgba(0,0,0,0.18), inset -1px 0 1px rgba(0,0,0,0.10)',
                      borderRadius: '0 3px 3px 0',
                      borderTop: isBlack ? 'none' : '1px solid rgba(255,255,255,0.45)',
                      borderBottom: isBlack
                        ? '1px solid #000'
                        : isC
                          ? '1px solid #4a4a54'
                          : '1px solid rgba(0,0,0,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 5,
                      fontSize: isC ? 9 : 8,
                      fontWeight: isC ? 800 : 700,
                      color: isActiveKey
                        ? '#0a0a0e'
                        : isBlack
                          ? '#9a9aa6'
                          : '#1a1a22',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      letterSpacing: 0.2,
                      transition: 'background 80ms linear, box-shadow 80ms linear',
                    }}
                  >
                    {keyLabel}
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex' }}>
                  {Array.from({ length: totalBars }).map((_, bi) => {
                    const isDragTarget = bi === dragTargetBar;
                    return (
                      <div
                        key={bi}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          onBarDragOver(bi);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'copy';
                          if (dragTargetBar !== bi) onBarDragOver(bi);
                        }}
                        onDragLeave={(e) => {
                          const rt = e.relatedTarget as Node | null;
                          if (!rt || !(e.currentTarget as Node).contains(rt)) onBarDragLeave();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sym =
                            e.dataTransfer.getData(DND_CHORD_MIME) || e.dataTransfer.getData('text/plain');
                          onBarDragLeave();
                          if (sym) onBarDrop(bi, sym as ChordSymbol);
                        }}
                        style={{
                          boxSizing: 'border-box',
                          width: barW,
                          flexShrink: 0,
                          display: 'flex',
                          background: isDragTarget
                            ? 'rgba(124, 244, 198, 0.08)'
                            : 'transparent',
                          borderRight: '1px solid rgba(124, 244, 198, 0.08)',
                          cursor: 'cell',
                        }}
                      >
                        {Array.from({ length: colsPerBar }).map((_, ci) => {
                          const colIdx = bi * colsPerBar + ci;
                          // Cells that fall inside another note's stretched
                          // span are owned by that note's head — skip them so
                          // the head's wider div absorbs their flex slot.
                          if (rowSkipCols.has(colIdx)) return null;
                          const cellKey = `${ri},${colIdx}`;
                          const isAuto = autoNoteSet.has(cellKey);
                          const isAdded = manualAdded.has(cellKey);
                          const isRemoved = manualRemoved.has(cellKey);
                          // Final visibility: auto note unless removed, OR manually added.
                          const isLit = (isAuto && !isRemoved) || isAdded;
                          // Stretched-note head: width covers this column +
                          // its trailing siblings. Single-cell notes (and
                          // empty cells) keep the normal cell width.
                          const headLen = rowHeadLens.get(colIdx) ?? 1;
                          const cellRenderW = cellW * headLen;
                          // Color hint: manually-added cells render a brighter
                          // mint with a contrasting halo so the user can tell
                          // their tweaks apart from the chord-generated notes.
                          const bg = !isLit
                            ? 'transparent'
                            : isAdded
                              ? 'linear-gradient(180deg, #a8ffd9 0%, #5feab1 100%)'
                              : MINT;
                          const glow = !isLit
                            ? 'none'
                            : isAdded
                              ? '0 0 7px rgba(168, 255, 217, 0.85)'
                              : '0 0 6px rgba(124, 244, 198, 0.55)';
                          // Ghost outline on auto notes the user removed, so
                          // it's visible they were silenced and can be restored.
                          const ghost = isAuto && isRemoved;
                          const isDragTarget =
                            dragTargetCell !== null &&
                            dragTargetCell.row === ri &&
                            dragTargetCell.col === colIdx;
                          const isDragOrigin =
                            dragRef.current !== null &&
                            dragRef.current.fromRow === ri &&
                            dragRef.current.fromCol === colIdx &&
                            dragRef.current.moved;
                          // borderRight = 'none' on the visual last column of
                          // the bar (the head's rightmost column may sit past
                          // ci if the note is stretched).
                          const visualLastCi = ci + headLen - 1;
                          const isLastColOfBar = visualLastCi === colsPerBar - 1;
                          return (
                            <div
                              key={ci}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                if (!isLit) return;
                                e.preventDefault();
                                e.stopPropagation();
                                dragRef.current = {
                                  fromRow: ri,
                                  fromCol: colIdx,
                                  wasAuto: isAuto && !isRemoved,
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  moved: false,
                                };
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Suppress the click that fires at the end of
                                // a drag (move) or a resize — those gestures
                                // already updated the model.
                                if (justDraggedRef.current) {
                                  justDraggedRef.current = false;
                                  return;
                                }
                                onToggleNote(ri, colIdx, isAuto);
                              }}
                              onDoubleClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'relative',
                                width: cellRenderW,
                                flexShrink: 0,
                                borderRight: isLastColOfBar
                                  ? 'none'
                                  : '1px solid rgba(255,255,255,0.02)',
                                background: isDragTarget && !isLit
                                  ? 'rgba(124, 244, 198, 0.18)'
                                  : bg,
                                boxShadow: isDragTarget
                                  ? '0 0 0 1px rgba(168, 255, 217, 0.95) inset, 0 0 8px rgba(168,255,217,0.55)'
                                  : glow,
                                opacity: isDragOrigin ? 0.35 : isLit ? 0.95 : 1,
                                cursor: isLit ? 'grab' : 'pointer',
                                outline: ghost ? '1px dashed rgba(124,244,198,0.30)' : 'none',
                                outlineOffset: ghost ? -2 : 0,
                                transition: 'background 60ms linear, box-shadow 60ms linear',
                              }}
                              title={
                                isLit
                                  ? isAdded
                                    ? `${noteName} · bar ${bi + 1} · drag = move · right edge = resize · click = remove (added)`
                                    : `${noteName} · bar ${bi + 1} · drag = move · right edge = resize · click = mute (chord note)`
                                  : ghost
                                    ? `${noteName} · bar ${bi + 1} · click to restore (was muted)`
                                    : `${noteName} · bar ${bi + 1} · click to add note`
                              }
                            >
                              {isLit ? (
                                <div
                                  onMouseDown={(e) => {
                                    if (e.button !== 0) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    resizeRef.current = {
                                      row: ri,
                                      headCol: colIdx,
                                      startX: e.clientX,
                                      startLen: headLen,
                                    };
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  title={`drag to resize · current ${headLen} step${headLen === 1 ? '' : 's'}`}
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    width: 6,
                                    cursor: 'ew-resize',
                                    // Subtle highlight strip so the handle is
                                    // discoverable without being noisy.
                                    background:
                                      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 100%)',
                                    zIndex: 2,
                                  }}
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ToolbarSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  // Custom popup-based dropdown — replaces the native <select> which
  // was inconsistent in the embedded Cursor preview browser (often took
  // 2-3 clicks before the option list opened). This implementation is
  // a plain <button> that toggles a fixed-position popup so the option
  // list is part of our React tree and opens on the first click 100% of
  // the time. We still accept <option> / <optgroup> children so existing
  // call sites don't need to be rewritten — we walk the children at
  // render time and flatten them into menu items grouped by <optgroup>.
  const options = useMemo(() => parseSelectOptions(children), [children]);
  const flat = useMemo(() => options.flatMap((g) => g.items), [options]);
  const current = flat.find((o) => o.value === value);
  const currentLabel = current?.label ?? value;
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Reposition the popup relative to the button on every open. Using
  // position: fixed avoids overflow:hidden clipping from any ancestor
  // panel (e.g. the slimmed-down TopToolbar that wraps).
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    function onScroll() {
      const r2 = el?.getBoundingClientRect();
      if (r2) setRect({ top: r2.bottom + 4, left: r2.left, width: r2.width });
    }
    function onResize() {
      const r2 = el?.getBoundingClientRect();
      if (r2) setRect({ top: r2.bottom + 4, left: r2.left, width: r2.width });
    }
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      // Popup contents tag themselves with `data-cb-select-popup` so we
      // can identify clicks inside the popup without holding a second ref.
      const inPopup = (target as Element).closest?.('[data-cb-select-popup="true"]');
      if (inPopup) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#8a8a98',
          letterSpacing: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={current?.title ?? currentLabel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          minHeight: 24,
          borderRadius: 4,
          border: `1px solid ${open ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255,255,255,0.14)'}`,
          background: open ? 'rgba(124, 244, 198, 0.08)' : 'rgba(255,255,255,0.04)',
          color: '#dcdce4',
          fontSize: 10,
          fontWeight: 600,
          outline: 'none',
          cursor: 'pointer',
          letterSpacing: 0.3,
        }}
      >
        <span
          style={{
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentLabel}
        </span>
        <span aria-hidden style={{ fontSize: 9, color: '#8a8a98', lineHeight: 1 }}>
          ▾
        </span>
      </button>
      {open && rect && (
        <div
          data-cb-select-popup="true"
          role="listbox"
          aria-label={label}
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            minWidth: Math.max(rect.width, 160),
            maxHeight: '60vh',
            overflowY: 'auto',
            zIndex: 9999,
            padding: 4,
            background: '#0a0a0e',
            border: '1px solid rgba(124, 244, 198, 0.30)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
          }}
        >
          {options.map((group, gi) => (
            <div key={group.label ?? `g-${gi}`}>
              {group.label && (
                <div
                  style={{
                    padding: '4px 8px 2px 8px',
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: 1.2,
                    color: '#7cf4c6',
                    textTransform: 'uppercase',
                  }}
                >
                  {group.label}
                </div>
              )}
              {group.items.map((opt) => {
                const isActive = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    title={opt.title}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 8px',
                      border: 'none',
                      borderRadius: 4,
                      background: isActive ? 'rgba(124, 244, 198, 0.16)' : 'transparent',
                      color: isActive ? '#7cf4c6' : '#dcdce4',
                      fontSize: 10,
                      fontWeight: isActive ? 800 : 600,
                      letterSpacing: 0.3,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </span>
                    {isActive && (
                      <span aria-hidden style={{ fontSize: 9, lineHeight: 1 }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Walk the React children passed to a ToolbarSelect and flatten them
 *  into a structure usable by the custom popup. Accepts plain <option>
 *  and <optgroup><option/></optgroup> nodes so existing call sites that
 *  were written for a native <select> keep working unchanged. */
type ToolbarSelectGroup = {
  label: string | null;
  items: { value: string; label: string; title?: string }[];
};
function parseSelectOptions(children: ReactNode): ToolbarSelectGroup[] {
  const groups: ToolbarSelectGroup[] = [];
  let ungrouped: ToolbarSelectGroup | null = null;
  function pushOption(group: ToolbarSelectGroup, node: ReactElement) {
    const props = node.props as {
      value?: string | number;
      children?: ReactNode;
      title?: string;
    };
    const value = String(props.value ?? '');
    const label = reactChildrenToText(props.children) || value;
    group.items.push({ value, label, title: props.title });
  }
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'option') {
      if (!ungrouped) {
        ungrouped = { label: null, items: [] };
        groups.push(ungrouped);
      }
      pushOption(ungrouped, child);
    } else if (child.type === 'optgroup') {
      const groupProps = child.props as { label?: string; children?: ReactNode };
      const group: ToolbarSelectGroup = { label: groupProps.label ?? null, items: [] };
      groups.push(group);
      ungrouped = null;
      Children.forEach(groupProps.children, (inner) => {
        if (isValidElement(inner) && inner.type === 'option') {
          pushOption(group, inner);
        }
      });
    }
  });
  return groups;
}

function reactChildrenToText(children: ReactNode): string {
  if (children == null || children === false) return '';
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(reactChildrenToText).join('');
  }
  if (isValidElement(children)) {
    return reactChildrenToText((children.props as { children?: ReactNode }).children);
  }
  return '';
}

function ToolbarButton({
  onClick,
  icon,
  label,
  primary = false,
  subdued = false,
  disabled = false,
  title,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  subdued?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const baseColor = primary ? MINT : subdued ? '#cfd0d8' : MINT;
  const baseBg = primary ? MINT_BG_STRONG : subdued ? 'transparent' : MINT_BG;
  const baseBorder = primary ? MINT_DIM : subdued ? 'rgba(255,255,255,0.10)' : MINT_DIM;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 4,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : baseBorder}`,
        background: disabled ? 'rgba(255,255,255,0.02)' : baseBg,
        color: disabled ? '#3a3a44' : baseColor,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.4,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

ChordBuilderTab.displayName = 'ChordBuilderTab';
