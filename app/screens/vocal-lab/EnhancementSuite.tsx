import { useState, type CSSProperties, type ReactNode } from 'react';

import { SlidersHorizontal, Mic2, Sparkles, Wind, SunMedium, Radio, AudioWaveform } from 'lucide-react';

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
  { id: 'studio', label: 'Studio Polish', hint: 'Radio-ready sheen', color: '#D500F9', icon: <Sparkles size={14} /> },
  { id: 'live', label: 'Live Stage', hint: 'Punch & presence', color: '#00E5FF', icon: <Radio size={14} /> },
  { id: 'intimate', label: 'Intimate', hint: 'Soft & close', color: '#ffcc00', icon: <Mic2 size={14} /> },
  { id: 'broadcast', label: 'Broadcast', hint: 'Max clarity', color: '#00ff88', icon: <Wind size={14} /> },
];

const PRESET_VALUES: Record<string, Record<string, number>> = {
  studio: { autotune: 70, noise: 80, deess: 60, clarity: 75, smooth: 65, eq: 55 },
  live: { autotune: 30, noise: 40, deess: 50, clarity: 60, smooth: 45, eq: 50 },
  intimate: { autotune: 20, noise: 50, deess: 30, clarity: 40, smooth: 70, eq: 40 },
  broadcast: { autotune: 85, noise: 90, deess: 75, clarity: 90, smooth: 80, eq: 60 },
};

export default function EnhancementSuite() {
  const [autotuneOn, setAutotuneOn] = useState(false);
  const [autotune, setAutotune] = useState(50);
  const [noise, setNoise] = useState(40);
  const [deess, setDeess] = useState(30);
  const [clarity, setClarity] = useState(50);
  const [smooth, setSmooth] = useState(50);
  const [eq, setEq] = useState(50);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyPreset(id: string) {
    const v = PRESET_VALUES[id];
    setAutotune(v.autotune);
    setNoise(v.noise);
    setDeess(v.deess);
    setClarity(v.clarity);
    setSmooth(v.smooth);
    setEq(v.eq);
    setAutotuneOn(true);
    setActivePreset(id);
  }

  const clearPreset = () => setActivePreset(null);

  return (
    <div className="flex flex-col min-w-0" style={{ gap: '1rem' }}>
      {/* Title block — subtitle on its own line so nothing collides */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #00E5FF22, #D500F922)', border: '1px solid #00E5FF33' }}
          >
            <SlidersHorizontal size={18} style={{ color: '#00E5FF' }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: '#00E5FF' }}>
              Enhancement Suite
            </h3>
            <p className="text-[11px] leading-relaxed mt-0.5 max-w-xl" style={{ color: '#6a6a78' }}>
              Chain processing for vocals — tune pitch, tame harshness, then polish tone. Presets load a full chain; tweak sliders after.
            </p>
          </div>
        </div>
      </div>

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
                onClick={() => applyPreset(p.id)}
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
            subtitle="Correct pitch to the nearest scale step. Higher = stronger correction."
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
  );
}
