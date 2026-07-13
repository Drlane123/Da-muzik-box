/**
 * WaveformEditor — clip overview + loop tools (no canvas waveform).
 * - H+V zoom, razor cuts, ruler loop selection, playhead sync to master clock
 */
import { useRef, useState, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { useMasterClock } from '@/app/context/MasterClockContext';

import { ZoomIn, ZoomOut, Scissors, MousePointer, Repeat } from 'lucide-react';

import LoopMarkersBrace, { LoopVerticalGuides } from './LoopMarkersBrace';


interface WaveformEditorClip {
  id: number;
  bar: number;
  len: number;
  label: string;
  trackColor: string;
  trackType: string;
}


interface WaveformEditorProps {
  clips: WaveformEditorClip[];
  colW: number;         // pixels per bar at zoom=1
  totalBars: number;
  trackColor: string;
  trackName: string;
  onClose?: () => void;
}


export default function WaveformEditor({
  clips, colW, totalBars, trackColor, trackName, onClose,
}: WaveformEditorProps) {
  const {
    positionTicks,
    ppq,
    ticksPerBar,
    transport,
    loopEnabled, loopStartBar, loopBars,
    loopSection,
    setLoopRange,
    quantize,
    subscribeTransportBeatUi,
    getTransportBeatUiSnapshot,
  } = useMasterClock();

  const [hZoom, setHZoom] = useState(1);
  const [vZoom, setVZoom] = useState(1);
  const [tool, setTool] = useState<'pointer' | 'razor'>('pointer');
  const [cuts, setCuts] = useState<Record<number, { x: number }[]>>({});

  // Loop selection drag
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  /** Reliable range on mouseup (React state can lag behind last pointermove). */
  const selectionDragRef = useRef<{ start: number; end: number } | null>(null);

  const barW = colW * hZoom;
  const timelineW = barW * totalBars;
  const trackH = Math.round(72 * Math.min(vZoom, 4));
  /** Exact quarters/bar — must match Studio (`ticksPerBar / ppq`), not `round(quartersPerBar)`. */
  const qpb = Math.max(1e-9, ticksPerBar / ppq);
  const transportFrameSeq = useSyncExternalStore(
    subscribeTransportBeatUi,
    () => getTransportBeatUiSnapshot().frameSeq,
    () => 0,
  );
  const absBeat = useMemo(() => {
    if (transport === 'playing' || transport === 'recording') {
      return Math.max(0, getTransportBeatUiSnapshot().studioTimelineBeatFloat);
    }
    return Math.max(0, positionTicks / ppq);
  }, [transport, positionTicks, ppq, transportFrameSeq]);
  /** Continuous 0-based bar phase for playhead X — same `studioTimelineBeatFloat` as Studio (metronome + click-latency). */
  const playheadLeftPx = (absBeat / qpb) * barW;

  // Snap fraction to quantize grid
  function snapToGrid(fraction: number, clipLen: number): number {
    const divs = quantize === '1/16T' ? 48 : quantize === '1/32' ? 32 : quantize === '1/16' ? 16 : quantize === '1/8' ? 8 : 4;
    const steps = clipLen * divs;
    return Math.round(fraction * steps) / steps;
  }

  function handleCut(clipId: number, clipLen: number, fraction: number) {
    const snapped = snapToGrid(fraction, clipLen);
    setCuts(prev => ({ ...prev, [clipId]: [...(prev[clipId] ?? []), { x: snapped }] }));
  }

  function commitLoopRange(barA: number, barB: number) {
    const start = Math.min(barA, barB);
    const rawLen = Math.abs(barB - barA) + 1;
    const options = [2, 4, 8, 16, 32, 64];
    const snappedLen = options.reduce((prev, cur) => Math.abs(cur - rawLen) < Math.abs(prev - rawLen) ? cur : prev);
    setLoopRange(start, start + snappedLen - 1, loopSection ?? undefined);
    setSelStart(null);
    setSelEnd(null);
    selectionDragRef.current = null;
  }

  const clearRulerSelection = useCallback(() => {
    setIsDragging(false);
    setSelStart(null);
    setSelEnd(null);
    selectionDragRef.current = null;
  }, []);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return;
      const t = ev.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      clearRulerSelection();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearRulerSelection]);

  // Drag-select loop region on ruler
  function onRulerMouseDown(e: React.MouseEvent) {
    if (tool !== 'pointer') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const bar = Math.max(1, Math.floor((e.clientX - rect.left) / barW) + 1);
    selectionDragRef.current = { start: bar, end: bar };
    setSelStart(bar); setSelEnd(bar); setIsDragging(true);
  }
  function onRulerMouseMove(e: React.MouseEvent) {
    if (!isDragging || selectionDragRef.current === null) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const bar = Math.max(1, Math.ceil((e.clientX - rect.left) / barW));
    selectionDragRef.current.end = bar;
    setSelEnd(bar);
  }
  function onRulerMouseUp() {
    if (!isDragging) return;
    setIsDragging(false);
    const r = selectionDragRef.current;
    selectionDragRef.current = null;
    if (r) commitLoopRange(r.start, r.end);
  }

  const selMin = selStart !== null && selEnd !== null ? Math.min(selStart, selEnd) : null;
  const selMax = selStart !== null && selEnd !== null ? Math.max(selStart, selEnd) : null;

  return (
    <div className="flex flex-col flex-1" style={{ background: '#2a2a2a', border: '1px solid #303030', borderRadius: 8, minHeight: 0 }}>
      {/* Editor toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 flex-wrap" style={{ background: '#2c2c2c', borderBottom: '1px solid #2c2c2c', borderRadius: '8px 8px 0 0', gap: '8px' }}>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: trackColor }} />
        <span className="text-xs font-bold" style={{ color: trackColor }}>{trackName} — Waveform Editor</span>

        <div className="w-px h-4 mx-1" style={{ background: '#2a2a2a' }} />

        {/* Tool selector */}
        <button onClick={() => setTool('pointer')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
          style={{ background: tool === 'pointer' ? '#1a1a2a' : '#242424', color: tool === 'pointer' ? '#00E5FF' : '#555', border: `1px solid ${tool === 'pointer' ? '#00E5FF44' : '#222'}` }}>
          <MousePointer size={10} /> Select
        </button>
        <button onClick={() => setTool('razor')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
          style={{ background: tool === 'razor' ? '#ff444422' : '#242424', color: tool === 'razor' ? '#ff4444' : '#555', border: `1px solid ${tool === 'razor' ? '#ff444444' : '#222'}` }}>
          <Scissors size={10} /> Razor
        </button>

        <div className="w-px h-4 mx-1" style={{ background: '#2a2a2a' }} />

        {/* H Zoom */}
        <span className="text-xs" style={{ color: '#555' }}>H</span>
        <button onClick={() => setHZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="w-5 h-5 flex items-center justify-center rounded" style={{ background: '#242424', color: '#666' }}><ZoomOut size={10} /></button>
        <span className="text-xs font-mono w-8 text-center" style={{ color: '#00E5FF' }}>{hZoom.toFixed(1)}x</span>
        <button onClick={() => setHZoom(z => Math.min(8, +(z + 0.25).toFixed(2)))} className="w-5 h-5 flex items-center justify-center rounded" style={{ background: '#242424', color: '#666' }}><ZoomIn size={10} /></button>

        {/* V Zoom */}
        <span className="text-xs ml-1" style={{ color: '#555' }}>V</span>
        <button onClick={() => setVZoom(z => Math.max(1, +(z - 0.25).toFixed(2)))} className="w-5 h-5 flex items-center justify-center rounded" style={{ background: '#242424', color: '#666' }}><ZoomOut size={10} /></button>
        <span className="text-xs font-mono w-8 text-center" style={{ color: '#D500F9' }}>{vZoom.toFixed(1)}x</span>
        <button onClick={() => setVZoom(z => Math.min(8, +(z + 0.25).toFixed(2)))} className="w-5 h-5 flex items-center justify-center rounded" style={{ background: '#242424', color: '#666' }}><ZoomIn size={10} /></button>

        {/* Loop from selection */}
        {selMin !== null && selMax !== null && (
          <button
            type="button"
            onClick={() => selStart !== null && selEnd !== null && commitLoopRange(selStart, selEnd)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ml-1"
            style={{ background: '#00E5FF22', color: '#00E5FF', border: '1px solid #00E5FF55' }}
          >
            <Repeat size={10} /> Set Loop
          </button>
        )}

        {onClose && (
          <button onClick={onClose} className="ml-auto px-2 py-1 rounded text-xs" style={{ color: '#555' }}>✕ Close</button>
        )}
      </div>

      {/* Timeline area */}
      <div className="flex-1 overflow-auto min-h-0" style={{ background: '#2a2a2a' }}
        onMouseMove={onRulerMouseMove} onMouseUp={onRulerMouseUp}>
        <div ref={timelineRef} style={{ width: timelineW, position: 'relative' }}>
          {/* Ruler with drag-select */}
          <div className="sticky top-0 z-10 flex relative" style={{ height: 28, background: '#1c1c1c', borderBottom: '1px solid #2c2c2c' }}
            onMouseDown={onRulerMouseDown}>
            {Array.from({ length: totalBars }, (_, i) => {
              const bar = i + 1;
              const inSel = selMin !== null && selMax !== null && bar >= selMin && bar <= selMax;
              return (
                <div key={i} className="absolute flex items-end justify-start pb-1 pl-0.5 select-none"
                  style={{
                    left: i * barW, width: barW, height: 28,
                    background: inSel ? 'rgba(0,229,255,0.18)' : 'transparent',
                    borderLeft: `1px solid ${i % 4 === 0 ? '#2a2a2a' : '#242424'}`,
                    color: inSel ? '#00E5FF' : '#444',
                    fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold',
                    cursor: tool === 'pointer' ? 'col-resize' : 'default',
                  }}>
                  {i + 1}
                </div>
              );
            })}

            <LoopMarkersBrace
              visible={loopEnabled}
              leftPx={(loopStartBar - 1) * barW}
              widthPx={loopBars * barW}
              height={28}
              variant="purple"
              zIndex={12}
            />

            {/* Playhead on ruler */}
            <div className="absolute top-0 h-full pointer-events-none"
              style={{ left: playheadLeftPx, width: 1.5, background: '#D500F9', boxShadow: '0 0 6px #D500F9', zIndex: 20 }} />
          </div>

          {/* Clip overview row (no canvas waveform — avoids visual noise; razor still works on clip blocks). */}
          <div
            style={{ height: trackH, position: 'relative', background: '#060606' }}
            onMouseDown={(e) => {
              if (tool !== 'pointer') return;
              if ((e.target as HTMLElement).closest('[data-wf-clip-block="1"]')) return;
              clearRulerSelection();
            }}
          >
            {/* Grid lines */}
            {Array.from({ length: totalBars }, (_, i) => (
              <div key={i} className="absolute top-0 h-full" style={{ left: i * barW, width: 1, background: i % 4 === 0 ? '#2c2c2c' : '#0d0d0d' }} />
            ))}

            <LoopVerticalGuides
              visible={loopEnabled}
              leftPx={(loopStartBar - 1) * barW}
              widthPx={loopBars * barW}
              height={trackH}
              zIndex={6}
            />

            {clips.map(clip => {
              const clipW = Math.max(4, clip.len * barW - 2);
              const clipLeft = (clip.bar - 1) * barW + 1;
              const clipStartBeat = (clip.bar - 1) * qpb;
              const clipLenBeats = clip.len * qpb;
              const clipEndBeatEx = clipStartBeat + clipLenBeats;
              const phFrac =
                absBeat >= clipStartBeat && absBeat < clipEndBeatEx
                  ? (absBeat - clipStartBeat) / clipLenBeats
                  : undefined;
              return (
                <div
                  key={clip.id}
                  data-wf-clip-block="1"
                  className="absolute top-1 rounded overflow-hidden select-none"
                  style={{
                    left: clipLeft,
                    width: clipW,
                    height: trackH - 8,
                    cursor: tool === 'razor' ? 'crosshair' : 'default',
                    border: `1px solid ${clip.trackColor}55`,
                    background: `linear-gradient(180deg, ${clip.trackColor}28, ${clip.trackColor}0d)`,
                    boxSizing: 'border-box',
                  }}
                  onClick={(e) => {
                    if (tool !== 'razor') return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const fraction = (e.clientX - rect.left) / rect.width;
                    handleCut(clip.id, clip.len, fraction);
                  }}
                >
                  {(cuts[clip.id] ?? []).map((cut, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: `${cut.x * 100}%`,
                        width: 2,
                        marginLeft: -1,
                        background: 'rgba(248,113,113,0.95)',
                        boxShadow: '0 0 4px rgba(248,113,113,0.6)',
                        zIndex: 2,
                      }}
                      title="Cut"
                    />
                  ))}
                  {phFrac !== undefined && phFrac >= 0 && phFrac <= 1 ? (
                    <div
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: `${phFrac * 100}%`,
                        width: 2,
                        marginLeft: -1,
                        background: '#D500F9',
                        boxShadow: '0 0 6px #D500F9',
                        zIndex: 3,
                      }}
                    />
                  ) : null}
                  <span
                    className="absolute bottom-0.5 left-1 font-mono font-bold pointer-events-none"
                    style={{ fontSize: 8, color: clip.trackColor, textShadow: '0 0 4px #000' }}
                  >
                    {clip.label}
                  </span>
                </div>
              );
            })}

            {/* Global playhead line */}
            <div className="absolute top-0 h-full pointer-events-none"
              style={{ left: playheadLeftPx, width: 1.5, background: '#D500F9', boxShadow: '0 0 8px #D500F9', zIndex: 20 }} />
          </div>

          <div className="px-3 py-1" style={{ background: '#060606', borderTop: '1px solid #242424' }}>
            <span className="text-[9px] font-mono" style={{ color: '#555' }}>
              Clip blocks · Razor tool adds cut markers
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
