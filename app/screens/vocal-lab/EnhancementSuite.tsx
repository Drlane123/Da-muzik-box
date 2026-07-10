import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import {
  ChevronDown,
  ChevronUp,
  Download,
  Mic2,
  Pause,
  Play,
  Radio,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  Upload,
  Volume2,
  Wind,
  AudioWaveform,
  Zap,
} from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';
import { decodeAudioBlob } from '@/app/lib/vocalLab/rvcVoiceConverter';
import {
  downloadEnhancedVocalWav,
  enhanceVocal,
  VOCAL_ENHANCE_PREVIEW_SEC,
  type VocalEnhancementResult,
  type VocalEnhancementSettings,
} from '@/app/lib/vocalLab/vocalEnhancementProcessor';

const PREVIEW_SEC = VOCAL_ENHANCE_PREVIEW_SEC;

/** Bundled URL — works in dev + `vite preview` (avoid `public/assets/`; Vite also writes bundles to `/dist/assets/`). */
import vocalNeonFigureUrl from '@/app/assets/vocal-neon-figure.png';

/** Your artwork — app/assets/vocal-neon-figure.png */
function NeonVocalHeadArt() {
  return (
    <div className="w-full shrink-0 mt-0.5 pt-1" style={{ background: 'transparent' }} aria-hidden>
      <div
        className="neon-vocal-figure-wrap flex justify-center px-0.5"
        style={{ background: 'transparent', overflow: 'visible' }}
      >
        <img
          src={vocalNeonFigureUrl}
          alt=""
          width={360}
          height={480}
          className="neon-vocal-figure-img max-w-full h-auto w-full object-contain object-center rounded-lg"
          style={{ maxHeight: 260, backgroundColor: 'transparent' }}
          draggable={false}
        />
      </div>
      <p className="text-center mt-1.5 font-medium tracking-[0.2em] uppercase" style={{ color: '#555', fontSize: 8 }}>
        Vocal output
      </p>
    </div>
  );
}

interface ControlProps {
  title: string;
  subtitle: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  enabled?: boolean;
  onToggle?: () => void;
  /** Optional end labels for the slider (shown below the track, not inline) */
  rangeHint?: { left: string; right: string };
  icon: ReactNode;
}

