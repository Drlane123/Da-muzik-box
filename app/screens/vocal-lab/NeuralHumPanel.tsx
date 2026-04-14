import { useState, useRef } from 'react';

import { Play, Pause, Volume2 } from 'lucide-react';


const INSTRUMENTS = [
  { id: 'trumpet',   label: 'Trumpet',     emoji: '🎺', desc: 'Bright & bold brass sound' },
  { id: 'saxophone', label: 'Saxophone',   emoji: '🎷', desc: 'Smooth & soulful tone' },
  { id: 'guitar',    label: 'Guitar',      emoji: '🎸', desc: 'Warm acoustic or electric' },
  { id: 'bass',      label: 'Bass',        emoji: '🥁', desc: 'Deep & punchy low end' },
  { id: 'piano',     label: 'Piano',       emoji: '🎹', desc: 'Elegant & versatile' },
  { id: 'violin',    label: 'Violin',      emoji: '🎻', desc: 'Soaring & expressive' },
  { id: 'flute',     label: 'Flute',       emoji: '🪈', desc: 'Airy & melodic' },
  { id: 'synth',     label: 'Analog Synth',emoji: '🎛️', desc: 'Electronic & futuristic' },
];


interface NeuralHumPanelProps {
  hasAudio: boolean;
}


export default function NeuralHumPanel({ hasAudio }: NeuralHumPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [done, setDone] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [meterLevel, setMeterLevel] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  function handleTransform() {
    if (!selected || !hasAudio) return;
    setDone(false);
    setProgress(0);
    const stages = ['Analyzing melody…', 'Mapping timbre…', 'Rendering performance…', 'Finalizing…'];
    let step = 0;
    const tick = setInterval(() => {
      step++;
      setStage(stages[Math.min(step - 1, stages.length - 1)]);
      setProgress(Math.min(step * 26, 100));
      if (step >= 4) {
        clearInterval(tick);
        setProgress(100);
        setStage('Complete!');
        setDone(true);
      }
    }, 700);
  }

  function handlePlayPause() {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Simulate meter reading
      const meterInterval = setInterval(() => {
        setMeterLevel(Math.random() * 100);
      }, 50);
      setTimeout(() => clearInterval(meterInterval), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <span className="text-sm font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>
          Neural Hum-to-Instrument
        </span>
        <p className="text-xs mt-1" style={{ color: '#888' }}>
          Hum, whistle or beatbox — AI converts it to a professional instrument performance.
        </p>
      </div>

      {/* Instrument grid - LARGER TABS */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {INSTRUMENTS.map(inst => (
          <button
            key={inst.id}
            onClick={() => setSelected(inst.id)}
            className="flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-lg text-sm transition-all hover:scale-105"
            style={{
              background: selected === inst.id ? 'rgba(0,229,255,0.2)' : '#111',
              border: '2px solid',
              borderColor: selected === inst.id ? '#00E5FF' : '#222',
              color: selected === inst.id ? '#00E5FF' : '#666',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: 48 }}>{inst.emoji}</span>
            <div className="text-center">
              <span className="font-bold block">{inst.label}</span>
              <span className="text-10px" style={{ color: selected === inst.id ? '#00E5FF88' : '#555' }}>
                {inst.desc}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Transform button + progress */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleTransform}
          disabled={!selected || !hasAudio}
          className="py-3 rounded-lg text-sm font-bold transition-all"
          style={{
            background: selected && hasAudio ? '#00E5FF' : '#1a1a1a',
            color: selected && hasAudio ? '#000' : '#444',
            cursor: selected && hasAudio ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          {selected ? `Transform to ${INSTRUMENTS.find(i => i.id === selected)?.label}` : 'Select an instrument'}
        </button>

        {progress > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm" style={{ color: '#888' }}>
              <span>{stage}</span>
              <span style={{ color: '#00E5FF', fontWeight: 'bold' }}>{progress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: '#00E5FF', boxShadow: '0 0 12px #00E5FF' }}
              />
            </div>
            {done && (
              <p className="text-sm font-semibold text-center" style={{ color: '#00E5FF' }}>
                ✓ Transformation complete!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Playback & Meter Section */}
      {done && (
        <div className="flex flex-col gap-3 border-t border-gray-700 pt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-bold text-sm transition-all"
              style={{
                background: isPlaying ? '#00ff88' : '#1a1a1a',
                color: isPlaying ? '#000' : '#00ff88',
                border: '1px solid #00ff8844',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
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
            <span style={{ color: '#888', fontSize: '12px', minWidth: '30px' }}>{volume}%</span>
          </div>

          {/* Meter Reading */}
          {isPlaying && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Volume2 size={14} style={{ color: '#00ff88' }} />
                <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>LEVEL</span>
              </div>
              <div style={{ display: 'flex', gap: '2px', height: '20px' }}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const threshold = (i / 12) * 100;
                  const isActive = meterLevel > threshold;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        background: isActive ? (threshold > 80 ? '#ff4444' : threshold > 60 ? '#ffaa00' : '#00ff88') : '#1a1a1a',
                        borderRadius: '2px',
                        transition: 'all 50ms'
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', color: '#888' }}>
                {Math.round(meterLevel)}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
