'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Mic, Play, Square } from 'lucide-react';

import { useVocalCapture, type UseVocalCaptureResult } from '@/app/hooks/useVocalCapture';
import type { BeatPadsDrumPattern, BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { beatPadsPatternCols } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  alignAndQuantizeVocalBoxHits,
  detectBeatboxVocalBoxHits,
  mergeVocalBoxHitsIntoPattern,
  trimAudioBufferFromSec,
  vocalBoxBarSec,
  vocalBoxCaptureDurationSec,
  vocalBoxDefaultQuantize,
  vocalBoxHitsToLaneSteps,
  vocalBoxLeadingSilenceSec,
  vocalBoxStepSec,
  VOCALBOX_CAPTURE_BAR_OPTIONS,
  VOCALBOX_DEFAULT_CAPTURE_BARS,
  VOCALBOX_DEFAULT_ROLE_MASK,
  VOCALBOX_QUANTIZE_OPTIONS,
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
  ensureSe2PrecountRimshotBuffer,
  runSe2Precount,
  SE2_PRECOUNT_CLICK_VOLUME,
} from '@/app/lib/studio/se2Precount';

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

export const BEAT_PADS_VOCALBOX_TAGLINE =
  '(create your own drum pattern with your mouth)';

/** Dropdown height — sits above pad FX (capped under the FX box height). */
export const BEAT_PADS_VOCALBOX_PANEL_H_PX = 224;

/** Lead before preview playback starts — shared by the scheduler and the preview playhead. */
const VOCALBOX_PREVIEW_LEAD_MS = 200;
/**
 * Fixed capture window (seconds). The bar-based cutoff was stopping the take early
 * (~1 bar). Per owner: after the count-in, keep recording + metronome running for a
 * generous window so the take never cuts off before the end of the grid.
 */
const VOCALBOX_RECORD_WINDOW_SEC = 10;
/** Lanes/playhead track sit inside this inset (kit button 38px + 6px gap · count 14px + 6px gap). */
const VOCALBOX_TRACK_INSET = { left: 44, right: 20 } as const;
/** Drum-grid lane sizing — taller than a meter so cells read as sequencer squares. */
const VOCALBOX_LANE_ROW_H = 34;
const VOCALBOX_LANE_TRACK_H = 28;

const VOCALBOX_SOUND_HINT = {
  kick: 'boom',
  snare: 'ka',
} as const;