function EnhancementControl({
  title,
  subtitle,
  value,
  onChange,
  color,
  enabled = true,
  onToggle,
  rangeHint,
  icon,
}: ControlProps) {
  const dim = onToggle !== undefined && !enabled;

  return (
    <div
      className="rounded-xl p-3 flex flex-col min-w-0"
      style={{
        background: 'linear-gradient(145deg, #0e0e12 0%, #08080a 100%)',
        border: '1px solid #1f1f28',
        boxShadow: dim ? 'none' : `inset 0 1px 0 0 ${color}18`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${color}14`, color, border: `1px solid ${color}35` }}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold leading-tight block" style={{ color: '#e8e8ec' }}>
                {title}
              </span>
              {onToggle && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="relative w-10 h-5 rounded-full shrink-0 transition-colors"
                  style={{ background: enabled ? color : '#252530', border: `1px solid ${enabled ? color : '#3a3a48'}` }}
                  aria-pressed={enabled}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all shadow-sm"
                    style={{
                      background: '#fff',
                      left: enabled ? 'calc(100% - 18px)' : 3,
                      opacity: dim ? 0.5 : 1,
                    }}
                  />
                </button>
              )}
            </div>
            <p className="text-[11px] leading-snug mt-1" style={{ color: '#6b6b78' }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div
          className="shrink-0 px-2 py-0.5 rounded-md text-xs font-mono font-bold tabular-nums"
          style={{
            background: `${color}12`,
            color,
            border: `1px solid ${color}30`,
          }}
        >
          {value}
        </div>
      </div>

      <div className="px-0.5" style={{ opacity: dim ? 0.35 : 1, pointerEvents: dim ? 'none' : 'auto' }}>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={dim}
          className="w-full h-2 rounded-full appearance-none cursor-pointer vocal-suite-range"
          style={
            {
              accentColor: color,
              background: `linear-gradient(to right, ${color}55 0%, ${color}55 ${value}%, #2a2a34 ${value}%, #2a2a34 100%)`,
            } as CSSProperties
        }
        />
        {rangeHint && (
          <div className="flex justify-between mt-1.5 px-0.5">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: '#4a4a58' }}>
              {rangeHint.left}
            </span>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: '#4a4a58' }}>
              {rangeHint.right}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const PRESETS = [
  { id: 'tpain', label: 'Hard Tune', hint: 'T-Pain snap · 100% tune', color: '#ff3366', icon: <Mic2 size={14} /> },
  { id: 'studio', label: 'Studio Polish', hint: 'Radio-ready sheen', color: '#D500F9', icon: <Sparkles size={14} /> },
  { id: 'live', label: 'Live Stage', hint: 'Punch & presence', color: '#00E5FF', icon: <Radio size={14} /> },
  { id: 'intimate', label: 'Intimate', hint: 'Soft & close', color: '#ffcc00', icon: <Mic2 size={14} /> },
  { id: 'broadcast', label: 'Broadcast', hint: 'Max clarity', color: '#00ff88', icon: <Wind size={14} /> },
];

const PRESET_VALUES: Record<string, Record<string, number>> = {
  tpain: { autotune: 100, noise: 30, deess: 50, clarity: 72, smooth: 35, eq: 58 },
  studio: { autotune: 70, noise: 80, deess: 60, clarity: 75, smooth: 65, eq: 55 },
  live: { autotune: 30, noise: 40, deess: 50, clarity: 60, smooth: 45, eq: 50 },
  intimate: { autotune: 20, noise: 50, deess: 30, clarity: 40, smooth: 70, eq: 40 },
  broadcast: { autotune: 85, noise: 90, deess: 75, clarity: 90, smooth: 80, eq: 60 },
};

interface EnhancementSuiteProps {
  audioBlob?: Blob | null;
}

export default function EnhancementSuite({ audioBlob = null }: EnhancementSuiteProps) {
  const { getOrCreateAudioContext } = useMasterClock();

  const [open, setOpen] = useState(false);
  const [importedBlob, setImportedBlob] = useState<Blob | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VocalEnhancementResult | null>(null);
  const [isPlayingEnhanced, setIsPlayingEnhanced] = useState(false);
  const [isPlayingSource, setIsPlayingSource] = useState(false);
  const [sourceDurationSec, setSourceDurationSec] = useState<number | null>(null);
  const [livePreview, setLivePreview] = useState(true);
  const [volume, setVolume] = useState(75);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const enhancedUrlRef = useRef<string | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const enhancedAudioRef = useRef<HTMLAudioElement>(null);
  const sourceAudioRef = useRef<HTMLAudioElement>(null);
  const applyGenRef = useRef(0);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sourceBlob = importedBlob ?? audioBlob;
  const hasSource = Boolean(sourceBlob && sourceBlob.size > 0);
  const sourceLabel = importedName ?? (hasSource && !importedBlob ? 'Hum Capture recording' : null);

  const [autotuneOn, setAutotuneOn] = useState(true);
  const [autotune, setAutotune] = useState(100);
  const [noise, setNoise] = useState(30);
  const [deess, setDeess] = useState(50);
  const [clarity, setClarity] = useState(72);
  const [smooth, setSmooth] = useState(35);
  const [eq, setEq] = useState(58);
  const [activePreset, setActivePreset] = useState<string | null>('tpain');

  const revokeEnhancedUrl = () => {
    if (enhancedUrlRef.current) {
      URL.revokeObjectURL(enhancedUrlRef.current);
      enhancedUrlRef.current = null;
    }
  };

  const revokeSourceUrl = () => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = null;
    }
  };

  const stopAllPlayback = () => {
    enhancedAudioRef.current?.pause();
    sourceAudioRef.current?.pause();
    setIsPlayingEnhanced(false);
    setIsPlayingSource(false);
  };

  useEffect(() => {
    setResult(null);
    setError(null);
    stopAllPlayback();
    revokeEnhancedUrl();
    revokeSourceUrl();
    setSourceDurationSec(null);
    if (enhancedAudioRef.current) enhancedAudioRef.current.removeAttribute('src');
    if (sourceAudioRef.current) sourceAudioRef.current.removeAttribute('src');

    if (!sourceBlob || sourceBlob.size === 0) return;

    sourceUrlRef.current = URL.createObjectURL(sourceBlob);
    if (sourceAudioRef.current) sourceAudioRef.current.src = sourceUrlRef.current;

    void (async () => {
      try {
        const ctx = getOrCreateAudioContext();
        const buf = await decodeAudioBlob(ctx, sourceBlob);
        setSourceDurationSec(buf.duration);
      } catch {
        setSourceDurationSec(null);
      }
    })();
  }, [sourceBlob, getOrCreateAudioContext]);

  useEffect(() => {
    return () => {
      revokeEnhancedUrl();
      revokeSourceUrl();
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, []);

  const buildSettings = (override?: VocalEnhancementSettings): VocalEnhancementSettings =>
    override ?? {
      autotuneOn,
      autotune,
      noise,
      deess,
      clarity,
      smooth,
      eq,
    };

  const runEnhance = useCallback(
    async (opts?: {
      override?: VocalEnhancementSettings;
      preview?: boolean;
      autoPlay?: boolean;
    }) => {
      if (!sourceBlob || sourceBlob.size === 0) return;

      const settings = buildSettings(opts?.override);
      const isPreview = opts?.preview ?? (sourceDurationSec != null && sourceDurationSec > PREVIEW_SEC + 0.5);

      const gen = applyGenRef.current + 1;
      applyGenRef.current = gen;
      setIsProcessing(true);
      setProcessingLabel(isPreview ? `Preview (${PREVIEW_SEC}s)…` : 'Processing full song…');
      setError(null);
      if (!isPreview) setResult(null);
      stopAllPlayback();
      revokeEnhancedUrl();

      try {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();

        const out = await enhanceVocal(
          ctx,
          sourceBlob,
          settings,
          isPreview ? { maxDurationSec: PREVIEW_SEC } : undefined,
        );
        if (applyGenRef.current !== gen) return;

        enhancedUrlRef.current = URL.createObjectURL(out.wavBlob);
        if (enhancedAudioRef.current) enhancedAudioRef.current.src = enhancedUrlRef.current;
        setResult(out);

        if (opts?.autoPlay && enhancedAudioRef.current) {
          enhancedAudioRef.current.volume = volume / 100;
          void enhancedAudioRef.current
            .play()
            .then(() => {
              setIsPlayingEnhanced(true);
              setIsPlayingSource(false);
            })
            .catch(() => setIsPlayingEnhanced(false));
        }
      } catch (err) {
        if (applyGenRef.current !== gen) return;
        setError(err instanceof Error ? err.message : 'Enhancement failed');
      } finally {
        if (applyGenRef.current === gen) {
          setIsProcessing(false);
          setProcessingLabel('');
        }
      }
    },
    [
      autotune,
      autotuneOn,
      clarity,
      deess,
      eq,
      getOrCreateAudioContext,
      noise,
      smooth,
      sourceBlob,
      sourceDurationSec,
      volume,
    ],
  );

  useEffect(() => {
    if (!hasSource || !livePreview) return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => {
      void runEnhance({ preview: true, autoPlay: false });
    }, 650);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [autotune, autotuneOn, clarity, deess, eq, hasSource, livePreview, noise, runEnhance, smooth]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportedBlob(file);
    setImportedName(file.name);
    e.target.value = '';
  };

  const toggleSourcePlay = () => {
    const el = sourceAudioRef.current;
    if (!el || !sourceUrlRef.current) return;
    if (isPlayingSource) {
      el.pause();
      setIsPlayingSource(false);
      return;
    }
    enhancedAudioRef.current?.pause();
    setIsPlayingEnhanced(false);
    el.volume = volume / 100;
    void el.play().then(() => setIsPlayingSource(true)).catch(() => setIsPlayingSource(false));
  };

  const toggleEnhancedPlay = () => {
    const el = enhancedAudioRef.current;
    if (!el || !enhancedUrlRef.current) return;
    if (isPlayingEnhanced) {
      el.pause();
      setIsPlayingEnhanced(false);
      return;
    }
    sourceAudioRef.current?.pause();
    setIsPlayingSource(false);
    el.volume = volume / 100;
    void el.play().then(() => setIsPlayingEnhanced(true)).catch(() => setIsPlayingEnhanced(false));
  };

  function applyPreset(id: string) {
    const v = PRESET_VALUES[id];
    if (!v) return;
    setAutotune(v.autotune);
    setNoise(v.noise);
    setDeess(v.deess);
    setClarity(v.clarity);
    setSmooth(v.smooth);
    setEq(v.eq);
    setAutotuneOn(true);
    setActivePreset(id);
    setResult(null);
    setError(null);
  }

  function applyPresetAndRun(id: string) {
    const v = PRESET_VALUES[id];
    if (!v) return;
    applyPreset(id);
    if (hasSource) {
      void runEnhance({
        preview: true,
        autoPlay: true,
        override: {
          autotuneOn: true,
          autotune: v.autotune,
          noise: v.noise,
          deess: v.deess,
          clarity: v.clarity,
          smooth: v.smooth,
          eq: v.eq,
        },
      });
    }
  }

  const clearPreset = () => setActivePreset(null);

  return (
    <div className="flex flex-col w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-3 w-full px-3 py-2 rounded-lg text-left"
        style={{
          background: open ? '#0e1220' : '#0a0a12',
          border: '1px solid #00E5FF44',
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <span className="text-sm font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>
          Enhancement Suite
        </span>
        {open ? (
          <ChevronUp size={18} style={{ color: '#00E5FF', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={18} style={{ color: '#00E5FF', flexShrink: 0 }} />
        )}
      </button>

      {open && (
    <div className="flex flex-col min-w-0 mt-3" style={{ gap: '1rem' }}>

      {/* Import + enhance */}
      <div
        className="flex flex-col gap-2 p-3 rounded-lg"
        style={{ background: '#0a1a22', border: '1px solid #00E5FF33' }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>
          Import vocal
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: '#111', color: '#00E5FF', border: '1px solid #00E5FF44', cursor: 'pointer' }}
          >
            <Upload size={12} /> Import WAV / MP3
          </button>
          {importedBlob && (
            <button
              type="button"
              onClick={() => {
                setImportedBlob(null);
                setImportedName(null);
              }}
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
            {sourceDurationSec != null ? ` · ${Math.floor(sourceDurationSec / 60)}:${String(Math.floor(sourceDurationSec % 60)).padStart(2, '0')}` : ''}
          </p>
        )}
        {hasSource && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleSourcePlay}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold"
              style={{
                background: isPlayingSource ? '#888' : '#1a1a1a',
                color: isPlayingSource ? '#fff' : '#ccc',
                border: '1px solid #444',
                cursor: 'pointer',
              }}
            >
              {isPlayingSource ? <Pause size={12} /> : <Play size={12} />}
              Audition original
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (sourceAudioRef.current) sourceAudioRef.current.volume = v / 100;
                if (enhancedAudioRef.current) enhancedAudioRef.current.volume = v / 100;
              }}
              style={{ flex: 1, minWidth: 80, accentColor: '#888' }}
            />
            <audio ref={sourceAudioRef} onEnded={() => setIsPlayingSource(false)} style={{ display: 'none' }} />
          </div>
        )}
        {!hasSource && (
          <p className="text-[11px]" style={{ color: '#666' }}>
            Import a vocal or use Hum Capture — audition first, then tweak the chain.
          </p>
        )}
        {error && (
          <p className="text-xs" style={{ color: '#ff6666' }}>
            {error}
          </p>
        )}
      </div>

      <p className="text-[11px] leading-relaxed max-w-xl" style={{ color: '#6a6a78' }}>
        Auto-Tune at 90+ = hard chromatic snap (T-Pain). Live preview updates a {PREVIEW_SEC}s clip as you move sliders.
      </p>
      {/* Preset tiles */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: '#555' }}>
          Quick chain
        </span>
        <div
          className="grid w-full min-w-0"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '0.65rem',
          }}
        >
          {PRESETS.map((p) => {
            const on = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPresetAndRun(p.id)}
                className="rounded-xl p-3 text-left transition-all min-w-0"
                style={{
                  background: on ? `linear-gradient(160deg, ${p.color}14, #0c0c10)` : '#0c0c10',
                  border: `1px solid ${on ? `${p.color}55` : '#222230'}`,
                  boxShadow: on ? `0 0 20px ${p.color}12` : 'none',
                }}
              >
                <div className="flex items-center gap-2 mb-1.5" style={{ color: on ? p.color : '#666' }}>
                  {p.icon}
                  <span className="text-xs font-bold truncate" style={{ color: on ? p.color : '#bbb' }}>
                    {p.label}
                  </span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: '#5a5a68' }}>
                  {p.hint}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column modules */}
      <div
        className="grid w-full min-w-0"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <div className="flex flex-col min-w-0" style={{ gap: '0.65rem' }}>
          <div
            className="flex items-center gap-2 px-1 py-0.5 rounded-lg mb-0.5"
            style={{ borderLeft: '3px solid #D500F9', background: '#D500F908' }}
          >
            <SunMedium size={14} style={{ color: '#D500F9' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
              Pitch & spectrum
            </span>
          </div>
          <EnhancementControl
            title="Auto-Tune"
            subtitle="Hard snap at 90–100 (T-Pain). Toggle off for polish-only chain."
            value={autotune}
            onChange={(v) => {
              setAutotune(v);
              clearPreset();
            }}
            color="#D500F9"
            enabled={autotuneOn}
            onToggle={() => setAutotuneOn(!autotuneOn)}
            icon={<Mic2 size={16} />}
          />
          <EnhancementControl
            title="EQ balance"
            subtitle="Tilt the vocal brighter or warmer before the limiter."
            value={eq}
            onChange={(v) => {
              setEq(v);
              clearPreset();
            }}
            color="#ff9800"
            rangeHint={{ left: 'Warm', right: 'Bright' }}
            icon={<AudioWaveform size={16} />}
          />
          <NeonVocalHeadArt />
        </div>

        <div className="flex flex-col min-w-0" style={{ gap: '0.65rem' }}>
          <div
            className="flex items-center gap-2 px-1 py-0.5 rounded-lg mb-0.5"
            style={{ borderLeft: '3px solid #00E5FF', background: '#00E5FF08' }}
          >
            <Wind size={14} style={{ color: '#00E5FF' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#67e8f9' }}>
              Cleanup & dynamics
            </span>
          </div>
          <EnhancementControl
            title="AI noise removal"
            subtitle="Spectral gating for room tone, hiss, and laptop fan bleed."
            value={noise}
            onChange={(v) => {
              setNoise(v);
              clearPreset();
            }}
            color="#00E5FF"
            icon={<Wind size={16} />}
          />
          <EnhancementControl
            title="De-essing"
            subtitle="Tame sibilance (“s” and “sh”) without dulling the vocal."
            value={deess}
            onChange={(v) => {
              setDeess(v);
              clearPreset();
            }}
            color="#22d3ee"
            icon={<Sparkles size={16} />}
          />
          <EnhancementControl
            title="Clarity boost"
            subtitle="Presence lift in the vocal presence band for intelligibility."
            value={clarity}
            onChange={(v) => {
              setClarity(v);
              clearPreset();
            }}
            color="#00ff88"
            icon={<SunMedium size={16} />}
          />
          <EnhancementControl
            title="Vocal smoothing"
            subtitle="Low-level compression to even out level swings and breaths."
            value={smooth}
            onChange={(v) => {
              setSmooth(v);
              clearPreset();
            }}
            color="#ffcc00"
            icon={<SlidersHorizontal size={16} />}
          />
        </div>
      </div>

      <div
        className="flex flex-col gap-2 p-3 rounded-lg"
        style={{ background: '#0a1a22', border: '1px solid #00E5FF33' }}
      >
        <label className="flex items-center gap-2 cursor-pointer text-[11px]" style={{ color: '#888' }}>
          <input
            type="checkbox"
            checked={livePreview}
            onChange={(e) => setLivePreview(e.target.checked)}
            style={{ accentColor: '#00E5FF' }}
          />
          Live preview — re-render {PREVIEW_SEC}s clip when sliders change
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runEnhance({ preview: true, autoPlay: true })}
            disabled={!hasSource || isProcessing}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-bold"
            style={{
              background: hasSource && !isProcessing ? '#00E5FF' : '#1a1a1a',
              color: hasSource && !isProcessing ? '#000' : '#444',
              cursor: hasSource && !isProcessing ? 'pointer' : 'not-allowed',
            }}
          >
            <Play size={14} />
            {isProcessing ? processingLabel || 'Working…' : `Preview chain (${PREVIEW_SEC}s)`}
          </button>
          <button
            type="button"
            onClick={() => void runEnhance({ preview: false, autoPlay: false })}
            disabled={!hasSource || isProcessing}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-bold"
            style={{
              background: hasSource && !isProcessing ? '#1a2a1a' : '#1a1a1a',
              color: hasSource && !isProcessing ? '#00ff88' : '#444',
              border: '1px solid #00ff8844',
              cursor: hasSource && !isProcessing ? 'pointer' : 'not-allowed',
            }}
          >
            <Zap size={14} />
            Export full song
          </button>
        </div>

        {sourceDurationSec != null && sourceDurationSec > PREVIEW_SEC + 0.5 && (
          <p className="text-10px" style={{ color: '#666' }}>
            Full song is {Math.ceil(sourceDurationSec)}s — use preview to tune auto-tune, then export when ready.
          </p>
        )}

        {result && (
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-800">
            <p className="text-xs font-semibold" style={{ color: '#00ff88' }}>
              ✓ {result.isPreview ? `Preview (${result.durationSec.toFixed(1)}s)` : `Full export (${result.durationSec.toFixed(1)}s)`}
              {autotuneOn && autotune >= 88 ? ' · hard tune' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleEnhancedPlay}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold"
                style={{
                  background: isPlayingEnhanced ? '#00E5FF' : '#1a1a1a',
                  color: isPlayingEnhanced ? '#000' : '#00E5FF',
                  border: '1px solid #00E5FF44',
                }}
              >
                {isPlayingEnhanced ? <Pause size={12} /> : <Play size={12} />}
                {isPlayingEnhanced ? 'Pause' : 'Play enhanced'}
              </button>
              {!result.isPreview && (
                <button
                  type="button"
                  onClick={() => downloadEnhancedVocalWav(result.wavBlob, activePreset ?? 'enhanced-vocal')}
                  className="px-2 py-1.5 rounded text-xs font-bold"
                  style={{ background: '#00E5FF22', color: '#00E5FF', border: '1px solid #00E5FF' }}
                >
                  <Download size={12} />
                </button>
              )}
            </div>
            <audio ref={enhancedAudioRef} onEnded={() => setIsPlayingEnhanced(false)} style={{ display: 'none' }} />
          </div>
        )}
      </div>

      <style>{`
        .vocal-suite-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid rgba(255,255,255,0.4);
          box-shadow: 0 2px 8px rgba(0,0,0,0.45);
          margin-top: -4px;
        }
        .vocal-suite-range::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 999px;
        }
        .vocal-suite-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid rgba(255,255,255,0.35);
        }
        .neon-vocal-figure-wrap {
          padding: 10px 6px 14px;
        }
        /* Slight pop + soft neon rim (light, not heavy bloom) */
        .neon-vocal-figure-img {
          filter:
            contrast(1.1)
            saturate(1.12)
            brightness(1.05)
            drop-shadow(0 0 1px rgba(255, 255, 255, 0.45))
            drop-shadow(0 0 4px rgba(0, 229, 255, 0.5))
            drop-shadow(0 0 10px rgba(0, 229, 255, 0.28))
            drop-shadow(0 0 18px rgba(213, 0, 249, 0.18));
        }
      `}</style>
    </div>
      )}
    </div>
  );
}
