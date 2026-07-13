/**
 * Piano Roll + Waveform visualization for melody transcription
 * Shows MIDI notes detected from pitch detection
 */

import { useEffect, useRef, useState } from 'react';

import { Volume2, ZoomIn, ZoomOut } from 'lucide-react';


const PPQ = 960;

const PIANO_KEYS = 128;

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];


export function WaveformVisualizer({ analyzerNode, isRecording }: { analyzerNode: AnalyserNode | null; isRecording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyzerNode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyzerNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyzerNode.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw frequency bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      if (isRecording) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    if (isRecording) {
      animationRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyzerNode, isRecording]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={120}
        style={{ display: 'block', width: '100%', height: 120 }}
      />
    </div>
  );
}


export function VolumeMeter({ analyzerNode, isRecording }: { analyzerNode: AnalyserNode | null; isRecording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const levelRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current || !analyzerNode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const dataArray = new Uint8Array(analyzerNode.frequencyBinCount);

    const draw = () => {
      analyzerNode.getByteFrequencyData(dataArray);

      // Calculate RMS for volume level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length) / 255;
      levelRef.current = rms * 100;

      // Clear canvas
      ctx.fillStyle = '#242424';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw background grid
      ctx.fillStyle = '#2c2c2c';
      for (let i = 0; i < 10; i++) {
        const y = (canvas.height / 10) * i;
        ctx.fillRect(0, y, canvas.width, 1);
      }

      // Draw level indicator with gradient
      const levelHeight = (levelRef.current / 100) * canvas.height;
      const barGradient = ctx.createLinearGradient(0, canvas.height - levelHeight, 0, canvas.height);
      barGradient.addColorStop(0, '#00ff88');
      barGradient.addColorStop(0.7, '#ffcc00');
      barGradient.addColorStop(1, '#ff6b35');

      ctx.fillStyle = barGradient;
      ctx.fillRect(0, canvas.height - levelHeight, canvas.width, levelHeight);

      // Draw peak indicator
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(0, Math.max(0, canvas.height - (95 / 100) * canvas.height), canvas.width, 2);

      if (isRecording) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    if (isRecording) {
      animationRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyzerNode, isRecording]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Volume2 size={14} style={{ color: '#00ff88' }} />
        <span className="text-xs font-bold" style={{ color: '#ccc' }}>Input Level</span>
      </div>
      <canvas
        ref={canvasRef}
        width={60}
        height={140}
        style={{ display: 'block', border: '1px solid #303030', borderRadius: 4, background: '#1c1c1c' }}
      />
    </div>
  );
}


export function PianoRollEditor({
  midiNotes,
  onNotesChange,
  bpm,
  loopLength,
  pitchEvents,
  onBpmChange,
  isPlaying,
  onPlayStop,
  playheadPosition,
  onUndo
}: {
  midiNotes: Array<{ pitch: number; start: number; duration: number; velocity: number }>;
  onNotesChange: (notes: Array<{ pitch: number; start: number; duration: number; velocity: number }>) => void;
  bpm: number;
  loopLength: number;
  pitchEvents?: Array<{ time: number; frequency: number; confidence: number }>;
  onBpmChange?: (newBpm: number) => void;
  isPlaying?: boolean;
  onPlayStop?: () => void;
  playheadPosition?: number;
  onUndo?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [localBpm, setLocalBpm] = useState(bpm);

  const pixelsPerBeatBase = 40;
  const pixelsPerBeat = pixelsPerBeatBase * zoom;
  const keyHeight = 24;
  const keyAreaWidth = 100;

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalBeats = loopLength * 4;
    const msPerBeat = 60000 / bpm;

    // Set canvas resolution to match display size
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Clear background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw piano keys on left
    ctx.fillStyle = '#242424';
    ctx.fillRect(0, 0, keyAreaWidth, canvas.height);

    // Draw octave labels and key dividers
    for (let i = 0; i < PIANO_KEYS; i++) {
      const y = (PIANO_KEYS - i - 1) * keyHeight - scrollY;
      if (y < -keyHeight || y > canvas.height) continue;

      const isWhiteKey = WHITE_KEYS.includes(i % 12);
      const hasPitch = midiNotes.some(note => note.pitch === i);
      
      // Key background - highlight detected pitches
      if (hasPitch) {
        ctx.fillStyle = isWhiteKey ? '#00FF8833' : '#00FF8822';
      } else {
        ctx.fillStyle = isWhiteKey ? '#222' : '#242424';
      }
      ctx.fillRect(0, y, keyAreaWidth, keyHeight);

      // Key border - bright for detected notes
      ctx.strokeStyle = hasPitch ? '#00FF88' : '#2c2c2c';
      ctx.lineWidth = hasPitch ? 1.5 : 1;
      ctx.strokeRect(0, y, keyAreaWidth, keyHeight);

      // Label every octave (C notes) and all detected notes
      const isLabelKey = i % 12 === 0 || hasPitch;
      
      if (isLabelKey && y > 0 && y < canvas.height) {
        const noteName = NOTE_NAMES[i % 12];
        const octave = Math.floor(i / 12) - 1;
        
        ctx.fillStyle = hasPitch ? '#00FF88' : '#888';
        ctx.font = `bold ${hasPitch ? 11 : 9}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${noteName}${octave}`, keyAreaWidth - 10, y + keyHeight / 2);
        
        // Show indicator dot for detected notes
        if (hasPitch) {
          ctx.fillStyle = '#00FF88';
          ctx.shadowColor = '#00FF88';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(12, y + keyHeight / 2, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowColor = 'transparent';
        }
      }
    }

    // Draw grid area background
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(keyAreaWidth, 0, canvas.width - keyAreaWidth, canvas.height);

    // Draw vertical beat grid lines
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = keyAreaWidth + beat * pixelsPerBeat - scrollX;
      if (x < keyAreaWidth || x > canvas.width) continue;

      const major = beat % 4 === 0;
      ctx.strokeStyle = major ? '#2a2a2a' : '#2c2c2c';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      // Beat numbers
      if (major) {
        ctx.fillStyle = '#444';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(beat / 4 + 1), x, 15);
      }
    }

    // Draw horizontal key dividers
    for (let i = 0; i < PIANO_KEYS; i++) {
      const y = (PIANO_KEYS - i - 1) * keyHeight - scrollY;
      if (y < 0 || y > canvas.height) continue;

      const isWhiteKey = WHITE_KEYS.includes(i % 12);
      ctx.strokeStyle = isWhiteKey ? '#2c2c2c' : '#222222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(keyAreaWidth, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw MIDI notes with vibrant NEON colors
    midiNotes.forEach((note, idx) => {
      const y = (PIANO_KEYS - note.pitch - 1) * keyHeight - scrollY;
      const noteWidthBeats = note.duration / PPQ;
      const noteWidth = noteWidthBeats * pixelsPerBeat;
      const x = keyAreaWidth + (note.start / PPQ) * pixelsPerBeat - scrollX;

      if (x + noteWidth < keyAreaWidth || x > canvas.width) return;

      // NEON color palette - vivid & saturated
      const neonColors = [
        { light: '#FF006E', dark: '#FF0050' },  // Hot pink
        { light: '#FB5607', dark: '#E04600' },  // Orange
        { light: '#FFBE0B', dark: '#E8A800' },  // Yellow
        { light: '#8338EC', dark: '#6A2DE8' },  // Purple
        { light: '#3A86FF', dark: '#1F6FFF' },  // Blue
        { light: '#06FFA5', dark: '#00E880' },  // Mint
        { light: '#FF006E', dark: '#FF0050' },  // Hot pink (repeat)
        { light: '#00F5FF', dark: '#00D4E8' },  // Cyan
        { light: '#FF0080', dark: '#E6006E' },  // Magenta
        { light: '#39FF14', dark: '#2FE008' },  // Neon green
        { light: '#FF10F0', dark: '#E600D4' },  // Neon purple
        { light: '#00FFFF', dark: '#00E8E8' }   // Bright cyan
      ];
      
      const neon = neonColors[note.pitch % 12];
      const noteX = Math.max(keyAreaWidth, x);
      const noteW = Math.min(noteWidth, canvas.width - noteX);
      
      // Main note body - NEON GLOW
      const gradient = ctx.createLinearGradient(noteX, y + 2, noteX, y + keyHeight - 2);
      gradient.addColorStop(0, neon.light);
      gradient.addColorStop(1, neon.dark);
      ctx.fillStyle = gradient;
      ctx.fillRect(noteX, y + 2, noteW, keyHeight - 4);

      // Super glowing border - NEON effect
      ctx.strokeStyle = neon.light;
      ctx.lineWidth = 3;
      ctx.shadowColor = neon.light;
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeRect(noteX, y + 2, noteW, keyHeight - 4);
      
      // Double glow layer
      ctx.shadowColor = neon.light;
      ctx.shadowBlur = 25;
      ctx.strokeStyle = neon.light + '88';
      ctx.lineWidth = 1;
      ctx.strokeRect(noteX - 1, y + 1, noteW + 2, keyHeight - 2);
      ctx.shadowColor = 'transparent';

      // Velocity indicator - BRIGHT INNER
      const velHeight = (note.velocity / 127) * (keyHeight - 8);
      ctx.fillStyle = neon.light + 'CC';
      ctx.fillRect(noteX + 2, y + keyHeight - 2 - velHeight, noteW - 4, velHeight);
    });

    // Draw pitch detection confidence visualization
    if (pitchEvents && pitchEvents.length > 0) {
      pitchEvents.forEach(event => {
        const A4 = 440;
        const A4_MIDI = 69;
        const semitones = 12 * Math.log2(event.frequency / A4);
        const pitch = Math.round(A4_MIDI + semitones);

        if (pitch < 0 || pitch > 127) return;

        const y = (PIANO_KEYS - pitch - 1) * keyHeight - scrollY;
        const beatTime = event.time / msPerBeat;
        const x = keyAreaWidth + beatTime * pixelsPerBeat - scrollX;

        ctx.fillStyle = `rgba(100, 200, 255, ${event.confidence * 0.1})`;
        ctx.fillRect(x, y, 2, keyHeight);
      });
    }

    // Draw playhead line - always visible
    if (typeof playheadPosition === 'number' && playheadPosition >= 0) {
      const playheadBeat = playheadPosition;
      const playheadX = keyAreaWidth + playheadBeat * pixelsPerBeat - scrollX;
      
      if (playheadX > keyAreaWidth && playheadX < canvas.width) {
        // Triple-layer playhead for visibility
        // Back shadow
        ctx.strokeStyle = '#00E5FF44';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, canvas.height);
        ctx.stroke();
        
        // Main line
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, canvas.height);
        ctx.stroke();
        
        // Arrow indicator at top
        ctx.fillStyle = '#00FFFF';
        ctx.beginPath();
        ctx.moveTo(playheadX, 8);
        ctx.lineTo(playheadX - 5, 0);
        ctx.lineTo(playheadX + 5, 0);
        ctx.fill();
        
        ctx.shadowColor = 'transparent';
      }
    }
  }, [midiNotes, bpm, loopLength, zoom, scrollX, scrollY, pitchEvents]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const y = e.clientY - rect.top + scrollY;

    // Check if clicking on grid area
    if (x < keyAreaWidth) return;

    // Calculate note
    const beatClicked = (x - keyAreaWidth) / pixelsPerBeat;
    const pitchClicked = PIANO_KEYS - Math.floor(y / keyHeight) - 1;

    if (pitchClicked < 0 || pitchClicked > 127) return;

    // Check if clicking on existing note to delete
    const clickedNoteIdx = midiNotes.findIndex(note => {
      const noteStart = note.start / PPQ;
      const noteEnd = noteStart + note.duration / PPQ;
      const notePitch = note.pitch;
      return beatClicked >= noteStart && beatClicked < noteEnd && Math.abs(pitchClicked - notePitch) < 1;
    });

    if (clickedNoteIdx >= 0) {
      // Delete note
      const updated = midiNotes.filter((_, i) => i !== clickedNoteIdx);
      onNotesChange(updated);
    } else {
      // Add new note (quarter note duration)
      const newNote = {
        pitch: Math.max(0, Math.min(127, pitchClicked)),
        start: Math.round(beatClicked * PPQ),
        duration: PPQ, // Quarter note
        velocity: 100
      };
      onNotesChange([...midiNotes, newNote].sort((a, b) => a.start - b.start));
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Zoom with Ctrl+Scroll
    if (e.ctrlKey) {
      const newZoom = Math.max(0.5, Math.min(4, zoom + (e.deltaY > 0 ? -0.2 : 0.2)));
      setZoom(newZoom);
    } else {
      // Pan with regular scroll - bidirectional
      // deltaY > 0 = scroll down = increase scrollY = move view down
      // deltaY < 0 = scroll up = decrease scrollY = move view up
      setScrollY(prev => {
        const sensitivity = 1;
        const newScrollY = prev + (e.deltaY * sensitivity);
        const maxScroll = PIANO_KEYS * 24 - 100;
        return Math.max(0, Math.min(newScrollY, maxScroll));
      });
      
      // Horizontal pan with Shift+Scroll
      if (e.shiftKey) {
        setScrollX(prev => {
          const newScrollX = prev + (e.deltaX * 1.5);
          return Math.max(0, newScrollX);
        });
      }
    }
  };

  return (
    <div ref={containerRef} className="rounded-xl overflow-hidden flex flex-col w-full" style={{ background: '#1c1c1c', border: '1px solid #303030', height: 650 }}>
      {/* Controls Top Bar */}
      <div className="flex items-center justify-between gap-3 p-3 border-b" style={{ borderColor: '#303030', background: '#2c2c2c' }}>
        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} className="p-1.5 rounded hover:bg-slate-800"
            style={{ color: '#666', background: '#242424', border: '1px solid #222', cursor: 'pointer' }}>
            <ZoomOut size={14} />
          </button>
          <span className="text-10px font-mono" style={{ color: '#666', minWidth: 40 }}>{(zoom * 100).toFixed(0)}%</span>
          <button onClick={() => setZoom(Math.min(4, zoom + 0.2))} className="p-1.5 rounded hover:bg-slate-800"
            style={{ color: '#666', background: '#242424', border: '1px solid #222', cursor: 'pointer' }}>
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 rounded" style={{ background: '#242424', border: '1px solid #222' }}>
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (onUndo) onUndo();
              }} 
              className="px-2 py-1.5 rounded transition-all active:scale-90 hover:bg-slate-700 text-10px font-bold"
              style={{ 
                color: '#a78bfa',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 12
              }}
              title="Undo last action">
              UNDO
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (midiNotes.length > 0) {
                  onNotesChange([]);
                  console.log('Erase clicked - removed all notes');
                }
              }} 
              className="px-2 py-1.5 rounded transition-all active:scale-90 hover:bg-slate-700 text-10px font-bold"
              style={{ 
                color: midiNotes.length > 0 ? '#ff6b35' : '#666',
                cursor: midiNotes.length > 0 ? 'pointer' : 'not-allowed',
                opacity: midiNotes.length > 0 ? 1 : 0.5
              }}
              title="Clear all notes">
              ERASE
            </button>
          </div>
          <div style={{ width: 1, height: 20, background: '#222' }} />
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setScrollX(0);
              console.log('Rewind clicked');
            }} 
            className="p-1.5 rounded transition-all active:scale-90 hover:bg-slate-700"
            style={{ 
              color: '#888',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 14
            }}>
            ⏮
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              console.log('Play clicked, onPlayStop:', !!onPlayStop, 'isPlaying:', isPlaying);
              if (onPlayStop) onPlayStop();
            }} 
            className="p-1.5 rounded transition-all active:scale-90 hover:bg-slate-700"
            style={{ 
              color: isPlaying ? '#ff6b35' : '#00ff88', 
              background: isPlaying ? '#ff6b3522' : '#00ff8822',
              border: `1px solid ${isPlaying ? '#ff6b3544' : '#00ff8844'}`,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 14
            }}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              console.log('Stop clicked');
              if (onPlayStop && isPlaying) onPlayStop();
              setScrollX(0);
            }} 
            className="p-1.5 rounded transition-all active:scale-90 hover:bg-slate-700"
            style={{ 
              color: '#ff6b35',
              background: '#ff6b3522', 
              border: '1px solid #ff6b3544',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 14
            }}>
            ⏹
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const totalBeats = loopLength * 4;
              const maxScroll = totalBeats * pixelsPerBeat - 400;
              setScrollX(Math.max(0, maxScroll));
              console.log('Forward clicked');
            }} 
            className="p-1.5 rounded transition-all active:scale-90 hover:bg-slate-700"
            style={{ 
              color: '#888',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 14
            }}>
            ⏭
          </button>
        </div>

        {/* BPM Control */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded" style={{ background: '#242424', border: '1px solid #222' }}>
          <span className="text-10px font-bold" style={{ color: '#888', minWidth: 30 }}>BPM</span>
          <button onClick={() => {
            const newBpm = Math.max(40, localBpm - 1);
            setLocalBpm(newBpm);
            if (onBpmChange) onBpmChange(newBpm);
          }} className="p-0.5" style={{ color: '#00ff88', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
            ▼
          </button>
          <input type="number" value={localBpm} onChange={(e) => {
            const v = Math.max(40, Math.min(240, Number(e.target.value) || localBpm));
            setLocalBpm(v);
            if (onBpmChange) onBpmChange(v);
          }}
            style={{
              width: 50,
              padding: '2px 4px',
              background: '#1c1c1c',
              border: '1px solid #333',
              borderRadius: 3,
              color: '#00ff88',
              fontWeight: 'bold',
              fontSize: 12,
              textAlign: 'center'
            }}
          />
          <button onClick={() => {
            const newBpm = Math.min(240, localBpm + 1);
            setLocalBpm(newBpm);
            if (onBpmChange) onBpmChange(newBpm);
          }} className="p-0.5" style={{ color: '#00ff88', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
            ▲
          </button>
        </div>

        {/* Info */}
        <div className="text-10px" style={{ color: '#666' }}>
          {midiNotes.length} notes
        </div>
      </div>

      {/* Piano Roll Canvas Container with Scrollbars */}
      <div className="flex flex-col flex-1 overflow-hidden relative w-full" style={{ background: '#2a2a2a', touchAction: 'none' }}>
        {/* Main Canvas */}
        <div className="flex-1 overflow-hidden relative" style={{ background: '#2a2a2a' }}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}>
          <canvas
            ref={canvasRef}
            width={1400}
            height={600}
            onClick={handleCanvasClick}
            onWheel={handleWheel}
            onMouseDown={(e) => {
              if (canvasRef.current) {
                canvasRef.current.focus();
              }
            }}
            tabIndex={0}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              cursor: 'crosshair',
              outline: 'none'
            }}
          />
        </div>

        {/* Horizontal Scrollbar */}
        <div style={{
          height: 12,
          background: '#242424',
          borderTop: '1px solid #222',
          position: 'relative',
          cursor: 'pointer'
        }}>
          <div
            style={{
              height: '100%',
              background: '#00ff88',
              position: 'absolute',
              borderRadius: 2,
              opacity: 0.7,
              transition: 'opacity 0.2s',
              left: `${(scrollX / (loopLength * 4 * pixelsPerBeat)) * 100}%`,
              width: `${Math.max(5, (400 / (loopLength * 4 * pixelsPerBeat)) * 100)}%`
            }}
            onMouseDown={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect) return;
              const startX = e.clientX;
              const startScrollX = scrollX;
              const maxScroll = loopLength * 4 * pixelsPerBeat - 400;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const ratio = deltaX / rect.width;
                const newScrollX = startScrollX + ratio * (loopLength * 4 * pixelsPerBeat);
                setScrollX(Math.max(0, Math.min(newScrollX, maxScroll)));
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        </div>

        {/* Vertical Scrollbar */}
        <div style={{
          width: 12,
          background: '#242424',
          borderLeft: '1px solid #222',
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 12,
          cursor: 'pointer'
        }}>
          <div
            style={{
              width: '100%',
              background: '#00ff88',
              position: 'absolute',
              borderRadius: 2,
              opacity: 0.7,
              transition: 'opacity 0.2s',
              top: `${(scrollY / (PIANO_KEYS * keyHeight)) * 100}%`,
              height: `${Math.max(5, (600 / (PIANO_KEYS * keyHeight)) * 100)}%`
            }}
            onMouseDown={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect) return;
              const startY = e.clientY;
              const startScrollY = scrollY;
              const maxScroll = PIANO_KEYS * keyHeight - 100;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const ratio = deltaY / rect.height;
                const newScrollY = startScrollY + ratio * (PIANO_KEYS * keyHeight);
                setScrollY(Math.max(0, Math.min(newScrollY, maxScroll)));
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        </div>
      </div>
    </div>
  );
}
