import React, { useState, useRef, useEffect } from 'react';
import { Mic, Play, Plus, Settings, X } from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';

function pickMediaRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function musicEnhancerApiBase(): string {
  const raw = import.meta.env.VITE_MUSIC_ENHANCER_URL ?? 'http://localhost:8000';
  return String(raw).replace(/\/$/, '');
}

interface MusicEnhancerProps {
  onCreateTrack: (audioData: AudioBuffer, name: string) => void;
  onClose: () => void;
}

export const MusicEnhancer: React.FC<MusicEnhancerProps> = ({ onCreateTrack, onClose }) => {
  const { getOrCreateAudioContext } = useMasterClock();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState('flute');
  const [styleDescription, setStyleDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<AudioBuffer | null>(null);
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const instruments = [
    { value: 'flute', label: '🪶 Flute' },
    { value: 'piano', label: '🎹 Piano' },
    { value: 'violin', label: '🎻 Violin' },
    { value: 'trumpet', label: '🎺 Trumpet' },
    { value: 'cello', label: '🎻 Cello' },
    { value: 'saxophone', label: '🎷 Saxophone' },
    { value: 'harp', label: '🎶 Harp' },
    { value: 'synth', label: '⚡ Synth' },
  ];

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

  const stopCurrentPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  };

  const playBlobPreview = (blob: Blob) => {
    stopCurrentPreview();
    const url = URL.createObjectURL(blob);
    previewObjectUrlRef.current = url;
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    audio.onended = () => {
      stopCurrentPreview();
    };
    audio.play().catch((err) => {
      console.error('Audio preview play() failed:', err);
      stopCurrentPreview();
      alert('Unable to play preview audio in this browser/session.');
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickMediaRecorderMimeType();
      const mediaRecorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blobType =
          mediaRecorder.mimeType ||
          mime ||
          'audio/webm';
        const blob = new Blob(chunks, { type: blobType });
        setRecordedAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
      alert('Please allow microphone access to record');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const playPreview = async () => {
    if (!recordedAudio) return;

    try {
      playBlobPreview(recordedAudio);
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const generateInstrument = async () => {
    if (!recordedAudio) {
      alert('Please record audio first');
      return;
    }

    setIsProcessing(true);
    const base = musicEnhancerApiBase();
    const enhanceUrl = `${base}/enhance`;
    try {
      const formData = new FormData();
      const ext =
        recordedAudio.type.includes('webm') ? 'webm' :
        recordedAudio.type.includes('mp4') ? 'mp4' :
        recordedAudio.type.includes('ogg') ? 'ogg' : 'bin';
      formData.append('audio', recordedAudio, `capture.${ext}`);
      formData.append('instrument', selectedInstrument);
      formData.append('style', styleDescription);

      const response = await fetch(enhanceUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      setGeneratedAudioBlob(audioBlob);

      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      audioContextRef.current = ctx;

      const arrayBuffer = await audioBlob.arrayBuffer();
      const slice = arrayBuffer.byteLength ? arrayBuffer.slice(0) : arrayBuffer;
      const audioBuffer = await ctx.decodeAudioData(slice);
      setGeneratedAudio(audioBuffer);
    } catch (err) {
      console.error('Generation error:', err);
      alert(
        `Sound Conversion request failed (${enhanceUrl}).\n` +
          `Start the dev server: npm run music-enhancer-server\n` +
          `Or set VITE_MUSIC_ENHANCER_URL in .env to your API base (no /enhance suffix).`,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const playGenerated = async () => {
    if (generatedAudioBlob) {
      playBlobPreview(generatedAudioBlob);
      return;
    }
    if (!generatedAudio) return;
    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    audioContextRef.current = ctx;
    const source = ctx.createBufferSource();
    source.buffer = generatedAudio;
    source.connect(ctx.destination);
    source.start(0);
  };

  const createTrack = () => {
    if (!generatedAudio) {
      alert('Generate audio first');
      return;
    }

    const trackName = `${selectedInstrument.charAt(0).toUpperCase() + selectedInstrument.slice(1)} - ${new Date().toLocaleTimeString()}`;
    onCreateTrack(generatedAudio, trackName);
    
    // Reset form
    setRecordedAudio(null);
    setGeneratedAudio(null);
    setGeneratedAudioBlob(null);
    setStyleDescription('');
    stopCurrentPreview();
    
    // Close the modal
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-100 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-2xl w-full max-w-md border border-slate-700" style={{ backgroundColor: '#000000', opacity: 1 }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-t-xl flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Mic className="w-6 h-6" /> Sound Conversion
            </h2>
            <p className="text-purple-100 text-sm mt-1">Hum → Professional Instrument</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Recording Section */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-200">Step 1: Record Your Hum</label>
            <div className="flex gap-2">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                <Mic className="w-4 h-4" />
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
              {recordedAudio && (
                <button
                  onClick={playPreview}
                  className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-all"
                >
                  <Play className="w-4 h-4" /> Play Original
                </button>
              )}
            </div>
            {recordedAudio && (
              <p className="text-xs text-green-400">✓ Recording saved</p>
            )}
          </div>

          {/* Instrument Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-200">Step 2: Select Instrument</label>
            <select
              value={selectedInstrument}
              onChange={(e) => setSelectedInstrument(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            >
              {instruments.map((inst) => (
                <option key={inst.value} value={inst.value}>
                  {inst.label}
                </option>
              ))}
            </select>
          </div>

          {/* Style Description */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Style & Mood (Optional)
            </label>
            <textarea
              value={styleDescription}
              onChange={(e) => setStyleDescription(e.target.value)}
              placeholder="e.g., 'symphonic, epic, bright, dark, jazzy, classical'..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none h-24"
            />
            <p className="text-xs text-slate-400">Describe the style and mood you want</p>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateInstrument}
            disabled={!recordedAudio || isProcessing}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Generate Instrument
              </>
            )}
          </button>

          {/* Generated Audio Preview */}
          {generatedAudio && (
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <p className="text-sm font-semibold text-green-400 mb-2">✓ Generated Successfully!</p>
              <button
                onClick={playGenerated}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all mb-2"
              >
                <Play className="w-4 h-4" /> Preview Generated Audio
              </button>
            </div>
          )}

          {/* Create Track Button */}
          {generatedAudio && (
            <button
              onClick={createTrack}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add to Studio Timeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
