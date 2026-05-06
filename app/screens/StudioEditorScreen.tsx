import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  memo,
  useSyncExternalStore,
  type MutableRefObject,
} from 'react';

import { Radio, Plus, VolumeX, Lock, Trash2, Copy, Send, ZoomIn, ZoomOut, Scissors, MousePointer, ChevronUp, ChevronDown, Mic, Play, Pause, Square, Clock, SkipBack, SkipForward } from 'lucide-react';

import {
  useMasterClock,
  BEATS_PER_BAR,
  PPQ,
  type StudioTransportSyncSnapshot,
  type TransportState,
} from '@/app/context/MasterClockContext';
import { useView } from '@/app/context/ViewContext';
import { useSettings } from '@/app/context/SettingsContext';

import { useTrackManager } from '@/app/lib/trackManager';
import {
  STUDIO_PROJECT_STORAGE_KEY,
  deserializeStudioProject,
  serializeStudioProject,
} from '@/app/lib/studioProjectPersistence';
import {
  rebuildStudioTracksFromSessionManifest,
  readCombinedSessionTrackManifest,
  DA_SESSION_TRACKS_SYNC_EVENT,
} from '@/app/lib/sessionChannelTracks';
import {
  stripModuleSessionClips,
  applySessionModuleClips,
  type StudioTrackLike,
} from '@/app/lib/sessionClipContent';
import { type TimeSignature } from '@/app/context/daw-types';
import { registerStudioProjectCloudExporter } from '@/app/lib/studioProjectBridge';
import {
  createStudioTimelineMap,
  type StudioTimelineMap,
} from '@/app/lib/studioTimelineMap';
import { studioMicTrackConstraints } from '@/app/lib/audioRouting';

import RecordingWaveShade from '@/app/components/RecordingWaveShade';

import WaveformEditor from '@/app/components/WaveformEditor';

import ResizablePanel from '@/app/components/ResizablePanel';

import ProMeter from '@/app/components/ProMeter';
import LoopMarkersBrace, { LoopVerticalGuides } from '@/app/components/LoopMarkersBrace';

import { MusicEnhancer } from '@/app/screens/components/MusicEnhancer';

// DAW Editing Features
import { useClipboardEditor } from '@/app/screens/hooks/useClipboardEditor';
import { useDAWKeyboardShortcuts } from '@/app/screens/hooks/useDAWKeyboardShortcuts';
import { useStudioMusicalClock } from '@/app/screens/hooks/useStudioMusicalClock';
import { STUDIO_TIMING_MODE_STORAGE_KEY } from '@/app/lib/studioDawClockDisplay';
import {
  subscribeStudioPlayheadFrame,
  readStudioTransportSnapshotForUi,
  displayAudioNowForStudio,
} from '@/app/lib/studioPlayheadSharedFrame';
import {
  createStudioTransportClock,
  studioCanonicalBeatFromSnapshot,
  studioGridBeatFloatFromSnapshot,
} from '@/app/lib/studio/studioTransportHub';
import {
  createRulerQuarterGate,
  resetRulerQuarterGate,
  shouldPublishRulerQuarter,
} from '@/app/lib/studio/studioGridLockedPlayhead';
import { snapClipStartTick0, SnapGridType, getClipsInSelection, SelectionBox } from '@/app/screens/utils/dawUtils';
import { DAWEditorToolbar } from '@/app/screens/components/DAWEditorToolbar';
import { TimelineContextMenu } from '@/app/screens/components/TimelineContextMenu';

/** Fired before Stop (TitleBar + Studio) so Studio count-in can abort without entering transport. */
const DMB_STUDIO_PRECOUNT_CANCEL = 'dmb-studio-precount-cancel';

type TrackType = 'MIDI' | 'Audio' | 'Drum' | 'Bus' | 'Vocal';


interface Clip {
  id: number;
  bar: number;
  len: number;
  label: string;
  /** Present for imported/recorded audio ΓÇö used for timeline playback. */
  audioBuffer?: AudioBuffer;
  /**
   * Exact timeline start in session ticks (PPQ). When set, playback + clip X use this instead of
   * `(bar-1)*ticksPerBar` so takes align with the real record-arm downbeat (rounding `bar` alone was up to ~┬╜ bar late).
   */
  startTick?: number;
}

/**
 * Transport is in **beats** (quarters). Pixels are only a view of time:
 * BeatΓåÆpixel scale: `createStudioTimelineMap` (`colW` = one bar width).
 */
function clipStartBeat0(clip: Clip, quartersPerBar: number = BEATS_PER_BAR): number {
  if (typeof clip.startTick === 'number' && Number.isFinite(clip.startTick)) {
    return clip.startTick / PPQ;
  }
  return (clip.bar - 1) * quartersPerBar;
}

function clipTimelineStartTick(clip: Clip, ticksPerBar: number): number {
  if (typeof clip.startTick === 'number' && Number.isFinite(clip.startTick)) {
    return Math.max(0, Math.round(clip.startTick));
  }
  return Math.max(0, (clip.bar - 1) * ticksPerBar);
}
function clipLengthBeats(clip: Clip, quartersPerBar: number = BEATS_PER_BAR): number {
  return clip.len * quartersPerBar;
}

interface Track {
  id: number; name: string; type: TrackType; color: string;
  muted: boolean; solo: boolean; locked: boolean; volume: number; clips: Clip[];
  /** Shared session channel slot (1ΓÇô17 Creation, 18+ AI Pattern contiguous, Arranger after last AI slot, Studio user ΓëÑ min floor). */
  audioTrack?: number;
  /** Mixer display/monitor mode. Stereo = split L/R meter, Mono = single meter. */
  stereoMode?: 'stereo' | 'mono';
}


const TYPE_COLORS: Record<TrackType, string> = {
  MIDI: '#00E5FF', Audio: '#00ff88', Drum: '#D500F9', Bus: '#ffcc00', Vocal: '#ff6b35',
};

/** Timeline playhead / scrub line — cyan so it’s distinct from MET (magenta) in the title bar. */
const STUDIO_PLAYHEAD_LINE = {
  gradient:
    'linear-gradient(180deg, #22d3ee 0%, #06b6d4 55%, #22d3ee 100%)',
  shadow: '0 0 12px rgba(34,211,238,0.9), 0 0 2px #fff',
  shadowClip: '0 0 8px rgba(34,211,238,0.85)',
  rulerFill: 'rgba(34,211,238,0.12)',
  rulerStroke: 'rgba(34,211,238,0.42)',
  barText: '#22d3ee',
  barBg: 'rgba(34,211,238,0.07)',
  measText: '#22d3ee',
  measBg: 'rgba(34,211,238,0.14)',
} as const;
type EffectType =
  | 'eq'
  | 'compressor'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'flanger'
  | 'distortion'
  | 'filter';
type EffectSlot = {
  id: string;
  type: EffectType;
  enabled: boolean;
  wet: number;
  params: Record<string, number>;
};

/**
 * Bar / beat-in-bar matching {@link StudioTimelineMap.gridFromContentX} and ruler columns (`bi * qpb + mi`).
 * Uses absolute quarter index, not {@link tickToBarBeatFromFloatTick} (which can diverge from the pixel grid).
 */
function studioRulerBarBeatFromAbsoluteQuarter(
  absoluteQuarterFloat: number,
  beatsPerBar: number,
  totalBars?: number,
): { bar: number; beatInBar: number } {
  const bpb = Math.max(1, Math.round(beatsPerBar));
  const abs = Math.max(0, absoluteQuarterFloat);
  const beatIndex0 = Math.floor(abs + 1e-9);
  const barIndex0 = Math.floor(beatIndex0 / bpb + 1e-9);
  let bar = barIndex0 + 1;
  if (typeof totalBars === 'number' && totalBars >= 1) {
    bar = Math.max(1, Math.min(totalBars, bar));
  }
  const beatInBar0 = beatIndex0 - barIndex0 * bpb;
  const beatInBar = Math.floor(beatInBar0 + 1e-9) + 1;
  return { bar, beatInBar };
}

/** Bar/beat for cyan line + ruler — same quarter grid as {@link createStudioTimelineMap} (`beatsPerBar` = qpb). */
function studioTransportToBarBeatFromSnap(
  snap: StudioTransportSyncSnapshot,
  beatsPerBar: number,
  totalBars?: number,
): { bar: number; beatInBar: number } {
  const qtr = studioGridBeatFloatFromSnapshot(snap);
  return studioRulerBarBeatFromAbsoluteQuarter(qtr, beatsPerBar, totalBars);
}

const EFFECT_TYPES: EffectType[] = ['eq', 'compressor', 'reverb', 'delay', 'chorus', 'flanger', 'distortion', 'filter'];


let globalClipId = 100;

function mkClip(bar: number, len: number, label: string, audioBuffer?: AudioBuffer): Clip {
  const c: Clip = { id: globalClipId++, bar, len, label };
  if (audioBuffer) c.audioBuffer = audioBuffer;
  return c;
}

/**
 * Timeline clip.len is in bars. At tempo BPM, one bar = (60/BPM)*beatsPerBar seconds (4/4 ΓåÆ 4 beats/bar).
 * bars = duration_sec * (BPM/60) / beats_per_bar
 */
function clipBarLengthFromAudioDuration(
  durationSec: number,
  bpm: number,
  beatsPerBar: number = BEATS_PER_BAR,
): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 1;
  const tempo = Math.max(1, Number.isFinite(bpm) && bpm > 0 ? bpm : 120);
  const bars = (durationSec * (tempo / 60)) / beatsPerBar;
  return Math.max(1 / 16, Math.round(bars * 1000) / 1000);
}

/** Best-effort MIME for MediaRecorder + decodeAudioData across Chromium/Safari/Firefox. */
function pickMediaRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSafari =
    /safari/i.test(ua) && !/chrome|chromium|android/i.test(ua);
  const candidates = isSafari
    ? [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/aac',
        'audio/ogg;codecs=opus',
      ]
    : [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}


/** Session re-merge runs async ΓÇö preserve mic/import clips already committed on the timeline. */
function isModuleSessionClipLabel(label: string): boolean {
  return (
    label.startsWith('[AI]') ||
    label.startsWith('[Arr]') ||
    label.startsWith('[CS]')
  );
}

function mergeSessionSyncWithLocalRecordings(next: Track[], latest: Track[]): Track[] {
  const out = next.map((t) => ({ ...t, clips: [...t.clips] }));
  const findOutIdx = (row: Track) => {
    if (row.audioTrack != null && Number.isFinite(row.audioTrack)) {
      const byAt = out.findIndex((t) => t.audioTrack === row.audioTrack);
      if (byAt >= 0) return byAt;
    }
    return out.findIndex((t) => t.id === row.id);
  };
  for (const lt of latest) {
    const toAdd = lt.clips.filter(
      (c) => c.audioBuffer && !isModuleSessionClipLabel(c.label),
    );
    if (!toAdd.length) continue;
    const idx = findOutIdx(lt);
    if (idx >= 0) {
      const dest = out[idx];
      const clips = [...dest.clips];
      for (const c of toAdd) {
        if (!clips.some((dc) => dc.id === c.id)) clips.push(c);
      }
      out[idx] = { ...dest, clips };
    } else if (!out.some((t) => t.id === lt.id)) {
      out.push({ ...lt, clips: toAdd });
    }
  }
  return out;
}

function resolveClipCollisions(clips: Clip[]): Clip[] {
  const sorted = [...clips].sort((a, b) => a.bar - b.bar);
  const result: Clip[] = [];
  for (const clip of sorted) {
    const last = result[result.length - 1];
    result.push(
      last && clip.bar < last.bar + last.len
        ? { ...clip, bar: last.bar + last.len, startTick: undefined }
        : { ...clip },
    );
  }
  return result;
}

/** Place one copy directly after the source clip (same row); then fix overlaps. */
function duplicateClipImmediatelyAfter(
  tracks: Track[],
  trackId: number,
  clipId: number,
  ticksPerBar: number,
): Track[] {
  return tracks.map((t) => {
    if (t.id !== trackId) return t;
    const clip = t.clips.find((c) => c.id === clipId);
    if (!clip) return t;
    const dup = mkClip(clip.bar + clip.len, clip.len, clip.label, clip.audioBuffer);
    if (typeof clip.startTick === 'number' && Number.isFinite(clip.startTick)) {
      dup.startTick = Math.round(clip.startTick + clip.len * ticksPerBar);
    }
    return { ...t, clips: resolveClipCollisions([...t.clips, dup]) };
  });
}

/** Rows per session `audioTrack` ΓÇö used to flag duplicate CH in the UI. */
function countAudioTrackDuplicates(trs: { audioTrack?: number }[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of trs) {
    const at = t.audioTrack;
    if (at != null && Number.isFinite(at)) m.set(at, (m.get(at) ?? 0) + 1);
  }
  return m;
}

/** UI-only local channel numbering (CH1..N) by first appearance order; backend `audioTrack` stays unchanged. */
function buildDisplayChannelMap(trs: { audioTrack?: number }[]): Map<number, number> {
  const m = new Map<number, number>();
  let idx = 1;
  for (const t of trs) {
    const at = t.audioTrack;
    if (at == null || !Number.isFinite(at)) continue;
    if (!m.has(at)) {
      m.set(at, idx);
      idx += 1;
    }
  }
  return m;
}

/**
 * Visible session channel ΓÇö always from `audioTrack`, never timeline row `id`.
 * ΓÜá when two rows share the same `audioTrack` (should not happen after manifest merge).
 */
function sessionChDisplayLabel(
  t: { audioTrack?: number },
  dupByCh: Map<number, number>,
  displayChMap?: Map<number, number>,
): string {
  const at = t.audioTrack;
  if (at == null || !Number.isFinite(at)) return 'CH ΓÇö';
  const display = displayChMap?.get(at) ?? at;
  return (dupByCh.get(at) ?? 0) > 1 ? `CH${display} ΓÜá` : `CH${display}`;
}

/** MasterClock channel for fader/meter: session slot when set, else internal row id (not shown as CH). */
function mixerRoutingChannel(t: { id: number; audioTrack?: number }): number {
  return t.audioTrack != null && Number.isFinite(t.audioTrack) ? t.audioTrack : t.id;
}

function getTrackStereoMode(t: { stereoMode?: 'stereo' | 'mono' }): 'stereo' | 'mono' {
  return t.stereoMode === 'mono' ? 'mono' : 'stereo';
}

/** DOM x position: use a custom property so React can keep a stable `transform` in JSX. */
const STUDIO_PLAYHEAD_X_VAR = '--da-studio-ph-x';
const STUDIO_RULER_HL_X_VAR = '--da-ruler-hl-x';

/** Same instant as {@link readStudioTransportSnapshotForUi} / clip grid reads — one Studio display clock. */
function studioAudioNowForPaint(ctx: AudioContext | null | undefined): number | null {
  return displayAudioNowForStudio(ctx);
}

function studioPlayheadApplyLeft(
  el: HTMLDivElement,
  map: StudioTimelineMap,
  beatForPixel: number,
  allowNeg: boolean,
) {
  if (!Number.isFinite(beatForPixel)) return;
  let gx = map.absoluteBeatToX(beatForPixel);
  if (!allowNeg) gx = Math.max(0, gx);
  gx = Math.min(gx, map.totalWidthPx - 1e-6);
  if (!Number.isFinite(gx)) return;
  /** Subpixel `translate3d` — rounding to int px caused staircase motion that read as “skipping” beats. */
  const x = Math.max(0, Math.min(gx, map.totalWidthPx - 1e-6));
  el.style.setProperty(STUDIO_PLAYHEAD_X_VAR, `${x}px`);
}

/** Ruler measure-column highlight — same beat as cyan line; called from the transport pump only (no second rAF). */
function studioRulerPlayheadApplyHighlight(
  el: HTMLDivElement,
  map: StudioTimelineMap,
  beatFloat: number,
  allowNeg: boolean,
) {
  if (!Number.isFinite(beatFloat)) return;
  const measureW = map.beatColumnWidthPx;
  const b = Math.max(0, beatFloat);
  const beatIdx0 = Math.floor(b + 1e-9);
  let hx = map.absoluteBeatToX(beatIdx0);
  if (!allowNeg) hx = Math.max(0, hx);
  hx = Math.min(hx, Math.max(0, map.totalWidthPx - measureW));
  if (!Number.isFinite(hx)) return;
  el.style.setProperty(STUDIO_RULER_HL_X_VAR, `${hx}px`);
  el.style.width = `${measureW}px`;
}

/**
 * Cyan timeline playhead is painted imperatively from {@link StudioEditorScreen} (not a memo child)
 * so every frame uses the latest `getStudioTransportSyncSnapshotAtAudioNow` and stable rAF (no stale refs / effect churn).
 */

/**
 * Ruler bar + beat highlights without React state ΓÇö avoids full-tree re-renders every quarter that
 * dropped frames and made the ΓÇ£otherΓÇ¥ highlight skip vs the line.
 */
type StudioRulerPlayheadHighlightsProps = {
  isActive: boolean;
  timelineMap: StudioTimelineMap;
  beatForPixel: number;
  liveBeatForPixel?: () => number | null;
  allowNeg: boolean;
  rulerBarH: number;
  rulerMeasH: number;
  getTransportBeatFloat?: () => number;
  /** Parent assigns the beat-column node so {@link StudioEditorScreen} transport pump can paint highlights in sync with the cyan line. */
  beatColumnExposeRef?: MutableRefObject<HTMLDivElement | null>;
  /** True while master transport runs (non–local-precount): parent pump owns column paint — avoids a second rAF vs MET/grid. */
  suppressInternalHighlightRaf?: boolean;
};

function studioRulerPlayheadHighlightsPropsEqual(
  prev: StudioRulerPlayheadHighlightsProps,
  next: StudioRulerPlayheadHighlightsProps,
): boolean {
  if (prev.isActive !== next.isActive) return false;
  if (prev.allowNeg !== next.allowNeg) return false;
  if (prev.liveBeatForPixel !== next.liveBeatForPixel) return false;
  if (prev.timelineMap !== next.timelineMap) return false;
  if (prev.rulerBarH !== next.rulerBarH) return false;
  if (prev.rulerMeasH !== next.rulerMeasH) return false;
  if (prev.getTransportBeatFloat !== next.getTransportBeatFloat) return false;
  if (prev.beatColumnExposeRef !== next.beatColumnExposeRef) return false;
  if (prev.suppressInternalHighlightRaf !== next.suppressInternalHighlightRaf)
    return false;
  if (
    next.isActive &&
    !next.liveBeatForPixel &&
    next.getTransportBeatFloat
  ) {
    /* rAF paints; ignore scrub prop updates when audio drives motion. */
  } else if (prev.beatForPixel !== next.beatForPixel) {
    return false;
  }
  return true;
}

const StudioRulerPlayheadHighlights = memo(function StudioRulerPlayheadHighlights({
  isActive,
  timelineMap,
  beatForPixel,
  liveBeatForPixel,
  allowNeg,
  rulerBarH,
  rulerMeasH,
  getTransportBeatFloat,
  beatColumnExposeRef,
  suppressInternalHighlightRaf,
}: StudioRulerPlayheadHighlightsProps) {
  const { getStudioTransportSyncSnapshotAtAudioNow, audioCtxRef } = useMasterClock();
  /** One column over bar + beat rows ΓÇö advances each quarter (measure slot), not whole-bar width. */
  const beatColumnRef = useRef<HTMLDivElement | null>(null);
  const timelineMapRef = useRef(timelineMap);
  timelineMapRef.current = timelineMap;
  const beatForPixelRef = useRef(beatForPixel);
  beatForPixelRef.current = beatForPixel;
  const allowNegRef = useRef(allowNeg);
  allowNegRef.current = allowNeg;
  const liveRef = useRef(liveBeatForPixel);
  liveRef.current = liveBeatForPixel;
  const getTransportBeatFloatRef = useRef(getTransportBeatFloat);
  getTransportBeatFloatRef.current = getTransportBeatFloat;
  const getSnapAtRef = useRef(getStudioTransportSyncSnapshotAtAudioNow);
  getSnapAtRef.current = getStudioTransportSyncSnapshotAtAudioNow;

  const applyShades = useCallback((beat: number) => {
    const map = timelineMapRef.current;
    const measureW = map.beatColumnWidthPx;
    const el = beatColumnRef.current;
    if (el) {
      const b = Math.max(0, beat);
      /* Snap column to the same integer-beat left edges as ruler cells (`bi * qpb + mi`). */
      const beatIdx0 = Math.floor(b + 1e-9);
      let hx = map.absoluteBeatToX(beatIdx0);
      if (!allowNegRef.current) hx = Math.max(0, hx);
      hx = Math.min(hx, Math.max(0, map.totalWidthPx - measureW));
      el.style.setProperty(STUDIO_RULER_HL_X_VAR, `${hx}px`);
      el.style.width = `${measureW}px`;
    }
  }, []);

  useLayoutEffect(() => {
    if (!isActive) return;
    if (liveBeatForPixel) return;
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'closed') return;
    const getBeat = getTransportBeatFloatRef.current;
    if (!getBeat) return;
    const b = getBeat();
    if (Number.isFinite(b)) applyShades(b);
  }, [isActive, liveBeatForPixel, applyShades, timelineMap, audioCtxRef]);

  useLayoutEffect(() => {
    if (!isActive) return;
    if (suppressInternalHighlightRaf) return;
    if (!liveBeatForPixel && getTransportBeatFloatRef.current) return;
    const live = liveBeatForPixel?.();
    const beat =
      typeof live === 'number' && Number.isFinite(live) ? live : beatForPixel;
    applyShades(beat);
  }, [
    isActive,
    beatForPixel,
    liveBeatForPixel,
    applyShades,
    suppressInternalHighlightRaf,
  ]);

  useEffect(() => {
    if (!isActive || !liveBeatForPixel || suppressInternalHighlightRaf) return;
    let raf = 0;
    const step = () => {
      const liveFn = liveRef.current;
      if (!liveFn) return;
      const live = liveFn();
      const beat =
        typeof live === 'number' && Number.isFinite(live)
          ? live
          : beatForPixelRef.current;
      applyShades(beat);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isActive, applyShades, liveBeatForPixel, suppressInternalHighlightRaf]);

  useEffect(() => {
    if (!isActive || liveBeatForPixel) return;
    let raf = 0;
    const step = () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'closed') {
        const audioNow = studioAudioNowForPaint(ctx) ?? ctx.currentTime;
        const beat = studioGridBeatFloatFromSnapshot(
          getSnapAtRef.current(audioNow),
        );
        if (Number.isFinite(beat)) applyShades(beat);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [
    isActive,
    liveBeatForPixel,
    applyShades,
    audioCtxRef,
    getStudioTransportSyncSnapshotAtAudioNow,
  ]);

  const rulerH = rulerBarH + rulerMeasH;
  return (
    <div
      className="absolute left-0 top-0 pointer-events-none overflow-hidden"
      style={{
        width: timelineMap.totalWidthPx,
        height: rulerH,
        zIndex: 15,
        opacity: isActive ? 1 : 0,
      }}
      aria-hidden
    >
      <div
        ref={(node) => {
          beatColumnRef.current = node;
          if (beatColumnExposeRef) beatColumnExposeRef.current = node;
        }}
        className="absolute left-0 top-0"
        style={{
          height: rulerH,
          background: STUDIO_PLAYHEAD_LINE.rulerFill,
          boxSizing: 'border-box',
          borderLeft: `1px solid ${STUDIO_PLAYHEAD_LINE.rulerStroke}`,
          borderRight: `1px solid ${STUDIO_PLAYHEAD_LINE.rulerStroke}`,
          transform: `translateX(var(${STUDIO_RULER_HL_X_VAR}, 0px))`,
        }}
      />
    </div>
  );
}, studioRulerPlayheadHighlightsPropsEqual);

const StudioLockBeatReadout = memo(function StudioLockBeatReadout({
  isActive,
  beatsPerBar,
  totalBars,
  getBeatFloat,
  clockRunning,
}: {
  isActive: boolean;
  /** Quarters per bar — same as timeline ruler / {@link createStudioTimelineMap}. */
  beatsPerBar: number;
  totalBars?: number;
  getBeatFloat: () => number;
  /** Same windows as the cyan playhead — rAF + AudioContext so bar.beat matches transport each frame. */
  clockRunning: boolean;
}) {
  const {
    getStudioTransportSyncSnapshotAtAudioNow,
    getStudioTransportSyncSnapshot,
    audioCtxRef,
  } = useMasterClock();
  const textRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const el = textRef.current;
    if (!el) return;

    const paintFromSnap = (snap: StudioTransportSyncSnapshot) => {
      const tbb = studioTransportToBarBeatFromSnap(snap, beatsPerBar, totalBars);
      el.textContent = `${tbb.bar}.${tbb.beatInBar}`;
    };

    if (clockRunning) {
      const paint = (t: number | null) => {
        if (t == null) return;
        paintFromSnap(getStudioTransportSyncSnapshotAtAudioNow(t));
      };
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'closed') {
        const audioNow = studioAudioNowForPaint(ctx) ?? ctx.currentTime;
        paintFromSnap(getStudioTransportSyncSnapshotAtAudioNow(audioNow));
      }
      return subscribeStudioPlayheadFrame(paint);
    }

    let raf = 0;
    const step = () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'closed') {
        const snap = readStudioTransportSnapshotForUi(
          getStudioTransportSyncSnapshotAtAudioNow,
          getStudioTransportSyncSnapshot,
          ctx,
        );
        paintFromSnap(snap);
      } else {
        const beat = Math.max(0, getBeatFloat());
        const tbb = studioRulerBarBeatFromAbsoluteQuarter(
          beat,
          beatsPerBar,
          totalBars,
        );
        el.textContent = `${tbb.bar}.${tbb.beatInBar}`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [
    isActive,
    clockRunning,
    beatsPerBar,
    totalBars,
    getBeatFloat,
    getStudioTransportSyncSnapshot,
    getStudioTransportSyncSnapshotAtAudioNow,
    audioCtxRef,
  ]);
  return (
    <span
      ref={textRef}
      style={{
        fontFamily: 'monospace',
        fontSize: 10,
        fontWeight: 800,
        color: '#fbbf24',
        border: '1px solid #333',
        borderRadius: 4,
        background: '#090909',
        padding: '2px 6px',
        minWidth: 44,
        textAlign: 'center',
      }}
      title="Bar.beat — Studio timeline quarter grid (same columns as ruler), sampled each display frame from AudioContext."
    >
      1.1
    </span>
  );
});

