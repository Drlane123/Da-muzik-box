import { useRef, type ReactNode } from 'react';
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
  /** Count-in / arming — show pulse UI without calling it REC yet. */
  isPrecounting?: boolean;
  /** Override the REC / idle status text (e.g. "Count-in 2/4"). */
  statusLabel?: string | null;
  /** Extra toggles (Cnt / Mtr) rendered before Record. */
  leadingControls?: ReactNode;
  /** Disable Record while busy (e.g. analyzing). */
  recordDisabled?: boolean;
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
  isPrecounting = false,
  statusLabel = null,
  leadingControls = null,
  recordDisabled = false,
}: VocalCapturePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const live = isRecording || isPrecounting;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {title}
        </span>
        {live && (
          <span
            className="flex items-center gap-1 text-xs font-mono font-bold"
            style={{ color: isPrecounting ? '#ffb080' : '#f44' }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: isPrecounting ? '#ffb080' : '#f44' }}
            />
            {statusLabel ??
              (isPrecounting ? 'Count-in…' : `REC ${formatTime(recordingTime)}`)}
          </span>
        )}
      </div>

      <WaveformCanvas
        isRecording={live}
        hasAudio={hasAudio}
        accentColor={isPrecounting ? '#ffb080' : accentColor}
        meterStream={meterStream}
      />

      <div className="flex flex-wrap items-center gap-2">
        {leadingControls}

        {!live ? (
          <button
            type="button"
            onClick={onStartRecord}
            disabled={recordDisabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold disabled:opacity-40"
            style={{ background: '#2a0a0a', color: '#f66', border: '1px solid #f44' }}
          >
            <Mic size={12} /> Record
          </button>
        ) : (
          <button
            type="button"
            onClick={onStopRecord}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold animate-pulse"
            style={{
              background: isPrecounting ? '#ffb080' : '#f44',
              color: isPrecounting ? '#1a1008' : '#fff',
            }}
          >
            <Square size={12} /> {isPrecounting ? 'Cancel' : 'Stop'}
          </button>
        )}

        {hasAudio && showPreviewPlay && onPlayPause && (
          <>
            <button
              type="button"
              onClick={onPlayPause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
              style={{ background: '#0d0d14', color: '#00E5FF', border: '1px solid #00E5FF44' }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded"
              style={{ background: '#0d0d14', color: '#666' }}
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
        {hasAudio && !showPreviewPlay && (
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded"
            style={{ background: '#0d0d14', color: '#666' }}
            title="Clear recording"
          >
            <Trash2 size={12} />
          </button>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={live}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold ml-auto disabled:opacity-40"
          style={{ background: '#121218', color: '#888', border: '1px solid #333' }}
        >
          <Upload size={12} /> Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
      </div>
    </div>
  );
}
