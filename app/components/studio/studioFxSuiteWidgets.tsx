'use client';

import { PadFxVerticalFader } from '@/app/components/creation/PadSamplerFxWidgets';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { StudioTrackMeterSnapshot } from '@/app/lib/studio/studioTrackAnalyserBus';
import {
  readStudioTrackMeterSnapshot,
  studioAnalyserLogBandIndex,
  studioAnalyserSpectrumDisplayLinear,
  studioMeterBallistics,
  STUDIO_METER_DISPLAY_FLOOR,
} from '@/app/lib/studio/studioTrackAnalyserBus';
import { useStudioAnalyserLevels } from '@/app/hooks/useStudioAnalyserLevels';
import type { StudioTrackInsertFxRack } from '@/app/lib/studio/studioTrackInsertFx';
import { studioInsertFxSuitePowered } from '@/app/lib/studio/studioTrackInsertFx';
import {
  DEESSER_AMOUNT_MAX,
  DEESSER_FREQ_MAX_HZ,
  DEESSER_FREQ_MIN_HZ,
} from '@/app/lib/creationStation/padSamplerFxRack';
import { STUDIO_EQ_BAND_COUNT, STUDIO_EQ_GRAPH_H } from '@/app/lib/studio/studioEq';
import { SUITE_FONT_FAMILY } from '@/app/lib/studio/studioUiTypography';
export const SUITE_FADER_H = 72;
/** Pitch Tune lanes — taller travel for precise retune / speed / flex drags. */
export const PITCH_TUNE_FADER_H = 98;

type SuiteFaderProps = Omit<ComponentProps<typeof PadFxVerticalFader>, 'faderHeight' | 'suiteTypography'> & {
  faderHeight?: number;
};

/** FX Suite vertical fader — Rajdhani labels + compact lane height. */
export function SuiteFader({ faderHeight = SUITE_FADER_H, ...props }: SuiteFaderProps) {
  return <PadFxVerticalFader {...props} faderHeight={faderHeight} suiteTypography />;
}

export const SUITE_MODULE_VIZ_SLOT_H = STUDIO_EQ_GRAPH_H + 8;
/** Fixed module body — preset strip + viz + faders (same footprint as EQ). */
export const SUITE_MODULE_BODY_H = 265;
/** Active module bay — header + padded body. */
export const SUITE_MODULE_BAY_H = 309;
/** Compact module body for Xvox-style side-by-side columns. */
export const SUITE_COLUMN_MODULE_BODY_H = 132;
export const SUITE_COLUMN_MODULE_VIZ_H = 52;
export const SUITE_COLUMN_EQ_BODY_H = 252;
export const SUITE_COLUMN_FADER_H = 54;

/** Xvox Pro-style column groups — modules stacked inside each lane. */
export const SUITE_XVOX_COLUMNS: {
  key: string;
  title: string;
  tagline: string;
  accent: string;
  modules: SuiteModuleId[];
}[] = [
  {
    key: 'dynamics',
    title: 'Dynamics',
    tagline: 'Gate · Comp · Limit',
    accent: '#f87171',
    modules: ['gate', 'deEsser', 'compressor', 'limiter'],
  },
  {
    key: 'tone',
    title: 'Tone',
    tagline: 'EQ · Filter · Drive',
    accent: '#7cf4c6',
    modules: ['eq', 'filter', 'saturation'],
  },
  {
    key: 'space',
    title: 'Space',
    tagline: 'Delay · Reverb',
    accent: '#a78bfa',
    modules: ['delay', 'reverb'],
  },
  {
    key: 'sfx',
    title: 'SFX',
    tagline: 'Mod · Color',
    accent: '#4ade80',
    modules: ['chorus'],
  },
];

export type SuiteModuleId =
  | 'eq'
  | 'gate'
  | 'deEsser'
  | 'compressor'
  | 'saturation'
  | 'filter'
  | 'chorus'
  | 'delay'
  | 'reverb'
  | 'limiter';

export const STUDIO_FX_CHROME = {
  frame: 'linear-gradient(165deg, rgba(42,42,52,0.88) 0%, rgba(20,20,28,0.82) 35%, rgba(12,12,18,0.78) 100%)',
  inset: 'linear-gradient(180deg, rgba(8,8,14,0.52) 0%, rgba(4,4,8,0.68) 100%)',
  bezel: '#3a3a48',
  bezelHi: '#5a5a6a',
  glass: 'rgba(12, 14, 22, 0.55)',
  header: 'linear-gradient(180deg, rgba(30,30,40,0.72) 0%, rgba(18,18,26,0.58) 60%, rgba(12,12,18,0.52) 100%)',
  footer: 'rgba(10,10,16,0.45)',
} as const;

/** @deprecated Use STUDIO_FX_CHROME */
export const CHROME = STUDIO_FX_CHROME;

/** Dim scrim behind portaled FX panels. */
export const STUDIO_FX_PANEL_BACKDROP = 'rgba(0,0,0,0.35)';

export function studioFxPanelShellStyle(accentHex = '#7cf4c6'): CSSProperties {
  return {
    border: `2px solid ${STUDIO_FX_CHROME.bezelHi}`,
    background: STUDIO_FX_CHROME.frame,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: `
      0 0 0 1px rgba(0,0,0,0.75),
      0 32px 80px rgba(0,0,0,0.9),
      0 0 48px ${accentHex}14,
      inset 0 1px 0 rgba(255,255,255,0.08)
    `,
  };
}

export function studioFxGlassChipStyle(on: boolean, accent: string): CSSProperties {
  return {
    borderColor: on ? `${accent}66` : 'rgba(58,58,72,0.72)',
    background: on
      ? `linear-gradient(180deg, ${accent}22 0%, ${accent}08 100%)`
      : 'linear-gradient(180deg, rgba(20,20,28,0.48) 0%, rgba(10,10,16,0.58) 100%)',
    boxShadow: on ? `0 0 12px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.05)` : 'inset 0 1px 2px rgba(0,0,0,0.32)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };
}

export function FxSuiteChromeFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-lg ${className}`}
      style={{
        border: `1px solid ${STUDIO_FX_CHROME.bezel}`,
        background: STUDIO_FX_CHROME.inset,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(255,255,255,0.04), 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.2) 100%)',
        }}
      />
      {children}
    </div>
  );
}

/** Hardware-style power LED + label plate */
export function FxModulePower({
  on,
  accent,
  onToggle,
  label,
  compact = false,
}: {
  on: boolean;
  accent: string;
  onToggle: () => void;
  label: string;
  /** Header row — LED + ON/OFF only */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-md px-2 py-0.5 border shrink-0 transition-all"
      style={{
        borderColor: on ? `${accent}66` : '#2a2a36',
        background: on
          ? `linear-gradient(180deg, ${accent}18 0%, ${accent}08 100%)`
          : 'linear-gradient(180deg, #14141c 0%, #0a0a10 100%)',
        boxShadow: on ? `0 0 16px ${accent}28, inset 0 1px 0 rgba(255,255,255,0.06)` : 'inset 0 1px 2px rgba(0,0,0,0.4)',
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: compact ? 7 : 8,
          height: compact ? 7 : 8,
          background: on ? accent : '#2a2a34',
          boxShadow: on ? `0 0 10px ${accent}, 0 0 4px ${accent}88` : 'inset 0 1px 2px rgba(0,0,0,0.6)',
        }}
      />
      {!compact ? (
        <span className="suite-type-micro text-[8px]" style={{ color: on ? accent : '#6a6a78' }}>
          {label}
        </span>
      ) : null}
      <span className="suite-type-micro text-[7px]" style={{ color: on ? '#c8f0e0' : '#4a4a58' }}>
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

/** Photorealistic vintage vacuum tube (6A1A-style) — glass stays clear; plate/filament glows with drive. */
function VacuumTube807Svg({ glow }: { glow: number }) {
  const uid = useId().replace(/:/g, '');
  const lit = glow > 0.008;
  const heat = Math.pow(Math.max(0, glow), 0.78);
  const bloom = 1.5 + heat * 14;
  const plateGlow = lit ? 0.12 + heat * 0.88 : 0;
  const filamentCore = lit ? 0.4 + heat * 0.6 : 0.04;
  const PIN_RIM_Y = 96;
  const PIN_RING_R = 14;

  return (
    <svg
      width={46}
      height={90}
      viewBox="0 0 64 118"
      fill="none"
      aria-hidden
      className="shrink-0"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="18%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          <stop offset="82%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.07)" />
        </linearGradient>
        <linearGradient id={`${uid}-getter`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#c8ccd4" />
          <stop offset="45%" stopColor="#8a9098" />
          <stop offset="100%" stopColor="#5a6068" />
        </linearGradient>
        <linearGradient id={`${uid}-plate`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3a4048" />
          <stop offset="50%" stopColor="#525860" />
          <stop offset="100%" stopColor="#3a4048" />
        </linearGradient>
        <radialGradient id={`${uid}-heat`} cx="50%" cy="55%" r="45%">
          <stop offset="0%" stopColor="#fff8e8" stopOpacity={filamentCore} />
          <stop offset="35%" stopColor="#ffc870" stopOpacity={plateGlow * 0.95} />
          <stop offset="70%" stopColor="#ff8020" stopOpacity={plateGlow * 0.55} />
          <stop offset="100%" stopColor="#ff5010" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-bloom`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={bloom} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={`${uid}-bulb`}>
          <path d="M32 8 C44 8 50 18 51 32 C52 52 51 74 49 86 C46 93 40 96 32 96 C24 96 18 93 15 86 C13 74 12 52 13 32 C14 18 20 8 32 8 Z" />
        </clipPath>
      </defs>

      {/* Internal heat — clipped inside bulb */}
      <g clipPath={`url(#${uid}-bulb)`}>
        {lit ? (
          <ellipse cx="32" cy="58" rx="16" ry="26" fill={`url(#${uid}-heat)`} filter={`url(#${uid}-bloom)`} />
        ) : null}

        {/* Getter mirror (top silver coat) */}
        <ellipse cx="32" cy="22" rx="14" ry="9" fill={`url(#${uid}-getter)`} opacity="0.92" />
        <ellipse cx="32" cy="20" rx="10" ry="5" fill="rgba(220,225,235,0.35)" />

        {/* Top mica */}
        <ellipse cx="32" cy="34" rx="15" ry="1.4" fill="rgba(210,205,195,0.55)" stroke="rgba(160,155,145,0.35)" strokeWidth="0.5" />

        {/* Anode / plate cylinder */}
        <rect x="22" y="38" width="20" height="36" rx="2" fill={`url(#${uid}-plate)`} />
        <rect x="24" y="42" width="4" height="28" rx="0.5" fill="rgba(20,22,28,0.55)" />
        <rect x="36" y="42" width="4" height="28" rx="0.5" fill="rgba(20,22,28,0.55)" />
        {lit ? (
          <rect x="26" y="46" width="12" height="22" rx="1" fill={`rgba(255,180,90,${0.08 + plateGlow * 0.35})`} filter={`url(#${uid}-bloom)`} />
        ) : null}

        {/* Faint glass marking */}
        <text x="32" y="52" textAnchor="middle" fill="rgba(30,32,38,0.35)" fontSize="5" fontFamily="monospace" fontWeight="700">
          6A1A
        </text>

        {/* Bottom mica */}
        <ellipse cx="32" cy="76" rx="14" ry="1.3" fill="rgba(210,205,195,0.5)" stroke="rgba(160,155,145,0.32)" strokeWidth="0.5" />

        {/* Copper lead wires */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
          const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
          const bx = 32 + Math.cos(a) * (PIN_RING_R - 2);
          return (
            <path
              key={i}
              d={`M32 76 Q${32 + Math.cos(a) * 5} 86 ${bx} ${PIN_RIM_Y - 2}`}
              stroke="#b87333"
              strokeWidth="0.55"
              fill="none"
              opacity="0.75"
            />
          );
        })}
      </g>

      {/* Glass envelope — flat wide rim, no stem */}
      <path
        d="M32 8 C44 8 50 18 51 32 C52 52 51 74 49 86 C46 93 40 96 32 96 C24 96 18 93 15 86 C13 74 12 52 13 32 C14 18 20 8 32 8 Z"
        fill={`url(#${uid}-glass)`}
        fillOpacity="0.32"
        stroke="rgba(200,210,222,0.5)"
        strokeWidth="1.1"
      />
      {/* Exhaust tip */}
      <circle cx="32" cy="5.5" r="2.2" fill="rgba(200,210,220,0.35)" stroke="rgba(160,170,185,0.4)" strokeWidth="0.6" />
      <path d="M32 3.2 V1.8" stroke="rgba(160,170,185,0.45)" strokeWidth="0.8" strokeLinecap="round" />

      {/* Glass highlights */}
      <path d="M19 24 C20 16 24 12 28 14" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M44 30 C45 42 44 58 41 70" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round" />

      {/* 9 pins — emerge from inside glass bottom rim */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
        const px = 32 + Math.cos(a) * PIN_RING_R;
        const rimY = PIN_RIM_Y - 1.5;
        return (
          <g key={i}>
            <line x1={px} y1={rimY - 2} x2={px} y2={rimY + 14} stroke="#b8bcc6" strokeWidth="1.65" strokeLinecap="round" />
            <circle cx={px} cy={rimY + 14.5} r="1.4" fill="#d4d8e0" stroke="#686870" strokeWidth="0.45" />
          </g>
        );
      })}
    </svg>
  );
}

