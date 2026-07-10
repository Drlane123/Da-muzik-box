import React, { useCallback, useEffect, useRef, useState } from 'react';
import { beatLabMelodicSynthV2AuditionPitch } from '@/app/lib/creationStation/beatLabMidiRoll';
import { BeatLabSynthV2MiniKeys } from '@/app/components/creation/BeatLabSynthV2MiniKeys';
import {
  BEAT_LAB_BASS_SYNTH_PRESETS,
  type BeatLabBassSynthPreset,
} from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import type {
  BeatLabBassSynthVoiceParams,
  BeatLabGlideShiftMarker,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import {
  beatLabSynthV2GlideDivisionFromQuantSubdiv,
  beatLabSynthV2GlideSeconds,
  type BeatLabSynthGlideDivision,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';
import { SynthRoundKnob } from '@/app/components/creation/BeatLabSynthV2Knob';
import { BeatLabSynthV2Oscilloscope } from '@/app/components/creation/BeatLabSynthV2Oscilloscope';
import { BeatLabSynthV2GlideActivityMeter } from '@/app/components/creation/BeatLabSynthV2GlideActivityMeter';
import { BeatLabSynthV2GlideTimeline } from '@/app/components/creation/BeatLabSynthV2GlideTimeline';
import { BeatLabSynthV2GlidePresetPicker } from '@/app/components/creation/BeatLabSynthV2GlidePresetPicker';
import { BeatLabSynthV2BassGenerator } from '@/app/components/creation/BeatLabSynthV2BassGenerator';
import {
  beatLabSynthV2GlideDivisionToCols,
  beatLabSynthV2StarterShiftMarkers,
} from '@/app/lib/creationStation/beatLabSynthV2GlidePresets';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import {
  beatLabGlideMarkerStartCol,
  beatLabNormalizeGlideMarkers,
} from '@/app/lib/creationStation/beatLabSynthV2GlideMarkers';

type Props = {
  /** Bass synth + GENERATOR (bass preset bank). */
  bassLane: number;
  /** Piano-roll chords (separate mixer CH + piano bank). */
  harmonyLane: number;
  presetId: string;
  voice: BeatLabBassSynthVoiceParams;
  onPresetChange: (presetId: string) => void;
  onLoadPresetToVoice: (presetId: string) => void;
  onPatchVoice: (next: Partial<BeatLabBassSynthVoiceParams>) => void;
  onPreview?: () => void;
  onPreviewMidi?: (midi: number) => void;
  onSustainMidi?: (midi: number) => void;
  onReleaseMidi?: () => void;
  playingMidis?: ReadonlySet<number>;
  bpm?: number;
  quantSubdiv?: number;
  /** Chord Builder progression rail — enables chord glide mode. */
  chordRail?: BeatLabImportedChordRail | null;
  laneNotes?: readonly BeatLabMidiNote[];
  patternCols?: number;
  beatsPerBar?: number;
  colsPerBar?: number;
  isActive?: boolean;
  onAuditionStart?: () => void;
  onAuditionStop?: () => void;
  onAuditionTouch?: () => void;
  onApplyBassLaneNotes?: (bassLaneNotes: BeatLabMidiNote[]) => void;
  onApplyHarmonyLaneNotes?: (harmonyLaneNotes: BeatLabMidiNote[]) => void;
  /** Parent owns vertical scroll (e.g. SE2 floating panel). */
  scrollContained?: boolean;
};

const FX_GRAPH_H = 50;
const KNOB_SIZE = 36;

const GRID_FX = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 228px), 1fr))',
} as const;

type ModuleOpenState = {
  osc: boolean;
  filter: boolean;
  amp: boolean;
  glide: boolean;
  dist: boolean;
  eq: boolean;
  comp: boolean;
  chorus: boolean;
  delay: boolean;
  phaser: boolean;
  flanger: boolean;
  reverb: boolean;
};

const DEFAULT_MODULE_OPEN: ModuleOpenState = {
  osc: false,
  filter: false,
  amp: false,
  glide: true,
  dist: false,
  eq: false,
  comp: false,
  chorus: false,
  delay: false,
  phaser: false,
  flanger: false,
  reverb: false,
};

function FxGraphSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 200 80" width="100%" height={FX_GRAPH_H} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  );
}

