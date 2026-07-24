'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { ChevronDown, ChevronUp, Mic, Play, Square } from 'lucide-react';

import { useVocalCapture, type UseVocalCaptureResult } from '@/app/hooks/useVocalCapture';
import type { BeatPadsDrumPattern, BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  beatPadsPatternCols,
  clampBeatPadsBpm,
  BEAT_PADS_MIN_BPM,
  BEAT_PADS_MAX_BPM,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  alignAndQuantizeVocalBoxHits,
  clampVocalBoxDrumIntensity,
  detectBeatboxVocalBoxHits,
  mergeVocalBoxHitsIntoPattern,
  trimAudioBufferFromSec,
  vocalBoxCaptureDurationSec,
  vocalBoxDefaultQuantize,
  vocalBoxHitsToLaneSteps,
  vocalBoxLeadingSilenceSec,
  vocalBoxStepSec,
  VOCALBOX_CAPTURE_BAR_OPTIONS,
  VOCALBOX_DEFAULT_CAPTURE_BARS,
  VOCALBOX_DEFAULT_ROLE_MASK,
  VOCALBOX_DRUM_INTENSITY_DEFAULT,
  VOCALBOX_QUANTIZE_OPTIONS,
  vocalBoxClampCaptureBars,
  vocalBoxTimingFeedback,
  type VocalBoxCaptureBars,
  type VocalBoxHit,
  type VocalBoxQuantize,
  type VocalBoxRoleMask,
} from '@/app/lib/creationStation/beatPadsVocalBoxAnalyze';
import {
  beatPadsVocalBoxPadMapFromLabels,
  VOCALBOX_DRUM_ROLES,
  type VocalBoxDrumRole,
} from '@/app/lib/creationStation/beatPadsVocalBoxPads';
import {
  createSe2PrecountRimshotBuffer,
  SE2_PRECOUNT_CLICK_VOLUME,
} from '@/app/lib/studio/se2Precount';
import { se2ClickGridTempo, waitSe2AudioTime } from '@/app/lib/creationStation/vocalBoxAudioGrid';
import {
  runVocalBoxClickCount,
} from '@/app/lib/creationStation/vocalBoxClickCount';
import type { BeatPadsVocalBoxHumMelodyApply } from '@/app/components/creation/BeatPadsVocalBoxHumMelodyPanel';
import { VocalBoxHumIntensitySlider } from '@/app/components/creation/VocalBoxHumIntensitySlider';
import '@/app/styles/beatPadsVocalBoxHumMelody.css';

export type { BeatPadsVocalBoxHumMelodyApply } from '@/app/components/creation/BeatPadsVocalBoxHumMelodyPanel';

const BeatPadsVocalBoxHumMelodyPanelLazy = lazy(() =>
  import('@/app/components/creation/BeatPadsVocalBoxHumMelodyPanel').then((m) => ({
    default: m.BeatPadsVocalBoxHumMelodyPanel,
  })),
);

/** Mic art for kit-bar tab + dropdown header. */
export const BEAT_PADS_VOCALBOX_MIC_SRC = '/images/beat-pads/vocalbox-mic.png';

/** Slight color pop for small UI slots — kept soft (not over-sharpened). */
export const BEAT_PADS_VOCALBOX_MIC_STYLE = {
  display: 'block',
  objectFit: 'cover' as const,
  objectPosition: 'center left',
  flexShrink: 0,
  filter: 'contrast(1.06) saturate(1.1) brightness(1.02)',
  imageRendering: 'auto' as const,
};

export const BEAT_PADS_VOCALBOX_TAGLINE = 'Hum / Melody Capture';
/** Full Beat Pads tab label — VocalBox — Hum / Melody Capture */
export const BEAT_PADS_VOCALBOX_TITLE = 'VocalBox — Hum / Melody Capture';

/** Compact dropdown height — drum lanes only (Hum Melody expands below). */
export const BEAT_PADS_VOCALBOX_PANEL_H_PX = 224;
/** Collapsed Hum Melody Capture toggle strip inside VocalBox. */
export const BEAT_PADS_VOCALBOX_HUM_TOGGLE_H_PX = 28;
/** Expanded compact Hum Melody Capture body (dropdown). */
export const BEAT_PADS_VOCALBOX_HUM_BODY_H_PX = 118;
/** Centered modal — drums + scope + 4/8-bar melody roll. */
export const BEAT_PADS_VOCALBOX_MODAL_MIN_H_PX = 0;
/** Hum Melody section grows with the piano roll (no tiny clip). */
export const BEAT_PADS_VOCALBOX_MODAL_HUM_BODY_H_PX = 420;
const HUM_MELODY_ACCENT = '#00E5FF';

/** Lead before preview playback starts — shared by the scheduler and the preview playhead. */
const VOCALBOX_PREVIEW_LEAD_MS = 200;
/** Lanes/playhead track sit inside this inset (kit button 38px + 6px gap · count 14px + 6px gap). */
const VOCALBOX_TRACK_INSET = { left: 44, right: 20 } as const;
/** Drum-grid lane sizing — taller than a meter so cells read as sequencer squares. */
const VOCALBOX_LANE_ROW_H = 34;
const VOCALBOX_LANE_TRACK_H = 28;
/** Beat 1–2–3–4 ruler above the drum lanes (aligned to BPM beat lines). */
const VOCALBOX_BEAT_RULER_H = 16;

const VOCALBOX_SOUND_HINT = {
  kick: 'boom',
  snare: 'ka',
} as const;

const VOCALBOX_TOOL_FONT: CSSProperties = {
  fontFamily: "'Rajdhani', 'Exo 2', system-ui, sans-serif",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  lineHeight: 1.2,
};
const VOCALBOX_TOOL_BTN =
  'rounded border px-2.5 py-1 font-bold uppercase disabled:opacity-35 min-w-[38px] text-center';
const VOCALBOX_TOOL_SELECT =
  'rounded border px-2 py-1 font-extrabold tabular-nums disabled:opacity-35';

function vocalBoxStatusCounts(
  hits: readonly VocalBoxHit[],
  bpm: number,
  quantize: VocalBoxQuantize,
  captureBars: VocalBoxCaptureBars,
): string {
  const counts = { kick: 0, snare: 0, hat: 0, clap: 0 };
  for (const h of hits) counts[h.role] += 1;
  return `${bpm} BPM · ${captureBars}bar · ${quantize} — ${counts.kick}K ${counts.snare}S ${counts.hat}H ${counts.clap}C`;
}

function vocalBoxPadRoutingHint(
  padMap: ReturnType<typeof beatPadsVocalBoxPadMapFromLabels>,
  padLabels: string[],
): string {
  const label = (i: number) => padLabels[i]?.trim() || `Pad ${i + 1}`;
  return `→ ${label(padMap.kick)} · ${label(padMap.snare)} · ${label(padMap.hat)} · ${label(padMap.clap)}`;
}

const ROLE_COLOR: Record<VocalBoxDrumRole, string> = {
  kick: '#ff6b6b',
  snare: '#ffa94d',
  hat: '#ffd43b',
  clap: '#69db7c',
};

const ROLE_LABEL: Record<VocalBoxDrumRole, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hat: 'Hat',
  clap: 'Clap',
};

function VocalBoxMouthSoundHint() {
  return (
    <div
      className="flex shrink-0 items-center gap-2 pl-[44px] pr-0.5"
      style={{ minHeight: 13, marginTop: -1, marginBottom: 1 }}
      aria-label="Mouth sounds — say boom for kick, ka for snare"
    >
      <span className="font-extrabold lowercase tracking-wide" style={{ ...VOCALBOX_TOOL_FONT, color: ROLE_COLOR.kick }}>
        {VOCALBOX_SOUND_HINT.kick}
      </span>
      <span style={{ ...VOCALBOX_TOOL_FONT, color: '#5a5a68' }}>kick</span>
      <span style={{ ...VOCALBOX_TOOL_FONT, color: '#3a3a44' }}>·</span>
      <span className="font-extrabold lowercase tracking-wide" style={{ ...VOCALBOX_TOOL_FONT, color: ROLE_COLOR.snare }}>
        {VOCALBOX_SOUND_HINT.snare}
      </span>
      <span style={{ ...VOCALBOX_TOOL_FONT, color: '#5a5a68' }}>snare</span>
    </div>
  );
}

export type BeatPadsVocalBoxPanelProps = {
  bpm: number;
  loopBars: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
  beatsPerBar?: number;
  pattern: BeatPadsDrumPattern;
  onPatternChange: (pattern: BeatPadsDrumPattern) => void;
  padLabelForPad?: (padIndex: number) => string | undefined;
  onStrikePad?: (padIndex: number, velocity01: number, gridCol?: number, whenSec?: number) => void;
  hasPadSample?: (padIndex: number) => boolean;
  getAudioContext?: () => AudioContext | null;
  /** SE2 master / track strip — count-in clicks. */
  getAudioOutput?: () => AudioNode | null;
  /** SE2 — wake shared AudioContext before mic + decode. */
  warmAudio?: () => void | Promise<void>;
  /** Load producer kit when kick/snare pads have no samples (SE2 VocalBox preview). */
  onEnsurePadSamples?: () => void | Promise<void>;
  /** Preview destination for Hum Melody Capture (SE2 track strip / master). */
  getHumMelodyPreviewDestination?: (ctx: AudioContext) => AudioNode;
  /** Apply Hum Melody → new/updated Hum Capture track (same BPM/bars as Beat Pads). */
  onApplyHumMelody?: (payload: BeatPadsVocalBoxHumMelodyApply) => void;
  /** Shared Beat Pads tempo — VocalBox + Hum Melody follow this. */
  onBpmChange?: (bpm: number) => void;
  songKeyRoot?: number;
  songKeyMode?: 'major' | 'minor';
  /** Centered modal over Beat Pads (default). Dropdown kept for legacy embeds. */
  variant?: 'modal' | 'dropdown';
  onClose?: () => void;
  disabled?: boolean;
};

async function resolveVocalBoxAudioContext(
  getAudioContext?: () => AudioContext | null,
  warmAudio?: () => void | Promise<void>,
): Promise<AudioContext | null> {
  try {
    await warmAudio?.();
  } catch {
    /* */
  }
  const ctx = getAudioContext?.() ?? null;
  if (!ctx || ctx.state === 'closed') return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* */
    }
  }
  return ctx;
}

async function decodeCaptureBlob(
  getAudioContext?: () => AudioContext | null,
  warmAudio?: () => void | Promise<void>,
  blob?: Blob | null,
): Promise<AudioBuffer | null> {
  if (!blob || blob.size < 64) return null;
  const ctx = await resolveVocalBoxAudioContext(getAudioContext, warmAudio);
  if (!ctx) return null;
  try {
    const ab = await blob.arrayBuffer();
    const copy = ab.slice(0);
    return await ctx.decodeAudioData(copy);
  } catch {
    return null;
  }
}