const ANALOG_SAT_STEPS = 9;

function analogSatLevelToStep(level: number): number {
  return Math.round(Math.max(0, Math.min(1, level)) * ANALOG_SAT_STEPS);
}

function analogSatStepToLevel(step: number): number {
  return Math.max(0, Math.min(ANALOG_SAT_STEPS, Math.round(step))) / ANALOG_SAT_STEPS;
}

/** Black rotary knob 0–9 — 0 at top, 1→9 clockwise (like a clock). */
function SuiteAnalogSatKnob({ step, onChange }: { step: number; onChange: (step: number) => void }) {
  const gradId = useId().replace(/:/g, '');
  const dragRef = useRef<{ startY: number; startStep: number } | null>(null);
  const size = 50;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(ANALOG_SAT_STEPS, Math.round(step)));
  /** 0 at 12 o'clock; 1→9 sweep clockwise (~270° arc). */
  const dialDeg = (i: number) => -90 + (i / ANALOG_SAT_STEPS) * 270;
  /** Line drawn pointing up; rotate to match dial angle (0 = 12 o'clock). */
  const needleDeg = dialDeg(clamped) + 90;

  const bindDrag = () => ({
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startStep: clamped };
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const dy = dragRef.current.startY - e.clientY;
      const next = Math.round(dragRef.current.startStep + dy / 6);
      onChange(Math.max(0, Math.min(ANALOG_SAT_STEPS, next)));
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => {
      dragRef.current = null;
    },
  });

  return (
    <div
      className="flex flex-col items-center"
      data-no-drag
      style={{ width: size + 4, flexShrink: 0, touchAction: 'none', userSelect: 'none' }}
    >
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={ANALOG_SAT_STEPS}
        aria-valuenow={clamped}
        aria-label="Analog saturation"
        title="Analog saturation — drag up/down"
        style={{ width: size, height: size, cursor: 'ns-resize', position: 'relative' }}
        {...bindDrag()}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <defs>
            <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#1a1a22" />
              <stop offset="100%" stopColor="#050508" />
            </radialGradient>
          </defs>
          {Array.from({ length: ANALOG_SAT_STEPS + 1 }, (_, i) => {
            const ang = (dialDeg(i) * Math.PI) / 180;
            const tx = cx + Math.cos(ang) * (size * 0.44);
            const ty = cy + Math.sin(ang) * (size * 0.44);
            return (
              <text
                key={i}
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={i <= clamped ? '#c4a574' : '#4a4a58'}
                fontSize="6.5"
                fontFamily="monospace"
                fontWeight="700"
              >
                {i}
              </text>
            );
          })}
          <circle cx={cx} cy={cy} r={size * 0.32} fill="#0a0a0e" stroke="#2a2a32" strokeWidth="1.2" />
          <circle cx={cx} cy={cy} r={size * 0.3} fill={`url(#${gradId})`} />
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - size * 0.24}
            stroke="#f0f0f4"
            strokeWidth="1.8"
            strokeLinecap="round"
            transform={`rotate(${needleDeg} ${cx} ${cy})`}
          />
        </svg>
      </div>
    </div>
  );
}