const StudioDawLockStatusReadout = memo(function StudioDawLockStatusReadout({
  isActive,
  clockRunning,
  beatsPerBar,
  totalBars,
  timeSigs,
}: {
  isActive: boolean;
  clockRunning: boolean;
  beatsPerBar: number;
  totalBars?: number;
  timeSigs: TimeSignature[];
}) {
  const { getStudioTransportSyncSnapshotAtAudioNow, audioCtxRef } = useMasterClock();
  const [ui, setUi] = useState(() => ({
    beatInBar: 1,
    numer: 4,
    locked: true,
    ooo: 0,
    skip: 0,
  }));

  const lastQuarterRef = useRef(-1);
  const auditRef = useRef({ ooo: 0, skip: 0 });
  const wasClockRef = useRef(false);
  const warnedRef = useRef(false);

  useEffect(() => {
    warnedRef.current = false;
    if (!isActive) {
      wasClockRef.current = false;
      lastQuarterRef.current = -1;
      auditRef.current = { ooo: 0, skip: 0 };
      setUi((p) => ({ ...p, locked: true, ooo: 0, skip: 0 }));
      return;
    }
    if (!clockRunning) {
      wasClockRef.current = false;
      lastQuarterRef.current = -1;
      auditRef.current = { ooo: 0, skip: 0 };
      const numer = Math.max(1, Math.min(12, timeSigs[0]?.numerator ?? 4));
      setUi({
        beatInBar: 1,
        numer,
        locked: true,
        ooo: 0,
        skip: 0,
      });
      return;
    }

    if (!wasClockRef.current) {
      lastQuarterRef.current = -1;
      auditRef.current = { ooo: 0, skip: 0 };
    }
    wasClockRef.current = true;

    const numer0 = Math.max(1, Math.min(12, timeSigs[0]?.numerator ?? 4));

    const tickFromSnap = (snap: StudioTransportSyncSnapshot) => {
      const beat = studioGridBeatFloatFromSnapshot(snap);
      const quarter = Math.floor(Math.max(0, beat) + 1e-9);
      const prev = lastQuarterRef.current;
      if (prev >= 0) {
        if (quarter < prev) {
          auditRef.current.ooo += 1;
        } else if (quarter > prev + 1) {
          auditRef.current.skip += quarter - prev - 1;
        }
      }
      lastQuarterRef.current = quarter;

      const tbb = studioRulerBarBeatFromAbsoluteQuarter(beat, beatsPerBar, totalBars);
      const ooo = auditRef.current.ooo;
      const skip = auditRef.current.skip;
      const locked = ooo === 0 && skip === 0;

      if (!locked && !warnedRef.current) {
        warnedRef.current = true;
        console.warn(
          '[Studio DAW Lock] quarter-order violation',
          JSON.stringify({ outOfOrderCount: ooo, skippedQuarterCount: skip }),
        );
      }
      if (locked) warnedRef.current = false;

      setUi((prevUi) => {
        const next = {
          beatInBar: tbb.beatInBar,
          numer: numer0,
          locked,
          ooo,
          skip,
        };
        if (
          prevUi.beatInBar === next.beatInBar &&
          prevUi.numer === next.numer &&
          prevUi.locked === next.locked &&
          prevUi.ooo === next.ooo &&
          prevUi.skip === next.skip
        ) {
          return prevUi;
        }
        return next;
      });
    };

    const step = (t: number | null) => {
      if (t == null) return;
      tickFromSnap(getStudioTransportSyncSnapshotAtAudioNow(t));
    };
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'closed') {
      const audioNow = studioAudioNowForPaint(ctx) ?? ctx.currentTime;
      tickFromSnap(getStudioTransportSyncSnapshotAtAudioNow(audioNow));
    }
    return subscribeStudioPlayheadFrame(step);
  }, [
    isActive,
    clockRunning,
    beatsPerBar,
    totalBars,
    timeSigs,
    getStudioTransportSyncSnapshotAtAudioNow,
    audioCtxRef,
  ]);

  const numer = Math.max(1, Math.min(12, timeSigs[0]?.numerator ?? 4));
  const displayNumer = isActive && clockRunning ? ui.numer : numer;

  if (!isActive) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'monospace',
          fontSize: 9,
          fontWeight: 700,
          color: '#6b7280',
          border: '1px solid #222',
          borderRadius: 4,
          background: '#050505',
          padding: '2px 6px',
          minWidth: 160,
        }}
        title="DAW quarter lock (idle)"
      >
        <span>LOCK —</span>
      </div>
    );
  }

  if (!clockRunning) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'monospace',
          fontSize: 9,
          fontWeight: 700,
          color: '#6b7280',
          border: '1px solid #222',
          borderRadius: 4,
          background: '#050505',
          padding: '2px 6px',
          minWidth: 160,
        }}
        title="Transport stopped — beat ladder shows meter length; play to lock quarters in order."
      >
        <span style={{ color: '#71717a' }}>LOCK ready</span>
        {Array.from({ length: displayNumer }, (_, i) => (
          <span
            key={i}
            style={{
              color: '#3f3f46',
              minWidth: 9,
              textAlign: 'center',
            }}
          >
            {i + 1}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'monospace',
        fontSize: 9,
        fontWeight: 700,
        border: '1px solid #222',
        borderRadius: 4,
        background: '#050505',
        padding: '2px 6px',
        minWidth: 168,
        flexShrink: 0,
      }}
      title="Quarters audited on the same audio clock as the playhead. Amber = current beat in bar; green LOCK OK = strict +1 quarter order."
    >
      <span style={{ color: ui.locked ? '#86efac' : '#f87171' }}>
        {ui.locked ? 'LOCK OK' : 'LOCK WARN'}
      </span>
      {Array.from({ length: ui.numer }, (_, i) => {
        const n = i + 1;
        const on = n === ui.beatInBar;
        return (
          <span
            key={n}
            style={{
              color: on ? '#fbbf24' : '#52525b',
              fontWeight: 800,
              minWidth: 10,
              textAlign: 'center',
              textShadow: on ? '0 0 8px rgba(251,191,36,0.45)' : 'none',
            }}
          >
            {n}
          </span>
        );
      })}
      {!ui.locked ? (
        <span style={{ color: '#f87171', fontSize: 8, marginLeft: 2 }}>
          Δ{ui.ooo}/{ui.skip}
        </span>
      ) : null}
    </div>
  );
});

const StudioRenderCadenceReadout = memo(function StudioRenderCadenceReadout({
  isActive,
}: {
  isActive: boolean;
}) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    if (!isActive) {
      el.textContent = 'UI idle';
      el.style.color = '#6b7280';
      return;
    }
    let raf = 0;
    let lastNow = performance.now();
    let windowStart = lastNow;
    let sampleCount = 0;
    let sumGapMs = 0;
    let maxGapMs = 0;
    let longGapCount = 0;
    const publish = () => {
      const avgGapMs = sampleCount > 0 ? sumGapMs / sampleCount : 0;
      const fps = avgGapMs > 0 ? 1000 / avgGapMs : 0;
      el.textContent = `UI ${fps.toFixed(0)}fps avg ${avgGapMs.toFixed(1)} max ${maxGapMs.toFixed(1)} long ${longGapCount}`;
      el.style.color = maxGapMs > 120 ? '#f87171' : maxGapMs > 48 ? '#fbbf24' : '#86efac';
      sampleCount = 0;
      sumGapMs = 0;
      maxGapMs = 0;
      longGapCount = 0;
    };
    const step = (nowMs: number) => {
      const gapMs = Math.max(0, nowMs - lastNow);
      lastNow = nowMs;
      if (gapMs > 0 && gapMs < 5000) {
        sampleCount += 1;
        sumGapMs += gapMs;
        if (gapMs > maxGapMs) maxGapMs = gapMs;
        if (gapMs > 34) longGapCount += 1;
      }
      if (nowMs - windowStart >= 500) {
        publish();
        windowStart = nowMs;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isActive]);
  return (
    <span
      ref={textRef}
      style={{
        fontFamily: 'monospace',
        fontSize: 9,
        fontWeight: 700,
        color: '#6b7280',
        border: '1px solid #222',
        borderRadius: 4,
        background: '#050505',
        padding: '2px 6px',
        minWidth: 168,
        textAlign: 'left',
      }}
      title="Render cadence monitor for playhead smoothness: fps, avg frame gap ms, max frame gap ms, and long frame count (>34ms)"
    >
      UI idle
    </span>
  );
});

/**
 * Playhead / transport sync strip + beat lamps (1..N per time sig). Same grid as MET when clicks are on;
 * this UI follows **playhead** phase, not a separate “metronome graphic.”
 */
const StudioLiveSyncHud = memo(function StudioLiveSyncHud({
  isActive,
  clockRunning,
  metronomeEnabled,
  beatsPerBar,
  getStudioTransportSyncSnapshot,
  pixelsPerBeat,
}: {
  isActive: boolean;
  /** Same as moving playhead — rAF + `AudioContext.currentTime`; when false, paint once from fallback snapshot. */
  clockRunning: boolean;
  metronomeEnabled: boolean;
  beatsPerBar: number;
  getStudioTransportSyncSnapshot: () => StudioTransportSyncSnapshot;
  pixelsPerBeat: number;
}) {
  const { getStudioTransportSyncSnapshotAtAudioNow, audioCtxRef } = useMasterClock();
  const getSnapAtRef = useRef(getStudioTransportSyncSnapshotAtAudioNow);
  getSnapAtRef.current = getStudioTransportSyncSnapshotAtAudioNow;
  const getSnapFallbackRef = useRef(getStudioTransportSyncSnapshot);
  getSnapFallbackRef.current = getStudioTransportSyncSnapshot;
  const syncLineRef = useRef<HTMLSpanElement | null>(null);
  const beatSlotRefs = useRef<(HTMLSpanElement | null)[]>(
    Array.from({ length: 12 }, () => null),
  );
  const numerator = Math.max(1, Math.min(12, Math.round(beatsPerBar)));
  useEffect(() => {
    if (!isActive) {
      const line = syncLineRef.current;
      if (line) {
        line.textContent = 'PLAYHEAD sync (idle)';
        line.style.color = '#6b7280';
      }
      for (let i = 0; i < 12; i++) {
        const el = beatSlotRefs.current[i];
        if (el) {
          el.style.color = '#444';
          el.style.textShadow = 'none';
        }
      }
      return;
    }
    const paint = (snap: StudioTransportSyncSnapshot) => {
      const beatMono = studioGridBeatFloatFromSnapshot(snap);
      const beat = studioCanonicalBeatFromSnapshot(snap);
      const nearestBeat = Math.round(beatMono);
      const gridDeltaPx = (beatMono - nearestBeat) * pixelsPerBeat;
      const metroAheadBeats =
        (snap.metronomeNextQuarterTick - snap.tickFloat) / PPQ;
      const expectedNextQuarter =
        Math.ceil(Math.max(0, beat) - 1e-9) * PPQ;
      const phaseErrorBeats =
        (snap.metronomeNextQuarterTick - expectedNextQuarter) / PPQ;
      const tbb = studioRulerBarBeatFromAbsoluteQuarter(beatMono, beatsPerBar);
      const nBeats = Math.max(1, Math.min(12, Math.round(beatsPerBar)));
      const phaseOk =
        !snap.running || Math.abs(phaseErrorBeats) <= 0.05;
      const metLabel = !metronomeEnabled
        ? 'MET OFF'
        : phaseOk
          ? 'MET ON | LOCK'
          : 'MET ON';
      const line = syncLineRef.current;
      if (line) {
        line.textContent = [
          `PH ${tbb.bar}.${tbb.beatInBar}`,
          `b${beatMono.toFixed(3)}`,
          `PErr ${phaseErrorBeats.toFixed(3)}`,
          `MET+ ${metroAheadBeats.toFixed(1)}`,
          `QΔ ${(snap.nextQuarterTick - snap.tickFloat).toFixed(0)}`,
          `Δpx ${gridDeltaPx.toFixed(1)}`,
          metLabel,
        ].join(' ');
        line.style.color =
          Math.abs(phaseErrorBeats) > 0.05 ? '#f87171' : '#86efac';
      }
      for (let i = 0; i < nBeats; i++) {
        const el = beatSlotRefs.current[i];
        if (el) {
          const active = tbb.beatInBar === i + 1;
          el.style.color = active ? '#fbbf24' : '#666';
          el.style.textShadow = active
            ? '0 0 6px rgba(251,191,36,0.7)'
            : 'none';
        }
      }
    };
    if (clockRunning) {
      const step = (t: number | null) => {
        if (t == null) return;
        paint(getSnapAtRef.current(t));
      };
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'closed') {
        const audioNow = studioAudioNowForPaint(ctx) ?? ctx.currentTime;
        paint(getSnapAtRef.current(audioNow));
      }
      return subscribeStudioPlayheadFrame(step);
    }
    paint(getSnapFallbackRef.current());
  }, [
    isActive,
    clockRunning,
    metronomeEnabled,
    beatsPerBar,
    getStudioTransportSyncSnapshot,
    pixelsPerBeat,
    audioCtxRef,
  ]);
  return (
    <>
      <span
        ref={syncLineRef}
        style={{
          fontFamily: 'monospace',
          fontSize: 9,
          background: '#050505',
          border: '1px solid #222',
          borderRadius: 4,
          padding: '2px 6px',
          flexShrink: 0,
          color: '#6b7280',
        }}
        title="Playhead / transport on the bar·beat grid (not the MET button). Digits = playhead phase; MET ON = audible clicks enabled + phase OK when LOCK."
      >
        PH …
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '1px 4px',
          borderRadius: 4,
          border: '1px solid #222',
          background: '#050505',
          flexShrink: 0,
        }}
        title="Playhead beat in bar (1…N) — which quarter the transport is on; order matches MET clicks when MET is on"
      >
        {Array.from({ length: numerator }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            ref={(el) => {
              beatSlotRefs.current[n - 1] = el;
            }}
            style={{
              minWidth: 10,
              textAlign: 'center',
              fontFamily: 'monospace',
              fontSize: 9,
              fontWeight: 700,
              color: '#666',
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </>
  );
});

/**
 * Pulses on each transport-grid quarter (same {@link getStudioTransportSyncSnapshotAtAudioNow} phase as the cyan playhead).
 * Magenta lamp = MET visual; title-bar MET = audio on/off.
 */
const StudioVisualMetronomeLamp = memo(function StudioVisualMetronomeLamp({
  isActive,
  metronomeEnabled,
  clockRunning,
  beatsPerBar,
}: {
  isActive: boolean;
  metronomeEnabled: boolean;
  /** Same windows as the moving playhead (transport + precount + audio running). */
  clockRunning: boolean;
  beatsPerBar: number;
}) {
  const { audioCtxRef, getStudioTransportSyncSnapshotAtAudioNow } = useMasterClock();
  const lampRef = useRef<HTMLDivElement | null>(null);
  const lastQuarterRef = useRef(-1);
  const decayTRef = useRef(0);
  const getSnapAtRef = useRef(getStudioTransportSyncSnapshotAtAudioNow);
  getSnapAtRef.current = getStudioTransportSyncSnapshotAtAudioNow;
  const beatsPerBarRef = useRef(beatsPerBar);
  beatsPerBarRef.current = beatsPerBar;

  useEffect(() => {
    const clearDecay = () => {
      if (decayTRef.current) {
        window.clearTimeout(decayTRef.current);
        decayTRef.current = 0;
      }
    };

    if (!isActive || !metronomeEnabled || !clockRunning) {
      clearDecay();
      lastQuarterRef.current = -1;
      const el = lampRef.current;
      if (el) {
        el.style.transition = '';
        el.style.opacity = metronomeEnabled ? '0.4' : '0.22';
        el.style.transform = 'scale(1)';
        el.style.boxShadow = 'none';
      }
      return;
    }

    lastQuarterRef.current = -1;
    const runAt = (audioNow: number) => {
      const snap = getSnapAtRef.current(audioNow);
      const b = studioGridBeatFloatFromSnapshot(snap);
      const q = Math.floor(b + 1e-9);
      if (lastQuarterRef.current < 0) {
        lastQuarterRef.current = q;
      } else if (q !== lastQuarterRef.current) {
        lastQuarterRef.current = q;
        const tbb = studioRulerBarBeatFromAbsoluteQuarter(
          b,
          beatsPerBarRef.current,
        );
        const isDown = tbb.beatInBar === 1;
        const el = lampRef.current;
        if (el) {
          clearDecay();
          el.style.transition =
            'transform 0.05s ease-out, opacity 0.07s ease-out, box-shadow 0.09s ease-out';
          el.style.opacity = '1';
          el.style.transform = isDown ? 'scale(1.24)' : 'scale(1.1)';
          el.style.boxShadow = isDown
            ? '0 0 20px rgba(213,0,249,0.95), inset 0 0 10px rgba(255,255,255,0.4)'
            : '0 0 14px rgba(167,139,250,0.92)';
          decayTRef.current = window.setTimeout(() => {
            const lamp = lampRef.current;
            if (!lamp) return;
            lamp.style.opacity = '0.62';
            lamp.style.transform = 'scale(1)';
            lamp.style.boxShadow = 'none';
          }, 95);
        }
      }
    };
    const step = (t: number | null) => {
      if (t == null) return;
      runAt(t);
    };
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'closed') {
      runAt(studioAudioNowForPaint(ctx) ?? ctx.currentTime);
    }
    const unsub = subscribeStudioPlayheadFrame(step);
    return () => {
      clearDecay();
      unsub();
    };
  }, [
    isActive,
    metronomeEnabled,
    clockRunning,
    beatsPerBar,
    audioCtxRef,
    getStudioTransportSyncSnapshotAtAudioNow,
  ]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        padding: '1px 5px',
        borderRadius: 4,
        border: '1px solid #2a2a2a',
        background: '#0a0a0a',
      }}
      title="Visual metronome: flashes each grid quarter (same clock as playhead + MET schedule). Stronger pulse = downbeat."
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 800,
          color: '#a78bfa',
          letterSpacing: 0.4,
          userSelect: 'none',
        }}
      >
        MET
      </span>
      <div
        ref={lampRef}
        style={{
          width: 13,
          height: 13,
          borderRadius: 999,
          border: '2px solid #D500F9',
          background: metronomeEnabled ? '#1f0f2e' : '#141414',
          opacity: metronomeEnabled ? 0.45 : 0.2,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
});

type StudioEditorScreenProps = {
  onExport: (dest: string, audioBlob?: Blob) => void;
  /** When set (e.g. from Vocal Lab export), decode and append one Audio track clip to the timeline. */
  pendingStudioAudioBlob?: Blob | null;
  onPendingStudioAudioConsumed?: () => void;
  /** Full Studio JSON from Supabase (serializeStudioProject shape); applied once then cleared by parent. */
  pendingCloudStudioJson?: string | null;
  onPendingCloudStudioConsumed?: () => void;
  /** False when another nav tab is visible ΓÇö disables global DAW key handlers. */
  isStudioScreenActive?: boolean;
};