/** 1–2–3–4 above each beat line — lights with the BPM click; big digit follows. */
function VocalBoxBeatRuler({
  totalCols,
  stepsPerBeat,
  beatsPerBar,
  captureBars,
  rulerRef,
}: {
  totalCols: number;
  stepsPerBeat: number;
  beatsPerBar: number;
  captureBars: number;
  rulerRef: RefObject<HTMLDivElement | null>;
}) {
  const cols = Math.max(1, totalCols);
  const bpb = Math.max(1, Math.round(beatsPerBar));
  // One label per quarter-note beat across every bar: 1 2 3 4 · 1 2 3 4 …
  const beatCount = Math.max(1, Math.round(captureBars) * bpb);
  // Same width as each beat column on the drum lanes under this ruler.
  const beatW = (100 * Math.max(1, stepsPerBeat)) / cols;

  return (
    <div className="flex items-center gap-1.5" style={{ height: VOCALBOX_BEAT_RULER_H }} aria-hidden>
      <span style={{ width: 38, flexShrink: 0 }} />
      <div
        ref={rulerRef}
        className="vb-beat-ruler relative flex-1 min-w-0"
        style={{ height: VOCALBOX_BEAT_RULER_H }}
      >
        {Array.from({ length: beatCount }, (_, i) => {
          const n = (i % bpb) + 1;
          return (
            <span
              key={`vb-beat-${i}`}
              data-vb-grid-beat={i}
              className="vb-beat-ruler-num"
              style={{
                left: `${i * beatW}%`,
                width: `${beatW}%`,
              }}
            >
              {n}
            </span>
          );
        })}
      </div>
      <span style={{ width: 14, flexShrink: 0 }} />
    </div>
  );
}

