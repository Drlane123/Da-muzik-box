import { useState, useRef } from 'react';

import { Volume2, Plus, Send, X } from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';

import { useTrackAllocation } from '@/app/context/TrackAllocationContext';

import ProMeter from '@/app/components/ProMeter';


const DRUM_PAD_NAMES = ['Kick','Snare','Clap','Hi-Hat','Open HH','Tom Hi','Tom Lo','Rim','Perc 1','Perc 2','Crash','Ride','Shaker','Cowbell','Snap','SUB BASS','Sub Bass'];

const DRUM_PAD_COLORS = ['#D500F9','#00E5FF','#ff6b35','#00ff88','#ffcc00','#a78bfa','#f472b6','#60a5fa','#D500F9','#00E5FF','#ff6b35','#00ff88','#ffcc00','#a78bfa','#f472b6','#60a5fa','#D500F9'];

const DRUM_CHANNELS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];

const EFFECTS = ['Reverb','Delay','Distortion','Filter','Compressor','EQ','Chorus','Phaser'];


interface FxParam { label: string; value: number; }

interface Effect { type: string; enabled: boolean; params: FxParam[]; }


export default function MixerScreen({ onExport }: { onExport: (dest: string) => void }) {
  const { channelLevels, channelVolumes, setChannelVolume, triggerChannel } = useMasterClock();
  const { getAllAllocations, getTrackOwner } = useTrackAllocation();
  const [selected, setSelected] = useState<number>(0);
  const [addEffectOpen, setAddEffectOpen] = useState(false);
  const [drumEffects, setDrumEffects] = useState<Record<number, Effect[]>>(
    Object.fromEntries(DRUM_CHANNELS.map(ch => [ch, []]))
  );
  const [drumPans, setDrumPans] = useState<Record<number, number>>(
    Object.fromEntries(DRUM_CHANNELS.map(ch => [ch, 0]))
  );

  function getVolume(chId: number) { return channelVolumes[chId] ?? 80; }
  function getRmsLevel(chId: number) {
    const raw = channelLevels[chId] ?? 0;
    return Math.min(1, raw * (getVolume(chId) / 100));
  }
  function getPeakLevel(chId: number) {
    return Math.min(1, getRmsLevel(chId) * 1.25);
  }

  function setVolume(chId: number, v: number) { setChannelVolume(chId, v); }
  function setPan(chId: number, v: number) { setDrumPans(prev => ({ ...prev, [chId]: v })); }
  
  function addEffectToDrum(chId: number, type: string) {
    setDrumEffects(prev => ({
      ...prev,
      [chId]: [...(prev[chId] || []), { type, enabled: true, params: [{ label: 'Mix', value: 50 }, { label: 'Amount', value: 40 }, { label: 'Time', value: 30 }] }]
    }));
    setAddEffectOpen(false);
  }
  
  function removeEffectFromDrum(chId: number, ei: number) {
    setDrumEffects(prev => ({
      ...prev,
      [chId]: (prev[chId] || []).filter((_, i) => i !== ei)
    }));
  }
  
  function toggleEffectOnDrum(chId: number, ei: number) {
    setDrumEffects(prev => ({
      ...prev,
      [chId]: (prev[chId] || []).map((e, i) => i === ei ? { ...e, enabled: !e.enabled } : e)
    }));
  }
  
  function setDrumEffectParam(chId: number, ei: number, pi: number, v: number) {
    setDrumEffects(prev => ({
      ...prev,
      [chId]: (prev[chId] || []).map((e, i) => i !== ei ? e : { ...e, params: e.params.map((p, j) => j !== pi ? p : { ...p, value: v }) })
    }));
  }

  const selCh = DRUM_CHANNELS[selected];
  const selChEffects = drumEffects[selCh] || [];

  return (
    <div className="flex flex-col h-full" style={{ background: '#2a2a2a', color: '#ccc' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2 shrink-0" style={{ borderBottom: '1px solid #2c2c2c', background: '#2c2c2c' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#D500F922', color: '#D500F9' }}><Volume2 size={16} /></div>
          <h2 className="text-sm font-bold" style={{ color: '#fff' }}>Drum Mixer & Effects</h2>
          <span className="text-xs" style={{ color: '#333' }}>Dedicated drum pad control + per-pad effects</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onExport('creation-station')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#D500F918', color: '#D500F9', border: '1px solid #D500F944' }}><Send size={10} /> Creation</button>
          <button onClick={() => onExport('studio-editor')} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF44' }}><Send size={10} /> Studio</button>
        </div>
      </div>

      {/* Track Allocation Status */}
      <div style={{ borderBottom: '1px solid #2c2c2c', background: '#2c2c2c', padding: '8px 12px' }}>
        <div className="text-xs font-bold mb-2" style={{ color: '#888' }}>TRACK ALLOCATION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px' }}>
          {Object.entries(getAllAllocations()).map(([moduleId, tracks]) => 
            tracks.length > 0 && (
              <div key={moduleId} style={{ fontSize: '11px', padding: '4px 6px', borderRadius: '4px', background: '#1c1c1c', border: '1px solid #2c2c2c' }}>
                <div style={{ color: '#00E5FF', fontWeight: 'bold', marginBottom: '2px' }}>{moduleId}</div>
                <div style={{ color: '#666' }}>{tracks.join(', ')}</div>
              </div>
            )
          )}
          {Object.entries(getAllAllocations()).every(([_, tracks]) => tracks.length === 0) && (
            <div style={{ fontSize: '11px', color: '#666', padding: '4px 6px' }}>No modules have allocated tracks yet</div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Drum pad list */}
        <div className="shrink-0" style={{ width: 140, background: '#2c2c2c', borderRight: '1px solid #2c2c2c', display: 'flex', flexDirection: 'column' }}>
          <div className="text-xs text-center py-1 font-bold" style={{ borderBottom: '1px solid #2c2c2c', color: '#444', background: '#2a2a2a' }}>PADS</div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', padding: '4px' }}>
            {DRUM_PAD_NAMES.map((name, i) => {
              const chId = DRUM_CHANNELS[i];
              const isSelected = selected === i;
              return (
                <button key={chId} onClick={() => setSelected(i)}
                  className="rounded text-xs font-bold py-1 px-1 text-center"
                  style={{ background: isSelected ? DRUM_PAD_COLORS[i] : '#1c1c1c', color: isSelected ? '#000' : DRUM_PAD_COLORS[i], border: `1px solid ${DRUM_PAD_COLORS[i]}${isSelected ? '' : '44'}`, cursor: 'pointer' }}>
                  <div style={{ fontSize: '9px', lineHeight: '1.2' }}>{name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drum pad editor */}
        <div className="flex-1 overflow-y-auto" style={{ background: '#1c1c1c' }}>
          <div className="px-4 py-3 border-b" style={{ borderBottomColor: '#2c2c2c' }}>
            <div className="text-sm font-bold" style={{ color: DRUM_PAD_COLORS[selected] }}>{DRUM_PAD_NAMES[selected]}</div>
            <div className="text-xs" style={{ color: '#888' }}>Channel {selCh}</div>
          </div>

          {/* Volume */}
          <div className="px-4 py-3 border-b" style={{ borderBottomColor: '#2c2c2c' }}>
            <div className="text-xs font-bold mb-3">VOLUME: {getVolume(selCh)}</div>
            <input type="range" min={0} max={100} value={getVolume(selCh)} onChange={e => setVolume(selCh, Number(e.target.value))}
              className="w-full" style={{ accentColor: DRUM_PAD_COLORS[selected] }} />
            <div className="mt-2 flex gap-2">
              <ProMeter level={getRmsLevel(selCh)} peakLevel={getPeakLevel(selCh)} />
            </div>
          </div>

          {/* Pan */}
          <div className="px-4 py-3 border-b" style={{ borderBottomColor: '#2c2c2c' }}>
            <div className="text-xs font-bold mb-3">PAN: {drumPans[selCh] > 0 ? '+' : ''}{drumPans[selCh]}</div>
            <input type="range" min={-100} max={100} value={drumPans[selCh]} onChange={e => setPan(selCh, Number(e.target.value))}
              className="w-full" style={{ accentColor: DRUM_PAD_COLORS[selected] }} />
          </div>

          {/* Trigger button */}
          <div className="px-4 py-3 border-b" style={{ borderBottomColor: '#2c2c2c' }}>
            <button onClick={() => triggerChannel(selCh, 100)}
              className="w-full px-4 py-2 rounded font-bold text-sm"
              style={{ background: DRUM_PAD_COLORS[selected], color: '#000', cursor: 'pointer', boxShadow: '0 0 16px ' + DRUM_PAD_COLORS[selected] + '66' }}>
              ▶ TRIGGER {DRUM_PAD_NAMES[selected].toUpperCase()}
            </button>
          </div>

          {/* Effects */}
          <div className="px-4 py-3" style={{ borderBottomColor: '#2c2c2c' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold">PAD EFFECTS</span>
              <button onClick={() => setAddEffectOpen(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
                style={{ color: DRUM_PAD_COLORS[selected], background: '#1a1a2a', border: `1px solid ${DRUM_PAD_COLORS[selected]}66` }}>
                <Plus size={10} /> Add
              </button>
            </div>

            {addEffectOpen && (
              <div className="mb-3 p-2 rounded" style={{ background: '#1a1a2a', border: `1px solid ${DRUM_PAD_COLORS[selected]}` }}>
                {EFFECTS.map(e => (
                  <button key={e} onClick={() => addEffectToDrum(selCh, e)} className="w-full text-left text-xs px-1.5 py-1 rounded mb-1"
                    style={{ color: DRUM_PAD_COLORS[selected], background: '#222222', border: `1px solid ${DRUM_PAD_COLORS[selected]}44`, cursor: 'pointer' }}>
                    {e}
                  </button>
                ))}
              </div>
            )}

            {selChEffects.length === 0 && (
              <div className="text-center py-4" style={{ color: '#333' }}>
                <p className="text-xs">No effects. Click "Add" to insert.</p>
              </div>
            )}

            <div className="space-y-2">
              {selChEffects.map((fx, fi) => (
                <div key={fi} className="text-xs p-2 rounded" style={{ background: fx.enabled ? '#1a1a2a' : '#222222', borderLeft: `2px solid ${fx.enabled ? DRUM_PAD_COLORS[selected] : '#333'}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">{fx.type}</span>
                    <button onClick={() => removeEffectFromDrum(selCh, fi)} className="text-xs" style={{ color: '#666' }}><X size={12} /></button>
                  </div>
                  <button onClick={() => toggleEffectOnDrum(selCh, fi)} className="text-xs w-full px-1 py-0.5 rounded mb-1"
                    style={{ background: fx.enabled ? DRUM_PAD_COLORS[selected] + '33' : '#242424', color: fx.enabled ? DRUM_PAD_COLORS[selected] : '#666', border: `1px solid ${fx.enabled ? DRUM_PAD_COLORS[selected] : '#333'}` }}>
                    {fx.enabled ? '✓ ON' : '○ OFF'}
                  </button>
                  {fx.params.map((p, pi) => (
                    <div key={pi} className="mt-1">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span style={{ color: '#888' }}>{p.label}</span>
                        <span style={{ color: '#666' }}>{p.value}</span>
                      </div>
                      <input type="range" min={0} max={100} value={p.value} onChange={e => setDrumEffectParam(selCh, fi, pi, Number(e.target.value))}
                        className="w-full" style={{ accentColor: DRUM_PAD_COLORS[selected] }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
