/**
 * SectionBar — draggable + resizable section container blocks on the arranger ruler
 * - Drag body to move section
 * - Drag right edge to resize (bar-snap)
 * - Click to select & snap loop
 * - Add button: multiple sections of same type allowed
 */
import { useState } from 'react';

import { useMasterClock } from '@/app/context/MasterClockContext';

import { useSongArranger, SECTION_TYPE_COLORS } from '@/app/context/SongArrangerContext';

import type { SectionType } from '@/app/context/SongArrangerContext';

import { Plus, Trash2 } from 'lucide-react';


const SECTION_TYPES: SectionType[] = ['Intro','Verse','Pre-Chorus','Chorus','Bridge','Breakdown','Drop','Build','Outro'];


interface SectionBarProps {
  colW: number;
  totalBars: number;
}


type DragMode = 'move' | 'resize';


export default function SectionBar({ colW, totalBars }: SectionBarProps) {
  const { currentBar, transport, setLoopGeometry } = useMasterClock();
  const { sections, selectedSectionId, setSelectedSectionId, moveSection, resizeSection, addSection, deleteSection } = useSongArranger();

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('move');
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOrigBar, setDragOrigBar] = useState(1);
  const [dragOrigLen, setDragOrigLen] = useState(4);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [pickerType, setPickerType] = useState<SectionType | null>(null);
  const [pickerBars, setPickerBars] = useState(4);

  const playheadBar = (transport === 'playing' || transport === 'recording') ? currentBar : 0;

  function snapLoop(secId: number) {
    const sec = sections.find(s => s.id === secId);
    if (!sec) return;
    const opts = [2, 4, 8, 16, 32, 64];
    const snapped = opts.reduce((p, c) => Math.abs(c - sec.lenBars) < Math.abs(p - sec.lenBars) ? c : p);
    setLoopGeometry(sec.startBar, sec.startBar + snapped - 1, sec.name);
    // Keep manual loop toggle authoritative; don't force-enable on section snap.
  }

  function onBodyMouseDown(id: number, e: React.MouseEvent, origBar: number) {
    e.stopPropagation();
    setDraggingId(id); setDragMode('move');
    setDragStartX(e.clientX); setDragOrigBar(origBar);
    setSelectedSectionId(id);
    snapLoop(id);
  }

  function onResizeMouseDown(id: number, e: React.MouseEvent, origLen: number) {
    e.stopPropagation();
    setDraggingId(id); setDragMode('resize');
    setDragStartX(e.clientX); setDragOrigLen(origLen);
    setSelectedSectionId(id);
  }

  function onMouseMove(e: React.MouseEvent) {
    if (draggingId === null) return;
    const deltaBars = Math.round((e.clientX - dragStartX) / colW);
    if (dragMode === 'move') {
      moveSection(draggingId, Math.max(1, dragOrigBar + deltaBars));
    } else {
      resizeSection(draggingId, Math.max(1, dragOrigLen + deltaBars));
    }
  }

  function onMouseUp() {
    if (draggingId !== null) snapLoop(draggingId);
    setDraggingId(null);
  }

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ height: 32, width: colW * totalBars, background: '#050505', borderBottom: '1px solid #1a1a1a' }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {sections.map(sec => {
        const active = playheadBar > 0 && playheadBar >= sec.startBar && playheadBar < sec.startBar + sec.lenBars;
        const selected = selectedSectionId === sec.id;
        const left = (sec.startBar - 1) * colW;
        const width = Math.max(colW, sec.lenBars * colW);
        const isRainbow = sec.type === 'Bridge' || sec.type === 'Breakdown';
        const isMoving = draggingId === sec.id && dragMode === 'move';
        const isResizing = draggingId === sec.id && dragMode === 'resize';

        return (
          <div
            key={sec.id}
            className="absolute top-0 flex items-center overflow-hidden"
            style={{
              left: left + 1,
              width: width - 2,
              height: 32,
              background: active ? `${sec.color}40` : selected ? `${sec.color}28` : `${sec.color}16`,
              border: `1.5px solid ${active ? sec.color : selected ? sec.color + 'aa' : sec.color + '55'}`,
              borderRadius: 3,
              boxShadow: active ? `0 0 10px ${sec.color}66` : isMoving ? `0 0 14px ${sec.color}` : 'none',
              zIndex: isMoving || isResizing ? 30 : selected ? 12 : 5,
              cursor: isMoving ? 'grabbing' : 'default',
            }}
          >
            {/* Rainbow strip */}
            {isRainbow && (
              <div className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: 'linear-gradient(90deg,#ff2222,#ffcc00,#00ff88,#00E5FF,#D500F9)' }} />
            )}

            {/* Drag body (left 80%) */}
            <div
              className="flex-1 flex items-center pl-1.5 overflow-hidden h-full"
              style={{ cursor: 'grab' }}
              onMouseDown={e => onBodyMouseDown(sec.id, e, sec.startBar)}
            >
              <span className="font-bold truncate" style={{ color: active ? '#fff' : sec.color, fontSize: 8, fontFamily: 'monospace' }}>
                {sec.name} <span style={{ opacity: 0.5 }}>{sec.lenBars}B</span>
              </span>
            </div>

            {/* Delete on selected */}
            {selected && width > 48 && (
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { deleteSection(sec.id); setSelectedSectionId(null); }}
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-60 hover:opacity-100 mr-0.5"
                style={{ color: sec.color }}
              >
                <Trash2 size={8} />
              </button>
            )}

            {/* Resize handle (right edge) */}
            <div
              className="absolute top-0 right-0 h-full flex items-center justify-center"
              style={{ width: 8, cursor: 'ew-resize', background: selected ? `${sec.color}44` : 'transparent' }}
              onMouseDown={e => onResizeMouseDown(sec.id, e, sec.lenBars)}
            >
              <div className="h-4 w-0.5 rounded-full" style={{ background: sec.color, opacity: 0.7 }} />
            </div>
          </div>
        );
      })}

      {/* Add section menu */}
      <div className="absolute top-0 right-0 z-40 flex gap-1">
        <button
          onClick={() => {
            setPickerType('Intro');
            setShowDurationPicker(true);
          }}
          className="h-8 px-2 flex items-center gap-1 font-bold transition-all active:scale-90"
          style={{ background: '#1a2a2a', color: '#00E5FF', fontSize: 9, border: '1px solid #00E5FF33' }}
          title="Add custom Intro with duration"
        >
          <Plus size={9} /> INTRO
        </button>
        <button
          onClick={() => setShowAddMenu(v => !v)}
          className="h-8 px-2 flex items-center gap-1 font-bold transition-all active:scale-90"
          style={{ background: '#111', color: '#555', fontSize: 9 }}
          title="Add any section type"
        >
          <Plus size={9} /> SEC
        </button>
        {showAddMenu && (
          <div
            className="absolute right-0 top-full mt-0.5 rounded-lg p-1 z-50 grid gap-0.5"
            style={{ background: '#1a1a1a', border: '1px solid #333', gridTemplateColumns: '1fr 1fr', minWidth: 170 }}
          >
            {SECTION_TYPES.map(type => (
              <button
                key={type}
                onClick={() => {
                  setPickerType(type);
                  setShowDurationPicker(true);
                  setShowAddMenu(false);
                }}
                className="px-2 py-1.5 rounded text-xs text-left font-bold transition-all active:scale-90"
                style={{ color: SECTION_TYPE_COLORS[type], background: `${SECTION_TYPE_COLORS[type]}11` }}
              >
                {type}
              </button>
            ))}
          </div>
        )}
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
                  style={{ background: '#111', color: '#00E5FF', border: '1px solid #333' }}
                />
              </div>
              <button
                onClick={() => setPickerBars(Math.min(64, pickerBars + 1))}
                className="w-8 h-8 rounded flex items-center justify-center font-bold transition-all active:scale-90"
                style={{ background: '#333', color: '#888' }}>+</button>
            </div>
            <div className="text-xs mb-4" style={{ color: '#555' }}>
              Duration: <span style={{ color: '#00E5FF', fontFamily: 'monospace', fontWeight: 'bold' }}>{pickerBars} bars</span>
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
                }}
                className="flex-1 px-3 py-2 rounded text-xs font-bold transition-all active:scale-90"
                style={{ background: SECTION_TYPE_COLORS[pickerType], color: '#000' }}>
                Add {pickerType}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