function VocalBoxLaneRow({
  role,
  steps,
  totalCols,
  stepsPerBar,
  stepsPerBeat,
  liveLevel,
  isRecording,
  enabled,
  onToggleEnabled,
  editable,
  onToggleStep,
  onMoveStep,
  disabled,
}: {
  role: VocalBoxDrumRole;
  steps: readonly number[];
  totalCols: number;
  stepsPerBar: number;
  stepsPerBeat: number;
  liveLevel: number;
  isRecording: boolean;
  enabled: boolean;
  onToggleEnabled: () => void;
  editable: boolean;
  onToggleStep: (step: number) => void;
  onMoveStep: (from: number, to: number) => void;
  disabled?: boolean;
}) {
  const color = ROLE_COLOR[role];
  const cols = Math.max(1, totalCols);
  const cellW = 100 / cols;
  const stepPct = 100 / cols;
  const beatPct = (100 * Math.max(1, stepsPerBeat)) / cols;
  const barPct = (100 * Math.max(1, stepsPerBar)) / cols;
  // Grid painted into the lane background (bar / beat / step lines) so it can never be covered.
  // Neutral light-gray lines (no pink / colored lines) per owner preference.
  const gridBackground = {
    backgroundColor: '#08090b',
    backgroundImage: [
      'linear-gradient(90deg, rgba(200,204,214,0.65) 0 2px, transparent 2px)',
      'linear-gradient(90deg, rgba(170,174,184,0.4) 0 1px, transparent 1px)',
      'linear-gradient(90deg, rgba(150,154,164,0.24) 0 1px, transparent 1px)',
    ].join(', '),
    backgroundSize: [`${barPct}% 100%`, `${beatPct}% 100%`, `${stepPct}% 100%`].join(', '),
    backgroundRepeat: 'repeat',
    backgroundPosition: '0 0',
  } as const;
  const stepSet = new Set(steps);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);

  const stepFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = trackRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return null;
      const rel = (clientX - r.left) / r.width;
      return Math.max(0, Math.min(cols - 1, Math.floor(rel * cols)));
    },
    [cols],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!editable) return;
      const step = stepFromClientX(e.clientX);
      if (step == null) return;
      e.preventDefault();
      if (stepSet.has(step)) {
        setDragFrom(step);
        setDragTo(step);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
      } else {
        onToggleStep(step);
      }
    },
    [editable, onToggleStep, stepFromClientX, stepSet],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragFrom == null) return;
      const step = stepFromClientX(e.clientX);
      if (step != null) setDragTo(step);
    },
    [dragFrom, stepFromClientX],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragFrom == null) return;
      const to = dragTo ?? dragFrom;
      const from = dragFrom;
      setDragFrom(null);
      setDragTo(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      if (to === from) onToggleStep(from);
      else onMoveStep(from, to);
    },
    [dragFrom, dragTo, onMoveStep, onToggleStep],
  );

  const shownSteps = new Set(stepSet);
  if (dragFrom != null && dragTo != null && dragTo !== dragFrom) {
    shownSteps.delete(dragFrom);
    shownSteps.add(dragTo);
  }
  return (
    <div
      className="flex items-center gap-1.5"
      style={{ height: VOCALBOX_LANE_ROW_H, opacity: enabled ? 1 : 0.4 }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggleEnabled}
        className="shrink-0 rounded border px-0 font-bold uppercase leading-none"
        style={{
          width: 38,
          height: VOCALBOX_LANE_TRACK_H,
          fontSize: 9,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          padding: 0,
          borderColor: enabled ? `${color}88` : '#444',
          color: enabled ? color : '#666',
          background: enabled ? `${color}18` : 'transparent',
        }}
        title={enabled ? `${ROLE_LABEL[role]} on — click to disable` : `${ROLE_LABEL[role]} off — click to enable`}
        aria-pressed={enabled}
      >
        {ROLE_LABEL[role]}
      </button>
      <div
        ref={trackRef}
        className="relative flex-1 min-w-0 overflow-hidden rounded-sm"
        style={{
          height: VOCALBOX_LANE_TRACK_H,
          ...gridBackground,
          border: '1px solid rgba(170,174,184,0.4)',
          cursor: editable ? (dragFrom != null ? 'grabbing' : 'pointer') : 'default',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {isRecording && liveLevel > 0.02 ? (
          <div
            className="absolute inset-y-0 left-0 pointer-events-none"
            style={{
              width: `${Math.round(liveLevel * 100)}%`,
              background: `${color}26`,
              transition: 'width 60ms linear',
            }}
          />
        ) : null}
        {Array.from(shownSteps).map((step) => (
          <div
            key={`${role}-${step}`}
            className="absolute rounded-[2px] pointer-events-none"
            style={{
              left: `${step * cellW}%`,
              width: `calc(${cellW}% - 2px)`,
              marginLeft: '1px',
              top: 2,
              bottom: 2,
              background: color,
              boxShadow: `0 0 6px ${color}cc, inset 0 0 0 1px rgba(255,255,255,0.35)`,
            }}
            title={`Step ${step + 1}`}
          />
        ))}
      </div>
      <span className="shrink-0 text-[9px] font-mono tabular-nums text-center" style={{ width: 14, color: '#7a7a88' }}>
        {steps.length > 0 ? steps.length : ''}
      </span>
    </div>
  );
}

export function BeatPadsVocalBoxPanel({
  bpm,
  loopBars,
  stepsPerBar,
  beatsPerBar = 4,
  pattern,
  onPatternChange,
  padLabelForPad,
  onStrikePad,
  hasPadSample,
  getAudioContext,
  getAudioOutput,
  warmAudio,
  onEnsurePadSamples,
  getHumMelodyPreviewDestination,
  onApplyHumMelody,
  onBpmChange,
  songKeyRoot = 0,
  songKeyMode = 'major',
  variant = 'modal',
  onClose,
  disabled = false,
}: BeatPadsVocalBoxPanelProps) {
  const [status, setStatus] = useState('Say boom for kick · ka for snare — Rec on count-in.');
  const [draftHits, setDraftHits] = useState<VocalBoxHit[]>([]);
  const [rawHits, setRawHits] = useState<VocalBoxHit[]>([]);
  const [quantize, setQuantize] = useState<VocalBoxQuantize>(() => vocalBoxDefaultQuantize(stepsPerBar));
  const [captureBars, setCaptureBars] = useState<VocalBoxCaptureBars>(VOCALBOX_DEFAULT_CAPTURE_BARS);
  const [roleMask, setRoleMask] = useState<VocalBoxRoleMask>(() => ({ ...VOCALBOX_DEFAULT_ROLE_MASK }));
  const [replaceLanes, setReplaceLanes] = useState(true);
  const [precountEnabled, setPrecountEnabled] = useState(true);
  /** Free count-in length (1 or 2 bars) — timing only; existing Cnt toggle enables it. */
  const [precountBars] = useState<1 | 2>(1);
  const [recordMetroEnabled, setRecordMetroEnabled] = useState(true);
  const [isPrecounting, setIsPrecounting] = useState(false);
  /** VocalBox drums Intensity only — independent from Hum Melody. */
  const [drumIntensity, setDrumIntensity] = useState(VOCALBOX_DRUM_INTENSITY_DEFAULT);
  const drumIntensityRef = useRef(drumIntensity);
  drumIntensityRef.current = drumIntensity;
  /** Last trimmed take — Intensity re-gates without re-recording. */
  const lastDrumTakeRef = useRef<AudioBuffer | null>(null);
  /** True while click-Play audition runs (Mtr + count box, no mic, no pre-count). */
  const [clickPlayActive, setClickPlayActive] = useState(false);
  /** True for whole Rec session (count-in + take) so the digit span never unmounts mid-grid. */
  const [recSessionActive, setRecSessionActive] = useState(false);
  /** Rec-button number: pre-count 4…1 or metro beat-in-bar 1…4. */
  const [recBeatNumber, setRecBeatNumber] = useState<number | null>(null);
  /** precount | metro — styles the count box under Rec. */
  const [recCountPhase, setRecCountPhase] = useState<'precount' | 'metro' | null>(null);
  /** Imperative digit paint into the count box under Rec. */
  const recBeatDigitRef = useRef<HTMLSpanElement | null>(null);
  const recCountBoxRef = useRef<HTMLDivElement | null>(null);
  /** Last painted digit — restored after React clears empty <span /> children. */
  const recDigitPaintRef = useRef<{ text: string; phase: 'precount' | 'metro' | null }>({
    text: '—',
    phase: null,
  });

  const paintRecCountBox = useCallback((n: number | '—' | '…', phase: 'precount' | 'metro' | null) => {
    recDigitPaintRef.current = { text: String(n), phase };
    const digit = recBeatDigitRef.current;
    if (digit) digit.textContent = String(n);
    const box = recCountBoxRef.current;
    if (!box) return;
    // Classes owned here — do not also drive them from React className (commits fight the digit).
    box.classList.toggle('vb-rec-count-box--idle', phase == null);
    box.classList.toggle('vb-rec-count-box--metro', phase === 'metro');
    // Pulse with each BPM click (same moment the grid number lights).
    if (typeof n === 'number') {
      box.classList.remove('vb-rec-count-box--lit');
      void box.offsetWidth;
      box.classList.add('vb-rec-count-box--lit');
    } else {
      box.classList.remove('vb-rec-count-box--lit');
    }
  }, []);

  /** Light every click’s number in order (1→2→3→4…). Pre-count = red; metro = green. */
  const paintGridBeatLit = useCallback(
    (gridBeatIndex: number | null, phase: 'precount' | 'metro' = 'metro') => {
      litGridBeatRef.current = gridBeatIndex;
      litGridPhaseRef.current = gridBeatIndex == null ? null : phase;
      let cells = gridCellsRef.current;
      if (cells.length === 0) {
        const root = beatRulerRef.current;
        if (root) {
          cells = Array.from(root.querySelectorAll('[data-vb-grid-beat]')) as HTMLElement[];
          gridCellsRef.current = cells;
        }
      }
      for (let i = 0; i < cells.length; i += 1) {
        const el = cells[i]!;
        const on = gridBeatIndex != null && i === gridBeatIndex;
        const pre = on && phase === 'precount';
        el.classList.toggle('vb-beat-ruler-num--lit', on && !pre);
        el.classList.toggle('vb-beat-ruler-num--lit-precount', pre);
        if (pre) {
          el.style.color = '#ffd0d8';
          el.style.textShadow = '0 0 12px rgba(255,80,100,1), 0 0 6px rgba(255,120,140,0.95)';
          el.style.transform = 'scale(1.35)';
          el.style.background = 'rgba(232,93,117,0.32)';
          el.style.borderRadius = '3px';
        } else if (on) {
          el.style.color = '#e8fff4';
          el.style.textShadow = '0 0 12px rgba(124,244,198,1), 0 0 6px rgba(255,255,255,0.9)';
          el.style.transform = 'scale(1.35)';
          el.style.background = 'rgba(124,244,198,0.28)';
          el.style.borderRadius = '3px';
        } else {
          el.style.color = '';
          el.style.textShadow = '';
          el.style.transform = '';
          el.style.background = '';
          el.style.borderRadius = '';
        }
      }
    },
    [],
  );

  const clearGridBeatLit = useCallback(() => {
    litGridBeatRef.current = null;
    litGridPhaseRef.current = null;
    const clearEl = (el: HTMLElement) => {
      el.classList.remove('vb-beat-ruler-num--lit', 'vb-beat-ruler-num--lit-precount');
      el.style.color = '';
      el.style.textShadow = '';
      el.style.transform = '';
      el.style.background = '';
      el.style.borderRadius = '';
    };
    for (const el of gridCellsRef.current) clearEl(el);
    const root = beatRulerRef.current;
    if (root) {
      root
        .querySelectorAll('.vb-beat-ruler-num--lit, .vb-beat-ruler-num--lit-precount')
        .forEach((node) => clearEl(node as HTMLElement));
    }
  }, []);

  const armGridBeatCells = useCallback(() => {
    const root = beatRulerRef.current;
    gridCellsRef.current = root
      ? (Array.from(root.querySelectorAll('[data-vb-grid-beat]')) as HTMLElement[])
      : [];
  }, []);

  /** Rec digit only (grid lights via onGridBeat). */
  const paintClickDigit = useCallback(
    (n: number, phase: 'precount' | 'metro', _absoluteBeat: number) => {
      paintRecCountBox(n, phase);
    },
    [paintRecCountBox],
  );

  // Empty <span ref /> has no React children — every commit wipes textContent. Re-apply before paint.
  useLayoutEffect(() => {
    const { text, phase } = recDigitPaintRef.current;
    const digit = recBeatDigitRef.current;
    if (digit && digit.textContent !== text) digit.textContent = text;
    const box = recCountBoxRef.current;
    if (!box) return;
    box.classList.toggle('vb-rec-count-box--idle', phase == null);
    box.classList.toggle('vb-rec-count-box--metro', phase === 'metro');
  });

  // After every React commit, put the lit back on the current click’s number (1→2→3→4 order).
  useLayoutEffect(() => {
    const lit = litGridBeatRef.current;
    const phase = litGridPhaseRef.current ?? 'metro';
    if (gridCellsRef.current.length === 0) {
      const root = beatRulerRef.current;
      if (root) {
        gridCellsRef.current = Array.from(root.querySelectorAll('[data-vb-grid-beat]')) as HTMLElement[];
      }
    }
    const cells = gridCellsRef.current;
    for (let i = 0; i < cells.length; i += 1) {
      const el = cells[i]!;
      const on = lit != null && i === lit;
      const pre = on && phase === 'precount';
      el.classList.toggle('vb-beat-ruler-num--lit', on && !pre);
      el.classList.toggle('vb-beat-ruler-num--lit-precount', pre);
      if (pre) {
        el.style.color = '#ffd0d8';
        el.style.textShadow = '0 0 12px rgba(255,80,100,1), 0 0 6px rgba(255,120,140,0.95)';
        el.style.transform = 'scale(1.35)';
        el.style.background = 'rgba(232,93,117,0.32)';
        el.style.borderRadius = '3px';
      } else if (on) {
        el.style.color = '#e8fff4';
        el.style.textShadow = '0 0 12px rgba(124,244,198,1), 0 0 6px rgba(255,255,255,0.9)';
        el.style.transform = 'scale(1.35)';
        el.style.background = 'rgba(124,244,198,0.28)';
        el.style.borderRadius = '3px';
      } else {
        el.style.color = '';
        el.style.textShadow = '';
        el.style.transform = '';
        el.style.background = '';
        el.style.borderRadius = '';
      }
    }
  });

  useEffect(() => {
    paintRecCountBox('—', null);
  }, [paintRecCountBox]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  /** Drums + Hum Melody share one downbeat when Sync is on. */
  const [partsSync, setPartsSync] = useState(false);
  const [humSyncAuditionNonce, setHumSyncAuditionNonce] = useState(0);
  const [humAuditionStopNonce, setHumAuditionStopNonce] = useState(0);
  const [humSyncToPadsNonce, setHumSyncToPadsNonce] = useState(0);
  const syncStartAtSecRef = useRef<number | null>(null);
  const syncFromMelodyRef = useRef(false);
  const [liveRoleLevel, setLiveRoleLevel] = useState<Record<VocalBoxDrumRole, number>>({
    kick: 0,
    snare: 0,
    hat: 0,
    clap: 0,
  });
  const [humMelodyOpen, setHumMelodyOpen] = useState(variant === 'modal');
  const [humMelodyMounted, setHumMelodyMounted] = useState(variant === 'modal');
  const processingRef = useRef(false);
  const recordStopPendingRef = useRef(false);
  const precountCancelRef = useRef(false);
  const precountBufRef = useRef<AudioBuffer | null>(null);
  const scheduledPrecountNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const recordMetroAnchorRef = useRef<number | null>(null);
  /** Stop synced Rec-number UI driver (same clock as clicks). */
  const stopClickUiRef = useRef<(() => void) | null>(null);
  /** WAAPI count playhead (VocalBox-local — not SE2 transport). */
  const stopCountPlayheadRef = useRef<(() => void) | null>(null);
  /** Audio-clock time of the capture downbeat — drives the record playhead (set even if metro is off). */
  const recordAnchorRef = useRef<number | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  /** Beat 1–2–3–4 ruler above the drum grid — lit cell drives the Rec digit. */
  const beatRulerRef = useRef<HTMLDivElement | null>(null);
  const litGridBeatRef = useRef<number | null>(null);
  /** precount → red blink; metro → green (same as before). */
  const litGridPhaseRef = useRef<'precount' | 'metro' | null>(null);
  /** Cached ruler cells — index = click order across the bars (lights every click). */
  const gridCellsRef = useRef<HTMLElement[]>([]);
  /** Precount length in beats for mapping metro absoluteBeat → grid column. */
  const clickCountBeatsRef = useRef(0);
  /** AudioContext time of the preview downbeat — drives sample-accurate playback + the preview playhead. */
  const previewAnchorSecRef = useRef(0);
  const previewDurSecRef = useRef(0);
  const gridOriginFileSecRef = useRef(0);
  const previewTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const captureApiRef = useRef<UseVocalCaptureResult | null>(null);
  const stopRecordRef = useRef<() => void>(() => {});
  const isRecordingRef = useRef(false);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  const cancelScheduledPrecountNodes = useCallback(() => {
    for (const node of scheduledPrecountNodesRef.current) {
      try {
        node.stop();
      } catch {
        /* */
      }
    }
    scheduledPrecountNodesRef.current = [];
  }, []);

  const stopCountPlayhead = useCallback(() => {
    stopCountPlayheadRef.current?.();
    stopCountPlayheadRef.current = null;
  }, []);

  const cancelPrecount = useCallback(() => {
    precountCancelRef.current = true;
    stopClickUiRef.current?.();
    stopClickUiRef.current = null;
    stopCountPlayhead();
    cancelScheduledPrecountNodes();
    if (captureApiRef.current?.isRecording) {
      captureApiRef.current.stopRecord();
    }
    captureApiRef.current?.releaseMic();
    setIsPrecounting(false);
    setClickPlayActive(false);
    setRecSessionActive(false);
    setRecBeatNumber(null);
    setRecCountPhase(null);
    paintRecCountBox('—', null);
    clearGridBeatLit();
  }, [cancelScheduledPrecountNodes, clearGridBeatLit, paintRecCountBox, stopCountPlayhead]);

  const stopClickPlay = useCallback(() => {
    precountCancelRef.current = true;
    stopClickUiRef.current?.();
    stopClickUiRef.current = null;
    stopCountPlayhead();
    cancelScheduledPrecountNodes();
    setIsPrecounting(false);
    setClickPlayActive(false);
    setRecSessionActive(false);
    setRecCountPhase(null);
    paintRecCountBox('—', null);
    clearGridBeatLit();
    setStatus('Click play stopped.');
  }, [cancelScheduledPrecountNodes, clearGridBeatLit, paintRecCountBox, stopCountPlayhead]);

  const schedulePrecountClick = useCallback(
    (ctx: AudioContext, idealT: number, _downbeat: boolean) => {
      let buf = precountBufRef.current;
      if (!buf && ctx.state !== 'closed') {
        buf = createSe2PrecountRimshotBuffer(ctx);
        precountBufRef.current = buf;
      }
      if (!buf) return;
      // Exact audio-clock time — never jam late clicks onto "now".
      if (idealT < ctx.currentTime - 0.002) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      // Same loudness every beat — accent-only volume made 2–3–4 feel late vs downbeats.
      g.gain.value = SE2_PRECOUNT_CLICK_VOLUME;
      src.connect(g);
      // Direct to speakers — track/master strip adds latency and desyncs the count digit.
      g.connect(ctx.destination);
      try {
        src.start(idealT);
        scheduledPrecountNodesRef.current.push(src);
      } catch {
        /* */
      }
    },
    [],
  );

  /** Instant-onset synth click only — fetched TR-808 sample has variable onset vs the digit. */
  const armClickBuffer = useCallback((ctx: AudioContext) => {
    if (!precountBufRef.current) {
      precountBufRef.current = createSe2PrecountRimshotBuffer(ctx);
    }
  }, []);

  // Prewarm click sample + AudioContext while VocalBox is open.
  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    void (async () => {
      const ctx = await resolveVocalBoxAudioContext(getAudioContext, warmAudio);
      if (cancelled || !ctx) return;
      armClickBuffer(ctx);
    })();
    return () => {
      cancelled = true;
    };
  }, [armClickBuffer, disabled, getAudioContext, warmAudio]);

  const padLabels = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => padLabelForPad?.(i)?.trim() || `Pad ${i + 1}`);
  }, [padLabelForPad]);

  const padMap = useMemo(() => beatPadsVocalBoxPadMapFromLabels(padLabels), [padLabels]);
  const totalCols = beatPadsPatternCols(captureBars, stepsPerBar);
  const stepsPerBeat = Math.max(1, Math.round(stepsPerBar / Math.max(1, Math.round(beatsPerBar))));
  const captureDurationSec = useMemo(
    () => vocalBoxCaptureDurationSec(bpm, captureBars, beatsPerBar),
    [beatsPerBar, bpm, captureBars],
  );

  useEffect(() => {
    setQuantize(vocalBoxDefaultQuantize(stepsPerBar));
  }, [stepsPerBar]);

  const alignOpts = useMemo(
    () => ({
      bpm,
      captureBars,
      stepsPerBar,
      beatsPerBar,
      quantize,
      roleMask,
    }),
    [beatsPerBar, bpm, captureBars, quantize, roleMask, stepsPerBar],
  );

  const toggleRole = useCallback((role: VocalBoxDrumRole) => {
    setRoleMask((prev) => {
      const next = { ...prev, [role]: !prev[role] };
      if (!VOCALBOX_DRUM_ROLES.some((r) => next[r])) return prev;
      return next;
    });
  }, []);

  const applyQuantizeToRaw = useCallback(
    (raw: readonly VocalBoxHit[], q: VocalBoxQuantize = quantize) => {
      const aligned = alignAndQuantizeVocalBoxHits(raw, {
        ...alignOpts,
        quantize: q,
      });
      setDraftHits(aligned);
      if (aligned.length > 0) {
        setStatus(
          `${vocalBoxStatusCounts(aligned, bpm, q, captureBars)} ${vocalBoxTimingFeedback(raw, aligned)} ${vocalBoxPadRoutingHint(padMap, padLabels)}`,
        );
      }
      return aligned;
    },
    [alignOpts, bpm, captureBars, padLabels, padMap, quantize],
  );

  useEffect(() => {
    if (rawHits.length === 0) return;
    applyQuantizeToRaw(rawHits, quantize);
  }, [applyQuantizeToRaw, captureBars, quantize, rawHits, roleMask]);

  // VocalBox Intensity — re-gate last drum take without re-recording.
  const prevDrumIntensityRef = useRef(drumIntensity);
  useEffect(() => {
    if (prevDrumIntensityRef.current === drumIntensity) return;
    prevDrumIntensityRef.current = drumIntensity;
    const take = lastDrumTakeRef.current;
    if (!take) return;
    const takeSec = vocalBoxCaptureDurationSec(bpm, captureBars, beatsPerBar);
    const raw = detectBeatboxVocalBoxHits(take, takeSec, roleMask, drumIntensity);
    setRawHits(raw);
    if (raw.length === 0) {
      setDraftHits([]);
      setStatus(`Intensity ${drumIntensity} — no hits left. Open the gate or Rec again.`);
      return;
    }
    const hits = alignAndQuantizeVocalBoxHits(raw, {
      bpm,
      captureBars,
      stepsPerBar,
      beatsPerBar,
      quantize,
      roleMask,
    });
    setDraftHits(hits);
    setStatus(
      `${vocalBoxStatusCounts(hits, bpm, quantize, captureBars)} · intensity ${drumIntensity}`,
    );
  }, [
    beatsPerBar,
    bpm,
    captureBars,
    drumIntensity,
    quantize,
    roleMask,
    stepsPerBar,
  ]);

  const laneSteps = useMemo(
    () =>
      vocalBoxHitsToLaneSteps(draftHits, {
        bpm,
        captureBars,
        stepsPerBar,
        beatsPerBar,
      }),
    [beatsPerBar, bpm, captureBars, draftHits, stepsPerBar],
  );

  const analyzeCapture = useCallback(
    async (blob: Blob) => {
      processingRef.current = true;
      setProcessing(true);
      setStatus('Converting…');
      try {
        const buffer = await decodeCaptureBlob(getAudioContext, warmAudio, blob);
        if (!buffer) {
          setStatus('Could not read mic audio — tap Play once, then Rec again.');
          return;
        }
        if (buffer.duration < 0.08) {
          setStatus('Too short — beatbox a few hits.');
          return;
        }
        // Bar 1 Beat 1 = scheduled downbeat in the file (recorder was armed before 1).
        // Do not snap to the first mouth hit — that shifts the whole grid late/early.
        const downbeatSec = Math.max(0, Math.min(gridOriginFileSecRef.current, Math.max(0, buffer.duration - 0.05)));
        const takeSec = vocalBoxCaptureDurationSec(bpm, captureBars, beatsPerBar);
        const fromDownbeat = trimAudioBufferFromSec(buffer, downbeatSec, takeSec + 0.06);
        lastDrumTakeRef.current = fromDownbeat;
        const raw = detectBeatboxVocalBoxHits(
          fromDownbeat,
          takeSec,
          roleMask,
          drumIntensityRef.current,
        );
        if (raw.length === 0) {
          setStatus(`No hits — ${captureBars} bar @ ${bpm} BPM. boom / ka on the beat.`);
          setRawHits([]);
          setDraftHits([]);
          return;
        }
        setRawHits(raw);
        const hits = alignAndQuantizeVocalBoxHits(raw, {
          bpm,
          captureBars,
          stepsPerBar,
          beatsPerBar,
          quantize,
          roleMask,
        });
        setDraftHits(hits);
        setStatus(
          `${vocalBoxStatusCounts(hits, bpm, quantize, captureBars)} ${vocalBoxTimingFeedback(raw, hits)} ${vocalBoxPadRoutingHint(padMap, padLabels)}`,
        );
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'VocalBox failed.');
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [beatsPerBar, bpm, captureBars, getAudioContext, padLabels, padMap, quantize, roleMask, stepsPerBar, warmAudio],
  );

  const handleCaptureBlob = useCallback(
    (blob: Blob | null) => {
      if (!recordStopPendingRef.current) return;
      recordStopPendingRef.current = false;
      if (!blob || blob.size === 0) {
        setStatus('No audio captured — check mic permission.');
        return;
      }
      void analyzeCapture(blob);
    },
    [analyzeCapture],
  );

  const capture = useVocalCapture(handleCaptureBlob, { percussiveMic: true });
  captureApiRef.current = capture;
  stopRecordRef.current = capture.stopRecord;
  isRecordingRef.current = capture.isRecording;

  const clearPreviewTimers = useCallback(() => {
    for (const t of previewTimersRef.current) clearTimeout(t);
    previewTimersRef.current = [];
  }, []);

  const stopBarPreview = useCallback(() => {
    clearPreviewTimers();
    setIsPreviewing(false);
    setHumAuditionStopNonce((n) => n + 1);
    setStatus('Play stopped.');
  }, [clearPreviewTimers]);

  useEffect(() => {
    if (!capture.isRecording || !capture.captureStream) {
      setMicLevel(0);
      setLiveRoleLevel({ kick: 0, snare: 0, hat: 0, clap: 0 });
      return;
    }
    let cancelled = false;
    let raf = 0;
    let src: MediaStreamAudioSourceNode | null = null;

    void (async () => {
      const ctx = await resolveVocalBoxAudioContext(getAudioContext, warmAudio);
      if (!ctx || cancelled || !capture.captureStream) return;

      src = ctx.createMediaStreamSource(capture.captureStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);

      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(buf);
        let low = 0;
        let mid = 0;
        let high = 0;
        const n = buf.length;
        const third = Math.floor(n / 3);
        for (let i = 0; i < n; i++) {
          const v = buf[i]! / 255;
          if (i < third) low += v;
          else if (i < third * 2) mid += v;
          else high += v;
        }
        const sum = low + mid + high + 1e-6;
        const level = Math.min(1, (low + mid + high) / (n * 0.35));
        const boom = low / sum;
        const snap = (mid + high) / sum;
        setMicLevel(level);
        setLiveRoleLevel({
          kick: Math.min(1, boom * level * 2.4 * (boom > snap * 0.9 ? 1.15 : 0.65)),
          // Snare meter less eager — needs a clearer snap than the boom band.
          snare: Math.min(1, snap * level * 1.7 * (snap >= boom * 1.05 ? 1.15 : 0.35)),
          clap: Math.min(1, (mid / sum) * level * 2.2),
          hat: Math.min(1, (high / sum) * level * 2.5),
        });
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try {
        src?.disconnect();
      } catch {
        /* */
      }
    };
  }, [capture.captureStream, capture.isRecording, getAudioContext, warmAudio]);

  useEffect(() => {
    if (!capture.isRecording) return;
    setDraftHits([]);
    setRawHits([]);
    return () => {
      // Do not stopClickUi here — arming MediaRecorder must not kill the BPM-synced
      // number driver (Strict Mode remount / arm-before-downbeat would desync Rec digits).
      recordMetroAnchorRef.current = null;
      recordAnchorRef.current = null;
    };
  }, [capture.isRecording]);

  // Keep AudioContext awake for the whole capture so metro clicks keep firing.
  useEffect(() => {
    if (!capture.isRecording && !isPrecounting) return;
    const ctx = getAudioContext?.();
    if (!ctx) return;
    let raf = 0;
    const keepAwake = () => {
      if (ctx.state === 'suspended') void ctx.resume();
      raf = requestAnimationFrame(keepAwake);
    };
    keepAwake();
    return () => cancelAnimationFrame(raf);
  }, [capture.isRecording, getAudioContext, isPrecounting]);

  // Record playhead — sweep a bright line across the lanes in sync with the capture
  // metronome so you can place hits on the beat. Anchored to the audio clock.
  useEffect(() => {
    if (!capture.isRecording) return;
    const el = playheadRef.current;
    const ctx = getAudioContext?.();
    if (!el || !ctx) return;
    const dur = Math.max(0.001, captureDurationSec);
    let raf = 0;
    const tick = () => {
      const anchor = recordAnchorRef.current;
      if (anchor == null) {
        el.style.opacity = '0';
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = (ctx.currentTime - anchor) / dur;
      if (p < 0) {
        el.style.left = '0%';
        el.style.opacity = '0.35';
      } else if (p <= 1.0001) {
        el.style.left = `${Math.min(100, p * 100)}%`;
        el.style.opacity = '1';
      } else {
        el.style.opacity = '0';
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      if (el) el.style.opacity = '0';
    };
  }, [capture.isRecording, captureDurationSec, getAudioContext]);

  // Preview playhead — same sweeping line during Pvw playback so you can watch each
  // block trigger on the beat. Rides the AudioContext clock, matching the scheduled hits.
  useEffect(() => {
    if (!isPreviewing) return;
    const el = playheadRef.current;
    const ctx = getAudioContext?.();
    if (!el || !ctx) return;
    const dur = Math.max(0.001, previewDurSecRef.current || captureDurationSec);
    let raf = 0;
    const tick = () => {
      const p = (ctx.currentTime - previewAnchorSecRef.current) / dur;
      if (p < 0) {
        el.style.left = '0%';
        el.style.opacity = '0.35';
      } else if (p <= 1.0001) {
        el.style.left = `${Math.min(100, p * 100)}%`;
        el.style.opacity = '1';
      } else {
        el.style.opacity = '0';
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      if (el) el.style.opacity = '0';
    };
  }, [isPreviewing, captureDurationSec, getAudioContext]);

  useEffect(() => {
    if (!capture.isRecording) return;
    // Stop at end of loop from the audio downbeat (not MediaRecorder arm time).
    const takeSec = vocalBoxCaptureDurationSec(bpm, captureBars, beatsPerBar);
    const ctx = getAudioContext?.();
    let raf = 0;
    let t = 0;
    const armTimer = () => {
      const anchor = recordAnchorRef.current;
      if (anchor == null || !ctx) {
        raf = requestAnimationFrame(armTimer);
        return;
      }
      const remainingMs = (anchor + takeSec - ctx.currentTime) * 1000 + 40;
      t = window.setTimeout(() => {
        if (!isRecordingRef.current) return;
        recordStopPendingRef.current = true;
        stopClickUiRef.current?.();
        stopClickUiRef.current = null;
        setRecBeatNumber(null);
        setRecSessionActive(false);
        setRecCountPhase(null);
        paintRecCountBox('—', null);
        stopRecordRef.current();
        setStatus('Processing…');
      }, Math.max(40, remainingMs));
    };
    armTimer();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [beatsPerBar, bpm, capture.isRecording, captureBars, getAudioContext]);

  const beginRecordWithOptionalPrecount = useCallback(async () => {
    if (disabled) return;
    if (clickPlayActive) stopClickPlay();
    setIsPrecounting(true);
    setRecSessionActive(true);
    setRecBeatNumber(null);
    setRecCountPhase(precountEnabled ? 'precount' : 'metro');
    paintRecCountBox('…', precountEnabled ? 'precount' : 'metro');
    setStatus(`Count @ ${Math.round(bpm)} BPM…`);

    const ctx = await resolveVocalBoxAudioContext(getAudioContext, warmAudio);
    if (!ctx) {
      setIsPrecounting(false);
      setRecSessionActive(false);
      setStatus('Audio not ready — tap Play once, then Rec.');
      return;
    }

    setDraftHits([]);
    setRawHits([]);
    recordStopPendingRef.current = false;
    precountCancelRef.current = false;

    try {
      const { bpm: gridBpm } = se2ClickGridTempo(bpm);
      const bpb = Math.max(1, Math.round(beatsPerBar));
      const takeBeats = captureBars * bpb;

      if (precountEnabled || recordMetroEnabled) {
        armClickBuffer(ctx);
      }

      cancelScheduledPrecountNodes();
      stopClickUiRef.current?.();
      stopClickUiRef.current = null;

      // Mic arms in parallel with count-in — do not delay the first click/digit.
      const micPromise =
        precountEnabled || recordMetroEnabled
          ? capture.armMic()
          : Promise.resolve(false);

      if (!precountEnabled && !recordMetroEnabled) {
        const micOk = await capture.armMic();
        if (!micOk) {
          setIsPrecounting(false);
          setRecSessionActive(false);
          setStatus('Mic blocked — allow microphone access.');
          return;
        }
      }

      paintRecCountBox('…', precountEnabled ? 'precount' : 'metro');
      clearGridBeatLit();
      armGridBeatCells();
      clickCountBeatsRef.current = precountEnabled
        ? (precountBars === 2 ? 2 : 1) * bpb
        : 0;

      // Metronome + grid beat numbers share the BPM click times.
      const result = await runVocalBoxClickCount({
        ctx,
        bpm: gridBpm,
        beatsPerBar: bpb,
        precountEnabled,
        precountBars,
        metroEnabled: recordMetroEnabled,
        metroBeatCount: takeBeats,
        scheduleClick: (idealT, accent) => schedulePrecountClick(ctx, idealT, accent),
        isCancelled: () => precountCancelRef.current,
        onArmRecord: async () => {
          if (precountEnabled || recordMetroEnabled) {
            const micOk = await micPromise;
            if (!micOk) {
              precountCancelRef.current = true;
              throw new Error('Mic blocked — allow microphone access.');
            }
          }
          await capture.startRecord();
        },
        // Pre-roll so MediaRecorder is already capturing when green 1 hits (avoids 2–3 step lag).
        recordArmLeadSec: Math.min(0.28, Math.max(0.18, (60 / Math.max(40, gridBpm)) * 0.45)),
        paintDigit: paintClickDigit,
        onGridBeat: paintGridBeatLit,
        onPhaseChange: (phase) => {
          if (phase === 'metro') setIsPrecounting(false);
        },
        playheadEl: playheadRef.current,
      });

      stopClickUiRef.current = result.stopUi;

      if (result.cancelled) {
        result.stopUi();
        stopClickUiRef.current = null;
        stopCountPlayhead();
        cancelScheduledPrecountNodes();
        capture.releaseMic();
        if (capture.isRecording) capture.stopRecord();
        setRecBeatNumber(null);
        setRecSessionActive(false);
        setRecCountPhase(null);
        paintRecCountBox('—', null);
        setStatus('Count-in cancelled.');
        return;
      }

      const { downbeatAudioTime, recordArmedAtSec } = result;
      const fileZero = recordArmedAtSec ?? downbeatAudioTime;
      // Downbeat in the file + a little slack for mic/MediaRecorder path delay
      // so a kick played on 1 lands on step 0, not 2–3 steps late.
      gridOriginFileSecRef.current = Math.max(0, downbeatAudioTime - fileZero + 0.045);
      recordAnchorRef.current = downbeatAudioTime;
      recordMetroAnchorRef.current = recordMetroEnabled ? downbeatAudioTime : null;
      if (result.countBeats === 0) {
        setIsPrecounting(false);
      } else {
        // Downbeat reached — count-in done; keep stopUi running for metro digits.
        setIsPrecounting(false);
        setRecCountPhase('metro');
      }
      setStatus(
        recordMetroEnabled
          ? `Recording ${captureBars} bars @ ${gridBpm} BPM · metro locked`
          : `Recording ${captureBars} bars @ ${gridBpm} BPM`,
      );
    } catch (err) {
      stopCountPlayhead();
      capture.releaseMic();
      setRecSessionActive(false);
      setStatus(err instanceof Error ? err.message : 'Record failed.');
    }
  }, [
    bpm,
    beatsPerBar,
    cancelScheduledPrecountNodes,
    capture,
    captureBars,
    clickPlayActive,
    disabled,
    getAudioContext,
    precountBars,
    precountEnabled,
    recordMetroEnabled,
    schedulePrecountClick,
    armClickBuffer,
    paintClickDigit,
    paintGridBeatLit,
    armGridBeatCells,
    clearGridBeatLit,
    paintRecCountBox,
    stopClickPlay,
    stopCountPlayhead,
    warmAudio,
  ]);

  const toggleRecord = useCallback(() => {
    if (disabled) return;
    if (clickPlayActive) {
      stopClickPlay();
      return;
    }
    if (capture.isRecording) {
      recordStopPendingRef.current = true;
      stopClickUiRef.current?.();
      stopClickUiRef.current = null;
      setRecBeatNumber(null);
      setRecSessionActive(false);
      setRecCountPhase(null);
      paintRecCountBox('—', null);
      clearGridBeatLit();
      cancelScheduledPrecountNodes();
      capture.stopRecord();
      setStatus('Processing…');
      return;
    }
    if (isPrecounting || recSessionActive) {
      cancelPrecount();
      setStatus('Count-in cancelled.');
      return;
    }
    void beginRecordWithOptionalPrecount();
  }, [
    beginRecordWithOptionalPrecount,
    cancelPrecount,
    cancelScheduledPrecountNodes,
    capture,
    clickPlayActive,
    disabled,
    isPrecounting,
    paintRecCountBox,
    recSessionActive,
    stopClickPlay,
  ]);

  /** Audition Mtr + count box only — no mic, no record, no pre-count (Cnt is Rec-only). */
  const beginClickPlay = useCallback(async () => {
    if (
      disabled ||
      processing ||
      isPreviewing ||
      capture.isRecording ||
      recSessionActive ||
      clickPlayActive
    ) {
      return;
    }
    if (!recordMetroEnabled) {
      setStatus('Turn on Mtr, then Play. (Cnt is for Rec only.)');
      return;
    }

    // UI first so the count box is live before audio schedules.
    precountCancelRef.current = false;
    setClickPlayActive(true);
    setRecSessionActive(true);
    setIsPrecounting(false);
    setRecCountPhase('metro');
    paintRecCountBox('…', 'metro');

    const ctx = await resolveVocalBoxAudioContext(getAudioContext, warmAudio);
    if (!ctx) {
      setClickPlayActive(false);
      setRecSessionActive(false);
      setIsPrecounting(false);
      setRecCountPhase(null);
      paintRecCountBox('—', null);
      clearGridBeatLit();
      setStatus('Audio not ready — tap a pad once, then Play.');
      return;
    }

    setStatus(`Play click @ ${Math.round(bpm)} BPM — metro…`);

    try {
      const { bpm: gridBpm } = se2ClickGridTempo(bpm);
      const bpb = Math.max(1, Math.round(beatsPerBar));
      // Exact loop length at session BPM (2 / 4 / 8 bars — not forced to 4+).
      const takeBeats = captureBars * bpb;

      armClickBuffer(ctx);
      cancelScheduledPrecountNodes();
      stopClickUiRef.current?.();
      stopClickUiRef.current = null;
      stopCountPlayhead();
      clearGridBeatLit();
      armGridBeatCells();
      // Play = metro only. Pre-count is Rec-only (do not repeat the first four).
      clickCountBeatsRef.current = 0;

      // Metronome + grid 1–2–3–4 lights share the BPM click times.
      const result = await runVocalBoxClickCount({
        ctx,
        bpm: gridBpm,
        beatsPerBar: bpb,
        precountEnabled: false,
        precountBars,
        metroEnabled: true,
        metroBeatCount: takeBeats,
        scheduleClick: (idealT, accent) => schedulePrecountClick(ctx, idealT, accent),
        isCancelled: () => precountCancelRef.current,
        paintDigit: paintClickDigit,
        onGridBeat: paintGridBeatLit,
        onPhaseChange: (phase) => {
          if (phase === 'metro') setIsPrecounting(false);
        },
        playheadEl: playheadRef.current,
      });

      stopClickUiRef.current = result.stopUi;

      if (result.cancelled) {
        result.stopUi();
        stopClickUiRef.current = null;
        stopCountPlayhead();
        cancelScheduledPrecountNodes();
        setClickPlayActive(false);
        setRecSessionActive(false);
        setRecCountPhase(null);
        paintRecCountBox('—', null);
        setStatus('Click play stopped.');
        return;
      }

      if (result.countBeats > 0) {
        setIsPrecounting(false);
        setRecCountPhase('metro');
      }

      const metroBeats = recordMetroEnabled ? takeBeats : 0;
      const gridEnd = result.downbeatAudioTime + metroBeats * result.spb;
      const okEnd = await waitSe2AudioTime({
        ctx,
        whenSec: gridEnd,
        isCancelled: () => precountCancelRef.current,
      });

      result.stopUi();
      stopClickUiRef.current = null;
      stopCountPlayhead();
      cancelScheduledPrecountNodes();
      setClickPlayActive(false);
      setRecSessionActive(false);
      setIsPrecounting(false);
      setRecCountPhase(null);
      paintRecCountBox('—', null);
      clearGridBeatLit();
      setStatus(
        okEnd && !precountCancelRef.current
          ? `Click play done @ ${gridBpm} BPM — ${captureBars} bars locked.`
          : 'Click play stopped.',
      );
    } catch (err) {
      cancelScheduledPrecountNodes();
      stopClickUiRef.current?.();
      stopClickUiRef.current = null;
      stopCountPlayhead();
      setClickPlayActive(false);
      setRecSessionActive(false);
      setIsPrecounting(false);
      setRecCountPhase(null);
      paintRecCountBox('—', null);
      clearGridBeatLit();
      setStatus(err instanceof Error ? err.message : 'Click play failed.');
    }
  }, [
    beatsPerBar,
    bpm,
    cancelScheduledPrecountNodes,
    capture.isRecording,
    captureBars,
    clickPlayActive,
    disabled,
    getAudioContext,
    isPreviewing,
    paintClickDigit,
    paintGridBeatLit,
    armGridBeatCells,
    clearGridBeatLit,
    paintRecCountBox,
    precountBars,
    processing,
    recSessionActive,
    recordMetroEnabled,
    schedulePrecountClick,
    armClickBuffer,
    warmAudio,
    stopCountPlayhead,
  ]);

  const previewDraft = useCallback(async () => {
    const ctx = await resolveVocalBoxAudioContext(getAudioContext, warmAudio);
    if (!ctx) {
      setStatus('Audio not ready — tap a pad or Play once, then try again.');
      return;
    }

    const leadSec = VOCALBOX_PREVIEW_LEAD_MS / 1000;
    const stampedFromMelody =
      syncFromMelodyRef.current &&
      typeof syncStartAtSecRef.current === 'number' &&
      Number.isFinite(syncStartAtSecRef.current);
    const startAtSec = stampedFromMelody
      ? (syncStartAtSecRef.current as number)
      : ctx.currentTime + leadSec;
    previewAnchorSecRef.current = startAtSec;
    syncStartAtSecRef.current = startAtSec;

    // No drum draft — Sync Play can still drive Hum Melody alone.
    if (draftHits.length === 0 || !onStrikePad) {
      if (partsSync && !syncFromMelodyRef.current) {
        setHumSyncAuditionNonce((n) => n + 1);
        setIsPreviewing(true);
        setStatus(`Sync play — melody @ ${Math.round(bpm)} BPM…`);
        const takeSec = vocalBoxCaptureDurationSec(bpm, captureBars, beatsPerBar);
        const doneTimer = setTimeout(() => {
          setIsPreviewing(false);
          setStatus('Sync play done.');
        }, VOCALBOX_PREVIEW_LEAD_MS + takeSec * 1000 + 120);
        previewTimersRef.current.push(doneTimer);
      } else if (!partsSync) {
        setStatus('Nothing to play — record first.');
      }
      syncFromMelodyRef.current = false;
      return;
    }

    clearPreviewTimers();

    const takeSec = vocalBoxCaptureDurationSec(bpm, captureBars, beatsPerBar);
    const hits = draftHits.filter((h) => h.startSec >= 0 && h.startSec < takeSec);
    if (hits.length === 0) {
      if (partsSync && !syncFromMelodyRef.current) {
        setHumSyncAuditionNonce((n) => n + 1);
        setIsPreviewing(true);
        setStatus(`Sync play — melody @ ${Math.round(bpm)} BPM…`);
        const doneTimer = setTimeout(() => {
          setIsPreviewing(false);
          setStatus('Sync play done.');
        }, VOCALBOX_PREVIEW_LEAD_MS + takeSec * 1000 + 120);
        previewTimersRef.current.push(doneTimer);
      } else {
        setStatus('No hits in capture window — record again.');
      }
      syncFromMelodyRef.current = false;
      return;
    }

    const roleNeedsSample = (role: VocalBoxDrumRole) => {
      if (!hits.some((h) => h.role === role)) return false;
      const pi = padMap[role];
      return Boolean(hasPadSample && !hasPadSample(pi));
    };
    let missingSamples = VOCALBOX_DRUM_ROLES.filter(roleNeedsSample);
    if (missingSamples.length > 0 && onEnsurePadSamples) {
      setStatus('Loading pad samples for preview…');
      try {
        await onEnsurePadSamples();
      } catch {
        /* kit load may fail — fall through to clear status */
      }
      missingSamples = VOCALBOX_DRUM_ROLES.filter(roleNeedsSample);
    }

    // Play through to the end of the whole take (not just one bar) — leave a tail so the
    // last sample rings out before we mark preview done.
    const lastHitSec = hits.reduce((m, h) => Math.max(m, h.startSec), 0);
    const previewDurSec = Math.max(
      lastHitSec + 0.6,
      vocalBoxCaptureDurationSec(bpm, captureBars, beatsPerBar),
    );
    previewDurSecRef.current = previewDurSec;

    setIsPreviewing(true);
    setStatus(
      missingSamples.length > 0
        ? `Preview — load ${missingSamples.join('+')} sample(s) on routed pad(s).`
        : partsSync
          ? `Sync play drums + melody @ ${Math.round(bpm)} BPM…`
          : `Play ${captureBars} bar @ ${bpm} BPM…`,
    );

    let scheduled = 0;
    for (const hit of hits) {
      const pi = padMap[hit.role];
      if (hasPadSample && !hasPadSample(pi)) continue;
      const velBase = Math.max(0.45, Math.min(1, hit.velocity / 127));
      const vel = hit.role === 'snare' ? Math.min(1, velBase + 0.15) : velBase;
      onStrikePad(pi, vel, undefined, startAtSec + hit.startSec);
      scheduled += 1;
    }

    if (scheduled === 0) {
      if (partsSync && !syncFromMelodyRef.current) {
        setHumSyncAuditionNonce((n) => n + 1);
        setStatus(`Sync play — melody @ ${Math.round(bpm)} BPM…`);
      } else {
        setIsPreviewing(false);
        setStatus('Pads need samples — load kick/snare (Load kit), then Play.');
        syncFromMelodyRef.current = false;
        return;
      }
    }

    // Kick Hum Melody on the same downbeat (unless Audition already started this sync).
    if (partsSync && !syncFromMelodyRef.current) {
      setHumSyncAuditionNonce((n) => n + 1);
    }
    syncFromMelodyRef.current = false;

    const doneTimer = setTimeout(() => {
      setIsPreviewing(false);
      setStatus(
        partsSync
          ? `${captureBars} bar sync play done — To Pads when you like it.`
          : `${captureBars} bar ready — Play done. To Pads for grid.`,
      );
    }, VOCALBOX_PREVIEW_LEAD_MS + previewDurSec * 1000 + 120);
    previewTimersRef.current.push(doneTimer);
  }, [
    beatsPerBar,
    bpm,
    captureBars,
    clearPreviewTimers,
    draftHits,
    getAudioContext,
    hasPadSample,
    onEnsurePadSamples,
    onStrikePad,
    padMap,
    partsSync,
    warmAudio,
  ]);

  /** Melody Play / Audition with Sync — stamp shared clock, then preview drums (+ melody nonce). */
  const syncPlayDrumsFromMelody = useCallback(() => {
    if (!partsSync) return;
    syncFromMelodyRef.current = true;
    const ctx = getAudioContext?.();
    if (ctx && ctx.state !== 'closed') {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      syncStartAtSecRef.current = ctx.currentTime + VOCALBOX_PREVIEW_LEAD_MS / 1000;
    }
    void previewDraft();
  }, [getAudioContext, partsSync, previewDraft]);

  const sendToPads = useCallback(() => {
    if (draftHits.length === 0) {
      setStatus('Nothing to send — record first.');
      return;
    }
    const next = mergeVocalBoxHitsIntoPattern(patternRef.current, draftHits, {
      loopBars,
      captureBars,
      stepsPerBar,
      bpm,
      beatsPerBar,
      pads: padMap,
      replaceLanes,
      roleMask,
    });
    onPatternChange(next);
    if (onStrikePad) {
      for (const hit of draftHits.slice(0, 6)) {
        const pi = padMap[hit.role];
        onStrikePad(pi, Math.max(0.35, Math.min(1, hit.velocity / 127)));
      }
    }
    setStatus(`Sent to pad grid — ${captureBars} bar beat at bar 1.`);
  }, [
    beatsPerBar,
    bpm,
    captureBars,
    draftHits,
    loopBars,
    onPatternChange,
    onStrikePad,
    padMap,
    replaceLanes,
    roleMask,
    stepsPerBar,
  ]);

  /** Push drums (+ ask Hum to apply melody layers) onto Beat Pads / Beat Lab. */
  const syncToBeatPads = useCallback(() => {
    const hadDrums = draftHits.length > 0;
    if (hadDrums) sendToPads();
    setHumSyncToPadsNonce((n) => n + 1);
    if (!hadDrums && !onApplyHumMelody) {
      setStatus('Record drums or melody first, then To Pads.');
      return;
    }
    setStatus(
      hadDrums
        ? 'To Pads — drums on grid; melody layers applying…'
        : 'To Pads — applying Hum Melody layers…',
    );
  }, [draftHits.length, onApplyHumMelody, sendToPads]);

  const togglePlay = useCallback(() => {
    if (disabled) return;
    if (clickPlayActive) {
      stopClickPlay();
      return;
    }
    if (isPreviewing) {
      stopBarPreview();
      return;
    }
    // After a take: Play = recorded bars (Sync = both parts). Else metro click practice.
    if (draftHits.length > 0 || partsSync) {
      void previewDraft();
      return;
    }
    void beginClickPlay();
  }, [
    beginClickPlay,
    clickPlayActive,
    disabled,
    draftHits.length,
    isPreviewing,
    partsSync,
    previewDraft,
    stopBarPreview,
    stopClickPlay,
  ]);

  const clearDraft = useCallback(() => {
    clearPreviewTimers();
    setIsPreviewing(false);
    setDraftHits([]);
    setRawHits([]);
    lastDrumTakeRef.current = null;
    setStatus(`Cleared — ${bpm} BPM, Rec when ready.`);
  }, [bpm, clearPreviewTimers]);

  // Manual grid editing — tap a cell to add/remove a hit, drag a block to move it.
  const editStepSec = useMemo(
    () => vocalBoxStepSec(bpm, stepsPerBar, beatsPerBar),
    [beatsPerBar, bpm, stepsPerBar],
  );

  const toggleHitAt = useCallback(
    (role: VocalBoxDrumRole, step: number) => {
      const stepSec = editStepSec;
      setDraftHits((prev) => {
        const at = (h: VocalBoxHit) => Math.round(h.startSec / stepSec);
        const exists = prev.some((h) => h.role === role && at(h) === step);
        const next = exists
          ? prev.filter((h) => !(h.role === role && at(h) === step))
          : [...prev, { role, startSec: step * stepSec, velocity: 100 }];
        return next.sort((a, b) => a.startSec - b.startSec);
      });
    },
    [editStepSec],
  );

  const moveHitAt = useCallback(
    (role: VocalBoxDrumRole, from: number, to: number) => {
      if (from === to) return;
      const stepSec = editStepSec;
      setDraftHits((prev) => {
        const at = (h: VocalBoxHit) => Math.round(h.startSec / stepSec);
        let moved = false;
        const next = prev
          .filter((h) => !(h.role === role && at(h) === to))
          .map((h) => {
            if (!moved && h.role === role && at(h) === from) {
              moved = true;
              return { ...h, startSec: to * stepSec };
            }
            return h;
          });
        return next.sort((a, b) => a.startSec - b.startSec);
      });
    },
    [editStepSec],
  );

  useEffect(
    () => () => {
      cancelPrecount();
      clearPreviewTimers();
    },
    [cancelPrecount, clearPreviewTimers],
  );

  const hasDraft = draftHits.length > 0;
  const busy = capture.isRecording || isPrecounting || processing;
  const isModal = variant === 'modal';
  const humBodyH = isModal
    ? BEAT_PADS_VOCALBOX_MODAL_HUM_BODY_H_PX
    : BEAT_PADS_VOCALBOX_HUM_BODY_H_PX;
  const panelHeightPx = isModal
    ? undefined
    : humMelodyOpen
      ? BEAT_PADS_VOCALBOX_PANEL_H_PX +
        BEAT_PADS_VOCALBOX_HUM_TOGGLE_H_PX +
        BEAT_PADS_VOCALBOX_HUM_BODY_H_PX
      : BEAT_PADS_VOCALBOX_PANEL_H_PX + BEAT_PADS_VOCALBOX_HUM_TOGGLE_H_PX;

  return (
    <div
      className={`beat-pads-vocalbox-panel flex flex-col gap-1.5 rounded-lg border px-3 py-2${
        isModal ? ' min-h-0 flex-1 overflow-y-auto overflow-x-hidden' : ' shrink-0 overflow-hidden'
      }`}
      style={{
        height: panelHeightPx,
        minHeight: isModal ? undefined : undefined,
        width: isModal ? '100%' : undefined,
        borderColor: 'rgba(180, 40, 220, 0.65)',
        background: 'linear-gradient(165deg, #1a0a1e 0%, #0a060c 55%, #050408 100%)',
        boxShadow: isModal
          ? '0 16px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(213,0,249,0.25)'
          : '0 4px 18px rgba(0,0,0,0.7)',
      }}
      data-beat-pads-vocalbox
      data-vocalbox-hum-open={humMelodyOpen ? '1' : '0'}
      data-vocalbox-variant={variant}
    >
      <div className="flex flex-col gap-1.5 shrink-0">
      <div className="flex items-center justify-between gap-1.5 min-h-[28px]">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={BEAT_PADS_VOCALBOX_MIC_SRC}
            alt=""
            aria-hidden
            className="shrink-0 rounded-sm"
            style={{ ...BEAT_PADS_VOCALBOX_MIC_STYLE, height: isModal ? 28 : 22, width: isModal ? 68 : 52 }}
          />
          {isModal ? (
            <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
              <span className="vb-suite-title truncate">VocalBox</span>
              <span className="vb-suite-title-dash" aria-hidden>
                —
              </span>
              <span className="vb-suite-hum-title truncate">Hum / Melody Capture</span>
            </div>
          ) : null}
        </div>
        <div
          className="vb-vocalbox-tools-row flex flex-1 min-w-0 flex-nowrap items-center justify-end overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          <select
            value={quantize}
            disabled={disabled || busy}
            onChange={(e) => setQuantize(e.target.value as VocalBoxQuantize)}
            className={VOCALBOX_TOOL_SELECT}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 52,
              borderColor: 'rgba(124, 244, 198, 0.45)',
              color: '#9ee8c8',
              background: 'rgba(0,0,0,0.35)',
            }}
            title="Quantize grid"
            aria-label="VocalBox quantize"
          >
            {VOCALBOX_QUANTIZE_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <select
            value={captureBars}
            disabled={disabled || busy}
            onChange={(e) => setCaptureBars(vocalBoxClampCaptureBars(Number(e.target.value)))}
            className={VOCALBOX_TOOL_SELECT}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 44,
              borderColor: 'rgba(213, 0, 249, 0.45)',
              color: '#e8b0f8',
              background: 'rgba(0,0,0,0.35)',
            }}
            title="Capture length — 4 or 8 bars @ BPM"
            aria-label="VocalBox capture bars"
          >
            {VOCALBOX_CAPTURE_BAR_OPTIONS.map((bars) => (
              <option key={bars} value={bars}>
                {bars} bar
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setRecordMetroEnabled((v) => !v)}
            className={VOCALBOX_TOOL_BTN}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 34,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor: recordMetroEnabled ? 'rgba(120, 200, 255, 0.55)' : '#444',
              color: recordMetroEnabled ? '#9ec8ff' : '#666',
              background: recordMetroEnabled ? 'rgba(120, 180, 255, 0.1)' : 'transparent',
            }}
            title={recordMetroEnabled ? 'Metronome during capture' : 'Record metro off'}
          >
            Mtr
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPrecountEnabled((v) => !v)}
            className={VOCALBOX_TOOL_BTN}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 34,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor: precountEnabled ? 'rgba(255, 176, 128, 0.55)' : '#444',
              color: precountEnabled ? '#ffb080' : '#666',
              background: precountEnabled ? 'rgba(255, 120, 60, 0.1)' : 'transparent',
            }}
            title={
              precountEnabled
                ? 'Count-in before Rec only (1-2-3-4) — not used on Play'
                : 'Count-in off'
            }
          >
            Cnt
          </button>
          <button
            type="button"
            disabled={disabled || isPreviewing || clickPlayActive}
            onClick={toggleRecord}
            className={`inline-flex shrink-0 items-center justify-center gap-1 ${VOCALBOX_TOOL_BTN}`}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 44,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor:
                (!clickPlayActive && (recSessionActive || capture.isRecording || isPrecounting))
                  ? '#e85d7588'
                  : 'rgba(213, 0, 249, 0.5)',
              background:
                (!clickPlayActive && (recSessionActive || capture.isRecording || isPrecounting))
                  ? 'rgba(232, 93, 117, 0.18)'
                  : 'rgba(213, 0, 249, 0.12)',
              color:
                (!clickPlayActive && (recSessionActive || capture.isRecording || isPrecounting))
                  ? '#ff8a9a'
                  : '#e8b0f8',
            }}
          >
            {!clickPlayActive && (recSessionActive || capture.isRecording || isPrecounting) ? (
              <Square size={9} fill="currentColor" />
            ) : (
              <Mic size={9} />
            )}
            {!clickPlayActive && (recSessionActive || capture.isRecording || isPrecounting)
              ? 'Stop'
              : 'Rec'}
          </button>
          <button
            type="button"
            disabled={disabled || busy || capture.isRecording}
            onClick={togglePlay}
            className={`inline-flex shrink-0 items-center justify-center gap-1 ${VOCALBOX_TOOL_BTN}`}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 44,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor:
                clickPlayActive || isPreviewing
                  ? 'rgba(124, 244, 198, 0.65)'
                  : 'rgba(124, 244, 198, 0.45)',
              color: clickPlayActive || isPreviewing ? '#e8fff6' : '#7cf4c6',
              background:
                clickPlayActive || isPreviewing
                  ? 'rgba(124, 244, 198, 0.18)'
                  : 'rgba(124, 244, 198, 0.08)',
            }}
            title={
              clickPlayActive || isPreviewing
                ? 'Stop play'
                : hasDraft || partsSync
                  ? partsSync
                    ? 'Play recorded bars — Sync On plays drums + Hum Melody together'
                    : 'Play recorded drum bars'
                  : 'Play Mtr + count box (no record) — practice clicks'
            }
          >
            {clickPlayActive || isPreviewing ? (
              <Square size={9} fill="currentColor" />
            ) : (
              <Play size={9} fill="currentColor" />
            )}
            {clickPlayActive || isPreviewing ? 'Stop' : 'Play'}
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPartsSync((v) => !v)}
            className={VOCALBOX_TOOL_BTN}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 40,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor: partsSync ? 'rgba(124, 244, 198, 0.55)' : '#444',
              color: partsSync ? '#7cf4c6' : '#888',
              background: partsSync ? 'rgba(124, 244, 198, 0.12)' : 'transparent',
            }}
            title={
              partsSync
                ? 'Sync ON — Play starts VocalBox + Hum Melody together'
                : 'Sync OFF — each Play is solo'
            }
          >
            Sync {partsSync ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            disabled={disabled || !hasDraft}
            onClick={clearDraft}
            className={VOCALBOX_TOOL_BTN}
            style={{ ...VOCALBOX_TOOL_FONT, minWidth: 38, paddingLeft: 6, paddingRight: 6, borderColor: '#444', color: '#888' }}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setReplaceLanes((v) => !v)}
            className={VOCALBOX_TOOL_BTN}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 34,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor: replaceLanes ? 'rgba(213, 0, 249, 0.45)' : 'rgba(124, 244, 198, 0.45)',
              color: replaceLanes ? '#e8b0f8' : '#7cf4c6',
            }}
            title={replaceLanes ? 'Replace lanes on To Pads' : 'Add on To Pads'}
          >
            {replaceLanes ? 'Rpl' : 'Add'}
          </button>
          <button
            type="button"
            disabled={disabled || busy || (!hasDraft && !onApplyHumMelody)}
            onClick={syncToBeatPads}
            className={VOCALBOX_TOOL_BTN}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 52,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor: 'rgba(124, 244, 198, 0.55)',
              color: '#7cf4c6',
              background: 'rgba(124, 244, 198, 0.1)',
            }}
            title="Push drums + Hum Melody onto Beat Pads / Beat Lab grid"
          >
            To Pads
          </button>
          {isModal && typeof onClose === 'function' ? (
            <button
              type="button"
              onClick={onClose}
              className={VOCALBOX_TOOL_BTN}
              style={{
                ...VOCALBOX_TOOL_FONT,
                minWidth: 44,
                paddingLeft: 8,
                paddingRight: 8,
                borderColor: 'rgba(255,255,255,0.22)',
                color: '#c8c0d0',
                background: 'rgba(255,255,255,0.06)',
              }}
              title="Close VocalBox"
              aria-label="Close VocalBox"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
      <div className="vb-intensity-slot">
        <VocalBoxHumIntensitySlider
          size="compact"
          value={drumIntensity}
          onChange={(v) => setDrumIntensity(clampVocalBoxDrumIntensity(v))}
          disabled={disabled || busy || capture.isRecording || isPrecounting}
          ariaLabel="VocalBox drum intensity gate"
          helpTitle="VocalBox Intensity"
          helpBody={
            'Controls how easy mouth-drum hits get into the grid after Rec.\n\nHard (low) = only strong boom / ka hits pass — soft breaths and weak scraps stay out.\n\nOpen (high) = quieter / softer hits can also land on the pads.\n\nDefault 55 is the locked sweet spot. Drag after a take to re-gate without recording again. Independent from Hum Melody Intensity.'
          }
        />
      </div>
      <div className="vb-rec-count-below" title="Each click shows its beat number">
        <label
          className="shrink-0 inline-flex items-center gap-0.5 rounded border px-1"
          style={{
            ...VOCALBOX_TOOL_FONT,
            height: 24,
            borderColor: 'rgba(213,0,249,0.35)',
            color: '#c890e0',
            background: 'rgba(0,0,0,0.35)',
          }}
          title="Beat Pads / VocalBox shared tempo"
        >
          <button
            type="button"
            disabled={disabled || busy || !onBpmChange}
            className={VOCALBOX_TOOL_BTN}
            style={{ ...VOCALBOX_TOOL_FONT, minWidth: 22, padding: 0, border: 'none', background: 'transparent', color: '#e8b0f8' }}
            onClick={() => onBpmChange?.(clampBeatPadsBpm(bpm - 1))}
            aria-label="Decrease BPM"
          >
            −
          </button>
          <input
            type="number"
            min={BEAT_PADS_MIN_BPM}
            max={BEAT_PADS_MAX_BPM}
            value={Math.round(bpm)}
            disabled={disabled || busy || !onBpmChange}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onBpmChange?.(clampBeatPadsBpm(v));
            }}
            style={{
              width: 40,
              height: 20,
              border: 'none',
              background: 'transparent',
              color: '#f0c0ff',
              fontWeight: 800,
              textAlign: 'center',
              outline: 'none',
            }}
            aria-label="VocalBox BPM"
            title="Change BPM — updates Beat Pads + Hum Melody together"
          />
          <button
            type="button"
            disabled={disabled || busy || !onBpmChange}
            className={VOCALBOX_TOOL_BTN}
            style={{ ...VOCALBOX_TOOL_FONT, minWidth: 22, padding: 0, border: 'none', background: 'transparent', color: '#e8b0f8' }}
            onClick={() => onBpmChange?.(clampBeatPadsBpm(bpm + 1))}
            aria-label="Increase BPM"
          >
            +
          </button>
        </label>
        <div
          ref={recCountBoxRef}
          className="vb-rec-count-box vb-rec-count-box--idle"
          aria-live="off"
          aria-label="Record beat count"
        >
          <span ref={recBeatDigitRef} />
        </div>
      </div>
      </div>

      <VocalBoxMouthSoundHint />

      {isModal ? (
        <p className="vb-suite-section vb-suite-section--drums shrink-0 m-0">
          1 · Beatbox drums — Rec / Preview / Send to pad grid
        </p>
      ) : null}

      <div
        className="relative flex flex-col gap-1 flex-1 min-h-0 justify-center rounded-md"
        style={{
          background: '#0e0f13',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: isModal ? '8px 0' : '4px 0',
          maxHeight: isModal ? 188 : 168,
          minHeight: isModal ? 156 : undefined,
          flex: isModal ? '0 0 auto' : undefined,
        }}
      >
        <VocalBoxBeatRuler
          totalCols={totalCols}
          stepsPerBeat={stepsPerBeat}
          beatsPerBar={beatsPerBar}
          captureBars={captureBars}
          rulerRef={beatRulerRef}
        />
        {VOCALBOX_DRUM_ROLES.map((role) => (
          <VocalBoxLaneRow
            key={role}
            role={role}
            steps={laneSteps[role]}
            totalCols={totalCols}
            stepsPerBar={stepsPerBar}
            stepsPerBeat={stepsPerBeat}
            liveLevel={capture.isRecording && roleMask[role] ? liveRoleLevel[role] : 0}
            isRecording={capture.isRecording && roleMask[role]}
            enabled={roleMask[role]}
            onToggleEnabled={() => toggleRole(role)}
            editable={!disabled && !busy && !isPreviewing && roleMask[role]}
            onToggleStep={(step) => toggleHitAt(role, step)}
            onMoveStep={(from, to) => moveHitAt(role, from, to)}
            disabled={disabled || busy}
          />
        ))}
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: VOCALBOX_TRACK_INSET.left,
            right: VOCALBOX_TRACK_INSET.right,
            top: VOCALBOX_BEAT_RULER_H + 4,
            bottom: 0,
          }}
          aria-hidden
        >
          <div
            ref={playheadRef}
            className="absolute inset-y-0"
            style={{
              left: '0%',
              width: 3,
              marginLeft: -1.5,
              opacity: 0,
              background: 'linear-gradient(180deg, #fff 0%, #7cf4c6 100%)',
              boxShadow: '0 0 8px rgba(124,244,198,0.95), 0 0 3px rgba(255,255,255,0.9)',
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      <p
        className="shrink-0 font-semibold leading-snug line-clamp-2"
        style={{ ...VOCALBOX_TOOL_FONT, color: '#8a7a92' }}
      >
        {status}
        {isPrecounting && recBeatNumber != null ? (
          <span style={{ color: '#ffb080' }}> · pre-count {recBeatNumber}</span>
        ) : capture.isRecording ? (
          <span style={{ color: '#D500F9' }}> · {Math.round(micLevel * 100)}%</span>
        ) : null}
      </p>

      <div
        className="shrink-0 flex flex-col min-h-0"
        style={{
          borderTop: `1px solid ${HUM_MELODY_ACCENT}33`,
          marginTop: 2,
          paddingTop: 2,
        }}
      >
        {isModal ? (
          <p className="vb-suite-section shrink-0 m-0 mb-1">
            2 · Hum Melody — Melody / Bass / Lead rolls · Save each to its track
          </p>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setHumMelodyOpen((o) => {
              const next = !o;
              if (next) setHumMelodyMounted(true);
              return next;
            });
          }}
          className="flex w-full shrink-0 items-center justify-between gap-2 rounded border px-2 text-left outline-none transition-colors hover:bg-white/[0.04] disabled:opacity-40"
          style={{
            height: BEAT_PADS_VOCALBOX_HUM_TOGGLE_H_PX - 2,
            borderColor: humMelodyOpen ? `${HUM_MELODY_ACCENT}66` : `${HUM_MELODY_ACCENT}33`,
            background: humMelodyOpen ? `${HUM_MELODY_ACCENT}14` : 'rgba(0,0,0,0.25)',
            color: HUM_MELODY_ACCENT,
          }}
          aria-expanded={humMelodyOpen}
          aria-label={
            humMelodyOpen
              ? 'Collapse Hum Melody Capture'
              : 'Expand Hum Melody Capture — hum, sing, or whistle a melody'
          }
          title="Hum Melody Capture — hum · sing · whistle → MIDI melody"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {humMelodyOpen ? (
              <ChevronDown size={12} strokeWidth={2.5} aria-hidden />
            ) : (
              <ChevronUp size={12} strokeWidth={2.5} aria-hidden />
            )}
            <span className="vb-suite-section truncate" style={{ fontSize: 11 }}>
              Hum Melody Capture
            </span>
            <span className="vb-suite-subtitle" style={{ textTransform: 'none', letterSpacing: '0.06em' }}>
              hum · sing · whistle → MIDI
            </span>
          </span>
          <span
            className="shrink-0 rounded border px-1.5 py-0.5 font-bold uppercase"
            style={{
              ...VOCALBOX_TOOL_FONT,
              fontSize: 8,
              borderColor: `${HUM_MELODY_ACCENT}55`,
              color: HUM_MELODY_ACCENT,
              background: `${HUM_MELODY_ACCENT}12`,
            }}
          >
            {humMelodyOpen ? 'Hide' : 'Show'}
          </span>
        </button>

        {humMelodyMounted && humMelodyOpen ? (
          <div
            className={`mt-1 min-h-0 overflow-hidden rounded border${isModal ? ' flex flex-col' : ' shrink-0'}`}
            style={{
              height: isModal ? undefined : humBodyH,
              minHeight: isModal ? BEAT_PADS_VOCALBOX_MODAL_HUM_BODY_H_PX : undefined,
              flex: isModal ? '1 1 auto' : undefined,
              borderColor: `${HUM_MELODY_ACCENT}28`,
              background: 'linear-gradient(180deg, #081018 0%, #04080c 100%)',
            }}
            data-beat-pads-vocalbox-hum-melody
          >
            <Suspense
              fallback={
                <p className="m-0 px-2 py-2 text-[9px] font-semibold" style={{ color: '#7a9aaa' }}>
                  Loading Hum Melody…
                </p>
              }
            >
              <BeatPadsVocalBoxHumMelodyPanelLazy
                bpm={bpm}
                loopBars={loopBars}
                disabled={disabled}
                drumsBusy={busy}
                getAudioContext={getAudioContext}
                getAudioOutput={getAudioOutput}
                getPreviewDestination={getHumMelodyPreviewDestination}
                warmAudio={warmAudio}
                songKeyRoot={songKeyRoot}
                songKeyMode={songKeyMode}
                onApply={onApplyHumMelody}
                onBpmChange={onBpmChange}
                partsSync={partsSync}
                onPartsSyncChange={setPartsSync}
                syncAuditionNonce={humSyncAuditionNonce}
                syncAuditionStopNonce={humAuditionStopNonce}
                syncToPadsNonce={humSyncToPadsNonce}
                getSyncAuditionStartAtSec={() => syncStartAtSecRef.current}
                onSyncPlayDrums={syncPlayDrumsFromMelody}
                onSyncToBeatPads={syncToBeatPads}
                gridQuantize={quantize}
              />
            </Suspense>
          </div>
        ) : null}
      </div>
    </div>
  );
}