function moduleShell(
  title: string,
  accent: string,
  children: React.ReactNode,
  opts?: { open?: boolean; onToggle?: () => void },
) {
  const open = opts?.open ?? true;
  return (
    <div
      style={{
        border: `1px solid ${accent}55`,
        borderRadius: 8,
        background: `linear-gradient(165deg, ${accent}12 0%, #0a0c12 55%)`,
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: '5px 8px',
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: 0.6,
          color: accent,
          borderBottom: `1px solid ${accent}33`,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{title}</span>
        {opts?.onToggle ? (
          <button
            type="button"
            onClick={opts.onToggle}
            style={{
              fontSize: 8,
              fontWeight: 800,
              color: accent,
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${accent}44`,
              borderRadius: 4,
              padding: '1px 6px',
              cursor: 'pointer',
            }}
            title={open ? 'Collapse module' : 'Expand module'}
          >
            {open ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
      {open ? <div style={{ padding: 8 }}>{children}</div> : null}
    </div>
  );
}

function graphBox(children: React.ReactNode) {
  return (
    <div
      style={{
        borderRadius: 6,
        border: '1px solid #243044',
        background: 'radial-gradient(ellipse 90% 80% at 50% 40%, #0c1524 0%, #05080e 100%)',
        minHeight: FX_GRAPH_H,
        marginBottom: 6,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function GlideDrawLaneBox({
  voice,
  subdiv,
  beatsPerBar,
  onPatch,
}: {
  voice: BeatLabBassSynthVoiceParams;
  subdiv: number;
  beatsPerBar: number;
  onPatch: (next: Partial<BeatLabBassSynthVoiceParams>) => void;
}) {
  const glideDivBeats = (
    div: NonNullable<BeatLabBassSynthVoiceParams['glideDivision']>,
  ): number => {
    if (div === '1/32') return 1 / 8;
    if (div === '1/16') return 1 / 4;
    if (div === '1/8') return 1 / 2;
    return 1;
  };
  const layoutBars: 4 | 8 = voice.glideLayoutBars === 4 ? 4 : 8;
  const stepsPerBar = Math.max(1, Math.round(subdiv * beatsPerBar));
  const totalCols = layoutBars * stepsPerBar;
  const qCols = Math.max(1, Math.round(subdiv * glideDivBeats(voice.glideDivision ?? '1/16')));
  const markers = voice.glideShiftMarkers ?? [];
  const qShift = voice.glideQuantShiftSteps ?? 0;
  const W = 920;
  const H = 146;
  const PAD_L = 36;
  const PAD_R = 10;
  const PAD_T = 42;
  const PAD_B = 14;
  const drawW = W - PAD_L - PAD_R;
  const yMid = PAD_T + (H - PAD_T - PAD_B) * 0.5;

  const colToX = (col: number) =>
    PAD_L + (Math.max(0, Math.min(totalCols, col)) / Math.max(1, totalCols)) * drawW;

  const semiToY = (semi: number) => {
    const s = Math.max(-12, Math.min(12, semi));
    return yMid - (s / 12) * ((H - PAD_T - PAD_B) * 0.45);
  };

  const yToSemi = (y: number) => {
    const norm = (yMid - y) / Math.max(1, (H - PAD_T - PAD_B) * 0.45);
    const s = Math.round(norm * 12);
    if (s > 0) return Math.max(1, Math.min(12, s));
    if (s < 0) return Math.max(-12, Math.min(-1, s));
    return 0;
  };

  const pointerToSnap = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const pt = svg.createSVGPoint?.();
    const ctm = svg.getScreenCTM?.();
    if (!pt || !ctm) return null;
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    if (p.x < PAD_L || p.x > W - PAD_R || p.y < PAD_T || p.y > H - PAD_B) return null;
    const colRaw = ((p.x - PAD_L) / Math.max(1, drawW)) * totalCols;
    const snappedCol = Math.round(colRaw / qCols) * qCols;
    const col = Math.max(0, Math.min(totalCols - 1, snappedCol));
    const semi = yToSemi(p.y);
    const dir: 'up' | 'down' | 'roundtrip' = semi < 0 ? 'down' : semi > 0 ? 'up' : 'roundtrip';
    return { col, semi: Math.abs(semi) || 3, dir };
  };

  const markerSlotFromGlobalCol = (globalCol: number) => {
    const baseCol = globalCol - qShift;
    if (baseCol < 0 || baseCol >= totalCols) return null;
    const bar = Math.floor(baseCol / stepsPerBar);
    const stepInBar = Math.max(0, Math.min(stepsPerBar - 1, baseCol - bar * stepsPerBar));
    return { bar, stepInBar };
  };

  const upsertMarkerAt = (
    col: number,
    patch: Pick<NonNullable<BeatLabBassSynthVoiceParams['glideShiftMarkers']>[number], 'semi' | 'dir'>,
  ) => {
    const slot = markerSlotFromGlobalCol(col);
    if (!slot) return;
    const next = [...markers];
    const i = next.findIndex((m) => m.bar === slot.bar && m.stepInBar === slot.stepInBar);
    if (i >= 0) {
      next[i] = {
        ...next[i],
        semi: patch.semi,
        dir: patch.dir,
        lenSteps: Math.max(1, qCols),
      };
    } else {
      next.push({
        bar: slot.bar,
        stepInBar: slot.stepInBar,
        lenSteps: Math.max(1, qCols),
        semi: patch.semi,
        dir: patch.dir,
      });
    }
    onPatch({ glideShiftMarkers: beatLabNormalizeGlideMarkers(next, layoutBars, stepsPerBar) });
  };

  const removeMarkerAt = (col: number) => {
    const slot = markerSlotFromGlobalCol(col);
    if (!slot) return;
    const next = [...markers];
    const i = next.findIndex((m) => m.bar === slot.bar && m.stepInBar === slot.stepInBar);
    if (i < 0) return;
    next.splice(i, 1);
    onPatch({ glideShiftMarkers: beatLabNormalizeGlideMarkers(next, layoutBars, stepsPerBar) });
  };

  const markerByCol = new Map<number, { semi: number; dir: 'up' | 'down' | 'roundtrip' }>();
  for (const m of markers) {
    const col0 = beatLabGlideMarkerStartCol(m, stepsPerBar, qShift);
    if (col0 < 0 || col0 >= totalCols) continue;
    markerByCol.set(col0, {
      semi: Math.max(1, Math.min(12, Math.abs(m.semi) || 3)),
      dir: m.dir === 'down' || m.dir === 'up' ? m.dir : 'roundtrip',
    });
  }

  const controlCols = Array.from({ length: Math.floor(totalCols / qCols) + 1 }, (_, i) => i * qCols).filter(
    (c) => c >= 0 && c < totalCols,
  );
  const linePts = controlCols.map((c) => {
    const mk = markerByCol.get(c);
    if (!mk) return `${colToX(c)},${yMid}`;
    const signed = mk.dir === 'down' ? -mk.semi : mk.semi;
    return `${colToX(c)},${semiToY(signed)}`;
  });
  const [activeCol, setActiveCol] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const activeColRef = useRef<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);

  const currentColRef = activeColRef.current ?? hoverCol;
  const laneCursor: React.CSSProperties['cursor'] =
    activeColRef.current != null ? 'ns-resize' : currentColRef != null ? 'pointer' : 'default';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', maxWidth: '100%', cursor: laneCursor }}
      onPointerDown={(e) => {
        const snap = pointerToSnap(e.currentTarget, e.clientX, e.clientY);
        if (!snap) return;
        if (e.altKey || e.button === 2) {
          removeMarkerAt(snap.col);
          setHoverCol(snap.col);
          return;
        }
        upsertMarkerAt(snap.col, { semi: snap.semi, dir: snap.dir });
        activeColRef.current = snap.col;
        dragPointerIdRef.current = e.pointerId;
        setActiveCol(snap.col);
        setHoverCol(snap.col);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const snap = pointerToSnap(e.currentTarget, e.clientX, e.clientY);
        if (!snap) {
          if (activeColRef.current == null) setHoverCol(null);
          return;
        }
        if (activeColRef.current != null && (e.buttons & 1) === 1) {
          upsertMarkerAt(activeColRef.current, { semi: snap.semi, dir: snap.dir });
          return;
        }
        setHoverCol(snap.col);
      }}
      onPointerUp={(e) => {
        if (dragPointerIdRef.current != null) {
          e.currentTarget.releasePointerCapture?.(dragPointerIdRef.current);
        }
        activeColRef.current = null;
        dragPointerIdRef.current = null;
        setActiveCol(null);
      }}
      onPointerLeave={() => {
        if (activeColRef.current == null) setHoverCol(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {Array.from({ length: layoutBars + 1 }, (_, i) => {
        const x = colToX(i * stepsPerBar);
        return <line key={`b-${i}`} x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#2a3140" strokeWidth={1} />;
      })}
      {Array.from({ length: Math.floor(totalCols / qCols) + 1 }, (_, i) => {
        const x = colToX(i * qCols);
        return <line key={`q-${i}`} x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#1b2230" strokeWidth={0.7} />;
      })}
      <line x1={PAD_L} y1={yMid} x2={W - PAD_R} y2={yMid} stroke="#72608a" strokeWidth={1} strokeDasharray="3 4" />
      <polyline
        points={linePts.join(' ')}
        stroke="#d6a7ff"
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {currentColRef != null ? (
        <line
          x1={colToX(currentColRef)}
          y1={PAD_T}
          x2={colToX(currentColRef)}
          y2={H - PAD_B}
          stroke={activeCol != null ? '#ffe38a' : '#7cc9ff'}
          strokeWidth={1.6}
          strokeDasharray="2 3"
        />
      ) : null}
      {markers.map((m, i) => {
        const col0 = beatLabGlideMarkerStartCol(m, stepsPerBar, qShift);
        const col1 = col0 + Math.max(1, m.lenSteps);
        const x0 = colToX(col0);
        const x1 = colToX(col1);
        const signedSemi = m.dir === 'down' ? -Math.abs(m.semi) : Math.abs(m.semi);
        const yPeak = semiToY(signedSemi);
        if (m.dir === 'roundtrip') {
          const xm = (x0 + x1) / 2;
          return (
            <path
              key={`m-${i}`}
              d={`M ${x0} ${yMid} L ${xm} ${yPeak} L ${x1} ${yMid}`}
              stroke="#ffb2d8"
              strokeWidth={2}
              fill="none"
            />
          );
        }
        return <line key={`m-${i}`} x1={x0} y1={yMid} x2={x1} y2={yPeak} stroke="#ffb2d8" strokeWidth={2} />;
      })}
    </svg>
  );
}

function oscWavePath(type: BeatLabBassSynthVoiceParams['osc1Wave']): string {
  if (type === 'sine') return 'M0,40 C15,8 35,8 50,40 C65,72 85,72 100,40 C115,8 135,8 150,40 C165,72 185,72 200,40';
  if (type === 'triangle') return 'M0,40 L25,8 L75,72 L125,8 L175,72 L200,40';
  if (type === 'square') return 'M0,72 L0,12 L45,12 L45,72 L95,72 L95,12 L145,12 L145,72 L200,72';
  return 'M0,65 L30,20 L60,65 L90,20 L120,65 L150,20 L180,65 L200,45';
}

function envelopePath(voice: BeatLabBassSynthVoiceParams): string {
  const atk = Math.max(1, Math.min(40, Math.round((voice.ampAttackMs / 1000) * 40)));
  const dec = Math.max(8, Math.min(50, Math.round((voice.ampDecayMs / 2000) * 50)));
  const rel = Math.max(8, Math.min(60, Math.round((voice.ampReleaseMs / 3000) * 60)));
  const susY = 72 - Math.max(0, Math.min(1, voice.ampSustain)) * 56;
  const x1 = 14 + atk;
  const x2 = x1 + dec;
  const x3 = 160;
  const x4 = Math.min(200, x3 + rel);
  return `M8,72 L${x1},12 L${x2},${susY} L${x3},${susY} L${x4},72`;
}

function glideCurvePath(voice: BeatLabBassSynthVoiceParams, bpm: number): string {
  const sec = beatLabSynthV2GlideSeconds(voice, bpm);
  const t = Math.max(0.01, Math.min(1, sec / 0.6));
  const sx = 18;
  const ex = 186;
  const y0 = 62;
  const y1 = 18;
  const cx1 = sx + (ex - sx) * Math.max(0.08, t * 0.25);
  const cx2 = sx + (ex - sx) * Math.max(0.2, t * 0.92);
  return `M ${sx} ${y0} C ${cx1} ${y0} ${cx2} ${y1} ${ex} ${y1}`;
}

function filterPath(voice: BeatLabBassSynthVoiceParams): string {
  const n = Math.max(
    0,
    Math.min(
      1,
      (Math.log10(Math.max(40, voice.filterCutoffHz)) - Math.log10(40)) /
        (Math.log10(8000) - Math.log10(40)),
    ),
  );
  const q = Math.max(0, Math.min(1, voice.filterResonanceQ / 12));
  const x = 20 + n * 150;
  const peak = 64 - q * 40;
  if (voice.filterType === 'highpass')
    return `M0,72 L${x - 30},72 C${x - 10},72 ${x - 8},${peak} ${x + 8},${peak} C${x + 24},${peak} 180,12 200,12`;
  if (voice.filterType === 'bandpass')
    return `M0,72 L${x - 38},72 C${x - 14},72 ${x - 6},${peak} ${x + 6},${peak} C${x + 14},${peak} ${x + 22},72 ${x + 52},72`;
  return `M0,12 L${x - 30},12 C${x - 12},12 ${x - 8},${peak} ${x + 10},${peak} C${x + 26},${peak} 176,72 200,72`;
}

function distortionCurvePath(drive: number): string {
  const k = 0.5 + drive * 10;
  const pts: string[] = [];
  for (let i = 0; i <= 40; i += 1) {
    const xin = (i / 40) * 2 - 1;
    const y = Math.tanh(xin * k);
    const px = 10 + (i / 40) * 180;
    const py = 40 - y * 32;
    pts.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
  }
  return pts.join(' ');
}

function eqResponsePath(lowDb: number, midDb: number, highDb: number): string {
  const l = lowDb / 12;
  const m = midDb / 12;
  const h = highDb / 12;
  return `M0,${40 - l * 28} Q50,${28 - m * 22} 100,${40 - m * 18} T200,${40 - h * 30}`;
}

function chorusGraphPath(mix: number, rate: number, spread: number): string {
  const wobble = rate * 18;
  const sep = 8 + spread * 24;
  const y0 = 40;
  return `M0,${y0} Q30,${y0 - wobble} 60,${y0 + mix * 12} T120,${y0 - mix * 8} Q150,${y0 + wobble * 0.6} 180,${y0 - sep * mix} T200,${y0}`;
}

function delayTapsPath(timeMs: number, feedback: number): string {
  const spacing = Math.max(8, Math.min(70, timeMs / 25));
  let d = `M4,50 L30,50`;
  let x = 30;
  for (let i = 0; i < 5; i += 1) {
    const h = 50 - (i + 1) * 8 * feedback;
    x += spacing;
    d += ` L${x - 4},50 L${x - 4},${h} L${x + 2},${h} L${x + 2},50`;
  }
  return d;
}

function compressorCurve(comp: number): string {
  const knee = 0.2 + comp * 0.55;
  const ratio = 1 + comp * 5;
  const pts: string[] = [];
  for (let i = 0; i <= 32; i += 1) {
    const xi = i / 32;
    const xin = xi * 1.8 - 0.4;
    const y =
      xin < knee ? xin * 34 + 46 : knee * 34 + 46 + (xin - knee) * (34 / ratio);
    const px = 8 + xi * 184;
    const py = Math.max(4, Math.min(76, y));
    pts.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
  }
  return pts.join(' ');
}

function reverbDiffusePath(decay: number, mix: number): string {
  const d = [];
  let y = 50;
  for (let x = 0; x <= 200; x += 4) {
    const jitter = Math.sin(x * 0.13 + decay * 5) * (6 + decay * 18) * mix;
    const py = Math.max(6, Math.min(74, y + jitter));
    d.push(`${x === 0 ? 'M' : 'L'} ${x} ${py}`);
  }
  return d.join(' ');
}

function phaserNotches(depth: number, rate: number): string {
  const parts: string[] = [];
  const n = 5;
  for (let k = 0; k < n; k += 1) {
    const cx = 20 + k * 36 + Math.sin(rate * 4 + k) * 4;
    const w = 4 + depth * 10;
    const dip = 50 + depth * 22;
    parts.push(`M${cx - w},50 Q${cx},${dip} ${cx + w},50`);
  }
  return parts.join(' ');
}

function flangerComb(feedback: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i += 1) {
    const x = (i / 60) * 200;
    const comb = Math.sin(i * 0.35) * (8 + feedback * 22) + Math.sin(i * 0.11) * 4;
    const py = 40 + comb;
    pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${py}`);
  }
  return pts.join(' ');
}

function knobRow(children: React.ReactNode) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
      }}
    >
      {children}
    </div>
  );
}

export function BeatLabSynthV2Panel({
  bassLane,
  harmonyLane,
  presetId,
  voice,
  onPresetChange,
  onLoadPresetToVoice,
  onPatchVoice,
  onPreview,
  onPreviewMidi,
  onSustainMidi,
  onReleaseMidi,
  playingMidis,
  bpm = 120,
  quantSubdiv = 4,
  chordRail = null,
  laneNotes = [],
  patternCols = 64,
  beatsPerBar = 4,
  colsPerBar = 4,
  isActive = true,
  onAuditionStart,
  onAuditionStop,
  onAuditionTouch,
  onApplyBassLaneNotes,
  onApplyHarmonyLaneNotes,
  scrollContained = false,
}: Props) {
  const lane = bassLane;
  const [auditionOn, setAuditionOn] = useState(false);
  const [moduleOpen, setModuleOpen] = useState<ModuleOpenState>(DEFAULT_MODULE_OPEN);
  const wasActiveRef = useRef(isActive);

  useEffect(() => {
    setAuditionOn(false);
    onAuditionStop?.();
  }, [bassLane, onAuditionStop]);
  useEffect(() => {
    setModuleOpen(DEFAULT_MODULE_OPEN);
  }, [bassLane]);
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      setModuleOpen(DEFAULT_MODULE_OPEN);
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  const applyVoice = useCallback(
    (next: Partial<BeatLabBassSynthVoiceParams>) => {
      onPatchVoice(next);
      if (auditionOn) onAuditionTouch?.();
    },
    [auditionOn, onAuditionTouch, onPatchVoice],
  );

  const toggleAudition = useCallback(() => {
    setAuditionOn((on) => {
      const next = !on;
      if (next) onAuditionStart?.();
      else onAuditionStop?.();
      return next;
    });
  }, [onAuditionStart, onAuditionStop]);

  // One octave span below lane default — keeps preview keys anchored in bass after lower lane roots.
  const previewRoot = beatLabMelodicSynthV2AuditionPitch(lane) - 12;
  const glideDiv = (voice.glideDivision ?? '1/16') as BeatLabSynthGlideDivision;
  const glideEffectiveMs = Math.round(beatLabSynthV2GlideSeconds(voice, bpm) * 1000);
  const quantGlideDiv = beatLabSynthV2GlideDivisionFromQuantSubdiv(quantSubdiv);
  const hasChordRail = chordRail != null && chordRail.timeline.some((s) => s.chord != null);
  const layoutBars: 4 | 8 = voice.glideLayoutBars === 4 ? 4 : 8;
  const stepsPerBar = Math.max(1, Math.round(quantSubdiv * beatsPerBar));
  const qCols = beatLabSynthV2GlideDivisionToCols(voice.glideDivision ?? '1/16', quantSubdiv);
  const matchQuantGlide = useCallback(() => {
    applyVoice({ glideSync: true, glideDivision: quantGlideDiv });
  }, [applyVoice, quantGlideDiv]);
  const toggleModule = useCallback((k: keyof ModuleOpenState) => {
    setModuleOpen((m) => ({ ...m, [k]: !m[k] }));
  }, []);
  const openAllModules = useCallback(() => {
    setModuleOpen({
      osc: true,
      filter: true,
      amp: true,
      glide: true,
      dist: true,
      eq: true,
      comp: true,
      chorus: true,
      delay: true,
      phaser: true,
      flanger: true,
      reverb: true,
    });
  }, []);
  const glideOnlyModules = useCallback(() => {
    setModuleOpen(DEFAULT_MODULE_OPEN);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: scrollContained ? '0 0 auto' : '1 1 auto',
        minHeight: scrollContained ? undefined : 0,
        overflow: scrollContained ? 'visible' : 'auto',
        padding: scrollContained ? 6 : 10,
        gap: scrollContained ? 8 : 10,
        background: 'linear-gradient(180deg, #06080f 0%, #050507 100%)',
        borderTop: '1px solid rgba(124, 244, 198, 0.16)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#7cf4c6', letterSpacing: 0.8 }}>
          NEW SYNTH (V2)
        </span>
        <span style={{ fontSize: 9, color: '#8ca0b6', fontWeight: 700 }}>
          Bass CH {lane + 1} · piano roll CH {harmonyLane + 1} · Web Audio + graphs
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: 10,
          borderRadius: 8,
          border: '1px solid rgba(124, 244, 198, 0.22)',
          background: 'rgba(124, 244, 198, 0.06)',
        }}
      >
        <span style={{ fontSize: 9, color: '#9ccab4', fontWeight: 800 }}>Bass preset</span>
        <select
          value={presetId}
          onChange={(e) => onPresetChange(e.target.value)}
          style={{
            minWidth: 210,
            fontSize: 10,
            fontWeight: 700,
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid #2a2a34',
            background: '#101014',
            color: '#e8e8f0',
          }}
        >
          {BEAT_LAB_BASS_SYNTH_PRESETS.map((p: BeatLabBassSynthPreset) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.category})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onLoadPresetToVoice(presetId)}
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#7cf4c6',
            background: 'rgba(124, 244, 198, 0.12)',
            border: '1px solid rgba(124, 244, 198, 0.35)',
            borderRadius: 6,
            padding: '5px 10px',
            cursor: 'pointer',
          }}
        >
          Load preset to controls
        </button>
        {onPreview ? (
          <button
            type="button"
            onClick={onPreview}
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: '#58c4ff',
              background: 'rgba(88, 196, 255, 0.12)',
              border: '1px solid rgba(88, 196, 255, 0.4)',
              borderRadius: 6,
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            Preview note
          </button>
        ) : null}
        {onAuditionStart ? (
          <button
            type="button"
            onClick={toggleAudition}
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: auditionOn ? '#0a0c10' : '#c59cff',
              background: auditionOn ? '#c59cff' : 'rgba(197, 156, 255, 0.12)',
              border: `1px solid ${auditionOn ? '#c59cff' : 'rgba(197, 156, 255, 0.4)'}`,
              borderRadius: 6,
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            {auditionOn ? 'Audition on' : 'Audition'}
          </button>
        ) : null}
      </div>

      {onPreviewMidi || onSustainMidi ? (
        <BeatLabSynthV2MiniKeys
          rootMidi={previewRoot}
          onPlayMidi={(midi) => {
            if (auditionOn && onPreviewMidi) {
              onPreviewMidi(midi);
              return;
            }
            onSustainMidi?.(midi);
          }}
          onReleaseMidi={auditionOn ? undefined : onReleaseMidi}
          playingMidis={playingMidis}
        />
      ) : null}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 8, color: '#78879b', fontWeight: 700 }}>Modules</span>
        <button
          type="button"
          onClick={openAllModules}
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: '#d0deef',
            background: '#12161e',
            border: '1px solid #2f3c50',
            borderRadius: 4,
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          Open all filters
        </button>
        <button
          type="button"
          onClick={glideOnlyModules}
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: '#e5d3ff',
            background: 'rgba(184,140,255,0.14)',
            border: '1px solid rgba(184,140,255,0.45)',
            borderRadius: 4,
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          Glide only
        </button>
      </div>

      <div style={{ width: '100%' }}>
        {moduleShell('GLIDE FX', '#b88cff', (
          <>
            <BeatLabSynthV2GlideTimeline
              lane={bassLane}
              notes={laneNotes}
              voice={voice}
              patternCols={patternCols}
              subdiv={quantSubdiv}
              bpm={bpm}
              beatsPerBar={beatsPerBar}
              colsPerBar={colsPerBar}
              chordRail={chordRail}
              onBarMaskChange={(mask) => applyVoice({ glideBarMask: mask })}
              onSlideBarMaskChange={(mask) => applyVoice({ slideBarMask: mask })}
              onGlideVoicePatch={applyVoice}
            />
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                marginTop: 6,
                marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 900, color: '#d9c0ff', letterSpacing: 0.5 }}>
                GLIDE FX (Channel)
              </span>
              <span style={{ fontSize: 8, color: '#a8b4c8', fontWeight: 700 }}>
                {glideEffectiveMs} ms @ {Math.round(bpm)} BPM
              </span>
              <span style={{ fontSize: 8, color: '#ffb7c9', fontWeight: 700 }}>
                Slide: {voice.slideMotionEnabled ? 'On' : 'Off'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => applyVoice({ slideMotionEnabled: !(voice.slideMotionEnabled === true) })}
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: `1px solid ${voice.slideMotionEnabled ? '#ff8aa8' : '#303848'}`,
                    background: voice.slideMotionEnabled ? 'rgba(255,138,168,0.2)' : '#12161e',
                    color: voice.slideMotionEnabled ? '#ffd7e3' : '#8899aa',
                    cursor: 'pointer',
                  }}
                >
                  Slide motion
                </button>
                {(['tail', 'head', 'both'] as const).map((at) => (
                  <button
                    key={`slide-at-${at}`}
                    type="button"
                    onClick={() => applyVoice({ slideMotionAt: at, slideMotionEnabled: true })}
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '3px 7px',
                      borderRadius: 4,
                      border: `1px solid ${voice.slideMotionAt === at ? '#ff8aa8' : '#303848'}`,
                      background: voice.slideMotionAt === at ? 'rgba(255,138,168,0.2)' : '#12161e',
                      color: voice.slideMotionAt === at ? '#ffd7e3' : '#8899aa',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      opacity: voice.slideMotionEnabled ? 1 : 0.65,
                    }}
                  >
                    {at}
                  </button>
                ))}
                {(['up', 'down'] as const).map((dir) => (
                  <button
                    key={`slide-dir-${dir}`}
                    type="button"
                    onClick={() => applyVoice({ slideMotionDir: dir, slideMotionEnabled: true })}
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '3px 7px',
                      borderRadius: 4,
                      border: `1px solid ${voice.slideMotionDir === dir ? '#ff8aa8' : '#303848'}`,
                      background: voice.slideMotionDir === dir ? 'rgba(255,138,168,0.2)' : '#12161e',
                      color: voice.slideMotionDir === dir ? '#ffd7e3' : '#8899aa',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      opacity: voice.slideMotionEnabled ? 1 : 0.65,
                    }}
                  >
                    {dir}
                  </button>
                ))}
              </div>
              {hasChordRail && voice.glideMode === 'chord' ? (
                <span style={{ fontSize: 8, color: '#b8d4ff', fontWeight: 700 }}>
                  Chord glide · bar roots follow progression
                </span>
              ) : null}
              <div style={{ marginLeft: 'auto' }}>
                <BeatLabSynthV2GlideActivityMeter lane={lane} />
              </div>
            </div>
            {onApplyBassLaneNotes && onApplyHarmonyLaneNotes ? (
              <BeatLabSynthV2BassGenerator
                bassLane={bassLane}
                harmonyLane={harmonyLane}
                patternCols={patternCols}
                voice={voice}
                subdiv={quantSubdiv}
                beatsPerBar={beatsPerBar}
                colsPerBar={colsPerBar}
                chordRail={chordRail}
                laneNotes={laneNotes}
                onPatch={applyVoice}
                onApplyBassLaneNotes={onApplyBassLaneNotes}
                onApplyHarmonyLaneNotes={onApplyHarmonyLaneNotes}
              />
            ) : null}
            <div style={{ marginBottom: 6 }}>
              <BeatLabSynthV2GlidePresetPicker
                layoutBars={layoutBars}
                stepsPerBar={stepsPerBar}
                subdiv={quantSubdiv}
                hasChordRail={hasChordRail}
                fallbackGlideDivision={voice.glideDivision}
                onApply={applyVoice}
              />
            </div>
            <div style={{ fontSize: 8, color: '#9aa6bc', fontWeight: 700, marginBottom: 3 }}>
              SHIFT DRAW LANE · click grid to draw glide shifts · snap {voice.glideDivision ?? '1/16'}
            </div>
            {graphBox(
              <GlideDrawLaneBox
                voice={voice}
                subdiv={quantSubdiv}
                beatsPerBar={beatsPerBar}
                onPatch={applyVoice}
              />,
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6, alignItems: 'center' }}>
              <SynthRoundKnob size={KNOB_SIZE}
                key="glide-ms"
                label="TIME"
                accent="#cfb3ff"
                value={voice.glideMs}
                min={0}
                max={500}
                decimals={0}
                unit="ms"
                onChange={(v) => applyVoice({ glideMs: v })}
              />
              <SynthRoundKnob
                size={KNOB_SIZE}
                key="slide-semi"
                label="SLIDE SEMI"
                accent="#ff9cbc"
                value={voice.slideMotionSemi ?? 2}
                min={1}
                max={12}
                decimals={0}
                onChange={(v) => applyVoice({ slideMotionSemi: Math.round(v), slideMotionEnabled: true })}
              />
              <SynthRoundKnob
                size={KNOB_SIZE}
                key="slide-len"
                label="SLIDE LEN"
                accent="#ff9cbc"
                value={Math.round((voice.slideMotionFrac ?? 0.2) * 100)}
                min={8}
                max={80}
                decimals={0}
                unit="%"
                onChange={(v) =>
                  applyVoice({ slideMotionFrac: Math.max(0.08, Math.min(0.8, v / 100)), slideMotionEnabled: true })
                }
              />
              <SynthRoundKnob
                size={KNOB_SIZE}
                key="slide-speed"
                label="SLIDE SPEED"
                accent="#ff9cbc"
                value={voice.slideMotionRateMs ?? 85}
                min={10}
                max={400}
                decimals={0}
                unit="ms"
                onChange={(v) => applyVoice({ slideMotionRateMs: Math.round(v), slideMotionEnabled: true })}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, color: '#8899aa', fontWeight: 700 }}>Shape</span>
                {(['smooth', 'stutter', 'shift'] as const).map((s) => (
                  <button
                    key={`shape-${s}`}
                    type="button"
                    title={s === 'shift' ? 'Smooth glide + quantized bends drawn in Glide Layout' : undefined}
                    onClick={() => {
                      if (s === 'shift') {
                        const hasMarkers = (voice.glideShiftMarkers?.length ?? 0) > 0;
                        applyVoice({
                          glideStyle: 'shift',
                          glideMode: voice.glideMode === 'off' ? 'mono' : voice.glideMode,
                          glideSync: true,
                          glideShiftMarkers: hasMarkers
                            ? voice.glideShiftMarkers
                            : beatLabSynthV2StarterShiftMarkers(layoutBars, stepsPerBar, qCols),
                        });
                        return;
                      }
                      applyVoice({
                        glideStyle: s,
                        glideMode: voice.glideMode === 'off' ? 'mono' : voice.glideMode,
                        glideSync: s === 'stutter' ? true : voice.glideSync,
                      });
                    }}
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: `1px solid ${(voice.glideStyle ?? 'smooth') === s ? '#c59cff' : '#303848'}`,
                      background:
                        (voice.glideStyle ?? 'smooth') === s ? 'rgba(197, 156, 255, 0.2)' : '#12161e',
                      color: (voice.glideStyle ?? 'smooth') === s ? '#e8d8ff' : '#8899aa',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => applyVoice({ glideIntraNote: !(voice.glideIntraNote === true) })}
                  disabled={voice.glideSync !== true || (voice.glideStyle ?? 'smooth') !== 'stutter'}
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: `1px solid ${voice.glideIntraNote === true ? '#7ce8b8' : '#303848'}`,
                    background: voice.glideIntraNote === true ? 'rgba(124, 232, 184, 0.18)' : '#12161e',
                    color: voice.glideIntraNote === true ? '#c8ffe8' : '#8899aa',
                    cursor:
                      voice.glideSync === true && (voice.glideStyle ?? 'smooth') === 'stutter'
                        ? 'pointer'
                        : 'not-allowed',
                    opacity:
                      voice.glideSync === true && (voice.glideStyle ?? 'smooth') === 'stutter'
                        ? 1
                        : 0.45,
                  }}
                >
                  Intra stutter
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, color: '#8899aa', fontWeight: 700 }}>Mode</span>
                {(['off', 'mono', 'legato', 'chord'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => applyVoice({ glideMode: m })}
                    disabled={m === 'chord' && !hasChordRail}
                    title={
                      m === 'chord'
                        ? hasChordRail
                          ? 'Glide from previous bar chord root on first note of each bar'
                          : 'Needs Chord Builder import'
                        : undefined
                    }
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: `1px solid ${voice.glideMode === m ? '#c59cff' : '#303848'}`,
                      background: voice.glideMode === m ? 'rgba(197, 156, 255, 0.2)' : '#12161e',
                      color: voice.glideMode === m ? '#e8d8ff' : '#8899aa',
                      cursor: m === 'chord' && !hasChordRail ? 'not-allowed' : 'pointer',
                      textTransform: 'capitalize',
                      opacity: m === 'chord' && !hasChordRail ? 0.45 : 1,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 8, color: '#8899aa', fontWeight: 700 }}>Sync</span>
                {([false, true] as const).map((syncOn) => (
                  <button
                    key={syncOn ? 'sync-on' : 'sync-off'}
                    type="button"
                    onClick={() => applyVoice({ glideSync: syncOn })}
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: `1px solid ${voice.glideSync === syncOn ? '#7cc9ff' : '#303848'}`,
                      background: voice.glideSync === syncOn ? 'rgba(88, 196, 255, 0.22)' : '#12161e',
                      color: voice.glideSync === syncOn ? '#d7f0ff' : '#8899aa',
                      cursor: 'pointer',
                    }}
                  >
                    {syncOn ? 'On' : 'Off'}
                  </button>
                ))}
                {(['1/32', '1/16', '1/8', '1/4'] as const).map((div) => (
                  <button
                    key={div}
                    type="button"
                    onClick={() => applyVoice({ glideDivision: div })}
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '3px 7px',
                      borderRadius: 4,
                      border: `1px solid ${glideDiv === div ? '#58c4ff' : '#303848'}`,
                      background: glideDiv === div ? 'rgba(88, 196, 255, 0.2)' : '#12161e',
                      color: glideDiv === div ? '#d9f4ff' : '#8899aa',
                      cursor: 'pointer',
                      opacity: voice.glideSync === true ? 1 : 0.45,
                    }}
                    disabled={voice.glideSync !== true}
                    title="Tempo-synced glide length (rhythmic slide expression)"
                  >
                    {div}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={matchQuantGlide}
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(120, 220, 160, 0.5)',
                    background: 'rgba(120, 220, 160, 0.12)',
                    color: '#b8f0d0',
                    cursor: 'pointer',
                  }}
                  title={`Use grid quant 1/${quantSubdiv * 4} as glide division (${quantGlideDiv})`}
                >
                  Match quant ({quantGlideDiv})
                </button>
              </div>
              <span style={{ fontSize: 8, color: '#8b96aa', fontWeight: 700 }}>
                Effective: {glideEffectiveMs} ms · BPM {Math.round(bpm)} · Grid 1/{Math.max(1, quantSubdiv * 4)}
                {hasChordRail ? ' · Chord rail active' : ''}
              </span>
            </div>
          </>
        ), { open: moduleOpen.glide, onToggle: () => toggleModule('glide') })}
      </div>

      <div style={GRID_FX}>
        {moduleShell('OSCILLATORS', '#58c4ff', (
          <>
            <BeatLabSynthV2Oscilloscope
              osc1Wave={voice.osc1Wave}
              osc2Wave={voice.osc2Wave}
              level1={voice.osc1Level}
              level2={voice.osc2Level}
              height={56}
              width={280}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'center' }}>
              <label style={{ fontSize: 8, color: '#8899aa' }}>
                OSC1 wav
                <select
                  value={voice.osc1Wave}
                  onChange={(e) =>
                    applyVoice({
                      osc1Wave: e.target.value as BeatLabBassSynthVoiceParams['osc1Wave'],
                    })
                  }
                  style={{
                    display: 'block',
                    marginTop: 4,
                    fontSize: 9,
                    padding: '2px 4px',
                    borderRadius: 4,
                    background: '#12161e',
                    color: '#e0e8f8',
                    border: '1px solid #303848',
                  }}
                >
                  {(['sine', 'triangle', 'square', 'saw'] as const).map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 8, color: '#8899aa' }}>
                OSC2 wav
                <select
                  value={voice.osc2Wave}
                  onChange={(e) =>
                    applyVoice({
                      osc2Wave: e.target.value as BeatLabBassSynthVoiceParams['osc2Wave'],
                    })
                  }
                  style={{
                    display: 'block',
                    marginTop: 4,
                    fontSize: 9,
                    padding: '2px 4px',
                    borderRadius: 4,
                    background: '#12161e',
                    color: '#e0e8f8',
                    border: '1px solid #303848',
                  }}
                >
                  {(['sine', 'triangle', 'square', 'saw'] as const).map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {graphBox(
              <FxGraphSvg>
                <path d={oscWavePath(voice.osc1Wave)} stroke="#58c4ff88" strokeWidth="1.2" fill="none" opacity={0.5} />
                <path d={oscWavePath(voice.osc2Wave)} stroke="#ff66d988" strokeWidth="1.2" fill="none" opacity={0.5} />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="o1"
                label="OSC1"
                accent="#58c4ff"
                value={voice.osc1Level}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ osc1Level: v })}
                defaultValue={0.8}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="o2"
                label="OSC2"
                accent="#ff66d9"
                value={voice.osc2Level}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ osc2Level: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="sub"
                label="SUB"
                accent="#88ffc8"
                value={voice.subLevel}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ subLevel: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="nz"
                label="NOISE"
                accent="#a8b8c8"
                value={voice.noiseLevel}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ noiseLevel: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="uni"
                label="UNISON"
                accent="#7aa0ff"
                value={voice.unisonVoices}
                min={1}
                max={8}
                decimals={0}
                onChange={(v) => applyVoice({ unisonVoices: Math.round(v) })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="det"
                label="DETUNE ¢"
                accent="#9ab0e0"
                value={voice.unisonDetuneCents}
                min={0}
                max={48}
                decimals={0}
                unit="¢"
                onChange={(v) => applyVoice({ unisonDetuneCents: Math.round(v) })}
              />,
            ])}
          </>
        ), { open: moduleOpen.osc, onToggle: () => toggleModule('osc') })}

        {moduleShell('FILTER', '#7cf4c6', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d={filterPath(voice)} stroke="#7cf4c6" strokeWidth="2.2" fill="none" />
              </FxGraphSvg>,
            )}
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 8, color: '#8a9e90', marginRight: 6 }}>Mode</span>
              {(['lowpass', 'bandpass', 'highpass'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => applyVoice({ filterType: m })}
                  style={{
                    marginRight: 4,
                    padding: '3px 8px',
                    fontSize: 8,
                    fontWeight: 700,
                    borderRadius: 4,
                    border: `1px solid ${voice.filterType === m ? '#7cf4c6' : '#2a3a34'}`,
                    background: voice.filterType === m ? 'rgba(124,244,198,0.15)' : '#12161a',
                    color: voice.filterType === m ? '#7cf4c6' : '#6a7880',
                    cursor: 'pointer',
                  }}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="cut"
                label="CUTOFF"
                accent="#7cf4c6"
                value={voice.filterCutoffHz}
                min={40}
                max={8000}
                decimals={0}
                unit="Hz"
                onChange={(v) => applyVoice({ filterCutoffHz: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="res"
                label="RES"
                accent="#5eeadb"
                value={voice.filterResonanceQ}
                min={0.1}
                max={12}
                decimals={1}
                onChange={(v) => applyVoice({ filterResonanceQ: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="drv"
                label="DRIVE"
                accent="#c4ffd8"
                value={voice.filterDrive}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ filterDrive: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.filter, onToggle: () => toggleModule('filter') })}

        {moduleShell('AMP ENVELOPE', '#c59cff', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d={envelopePath(voice)} stroke="#c59cff" strokeWidth="2.2" fill="none" />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob
                size={KNOB_SIZE}
                key="out"
                label="OUTPUT"
                accent="#7cf4c6"
                value={Math.round((voice.outputLevel ?? 0.45) * 100)}
                min={0}
                max={100}
                decimals={0}
                unit="%"
                title="Bass preset volume — independent of main master"
                onChange={(v) => applyVoice({ outputLevel: Math.max(0, Math.min(1, v / 100)) })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="a"
                label="ATK"
                accent="#c59cff"
                value={voice.ampAttackMs}
                min={0}
                max={1000}
                decimals={0}
                unit="ms"
                onChange={(v) => applyVoice({ ampAttackMs: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="d"
                label="DEC"
                accent="#b88cff"
                value={voice.ampDecayMs}
                min={0}
                max={2000}
                decimals={0}
                unit="ms"
                onChange={(v) => applyVoice({ ampDecayMs: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="s"
                label="SUS"
                accent="#d4b4ff"
                value={voice.ampSustain}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ ampSustain: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="r"
                label="REL"
                accent="#9a6cff"
                value={voice.ampReleaseMs}
                min={0}
                max={3000}
                decimals={0}
                unit="ms"
                onChange={(v) => applyVoice({ ampReleaseMs: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.amp, onToggle: () => toggleModule('amp') })}

        {moduleShell('DISTORTION', '#ff9a6c', (
          <>
            {graphBox(
              <FxGraphSvg>
                <line x1={10} y1={40} x2={190} y2={40} stroke="#3a3030" strokeWidth={1} />
                <line x1={100} y1={8} x2={100} y2={72} stroke="#3a3030" strokeWidth={1} />
                <path d={distortionCurvePath(voice.distortion)} stroke="#ff9a6c" strokeWidth="2.2" fill="none" />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="dst"
                label="DRIVE"
                accent="#ff9a6c"
                value={voice.distortion}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ distortion: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.dist, onToggle: () => toggleModule('dist') })}

        {moduleShell('EQUALIZER', '#6ce0ff', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d={eqResponsePath(voice.eqLowDb, voice.eqMidDb, voice.eqHighDb)} stroke="#6ce0ff" strokeWidth="2.2" fill="none" />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="lo"
                label="LOW"
                accent="#6ce0ff"
                value={voice.eqLowDb}
                min={-12}
                max={12}
                decimals={1}
                unit="dB"
                onChange={(v) => applyVoice({ eqLowDb: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="mid"
                label="MID"
                accent="#5cc8e8"
                value={voice.eqMidDb}
                min={-12}
                max={12}
                decimals={1}
                unit="dB"
                onChange={(v) => applyVoice({ eqMidDb: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="hi"
                label="HIGH"
                accent="#4ab0d0"
                value={voice.eqHighDb}
                min={-12}
                max={12}
                decimals={1}
                unit="dB"
                onChange={(v) => applyVoice({ eqHighDb: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.eq, onToggle: () => toggleModule('eq') })}

        {moduleShell('COMPRESSOR', '#ffd56c', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d="M8,8 L8,72 L192,72" stroke="#4a4030" strokeWidth="1" fill="none" />
                <path d={compressorCurve(voice.compressor)} stroke="#ffd56c" strokeWidth="2.2" fill="none" />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="cmp"
                label="AMOUNT"
                accent="#ffd56c"
                value={voice.compressor}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ compressor: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.comp, onToggle: () => toggleModule('comp') })}

        {moduleShell('CHORUS', '#8cf4a8', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d={chorusGraphPath(voice.chorusMix, voice.chorusRateHz, voice.chorusSpread)} stroke="#8cf4a8" strokeWidth="2" fill="none" />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="chm"
                label="MIX"
                accent="#8cf4a8"
                value={voice.chorusMix}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ chorusMix: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="chr"
                label="RATE"
                accent="#6ce090"
                value={voice.chorusRateHz}
                min={0.02}
                max={2}
                decimals={2}
                unit="Hz"
                onChange={(v) => applyVoice({ chorusRateHz: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="chs"
                label="SPREAD"
                accent="#a8f4c0"
                value={voice.chorusSpread}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ chorusSpread: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.chorus, onToggle: () => toggleModule('chorus') })}

        {moduleShell('DELAY', '#7ab0ff', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d={delayTapsPath(voice.delayTimeMs, voice.delayFeedback)} stroke="#7ab0ff" strokeWidth="2" fill="none" />
              </FxGraphSvg>,
            )}
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => applyVoice({ delaySync: !voice.delaySync })}
                style={{
                  padding: '4px 10px',
                  fontSize: 8,
                  fontWeight: 800,
                  borderRadius: 4,
                  border: `1px solid ${voice.delaySync ? '#7ab0ff' : '#2a3448'}`,
                  background: voice.delaySync ? 'rgba(122,176,255,0.15)' : '#12161a',
                  color: voice.delaySync ? '#7ab0ff' : '#6a7484',
                  cursor: 'pointer',
                }}
              >
                SYNC {voice.delaySync ? 'ON' : 'OFF'}
              </button>
            </div>
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="dmx"
                label="MIX"
                accent="#7ab0ff"
                value={voice.delayMix}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ delayMix: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="dfb"
                label="FB"
                accent="#5a98e8"
                value={voice.delayFeedback}
                min={0}
                max={0.95}
                decimals={2}
                onChange={(v) => applyVoice({ delayFeedback: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="dt"
                label="TIME"
                accent="#9ac4ff"
                value={voice.delayTimeMs}
                min={16}
                max={1200}
                decimals={0}
                unit="ms"
                onChange={(v) => applyVoice({ delayTimeMs: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.delay, onToggle: () => toggleModule('delay') })}

        {moduleShell('PHASER', '#c86cff', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d={phaserNotches(voice.phaserDepth, voice.phaserRateHz)} stroke="#c86cff" strokeWidth="2" fill="none" />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="pmx"
                label="MIX"
                accent="#c86cff"
                value={voice.phaserMix}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ phaserMix: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="pr"
                label="RATE"
                accent="#a84cff"
                value={voice.phaserRateHz}
                min={0.02}
                max={2}
                decimals={2}
                unit="Hz"
                onChange={(v) => applyVoice({ phaserRateHz: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="pd"
                label="DEPTH"
                accent="#e0a8ff"
                value={voice.phaserDepth}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ phaserDepth: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.phaser, onToggle: () => toggleModule('phaser') })}

        {moduleShell('FLANGER', '#ff6cb8', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d={flangerComb(voice.flangerFeedback)} stroke="#ff6cb8" strokeWidth="2" fill="none" />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="fmx"
                label="MIX"
                accent="#ff6cb8"
                value={voice.flangerMix}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ flangerMix: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="fr"
                label="RATE"
                accent="#ff4ca0"
                value={voice.flangerRateHz}
                min={0.02}
                max={2}
                decimals={2}
                unit="Hz"
                onChange={(v) => applyVoice({ flangerRateHz: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="ffb"
                label="FB"
                accent="#ff9cd0"
                value={voice.flangerFeedback}
                min={0}
                max={0.95}
                decimals={2}
                onChange={(v) => applyVoice({ flangerFeedback: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.flanger, onToggle: () => toggleModule('flanger') })}

        {moduleShell('REVERB', '#88b4ff', (
          <>
            {graphBox(
              <FxGraphSvg>
                <path d={reverbDiffusePath(voice.reverbDecay, voice.reverbMix)} stroke="#88b4ff" strokeWidth="1.6" fill="none" opacity={0.9} />
              </FxGraphSvg>,
            )}
            {knobRow([
              <SynthRoundKnob size={KNOB_SIZE}
                key="rmx"
                label="MIX"
                accent="#88b4ff"
                value={voice.reverbMix}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ reverbMix: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="rdec"
                label="DECAY"
                accent="#6898e8"
                value={voice.reverbDecay}
                min={0}
                max={1}
                decimals={2}
                onChange={(v) => applyVoice({ reverbDecay: v })}
              />,
              <SynthRoundKnob size={KNOB_SIZE}
                key="rpre"
                label="PRE"
                accent="#a8c8ff"
                value={voice.reverbPreDelayMs}
                min={0}
                max={120}
                decimals={0}
                unit="ms"
                onChange={(v) => applyVoice({ reverbPreDelayMs: v })}
              />,
            ])}
          </>
        ), { open: moduleOpen.reverb, onToggle: () => toggleModule('reverb') })}
      </div>

      <p style={{ fontSize: 9, color: '#5a6478', margin: 0, lineHeight: 1.45 }}>
        Layout inspired by Vital-style racks: dedicated graph per module + round knobs (drag vertically, double‑click resets).
        Effects order here is conceptual until the synth engine DSP chain matches.
      </p>
    </div>
  );
}
