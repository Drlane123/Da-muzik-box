'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { MasteringBayClipEditState } from '@/app/lib/masteringBay/masteringBayClipEdit';
import { clipEditTimelineSpanSec } from '@/app/lib/masteringBay/masteringBayClipEdit';
import {
  resolveMasteringBayTimelineDurationSec,
  type StereoWaveformPeaks,
} from '@/app/lib/masteringBay/masteringBaySourceTrack';
import { renderMasteringBayMiniWaveform } from '@/app/lib/masteringBay/masteringBayWaveformRender';

export type MasteringBaySourcePreview = {
  clipEdit: MasteringBayClipEditState;
  peaksByClipId: Map<string, StereoWaveformPeaks>;
};

type Props = {
  preview: MasteringBaySourcePreview | null;
  playheadSec: number;
  /** Scrub / seek playhead by clicking or dragging on the mini wave. */
  onSeek?: (sec: number) => void;
};

export function MasteringBayMiniWaveStrip({ preview, playheadSec, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const previewRef = useRef(preview);
  const onSeekRef = useRef(onSeek);
  previewRef.current = preview;
  onSeekRef.current = onSeek;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !preview) return;

    const paint = () => {
      const w = Math.max(1, Math.floor(wrap.clientWidth));
      const h = Math.max(1, Math.floor(wrap.clientHeight));
      const span = clipEditTimelineSpanSec(preview.clipEdit);
      const dur = resolveMasteringBayTimelineDurationSec(span);
      renderMasteringBayMiniWaveform(canvas, {
        width: w,
        height: h,
        timelineDurSec: dur,
        clips: preview.clipEdit.clips,
        peaksByClipId: preview.peaksByClipId,
        playheadSec,
      });
    };

    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [playheadSec, preview]);

  const seekFromClientX = useCallback((clientX: number) => {
    const wrap = wrapRef.current;
    const prev = previewRef.current;
    const seek = onSeekRef.current;
    if (!wrap || !prev || !seek) return;
    const rect = wrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const span = clipEditTimelineSpanSec(prev.clipEdit);
    const dur = resolveMasteringBayTimelineDurationSec(span);
    const sec = (x / Math.max(1, rect.width)) * dur;
    seek(Math.max(0, Math.min(dur, sec)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!preview || !onSeek || e.button !== 0) return;
    e.preventDefault();
    scrubbingRef.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    seekFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    seekFromClientX(e.clientX);
  };

  const endScrub = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  if (!preview) {
    return (
      <div className="mb-mini-wave mb-mini-wave--empty" aria-hidden>
        <span>No source</span>
      </div>
    );
  }

  return (
    <div
      className={`mb-mini-wave${onSeek ? ' mb-mini-wave--scrub' : ''}`}
      ref={wrapRef}
      role="slider"
      aria-label="Source playhead"
      aria-valuemin={0}
      aria-valuemax={Math.floor(clipEditTimelineSpanSec(preview.clipEdit))}
      aria-valuenow={Math.floor(playheadSec)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endScrub}
      onPointerCancel={endScrub}
      onKeyDown={(e) => {
        if (!onSeek) return;
        const span = clipEditTimelineSpanSec(preview.clipEdit);
        const dur = resolveMasteringBayTimelineDurationSec(span);
        const step = e.shiftKey ? 1 : 0.1;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onSeek(Math.max(0, playheadSec - step));
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onSeek(Math.min(dur, playheadSec + step));
        }
      }}
    >
      <canvas ref={canvasRef} className="mb-mini-wave__canvas" aria-hidden />
    </div>
  );
}
