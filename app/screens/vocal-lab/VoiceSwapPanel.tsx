import { useCallback, useEffect, useRef, useState } from 'react';

import { ChevronDown, ChevronUp, Download, Pause, Play, Upload, Volume2 } from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';
import {
  convertVoiceSwap,
  downloadVoiceSwapWav,
  VOICE_SWAP_STYLES,
  type VoiceSwapResult,
  type VoiceSwapStyleId,
} from '@/app/lib/vocalLab/voiceSwapConverter';

interface VoiceSwapPanelProps {
  /** Optional Hum Capture recording — used when no file is imported here. */
  hasAudio?: boolean;
  audioBlob?: Blob | null;
}

export default function VoiceSwapPanel({ audioBlob = null }: VoiceSwapPanelProps) {
  const { getOrCreateAudioContext } = useMasterClock();

  const [open, setOpen] = useState(false);
  const [importedBlob, setImportedBlob] = useState<Blob | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<VoiceSwapStyleId | null>(null);
  const [intensity, setIntensity] = useState(60);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceSwapResult | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [meterLevel, setMeterLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef(0);
  const applyGenRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourceBlob = importedBlob ?? audioBlob;
  const hasSource = Boolean(sourceBlob && sourceBlob.size > 0);
  const sourceLabel = importedName
    ? importedName
    : hasSource
      ? 'Hum Capture recording'
      : null;

  const revokePreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  useEffect(() => {
    setResult(null);
    setError(null);
    setIsPlaying(false);
    revokePreviewUrl();
    analyserRef.current = null;
    if (audioRef.current) audioRef.current.removeAttribute('src');
  }, [sourceBlob]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportedBlob(file);
    setImportedName(file.name);
    e.target.value = '';
  };

  const clearImport = () => {
    setImportedBlob(null);
    setImportedName(null);
  };

  useEffect(() => {
    return () => {
      revokePreviewUrl();
      cancelAnimationFrame(meterRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(meterRafRef.current);
      setMeterLevel(0);
      return;
    }

    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i]!;
      setMeterLevel(Math.min(100, (sum / data.length / 255) * 100 * 2.8));
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(meterRafRef.current);
  }, [isPlaying]);

  const applyStyle = useCallback(
    async (styleId: VoiceSwapStyleId, intensityPct: number) => {
      if (!sourceBlob || sourceBlob.size === 0) return;

      const gen = applyGenRef.current + 1;
      applyGenRef.current = gen;
      setIsProcessing(true);
      setError(null);
      setResult(null);
      setIsPlaying(false);
      revokePreviewUrl();

      try {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();

        const out = await convertVoiceSwap(ctx, sourceBlob, styleId, intensityPct);
        if (applyGenRef.current !== gen) return;

        previewUrlRef.current = URL.createObjectURL(out.wavBlob);
        if (audioRef.current) {
          audioRef.current.src = previewUrlRef.current;
          analyserRef.current = null;
        }
        setResult(out);
      } catch (err) {
        if (applyGenRef.current !== gen) return;
        setError(err instanceof Error ? err.message : 'Voice swap failed');
      } finally {
        if (applyGenRef.current === gen) setIsProcessing(false);
      }
    },
    [sourceBlob, getOrCreateAudioContext],
  );

  const handleApply = () => {
    if (!selectedStyle || !hasSource) return;
    void applyStyle(selectedStyle, intensity);
  };

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el || !previewUrlRef.current) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      return;
    }

    if (!analyserRef.current) {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const src = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }

    el.volume = volume / 100;
    void el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const selectedStyleMeta = VOICE_SWAP_STYLES.find((s) => s.id === selectedStyle);

  return (
    <div className="flex flex-col w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-3 w-full px-3 py-2 rounded-lg text-left"
        style={{
          background: open ? '#1a0a2a' : '#120a1a',
          border: '1px solid #D500F944',
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <span className="text-sm font-bold uppercase tracking-widest" style={{ color: '#D500F9' }}>
          AI Voice Swap
        </span>
        {open ? (
          <ChevronUp size={18} style={{ color: '#D500F9', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={18} style={{ color: '#D500F9', flexShrink: 0 }} />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-3 mt-3">
          <p className="text-xs" style={{ color: '#555' }}>
            Import a vocal or use Hum Capture — same melody, artist-style tone (browser DSP).
          </p>

          <div
            className="flex flex-col gap-2 p-3 rounded-lg"
            style={{ background: '#1a0a2a', border: '1px solid #D500F944' }}
          >
            <span className="text-xs font-bold" style={{ color: '#D500F9' }}>
              IMPORT VOCAL
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
                style={{ background: '#111', color: '#D500F9', border: '1px solid #D500F944', cursor: 'pointer' }}
              >
                <Upload size={12} /> Import WAV / MP3
              </button>
              {importedBlob && (
                <button
                  type="button"
                  onClick={clearImport}
                  className="px-2 py-1.5 rounded text-9px font-bold"
                  style={{ background: '#1a1a1a', color: '#888', border: '1px solid #333' }}
                >
                  Clear import
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,.ogg,.webm,audio/*"
              className="hidden"
              onChange={handleImport}
            />
            {sourceLabel && hasSource && (
              <p className="text-10px" style={{ color: '#00ff88' }}>
                ✓ {sourceLabel}
              </p>
            )}
            {!hasSource && (
              <p className="text-xs" style={{ color: '#888' }}>
                Import a vocal file above, or record in Hum Capture.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {VOICE_SWAP_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedStyle(s.id);
                  setResult(null);
                  setError(null);
                }}
                className="py-2.5 rounded-lg text-xs font-bold transition-all text-left px-2"
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

          {selectedStyleMeta && (
            <p className="text-9px" style={{ color: '#666' }}>
              {selectedStyleMeta.description}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs" style={{ color: '#555' }}>
              <span>Intensity</span>
              <span style={{ color: '#D500F9' }}>{intensity}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#333' }}>
              <span>Subtle</span>
              <input
                type="range"
                min={0}
                max={100}
                value={intensity}
                onChange={(e) => {
                  setIntensity(Number(e.target.value));
                  setResult(null);
                }}
                className="flex-1 h-1.5 accent-[#D500F9]"
              />
              <span>Full</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedStyle || !hasSource || isProcessing}
            className="py-2 rounded text-xs font-bold transition-all"
            style={{
              background: selectedStyle && hasSource && !isProcessing ? '#D500F9' : '#1a1a1a',
              color: selectedStyle && hasSource && !isProcessing ? '#000' : '#444',
              cursor: selectedStyle && hasSource && !isProcessing ? 'pointer' : 'not-allowed',
            }}
          >
            {isProcessing
              ? 'Applying voice swap…'
              : selectedStyle
                ? `Apply ${selectedStyleMeta?.label ?? ''} Voice`
                : 'Select a style'}
          </button>

          {error && (
            <p className="text-xs" style={{ color: '#ff6666' }}>
              {error}
            </p>
          )}

          {result && (
            <div className="flex flex-col gap-3 border-t border-gray-700 pt-3">
              <p className="text-xs font-semibold" style={{ color: '#D500F9' }}>
                ✓ {result.styleLabel} voice · {result.durationSec.toFixed(1)}s · {intensity}% intensity
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void togglePlay()}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-all"
                  style={{
                    background: isPlaying ? '#D500F9' : '#1a1a1a',
                    color: isPlaying ? '#000' : '#D500F9',
                    border: '1px solid #D500F944',
                    cursor: 'pointer',
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
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v / 100;
                  }}
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#D500F9' }}
                />
                <button
                  type="button"
                  onClick={() => downloadVoiceSwapWav(result.wavBlob, result.styleLabel)}
                  className="flex items-center justify-center px-2 py-1.5 rounded text-xs font-bold"
                  style={{ background: '#D500F944', color: '#D500F9', border: '1px solid #D500F9' }}
                  title="Download WAV"
                >
                  <Download size={12} />
                </button>
              </div>

              {isPlaying && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Volume2 size={12} style={{ color: '#D500F9' }} />
                    <span style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', flex: 1 }}>LEVEL</span>
                    <span style={{ fontSize: '9px', color: '#D500F9', fontWeight: 'bold' }}>
                      {Math.round(meterLevel)}%
                    </span>
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
                            transition: 'all 50ms',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <audio ref={audioRef} onEnded={() => setIsPlaying(false)} style={{ display: 'none' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
