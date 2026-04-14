import React, { useEffect, useState } from 'react';

import { Download, Play, Pause, FileAudio, Music, Layers, MapPin } from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';

import { useSongArranger } from '@/app/context/SongArrangerContext';


const FORMATS = ['WAV','MP3','MIDI'];

const QUALITIES = ['320 kbps','256 kbps','192 kbps','FLAC (Lossless)'];

const SCOPES = [
  { id:'pattern',   label:'Current Pattern',  icon:<Layers size={14} />,   desc:'Export the active 4-bar pattern' },
  { id:'selection', label:'Export Selection', icon:<MapPin size={14} />,   desc:'Export highlighted bars only' },
  { id:'song',      label:'Full Song',         icon:<Music size={14} />,    desc:'Export the complete arrangement' },
  { id:'stems',     label:'Stems per Channel', icon:<FileAudio size={14} />, desc:'Separate file for each mixer channel' },
];


export default function ExportScreen() {
  const { bpm, transport, play, pause } = useMasterClock();
  const { sections, setSectionWavePreview } = useSongArranger();
  const [format, setFormat] = useState('WAV');
  const [quality, setQuality] = useState('320 kbps');
  const [scope, setScope] = useState('pattern');
  const [targetIsle, setTargetIsle] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewPositionSec, setPreviewPositionSec] = useState(0);

  const EXPORT_STAGES = ['Bouncing tracks…','Applying master effects…','Encoding audio…','Writing file…','Complete!'];
  const PREVIEW_DURATION_SEC = 3 * 60 + 24;

  function formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.max(0, totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  useEffect(() => {
    if (!previewing) return;
    const tick = window.setInterval(() => {
      setPreviewPositionSec((prev) => {
        const next = prev + 0.1;
        if (next >= PREVIEW_DURATION_SEC) {
          setPreviewing(false);
          return PREVIEW_DURATION_SEC;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(tick);
  }, [previewing]);

  useEffect(() => {
    // Keep preview panel state aligned with the real transport engine.
    if (transport === 'playing' || transport === 'recording') {
      setPreviewing(true);
      return;
    }
    setPreviewing(false);
  }, [transport]);

  function startExport() {
    setDone(false); setProgress(0); setExporting(true);
    let step = 0;
    const tick = setInterval(() => {
      step++;
      setProgress(Math.round((step / EXPORT_STAGES.length) * 100));
      if (step >= EXPORT_STAGES.length) {
        clearInterval(tick);
        setExporting(false);
        setDone(true);
        // Place on Isle: assign waveform preview to selected section
        if (targetIsle !== null) {
          setSectionWavePreview(targetIsle, targetIsle * 999 + Date.now() % 1000);
        }
      }
    }, 500);
  }

  const fileName = `DaMusicBox_${scope}_${bpm}bpm.${format.toLowerCase()}`;
  const previewProgress = Math.max(0, Math.min(100, (previewPositionSec / PREVIEW_DURATION_SEC) * 100));

  return (
    <div className="flex flex-col h-full" style={{ background: '#050505', color: '#ccc' }}>
      <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#00ff8822', color: '#00ff88' }}><Download size={16} /></div>
        <div>
          <h2 className="text-sm font-bold" style={{ color: '#fff' }}>Export & Playback</h2>
          <p className="text-xs" style={{ color: '#555' }}>Export WAV, MP3 or MIDI — pattern, full song, or stems</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 min-h-0 flex flex-col gap-5">
        {/* Waveform preview */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00ff88' }}>Preview</span>
          <div className="rounded-lg overflow-hidden flex items-center justify-center" style={{ height: 72, background: '#080808', border: '1px solid #111' }}>
            <div className="flex items-end gap-px w-full h-full px-4">
              {Array.from({ length: 120 }, (_, i) => (
                <div key={i} className="flex-1 rounded-full"
                  style={{ height: `${15 + Math.abs(Math.sin(i * 0.18) * 65 + Math.sin(i * 0.07) * 25)}%`, background: previewing ? '#00ff88' : '#1a1a1a', transition: 'background 0.3s', opacity: 0.7 + Math.sin(i * 0.3) * 0.3 }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!previewing && previewPositionSec >= PREVIEW_DURATION_SEC) {
                  setPreviewPositionSec(0);
                }
                if (previewing) {
                  pause();
                } else {
                  play();
                }
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#00ff88', color: '#000' }}>
              {previewing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
              <div className="h-full rounded-full" style={{ width: `${previewProgress}%`, background: '#00ff88', transition: 'width 0.1s linear' }} />
            </div>
            <span className="text-xs font-mono" style={{ color: '#555' }}>
              {formatTime(Math.floor(previewPositionSec))} / {formatTime(PREVIEW_DURATION_SEC)}
            </span>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {/* Format */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>Format</span>
            <div className="flex flex-col gap-1.5">
              {FORMATS.map(f => (
                <button key={f} onClick={() => setFormat(f)} className="py-2 rounded text-xs font-bold text-left px-3"
                  style={{ background: format === f ? '#00E5FF22' : '#111', color: format === f ? '#00E5FF' : '#555', border: `1px solid ${format === f ? '#00E5FF' : '#222'}` }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#D500F9' }}>Quality</span>
            <div className="flex flex-col gap-1.5">
              {QUALITIES.map(q => (
                <button key={q} onClick={() => setQuality(q)} className="py-2 rounded text-xs font-bold text-left px-3"
                  style={{ background: quality === q ? '#D500F922' : '#111', color: quality === q ? '#D500F9' : '#555', border: `1px solid ${quality === q ? '#D500F9' : '#222'}` }}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00ff88' }}>Scope</span>
            <div className="flex flex-col gap-1.5">
              {SCOPES.map(s => (
                <button key={s.id} onClick={() => setScope(s.id)} className="py-2 rounded text-xs font-bold text-left px-3 flex flex-col gap-0.5"
                  style={{ background: scope === s.id ? '#00ff8822' : '#111', color: scope === s.id ? '#00ff88' : '#555', border: `1px solid ${scope === s.id ? '#00ff88' : '#222'}` }}>
                  <span className="flex items-center gap-1">{s.icon} {s.label}</span>
                  <span className="text-xs font-normal" style={{ color: scope === s.id ? '#00ff8888' : '#333', fontSize: 9 }}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Place on Isle selector */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff6b35' }}>Place on Isle (optional)</span>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTargetIsle(null)}
              className="px-2 py-1 rounded text-xs font-bold"
              style={{ background: targetIsle === null ? '#1a1a1a' : '#111', color: targetIsle === null ? '#fff' : '#555', border: `1px solid ${targetIsle === null ? '#555' : '#222'}` }}>
              None (file only)
            </button>
            {sections.map(sec => (
              <button key={sec.id} onClick={() => setTargetIsle(sec.id)}
                className="px-2 py-1 rounded text-xs font-bold"
                style={{ background: targetIsle === sec.id ? `${sec.color}22` : '#111', color: targetIsle === sec.id ? sec.color : '#555', border: `1px solid ${targetIsle === sec.id ? sec.color : '#222'}` }}>
                {sec.name}
              </button>
            ))}
          </div>
          {targetIsle !== null && (
            <p className="text-xs" style={{ color: '#555' }}>
              ↳ Will overwrite content on <span style={{ color: sections.find(s=>s.id===targetIsle)?.color }}>
                {sections.find(s=>s.id===targetIsle)?.name}
              </span> · Non-destructive (replaces only this export)
            </p>
          )}
        </div>

        {/* Export summary + button */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
          <div className="flex items-center justify-between text-xs" style={{ color: '#555' }}>
            <span>Output: <span style={{ color: '#ccc' }}>{fileName}</span></span>
            <span>{bpm} BPM · 44.1 kHz · {format}</span>
          </div>

          <button onClick={startExport} disabled={exporting || done}
            className="py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all"
            style={{ background: done ? '#00ff8822' : exporting ? '#1a1a1a' : 'linear-gradient(135deg,#00ff88,#00E5FF)', color: done ? '#00ff88' : exporting ? '#444' : '#000', cursor: exporting || done ? 'not-allowed' : 'pointer', border: done ? '1px solid #00ff8844' : 'none' }}>
            {done ? '✓ Export Complete' : exporting ? 'Exporting…' : <><Download size={14} /> Export {SCOPES.find(s=>s.id===scope)?.label}</>}
          </button>

          {(exporting || done) && (
            <div>
              <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: '#111' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#00ff88,#00E5FF)', boxShadow: '0 0 8px #00ff88' }} />
              </div>
              {done && (
                <button className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                  style={{ background: '#00ff8818', color: '#00ff88', border: '1px solid #00ff8844' }}>
                  <Download size={12} /> Download {fileName}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
