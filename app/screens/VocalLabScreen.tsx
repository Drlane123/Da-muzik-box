import { useState, useRef, useEffect } from 'react';

import { Mic2, FileAudio, Send } from 'lucide-react';

import VocalCapturePanel from './vocal-lab/VocalCapturePanel';

import NeuralHumPanel from './vocal-lab/NeuralHumPanel';

import VoiceSwapPanel from './vocal-lab/VoiceSwapPanel';

import RVCSingingConverterPanel from './vocal-lab/RVCSingingConverterPanel';

import EnhancementSuite from './vocal-lab/EnhancementSuite';

import VocalTracksPanel from './vocal-lab/VocalTracksPanel';


interface VocalLabScreenProps {
  /** Second arg: optional audio blob when sending recorded/uploaded audio to Studio Editor. */
  onExport: (dest: string, audioBlob?: Blob) => void;
}


export default function VocalLabScreen({ onExport }: VocalLabScreenProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  async function startRecord() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chunks: BlobPart[] = [];
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
          : new MediaRecorder(stream);
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        recordedBlobRef.current = blob;
        setHasAudio(blob.size > 0);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
      };
      mediaRecorder.start(100);
      setIsRecording(true);
      setHasAudio(false);
      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) {
      console.error('Vocal Capture mic error:', err);
      alert('Microphone access is required to record. Allow the mic for this site (or use https / localhost).');
    }
  }

  function stopRecord() {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleUpload(file: File) {
    recordedBlobRef.current = file;
    setHasAudio(true);
    setIsRecording(false);
  }

  function handleDelete() {
    recordedBlobRef.current = null;
    setHasAudio(false);
    setIsPlaying(false);
    setRecordingTime(0);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return (
    <div className="flex flex-col h-full" style={{ background: '#050505', color: '#ccc' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#D500F922', color: '#D500F9' }}>
            <Mic2 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#fff' }}>AI Vocal Lab & Neural Transformation</h2>
            <p className="text-xs" style={{ color: '#555' }}>Record, transform, and enhance vocals with AI</p>
          </div>
          {/* Neural engine badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-2" style={{ background: '#0a1a0a', border: '1px solid #00ff8844' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00ff88' }} />
            <span className="text-xs" style={{ color: '#00ff88', fontSize: 10 }}>Neural Engine Active</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              onExport(
                'studio-editor',
                recordedBlobRef.current && recordedBlobRef.current.size > 0 ? recordedBlobRef.current : undefined,
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF55' }}
          >
            <Send size={11} /> Studio Editor
          </button>
          <button
            onClick={() => onExport('master-arranger')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: '#1a1a1a', color: '#D500F9', border: '1px solid #D500F955' }}
          >
            <Send size={11} /> Arranger
          </button>
        </div>
      </div>

      {/* Main content — scrollable */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 min-h-0">

        {/* Row 1: Neural Hum (Left) + RVC Singing Voice Converter (Right) */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          
          {/* Left Column: Neural Hum-to-Instrument */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <NeuralHumPanel hasAudio={hasAudio} />
          </div>

          {/* Right Column: RVC Singing Voice Converter */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <RVCSingingConverterPanel />
          </div>
        </div>

        {/* Row 2: AI Voice Processing Stack */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          
          {/* Left: AI Voice Swap */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <VoiceSwapPanel hasAudio={hasAudio} />
          </div>

          {/* Right: Vocal Capture */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <VocalCapturePanel
              hasAudio={hasAudio}
              isRecording={isRecording}
              isPlaying={isPlaying}
              recordingTime={recordingTime}
              onStartRecord={startRecord}
              onStopRecord={stopRecord}
              onPlayPause={() => setIsPlaying(p => !p)}
              onDelete={handleDelete}
              onUpload={handleUpload}
            />
          </div>
        </div>

        {/* Row 2: Enhancement Suite */}
        <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
          <EnhancementSuite />
        </div>

        {/* Row 3: Vocal Tracks */}
        <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
          <VocalTracksPanel />
        </div>

        {/* Export row */}
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}
        >
          <span className="text-xs font-bold uppercase tracking-widest mr-2" style={{ color: '#555' }}>Export</span>
          {[
            { label: 'WAV', color: '#00ff88' },
            { label: 'MP3', color: '#00ff88' },
          ].map(({ label, color }) => (
            <button
              key={label}
              disabled={!hasAudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all"
              style={{
                background: hasAudio ? `${color}18` : '#111',
                color: hasAudio ? color : '#333',
                border: `1px solid ${hasAudio ? `${color}44` : '#222'}`,
                cursor: hasAudio ? 'pointer' : 'not-allowed',
              }}
            >
              <FileAudio size={11} /> {label}
            </button>
          ))}
          <button
            onClick={() => onExport('creation-station')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: '#1a1a1a', color: '#D500F9', border: '1px solid #D500F944' }}
          >
            <Send size={11} /> To Creation Station
          </button>
          <button
            onClick={() =>
              onExport(
                'studio-editor',
                recordedBlobRef.current && recordedBlobRef.current.size > 0 ? recordedBlobRef.current : undefined,
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF44' }}
          >
            <Send size={11} /> To Studio Editor
          </button>
        </div>
      </div>
    </div>
  );
}
