import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';

import { AlignLeft, Send, Plus, ChevronDown, ChevronUp, ZoomIn, ZoomOut, VolumeX, Play, Square, Mic, Clock } from 'lucide-react';

import { useMasterClock, STEPS_PER_BAR } from '@/app/context/MasterClockContext';

import { useSongArranger, TEMPLATES, SECTION_TYPE_COLORS, type SectionType } from '@/app/context/SongArrangerContext';

import WaveformClip from '@/app/components/WaveformClip';

import SectionBar from '@/app/components/SectionBar';
import LoopMarkersBrace, { LoopVerticalGuides } from '@/app/components/LoopMarkersBrace';

import IsleMap from '@/app/components/IsleMap';

import ProMeter from '@/app/components/ProMeter';

import {
  computeMasterArrangerSessionMeta,
  getMasterArrangerSessionBase,
  writeMasterArrangerSessionManifestToStorage,
  DA_SESSION_TRACKS_SYNC_EVENT,
} from '@/app/lib/sessionChannelTracks';

import { MASTER_ARRANGER_CLIP_DATA_KEY } from '@/app/lib/sessionClipContent';

interface Block { id: number; trackId: number; bar: number; len: number; label: string; }

interface ArrTrack { id: number; name: string; color: string; }


const INIT_TRACKS: ArrTrack[] = [
  { id: 1,  name: 'Drums',      color: '#D500F9' },
  { id: 2,  name: 'Bass',       color: '#00E5FF' },
  { id: 3,  name: 'Lead',       color: '#00ff88' },
  { id: 4,  name: 'AI Pattern', color: '#ffcc00' },
  { id: 5,  name: 'Vocals',     color: '#ff6b35' },
  { id: 6,  name: 'Track 6',    color: '#a78bfa' },
  { id: 7,  name: 'Track 7',    color: '#60a5fa' },
  { id: 8,  name: 'Track 8',    color: '#f472b6' },
  { id: 9,  name: 'Track 9',    color: '#34d399' },
  { id: 10, name: 'Track 10',   color: '#fb923c' },
  { id: 11, name: 'Track 11',   color: '#D500F9' },
  { id: 12, name: 'Track 12',   color: '#00E5FF' },
  { id: 13, name: 'Track 13',   color: '#00ff88' },
  { id: 14, name: 'Track 14',   color: '#ffcc00' },
  { id: 15, name: 'Track 15',   color: '#ff6b35' },
  { id: 16, name: 'Track 16',   color: '#a78bfa' },
];

const INIT_BLOCKS: Block[] = [
  { id: 1,  trackId: 1, bar: 1,  len: 4,  label: 'Intro Beat'   },
  { id: 2,  trackId: 1, bar: 5,  len: 8,  label: 'Verse Beat'   },
  { id: 3,  trackId: 1, bar: 21, len: 8,  label: 'Hook Beat'    },
  { id: 4,  trackId: 2, bar: 1,  len: 4,  label: 'Intro Bass'   },
  { id: 5,  trackId: 2, bar: 5,  len: 8,  label: 'Verse Bass'   },
  { id: 6,  trackId: 2, bar: 21, len: 8,  label: 'Hook Bass'    },
  { id: 7,  trackId: 3, bar: 5,  len: 8,  label: 'Verse Melody' },
  { id: 8,  trackId: 3, bar: 21, len: 8,  label: 'Hook'         },
  { id: 9,  trackId: 4, bar: 13, len: 2,  label: 'AI Fill'      },
  { id: 10, trackId: 5, bar: 5,  len: 16, label: 'Verse Vox'    },
];

const MIN_MASTER_MIXER_TRACKS = 16;
const TRACK_COLOR_POOL = ['#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fb923c', '#D500F9', '#00E5FF', '#00ff88', '#ffcc00', '#ff6b35'];
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
const EFFECT_TYPES: EffectType[] = ['eq', 'compressor', 'reverb', 'delay', 'chorus', 'flanger', 'distortion', 'filter'];


const BASE_COL = 64;

const TRACK_H = 52;

