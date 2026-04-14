import { useState } from 'react';

import { Plus, Mic2, Trash2 } from 'lucide-react';


interface VocalTrack {
  id: number;
  name: string;
  channel: number;
  color: string;
}


const TRACK_COLORS = ['#D500F9', '#00E5FF', '#ff6b35', '#00ff88', '#ffcc00', '#a78bfa'];


export default function VocalTracksPanel() {
  const [tracks, setTracks] = useState<VocalTrack[]>([
    { id: 1, name: 'Vocal Track 1', channel: 17, color: '#D500F9' },
  ]);

  function addTrack() {
    const id = tracks.length + 1;
    setTracks(prev => [...prev, {
      id,
      name: `Vocal Track ${id}`,
      channel: 17 + id - 1,
      color: TRACK_COLORS[(id - 1) % TRACK_COLORS.length],
    }]);
  }

  function removeTrack(id: number) {
    setTracks(prev => prev.filter(t => t.id !== id));
  }

  function updateName(id: number, name: string) {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  }

  function updateChannel(id: number, channel: number) {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, channel } : t));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#D500F9' }}>
          AI Vocal Tracks
        </span>
        <button
          onClick={addTrack}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
          style={{ background: 'rgba(213,0,249,0.15)', color: '#D500F9', border: '1px solid rgba(213,0,249,0.3)' }}
        >
          <Plus size={11} /> Add Vocal Track
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {tracks.map(track => (
          <div
            key={track.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: '#0d0d0d', border: `1px solid ${track.color}33` }}
          >
            {/* Color indicator */}
            <div className="w-2 h-8 rounded-full shrink-0" style={{ background: track.color }} />

            {/* Icon */}
            <Mic2 size={13} style={{ color: track.color, flexShrink: 0 }} />

            {/* Name */}
            <input
              type="text"
              value={track.name}
              onChange={e => updateName(track.id, e.target.value)}
              className="flex-1 bg-transparent text-xs font-medium outline-none min-w-0"
              style={{ color: '#ccc' }}
            />

            {/* Waveform thumbnail placeholder */}
            <div
              className="w-20 h-6 rounded flex items-center justify-center shrink-0"
              style={{ background: '#111', overflow: 'hidden' }}
            >
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 mx-px rounded-full"
                  style={{
                    height: `${10 + Math.sin(i * 1.3) * 8}px`,
                    background: track.color,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>

            {/* Channel selector */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs" style={{ color: '#555' }}>CH</span>
              <select
                value={track.channel}
                onChange={e => updateChannel(track.id, Number(e.target.value))}
                className="text-xs rounded px-1 py-0.5 outline-none"
                style={{ background: '#1a1a1a', color: '#00E5FF', border: '1px solid #222', width: 44 }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>

            <button onClick={() => removeTrack(track.id)} className="shrink-0" style={{ color: '#333' }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: '#333' }}>
        Each track gets a dedicated mixer channel. Tracks auto-appear in Studio Editor.
      </p>
    </div>
  );
}
