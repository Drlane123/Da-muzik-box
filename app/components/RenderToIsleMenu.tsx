/**
 * RenderToIsleMenu — right-click context menu for "Render Selection to Isle"
 * Appears on the Studio Editor timeline on right-click within a selection
 * Shows mini Isle map to pick destination, then triggers non-destructive overwrite
 */
import { useState } from 'react';

import { useSongArranger } from '@/app/context/SongArrangerContext';

import WaveformClip from './WaveformClip';

import { Download, RefreshCw, Check } from 'lucide-react';


interface RenderToIsleMenuProps {
  x: number;
  y: number;
  startBar: number;
  endBar: number;
  soloTracks: { id: number; name: string; color: string }[];
  bpm: number;
  onClose: () => void;
}


export default function RenderToIsleMenu({ x, y, startBar, endBar, soloTracks, bpm, onClose }: RenderToIsleMenuProps) {
  const { sections, setSectionWavePreview } = useSongArranger();
  const [targetId, setTargetId] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const [done, setDone] = useState(false);

  function startRender() {
    if (targetId === null) return;
    setRendering(true);
    setTimeout(() => {
      setRendering(false);
      setDone(true);
      // Non-destructive: assign new wavePreviewId (overwrites old one)
      setSectionWavePreview(targetId, targetId * 7919 + startBar * 113 + (Date.now() % 9999));
      setTimeout(onClose, 900);
    }, 1200);
  }

  const selLen = endBar - startBar + 1;
  const targetSec = sections.find(s => s.id === targetId);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div className="fixed z-50 rounded-xl shadow-2xl overflow-hidden"
        style={{ left: Math.min(x, window.innerWidth - 300), top: Math.min(y, window.innerHeight - 400), width: 280, background: '#0d0d0d', border: '1px solid #2a2a2a', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: '#242424', borderBottom: '1px solid #2c2c2c' }}>
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#00ff8822', color: '#00ff88' }}>
            <Download size={11} />
          </div>
          <div>
            <p className="font-bold" style={{ color: '#fff', fontSize: 11 }}>Render to Isle</p>
            <p style={{ color: '#555', fontSize: 9, fontFamily: 'monospace' }}>
              Bars {startBar}–{endBar} · {selLen}B · {bpm} BPM · 44.1kHz
              {soloTracks.length > 0 && ` · Solo: ${soloTracks.map(t => t.name).join(', ')}`}
            </p>
          </div>
        </div>

        {/* Isle selection grid */}
        <div className="p-2 flex flex-col gap-1.5" style={{ maxHeight: 240, overflowY: 'auto' }}>
          <p style={{ color: '#555', fontSize: 9, padding: '2px 4px' }}>SELECT DESTINATION ISLE:</p>
          {sections.map(sec => {
            const isOccupied = sec.wavePreviewId !== undefined;
            const isSelected = targetId === sec.id;
            const isRainbow = sec.type === 'Bridge' || sec.type === 'Breakdown';
            return (
              <button key={sec.id} onClick={() => setTargetId(isSelected ? null : sec.id)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all"
                style={{ background: isSelected ? `${sec.color}22` : '#242424', border: `1px solid ${isSelected ? sec.color : '#222'}` }}>

                {/* Rainbow indicator */}
                {isRainbow ? (
                  <div className="w-2 h-6 rounded-full shrink-0 overflow-hidden">
                    <div className="w-full h-full" style={{ background: 'linear-gradient(180deg,#ff2222,#ffcc00,#00ff88,#00E5FF,#D500F9)' }} />
                  </div>
                ) : (
                  <div className="w-2 h-6 rounded-full shrink-0" style={{ background: sec.color }} />
                )}

                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-bold" style={{ color: isSelected ? sec.color : '#aaa', fontSize: 10 }}>{sec.name}</span>
                  <span style={{ color: '#444', fontSize: 8, fontFamily: 'monospace' }}>
                    Bar {sec.startBar} · {sec.lenBars}B
                    {isOccupied && ' · ⚠ occupied'}
                  </span>
                </div>

                {/* Mini waveform preview of current content */}
                {sec.wavePreviewId !== undefined && (
                  <div style={{ width: 40, height: 20 }}>
                    <WaveformClip clipId={sec.wavePreviewId} color={sec.color} trackType="MIDI" width={40} height={20} vZoom={1} />
                  </div>
                )}

                {isSelected && <Check size={12} style={{ color: sec.color, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        {/* Overwrite notice */}
        {targetSec?.wavePreviewId !== undefined && (
          <div className="mx-2 mb-2 px-2 py-1.5 rounded" style={{ background: '#ff440011', border: '1px solid #ff440033' }}>
            <p style={{ color: '#ff6b35', fontSize: 9 }}>
              ⚠ Drop-to-Replace: This will overwrite the existing audio on <strong>{targetSec.name}</strong>. Non-destructive — original tracks are unchanged.
            </p>
          </div>
        )}

        {/* Render button */}
        <div className="p-2 pt-0">
          <button onClick={startRender} disabled={targetId === null || rendering || done}
            className="w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: done ? '#00ff8822' : targetId === null ? '#242424' : rendering ? '#2c2c2c' : 'linear-gradient(135deg,#00ff88,#00E5FF)',
              color: done ? '#00ff88' : targetId === null ? '#444' : rendering ? '#555' : '#000',
              fontSize: 11, cursor: targetId === null ? 'not-allowed' : 'pointer',
              border: done ? '1px solid #00ff8844' : 'none',
            }}>
            {done
              ? <><Check size={12} /> Placed on {targetSec?.name}!</>
              : rendering
                ? <><RefreshCw size={12} className="animate-spin" /> Rendering 44.1kHz…</>
                : <><Download size={12} /> {targetId ? `Print to ${targetSec?.name}` : 'Select a destination'}</>
            }
          </button>
        </div>
      </div>
    </>
  );
}
