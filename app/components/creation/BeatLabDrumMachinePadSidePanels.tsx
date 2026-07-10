'use client';

import { CircleHelp, FolderOpen, Layers, Pencil, Play, Power, Undo2, Upload } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  BeatLabPadSampleFxWaveform,
  type BeatLabPadSampleFxWaveformProps,
} from '@/app/components/creation/BeatLabPadSampleFxWaveform';
import {
  BeatPadsFxCompGraph,
  BeatPadsFxDriveGraph,
  BeatPadsFxEqGraph,
  BeatPadsFxFilterGraph,
  BeatPadsFxSuiteFader,
  BeatPadsFxSuiteKnob,
  BeatPadsFxSuiteInsertShell,
  BeatPadsFxSuiteMeterViz,
  useBeatPadsFxMeterPulse,
} from '@/app/components/creation/BeatPadsFxSuiteInsert';
import { BeatPadsInstrumentSuitePanel } from '@/app/components/creation/BeatPadsInstrumentSuitePhases';
import {
  BeatPadsDelaySuitePanel,
  BeatPadsReverbSuitePanel,
} from '@/app/components/creation/BeatPadsSendSuitePanels';
import { LimiterCeilingViz } from '@/app/components/studio/studioFxSuiteWidgets';
import { SynthRoundKnob, type SynthRoundKnobProps } from '@/app/components/creation/BeatLabSynthV2Knob';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { BEAT_PADS_LANE_GM_PITCH } from '@/app/lib/creationStation/beatPadsStudioExport';
import { BeatPadsSpreadPianoRoll } from '@/app/components/creation/BeatPadsSpreadPianoRoll';
import {
  BEAT_PADS_PAD_SPREAD_BADGE_STYLE,
  BEAT_PADS_PAD_SPREAD_HELP,
} from '@/app/lib/creationStation/beatPadsPadSpreadInstructions';
import { beatPadsSpreadRollPopoverWidth } from '@/app/lib/creationStation/beatPadsSpreadTrack';
import type { BeatPadsSpreadLoopBars, BeatPadsSpreadNote } from '@/app/lib/creationStation/beatPadsSpreadTrack';
import {
  BEAT_LAB_DRUM_PAD_NOTE_REPEAT_OPTIONS,
  BEAT_LAB_DRUM_PAD_SAMPLE_PARAMS,
  BEAT_LAB_DRUM_PAD_SEQUENCER_PARAMS,
  beatLabDrumPadVoiceParamValue,
  beatLabDrumPadVoiceWithNoteRepeat,
  beatLabDrumPadVoiceWithParam,
  beatLabDrumVoiceDecayToSampler,
  beatLabDrumVoiceGridVelocity,
  beatLabDrumVoiceScheduleOffsetSec,
  beatPadSamplerTrim1ToDecay,
  clampBeatLabDrumPadVoiceOpts,
  defaultBeatLabDrumPadVoiceOpts,
  type BeatLabDrumPadNoteRepeat,
  type BeatLabDrumPadVoiceOpts,
  type BeatLabDrumPadVoiceParam,
} from '@/app/lib/creationStation/beatLabDrumPadVoice';
import {
  clonePadSamplerFxRack,
  defaultPadSamplerFxRack,
  type PadSamplerFxRack,
} from '@/app/lib/creationStation/padSamplerFxRack';
import {
  defaultPadSamplerPlaybackOpts,
  type PadSamplerPlaybackOpts,
} from '@/app/lib/padSampleStorage';

const PANEL_TITLE: CSSProperties = {
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: '0.14em',
  textAlign: 'center',
  lineHeight: 1.2,
};

const KNOB_ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '2px 6px',
};

const KNOB_SIZE = 38;

/** Modern glass knobs — all Beat Pads FX / Instrument tabs. */
function BeatPadsFxKnob(props: Omit<SynthRoundKnobProps, 'variant' | 'size'>) {
  return <SynthRoundKnob {...props} variant="modern" size={KNOB_SIZE} />;
}

function patchSampler(
  samplerOpts: PadSamplerPlaybackOpts,
  patch: Partial<PadSamplerPlaybackOpts>,
): PadSamplerPlaybackOpts {
  return { ...samplerOpts, ...patch };
}

const FX_PERSIST_MS = 300;
const PAD_EDIT_UNDO_MAX = 32;

type PadEditUndoSnapshot = {
  sampler: PadSamplerPlaybackOpts;
  fx: PadSamplerFxRack;
  voice: BeatLabDrumPadVoiceOpts;
};

function padEditSnapshot(
  sampler: PadSamplerPlaybackOpts,
  fx: PadSamplerFxRack,
  voice: BeatLabDrumPadVoiceOpts,
): PadEditUndoSnapshot {
  return {
    sampler: { ...sampler },
    fx: clonePadSamplerFxRack(fx),
    voice: { ...voice },
  };
}

function padEditSnapshotsEqual(a: PadEditUndoSnapshot, b: PadEditUndoSnapshot): boolean {
  return (
    JSON.stringify(a.sampler) === JSON.stringify(b.sampler) &&
    JSON.stringify(a.fx) === JSON.stringify(b.fx) &&
    JSON.stringify(a.voice) === JSON.stringify(b.voice)
  );
}

/** Beat Pads panel skin — matches Pattern Bank + Lane Placements sidebar boxes. */
const BEAT_PADS_MINT = '#7cf4c6';
const BEAT_PADS_VIOLET = '#c4b5fd';
const BEAT_PADS_PANEL_BG =
  'linear-gradient(165deg, rgba(11, 11, 16, 0.55) 0%, rgba(8, 8, 12, 0.95) 100%)';
const BEAT_PADS_PANEL_BORDER = 'rgba(124, 244, 198, 0.22)';
const BEAT_PADS_PANEL_ROW_BORDER = 'rgba(124, 244, 198, 0.12)';
const BEAT_PADS_PANEL_INSET = 'inset 0 1px 0 rgba(255,255,255,0.04)';

function beatPadsPanelTab(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? BEAT_PADS_MINT : 'rgba(255,255,255,0.14)'}`,
    background: active ? 'rgba(124, 244, 198, 0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? BEAT_PADS_MINT : '#b8bcc8',
  };
}

const fxMiniBtn: CSSProperties = {
  height: 24,
  padding: '0 10px',
  borderRadius: 4,
  border: '1px solid rgba(255, 255, 255, 0.14)',
  background: 'rgba(255, 255, 255, 0.04)',
  color: '#b8bcc8',
  fontSize: 10,
  fontWeight: 800,
  cursor: 'pointer',
  letterSpacing: '0.08em',
};

/** Snare roll photo — Note Repeat visual cue. */
const NOTE_REPEAT_SNARE_ROLL_IMG = '/beat-pads-note-repeat-snare-roll.png';

/** ~¼″ snare roll cue in the Note Repeat row. */
const NOTE_REPEAT_SNARE_ICON_PX = 84;

function NoteRepeatSnareRollIcon({ size = NOTE_REPEAT_SNARE_ICON_PX }: { size?: number }) {
  return (
    <img
      src={NOTE_REPEAT_SNARE_ROLL_IMG}
      alt=""
      aria-hidden
      draggable={false}
      width={size}
      height={size}
      style={{
        display: 'block',
        flexShrink: 0,
        width: size,
        height: size,
        objectFit: 'cover',
        objectPosition: '50% 42%',
        borderRadius: 5,
      }}
    />
  );
}

const CUBASE_EDIT_BG = BEAT_PADS_PANEL_BG;
const CUBASE_EDIT_BORDER = BEAT_PADS_PANEL_ROW_BORDER;
const CUBASE_TAB_ACTIVE = BEAT_PADS_MINT;
const CUBASE_LAYER_ACTIVE = 'rgba(124, 244, 198, 0.14)';

type CubaseMainTab = 'instrument' | 'padfx' | 'group' | 'delay' | 'reverb';

const CUBASE_MAIN_TABS: {
  id: CubaseMainTab;
  label: string;
  powerKey?: 'delay' | 'reverb';
}[] = [
  { id: 'instrument', label: 'Instrument' },
  { id: 'padfx', label: 'Pad FX' },
  { id: 'group', label: 'Group' },
  { id: 'delay', label: 'Delay', powerKey: 'delay' },
  { id: 'reverb', label: 'Reverb', powerKey: 'reverb' },
];

type SoundPhase = 'oscillator' | 'filter' | 'pitch' | 'amp' | 'dist' | 'amplifier';

const SOUND_PHASES: { id: SoundPhase; label: string; title: string }[] = [
  { id: 'oscillator', label: 'OSC', title: 'Oscillator' },
  { id: 'filter', label: 'FILTER', title: 'Filter' },
  { id: 'pitch', label: 'PITCH', title: 'Pitch' },
  { id: 'amp', label: 'AMP ENV', title: 'Amp Envelope' },
  { id: 'dist', label: 'DIST', title: 'Distortion' },
  { id: 'amplifier', label: 'AMP', title: 'Amplifier' },
];

const TAB_META: Record<CubaseMainTab, { title: string; hint: string; needsSample?: boolean }> = {
  instrument: { title: 'Instrument', hint: 'Layer parameters — varies by model' },
  padfx: { title: 'Pad FX', hint: 'Distortion · Filter · Equalizer inserts', needsSample: true },
  group: { title: 'Group', hint: 'Grid timing, swing & groove' },
  delay: { title: 'Delay', hint: 'Synced delay send', needsSample: true },
  reverb: { title: 'Reverb', hint: 'Reverb send & tail', needsSample: true },
};

const GROUP_FEEL_STEPS = 16;
const GROUP_FEEL_STEP_W = 13;
const GROUP_FEEL_MS_SCALE = 0.48;

const GROUP_FEEL_HELP = {
  timing: {
    title: 'TIMING',
    tagline: 'Nudge the whole lane.',
    body:
      'Shifts every step on this lane earlier (−ms) or later (+ms). Use when the whole lane sits ahead of or behind the beat — not just one hit.',
  },
  swing: {
    title: 'SWING',
    tagline: 'Off-beat bounce.',
    body:
      '50% is straight 16ths. Above 50% pushes off-beats later (classic bounce / hip-hop). Below 50% pulls off-beats earlier. Even steps stay on the grid.',
  },
  groove: {
    title: 'GROOVE',
    tagline: 'Human feel.',
    body:
      'Adds subtle random timing and velocity wobble so the lane feels less machine-perfect. 0% = locked to the grid; higher = more live-drummer looseness.',
  },
} as const;

type GroupFeelHelpKey = keyof typeof GROUP_FEEL_HELP;

function BeatPadsMiniHelpPopover({
  open,
  onToggle,
  title,
  tagline,
  body,
  accent = '#7cf4c6',
  label,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  tagline: string;
  body: string;
  accent?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, onToggle]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        className="beat-pads-mini-help-btn"
        aria-expanded={open}
        aria-label={`${label} help`}
        title={`What is ${label}?`}
        onClick={onToggle}
        style={{
          ...fxMiniBtn,
          width: 18,
          height: 18,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: open ? accent : '#8a9098',
          borderColor: open ? `${accent}66` : undefined,
          background: open ? `${accent}14` : undefined,
        }}
      >
        <CircleHelp size={10} aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={`${title} help`}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            width: 196,
            padding: '8px 10px',
            borderRadius: 6,
            border: `1px solid ${accent}55`,
            background: 'linear-gradient(165deg, #12141c 0%, #0a0a10 100%)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: '0.1em',
              color: accent,
              marginBottom: 4,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: '#e8eef8',
              lineHeight: 1.35,
              marginBottom: 6,
            }}
          >
            {tagline}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 8,
              fontWeight: 600,
              lineHeight: 1.45,
              color: '#a8b0bc',
            }}
          >
            {body}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function BeatPadsGroupFeelViz({ voice }: { voice: BeatLabDrumPadVoiceOpts }) {
  const padX = 8;
  const baselineY = 28;
  const vizH = 36;
  const vizW = padX * 2 + GROUP_FEEL_STEPS * GROUP_FEEL_STEP_W;
  const hits = Array.from({ length: GROUP_FEEL_STEPS }, (_, col) => {
    const baseX = padX + col * GROUP_FEEL_STEP_W + GROUP_FEEL_STEP_W / 2;
    const offMs = beatLabDrumVoiceScheduleOffsetSec(voice, col, 0) * 1000;
    const x = baseX + offMs * GROUP_FEEL_MS_SCALE;
    const vel = beatLabDrumVoiceGridVelocity(voice, col, 0);
    const r = 2.8 + (vel / 127) * 2.6;
    return { col, baseX, x, r, isOffbeat: col % 2 === 1 };
  });

  return (
    <div className="beat-pads-group-feel-viz">
      <svg
        className="beat-pads-group-feel-viz-svg"
        viewBox={`0 0 ${vizW} ${vizH}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <line
          x1={padX}
          y1={baselineY}
          x2={vizW - padX}
          y2={baselineY}
          stroke="rgba(124, 244, 198, 0.28)"
          strokeWidth="2"
        />
        {hits.map((h) => (
          <g key={h.col}>
            <line
              x1={h.baseX}
              y1={baselineY - 12}
              x2={h.baseX}
              y2={baselineY + 6}
              stroke={h.isOffbeat ? 'rgba(196, 181, 253, 0.55)' : 'rgba(124, 244, 198, 0.38)'}
              strokeWidth="1.75"
              strokeDasharray={h.isOffbeat ? '3 2' : undefined}
            />
            <circle cx={h.x} cy={baselineY} r={h.r} fill="#7cf4c6" opacity={0.95} />
          </g>
        ))}
      </svg>
      <div className="beat-pads-group-feel-viz-legend">
        <span className="beat-pads-group-feel-viz-legend-item">
          <span className="beat-pads-group-feel-viz-tick beat-pads-group-feel-viz-tick--on" /> on-beat
        </span>
        <span className="beat-pads-group-feel-viz-legend-item">
          <span className="beat-pads-group-feel-viz-tick beat-pads-group-feel-viz-tick--off" /> off-beat
        </span>
        <span className="beat-pads-group-feel-viz-legend-item beat-pads-group-feel-viz-legend-dot">● hit moves</span>
      </div>
    </div>
  );
}