/** Vintage tube + rotary knob — fixed footprint so header never shifts. */
export function SuiteAnalogTubeControl({
  level,
  onChange,
}: {
  level: number;
  onChange: (level: number) => void;
}) {
  const glow = Math.max(0, Math.min(1, level));
  const lit = glow > 0.008;
  const step = analogSatLevelToStep(level);

  return (
    <div
      className="shrink-0 flex items-center"
      data-no-drag
      style={{
        width: 168,
        height: 90,
        marginLeft: 18,
        background: 'transparent',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div className="flex items-center gap-1.5 h-full w-full">
        <div style={{ width: 46, height: 90, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <VacuumTube807Svg glow={glow} />
        </div>
        <div
          className="flex flex-col items-center justify-center"
          style={{ width: 112, height: 90, flexShrink: 0, overflow: 'visible' }}
        >
          <div
            className="flex flex-col items-center leading-none text-center"
            style={{ flexShrink: 0, marginBottom: 3, width: '100%', overflow: 'visible' }}
          >
            <span
              className="suite-type-micro"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: lit ? '#e8c896' : '#6a6a78',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}
            >
              ANALOG
            </span>
            <span
              className="suite-type-micro"
              style={{
                fontSize: '11px',
                fontWeight: 500,
                marginTop: 2,
                color: lit ? '#c4a574' : '#5a5a68',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              SATURATION
            </span>
          </div>
          <SuiteAnalogSatKnob
            step={step}
            onChange={(s) => onChange(analogSatStepToLevel(s))}
          />
        </div>
      </div>
    </div>
  );
}

const SUITE_METER_MIN_H = 88;
/** Matches stacked L/R meter column — canvas fills this height inside the chrome frame. */
const SUITE_ANALYZER_PLOT_MIN_H = SUITE_METER_MIN_H * 2 + 10;
const SUITE_ANALYZER_LABEL_H = 9;
const SUITE_ANALYZER_TOP_PAD = 2;
const SUITE_ANALYZER_BAR_ATTACK = 0.5;
const SUITE_ANALYZER_BAR_RELEASE = 0.7;

const SILENT_METER: StudioTrackMeterSnapshot = {
  peak: 0,
  peakL: 0,
  peakR: 0,
  rms: 0,
  hasSignal: false,
  spectrum: new Float32Array(0),
};

function SuiteLevelMeters({
  accent,
  trackIndex,
  meterActive,
}: {
  accent: string;
  trackIndex: number;
  meterActive: boolean;
}) {
  const fillLRef = useRef<HTMLDivElement | null>(null);
  const fillRRef = useRef<HTMLDivElement | null>(null);
  const accentRef = useRef(accent);
  accentRef.current = accent;

  useEffect(() => {
    if (!meterActive) {
      if (fillLRef.current) fillLRef.current.style.height = '0%';
      if (fillRRef.current) fillRRef.current.style.height = '0%';
      return;
    }
    let cancelled = false;
    let raf = 0;
    let smoothL = 0;
    let smoothR = 0;
    const tick = () => {
      if (cancelled) return;
      const raw = readStudioTrackMeterSnapshot(trackIndex);
      const a = accentRef.current;
      const grad = `linear-gradient(0deg, ${a} 0%, ${a}66 55%, ${a}22 100%)`;
      const glow = `0 0 8px ${a}44`;
      if (raw?.hasSignal) {
        const targetL = Math.min(1, raw.peakL * 2.1);
        const targetR = Math.min(1, raw.peakR * 2.1);
        smoothL = studioMeterBallistics(smoothL, targetL, true);
        smoothR = studioMeterBallistics(smoothR, targetR, true);
      } else {
        smoothL = studioMeterBallistics(smoothL, 0, false);
        smoothR = studioMeterBallistics(smoothR, 0, false);
      }
      if (fillLRef.current) {
        fillLRef.current.style.height = `${smoothL * 100}%`;
        fillLRef.current.style.background = smoothL > STUDIO_METER_DISPLAY_FLOOR ? grad : 'transparent';
        fillLRef.current.style.boxShadow = smoothL > STUDIO_METER_DISPLAY_FLOOR ? glow : 'none';
      }
      if (fillRRef.current) {
        fillRRef.current.style.height = `${smoothR * 100}%`;
        fillRRef.current.style.background = smoothR > STUDIO_METER_DISPLAY_FLOOR ? grad : 'transparent';
        fillRRef.current.style.boxShadow = smoothR > STUDIO_METER_DISPLAY_FLOOR ? glow : 'none';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [meterActive, trackIndex]);

  return (
    <div
      className="flex flex-col gap-1 shrink-0 self-stretch"
      style={{ width: 14, minHeight: SUITE_ANALYZER_PLOT_MIN_H }}
    >
      {(['L', 'R'] as const).map((ch, ci) => (
        <div key={ch} className="flex flex-col items-center gap-0.5 flex-1">
          <span className="suite-type-micro text-[6px]" style={{ color: '#5a5a68' }}>{ch}</span>
          <div
            className="relative flex-1 w-full rounded-sm overflow-hidden"
            style={{
              minHeight: 72,
              background: '#040408',
              border: '1px solid #222230',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7)',
            }}
          >
            <div
              ref={ci === 0 ? fillLRef : fillRRef}
              className="absolute bottom-0 left-0 right-0"
              style={{ height: '0%', background: 'transparent' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Hero FFT display — TRIAD / premium channel-strip aesthetic */
export function SuiteSpectrumAnalyzer({
  rack,
  accent,
  armed,
  trackIndex = 0,
  meterActive = false,
}: {
  rack: StudioTrackInsertFxRack;
  accent: string;
  /** FX modules armed — label only; motion requires real audio. */
  armed: boolean;
  trackIndex?: number;
  meterActive?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<Float32Array>(new Float32Array(64));
  const rackRef = useRef(rack);
  const armedRef = useRef(armed);
  const trackIndexRef = useRef(trackIndex);
  const meterActiveRef = useRef(meterActive);
  const accentRef = useRef(accent);
  const spectrumScratchRef = useRef(new Float32Array(256));
  rackRef.current = rack;
  armedRef.current = armed;
  trackIndexRef.current = trackIndex;
  meterActiveRef.current = meterActive;
  accentRef.current = accent;

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const syncSize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 1 || h < 1) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastDraw = 0;
    const bars = barsRef.current;
    const n = bars.length;

    const eqCurveOverlayDb = (i: number) => {
      const r = rackRef.current;
      if (!r.eq.enabled) return 0;
      const t = i / (n - 1);
      const hz = 20 * Math.pow(20000 / 20, t);
      let db = 0;
      for (const band of r.eq.bands) {
        const dist = Math.abs(Math.log(hz / band.freqHz));
        const weight =
          band.kind === 'lowshelf'
            ? hz <= band.freqHz
              ? 1
              : Math.max(0, 1 - dist * 2)
            : band.kind === 'highshelf'
              ? hz >= band.freqHz
                ? 1
                : Math.max(0, 1 - dist * 2)
              : Math.max(0, 1 - dist * (1.2 + band.q * 0.15));
        db += band.gainDb * weight;
      }
      if (r.filter.enabled) {
        const lowT = Math.log10(r.filter.lowCutHz / 20) / Math.log10(20000 / 20);
        const highT = Math.log10(r.filter.highCutHz / 20) / Math.log10(20000 / 20);
        if (t < lowT) db -= (lowT - t) * 22 * (0.5 + r.filter.resonance * 0.5);
        if (t > highT) db -= (t - highT) * 22 * (0.5 + r.filter.resonance * 0.5);
      }
      return db;
    };

    const draw = (t: number) => {
      if (t - lastDraw < 33) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastDraw = t;
      const meterActiveNow = meterActiveRef.current;
      const raw = meterActiveNow
        ? readStudioTrackMeterSnapshot(trackIndexRef.current, spectrumScratchRef.current)
        : null;
      const hasSignal = raw?.hasSignal ?? false;
      const accentNow = accentRef.current;
      const w = canvas.width;
      const h = canvas.height;
      if (w < 1 || h < 1) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const labelH = SUITE_ANALYZER_LABEL_H;
      const topPad = SUITE_ANALYZER_TOP_PAD;
      const plotBottom = h - labelH;
      const plotH = Math.max(24, plotBottom - topPad);
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0e1018');
      bg.addColorStop(0.5, '#06080c');
      bg.addColorStop(1, '#020204');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const lowEnd = 0.28 * w;
      const midEnd = 0.62 * w;
      ctx.fillStyle = 'rgba(99,102,241,0.04)';
      ctx.fillRect(0, 0, lowEnd, h);
      ctx.fillStyle = 'rgba(251,191,36,0.04)';
      ctx.fillRect(lowEnd, 0, midEnd - lowEnd, h);
      ctx.fillStyle = 'rgba(52,211,153,0.04)';
      ctx.fillRect(midEnd, 0, w - midEnd, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      [0.2, 0.4, 0.6, 0.8].forEach((f) => {
        const y = h * f;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      });
      const freqs = ['80', '200', '1k', '5k', '16k'];
      freqs.forEach((label, i) => {
        const x = (i / (freqs.length - 1)) * (w - 24) + 12;
        ctx.fillStyle = '#4a4a58';
        ctx.font = 'bold 8px system-ui,sans-serif';
        ctx.fillText(label, x - 8, h - 2);
      });

      if (hasSignal && raw && raw.spectrum.length > 0) {
        for (let i = 0; i < n; i++) {
          const srcI = studioAnalyserLogBandIndex(i, n, raw.spectrum.length);
          const target = studioAnalyserSpectrumDisplayLinear(raw.spectrum[srcI] ?? 0);
          bars[i] =
            bars[i]! * (1 - SUITE_ANALYZER_BAR_ATTACK) + target * SUITE_ANALYZER_BAR_ATTACK;
        }
      } else {
        for (let i = 0; i < n; i++) bars[i] = bars[i]! * SUITE_ANALYZER_BAR_RELEASE;
      }

      const barW = (w - 16) / n;
      for (let i = 0; i < n; i++) {
        const bh = Math.max(2, bars[i]! * plotH);
        const x = 8 + i * barW;
        const y = plotBottom - bh;
        const tBand = i / (n - 1);
        const barColor =
          tBand < 0.28 ? '#6366f1' : tBand < 0.62 ? '#fbbf24' : '#34d399';
        const barGrad = ctx.createLinearGradient(0, y, 0, plotBottom);
        barGrad.addColorStop(0, barColor);
        barGrad.addColorStop(0.6, `${barColor}99`);
        barGrad.addColorStop(1, `${barColor}22`);
        ctx.fillStyle = barGrad;
        ctx.fillRect(x + 0.5, y, barW - 1.5, bh);
      }

      ctx.strokeStyle = `${accentNow}66`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const db = eqCurveOverlayDb(i);
        const y = topPad + plotH * 0.52 - db * (plotH * 0.028);
        const x = 8 + i * barW + barW * 0.5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <FxSuiteChromeFrame>
      <div className="flex gap-2 px-2 py-1.5 items-stretch">
        <SuiteLevelMeters accent={accent} trackIndex={trackIndex} meterActive={meterActive} />
        <div
          ref={wrapRef}
          className="relative flex-1 min-w-0 min-h-0 rounded-md overflow-hidden self-stretch"
          style={{ border: '1px solid #1e1e28', minHeight: SUITE_ANALYZER_PLOT_MIN_H }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
          <div
            className="absolute top-0 left-0 right-0 h-5 pointer-events-none"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 100%)' }}
          />
          <div className="absolute top-1.5 left-3 flex items-center gap-2">
            <span className="suite-type-title text-[9px]" style={{ color: accent, textShadow: `0 0 12px ${accent}66` }}>
              Analyzer
            </span>
            <span
              className="suite-type-micro rounded px-1 py-px text-[6px]"
              style={{
                background: armed ? `${accent}22` : '#1a1a24',
                color: armed ? accent : '#5a5a68',
                border: `1px solid ${armed ? `${accent}44` : '#2a2a36'}`,
              }}
            >
              {armed ? 'ARMED' : 'STANDBY'}
            </span>
          </div>
          <div className="suite-type-micro absolute top-1.5 right-3 text-[7px] tabular-nums" style={{ color: '#5a5a68' }}>
            FFT
          </div>
        </div>
      </div>
    </FxSuiteChromeFrame>
  );
}

/** Signal-chain LED strip — shows active modules in rack order */
export function SuiteSignalChainStrip({
  rack,
  activeModule,
  onSelect,
}: {
  rack: StudioTrackInsertFxRack;
  activeModule: SuiteModuleId;
  onSelect: (id: SuiteModuleId) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 px-1.5 py-1 rounded-md overflow-x-auto"
      style={{
        background: 'linear-gradient(180deg, #0a0a10 0%, #06060c 100%)',
        border: '1px solid #222230',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      {SUITE_MODULES.map((m, i) => {
        const on = suiteModuleEnabled(rack, m.id);
        const sel = activeModule === m.id;
        return (
          <div key={m.id} className="flex items-center shrink-0">
            {i > 0 ? (
              <div
                className="w-3 h-px mx-0.5"
                style={{ background: on ? `${m.accent}44` : '#2a2a34' }}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              className="rounded-sm px-1 py-0.5"
              style={{
                background: sel ? `${m.accent}22` : 'transparent',
                boxShadow: sel ? `0 0 8px ${m.accent}33` : 'none',
              }}
              title={m.label}
            >
              <span
                className="block rounded-full mx-auto"
                style={{
                  width: 6,
                  height: 6,
                  background: on ? m.accent : '#2a2a34',
                  boxShadow: on ? `0 0 6px ${m.accent}` : 'none',
                }}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SuiteModuleGlyph({ id, accent, on }: { id: SuiteModuleId; accent: string; on: boolean }) {
  const c = on ? accent : '#5a5a68';
  const svgProps = { width: 18, height: 14, viewBox: '0 0 24 18', fill: 'none', className: 'block mx-auto' };

  switch (id) {
    case 'eq':
      return (
        <span className="font-black tabular-nums leading-none" style={{ fontSize: 13, color: c }}>
          {STUDIO_EQ_BAND_COUNT}
        </span>
      );
    case 'gate':
      return (
        <svg {...svgProps}>
          <rect x="2" y="4" width="5" height="10" rx="1" fill={`${c}55`} stroke={c} strokeWidth="1.2" />
          <rect x="17" y="4" width="5" height="10" rx="1" fill={`${c}55`} stroke={c} strokeWidth="1.2" />
          <path d="M9 9h6" stroke={c} strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      );
    case 'deEsser':
      return (
        <svg {...svgProps}>
          <path d="M2 14 L8 14 L8 6 L14 6 L14 14 L20 14" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M14 6 L20 10" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity={on ? 1 : 0.45} />
          <circle cx="17" cy="8" r="1.2" fill={c} opacity={on ? 1 : 0.5} />
        </svg>
      );
    case 'compressor':
      return (
        <svg {...svgProps}>
          <path d="M2 16 L8 10 L14 12 L22 4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="2" y1="16" x2="22" y2="16" stroke="#3a3a48" strokeWidth="1" />
        </svg>
      );
    case 'saturation':
      return (
        <svg {...svgProps}>
          <path d="M2 9 Q8 3 14 9 T22 9" stroke={c} strokeWidth="1.8" fill="none" />
          <line x1="2" y1="9" x2="22" y2="9" stroke="#3a3a48" strokeWidth="0.8" strokeDasharray="2 2" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...svgProps}>
          <path
            d="M2 14 L6 14 Q9 6 12 6 Q15 6 18 14 L22 14"
            stroke={c}
            strokeWidth="1.6"
            fill={`${c}22`}
            strokeLinecap="round"
          />
          <circle cx={6} cy={10} r={1.5} fill={c} opacity={on ? 1 : 0.5} />
          <circle cx={18} cy={10} r={1.5} fill={c} opacity={on ? 1 : 0.5} />
        </svg>
      );
    case 'chorus':
      return (
        <svg {...svgProps}>
          <path d="M2 10 Q6 4 10 10 T18 10 T22 10" stroke={c} strokeWidth="1.5" fill="none" opacity="0.55" />
          <path d="M2 12 Q6 6 10 12 T18 12 T22 12" stroke={c} strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'delay':
      return (
        <svg {...svgProps}>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={3 + i * 5} y={12 - i * 2} width="3" height={4 + i * 2} rx="0.5" fill={c} fillOpacity={0.35 + i * 0.18} />
          ))}
        </svg>
      );
    case 'reverb':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="9" r="2.5" stroke={c} strokeWidth="1.2" fill={`${c}33`} />
          <circle cx="12" cy="9" r="5.5" stroke={c} strokeOpacity="0.55" strokeWidth="1" fill="none" />
          <circle cx="12" cy="9" r="8.5" stroke={c} strokeOpacity="0.3" strokeWidth="1" fill="none" />
        </svg>
      );
    case 'limiter':
      return (
        <svg {...svgProps}>
          <line x1="2" y1="5" x2="22" y2="5" stroke={c} strokeWidth="2" />
          <path d="M2 16 L10 8 L16 11 L22 6" stroke={c} strokeOpacity="0.55" strokeWidth="1.4" fill="none" />
        </svg>
      );
    default:
      return null;
  }
}

export function SuiteModuleRackTile({
  id,
  label,
  accent,
  on,
  selected,
  onClick,
  onDoubleClick,
}: {
  id: SuiteModuleId;
  label: string;
  accent: string;
  on: boolean;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch min-w-0">
      <span
        className="suite-type-micro text-[5px] text-center leading-none mb-px truncate px-0.5"
        style={{ color: on || selected ? accent : '#6a6a78' }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className="relative rounded-md transition-all overflow-hidden min-w-0 w-full"
        style={{
          height: 26,
          padding: '2px 1px',
          border: `1px solid ${selected ? `${accent}88` : on ? `${accent}44` : '#2a2a36'}`,
          background: selected
            ? `linear-gradient(180deg, ${accent}20 0%, ${accent}08 50%, #0a0a10 100%)`
            : on
              ? `linear-gradient(180deg, ${accent}10 0%, #1e1e26 100%)`
              : 'linear-gradient(180deg, #14141c 0%, #0a0a10 100%)',
          boxShadow: selected
            ? `0 0 16px ${accent}28, inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.4)`
            : 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -2px 4px rgba(0,0,0,0.35)',
        }}
      >
        <span
          className="absolute top-0.5 right-0.5 rounded-full"
          style={{
            width: 3,
            height: 3,
            background: on ? accent : 'transparent',
            boxShadow: on ? `0 0 6px ${accent}` : 'none',
          }}
        />
        <div className="flex items-center justify-center h-full">
          <SuiteModuleGlyph id={id} accent={accent} on={on || selected} />
        </div>
      </button>
    </div>
  );
}

function VizChrome({ children, height = STUDIO_EQ_GRAPH_H }: { children: ReactNode; height?: number }) {
  return (
    <FxSuiteChromeFrame className="overflow-hidden h-full w-full">
      <div className="h-full w-full" style={{ minHeight: height }}>
        {children}
      </div>
    </FxSuiteChromeFrame>
  );
}

/** Log-frequency helpers shared by filter / analyzer-style graphs. */
const VIZ_LOG_FMIN = 20;
const VIZ_LOG_FMAX = 20000;

function vizLogHzToX(hz: number, padL: number, innerW: number): number {
  return padL + (Math.log(Math.max(VIZ_LOG_FMIN, hz) / VIZ_LOG_FMIN) / Math.log(VIZ_LOG_FMAX / VIZ_LOG_FMIN)) * innerW;
}

function vizXToLogHz(x: number, padL: number, innerW: number): number {
  const t = Math.max(0, Math.min(1, (x - padL) / Math.max(1, innerW)));
  return VIZ_LOG_FMIN * Math.pow(VIZ_LOG_FMAX / VIZ_LOG_FMIN, t);
}

function vizFilterBandMag(f: number, lowCut: number, highCut: number, resonance: number): number {
  const q = 0.55 + resonance * 3.2;
  const hpf =
    (f * f) /
    Math.sqrt((f * f - lowCut * lowCut) ** 2 + (f * lowCut / q) ** 2 + 1e-18);
  const lpf =
    (highCut * highCut) /
    Math.sqrt((f * f - highCut * highCut) ** 2 + (f * highCut / q) ** 2 + 1e-18);
  let mag = Math.min(1, (hpf * lpf) / Math.max(lowCut * 0.65, 40));
  const logF = Math.log(Math.max(f, 1));
  mag += resonance * 0.22 * Math.exp(-Math.pow((logF - Math.log(lowCut)) / 0.35, 2));
  mag += resonance * 0.22 * Math.exp(-Math.pow((logF - Math.log(highCut)) / 0.35, 2));
  return Math.min(1, mag);
}

function vizMagToY(mag: number, padT: number, plotH: number, dbMin: number, dbMax: number): number {
  const db = 20 * Math.log10(Math.max(1e-5, mag));
  const t = (db - dbMin) / (dbMax - dbMin);
  return padT + (1 - Math.max(0, Math.min(1, t))) * plotH;
}

function vizLogFreqGrid(
  padL: number,
  padR: number,
  padT: number,
  floorY: number,
  w: number,
  innerW: number,
) {
  const freqs = [100, 1000, 10000];
  const labels = ['100', '1k', '10k'];
  return (
    <>
      {freqs.map((hz, i) => {
        const x = vizLogHzToX(hz, padL, innerW);
        return (
          <g key={hz}>
            <line x1={x} y1={padT} x2={x} y2={floorY} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={x} y={floorY + 12} textAnchor="middle" fill="#5a5a68" fontSize={7} fontWeight={700}>
              {labels[i]}
            </text>
          </g>
        );
      })}
      {[-12, -24, -36].map((db) => {
        const y = vizMagToY(10 ** (db / 20), padT, floorY - padT, -42, 6);
        return (
          <line
            key={db}
            x1={padL}
            y1={y}
            x2={w - padR}
            y2={y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
            strokeDasharray="3 6"
          />
        );
      })}
    </>
  );
}

const SUITE_VIZ_READOUT_H = 20;

function SuiteVizReadoutStrip({
  cells,
}: {
  cells: { key: string; title: string; value: string; color?: string }[];
}) {
  return (
    <div
      className="shrink-0 grid border-b"
      style={{
        height: SUITE_VIZ_READOUT_H,
        gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
        borderColor: '#1c1c28',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 100%)',
      }}
    >
      {cells.map((cell) => (
        <div
          key={cell.key}
          className="flex items-center justify-center gap-0.5 px-0.5 border-r last:border-r-0 min-w-0 overflow-hidden"
          style={{ borderColor: '#1c1c28' }}
        >
          <span
            className="suite-type-micro text-[4px] leading-none shrink-0"
            style={{ color: '#5a5a68' }}
          >
            {cell.title}
          </span>
          <span
            className="suite-type-value text-[6px] leading-none truncate min-w-0"
            style={{ color: cell.color ?? '#b0b0c0' }}
          >
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function suiteFxInputLevels(meter: StudioTrackMeterSnapshot) {
  const inputL = meter.hasSignal ? Math.min(1, meter.peakL * 2.6) : 0;
  const inputR = meter.hasSignal ? Math.min(1, meter.peakR * 2.6) : 0;
  return { inputL, inputR, inputPeak: Math.max(inputL, inputR) };
}

/** Beat Pads Instrument / send tabs — animated IN/OUT without SE2 analyser tap. */
function suiteFxLevelsFromSimOrMeter(
  meter: StudioTrackMeterSnapshot,
  simMeterPeak?: number,
): { inputL: number; inputR: number; inputPeak: number; hasSignal: boolean } {
  if (simMeterPeak !== undefined) {
    const peak = Math.max(0, Math.min(1, simMeterPeak));
    return {
      inputL: Math.min(1, peak * 0.94),
      inputR: Math.min(1, peak * 0.88),
      inputPeak: peak,
      hasSignal: peak > 0.04,
    };
  }
  const { inputL, inputR, inputPeak } = suiteFxInputLevels(meter);
  return { inputL, inputR, inputPeak, hasSignal: meter.hasSignal };
}

function suiteFxWetOutput(inputL: number, inputR: number, enabled: boolean, wet: number) {
  const w = enabled ? Math.max(0, Math.min(1, wet)) : 0;
  return {
    outL: Math.min(1, inputL * (0.35 + w * 0.65)),
    outR: Math.min(1, inputR * (0.35 + w * 0.65)),
  };
}

function SuiteFxMeterLane({
  label,
  level,
  laneAccent,
  enabled = true,
  dim,
}: {
  label: string;
  level: number;
  laneAccent: string;
  enabled?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="flex flex-col min-w-0 flex-1 h-full gap-0.5">
      <span
        className="suite-type-micro text-[5px] leading-none text-center shrink-0"
        style={{ color: dim ? '#4a4a58' : '#5a5a68' }}
      >
        {label}
      </span>
      <div
        className="relative flex-1 min-h-0 rounded-[3px] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #050508 0%, #0a0a12 100%)',
          border: `1px solid ${dim ? '#181820' : '#1e1e28'}`,
          opacity: enabled ? 1 : 0.45,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '100% 20%',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
          style={{
            height: `${level * 100}%`,
            background:
              level > 0.02
                ? `linear-gradient(0deg, ${laneAccent} 0%, ${laneAccent}aa 35%, ${laneAccent}33 72%, transparent 100%)`
                : 'transparent',
            boxShadow: level > 0.55 ? `0 0 14px ${laneAccent}44` : 'none',
          }}
        />
      </div>
    </div>
  );
}

function SuiteFxMeterCluster({
  accent,
  enabled = true,
  inputL,
  inputR,
  midLabel,
  midLevel,
  midAccent,
  midActive = false,
  outL,
  outR,
}: {
  accent: string;
  enabled?: boolean;
  inputL: number;
  inputR: number;
  midLabel: string;
  midLevel: number;
  midAccent: string;
  midActive?: boolean;
  outL: number;
  outR: number;
}) {
  return (
    <div className="flex min-w-0 h-full gap-1 min-h-0" style={{ gridColumn: '1 / 3' }}>
      <div
        className="flex flex-col min-w-0 flex-1 h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <span className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5" style={{ color: accent }}>
          INPUT
        </span>
        <div className="flex flex-1 min-h-0 gap-1">
          <SuiteFxMeterLane label="L" level={inputL} laneAccent={accent} enabled={enabled} />
          <SuiteFxMeterLane label="R" level={inputR} laneAccent={accent} enabled={enabled} />
        </div>
      </div>
      <div
        className="flex flex-col min-w-0 flex-[0.55] h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
          border: `1px solid ${midActive ? `${midAccent}44` : 'rgba(255,255,255,0.04)'}`,
          boxShadow: midActive ? `inset 0 0 20px ${midAccent}12` : 'none',
        }}
      >
        <span
          className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5"
          style={{ color: midActive ? midAccent : '#5a5a68' }}
        >
          {midLabel}
        </span>
        <div className="flex flex-1 min-h-0">
          <SuiteFxMeterLane
            label=""
            level={midLevel}
            laneAccent={midActive ? midAccent : '#3a3a48'}
            enabled={enabled}
            dim={!midActive}
          />
        </div>
      </div>
      <div
        className="flex flex-col min-w-0 flex-1 h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <span className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5" style={{ color: '#7cf4c6' }}>
          OUTPUT
        </span>
        <div className="flex flex-1 min-h-0 gap-1">
          <SuiteFxMeterLane label="L" level={outL} laneAccent="#7cf4c6" enabled={enabled} />
          <SuiteFxMeterLane label="R" level={outR} laneAccent="#7cf4c6" enabled={enabled} />
        </div>
      </div>
    </div>
  );
}

function SuiteFxSplitViz({
  readoutCells,
  graphLabel,
  accent,
  enabled = true,
  inputL,
  inputR,
  midLabel,
  midLevel,
  midAccent,
  midActive = false,
  outL,
  outR,
  children,
}: {
  readoutCells: { key: string; title: string; value: string; color?: string }[];
  graphLabel: string;
  accent: string;
  enabled?: boolean;
  inputL: number;
  inputR: number;
  midLabel: string;
  midLevel: number;
  midAccent: string;
  midActive?: boolean;
  outL: number;
  outR: number;
  children: ReactNode;
}) {
  const h = STUDIO_EQ_GRAPH_H;
  const meterAreaH = h - SUITE_VIZ_READOUT_H;
  return (
    <VizChrome>
      <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: h }}>
        <SuiteVizReadoutStrip cells={readoutCells} />
        <div
          className="grid flex-1 min-h-0 gap-1 px-1 pb-1 pt-0.5"
          style={{
            height: meterAreaH,
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          }}
        >
          <SuiteFxMeterCluster
            accent={accent}
            enabled={enabled}
            inputL={inputL}
            inputR={inputR}
            midLabel={midLabel}
            midLevel={midLevel}
            midAccent={midAccent}
            midActive={midActive}
            outL={outL}
            outR={outR}
          />
          <div
            className="relative min-w-0 h-full rounded-md overflow-hidden min-h-0"
            style={{
              gridColumn: '3 / 5',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span
              className="absolute top-1 left-1.5 z-10 suite-type-micro text-[5px] pointer-events-none"
              style={{ color: '#6a6a78' }}
            >
              {graphLabel}
            </span>
            <div className="absolute inset-0">{children}</div>
          </div>
        </div>
      </div>
    </VizChrome>
  );
}

/** Uniform module layout — full or compact (Xvox column stack). */
export function SuiteModuleShell({
  top,
  viz,
  faders,
  compact = false,
  tall = false,
}: {
  top?: ReactNode;
  viz?: ReactNode;
  faders: ReactNode;
  compact?: boolean;
  /** Tone-column EQ — taller than compact siblings. */
  tall?: boolean;
}) {
  const bodyH = tall ? SUITE_COLUMN_EQ_BODY_H : compact ? SUITE_COLUMN_MODULE_BODY_H : SUITE_MODULE_BODY_H;
  const vizH = compact ? SUITE_COLUMN_MODULE_VIZ_H : SUITE_MODULE_VIZ_SLOT_H;
  const topH = compact ? 18 : 22;
  return (
    <div className="flex flex-col min-h-0" style={{ height: bodyH }}>
      <div className="shrink-0 flex items-center overflow-hidden" style={{ height: topH, minHeight: topH }}>
        {top ?? null}
      </div>
      <div className="shrink-0 mt-1 overflow-hidden" style={{ height: vizH }}>
        {viz ?? (
          <FxSuiteChromeFrame className="overflow-hidden h-full">
            <div className="h-full" style={{ minHeight: compact ? SUITE_COLUMN_MODULE_VIZ_H - 8 : STUDIO_EQ_GRAPH_H }} />
          </FxSuiteChromeFrame>
        )}
      </div>
      <div
        className={`shrink-0 flex justify-center items-start mt-1 pb-1 flex-wrap px-0.5 ${compact ? 'gap-x-1 gap-y-0.5' : 'gap-x-3.5 gap-y-2 mt-1.5 pb-1.5 px-1'}`}
      >
        {faders}
      </div>
    </div>
  );
}

/** Xvox Pro-style vertical column — title bar + stacked module cards. */
export function SuiteXvoxColumnShell({
  title,
  tagline,
  accent,
  armedCount,
  children,
}: {
  title: string;
  tagline: string;
  accent: string;
  armedCount: number;
  children: ReactNode;
}) {
  return (
    <div
      className="flex flex-col min-w-0 flex-1 rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${accent}33`,
        background: 'linear-gradient(180deg, #0e0e16 0%, #06060c 100%)',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 20px ${accent}08`,
      }}
    >
      <div
        className="shrink-0 px-2 py-1 flex items-center justify-between gap-1 border-b"
        style={{
          borderColor: `${accent}28`,
          background: `linear-gradient(90deg, ${accent}14 0%, transparent 100%)`,
        }}
      >
        <div className="min-w-0">
          <div className="suite-type-title text-[8px] leading-none truncate" style={{ color: accent }}>
            {title}
          </div>
          <div className="suite-type-micro text-[5px] mt-px truncate" style={{ color: '#6a6a78', textTransform: 'none' }}>
            {tagline}
          </div>
        </div>
        <span
          className="suite-type-micro shrink-0 rounded px-1 py-px text-[5px] border"
          style={{
            borderColor: armedCount > 0 ? `${accent}55` : '#2a2a36',
            color: armedCount > 0 ? accent : '#5a5a68',
            background: armedCount > 0 ? `${accent}12` : '#0a0a10',
          }}
        >
          {armedCount > 0 ? `${armedCount} on` : 'off'}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-1 min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/** Single effect card inside an Xvox column. */
export function SuiteModuleColumnCard({
  label,
  sub,
  accent,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  sub?: string;
  accent: string;
  enabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden flex flex-col min-h-0"
      style={{
        border: `1px solid ${enabled ? `${accent}44` : '#222230'}`,
        background: enabled
          ? `linear-gradient(180deg, ${accent}0c 0%, #08080e 100%)`
          : 'linear-gradient(180deg, #101018 0%, #08080e 100%)',
      }}
    >
      <div
        className="shrink-0 px-1.5 py-0.5 flex items-center justify-between gap-1 border-b"
        style={{ borderColor: `${accent}18`, background: 'rgba(0,0,0,0.35)' }}
      >
        <div className="min-w-0 flex items-baseline gap-1">
          <span className="suite-type-title text-[7px] truncate" style={{ color: enabled ? accent : '#8a8a98' }}>
            {label}
          </span>
          {sub ? (
            <span className="suite-type-micro text-[5px] truncate hidden sm:inline" style={{ color: '#5a5a68' }}>
              · {sub}
            </span>
          ) : null}
        </div>
        <FxModulePower compact on={enabled} accent={accent} onToggle={onToggle} label={label} />
      </div>
      <div className="min-h-0">{children}</div>
    </div>
  );
}

export function CompTransferCurve({
  thresholdDb,
  ratio,
  kneeDb,
  accent,
  makeupDb = 0,
  enabled = true,
  trackIndex = 0,
  meterActive = false,
  simMeterPeak,
}: {
  thresholdDb: number;
  ratio: number;
  kneeDb: number;
  accent: string;
  makeupDb?: number;
  enabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
  /** Beat Pads Instrument — animated meters without SE2 analyser. */
  simMeterPeak?: number;
}) {
  const gradId = useId().replace(/:/g, '');
  const meter = useStudioAnalyserLevels(trackIndex, meterActive && simMeterPeak === undefined);
  const h = STUDIO_EQ_GRAPH_H;
  const meterAreaH = h - SUITE_VIZ_READOUT_H;

  const thrClamped = Math.max(-48, Math.min(0, thresholdDb));
  const thrPct = ((thrClamped + 48) / 48) * 100;

  const { inputL, inputR, inputPeak, hasSignal } = suiteFxLevelsFromSimOrMeter(meter, simMeterPeak);
  const thrNorm = thrPct / 100;
  const over = Math.max(0, inputPeak - thrNorm);
  const compAmt = 1 - 1 / Math.max(1.01, ratio);
  const grLvl = enabled && hasSignal ? Math.min(1, over * compAmt * 2.8) : 0;
  const grDb = grLvl > 0.02 ? grLvl * 18 : 0;
  const compressing = grLvl > 0.04;
  const makeupBoost = (makeupDb / 18) * 0.22;
  const outL = enabled ? Math.min(1, inputL * (1 - grLvl * 0.55) + makeupBoost) : inputL * 0.35;
  const outR = enabled ? Math.min(1, inputR * (1 - grLvl * 0.55) + makeupBoost) : inputR * 0.35;

  const curve = useMemo(() => {
    const gw = 320;
    const gh = 88;
    const pad = 8;
  const dbMin = -48;
  const dbMax = 6;
    const toX = (db: number) => pad + ((db - dbMin) / (dbMax - dbMin)) * (gw - pad * 2);
    const toY = (db: number) => gh - pad - ((db - dbMin) / (dbMax - dbMin)) * (gh - pad * 2);

  const thr = thresholdDb;
  const knee = Math.max(0, kneeDb);
  const kneeLo = thr - knee / 2;
  const kneeHi = thr + knee / 2;

    const outDbForIn = (inDb: number) => {
    let outDb = inDb;
    if (inDb > kneeHi) outDb = thr + (inDb - thr) * (1 - compAmt);
    else if (inDb > kneeLo) {
      const t = (inDb - kneeLo) / Math.max(0.01, kneeHi - kneeLo);
      const fullOut = thr + (inDb - thr) * (1 - compAmt);
      outDb = inDb + t * (fullOut - inDb);
    }
      return outDb + (enabled ? makeupDb * 0.35 : 0);
    };

    let d = '';
    for (let inDb = dbMin; inDb <= dbMax; inDb += 0.5) {
      const x = toX(inDb);
      const y = toY(outDbForIn(inDb));
      d += d ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    const fillD = `${d} L ${toX(dbMax)} ${toY(dbMin)} L ${toX(dbMin)} ${toY(dbMin)} Z`;
    const unityD = `M ${toX(dbMin)} ${toY(dbMin)} L ${toX(dbMax)} ${toY(dbMax)}`;

    const inDbLive = dbMin + inputPeak * (dbMax - dbMin);
    const outDbLive = outDbForIn(inDbLive);
    const liveX = toX(inDbLive);
    const liveY = toY(outDbLive);

    return { gw, gh, pad, dbMin, dbMax, toX, toY, d, fillD, unityD, thr, liveX, liveY, showLive: hasSignal && inputPeak > 0.02 };
  }, [compAmt, enabled, hasSignal, inputPeak, kneeDb, makeupDb, thresholdDb]);

  const renderMeterLane = (
    label: string,
    level: number,
    laneAccent: string,
    opts?: { showThr?: boolean; dim?: boolean },
  ) => (
    <div className="flex flex-col min-w-0 flex-1 h-full gap-0.5">
      <span
        className="suite-type-micro text-[5px] leading-none text-center shrink-0"
        style={{ color: opts?.dim ? '#4a4a58' : '#5a5a68' }}
      >
        {label}
      </span>
      <div
        className="relative flex-1 min-h-0 rounded-[3px] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #050508 0%, #0a0a12 100%)',
          border: `1px solid ${opts?.dim ? '#181820' : '#1e1e28'}`,
          opacity: enabled ? 1 : 0.45,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '100% 20%',
          }}
        />
        {opts?.showThr && (
          <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ bottom: `${thrPct}%` }}>
            <div
              style={{
                height: 2,
                background: `linear-gradient(90deg, transparent 0%, ${accent} 10%, ${accent} 90%, transparent 100%)`,
                boxShadow: `0 0 10px ${accent}88`,
              }}
            />
          </div>
        )}
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
          style={{
            height: `${level * 100}%`,
            background:
              level > 0.02
                ? `linear-gradient(0deg, ${laneAccent} 0%, ${laneAccent}aa 35%, ${laneAccent}33 72%, transparent 100%)`
                : 'transparent',
            boxShadow: level > 0.55 ? `0 0 14px ${laneAccent}44` : 'none',
          }}
        />
      </div>
    </div>
  );

  return (
    <VizChrome>
      <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: h }}>
        <SuiteVizReadoutStrip
          cells={[
            {
              key: 'state',
              title: 'comp',
              value: !enabled ? 'OFF' : compressing ? 'GR ON' : 'READY',
              color: !enabled ? '#6a6a78' : compressing ? accent : '#8a8a98',
            },
            { key: 'thr', title: 'thr', value: `${Math.round(thresholdDb)} dB`, color: accent },
            {
              key: 'gr',
              title: 'reduction',
              value: compressing ? `−${grDb.toFixed(1)} dB` : '0.0 dB',
              color: compressing ? '#f87171' : '#7a7a8a',
            },
            { key: 'ratio', title: 'ratio', value: `1:${ratio.toFixed(1)}`, color: '#94a3b8' },
          ]}
        />
        <div
          className="grid flex-1 min-h-0 gap-1 px-1 pb-1 pt-0.5"
          style={{
            height: meterAreaH,
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          }}
        >
          <div
            className="flex min-w-0 h-full gap-1 min-h-0"
            style={{ gridColumn: '1 / 3' }}
          >
            <div
              className="flex flex-col min-w-0 flex-1 h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5" style={{ color: accent }}>
                INPUT
              </span>
              <div className="flex flex-1 min-h-0 gap-1">
                {renderMeterLane('L', inputL, accent, { showThr: true })}
                {renderMeterLane('R', inputR, accent, { showThr: true })}
              </div>
            </div>

            <div
              className="flex flex-col min-w-0 flex-[0.55] h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
                border: `1px solid ${compressing ? '#f8717133' : 'rgba(255,255,255,0.04)'}`,
                boxShadow: compressing ? 'inset 0 0 20px rgba(248,113,113,0.08)' : 'none',
              }}
            >
              <span
                className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5"
                style={{ color: compressing ? '#f87171' : '#5a5a68' }}
              >
                GR
              </span>
              <div className="flex flex-1 min-h-0">
                {renderMeterLane('', grLvl, compressing ? '#f87171' : '#3a3a48', { dim: !compressing })}
              </div>
            </div>

            <div
              className="flex flex-col min-w-0 flex-1 h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5" style={{ color: '#7cf4c6' }}>
                OUTPUT
              </span>
              <div className="flex flex-1 min-h-0 gap-1">
                {renderMeterLane('L', outL, '#7cf4c6')}
                {renderMeterLane('R', outR, '#7cf4c6')}
              </div>
            </div>
          </div>

          <div
            className="relative min-w-0 h-full rounded-md overflow-hidden min-h-0"
            style={{
              gridColumn: '3 / 5',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span
              className="absolute top-1 left-1.5 z-10 suite-type-micro text-[5px] pointer-events-none"
              style={{ color: '#6a6a78' }}
            >
              IN → OUT
            </span>
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${curve.gw} ${curve.gh}`}
              preserveAspectRatio="none"
              className="absolute inset-0 block h-full w-full"
            >
        <defs>
                  <linearGradient id={`compFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
                <rect
                  x={curve.pad}
                  y={curve.pad}
                  width={curve.gw - curve.pad * 2}
                  height={curve.gh - curve.pad * 2}
                  fill="rgba(0,0,0,0.35)"
                  rx={3}
                />
                {[-24, -12, 0].map((db) => (
                  <line
                    key={db}
                    x1={curve.pad}
                    y1={curve.toY(db)}
                    x2={curve.gw - curve.pad}
                    y2={curve.toY(db)}
                    stroke={db === 0 ? 'rgba(124,244,198,0.18)' : 'rgba(255,255,255,0.05)'}
                    strokeWidth={1}
                  />
                ))}
                <path d={curve.unityD} stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
                <path d={curve.fillD} fill={`url(#compFill-${gradId})`} pointerEvents="none" />
                <path
                  d={curve.d}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 5px ${accent}88)` }}
                  opacity={enabled ? 1 : 0.45}
                />
                <line
                  x1={curve.toX(curve.thr)}
                  y1={curve.pad}
                  x2={curve.toX(curve.thr)}
                  y2={curve.gh - curve.pad}
                  stroke={accent}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
                {curve.showLive && (
                  <>
                    <line
                      x1={curve.liveX}
                      y1={curve.toY(curve.dbMin)}
                      x2={curve.liveX}
                      y2={curve.liveY}
                      stroke="#7cf4c6"
                      strokeOpacity={0.35}
                      strokeWidth={1}
                    />
                    <line
                      x1={curve.pad}
                      y1={curve.liveY}
                      x2={curve.liveX}
                      y2={curve.liveY}
                      stroke="#7cf4c6"
                      strokeOpacity={0.35}
                      strokeWidth={1}
                    />
                    <circle
                      cx={curve.liveX}
                      cy={curve.liveY}
                      r={4}
                      fill="#7cf4c6"
                      stroke="#0a1018"
                      strokeWidth={1.25}
                      style={{ filter: 'drop-shadow(0 0 6px rgba(124,244,198,0.8))' }}
                    />
                  </>
                )}
      </svg>
          </div>
        </div>
      </div>
    </VizChrome>
  );
}

export function GateMeter({
  thresholdDb,
  floorDb,
  accent,
  enabled = true,
  trackIndex = 0,
  meterActive = false,
  simMeterPeak,
}: {
  thresholdDb: number;
  floorDb: number;
  accent: string;
  enabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
  /** Beat Pads Instrument — animated meters without SE2 analyser. */
  simMeterPeak?: number;
}) {
  const meter = useStudioAnalyserLevels(trackIndex, meterActive && simMeterPeak === undefined);
  const { inputL, inputR, inputPeak, hasSignal } = suiteFxLevelsFromSimOrMeter(meter, simMeterPeak);

  const thrClamped = Math.max(-48, Math.min(0, thresholdDb));
  const thrNorm = (thrClamped + 48) / 48;
  const open = enabled && hasSignal && inputPeak > thrNorm;
  const gated = enabled && hasSignal && !open;
  const floorGain = Math.pow(10, floorDb / 20);
  const floorMix = Math.min(1, Math.max(0.001, floorGain * 2.6));
  const outL = enabled ? (open ? inputL : Math.min(1, inputL * floorMix)) : inputL * 0.35;
  const outR = enabled ? (open ? inputR : Math.min(1, inputR * floorMix)) : inputR * 0.35;
  const gateLvl = gated ? Math.min(1, Math.max(0.06, (thrNorm - inputPeak) * 2.8)) : 0;
  const thrFromBottom = thrNorm * 100;

  return (
    <SuiteFxSplitViz
      accent={accent}
      enabled={enabled}
      inputL={inputL}
      inputR={inputR}
      midLabel="GATE"
      midLevel={gateLvl}
      midAccent={gated ? accent : '#3a3a48'}
      midActive={gated}
      outL={outL}
      outR={outR}
      graphLabel="THR"
      readoutCells={[
        {
          key: 'state',
          title: 'gate',
          value: !enabled ? 'OFF' : open ? 'OPEN' : gated ? 'GATED' : 'READY',
          color: !enabled ? '#6a6a78' : open ? accent : gated ? '#6a6a78' : '#8a8a98',
        },
        { key: 'thr', title: 'thr', value: `${Math.round(thresholdDb)} dB`, color: accent },
        { key: 'floor', title: 'floor', value: `${Math.round(floorDb)} dB`, color: '#94a3b8' },
        {
          key: 'attn',
          title: 'atten',
          value: gated ? `${Math.round(floorDb)} dB` : '0 dB',
          color: gated ? '#94a3b8' : '#7a7a8a',
        },
      ]}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #050508 0%, #0a0a12 100%)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '100% 20%',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
          style={{
            height: `${inputPeak * 100}%`,
            background: open
              ? `linear-gradient(0deg, ${accent} 0%, ${accent}55 40%, ${accent}15 100%)`
              : gated
                ? 'linear-gradient(0deg, #4a2030 0%, #1a1018 100%)'
                : 'transparent',
            boxShadow: open ? `0 0 20px ${accent}44` : 'none',
          }}
        />
        <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom: `${thrFromBottom}%` }}>
          <div
            style={{
              height: 1,
              background: `linear-gradient(90deg, transparent 0%, ${accent}cc 12%, ${accent}cc 88%, transparent 100%)`,
              boxShadow: `0 0 8px ${accent}55`,
            }}
          />
          <div
            className="absolute left-2 -translate-y-1/2 rounded px-1 py-px"
            style={{
              top: 0,
              background: `${accent}22`,
              border: `1px solid ${accent}55`,
            }}
          >
            <span className="suite-type-micro text-[5px]" style={{ color: accent }}>
              THR
            </span>
          </div>
        </div>
      </div>
    </SuiteFxSplitViz>
  );
}

function formatEssFreqHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
}

/** Split-band de-esser — sibilance band graph + INPUT | ESS | OUTPUT meters. */
export function DeEsserViz({
  freqHz,
  amount,
  accent,
  enabled = true,
  trackIndex = 0,
  meterActive = false,
}: {
  freqHz: number;
  amount: number;
  accent: string;
  enabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
}) {
  const gradId = useId().replace(/:/g, '');
  const meter = useStudioAnalyserLevels(trackIndex, meterActive);
  const { inputL, inputR, inputPeak } = suiteFxInputLevels(meter);
  const strength = amount / DEESSER_AMOUNT_MAX;
  const sibThr = 0.34 - strength * 0.18;
  const essActive = enabled && meter.hasSignal && inputPeak > sibThr;
  const essLvl = essActive ? Math.min(1, (inputPeak - sibThr) * strength * 4.2) : 0;
  const essDb = essLvl > 0.02 ? essLvl * (12 + strength * 20) : 0;
  const reduce = essLvl * strength * 0.88;
  const outL = enabled ? Math.min(1, inputL * (1 - reduce * 0.72)) : inputL * 0.35;
  const outR = enabled ? Math.min(1, inputR * (1 - reduce * 0.72)) : inputR * 0.35;

  const graph = useMemo(() => {
    const gw = 320;
    const gh = 88;
    const pad = 8;
    const hzMin = DEESSER_FREQ_MIN_HZ;
    const hzMax = DEESSER_FREQ_MAX_HZ;
    const toX = (hz: number) =>
      pad + ((Math.log(Math.max(hzMin, hz)) - Math.log(hzMin)) / (Math.log(hzMax) - Math.log(hzMin))) * (gw - pad * 2);
    const splitX = toX(freqHz);
    const duckDb = strength * 28 * (essActive ? 0.55 + essLvl * 0.45 : 0.35);
    const topY = pad + 6;
    const floorY = gh - pad;

    let lowD = '';
    let highD = '';
    const samples = 72;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const hz = hzMin * Math.pow(hzMax / hzMin, t);
      const x = toX(hz);
      if (hz <= freqHz) {
        lowD += lowD ? ` L ${x.toFixed(1)} ${topY.toFixed(1)}` : `M ${x.toFixed(1)} ${topY.toFixed(1)}`;
      } else {
        const hiT = (Math.log(hz) - Math.log(freqHz)) / (Math.log(hzMax) - Math.log(freqHz));
        const y = topY + hiT * (duckDb / 22) * (floorY - topY - 8);
        highD += highD ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${splitX.toFixed(1)} ${topY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }

    const bandFill = `M ${splitX.toFixed(1)} ${topY.toFixed(1)} L ${gw - pad} ${topY.toFixed(1)} L ${gw - pad} ${floorY} L ${splitX.toFixed(1)} ${floorY} Z`;

    return { gw, gh, pad, splitX, topY, floorY, lowD, highD, bandFill, duckDb };
  }, [amount, essActive, essLvl, freqHz, strength]);

  return (
    <SuiteFxSplitViz
      accent={accent}
      enabled={enabled}
      inputL={inputL}
      inputR={inputR}
      midLabel="ESS"
      midLevel={essLvl}
      midAccent="#f87171"
      midActive={essActive}
      outL={outL}
      outR={outR}
      graphLabel="SIBILANCE BAND"
      readoutCells={[
        {
          key: 'state',
          title: 'ess',
          value: !enabled ? 'OFF' : essActive ? 'ACTIVE' : 'READY',
          color: !enabled ? '#6a6a78' : essActive ? accent : '#8a8a98',
        },
        { key: 'freq', title: 'freq', value: `${formatEssFreqHz(freqHz)} Hz`, color: accent },
        {
          key: 'cut',
          title: 'reduction',
          value: essActive ? `−${essDb.toFixed(1)} dB` : '0.0 dB',
          color: essActive ? '#f87171' : '#7a7a8a',
        },
        { key: 'amt', title: 'amount', value: `${Math.round(amount * 100)}%`, color: '#94a3b8' },
      ]}
    >
      <svg viewBox={`0 0 ${graph.gw} ${graph.gh}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${gradId}-band`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id={`${gradId}-duck`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[2500, 5000, 8000, 12000, 16000].map((hz) => {
          const x =
            graph.pad +
            ((Math.log(hz) - Math.log(DEESSER_FREQ_MIN_HZ)) / (Math.log(DEESSER_FREQ_MAX_HZ) - Math.log(DEESSER_FREQ_MIN_HZ))) *
              (graph.gw - graph.pad * 2);
          return (
            <line key={hz} x1={x} y1={graph.pad} x2={x} y2={graph.floorY} stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1" />
          );
        })}
        <path d={graph.bandFill} fill={`url(#${gradId}-band)`} />
        <path d={graph.lowD} fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeOpacity="0.55" />
        <path
          d={graph.highD}
          fill="none"
          stroke={accent}
          strokeWidth={essActive ? 2.2 : 1.6}
          strokeLinecap="round"
          style={{ filter: essActive ? `drop-shadow(0 0 6px ${accent}88)` : undefined }}
        />
        <line
          x1={graph.splitX}
          y1={graph.topY - 4}
          x2={graph.splitX}
          y2={graph.floorY}
          stroke={accent}
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity={0.85}
        />
        <circle cx={graph.splitX} cy={graph.topY - 2} r="3.5" fill={accent} stroke="#0a0a12" strokeWidth="1.2" />
        {essActive ? (
          <rect
            x={graph.splitX}
            y={graph.topY}
            width={graph.gw - graph.pad - graph.splitX}
            height={graph.floorY - graph.topY}
            fill={`url(#${gradId}-duck)`}
            opacity={0.35 + essLvl * 0.35}
          />
        ) : null}
      </svg>
    </SuiteFxSplitViz>
  );
}

export function ReverbRoomViz({
  mix,
  decaySec,
  accent,
  enabled = true,
  trackIndex = 0,
  meterActive = false,
  simMeterPeak,
}: {
  mix: number;
  decaySec: number;
  accent: string;
  enabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
  /** Beat Pads send tab — animated meters without SE2 analyser. */
  simMeterPeak?: number;
}) {
  const meter = useStudioAnalyserLevels(trackIndex, meterActive && simMeterPeak === undefined);
  const sim = simMeterPeak !== undefined;
  const inputL = sim ? Math.min(1, simMeterPeak * 0.94) : suiteFxInputLevels(meter).inputL;
  const inputR = sim ? Math.min(1, simMeterPeak * 0.88) : suiteFxInputLevels(meter).inputR;
  const inputPeak = sim ? simMeterPeak : Math.max(meter.peakL, meter.peakR);
  const hasSignal = sim ? simMeterPeak > 0.04 : meter.hasSignal;
  const { outL, outR } = suiteFxWetOutput(inputL, inputR, enabled, mix);
  const wetLvl = enabled ? Math.min(1, inputPeak * mix * 1.2) : 0;
  const live = enabled && hasSignal && mix > 0.02;
  const rings = [0.22, 0.38, 0.54, 0.72, 0.9];
  const phase = live ? (performance.now() / 1000) % Math.max(0.4, decaySec) : 0;

  return (
    <SuiteFxSplitViz
      accent={accent}
      enabled={enabled}
      inputL={inputL}
      inputR={inputR}
      midLabel="WET"
      midLevel={wetLvl}
      midAccent={accent}
      midActive={live}
      outL={outL}
      outR={outR}
      graphLabel="ROOM"
      readoutCells={[
        {
          key: 'state',
          title: 'verb',
          value: !enabled ? 'OFF' : live ? 'WET' : 'READY',
          color: !enabled ? '#6a6a78' : live ? accent : '#8a8a98',
        },
        { key: 'mix', title: 'mix', value: `${Math.round(mix * 100)}%`, color: accent },
        { key: 'decay', title: 'decay', value: `${decaySec.toFixed(1)}s`, color: '#c4b5fd' },
        {
          key: 'tail',
          title: 'tail',
          value: live ? `${Math.round(wetLvl * 100)}%` : '0%',
          color: live ? accent : '#7a7a8a',
        },
      ]}
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 55%, #12121a 0%, #06060c 100%)' }}
      >
        {rings.map((r, i) => {
          const pulse = live ? Math.max(0, 1 - Math.abs(phase / decaySec - i * 0.18) * 3) : 0;
          return (
            <div
              key={i}
              className="absolute rounded-full border-2"
              style={{
                width: `${r * 100}%`,
                height: `${r * 100}%`,
                borderColor: `${accent}${Math.round(40 + pulse * 120)
                  .toString(16)
                  .padStart(2, '0')}`,
                boxShadow: pulse > 0.2 ? `0 0 ${16 + pulse * 28}px ${accent}55` : 'none',
                opacity: live ? 0.3 + mix * 0.6 : 0.2,
              }}
            />
          );
        })}
        <span
          className="relative text-[9px] font-black uppercase tracking-[0.18em]"
          style={{ color: accent, textShadow: `0 0 12px ${accent}66` }}
        >
          {Math.round(mix * 100)}%
        </span>
      </div>
    </SuiteFxSplitViz>
  );
}

export function DelayEchoViz({
  mix,
  feedback,
  accent,
  syncLabel,
  enabled = true,
  trackIndex = 0,
  meterActive = false,
  simMeterPeak,
}: {
  mix: number;
  feedback: number;
  accent: string;
  syncLabel?: string;
  enabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
  simMeterPeak?: number;
}) {
  const meter = useStudioAnalyserLevels(trackIndex, meterActive && simMeterPeak === undefined);
  const sim = simMeterPeak !== undefined;
  const inputL = sim ? Math.min(1, simMeterPeak * 0.94) : suiteFxInputLevels(meter).inputL;
  const inputR = sim ? Math.min(1, simMeterPeak * 0.88) : suiteFxInputLevels(meter).inputR;
  const inputPeak = sim ? simMeterPeak : Math.max(meter.peakL, meter.peakR);
  const hasSignal = sim ? simMeterPeak > 0.04 : meter.hasSignal;
  const { outL, outR } = suiteFxWetOutput(inputL, inputR, enabled, mix);
  const echoLvl = enabled ? Math.min(1, inputPeak * mix * (0.45 + feedback * 0.65)) : 0;
  const live = enabled && hasSignal && mix > 0.02;
  const tick = live ? performance.now() / 1000 : 0;

  return (
    <SuiteFxSplitViz
      accent={accent}
      enabled={enabled}
      inputL={inputL}
      inputR={inputR}
      midLabel="ECHO"
      midLevel={echoLvl}
      midAccent="#a78bfa"
      midActive={live && echoLvl > 0.04}
      outL={outL}
      outR={outR}
      graphLabel={syncLabel ? `${syncLabel} SYNC` : 'DELAY'}
      readoutCells={[
        {
          key: 'state',
          title: 'delay',
          value: !enabled ? 'OFF' : live ? 'ECHO' : 'READY',
          color: !enabled ? '#6a6a78' : live ? accent : '#8a8a98',
        },
        { key: 'mix', title: 'mix', value: `${Math.round(mix * 100)}%`, color: accent },
        { key: 'fb', title: 'fb', value: `${Math.round(feedback * 100)}%`, color: '#94a3b8' },
        {
          key: 'tap',
          title: 'level',
          value: live ? `${Math.round(echoLvl * 100)}%` : '0%',
          color: live ? '#a78bfa' : '#7a7a8a',
        },
      ]}
    >
      <div
        className="relative flex h-full w-full items-end overflow-hidden px-2 pb-2"
        style={{ background: 'linear-gradient(180deg, #050508 0%, #0a0a12 100%)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '14% 100%',
          }}
        />
        {Array.from({ length: 8 }, (_, i) => {
          const pulse = live ? Math.max(0, Math.sin(tick * 3 - i * 0.55) * 0.5 + 0.5) * Math.pow(feedback, i) : 0;
          return (
            <div
              key={i}
              className="absolute rounded-sm transition-[height,opacity] duration-75"
              style={{
                left: `${8 + i * 10}%`,
                width: '9%',
                height: live ? `${12 + pulse * 72}%` : '4%',
                bottom: 8,
                background: `linear-gradient(0deg, ${accent}, ${accent}33)`,
                opacity: live ? mix * (0.4 + pulse * 0.6) : 0.08,
                boxShadow: pulse > 0.3 ? `0 0 12px ${accent}66` : 'none',
              }}
            />
          );
        })}
      </div>
    </SuiteFxSplitViz>
  );
}

export function DriveWaveViz({
  drive,
  tone,
  accent,
  enabled = true,
  trackIndex = 0,
  meterActive = false,
  simMeterPeak,
}: {
  drive: number;
  tone: number;
  accent: string;
  enabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
  /** Beat Pads Instrument — animated meters without SE2 analyser. */
  simMeterPeak?: number;
}) {
  const gradId = useId().replace(/:/g, '');
  const meter = useStudioAnalyserLevels(trackIndex, meterActive && simMeterPeak === undefined);
  const h = STUDIO_EQ_GRAPH_H;
  const meterAreaH = h - SUITE_VIZ_READOUT_H;

  const { inputL, inputR, inputPeak, hasSignal } = suiteFxLevelsFromSimOrMeter(meter, simMeterPeak);
  const toneBright = 0.35 + tone * 0.65;
  const saturating = enabled && hasSignal && drive > 0.02 && inputPeak > 0.04;
  const harmLvl = enabled ? Math.min(1, inputPeak * drive * 1.35) : 0;
  const driveBoost = 1 + drive * 0.55 * toneBright;
  const outL = enabled ? Math.min(1, inputL * driveBoost) : inputL * 0.35;
  const outR = enabled ? Math.min(1, inputR * driveBoost) : inputR * 0.35;

  const curve = useMemo(() => {
    const gw = 320;
    const gh = 88;
    const pad = 8;
  const k = Math.max(0.01, drive * 8 + 0.5);
    const midY = gh / 2;
    const amp = midY - pad - 4;

  let d = '';
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * 2 - 1;
      const x = pad + ((t + 1) / 2) * (gw - pad * 2);
      const y = midY - (Math.tanh(k * t) / Math.tanh(k)) * amp;
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const fillD = `${d} L ${gw - pad} ${midY} L ${pad} ${midY} Z`;

    const liveT = Math.min(0.98, inputPeak);
    const liveX = pad + ((liveT + 1) / 2) * (gw - pad * 2);
    const liveY = midY - (Math.tanh(k * liveT) / Math.tanh(k)) * amp;

    return {
      gw,
      gh,
      pad,
      midY,
      d,
      fillD,
      k,
      liveX,
      liveY,
      showLive: hasSignal && inputPeak > 0.03,
    };
  }, [drive, hasSignal, inputPeak]);

  const driveLabel = `${Math.round(drive * 100)}%`;
  const toneLabel = `${Math.round(tone * 100)}%`;
  const stateLabel = !enabled ? 'OFF' : saturating ? (drive > 0.65 ? 'HOT' : 'WARM') : 'READY';

  const renderMeterLane = (
    label: string,
    level: number,
    laneAccent: string,
    opts?: { dim?: boolean },
  ) => (
    <div className="flex flex-col min-w-0 flex-1 h-full gap-0.5">
      <span
        className="suite-type-micro text-[5px] leading-none text-center shrink-0"
        style={{ color: opts?.dim ? '#4a4a58' : '#5a5a68' }}
      >
        {label}
      </span>
      <div
        className="relative flex-1 min-h-0 rounded-[3px] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #050508 0%, #0a0a12 100%)',
          border: `1px solid ${opts?.dim ? '#181820' : '#1e1e28'}`,
          opacity: enabled ? 1 : 0.45,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '100% 20%',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
          style={{
            height: `${level * 100}%`,
            background:
              level > 0.02
                ? `linear-gradient(0deg, ${laneAccent} 0%, ${laneAccent}aa 35%, ${laneAccent}33 72%, transparent 100%)`
                : 'transparent',
            boxShadow: level > 0.55 ? `0 0 14px ${laneAccent}44` : 'none',
          }}
        />
      </div>
    </div>
  );

  return (
    <VizChrome>
      <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: h }}>
        <SuiteVizReadoutStrip
          cells={[
            {
              key: 'state',
              title: 'drive',
              value: stateLabel,
              color: !enabled ? '#6a6a78' : saturating ? accent : '#8a8a98',
            },
            { key: 'drive', title: 'drive', value: driveLabel, color: accent },
            { key: 'tone', title: 'tone', value: toneLabel, color: '#94a3b8' },
            {
              key: 'harm',
              title: 'harm',
              value: saturating ? `${Math.round(harmLvl * 100)}%` : '0%',
              color: saturating ? '#fbbf24' : '#7a7a8a',
            },
          ]}
        />
        <div
          className="grid flex-1 min-h-0 gap-1 px-1 pb-1 pt-0.5"
          style={{
            height: meterAreaH,
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          }}
        >
          <div
            className="flex min-w-0 h-full gap-1 min-h-0"
            style={{ gridColumn: '1 / 3' }}
          >
            <div
              className="flex flex-col min-w-0 flex-1 h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5" style={{ color: accent }}>
                INPUT
              </span>
              <div className="flex flex-1 min-h-0 gap-1">
                {renderMeterLane('L', inputL, accent)}
                {renderMeterLane('R', inputR, accent)}
              </div>
            </div>

            <div
              className="flex flex-col min-w-0 flex-[0.55] h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
                border: `1px solid ${saturating ? `${accent}44` : 'rgba(255,255,255,0.04)'}`,
                boxShadow: saturating ? `inset 0 0 20px ${accent}12` : 'none',
              }}
            >
              <span
                className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5"
                style={{ color: saturating ? '#fbbf24' : '#5a5a68' }}
              >
                HARM
              </span>
              <div className="flex flex-1 min-h-0">
                {renderMeterLane('', harmLvl, saturating ? '#fbbf24' : '#3a3a48', { dim: !saturating })}
              </div>
            </div>

            <div
              className="flex flex-col min-w-0 flex-1 h-full rounded-md overflow-hidden px-1 pb-1 pt-0.5"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span className="suite-type-micro text-[5px] text-center shrink-0 mb-0.5" style={{ color: '#7cf4c6' }}>
                OUTPUT
              </span>
              <div className="flex flex-1 min-h-0 gap-1">
                {renderMeterLane('L', outL, '#7cf4c6')}
                {renderMeterLane('R', outR, '#7cf4c6')}
              </div>
            </div>
          </div>

          <div
            className="relative min-w-0 h-full rounded-md overflow-hidden min-h-0"
            style={{
              gridColumn: '3 / 5',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <span
              className="absolute top-1 left-1.5 z-10 suite-type-micro text-[5px] pointer-events-none"
              style={{ color: '#6a6a78' }}
            >
              WAVE
            </span>
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${curve.gw} ${curve.gh}`}
              preserveAspectRatio="none"
              className="absolute inset-0 block h-full w-full"
            >
              <defs>
                <linearGradient id={`driveFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.35 * toneBright} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <rect
                x={curve.pad}
                y={curve.pad}
                width={curve.gw - curve.pad * 2}
                height={curve.gh - curve.pad * 2}
                fill="rgba(0,0,0,0.35)"
                rx={3}
              />
              <line
                x1={curve.pad}
                y1={curve.midY}
                x2={curve.gw - curve.pad}
                y2={curve.midY}
                stroke="rgba(124,244,198,0.16)"
                strokeWidth={1}
              />
              <path d={curve.fillD} fill={`url(#driveFill-${gradId})`} pointerEvents="none" />
              <path
                d={curve.d}
                fill="none"
                stroke={accent}
                strokeWidth={2.25}
                opacity={enabled ? 0.55 + drive * 0.45 : 0.35}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 6px ${accent}77)` }}
              />
              {curve.showLive && (
                <>
                  <line
                    x1={curve.pad}
                    y1={curve.midY}
                    x2={curve.liveX}
                    y2={curve.liveY}
                    stroke="#7cf4c6"
                    strokeOpacity={0.35}
                    strokeWidth={1}
                  />
                  <circle
                    cx={curve.liveX}
                    cy={curve.liveY}
                    r={4}
                    fill="#7cf4c6"
                    stroke="#0a1018"
                    strokeWidth={1.25}
                    style={{ filter: 'drop-shadow(0 0 6px rgba(124,244,198,0.8))' }}
                  />
                </>
              )}
      </svg>
          </div>
        </div>
      </div>
    </VizChrome>
  );
}

export function ChorusModViz({
  mix,
  rateHz,
  depth,
  accent,
  enabled = true,
  trackIndex = 0,
  meterActive = false,
}: {
  mix: number;
  rateHz: number;
  depth: number;
  accent: string;
  enabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
}) {
  const meter = useStudioAnalyserLevels(trackIndex, meterActive);
  const { inputL, inputR, inputPeak } = suiteFxInputLevels(meter);
  const { outL, outR } = suiteFxWetOutput(inputL, inputR, enabled, mix);
  const modLvl = enabled ? Math.min(1, inputPeak * mix * (0.35 + depth * 0.75)) : 0;
  const live = enabled && meter.hasSignal && mix > 0.02;
  const glow = mix * (0.45 + depth * 0.55);
  const spreadW = 28 + depth * 42 + mix * 18;
  const spreadH = 22 + depth * 38 + mix * 14;

  return (
    <SuiteFxSplitViz
      accent={accent}
      enabled={enabled}
      inputL={inputL}
      inputR={inputR}
      midLabel="MOD"
      midLevel={modLvl}
      midAccent="#a78bfa"
      midActive={live && modLvl > 0.04}
      outL={outL}
      outR={outR}
      graphLabel="CHORUS"
      readoutCells={[
        {
          key: 'state',
          title: 'chorus',
          value: !enabled ? 'OFF' : live ? 'MOD' : 'READY',
          color: !enabled ? '#6a6a78' : live ? accent : '#8a8a98',
        },
            { key: 'mix', title: 'mix', value: `${Math.round(mix * 100)}%`, color: mix > 0.02 ? accent : '#6a6a78' },
            { key: 'rate', title: 'rate', value: `${rateHz.toFixed(1)} Hz`, color: '#94a3b8' },
            { key: 'depth', title: 'depth', value: `${Math.round(depth * 100)}%`, color: '#a78bfa' },
          ]}
    >
        <div
        className="relative h-full w-full overflow-hidden transition-all duration-150"
          style={{ background: 'linear-gradient(180deg, #050508 0%, #0a0a10 100%)' }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-150"
            style={{
              opacity: 0.35 + glow * 0.65,
              background: `radial-gradient(ellipse ${spreadW}% ${spreadH}% at 50% 50%, ${accent}55 0%, ${accent}18 42%, transparent 72%)`,
            }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-150"
            style={{
              opacity: glow * 0.9,
              background: `linear-gradient(90deg, transparent 0%, ${accent}22 18%, ${accent}44 50%, ${accent}22 82%, transparent 100%)`,
            }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-150 pointer-events-none"
            style={{
              opacity: glow,
              boxShadow: `inset 0 0 ${24 + mix * 48}px ${accent}33`,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 100%)',
            }}
          />
        </div>
    </SuiteFxSplitViz>
  );
}

export function LimiterCeilingViz({
  ceilingDb,
  accent,
  enabled = true,
  trackIndex = 0,
  meterActive = false,
  simMeterPeak,
}: {
  ceilingDb: number;
  accent: string;
  enabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
  /** Beat Pads Instrument — animated meters without SE2 analyser. */
  simMeterPeak?: number;
}) {
  const gradId = useId().replace(/:/g, '');
  const meter = useStudioAnalyserLevels(trackIndex, meterActive && simMeterPeak === undefined);
  const { inputL, inputR, inputPeak, hasSignal } = suiteFxLevelsFromSimOrMeter(meter, simMeterPeak);
  const gr = enabled && hasSignal ? Math.min(1, Math.max(0, inputPeak - 0.55) * 2.4) : 0;
  const grActive = gr > 0.08;
  const grDbLabel = grActive ? (gr * 12).toFixed(1) : '0.0';
  const outL = enabled ? Math.min(1, inputL * (1 - gr * 0.5)) : inputL * 0.35;
  const outR = enabled ? Math.min(1, inputR * (1 - gr * 0.5)) : inputR * 0.35;

  const curve = useMemo(() => {
    const gw = 320;
    const gh = 88;
    const pad = 8;
    const dbMin = -48;
    const dbMax = 6;
    const toX = (db: number) => pad + ((db - dbMin) / (dbMax - dbMin)) * (gw - pad * 2);
    const toY = (db: number) => gh - pad - ((db - dbMin) / (dbMax - dbMin)) * (gh - pad * 2);
    const ceilY = toY(ceilingDb);
    const inDbLive = dbMin + inputPeak * (dbMax - dbMin);
    const outDbLive = Math.min(ceilingDb, inDbLive);
    return {
      gw,
      gh,
      pad,
      ceilY,
      liveX: toX(inDbLive),
      liveY: toY(outDbLive),
      showLive: hasSignal && inputPeak > 0.03,
    };
  }, [ceilingDb, hasSignal, inputPeak]);

  return (
    <SuiteFxSplitViz
      accent={accent}
      enabled={enabled}
      inputL={inputL}
      inputR={inputR}
      midLabel="GR"
      midLevel={gr}
      midAccent={grActive ? '#f87171' : '#3a3a48'}
      midActive={grActive}
      outL={outL}
      outR={outR}
      graphLabel="CEIL"
      readoutCells={[
            {
              key: 'state',
          title: 'limit',
          value: !enabled ? 'OFF' : grActive ? 'GR ON' : 'ARMED',
          color: !enabled ? '#6a6a78' : grActive ? accent : '#8a8a98',
            },
            { key: 'ceil', title: 'ceil', value: `${ceilingDb.toFixed(1)} dB`, color: accent },
        {
          key: 'gr',
          title: 'reduction',
          value: grActive ? `−${grDbLabel} dB` : '0.0 dB',
          color: grActive ? '#f87171' : '#7a7a8a',
        },
        {
          key: 'peak',
          title: 'peak',
          value: hasSignal ? `${Math.round(inputPeak * 100)}%` : '0%',
          color: grActive ? accent : '#94a3b8',
        },
      ]}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${curve.gw} ${curve.gh}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        <defs>
          <linearGradient id={`limFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <rect
          x={curve.pad}
          y={curve.pad}
          width={curve.gw - curve.pad * 2}
          height={curve.gh - curve.pad * 2}
          fill="rgba(0,0,0,0.35)"
          rx={3}
        />
        {[-24, -12, 0].map((db) => {
          const y = curve.gh - curve.pad - ((db + 48) / 54) * (curve.gh - curve.pad * 2);
          return (
            <line
              key={db}
              x1={curve.pad}
              y1={y}
              x2={curve.gw - curve.pad}
              y2={y}
              stroke={db === 0 ? 'rgba(124,244,198,0.18)' : 'rgba(255,255,255,0.05)'}
              strokeWidth={1}
            />
          );
        })}
        <rect
          x={curve.pad}
          y={curve.ceilY}
          width={curve.gw - curve.pad * 2}
          height={curve.gh - curve.pad - curve.ceilY}
          fill={`url(#limFill-${gradId})`}
          opacity={grActive ? 0.9 : 0.35}
        />
        <line
          x1={curve.pad}
          y1={curve.ceilY}
          x2={curve.gw - curve.pad}
          y2={curve.ceilY}
          stroke={accent}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 8px ${accent}88)` }}
        />
        <rect
          x={curve.pad}
          y={curve.ceilY}
          width={Math.max(0, (grActive ? curve.liveX : curve.pad) - curve.pad)}
          height={curve.gh - curve.pad - curve.ceilY}
          fill={accent}
          opacity={grActive ? 0.25 : 0}
        />
        {curve.showLive && (
          <>
            <line
              x1={curve.liveX}
              y1={curve.gh - curve.pad}
              x2={curve.liveX}
              y2={curve.liveY}
              stroke="#7cf4c6"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            <circle
              cx={curve.liveX}
              cy={curve.liveY}
              r={4}
              fill="#7cf4c6"
              stroke="#0a1018"
              strokeWidth={1.25}
              style={{ filter: 'drop-shadow(0 0 6px rgba(124,244,198,0.8))' }}
            />
          </>
        )}
      </svg>
    </SuiteFxSplitViz>
  );
}

export function FilterBandViz({
  lowCutHz,
  highCutHz,
  resonance,
  accent,
  disabled,
  onChange,
  trackIndex = 0,
  meterActive = false,
  simMeterPeak,
}: {
  lowCutHz: number;
  highCutHz: number;
  resonance: number;
  accent: string;
  disabled?: boolean;
  onChange: (patch: { lowCutHz?: number; highCutHz?: number }) => void;
  trackIndex?: number;
  meterActive?: boolean;
  /** Beat Pads Instrument — animated meters without SE2 analyser. */
  simMeterPeak?: number;
}) {
  const gradId = useId().replace(/:/g, '');
  const w = 488;
  const h = STUDIO_EQ_GRAPH_H;
  const padL = 36;
  const padR = 48;
  const padT = 14;
  const padB = 26;
  const dbMin = -42;
  const dbMax = 6;
  const innerW = w - padL - padR;
  const plotH = h - padT - padB;
  const floorY = h - padB;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<'low' | 'high' | null>(null);
  const cutsRef = useRef({ lowCutHz, highCutHz });
  cutsRef.current = { lowCutHz, highCutHz };
  const enabled = !disabled;
  const meter = useStudioAnalyserLevels(trackIndex, meterActive && simMeterPeak === undefined);
  const { inputL, inputR, inputPeak, hasSignal } = suiteFxLevelsFromSimOrMeter(meter, simMeterPeak);
  const passLvl = enabled ? Math.min(1, inputPeak * (0.35 + resonance * 0.55)) : 0;
  const live = enabled && hasSignal && inputPeak > 0.03;
  const { outL, outR } = suiteFxWetOutput(inputL, inputR, enabled, 0.85);

  const hzToX = (hz: number) => vizLogHzToX(hz, padL, innerW);
  const xToHz = (x: number) => vizXToLogHz(x, padL, innerW);

  const clientToSvgX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return padL;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    const ctm = svg.getScreenCTM();
    if (!ctm) return padL;
    return pt.matrixTransform(ctm.inverse()).x;
  };

  const clampCuts = (low: number, high: number) => {
    let lo = Math.max(20, Math.min(800, low));
    let hi = Math.max(400, Math.min(18000, high));
    if (hi < lo + 200) {
      if (dragRef.current === 'low') lo = Math.max(20, hi - 200);
      else hi = Math.min(18000, lo + 200);
    }
    return { lowCutHz: lo, highCutHz: hi };
  };

  const applyPointer = (which: 'low' | 'high', clientX: number) => {
    if (disabled) return;
    const x = clientToSvgX(clientX);
    const hz = xToHz(x);
    const { lowCutHz: lo, highCutHz: hi } = cutsRef.current;
    if (which === 'low') onChange(clampCuts(hz, hi));
    else onChange(clampCuts(lo, hz));
  };

  const bindHandleDrag = (which: 'low' | 'high') => ({
    style: { cursor: disabled ? 'default' : 'ew-resize', touchAction: 'none' as const },
    onPointerDown: (e: PointerEvent<Element>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = which;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      applyPointer(which, e.clientX);
    },
    onPointerMove: (e: PointerEvent<Element>) => {
      if (dragRef.current !== which) return;
      e.preventDefault();
      applyPointer(which, e.clientX);
    },
    onPointerUp: (e: PointerEvent<Element>) => {
      if (dragRef.current !== which) return;
      dragRef.current = null;
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    onPointerCancel: (e: PointerEvent<Element>) => {
      if (dragRef.current !== which) return;
      dragRef.current = null;
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
  });

  const lowX = hzToX(lowCutHz);
  const highX = hzToX(highCutHz);

  const samples = 96;
  const curvePts: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const hz = VIZ_LOG_FMIN * Math.pow(VIZ_LOG_FMAX / VIZ_LOG_FMIN, t);
    const mag = vizFilterBandMag(hz, lowCutHz, highCutHz, resonance);
    curvePts.push({
      x: vizLogHzToX(hz, padL, innerW),
      y: vizMagToY(mag, padT, plotH, dbMin, dbMax),
    });
  }

  let curveD = `M ${curvePts[0]?.x ?? padL} ${curvePts[0]?.y ?? floorY}`;
  for (let i = 1; i < curvePts.length; i++) {
    curveD += ` L ${curvePts[i]!.x.toFixed(1)} ${curvePts[i]!.y.toFixed(1)}`;
  }
  const fillD = `${curveD} L ${vizLogHzToX(VIZ_LOG_FMAX, padL, innerW)} ${floorY} L ${padL} ${floorY} Z`;

  const lowY = vizMagToY(vizFilterBandMag(lowCutHz, lowCutHz, highCutHz, resonance), padT, plotH, dbMin, dbMax);
  const highY = vizMagToY(vizFilterBandMag(highCutHz, lowCutHz, highCutHz, resonance), padT, plotH, dbMin, dbMax);

  const fmtHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`);
  const hitW = 44;
  const hitH = 36;

  const renderHandle = (which: 'low' | 'high', x: number, y: number, label: string, color: string) => (
    <g key={which}>
      <circle cx={x} cy={y} r={14} fill={`${color}18`} stroke={color} strokeOpacity={0.35} strokeWidth={1} pointerEvents="none" />
      <circle cx={x} cy={y} r={5.5} fill={color} stroke="#0a1018" strokeWidth={1.5} pointerEvents="none" style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }} />
      <rect
        x={x - hitW / 2}
        y={y - hitH / 2}
        width={hitW}
        height={hitH}
        rx={8}
        fill="transparent"
        {...bindHandleDrag(which)}
      />
      <rect
        x={x - 16}
        y={floorY + 2}
        width={32}
        height={14}
        rx={4}
        fill="#0a0a12"
        stroke={color}
        strokeOpacity={0.55}
        strokeWidth={1}
        pointerEvents="none"
      />
      <text x={x} y={floorY + 12} textAnchor="middle" fill={color} fontSize={7} fontWeight={800} pointerEvents="none">
        {label} {fmtHz(which === 'low' ? lowCutHz : highCutHz)}
      </text>
    </g>
  );

  return (
    <SuiteFxSplitViz
      accent={accent}
      enabled={enabled}
      inputL={inputL}
      inputR={inputR}
      midLabel="PASS"
      midLevel={passLvl}
      midAccent="#fbbf24"
      midActive={live}
      outL={outL}
      outR={outR}
      graphLabel="FILTER"
      readoutCells={[
        {
          key: 'state',
          title: 'filter',
          value: !enabled ? 'OFF' : live ? 'ACTIVE' : 'READY',
          color: !enabled ? '#6a6a78' : live ? accent : '#8a8a98',
        },
        { key: 'lc', title: 'lc', value: fmtHz(lowCutHz), color: '#fbbf24' },
        { key: 'hc', title: 'hc', value: fmtHz(highCutHz), color: accent },
        { key: 'res', title: 'res', value: `${Math.round(resonance * 100)}%`, color: '#94a3b8' },
      ]}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        style={{ touchAction: 'none', userSelect: 'none' }}
        role="img"
        aria-label="Filter low cut and high cut — drag handles horizontally"
      >
        <defs>
          <linearGradient id={`filterFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.38} />
            <stop offset="55%" stopColor={accent} stopOpacity={0.12} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={`filterPass-${gradId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.08} />
            <stop offset={`${((lowX - padL) / innerW) * 100}%`} stopColor={accent} stopOpacity={0.1} />
            <stop offset={`${((highX - padL) / innerW) * 100}%`} stopColor={accent} stopOpacity={0.1} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <rect x={padL} y={padT} width={innerW} height={plotH} fill="rgba(0,0,0,0.35)" rx={4} />
        {vizLogFreqGrid(padL, padR, padT, floorY, w, innerW)}
        <rect x={lowX} y={padT} width={Math.max(0, highX - lowX)} height={plotH} fill={`url(#filterPass-${gradId})`} pointerEvents="none" />
        <path d={fillD} fill={`url(#filterFill-${gradId})`} pointerEvents="none" />
        <path
          d={curveD}
          fill="none"
          stroke={accent}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
          style={{ filter: `drop-shadow(0 0 7px ${accent}88)` }}
          opacity={enabled ? 1 : 0.45}
        />
        {renderHandle('low', lowX, lowY, 'LC', '#fbbf24')}
        {renderHandle('high', highX, highY, 'HC', accent)}
      </svg>
    </SuiteFxSplitViz>
  );
}

export function FilterCutoffViz(props: {
  lowCutHz: number;
  highCutHz: number;
  resonance: number;
  accent: string;
  disabled?: boolean;
  trackIndex?: number;
  meterActive?: boolean;
  simMeterPeak?: number;
  onChange?: (patch: { lowCutHz?: number; highCutHz?: number }) => void;
}) {
  if (props.onChange) {
    return <FilterBandViz {...props} onChange={props.onChange} />;
  }
  return (
    <FilterBandViz
      lowCutHz={props.lowCutHz}
      highCutHz={props.highCutHz}
      resonance={props.resonance}
      accent={props.accent}
      disabled
      simMeterPeak={props.simMeterPeak}
      onChange={() => {}}
    />
  );
}

export const SUITE_MODULES: { id: SuiteModuleId; label: string; accent: string; sub: string }[] = [
  { id: 'eq', label: 'EQ', accent: '#7cf4c6', sub: `${STUDIO_EQ_BAND_COUNT}-band` },
  { id: 'gate', label: 'Gate', accent: '#f87171', sub: 'dynamics' },
  { id: 'deEsser', label: 'De-ess', accent: '#38bdf8', sub: 'sibilance' },
  { id: 'compressor', label: 'Comp', accent: '#fbbf24', sub: 'dynamics' },
  { id: 'saturation', label: 'Drive', accent: '#fb923c', sub: 'harmonics' },
  { id: 'filter', label: 'Filter', accent: '#38bdf8', sub: 'LC · HC' },
  { id: 'chorus', label: 'Chorus', accent: '#4ade80', sub: 'mod' },
  { id: 'delay', label: 'Delay', accent: '#f472b6', sub: 'space' },
  { id: 'reverb', label: 'Verb', accent: '#a78bfa', sub: 'space' },
  { id: 'limiter', label: 'Limit', accent: '#e879f9', sub: 'safety' },
];

export function suiteModuleEnabled(rack: StudioTrackInsertFxRack, id: SuiteModuleId): boolean {
  if (!studioInsertFxSuitePowered(rack)) return false;
  switch (id) {
    case 'eq':
      return rack.eq.enabled;
    case 'gate':
      return rack.gate.enabled;
    case 'deEsser':
      return rack.deEsser.enabled;
    case 'compressor':
      return rack.compressor.enabled;
    case 'saturation':
      return rack.saturation.enabled && rack.saturation.drive > 0.01;
    case 'filter':
      return rack.filter.enabled;
    case 'chorus':
      return rack.chorus.enabled;
    case 'delay':
      return rack.delay.enabled;
    case 'reverb':
      return rack.reverb.enabled;
    case 'limiter':
      return rack.limiter.enabled;
    default:
      return false;
  }
}
