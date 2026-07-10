'use client';

import { useId, useMemo } from 'react';
import type { GenoUltraLfoShape, GenoUltraModSlot, GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { GenoBassEnvScreen } from '@/app/components/studio/genoBassEnvScreen';
import { AnaFxModernFrame } from '@/app/components/studio/genoUltraFxVisuals';
import { GenoBassBtn, GenoBassMoogKnob, GENO_BASS_THEME } from '@/app/components/studio/genoBassWoodUi';

const LFO_SHAPES: readonly GenoUltraLfoShape[] = ['sine', 'triangle', 'square', 'saw'];

const LFO_VIEW_W = 240;
const LFO_VIEW_H = 120;
const LFO_PLOT = { x0: 4, x1: 236, y0: 30, y1: 116 };

function lfoWavePath(shape: GenoUltraLfoShape, depth: number, cycles = 1, phase = 0): string {
  const { x0, x1, y0, y1 } = LFO_PLOT;
  const midY = (y0 + y1) / 2;
  const halfH = (y1 - y0) / 2;
  const amp = halfH * (0.06 + depth * 0.94);
  const width = x1 - x0;
  const pts: string[] = [];

  for (let x = x0; x <= x1; x += 2) {
    const t = (x - x0) / width;
    const p = t * Math.PI * 2 * cycles + phase;
    let y = 0;
    switch (shape) {
      case 'square':
        y = Math.sign(Math.sin(p));
        break;
      case 'triangle':
        y = (2 / Math.PI) * Math.asin(Math.sin(p));
        break;
      case 'saw':
        y = ((p / (Math.PI * 2)) % 1) * 2 - 1;
        break;
      default:
        y = Math.sin(p);
    }
    const py = midY - y * amp;
    pts.push(`${x === x0 ? 'M' : 'L'} ${x} ${py.toFixed(1)}`);
  }
  return pts.join(' ');
}

function ModLfoScreen({
  which,
  shape,
  rateHz,
  depth,
  modSlots,
  slotOffset,
}: {
  which: 'l1' | 'l2';
  shape: GenoUltraLfoShape;
  rateHz: number;
  depth: number;
  modSlots: GenoUltraModSlot[];
  slotOffset: number;
}) {
  const clipId = useId().replace(/:/g, '');
  const bgId = useId().replace(/:/g, '');
  const isL1 = which === 'l1';
  const accent = isL1 ? GENO_BASS_THEME.sphinxHi : GENO_BASS_THEME.amberHi;
  const glow = isL1 ? GENO_BASS_THEME.sphinxGlow : GENO_BASS_THEME.amberGlow;
  const label = isL1 ? 'LFO 1' : 'LFO 2';

  const wavePath = useMemo(() => lfoWavePath(shape, depth, 1), [shape, depth]);
  const plotMidY = (LFO_PLOT.y0 + LFO_PLOT.y1) / 2;

  return (
    <AnaFxModernFrame height={120} minHeight={120} style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${LFO_VIEW_W} ${LFO_VIEW_H}`} width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isL1 ? 'rgba(155,109,255,0.1)' : 'rgba(240,160,32,0.08)'} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x={LFO_PLOT.x0} y={LFO_PLOT.y0} width={LFO_PLOT.x1 - LFO_PLOT.x0} height={LFO_PLOT.y1 - LFO_PLOT.y0} />
          </clipPath>
        </defs>
        <rect x={0} y={0} width={LFO_VIEW_W} height={LFO_VIEW_H} fill={`url(#${bgId})`} />
        <rect
          x={LFO_PLOT.x0}
          y={LFO_PLOT.y0}
          width={LFO_PLOT.x1 - LFO_PLOT.x0}
          height={LFO_PLOT.y1 - LFO_PLOT.y0}
          fill="none"
          stroke="rgba(148,163,184,0.1)"
          strokeWidth={1}
        />
        {[0.25, 0.5, 0.75].map((frac) => {
          const y = LFO_PLOT.y0 + (LFO_PLOT.y1 - LFO_PLOT.y0) * frac;
          return (
            <line
              key={frac}
              x1={LFO_PLOT.x0}
              y1={y}
              x2={LFO_PLOT.x1}
              y2={y}
              stroke="rgba(148,163,184,0.1)"
              strokeWidth={1}
            />
          );
        })}
        <line
          x1={LFO_PLOT.x0}
          y1={plotMidY}
          x2={LFO_PLOT.x1}
          y2={plotMidY}
          stroke="rgba(148,163,184,0.18)"
          strokeWidth={1}
        />
        <text x={8} y={14} fill={GENO_BASS_THEME.labelDim} fontSize={7} fontWeight={700} fontFamily="ui-monospace, monospace">
          {label} · {shape.toUpperCase()}
        </text>
        <text x={8} y={26} fill={accent} fontSize={6.5} fontWeight={800} opacity={0.9}>
          {rateHz.toFixed(2)} Hz · depth {(depth * 100).toFixed(0)}%
        </text>
        <g clipPath={`url(#${clipId})`}>
          <path
            d={wavePath}
            fill="none"
            stroke={accent}
            strokeWidth={2.6}
            opacity={0.95}
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 8px ${glow})` }}
          />
        </g>
        {modSlots.map((slot, i) => {
          if (slot.source === 'off' || slot.dest === 'off' || Math.abs(slot.amount) < 0.02) return null;
          const x = LFO_VIEW_W - 40 + i * 14;
          const h = 8 + Math.abs(slot.amount) * 14;
          return (
            <g key={i}>
              <rect
                x={x}
                y={18 - h}
                width={10}
                height={h}
                rx={2}
                fill={GENO_BASS_THEME.sphinx}
                opacity={0.35 + Math.abs(slot.amount) * 0.45}
              />
              <text x={x + 5} y={22} textAnchor="middle" fill={GENO_BASS_THEME.labelDim} fontSize={5} fontWeight={700}>
                S{slotOffset + i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </AnaFxModernFrame>
  );
}

export type GenoBassModPanelProps = {
  voice: GenoUltraSynthVoiceParams;
  disabled?: boolean;
  onPatchVoice: (patch: Partial<GenoUltraSynthVoiceParams>) => void;
};

export function GenoBassModPanel({ voice, disabled, onPatchVoice }: GenoBassModPanelProps) {
  const patchAudible = (patch: Partial<GenoUltraSynthVoiceParams>) => {
    onPatchVoice(patch);
  };

  const patchSlotAmount = (index: number, amount: number) => {
    const slots = voice.modSlots.map((s, j) => (j === index ? { ...s, amount } : { ...s }));
    patchAudible({ modSlots: slots });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', minHeight: 0 }}>
      <GenoBassEnvScreen
        label="MOD ENVELOPE"
        variant="mod"
        attack={voice.modAttackMs}
        decay={voice.modDecayMs}
        sustain={voice.modSustain}
        release={voice.modReleaseMs}
        height={52}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: 8,
          alignItems: 'stretch',
          borderTop: `1px solid ${GENO_BASS_THEME.border}`,
          paddingTop: 6,
        }}
      >
        {/* LFO 1 — left column */}
        <div style={{ flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column', paddingBottom: 10 }}>
          <div style={{ fontSize: 6.5, fontWeight: 800, color: GENO_BASS_THEME.sphinxHi, letterSpacing: '0.1em', marginBottom: 4 }}>
            LFO 1
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-end' }}>
            <GenoBassMoogKnob
              label="RATE"
              value={voice.lfo1RateHz}
              min={0.05}
              max={12}
              decimals={2}
              disabled={disabled}
              onChange={(v) => patchAudible({ lfo1RateHz: v })}
            />
            <GenoBassMoogKnob
              label="DEPTH"
              value={voice.lfo1Depth}
              min={0}
              max={1}
              decimals={2}
              disabled={disabled}
              onChange={(v) => patchAudible({ lfo1Depth: v })}
            />
            {voice.modSlots.slice(0, 2).map((slot, i) => (
              <GenoBassMoogKnob
                key={`s${i}`}
                label={`S${i + 1}`}
                value={slot.amount}
                min={-1}
                max={1}
                decimals={2}
                disabled={disabled}
                onChange={(v) => patchSlotAmount(i, v)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            {LFO_SHAPES.map((w) => (
              <GenoBassBtn
                key={`l1-${w}`}
                small
                active={voice.lfo1Shape === w}
                disabled={disabled}
                onClick={() => patchAudible({ lfo1Shape: w })}
              >
                {w.slice(0, 3).toUpperCase()}
              </GenoBassBtn>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 100, display: 'flex', marginTop: 10 }}>
            <ModLfoScreen
              which="l1"
              shape={voice.lfo1Shape}
              rateHz={voice.lfo1RateHz}
              depth={voice.lfo1Depth}
              modSlots={voice.modSlots.slice(0, 2)}
              slotOffset={0}
            />
          </div>
        </div>

        {/* LFO 2 — right column */}
        <div style={{ flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column', paddingBottom: 10 }}>
          <div style={{ fontSize: 6.5, fontWeight: 800, color: GENO_BASS_THEME.amberHi, letterSpacing: '0.1em', marginBottom: 4 }}>
            LFO 2
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-end' }}>
            <GenoBassMoogKnob
              label="RATE"
              value={voice.lfo2RateHz}
              min={0.05}
              max={12}
              decimals={2}
              disabled={disabled}
              onChange={(v) => patchAudible({ lfo2RateHz: v })}
            />
            <GenoBassMoogKnob
              label="DEPTH"
              value={voice.lfo2Depth}
              min={0}
              max={1}
              decimals={2}
              disabled={disabled}
              onChange={(v) => patchAudible({ lfo2Depth: v })}
            />
            {voice.modSlots.slice(2, 4).map((slot, i) => (
              <GenoBassMoogKnob
                key={`s${i + 2}`}
                label={`S${i + 3}`}
                value={slot.amount}
                min={-1}
                max={1}
                decimals={2}
                disabled={disabled}
                onChange={(v) => patchSlotAmount(i + 2, v)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            {LFO_SHAPES.map((w) => (
              <GenoBassBtn
                key={`l2-${w}`}
                small
                active={voice.lfo2Shape === w}
                disabled={disabled}
                onClick={() => patchAudible({ lfo2Shape: w })}
              >
                {w.slice(0, 3).toUpperCase()}
              </GenoBassBtn>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 100, display: 'flex', marginTop: 10 }}>
            <ModLfoScreen
              which="l2"
              shape={voice.lfo2Shape}
              rateHz={voice.lfo2RateHz}
              depth={voice.lfo2Depth}
              modSlots={voice.modSlots.slice(2, 4)}
              slotOffset={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