const VOCALBOX_TOOL_FONT: CSSProperties = { fontSize: 11, lineHeight: 1.2 };
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
  const [recordMetroEnabled, setRecordMetroEnabled] = useState(true);
  const [isPrecounting, setIsPrecounting] = useState(false);
  const [precountBeatUi, setPrecountBeatUi] = useState<{ beat: number; total: number } | null>(null);
  const [recordBeatUi, setRecordBeatUi] = useState<{ beat: number; total: number } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [liveRoleLevel, setLiveRoleLevel] = useState<Record<VocalBoxDrumRole, number>>({
    kick: 0,
    snare: 0,
    hat: 0,
    clap: 0,
  });
  const processingRef = useRef(false);
  const recordStopPendingRef = useRef(false);
  const precountCancelRef = useRef(false);
  const precountBufRef = useRef<AudioBuffer | null>(null);
  const scheduledPrecountNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const recordMetroAnchorRef = useRef<number | null>(null);
  /** Audio-clock time of the capture downbeat — drives the record playhead (set even if metro is off). */
  const recordAnchorRef = useRef<number | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
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

  const cancelPrecount = useCallback(() => {
    precountCancelRef.current = true;
    cancelScheduledPrecountNodes();
    if (captureApiRef.current?.isRecording) {
      captureApiRef.current.stopRecord();
    }
    captureApiRef.current?.releaseMic();
    setIsPrecounting(false);
    setPrecountBeatUi(null);
  }, [cancelScheduledPrecountNodes]);

  const schedulePrecountClick = useCallback(
    (
      ctx: AudioContext,
      idealT: number,
      downbeat: boolean,
      opts?: { volumeScale?: number },
    ) => {
      let buf = precountBufRef.current;
      if (!buf && ctx.state !== 'closed') {
        buf = createSe2PrecountRimshotBuffer(ctx);
        precountBufRef.current = buf;
      }
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      const scale = opts?.volumeScale ?? 1;
      g.gain.value =
        (downbeat ? SE2_PRECOUNT_CLICK_VOLUME * 1.12 : SE2_PRECOUNT_CLICK_VOLUME) * scale;
      src.connect(g);
      const dest = getAudioOutput?.() ?? ctx.destination;
      g.connect(dest);
      const when = Math.max(ctx.currentTime, idealT);
      try {
        src.start(when);
        scheduledPrecountNodesRef.current.push(src);
      } catch {
        /* */
      }
    },
    [getAudioOutput],
  );

  const scheduleRecordMetronome = useCallback(
    (ctx: AudioContext, anchorT: number) => {
      if (!recordMetroEnabled) return;
      const b = Math.max(30, Math.min(300, bpm));
      const spb = 60 / b;
      const bpb = Math.max(1, Math.round(beatsPerBar));
      // Quarter-note clicks across the whole fixed record window (continuation of the
      // count-in), not just a bar or two — so the metronome never shuts off early.
      const totalBeats = Math.ceil(VOCALBOX_RECORD_WINDOW_SEC / spb) + 1;
      const metroVol = 0.68;
      for (let i = 0; i < totalBeats; i += 1) {
        schedulePrecountClick(ctx, anchorT + i * spb, i % bpb === 0, { volumeScale: metroVol });
      }
      recordMetroAnchorRef.current = anchorT;
    },
    [beatsPerBar, bpm, recordMetroEnabled, schedulePrecountClick],
  );

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
        // gridOriginFileSecRef is where the downbeat (first bar-count click) is expected in
        // the file. Snap t=0 to the actual first onset within a tight window around it, so
        // the take locks to the bar count regardless of any residual recorder latency —
        // without drifting off if the very first hit lands early or late.
        const anchorSearchLeadSec = 0.12;
        const searchStartSec = Math.max(0, gridOriginFileSecRef.current - anchorSearchLeadSec);
        const searchClip = trimAudioBufferFromSec(buffer, searchStartSec, anchorSearchLeadSec + 0.18);
        const onsetInWindowSec = vocalBoxLeadingSilenceSec(searchClip, anchorSearchLeadSec + 0.18);
        const downbeatSec = searchStartSec + onsetInWindowSec;
        // Analyze the whole fixed record window (not a single bar) so a full take is
        // detected end-to-end instead of being cut off after ~1 bar.
        const fromDownbeat = trimAudioBufferFromSec(buffer, downbeatSec, VOCALBOX_RECORD_WINDOW_SEC + 0.06);
        const raw = detectBeatboxVocalBoxHits(fromDownbeat, VOCALBOX_RECORD_WINDOW_SEC, roleMask);
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
    setRecordBeatUi(null);
    const totalBeats = captureBars * Math.max(1, Math.round(beatsPerBar));
    setStatus(`Recording ${captureBars} bar @ ${bpm} BPM${recordMetroEnabled ? ' + metro' : ''}…`);
    return () => {
      setRecordBeatUi(null);
      recordMetroAnchorRef.current = null;
      recordAnchorRef.current = null;
    };
  }, [beatsPerBar, bpm, capture.isRecording, captureBars, recordMetroEnabled]);

  // Keep the AudioContext running for the whole capture. The count-in (runSe2Precount)
  // resumes the context every frame while it runs; once it hands off, nothing keeps it
  // awake, so the shared context can suspend and the already-scheduled record-metronome
  // clicks stop firing after only a click or two. Re-resume each frame while recording so
  // the metronome plays through as a seamless continuation of the count-in.
  useEffect(() => {
    if (!capture.isRecording) return;
    const ctx = getAudioContext?.();
    if (!ctx) return;
    let raf = 0;
    const keepAwake = () => {
      if (ctx.state === 'suspended') void ctx.resume();
      raf = requestAnimationFrame(keepAwake);
    };
    keepAwake();
    return () => cancelAnimationFrame(raf);
  }, [capture.isRecording, getAudioContext]);

  useEffect(() => {
    if (!capture.isRecording || !recordMetroEnabled) return;
    const anchor = recordMetroAnchorRef.current;
    if (anchor == null) return;
    const ctx = getAudioContext?.();
    if (!ctx) return;
    const spb = 60 / Math.max(30, Math.min(300, bpm));
    const totalBeats = captureBars * Math.max(1, Math.round(beatsPerBar));
    let raf = 0;
    const tick = () => {
      const beatIdx = Math.min(totalBeats, Math.max(1, Math.floor((ctx.currentTime - anchor) / spb) + 1));
      setRecordBeatUi({ beat: beatIdx, total: totalBeats });
      if (ctx.currentTime < anchor + totalBeats * spb + 0.05) {
        raf = requestAnimationFrame(tick);
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [beatsPerBar, bpm, capture.isRecording, captureBars, getAudioContext, recordMetroEnabled]);

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
    // Recording starts a hair before the downbeat (pre-roll for the first hit), so the
    // window spans the count-in plus the fixed take length.
    const countInSec = precountEnabled ? vocalBoxBarSec(bpm, beatsPerBar) : 0;
    const durMs = (countInSec + VOCALBOX_RECORD_WINDOW_SEC) * 1000 + 120;
    const t = window.setTimeout(() => {
      if (!isRecordingRef.current) return;
      recordStopPendingRef.current = true;
      stopRecordRef.current();
      setStatus('Processing…');
    }, durMs);
    return () => window.clearTimeout(t);
  }, [capture.isRecording, beatsPerBar, bpm, precountEnabled]);

  const beginRecordWithOptionalPrecount = useCallback(async () => {
    if (disabled) return;
    setIsPrecounting(true);
    setPrecountBeatUi(null);
    setStatus(`Arming @ ${bpm} BPM…`);

    const ctx = await resolveVocalBoxAudioContext(getAudioContext, warmAudio);
    if (!ctx) {
      setIsPrecounting(false);
      setStatus('Audio not ready — tap Play once, then Rec.');
      return;
    }

    const micOk = await capture.armMic();
    if (!micOk) {
      setIsPrecounting(false);
      setStatus('Mic blocked — allow microphone access.');
      return;
    }

    setDraftHits([]);
    setRawHits([]);
    recordStopPendingRef.current = false;

    try {
      let recordAnchor = ctx.currentTime + 0.08;
      const countInDurSec = vocalBoxBarSec(bpm, beatsPerBar);
      let recordStarted = false;

      if (precountEnabled || recordMetroEnabled) {
        precountBufRef.current = await ensureSe2PrecountRimshotBuffer(ctx);
      }

      if (precountEnabled) {
        precountCancelRef.current = false;
        setStatus(`${bpm} BPM — count-in…`);
        cancelScheduledPrecountNodes();
        // Start the recorder BEFORE the pre-count so it runs continuously through the whole
        // count-in and is already capturing (no MediaRecorder start-up lag) by the time the
        // bar count comes in. The downbeat sits exactly one count-in bar into the file, so
        // that is where analysis anchors t=0.
        gridOriginFileSecRef.current = countInDurSec;
        await capture.startRecord();
        recordStarted = true;

        const result = await runSe2Precount({
          ctx,
          bpm,
          beatsPerBar,
          bars: 1,
          scheduleClick: (idealT, downbeat) => schedulePrecountClick(ctx, idealT, downbeat),
          onBeat: (beat, total) => {
            setPrecountBeatUi({ beat, total });
            setStatus(`${bpm} BPM — ${beat}/${total}`);
          },
          isCancelled: () => precountCancelRef.current,
        });

        cancelScheduledPrecountNodes();

        if (result.cancelled) {
          capture.releaseMic();
          if (capture.isRecording) capture.stopRecord();
          setStatus('Count-in cancelled.');
          return;
        }
        recordAnchor = result.downbeatAudioTime;
      } else {
        gridOriginFileSecRef.current = 0;
      }

      recordAnchorRef.current = recordAnchor;
      scheduleRecordMetronome(ctx, recordAnchor);
      setIsPrecounting(false);
      setPrecountBeatUi(null);
      if (!recordStarted) {
        await capture.startRecord();
      }
    } catch (err) {
      capture.releaseMic();
      setStatus(err instanceof Error ? err.message : 'Record failed.');
    } finally {
      setIsPrecounting(false);
      setPrecountBeatUi(null);
    }
  }, [
    bpm,
    beatsPerBar,
    cancelScheduledPrecountNodes,
    capture,
    captureBars,
    disabled,
    getAudioContext,
    precountEnabled,
    recordMetroEnabled,
    schedulePrecountClick,
    scheduleRecordMetronome,
    warmAudio,
  ]);

  const toggleRecord = useCallback(() => {
    if (disabled) return;
    if (capture.isRecording) {
      recordStopPendingRef.current = true;
      cancelScheduledPrecountNodes();
      capture.stopRecord();
      setStatus('Processing…');
      return;
    }
    if (isPrecounting) {
      cancelPrecount();
      setStatus('Count-in cancelled.');
      return;
    }
    void beginRecordWithOptionalPrecount();
  }, [beginRecordWithOptionalPrecount, cancelPrecount, capture, disabled, isPrecounting]);

  const previewDraft = useCallback(async () => {
    if (draftHits.length === 0 || !onStrikePad) {
      setStatus('Nothing to preview — record first.');
      return;
    }
    clearPreviewTimers();
    const ctx = await resolveVocalBoxAudioContext(getAudioContext, warmAudio);
    if (!ctx) {
      setStatus('Audio not ready — tap a pad or Play once, then Pvw.');
      return;
    }

    const hits = draftHits.filter((h) => h.startSec >= 0 && h.startSec < VOCALBOX_RECORD_WINDOW_SEC);
    if (hits.length === 0) {
      setStatus('No hits in capture window — record again.');
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
    const previewDurSec = lastHitSec + 0.6;
    previewDurSecRef.current = previewDurSec;

    const leadSec = VOCALBOX_PREVIEW_LEAD_MS / 1000;
    // Anchor every hit to one AudioContext time so playback is sample-accurate and even
    // (setTimeout batching was what made parts rush / sound "too fast").
    const startAtSec = ctx.currentTime + leadSec;
    previewAnchorSecRef.current = startAtSec;

    setIsPreviewing(true);
    setStatus(
      missingSamples.length > 0
        ? `Preview — load ${missingSamples.join('+')} sample(s) on routed pad(s).`
        : `Preview ${captureBars} bar @ ${bpm} BPM…`,
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
      setIsPreviewing(false);
      setStatus('Pads need samples — load kick/snare (Load kit), then Pvw.');
      return;
    }

    const doneTimer = setTimeout(() => {
      setIsPreviewing(false);
      setStatus(`${captureBars} bar ready — Preview done. Tap Send for grid.`);
    }, VOCALBOX_PREVIEW_LEAD_MS + previewDurSec * 1000 + 120);
    previewTimersRef.current.push(doneTimer);
  }, [
    bpm,
    captureBars,
    clearPreviewTimers,
    draftHits,
    getAudioContext,
    hasPadSample,
    onEnsurePadSamples,
    onStrikePad,
    padMap,
    warmAudio,
  ]);

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

  const clearDraft = useCallback(() => {
    clearPreviewTimers();
    setIsPreviewing(false);
    setDraftHits([]);
    setRawHits([]);
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

  return (
    <div
      className="beat-pads-vocalbox-panel flex shrink-0 flex-col gap-1 overflow-hidden rounded-md border px-2 py-1.5"
      style={{
        height: BEAT_PADS_VOCALBOX_PANEL_H_PX,
        borderColor: 'rgba(150, 0, 180, 0.55)',
        background: 'linear-gradient(165deg, #150818 0%, #070509 100%)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.7)',
      }}
    >
      <div className="flex items-center justify-between gap-1.5 shrink-0 min-h-[26px]">
        <img
          src={BEAT_PADS_VOCALBOX_MIC_SRC}
          alt=""
          aria-hidden
          className="shrink-0 rounded-sm"
          style={{ ...BEAT_PADS_VOCALBOX_MIC_STYLE, height: 22, width: 52 }}
        />
        <div
          className="flex flex-1 min-w-0 flex-nowrap items-center justify-end gap-1 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          <span
            className="shrink-0 rounded border px-1.5 py-0.5 font-extrabold tabular-nums text-center"
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 30,
              borderColor: 'rgba(213,0,249,0.35)',
              color: '#c890e0',
            }}
            title="Session tempo"
          >
            {bpm}
          </span>
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
            onChange={(e) => setCaptureBars(Number(e.target.value) === 1 ? 1 : 2)}
            className={VOCALBOX_TOOL_SELECT}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 44,
              borderColor: 'rgba(213, 0, 249, 0.45)',
              color: '#e8b0f8',
              background: 'rgba(0,0,0,0.35)',
            }}
            title="Capture length — 1 or 2 bars"
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
            title={precountEnabled ? '1-bar count-in (1-2-3-4)' : 'Count-in off'}
          >
            Cnt
          </button>
          <button
            type="button"
            disabled={disabled || isPreviewing}
            onClick={toggleRecord}
            className={`inline-flex shrink-0 items-center justify-center gap-1 ${VOCALBOX_TOOL_BTN}`}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 44,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor:
                capture.isRecording || isPrecounting ? '#e85d7588' : 'rgba(213, 0, 249, 0.5)',
              background:
                capture.isRecording || isPrecounting
                  ? 'rgba(232, 93, 117, 0.18)'
                  : 'rgba(213, 0, 249, 0.12)',
              color: capture.isRecording || isPrecounting ? '#ff8a9a' : '#e8b0f8',
            }}
          >
            {capture.isRecording || isPrecounting ? (
              <Square size={9} fill="currentColor" />
            ) : (
              <Mic size={9} />
            )}
            {capture.isRecording
              ? recordBeatUi
                ? `${recordBeatUi.beat}/${recordBeatUi.total}`
                : `${capture.recordingTime}s`
              : isPrecounting && precountBeatUi
                ? `${precountBeatUi.beat}/${precountBeatUi.total}`
                : 'Rec'}
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
            title={replaceLanes ? 'Replace lanes on send' : 'Add on send'}
          >
            {replaceLanes ? 'Rpl' : 'Add'}
          </button>
          <button
            type="button"
            disabled={disabled || !hasDraft || isPreviewing || busy}
            onClick={() => void previewDraft()}
            className={`inline-flex shrink-0 items-center justify-center gap-1 ${VOCALBOX_TOOL_BTN}`}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 44,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor: 'rgba(120, 180, 255, 0.55)',
              color: '#9ec8ff',
              background: isPreviewing ? 'rgba(120, 180, 255, 0.15)' : 'rgba(120, 180, 255, 0.08)',
            }}
            title="Preview on pads"
          >
            <Play size={9} fill="currentColor" />
            Pvw
          </button>
          <button
            type="button"
            disabled={disabled || !hasDraft || busy}
            onClick={sendToPads}
            className={VOCALBOX_TOOL_BTN}
            style={{
              ...VOCALBOX_TOOL_FONT,
              minWidth: 40,
              paddingLeft: 6,
              paddingRight: 6,
              borderColor: 'rgba(124, 244, 198, 0.55)',
              color: '#7cf4c6',
              background: 'rgba(124, 244, 198, 0.1)',
            }}
          >
            Send
          </button>
        </div>
      </div>

      <VocalBoxMouthSoundHint />

      <div
        className="relative flex flex-col gap-0.5 flex-1 min-h-0 justify-center rounded-md"
        style={{ background: '#0e0f13', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 0' }}
      >
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
        {(capture.isRecording || isPrecounting || isPreviewing) ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ left: VOCALBOX_TRACK_INSET.left, right: VOCALBOX_TRACK_INSET.right }}
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
                transition: 'opacity 90ms linear',
              }}
            />
          </div>
        ) : null}
      </div>

      <p
        className="shrink-0 font-semibold leading-snug line-clamp-2"
        style={{ ...VOCALBOX_TOOL_FONT, color: '#8a7a92' }}
      >
        {status}
        {capture.isRecording ? (
          <span style={{ color: '#D500F9' }}> · {Math.round(micLevel * 100)}%</span>
        ) : isPrecounting && precountBeatUi ? (
          <span style={{ color: '#ffb080' }}> · {precountBeatUi.beat}/{precountBeatUi.total}</span>
        ) : null}
      </p>
    </div>
  );
}
