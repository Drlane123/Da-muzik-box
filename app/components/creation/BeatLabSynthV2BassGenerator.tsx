import React, { useCallback, useMemo, useRef, useState } from 'react';

import { chordSymbolToName } from '@/app/lib/creationStation/chordBuilder';

import {
  beatLabStepsPerBar,
  type BeatLabImportedChordRail,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';

import { beatLabNoteMidi } from '@/app/lib/creationStation/beatLabMelodicSynth';

import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';

import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';

import {

  beatLabSynthV2ApplyChordHarmonyMute,

  beatLabSynthV2ChordColumnsOnLane,

  beatLabSynthV2GenerateBassRollNotes,

  beatLabSynthV2HarmonyColumnsOnLane,

  beatLabSynthV2IsChordHarmonyMuted,

  beatLabSynthV2MergeGeneratedBass,

  beatLabSynthV2ResolveRootsPerBar,

} from '@/app/lib/creationStation/beatLabSynthV2BasslineGenerator';

import {

  beatLabSynthV2AddBassHitAt,

  beatLabSynthV2BassEditSpans,

  beatLabSynthV2DeleteBassNote,

  beatLabSynthV2MidiToBassPitchSemi,

  beatLabSynthV2PitchSemiForBarRoot,

  beatLabSynthV2ResizeBassNoteEnd,

  beatLabSynthV2ResizeBassNoteStart,

  beatLabSynthV2SnapBassCol,

  beatLabSynthV2SnapBassColWithBars,

  beatLabSynthV2SplitBassNoteAt,

  beatLabSynthV2UpdateBassNote,

  type BeatLabSynthV2BassEditSpan,

} from '@/app/lib/creationStation/beatLabSynthV2BassNoteEdit';



const W = 920;

const H = 146;

const PAD_L = 36;

const PAD_R = 10;

const PAD_T = 42;

const PAD_B = 14;

const PLOT_W = W - PAD_L - PAD_R;

const PLOT_H = H - PAD_T - PAD_B;

const EDGE_GRAB_PX = 5;
const MIN_BODY_GRAB_PX = 12;



type DragKind = 'move' | 'resize-start' | 'resize-end';



type DragState = {

  kind: DragKind;

  headCol: number;

  grabCol: number;

  grabColRaw: number;

  originalCol: number;

  originalLen: number;

  originalPitchSemi: number;

  grabPitchSemi: number;

};



type Props = {

  /** Mixer lane for generated bass (bass presets). */

  bassLane: number;

  /** Mixer lane for piano-roll chords (harmony / roots source). */

  harmonyLane: number;

  patternCols: number;

  voice: BeatLabBassSynthVoiceParams;

  subdiv: number;

  beatsPerBar: number;

  /** Quarter columns per bar on the SYNTH roll (matches chord snap / transport). */
  colsPerBar?: number;

  chordRail?: BeatLabImportedChordRail | null;

  laneNotes: readonly BeatLabMidiNote[];

  onPatch: (next: Partial<BeatLabBassSynthVoiceParams>) => void;

  /** Merged bass notes on `bassLane` only (harmony lane untouched). */

  onApplyBassLaneNotes: (bassLaneNotes: BeatLabMidiNote[]) => void;

  onApplyHarmonyLaneNotes: (harmonyLaneNotes: BeatLabMidiNote[]) => void;

};



export function BeatLabSynthV2BassGenerator({

  bassLane,

  harmonyLane,

  patternCols,

  voice,

  subdiv,

  beatsPerBar,

  colsPerBar = 4,

  chordRail = null,

  laneNotes,

  onPatch,

  onApplyBassLaneNotes,

  onApplyHarmonyLaneNotes,

}: Props) {

  const layoutBars: 4 | 8 = voice.glideLayoutBars === 4 ? 4 : 8;

  const stepsPerBar = beatLabStepsPerBar(subdiv, beatsPerBar, colsPerBar);

  const windowCols = layoutBars * stepsPerBar;

  const maxCol = Math.max(windowCols, Math.max(1, Math.floor(patternCols)));

  const snapCols = Math.max(1, Math.round(stepsPerBar / 16));
  /** Full step columns when sliding — bar downbeats stay reachable. */
  const moveSnapCols = 1;

  const variationRef = useRef(0);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const laneNotesRef = useRef(laneNotes);
  laneNotesRef.current = laneNotes;

  const [selectedHeadCol, setSelectedHeadCol] = useState<number | null>(null);

  const [hoverHeadCol, setHoverHeadCol] = useState<number | null>(null);

  const [hoverKind, setHoverKind] = useState<DragKind | 'body' | null>(null);

  const [addNoteMode, setAddNoteMode] = useState(false);

  const lastClickRef = useRef<{ t: number; headCol: number } | null>(null);



  const midiAtBass = (n: BeatLabMidiNote) => beatLabNoteMidi(bassLane, n);

  const midiAtHarmony = (n: BeatLabMidiNote) => beatLabNoteMidi(harmonyLane, n);



  const roots = useMemo(

    () =>

      beatLabSynthV2ResolveRootsPerBar({

        chordRail,

        laneNotes,

        lane: harmonyLane,

        layoutBars,

        stepsPerBar,

        midiAtNote: midiAtHarmony,

        includeMutedHarmony: true,

      }),

    [chordRail, laneNotes, harmonyLane, layoutBars, stepsPerBar],

  );



  const chordCols = useMemo(

    () => beatLabSynthV2HarmonyColumnsOnLane(laneNotes, harmonyLane, midiAtHarmony),

    [laneNotes, harmonyLane],

  );

  const stackCols = useMemo(

    () => beatLabSynthV2ChordColumnsOnLane(laneNotes, harmonyLane),

    [laneNotes, harmonyLane],

  );

  const chordsMuted = useMemo(

    () => beatLabSynthV2IsChordHarmonyMuted(laneNotes, harmonyLane, midiAtHarmony),

    [laneNotes, harmonyLane],

  );



  const bassSpans = useMemo(

    () => beatLabSynthV2BassEditSpans(laneNotes, bassLane, midiAtBass, windowCols),

    [laneNotes, bassLane, windowCols],

  );



  const midiLo = useMemo(() => {

    const mids = [...roots, ...bassSpans.map((s) => s.midi)];

    if (mids.length === 0) return 30;

    return Math.min(...mids) - 3;

  }, [roots, bassSpans]);



  const midiHi = useMemo(() => {

    const mids = [...roots, ...bassSpans.map((s) => s.midi)];

    if (mids.length === 0) return 55;

    return Math.max(...mids) + 3;

  }, [roots, bassSpans]);



  const colToX = useCallback(

    (col: number) => PAD_L + (Math.max(0, Math.min(windowCols, col)) / Math.max(1, windowCols)) * PLOT_W,

    [windowCols],

  );



  const midiToY = useCallback(

    (midi: number) => {

      const span = Math.max(1, midiHi - midiLo);

      return PAD_T + (1 - (midi - midiLo) / span) * PLOT_H;

    },

    [midiHi, midiLo],

  );



  const pointerToPlot = useCallback(
    (
      svg: SVGSVGElement,
      clientX: number,
      clientY: number,
      opts?: { allowXOutside?: boolean },
    ): { col: number; pitchSemi: number; colRaw: number } | null => {
      const pt = svg.createSVGPoint?.();
      const ctm = svg.getScreenCTM?.();
      if (!pt || !ctm) return null;
      pt.x = clientX;
      pt.y = clientY;
      const p = pt.matrixTransform(ctm.inverse());
      if (p.y < PAD_T || p.y > PAD_T + PLOT_H) return null;
      const xClamped = opts?.allowXOutside
        ? Math.max(PAD_L, Math.min(W - PAD_R, p.x))
        : p.x;
      if (!opts?.allowXOutside && (p.x < PAD_L || p.x > W - PAD_R)) return null;
      const colRaw = ((xClamped - PAD_L) / Math.max(1, PLOT_W)) * windowCols;
      const col = beatLabSynthV2SnapBassCol(colRaw, snapCols, maxCol);
      const span = Math.max(1, midiHi - midiLo);
      const midi = midiLo + (1 - (p.y - PAD_T) / PLOT_H) * span;
      const pitchSemi = beatLabSynthV2MidiToBassPitchSemi(bassLane, midi);
      return { col, pitchSemi, colRaw };
    },
    [windowCols, snapCols, maxCol, midiLo, midiHi, bassLane],
  );

  const hitTestSpan = useCallback(
    (
      clientX: number,
      clientY: number,
      span: BeatLabSynthV2BassEditSpan,
    ): { kind: DragKind | 'body'; headCol: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint?.();
      const ctm = svg.getScreenCTM?.();
      if (!pt || !ctm) return null;
      pt.x = clientX;
      pt.y = clientY;
      const p = pt.matrixTransform(ctm.inverse());
      const y = midiToY(span.midi);
      if (Math.abs(p.y - y) > 10) return null;
      const x0 = colToX(span.col0);
      const x1 = colToX(span.col1);
      if (p.x < x0 - 2 || p.x > x1 + 2) return null;
      const w = Math.max(3, x1 - x0);
      if (w <= MIN_BODY_GRAB_PX + EDGE_GRAB_PX * 2) {
        return { kind: 'body', headCol: span.headCol };
      }
      if (p.x <= x0 + EDGE_GRAB_PX) return { kind: 'resize-start', headCol: span.headCol };
      if (p.x >= x1 - EDGE_GRAB_PX) return { kind: 'resize-end', headCol: span.headCol };
      return { kind: 'body', headCol: span.headCol };
    },
    [colToX, midiToY],
  );



  const emitBassLaneNotes = useCallback(
    (fullRoll: BeatLabMidiNote[]) => {
      const bassOnly = fullRoll.filter((n) => n.lane === bassLane);
      onApplyBassLaneNotes(bassOnly);
      const kept = laneNotesRef.current.filter((n) => n.lane !== bassLane);
      laneNotesRef.current = [...kept, ...bassOnly];
    },
    [bassLane, onApplyBassLaneNotes],
  );

  const applyMerged = useCallback(
    (next: BeatLabMidiNote[] | null) => {
      if (next) emitBassLaneNotes(next);
    },
    [emitBassLaneNotes],
  );

  const placeBassHit = useCallback(
    (col: number, pitchSemi: number) => {
      applyMerged(
        beatLabSynthV2AddBassHitAt({
          allNotes: laneNotes,
          bassLane,
          layoutBars,
          stepsPerBar,
          col,
          pitchSemi,
          midiAtNote: midiAtBass,
          maxCol,
          snapCols,
          defaultLen: snapCols,
        }),
      );
    },
    [applyMerged, laneNotes, bassLane, layoutBars, stepsPerBar, maxCol, snapCols],
  );



  const runGenerate = () => {

    variationRef.current += 1;

    const colsBound = Math.max(1, Math.floor(patternCols));

    const newBass = beatLabSynthV2GenerateBassRollNotes({

      lane: bassLane,

      harmonyLane,

      layoutBars,

      subdiv,

      beatsPerBar,

      colsPerBar,

      patternCols: colsBound,

      chordRail,

      laneNotes,

      midiAtNote: midiAtHarmony,

      variationSeed: variationRef.current,

    });

    const merged = beatLabSynthV2MergeGeneratedBass(

      laneNotes,

      bassLane,

      layoutBars,

      stepsPerBar,

      newBass,

    );

    emitBassLaneNotes(merged);

    const activeBarsMask =

      layoutBars >= 31 ? 0x7fffffff : Math.max(1, (1 << layoutBars) - 1);

    onPatch({

      glideMode: voice.glideMode === 'off' ? 'mono' : voice.glideMode,

      glideBarMask: activeBarsMask,

      slideBarMask: activeBarsMask,

    });

  };



  const runClearBass = () => {

    const merged = beatLabSynthV2MergeGeneratedBass(

      laneNotes,

      bassLane,

      layoutBars,

      stepsPerBar,

      [],

    );

    emitBassLaneNotes(merged);

    setSelectedHeadCol(null);

  };



  const miniBtn: React.CSSProperties = {

    fontSize: 7,

    fontWeight: 800,

    padding: '2px 6px',

    borderRadius: 3,

    border: '1px solid #324154',

    background: '#12161e',

    color: '#9aa6bc',

    cursor: 'pointer',

    flexShrink: 0,

  };



  const hasChords =

    (chordRail?.timeline.some((s) => s.chord != null) ?? false) ||

    chordCols.size > 0 ||

    laneNotes.some((n) => n.lane === harmonyLane);



  const toggleMuteChords = () => {

    const harmonyOnly = laneNotes.filter((n) => n.lane === harmonyLane);

    const patched = beatLabSynthV2ApplyChordHarmonyMute(

      harmonyOnly,

      harmonyLane,

      !chordsMuted,

      midiAtHarmony,

    );

    onApplyHarmonyLaneNotes(patched);

  };



  const commitDrag = useCallback(
    (drag: DragState, pointerColRaw: number, pointerPitchSemi: number, finalize: boolean) => {
      const roll = laneNotesRef.current;
      const base = {
        allNotes: roll,
        bassLane,
        layoutBars,
        stepsPerBar,
        headCol: drag.headCol,
        midiAtNote: midiAtBass,
        maxCol,
        snapCols: moveSnapCols,
        snapToBarDownbeats: finalize,
      };

      if (drag.kind === 'move') {
        const rawCol = drag.originalCol + (pointerColRaw - drag.grabColRaw);
        const snapCol = finalize
          ? beatLabSynthV2SnapBassColWithBars(rawCol, moveSnapCols, maxCol, stepsPerBar)
          : beatLabSynthV2SnapBassCol(rawCol, moveSnapCols, maxCol);
        const colDelta = pointerColRaw - drag.grabColRaw;
        const pitchDeltaRaw = pointerPitchSemi - drag.grabPitchSemi;
        // Keep pitch locked for sideways drags; change it only when vertical motion is intentional.
        const verticalIntent =
          Math.abs(pitchDeltaRaw) >= 2 && Math.abs(pitchDeltaRaw) > Math.abs(colDelta) * 0.35;
        const newPitchSemi = drag.originalPitchSemi + (verticalIntent ? pitchDeltaRaw : 0);
        const next = beatLabSynthV2UpdateBassNote({
          ...base,
          newCol: rawCol,
          newPitchSemi,
        });
        if (next) {
          emitBassLaneNotes(next);
          const placed = next
            .filter((n) => n.lane === bassLane)
            .find((n) => n.col === snapCol);
          if (placed && dragRef.current) {
            dragRef.current = { ...drag, headCol: placed.col };
          }
        }
        return;
      }

      if (drag.kind === 'resize-end') {
        const endCol = finalize
          ? beatLabSynthV2SnapBassColWithBars(pointerColRaw, moveSnapCols, maxCol, stepsPerBar)
          : beatLabSynthV2SnapBassCol(pointerColRaw, moveSnapCols, maxCol);
        const newLen = Math.max(1, endCol - drag.originalCol + 1);
        applyMerged(beatLabSynthV2ResizeBassNoteEnd({ ...base, newLen }));
        return;
      }

      const headCol = finalize
        ? beatLabSynthV2SnapBassColWithBars(pointerColRaw, moveSnapCols, maxCol, stepsPerBar)
        : beatLabSynthV2SnapBassCol(pointerColRaw, moveSnapCols, maxCol);
      const next = beatLabSynthV2ResizeBassNoteStart({ ...base, newHeadCol: headCol });
      if (next) {
        emitBassLaneNotes(next);
        const moved = next.filter((n) => n.lane === bassLane).find((n) => n.col !== drag.headCol);
        if (moved && dragRef.current) {
          dragRef.current = { ...drag, headCol: moved.col };
        }
      }
    },
    [
      bassLane,
      layoutBars,
      stepsPerBar,
      maxCol,
      moveSnapCols,
      applyMerged,
      emitBassLaneNotes,
    ],
  );

  const activeDrag = dragRef.current;

  const svgCursor =

    activeDrag?.kind === 'resize-start' || activeDrag?.kind === 'resize-end'

      ? 'ew-resize'

      : activeDrag?.kind === 'move'

        ? 'grabbing'

        : hoverKind === 'resize-start' || hoverKind === 'resize-end'

          ? 'ew-resize'

          : hoverKind === 'body'

            ? 'grab'

            : addNoteMode

              ? 'cell'

              : 'crosshair';



  return (

    <div

      style={{

        width: '100%',

        minWidth: 0,

        maxWidth: '100%',

        boxSizing: 'border-box',

        marginBottom: 6,

        borderRadius: 6,

        border: '1px solid rgba(124, 244, 198, 0.28)',

        background: 'linear-gradient(180deg, #0a1018 0%, #05080e 100%)',

        overflow: 'hidden',

      }}

    >

      <div

        style={{

          display: 'flex',

          alignItems: 'center',

          gap: 6,

          flexWrap: 'nowrap',

          padding: '4px 8px 2px',

          minWidth: 0,

        }}

      >

        <span style={{ fontSize: 8, fontWeight: 900, color: '#7cf4c6', letterSpacing: 0.5, flexShrink: 0 }}>

          BASSLINE

        </span>

        <button

          type="button"

          onClick={runGenerate}

          disabled={!hasChords}

          title={

            hasChords

              ? 'New root-locked bass groove (roots + fifths / walks) — click again for another pattern'

              : 'Drop chords into NEW SYNTH piano roll first (Groove Lab or draw)'

          }

          style={{

            ...miniBtn,

            fontSize: 8,

            padding: '3px 10px',

            borderColor: 'rgba(124,244,198,0.55)',

            background: 'rgba(124,244,198,0.2)',

            color: '#d7ffef',

            opacity: hasChords ? 1 : 0.45,

          }}

        >

          GENERATOR

        </button>

        <button type="button" onClick={runClearBass} style={miniBtn} title="Clear monophonic bass on the bass CH (piano-roll chords untouched)">

          Clear bass

        </button>

        <button

          type="button"

          onClick={toggleMuteChords}

          disabled={chordCols.size === 0}

          title={

            stackCols.size === 0

              ? 'Drop chords from Groove Lab (TO NEW SYNTH) or draw harmony on the roll'

              : chordsMuted

                ? 'Unmute chord piano roll — chords play again'

                : 'Mute chord stacks only — bass line still plays; chords stay on roll for GENERATOR'

          }

          style={{

            ...miniBtn,

            borderColor: chordsMuted ? 'rgba(251,191,36,0.55)' : 'rgba(147,197,253,0.45)',

            background: chordsMuted ? 'rgba(251,191,36,0.15)' : 'rgba(59,130,246,0.12)',

            color: chordsMuted ? '#fde68a' : '#bfdbfe',

            opacity: stackCols.size === 0 && !chordRail?.timeline.some((s) => s.chord) ? 0.4 : 1,

          }}

        >

          {chordsMuted ? 'UNMUTE CHORDS' : 'MUTE CHORDS'}

        </button>

        <button
          type="button"
          onClick={() => setAddNoteMode((v) => !v)}
          title="Click the grid to place bass hits at that time and pitch"
          style={{
            ...miniBtn,
            borderColor: addNoteMode ? 'rgba(124,244,198,0.65)' : 'rgba(124,244,198,0.35)',
            background: addNoteMode ? 'rgba(124,244,198,0.28)' : 'rgba(124,244,198,0.1)',
            color: addNoteMode ? '#e8fff5' : '#9ad4bc',
          }}
        >
          {addNoteMode ? '+ NOTE on' : '+ NOTE'}
        </button>

        <span style={{ fontSize: 7, color: '#6a7d92', fontWeight: 700, flexShrink: 0 }}>
          drag center = slide L/R + pitch · edges = length · snaps to bar start
        </span>

      </div>

      <svg

        ref={svgRef}

        viewBox={`0 0 ${W} ${H}`}

        width="100%"

        height={H}

        preserveAspectRatio="xMidYMid meet"

        style={{ display: 'block', maxWidth: '100%', cursor: svgCursor, touchAction: 'none' }}

        onPointerDown={(e) => {
          const svg = e.currentTarget;
          const plot = pointerToPlot(svg, e.clientX, e.clientY);
          if (plot == null) return;
          const { col, pitchSemi, colRaw } = plot;

          let hit: { kind: DragKind | 'body'; headCol: number } | null = null;
          for (let i = bassSpans.length - 1; i >= 0; i -= 1) {
            const h = hitTestSpan(e.clientX, e.clientY, bassSpans[i]!);
            if (h) {
              hit = h;
              break;
            }
          }

          if (e.button === 2 && hit) {
            applyMerged(
              beatLabSynthV2DeleteBassNote({
                allNotes: laneNotes,
                bassLane,
                layoutBars,
                stepsPerBar,
                headCol: hit.headCol,
                midiAtNote: midiAtBass,
              }),
            );
            if (selectedHeadCol === hit.headCol) setSelectedHeadCol(null);
            e.preventDefault();
            return;
          }



          if (e.altKey && hit) {

            applyMerged(

              beatLabSynthV2SplitBassNoteAt({

                allNotes: laneNotes,

                bassLane,

                layoutBars,

                stepsPerBar,

                headCol: hit.headCol,

                splitCol: col,

                midiAtNote: midiAtBass,

                maxCol,

                snapCols,

              }),

            );

            e.preventDefault();

            return;

          }



          if (hit?.kind === 'body') {

            const span = bassSpans.find((s) => s.headCol === hit!.headCol);

            if (!span) return;

            const now = Date.now();

            const dbl =

              lastClickRef.current &&

              lastClickRef.current.headCol === hit.headCol &&

              now - lastClickRef.current.t < 320;

            lastClickRef.current = { t: now, headCol: hit.headCol };

            if (dbl) {

              applyMerged(

                beatLabSynthV2SplitBassNoteAt({

                  allNotes: laneNotes,

                  bassLane,

                  layoutBars,

                  stepsPerBar,

                  headCol: hit.headCol,

                  splitCol: col,

                  midiAtNote: midiAtBass,

                  maxCol,

                  snapCols,

                }),

              );

              return;

            }

            setSelectedHeadCol(hit.headCol);

            const startSemi =
              span.pitchSemi ?? beatLabSynthV2MidiToBassPitchSemi(bassLane, span.midi);
            dragRef.current = {
              kind: 'move',
              headCol: hit.headCol,
              grabCol: col,
              grabColRaw: colRaw,
              grabPitchSemi: pitchSemi,
              originalCol: span.col0,
              originalLen: span.len,
              originalPitchSemi: startSemi,
            };

            svg.setPointerCapture(e.pointerId);

            e.preventDefault();

            return;

          }



          if (hit?.kind === 'resize-start' || hit?.kind === 'resize-end') {

            const span = bassSpans.find((s) => s.headCol === hit.headCol);

            if (!span) return;

            setSelectedHeadCol(hit.headCol);

            dragRef.current = {
              kind: hit.kind,
              headCol: hit.headCol,
              grabCol: col,
              grabColRaw: colRaw,
              grabPitchSemi: pitchSemi,
              originalCol: span.col0,
              originalLen: span.len,
              originalPitchSemi:
                span.pitchSemi ?? beatLabSynthV2MidiToBassPitchSemi(bassLane, span.midi),
            };

            svg.setPointerCapture(e.pointerId);

            e.preventDefault();

            return;

          }



          if (addNoteMode) {
            placeBassHit(col, pitchSemi);
            e.preventDefault();
            return;
          }

          if (e.detail >= 2) {
            const bar = Math.min(layoutBars - 1, Math.max(0, Math.floor(col / stepsPerBar)));
            placeBassHit(col, beatLabSynthV2PitchSemiForBarRoot(bassLane, roots[bar] ?? 36));
            e.preventDefault();
          }
        }}

        onPointerMove={(e) => {
          const svg = e.currentTarget;
          const plot = pointerToPlot(svg, e.clientX, e.clientY);

          if (dragRef.current && (e.buttons & 1) === 1) {
            const plotDrag = pointerToPlot(svg, e.clientX, e.clientY, { allowXOutside: true });
            if (plotDrag) {
              commitDrag(dragRef.current, plotDrag.colRaw, plotDrag.pitchSemi, false);
            }
            return;
          }

          if (dragRef.current) return;

          let found: { kind: DragKind | 'body'; headCol: number } | null = null;
          for (let i = bassSpans.length - 1; i >= 0; i -= 1) {
            const h = hitTestSpan(e.clientX, e.clientY, bassSpans[i]!);
            if (h) {
              found = h;
              break;
            }
          }

          setHoverHeadCol(found?.headCol ?? null);

          setHoverKind(found?.kind ?? null);

        }}

        onPointerUp={(e) => {
          const drag = dragRef.current;
          if (drag) {
            const plot = pointerToPlot(e.currentTarget, e.clientX, e.clientY, { allowXOutside: true });
            if (plot) commitDrag(drag, plot.colRaw, plot.pitchSemi, true);
            if (drag.kind === 'move' && dragRef.current) {
              setSelectedHeadCol(dragRef.current.headCol);
            }
            e.currentTarget.releasePointerCapture?.(e.pointerId);
            dragRef.current = null;
          }
        }}

        onPointerLeave={() => {

          if (!dragRef.current) {

            setHoverHeadCol(null);

            setHoverKind(null);

          }

        }}

        onContextMenu={(e) => e.preventDefault()}

      >

        {Array.from({ length: layoutBars }, (_, bar) => {

          const x0 = colToX(bar * stepsPerBar);

          const x1 = colToX((bar + 1) * stepsPerBar);

          const chord = chordRail?.timeline[bar]?.chord;

          const rootMidi = roots[bar] ?? 36;

          return (

            <g key={`bg-bar-${bar}`}>

              <rect

                x={x0}

                y={PAD_T - 36}

                width={Math.max(4, x1 - x0)}

                height={16}

                rx={3}

                fill="rgba(124,244,198,0.1)"

                stroke="rgba(124,244,198,0.35)"

              />

              <text

                x={(x0 + x1) / 2}

                y={PAD_T - 24}

                textAnchor="middle"

                fontSize={7}

                fontWeight={800}

                fill="#a8e8d0"

              >

                {chord && chordRail

                  ? chordSymbolToName(chord, chordRail.keyRoot, chordRail.mode).slice(0, 8)

                  : `Root ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][rootMidi % 12]}`}

              </text>

              <line x1={x0} y1={PAD_T} x2={x0} y2={PAD_T + PLOT_H} stroke="#243044" strokeWidth={1} />

            </g>

          );

        })}

        {Array.from({ length: Math.floor(windowCols / Math.max(1, stepsPerBar / 4)) + 1 }, (_, i) => {

          const col = i * Math.max(1, Math.round(stepsPerBar / 4));

          const x = colToX(col);

          return (

            <line key={`bg-q-${i}`} x1={x} y1={PAD_T} x2={x} y2={PAD_T + PLOT_H} stroke="#1a2434" strokeWidth={0.5} />

          );

        })}

        {bassSpans.map((n) => {

          if (n.col0 >= windowCols) return null;

          const x0 = colToX(n.col0);

          const x1 = colToX(n.col1);

          const y = midiToY(n.midi);

          const w = Math.max(3, x1 - x0);

          const active =

            selectedHeadCol === n.headCol || hoverHeadCol === n.headCol || activeDrag?.headCol === n.headCol;

          return (

            <g key={`bg-note-${n.headCol}`}>

              <rect

                x={x0}

                y={y - 5}

                width={w}

                height={10}

                rx={2}

                fill={active ? 'rgba(124, 244, 198, 0.62)' : 'rgba(124, 244, 198, 0.42)'}

                stroke={active ? '#b8ffe8' : 'rgba(124, 244, 198, 0.75)'}

                strokeWidth={active ? 1.2 : 0.9}

              />

              <line

                x1={x0 + 1}

                y1={y - 5}

                x2={x0 + 1}

                y2={y + 5}

                stroke="rgba(255,255,255,0.35)"

                strokeWidth={2}

              />

              <line

                x1={x1 - 1}

                y1={y - 5}

                x2={x1 - 1}

                y2={y + 5}

                stroke="rgba(255,255,255,0.35)"

                strokeWidth={2}

              />

            </g>

          );

        })}

        {roots.map((midi, bar) => {
          const x = colToX(bar * stepsPerBar);
          const y = midiToY(midi);
          return (
            <circle
              key={`bg-root-${bar}`}
              cx={x}
              cy={y}
              r={3}
              fill="#7cf4c6"
              stroke="#243044"
              strokeWidth={1}
              opacity={0.95}
            />
          );
        })}

      </svg>

    </div>

  );

}


