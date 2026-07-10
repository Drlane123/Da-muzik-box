import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Upload } from 'lucide-react';
import WaveformCanvas from './WaveformCanvas';

interface VocalCapturePanelProps {
  hasAudio: boolean;
  isRecording: boolean;
  isPlaying?: boolean;
  recordingTime: number;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onPlayPause?: () => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  /** Panel heading — defaults to Vocal Capture. */
  title?: string;
  accentColor?: string;
  /** Hide play/pause (Neural Hum uses its own A/B player). */
  showPreviewPlay?: boolean;
  /** Live mic stream for level meters while recording. */
  meterStream?: MediaStream | null;
}

export default function VocalCapturePanel({
  hasAudio,
  isRecording,
  isPlaying = false,
  recordingTime,
  onStartRecord,
  onStopRecord,
  onPlayPause,
  onDelete,
  onUpload,
  title = 'Vocal Capture',
  accentColor = '#D500F9',
  showPreviewPlay = true,
  meterStream = null,
}: VocalCapturePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {title}
        </span>
        {isRecording && (
          <span className="flex items-center gap-1 text-xs font-mono" style={{ color: '#f44' }}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            REC {formatTime(recordingTime)}
          </span>
        )}
      </div>

      {/* Waveform */}
      <WaveformCanvas
        isRecording={isRecording}
        hasAudio={hasAudio}
        accentColor={accentColor}
        meterStream={meterStream}
      />

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <button
            onClick={onStartRecord}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: '#2a0a0a', color: '#f66', border: '1px solid #f44' }}
          >
            <Mic size={12} /> Record
          </button>
        ) : (
          <button
            onClick={onStopRecord}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold animate-pulse"
            style={{ background: '#f44', color: '#fff' }}
          >
            <Square size={12} /> Stop
          </button>
        )}

        {hasAudio && showPreviewPlay && onPlayPause && (
          <>
            <button
              onClick={onPlayPause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
              style={{ background: '#1a1a1a', color: '#00E5FF', border: '1px solid #00E5FF44' }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded"
              style={{ background: '#1a1a1a', color: '#666' }}
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
        {hasAudio && !showPreviewPlay && (
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded"
            style={{ background: '#1a1a1a', color: '#666' }}
            title="Clear recording"
          >
            <Trash2 size={12} />
          </button>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold ml-auto"
          style={{ background: '#111', color: '#888', border: '1px solid #333' }}
        >
          <Upload size={12} /> Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,audio/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
      </div>
    </div>
  );
}
