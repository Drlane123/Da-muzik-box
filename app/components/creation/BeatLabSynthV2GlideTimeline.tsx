import React, { useMemo, useCallback, useState } from 'react';
import { chordSymbolToName } from '@/app/lib/creationStation/chordBuilder';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import type {
  BeatLabBassSynthVoiceParams,
  BeatLabGlideShiftDir,
  BeatLabGlideShiftMarker,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import { beatLabNoteMidi } from '@/app/lib/creationStation/beatLabMelodicSynth';
import {
  buildBeatLabSynthV2GlideTimelineModel,
  type BeatLabGlideVisKind,
} from '@/app/lib/creationStation/beatLabSynthV2GlideTimelineModel';
import {
  beatLabGlideMarkerStartCol,
  beatLabNormalizeGlideMarkers,
} from '@/app/lib/creationStation/beatLabSynthV2GlideMarkers';
import { midiToShortLabel } from '@/app/lib/creationStation/beatLabSynthV2GlidePulse';
import {
  beatLabSynth2ClearFxPatch,
  beatLabSynth2ClearShiftsAndBarsPatch,
} from '@/app/lib/creationStation/beatLabSynthV2GlideClear';
import { BeatLabSynthV2GlidePresetPicker } from '@/app/components/creation/BeatLabSynthV2GlidePresetPicker';

const W = 920;
const H = 146;
const PAD_L = 36;
const PAD_R = 10;
const PAD_T = 42;
const PAD_B = 14;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const KIND_STROKE: Record<BeatLabGlideVisKind, string> = {
  mono: '#cfb3ff',
  legato: '#9ad4ff',
  chord: '#ffd48a',
  intra: '#7ce8b8',
  slide: '#ff8aa8',
};

const SHIFT_PREVIEW = '#ffa8c8';

const miniBtn: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 700,
  padding: '3px 7px',
  borderRadius: 4,
  border: '1px solid #303848',
  background: '#12161e',
  color: '#a8b4c8',
  cursor: 'pointer',
};

type Props = {
  lane: number;
  notes: readonly BeatLabMidiNote[];
  voice: BeatLabBassSynthVoiceParams;
  patternCols: number;
  subdiv: number;
  bpm: number;
  beatsPerBar: number;
  colsPerBar: number;
  chordRail?: BeatLabImportedChordRail | null;
  onBarMaskChange?: (mask: number) => void;
  onSlideBarMaskChange?: (mask: number) => void;
  onGlideVoicePatch?: (next: Partial<BeatLabBassSynthVoiceParams>) => void;
};

