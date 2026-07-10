'use client';

import {
  applyFadeToClip,
  applySourceGainToClip,
  clampSourceGainDb,
  clipEditTimelineSpanSec,
  createClipEditFromBuffer,
  deleteClipById,
  findClipAtTimelineSec,
  formatSourceGainDb,
  splitClipAtTimelineSec,
  type MasteringBayClipEditState,
  type MasteringBayTimelineClip,
} from '@/app/lib/masteringBay/masteringBayClipEdit';
import type { MasteringBaySourcePreview } from '@/app/components/masteringBay/MasteringBayMiniWaveStrip';
import { MasteringBayTransportControls } from '@/app/components/masteringBay/MasteringBayTransportControls';
import {
  buildStereoWaveformPeaks,
  decodeMasteringBayAudioFile,
  formatSourceDuration,
  isMasteringBayAudioFile,
  MASTERING_BAY_AUDIO_ACCEPT,
  MASTERING_BAY_TIMELINE_DURATION_SEC,
  buildMasteringBayRulerTicks,
  masteringBayTimelineMinWidthPx,
  metaFromAudioBuffer,
  resolveMasteringBayTimelineDurationSec,
  secToTimelinePct,
  type MasteringBaySourceMeta,
  type MasteringBaySourcePayload,
  type StereoWaveformPeaks,
} from '@/app/lib/masteringBay/masteringBaySourceTrack';
import {
  renderMasteringBayWaveform,
  timelineXToSec,
} from '@/app/lib/masteringBay/masteringBayWaveformRender';
import type { MasteringBayTransport } from '@/app/hooks/useMasteringBayEngine';
import { useMasterClock } from '@/app/context/MasterClockContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type { MasteringBaySourcePayload };

type PointerMode = 'idle' | 'scrub' | 'fade-in' | 'fade-out' | 'clip-interact';
type ClipInteractSubMode = 'source-gain' | 'scrub' | null;

const GAIN_DRAG_DB_PER_PX = 0.2;

type Props = {
  onSourceLoaded?: (payload: MasteringBaySourcePayload) => void;
  onSourceCleared?: () => void;
  onPreviewChange?: (preview: MasteringBaySourcePreview | null) => void;
  transport?: MasteringBayTransport;
  onSeek?: (sec: number) => void;
  onScrubActive?: (active: boolean) => void;
  syncClipEdit?: (edit: MasteringBayClipEditState, activeClipId: string | null) => void;
  /** SE2 / external handoff — loads waveform + engine on mount. */
  initialSourcePayload?: MasteringBaySourcePayload | null;
  onInitialSourceConsumed?: () => void;
};

function formatRulerTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const HANDLE_HIT_PX = 8;

