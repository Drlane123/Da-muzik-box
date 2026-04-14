import { useState, useRef, useEffect } from 'react';

import { Play, Pause, Volume2 } from 'lucide-react';


const STYLES = [
  { id: 'soulful',   label: 'Soulful',   color: '#ff6b35' },
  { id: 'gritty',    label: 'Gritty',    color: '#888' },
  { id: 'smooth',    label: 'Smooth',    color: '#00E5FF' },
  { id: 'warm',      label: 'Warm',      color: '#ffcc00' },
  { id: 'energetic', label: 'Energetic', color: '#D500F9' },
  { id: 'ethereal',  label: 'Ethereal',  color: '#a78bfa' },
];


interface VoiceSwapPanelProps {
  hasAudio: boolean;
}


export default function VoiceSwapPanel({ hasAudio }: VoiceSwapPanelProps) {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(60);
  const [applied, setApplied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [meterLevel, setMeterLevel] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
    
    const meterInterval = setInterval(() => {
      setMeterLevel(Math.random() * 100);
    }, 50);
    
    return () => clearInterval(meterInterval);
  }, [isPlaying]);

  function handleApply() {
    if (!selectedStyle || !hasAudio) return;
    setApplied(false);
    setTimeout(() => setApplied(true), 800);
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#D500F9' }}>
        AI Voice Swap
      </span>
      <p className="text-xs" style={{ color: '#555' }}>
        Transform your voice into a professional artist tone.
      </p>

      {/* Style cards */}
      <div className="grid grid-cols-3 gap-2">
        {STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => { setSelectedStyle(s.id); setApplied(false); }}
            className="py-2.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: selectedStyle === s.id ? `${s.color}22` : '#111',
              border: '1px solid',
              borderColor: selectedStyle === s.id ? s.color : '#222',
              color: selectedStyle === s.id ? s.color : '#555',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Intensity slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs" style={{ color: '#555' }}>
          <span>Intensity</span>
          <span style={{ color: '#D500F9' }}>{intensity}%</span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: '#333' }}>
          <span>Subtle</span>
          <input
            type="range" min={0} max={100} value={intensity}
            onChange={e => { setIntensity(Number(e.target.value)); setApplied(false); }}
            className="flex-1 h-1.5 accent-[#D500F9]"
          />
          <span>Full</span>
        </div>
      </div>

      <button
        onClick={handleApply}
        disabled={!selectedStyle || !hasAudio}
        className="py-2 rounded text-xs font-bold transition-all"
        style={{
          background: selectedStyle && hasAudio ? '#D500F9' : '#1a1a1a',
          color: selectedStyle && hasAudio ? '#000' : '#444',
          cursor: selectedStyle && hasAudio ? 'pointer' : 'not-allowed',
        }}
      >
        {selectedStyle ? `Apply ${STYLES.find(s => s.id === selectedStyle)?.label} Voice` : 'Select a style'}
      </button>

      {applied && (
        <div className="flex flex-col gap-3 border-t border-gray-700 pt-3">
          <p className="text-xs font-semibold" style={{ color: '#D500F9' }}>
            ✓ Voice swap applied at {intensity}% intensity
          </p>

          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-all"
              style={{
                background: isPlaying ? '#D500F9' : '#1a1a1a',
                color: isPlaying ? '#000' : '#D500F9',
                border: '1px solid #D500F944',
                cursor: 'pointer'
              }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ color: '#888', fontSize: '10px', minWidth: '28px' }}>{volume}%</span>
          </div>

          {/* Meter Reading */}
          {isPlaying && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Volume2 size={12} style={{ color: '#D500F9' }} />
                <span style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', flex: 1 }}>LEVEL</span>
                <span style={{ fontSize: '9px', color: '#D500F9', fontWeight: 'bold' }}>{Math.round(meterLevel)}%</span>
              </div>
              <div style={{ display: 'flex', gap: '2px', height: '16px' }}>
                {Array.from({ length: 16 }).map((_, i) => {
                  const threshold = (i / 16) * 100;
                  const isActive = meterLevel > threshold;
                  let color = '#1a1a1a';
                  if (isActive) {
                    color = threshold > 85 ? '#ff4444' : threshold > 70 ? '#ffaa00' : '#D500F9';
                  }
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        background: color,
                        borderRadius: '1px',
                        transition: 'all 50ms'
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