export function BeatLabSynthV2GlideTimeline({
  lane,
  notes,
  voice,
  patternCols,
  subdiv,
  bpm,
  beatsPerBar,
  colsPerBar,
  chordRail = null,
  onBarMaskChange,
  onSlideBarMaskChange,
  onGlideVoicePatch,
}: Props) {
  const layoutBars: 4 | 8 = voice.glideLayoutBars === 4 ? 4 : 8;
  const barMask = voice.glideBarMask ?? 0xffffffff;
  const slideBarMask = voice.slideBarMask ?? 0xffffffff;
  const qShift = voice.glideQuantShiftSteps ?? 0;
  const qFine = voice.glideQuantShiftFine ?? 0;
  const stepsPerBar = Math.max(1, Math.round(beatsPerBar * subdiv));
  const windowCols = layoutBars * stepsPerBar;
  const hasChordRail =
    chordRail != null && chordRail.timeline.some((s) => s.chord != null);

  const [drawSemi, setDrawSemi] = useState(3);
  const [drawDir, setDrawDir] = useState<BeatLabGlideShiftDir>('roundtrip');
  const [drawLen, setDrawLen] = useState(2);
  const [barEditTarget, setBarEditTarget] = useState<'glide' | 'slide'>('glide');
  const [showBassNotesInLayout, setShowBassNotesInLayout] = useState(true);

  const model = useMemo(
    () =>
      buildBeatLabSynthV2GlideTimelineModel({
        notes,
        lane,
        voice,
        patternCols,
        subdiv,
        bpm,
        beatsPerBar,
        colsPerBar,
        chordRail,
        midiAtNote: (n) => beatLabNoteMidi(n.lane, n),
        maxStepCol: windowCols,
      }),
    [
      notes,
      lane,
      voice,
      patternCols,
      subdiv,
      bpm,
      beatsPerBar,
      colsPerBar,
      chordRail,
      windowCols,
    ],
  );

  const displayBars = layoutBars;
  const { segments, noteSpans } = model;
  const visibleSegments = useMemo(() => segments.filter((seg) => seg.enabled), [segments]);
  const hasShiftMarkers = (voice.glideShiftMarkers?.length ?? 0) > 0;

  const midiLo = useMemo(() => {
    const mids = noteSpans.map((n) => n.midi);
    if (mids.length === 0) return 36;
    return Math.min(...mids) - 3;
  }, [noteSpans]);

  const midiHi = useMemo(() => {
    const mids = noteSpans.map((n) => n.midi);
    if (mids.length === 0) return 60;
    return Math.max(...mids) + 3;
  }, [noteSpans]);

  const colToX = (col: number) =>
    PAD_L + (col / Math.max(1, windowCols)) * PLOT_W;

  const midiToY = useCallback(
    (midi: number) => {
      const span = Math.max(1, midiHi - midiLo);
      return PAD_T + (1 - (midi - midiLo) / span) * PLOT_H;
    },
    [midiLo, midiHi],
  );

  const toggleBar = (barIdx: number) => {
    if (barIdx > 31) return;
    if (barEditTarget === 'slide') {
      if (!onSlideBarMaskChange) return;
      onSlideBarMaskChange(slideBarMask ^ (1 << barIdx));
      return;
    }
    if (!onBarMaskChange) return;
    onBarMaskChange(barMask ^ (1 << barIdx));
  };

  const quantCols = Math.max(1, Math.round(stepsPerBar / 4));

  const commitMarkers = useCallback(
    (next: BeatLabGlideShiftMarker[]) => {
      onGlideVoicePatch?.({
        glideShiftMarkers: beatLabNormalizeGlideMarkers(next, layoutBars, stepsPerBar),
      });
    },
    [onGlideVoicePatch, layoutBars, stepsPerBar],
  );

  const onSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onGlideVoicePatch) return;
      const svg = e.currentTarget as SVGSVGElement & {
        createSVGPoint?: () =>
          SVGPoint & { matrixTransform(m: SVGMatrix): { x: number; y: number } };
      };
      const pt = svg.createSVGPoint?.();
      if (!pt) return;
      pt.x = e.clientX;
      pt.y = e.clientY;
      const cur = svg.getScreenCTM();
      const p =
        pt && cur && typeof svg.createSVGPoint === 'function'
          ? pt.matrixTransform(cur.inverse())
          : { x: 0, y: 0 };
      if (p.x < PAD_L || p.x > W - PAD_R || p.y < PAD_T || p.y > PAD_T + PLOT_H) return;
      const colF = ((p.x - PAD_L) / PLOT_W) * windowCols;
      const snapped = Math.round(colF / quantCols) * quantCols;
      const safeCol = Math.max(0, Math.min(windowCols - 1, snapped));
      const bar = Math.floor(safeCol / stepsPerBar);
      const stepInBar = Math.max(0, Math.min(stepsPerBar - 1, safeCol - bar * stepsPerBar));

      const curM = [...(voice.glideShiftMarkers ?? [])];
      const hit = curM.findIndex((m) => m.bar === bar && m.stepInBar === stepInBar);
      if (hit >= 0) {
        curM.splice(hit, 1);
      } else {
        curM.push({
          bar,
          stepInBar,
          lenSteps: drawLen,
          semi: drawSemi,
          dir: drawDir,
        });
      }
      commitMarkers(curM);
    },
    [
      quantCols,
      windowCols,
      stepsPerBar,
      voice.glideShiftMarkers,
      commitMarkers,
      drawLen,
      drawSemi,
      drawDir,
      onGlideVoicePatch,
    ],
  );

  const shiftPreview = useMemo(() => {
    const markers = voice.glideShiftMarkers ?? [];
    type Seg = {
      key: string;
      x0: number;
      x1: number;
      y0: number;
      y1: number;
      dir: string;
      roundtrip: boolean;
      index: number;
      leg?: 'a' | 'b';
    };
    const out: Seg[] = [];
    let idx = 0;
    const baseAtCol = (c: number): number => {
      const ns = noteSpans.find((ns2) => ns2.col0 <= c && ns2.col1 > c);
      return ns?.midi ?? (midiLo + midiHi) / 2;
    };

    for (const m of markers) {
      const g0 = beatLabGlideMarkerStartCol(m, stepsPerBar, qShift);
      const g1 = g0 + m.lenSteps;
      if (g0 >= windowCols) {
        idx += 1;
        continue;
      }
      const clip0 = Math.max(0, g0);
      const clip1 = Math.min(windowCols, g1);
      const baseMidi = baseAtCol(clip0 + 1e-4);
      const mag = Math.max(1, Math.min(12, Math.abs(Number(m.semi)) || 3));
      const signed = Math.sign(Number(m.semi)) === -1 ? -mag : mag;

      if (m.dir === 'roundtrip') {
        const off = signed;
        const yPeak = midiToY(baseMidi + off);
        const ym = midiToY(baseMidi);
        const midCol = clip0 + (clip1 - clip0) / 2;
        out.push({
          key: `${idx}-a`,
          x0: colToX(clip0),
          x1: colToX(midCol),
          y0: ym,
          y1: yPeak,
          dir: m.dir,
          roundtrip: true,
          leg: 'a',
          index: idx,
        });
        out.push({
          key: `${idx}-b`,
          x0: colToX(midCol),
          x1: colToX(clip1),
          y0: yPeak,
          y1: ym,
          dir: m.dir,
          roundtrip: true,
          leg: 'b',
          index: idx,
        });
      } else if (m.dir === 'down') {
        const yPeak = midiToY(baseMidi - mag);
        out.push({
          key: `${idx}`,
          x0: colToX(clip0),
          x1: colToX(clip1),
          y0: midiToY(baseMidi),
          y1: yPeak,
          dir: m.dir,
          roundtrip: false,
          index: idx,
        });
      } else {
        const yPeak = midiToY(baseMidi + mag);
        out.push({
          key: `${idx}`,
          x0: colToX(clip0),
          x1: colToX(clip1),
          y0: midiToY(baseMidi),
          y1: yPeak,
          dir: m.dir,
          roundtrip: false,
          index: idx,
        });
      }
      idx += 1;
    }
    return out;
  }, [
    voice.glideShiftMarkers,
    stepsPerBar,
    qShift,
    windowCols,
    noteSpans,
    midiLo,
    midiHi,
    midiToY,
  ]);

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: '#d9c0ff', letterSpacing: 0.5 }}>
            GLIDE LAYOUT · {displayBars} bars
          </span>
          {([4, 8] as const).map((n) => (
            <button
              key={`lb-${n}`}
              type="button"
              onClick={() => onGlideVoicePatch?.({ glideLayoutBars: n })}
              style={{
                fontSize: 8,
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 4,
                border: layoutBars === n ? '1px solid #c59cff' : '1px solid #303848',
                background: layoutBars === n ? 'rgba(197,156,255,0.2)' : '#12161e',
                color: layoutBars === n ? '#eeddff' : '#8899aa',
                cursor: onGlideVoicePatch ? 'pointer' : 'default',
              }}
            >
              {n} bars
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: '#8a9aae', fontWeight: 700 }}>Bar target</span>
          {(['glide', 'slide'] as const).map((t) => (
            <button
              key={`bt-${t}`}
              type="button"
              onClick={() => setBarEditTarget(t)}
              style={{
                ...miniBtn,
                border: barEditTarget === t ? '1px solid #7cc9ff' : miniBtn.border,
                color: barEditTarget === t ? '#d7f0ff' : '#8899aa',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
          <span style={{ fontSize: 8, color: '#8a9aae', fontWeight: 700 }}>Quant shift</span>
          <button
            type="button"
            onClick={() =>
              onGlideVoicePatch?.({ glideQuantShiftSteps: Math.max(-24, qShift - 1) })
            }
            disabled={!onGlideVoicePatch}
            style={miniBtn}
          >
            ◀ step
          </button>
          <span style={{ fontSize: 8, color: '#bcd0ea', fontWeight: 800, minWidth: 28 }}>
            {qShift > 0 ? `+${qShift}` : qShift}
          </span>
          <button
            type="button"
            onClick={() => onGlideVoicePatch?.({ glideQuantShiftSteps: Math.min(24, qShift + 1) })}
            disabled={!onGlideVoicePatch}
            style={miniBtn}
          >
            step ▶
          </button>
          <span style={{ fontSize: 8, color: '#8a9aae', fontWeight: 700 }}>Fine</span>
          {([0, 0.25, 0.5, 0.75] as const).map((f) => (
            <button
              key={`fine-${f}`}
              type="button"
              onClick={() => onGlideVoicePatch?.({ glideQuantShiftFine: f })}
              style={{
                ...miniBtn,
                border: qFine === f ? '1px solid #7cc9ff' : miniBtn.border,
                color: qFine === f ? '#d7f0ff' : '#8899aa',
              }}
            >
              {f === 0 ? '0' : `${f * 100}%`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <BeatLabSynthV2GlidePresetPicker
          layoutBars={layoutBars}
          stepsPerBar={stepsPerBar}
          subdiv={subdiv}
          hasChordRail={hasChordRail}
          fallbackGlideDivision={voice.glideDivision}
          onApply={(patch) => onGlideVoicePatch?.(patch)}
          disabled={!onGlideVoicePatch}
          compact
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 8, color: '#8899aa', fontWeight: 700 }}>Draw shift</span>
        <label style={{ fontSize: 8, color: '#9aa6b8' }}>
          semi
          <input
            type="number"
            min={1}
            max={12}
            value={drawSemi}
            onChange={(e) => setDrawSemi(Math.max(1, Math.min(12, +e.target.value || 3)))}
            style={{
              width: 44,
              height: 22,
              marginLeft: 4,
              fontSize: 10,
              background: '#12161e',
              color: '#e0e8f8',
              border: '1px solid #303848',
              borderRadius: 4,
              padding: '0 4px',
            }}
          />
        </label>
        <label style={{ fontSize: 8, color: '#9aa6b8' }}>
          len
          <input
            type="number"
            min={1}
            max={16}
            value={drawLen}
            onChange={(e) => setDrawLen(Math.max(1, Math.min(16, +e.target.value || 2)))}
            style={{
              width: 44,
              height: 22,
              marginLeft: 4,
              fontSize: 10,
              background: '#12161e',
              color: '#e0e8f8',
              border: '1px solid #303848',
              borderRadius: 4,
              padding: '0 4px',
            }}
          />
        </label>
        {(['up', 'down', 'roundtrip'] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDrawDir(d)}
            style={{
              fontSize: 8,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 4,
              border: drawDir === d ? '1px solid #ffa8c8' : '1px solid #303848',
              background: drawDir === d ? 'rgba(255,168,200,0.15)' : '#12161e',
              color: drawDir === d ? '#ffd0e0' : '#8899aa',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onGlideVoicePatch?.(beatLabSynth2ClearFxPatch())}
          disabled={!onGlideVoicePatch}
          style={{ ...miniBtn, color: '#9ad4ff' }}
          title="Reset glide time and slide-motion FX only — keeps pink shifts and bar G/S toggles"
        >
          Clear FX
        </button>
        <button
          type="button"
          onClick={() => onGlideVoicePatch?.(beatLabSynth2ClearShiftsAndBarsPatch())}
          disabled={!onGlideVoicePatch}
          style={{ ...miniBtn, color: '#ff9999' }}
          title="Remove pink shift lines, quant shift, and bar G/S toggles (does not change glide time)"
        >
          Clear shifts + bars
        </button>
        <button
          type="button"
          onClick={() => setShowBassNotesInLayout((v) => !v)}
          style={{
            ...miniBtn,
            color: showBassNotesInLayout ? '#58c4ff' : '#8899aa',
            borderColor: showBassNotesInLayout ? 'rgba(88,196,255,0.45)' : miniBtn.border,
          }}
          title="Cyan bars = bass CH notes (not piano-roll chords). Toggle visibility only."
        >
          {showBassNotesInLayout ? 'Hide bass line' : 'Show bass line'}
        </button>
        <span style={{ fontSize: 8, color: '#8a9aae', fontWeight: 700, marginLeft: 6 }}>Glide controls</span>
        <label style={{ fontSize: 8, color: '#9aa6b8' }}>
          time
          <input
            type="number"
            min={0}
            max={500}
            value={Math.round(voice.glideMs)}
            onChange={(e) =>
              onGlideVoicePatch?.({
                glideMs: Math.max(0, Math.min(500, Math.round(+e.target.value || 0))),
              })
            }
            style={{
              width: 40,
              height: 18,
              marginLeft: 4,
              fontSize: 9,
              background: '#12161e',
              color: '#e0e8f8',
              border: '1px solid #303848',
              borderRadius: 4,
              padding: '0 2px',
            }}
          />
        </label>
        <label style={{ fontSize: 8, color: '#9aa6b8' }}>
          glide semi
          <input
            type="number"
            min={1}
            max={12}
            value={Math.max(1, Math.min(12, Math.round(voice.slideMotionSemi ?? 2)))}
            onChange={(e) =>
              onGlideVoicePatch?.({
                slideMotionSemi: Math.max(1, Math.min(12, Math.round(+e.target.value || 2))),
                slideMotionEnabled: true,
              })
            }
            style={{
              width: 40,
              height: 18,
              marginLeft: 4,
              fontSize: 9,
              background: '#12161e',
              color: '#e0e8f8',
              border: '1px solid #303848',
              borderRadius: 4,
              padding: '0 2px',
            }}
          />
        </label>
        <label style={{ fontSize: 8, color: '#9aa6b8' }}>
          glide length %
          <input
            type="number"
            min={8}
            max={80}
            value={Math.round((voice.slideMotionFrac ?? 0.2) * 100)}
            onChange={(e) =>
              onGlideVoicePatch?.({
                slideMotionFrac: Math.max(0.08, Math.min(0.8, (+e.target.value || 20) / 100)),
                slideMotionEnabled: true,
              })
            }
            style={{
              width: 44,
              height: 18,
              marginLeft: 4,
              fontSize: 9,
              background: '#12161e',
              color: '#e0e8f8',
              border: '1px solid #303848',
              borderRadius: 4,
              padding: '0 2px',
            }}
          />
        </label>
        <label style={{ fontSize: 8, color: '#9aa6b8' }}>
          glide speed ms
          <input
            type="number"
            min={10}
            max={400}
            value={Math.max(10, Math.min(400, Math.round(voice.slideMotionRateMs ?? 85)))}
            onChange={(e) =>
              onGlideVoicePatch?.({
                slideMotionRateMs: Math.max(10, Math.min(400, Math.round(+e.target.value || 85))),
                slideMotionEnabled: true,
              })
            }
            style={{
              width: 48,
              height: 18,
              marginLeft: 4,
              fontSize: 9,
              background: '#12161e',
              color: '#e0e8f8',
              border: '1px solid #303848',
              borderRadius: 4,
              padding: '0 2px',
            }}
          />
        </label>
        <span style={{ fontSize: 8, color: '#6a7a8e', fontWeight: 600 }}>
          Click grid · snap 1/{subdiv * 4} · audio uses Sync + fine nudge
        </span>
      </div>

      <div
        style={{
          borderRadius: 8,
          border: '1px solid rgba(184, 140, 255, 0.35)',
          background: 'linear-gradient(180deg, #0c1018 0%, #06080e 100%)',
          overflow: 'auto',
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="xMidYMid meet"
          style={{ cursor: onGlideVoicePatch ? 'crosshair' : 'default' }}
          onClick={onSvgClick}
        >
          {Array.from({ length: displayBars }, (_, bar) => {
            const x0 = colToX(bar * stepsPerBar);
            const x1 = colToX((bar + 1) * stepsPerBar);
            const glideEnabled = (barMask & (1 << bar)) !== 0;
            const slideEnabled = (slideBarMask & (1 << bar)) !== 0;
            const enabled = barEditTarget === 'slide' ? slideEnabled : glideEnabled;
            const chord = chordRail?.timeline[bar]?.chord;
            return (
              <g key={`bar-${bar}`}>
                <rect
                  x={x0}
                  y={PAD_T - 36}
                  width={Math.max(4, x1 - x0)}
                  height={16}
                  rx={3}
                  fill={enabled ? 'rgba(184,140,255,0.22)' : 'rgba(40,48,60,0.5)'}
                  stroke={enabled ? 'rgba(184,140,255,0.5)' : '#303848'}
                  style={{ cursor: onBarMaskChange ? 'pointer' : 'default' }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggleBar(bar);
                  }}
                />
                <text
                  x={(x0 + x1) / 2}
                  y={PAD_T - 24}
                  textAnchor="middle"
                  fontSize={7}
                  fontWeight={800}
                  fill={enabled ? '#e8d8ff' : '#5a6478'}
                  style={{ pointerEvents: 'none' }}
                >
                  Bar {bar + 1}
                  {chord
                    ? ` · ${chordSymbolToName(chord, chordRail!.keyRoot, chordRail!.mode).slice(0, 7)}`
                    : ''}
                </text>
                <text
                  x={(x0 + x1) / 2}
                  y={PAD_T - 15}
                  textAnchor="middle"
                  fontSize={6.2}
                  fontWeight={800}
                  fill="#9fb2c8"
                  style={{ pointerEvents: 'none' }}
                >
                  G:{glideEnabled ? 'on' : 'off'} · S:{slideEnabled ? 'on' : 'off'}
                </text>
                <g
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (!onBarMaskChange || bar > 31) return;
                    onBarMaskChange(barMask ^ (1 << bar));
                  }}
                  style={{ cursor: onBarMaskChange ? 'pointer' : 'default' }}
                >
                  <rect
                    x={x0 + 3}
                    y={PAD_T - 36}
                    width={10}
                    height={10}
                    rx={2}
                    fill={glideEnabled ? 'rgba(124, 226, 255, 0.28)' : 'rgba(32,40,52,0.7)'}
                    stroke={glideEnabled ? '#7ce2ff' : '#364155'}
                    strokeWidth={0.8}
                  />
                  <text
                    x={x0 + 8}
                    y={PAD_T - 28.8}
                    textAnchor="middle"
                    fontSize={6.8}
                    fontWeight={900}
                    fill={glideEnabled ? '#dff8ff' : '#7f8a9d'}
                    style={{ pointerEvents: 'none' }}
                  >
                    G
                  </text>
                </g>
                <g
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (!onSlideBarMaskChange || bar > 31) return;
                    onSlideBarMaskChange(slideBarMask ^ (1 << bar));
                  }}
                  style={{ cursor: onSlideBarMaskChange ? 'pointer' : 'default' }}
                >
                  <rect
                    x={x1 - 13}
                    y={PAD_T - 36}
                    width={10}
                    height={10}
                    rx={2}
                    fill={slideEnabled ? 'rgba(255, 168, 200, 0.28)' : 'rgba(32,40,52,0.7)'}
                    stroke={slideEnabled ? '#ffa8c8' : '#364155'}
                    strokeWidth={0.8}
                  />
                  <text
                    x={x1 - 8}
                    y={PAD_T - 28.8}
                    textAnchor="middle"
                    fontSize={6.8}
                    fontWeight={900}
                    fill={slideEnabled ? '#ffe3ef' : '#7f8a9d'}
                    style={{ pointerEvents: 'none' }}
                  >
                    S
                  </text>
                </g>
                <rect
                  x={x0}
                  y={PAD_T}
                  width={Math.max(1, x1 - x0)}
                  height={PLOT_H}
                  fill={enabled ? 'rgba(184,140,255,0.04)' : 'rgba(0,0,0,0.15)'}
                />
                <line
                  x1={x0}
                  y1={PAD_T}
                  x2={x0}
                  y2={PAD_T + PLOT_H}
                  stroke="#243044"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {Array.from({ length: displayBars * 4 }, (_, qi) => {
            const col = qi * quantCols;
            const x = colToX(col + qFine * quantCols);
            return (
              <line
                key={`q-${qi}`}
                x1={x}
                y1={PAD_T}
                x2={x}
                y2={PAD_T + PLOT_H}
                stroke="#1a2434"
                strokeWidth={0.5}
                strokeDasharray="2 3"
              />
            );
          })}

          {qFine > 0
            ? Array.from({ length: displayBars * 4 }, (_, qi) => {
                const col = qi * quantCols + quantCols / 2;
                const x = colToX(col + qFine * quantCols);
                return (
                  <line
                    key={`qh-${qi}`}
                    x1={x}
                    y1={PAD_T}
                    x2={x}
                    y2={PAD_T + PLOT_H}
                    stroke="#2a3548"
                    strokeWidth={0.35}
                  />
                );
              })
            : null}

          {showBassNotesInLayout
            ? noteSpans.map((n, i) => {
                const clip1 = Math.min(n.col1, windowCols);
                if (n.col0 >= windowCols) return null;
                const x0 = colToX(n.col0);
                const x1 = colToX(clip1);
                const y = midiToY(n.midi);
                return (
                  <rect
                    key={`note-${i}`}
                    x={x0}
                    y={y - 3}
                    width={Math.max(2, x1 - x0)}
                    height={6}
                    rx={2}
                    fill="rgba(88, 196, 255, 0.35)"
                    stroke="#58c4ff88"
                    strokeWidth={0.8}
                  />
                );
              })
            : null}

          {visibleSegments.map((seg) => {
            if (seg.col0 >= windowCols) return null;
            const x0 = colToX(seg.col0);
            const x1 = colToX(Math.min(seg.col1, windowCols));
            const y0 = midiToY(seg.fromMidi);
            const y1 = midiToY(seg.toMidi);
            const stroke = KIND_STROKE[seg.kind];
            const opacity = seg.enabled ? 0.92 : 0.22;
            const steps = seg.stutterSteps;
            const pathPts: string[] = [`M ${x0} ${y0}`];
            if (steps <= 1) {
              pathPts.push(`L ${x1} ${y1}`);
            } else {
              for (let s = 1; s <= steps; s += 1) {
                const t = s / steps;
                const px = x0 + (x1 - x0) * t;
                const py = y0 + (y1 - y0) * t;
                pathPts.push(`L ${px} ${py}`);
              }
            }
            return (
              <g key={seg.id} opacity={opacity}>
                <path
                  d={pathPts.join(' ')}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={seg.kind === 'intra' ? 1.2 : 2}
                  strokeDasharray={seg.kind === 'intra' ? '3 2' : undefined}
                />
                {steps > 1
                  ? Array.from({ length: steps - 1 }, (_, si) => {
                      const t = (si + 1) / steps;
                      const px = x0 + (x1 - x0) * t;
                      const py = y0 + (y1 - y0) * t;
                      return (
                        <circle key={`${seg.id}-s${si}`} cx={px} cy={py} r={1.8} fill={stroke} />
                      );
                    })
                  : null}
                <title>
                  {midiToShortLabel(seg.fromMidi)} → {midiToShortLabel(seg.toMidi)} ({seg.kind})
                </title>
              </g>
            );
          })}

          {hasShiftMarkers
            ? shiftPreview.map((seg) => (
                <line
                  key={seg.key}
                  x1={seg.x0}
                  y1={seg.y0}
                  x2={seg.x1}
                  y2={seg.y1}
                  stroke={SHIFT_PREVIEW}
                  strokeWidth={seg.roundtrip ? 1.8 : 2.4}
                  strokeDasharray={seg.roundtrip ? '4 2' : undefined}
                />
              ))
            : null}

          <text x={4} y={PAD_T + 10} fontSize={7} fill="#5a6a78" fontWeight={700}>
            ↑ pitch
          </text>
        </svg>
      </div>
      <div style={{ fontSize: 8, color: '#5c687c', marginTop: 4, fontWeight: 600, lineHeight: 1.45 }}>
        Cyan bars = bass CH (GENERATOR) · Pink = drawn shifts · Purple arcs = glide FX when a bar G is on.
        Clear FX resets time/slide knobs. Clear shifts + bars removes pink lines and turns all bar G/S off.
        Piano-roll chords live on the other CH — use BASSLINE → Clear bass to remove cyan bars.
      </div>
    </div>
  );
}
