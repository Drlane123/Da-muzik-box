import { useState, useRef, useEffect, useCallback } from 'react';

import { Radio, Plus, VolumeX, Lock, Trash2, Send, ZoomIn, ZoomOut, Scissors, MousePointer, ChevronUp, ChevronDown, Mic } from 'lucide-react';

import { useMasterClock, STEPS_PER_BAR } from '@/app/context/MasterClockContext';

import { useView } from '@/app/context/ViewContext';

import { useTrackManager } from '@/app/lib/trackManager';

import WaveformClip from '@/app/components/WaveformClip';

import WaveformEditor from '@/app/components/WaveformEditor';

import ResizablePanel from '@/app/components/ResizablePanel';

import ProMeter from '@/app/components/ProMeter';

import { MusicEnhancer } from '@/app/screens/components/MusicEnhancer';


type TrackType = 'MIDI' | 'Audio' | 'Drum' | 'Bus' | 'Vocal';


interface Clip { id: number; bar: number; len: number; label: string; }

interface Track {
  id: number; name: string; type: TrackType; color: string;
  muted: boolean; solo: boolean; locked: boolean; volume: number; clips: Clip[];
  audioTrack?: number; // Maps to global track pool (18+)
}


const TYPE_COLORS: Record<TrackType, string> = {
  MIDI: '#00E5FF', Audio: '#00ff88', Drum: '#D500F9', Bus: '#ffcc00', Vocal: '#ff6b35',
};


let globalClipId = 100;

function mkClip(bar: number, len: number, label: string): Clip {
  return { id: globalClipId++, bar, len, label };
}


const INITIAL_TRACKS: Track[] = [
  { id: 1, name: 'Kick & Drums', type: 'Drum',  color: '#D500F9', muted: false, solo: false, locked: false, volume: 80, clips: [mkClip(1,4,'Beat 1'), mkClip(5,4,'Beat 2')] },
  { id: 2, name: 'Bass Line',    type: 'MIDI',  color: '#00E5FF', muted: false, solo: false, locked: false, volume: 75, clips: [mkClip(1,8,'Bass A')] },
  { id: 3, name: 'Lead Melody',  type: 'MIDI',  color: '#00ff88', muted: false, solo: false, locked: false, volume: 70, clips: [mkClip(3,4,'Melody 1'), mkClip(9,4,'Melody 2')] },
  { id: 4, name: 'AI Vocal 1',   type: 'Vocal', color: '#ff6b35', muted: false, solo: false, locked: false, volume: 85, clips: [mkClip(5,8,'Verse 1')] },
  { id: 5, name: 'FX Bus',       type: 'Bus',   color: '#ffcc00', muted: false, solo: false, locked: false, volume: 65, clips: [] },
];


function resolveClipCollisions(clips: Clip[]): Clip[] {
  const sorted = [...clips].sort((a, b) => a.bar - b.bar);
  const result: Clip[] = [];
  for (const clip of sorted) {
    const last = result[result.length - 1];
    result.push(last && clip.bar < last.bar + last.len ? { ...clip, bar: last.bar + last.len } : { ...clip });
  }
  return result;
}


