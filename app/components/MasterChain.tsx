/**
 * MasterChain — Professional Mastering Signal Chain
 * Signal flow: Gain → Clean EQ → Glue Compressor → Saturator → Stereo Imager → Limiter → Meters
 * Glue Compressor: 30ms attack / 130ms release (matches 115 BPM)
 * All stages have bypass toggles and parameter controls
 */
import { useState } from 'react';

import { useMasterClock } from '@/app/context/MasterClockContext';

import ProMeter from './ProMeter';

import Goniometer from './Goniometer';


interface StageParam { label: string; value: number; min: number; max: number; unit?: string; }

interface Stage { id: string; label: string; color: string; enabled: boolean; params: StageParam[]; }


const INITIAL_STAGES: Stage[] = [
  {
    id: 'gain', label: 'Gain Staging', color: '#00E5FF', enabled: true,
    params: [
      { label: 'Input Gain', value: 0, min: -24, max: 24, unit: 'dB' },
      { label: 'Output Gain', value: -6, min: -24, max: 0, unit: 'dB' },
    ],
  },
  {
    id: 'eq', label: 'Clean EQ', color: '#00ff88', enabled: true,
    params: [
      { label: 'Low Boost', value: 3, min: -12, max: 12, unit: 'dB' },
      { label: '4kHz Sizzle', value: 2, min: -12, max: 12, unit: 'dB' },
      { label: '10kHz Air', value: 3, min: -12, max: 12, unit: 'dB' },
      { label: 'HP Filter', value: 30, min: 20, max: 200, unit: 'Hz' },
    ],
  },
  {
    id: 'comp', label: 'Glue Compressor', color: '#D500F9', enabled: true,
    params: [
      { label: 'Threshold', value: -12, min: -40, max: 0, unit: 'dB' },
      { label: 'Ratio', value: 4, min: 1, max: 10, unit: ':1' },
      { label: 'Attack', value: 30, min: 1, max: 300, unit: 'ms' },
      { label: 'Release', value: 130, min: 10, max: 1000, unit: 'ms' },
      { label: 'Makeup', value: 3, min: 0, max: 12, unit: 'dB' },
    ],
  },
  {
    id: 'sat', label: 'Tonal Saturator', color: '#ffcc00', enabled: true,
    params: [
      { label: 'Drive', value: 20, min: 0, max: 100 },
      { label: 'Warmth', value: 35, min: 0, max: 100 },
      { label: 'Mix', value: 40, min: 0, max: 100 },
    ],
  },
  {
    id: 'stereo', label: 'Stereo Imager', color: '#a78bfa', enabled: true,
    params: [
      { label: 'Width', value: 120, min: 0, max: 200, unit: '%' },
      { label: 'Mid Gain', value: 0, min: -6, max: 6, unit: 'dB' },
      { label: 'Side Gain', value: 1, min: -6, max: 6, unit: 'dB' },
    ],
  },
  {
    id: 'limiter', label: 'True Peak Limiter', color: '#ff6b35', enabled: true,
    params: [
      { label: 'Ceiling', value: -1, min: -6, max: 0, unit: 'dBTP' },
      { label: 'Release', value: 80, min: 10, max: 500, unit: 'ms' },
      { label: 'ISP Det.', value: 1, min: 0, max: 1, unit: '' },
    ],
  },
];