function SourceTrackTimeline({
  clipEdit,
  peaksByClipId,
  playheadSec,
  onSeek,
  onScrubActive,
  onClipEditChange,
  activeClipId,
  onActiveClipChange,
}: {
  clipEdit: MasteringBayClipEditState;
  peaksByClipId: Map<string, StereoWaveformPeaks>;
  playheadSec: number;
  onSeek: (sec: number) => void;
  onScrubActive?: (active: boolean) => void;
  onClipEditChange: (edit: MasteringBayClipEditState, activeClipId?: string | null) => void;
  activeClipId: string | null;
  onActiveClipChange: (id: string | null) => void;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{
    mode: PointerMode;
    subMode: ClipInteractSubMode;
    pointerId: number;
    captureEl: HTMLElement | null;
    clipId: string | null;
    startClientX: number;
    startClientY: number;
    startTimelineSec: number;
    startSourceGainDb: number;
    lastClientX: number;
    moved: boolean;
  }>({
    mode: 'idle',
    subMode: null,
    pointerId: -1,
    captureEl: null,
    clipId: null,
    startClientX: 0,
    startClientY: 0,
    startTimelineSec: 0,
    startSourceGainDb: 0,
    lastClientX: 0,
    moved: false,
  });
  const [width, setWidth] = useState(0);
  const [trackHeight, setTrackHeight] = useState(0);
  const [hoverHandle, setHoverHandle] = useState<'fade-in' | 'fade-out' | null>(null);
  const [gainDragClipId, setGainDragClipId] = useState<string | null>(null);

  const { clips } = clipEdit;
  const clipSpan = clipEditTimelineSpanSec(clipEdit);
  const dur = resolveMasteringBayTimelineDurationSec(clipSpan);
  const ticks = buildMasteringBayRulerTicks(dur);
  const timelineMinWidthPx = masteringBayTimelineMinWidthPx(dur);
  const playheadPct = secToTimelinePct(playheadSec, dur);

  const hitTest = useCallback(
    (clientX: number): { mode: PointerMode; clipId: string | null } => {
      const timeline = timelineRef.current;
      if (!timeline || clips.length === 0) return { mode: 'scrub', clipId: null };
      const trackW = Math.max(1, timeline.scrollWidth);
      const rect = timeline.getBoundingClientRect();
      const x = clientX - rect.left + timeline.scrollLeft;
      const tSec = (x / trackW) * dur;

      for (const clip of clips) {
        const clipStartPx = (clip.timelineStartSec / dur) * trackW;
        const visDur = Math.max(0.001, clip.trimEndSec - clip.trimStartSec);
        const clipW = (visDur / dur) * trackW;
        const clipEndPx = clipStartPx + clipW;
        if (x < clipStartPx - 2 || x > clipEndPx + 2) continue;
        if (clip.id === activeClipId) {
          const fadeInX = clipStartPx + (clip.fadeInSec / visDur) * clipW;
          const fadeOutX = clipEndPx - (clip.fadeOutSec / visDur) * clipW;
          if (Math.abs(x - fadeInX) <= HANDLE_HIT_PX) return { mode: 'fade-in', clipId: clip.id };
          if (Math.abs(x - fadeOutX) <= HANDLE_HIT_PX) return { mode: 'fade-out', clipId: clip.id };
          return { mode: 'clip-interact', clipId: clip.id };
        }
        return { mode: 'scrub', clipId: clip.id };
      }
      return { mode: 'scrub', clipId: findClipAtTimelineSec(clips, tSec)?.id ?? null };
    },
    [activeClipId, clips, dur],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      const sec = timelineXToSec(clientX, timeline, dur);
      onSeek(Math.max(0, Math.min(clipSpan || dur, sec)));
    },
    [clipSpan, dur, onSeek],
  );

  const endPointer = useCallback(
    (pointerId?: number) => {
      const p = pointerRef.current;
      if (p.mode === 'idle') return;
      if (pointerId != null && pointerId !== p.pointerId) return;
      try {
        p.captureEl?.releasePointerCapture(p.pointerId);
      } catch {
        /* released */
      }
      if (p.mode === 'scrub') onScrubActive?.(false);
      if (p.subMode === 'source-gain') setGainDragClipId(null);
      pointerRef.current = {
        mode: 'idle',
        subMode: null,
        pointerId: -1,
        captureEl: null,
        clipId: null,
        startClientX: 0,
        startClientY: 0,
        startTimelineSec: 0,
        startSourceGainDb: 0,
        lastClientX: 0,
        moved: false,
      };
      setHoverHandle(null);
    },
    [onScrubActive, seekFromClientX],
  );

  const updateClipEdit = useCallback(
    (next: MasteringBayClipEditState, activeId?: string | null) => {
      onClipEditChange(next, activeId);
    },
    [onClipEditChange],
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const p = pointerRef.current;
      const timeline = timelineRef.current;
      if (!timeline || p.mode === 'idle') return;

      const dx = clientX - p.startClientX;
      const dy = clientY - p.startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) p.moved = true;
      p.lastClientX = clientX;

      if (p.mode === 'clip-interact') {
        if (!p.subMode && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          p.subMode = Math.abs(dy) >= Math.abs(dx) ? 'source-gain' : 'scrub';
          if (p.subMode === 'scrub') onScrubActive?.(true);
          if (p.subMode === 'source-gain') setGainDragClipId(p.clipId);
        }
        if (p.subMode === 'scrub') {
          seekFromClientX(clientX);
          return;
        }
        if (p.subMode === 'source-gain') {
          const clipId = p.clipId;
          if (!clipId) return;
          const gainDb = clampSourceGainDb(
            p.startSourceGainDb + (p.startClientY - clientY) * GAIN_DRAG_DB_PER_PX,
          );
          const nextClips = clips.map((c) =>
            c.id === clipId ? applySourceGainToClip(c, gainDb) : c,
          );
          updateClipEdit({ ...clipEdit, clips: nextClips }, clipId);
          return;
        }
        return;
      }

      if (p.mode === 'scrub') {
        seekFromClientX(clientX);
        return;
      }

      const trackW = Math.max(1, timeline.scrollWidth);
      const rect = timeline.getBoundingClientRect();
      const x = clientX - rect.left + timeline.scrollLeft;
      const tSec = (x / trackW) * dur;
      const clipId = p.clipId;
      if (!clipId) return;
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      if (p.mode === 'fade-in') {
        const nextClips = clips.map((c) =>
          c.id === clipId ? applyFadeToClip(c, 'in', tSec) : c,
        );
        updateClipEdit({ ...clipEdit, clips: nextClips });
        return;
      }

      if (p.mode === 'fade-out') {
        const nextClips = clips.map((c) =>
          c.id === clipId ? applyFadeToClip(c, 'out', tSec) : c,
        );
        updateClipEdit({ ...clipEdit, clips: nextClips });
      }
    },
    [clipEdit, clips, dur, onScrubActive, seekFromClientX, updateClipEdit],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerRef.current.pointerId) return;
      handlePointerMove(e.clientX, e.clientY);
    };
    const onEnd = (e: PointerEvent) => endPointer(e.pointerId);
    const onBlur = () => endPointer();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onBlur);
    };
  }, [endPointer, handlePointerMove]);

  useEffect(() => {
    const timelineEl = timelineRef.current;
    const bodyEl = bodyRef.current;
    if (!timelineEl || !bodyEl) return;
    const ro = new ResizeObserver(() => {
      setWidth(Math.floor(timelineEl.clientWidth));
      setTrackHeight(Math.floor(bodyEl.clientHeight));
    });
    ro.observe(timelineEl);
    ro.observe(bodyEl);
    setWidth(Math.floor(timelineEl.clientWidth));
    setTrackHeight(Math.floor(bodyEl.clientHeight));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || trackHeight <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderMasteringBayWaveform(canvas, {
      width,
      height: trackHeight,
      dpr,
      timelineDurSec: dur,
      ticks,
      clips,
      peaksByClipId,
      activeClipId,
      hoverHandle,
      playheadSec,
    });
  }, [
    activeClipId,
    clips,
    dur,
    hoverHandle,
    peaksByClipId,
    playheadSec,
    ticks,
    timelineMinWidthPx,
    trackHeight,
    width,
  ]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    endPointer();

    const hit = hitTest(e.clientX);
    const mode: PointerMode = hit.mode;

    const clip = hit.clipId ? clips.find((c) => c.id === hit.clipId) : null;
    if (clip) onActiveClipChange(clip.id);

    pointerRef.current = {
      mode,
      subMode: null,
      pointerId: e.pointerId,
      captureEl: e.currentTarget as HTMLElement,
      clipId: hit.clipId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTimelineSec: clip?.timelineStartSec ?? 0,
      startSourceGainDb: clip?.sourceGainDb ?? 0,
      lastClientX: e.clientX,
      moved: false,
    };

    if (mode === 'scrub') {
      onScrubActive?.(true);
      seekFromClientX(e.clientX);
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mb-source-track__timeline-scroll">
      <div
        className="mb-source-track__timeline"
        ref={timelineRef}
        style={{ minWidth: timelineMinWidthPx }}
      >
          <div
            className="mb-source-track__ruler mb-source-track__scrub-surface"
            aria-hidden
            onPointerDown={onPointerDown}
            onLostPointerCapture={(e) => endPointer(e.pointerId)}
          >
            {ticks.map(({ sec: t, major: isMajor }) => {
              const xPct = (t / dur) * 100;
              return (
                <div
                  key={t}
                  className={`mb-source-track__ruler-tick${isMajor ? ' mb-source-track__ruler-tick--major' : ''}`}
                  style={{ left: `${xPct}%` }}
                >
                  {isMajor && t <= dur ? (
                    <span className="mb-source-track__ruler-label">{formatRulerTime(t)}</span>
                  ) : null}
                </div>
              );
            })}
            <span className="mb-source-track__ruler-end" aria-hidden>
              {formatRulerTime(dur)}
            </span>
            <div
              className="mb-source-track__playhead mb-source-track__playhead--ruler"
              style={{ left: `${playheadPct}%` }}
              aria-hidden
            />
          </div>
          <div
            className={`mb-source-track__body mb-source-track__scrub-surface${gainDragClipId ? ' mb-source-track__body--gain-drag' : ''}`}
            ref={bodyRef}
            onPointerDown={onPointerDown}
            onLostPointerCapture={(e) => endPointer(e.pointerId)}
            onPointerMove={(e) => {
              const hit = hitTest(e.clientX);
              if (hit.mode === 'fade-in') setHoverHandle('fade-in');
              else if (hit.mode === 'fade-out') setHoverHandle('fade-out');
              else if (hit.mode === 'clip-interact') setHoverHandle(null);
              else setHoverHandle(null);
            }}
          >
            <canvas ref={canvasRef} className="mb-source-track__canvas" aria-hidden />
            <div
              className="mb-source-track__playhead"
              style={{ left: `${playheadPct}%` }}
              role="slider"
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={Math.floor(clipSpan)}
              aria-valuenow={Math.floor(playheadSec)}
              tabIndex={0}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 1 : 0.1;
                const maxSec = Math.max(0.001, clipSpan);
                if (e.key === 'ArrowLeft') onSeek(Math.max(0, playheadSec - step));
                if (e.key === 'ArrowRight') onSeek(Math.min(maxSec, playheadSec + step));
                if (e.key === 's' || e.key === 'S') {
                  e.preventDefault();
                  document.dispatchEvent(new CustomEvent('mb-source-split'));
                }
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  document.dispatchEvent(new CustomEvent('mb-source-erase'));
                }
              }}
            >
              <span className="mb-source-track__playhead-cap" aria-hidden />
            </div>
          </div>
        </div>
      </div>
  );
}

