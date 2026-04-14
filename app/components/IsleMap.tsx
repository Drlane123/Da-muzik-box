/**
 * IsleMap — Visual Song Section Map
 * Floating "isles" per section, highlight when playhead is inside
 * Click to preview/select; drag section to reorder on timeline
 */
import { useMasterClock } from '@/app/context/MasterClockContext';

import { useSongArranger, SECTION_TYPE_COLORS } from '@/app/context/SongArrangerContext';

import WaveformClip from './WaveformClip';

import { Trash2, Lock } from 'lucide-react';


const ISLE_SHAPES: Record<string, string> = {
  'Intro': 'M 0,20 Q 40,0 80,20 Q 80,50 40,50 Q 0,50 0,20',
  'Verse': 'M 10,0 L 90,0 L 100,50 L 0,50 Z',
  'Chorus': 'M 0,25 L 20,0 L 80,0 L 100,25 L 80,50 L 20,50 Z',
  'Bridge': 'M 50,0 L 100,30 L 75,50 L 25,50 L 0,30 Z',
  'Outro': 'M 0,20 Q 40,0 80,20 Q 80,50 40,50 Q 0,50 0,20',
};


export default function IsleMap() {
  const { currentBar, transport, setLoopGeometry } = useMasterClock();
  const { sections, selectedSectionId, setSelectedSectionId, deleteSection } = useSongArranger();

  const playheadBar = (transport === 'playing' || transport === 'recording') ? currentBar : 0;

  function isActive(s: { startBar: number; lenBars: number }) {
    return playheadBar > 0 && playheadBar >= s.startBar && playheadBar < s.startBar + s.lenBars;
  }

  function handleIsleClick(id: number) {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    setSelectedSectionId(selectedSectionId === id ? null : id);
    // Snap loop to this section's bars (snapped to nearest valid option)
    const options = [2, 4, 8, 16, 32, 64];
    const snapped = options.reduce((p, c) => Math.abs(c - sec.lenBars) < Math.abs(p - sec.lenBars) ? c : p);
    setLoopGeometry(sec.startBar, sec.startBar + snapped - 1, sec.name);
    // Keep manual loop toggle authoritative; don't force-enable on isle click.
  }

  const selectedSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="flex flex-col gap-1 p-2" style={{ background: '#030303' }}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-bold tracking-widest" style={{ color: '#555', fontSize: '9px' }}>SECTIONS</span>
        {selectedSection && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: selectedSection.color }}>
              {selectedSection.name} · Bar {selectedSection.startBar}–{selectedSection.startBar + selectedSection.lenBars - 1}
            </span>
            <button onClick={() => deleteSection(selectedSection.id)} className="w-5 h-5 flex items-center justify-center rounded" style={{ color: '#555' }}>
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Single row isle layout */}
      <div className="flex gap-1 overflow-x-auto" style={{ minWidth: 'max-content', alignItems: 'center' }}>
        {sections.map(sec => {
          const active = isActive(sec);
          const selected = selectedSectionId === sec.id;
          const isRainbowBridge = sec.type === 'Bridge' || sec.type === 'Breakdown';
          return (
            <button key={sec.id} onClick={() => handleIsleClick(sec.id)}
              className="flex items-center gap-1 px-2 py-1 rounded transition-all relative shrink-0"
              style={{
                background: active
                  ? `${sec.color}30`
                  : selected
                    ? `${sec.color}20`
                    : '#0a0a0a',
                border: `1px solid ${active ? sec.color : selected ? sec.color + '88' : '#1e1e1e'}`,
                boxShadow: active ? `0 0 12px ${sec.color}66` : selected ? `0 0 6px ${sec.color}44` : 'none',
              }}>

              {/* Rainbow Bridge decoration */}
              {isRainbowBridge && (
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t overflow-hidden">
                  <div className="h-full w-full" style={{ background: 'linear-gradient(90deg,#ff2222,#ffcc00,#00ff88,#00E5FF,#D500F9)', opacity: active ? 1 : 0.4 }} />
                </div>
              )}

              {/* Color dot + type label */}
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sec.color }} />
              <span className="font-bold whitespace-nowrap" style={{ color: sec.color, fontSize: 8 }}>{sec.type.slice(0, 3)}</span>
              <span className="font-medium whitespace-nowrap" style={{ color: active ? '#fff' : '#888', fontSize: 8 }}>{sec.name}</span>

              {/* Active pulse indicator */}
              {active && (
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse" style={{ background: sec.color }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