export default function MasterChain({ masterLevel }: { masterLevel: number }) {
  const { transport, bpm } = useMasterClock();
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleStage(id: string) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }
  function setParam(stageId: string, pi: number, v: number) {
    setStages(prev => prev.map(s => s.id !== stageId ? s : {
      ...s, params: s.params.map((p, i) => i !== pi ? p : { ...p, value: v }),
    }));
  }
  function toggleCollapse(id: string) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Compute simulated post-chain level (limiter ceiling)
  const limiterCeiling = stages.find(s => s.id === 'limiter')?.params[0].value ?? -1;
  const chainedLevel = Math.min(masterLevel, Math.pow(10, limiterCeiling / 20));
  // RMS body is 12dB below peak (typical music)
  const rmsLevel = chainedLevel * 0.25;

  // LUFS estimate (-14 LUFS reference)
  const lufs = masterLevel > 0 ? Math.max(-60, 20 * Math.log10(masterLevel) - 14) : -60;
  const rmsDba = masterLevel > 0 ? Math.max(-60, 20 * Math.log10(rmsLevel)) : -60;
  const truePeak = masterLevel > 0 ? Math.max(-60, 20 * Math.log10(chainedLevel)) : -60;

  const isActive = transport === 'playing' || transport === 'recording';

  return (
    <div className="flex flex-col gap-2" style={{ background: '#2a2a2a' }}>
      {/* Signal flow header */}
      <div className="flex items-center gap-1 px-3 py-2 flex-wrap" style={{ background: '#2c2c2c', borderBottom: '1px solid #2c2c2c' }}>
        <span className="text-xs font-bold tracking-widest" style={{ color: '#555' }}>MASTER CHAIN</span>
        <span className="text-xs mx-1" style={{ color: '#333' }}>·</span>
        {stages.map((s, si) => (
          <span key={s.id} className="flex items-center gap-1">
            <span className="text-xs font-medium" style={{ color: s.enabled ? s.color : '#333', fontSize: 9 }}>{s.label}</span>
            {si < stages.length - 1 && <span style={{ color: '#333', fontSize: 10 }}>→</span>}
          </span>
        ))}
        <span className="text-xs mx-1" style={{ color: '#333' }}>→</span>
        <span className="text-xs font-bold" style={{ color: '#00E5FF', fontSize: 9 }}>METERS</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: '#444', fontSize: 9 }}>24-bit / 44.1 kHz</span>
        </div>
      </div>

      <div className="flex gap-3 px-3 pb-3 overflow-x-auto">
        {/* Stage controls */}
        <div className="flex flex-col gap-2 flex-1" style={{ minWidth: 0 }}>
          {stages.map((stage) => (
            <div key={stage.id} className="rounded-lg overflow-hidden" style={{ background: '#1c1c1c', border: `1px solid ${stage.enabled ? stage.color + '44' : '#2c2c2c'}` }}>
              <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                style={{ background: '#0d0d0d', borderBottom: collapsed[stage.id] ? 'none' : `1px solid ${stage.color}22` }}
                onClick={() => toggleCollapse(stage.id)}>
                <button
                  onClick={e => { e.stopPropagation(); toggleStage(stage.id); }}
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: stage.enabled ? stage.color : '#222', color: stage.enabled ? '#000' : '#555', fontSize: 8 }}>●</button>
                <span className="text-xs font-bold" style={{ color: stage.enabled ? stage.color : '#444' }}>{stage.label}</span>
                {stage.id === 'comp' && (
                  <span className="text-xs ml-1" style={{ color: '#555', fontSize: 9 }}>
                    {stage.params[2].value}ms A / {stage.params[3].value}ms R
                  </span>
                )}
                <span className="ml-auto text-xs" style={{ color: '#333' }}>{collapsed[stage.id] ? '▶' : '▼'}</span>
              </div>
              {!collapsed[stage.id] && (
                <div className="px-3 py-2 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', opacity: stage.enabled ? 1 : 0.3 }}>
                  {stage.params.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-2">
                      <span className="text-xs shrink-0" style={{ color: '#666', width: 72, fontSize: 9 }}>{p.label}</span>
                      <input type="range" min={p.min} max={p.max} value={p.value} step={p.unit === 'dB' || p.unit === 'dBTP' ? 0.5 : 1}
                        onChange={e => setParam(stage.id, pi, Number(e.target.value))}
                        className="flex-1 h-0.5" style={{ accentColor: stage.color }} />
                      <span className="text-xs font-mono shrink-0" style={{ color: stage.color, width: 36, textAlign: 'right', fontSize: 9 }}>
                        {p.value}{p.unit ?? ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Master Meters panel */}
        <div className="flex flex-col gap-3 shrink-0" style={{ width: 160 }}>
          {/* LUFS / RMS / TP readouts */}
          <div className="rounded-lg p-2 flex flex-col gap-1" style={{ background: '#1c1c1c', border: '1px solid #2c2c2c' }}>
            <span className="text-xs font-bold" style={{ color: '#555', fontSize: 9 }}>MASTER READOUTS</span>
            {[
              { label: 'LUFS',       value: lufs.toFixed(1),     color: lufs > -9 ? '#ff2222' : lufs > -14 ? '#ffcc00' : '#00e676' },
              { label: 'RMS',        value: rmsDba.toFixed(1) + 'dB', color: '#00E5FF' },
              { label: 'TRUE PEAK',  value: truePeak.toFixed(1) + 'dB', color: truePeak > -1 ? '#ff2222' : '#00e676' },
              { label: 'BIT DEPTH',  value: '24-bit',            color: '#555' },
              { label: 'SAMPLE RATE',value: '44.1 kHz',          color: '#555' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span style={{ color: '#444', fontSize: 9, fontFamily: 'monospace' }}>{label}</span>
                <span className="font-bold font-mono" style={{ color, fontSize: 10 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Goniometer */}
          <div className="flex justify-center">
            <Goniometer size={90} masterLevel={chainedLevel} />
          </div>

          {/* Stereo meter pair L+R */}
          <div className="flex justify-center gap-1">
            <ProMeter level={chainedLevel * (0.8 + Math.sin(Date.now() * 0.001) * 0.2)} peakLevel={chainedLevel} width={18} height={100} label="L" showDb />
            <ProMeter level={chainedLevel * (0.8 + Math.cos(Date.now() * 0.001) * 0.2)} peakLevel={chainedLevel} width={18} height={100} label="R" showDb />
          </div>

          {/* Compressor GR meter */}
          <div className="rounded p-2 flex flex-col gap-1" style={{ background: '#1c1c1c', border: `1px solid ${stages.find(s=>s.id==='comp')?.color}33` }}>
            <span style={{ color: '#555', fontSize: 8, fontFamily: 'monospace' }}>GAIN REDUCTION</span>
            <div className="h-2 rounded overflow-hidden" style={{ background: '#242424' }}>
              <div className="h-full rounded" style={{
                width: isActive ? `${Math.min(100, masterLevel * 35)}%` : '0%',
                background: '#D500F9',
                transition: 'width 0.04s',
                boxShadow: '0 0 4px #D500F9',
              }} />
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#333', fontSize: 7 }}>0dB</span>
              <span style={{ color: '#D500F9', fontSize: 7 }}>
                -{(masterLevel * 6).toFixed(1)}dB
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