export default function StudioEditorScreen({
  onExport,
  pendingStudioAudioBlob = null,
  onPendingStudioAudioConsumed,
  pendingCloudStudioJson = null,
  onPendingCloudStudioConsumed,
  isStudioScreenActive = true,
}: StudioEditorScreenProps) {
  const {
    positionTicks,
    songTotalBars,
    ticksToSeconds,
    audioCtxRef,
    getOrCreateAudioContext,
    getTickIntAtAudioNow,
    snapTick,
    transport,
    getTransportBeatUiSnapshot,
    subscribeTransportBeatUi,
    getStudioTransportSyncSnapshot,
    getStudioTransportSyncSnapshotAtAudioNow,
    getIsAudioTransportRunning,
    tickCounterRef,
    bpm,
    channelLevels,
    channelVolumes,
    setChannelVolume,
    play,
    pause,
    stop,
    record,
    getTransportAudioBpm,
    tickToBarBeat,
    metronomeEnabled,
    setMetronomeEnabled,
    wrapGlobalTickToDisplayTick,
    seekToTick,
    setBpm,
    masterOutputLinear,
    setMasterOutputLinear,
    masterMeterAnalyserRef,
    loopEnabled,
    loopStartBar,
    loopBars,
    ticksPerBar,
    quartersPerBar,
    timeSigs,
  } = useMasterClock();

  /**
   * Single Studio “engine clock” (musio `DAWCore`-style façade): all idle reads and timeline audio
   * use this — no second ad-hoc paths that drift from MET / `tickFloat`.
   */
  const studioTransportClock = useMemo(
    () =>
      createStudioTransportClock({
        getAtAudioNow: getStudioTransportSyncSnapshotAtAudioNow,
        getIdle: getStudioTransportSyncSnapshot,
        getAudioCtx: () => audioCtxRef.current,
      }),
    [
      getStudioTransportSyncSnapshotAtAudioNow,
      getStudioTransportSyncSnapshot,
    ],
  );

  /** Always derive from `AudioContext.currentTime` when live; else idle snapshot (paused/stopped). */
  const getUnifiedStudioSyncSnapshot = useCallback((): StudioTransportSyncSnapshot => {
    return studioTransportClock.frameNow();
  }, [studioTransportClock]);

  /** Beat columns per bar ΓÇö must match MasterClock time signature (not hardcoded 4). */
  const qpb = Math.max(1, Math.round(quartersPerBar));

  const wrapGlobalTickToDisplayTickRef = useRef(wrapGlobalTickToDisplayTick);
  wrapGlobalTickToDisplayTickRef.current = wrapGlobalTickToDisplayTick;
  const getTickIntAtAudioNowRef = useRef(getTickIntAtAudioNow);
  getTickIntAtAudioNowRef.current = getTickIntAtAudioNow;
  /** Latest session tick for transport readers (recording, clip rAF) without re-subscribing effects. */
  const positionTicksRef = useRef(positionTicks);
  positionTicksRef.current = positionTicks;
  /**
   * Timeline length (bars) ΓÇö matches session song length so grid width Γåö measure count stay aligned.
   * Capped for perf; minimum 64 bars of headroom for typical sessions.
   */
  const BARS = Math.max(64, Math.min(512, songTotalBars));

  const {
    globalZoom,
    setGlobalZoom,
    globalVZoom,
    setGlobalVZoom,
    studioHeight,
    setStudioHeight,
    selectedBar,
    selectedMeasureInBar,
    setSelectedBar,
  } = useView();
  const { settings } = useSettings();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      setSelectedBar(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSelectedBar]);

  const trackManager = useTrackManager('studio-editor');
  const trackManagerRef = useRef(trackManager);
  trackManagerRef.current = trackManager;
  const bpmRef = useRef(bpm ?? 120);
  bpmRef.current = bpm ?? 120;

  /** Built from `readCombinedSessionTrackManifest` after hydrate / sync ΓÇö not a fixed Creation-style row count. */
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tool, setTool] = useState<'pointer' | 'razor'>('pointer');
  /**
   * MediaRecorder finalizes onto this row ΓÇö driven only by explicit record arm (not waveform editor selection).
   * Resolve by `audioTrack` after manifest rebuild when possible.
   */
  const recordTargetTrackRef = useRef<{ id: number; name: string; audioTrack?: number } | null>(null);
  /** Timeline row id with record arm (exclusive). Ref mirrored for synchronous MasterClock record() preflight. */
  const [recordArmedTrackId, setRecordArmedTrackId] = useState<number | null>(null);
  const recordArmedTrackRef = useRef<number | null>(null);
  const recordArmedSessionSlotRef = useRef<number | null>(null);
  /** Shown when Record fails preflight or mic permission ΓÇö replaces console-only failures. */
  const [recordPathHint, setRecordPathHint] = useState<string | null>(null);
  /** Local precount: N├ù4/4 bars of clicks on the shared AudioContext, then `record({ countIn: false })` (no MasterClock `counting` transport). */
  const [studioPrecountEnabled, setStudioPrecountEnabled] = useState(false);
  const [studioPrecountBars, setStudioPrecountBars] = useState(1);
  const [studioTimingMode, setStudioTimingMode] = useState<'beats' | 'time'>(() => {
    if (typeof window === 'undefined') return 'beats';
    try {
      return localStorage.getItem(STUDIO_TIMING_MODE_STORAGE_KEY) === 'time'
        ? 'time'
        : 'beats';
    } catch {
      return 'beats';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STUDIO_TIMING_MODE_STORAGE_KEY, studioTimingMode);
    } catch {
      /* ignore */
    }
  }, [studioTimingMode]);
  const [isStudioPrecounting, setIsStudioPrecounting] = useState(false);
  const [studioPrecountBeat, setStudioPrecountBeat] = useState<number | null>(null);
  const studioPrecountCancelRef = useRef(false);
  const studioPrecountUiTimersRef = useRef<number[]>([]);
  const isStudioPrecountingRef = useRef(false);
  useEffect(() => {
    isStudioPrecountingRef.current = isStudioPrecounting;
  }, [isStudioPrecounting]);
  /** Ref for precount beat ΓÇö playhead rAF must not read stale React state. */
  const studioPrecountBeatRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    studioPrecountBeatRef.current = studioPrecountBeat;
  }, [studioPrecountBeat]);
  const transportRefForPlayhead = useRef(transport);
  transportRefForPlayhead.current = transport;
  /** Filled during local precount so the playhead tracks clicks before transport runs. */
  const studioPrecountTimelineRef = useRef<{
    playheadTick: number;
    totalBeats: number;
  } | null>(null);

  /** Timeline overlay: armed row + start beat while transport is recording. */
  const [liveRecordLane, setLiveRecordLane] = useState<{
    trackId: number;
    startBeat0: number;
  } | null>(null);
  const [editorTrack, setEditorTrack] = useState<Track | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [editingTrackName, setEditingTrackName] = useState('');

  useEffect(() => {
    recordArmedTrackRef.current = recordArmedTrackId;
  }, [recordArmedTrackId]);

  useEffect(() => {
    const t =
      recordArmedTrackId != null
        ? tracks.find((x) => x.id === recordArmedTrackId)
        : null;
    recordTargetTrackRef.current = t
      ? { id: t.id, name: t.name, audioTrack: t.audioTrack }
      : null;
    const w = window as unknown as {
      __daMusicStudioRecordTargetTrackId?: number | null;
      __daMusicStudioRecordTargetAudioTrack?: number | null;
    };
    w.__daMusicStudioRecordTargetTrackId = t?.id ?? null;
    w.__daMusicStudioRecordTargetAudioTrack =
      t?.audioTrack != null && Number.isFinite(t.audioTrack) ? t.audioTrack : null;
  }, [recordArmedTrackId, tracks]);

  /** After manifest sync, keep arm on same session channel if row id changed. */
  useEffect(() => {
    if (recordArmedTrackId == null) return;
    if (tracks.some((tr) => tr.id === recordArmedTrackId)) return;
    const slot = recordArmedSessionSlotRef.current;
    if (slot != null) {
      const m = tracks.find((tr) => tr.audioTrack === slot);
      if (m) {
        recordArmedTrackRef.current = m.id;
        setRecordArmedTrackId(m.id);
        return;
      }
    }
    recordArmedSessionSlotRef.current = null;
    recordArmedTrackRef.current = null;
    setRecordArmedTrackId(null);
  }, [tracks, recordArmedTrackId]);

  /** After manifest sync / rebuild, keep selection on the same session channel (stable `audioTrack`), not a stale `id`. */
  useEffect(() => {
    if (!tracks.length) return;
    setEditorTrack((et) => {
      if (!et) return et;
      if (et.audioTrack != null && Number.isFinite(et.audioTrack)) {
        const m = tracks.find((t) => t.audioTrack === et.audioTrack);
        if (m) return m;
      }
      return tracks.find((t) => t.id === et.id) ?? null;
    });
  }, [tracks]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [mixerOpen, setMixerOpen] = useState(true);
  const [performancePlaybackMode, setPerformancePlaybackMode] = useState(true);
  /** Mixer panel height ΓÇö bottom DAW strip; timeline uses remaining space above. */
  const [mixerHeight] = useState(340);

  const mixerScrollContainerRef = useRef<HTMLDivElement>(null);
  const trackListScrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mixerOpen || editorTrack == null) return;
    const trackId = editorTrack.id;
    const raf = requestAnimationFrame(() => {
      const root = mixerScrollContainerRef.current;
      if (!root) return;
      const el = root.querySelector(`[data-studio-mixer-strip="${trackId}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editorTrack?.id, mixerOpen, tracks.length]);

  useEffect(() => {
    if (editorTrack == null) return;
    const trackId = editorTrack.id;
    const raf = requestAnimationFrame(() => {
      const root = trackListScrollContainerRef.current;
      if (!root) return;
      const el = root.querySelector(`[data-studio-track-list-row="${trackId}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editorTrack?.id, tracks.length, globalVZoom]);
  /** True post-master RMS / peak (from shared AnalyserNode) for mixer master strip. */
  const [masterMeterDisplay, setMasterMeterDisplay] = useState({ rms: 0, peak: 0 });
  const masterMeterBufRef = useRef<Float32Array | null>(null);
  const masterPeakHoldRef = useRef(0);
  const masterMeterLastUiPushMsRef = useRef(0);
  const [trackPans, setTrackPans] = useState<Record<number, number>>(Object.fromEntries(tracks.map(t => [t.id, 0])));
  const [trackEffects, setTrackEffects] = useState<Record<number, EffectSlot[]>>({});
  const [masterSolo, setMasterSolo] = useState(false);
  const [masterEffects, setMasterEffects] = useState<EffectSlot[]>([]);
  const [masterAddFxOpen, setMasterAddFxOpen] = useState(false);
  const [dragFxSlot, setDragFxSlot] = useState<{ trackId: number; fromIndex: number } | null>(null);
  const [activeFxEditor, setActiveFxEditor] = useState<{ trackId: number; effectId: string } | null>(null);
  const [addFxTrackId, setAddFxTrackId] = useState<number | null>(null);
  /** After first load attempt from localStorage (avoid overwriting save before hydrate). */
  const [studioHydrated, setStudioHydrated] = useState(false);

  // DAW Editing Features
  const [snapType, setSnapType] = useState<SnapGridType>('1/4');
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const clipboardEditor = useClipboardEditor();

  // Transport Bar State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTempo, setRecordingTempo] = useState(bpm || 120);
  useEffect(() => {
    setRecordingTempo(bpm || 120);
  }, [bpm]);

  // Setup DAW keyboard shortcuts
  useDAWKeyboardShortcuts({
    onCut: () => {
      const selectedClipObjects = tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
      const { tracks: newTracks } = clipboardEditor.cut(selectedClipObjects, tracks);
      setTracks(newTracks);
      setSelectedClips([]);
      setSelectedBar(null);
    },
    onCopy: () => {
      const selectedClipObjects = tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
      clipboardEditor.copy(selectedClipObjects, tracks);
    },
    onPaste: () => {
      const newTracks = clipboardEditor.paste(tracks, Math.round(playheadPos) || 0);
      setTracks(newTracks);
    },
    onDuplicate: () => {
      const selectedClipObjects = tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
      const newTracks = clipboardEditor.duplicate(tracks, selectedClipObjects);
      setTracks(newTracks);
    },
    onDelete: () => {
      const newTracks = clipboardEditor.deleteClips(tracks, selectedClips);
      setTracks(newTracks);
      setSelectedClips([]);
      setSelectedBar(null);
    },
    onSelectAll: () => {
      const allClips = tracks.flatMap(t => t.clips);
      setSelectedClips(allClips.map(c => String(c.id)));
    },
    onZoomIn: () => setGlobalZoom(Math.min(4, globalZoom + 0.2)),
    onZoomOut: () => setGlobalZoom(Math.max(0.2, globalZoom - 0.2)),
  }, isStudioScreenActive);

  const [draggingClip, setDraggingClip] = useState<{ trackId: number; clipId: number } | null>(null);
  const dragStartContentXRef = useRef(0);
  const dragOrigStartBeat0Ref = useRef(0);
  const dragClipLenBeatsRef = useRef(0);
  const [shadowStartBeat0, setShadowStartBeat0] = useState<number | null>(null);
  const [isBarDragSelecting, setIsBarDragSelecting] = useState(false);
  const [showMusicEnhancer, setShowMusicEnhancer] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    /** Right-click target: waveform clip (duplicate/cut/copy/delete act on this clip). */
    targetClip?: { trackId: number; clipId: number };
  } | null>(null);
  const [undoStack, setUndoStack] = useState<Track[][]>([]);
  const [redoStack, setRedoStack] = useState<Track[][]>([]);

  const zoom = Math.max(0.2, Math.min(4, globalZoom));
  /** One bar width in px (= `quartersPerBar` quarter-notes from time sig). */
  const colW = Math.round(60 * zoom);
  /** Single scale: pixels Γåö Studio grid beats (`useStudioMusicalClock` + `ticksPerBar`). */
  const timelineMap = useMemo(
    () =>
      createStudioTimelineMap({
        colW,
        beatsPerBar: qpb,
        totalBars: BARS,
      }),
    [colW, BARS, qpb],
  );
  const studioTimelineMapRef = useRef(timelineMap);
  studioTimelineMapRef.current = timelineMap;


  const measureW = timelineMap.beatColumnWidthPx;
  /** Must match timeline ruler (bar row + measure row) so left header + track rows align with ruler + lanes. */
  const RULER_BAR_H = 18;
  const RULER_MEAS_H = 14;
  const RULER_H = RULER_BAR_H + RULER_MEAS_H;

  const loopEndBarMaster = loopStartBar + loopBars - 1;
  const studioVisLoopStart = Math.max(1, loopStartBar);
  const studioVisLoopEnd = Math.min(BARS, loopEndBarMaster);
  const studioLoopRegionOk = loopEnabled && studioVisLoopEnd >= studioVisLoopStart;
  const studioLoopBraceLeftPx = (studioVisLoopStart - 1) * colW;
  const studioLoopBraceWidthPx = (studioVisLoopEnd - studioVisLoopStart + 1) * colW;
  /** Beat labels overlap when zoomed out ΓÇö clip cells and hide glyph if too narrow. */
  const showBeatRulerLabels = measureW >= 10;
  const beatRulerFontPx = Math.min(
    8,
    Math.max(5, Math.floor(measureW * 0.85)),
  );
  /** Row height for track list + timeline (must stay identical for scroll sync). Base Γåæ for readable CH + name + controls. */
  /** Taller base so ARM / M / S / lock controls fit comfortably. */
  const TRACK_H = Math.round(80 * Math.max(1, Math.min(4, globalVZoom)));
  const isTransportRunning = transport === 'playing' || transport === 'recording';
  /** Ref copy so playhead rAF reads latest `transport` without re-running the effect on every edge. */
  const transportForPlayheadRef = useRef(transport);
  transportForPlayheadRef.current = transport;
  const getIsAudioTransportRunningRef = useRef(getIsAudioTransportRunning);
  getIsAudioTransportRunningRef.current = getIsAudioTransportRunning;
  const performancePlaybackActive = performancePlaybackMode && isTransportRunning;
  /** Include `counting` so ruler/playhead stay live during master count-in (not only local precount). */
  const playheadActiveOnRuler =
    isTransportRunning ||
    transport === 'counting' ||
    isStudioPrecounting;

  useEffect(() => {
    const w = window as unknown as { __daMusicStudioPerfPlayback?: boolean };
    w.__daMusicStudioPerfPlayback = performancePlaybackMode;
    return () => {
      delete w.__daMusicStudioPerfPlayback;
    };
  }, [performancePlaybackMode]);
  /**
   * Ruler highlights + idle layout: must match **audio** transport (incl. one frame before React
   * commits `transport`). The cyan-line rAF **effect** no longer depends on this — only reads refs —
   * so this does not restart that loop.
   */
  const playheadMotionActive =
    isStudioScreenActive &&
    (isTransportRunning ||
      transport === 'counting' ||
      isStudioPrecounting ||
      getIsAudioTransportRunning());
  /**
   * Keep the playhead column highlight on the same audio-frame path as the cyan playhead line.
   * Disabling this in PERF mode left only React `playheadBarForRuler` (sparse re-renders) ΓÇö
   * the grid highlight lagged the line and looked like drift vs the metronome.
   */
  const useDomRulerPlayheadHighlight = playheadMotionActive;
  /** Studio musical clock — playhead, clips, ruler, BBT/TIME (`useStudioMusicalClock` + engine). */
  const {
    transportBeatFloatForClips,
    studioPlayheadQuarterIdx0,
    effectiveRulerQuarterIdx0,
    studioLineBeatForPixel,
    studioTimingReadout,
    getStudioTransportBeatFloat,
    studioTransportReadRef,
  } = useStudioMusicalClock({
    positionTicks,
    songTotalBars,
    ticksPerBar,
    ticksToSeconds,
    timeSigs,
    transport,
    getTransportBeatUiSnapshot,
    subscribeTransportBeatUi,
    getStudioTransportSyncSnapshot,
    getStudioTransportSyncSnapshotAtAudioNow,
    getIsAudioTransportRunning,
    audioCtxRef,
    isStudioPrecounting,
    studioPrecountBeat,
    studioPrecountTimelineRef,
    PPQ,
  });
  /** Only for local precount rAF; during real transport, DOM rAF uses {@link getStudioTransportBeatFloat}. */
  const getLivePlayheadBeatForPixel = useCallback((): number | null => {
    return isStudioPrecounting ? getStudioTransportBeatFloat() : null;
  }, [isStudioPrecounting, getStudioTransportBeatFloat]);

  const studioPlayheadLineRef = useRef<HTMLDivElement | null>(null);
  /** Beat-column overlay — painted from the same transport pump as the cyan line (one rAF, one `audioNow`). */
  const studioRulerHighlightColumnRef = useRef<HTMLDivElement | null>(null);
  /** Latest `kickPump` from the transport playhead effect — used to boot the rAF chain on transport edges. */
  const pumpKickRef = useRef<() => void>(() => {});
  const getStudioSnapAtForPlayheadRef = useRef(getStudioTransportSyncSnapshotAtAudioNow);
  getStudioSnapAtForPlayheadRef.current = getStudioTransportSyncSnapshotAtAudioNow;
  const getStudioTransportBeatFloatForPlayheadRef = useRef(getStudioTransportBeatFloat);
  getStudioTransportBeatFloatForPlayheadRef.current = getStudioTransportBeatFloat;

  /** Bar / beat for ruler React cells — updated only from the same master `audioNow` as cyan line + MET. */
  const [rulerMusicalPlayhead, setRulerMusicalPlayhead] = useState<{
    bar: number;
    beat: number;
  } | null>(null);

  /** Latest grid quarter-float — updated every display rAF with the same snapshot as the cyan line. */
  const masterPulseGridBeatRef = useRef(0);

  /** Rebuilt path: only React-publish ruler bar/beat when the global quarter index changes (see `studioGridLockedPlayhead`). */
  const rulerQuarterGateRef = useRef(createRulerQuarterGate());

  const applyRulerFromGridBeat = useCallback(
    (beatMono: number) => {
      if (!Number.isFinite(beatMono)) return;
      const tbb = studioRulerBarBeatFromAbsoluteQuarter(
        Math.max(0, beatMono),
        qpb,
        BARS,
      );
      setRulerMusicalPlayhead((prev) =>
        prev && prev.bar === tbb.bar && prev.beat === tbb.beatInBar
          ? prev
          : { bar: tbb.bar, beat: tbb.beatInBar },
      );
    },
    [qpb, BARS],
  );

  const readMasterPulseGridBeat = useCallback(
    () => masterPulseGridBeatRef.current,
    [],
  );

  useLayoutEffect(() => {
    if (!isStudioScreenActive || playheadMotionActive) return;
    const el = studioPlayheadLineRef.current;
    if (!el) return;
    studioPlayheadApplyLeft(
      el,
      studioTimelineMapRef.current,
      studioLineBeatForPixel,
      false,
    );
  }, [isStudioScreenActive, playheadMotionActive, studioLineBeatForPixel, timelineMap]);

  /**
   * Cyan playhead + ruler pulse: display `requestAnimationFrame` loop while Studio is open (transport).
   * The loop is **kicked** from `subscribeStudioPlayheadFrame` (same `audioNow` as `emitTransportAudioFrame`)
   * and from `subscribeTransportBeatUi` + a `transport` edge effect. That covers **master record count-in**,
   * where `isRunningRef` is still false so the main transport rAF does not emit pulses — the line would
   * otherwise never start or would drift vs the count-in metronome.
   * `pulse(null)` on transport stop cancels the pending rAF so the line does not run one stale frame.
   */
  useEffect(() => {
    if (!isStudioScreenActive) {
      setRulerMusicalPlayhead(null);
      return;
    }

    resetRulerQuarterGate(rulerQuarterGateRef.current);

    const paintLine = (audioNow: number) => {
      const el = studioPlayheadLineRef.current;
      const map = studioTimelineMapRef.current;
      if (!el || !map) return;
      if (
        isStudioPrecountingRef.current &&
        studioPrecountTimelineRef.current != null
      ) {
        const b = getStudioTransportBeatFloatForPlayheadRef.current();
        if (Number.isFinite(b)) studioPlayheadApplyLeft(el, map, b, true);
        return;
      }
      const beat = studioGridBeatFloatFromSnapshot(
        getStudioSnapAtForPlayheadRef.current(audioNow),
      );
      if (Number.isFinite(beat)) {
        studioPlayheadApplyLeft(el, map, beat, false);
      }
    };

    const syncRulerToBeatMono = (beatMono: number) => {
      masterPulseGridBeatRef.current = beatMono;
      if (shouldPublishRulerQuarter(rulerQuarterGateRef.current, beatMono)) {
        applyRulerFromGridBeat(beatMono);
      }
    };

    let raf = 0;
    const precountStep = () => {
      if (
        !isStudioPrecountingRef.current ||
        studioPrecountTimelineRef.current == null
      ) {
        return;
      }
      paintLine(0);
      const b = getStudioTransportBeatFloatForPlayheadRef.current();
      if (Number.isFinite(b)) syncRulerToBeatMono(b);
      raf = requestAnimationFrame(precountStep);
    };

    if (isStudioPrecounting) {
      raf = requestAnimationFrame(precountStep);
      return () => {
        cancelAnimationFrame(raf);
        resetRulerQuarterGate(rulerQuarterGateRef.current);
        setRulerMusicalPlayhead(null);
      };
    }

    const motionNow = () => {
      const tr = transportForPlayheadRef.current;
      return (
        tr === 'playing' ||
        tr === 'recording' ||
        tr === 'counting' ||
        isStudioPrecountingRef.current ||
        getIsAudioTransportRunningRef.current()
      );
    };

    let pumpRunning = false;
    const pump = () => {
      try {
        if (!isStudioScreenActive) {
          pumpRunning = false;
          return;
        }
        if (isStudioPrecountingRef.current) {
          pumpRunning = false;
          return;
        }
        if (!motionNow()) {
          if (pumpRunning) {
            resetRulerQuarterGate(rulerQuarterGateRef.current);
            setRulerMusicalPlayhead(null);
          }
          pumpRunning = false;
          return;
        }
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state !== 'closed') {
          const t = studioAudioNowForPaint(ctx) ?? ctx.currentTime;
          paintLine(t);
          const snap = getStudioSnapAtForPlayheadRef.current(t);
          const beat = studioGridBeatFloatFromSnapshot(snap);
          const map = studioTimelineMapRef.current;
          const hl = studioRulerHighlightColumnRef.current;
          if (hl && map && Number.isFinite(beat)) {
            studioRulerPlayheadApplyHighlight(hl, map, beat, false);
          }
          syncRulerToBeatMono(beat);
        }
        pumpRunning = true;
        raf = requestAnimationFrame(pump);
      } catch {
        pumpRunning = false;
      }
    };

    const kickPump = () => {
      if (!isStudioScreenActive || isStudioPrecountingRef.current) return;
      if (!motionNow() || pumpRunning) return;
      pumpRunning = true;
      raf = requestAnimationFrame(pump);
    };

    const onMasterAudioPulse = (t: number | null) => {
      if (t == null) {
        cancelAnimationFrame(raf);
        pumpRunning = false;
        resetRulerQuarterGate(rulerQuarterGateRef.current);
        setRulerMusicalPlayhead(null);
        return;
      }
      kickPump();
    };

    const unsubPulse = subscribeStudioPlayheadFrame(onMasterAudioPulse);
    const unsubBeatUi = subscribeTransportBeatUi(kickPump);
    pumpKickRef.current = kickPump;
    kickPump();

    return () => {
      unsubPulse();
      unsubBeatUi();
      cancelAnimationFrame(raf);
      pumpRunning = false;
      pumpKickRef.current = () => {};
      resetRulerQuarterGate(rulerQuarterGateRef.current);
      setRulerMusicalPlayhead(null);
    };
  }, [
    isStudioScreenActive,
    isStudioPrecounting,
    applyRulerFromGridBeat,
    subscribeTransportBeatUi,
  ]);

  useEffect(() => {
    if (!isStudioScreenActive || isStudioPrecounting) return;
    if (
      transport !== 'playing' &&
      transport !== 'recording' &&
      transport !== 'counting'
    ) {
      return;
    }
    pumpKickRef.current();
  }, [transport, isStudioScreenActive, isStudioPrecounting]);

  /**
   * 1-based bar position for paste/UI: snapped to quarter grid while playing/recording/precount;
   * fractional when paused/stopped for scrub accuracy.
   */
  const playheadPos =
    isTransportRunning || isStudioPrecounting
      ? studioPlayheadQuarterIdx0 / qpb + 1
      : transportBeatFloatForClips / qpb + 1;
  const playheadBeat0Grid = effectiveRulerQuarterIdx0;
  /** Fractional grid — match ruler columns (`studioRulerBarBeatFromAbsoluteQuarter` / timeline map). */
  const playheadBarBeatIdle = useMemo(() => {
    const tbb = studioRulerBarBeatFromAbsoluteQuarter(
      Math.max(0, transportBeatFloatForClips),
      qpb,
      BARS,
    );
    return { bar: tbb.bar, beat: tbb.beatInBar };
  }, [transportBeatFloatForClips, qpb, BARS]);
  const playheadBarForRulerIdle = playheadBarBeatIdle.bar;
  const playheadBeatInBar1Idle = playheadBarBeatIdle.beat;

  const playheadBarForRuler =
    rulerMusicalPlayhead?.bar ?? playheadBarForRulerIdle;
  const playheadBeatInBar1 =
    rulerMusicalPlayhead?.beat ?? playheadBeatInBar1Idle;
  const [syncCaptureRunning, setSyncCaptureRunning] = useState(false);
  const captureSyncReport = useCallback(() => {
    if (syncCaptureRunning) return;
    setSyncCaptureRunning(true);
    const rows: string[] = [];
    const startedAt = performance.now();
    rows.push('Studio Sync Capture (10s)');
    rows.push(`started_iso=${new Date().toISOString()}`);
    rows.push('ms,bar,beatInBar,beatFloat,deltaPx,metroAheadBeats,nextQuarterDeltaTicks,phaseErrorBeats,tickInt,metroNextQuarterTick,metroNextBeatTimeSec');
    const id = window.setInterval(() => {
      const snap = getUnifiedStudioSyncSnapshot();
      const beat = studioCanonicalBeatFromSnapshot(snap);
      const nearestBeat = Math.round(beat);
      const gridDeltaPx = (beat - nearestBeat) * timelineMap.pixelsPerBeat;
      const metroAheadBeats =
        (snap.metronomeNextQuarterTick - snap.tickFloat) / PPQ;
      const expectedNextQuarter =
        Math.ceil(Math.max(0, beat) - 1e-9) * PPQ;
      const phaseErrorBeats =
        (snap.metronomeNextQuarterTick - expectedNextQuarter) / PPQ;
      const tbb = studioTransportToBarBeatFromSnap(snap, qpb, BARS);
      const nowMs = Math.round(performance.now() - startedAt);
      rows.push(
        [
          nowMs,
          tbb.bar,
          tbb.beatInBar,
          beat.toFixed(6),
          gridDeltaPx.toFixed(3),
          metroAheadBeats.toFixed(3),
          (snap.nextQuarterTick - snap.tickFloat).toFixed(3),
          phaseErrorBeats.toFixed(3),
          snap.tickInt,
          snap.metronomeNextQuarterTick,
          snap.metronomeNextBeatTimeSec.toFixed(6),
        ].join(','),
      );
      if (nowMs >= 10000) {
        clearInterval(id);
        setSyncCaptureRunning(false);
        const text = rows.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studio-sync-capture-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    }, 100);
  }, [
    getUnifiedStudioSyncSnapshot,
    syncCaptureRunning,
    timelineMap.pixelsPerBeat,
    qpb,
    BARS,
  ]);

  /** Bar index (1-based) for sorting / mkClip; precise alignment uses {@link recordStartTickRef}. */
  const recordStartBarRef = useRef(1);
  /** Snapped MasterClock tick when capture began ΓÇö written to the final clip as `startTick`. */
  const recordStartTickRef = useRef(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  /** Hear live mic in speakers/headphones while transport is recording (disconnect before releasing stream). */
  const inputMonitorTeardownRef = useRef<(() => void) | null>(null);

  /** Mic check (selected Audio/Vocal track): live input meter without recording transport. */
  const [micTestTrackId, setMicTestTrackId] = useState<number | null>(null);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [micTestPeak, setMicTestPeak] = useState(0);
  const micTestRafRef = useRef<number | null>(null);
  const micTestStreamRef = useRef<MediaStream | null>(null);
  const micTestNodesRef = useRef<{
    src: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    monitorGain: GainNode;
  } | null>(null);
  const micTestPeakHoldRef = useRef(0);

  function teardownInputMonitor() {
    const d = inputMonitorTeardownRef.current;
    if (d) {
      try {
        d();
      } catch {
        /* ignore */
      }
      inputMonitorTeardownRef.current = null;
    }
  }

  const timelineRef = useRef<HTMLDivElement>(null);

  const isRunning   = transport === 'playing' || transport === 'recording';

  const tracksPlaybackRef = useRef(tracks);
  tracksPlaybackRef.current = tracks;
  const trackPansPlaybackRef = useRef(trackPans);
  trackPansPlaybackRef.current = trackPans;
  const ticksToSecondsPlaybackRef = useRef(ticksToSeconds);
  ticksToSecondsPlaybackRef.current = ticksToSeconds;
  const studioClipSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const studioClipRafRef = useRef<number>(0);
  /** Bumps when cloud load wins so async localStorage restore canΓÇÖt overwrite it. */
  const studioLoadGenRef = useRef(0);
  const sessionSyncGenRef = useRef(0);

  const tracksRef = useRef(tracks);
  const trackPansRef = useRef(trackPans);
  tracksRef.current = tracks;
  trackPansRef.current = trackPans;

  /** Studio-only: block global record() until an Audio/Vocal row is record-armed. */
  useEffect(() => {
    const w = window as unknown as {
      __daMusicStudioRecordPreFlight?: () => boolean;
    };
    w.__daMusicStudioRecordPreFlight = () => {
      const id = recordArmedTrackRef.current;
      if (id == null) return false;
      const tr = tracksRef.current.find((x) => x.id === id);
      return tr != null && (tr.type === 'Audio' || tr.type === 'Vocal');
    };
    return () => {
      delete w.__daMusicStudioRecordPreFlight;
    };
  }, []);

  /** Drop arm if the row is missing or cannot capture microphone audio. */
  useEffect(() => {
    if (recordArmedTrackId == null) return;
    const tr = tracks.find((t) => t.id === recordArmedTrackId);
    if (!tr || (tr.type !== 'Audio' && tr.type !== 'Vocal')) {
      setRecordArmedTrackId(null);
      recordArmedTrackRef.current = null;
      recordArmedSessionSlotRef.current = null;
    }
  }, [tracks, recordArmedTrackId]);

  /** Sync armed row ΓåÆ record target using latest tracks (same tick as transport=recording). */
  function syncRecordTargetFromArmedRefs(): boolean {
    const armedId = recordArmedTrackRef.current;
    const list = tracksRef.current;
    const row =
      armedId != null ? list.find((x) => x.id === armedId) : undefined;
    if (!row) {
      recordTargetTrackRef.current = null;
      return false;
    }
    recordTargetTrackRef.current = {
      id: row.id,
      name: row.name,
      audioTrack: row.audioTrack,
    };
    return true;
  }

  /**
   * Begin MediaRecorder in the same synchronous turn as MasterClock `startTimer` (via window hook),
   * so capture aligns with the precount downbeat instead of waiting for `useEffect` (1+ frames late).
   */
  const tryBeginStudioMediaCapture = useCallback(() => {
    const w = window as unknown as {
      __daMusicStudioMicStream?: MediaStream | null;
      __daMusicStudioRecordStartTick?: number;
    };
    if (!syncRecordTargetFromArmedRefs() || !recordTargetTrackRef.current) {
      console.error(
        '[Studio] No record-armed target track ΓÇö cannot capture. Stop transport.',
      );
      stop();
      return;
    }
    const stream = w.__daMusicStudioMicStream;
    if (!stream) {
      console.error(
        '[Studio] No microphone stream after arm ΓÇö cannot capture. Aborting recording transport.',
      );
      stop();
      return;
    }
    for (const t of stream.getAudioTracks()) {
      t.enabled = true;
    }
    // Effect may re-run while already capturing ΓÇö donΓÇÖt add a second MediaRecorder or flicker monitor.
    if (mediaRecorderRef.current?.state === 'recording') return;

    teardownInputMonitor();
    try {
      const ctxMon = getOrCreateAudioContext();
      if (ctxMon.state === 'suspended') void ctxMon.resume();
      const src = ctxMon.createMediaStreamSource(stream);
      const g = ctxMon.createGain();
      g.gain.value = 0.78;
      src.connect(g);
      g.connect(ctxMon.destination);
      inputMonitorTeardownRef.current = () => {
        try {
          src.disconnect();
        } catch {
          /* ignore */
        }
        try {
          g.disconnect();
        } catch {
          /* ignore */
        }
      };
    } catch (e) {
      console.warn('[Studio] Input monitor failed ΓÇö recording still runs; use headphones if you add monitoring hardware.', e);
    }

    recordChunksRef.current = [];
    const ctxRec = audioCtxRef.current ?? getOrCreateAudioContext();
    const startTickRaw =
      typeof w.__daMusicStudioRecordStartTick === 'number' &&
      Number.isFinite(w.__daMusicStudioRecordStartTick)
        ? w.__daMusicStudioRecordStartTick
        : getTickIntAtAudioNow(ctxRec.currentTime);
    delete w.__daMusicStudioRecordStartTick;
    const startTick = snapTick(startTickRaw);
    recordStartTickRef.current = startTick;
    recordStartBarRef.current = Math.max(1, Math.floor(startTick / ticksPerBar) + 1);
    const recTarget = recordTargetTrackRef.current;
    if (recTarget) {
      setLiveRecordLane({
        trackId: recTarget.id,
        startBeat0: Math.max(0, startTick / PPQ),
      });
    }

    const mimeType = pickMediaRecorderMimeType();
    let mr: MediaRecorder;
    try {
      mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (e) {
      try {
        mr = new MediaRecorder(stream);
      } catch (e2) {
        console.error('[Studio] MediaRecorder construction failed', e, e2);
        teardownInputMonitor();
        stop();
        return;
      }
    }

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) recordChunksRef.current.push(e.data);
    };

    /** Frozen at record start ΓÇö avoids races if arm/target refs change before `onstop` runs. */
    const targetSnap = recordTargetTrackRef.current
      ? {
          id: recordTargetTrackRef.current.id,
          name: recordTargetTrackRef.current.name,
          audioTrack: recordTargetTrackRef.current.audioTrack,
        }
      : null;

    mr.onstop = () => {
      mediaRecorderRef.current = null;
      teardownInputMonitor();
      const chunks = [...recordChunksRef.current];
      recordChunksRef.current = [];
      const wStop = window as unknown as { __daMusicStudioMicStream?: MediaStream | null };
      const releaseMic = () => {
        const s = wStop.__daMusicStudioMicStream;
        if (s) s.getTracks().forEach((t) => t.stop());
        wStop.__daMusicStudioMicStream = null;
      };
      void (async () => {
        try {
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
          if (blob.size === 0) {
            console.error(
              '[Studio] Recording produced no audio data. Stop may have been too fast, or MediaRecorder failed.',
            );
            setRecordPathHint(
              'Recording had no audio bytes. Record at least ~1 second, then press Stop. If this persists, try Chrome/Edge or check that the mic isnΓÇÖt muted in the system.',
            );
            return;
          }
          const raw = await blob.arrayBuffer();
          const decodeCtx = getOrCreateAudioContext();
          if (decodeCtx.state === 'suspended') await decodeCtx.resume();
          let buffer: AudioBuffer;
          try {
            buffer = await decodeCtx.decodeAudioData(raw.slice(0));
          } catch (decErr) {
            console.error('[Studio] decodeAudioData failed', decErr);
            setRecordPathHint(
              'Could not decode the recording in this browser (codec not supported for import). Try Chrome or Edge, or record a bit longer and stop again.',
            );
            return;
          }
          const tempo = bpmRef.current;
          const lenBars = clipBarLengthFromAudioDuration(
            buffer.duration,
            tempo,
            Math.max(1, quartersPerBar),
          );
          const bar = Math.max(1, recordStartBarRef.current);
          const target = targetSnap;
          const clipLabel = target ? `${target.name} take` : 'Track recording';
          setRecordPathHint(null);
          setTracks((prev) => {
            const newClip = mkClip(bar, lenBars, clipLabel, buffer);
            newClip.startTick = recordStartTickRef.current;
            if (target) {
              const idx =
                target.audioTrack != null && Number.isFinite(target.audioTrack)
                  ? prev.findIndex((t) => t.audioTrack === target.audioTrack)
                  : prev.findIndex((t) => t.id === target.id);
              if (idx >= 0) {
                const t = prev[idx];
                const next = [...prev];
                next[idx] = { ...t, clips: [...t.clips, newClip] };
                return next;
              }
            }
            const nextId = Math.max(0, ...prev.map((t) => t.id)) + 1;
            const audioTrack = trackManagerRef.current.allocateNewTracks(1)[0];
            return [
              ...prev,
              {
                id: nextId,
                name: 'Track recording',
                type: 'Audio' as TrackType,
                color: TYPE_COLORS.Audio,
                muted: false,
                solo: false,
                locked: false,
                volume: 75,
                clips: [newClip],
                audioTrack,
              },
            ];
          });
        } catch (e) {
          console.error(
            '[Studio] Failed to finalize recorded take.',
            e,
          );
          setRecordPathHint(
            'Recording finished but saving the take failed. Check the browser console for details and try again.',
          );
        } finally {
          releaseMic();
        }
      })();
    };
    try {
      mediaRecorderRef.current = mr;
      /* Single payload on stop is more reliable than fixed timeslices for short takes. */
      mr.start();
    } catch (e) {
      console.error('[Studio] MediaRecorder.start failed ΓÇö recording aborted.', e);
      mediaRecorderRef.current = null;
      teardownInputMonitor();
      stop();
    }
  }, [
    stop,
    getOrCreateAudioContext,
    audioCtxRef,
    getTickIntAtAudioNow,
    snapTick,
    ticksPerBar,
    quartersPerBar,
    setLiveRecordLane,
    setTracks,
    setRecordPathHint,
  ]);

  useEffect(() => {
    const w = window as unknown as {
      __daMusicStudioTryStartMediaCapture?: () => void;
    };
    w.__daMusicStudioTryStartMediaCapture = () => {
      tryBeginStudioMediaCapture();
    };
    return () => {
      delete w.__daMusicStudioTryStartMediaCapture;
    };
  }, [tryBeginStudioMediaCapture]);

  useLayoutEffect(() => {
    if (transport !== 'recording') return;
    tryBeginStudioMediaCapture();
  }, [transport, tryBeginStudioMediaCapture]);

  useEffect(() => {
    registerStudioProjectCloudExporter(async () =>
      serializeStudioProject(tracksRef.current, trackPansRef.current, bpmRef.current ?? 120),
    );
    return () => registerStudioProjectCloudExporter(null);
  }, []);

  // Record arm + mic stream: registered globally in app.tsx for Studio / Creation Station / Master Arranger.

  useEffect(() => {
    if (transport === 'recording') return;
    setLiveRecordLane(null);
    teardownInputMonitor();
    const mrStop = mediaRecorderRef.current;
    if (mrStop && mrStop.state === 'recording') {
      try {
        mrStop.requestData();
      } catch {
        /* ignore */
      }
      try {
        mrStop.stop();
      } catch {
        /* ignore */
      }
    }
  }, [transport]);

  const applyFullSessionSync = useCallback(() => {
    if (!studioHydrated) return;
    const gen = ++sessionSyncGenRef.current;
    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const prev = tracksRef.current;
    const merged = rebuildStudioTracksFromSessionManifest([...prev], readCombinedSessionTrackManifest());
    const stripped = stripModuleSessionClips(merged);
    void applySessionModuleClips(
      stripped as StudioTrackLike[],
      ctx,
      bpmRef.current ?? 120,
      () => globalClipId++,
    ).then((next) => {
      setTracks((latest) => {
        if (sessionSyncGenRef.current !== gen) return latest;
        const merged = mergeSessionSyncWithLocalRecordings(next as Track[], latest);
        let maxC = 0;
        for (const t of merged) for (const c of t.clips) maxC = Math.max(maxC, c.id);
        globalClipId = Math.max(globalClipId, maxC + 1);
        return merged;
      });
    });
  }, [studioHydrated, getOrCreateAudioContext]);

  // Load saved studio timeline from localStorage (WAV audio per clip when present).
  useEffect(() => {
    const myGen = studioLoadGenRef.current;
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(STUDIO_PROJECT_STORAGE_KEY);
        if (!raw) {
          if (!cancelled && studioLoadGenRef.current === myGen) setStudioHydrated(true);
          return;
        }
        const ctx = getOrCreateAudioContext();
        const { tracks: restored, trackPans: pans, nextClipId } = await deserializeStudioProject(
          raw,
          ctx,
        );
        if (cancelled || studioLoadGenRef.current !== myGen) return;
        // Keep global master tempo fixed to startup default (120 BPM); ignore saved session tempo.
        bpmRef.current = 120;
        const merged = rebuildStudioTracksFromSessionManifest(
          restored as Track[],
          readCombinedSessionTrackManifest(),
        );
        let next = stripModuleSessionClips(merged);
        if (ctx.state === 'suspended') await ctx.resume();
        next = (await applySessionModuleClips(
          next as StudioTrackLike[],
          ctx,
          120,
          () => globalClipId++,
        )) as Track[];
        setTracks(next);
        setTrackPans(pans);
        let maxC = 0;
        for (const t of next) for (const c of t.clips) maxC = Math.max(maxC, c.id);
        globalClipId = Math.max(nextClipId, maxC + 1);
      } catch (e) {
        console.warn('Studio: could not restore saved project', e);
      }
      if (!cancelled && studioLoadGenRef.current === myGen) setStudioHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [getOrCreateAudioContext, setBpm]);

  // Apply Studio snapshot from Supabase (My Projects ΓåÆ Open in Studio).
  useEffect(() => {
    if (!pendingCloudStudioJson) return;
    studioLoadGenRef.current += 1;
    const myGen = studioLoadGenRef.current;
    let cancelled = false;
    (async () => {
      try {
        const ctx = getOrCreateAudioContext();
        const { tracks: restored, trackPans: pans, nextClipId } = await deserializeStudioProject(
          pendingCloudStudioJson,
          ctx,
        );
        if (cancelled || studioLoadGenRef.current !== myGen) return;
        // Keep global master tempo fixed to startup default (120 BPM); ignore cloud session tempo.
        bpmRef.current = 120;
        const merged = rebuildStudioTracksFromSessionManifest(
          restored as Track[],
          readCombinedSessionTrackManifest(),
        );
        let next = stripModuleSessionClips(merged);
        if (ctx.state === 'suspended') await ctx.resume();
        next = (await applySessionModuleClips(
          next as StudioTrackLike[],
          ctx,
          120,
          () => globalClipId++,
        )) as Track[];
        setTracks(next);
        setTrackPans(pans);
        let maxC = 0;
        for (const t of next) for (const c of t.clips) maxC = Math.max(maxC, c.id);
        globalClipId = Math.max(nextClipId, maxC + 1);
        try {
          localStorage.setItem(STUDIO_PROJECT_STORAGE_KEY, pendingCloudStudioJson);
        } catch (err) {
          console.warn('Studio: could not mirror cloud project to localStorage', err);
        }
      } catch (e) {
        console.warn('Studio: could not restore cloud project', e);
      }
      if (!cancelled && studioLoadGenRef.current === myGen) {
        setStudioHydrated(true);
        onPendingCloudStudioConsumed?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingCloudStudioJson, getOrCreateAudioContext, onPendingCloudStudioConsumed, setBpm]);

  // Shared session: merge track rows + module clips ([AI]/[Arr]) after hydrate and on sync events.
  useEffect(() => {
    if (!studioHydrated) return;
    applyFullSessionSync();
  }, [studioHydrated, applyFullSessionSync]);

  useEffect(() => {
    function onSessionChannelsSync() {
      applyFullSessionSync();
    }
    window.addEventListener(DA_SESSION_TRACKS_SYNC_EVENT, onSessionChannelsSync);
    return () => window.removeEventListener(DA_SESSION_TRACKS_SYNC_EVENT, onSessionChannelsSync);
  }, [applyFullSessionSync]);

  // Debounced persist (tracks, pans, clip audio as WAV base64, session BPM).
  useEffect(() => {
    if (!studioHydrated) return;
    const t = setTimeout(() => {
      const tempo = Math.round(bpm ?? 120);
      void serializeStudioProject(tracks, trackPans, tempo).then((json) => {
        try {
          localStorage.setItem(STUDIO_PROJECT_STORAGE_KEY, json);
        } catch (err) {
          console.warn('Studio: save failed (quota or private mode)', err);
        }
      });
    }, 600);
    return () => clearTimeout(t);
  }, [tracks, trackPans, studioHydrated, bpm]);

  /**
   * Timeline audio clips: schedule when playhead is inside the clip window.
   * Skips module-sync clips ([AI]/[Arr]/[CS]) ΓÇö decoded buffers are for sync/show; playing them stacks noise.
   */
  useEffect(() => {
    const stopAllStudioClipSources = () => {
      studioClipSourcesRef.current.forEach((src) => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      });
      studioClipSourcesRef.current.clear();
    };

    // Same as transport running: hear existing clips during punch-in / overdub, not only in "playing".
    if (transport !== 'playing' && transport !== 'recording') {
      stopAllStudioClipSources();
      return;
    }

    const tick = () => {
      const schedulerCadenceMs = performancePlaybackActive ? 90 : 40;
      const ctx = audioCtxRef.current;
      /**
       * Same master frame as MET + cyan playhead: `tickFloat` at `AudioContext.currentTime`
       * (musio-style single phase sample — not a separate ref beat path that can lag setTimeout).
       */
      const pt =
        ctx && ctx.state !== 'closed'
          ? studioTransportClock.tickFloatNow()
          : Math.max(0, tickCounterRef.current);
      const tracksNow = tracksPlaybackRef.current;
      const pans = trackPansPlaybackRef.current;
      const toSec = ticksToSecondsPlaybackRef.current;

      if (ctx && ctx.state === 'suspended') void ctx.resume();

      const solo = tracksNow.some((tr) => tr.solo);
      const trackById = new Map<number, Track>();
      const clipBySourceKey = new Map<
        string,
        {
          track: Track;
          clip: Clip;
          clipStartTick: number;
          clipEndTick: number;
          songSecAtClipStart: number;
          songSecAtClipEnd: number;
        }
      >();
      for (const track of tracksNow) {
        trackById.set(track.id, track);
        for (const clip of track.clips) {
          if (!clip.audioBuffer) continue;
          if (isModuleSessionClipLabel(clip.label)) continue;
          const clipStartTick = clipTimelineStartTick(clip, ticksPerBar);
          const clipEndTick = clipStartTick + clip.len * ticksPerBar;
          const songSecAtClipStart = toSec(clipStartTick);
          const songSecAtClipEnd = toSec(clipEndTick);
          clipBySourceKey.set(`${track.id}-${clip.id}`, {
            track,
            clip,
            clipStartTick,
            clipEndTick,
            songSecAtClipStart,
            songSecAtClipEnd,
          });
        }
      }

      studioClipSourcesRef.current.forEach((src, key) => {
        const meta = clipBySourceKey.get(key);
        let shouldPlay = false;
        if (
          meta &&
          !meta.track.muted &&
          (!solo || meta.track.solo)
        ) {
          shouldPlay = pt >= meta.clipStartTick && pt < meta.clipEndTick;
        }
        if (!shouldPlay) {
          try {
            src.stop();
          } catch {
            /* */
          }
          studioClipSourcesRef.current.delete(key);
        }
      });

      if (ctx) {
        for (const [key, meta] of clipBySourceKey) {
          const t = trackById.get(meta.track.id);
          if (!t || t.muted) continue;
          if (solo && !t.solo) continue;
          const inside = pt >= meta.clipStartTick && pt < meta.clipEndTick;
          if (!inside) continue;
          if (studioClipSourcesRef.current.has(key)) continue;

          const buf = meta.clip.audioBuffer;
          if (!buf) continue;
          const songSecAtPt = toSec(pt);
          let offset = songSecAtPt - meta.songSecAtClipStart;
          offset = Math.max(0, Math.min(offset, Math.max(0, buf.duration - 1e-4)));

          const remainingInClipWindow = Math.max(0, meta.songSecAtClipEnd - songSecAtPt);
          const remainingInBuffer = Math.max(0, buf.duration - offset);
          const playDur = Math.min(remainingInClipWindow, remainingInBuffer);

          if (playDur <= 0.005) continue;

          const src = ctx.createBufferSource();
          src.buffer = buf;
          const gain = ctx.createGain();
          gain.gain.value = (t.volume / 100) * 0.75;
          const panner = ctx.createStereoPanner();
          panner.pan.value = Math.max(-1, Math.min(1, (pans[t.id] ?? 0) / 100));
          src.connect(panner);
          panner.connect(gain);
          const master =
            (typeof window !== 'undefined' &&
              (window as Window & { __daMusicMasterGain?: GainNode }).__daMusicMasterGain) ||
            null;
          if (master && master.context === ctx) gain.connect(master);
          else gain.connect(ctx.destination);

          try {
            src.start(ctx.currentTime, offset, playDur);
          } catch {
            continue;
          }
          src.onended = () => {
            studioClipSourcesRef.current.delete(key);
          };
          studioClipSourcesRef.current.set(key, src);
        }
      }

      studioClipRafRef.current = window.setTimeout(tick, schedulerCadenceMs);
    };

    studioClipRafRef.current = window.setTimeout(tick, 0);
    return () => {
      window.clearTimeout(studioClipRafRef.current);
      stopAllStudioClipSources();
    };
  }, [
    transport,
    ticksPerBar,
    ticksToSeconds,
    audioCtxRef,
    studioTransportClock,
    performancePlaybackActive,
  ]);

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setGlobalZoom(Math.max(0.2, Math.min(4, parseFloat((zoomRef.current + delta).toFixed(2)))));
  }, [setGlobalZoom]);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  /** Master bus meter: read postΓÇômaster-gain analyser (same signal sent to speakers). */
  useEffect(() => {
    if (!mixerOpen) return;
    if (performancePlaybackActive && isTransportRunning) return;
    let raf = 0;
    const tick = () => {
      const nowMs = performance.now();
      const analyser = masterMeterAnalyserRef.current;
      const ctx = audioCtxRef.current;
      if (analyser && ctx && ctx.state === 'running') {
        const n = analyser.fftSize;
        if (!masterMeterBufRef.current || masterMeterBufRef.current.length !== n) {
          masterMeterBufRef.current = new Float32Array(n);
        }
        const buf = masterMeterBufRef.current;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        let pk = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]);
          sum += v * v;
          if (v > pk) pk = v;
        }
        const rms = Math.sqrt(sum / buf.length);
        masterPeakHoldRef.current = Math.max(pk, masterPeakHoldRef.current * 0.993);
        const meterPushMs = performancePlaybackActive ? 140 : 66;
        if (nowMs - masterMeterLastUiPushMsRef.current >= meterPushMs) {
          masterMeterLastUiPushMsRef.current = nowMs;
          setMasterMeterDisplay({ rms, peak: masterPeakHoldRef.current });
        }
      } else {
        masterPeakHoldRef.current *= 0.94;
        if (nowMs - masterMeterLastUiPushMsRef.current >= 90) {
          masterMeterLastUiPushMsRef.current = nowMs;
          setMasterMeterDisplay({ rms: 0, peak: masterPeakHoldRef.current });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    mixerOpen,
    masterMeterAnalyserRef,
    audioCtxRef,
    performancePlaybackActive,
    isTransportRunning,
  ]);

  const soloActive = tracks.some(t => t.solo);
  const soloTracks = tracks.filter(t => t.solo);
  const audioTrackDupCounts = countAudioTrackDuplicates(tracks);
  const displayChannelMap = buildDisplayChannelMap(tracks);
  let nextTrackId = tracks.length ? Math.max(...tracks.map((t) => t.id)) + 1 : 1;

  function addTrack(type: TrackType) {
    const id = nextTrackId++;
    const audioTrack = trackManager.allocateNewTracks(1)[0];
    setTracks(prev => [...prev, { id, name: `${type} Track ${id}`, type, color: TYPE_COLORS[type], muted: false, solo: false, locked: false, volume: 75, clips: [], audioTrack }]);
  }

  function handleMusicEnhancerTrack(audioBuffer: AudioBuffer, trackName: string) {
    const id = nextTrackId++;
    const audioTrack = trackManager.allocateNewTracks(1)[0];
    
    const lenBars = clipBarLengthFromAudioDuration(
      audioBuffer.duration,
      bpm ?? 120,
      Math.max(1, quartersPerBar),
    );
    const newClip = mkClip(1, lenBars, trackName, audioBuffer);
    
    setTracks(prev => [...prev, {
      id,
      name: trackName,
      type: 'Audio',
      color: TYPE_COLORS['Audio'],
      muted: false,
      solo: false,
      locked: false,
      volume: 75,
      clips: [newClip],
      audioTrack,
    }]);
    
    setShowMusicEnhancer(false);
  }

  // Import Vocal Lab recorded/uploaded blob into timeline (same clip shape as Music Enhancer).
  useEffect(() => {
    if (!pendingStudioAudioBlob || pendingStudioAudioBlob.size === 0) return;
    const blob = pendingStudioAudioBlob;
    let cancelled = false;
    (async () => {
      try {
        const raw = await blob.arrayBuffer();
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        const buffer = await ctx.decodeAudioData(raw.slice(0));
        if (cancelled) return;
        const lenBars = clipBarLengthFromAudioDuration(
          buffer.duration,
          bpm ?? 120,
          Math.max(1, quartersPerBar),
        );
        setTracks((prev) => {
          const nextId = Math.max(0, ...prev.map((t) => t.id)) + 1;
          const audioTrack = trackManager.allocateNewTracks(1)[0];
          const newClip = mkClip(1, lenBars, 'Vocal Recording', buffer);
          return [
            ...prev,
            {
              id: nextId,
              name: 'Vocal Recording',
              type: 'Audio' as TrackType,
              color: TYPE_COLORS.Audio,
              muted: false,
              solo: false,
              locked: false,
              volume: 75,
              clips: [newClip],
              audioTrack,
            },
          ];
        });
        if (!cancelled) onPendingStudioAudioConsumed?.();
      } catch (e) {
        console.error('Studio: failed to import pending audio blob', e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // trackManager.allocateNewTracks is stable for our module; omit from deps to avoid re-running on object identity churn.
  }, [
    pendingStudioAudioBlob,
    onPendingStudioAudioConsumed,
    bpm,
    quartersPerBar,
    getOrCreateAudioContext,
  ]);
  function toggleMute(id: number) { setTracks(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t)); }
  function toggleSolo(id: number) { setTracks(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t)); }
  function toggleLock(id: number) { setTracks(prev => prev.map(t => t.id === id ? { ...t, locked: !t.locked } : t)); }
  function toggleStereoMode(id: number) {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, stereoMode: getTrackStereoMode(t) === 'stereo' ? 'mono' : 'stereo' } : t));
  }
  function getDefaultEffectParams(type: EffectType): Record<string, number> {
    if (type === 'eq') return { low: 0.5, mid: 0.5, high: 0.5 };
    if (type === 'compressor') return { threshold: 0.6, ratio: 0.45, attack: 0.2, release: 0.4 };
    if (type === 'reverb') return { size: 0.6, decay: 0.5, preDelay: 0.15 };
    if (type === 'delay') return { time: 0.35, feedback: 0.3, tone: 0.5 };
    if (type === 'chorus') return { rate: 0.3, depth: 0.45, width: 0.6 };
    if (type === 'flanger') return { rate: 0.35, depth: 0.4, feedback: 0.25 };
    if (type === 'distortion') return { drive: 0.5, tone: 0.55, output: 0.5 };
    return { cutoff: 0.65, resonance: 0.35, drive: 0.25 };
  }
  function addTrackEffect(trackId: number, type: EffectType) {
    setTrackEffects((prev) => {
      const current = prev[trackId] ?? [];
      const slot: EffectSlot = {
        id: crypto.randomUUID(),
        type,
        enabled: true,
        wet: 1,
        params: getDefaultEffectParams(type),
      };
      return { ...prev, [trackId]: [...current, slot] };
    });
  }
  function removeTrackEffect(trackId: number, effectIndex: number) {
    const removedId = (trackEffects[trackId] ?? [])[effectIndex]?.id;
    setTrackEffects((prev) => {
      const current = prev[trackId] ?? [];
      return { ...prev, [trackId]: current.filter((_, i) => i !== effectIndex) };
    });
    if (removedId) {
      setActiveFxEditor((prev) =>
        prev && prev.trackId === trackId && prev.effectId === removedId ? null : prev,
      );
    }
  }
  function moveTrackEffect(trackId: number, fromIndex: number, toIndex: number) {
    setTrackEffects((prev) => {
      const current = [...(prev[trackId] ?? [])];
      if (fromIndex < 0 || fromIndex >= current.length) return prev;
      const target = Math.max(0, Math.min(toIndex, current.length - 1));
      const [moved] = current.splice(fromIndex, 1);
      current.splice(target, 0, moved);
      return { ...prev, [trackId]: current };
    });
  }

  /** Exclusive record arm ΓÇö transport Record writes the take to this row only (Audio/Vocal). */
  function toggleRecordArm(track: Track) {
    if (track.type !== 'Audio' && track.type !== 'Vocal') {
      setRecordPathHint(
        'Microphone recording uses Audio or Vocal tracks only. Click + Audio or + Vocal in the header, then use REC ARM on that row.',
      );
      window.setTimeout(() => setRecordPathHint(null), 10000);
      return;
    }
    setRecordPathHint(null);
    setRecordArmedTrackId((cur) => {
      const next = cur === track.id ? null : track.id;
      recordArmedTrackRef.current = next;
      if (next != null && track.audioTrack != null && Number.isFinite(track.audioTrack)) {
        recordArmedSessionSlotRef.current = track.audioTrack;
      } else if (next === null) {
        recordArmedSessionSlotRef.current = null;
      }
      return next;
    });
  }

  const stopMicTest = useCallback(() => {
    if (micTestRafRef.current != null) {
      cancelAnimationFrame(micTestRafRef.current);
      micTestRafRef.current = null;
    }
    const nodes = micTestNodesRef.current;
    micTestNodesRef.current = null;
    if (nodes) {
      try {
        nodes.src.disconnect();
      } catch {
        /* ignore */
      }
      try {
        nodes.analyser.disconnect();
      } catch {
        /* ignore */
      }
      try {
        nodes.monitorGain.disconnect();
      } catch {
        /* ignore */
      }
    }
    const s = micTestStreamRef.current;
    micTestStreamRef.current = null;
    if (s) s.getTracks().forEach((tr) => tr.stop());
    micTestPeakHoldRef.current = 0;
    setMicTestTrackId(null);
    setMicTestLevel(0);
    setMicTestPeak(0);
  }, []);

  const toggleMicTest = useCallback(
    async (trackId: number) => {
      if (micTestTrackId === trackId) {
        stopMicTest();
        return;
      }
      stopMicTest();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: studioMicTrackConstraints(settings.audioInput),
        });
        for (const tr of stream.getAudioTracks()) {
          tr.enabled = true;
        }
        micTestStreamRef.current = stream;
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.55;
        src.connect(analyser);
        const monitorGain = ctx.createGain();
        monitorGain.gain.value = 0.78;
        src.connect(monitorGain);
        monitorGain.connect(ctx.destination);
        micTestNodesRef.current = { src, analyser, monitorGain };
        const data = new Float32Array(analyser.fftSize);
        micTestPeakHoldRef.current = 0;
        setMicTestTrackId(trackId);
        const tick = () => {
          if (!micTestNodesRef.current) return;
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
          const rms = Math.sqrt(sum / data.length);
          const lin = Math.min(1, rms * 5.8);
          micTestPeakHoldRef.current = Math.max(micTestPeakHoldRef.current * 0.991, lin);
          setMicTestLevel(lin);
          setMicTestPeak(micTestPeakHoldRef.current);
          micTestRafRef.current = requestAnimationFrame(tick);
        };
        micTestRafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        console.warn('[Studio] Mic check failed (permission or device). Use Settings ΓåÆ Audio Input.', e);
        stopMicTest();
      }
    },
    [getOrCreateAudioContext, micTestTrackId, settings.audioInput, stopMicTest],
  );

  useEffect(() => () => stopMicTest(), [stopMicTest]);

  useEffect(() => {
    if (transport === 'recording' && micTestTrackId != null) stopMicTest();
  }, [transport, micTestTrackId, stopMicTest]);

  const startRecordWithPrecount = useCallback(async () => {
    if (transport === 'recording' || isStudioPrecountingRef.current) return;

    setRecordPathHint(null);
    const id = recordArmedTrackRef.current;
    const tr = tracksRef.current.find((x) => x.id === id);
    if (id == null || !tr || (tr.type !== 'Audio' && tr.type !== 'Vocal')) {
      setRecordPathHint(
        'Add an Audio or Vocal track (+ Audio / + Vocal), tap REC ARM on that row (red border), then tap Record and allow the microphone.',
      );
      return;
    }
    const arm = (
      window as unknown as { __daMusicStudioRecordArm?: () => Promise<void> }
    ).__daMusicStudioRecordArm;
    if (typeof arm !== 'function') {
      setRecordPathHint('Recording is not available on this screen. Open Studio Editor from the main app menu.');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
      setRecordPathHint('This browser does not expose a microphone API (use Chrome, Edge, or Firefox over https or localhost).');
      return;
    }

    if (!studioPrecountEnabled) {
      record({ countIn: false });
      return;
    }

    try {
      await arm();
    } catch {
      setRecordPathHint(
        'Microphone access failed. Allow the mic when prompted, use https:// or localhost, and pick the correct input under Settings (Ctrl+,).',
      );
      return;
    }

    studioPrecountCancelRef.current = false;
    setIsStudioPrecounting(true);
    isStudioPrecountingRef.current = true;

    /* Same BPM as `mapGlobalTickToAudioTime` / MET ΓÇö not React `bpm` alone (can lag `bpmRef` by a frame). */
    const bpmN = getTransportAudioBpm();
    const ctx = getOrCreateAudioContext();
    try {
      if (ctx.state === 'suspended') await ctx.resume();
    } catch {
      /* ignore */
    }

    if (studioPrecountCancelRef.current) {
      studioPrecountTimelineRef.current = null;
      isStudioPrecountingRef.current = false;
      setIsStudioPrecounting(false);
      setStudioPrecountBeat(null);
      return;
    }

    const spb = 60 / bpmN;
    const bars = Math.max(1, Math.min(4, Math.round(studioPrecountBars)));
    const totalBeats = bars * qpb;
    const t0 = ctx.currentTime;
    const playheadTick = snapTick(Math.max(0, Math.round(positionTicksRef.current)));
    studioPrecountTimelineRef.current = { playheadTick, totalBeats };
    setStudioPrecountBeat(1);

    // Intentionally silent precount while main transport/metronome sync is being validated.

    const deadline = t0 + totalBeats * spb;
    /* Wall clock: after Pause, MasterClock may leave AudioContext suspended ΓÇö `currentTime` then
     * never reaches `deadline` and this Promise would hang forever with isStudioPrecounting stuck. */
    const wallGiveUpMs = performance.now() + totalBeats * spb * 1000 + 800;
    studioPrecountUiTimersRef.current = [];
    let lastPrecountBeatUi = 1;
    await new Promise<void>((resolve) => {
      const step = () => {
        if (studioPrecountCancelRef.current) {
          resolve();
          return;
        }
        if (ctx.state === 'suspended') void ctx.resume();
        const now = ctx.currentTime;
        const k = Math.floor((now - t0) / spb + 1e-8);
        const beatIdx = Math.min(totalBeats, Math.max(1, k + 1));
        if (beatIdx > lastPrecountBeatUi) {
          lastPrecountBeatUi = beatIdx;
          setStudioPrecountBeat(beatIdx);
        }
        if (now >= deadline - 0.005 || performance.now() >= wallGiveUpMs) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    for (const tid of studioPrecountUiTimersRef.current) clearTimeout(tid);
    studioPrecountUiTimersRef.current = [];

    const cancelled = studioPrecountCancelRef.current;
    studioPrecountTimelineRef.current = null;
    isStudioPrecountingRef.current = false;
    setIsStudioPrecounting(false);
    setStudioPrecountBeat(null);

    if (cancelled) return;

    record({
      countIn: false,
      metronomeBeat0AudioTime: deadline,
      recordStartTick: playheadTick,
    });
  }, [
    transport,
    record,
    getTransportAudioBpm,
    getOrCreateAudioContext,
    settings.audioInput,
    studioPrecountEnabled,
    studioPrecountBars,
    snapTick,
    tickToBarBeat,
    qpb,
  ]);

  useEffect(() => {
    const onCancel = () => {
      studioPrecountCancelRef.current = true;
      for (const tid of studioPrecountUiTimersRef.current) clearTimeout(tid);
      studioPrecountUiTimersRef.current = [];
      studioPrecountTimelineRef.current = null;
      isStudioPrecountingRef.current = false;
      setIsStudioPrecounting(false);
      setStudioPrecountBeat(null);
    };
    window.addEventListener(DMB_STUDIO_PRECOUNT_CANCEL, onCancel);
    return () => window.removeEventListener(DMB_STUDIO_PRECOUNT_CANCEL, onCancel);
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      __daMusicStudioTryRecord?: () => Promise<void>;
    };
    w.__daMusicStudioTryRecord = startRecordWithPrecount;
    return () => {
      delete w.__daMusicStudioTryRecord;
    };
  }, [startRecordWithPrecount]);

  function deleteTrack(id: number) {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setRecordArmedTrackId((arm) => {
      if (arm === id) {
        recordArmedTrackRef.current = null;
        recordArmedSessionSlotRef.current = null;
        return null;
      }
      return arm;
    });
  }

  /** Full track duplicate: new row, new CH, new clip & effect IDs; shared audio buffers. */
  function duplicateTrack(sourceId: number) {
    let newTrackId: number | null = null;
    setTracks((prev) => {
      const source = prev.find((t) => t.id === sourceId);
      if (!source) return prev;
      const newId = Math.max(0, ...prev.map((t) => t.id)) + 1;
      newTrackId = newId;
      const audioTrack = trackManager.allocateNewTracks(1)[0];
      const duplicatedClips = source.clips.map((c) => {
        const nc = mkClip(c.bar, c.len, c.label, c.audioBuffer);
        if (typeof c.startTick === 'number' && Number.isFinite(c.startTick)) {
          nc.startTick = c.startTick;
        }
        return nc;
      });
      const baseName =
        source.name.replace(/\s*\(copy\)\s*$/i, '').trimEnd() || source.name;
      const copyTrack: Track = {
        ...source,
        id: newId,
        name: `${baseName} (copy)`,
        clips: duplicatedClips,
        audioTrack,
        solo: false,
        locked: false,
      };
      const idx = prev.findIndex((t) => t.id === sourceId);
      const next = [...prev];
      next.splice(Math.max(0, idx) + 1, 0, copyTrack);
      return next;
    });
    if (newTrackId == null) return;
    const dupTrackId = newTrackId;
    const pan = trackPans[sourceId] ?? 0;
    setTrackPans((p) => ({ ...p, [dupTrackId]: pan }));
    const fx = trackEffects[sourceId];
    if (fx && fx.length > 0) {
      setTrackEffects((p) => ({
        ...p,
        [dupTrackId]: fx.map((slot) => ({
          ...slot,
          id: crypto.randomUUID(),
          params: { ...slot.params },
        })),
      }));
    }
  }

  function beginRenameTrack(track: Track) {
    setEditingTrackId(track.id);
    setEditingTrackName(track.name);
  }

  function commitRenameTrack(trackId: number) {
    const nextName = editingTrackName.trim();
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, name: nextName.length > 0 ? nextName : t.name } : t,
      ),
    );
    setEditingTrackId(null);
    setEditingTrackName('');
  }

  function cancelRenameTrack() {
    setEditingTrackId(null);
    setEditingTrackName('');
  }
  
  // Cleanup: release all tracks when unmounting
  useEffect(() => {
    return () => {
      trackManager.releaseAllTracks();
    };
  }, []);
  function setVolume(id: number, v: number) { setTracks(prev => prev.map(t => t.id === id ? { ...t, volume: v } : t)); }
  function setPan(id: number, v: number) { setTrackPans(prev => ({ ...prev, [id]: v })); }

  function onClipMouseDown(trackId: number, clipId: number, origBar: number, e: React.MouseEvent) {
    const track = tracks.find(t => t.id === trackId);
    if (!track || track.locked) return;
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return;
    e.stopPropagation();

    const el = timelineRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      dragStartContentXRef.current = e.clientX - rect.left + el.scrollLeft;
    } else {
      dragStartContentXRef.current = 0;
    }

    // Handle selection (Ctrl/Cmd for multi-select, regular click for single)
    const clipIdStr = String(clipId);
    if (e.ctrlKey || e.metaKey) {
      // Multi-select toggle
      setSelectedClips(prev => 
        prev.includes(clipIdStr) 
          ? prev.filter(id => id !== clipIdStr)
          : [...prev, clipIdStr]
      );
    } else if (e.shiftKey && selectedClips.length > 0) {
      // Range select - would need clip ordering logic
      setSelectedClips([clipIdStr, ...selectedClips]);
    } else {
      // Single select
      setSelectedClips([clipIdStr]);
    }

    dragOrigStartBeat0Ref.current = clipStartBeat0({ ...clip, bar: origBar }, qpb);
    dragClipLenBeatsRef.current = clipLengthBeats(clip, qpb);
    setDraggingClip({ trackId, clipId });
    setShadowStartBeat0(dragOrigStartBeat0Ref.current);
  }

  function onGlobalMouseMove(e: React.MouseEvent) {
    if (draggingClip) {
      const el = timelineRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const contentX = e.clientX - rect.left + el.scrollLeft;
      const deltaBeats = (contentX - dragStartContentXRef.current) / timelineMap.pixelsPerBeat;
      const maxStart = BARS * qpb - dragClipLenBeatsRef.current;
      let startBeat0 = dragOrigStartBeat0Ref.current + deltaBeats;
      startBeat0 = Math.max(0, Math.min(maxStart, startBeat0));
      let newStartTick = Math.round(startBeat0 * PPQ);
      if (!e.altKey && snapType !== 'off') {
        newStartTick = snapClipStartTick0(newStartTick, snapType, qpb, PPQ);
        startBeat0 = newStartTick / PPQ;
        startBeat0 = Math.max(0, Math.min(maxStart, startBeat0));
        newStartTick = Math.round(startBeat0 * PPQ);
      }
      const newBar = startBeat0 / qpb + 1;
      setShadowStartBeat0(startBeat0);
      setTracks(prev => prev.map(t => t.id !== draggingClip.trackId ? t : {
        ...t, clips: t.clips.map(c => c.id !== draggingClip.clipId ? c : { ...c, bar: newBar, startTick: newStartTick }),
      }));
      return;
    }
    if (isBarDragSelecting) {
      selectTimelineGridFromClientX(e.clientX);
    }
  }

  function onGlobalMouseUp() {
    if (draggingClip) {
      setTracks(prev => prev.map(t => t.id !== draggingClip.trackId ? t : {
        ...t, clips: resolveClipCollisions(t.clips),
      }));
      setShadowStartBeat0(null);
    }
    setDraggingClip(null);
    setIsBarDragSelecting(false);
  }

  /** Map click X ΓåÆ bar / beat-in-bar via shared timeline map (same as playhead + clips). */
  function getTimelineGridFromClientX(clientX: number): { bar: number; measureInBar: number } | null {
    const el = timelineRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    const g = timelineMap.gridFromContentX(x);
    return { bar: g.bar, measureInBar: g.beatInBar };
  }

  function selectTimelineGridFromClientX(clientX: number) {
    const g = getTimelineGridFromClientX(clientX);
    if (!g) return;
    setSelectedBar(g.bar, g.measureInBar);
  }

  function onTimelineGridMouseDown(e: React.MouseEvent<HTMLDivElement>, laneTrack?: Track) {
    if (e.button !== 0) return;
    if (draggingClip) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-clip-item="true"]')) return;
    if (laneTrack) setEditorTrack(laneTrack);
    const g = getTimelineGridFromClientX(e.clientX);
    if (!g) return;
    if (selectedBar === g.bar && selectedMeasureInBar === g.measureInBar) {
      setSelectedBar(null);
    } else {
      setSelectedBar(g.bar, g.measureInBar);
    }
    setIsBarDragSelecting(true);
  }

  function onRulerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const g = getTimelineGridFromClientX(e.clientX);
    if (!g) return;
    if (selectedBar === g.bar && selectedMeasureInBar === g.measureInBar) {
      setSelectedBar(null);
    } else {
      setSelectedBar(g.bar, g.measureInBar);
    }
    setIsBarDragSelecting(true);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#050505', color: '#ccc' }}
      onMouseMove={onGlobalMouseMove} onMouseUp={onGlobalMouseUp}>

      {/* Header */}
      <div className="flex flex-col shrink-0" style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
        {recordPathHint && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2"
            style={{
              background: 'linear-gradient(90deg, #422006 0%, #292524 100%)',
              borderBottom: '1px solid #f59e0b55',
            }}
          >
            <span className="text-[11px] font-semibold leading-snug" style={{ color: '#fde68a' }}>
              {recordPathHint}
            </span>
            <button
              type="button"
              className="shrink-0 px-2 py-1 rounded text-[10px] font-bold"
              style={{ background: '#1c1917', color: '#a8a29e', border: '1px solid #57534e' }}
              onClick={() => setRecordPathHint(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-0.5">
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#00E5FF22', color: '#00E5FF' }}><Radio size={16} /></div>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-bold" style={{ color: '#fff' }}>Studio Editor</h2>
            <span className="text-[10px] font-mono font-semibold" style={{ color: '#a3a3a3' }} title="Recording: add Audio or Vocal, then REC ARM (red), then mixer Record.">
              Recording: + Audio or + Vocal ΓåÆ REC ARM (red) ΓåÆ MIC to test ΓåÆ Record in mixer
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" style={{ marginLeft: -6 }}>
            <span className="text-xs font-mono px-3 py-1 rounded font-bold" style={{ background: '#000', border: '1px solid #2a2a2a', color: '#ffcc00' }} title="Session tempo">
              ΓÜí {bpm} BPM
            </span>
            <span
              className="text-xs font-mono px-2 py-1 rounded font-bold"
              style={{ background: '#000', border: '1px solid #2a2a2a', color: '#93c5fd' }}
              title="Time signature"
            >
              {timeSigs[0]?.numerator ?? 4}/{timeSigs[0]?.denominator ?? 4}
            </span>
            {soloActive && (
              <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#ffcc0018', color: '#ffcc00', border: '1px solid #ffcc0044' }}>
                SOLO: {soloTracks.map((t) => `${sessionChDisplayLabel(t, audioTrackDupCounts, displayChannelMap)} ${t.name}`).join(', ')}
              </span>
            )}
            {selectedBar !== null && selectedMeasureInBar !== null && (
              <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#00ff8818', color: '#00ff88', border: '1px solid #00ff8844' }}>
                Γåö BAR {selectedBar} ┬╖ M{selectedMeasureInBar}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setTool('pointer')} className="flex items-center gap-1 px-2 h-5 rounded text-[10px] font-bold"
            style={{ background: tool === 'pointer' ? '#1a1a2a' : '#111', color: tool === 'pointer' ? '#00E5FF' : '#555', border: `1px solid ${tool === 'pointer' ? '#00E5FF44' : '#333'}` }}>
            <MousePointer size={10} /> Select
          </button>
          <button onClick={() => setTool('razor')} className="flex items-center gap-1 px-2 h-5 rounded text-[10px] font-bold"
            style={{ background: tool === 'razor' ? '#ff444422' : '#111', color: tool === 'razor' ? '#ff4444' : '#555', border: `1px solid ${tool === 'razor' ? '#ff444444' : '#333'}` }}>
            <Scissors size={10} /> Razor
          </button>
          <button onClick={() => setAutoScroll(v => !v)} className="px-2 h-5 rounded text-[10px] font-bold"
            style={{ background: autoScroll ? '#00ff8818' : '#111', color: autoScroll ? '#00ff88' : '#555', border: `1px solid ${autoScroll ? '#00ff8844' : '#333'}` }}>
            Γåö Scroll
          </button>
          <div className="w-px h-4" style={{ background: '#2a2a2a' }} />
          {(['MIDI', 'Audio', 'Vocal', 'Drum', 'Bus'] as TrackType[]).map((t) => (
            <button key={t} onClick={() => addTrack(t)} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
              style={{ background: `${TYPE_COLORS[t]}18`, color: TYPE_COLORS[t], border: `1px solid ${TYPE_COLORS[t]}44` }}>
              <Plus size={10} /> {t}
            </button>
          ))}
          <button onClick={() => setShowMusicEnhancer(true)} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ background: '#a855f722', color: '#a855f7', border: '1px solid #a855f744' }}>
            <Mic size={10} /> Sound Conversion
          </button>
          <div className="flex items-center gap-2 ml-3">
            <span className="text-[10px]" style={{ color: '#555' }}>H</span>
            <button onClick={() => setGlobalZoom(Math.max(0.2, +(zoom - 0.1).toFixed(2)))} className="w-5 h-5 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomOut size={10} /></button>
            <span className="text-[10px] font-mono w-8 text-center" style={{ color: '#00E5FF' }}>{zoom.toFixed(1)}x</span>
            <button onClick={() => setGlobalZoom(Math.min(4, +(zoom + 0.1).toFixed(2)))} className="w-5 h-5 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomIn size={10} /></button>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[10px]" style={{ color: '#555' }}>V</span>
            <button onClick={() => setGlobalVZoom(Math.max(1, +(globalVZoom - 0.5).toFixed(1)))} className="w-5 h-5 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomOut size={10} /></button>
            <span className="text-[10px] font-mono w-7 text-center" style={{ color: '#D500F9' }}>{globalVZoom.toFixed(1)}x</span>
            <button onClick={() => setGlobalVZoom(Math.min(8, +(globalVZoom + 0.5).toFixed(1)))} className="w-5 h-5 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomIn size={10} /></button>
          </div>
          <button onClick={() => onExport('master-arranger')} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ml-2" style={{ background: '#1a1a1a', color: '#D500F9', border: '1px solid #D500F944' }}>
            <Send size={10} /> Arrange
          </button>
        </div>
        </div>
      </div>

      {/* DAW Editor Toolbar - Professional Editing Features */}
      <DAWEditorToolbar
        onCut={() => {
          const selectedClipObjects = tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
          const { tracks: newTracks } = clipboardEditor.cut(selectedClipObjects, tracks);
          setTracks(newTracks);
          setSelectedClips([]);
          setSelectedBar(null);
        }}
        onCopy={() => {
          const selectedClipObjects = tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
          clipboardEditor.copy(selectedClipObjects, tracks);
        }}
        onPaste={() => {
          const newTracks = clipboardEditor.paste(tracks, Math.round(playheadPos) || 0);
          setTracks(newTracks);
        }}
        onDuplicate={() => {
          const selectedClipObjects = tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
          const newTracks = clipboardEditor.duplicate(tracks, selectedClipObjects);
          setTracks(newTracks);
        }}
        onDelete={() => {
          const newTracks = clipboardEditor.deleteClips(tracks, selectedClips);
          setTracks(newTracks);
          setSelectedClips([]);
          setSelectedBar(null);
        }}
        onSelectAll={() => {
          const allClips = tracks.flatMap(t => t.clips);
          setSelectedClips(allClips.map(c => String(c.id)));
        }}
        snapType={snapType}
        onSnapChange={setSnapType}
        onZoom={(direction) => {
          if (direction === 'in') setGlobalZoom(Math.min(4, globalZoom + 0.2));
          else setGlobalZoom(Math.max(0.2, globalZoom - 0.2));
        }}
        hasSelection={selectedClips.length > 0}
        hasClipboard={clipboardEditor.clipboard !== null}
        bpm={Math.round(bpm || 120)}
        onBpmChange={(next) => setBpm(Math.max(40, Math.min(300, next)))}
      />

      {/*
        DAW layout: TOP = timeline + track list (same `tracks` array order as mixer).
        BOTTOM = full-width mixer ΓÇö one strip per track + MASTER. audioTrack = session CH.
      */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ΓöÇΓöÇ TOP: multitrack timeline + track controls ΓöÇΓöÇ */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ minHeight: 200 }}>
        <ResizablePanel height={studioHeight} minH={200} maxH={900} defaultH={0} onResize={setStudioHeight}
          style={{ flex: studioHeight > 0 ? `0 0 ${studioHeight}px` : '1', minHeight: studioHeight > 0 ? studioHeight : 200 }}>
          <div className="flex flex-1 min-h-0 overflow-hidden flex-row" style={{ flex: 1 }}>
              {/*
                One vertical scroll for track list + timeline so rows stay locked.
                Timeline column: horizontal scroll only (right/bottom scrollbar behavior preserved).
              */}
              {/*
                items-start + self-start: columns size to content height (no flex shrink).
                If the timeline column used min-h-0 + overflow-y-hidden, the browser created a
                nested vertical scroll inside overflow-x-auto ΓÇö tracks left and waves right drifted.
                Only vertical scroll here is this parent (single scrollbar).
              */}
              <div
                ref={trackListScrollContainerRef}
                className="studio-track-timeline-scroll flex flex-1 min-h-0 min-w-0 flex-row overflow-y-auto overflow-x-hidden items-start"
                style={{ scrollPaddingTop: RULER_H }}
              >
              {/* Track list ΓÇö same `tracks` order as timeline rows & mixer strips; no nested vertical scroll */}
              <div className="shrink-0 self-start overflow-hidden flex flex-col" style={{ width: 248, borderRight: '1px solid #1a1a1a', background: '#080808' }}>
                <div
                  className="sticky top-0 z-20 flex items-center px-2 font-mono text-[9px] font-bold tracking-wide shrink-0"
                  style={{
                    height: RULER_H,
                    minHeight: RULER_H,
                    borderBottom: '1px solid #1a1a1a',
                    color: '#666',
                    letterSpacing: 0.5,
                    background: '#080808',
                  }}
                >
                  TRACKS
                </div>
                {tracks.map(t => {
                  const dimmed = soloActive && !t.solo;
                  const chLab = sessionChDisplayLabel(t, audioTrackDupCounts, displayChannelMap);
                  const isEditorSelected = editorTrack?.id === t.id;
                  const isArmed = recordArmedTrackId === t.id;
                  return (
                    <div
                      key={t.id}
                      data-studio-track-list-row={t.id}
                      className="group hover:opacity-100 transition-opacity flex flex-row items-stretch gap-1 px-1.5 py-1 box-border"
                      style={{
                        height: TRACK_H,
                        minHeight: TRACK_H,
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        borderBottom: '1px solid #1a1a1a',
                        cursor: 'pointer',
                        background: isEditorSelected ? `${t.color}22` : 'transparent',
                        opacity: dimmed ? 0.35 : 1,
                        borderLeft: isArmed
                          ? '4px solid #ff4444'
                          : isEditorSelected
                            ? '4px solid #00E5FF'
                            : `3px solid ${t.color}33`,
                        boxShadow: isArmed
                          ? 'inset 0 0 0 1px rgba(255,68,68,0.45)'
                          : isEditorSelected
                            ? 'inset 0 0 0 1px rgba(0,229,255,0.35)'
                            : undefined,
                      }}
                      onClick={() => setEditorTrack(et => et?.id === t.id ? null : t)}>
                      <div className="flex flex-col justify-center min-w-0 flex-1 gap-0.5 overflow-hidden">
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color, boxShadow: `0 0 4px ${t.color}` }} />
                          <span className="text-[10px] font-mono font-black shrink-0 leading-none" style={{ color: '#00E5FF', letterSpacing: 0.2 }} title="Session channel (shared DAW)">
                            {chLab}
                          </span>
                          {editingTrackId === t.id ? (
                            <input
                              autoFocus
                              value={editingTrackName}
                              onChange={(e) => setEditingTrackName(e.target.value)}
                              onBlur={() => commitRenameTrack(t.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitRenameTrack(t.id);
                                if (e.key === 'Escape') cancelRenameTrack();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] font-semibold min-w-0 flex-1 leading-tight px-1 rounded"
                              style={{ color: '#ccc', background: '#111', border: '1px solid #333' }}
                            />
                          ) : (
                            <span
                              className="text-[10px] font-semibold truncate min-w-0 flex-1 leading-tight"
                              style={{ color: t.muted ? '#555' : '#ccc', textShadow: `0 0 4px ${t.color}22` }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                beginRenameTrack(t);
                              }}
                              title="Double-click to rename track"
                            >
                              {t.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] font-mono truncate pl-2.5 leading-none" style={{ color: '#666' }}>
                          {t.type}
                        </span>
                      </div>
                      <div
                        className="flex flex-col justify-center gap-1.5 shrink-0 w-[108px] min-w-[108px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const canMic = t.type === 'Audio' || t.type === 'Vocal';
                          const armedHere = recordArmedTrackId === t.id;
                          return (
                            <>
                              <button
                                type="button"
                                aria-pressed={armedHere}
                                title={
                                  canMic
                                    ? armedHere
                                      ? 'Disarm ΓÇö Record will not target this track'
                                      : 'REC ARM ΓÇö mixer Record captures microphone to this track (exclusive)'
                                    : 'Use + Audio or + Vocal in the header for microphone recording'
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canMic) toggleRecordArm(t);
                                  else {
                                    setRecordPathHint(
                                      'MIDI / Drum / Bus rows cannot record the mic. Add + Audio or + Vocal, then REC ARM there.',
                                    );
                                    window.setTimeout(() => setRecordPathHint(null), 10000);
                                  }
                                }}
                                className="w-full rounded flex items-center justify-center font-mono font-black leading-none"
                                style={{
                                  minHeight: 32,
                                  padding: '4px 6px',
                                  background: !canMic
                                    ? '#141414'
                                    : armedHere
                                      ? 'linear-gradient(180deg, #ff5555 0%, #cc2222 100%)'
                                      : '#252525',
                                  color: !canMic ? '#555' : armedHere ? '#fff' : '#e5e5e5',
                                  border: `2px solid ${
                                    !canMic ? '#333' : armedHere ? '#ff8888' : '#737373'
                                  }`,
                                  cursor: canMic ? 'pointer' : 'not-allowed',
                                  fontSize: 11,
                                  letterSpacing: 0.4,
                                  boxShadow: armedHere ? '0 0 12px rgba(255,80,80,0.45)' : undefined,
                                }}
                              >
                                REC ARM
                              </button>
                              {canMic ? (
                                <button
                                  type="button"
                                  aria-pressed={micTestTrackId === t.id}
                                  title={
                                    micTestTrackId === t.id
                                      ? 'Stop mic check'
                                      : 'MIC CHECK ΓÇö hear input and see level (Settings ΓåÆ Audio Input if silent)'
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void toggleMicTest(t.id);
                                  }}
                                  className="w-full rounded flex items-center justify-center gap-1 font-mono font-black leading-none"
                                  style={{
                                    minHeight: 30,
                                    padding: '4px 6px',
                                    background: micTestTrackId === t.id ? '#00E5FF28' : '#1a2332',
                                    color: micTestTrackId === t.id ? '#00E5FF' : '#bae6fd',
                                    border: `2px solid ${micTestTrackId === t.id ? '#22d3ee' : '#38bdf8'}`,
                                    cursor: 'pointer',
                                    fontSize: 10,
                                    letterSpacing: 0.35,
                                    boxShadow:
                                      micTestTrackId === t.id
                                        ? '0 0 10px rgba(34,211,238,0.35)'
                                        : undefined,
                                  }}
                                >
                                  <Mic size={14} strokeWidth={2.5} />
                                  MIC
                                </button>
                              ) : (
                                <div
                                  className="w-full rounded flex items-center justify-center font-mono text-center leading-tight"
                                  style={{
                                    minHeight: 28,
                                    padding: '4px 4px',
                                    fontSize: 8,
                                    color: '#525252',
                                    border: '1px dashed #404040',
                                    background: '#0c0c0c',
                                  }}
                                  title="Mic appears on Audio and Vocal tracks only"
                                >
                                  Mic: Audio / Vocal
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {(t.type === 'Audio' || t.type === 'Vocal') && micTestTrackId === t.id && (
                          <ProMeter
                            level={micTestLevel}
                            peakLevel={micTestPeak}
                            vertical={false}
                            width={104}
                            height={14}
                            label="IN"
                          />
                        )}
                        <div className="flex gap-1 items-center opacity-80 group-hover:opacity-100">
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleMute(t.id); }} className="w-[26px] h-[26px] rounded flex items-center justify-center" style={{ background: t.muted ? '#f4444433' : '#1a1a1a', color: t.muted ? '#ff6666' : '#666', border: `1px solid ${t.muted ? '#f44444' : '#333'}`, cursor: 'pointer', padding: 0 }}><VolumeX size={12} /></button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleSolo(t.id); }} className="w-[26px] h-[26px] rounded flex items-center justify-center" style={{ background: t.solo ? '#ffcc0033' : '#1a1a1a', color: t.solo ? '#ffcc00' : '#666', border: `1px solid ${t.solo ? '#ffcc00' : '#333'}`, cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 'bold' }}>S</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleLock(t.id); }} className="w-[26px] h-[26px] rounded flex items-center justify-center" style={{ background: t.locked ? '#00E5FF22' : '#1a1a1a', color: t.locked ? '#00E5FF' : '#666', border: `1px solid ${t.locked ? '#00E5FF' : '#333'}`, cursor: 'pointer', padding: 0 }}><Lock size={12} /></button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); duplicateTrack(t.id); }}
                            title="Duplicate track (clips, mixer level, pan, FX)"
                            className="w-[26px] h-[26px] rounded flex items-center justify-center"
                            style={{ background: '#1a1a1a', color: '#9ecbff', border: '1px solid #334455', cursor: 'pointer', padding: 0 }}
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteTrack(t.id); }}
                            title="Delete track"
                            className="w-[26px] h-[26px] rounded flex items-center justify-center"
                            style={{ background: '#1a1a1a', color: '#ff6666', border: '1px solid #663333', cursor: 'pointer', padding: 0 }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Timeline: horizontal scroll only ΓÇö no min-h-0 (avoids nested vertical scroll) */}
              <div 
                ref={timelineRef} 
                className="flex-1 min-w-0 shrink-0 self-start overflow-x-auto" 
                style={{ position: 'relative', minHeight: 'min-content' }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY });
                }}>
                <div className="shrink-0" style={{ width: timelineMap.totalWidthPx, position: 'relative' }}>
                  {/* Ruler */}
                  <div
                    className="sticky top-0 z-20"
                    title="Timeline ruler — cyan column & line = playhead. TitleBar MET (magenta) = audible clicks. Toolbar MET lamp = visual quarter flashes."
                    style={{
                      background: '#0a0a0a',
                      borderBottom: '1px solid #1a1a1a',
                      width: timelineMap.totalWidthPx,
                      position: 'relative',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onMouseDown={onRulerMouseDown}
                  >
                    {/* Bar numbers */}
                    <div style={{ position: 'relative', height: RULER_BAR_H, minHeight: RULER_BAR_H, width: timelineMap.totalWidthPx }}>
                      {Array.from({ length: BARS }, (_, i) => {
                        const bar = i + 1;
                        const isBarActive = selectedBar === bar;
                        const isCurrent =
                          playheadBarForRuler === bar &&
                          playheadActiveOnRuler &&
                          !useDomRulerPlayheadHighlight;
                        return (
                          <div
                            key={i}
                            className="absolute top-0 flex items-center justify-start pl-1"
                            style={{
                              left: i * colW,
                              width: colW,
                              height: RULER_BAR_H,
                              color: isCurrent ? STUDIO_PLAYHEAD_LINE.barText : isBarActive ? '#00ff88' : '#555',
                              background: isCurrent ? STUDIO_PLAYHEAD_LINE.barBg : isBarActive ? 'rgba(0,255,136,0.08)' : 'transparent',
                              borderLeft: `1px solid ${i % 4 === 0 ? '#1a1a1a' : '#0d0d0d'}`,
                              fontSize: Math.min(9, Math.max(7, colW * 0.2)),
                              fontFamily: 'monospace',
                              fontWeight: 'bold',
                              overflow: 'hidden',
                              boxSizing: 'border-box',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {i + 1}
                          </div>
                        );
                      })}
                    </div>
                    {/* Beats 1ΓÇªN (quarters from time sig) aligned to bar grid */}
                    <div style={{ position: 'relative', height: RULER_MEAS_H, minHeight: RULER_MEAS_H, width: timelineMap.totalWidthPx, borderTop: '1px solid #141414' }}>
                      {Array.from({ length: BARS * qpb }, (_, idx) => {
                        const bi = Math.floor(idx / qpb);
                        const mi = idx % qpb;
                        const barNum = bi + 1;
                        const isSel = selectedBar === barNum && selectedMeasureInBar === mi + 1;
                        const isPlayheadBeat =
                          playheadActiveOnRuler &&
                          !useDomRulerPlayheadHighlight &&
                          barNum === playheadBarForRuler &&
                          mi + 1 === playheadBeatInBar1;
                        return (
                          <div
                            key={idx}
                            className="absolute flex items-center justify-center font-mono font-bold"
                            style={{
                              left: timelineMap.absoluteBeatToX(
                                bi * qpb + mi,
                              ),
                              width: measureW,
                              height: RULER_MEAS_H,
                              fontSize: beatRulerFontPx,
                              color: isSel ? '#00ff88' : isPlayheadBeat ? STUDIO_PLAYHEAD_LINE.measText : '#555',
                              borderLeft: mi === 0 ? `1px solid ${bi % 4 === 0 ? '#1a1a1a' : '#0d0d0d'}` : '1px solid #1a1a1a',
                              background: isSel
                                ? 'rgba(0,255,136,0.14)'
                                : isPlayheadBeat
                                  ? STUDIO_PLAYHEAD_LINE.measBg
                                  : 'transparent',
                              overflow: 'hidden',
                              boxSizing: 'border-box',
                              lineHeight: 1,
                              minWidth: 0,
                            }}
                          >
                            {showBeatRulerLabels ? mi + 1 : ''}
                          </div>
                        );
                      })}
                    </div>
                    {useDomRulerPlayheadHighlight ? (
                      <StudioRulerPlayheadHighlights
                        isActive={playheadMotionActive}
                        timelineMap={timelineMap}
                        beatForPixel={studioLineBeatForPixel}
                        liveBeatForPixel={
                          isStudioPrecounting &&
                          studioPrecountTimelineRef.current != null
                            ? getLivePlayheadBeatForPixel
                            : playheadMotionActive && !isStudioPrecounting
                              ? readMasterPulseGridBeat
                              : undefined
                        }
                        allowNeg={
                          isStudioPrecounting &&
                          studioPrecountTimelineRef.current != null
                        }
                        rulerBarH={RULER_BAR_H}
                        rulerMeasH={RULER_MEAS_H}
                        getTransportBeatFloat={getStudioTransportBeatFloat}
                        beatColumnExposeRef={studioRulerHighlightColumnRef}
                        suppressInternalHighlightRaf={
                          playheadMotionActive && !isStudioPrecounting
                        }
                      />
                    ) : null}
                    <LoopMarkersBrace
                      visible={studioLoopRegionOk}
                      leftPx={studioLoopBraceLeftPx}
                      widthPx={studioLoopBraceWidthPx}
                      height={RULER_H}
                      variant="dark"
                      zIndex={21}
                    />
                  </div>

                  {/* Track rows */}
                  <LoopVerticalGuides
                    visible={studioLoopRegionOk}
                    leftPx={studioLoopBraceLeftPx}
                    widthPx={studioLoopBraceWidthPx}
                    height={Math.max(0, tracks.length) * TRACK_H}
                    topPx={RULER_H}
                    zIndex={14}
                  />
                  {tracks.map(t => {
                    const dimmed = soloActive && !t.solo;
                    const rowCh = sessionChDisplayLabel(t, audioTrackDupCounts, displayChannelMap);
                    const isArmed = recordArmedTrackId === t.id;
                    const isSel = editorTrack?.id === t.id;
                    return (
                      <div key={t.id} className="relative"
                        onMouseDown={(e) => onTimelineGridMouseDown(e, t)}
                        style={{
                          height: TRACK_H,
                          borderBottom: '1px solid #111',
                          width: timelineMap.totalWidthPx,
                          opacity: dimmed ? 0.25 : 1,
                          boxShadow: isArmed
                            ? 'inset 3px 0 0 #ff4444'
                            : isSel
                              ? 'inset 3px 0 0 #00E5FF88'
                              : undefined,
                        }}>
                        <span
                          className="absolute left-1.5 z-[3] pointer-events-none font-mono font-bold"
                          style={{ top: 6, fontSize: 10, lineHeight: 1.2, color: '#00E5FF', textShadow: '0 0 6px #000, 0 1px 2px #000' }}
                          title="Session channel (audioTrack)"
                        >
                          {rowCh}
                        </span>
                        {/*
                          PERF mode previously used repeating-linear-gradient; browser stop positions
                          did not always match {@link StudioTimelineMap.absoluteBeatToX} + ruler divs,
                          so the cyan line looked "off" or jumped vs drawn quarters. Same 1px div grid always.
                        */}
                        {Array.from({ length: BARS * qpb }, (_, idx) => {
                          const bi = Math.floor(idx / qpb);
                          const mi = idx % qpb;
                          const left = timelineMap.absoluteBeatToX(bi * qpb + mi);
                          const isBarLine = mi === 0;
                          return (
                            <div
                              key={idx}
                              className="absolute top-0 h-full"
                              style={{
                                left,
                                width: 1,
                                background: isBarLine ? '#1e1e1e' : '#141414',
                              }}
                            />
                          );
                        })}
                        {t.clips.map(clip => {
                          const clipW = Math.max(
                            8,
                            timelineMap.absoluteBeatToX(clipLengthBeats(clip, qpb)) - 2,
                          );
                          const clipLeft =
                            timelineMap.absoluteBeatToX(clipStartBeat0(clip, qpb)) + 1;
                          const isDragging = draggingClip?.trackId === t.id && draggingClip.clipId === clip.id;
                          if (performancePlaybackActive) {
                            return (
                              <div
                                key={clip.id}
                                data-clip-item="true"
                                className="absolute top-1 select-none overflow-hidden rounded"
                                style={{
                                  left: clipLeft,
                                  width: clipW,
                                  height: Math.max(24, TRACK_H - 12),
                                  zIndex: isDragging ? 12 : 2,
                                  opacity: isDragging ? 0.9 : 1,
                                  background: `${t.color}18`,
                                  border: `1px solid ${t.color}77`,
                                  boxSizing: 'border-box',
                                }}
                                title={clip.label || 'Clip'}
                              >
                                {clip.label ? (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      left: 4,
                                      bottom: 2,
                                      fontSize: 8,
                                      fontFamily: 'monospace',
                                      fontWeight: 700,
                                      color: t.color,
                                      textShadow: '0 0 3px #000',
                                      whiteSpace: 'nowrap',
                                      pointerEvents: 'none',
                                    }}
                                  >
                                    {clip.label}
                                  </span>
                                ) : null}
                              </div>
                            );
                          }
                          const startBeat0 = clipStartBeat0(clip, qpb);
                          const lenBeats = clipLengthBeats(clip, qpb);
                          // Continuous playhead phase inside clips to avoid beat-quantized visual skipping.
                          const ph = transportBeatFloatForClips;
                          const phFrac =
                            performancePlaybackActive
                              ? undefined
                              : ph >= startBeat0 && ph < startBeat0 + lenBeats
                                ? (ph - startBeat0) / lenBeats
                                : undefined;
                          const hasCrossfade = t.clips.some(c => c.id !== clip.id && c.bar + c.len === clip.bar);
                          return (
                            <div key={clip.id}>
                              {isDragging && shadowStartBeat0 !== null && (
                                <div className="absolute top-1 bottom-1 rounded pointer-events-none"
                                  style={{ left: timelineMap.absoluteBeatToX(shadowStartBeat0) + 1, width: clipW, background: `${t.color}12`, border: `2px dashed ${t.color}`, zIndex: 8 }}>
                                  <span className="absolute top-0 left-1" style={{ color: t.color, fontSize: 7, fontFamily: 'monospace' }} title="Fractional bar (1 = bar 1)">
                                    ~{(shadowStartBeat0 / qpb + 1).toFixed(3)}
                                  </span>
                                </div>
                              )}
                              <div
                                onMouseDown={e => onClipMouseDown(t.id, clip.id, clip.bar, e)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    targetClip: { trackId: t.id, clipId: clip.id },
                                  });
                                }}
                                data-clip-item="true"
                                className="absolute top-1 select-none overflow-hidden rounded group"
                                style={{ left: clipLeft, width: clipW, height: Math.max(24, TRACK_H - 12), cursor: isDragging ? 'grabbing' : tool === 'razor' ? 'crosshair' : 'grab', boxShadow: selectedClips.includes(String(clip.id)) ? `0 0 12px ${t.color}ff, inset 0 0 8px ${t.color}66, 0 0 20px #00ff8866` : isDragging ? `0 0 20px ${t.color}88, inset 0 0 10px ${t.color}44` : `0 0 8px ${t.color}33`, zIndex: isDragging ? 15 : selectedClips.includes(String(clip.id)) ? 5 : 1, opacity: isDragging ? 0.9 : 1, background: selectedClips.includes(String(clip.id)) ? `linear-gradient(180deg, ${t.color}35, ${t.color}25)` : `linear-gradient(180deg, ${t.color}15, ${t.color}08)`, border: `2px solid ${selectedClips.includes(String(clip.id)) ? '#00ff88' : isDragging ? t.color : `${t.color}66`}`, transition: isDragging ? 'none' : 'all 0.15s' }}>
                                <div
                                  className="absolute inset-0 pointer-events-none flex flex-col justify-end overflow-hidden"
                                  style={{ padding: '2px 4px' }}
                                >
                                  {phFrac !== undefined &&
                                  phFrac >= 0 &&
                                  phFrac <= 1 ? (
                                    <div
                                      className="absolute top-0 bottom-0 pointer-events-none"
                                      style={{
                                        left: `${phFrac * 100}%`,
                                        width: 2,
                                        marginLeft: -1,
                                        background: STUDIO_PLAYHEAD_LINE.gradient,
                                        boxShadow: STUDIO_PLAYHEAD_LINE.shadowClip,
                                        zIndex: 2,
                                      }}
                                    />
                                  ) : null}
                                  {clip.label ? (
                                    <span
                                      style={{
                                        fontSize: 8,
                                        fontFamily: 'monospace',
                                        fontWeight: 700,
                                        color: t.color,
                                        textShadow: '0 0 4px #000, 0 1px 2px #000',
                                        zIndex: 1,
                                        position: 'relative',
                                      }}
                                    >
                                      {clip.label}
                                    </span>
                                  ) : null}
                                </div>
                                {hasCrossfade && (
                                  <div className="absolute top-0 left-0 h-full pointer-events-none"
                                    style={{ width: 12, background: `linear-gradient(90deg, ${t.color}66, transparent)` }} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {transport === 'recording' &&
                          liveRecordLane?.trackId === t.id && (
                            <div
                              className="absolute top-1 rounded overflow-hidden pointer-events-none"
                              style={{
                                left:
                                  timelineMap.absoluteBeatToX(liveRecordLane.startBeat0) + 1,
                                height: Math.max(24, TRACK_H - 12),
                                zIndex: 11,
                                boxShadow: '0 0 16px rgba(248,113,113,0.4)',
                                border: '2px solid rgba(251,113,133,0.75)',
                              }}
                            >
                              <RecordingWaveShade
                                height={Math.max(24, TRACK_H - 12)}
                                startBeat0={liveRecordLane.startBeat0}
                                pixelsPerBeat={timelineMap.pixelsPerBeat}
                                getCurrentBeat={getStudioTransportBeatFloat}
                              />
                              <span
                                className="absolute bottom-0.5 left-1 font-mono font-bold"
                                style={{
                                  fontSize: 7,
                                  color: '#fecaca',
                                  textShadow: '0 0 5px #000, 0 1px 2px #000',
                                }}
                              >
                                RECΓÇª
                              </span>
                            </div>
                          )}
                      </div>
                    );
                  })}
                  {/* Full-height bar selection column ΓÇö spans ruler + all tracks (not clipped by ruler / 100vh) */}
                  {selectedBar !== null &&
                    selectedBar <= BARS &&
                    selectedMeasureInBar !== null &&
                    selectedMeasureInBar >= 1 &&
                    selectedMeasureInBar <= qpb && (
                    <div
                      className="absolute"
                      style={{
                        top: 0,
                        bottom: 0,
                        left: timelineMap.absoluteBeatToX(
                          (selectedBar - 1) * qpb +
                            (selectedMeasureInBar - 1),
                        ),
                        width: measureW,
                        boxSizing: 'border-box',
                        zIndex: 22,
                        pointerEvents: 'none',
                      }}
                    >
                      {/*
                        Capture pointers here ΓÇö parent was pointer-events-none so clicks passed
                        through to track rows; the 2nd click of a double-click re-selected the beat.
                      */}
                      <div
                        className="absolute inset-0"
                        style={{
                          pointerEvents: 'auto',
                          background: 'rgba(0,255,136,0.07)',
                          borderLeft: '2px solid #00ff88',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                        }}
                        title="Double-click to clear edit line"
                        onMouseDown={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedBar(null);
                          setIsBarDragSelecting(false);
                        }}
                      />
                      <span
                        className="absolute top-1 font-bold pointer-events-none"
                        style={{ left: 2, color: '#00ff88', fontSize: 7 }}
                      >
                        EDIT
                      </span>
                    </div>
                  )}
                  <div
                    ref={studioPlayheadLineRef}
                    className="absolute pointer-events-none top-0 bottom-0"
                    title="Playhead — cyan line = transport grid (same as MET timing). MET offset for speakers is click-only."
                    style={{
                      left: 0,
                      width: 1,
                      zIndex: 25,
                      opacity: isStudioScreenActive ? 1 : 0,
                      background: STUDIO_PLAYHEAD_LINE.gradient,
                      boxShadow: STUDIO_PLAYHEAD_LINE.shadow,
                      willChange: 'transform',
                      transform: `translate3d(var(${STUDIO_PLAYHEAD_X_VAR}, 0px), 0, 0)`,
                    }}
                  />
                </div>
              </div>
              </div>
          </div>
        </ResizablePanel>

        {editorTrack && (
          <div className="shrink-0 overflow-hidden flex flex-col" style={{ borderTop: '2px solid #1a1a1a', background: '#030303', minHeight: 200, maxHeight: 360, flex: '0 1 320px' }}>
            <WaveformEditor
              clips={editorTrack.clips.map(c => ({ id: c.id, bar: c.bar, len: c.len, label: c.label, trackColor: editorTrack.color, trackType: editorTrack.type }))}
              colW={colW} totalBars={BARS} trackColor={editorTrack.color}
              trackName={`${sessionChDisplayLabel(editorTrack, audioTrackDupCounts, displayChannelMap)} ┬╖ ${editorTrack.name}`}
              onClose={() => setEditorTrack(null)}
            />
          </div>
        )}
        </div>

        {/* ΓöÇΓöÇ BOTTOM: full-width mixer (same `tracks` order + MASTER) ΓöÇΓöÇ */}
        <div
          className="w-full"
          style={{
            borderTop: '2px solid #2a2a2a',
            background: '#080808',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            height: mixerOpen ? `${mixerHeight + 24}px` : 'auto',
          }}
        >
          {/* Header — wrap + stacked readouts so transport/sync strip stays on-screen when narrow */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              gap: 10,
              rowGap: 8,
              padding: '6px 10px',
              background: '#0a0a0a',
              borderBottom: '1px solid #1a1a1a',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
                  stop();
                }}
                style={{ width: 24, height: 20, borderRadius: 3, border: '1px solid #333', background: '#111', color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Stop"
              >
                <Square size={11} fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={() => {
                  seekToTick(Math.max(0, positionTicks - ticksPerBar));
                }}
                style={{ width: 24, height: 20, borderRadius: 3, border: '1px solid #333', background: '#111', color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Rewind one bar"
              >
                <SkipBack size={11} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isStudioPrecounting) {
                    window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
                    return;
                  }
                  if (
                    transport === 'playing' ||
                    transport === 'recording' ||
                    transport === 'counting'
                  ) {
                    pause();
                    return;
                  }
                  window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
                  void play();
                }}
                style={(() => {
                  const isRec = transport === 'recording';
                  const isCount = transport === 'counting' || isStudioPrecounting;
                  const isPlay = transport === 'playing';
                  const active = isRec || isCount || isPlay;
                  let border = '#333';
                  let background = '#111';
                  let color = '#aaa';
                  let shadow: string | undefined;
                  if (isRec) {
                    border = '#f8717188';
                    background = '#ef444433';
                    color = '#fca5a5';
                    shadow = '0 0 10px rgba(248,113,113,0.45)';
                  } else if (isStudioPrecounting) {
                    border = '#fbbf2488';
                    background = '#f59e0b28';
                    color = '#fcd34d';
                    shadow = '0 0 8px rgba(251,191,36,0.35)';
                  } else if (transport === 'counting') {
                    border = '#fbbf2488';
                    background = '#f59e0b28';
                    color = '#fcd34d';
                    shadow = '0 0 8px rgba(251,191,36,0.35)';
                  } else if (isPlay) {
                    border = '#22c55e66';
                    background = '#22c55e22';
                    color = '#22c55e';
                  }
                  return {
                    width: 28,
                    height: 22,
                    borderRadius: 4,
                    border: `1px solid ${border}`,
                    background,
                    color,
                    boxShadow: active ? shadow : undefined,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  };
                })()}
                title={
                  isStudioPrecounting
                    ? 'Cancel count-in'
                    : transport === 'recording'
                      ? 'Pause ΓÇö recording (red)'
                      : transport === 'counting'
                        ? 'Pause ΓÇö count-in'
                        : transport === 'playing'
                          ? 'Pause ΓÇö playing'
                          : 'Play'
                }
              >
                {transport === 'playing' ||
                transport === 'recording' ||
                transport === 'counting' ||
                isStudioPrecounting ? (
                  <Pause size={12} fill="currentColor" />
                ) : (
                  <Play size={12} fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  const maxTick = Math.max(0, Math.round(songTotalBars * ticksPerBar));
                  seekToTick(Math.min(maxTick, positionTicks + ticksPerBar));
                }}
                style={{ width: 24, height: 20, borderRadius: 3, border: '1px solid #333', background: '#111', color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Fast forward one bar"
              >
                <SkipForward size={11} />
              </button>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginLeft: 4,
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid #2a2a2a',
                  background: '#0c0c0c',
                  flexShrink: 0,
                }}
                title="Same audio-time phase as playhead / metronome"
              >
                <button
                  type="button"
                  onClick={() => setStudioTimingMode('beats')}
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '2px 5px',
                    borderRadius: 2,
                    border: 'none',
                    cursor: 'pointer',
                    background: studioTimingMode === 'beats' ? '#1e3a5f' : 'transparent',
                    color: studioTimingMode === 'beats' ? '#93c5fd' : '#666',
                  }}
                >
                  BBT
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTimingMode('time')}
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '2px 5px',
                    borderRadius: 2,
                    border: 'none',
                    cursor: 'pointer',
                    background: studioTimingMode === 'time' ? '#1e3a5f' : 'transparent',
                    color: studioTimingMode === 'time' ? '#93c5fd' : '#666',
                  }}
                >
                  TIME
                </button>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#e5e7eb',
                    minWidth: 118,
                    textAlign: 'right',
                    letterSpacing: 0.2,
                  }}
                >
                  {studioTimingMode === 'beats'
                    ? studioTimingReadout.bbt
                    : studioTimingReadout.time}
                </span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                flex: '1 1 220px',
                minWidth: 0,
                maxWidth: '100%',
              }}
              title="Playhead grid sync — bar.beat, lock ladder, PH strip (same clock as cyan timeline line)"
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  rowGap: 4,
                }}
              >
                <StudioLockBeatReadout
                  isActive={isStudioScreenActive}
                  beatsPerBar={qpb}
                  totalBars={BARS}
                  getBeatFloat={getStudioTransportBeatFloat}
                  clockRunning={playheadMotionActive}
                />
                <StudioDawLockStatusReadout
                  isActive={isStudioScreenActive}
                  clockRunning={playheadMotionActive}
                  beatsPerBar={qpb}
                  totalBars={BARS}
                  timeSigs={timeSigs as TimeSignature[]}
                />
                <StudioRenderCadenceReadout isActive={isStudioScreenActive} />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  rowGap: 4,
                  width: '100%',
                }}
              >
                <StudioLiveSyncHud
                  isActive={isStudioScreenActive}
                  clockRunning={playheadMotionActive}
                  metronomeEnabled={metronomeEnabled}
                  beatsPerBar={qpb}
                  getStudioTransportSyncSnapshot={getUnifiedStudioSyncSnapshot}
                  pixelsPerBeat={timelineMap.pixelsPerBeat}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  rowGap: 4,
                }}
              >
                <StudioVisualMetronomeLamp
                  isActive={isStudioScreenActive}
                  metronomeEnabled={metronomeEnabled}
                  clockRunning={playheadMotionActive}
                  beatsPerBar={qpb}
                />
                <button
                  type="button"
                  onClick={captureSyncReport}
                  disabled={syncCaptureRunning}
                  style={{
                    height: 20,
                    borderRadius: 3,
                    border: '1px solid #333',
                    background: syncCaptureRunning ? '#222' : '#111',
                    color: syncCaptureRunning ? '#fbbf24' : '#aaa',
                    fontSize: 9,
                    padding: '0 6px',
                    flexShrink: 0,
                    cursor: syncCaptureRunning ? 'default' : 'pointer',
                  }}
                  title="Capture 10 seconds of sync data to a text file"
                >
                  {syncCaptureRunning ? 'SYNC REC...' : 'SYNC CAPTURE'}
                </button>
                <button
                  type="button"
                  onClick={() => setPerformancePlaybackMode((v) => !v)}
                  disabled={isTransportRunning}
                  style={{
                    height: 20,
                    minWidth: 78,
                    borderRadius: 3,
                    border: `1px solid ${performancePlaybackMode ? '#22c55e66' : '#333'}`,
                    background: performancePlaybackMode ? '#0f2015' : '#111',
                    color: performancePlaybackMode ? '#86efac' : '#aaa',
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 0.25,
                    whiteSpace: 'nowrap',
                    padding: '0 6px',
                    flexShrink: 0,
                    cursor: isTransportRunning ? 'not-allowed' : 'pointer',
                    opacity: isTransportRunning ? 0.7 : 1,
                  }}
                  title={
                    isTransportRunning
                      ? 'Performance Playback is locked ON while transport is running'
                      : 'Performance Playback: reduce scheduler/UI load while preserving full Studio visuals'
                  }
                >
                  PERF {performancePlaybackMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
                flexWrap: 'wrap',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 9,
                  color: '#888',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
                title="Count-in bars (4/4) before recording ΓÇö transport stays stopped until the last click"
              >
                <input
                  type="checkbox"
                  checked={studioPrecountEnabled}
                  onChange={(e) => setStudioPrecountEnabled(e.target.checked)}
                />
                In
              </label>
              <select
                value={studioPrecountBars}
                onChange={(e) => setStudioPrecountBars(Number(e.target.value))}
                disabled={!studioPrecountEnabled}
                style={{
                  fontSize: 9,
                  height: 20,
                  borderRadius: 3,
                  border: '1px solid #333',
                  background: '#111',
                  color: studioPrecountEnabled ? '#fbbf24' : '#555',
                  flexShrink: 0,
                  maxWidth: 56,
                }}
                title="Count-in length in bars"
              >
                <option value={1}>1 bar</option>
                <option value={2}>2 bars</option>
                <option value={3}>3 bars</option>
                <option value={4}>4 bars</option>
              </select>
              {isStudioPrecounting && studioPrecountBeat != null ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#fbbf24',
                    minWidth: 14,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                  title="Precount beat"
                >
                  {studioPrecountBeat}
                </span>
              ) : null}
              <button
                type="button"
                disabled={transport === 'recording' || isStudioPrecounting}
                onClick={() => void startRecordWithPrecount()}
                style={{
                  width: 30,
                  height: 24,
                  borderRadius: 4,
                  border: `2px solid ${
                    transport === 'recording'
                      ? '#f87171'
                      : isStudioPrecounting
                        ? '#fbbf24'
                        : recordArmedTrackId != null
                          ? '#f8717188'
                          : '#444'
                  }`,
                  background:
                    transport === 'recording'
                      ? '#ef444438'
                      : isStudioPrecounting
                        ? '#f59e0b22'
                        : '#1a0a0a',
                  color:
                    transport === 'recording'
                      ? '#fca5a5'
                      : isStudioPrecounting
                        ? '#fcd34d'
                        : '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: transport === 'recording' || isStudioPrecounting ? 0.85 : 1,
                  cursor:
                    transport === 'recording' || isStudioPrecounting ? 'not-allowed' : 'pointer',
                  boxShadow:
                    recordArmedTrackId != null &&
                    transport !== 'recording' &&
                    !isStudioPrecounting
                      ? '0 0 10px rgba(248,113,113,0.25)'
                      : undefined,
                }}
                title={
                  isStudioPrecounting
                    ? 'Count-inΓÇª'
                    : 'Record ΓÇö REC ARM (red) on an Audio/Vocal row first'
                }
              >
                <Mic size={14} strokeWidth={2.25} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 2 }}>
              <Clock size={12} color="#666" />
              <button
                type="button"
                onClick={() => setBpm(Math.max(40, Math.min(300, Math.round((bpm ?? 120) - 1))))}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 3,
                  border: '1px solid #6366f1',
                  background: '#312e81',
                  color: '#c7d2fe',
                  fontSize: 12,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  fontFamily: 'monospace',
                }}
                title="Tempo down (ΓêÆ1 BPM)"
              >
                -
              </button>
              <input
                type="number"
                min={40}
                max={300}
                step={1}
                value={Math.round(bpm || 120)}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) setBpm(Math.max(40, Math.min(300, Math.round(next))));
                }}
                style={{
                  width: 60,
                  height: 22,
                  borderRadius: 4,
                  border: '1px solid #333',
                  background: '#111',
                  color: '#f3f4f6',
                  fontSize: 11,
                  padding: '0 6px',
                  fontFamily: 'monospace',
                  textAlign: 'right',
                  appearance: 'textfield',
                  WebkitAppearance: 'none',
                  MozAppearance: 'textfield',
                }}
                title="Tempo BPM"
              />
              <button
                type="button"
                onClick={() => setBpm(Math.max(40, Math.min(300, Math.round((bpm ?? 120) + 1))))}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 3,
                  border: '1px solid #6366f1',
                  background: '#312e81',
                  color: '#c7d2fe',
                  fontSize: 12,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  fontFamily: 'monospace',
                }}
                title="Tempo up (+1 BPM)"
              >
                +
              </button>
              <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>BPM</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 8, color: '#666', fontFamily: 'monospace' }}>Add by channel (+), drag slots to reorder</span>
            </div>
            <span style={{ fontSize: 8, color: '#666', fontFamily: 'monospace', flex: 1, minWidth: 0, textAlign: 'center' }}>
              Channels ┬╖ same order as timeline ┬╖ CH = audioTrack
            </span>
            <button type="button" onClick={() => setMixerOpen(!mixerOpen)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px 4px', flexShrink: 0, marginLeft: 'auto' }}>
              {mixerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* Content */}
          {mixerOpen && (
            <div
              ref={mixerScrollContainerRef}
              style={{ display: 'flex', overflowX: 'auto', height: mixerHeight, background: '#050505' }}
            >
              {tracks.map(track => {
                const sessionCh = mixerRoutingChannel(track);
                const chLab = sessionChDisplayLabel(track, audioTrackDupCounts, displayChannelMap);
                const isPlaying = false;
                const volLevel = (channelVolumes[sessionCh] ?? track.volume) / 100;
                const rmsLevel = isPlaying ? Math.min(1, (channelLevels[sessionCh] ?? 0) * volLevel) : 0;
                const peakLevel = isPlaying ? Math.min(1, rmsLevel * 1.25) : 0;
                const pan = trackPans[track.id] ?? 0;
                const panNorm = Math.max(-1, Math.min(1, pan / 100));
                const stereoMode = getTrackStereoMode(track);
                const leftLevel = Math.min(1, rmsLevel * (panNorm > 0 ? 1 - panNorm : 1));
                const rightLevel = Math.min(1, rmsLevel * (panNorm < 0 ? 1 + panNorm : 1));
                const dbLevel = rmsLevel > 0 ? (20 * Math.log10(rmsLevel)) : -60;
                const clipping = dbLevel > 0;
                const mixArmed = recordArmedTrackId === track.id;
                const mixSel = editorTrack?.id === track.id;

                return (
                  <div
                    key={track.id}
                    data-studio-mixer-strip={track.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: 124,
                      flexShrink: 0,
                      padding: '10px 8px 12px',
                      borderRight: '1px solid #1a1a1a',
                      gap: 8,
                      justifyContent: 'flex-start',
                      background: mixSel ? 'rgba(0,229,255,0.06)' : 'transparent',
                      borderLeft: mixArmed ? '4px solid #ff4444' : mixSel ? '3px solid #00E5FF' : '3px solid transparent',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#00E5FF', textAlign: 'center', fontFamily: 'monospace', letterSpacing: 0.5, lineHeight: 1.25, paddingTop: 2 }} title="Session channel (same as track list)">
                      {chLab}
                    </div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: `${track.color}cc`, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: 10, lineHeight: 1.05, paddingBottom: 0, letterSpacing: 0.2 }}>
                      {track.name}
                    </div>

                    {/* Meter + side volume fader */}
                    <div style={{ flex: 1, display: 'flex', gap: 4, minHeight: 116 }}>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4, background: '#000', borderRadius: 3, padding: '4px 3px', border: '1px solid #1a1a1a' }}>
                        {(stereoMode === 'stereo' ? [leftLevel, rightLevel] : [rmsLevel]).map((level, meterIdx) => (
                          <div key={meterIdx} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-end', gap: '1px' }}>
                            {Array.from({ length: 12 }, (_, i) => {
                              const threshold = i / 12;
                              const isLit = level > threshold;
                              const ledColor = clipping && i > 10 ? '#ff3333' : isLit ? (i > 9 ? '#ffaa00' : i > 6 ? '#00ff88' : track.color) : '#0a0a0a';
                              return (
                                <div key={i} style={{ height: '100%', borderRadius: 2, background: ledColor, boxShadow: isLit ? `0 0 4px ${ledColor}` : 'none', transition: 'all 0.05s' }} />
                              );
                            })}
                            <div style={{ fontSize: 7, textAlign: 'center', color: '#666', fontFamily: 'monospace', marginTop: 2 }}>
                              {stereoMode === 'stereo' ? (meterIdx === 0 ? 'L' : 'R') : 'M'}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ width: 20, borderRadius: 3, border: '1px solid #1a1a1a', background: '#0b0b0b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 2px', gap: 4 }}>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={0.1}
                          value={Math.round(((channelVolumes[sessionCh] ?? track.volume) / 10) * 10) / 10}
                          onChange={e => setChannelVolume(sessionCh, Math.round(Number(e.target.value) * 10))}
                          style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 12, height: 74, accentColor: track.color, cursor: 'pointer' }}
                          title="Volume"
                        />
                        <div style={{ fontSize: 7, color: '#888', fontFamily: 'monospace', lineHeight: 1 }}>
                          {((channelVolumes[sessionCh] ?? track.volume) / 10).toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* dB display */}
                    <div style={{ fontSize: 7, textAlign: 'center', color: clipping ? '#ff3333' : '#888', fontFamily: 'monospace', fontWeight: 700 }}>
                      {dbLevel.toFixed(1)} dB
                    </div>

                    {/* Stereo / Mono */}
                    <button
                      type="button"
                      onClick={() => toggleStereoMode(track.id)}
                      style={{
                        width: '100%',
                        padding: '4px 0',
                        borderRadius: 3,
                        background: stereoMode === 'stereo' ? '#1a1a1a' : '#111',
                        color: stereoMode === 'stereo' ? '#00E5FF' : '#ffcc00',
                        border: `1px solid ${stereoMode === 'stereo' ? '#00E5FF44' : '#ffcc0044'}`,
                        cursor: 'pointer',
                        fontSize: 8,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                      }}
                      title="Toggle stereo/mono meter mode"
                    >
                      {stereoMode === 'stereo' ? 'STEREO' : 'MONO'}
                    </button>

                    {/* Pan under meter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <input
                        type="range"
                        min={-100}
                        max={100}
                        value={pan}
                        onChange={e => setPan(track.id, Number(e.target.value))}
                        style={{ width: '100%', height: 3, accentColor: track.color, cursor: 'pointer' }}
                      />
                      <div style={{ fontSize: 7, textAlign: 'center', color: '#666', fontFamily: 'monospace' }}>
                        {pan > 0 ? 'R' : pan < 0 ? 'L' : 'C'}{Math.abs(pan)}
                      </div>
                    </div>

                    {/* REC ARM + MIC ΓÇö full-width stacked for visibility */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        width: '100%',
                        alignItems: 'stretch',
                      }}
                    >
                      {(() => {
                        const canMic = track.type === 'Audio' || track.type === 'Vocal';
                        return (
                          <>
                            <button
                              type="button"
                              title={
                                canMic
                                  ? mixArmed
                                    ? 'Disarm track'
                                    : 'REC ARM ΓÇö Record in mixer targets this track'
                                  : 'Add Audio or Vocal track for mic recording'
                              }
                              onClick={() => {
                                if (canMic) toggleRecordArm(track);
                                else {
                                  setRecordPathHint(
                                    'Mixer REC ARM only on Audio / Vocal strips. Add + Audio or + Vocal in the header.',
                                  );
                                  window.setTimeout(() => setRecordPathHint(null), 10000);
                                }
                              }}
                              className="rounded font-mono font-black"
                              style={{
                                width: '100%',
                                minHeight: 30,
                                padding: '5px 4px',
                                background: !canMic
                                  ? '#141414'
                                  : mixArmed
                                    ? 'linear-gradient(180deg, #ff5555 0%, #b91c1c 100%)'
                                    : '#262626',
                                color: !canMic ? '#555' : mixArmed ? '#fff' : '#e5e5e5',
                                border: `2px solid ${!canMic ? '#333' : mixArmed ? '#fca5a5' : '#737373'}`,
                                cursor: canMic ? 'pointer' : 'not-allowed',
                                fontSize: 10,
                                letterSpacing: 0.4,
                                boxShadow: mixArmed ? '0 0 8px rgba(239,68,68,0.4)' : undefined,
                              }}
                            >
                              REC ARM
                            </button>
                            {canMic ? (
                              <button
                                type="button"
                                title={
                                  micTestTrackId === track.id
                                    ? 'Stop mic check'
                                    : 'MIC ΓÇö test input level before recording'
                                }
                                onClick={() => void toggleMicTest(track.id)}
                                className="rounded font-mono font-black"
                                style={{
                                  width: '100%',
                                  minHeight: 28,
                                  padding: '4px 4px',
                                  background: micTestTrackId === track.id ? '#00E5FF28' : '#0f172a',
                                  color: micTestTrackId === track.id ? '#00E5FF' : '#7dd3fc',
                                  border: `2px solid ${micTestTrackId === track.id ? '#22d3ee' : '#38bdf8'}`,
                                  cursor: 'pointer',
                                  fontSize: 10,
                                  fontWeight: 900,
                                  letterSpacing: 0.3,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 4,
                                }}
                              >
                                <Mic size={13} strokeWidth={2.25} />
                                MIC
                              </button>
                            ) : (
                              <div
                                className="rounded font-mono text-center"
                                style={{
                                  width: '100%',
                                  minHeight: 26,
                                  padding: '4px 2px',
                                  fontSize: 7,
                                  color: '#525252',
                                  border: '1px dashed #404040',
                                  background: '#0a0a0a',
                                }}
                                title="Mic on Audio / Vocal only"
                              >
                                Mic: Audio / Vocal
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {(track.type === 'Audio' || track.type === 'Vocal') && micTestTrackId === track.id && (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ProMeter
                          level={micTestLevel}
                          peakLevel={micTestPeak}
                          vertical={false}
                          width={100}
                          height={14}
                          label="IN"
                        />
                      </div>
                    )}

                    {/* M/S ΓÇö same state as timeline */}
                    <div style={{ display: 'flex', gap: '4px', fontSize: 10 }}>
                      <button onClick={() => toggleMute(track.id)} style={{ flex: 1, padding: '6px 4px', borderRadius: 3, background: track.muted ? '#f4444433' : '#1a1a1a', color: track.muted ? '#ff6666' : '#888', border: `1px solid ${track.muted ? '#f44444' : '#333'}`, cursor: 'pointer', fontWeight: 800, transition: 'all 0.1s' }}>
                        M
                      </button>
                      <button onClick={() => toggleSolo(track.id)} style={{ flex: 1, padding: '6px 4px', borderRadius: 3, background: track.solo ? '#ffcc0033' : '#1a1a1a', color: track.solo ? '#ffcc00' : '#888', border: `1px solid ${track.solo ? '#ffcc00' : '#333'}`, cursor: 'pointer', fontWeight: 800, transition: 'all 0.1s' }}>
                        S
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddFxTrackId((prev) => (prev === track.id ? null : track.id))}
                      style={{
                        height: 20,
                        borderRadius: 3,
                        border: '1px solid #2d4452',
                        background: addFxTrackId === track.id ? '#102332' : '#0f1922',
                        color: '#9dd9ff',
                        fontSize: 8,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                      }}
                    >
                      + ADD FX
                    </button>
                    {addFxTrackId === track.id && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                        {EFFECT_TYPES.map((fxType) => (
                          <button
                            key={`${track.id}-${fxType}`}
                            type="button"
                            onClick={() => {
                              addTrackEffect(track.id, fxType);
                              setAddFxTrackId(null);
                            }}
                            style={{ fontSize: 7, borderRadius: 3, border: '1px solid #254154', background: '#0f1b25', color: '#89b6d0', padding: '2px 3px', textTransform: 'uppercase' }}
                          >
                            {fxType}
                          </button>
                        ))}
                      </div>
                    )}
                    <div
                      style={{
                        minHeight: 30,
                        borderRadius: 3,
                        border: '1px dashed #203646',
                        background: '#060f16',
                        padding: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                      title="FX chain slots"
                    >
                      {(trackEffects[track.id] ?? []).length === 0 ? (
                        <span style={{ fontSize: 7, color: '#4e6678', fontFamily: 'monospace' }}>NO FX</span>
                      ) : (
                        (trackEffects[track.id] ?? []).map((fx, fxIdx) => (
                          <div key={`${track.id}-${fx.id}-${fxIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (!dragFxSlot || dragFxSlot.trackId !== track.id) return;
                                moveTrackEffect(track.id, dragFxSlot.fromIndex, fxIdx);
                                setDragFxSlot(null);
                              }}
                              style={{ height: 4, borderRadius: 2, background: 'transparent' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#0f1b25', border: '1px solid #2d4452', borderRadius: 3, padding: '1px 2px' }}>
                            <button
                              type="button"
                              draggable
                              onDragStart={() => setDragFxSlot({ trackId: track.id, fromIndex: fxIdx })}
                              onDragEnd={() => setDragFxSlot(null)}
                              onClick={() => {
                                setActiveFxEditor({ trackId: track.id, effectId: fx.id });
                              }}
                              style={{
                                fontSize: 7,
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                color: '#9dd9ff',
                                background: 'transparent',
                                border: 'none',
                                padding: '0 2px',
                                cursor: 'grab',
                                textTransform: 'uppercase',
                              }}
                              title="Open effect editor"
                            >
                              {fx.type}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTrackEffect(track.id, fxIdx)}
                              style={{
                                fontSize: 8,
                                fontWeight: 900,
                                color: '#ff7b7b',
                                background: 'transparent',
                                border: 'none',
                                padding: '0 2px',
                                cursor: 'pointer',
                                lineHeight: 1,
                              }}
                              title="Remove effect"
                            >
                              x
                            </button>
                            </div>
                          </div>
                        ))
                      )}
                      {(trackEffects[track.id] ?? []).length > 0 && (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!dragFxSlot || dragFxSlot.trackId !== track.id) return;
                            moveTrackEffect(track.id, dragFxSlot.fromIndex, (trackEffects[track.id] ?? []).length - 1);
                            setDragFxSlot(null);
                          }}
                          style={{ height: 4, borderRadius: 2, background: 'transparent' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Master output: fader + real post-bus meter at end of channel row */}
              {(() => {
                const meterH = Math.max(120, Math.min(210, mixerHeight - 72));
                const masterDb =
                  masterMeterDisplay.rms > 1e-8
                    ? 20 * Math.log10(masterMeterDisplay.rms)
                    : -60;
                const masterClip = masterDb > 0;
                return (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: 126,
                      flexShrink: 0,
                      padding: '10px 8px 12px',
                      border: '1px solid #000',
                      gap: 8,
                      justifyContent: 'flex-start',
                      background:
                        'radial-gradient(120% 80% at 50% 0%, rgba(120,92,28,0.14) 0%, transparent 55%), linear-gradient(165deg, rgba(18,32,48,0.35) 0%, transparent 45%), linear-gradient(180deg, #0c1218 0%, #080e14 48%, #05080c 100%)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        color: '#ffcc00',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        letterSpacing: 0.5,
                        lineHeight: 1.25,
                        paddingTop: 2,
                      }}
                    >
                      MASTER
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: '#888',
                        textAlign: 'center',
                        lineHeight: 1.2,
                      }}
                    >
                      Output
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 10,
                        alignItems: 'stretch',
                        minHeight: meterH,
                        padding: '4px 0',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <ProMeter
                          level={masterMeterDisplay.rms}
                          peakLevel={masterMeterDisplay.peak}
                          width={18}
                          height={meterH}
                          vertical
                          showDb={false}
                          label="L"
                        />
                        <span style={{ fontSize: 7, color: '#777', fontFamily: 'monospace' }}>L</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <ProMeter
                          level={masterMeterDisplay.rms}
                          peakLevel={masterMeterDisplay.peak}
                          width={18}
                          height={meterH}
                          vertical
                          showDb={false}
                          label="R"
                        />
                        <span style={{ fontSize: 7, color: '#777', fontFamily: 'monospace' }}>R</span>
                      </div>
                      <div style={{ width: 20, borderRadius: 3, border: '1px solid #1a1a1a', background: '#0b0b0b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 2px', gap: 4 }}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(masterOutputLinear * 100)}
                          onChange={(e) => setMasterOutputLinear(Number(e.target.value) / 100)}
                          title="Session master output level"
                          style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 12, height: Math.max(74, meterH - 8), accentColor: '#ffcc00', cursor: 'pointer' }}
                        />
                        <div style={{ fontSize: 7, color: '#aaa', fontFamily: 'monospace', lineHeight: 1 }}>
                          {Math.round(masterOutputLinear * 100)}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        textAlign: 'center',
                        color: masterClip ? '#ff4444' : '#888',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    >
                      {masterDb > -58 ? `${masterDb.toFixed(1)} dBFS` : 'ΓÇöΓê₧'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMasterSolo((v) => !v)}
                      style={{
                        width: '100%',
                        padding: '4px 0',
                        borderRadius: 3,
                        background: masterSolo ? '#ffcc0033' : '#1a1a1a',
                        color: masterSolo ? '#ffcc00' : '#888',
                        border: `1px solid ${masterSolo ? '#ffcc00' : '#333'}`,
                        cursor: 'pointer',
                        fontSize: 8,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                      }}
                    >
                      SOLO
                    </button>
                    <div
                      style={{
                        width: 'calc(100% + 16px)',
                        marginLeft: -8,
                        borderRadius: 3,
                        border: '1px solid #0b1016',
                        background: '#060f16',
                        boxShadow: 'inset 0 0 0 1px #000',
                        padding: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setMasterAddFxOpen((v) => !v)}
                        style={{
                          width: '100%',
                          height: 18,
                          borderRadius: 3,
                          border: '1px solid #2d4452',
                          background: masterAddFxOpen ? '#102332' : '#0f1922',
                          color: '#9dd9ff',
                          fontSize: 8,
                          fontWeight: 800,
                          fontFamily: 'monospace',
                        }}
                      >
                        + MASTER FX
                      </button>
                      {masterAddFxOpen && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                          {EFFECT_TYPES.map((fxType) => (
                            <button
                              key={`master-${fxType}`}
                              type="button"
                              onClick={() => {
                                setMasterEffects((prev) => [
                                  ...prev,
                                  {
                                    id: crypto.randomUUID(),
                                    type: fxType,
                                    enabled: true,
                                    wet: 1,
                                    params: getDefaultEffectParams(fxType),
                                  },
                                ]);
                                setMasterAddFxOpen(false);
                              }}
                              style={{ fontSize: 7, borderRadius: 3, border: '1px solid #254154', background: '#0f1b25', color: '#89b6d0', padding: '2px 3px', textTransform: 'uppercase' }}
                            >
                              {fxType}
                            </button>
                          ))}
                        </div>
                      )}
                      {masterEffects.length === 0 ? (
                        <span style={{ fontSize: 7, color: '#4e6678', fontFamily: 'monospace' }}>NO FX</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {masterEffects.map((fx, fxIdx) => (
                            <div key={fx.id} style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#0f1b25', border: '1px solid #2d4452', borderRadius: 3, padding: '1px 2px' }}>
                              <span style={{ fontSize: 7, fontWeight: 800, fontFamily: 'monospace', color: '#9dd9ff', textTransform: 'uppercase' }}>{fx.type}</span>
                              <button
                                type="button"
                                onClick={() => setMasterEffects((prev) => prev.filter((_, i) => i !== fxIdx))}
                                style={{ fontSize: 8, fontWeight: 900, color: '#ff7b7b', background: 'transparent', border: 'none', padding: '0 2px', cursor: 'pointer', lineHeight: 1 }}
                                title="Remove master effect"
                              >
                                x
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      {activeFxEditor && (() => {
        const slot = (trackEffects[activeFxEditor.trackId] ?? []).find((fx) => fx.id === activeFxEditor.effectId);
        if (!slot) return null;
        const trackColor = tracks.find((t) => t.id === activeFxEditor.trackId)?.color ?? '#00E5FF';
        const paramEntries = Object.entries(slot.params);
        return (
          <div
            style={{
              position: 'fixed',
              right: 16,
              bottom: 60,
              width: 300,
              borderRadius: 8,
              border: '1px solid #2a4354',
              background: '#08131b',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              zIndex: 250,
              boxShadow: '0 10px 32px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#9dd9ff', fontWeight: 900, fontFamily: 'monospace' }}>
                TRACK {activeFxEditor.trackId} - {slot.type.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={() => setActiveFxEditor(null)}
                style={{ background: 'none', border: 'none', color: '#6b8798', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
              >
                x
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#90a9bc', fontFamily: 'monospace' }}>
              <input
                type="checkbox"
                checked={slot.enabled}
                onChange={(e) =>
                  setTrackEffects((prev) => ({
                    ...prev,
                    [activeFxEditor.trackId]: (prev[activeFxEditor.trackId] ?? []).map((fx) =>
                      fx.id === slot.id ? { ...fx, enabled: e.target.checked } : fx,
                    ),
                  }))
                }
              />
              ENABLED
            </label>
            <div style={{ fontSize: 10, color: '#6f879a', fontFamily: 'monospace' }}>WET {Math.round(slot.wet * 100)}%</div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(slot.wet * 100)}
              onChange={(e) =>
                setTrackEffects((prev) => ({
                  ...prev,
                  [activeFxEditor.trackId]: (prev[activeFxEditor.trackId] ?? []).map((fx) =>
                    fx.id === slot.id ? { ...fx, wet: Number(e.target.value) / 100 } : fx,
                  ),
                }))
              }
              style={{ width: '100%', accentColor: trackColor, height: 4 }}
            />
            {paramEntries.slice(0, 3).map(([paramKey, paramVal]) => (
              <div key={paramKey}>
                <div style={{ fontSize: 10, color: '#6f879a', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  {paramKey} {Math.round(paramVal * 100)}%
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(paramVal * 100)}
                  onChange={(e) =>
                    setTrackEffects((prev) => ({
                      ...prev,
                      [activeFxEditor.trackId]: (prev[activeFxEditor.trackId] ?? []).map((fx) =>
                        fx.id === slot.id
                          ? { ...fx, params: { ...fx.params, [paramKey]: Number(e.target.value) / 100 } }
                          : fx,
                      ),
                    }))
                  }
                  style={{ width: '100%', accentColor: trackColor, height: 4 }}
                />
              </div>
            ))}
          </div>
        );
      })()}

      {/* Music Enhancer Modal */}
      {showMusicEnhancer && (
        <MusicEnhancer 
          onCreateTrack={handleMusicEnhancerTrack}
          onClose={() => setShowMusicEnhancer(false)}
        />
      )}

      {/* Right-Click Context Menu */}
      <TimelineContextMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onCut={() => {
          const tc = contextMenu?.targetClip;
          const selectedClipObjects = tc
            ? tracks.flatMap((tr) =>
                tr.id === tc.trackId ? tr.clips.filter((c) => c.id === tc.clipId) : [],
              )
            : tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
          const { tracks: newTracks } = clipboardEditor.cut(selectedClipObjects, tracks);
          setTracks(newTracks);
          setSelectedClips([]);
          setSelectedBar(null);
          setContextMenu(null);
        }}
        onCopy={() => {
          const tc = contextMenu?.targetClip;
          const selectedClipObjects = tc
            ? tracks.flatMap((tr) =>
                tr.id === tc.trackId ? tr.clips.filter((c) => c.id === tc.clipId) : [],
              )
            : tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
          clipboardEditor.copy(selectedClipObjects, tracks);
          setContextMenu(null);
        }}
        onPaste={() => {
          const newTracks = clipboardEditor.paste(tracks, Math.round(playheadPos) || 0);
          setTracks(newTracks);
          setContextMenu(null);
        }}
        onDuplicate={() => {
          const tc = contextMenu?.targetClip;
          if (tc) {
            setTracks((prev) =>
              duplicateClipImmediatelyAfter(prev, tc.trackId, tc.clipId, ticksPerBar),
            );
          } else {
            const selectedClipObjects = tracks.flatMap(t => t.clips.filter(c => selectedClips.includes(String(c.id))));
            const newTracks = clipboardEditor.duplicate(tracks, selectedClipObjects);
            setTracks(newTracks);
          }
          setContextMenu(null);
        }}
        onSplit={() => {
          // Split clips at playhead
          const newTracks = tracks.map(track => ({
            ...track,
            clips: track.clips.flatMap(clip => {
              const playheadBar = Math.round(playheadPos);
              if (playheadBar > clip.bar && playheadBar < clip.bar + clip.len) {
                const splitPoint = playheadBar - clip.bar;
                return [
                  { ...clip, len: splitPoint },
                  { ...clip, id: globalClipId++, bar: playheadBar, len: clip.len - splitPoint }
                ];
              }
              return [clip];
            })
          }));
          setTracks(newTracks);
          setSelectedBar(null);
          setContextMenu(null);
        }}
        onDelete={() => {
          const tc = contextMenu?.targetClip;
          const ids = tc ? [String(tc.clipId)] : selectedClips;
          const newTracks = clipboardEditor.deleteClips(tracks, ids);
          setTracks(newTracks);
          setSelectedClips([]);
          setSelectedBar(null);
          setContextMenu(null);
        }}
        onUndo={() => {
          if (undoStack.length > 0) {
            const previousState = undoStack[undoStack.length - 1];
            setRedoStack([...redoStack, tracks]);
            setTracks(previousState);
            setUndoStack(undoStack.slice(0, -1));
          }
          setContextMenu(null);
        }}
        onRedo={() => {
          if (redoStack.length > 0) {
            const nextState = redoStack[redoStack.length - 1];
            setUndoStack([...undoStack, tracks]);
            setTracks(nextState);
            setRedoStack(redoStack.slice(0, -1));
          }
          setContextMenu(null);
        }}
        canPaste={clipboardEditor.clipboard !== null}
      />

    </div>
  );
}