/** Must match SectionBar (32) + bar ruler + measure ruler in timeline — keeps left column aligned when scrolling. */
const SECTION_BAR_H = 32;
const BAR_RULER_H = 28;
const MEASURE_RULER_H = 24;
const TIMELINE_HEADER_H = SECTION_BAR_H + BAR_RULER_H + MEASURE_RULER_H;

/** Matches Studio editor master strip: dark bluish–gold mixer chrome */
const MIXER_BLUISH_GOLD_BG =
  'radial-gradient(120% 80% at 50% 0%, rgba(120,92,28,0.14) 0%, transparent 55%), linear-gradient(165deg, rgba(18,32,48,0.35) 0%, transparent 45%), linear-gradient(180deg, #0c1218 0%, #080e14 48%, #05080c 100%)';

export default function MasterArrangerScreen({ onExport }: { onExport: (dest: string) => void }) {
  const clock = useMasterClock();
  const { applyTemplate, activeTemplateName } = useSongArranger();

  const [tracks, setTracks]   = useState<ArrTrack[]>(INIT_TRACKS);
  const [blocks, setBlocks]   = useState<Block[]>(INIT_BLOCKS);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOrigBar, setDragOrigBar] = useState(0);
  const [showIsleMap, setShowIsleMap] = useState(true);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [pickerType, setPickerType] = useState<SectionType | null>(null);
  const [pickerBars, setPickerBars] = useState(4);
  const [mixerOpen, setMixerOpen] = useState(true);
  const [mixerHeight] = useState(320);
  const [channelVolumes, setChannelVolume] = useState<Record<number, number>>(Object.fromEntries(tracks.map(t => [t.id, 75])));
  const [trackPans, setTrackPans] = useState<Record<number, number>>(Object.fromEntries(tracks.map(t => [t.id, 0])));
  const [trackMutes, setTrackMutes] = useState<Record<number, boolean>>({});
  const [trackSolos, setTrackSolos] = useState<Record<number, boolean>>({});
  const [trackStereoModes, setTrackStereoModes] = useState<Record<number, 'stereo' | 'mono'>>({});
  const [trackEffects, setTrackEffects] = useState<Record<number, EffectSlot[]>>({});
  const [dragFxSlot, setDragFxSlot] = useState<{ trackId: number; fromIndex: number } | null>(null);
  const [activeFxEditor, setActiveFxEditor] = useState<{ trackId: number; effectId: string } | null>(null);
  const [addFxTrackId, setAddFxTrackId] = useState<number | null>(null);

  // Ensure this area always has at least 16 dedicated mixer/track channels, even in older in-memory sessions.
  useEffect(() => {
    setTracks(prev => {
      if (prev.length >= MIN_MASTER_MIXER_TRACKS) return prev;
      const next = [...prev];
      for (let id = prev.length + 1; id <= MIN_MASTER_MIXER_TRACKS; id++) {
        next.push({
          id,
          name: `Track ${id}`,
          color: TRACK_COLOR_POOL[(id - 1) % TRACK_COLOR_POOL.length],
        });
      }
      return next;
    });
  }, []);

  // Shared DAW session: arranger rows + blocks → Studio clips (audioTrack = session base + track id − 1).
  useEffect(() => {
    const meta = computeMasterArrangerSessionMeta(tracks);
    writeMasterArrangerSessionManifestToStorage(meta);
    try {
      localStorage.setItem(
        MASTER_ARRANGER_CLIP_DATA_KEY,
        JSON.stringify({ bpm: clock.bpm, blocks }),
      );
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(DA_SESSION_TRACKS_SYNC_EVENT));
  }, [tracks, blocks, clock.bpm]);

  const COL        = Math.round(BASE_COL * Math.max(0.3, Math.min(3, zoom)));
  const STEP_W     = COL / STEPS_PER_BAR;
  const TOTAL_BARS = Math.max(100, clock.songTotalBars + 8);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isRunning   = clock.transport === 'playing' || clock.transport === 'recording';

  // Ctrl+Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.3, Math.min(3, parseFloat((prev + delta).toFixed(2)))));
  }, []);
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Block dragging
  function resolveCollisions(allBlocks: Block[], movedId: number): Block[] {
    let result = [...allBlocks];
    let changed = true; let iters = 0;
    const moved = result.find(b => b.id === movedId);
    if (!moved) return result;
    while (changed && iters++ < 50) {
      changed = false;
      const sorted = result.filter(b => b.trackId === moved.trackId).sort((a, b) => a.bar - b.bar);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]; const curr = sorted[i];
        if (curr.bar < prev.bar + prev.len) {
          result = result.map(b => b.id === curr.id ? { ...b, bar: prev.bar + prev.len } : b);
          changed = true;
        }
      }
    }
    return result;
  }
  function startDrag(blockId: number, e: React.MouseEvent, origBar: number) {
    setDragging(blockId); setDragStartX(e.clientX); setDragOrigBar(origBar);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (dragging === null) return;
    const deltaBar = Math.round((e.clientX - dragStartX) / COL);
    setBlocks(prev => prev.map(b => b.id === dragging ? { ...b, bar: Math.max(1, dragOrigBar + deltaBar) } : b));
  }
  function stopDrag() {
    if (dragging !== null) setBlocks(prev => resolveCollisions(prev, dragging));
    setDragging(null);
  }

  let nextTrackId = Math.max(...tracks.map(t => t.id), 0) + 1;
  function addTrack() {
    const id = nextTrackId++;
    const colors = ['#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fb923c'];
    setTracks(prev => [...prev, { id, name: `Track ${id}`, color: colors[id % colors.length] }]);
    setChannelVolume(prev => ({ ...prev, [id]: 75 }));
    setTrackPans(prev => ({ ...prev, [id]: 0 }));
  }
  
  function toggleMute(id: number) {
    setTrackMutes(prev => ({ ...prev, [id]: !prev[id] }));
  }
  
  function toggleSolo(id: number) {
    setTrackSolos(prev => ({ ...prev, [id]: !prev[id] }));
  }
  
  function setPan(id: number, v: number) {
    setTrackPans(prev => ({ ...prev, [id]: v }));
  }
  function toggleStereoMode(id: number) {
    setTrackStereoModes(prev => ({ ...prev, [id]: prev[id] === 'mono' ? 'stereo' : 'mono' }));
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

  const { bpm, transport, loopEnabled, loopStartBar, loopBars, songTotalBars } = clock;
  const arrangerTransportBeatUi = useSyncExternalStore(
    clock.subscribeTransportBeatUi,
    clock.getTransportBeatUiSnapshot,
    clock.getTransportBeatUiSnapshot,
  );
  const arrangerQuarter = arrangerTransportBeatUi.wrappedQuarter;
  const currentBar = Math.floor(arrangerQuarter / STEPS_PER_BAR) + 1;
  const currentTick =
    ((arrangerQuarter % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  const currentBeat = currentTick + 1;
  const { sections, addSection } = useSongArranger();

  /** First Master Arranger session lane (default 26; shifts if AI Pattern expands past CH25). */
  const arrangerSessionBase = getMasterArrangerSessionBase();
  const sessionChForArrTrack = (trackId: number) => arrangerSessionBase + Math.max(0, trackId - 1);
  const localChForArrTrack = (trackId: number) => Math.max(1, trackId);

  const SECTION_TYPES: SectionType[] = ['Intro','Verse','Pre-Chorus','Chorus','Bridge','Breakdown','Drop','Build','Outro'];

  return (
    <div className="flex flex-col h-full" style={{ background: '#050505', color: '#ccc' }}
      onMouseMove={onMouseMove} onMouseUp={stopDrag}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0 flex-wrap gap-2"
        style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#00E5FF22', color: '#00E5FF' }}>
            <AlignLeft size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#fff' }}>Master Arranger</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-mono px-3 py-1 rounded font-bold"
                style={{ background: '#000', border: '1px solid #2a2a2a', color: '#ffcc00' }}>
                ⚡ {bpm} BPM
              </p>
              <p className="text-xs font-mono" style={{ color: '#555' }}>
                BAR {currentBar} · BEAT {currentBeat}/4
              </p>
              <p className="text-xs font-mono" style={{ color: '#444', marginTop: 2 }} title="UI shows local CH numbers; backend stays dedicated per module">
                Local CH1–CH{tracks.length} · backend routes dedicated
              </p>
            </div>
          </div>
          <span className="text-xs px-1.5 py-0.5 rounded font-bold"
            style={{ background: '#00ff8812', color: '#00ff8888', border: '1px solid #00ff8822', fontSize: 8 }}>
            MASTER SYNC
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button onClick={() => setShowTemplateMenu(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all active:scale-90"
              style={{ background: '#1a1a2a', color: '#D500F9', border: '1px solid #D500F944' }}
              title="Click to restore song structure from template">
              {activeTemplateName} <ChevronDown size={10} />
            </button>
            {showTemplateMenu && (
              <div className="absolute left-0 top-full mt-0.5 rounded-lg z-50 overflow-hidden"
                style={{ background: '#1a1a1a', border: '1px solid #333', minWidth: 120 }}>
                {Object.keys(TEMPLATES).map(name => (
                  <button key={name} onClick={() => { applyTemplate(name); setShowTemplateMenu(false); }}
                    className="w-full px-3 py-2 text-xs text-left transition-all active:scale-90"
                    style={{ color: activeTemplateName === name ? '#D500F9' : '#888', background: activeTemplateName === name ? '#D500F918' : 'transparent' }}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowIsleMap(v => !v)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
            style={{ background: showIsleMap ? '#00E5FF18' : '#111', color: showIsleMap ? '#00E5FF' : '#555', border: `1px solid ${showIsleMap ? '#00E5FF44' : '#333'}` }}>
            🗺 Isle Map
          </button>
          <button onClick={() => setAutoScroll(v => !v)} className="px-2 py-1 rounded text-xs font-bold"
            style={{ background: autoScroll ? '#00ff8818' : '#111', color: autoScroll ? '#00ff88' : '#555', border: `1px solid ${autoScroll ? '#00ff8844' : '#333'}` }}>
            ↔ Auto-Scroll
          </button>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: '#555' }}>ZOOM</span>
            <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.2).toFixed(1)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomOut size={11} /></button>
            <span className="text-xs font-mono w-8 text-center" style={{ color: '#00E5FF' }}>{zoom.toFixed(1)}x</span>
            <button onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(1)))} className="w-6 h-6 flex items-center justify-center rounded" style={{ background: '#1a1a1a', color: '#666' }}><ZoomIn size={11} /></button>
          </div>
          <button onClick={addTrack} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold" style={{ background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>
            <Plus size={10} /> Track
          </button>
          <button onClick={() => onExport('studio-editor')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF44' }}>
            <Send size={10} /> Studio
          </button>
          <button onClick={() => onExport('export')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#111', color: '#00ff88', border: '1px solid #00ff8844' }}>
            <Send size={10} /> Export
          </button>
        </div>
      </div>

      {showIsleMap && (
        <div style={{ maxHeight: '80px', overflow: 'y-auto', background: '#030303', borderBottom: '1px solid #1a1a1a' }}>
          <IsleMap />
        </div>
      )}

      {/* Section Management Bar */}
      <div className="shrink-0 overflow-x-auto flex items-center gap-1 px-3 py-2" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', height: 44 }}>
        <span className="text-xs font-bold shrink-0" style={{ color: '#555' }}>SECTIONS:</span>
        {SECTION_TYPES.map(type => (
          <button
            key={type}
            onClick={() => {
              setPickerType(type);
              setShowDurationPicker(true);
            }}
            className="px-2 py-1 rounded text-xs font-bold shrink-0 transition-all active:scale-90"
            style={{ 
              color: '#000', 
              background: SECTION_TYPE_COLORS[type],
              border: '1px solid transparent'
            }}
            title={`Add ${type} section`}
          >
            + {type}
          </button>
        ))}
      </div>

      {/* Duration picker dialog */}
      {showDurationPicker && pickerType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowDurationPicker(false)}>
          <div className="rounded-lg p-6 z-51" style={{ background: '#1a1a1a', border: '1px solid #333', minWidth: 280 }}
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold mb-4" style={{ color: SECTION_TYPE_COLORS[pickerType] }}>
              Add {pickerType} — How many bars?
            </div>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setPickerBars(Math.max(1, pickerBars - 1))}
                className="w-8 h-8 rounded flex items-center justify-center font-bold transition-all active:scale-90"
                style={{ background: '#333', color: '#888' }}>−</button>
              <div className="flex-1 flex items-center justify-center">
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={pickerBars}
                  onChange={e => setPickerBars(Math.max(1, parseInt(e.target.value) || 4))}
                  className="w-16 text-center rounded px-2 py-1 font-bold text-lg"
                  style={{ background: '#111', color: SECTION_TYPE_COLORS[pickerType], border: '1px solid #333' }}
                />
              </div>
              <button
                onClick={() => setPickerBars(Math.min(64, pickerBars + 1))}
                className="w-8 h-8 rounded flex items-center justify-center font-bold transition-all active:scale-90"
                style={{ background: '#333', color: '#888' }}>+</button>
            </div>
            <div className="text-xs mb-4" style={{ color: '#555' }}>
              Duration: <span style={{ color: SECTION_TYPE_COLORS[pickerType], fontFamily: 'monospace', fontWeight: 'bold' }}>{pickerBars} bars</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDurationPicker(false)}
                className="flex-1 px-3 py-2 rounded text-xs font-bold transition-all active:scale-90"
                style={{ background: '#333', color: '#888' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  const lastEnd = sections.reduce((max, s) => Math.max(max, s.startBar + s.lenBars), 1);
                  addSection(pickerType, lastEnd, pickerBars);
                  setShowDurationPicker(false);
                  setPickerType(null);
                  setPickerBars(4);
                }}
                className="flex-1 px-3 py-2 rounded text-xs font-bold transition-all active:scale-90"
                style={{ background: SECTION_TYPE_COLORS[pickerType], color: '#000' }}>
                Add {pickerType}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* One vertical scroll for track names + timeline; timeline uses horizontal scroll only (no nested vertical scroll). */}
        <div className="flex flex-1 min-h-0 overflow-hidden flex-row">
          <div className="flex flex-1 min-h-0 min-w-0 flex-row overflow-y-auto overflow-x-hidden items-start">
            {/* Track labels — same scroll as timeline */}
            <div
              className="shrink-0 self-start overflow-hidden flex flex-col"
              style={{ width: 160, background: '#080808', borderRight: '1px solid #1a1a1a' }}
            >
              <div
                className="sticky top-0 z-20 flex items-end px-2 shrink-0"
                style={{
                  height: TIMELINE_HEADER_H,
                  minHeight: TIMELINE_HEADER_H,
                  borderBottom: '1px solid #1a1a1a',
                  background: '#050505',
                }}
              >
                <span className="text-[9px] font-mono font-bold tracking-wide pb-1" style={{ color: '#666' }}>
                  TRACKS
                </span>
              </div>
              {tracks.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 px-3 py-2 box-border shrink-0"
                  style={{
                    height: TRACK_H,
                    minHeight: TRACK_H,
                    borderBottom: '1px solid #1a1a1a',
                    boxSizing: 'border-box',
                  }}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color, boxShadow: `0 0 4px ${t.color}` }} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[8px] font-mono leading-tight" style={{ color: '#888' }}>CH{localChForArrTrack(t.id)}</span>
                    <span className="text-xs font-semibold" style={{ color: '#ccc', textShadow: `0 0 4px ${t.color}22` }}>{t.name}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline — horizontal scroll only; vertical scroll is the parent above */}
            <div
              ref={timelineRef}
              className="flex-1 min-w-0 shrink-0 self-start overflow-x-auto"
              style={{ position: 'relative', minHeight: 'min-content' }}
            >
            <div className="shrink-0" style={{ width: COL * TOTAL_BARS, minWidth: '100%' }}>

              {/* Sticky header */}
              <div className="sticky top-0 z-20" style={{ width: COL * TOTAL_BARS }}>
                <SectionBar colW={COL} totalBars={TOTAL_BARS} />

                {/* Bar ruler */}
                <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111', height: BAR_RULER_H, width: COL * TOTAL_BARS, position: 'relative' }}>
                  {Array.from({ length: TOTAL_BARS }, (_, i) => {
                    const isCurrentBar = (i + 1) === currentBar && (transport === 'playing' || transport === 'recording');
                    return (
                      <div key={i} className="absolute top-0 flex items-center pl-1"
                        style={{
                          left: i * COL, width: COL, height: BAR_RULER_H,
                          color: isCurrentBar ? '#D500F9' : i % 4 === 0 ? '#888' : '#444',
                          background: isCurrentBar ? 'rgba(213,0,249,0.08)' : 'transparent',
                          borderLeft: `1px solid ${i % 4 === 0 ? '#333' : '#1a1a1a'}`,
                          fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold',
                        }}>
                        {i + 1}
                      </div>
                    );
                  })}
                  <LoopMarkersBrace
                    visible={loopEnabled}
                    leftPx={(loopStartBar - 1) * COL}
                    widthPx={loopBars * COL}
                    height={BAR_RULER_H}
                    variant="dark"
                    zIndex={10}
                  />
                </div>

                {/* Measure ruler — 4 measures per bar */}
                <div style={{ background: '#080808', borderBottom: '1px solid #1a1a1a', height: MEASURE_RULER_H, width: COL * TOTAL_BARS, position: 'relative', overflow: 'hidden' }}>
                  {Array.from({ length: TOTAL_BARS }, (_, bi) =>
                    Array.from({ length: STEPS_PER_BAR }, (_, si) => {
                      const isActive = (bi + 1) === currentBar && si === currentTick
                        && (transport === 'playing' || transport === 'recording');
                      return (
                        <div key={`${bi}-${si}`} className="absolute top-0 flex items-end pb-0.5 justify-center"
                          style={{
                            left: bi * COL + si * STEP_W, width: STEP_W, height: MEASURE_RULER_H,
                            borderLeft: '1px solid #1e1e1e',
                            background: isActive ? 'rgba(213,0,249,0.15)' : 'transparent',
                            fontSize: 7, color: '#555', fontFamily: 'monospace',
                          }}>
                          {si + 1}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* All track rows in one container */}
              <div style={{ width: COL * TOTAL_BARS, position: 'relative' }}>
                <LoopVerticalGuides
                  visible={loopEnabled}
                  leftPx={(loopStartBar - 1) * COL}
                  widthPx={loopBars * COL}
                  height={tracks.length * TRACK_H}
                  zIndex={5}
                />
                {tracks.map(t => (
                  <div key={t.id} className="relative" style={{ height: TRACK_H, borderBottom: '1px solid #111' }}>
                    {Array.from({ length: TOTAL_BARS }, (_, i) => (
                      <div key={i} className="absolute top-0 h-full"
                        style={{ left: i * COL, width: 1, background: i % 4 === 0 ? '#2a2a2a' : '#141414' }} />
                    ))}
                    {Array.from({ length: TOTAL_BARS }, (_, bi) =>
                      Array.from({ length: STEPS_PER_BAR }, (_, si) => {
                        if (si === 0) return null;
                        return (
                          <div key={`${bi}-${si}`} className="absolute top-0 h-full pointer-events-none"
                            style={{ left: bi * COL + si * STEP_W, width: 1, background: si % 4 === 0 ? '#1e1e1e' : '#111' }} />
                        );
                      })
                    )}
                    {blocks.filter(b => b.trackId === t.id).map(block => {
                      const bW = Math.max(8, block.len * COL - 4);
                      const bLeft = (block.bar - 1) * COL + 2;
                      const isDragging = dragging === block.id;
                      const curStep = arrangerQuarter;
                      const blockStartStep = (block.bar - 1) * STEPS_PER_BAR;
                      const blockEndStep   = blockStartStep + block.len * STEPS_PER_BAR;
                      const phFrac = curStep >= blockStartStep && curStep < blockEndStep
                        ? (curStep - blockStartStep) / (block.len * STEPS_PER_BAR)
                        : undefined;
                      const prevBlock = blocks.some(b => b.trackId === t.id && b.id !== block.id && b.bar + b.len === block.bar);
                      return (
                        <div key={block.id}>
                          {isDragging && (
                            <div className="absolute top-1 bottom-1 rounded pointer-events-none"
                              style={{ left: bLeft, width: bW, background: `${t.color}10`, border: `2px dashed ${t.color}88`, zIndex: 8 }} />
                          )}
                          <div onMouseDown={e => startDrag(block.id, e, block.bar)}
                            className="absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing select-none overflow-hidden"
                            style={{ left: bLeft, width: bW, boxShadow: isDragging ? `0 0 16px ${t.color}` : 'none', zIndex: isDragging ? 15 : 1, opacity: isDragging ? 0.85 : 1 }}>
                            <WaveformClip
                              clipId={t.id * 1000 + block.id} color={t.color}
                              trackType={t.id === 1 ? 'Drum' : t.id === 5 ? 'Vocal' : 'MIDI'}
                              width={bW} height={TRACK_H - 10} vZoom={1}
                              isRazorActive={false} playheadFraction={phFrac}
                              label={block.label} isSelected={isDragging}
                            />
                            {prevBlock && (
                              <div className="absolute top-0 left-0 h-full w-3 pointer-events-none"
                                style={{ background: `linear-gradient(90deg, ${t.color}44, transparent)` }} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* ── MIXER PANEL (anchored to bottom) ── */}
        <div style={{ borderTop: '1px solid #0a0a0a', background: MIXER_BLUISH_GOLD_BG, flexShrink: 0, display: 'flex', flexDirection: 'column', height: mixerOpen ? `${mixerHeight + 20}px` : '20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 8px', background: 'rgba(5,8,12,0.88)', borderBottom: '1px solid #0d1218', minHeight: '20px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#00E5FF', flexShrink: 0 }}>🎚️ MIXER — Live Metering</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => clock.stop()}
                style={{ width: 24, height: 20, borderRadius: 3, border: '1px solid #333', background: '#111', color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Stop"
              >
                <Square size={11} fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={() => clock.play()}
                style={{
                  width: 24,
                  height: 20,
                  borderRadius: 3,
                  border: `1px solid ${transport === 'playing' ? '#22c55e66' : '#333'}`,
                  background: transport === 'playing' ? '#22c55e22' : '#111',
                  color: transport === 'playing' ? '#22c55e' : '#aaa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Play"
              >
                <Play size={11} fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={() =>
                  clock.record({
                    countIn: clock.countInEnabled,
                    countInBeats: clock.countInBeats,
                  })
                }
                style={{
                  width: 24,
                  height: 20,
                  borderRadius: 3,
                  border: `1px solid ${transport === 'recording' ? '#ef444466' : '#333'}`,
                  background: transport === 'recording' ? '#ef444422' : '#111',
                  color: transport === 'recording' ? '#ef4444' : '#aaa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Record"
              >
                <Mic size={11} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', flex: 1 }}>
              <span style={{ fontSize: 8, color: '#666', fontFamily: 'monospace' }}>Add by channel (+), drag slots to reorder</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <Clock size={12} color="#666" />
              <input
                type="number"
                min={40}
                max={300}
                value={Math.round(bpm || 120)}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) clock.setBpm(Math.max(40, Math.min(300, next)));
                }}
                style={{
                  width: 52,
                  height: 20,
                  borderRadius: 3,
                  border: '1px solid #333',
                  background: '#111',
                  color: '#d4d4d4',
                  fontSize: 10,
                  padding: '0 4px',
                  fontFamily: 'monospace',
                }}
                title="Tempo BPM"
              />
              <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>BPM</span>
            </div>
            <button onClick={() => setMixerOpen(!mixerOpen)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px 4px' }}>
              {mixerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* Content */}
          {mixerOpen && (
            <div style={{ display: 'flex', overflowX: 'auto', height: mixerHeight, background: MIXER_BLUISH_GOLD_BG }}>
              {tracks.map(track => {
                const volLevel = (channelVolumes[track.id] ?? 75) / 100;
                const sessionCh = sessionChForArrTrack(track.id);
                const rawLevel = clock.channelLevels[sessionCh] ?? 0;
                const rmsLevel = Math.min(1, rawLevel * volLevel);
                const peakLevel = Math.min(1, rmsLevel * 1.3);
                const pan = trackPans[track.id] ?? 0;
                const panNorm = Math.max(-1, Math.min(1, pan / 100));
                const stereoMode = trackStereoModes[track.id] ?? 'stereo';
                const leftLevel = Math.min(1, rmsLevel * (panNorm > 0 ? 1 - panNorm : 1));
                const rightLevel = Math.min(1, rmsLevel * (panNorm < 0 ? 1 + panNorm : 1));
                const isMuted = trackMutes[track.id] ?? false;
                const isSolo = trackSolos[track.id] ?? false;
                const dbLevel = rmsLevel > 0 ? (20 * Math.log10(rmsLevel)) : -60;
                const clipping = dbLevel > 0;

                return (
                  <div
                    key={track.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: 100,
                      flexShrink: 0,
                      padding: '8px',
                      borderRight: '1px solid #1a1a1a',
                      gap: '8px',
                    }}
                  >
                    {/* Track name + local channel label (backend session channel remains dedicated) */}
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#888', textAlign: 'center', fontFamily: 'monospace' }}>
                      CH{localChForArrTrack(track.id)}
                    </div>
                    <div style={{ fontSize: 7, fontWeight: 700, color: `${track.color}cc`, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: 10, lineHeight: 1.05, letterSpacing: 0.2 }}>
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
                          value={Math.round(((channelVolumes[track.id] ?? 75) / 10) * 10) / 10}
                          onChange={e => setChannelVolume(prev => ({ ...prev, [track.id]: Math.round(Number(e.target.value) * 10) }))}
                          style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 12, height: 74, accentColor: track.color, cursor: 'pointer' }}
                          title="Volume"
                        />
                        <div style={{ fontSize: 7, color: '#888', fontFamily: 'monospace', lineHeight: 1 }}>
                          {((channelVolumes[track.id] ?? 75) / 10).toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* dB display */}
                    <div style={{ fontSize: 7, textAlign: 'center', color: clipping ? '#ff3333' : '#888', fontFamily: 'monospace', fontWeight: 700 }}>
                      {dbLevel.toFixed(1)} dB
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleStereoMode(track.id)}
                      style={{ width: '100%', padding: '4px 0', borderRadius: 3, background: stereoMode === 'stereo' ? '#1a1a1a' : '#111', color: stereoMode === 'stereo' ? '#00E5FF' : '#ffcc00', border: `1px solid ${stereoMode === 'stereo' ? '#00E5FF44' : '#ffcc0044'}`, cursor: 'pointer', fontSize: 8, fontWeight: 800, fontFamily: 'monospace' }}
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

                    {/* M/S buttons */}
                    <div style={{ display: 'flex', gap: '3px', fontSize: 9 }}>
                      <button onClick={() => toggleMute(track.id)} style={{ flex: 1, padding: '4px', borderRadius: 3, background: isMuted ? '#f4444433' : '#1a1a1a', color: isMuted ? '#ff6666' : '#666', border: `1px solid ${isMuted ? '#f44444' : '#333'}`, cursor: 'pointer', fontWeight: 700, transition: 'all 0.1s' }}>
                        M
                      </button>
                      <button onClick={() => toggleSolo(track.id)} style={{ flex: 1, padding: '4px', borderRadius: 3, background: isSolo ? '#ffcc0033' : '#1a1a1a', color: isSolo ? '#ffcc00' : '#666', border: `1px solid ${isSolo ? '#ffcc00' : '#333'}`, cursor: 'pointer', fontWeight: 700, transition: 'all 0.1s' }}>
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
                        minHeight: 26,
                        borderRadius: 3,
                        border: '1px dashed #203646',
                        background: '#060f16',
                        padding: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
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
            </div>
          )}
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
                bottom: 16,
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
                  CH{localChForArrTrack(activeFxEditor.trackId)} - {slot.type.toUpperCase()}
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
      </div>
    </div>
  );
}