function BeatPadsGroupTabPanel({
  voice,
  pushVoiceParam,
  voiceParamDefault,
}: {
  voice: BeatLabDrumPadVoiceOpts;
  pushVoiceParam: (param: BeatLabDrumPadVoiceParam, value: number) => void;
  voiceParamDefault: (param: BeatLabDrumPadVoiceParam) => number;
}) {
  const [helpKey, setHelpKey] = useState<GroupFeelHelpKey | null>(null);
  const feelParams = BEAT_LAB_DRUM_PAD_SEQUENCER_PARAMS.filter(
    (p) => p.id === 'timing' || p.id === 'swing' || p.id === 'groove',
  );

  return (
    <div className="beat-pads-group-tab">
      <div className="beat-pads-group-feel-block">
        <div className="beat-pads-group-feel-head">
          <span className="beat-pads-group-feel-title">GRID FEEL</span>
          <span className="beat-pads-group-feel-hint">Turn knobs — watch the dots move</span>
        </div>
        <BeatPadsGroupFeelViz voice={voice} />
        <div className="beat-pads-group-feel-knobs">
          {feelParams.map((p) => {
            const help = GROUP_FEEL_HELP[p.id as GroupFeelHelpKey];
            return (
              <div key={p.id} className="beat-pads-group-feel-knob-cell">
                <div className="beat-pads-group-feel-knob-row">
                  <BeatPadsMiniHelpPopover
                    open={helpKey === p.id}
                    onToggle={() => setHelpKey((k) => (k === p.id ? null : (p.id as GroupFeelHelpKey)))}
                    title={help.title}
                    tagline={help.tagline}
                    body={help.body}
                    label={p.label}
                  />
                  <BeatPadsFxKnob
                    label={p.label}
                    value={beatLabDrumPadVoiceParamValue(voice, p.id)}
                    min={p.min}
                    max={p.max}
                    decimals={0}
                    defaultValue={voiceParamDefault(p.id)}
                    onChange={(v) => pushVoiceParam(p.id, v)}
                    size={40}
                    accent="#7cf4c6"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CubaseMainTabBar({
  active,
  onSelect,
  fxRack,
  onToggleFxPower,
  padLabel,
  padIndex,
  hasSample = false,
  onSpreadHitToPads,
  spreadActive = false,
  onUndoSpread,
  onPadUndo,
  canPadUndo = false,
  beatPadsSpreadDirection = 'down',
  beatPadsSpreadRootMidi = 60,
  beatPadsSpreadBaseLabel = 'Spread',
  beatPadsSpreadNotes = [],
  beatPadsSpreadLoopBars = 8,
  beatPadsSpreadStepsPerBar = 16,
  beatPadsSpreadMixerChannel = 17,
  beatPadsSpreadKeyLockEnabled = false,
  beatPadsSpreadKeyLabel = 'key',
  beatPadsSpreadHarmonyLane = 17,
  beatPadsSpreadHarmonyLaneNotes = [],
  beatPadsSpreadSe2MatchTrackOptions,
  beatPadsSpreadHarmonyTrackIndex,
  onBeatPadsSpreadNotesChange,
  onBeatPadsSpreadLoopBarsChange,
  onBeatPadsSpreadDirectionChange,
  onBeatPadsSpreadMixerChannelChange,
  onBeatPadsSpreadKeyLockChange,
  onBeatPadsSpreadHarmonyLaneChange,
  onBeatPadsSpreadHarmonyTrackIndexChange,
  onBeatPadsSpreadRegenerateChordRoots,
  onPreviewBeatPadsSpreadRow,
  onStrikeBeatPadsSpreadRow,
  onWarmAudio,
  getAudioContext,
  sessionBpm = 120,
  beatPadsSpreadMidiExportTrackOptions,
  beatPadsSpreadWavExportTrackOptions,
  beatPadsSpreadDefaultMidiExportTrackIndex,
  beatPadsSpreadDefaultWavExportTrackIndex,
  onExportBeatPadsSpreadMidi,
  onExportBeatPadsSpreadWav,
  beatPadsSpreadExportStatus,
}: {
  active: CubaseMainTab;
  onSelect: (tab: CubaseMainTab) => void;
  fxRack: PadSamplerFxRack;
  onToggleFxPower: (key: 'delay' | 'reverb') => void;
  padLabel: string;
  padIndex: number;
  hasSample?: boolean;
  onSpreadHitToPads?: (direction: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection) => void;
  spreadActive?: boolean;
  onUndoSpread?: () => void;
  onPadUndo?: () => void;
  canPadUndo?: boolean;
  beatPadsSpreadDirection?: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection;
  beatPadsSpreadRootMidi?: number;
  beatPadsSpreadBaseLabel?: string;
  beatPadsSpreadNotes?: BeatPadsSpreadNote[];
  beatPadsSpreadLoopBars?: BeatPadsSpreadLoopBars;
  beatPadsSpreadStepsPerBar?: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar;
  beatPadsSpreadMixerChannel?: number;
  beatPadsSpreadKeyLockEnabled?: boolean;
  beatPadsSpreadKeyLabel?: string;
  beatPadsSpreadHarmonyLane?: number;
  beatPadsSpreadHarmonyLaneNotes?: import('@/app/lib/creationStation/beatLabMidiRoll').BeatLabMidiNote[];
  beatPadsSpreadSe2MatchTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadHarmonyTrackIndex?: number;
  onBeatPadsSpreadNotesChange?: (notes: BeatPadsSpreadNote[]) => void;
  onBeatPadsSpreadLoopBarsChange?: (bars: BeatPadsSpreadLoopBars) => void;
  onBeatPadsSpreadDirectionChange?: (direction: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection) => void;
  onBeatPadsSpreadMixerChannelChange?: (ch: number) => void;
  onBeatPadsSpreadKeyLockChange?: (enabled: boolean) => void;
  onBeatPadsSpreadHarmonyLaneChange?: (lane: number) => void;
  onBeatPadsSpreadHarmonyTrackIndexChange?: (trackIndex: number) => void;
  onBeatPadsSpreadRegenerateChordRoots?: () => void;
  onPreviewBeatPadsSpreadRow?: (row: number, gridCol?: number) => void;
  onStrikeBeatPadsSpreadRow?: (row: number, gridCol?: number, whenSec?: number) => void;
  onWarmAudio?: () => void | Promise<void>;
  getAudioContext?: () => AudioContext | null;
  sessionBpm?: number;
  beatPadsSpreadMidiExportTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadWavExportTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadDefaultMidiExportTrackIndex?: number;
  beatPadsSpreadDefaultWavExportTrackIndex?: number;
  onExportBeatPadsSpreadMidi?: (targetTrackIndex: number) => void | Promise<void>;
  onExportBeatPadsSpreadWav?: (targetTrackIndex: number) => void | Promise<void>;
  beatPadsSpreadExportStatus?: string | null;
}) {
  const midiLabel = beatPadsPadMidiLabel(padIndex);
  const [spreadHelpOpen, setSpreadHelpOpen] = useState(false);
  const [spreadRollOpen, setSpreadRollOpen] = useState(false);
  const [spreadRollPos, setSpreadRollPos] = useState({ top: 0, left: 0 });
  const spreadHelpRef = useRef<HTMLDivElement>(null);
  const spreadRollAnchorRef = useRef<HTMLDivElement>(null);
  const spreadRollPanelRef = useRef<HTMLDivElement>(null);
  const pendingSpreadRollRef = useRef(false);

  const canShowSpreadRoll =
    typeof onBeatPadsSpreadNotesChange === 'function' &&
    typeof onBeatPadsSpreadLoopBarsChange === 'function' &&
    typeof onBeatPadsSpreadDirectionChange === 'function';

  const repositionSpreadRoll = useCallback(() => {
    const anchor = spreadRollAnchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const panelW = Math.min(
      beatPadsSpreadRollPopoverWidth(beatPadsSpreadLoopBars, beatPadsSpreadStepsPerBar),
      vw - margin * 2,
    );
    const estH = spreadRollPanelRef.current?.offsetHeight ?? 340;
    let left = r.right - panelW;
    left = Math.max(margin, Math.min(left, vw - panelW - margin));
    let top = r.top - 8 - estH;
    if (top < margin) top = Math.min(r.bottom + 8, vh - estH - margin);
    setSpreadRollPos({ top, left });
  }, [beatPadsSpreadLoopBars, beatPadsSpreadStepsPerBar]);

  useEffect(() => {
    if (spreadActive && pendingSpreadRollRef.current) {
      pendingSpreadRollRef.current = false;
      setSpreadRollOpen(true);
    }
  }, [spreadActive]);

  useLayoutEffect(() => {
    if (!spreadRollOpen || !spreadActive) return;
    repositionSpreadRoll();
    const id = requestAnimationFrame(() => repositionSpreadRoll());
    return () => cancelAnimationFrame(id);
  }, [spreadRollOpen, spreadActive, beatPadsSpreadLoopBars, repositionSpreadRoll]);

  useEffect(() => {
    if (!spreadRollOpen) return;
    const onResize = () => repositionSpreadRoll();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [spreadRollOpen, repositionSpreadRoll]);

  useEffect(() => {
    if (!spreadHelpOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (spreadHelpRef.current && !spreadHelpRef.current.contains(t)) {
        setSpreadHelpOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [spreadHelpOpen]);

  const showSpreadControls = typeof onSpreadHitToPads === 'function' && (hasSample || spreadActive);
  const showSpreadRoll = spreadRollOpen && spreadActive && canShowSpreadRoll;

  const handleSpreadClick = (direction: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection) => {
    onSpreadHitToPads?.(direction);
    if (spreadActive) {
      setSpreadRollOpen(true);
    } else {
      pendingSpreadRollRef.current = true;
    }
  };

  return (
    <div
      className="beat-pads-fx-tabbar"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 6px',
        minWidth: 0,
      }}
    >
      <div
        className="beat-pads-fx-tabbar-pad"
        title={`Pad ${padIndex + 1} · ${midiLabel} · ${padLabel}`}
        style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flexShrink: 1 }}
      >
        <span className="beat-pads-fx-tabbar-pad-name">{padLabel}</span>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
          }}
        >
          {showSpreadControls ? (
            <div
              ref={spreadRollAnchorRef}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {showSpreadRoll && typeof document !== 'undefined'
                ? createPortal(
                    <div
                      ref={spreadRollPanelRef}
                      data-beat-pads-spread-roll-popover=""
                      style={{
                        position: 'fixed',
                        top: spreadRollPos.top,
                        left: spreadRollPos.left,
                        zIndex: 100050,
                      }}
                    >
                      <BeatPadsSpreadPianoRoll
                        baseLabel={beatPadsSpreadBaseLabel}
                        rootMidi={beatPadsSpreadRootMidi}
                        direction={beatPadsSpreadDirection}
                        notes={beatPadsSpreadNotes}
                        loopBars={beatPadsSpreadLoopBars}
                        stepsPerBar={beatPadsSpreadStepsPerBar}
                        mixerChannel={beatPadsSpreadMixerChannel}
                        keyLockEnabled={beatPadsSpreadKeyLockEnabled}
                        keyLabel={beatPadsSpreadKeyLabel}
                        harmonyLane={beatPadsSpreadHarmonyLane}
                        harmonyLaneNotes={beatPadsSpreadHarmonyLaneNotes}
                        se2MatchTrackOptions={beatPadsSpreadSe2MatchTrackOptions}
                        harmonyTrackIndex={beatPadsSpreadHarmonyTrackIndex}
                        onHarmonyLaneChange={onBeatPadsSpreadHarmonyLaneChange}
                        onHarmonyTrackIndexChange={onBeatPadsSpreadHarmonyTrackIndexChange}
                        onKeyLockChange={onBeatPadsSpreadKeyLockChange}
                        onRegenerateChordRoots={onBeatPadsSpreadRegenerateChordRoots}
                        onNotesChange={onBeatPadsSpreadNotesChange!}
                        onLoopBarsChange={onBeatPadsSpreadLoopBarsChange!}
                        onDirectionChange={onBeatPadsSpreadDirectionChange!}
                        onMixerChannelChange={onBeatPadsSpreadMixerChannelChange}
                        onPreviewRow={onPreviewBeatPadsSpreadRow}
                        onStrikeSpreadRow={
                          typeof onStrikeBeatPadsSpreadRow === 'function'
                            ? (row, col, whenSec) => onStrikeBeatPadsSpreadRow(row, col, whenSec)
                            : undefined
                        }
                        sessionBpm={sessionBpm}
                        onWarmAudio={onWarmAudio}
                        getAudioContext={getAudioContext}
                        midiExportTrackOptions={beatPadsSpreadMidiExportTrackOptions}
                        wavExportTrackOptions={beatPadsSpreadWavExportTrackOptions}
                        defaultMidiExportTrackIndex={beatPadsSpreadDefaultMidiExportTrackIndex}
                        defaultWavExportTrackIndex={beatPadsSpreadDefaultWavExportTrackIndex}
                        onExportSpreadMidi={onExportBeatPadsSpreadMidi}
                        onExportSpreadWav={onExportBeatPadsSpreadWav}
                        exportStatus={beatPadsSpreadExportStatus}
                        onClose={() => setSpreadRollOpen(false)}
                      />
                    </div>,
                    document.body,
                  )
                : null}
              {typeof onSpreadHitToPads === 'function' ? (
                <div
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    flexShrink: 0,
                  }}
                >
                  <span
                    title={BEAT_PADS_PAD_SPREAD_HELP.tagline}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 18,
                      padding: '0 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: '0.14em',
                      color: BEAT_PADS_PAD_SPREAD_BADGE_STYLE.color,
                      textShadow: BEAT_PADS_PAD_SPREAD_BADGE_STYLE.textShadow,
                      border: BEAT_PADS_PAD_SPREAD_BADGE_STYLE.border,
                      background: BEAT_PADS_PAD_SPREAD_BADGE_STYLE.background,
                      boxShadow: BEAT_PADS_PAD_SPREAD_BADGE_STYLE.boxShadow,
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                    }}
                  >
                    {BEAT_PADS_PAD_SPREAD_BADGE_STYLE.label}
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <button
                      type="button"
                      onClick={() => handleSpreadClick('down')}
                      aria-label="Pad Spread down 16 — open chromatic pitch roll"
                      title="Pad Spread ↓16 — chromatic down · CH 17 roll"
                      style={{
                        ...fxMiniBtn,
                        flexShrink: 0,
                        height: 20,
                        padding: '0 5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        color: '#9fd4ff',
                        borderColor: 'rgba(159, 212, 255, 0.35)',
                        background: 'rgba(159, 212, 255, 0.08)',
                      }}
                    >
                      <Layers size={9} aria-hidden />
                      ↓ 16
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSpreadClick('up')}
                      aria-label="Pad Spread up 16 — open chromatic pitch roll"
                      title="Pad Spread ↑16 — chromatic up · CH 17 roll"
                      style={{
                        ...fxMiniBtn,
                        flexShrink: 0,
                        height: 20,
                        padding: '0 5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        color: '#ffb4e6',
                        borderColor: 'rgba(255, 180, 230, 0.35)',
                        background: 'rgba(255, 180, 230, 0.08)',
                      }}
                    >
                      <Layers size={9} aria-hidden />
                      ↑ 16
                    </button>
                  </div>
                </div>
              ) : null}
              {spreadActive && typeof onUndoSpread === 'function' ? (
                <button
                  type="button"
                  onClick={() => onUndoSpread()}
                  title="Close Pad Spread roll — pads were never changed"
                  style={{
                    ...fxMiniBtn,
                    flexShrink: 0,
                    height: 20,
                    padding: '0 7px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color: '#ffd966',
                    borderColor: 'rgba(255, 217, 102, 0.45)',
                    background: 'rgba(255, 217, 102, 0.12)',
                  }}
                >
                  <Undo2 size={9} aria-hidden />
                  Undo spread
                </button>
              ) : null}
              <div ref={spreadHelpRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button"
                  aria-expanded={spreadHelpOpen}
                  aria-label="What is Pad Spread?"
                  title="Pad Spread — lane placements + CH 17 roll"
                  onClick={() => setSpreadHelpOpen((open) => !open)}
                  style={{
                    ...fxMiniBtn,
                    width: 20,
                    height: 20,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: spreadHelpOpen ? '#ffe082' : '#8a9098',
                    borderColor: spreadHelpOpen ? 'rgba(255, 224, 130, 0.45)' : undefined,
                    background: spreadHelpOpen ? 'rgba(255, 224, 130, 0.12)' : undefined,
                  }}
                >
                  <CircleHelp size={11} aria-hidden />
                </button>
                {spreadHelpOpen ? (
                  <div
                    className="beat-pads-spread-help-popover"
                    role="dialog"
                    aria-label="Pad Spread help"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      zIndex: 80,
                      width: 248,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(255, 224, 130, 0.45)',
                      background: 'linear-gradient(165deg, #1a1408 0%, #0a0a10 100%)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: '0.12em',
                        color: '#ffe082',
                        textShadow: '0 0 8px rgba(255, 224, 130, 0.3)',
                        marginBottom: 4,
                      }}
                    >
                      {BEAT_PADS_PAD_SPREAD_HELP.title.toUpperCase()}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: '#f8fafc',
                        lineHeight: 1.35,
                        marginBottom: 8,
                      }}
                    >
                      {BEAT_PADS_PAD_SPREAD_HELP.tagline}
                    </div>
                    {BEAT_PADS_PAD_SPREAD_HELP.sections.map((sec) => (
                      <div key={sec.heading} style={{ marginBottom: 7 }}>
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 900,
                            letterSpacing: '0.06em',
                            color: '#ffd966',
                            marginBottom: 2,
                          }}
                        >
                          {sec.heading}
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 8,
                            fontWeight: 600,
                            lineHeight: 1.45,
                            color: '#a8b0bc',
                          }}
                        >
                          {sec.body}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {typeof onPadUndo === 'function' ? (
            <button
              type="button"
              onClick={() => onPadUndo()}
              disabled={!canPadUndo}
              title={
                canPadUndo
                  ? spreadActive
                    ? 'Undo spread (or last pad edit)'
                    : 'Undo last change on this pad'
                  : 'Nothing to undo on this pad'
              }
              style={{
                ...fxMiniBtn,
                flexShrink: 0,
                height: 20,
                padding: '0 7px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                color: canPadUndo ? '#ffd966' : '#6a7280',
                borderColor: canPadUndo ? 'rgba(255, 217, 102, 0.45)' : undefined,
                background: canPadUndo ? 'rgba(255, 217, 102, 0.1)' : undefined,
                opacity: canPadUndo ? 1 : 0.55,
                cursor: canPadUndo ? 'pointer' : 'default',
              }}
            >
              <Undo2 size={9} aria-hidden />
              Undo
            </button>
          ) : null}
        </div>
      </div>
      <div
        className="beat-pads-fx-tabbar-tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 3,
          flex: '1 1 0',
          minWidth: 0,
        }}
      >
      {CUBASE_MAIN_TABS.map((tab) => {
        const isActive = active === tab.id;
        const fxOn =
          tab.powerKey === 'delay'
            ? fxRack.delay.enabled
            : tab.powerKey === 'reverb'
              ? fxRack.reverb.enabled
              : false;
        return (
          <div
            key={tab.id}
            className={`beat-pads-fx-tab-group${isActive ? ' beat-pads-fx-tab-group--active' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'stretch',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              className={`beat-pads-fx-tab${isActive ? ' beat-pads-fx-tab--active' : ''}`}
              onClick={() => onSelect(tab.id)}
              style={{
                borderRadius: tab.powerKey ? '4px 0 0 4px' : 4,
              }}
            >
              {tab.label}
            </button>
            {tab.powerKey ? (
              <button
                type="button"
                className={`beat-pads-fx-tab-power${fxOn ? ' beat-pads-fx-tab-power--on' : ''}`}
                aria-pressed={fxOn}
                title={fxOn ? `Turn ${tab.label} off` : `Turn ${tab.label} on`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleFxPower(tab.powerKey!);
                }}
              >
                <Power size={11} strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function beatPadsPadMidiLabel(padIndex: number): string {
  const midi = BEAT_PADS_LANE_GM_PITCH[padIndex] ?? 36 + padIndex;
  return cbPianoMidiToNoteName(midi);
}

function PadEditKnobSection({
  title,
  children,
  className,
  style,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`beat-pads-fx-knob-section${className ? ` ${className}` : ''}`}
      style={{
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 0,
        ...style,
      }}
    >
      <div
        className="beat-pads-fx-knob-section-label"
        style={{
          flexShrink: 0,
          width: 52,
          fontSize: 7,
          fontWeight: 900,
          letterSpacing: '0.12em',
          color: '#6a7280',
          lineHeight: 1.15,
          textAlign: 'left',
        }}
      >
        {title}
      </div>
      <div
        style={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '2px 4px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

type SidePanelShellProps = {
  title: string;
  titleColor: string;
  padIndex: number;
  padLabel: string;
  children: ReactNode;
  /** FX panel: stack knobs + waveform from top. */
  alignTop?: boolean;
  /** FX panel: grow into right-side space. */
  wide?: boolean;
  /** FX panel: pin waveform to bottom (align with pad bank baseline). */
  pinWaveBottom?: boolean;
};

function SidePanelShell({
  title,
  titleColor,
  padIndex,
  padLabel,
  children,
  alignTop = false,
  wide = false,
  pinWaveBottom = false,
}: SidePanelShellProps) {
  return (
    <div
      style={{
        flex: wide ? '1 1 300px' : '1 1 0',
        minWidth: wide ? 280 : 0,
        maxWidth: wide ? 'none' : 240,
        width: wide ? '100%' : undefined,
        height: pinWaveBottom ? '100%' : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: wide ? 'stretch' : 'center',
        justifyContent: pinWaveBottom ? 'flex-start' : alignTop ? 'flex-start' : 'center',
        gap: pinWaveBottom ? 2 : alignTop ? 6 : 8,
        padding: pinWaveBottom ? '0 6px 0 4px' : alignTop ? '4px 6px 8px 4px' : '6px 4px',
        boxSizing: 'border-box',
        alignSelf: pinWaveBottom || wide ? 'stretch' : 'flex-end',
      }}
    >
      <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
        <div style={{ ...PANEL_TITLE, color: titleColor }}>{title}</div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#9aa3b0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}
          title={padLabel}
        >
          PAD {padIndex + 1} · {padLabel}
        </div>
      </div>
      {children}
    </div>
  );
}

export type BeatLabDrumMachineVoicePanelProps = {
  padIndex: number;
  padLabel: string;
  voice: BeatLabDrumPadVoiceOpts;
  onVoiceParam: (param: BeatLabDrumPadVoiceParam, value: number) => void;
};

type PadFxInsertSlot = 'distortion' | 'filter' | 'equalizer';

const PAD_FX_INSERTS: { id: PadFxInsertSlot; label: string }[] = [
  { id: 'distortion', label: 'Distortion' },
  { id: 'filter', label: 'Filter' },
  { id: 'equalizer', label: 'Equalizer' },
];

function padFxDistortionOn(
  fxRack: PadSamplerFxRack,
  sampler: PadSamplerPlaybackOpts,
): boolean {
  return (
    fxRack.drive > 0.004 ||
    fxRack.compressor.enabled ||
    Math.abs(sampler.distOffset ?? 0) > 0.5
  );
}

function padFxFilterOn(sampler: PadSamplerPlaybackOpts): boolean {
  return (
    sampler.hpHz >= 25 ||
    (sampler.lpHz >= 200 && sampler.lpHz < 19900) ||
    (sampler.lpRes ?? 0) > 0.5 ||
    (sampler.lpEnvDepth ?? 0) > 0.5
  );
}

function PadFxMeterStack({
  labels,
  levels,
  accent = '#7cf4c6',
  enabled = true,
}: {
  labels: [string, string, string];
  levels?: [number, number, number];
  accent?: string;
  enabled?: boolean;
}) {
  const fallback = [0.42, 0.28, 0.38] as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div className="beat-pads-fx-meter-stack">
        {labels.map((label, i) => {
          const lvl = levels?.[i] ?? fallback[i] ?? 0.35;
          return (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="beat-pads-fx-meter" aria-hidden style={{ opacity: enabled ? 1 : 0.4 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${Math.round(lvl * 100)}%`,
                    background: `linear-gradient(180deg, ${accent} 0%, ${accent}88 100%)`,
                    transition: 'height 75ms linear',
                  }}
                />
              </div>
              <div className="beat-pads-fx-meter-label">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PadFxLimiterControls({
  fxRack,
  pushFx,
  accent = '#e8b923',
  faderHeight = 38,
}: {
  fxRack: PadSamplerFxRack;
  pushFx: (next: PadSamplerFxRack) => void;
  accent?: string;
  faderHeight?: number;
}) {
  const lim = fxRack.limiter ?? defaultPadSamplerFxRack().limiter;
  const limActivity = lim.enabled
    ? Math.max(0.25, 1 - (lim.ceilingDb + 24) / 24, lim.softClip / 120)
    : 0;
  const limMeters = useBeatPadsFxMeterPulse(limActivity, lim.enabled);
  const patchLimiter = (patch: Partial<PadSamplerFxRack['limiter']>) => {
    pushFx({
      ...fxRack,
      limiter: { ...lim, enabled: true, ...patch },
    });
  };

  return (
    <>
      <div className="beat-pads-fx-limiter-strip-head">
        <span className="beat-pads-fx-limiter-title">LIMITER</span>
        <button
          type="button"
          className={`beat-pads-fx-insert-slot-power${lim.enabled ? ' beat-pads-fx-insert-slot-power--on' : ''}`}
          aria-pressed={lim.enabled}
          title={lim.enabled ? 'Turn limiter off' : 'Turn limiter on'}
          onClick={() =>
            pushFx({
              ...fxRack,
              limiter: { ...lim, enabled: !lim.enabled },
            })
          }
        >
          <Power size={11} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      <PadFxMeterStack
        labels={['In', 'GR', 'Out']}
        levels={[limMeters.inputL, limMeters.mid, limMeters.outputL]}
        accent={accent}
        enabled={lim.enabled}
      />
      <div className="beat-pads-fx-softclip-scale beat-pads-fx-softclip-scale--inline">
        <span>Hard</span>
        <span>Soft</span>
      </div>
      <BeatPadsFxSuiteFader
        label="THR"
        min={-24}
        max={0}
        step={1}
        value={Math.round(lim.ceilingDb)}
        onChange={(v) => patchLimiter({ ceilingDb: Math.round(v) })}
        format={(v) => `${Math.round(v)} dB`}
        accent={accent}
        faderHeight={faderHeight}
      />
      <BeatPadsFxSuiteFader
        label="SOFT"
        min={0}
        max={100}
        step={1}
        value={Math.round(lim.softClip)}
        onChange={(v) => patchLimiter({ softClip: Math.round(v) })}
        format={(v) => `${Math.round(v)}%`}
        accent={accent}
        faderHeight={faderHeight}
      />
    </>
  );
}

/** Limiter tab — full viz + gold control strip inside the FX edit body. */
function PadFxLimiterPanel({
  fxRack,
  pushFx,
  accent = '#e8b923',
}: {
  fxRack: PadSamplerFxRack;
  pushFx: (next: PadSamplerFxRack) => void;
  accent?: string;
}) {
  const lim = fxRack.limiter ?? defaultPadSamplerFxRack().limiter;
  const activity = lim.enabled
    ? Math.max(0.28, 0.35 + (Math.abs(lim.ceilingDb) / 24) * 0.35 + (lim.softClip / 100) * 0.25)
    : 0;
  const pulse = useBeatPadsFxMeterPulse(activity, lim.enabled);
  const simMeterPeak = Math.max(pulse.inputL, pulse.inputR, pulse.mid * 0.9);

  return (
    <div className="beat-pads-limiter-panel beat-pads-instrument-suite" data-studio-fx-suite>
      <div className="beat-pads-limiter-panel__viz">
        <LimiterCeilingViz
          ceilingDb={lim.ceilingDb}
          accent={accent}
          enabled={lim.enabled}
          simMeterPeak={simMeterPeak}
        />
      </div>
      <div className="beat-pads-fx-limiter-strip beat-pads-limiter-panel__controls">
        <PadFxLimiterControls fxRack={fxRack} pushFx={pushFx} accent={accent} faderHeight={56} />
      </div>
    </div>
  );
}

function BeatLabPadFxCubaseEditor({
  layerModelLabel,
  hasSample,
  samplerOpts,
  fxRack,
  insertSlot,
  onInsertSlot,
  pushSampler,
  pushFx,
}: {
  layerModelLabel: string;
  hasSample: boolean;
  samplerOpts: PadSamplerPlaybackOpts;
  fxRack: PadSamplerFxRack;
  insertSlot: PadFxInsertSlot;
  onInsertSlot: (slot: PadFxInsertSlot) => void;
  pushSampler: (next: PadSamplerPlaybackOpts) => void;
  pushFx: (next: PadSamplerFxRack) => void;
}) {
  const distOn = padFxDistortionOn(fxRack, samplerOpts);
  const filterOn = padFxFilterOn(samplerOpts);
  const eqOn = fxRack.eq.enabled;

  const toggleDistortion = useCallback(() => {
    if (distOn) {
      pushFx({
        ...fxRack,
        drive: 0,
        compressor: { ...fxRack.compressor, enabled: false },
      });
      pushSampler(patchSampler(samplerOpts, { distOffset: 0 }));
      return;
    }
    pushFx({
      ...fxRack,
      drive: Math.max(fxRack.drive, 0.28),
      compressor: { ...fxRack.compressor, enabled: true },
    });
  }, [distOn, fxRack, pushFx, pushSampler, samplerOpts]);

  const toggleFilter = useCallback(() => {
    if (filterOn) {
      pushSampler(
        patchSampler(samplerOpts, {
          hpHz: 0,
          lpHz: 0,
          lpRes: 0,
          lpEnvDepth: 0,
        }),
      );
      return;
    }
    pushSampler(
      patchSampler(samplerOpts, {
        lpHz: samplerOpts.lpHz >= 200 ? samplerOpts.lpHz : 12000,
      }),
    );
  }, [filterOn, pushSampler, samplerOpts]);

  const toggleEq = useCallback(() => {
    pushFx({
      ...fxRack,
      eq: { ...fxRack.eq, enabled: !eqOn },
    });
  }, [eqOn, fxRack, pushFx]);

  const slotPower: Record<PadFxInsertSlot, { on: boolean; toggle: () => void }> = {
    distortion: { on: distOn, toggle: toggleDistortion },
    filter: { on: filterOn, toggle: toggleFilter },
    equalizer: { on: eqOn, toggle: toggleEq },
  };

  const fxMeterActivity = useMemo(() => {
    if (insertSlot === 'distortion') {
      return Math.max(
        fxRack.drive,
        fxRack.compressor.enabled ? 0.42 : 0,
        Math.abs(samplerOpts.distOffset ?? 0) / 100,
      );
    }
    if (insertSlot === 'filter') {
      const hp = samplerOpts.hpHz >= 25 ? 0.2 : 0;
      const lp = samplerOpts.lpHz >= 200 && samplerOpts.lpHz < 19900 ? 0.25 : 0;
      const res = (samplerOpts.lpRes ?? 0) / 100;
      return Math.min(1, 0.18 + hp + lp + res * 0.35);
    }
    const eqMag =
      Math.max(
        Math.abs(fxRack.eq.lowGainDb),
        Math.abs(fxRack.eq.midGainDb),
        Math.abs(fxRack.eq.highGainDb),
      ) / 12;
    return Math.min(1, 0.22 + eqMag * 0.55);
  }, [insertSlot, fxRack, samplerOpts]);

  const fxMeterEnabled =
    insertSlot === 'distortion' ? distOn : insertSlot === 'filter' ? filterOn : eqOn;
  const meterLevels = useBeatPadsFxMeterPulse(fxMeterActivity, fxMeterEnabled);

  const editorKnobs = (() => {
    if (insertSlot === 'distortion') {
      const accent = '#e8b923';
      const comp = fxRack.compressor;
      return (
        <BeatPadsFxSuiteInsertShell
          viz={
            <BeatPadsFxSuiteMeterViz
              accent={accent}
              enabled={distOn}
              levels={meterLevels}
              midLabel={comp.enabled ? 'GR' : 'HARM'}
              midAccent={comp.enabled ? '#f87171' : accent}
              graph={
                comp.enabled ? (
                  <BeatPadsFxCompGraph
                    thresholdDb={comp.thresholdDb}
                    ratio={comp.ratio}
                    live={distOn && fxMeterActivity > 0.2}
                  />
                ) : (
                  <BeatPadsFxDriveGraph
                    drive={fxRack.drive}
                    live={distOn && fxMeterActivity > 0.15}
                  />
                )
              }
              readouts={[
                {
                  key: 'state',
                  title: 'MODE',
                  value: !distOn ? 'OFF' : comp.enabled ? 'COMP' : 'DRIVE',
                  color: distOn ? accent : '#8a92a0',
                },
                {
                  key: 'drv',
                  title: 'DRIVE',
                  value: `${Math.round(fxRack.drive * 100)}%`,
                  color: accent,
                },
                {
                  key: 'in',
                  title: 'IN',
                  value: `${Math.round(samplerOpts.distOffset ?? 0)}`,
                  color: '#c8d0dc',
                },
                {
                  key: 'out',
                  title: 'OUT',
                  value: `${Math.round(samplerOpts.padLevel ?? 100)}%`,
                  color: '#7cf4c6',
                },
              ]}
            />
          }
          knobs={
            <>
              <BeatPadsFxSuiteKnob
                label="IN"
                min={-100}
                max={100}
                step={1}
                value={Math.round(samplerOpts.distOffset ?? 0)}
                onChange={(v) =>
                  pushSampler(patchSampler(samplerOpts, { distOffset: Math.round(v) }))
                }
                format={(v) => `${Math.round(v)}`}
              />
              <BeatPadsFxSuiteKnob
                label="DRIVE"
                min={0}
                max={100}
                step={1}
                value={Math.round(fxRack.drive * 100)}
                onChange={(v) =>
                  pushFx({ ...fxRack, drive: Math.max(0, Math.min(1, v / 100)) })
                }
                format={(v) => `${Math.round(v)}%`}
              />
              <BeatPadsFxSuiteKnob
                label="HP"
                min={0}
                max={8000}
                step={25}
                value={samplerOpts.hpHz <= 0 ? 0 : Math.round(samplerOpts.hpHz)}
                onChange={(v) => {
                  const hpHz = v <= 0 ? 0 : Math.max(25, Math.min(8000, Math.round(v)));
                  pushSampler(patchSampler(samplerOpts, { hpHz }));
                }}
                format={(v) => (v <= 0 ? 'OFF' : `${Math.round(v)}`)}
              />
              <BeatPadsFxSuiteKnob
                label="OUT"
                min={0}
                max={150}
                step={1}
                value={Math.round(samplerOpts.padLevel ?? 100)}
                onChange={(v) => pushSampler(patchSampler(samplerOpts, { padLevel: Math.round(v) }))}
                format={(v) => `${Math.round(v)}%`}
              />
            </>
          }
        />
      );
    }

    if (insertSlot === 'filter') {
      const accent = '#58c4ff';
      return (
        <BeatPadsFxSuiteInsertShell
          viz={
            <BeatPadsFxSuiteMeterViz
              accent={accent}
              enabled={filterOn}
              levels={meterLevels}
              midLabel="FILT"
              graph={
                <BeatPadsFxFilterGraph
                  hpHz={samplerOpts.hpHz}
                  lpHz={samplerOpts.lpHz}
                />
              }
              readouts={[
                {
                  key: 'state',
                  title: 'MODE',
                  value: filterOn ? 'ON' : 'OFF',
                  color: filterOn ? accent : '#8a92a0',
                },
                {
                  key: 'hp',
                  title: 'HP',
                  value: samplerOpts.hpHz <= 0 ? 'OFF' : `${Math.round(samplerOpts.hpHz)}`,
                  color: accent,
                },
                {
                  key: 'lp',
                  title: 'LP',
                  value: samplerOpts.lpHz <= 0 ? 'OFF' : `${Math.round(samplerOpts.lpHz)}`,
                  color: accent,
                },
                {
                  key: 'res',
                  title: 'RES',
                  value: `${Math.round(samplerOpts.lpRes ?? 0)}%`,
                  color: '#c8d0dc',
                },
              ]}
            />
          }
          knobs={
            <>
              <BeatPadsFxSuiteKnob
                label="HP"
                min={0}
                max={8000}
                step={25}
                value={samplerOpts.hpHz <= 0 ? 0 : Math.round(samplerOpts.hpHz)}
                onChange={(v) => {
                  const hpHz = v <= 0 ? 0 : Math.max(25, Math.min(8000, Math.round(v)));
                  pushSampler(patchSampler(samplerOpts, { hpHz }));
                }}
                format={(v) => (v <= 0 ? 'OFF' : `${Math.round(v)}`)}
              />
              <BeatPadsFxSuiteKnob
                label="RES"
                min={0}
                max={100}
                step={1}
                value={Math.round(samplerOpts.lpRes ?? 0)}
                onChange={(v) => pushSampler(patchSampler(samplerOpts, { lpRes: Math.round(v) }))}
                format={(v) => `${Math.round(v)}%`}
              />
              <BeatPadsFxSuiteKnob
                label="LP"
                min={0}
                max={14000}
                step={50}
                value={samplerOpts.lpHz <= 0 ? 0 : Math.round(samplerOpts.lpHz)}
                onChange={(v) => {
                  const lpHz = v <= 0 ? 0 : Math.max(200, Math.min(14000, Math.round(v)));
                  pushSampler(patchSampler(samplerOpts, { lpHz }));
                }}
                format={(v) => (v <= 0 ? 'OFF' : `${Math.round(v)}`)}
              />
              <BeatPadsFxSuiteKnob
                label="TONE"
                min={-100}
                max={100}
                step={1}
                value={Math.round(samplerOpts.tone ?? 0)}
                onChange={(v) => pushSampler(patchSampler(samplerOpts, { tone: Math.round(v) }))}
                format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
              />
            </>
          }
        />
      );
    }

    const eqAccent = '#a78bfa';
    return (
      <BeatPadsFxSuiteInsertShell
        viz={
          <BeatPadsFxSuiteMeterViz
            accent={eqAccent}
            enabled={eqOn}
            levels={meterLevels}
            midLabel="EQ"
            graph={
              <BeatPadsFxEqGraph eq={fxRack.eq} accent={eqAccent} enabled={eqOn} />
            }
            readouts={[
              {
                key: 'state',
                title: 'MODE',
                value: eqOn ? 'ON' : 'OFF',
                color: eqOn ? eqAccent : '#8a92a0',
              },
              {
                key: 'lo',
                title: 'LOW',
                value: `${fxRack.eq.lowGainDb > 0 ? '+' : ''}${fxRack.eq.lowGainDb} dB`,
                color: eqAccent,
              },
              {
                key: 'mid',
                title: 'MID',
                value: `${fxRack.eq.midGainDb > 0 ? '+' : ''}${fxRack.eq.midGainDb} dB`,
                color: '#c4b5fd',
              },
              {
                key: 'hi',
                title: 'HI',
                value: `${fxRack.eq.highGainDb > 0 ? '+' : ''}${fxRack.eq.highGainDb} dB`,
                color: '#7cf4c6',
              },
            ]}
          />
        }
        knobs={
          <>
            <BeatPadsFxSuiteKnob
              label="LOW"
              min={-12}
              max={12}
              step={1}
              value={fxRack.eq.lowGainDb}
              onChange={(lowGainDb) =>
                pushFx({ ...fxRack, eq: { ...fxRack.eq, enabled: true, lowGainDb } })
              }
              format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
            />
            <BeatPadsFxSuiteKnob
              label="MID"
              min={-12}
              max={12}
              step={1}
              value={fxRack.eq.midGainDb}
              onChange={(midGainDb) =>
                pushFx({ ...fxRack, eq: { ...fxRack.eq, enabled: true, midGainDb } })
              }
              format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
            />
            <BeatPadsFxSuiteKnob
              label="HI"
              min={-12}
              max={12}
              step={1}
              value={fxRack.eq.highGainDb}
              onChange={(highGainDb) =>
                pushFx({ ...fxRack, eq: { ...fxRack.eq, enabled: true, highGainDb } })
              }
              format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
            />
            <BeatPadsFxSuiteKnob
              label="MID Q"
              min={0.35}
              max={12}
              step={0.1}
              value={fxRack.eq.midQ}
              onChange={(v) => pushFx({ ...fxRack, eq: { ...fxRack.eq, enabled: true, midQ: v } })}
              format={(v) => `${Math.round(v * 10) / 10}`}
            />
          </>
        }
      />
    );
  })();

  return (
    <div className="beat-pads-fx-cubase-editor">
      <div className="beat-pads-fx-row beat-pads-fx-insert-bar">
        <div className="beat-pads-fx-layer-chip" title={`Layer 1 · ${layerModelLabel}`}>
          <strong>Layer 1</strong>
          <span>{layerModelLabel}</span>
        </div>
        {PAD_FX_INSERTS.map((slot) => {
          const active = insertSlot === slot.id;
          const power = slotPower[slot.id];
          return (
            <div
              key={slot.id}
              className={`beat-pads-fx-insert-slot${active ? ' beat-pads-fx-insert-slot--active' : ''}${power.on ? ' beat-pads-fx-insert-slot--on' : ''}`}
            >
              <button
                type="button"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  letterSpacing: 'inherit',
                  fontWeight: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0,
                }}
                onClick={() => onInsertSlot(slot.id)}
              >
                {slot.label}
              </button>
              <button
                type="button"
                className={`beat-pads-fx-insert-slot-power${power.on ? ' beat-pads-fx-insert-slot-power--on' : ''}`}
                aria-pressed={power.on}
                title={power.on ? `Turn ${slot.label} off` : `Turn ${slot.label} on`}
                onClick={(e) => {
                  e.stopPropagation();
                  power.toggle();
                }}
              >
                <Power size={11} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>

      <div className="beat-pads-fx-insert-bay">{editorKnobs}</div>
    </div>
  );
}

export function BeatLabDrumMachineVoicePanel({
  padIndex,
  padLabel,
  voice,
  onVoiceParam,
}: BeatLabDrumMachineVoicePanelProps) {
  const voiceParamDefault = useCallback(
    (param: BeatLabDrumPadVoiceParam) =>
      beatLabDrumPadVoiceParamValue(defaultBeatLabDrumPadVoiceOpts(padIndex), param),
    [padIndex],
  );

  return (
    <SidePanelShell title="PAD · VOICE" titleColor="#7cf4c6" padIndex={padIndex} padLabel={padLabel}>
      <div style={KNOB_ROW}>
        {BEAT_LAB_DRUM_PAD_SAMPLE_PARAMS.map((p) => (
          <BeatPadsFxKnob
            key={p.id}
            label={p.label}
            value={beatLabDrumPadVoiceParamValue(voice, p.id)}
            min={p.min}
            max={p.max}
            decimals={0}
            defaultValue={voiceParamDefault(p.id)}
            onChange={(v) => onVoiceParam(p.id, v)}
            size={32}
            accent="#7cf4c6"
          />
        ))}
      </div>
    </SidePanelShell>
  );
}

function BeatLabDrumMachineNoteRepeatBar({
  noteRepeat,
  onChange,
  rollDrawActive,
  onRollDrawChange,
}: {
  noteRepeat: BeatLabDrumPadNoteRepeat;
  onChange: (mode: BeatLabDrumPadNoteRepeat) => void;
  rollDrawActive?: boolean;
  onRollDrawChange?: (on: boolean) => void;
}) {
  const canDrawRoll = noteRepeat !== 'off';
  const drawLabel =
    noteRepeat === '32nd' ? '1/32' : noteRepeat === '16th' ? '1/16' : noteRepeat === '8th' ? '1/8' : '';

  return (
    <div
      style={{
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 4,
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 900,
          letterSpacing: '0.14em',
          color: '#c4b5fd',
          textAlign: 'center',
        }}
      >
        NOTE REPEAT
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          minWidth: 0,
        }}
      >
        <div
          title="Snare roll — hold pad or draw rolls on the lane"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: NOTE_REPEAT_SNARE_ICON_PX + 6,
            height: NOTE_REPEAT_SNARE_ICON_PX + 4,
            flexShrink: 0,
            marginLeft: 0,
            borderRadius: 6,
            border: '1px solid rgba(167, 139, 250, 0.32)',
            background: 'rgba(167, 139, 250, 0.1)',
            overflow: 'hidden',
          }}
        >
          <NoteRepeatSnareRollIcon />
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 4,
            flex: '1 1 0',
            minWidth: 0,
            padding: '4px 6px 4px 4px',
            borderRadius: 6,
            border: '1px solid rgba(167, 139, 250, 0.22)',
            background: 'rgba(0, 0, 0, 0.22)',
            boxSizing: 'border-box',
          }}
        >
        {BEAT_LAB_DRUM_PAD_NOTE_REPEAT_OPTIONS.map((opt) => {
          const active = noteRepeat === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              title={
                opt.id === 'off'
                  ? 'No roll — single hit only'
                  : `Hold pad to roll at ${opt.label} notes (BPM sync)`
              }
              onClick={() => onChange(opt.id)}
              style={{
                minWidth: 36,
                height: 22,
                padding: '0 8px',
                borderRadius: 4,
                border: `1px solid ${active ? 'rgba(167, 139, 250, 0.75)' : 'rgba(255, 255, 255, 0.14)'}`,
                background: active ? 'rgba(167, 139, 250, 0.22)' : 'rgba(255,255,255,0.04)',
                color: active ? '#ede9fe' : '#9aa3b0',
                fontSize: 9,
                fontWeight: 800,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {opt.label}
            </button>
          );
        })}
        {typeof onRollDrawChange === 'function' ? (
          <button
            type="button"
            aria-pressed
            title={
              canDrawRoll
                ? `Roll draw on — paint ${drawLabel || 'notes'} on the selected lane (use Note Repeat OFF to stop rolls)`
                : 'Roll draw on — pick 1/8, 1/16, or 1/32 under Note Repeat to set roll speed'
            }
            onClick={() => onRollDrawChange(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              minWidth: 52,
              height: 22,
              padding: '0 8px',
              marginLeft: 2,
              borderRadius: 4,
              border: '1px solid rgba(124, 244, 198, 0.75)',
              background: 'rgba(124, 244, 198, 0.18)',
              color: '#7cf4c6',
              fontSize: 9,
              fontWeight: 800,
              cursor: 'default',
            }}
          >
            <Pencil size={10} aria-hidden />
            DRAW
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
}

export type BeatLabDrumMachineFxPanelProps = {
  padIndex: number;
  padLabel: string;
  hasSample: boolean;
  getSamplerOpts: (padIndex: number) => PadSamplerPlaybackOpts;
  commitSamplerOpts: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  getFxRack: (padIndex: number) => PadSamplerFxRack;
  commitFxRack: (padIndex: number, rack: PadSamplerFxRack) => void;
  onLiveFxRack?: (padIndex: number, rack: PadSamplerFxRack) => void;
  onLiveSamplerDraft?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  getPadSampleAudioBuffer?: (padIndex: number) => AudioBuffer | undefined;
  getDrumPadVoice?: (padIndex: number) => BeatLabDrumPadVoiceOpts;
  commitDrumPadVoice?: (padIndex: number, voice: BeatLabDrumPadVoiceOpts) => void;
  onLiveDrumPadVoiceDraft?: (padIndex: number, voice: BeatLabDrumPadVoiceOpts) => void;
  rollDrawActive?: boolean;
  onRollDrawChange?: (on: boolean) => void;
  /** Cubase-style toolbar — audition selected pad. */
  onPreviewPad?: () => void;
  /** Spread pitch roll — opens above Spread buttons (pads unchanged). */
  onSpreadHitToPads?: (direction: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection) => void;
  spreadActive?: boolean;
  onUndoSpread?: () => void;
  beatPadsSpreadDirection?: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection;
  beatPadsSpreadRootMidi?: number;
  beatPadsSpreadBaseLabel?: string;
  beatPadsSpreadNotes?: BeatPadsSpreadNote[];
  beatPadsSpreadLoopBars?: BeatPadsSpreadLoopBars;
  beatPadsSpreadStepsPerBar?: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar;
  beatPadsSpreadMixerChannel?: number;
  beatPadsSpreadKeyLockEnabled?: boolean;
  beatPadsSpreadKeyLabel?: string;
  beatPadsSpreadHarmonyLane?: number;
  beatPadsSpreadHarmonyLaneNotes?: import('@/app/lib/creationStation/beatLabMidiRoll').BeatLabMidiNote[];
  beatPadsSpreadSe2MatchTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadHarmonyTrackIndex?: number;
  onBeatPadsSpreadNotesChange?: (notes: BeatPadsSpreadNote[]) => void;
  onBeatPadsSpreadLoopBarsChange?: (bars: BeatPadsSpreadLoopBars) => void;
  onBeatPadsSpreadDirectionChange?: (direction: import('@/app/lib/creationStation/beatPadsHitSpread').BeatPadsSpreadDirection) => void;
  onBeatPadsSpreadMixerChannelChange?: (ch: number) => void;
  onBeatPadsSpreadKeyLockChange?: (enabled: boolean) => void;
  onBeatPadsSpreadHarmonyLaneChange?: (lane: number) => void;
  onBeatPadsSpreadHarmonyTrackIndexChange?: (trackIndex: number) => void;
  onBeatPadsSpreadRegenerateChordRoots?: () => void;
  onPreviewBeatPadsSpreadRow?: (row: number, gridCol?: number) => void;
  onStrikeBeatPadsSpreadRow?: (row: number, gridCol?: number, whenSec?: number) => void;
  onWarmAudio?: () => void | Promise<void>;
  getAudioContext?: () => AudioContext | null;
  beatPadsSpreadMidiExportTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadWavExportTrackOptions?: readonly { trackIndex: number; label: string }[];
  beatPadsSpreadDefaultMidiExportTrackIndex?: number;
  beatPadsSpreadDefaultWavExportTrackIndex?: number;
  onExportBeatPadsSpreadMidi?: (targetTrackIndex: number) => void | Promise<void>;
  onExportBeatPadsSpreadWav?: (targetTrackIndex: number) => void | Promise<void>;
  beatPadsSpreadExportStatus?: string | null;
  onLoadPad?: () => void;
  onOpenKitBrowser?: () => void;
  onUploadPad?: () => void;
  /** Pin waveform in overlay footer (full width) instead of inside this column. */
  waveformPlacement?: 'inline' | 'external';
  onExternalWaveformProps?: (props: BeatLabPadSampleFxWaveformProps | null) => void;
  /** Fixed-height boxed layout (matches drum pad block). */
  compactLayout?: boolean;
  panelHeight?: number;
  /** Beat / transport BPM — tempo delay divisions lock to this. */
  sessionBpm?: number;
};

export function BeatLabDrumMachineFxPanel({
  padIndex,
  padLabel,
  hasSample,
  getSamplerOpts,
  commitSamplerOpts,
  getFxRack,
  commitFxRack,
  onLiveFxRack,
  onLiveSamplerDraft,
  getPadSampleAudioBuffer,
  getDrumPadVoice,
  commitDrumPadVoice,
  onLiveDrumPadVoiceDraft,
  rollDrawActive = false,
  onRollDrawChange,
  onPreviewPad,
  onSpreadHitToPads,
  spreadActive = false,
  onUndoSpread,
  beatPadsSpreadDirection = 'down',
  beatPadsSpreadRootMidi = 60,
  beatPadsSpreadBaseLabel = 'Spread',
  beatPadsSpreadNotes = [],
  beatPadsSpreadLoopBars = 8,
  beatPadsSpreadStepsPerBar = 16,
  beatPadsSpreadMixerChannel = 17,
  beatPadsSpreadKeyLockEnabled = false,
  beatPadsSpreadKeyLabel = 'key',
  beatPadsSpreadHarmonyLane = 17,
  beatPadsSpreadHarmonyLaneNotes = [],
  beatPadsSpreadSe2MatchTrackOptions,
  beatPadsSpreadHarmonyTrackIndex,
  onBeatPadsSpreadNotesChange,
  onBeatPadsSpreadLoopBarsChange,
  onBeatPadsSpreadDirectionChange,
  onBeatPadsSpreadMixerChannelChange,
  onBeatPadsSpreadKeyLockChange,
  onBeatPadsSpreadHarmonyLaneChange,
  onBeatPadsSpreadHarmonyTrackIndexChange,
  onBeatPadsSpreadRegenerateChordRoots,
  onPreviewBeatPadsSpreadRow,
  onStrikeBeatPadsSpreadRow,
  onWarmAudio,
  getAudioContext,
  sessionBpm = 120,
  beatPadsSpreadMidiExportTrackOptions,
  beatPadsSpreadWavExportTrackOptions,
  beatPadsSpreadDefaultMidiExportTrackIndex,
  beatPadsSpreadDefaultWavExportTrackIndex,
  onExportBeatPadsSpreadMidi,
  onExportBeatPadsSpreadWav,
  beatPadsSpreadExportStatus,
  onLoadPad,
  onOpenKitBrowser,
  onUploadPad,
  waveformPlacement = 'inline',
  onExternalWaveformProps,
  compactLayout = false,
  panelHeight,
}: BeatLabDrumMachineFxPanelProps) {
  const [mainTab, setMainTab] = useState<CubaseMainTab>('instrument');
  const [showRollPanel, setShowRollPanel] = useState(false);
  const [showLimiterPanel, setShowLimiterPanel] = useState(false);
  const [soundPhase, setSoundPhase] = useState<SoundPhase>('oscillator');
  const [padFxInsertSlot, setPadFxInsertSlot] = useState<PadFxInsertSlot>('distortion');
  const [activeLayer, setActiveLayer] = useState(0);
  const [samplerOpts, setSamplerOpts] = useState<PadSamplerPlaybackOpts>(() =>
    defaultPadSamplerPlaybackOpts(),
  );
  const [fxRack, setFxRack] = useState<PadSamplerFxRack>(() => defaultPadSamplerFxRack());
  const [padVoiceLocal, setPadVoiceLocal] = useState<BeatLabDrumPadVoiceOpts>(() =>
    defaultBeatLabDrumPadVoiceOpts(padIndex),
  );
  const samplerDraftRef = useRef(samplerOpts);
  const fxDraftRef = useRef(fxRack);
  const padVoiceDraftRef = useRef<BeatLabDrumPadVoiceOpts>(padVoiceLocal);
  const samplerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pitchPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const padUndoStackRef = useRef<PadEditUndoSnapshot[]>([]);
  const padUndoBatchRef = useRef(false);
  const padUndoBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canPadUndo, setCanPadUndo] = useState(false);
  samplerDraftRef.current = samplerOpts;
  fxDraftRef.current = fxRack;
  padVoiceDraftRef.current = padVoiceLocal;

  const voiceParamDefault = useCallback(
    (param: BeatLabDrumPadVoiceParam) =>
      beatLabDrumPadVoiceParamValue(defaultBeatLabDrumPadVoiceOpts(padIndex), param),
    [padIndex],
  );

  const flushSamplerNow = useCallback(
    (next?: PadSamplerPlaybackOpts) => {
      if (samplerTimerRef.current) {
        clearTimeout(samplerTimerRef.current);
        samplerTimerRef.current = null;
      }
      commitSamplerOpts(padIndex, next ?? samplerDraftRef.current);
    },
    [commitSamplerOpts, padIndex],
  );

  const flushFxNow = useCallback(
    (next?: PadSamplerFxRack) => {
      if (fxTimerRef.current) {
        clearTimeout(fxTimerRef.current);
        fxTimerRef.current = null;
      }
      commitFxRack(padIndex, next ?? fxDraftRef.current);
    },
    [commitFxRack, padIndex],
  );

  const flushVoiceNow = useCallback(
    (next?: BeatLabDrumPadVoiceOpts) => {
      if (voiceTimerRef.current) {
        clearTimeout(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      if (!commitDrumPadVoice) return;
      commitDrumPadVoice(padIndex, next ?? padVoiceDraftRef.current);
    },
    [commitDrumPadVoice, padIndex],
  );

  const syncPadUndoAvailability = useCallback(() => {
    setCanPadUndo(padUndoStackRef.current.length > 0 || spreadActive);
  }, [spreadActive]);

  const pushPadUndoBeforeChange = useCallback(() => {
    if (padUndoBatchRef.current) return;
    const snap = padEditSnapshot(
      samplerDraftRef.current,
      fxDraftRef.current,
      padVoiceDraftRef.current,
    );
    const stack = padUndoStackRef.current;
    const last = stack[stack.length - 1];
    if (last && padEditSnapshotsEqual(last, snap)) return;
    padUndoStackRef.current = [...stack.slice(-(PAD_EDIT_UNDO_MAX - 1)), snap];
    padUndoBatchRef.current = true;
    if (padUndoBatchTimerRef.current) clearTimeout(padUndoBatchTimerRef.current);
    padUndoBatchTimerRef.current = setTimeout(() => {
      padUndoBatchRef.current = false;
      padUndoBatchTimerRef.current = null;
    }, 420);
    syncPadUndoAvailability();
  }, [syncPadUndoAvailability]);

  const applyPadEditSnapshot = useCallback(
    (snap: PadEditUndoSnapshot) => {
      const syncedVoice = clampBeatLabDrumPadVoiceOpts(snap.voice, padIndex);
      samplerDraftRef.current = { ...snap.sampler };
      fxDraftRef.current = clonePadSamplerFxRack(snap.fx);
      padVoiceDraftRef.current = syncedVoice;
      setSamplerOpts(snap.sampler);
      setFxRack(snap.fx);
      setPadVoiceLocal(syncedVoice);
      onLiveSamplerDraft?.(padIndex, snap.sampler);
      onLiveFxRack?.(padIndex, snap.fx);
      onLiveDrumPadVoiceDraft?.(padIndex, syncedVoice);
      flushSamplerNow(snap.sampler);
      flushFxNow(snap.fx);
      if (commitDrumPadVoice) flushVoiceNow(syncedVoice);
    },
    [
      commitDrumPadVoice,
      flushFxNow,
      flushSamplerNow,
      flushVoiceNow,
      onLiveDrumPadVoiceDraft,
      onLiveFxRack,
      onLiveSamplerDraft,
      padIndex,
    ],
  );

  const undoPadEdit = useCallback(() => {
    const stack = padUndoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1]!;
    padUndoStackRef.current = stack.slice(0, -1);
    applyPadEditSnapshot(prev);
    syncPadUndoAvailability();
  }, [applyPadEditSnapshot, syncPadUndoAvailability]);

  const handlePadToolbarUndo = useCallback(() => {
    if (spreadActive && onUndoSpread) {
      onUndoSpread();
      return;
    }
    undoPadEdit();
  }, [onUndoSpread, spreadActive, undoPadEdit]);

  useEffect(() => {
    syncPadUndoAvailability();
  }, [spreadActive, syncPadUndoAvailability]);

  useEffect(() => {
    padUndoStackRef.current = [];
    padUndoBatchRef.current = false;
    if (padUndoBatchTimerRef.current) {
      clearTimeout(padUndoBatchTimerRef.current);
      padUndoBatchTimerRef.current = null;
    }
    setCanPadUndo(spreadActive);
    let nextSampler = { ...getSamplerOpts(padIndex) };
    const nextFx = clonePadSamplerFxRack(getFxRack(padIndex));
    const nextVoice = getDrumPadVoice?.(padIndex) ?? defaultBeatLabDrumPadVoiceOpts(padIndex);
    const trimDecay = beatPadSamplerTrim1ToDecay(nextSampler.trim1);
    if (trimDecay >= 98 && nextVoice.decay < 98) {
      const fields = beatLabDrumVoiceDecayToSampler(nextVoice.decay);
      nextSampler = {
        ...nextSampler,
        trim1: fields.trim1 ?? nextSampler.trim1,
        maxPlaySec: fields.maxPlaySec,
      };
    }
    const syncedVoice = clampBeatLabDrumPadVoiceOpts(
      {
        ...nextVoice,
        tuneSemi: nextSampler.fineSemi ?? nextVoice.tuneSemi,
        decay: beatPadSamplerTrim1ToDecay(nextSampler.trim1),
      },
      padIndex,
    );
    samplerDraftRef.current = nextSampler;
    fxDraftRef.current = nextFx;
    padVoiceDraftRef.current = syncedVoice;
    setSamplerOpts(nextSampler);
    setFxRack(nextFx);
    setPadVoiceLocal(syncedVoice);
    return () => {
      flushSamplerNow();
      flushFxNow();
      flushVoiceNow();
    };
  }, [padIndex, getSamplerOpts, getFxRack, getDrumPadVoice, flushSamplerNow, flushFxNow, flushVoiceNow, spreadActive]);

  useEffect(
    () => () => {
      if (samplerTimerRef.current) clearTimeout(samplerTimerRef.current);
      if (fxTimerRef.current) clearTimeout(fxTimerRef.current);
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      if (pitchPreviewTimerRef.current) clearTimeout(pitchPreviewTimerRef.current);
      if (padUndoBatchTimerRef.current) clearTimeout(padUndoBatchTimerRef.current);
    },
    [],
  );

  const queuePitchPreview = useCallback(() => {
    if (!onPreviewPad || !hasSample) return;
    if (pitchPreviewTimerRef.current) clearTimeout(pitchPreviewTimerRef.current);
    pitchPreviewTimerRef.current = setTimeout(() => {
      pitchPreviewTimerRef.current = null;
      onPreviewPad();
    }, 90);
  }, [hasSample, onPreviewPad]);

  const pushSampler = useCallback(
    (next: PadSamplerPlaybackOpts, opts?: { preview?: boolean }) => {
      pushPadUndoBeforeChange();
      samplerDraftRef.current = next;
      setSamplerOpts(next);
      onLiveSamplerDraft?.(padIndex, next);
      const decay = beatPadSamplerTrim1ToDecay(next.trim1);
      const tuneSemi = Math.max(-12, Math.min(12, Math.round(next.fineSemi ?? 0)));
      if (decay !== padVoiceDraftRef.current.decay || tuneSemi !== padVoiceDraftRef.current.tuneSemi) {
        const nextVoice = clampBeatLabDrumPadVoiceOpts(
          { ...padVoiceDraftRef.current, decay, tuneSemi },
          padIndex,
        );
        padVoiceDraftRef.current = nextVoice;
        setPadVoiceLocal(nextVoice);
        onLiveDrumPadVoiceDraft?.(padIndex, nextVoice);
        if (commitDrumPadVoice) {
          if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
          voiceTimerRef.current = setTimeout(() => commitDrumPadVoice(padIndex, nextVoice), FX_PERSIST_MS);
        }
      }
      if (samplerTimerRef.current) clearTimeout(samplerTimerRef.current);
      samplerTimerRef.current = setTimeout(() => flushSamplerNow(next), FX_PERSIST_MS);
      if (opts?.preview !== false) queuePitchPreview();
    },
    [
      commitDrumPadVoice,
      flushSamplerNow,
      onLiveDrumPadVoiceDraft,
      onLiveSamplerDraft,
      padIndex,
      pushPadUndoBeforeChange,
      queuePitchPreview,
    ],
  );

  const pushFx = useCallback(
    (next: PadSamplerFxRack) => {
      pushPadUndoBeforeChange();
      fxDraftRef.current = next;
      setFxRack(next);
      onLiveFxRack?.(padIndex, next);
      if (fxTimerRef.current) clearTimeout(fxTimerRef.current);
      fxTimerRef.current = setTimeout(() => flushFxNow(next), FX_PERSIST_MS);
      queuePitchPreview();
    },
    [flushFxNow, onLiveFxRack, padIndex, pushPadUndoBeforeChange, queuePitchPreview],
  );

  const pushVoiceParam = useCallback(
    (param: BeatLabDrumPadVoiceParam, value: number) => {
      if (!commitDrumPadVoice) return;
      pushPadUndoBeforeChange();
      const next = beatLabDrumPadVoiceWithParam(
        padVoiceDraftRef.current,
        param,
        Math.round(value),
        padIndex,
      );
      padVoiceDraftRef.current = next;
      setPadVoiceLocal(next);
      onLiveDrumPadVoiceDraft?.(padIndex, next);
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = setTimeout(() => commitDrumPadVoice(padIndex, next), FX_PERSIST_MS);
      if (param === 'velocity') queuePitchPreview();
    },
    [commitDrumPadVoice, onLiveDrumPadVoiceDraft, padIndex, pushPadUndoBeforeChange, queuePitchPreview],
  );

  const pushDecay = useCallback(
    (decay: number) => {
      const fields = beatLabDrumVoiceDecayToSampler(decay);
      pushSampler({
        ...samplerDraftRef.current,
        trim1: fields.trim1 ?? samplerDraftRef.current.trim1,
        maxPlaySec: fields.maxPlaySec,
      });
    },
    [pushSampler],
  );

  const pushTune = useCallback(
    (fineSemi: number) => {
      const clamped = Math.max(-12, Math.min(12, Math.round(fineSemi)));
      pushSampler({
        ...samplerDraftRef.current,
        fineSemi: clamped,
      });
    },
    [pushSampler],
  );

  const pushSamplerPitch = useCallback(
    (patch: Partial<PadSamplerPlaybackOpts>) => {
      pushSampler(patchSampler(samplerDraftRef.current, patch));
    },
    [pushSampler],
  );

  const decayDisplay = beatPadSamplerTrim1ToDecay(samplerOpts.trim1);

  const resetPadFx = useCallback(() => {
    pushPadUndoBeforeChange();
    const nextSampler = defaultPadSamplerPlaybackOpts();
    const nextFx = defaultPadSamplerFxRack();
    const nextVoice = { ...padVoiceDraftRef.current, decay: 100 };
    samplerDraftRef.current = nextSampler;
    fxDraftRef.current = nextFx;
    padVoiceDraftRef.current = nextVoice;
    setSamplerOpts(nextSampler);
    setFxRack(nextFx);
    setPadVoiceLocal(nextVoice);
    onLiveSamplerDraft?.(padIndex, nextSampler);
    onLiveFxRack?.(padIndex, nextFx);
    onLiveDrumPadVoiceDraft?.(padIndex, nextVoice);
    flushSamplerNow(nextSampler);
    flushFxNow(nextFx);
    if (commitDrumPadVoice) flushVoiceNow(nextVoice);
  }, [
    commitDrumPadVoice,
    flushFxNow,
    flushSamplerNow,
    flushVoiceNow,
    onLiveDrumPadVoiceDraft,
    onLiveFxRack,
    onLiveSamplerDraft,
    padIndex,
    pushPadUndoBeforeChange,
  ]);

  const showNoteRepeat = Boolean(getDrumPadVoice && commitDrumPadVoice);
  const audioBuffer = hasSample ? getPadSampleAudioBuffer?.(padIndex) : undefined;

  const externalWaveformProps = useMemo(
    (): BeatLabPadSampleFxWaveformProps => ({
      audioBuffer: audioBuffer ?? null,
      samplerOpts,
      fxRack,
      onSamplerChange: pushSampler,
      onFxChange: pushFx,
    }),
    [audioBuffer, fxRack, pushFx, pushSampler, samplerOpts],
  );

  useEffect(() => {
    if (waveformPlacement !== 'external') return;
    onExternalWaveformProps?.(externalWaveformProps);
    return () => onExternalWaveformProps?.(null);
  }, [externalWaveformProps, onExternalWaveformProps, waveformPlacement]);
  const midiLabel = beatPadsPadMidiLabel(padIndex);
  const layerModelLabel = hasSample ? 'Sample' : 'Empty';
  const modeMeta = TAB_META[mainTab];

  const phaseNeedsSample = modeMeta.needsSample === true && mainTab !== 'instrument';
  const phaseContent = (() => {
    if (showRollPanel) {
      return showNoteRepeat ? (
        <BeatLabDrumMachineNoteRepeatBar
          noteRepeat={padVoiceLocal.noteRepeat}
          rollDrawActive={rollDrawActive}
          onRollDrawChange={onRollDrawChange}
          onChange={(mode) => {
            pushPadUndoBeforeChange();
            const next = beatLabDrumPadVoiceWithNoteRepeat(padVoiceLocal, mode, padIndex);
            padVoiceDraftRef.current = next;
            setPadVoiceLocal(next);
            onLiveDrumPadVoiceDraft?.(padIndex, next);
            commitDrumPadVoice!(padIndex, next);
            onRollDrawChange?.(true);
          }}
        />
      ) : (
        <span style={{ fontSize: 9, color: '#6a7280', padding: '8px 4px' }}>Voice data unavailable</span>
      );
    }

    if (showLimiterPanel) {
      return <PadFxLimiterPanel fxRack={fxRack} pushFx={pushFx} />;
    }

    if (phaseNeedsSample && !hasSample) {
      return (
        <span style={{ fontSize: 9, fontWeight: 600, color: '#6a7280', padding: '8px 4px' }}>
          Load a sample on {midiLabel} — use Hot Swap / Load above, then Apply to this pad.
        </span>
      );
    }

    if (mainTab === 'instrument' && !hasSample && soundPhase !== 'amp' && soundPhase !== 'amplifier') {
      return (
        <span style={{ fontSize: 9, fontWeight: 600, color: '#6a7280', padding: '8px 4px' }}>
          No sample on {midiLabel}. Load a sound, or use AMP ENV / AMP for level & velocity tweaks.
        </span>
      );
    }

    if (mainTab === 'instrument') {
      return (
        <BeatPadsInstrumentSuitePanel
          phase={soundPhase}
          hasSample={hasSample}
          samplerOpts={samplerOpts}
          fxRack={fxRack}
          padVoiceLocal={padVoiceLocal}
          pushSampler={pushSampler}
          pushFx={pushFx}
          pushDecay={pushDecay}
          pushSamplerPitch={pushSamplerPitch}
          pushTune={pushTune}
          pushVoiceParam={pushVoiceParam}
          decayDisplay={decayDisplay}
        />
      );
    }

    if (mainTab === 'padfx') {
      return (
        <BeatLabPadFxCubaseEditor
          layerModelLabel={layerModelLabel}
          hasSample={hasSample}
          samplerOpts={samplerOpts}
          fxRack={fxRack}
          insertSlot={padFxInsertSlot}
          onInsertSlot={setPadFxInsertSlot}
          pushSampler={pushSampler}
          pushFx={pushFx}
        />
      );
    }

    if (mainTab === 'delay') {
      const delay = fxRack.delay;
      const patchDelay = (patch: Partial<typeof delay>) =>
        pushFx({
          ...fxRack,
          delay: { ...delay, enabled: true, ...patch },
        });
      return (
        <BeatPadsDelaySuitePanel
          delay={delay}
          sessionBpm={sessionBpm}
          onPatchDelay={patchDelay}
        />
      );
    }

    if (mainTab === 'reverb') {
      const reverb = fxRack.reverb;
      const patchReverb = (patch: Partial<typeof reverb>) =>
        pushFx({
          ...fxRack,
          reverb: { ...reverb, enabled: true, ...patch },
        });
      return (
        <BeatPadsReverbSuitePanel reverb={reverb} onPatchReverb={patchReverb} />
      );
    }

    if (mainTab === 'group') {
      return (
        <BeatPadsGroupTabPanel
          voice={padVoiceLocal}
          pushVoiceParam={pushVoiceParam}
          voiceParamDefault={voiceParamDefault}
        />
      );
    }

    return null;
  })();

  const handleMainTabSelect = useCallback(
    (tab: CubaseMainTab) => {
      setMainTab(tab);
      setShowRollPanel(false);
      setShowLimiterPanel(false);
      const rack = fxDraftRef.current;
      if (tab === 'delay' && !rack.delay.enabled) {
        const next = { ...rack, delay: { ...rack.delay, enabled: true } };
        pushFx(next);
        flushFxNow(next);
      } else if (tab === 'reverb' && !rack.reverb.enabled) {
        const next = { ...rack, reverb: { ...rack.reverb, enabled: true } };
        pushFx(next);
        flushFxNow(next);
      }
    },
    [flushFxNow, pushFx],
  );

  const toggleFxPower = useCallback(
    (key: 'delay' | 'reverb') => {
      const rack = fxDraftRef.current;
      const next =
        key === 'delay'
          ? { ...rack, delay: { ...rack.delay, enabled: !rack.delay.enabled } }
          : { ...rack, reverb: { ...rack.reverb, enabled: !rack.reverb.enabled } };
      pushFx(next);
      flushFxNow(next);
    },
    [flushFxNow, pushFx],
  );

  return (
    <div
      className="beat-pads-fx-panel"
      data-studio-beat-pads-interactive=""
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        flex: panelHeight ? '0 0 auto' : '1 1 auto',
        width: '100%',
        minWidth: compactLayout ? 0 : 280,
        minHeight: 0,
        height: panelHeight ?? '100%',
        maxHeight: panelHeight,
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'stretch',
        background: CUBASE_EDIT_BG,
        border: `1px solid ${BEAT_PADS_PANEL_BORDER}`,
        borderRadius: 8,
        boxShadow: BEAT_PADS_PANEL_INSET,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Cubase main tabs — Instrument | Pad FX | Group | Delay | Reverb */}
      <CubaseMainTabBar
        active={mainTab}
        onSelect={handleMainTabSelect}
        fxRack={fxRack}
        onToggleFxPower={toggleFxPower}
        padLabel={padLabel}
        padIndex={padIndex}
        hasSample={hasSample}
        onSpreadHitToPads={onSpreadHitToPads}
        spreadActive={spreadActive}
        onUndoSpread={onUndoSpread}
        onPadUndo={handlePadToolbarUndo}
        canPadUndo={canPadUndo}
        beatPadsSpreadDirection={beatPadsSpreadDirection}
        beatPadsSpreadRootMidi={beatPadsSpreadRootMidi}
        beatPadsSpreadBaseLabel={beatPadsSpreadBaseLabel}
        beatPadsSpreadNotes={beatPadsSpreadNotes}
        beatPadsSpreadLoopBars={beatPadsSpreadLoopBars}
        beatPadsSpreadStepsPerBar={beatPadsSpreadStepsPerBar}
        beatPadsSpreadMixerChannel={beatPadsSpreadMixerChannel}
        beatPadsSpreadKeyLockEnabled={beatPadsSpreadKeyLockEnabled}
        beatPadsSpreadKeyLabel={beatPadsSpreadKeyLabel}
        beatPadsSpreadHarmonyLane={beatPadsSpreadHarmonyLane}
        beatPadsSpreadHarmonyLaneNotes={beatPadsSpreadHarmonyLaneNotes}
        beatPadsSpreadSe2MatchTrackOptions={beatPadsSpreadSe2MatchTrackOptions}
        beatPadsSpreadHarmonyTrackIndex={beatPadsSpreadHarmonyTrackIndex}
        onBeatPadsSpreadNotesChange={onBeatPadsSpreadNotesChange}
        onBeatPadsSpreadLoopBarsChange={onBeatPadsSpreadLoopBarsChange}
        onBeatPadsSpreadDirectionChange={onBeatPadsSpreadDirectionChange}
        onBeatPadsSpreadMixerChannelChange={onBeatPadsSpreadMixerChannelChange}
        onBeatPadsSpreadKeyLockChange={onBeatPadsSpreadKeyLockChange}
        onBeatPadsSpreadHarmonyLaneChange={onBeatPadsSpreadHarmonyLaneChange}
        onBeatPadsSpreadHarmonyTrackIndexChange={onBeatPadsSpreadHarmonyTrackIndexChange}
        onBeatPadsSpreadRegenerateChordRoots={onBeatPadsSpreadRegenerateChordRoots}
        onPreviewBeatPadsSpreadRow={onPreviewBeatPadsSpreadRow}
        onStrikeBeatPadsSpreadRow={onStrikeBeatPadsSpreadRow}
        onWarmAudio={onWarmAudio}
        getAudioContext={getAudioContext}
        sessionBpm={sessionBpm}
        beatPadsSpreadMidiExportTrackOptions={beatPadsSpreadMidiExportTrackOptions}
        beatPadsSpreadWavExportTrackOptions={beatPadsSpreadWavExportTrackOptions}
        beatPadsSpreadDefaultMidiExportTrackIndex={beatPadsSpreadDefaultMidiExportTrackIndex}
        beatPadsSpreadDefaultWavExportTrackIndex={beatPadsSpreadDefaultWavExportTrackIndex}
        onExportBeatPadsSpreadMidi={onExportBeatPadsSpreadMidi}
        onExportBeatPadsSpreadWav={onExportBeatPadsSpreadWav}
        beatPadsSpreadExportStatus={beatPadsSpreadExportStatus}
      />

      {/* Utility row — Hot Swap / load */}
      <div
        className="beat-pads-fx-row"
        style={{
          flexShrink: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
        }}
      >
        {typeof onPreviewPad === 'function' ? (
          <button
            type="button"
            onClick={() => onPreviewPad()}
            title="Hot Swap Preview"
            style={{ ...fxMiniBtn, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Play size={10} aria-hidden />
            Hot Swap
          </button>
        ) : null}
        {typeof onLoadPad === 'function' ? (
          <button type="button" onClick={() => onLoadPad()} style={fxMiniBtn}>
            <Upload size={10} aria-hidden />
            Load
          </button>
        ) : null}
        {typeof onOpenKitBrowser === 'function' ? (
          <button type="button" onClick={() => onOpenKitBrowser()} style={{ ...fxMiniBtn, color: '#ffd966' }}>
            <FolderOpen size={10} aria-hidden />
            Browser
          </button>
        ) : null}
        {typeof onUploadPad === 'function' ? (
          <button type="button" onClick={() => onUploadPad()} style={fxMiniBtn}>
            <Upload size={10} aria-hidden />
            Upload
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setShowLimiterPanel((v) => !v);
            setShowRollPanel(false);
          }}
          title="Pad limiter"
          style={{
            ...fxMiniBtn,
            borderColor: showLimiterPanel ? 'rgba(232, 185, 35, 0.55)' : undefined,
            color: showLimiterPanel ? '#e8b923' : undefined,
          }}
        >
          Limiter
        </button>
        <button
          type="button"
          onClick={() => {
            setShowRollPanel((v) => !v);
            setShowLimiterPanel(false);
            setMainTab('instrument');
          }}
          title="Note repeat rolls"
          style={{
            ...fxMiniBtn,
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            borderColor: showRollPanel ? 'rgba(196, 181, 253, 0.55)' : undefined,
            color: showRollPanel ? '#c4b5fd' : undefined,
          }}
        >
          <NoteRepeatSnareRollIcon size={18} />
          Roll
        </button>
        <button type="button" onClick={resetPadFx} title="Reset pad" style={fxMiniBtn}>
          Reset
        </button>
      </div>

      {/* Edit body — scrollable phase content (limiter opens via utility tab) */}
      <div
        className={`beat-pads-fx-edit-body${mainTab === 'instrument' ? ' beat-pads-fx-edit-body--instrument' : ''}${mainTab === 'delay' ? ' beat-pads-fx-edit-body--delay' : ''}${mainTab === 'reverb' ? ' beat-pads-fx-edit-body--reverb' : ''}${showLimiterPanel ? ' beat-pads-fx-edit-body--limiter' : ''}${mainTab === 'padfx' ? ' beat-pads-fx-edit-body--padfx' : ''}${mainTab === 'group' ? ' beat-pads-fx-edit-body--group' : ''}`}
        style={{
          flex: mainTab === 'padfx' || mainTab === 'group' ? '0 0 auto' : '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
      <div
        className={`beat-pads-fx-edit-scroll${mainTab === 'padfx' ? ' beat-pads-fx-edit-scroll--padfx' : ''}${mainTab === 'group' ? ' beat-pads-fx-edit-scroll--group' : ''}${showLimiterPanel ? ' beat-pads-fx-edit-scroll--limiter' : ''}${mainTab === 'delay' ? ' beat-pads-fx-edit-scroll--delay' : ''}${mainTab === 'reverb' ? ' beat-pads-fx-edit-scroll--reverb' : ''}`}
        style={{
          flex: mainTab === 'padfx' || mainTab === 'group' ? '0 0 auto' : '1 1 auto',
          minHeight: 0,
          overflowY:
            mainTab === 'padfx' ||
            mainTab === 'group' ||
            showRollPanel ||
            showLimiterPanel ||
            mainTab === 'delay' ||
            mainTab === 'reverb' ||
            mainTab === 'instrument'
              ? 'hidden'
              : 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
      {/* Sound-engine phases — only while editing layer sound (not PadFX/Send) */}
      {mainTab === 'instrument' && !showRollPanel && !showLimiterPanel ? (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            gap: 2,
            padding: '2px 6px',
          }}
          className="beat-pads-fx-row"
        >
          {SOUND_PHASES.map((p) => {
            const active = soundPhase === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`beat-pads-fx-phase-tab${active ? ' beat-pads-fx-phase-tab--active' : ''}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setSoundPhase(p.id);
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Parameter knobs — title sits left of knobs via PadEditKnobSection */}
      <div
        style={{
          flex:
            mainTab === 'padfx'
              ? '0 0 auto'
              : mainTab === 'instrument' ||
                  showLimiterPanel ||
                  mainTab === 'delay' ||
                  mainTab === 'reverb'
                ? '1 1 auto'
                : undefined,
          flexShrink: mainTab === 'padfx' ? 0 : 0,
          minHeight:
            mainTab === 'instrument' ||
            showLimiterPanel ||
            mainTab === 'delay' ||
            mainTab === 'reverb'
              ? 0
              : undefined,
          padding: mainTab === 'padfx' ? 0 : '2px 6px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {phaseContent}
      </div>
      </div>
      </div>

      {/* Inline waveform — when not rendered in overlay footer */}
      {waveformPlacement === 'inline' ? (
      <div
        style={{
          flexShrink: 0,
          width: '100%',
          padding: '0 4px 2px',
          borderTop: `1px solid ${CUBASE_EDIT_BORDER}`,
          background: 'rgba(0, 0, 0, 0.25)',
          boxSizing: 'border-box',
        }}
      >
        <BeatLabPadSampleFxWaveform {...externalWaveformProps} />
      </div>
      ) : null}
    </div>
  );
}