export function MasteringBaySourceTrack({
  onSourceLoaded,
  onSourceCleared,
  onPreviewChange,
  transport,
  onSeek: onSeekExternal,
  onScrubActive,
  syncClipEdit,
  initialSourcePayload = null,
  onInitialSourceConsumed,
}: Props) {
  const useEngineTransport = transport != null;
  const bufferRef = useRef<AudioBuffer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<MasteringBaySourceMeta | null>(null);
  const [clipEdit, setClipEdit] = useState<MasteringBayClipEditState | null>(null);
  const [peaksByClipId, setPeaksByClipId] = useState<Map<string, StereoWaveformPeaks>>(new Map());
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const activeClipIdRef = useRef<string | null>(null);
  activeClipIdRef.current = activeClipId;
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = useState(0);

  const displayPlayhead = useEngineTransport ? transport.playheadSec : playheadSec;
  const displayPlaying = useEngineTransport ? transport.isPlaying : false;

  const { getOrCreateAudioContext } = useMasterClock();

  const rebuildPeaks = useCallback((clips: MasteringBayTimelineClip[]) => {
    const map = new Map<string, StereoWaveformPeaks>();
    for (const c of clips) {
      map.set(c.id, buildStereoWaveformPeaks(c.buffer, 480));
    }
    setPeaksByClipId(map);
  }, []);

  const applyClipEdit = useCallback(
    (next: MasteringBayClipEditState, activeId?: string | null) => {
      setClipEdit(next);
      rebuildPeaks(next.clips);
      syncClipEdit?.(next, activeId ?? activeClipIdRef.current);
    },
    [rebuildPeaks, syncClipEdit],
  );

  useEffect(() => {
    if (!clipEdit) {
      onPreviewChange?.(null);
      return;
    }
    onPreviewChange?.({ clipEdit, peaksByClipId });
  }, [clipEdit, onPreviewChange, peaksByClipId]);

  const loadBuffer = useCallback(
    async (buffer: AudioBuffer, nextMeta: MasteringBaySourceMeta) => {
      if (useEngineTransport) transport.onStop();
      bufferRef.current = buffer;
      const edit = createClipEditFromBuffer(buffer);
      setMeta(nextMeta);
      setActiveClipId(edit.clips[0]?.id ?? null);
      applyClipEdit(edit);
      if (!useEngineTransport) setPlayheadSec(0);
      setError(null);
      onSourceLoaded?.({ meta: nextMeta, buffer });
    },
    [applyClipEdit, onSourceLoaded, transport, useEngineTransport],
  );

  useEffect(() => {
    if (!initialSourcePayload) return;
    void loadBuffer(initialSourcePayload.buffer, initialSourcePayload.meta).then(() => {
      onInitialSourceConsumed?.();
    });
  }, [initialSourcePayload, loadBuffer, onInitialSourceConsumed]);

  const loadFile = useCallback(
    async (file: File) => {
      if (!isMasteringBayAudioFile(file)) {
        setError('Drop a WAV, MP3, or other audio file.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const ctx = getOrCreateAudioContext();
        const buffer = await decodeMasteringBayAudioFile(file, ctx);
        const nextMeta = metaFromAudioBuffer(buffer, file.name, 'file');
        await loadBuffer(buffer, nextMeta);
      } catch {
        setError('Could not read that audio file.');
      } finally {
        setBusy(false);
      }
    },
    [getOrCreateAudioContext, loadBuffer],
  );

  const clearSource = useCallback(() => {
    bufferRef.current = null;
    setMeta(null);
    setClipEdit(null);
    setPeaksByClipId(new Map());
    setActiveClipId(null);
    setPlayheadSec(0);
    setError(null);
    onSourceCleared?.();
    onPreviewChange?.(null);
  }, [onPreviewChange, onSourceCleared]);

  const seekTo = useCallback(
    (sec: number) => {
      if (displayPlaying && useEngineTransport) transport.onStop();
      if (onSeekExternal) onSeekExternal(sec);
      else setPlayheadSec(sec);
    },
    [displayPlaying, onSeekExternal, transport, useEngineTransport],
  );

  const splitAtPlayhead = useCallback(() => {
    if (!clipEdit || clipEdit.clips.length === 0) return;
    const clip = findClipAtTimelineSec(clipEdit.clips, displayPlayhead);
    if (!clip) {
      setError('Move the playhead inside a clip to split.');
      return;
    }
    const pair = splitClipAtTimelineSec(clip, displayPlayhead);
    if (!pair) {
      setError('Move the playhead away from clip edges to split.');
      return;
    }
    const [left, right] = pair;
    const nextClips = clipEdit.clips.flatMap((c) => (c.id === clip.id ? [left, right] : [c]));
    applyClipEdit({ ...clipEdit, clips: nextClips });
    setActiveClipId(right.id);
    setError(null);
  }, [applyClipEdit, clipEdit, displayPlayhead]);

  const eraseSelectedClip = useCallback(() => {
    if (!clipEdit || clipEdit.clips.length === 0) return;
    let targetId = activeClipId;
    if (!targetId) {
      targetId = findClipAtTimelineSec(clipEdit.clips, displayPlayhead)?.id ?? null;
    }
    if (!targetId) {
      setError('Click a clip to select it, then erase.');
      return;
    }
    const deletedIdx = clipEdit.clips.findIndex((c) => c.id === targetId);
    const next = deleteClipById(clipEdit, targetId);
    if (!next) {
      clearSource();
      return;
    }
    applyClipEdit(next);
    const pickIdx = Math.min(deletedIdx, next.clips.length - 1);
    setActiveClipId(next.clips[pickIdx]?.id ?? null);
    const newSpan = clipEditTimelineSpanSec(next);
    if (displayPlayhead > newSpan) seekTo(Math.max(0, newSpan));
    setError(null);
  }, [activeClipId, applyClipEdit, clearSource, clipEdit, displayPlayhead, seekTo]);

  useEffect(() => {
    const onSplit = () => splitAtPlayhead();
    document.addEventListener('mb-source-split', onSplit);
    return () => document.removeEventListener('mb-source-split', onSplit);
  }, [splitAtPlayhead]);

  useEffect(() => {
    const onErase = () => eraseSelectedClip();
    document.addEventListener('mb-source-erase', onErase);
    return () => document.removeEventListener('mb-source-erase', onErase);
  }, [eraseSelectedClip]);

  useEffect(() => {
    if (meta == null || clipEdit == null || displayPlaying) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('mb-source-erase'));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [clipEdit, displayPlaying, meta]);

  const hasSource = meta != null && clipEdit != null;
  const clipSpan = useMemo(
    () => (clipEdit ? clipEditTimelineSpanSec(clipEdit) : 0),
    [clipEdit],
  );
  const activeClipGainLabel = useMemo(() => {
    if (!clipEdit || !activeClipId) return null;
    const clip = clipEdit.clips.find((c) => c.id === activeClipId);
    if (!clip || Math.abs(clip.sourceGainDb ?? 0) < 0.05) return null;
    return formatSourceGainDb(clip.sourceGainDb);
  }, [activeClipId, clipEdit]);

  return (
    <section
      className={`mb-source-track${dragOver ? ' mb-source-track--drag' : ''}${hasSource ? ' mb-source-track--loaded' : ''}${displayPlaying ? ' mb-source-track--playing' : ''}`}
      aria-label="Stereo source track"
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void loadFile(file);
      }}
    >
      <div className="mb-source-track__head">
        <div className="mb-source-track__head-left">
          <span className="mb-source-track__badge">STEREO</span>
          <strong className="mb-source-track__title">
            {hasSource ? meta.name : 'Source track'}
          </strong>
          {hasSource ? (
            <span className="mb-source-track__meta">
              {formatSourceDuration(clipSpan)}
              {' / '}
              <span className="mb-source-track__timeline-span">
                {formatSourceDuration(MASTERING_BAY_TIMELINE_DURATION_SEC)}
              </span>
              {' · '}
              {clipEdit!.clips.length} clip{clipEdit!.clips.length === 1 ? '' : 's'}
              {' · '}
              <span className="mb-source-track__playhead-time">{formatRulerTime(displayPlayhead)}</span>
              {activeClipGainLabel ? (
                <>
                  {' · '}
                  <span className="mb-source-track__clip-gain" title="Pre-master input gain">
                    {activeClipGainLabel}
                  </span>
                </>
              ) : null}
            </span>
          ) : (
            <span className="mb-source-track__meta">
              <span className="mb-source-track__timeline-span">
                {formatSourceDuration(MASTERING_BAY_TIMELINE_DURATION_SEC)} timeline
              </span>
            </span>
          )}
        </div>
        <div className="mb-source-track__actions">
          {useEngineTransport && transport ? (
            <MasteringBayTransportControls transport={transport} hasSource={hasSource} />
          ) : null}
          <button
            type="button"
            className="mb-source-track__btn mb-source-track__btn--cut"
            disabled={!hasSource || displayPlaying}
            onClick={splitAtPlayhead}
            title="Split at playhead (S)"
          >
            Split
          </button>
          <button
            type="button"
            className="mb-source-track__btn mb-source-track__btn--erase"
            disabled={!hasSource || displayPlaying}
            onClick={eraseSelectedClip}
            title="Erase selected clip (Del)"
          >
            Erase
          </button>
          <button
            type="button"
            className="mb-source-track__btn"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy ? 'Loading…' : 'Browse'}
          </button>
          <button
            type="button"
            className="mb-source-track__btn mb-source-track__btn--ghost"
            disabled={!hasSource}
            onClick={clearSource}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mb-source-track__lanes">
        {hasSource && clipEdit ? (
          <SourceTrackTimeline
            clipEdit={clipEdit}
            peaksByClipId={peaksByClipId}
            playheadSec={displayPlayhead}
            onSeek={seekTo}
            onScrubActive={onScrubActive}
            onClipEditChange={applyClipEdit}
            activeClipId={activeClipId}
            onActiveClipChange={setActiveClipId}
          />
        ) : (
          <div className="mb-source-track__timeline-scroll">
            <div className="mb-source-track__empty">
              <p>Drop WAV, MP3, FLAC, or any audio here</p>
              <span>Click clip · Drag up/down for input gain · Split (S) · Erase (Del)</span>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mb-source-track__error" role="alert">{error}</p>}

      {/* Detached bottom wood lip — scrolls with source track, not the outer frame. */}
      <div className="mb-source-track__wood-foot" aria-hidden />

      <input
        ref={fileInputRef}
        type="file"
        className="mb-source-track__file-input"
        accept={MASTERING_BAY_AUDIO_ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void loadFile(file);
          e.target.value = '';
        }}
      />
    </section>
  );
}