export default function StudioEditorScreen({ onExport }: { onExport: (dest: string) => void }) {
  const {
    currentBar, currentTick, transport, bpm, currentMeasure, channelLevels, channelVolumes, setChannelVolume,
  } = useMasterClock();
  const { globalZoom, setGlobalZoom, globalVZoom, setGlobalVZoom, studioHeight, setStudioHeight, selectedBar, setSelectedBar } = useView();
  const trackManager = useTrackManager('studio-editor');

  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS.map(t => ({
    ...t,
    audioTrack: trackManager.getNextTrack(),
  })));
  const [tool, setTool] = useState<'pointer' | 'razor'>('pointer');
  const [editorTrack, setEditorTrack] = useState<Track | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [mixerOpen, setMixerOpen] = useState(true);
  const [mixerHeight] = useState(320);
  const [trackPans, setTrackPans] = useState<Record<number, number>>(Object.fromEntries(tracks.map(t => [t.id, 0])));

  const [draggingClip, setDraggingClip] = useState<{ trackId: number; clipId: number } | null>(null);
  const dragStartXRef = useRef(0);
  const dragOrigBarRef = useRef(0);
  const [shadowBar, setShadowBar] = useState<number | null>(null);
  const [showMusicEnhancer, setShowMusicEnhancer] = useState(false);

  const BARS = 64;
  const zoom = Math.max(0.2, Math.min(4, globalZoom));
  const colW = Math.round(60 * zoom);
  const TRACK_H = Math.round(52 * Math.max(1, Math.min(4, globalVZoom)));

  const timelineRef = useRef<HTMLDivElement>(null);
  const isRunning   = transport === 'playing' || transport === 'recording';

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

  const soloActive = tracks.some(t => t.solo);
  const soloTracks = tracks.filter(t => t.solo);
  let nextTrackId = Math.max(...tracks.map(t => t.id)) + 1;

  function addTrack(type: TrackType) {
    const id = nextTrackId++;
    const audioTrack = trackManager.allocateNewTracks(1)[0];
    setTracks(prev => [...prev, { id, name: `${type} Track ${id}`, type, color: TYPE_COLORS[type], muted: false, solo: false, locked: false, volume: 75, clips: [], audioTrack }]);
  }

  function handleMusicEnhancerTrack(audioBuffer: AudioBuffer, trackName: string) {
    const id = nextTrackId++;
    const audioTrack = trackManager.allocateNewTracks(1)[0];
    
    // Create a clip from the audio buffer
    const newClip = mkClip(1, 4, trackName);
    
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
  function toggleMute(id: number) { setTracks(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t)); }
  function toggleSolo(id: number) { setTracks(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t)); }
  function toggleLock(id: number) { setTracks(prev => prev.map(t => t.id === id ? { ...t, locked: !t.locked } : t)); }
  function deleteTrack(id: number) { 
    setTracks(prev => prev.filter(t => t.id !== id)); 
    // Note: Audio track is implicitly released when track is deleted
    // (could be re-used by other modules in future allocation)
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
    e.stopPropagation();
    setDraggingClip({ trackId, clipId });
    dragStartXRef.current = e.clientX;
    dragOrigBarRef.current = origBar;
    setShadowBar(origBar);
  }

  function onGlobalMouseMove(e: React.MouseEvent) {
    if (!draggingClip) return;
    const deltaBar = Math.round((e.clientX - dragStartXRef.current) / colW);
    const newBar = Math.max(1, dragOrigBarRef.current + deltaBar);
    setShadowBar(newBar);
    setTracks(prev => prev.map(t => t.id !== draggingClip.trackId ? t : {
      ...t, clips: t.clips.map(c => c.id !== draggingClip.clipId ? c : { ...c, bar: newBar }),
    }));
  }

  function onGlobalMouseUp() {
    if (draggingClip) {
      setTracks(prev => prev.map(t => t.id !== draggingClip.trackId ? t : {
        ...t, clips: resolveClipCollisions(t.clips),
      }));
      setShadowBar(null);
    }
    setDraggingClip(null);
  }

  function onRulerClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const bar = Math.max(1, Math.floor((e.clientX - rect.left) / colW) + 1);
    setSelectedBar(selectedBar === bar ? null : bar);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#2a2a2a', color: '#ccc' }}
      onMouseMove={onGlobalMouseMove} onMouseUp={onGlobalMouseUp}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2 shrink-0" style={{ borderBottom: '1px solid #2c2c2c', background: '#2c2c2c' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#00E5FF22', color: '#00E5FF' }}><Radio size={16} /></div>
          <h2 className="text-sm font-bold" style={{ color: '#fff' }}>Studio Editor</h2>
          <span className="text-xs font-mono px-3 py-1 rounded font-bold" style={{ background: '#000', border: '1px solid #2a2a2a', color: '#ffcc00' }}>⚡ {bpm} BPM</span>
          {soloActive && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#ffcc0018', color: '#ffcc00', border: '1px solid #ffcc0044' }}>SOLO: {soloTracks.map(t => t.name).join(', ')}</span>}
          {selectedBar !== null && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: '#00ff8818', color: '#00ff88', border: '1px solid #00ff8844' }}>↔ BAR {selectedBar}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setTool('pointer')} className="flex items-center gap-1 px-2 h-7 rounded text-xs font-bold"
            style={{ background: tool === 'pointer' ? '#1a1a2a' : '#242424', color: tool === 'pointer' ? '#00E5FF' : '#555', border: `1px solid ${tool === 'pointer' ? '#00E5FF44' : '#333'}` }}>
            <MousePointer size={10} /> Select
          </button>
          <button onClick={() => setTool('razor')} className="flex items-center gap-1 px-2 h-7 rounded text-xs font-bold"
            style={{ background: tool === 'razor' ? '#ff444422' : '#242424', color: tool === 'razor' ? '#ff4444' : '#555', border: `1px solid ${tool === 'razor' ? '#ff444444' : '#333'}` }}>
            <Scissors size={10} /> Razor
          </button>
          <button onClick={() => setAutoScroll(v => !v)} className="px-2 h-7 rounded text-xs font-bold"
            style={{ background: autoScroll ? '#00ff8818' : '#242424', color: autoScroll ? '#00ff88' : '#555', border: `1px solid ${autoScroll ? '#00ff8844' : '#333'}` }}>
            ↔ Scroll
          </button>
          <div className="w-px h-5" style={{ background: '#2a2a2a' }} />
          {(['MIDI', 'Audio', 'Drum', 'Bus'] as TrackType[]).map(t => (
            <button key={t} onClick={() => addTrack(t)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
              style={{ background: `${TYPE_COLORS[t]}18`, color: TYPE_COLORS[t], border: `1px solid ${TYPE_COLORS[t]}44` }}>
              <Plus size={10} /> {t}
            </button>
          ))}
          <button onClick={() => setShowMusicEnhancer(true)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
            style={{ background: '#a855f722', color: '#a855f7', border: '1px solid #a855f744' }}>
            <Mic size={10} /> Sound Conversion
          </button>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: '#555' }}>H</span>
            <button onClick={() => setGlobalZoom(Math.max(0.2, +(zoom - 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#2c2c2c', color: '#666' }}><ZoomOut size={11} /></button>
            <span className="text-xs font-mono w-8 text-center" style={{ color: '#00E5FF' }}>{zoom.toFixed(1)}x</span>
            <button onClick={() => setGlobalZoom(Math.min(4, +(zoom + 0.1).toFixed(2)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#2c2c2c', color: '#666' }}><ZoomIn size={11} /></button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: '#555' }}>V</span>
            <button onClick={() => setGlobalVZoom(Math.max(1, +(globalVZoom - 0.5).toFixed(1)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#2c2c2c', color: '#666' }}><ZoomOut size={11} /></button>
            <span className="text-xs font-mono w-7 text-center" style={{ color: '#D500F9' }}>{globalVZoom.toFixed(1)}x</span>
            <button onClick={() => setGlobalVZoom(Math.min(8, +(globalVZoom + 0.5).toFixed(1)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#2c2c2c', color: '#666' }}><ZoomIn size={11} /></button>
          </div>
          <button onClick={() => onExport('master-arranger')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#2c2c2c', color: '#D500F9', border: '1px solid #D500F944' }}>
            <Send size={10} /> Arrange
          </button>
        </div>
      </div>

      {/* Main content area with flex column layout */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* ResizablePanel for studio editor */}
        <ResizablePanel height={studioHeight} minH={200} maxH={900} defaultH={0} onResize={setStudioHeight}
          style={{ flex: studioHeight > 0 ? `0 0 ${studioHeight}px` : '1', minHeight: studioHeight > 0 ? studioHeight : 200 }}>
          <div className="flex flex-1 min-h-0 overflow-hidden flex-col" style={{ flex: 1 }}>
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Track list — simplified, moved into timeline */}
              <div className="shrink-0 overflow-y-auto" style={{ width: 160, borderRight: '1px solid #2c2c2c', background: '#2c2c2c' }}>
                <div className="h-8" style={{ borderBottom: '1px solid #2c2c2c' }} />
                {tracks.map(t => {
                  const dimmed = soloActive && !t.solo;
                  return (
                    <div key={t.id} className="flex flex-col gap-1 px-2 py-2 group hover:opacity-100 transition-opacity"
                      style={{ height: TRACK_H, borderBottom: '1px solid #2c2c2c', cursor: 'pointer', background: editorTrack?.id === t.id ? `${t.color}18` : 'transparent', opacity: dimmed ? 0.35 : 1, borderLeft: `3px solid ${t.color}${editorTrack?.id === t.id ? '' : '33'}` }}
                      onClick={() => setEditorTrack(et => et?.id === t.id ? null : t)}>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color, boxShadow: `0 0 4px ${t.color}` }} />
                        <span className="text-xs font-semibold truncate" style={{ color: t.muted ? '#555' : '#ccc', textShadow: `0 0 4px ${t.color}22` }}>{t.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5 flex-1 min-w-0">
                        <span className="text-7px font-mono truncate" style={{ color: '#666' }}>{t.type}</span>
                        <div className="flex gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity ml-auto">
                          <button onClick={e => { e.stopPropagation(); toggleMute(t.id); }} className="w-4 h-4 rounded flex items-center justify-center" style={{ background: t.muted ? '#f4444433' : '#2c2c2c', color: t.muted ? '#ff6666' : '#666', border: `1px solid ${t.muted ? '#f44444' : '#333'}`, cursor: 'pointer', transition: 'all 0.1s', padding: '1px' }}><VolumeX size={6} /></button>
                          <button onClick={e => { e.stopPropagation(); toggleSolo(t.id); }} className="w-4 h-4 rounded flex items-center justify-center text-4" style={{ background: t.solo ? '#ffcc0033' : '#2c2c2c', color: t.solo ? '#ffcc00' : '#666', border: `1px solid ${t.solo ? '#ffcc00' : '#333'}`, cursor: 'pointer', transition: 'all 0.1s', padding: '1px', fontSize: '9px', fontWeight: 'bold' }}>S</button>
                          <button onClick={e => { e.stopPropagation(); toggleLock(t.id); }} className="w-4 h-4 rounded flex items-center justify-center text-4" style={{ background: t.locked ? '#00E5FF22' : '#2c2c2c', color: t.locked ? '#00E5FF' : '#666', border: `1px solid ${t.locked ? '#00E5FF' : '#333'}`, cursor: 'pointer', transition: 'all 0.1s', padding: '1px' }}><Lock size={6} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Timeline scroll container */}
              <div ref={timelineRef} className="flex-1 overflow-auto" style={{ position: 'relative' }}>
                <div style={{ width: colW * BARS, position: 'relative' }}>
                  {/* Ruler */}
                  <div className="sticky top-0 z-20"
                    style={{ background: '#1c1c1c', borderBottom: '1px solid #2c2c2c', height: 32, width: colW * BARS, position: 'relative', cursor: 'pointer', userSelect: 'none' }}
                    onClick={onRulerClick}>
                    {Array.from({ length: BARS }, (_, i) => {
                      const bar = i + 1;
                      const isSelected = selectedBar === bar;
                      const isCurrent = bar === currentBar && (transport === 'playing' || transport === 'recording');
                      return (
                        <div key={i} className="absolute top-0 flex items-center justify-start pl-1"
                          style={{ left: i * colW, width: colW, height: 32, color: isCurrent ? '#D500F9' : isSelected ? '#00ff88' : '#555', background: isCurrent ? 'rgba(213,0,249,0.06)' : isSelected ? 'rgba(0,255,136,0.12)' : 'transparent', borderLeft: `1px solid ${i % 4 === 0 ? '#2c2c2c' : '#0d0d0d'}`, fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {i + 1}
                        </div>
                      );
                    })}
                    {selectedBar !== null && selectedBar <= BARS && (
                      <div className="absolute top-0 pointer-events-none"
                        style={{ left: (selectedBar - 1) * colW, width: colW, height: '100vh', background: 'rgba(0,255,136,0.06)', borderLeft: '2px solid #00ff88', zIndex: 6 }}>
                        <span className="absolute top-1 left-1 font-bold" style={{ color: '#00ff88', fontSize: 7 }}>↔ PR</span>
                      </div>
                    )}
                  </div>

                  {/* Track rows */}
                  {tracks.map(t => {
                    const dimmed = soloActive && !t.solo;
                    return (
                      <div key={t.id} className="relative"
                        style={{ height: TRACK_H, borderBottom: '1px solid #242424', width: colW * BARS, opacity: dimmed ? 0.25 : 1 }}>
                        {Array.from({ length: BARS }, (_, i) => (
                          <div key={i} className="absolute top-0 h-full" style={{ left: i * colW, width: 1, background: i % 4 === 0 ? '#303030' : '#0d0d0d' }} />
                        ))}
                        {selectedBar !== null && selectedBar <= BARS && (
                          <div className="absolute top-0 h-full pointer-events-none"
                            style={{ left: (selectedBar - 1) * colW, width: colW, background: 'rgba(0,255,136,0.04)' }} />
                        )}
                        {t.clips.map(clip => {
                          const clipW = Math.max(8, clip.len * colW - 2);
                          const clipLeft = (clip.bar - 1) * colW + 1;
                          const isDragging = draggingClip?.trackId === t.id && draggingClip.clipId === clip.id;
                          const phFrac = (currentBar >= clip.bar && currentBar <= clip.bar + clip.len - 1)
                            ? (currentBar - clip.bar + currentTick / STEPS_PER_BAR) / clip.len : undefined;
                          const hasCrossfade = t.clips.some(c => c.id !== clip.id && c.bar + c.len === clip.bar);
                          return (
                            <div key={clip.id}>
                              {isDragging && shadowBar !== null && (
                                <div className="absolute top-1 bottom-1 rounded pointer-events-none"
                                  style={{ left: (shadowBar - 1) * colW + 1, width: clipW, background: `${t.color}12`, border: `2px dashed ${t.color}`, zIndex: 8 }}>
                                  <span className="absolute top-0 left-1" style={{ color: t.color, fontSize: 7, fontFamily: 'monospace' }}>Bar {shadowBar}</span>
                                </div>
                              )}
                              <div onMouseDown={e => onClipMouseDown(t.id, clip.id, clip.bar, e)}
                                className="absolute top-1 select-none overflow-hidden rounded group"
                                style={{ left: clipLeft, width: clipW, height: TRACK_H - 8, cursor: isDragging ? 'grabbing' : tool === 'razor' ? 'crosshair' : 'grab', boxShadow: isDragging ? `0 0 20px ${t.color}88, inset 0 0 10px ${t.color}44` : `0 0 8px ${t.color}33`, zIndex: isDragging ? 15 : 1, opacity: isDragging ? 0.9 : 1, background: `linear-gradient(180deg, ${t.color}15, ${t.color}08)`, border: `1px solid ${isDragging ? t.color : `${t.color}66`}`, transition: isDragging ? 'none' : 'all 0.15s' }}>
                                <WaveformClip
                                  clipId={t.id * 1000 + clip.id} color={t.color} trackType={t.type}
                                  width={clipW} height={TRACK_H - 8} vZoom={globalVZoom}
                                  isRazorActive={tool === 'razor'} playheadFraction={phFrac}
                                  label={clip.label} isSelected={isDragging}
                                />
                                {hasCrossfade && (
                                  <div className="absolute top-0 left-0 h-full pointer-events-none"
                                    style={{ width: 12, background: `linear-gradient(90deg, ${t.color}66, transparent)` }} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {editorTrack && (
              <div className="shrink-0" style={{ borderTop: '2px solid #2c2c2c', background: '#030303', minHeight: 280, maxHeight: 380, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '12px' }}>
                <WaveformEditor
                  clips={editorTrack.clips.map(c => ({ id: c.id, bar: c.bar, len: c.len, label: c.label, trackColor: editorTrack.color, trackType: editorTrack.type }))}
                  colW={colW} totalBars={BARS} trackColor={editorTrack.color}
                  trackName={editorTrack.name} onClose={() => setEditorTrack(null)}
                />
              </div>
            )}
          </div>
        </ResizablePanel>

        {/* ── MIXER PANEL (anchored to bottom) ── */}
        <div style={{ borderTop: '1px solid #2c2c2c', background: '#2c2c2c', flexShrink: 0, display: 'flex', flexDirection: 'column', height: mixerOpen ? `${mixerHeight + 20}px` : '20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#1c1c1c', borderBottom: '1px solid #2c2c2c', minHeight: '20px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#00E5FF' }}>🎚️ MIXER — Live Metering</span>
            <button onClick={() => setMixerOpen(!mixerOpen)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px 4px' }}>
              {mixerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* Content */}
          {mixerOpen && (
            <div style={{ display: 'flex', overflowX: 'auto', height: mixerHeight, background: '#2a2a2a' }}>
              {tracks.map(track => {
                const isPlaying = transport === 'playing' || transport === 'recording';
                const volLevel = (channelVolumes[track.id] ?? track.volume) / 100;
                const rmsLevel = isPlaying ? Math.min(1, (channelLevels[track.id] ?? 0) * volLevel) : 0;
                const peakLevel = isPlaying ? Math.min(1, rmsLevel * 1.25) : 0;
                const pan = trackPans[track.id] ?? 0;
                const dbLevel = rmsLevel > 0 ? (20 * Math.log10(rmsLevel)) : -60;
                const clipping = dbLevel > 0;

                return (
                  <div key={track.id} style={{ display: 'flex', flexDirection: 'column', width: 100, flexShrink: 0, padding: '8px', borderRight: '1px solid #2c2c2c', gap: '8px' }}>
                    {/* Track name */}
                    <div style={{ fontSize: 9, fontWeight: 700, color: track.color, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: 16 }}>
                      {track.name}
                    </div>

                    {/* LED Meter */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-end', gap: '1px', minHeight: 80, background: '#000', borderRadius: 3, padding: '4px 3px', border: '1px solid #2c2c2c' }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const threshold = i / 12;
                        const isLit = rmsLevel > threshold;
                        const ledColor = clipping && i > 10 ? '#ff3333' : isLit ? (i > 9 ? '#ffaa00' : i > 6 ? '#00ff88' : track.color) : '#1c1c1c';
                        return (
                          <div key={i} style={{ height: '100%', borderRadius: 2, background: ledColor, boxShadow: isLit ? `0 0 4px ${ledColor}` : 'none', transition: 'all 0.05s' }} />
                        );
                      })}
                    </div>

                    {/* dB display */}
                    <div style={{ fontSize: 7, textAlign: 'center', color: clipping ? '#ff3333' : '#888', fontFamily: 'monospace', fontWeight: 700 }}>
                      {dbLevel.toFixed(1)} dB
                    </div>

                    {/* Volume fader + value */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={channelVolumes[track.id] ?? track.volume}
                        onChange={e => setChannelVolume(track.id, Number(e.target.value))}
                        style={{ width: '100%', height: 4, accentColor: track.color, cursor: 'pointer' }}
                      />
                      <div style={{ fontSize: 8, textAlign: 'center', color: '#888', fontFamily: 'monospace' }}>
                        {channelVolumes[track.id] ?? track.volume}%
                      </div>
                    </div>

                    {/* Pan + value */}
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

                    {/* M/S buttons */}
                    <div style={{ display: 'flex', gap: '3px', fontSize: 9 }}>
                      <button onClick={() => toggleMute(track.id)} style={{ flex: 1, padding: '4px', borderRadius: 3, background: track.muted ? '#f4444433' : '#2c2c2c', color: track.muted ? '#ff6666' : '#666', border: `1px solid ${track.muted ? '#f44444' : '#333'}`, cursor: 'pointer', fontWeight: 700, transition: 'all 0.1s' }}>
                        M
                      </button>
                      <button onClick={() => toggleSolo(track.id)} style={{ flex: 1, padding: '4px', borderRadius: 3, background: track.solo ? '#ffcc0033' : '#2c2c2c', color: track.solo ? '#ffcc00' : '#666', border: `1px solid ${track.solo ? '#ffcc00' : '#333'}`, cursor: 'pointer', fontWeight: 700, transition: 'all 0.1s' }}>
                        S
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Music Enhancer Modal */}
      {showMusicEnhancer && (
        <MusicEnhancer 
          onCreateTrack={handleMusicEnhancerTrack}
          onClose={() => setShowMusicEnhancer(false)}
        />
      )}
    </div>
  );
}
