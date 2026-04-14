import { useState } from 'react';

import { Music, Play, Send, RefreshCw, Sparkles } from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';


const GENRES = ['Hip-Hop','R&B','Pop','Trap','Lo-Fi','Electronic','Jazz','Rock','Soul','Afrobeats'];

const MOODS = ['Chill','Hype','Dark','Romantic','Uplifting','Melancholic','Aggressive','Dreamy'];

const VOCAL_STYLES = ['Male Rap','Female Rap','Male Vocal','Female Vocal','Duet','Choir','Auto-Tune','Spoken Word'];

const GEN_STAGES = ['Analyzing prompt…','Composing structure…','Generating instruments…','Rendering audio…','Mastering…','Complete!'];


export default function AiSongScreen({ onExport }: { onExport: (dest: string) => void }) {
  const { bpm } = useMasterClock();
  const [mode, setMode] = useState<'instrumental'|'full'>('instrumental');
  const [genre, setGenre] = useState('Hip-Hop');
  const [mood, setMood] = useState('Chill');
  const [vocalStyle, setVocalStyle] = useState('Female Vocal');
  const [lyrics, setLyrics] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [done, setDone] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  function generate() {
    setDone(false); setProgress(0); setGenerating(true);
    let step = 0;
    const tick = setInterval(() => {
      step++;
      setStage(GEN_STAGES[Math.min(step - 1, GEN_STAGES.length - 1)]);
      setProgress(Math.round((step / GEN_STAGES.length) * 100));
      if (step >= GEN_STAGES.length) { clearInterval(tick); setGenerating(false); setDone(true); }
    }, 600);
  }

  function generateLyrics() {
    setLyrics(`[Verse 1]\nI feel the beat drop at ${bpm} BPM\n${mood} vibes, ${genre} flows from within\nEvery bar hits hard, every note is clean\nThis is Da Music Box, the ultimate machine\n\n[Chorus]\nLet it play, let it ride\nNeural beats amplified\n${genre} soul, ${mood} pride\nDa Music Box worldwide`);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#050505', color: '#ccc' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#D500F922', color: '#D500F9' }}><Music size={16} /></div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#fff' }}>AI Song Generator</h2>
            <p className="text-xs" style={{ color: '#555' }}>Generate full songs — instrumental or with AI vocals</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onExport('studio-editor')} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold" style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF55' }}><Send size={11} /> Studio Editor</button>
          <button onClick={() => onExport('master-arranger')} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold" style={{ background: '#1a1a1a', color: '#D500F9', border: '1px solid #D500F955' }}><Send size={11} /> Arranger</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 min-h-0">
        {/* Mode toggle */}
        <div className="flex gap-2">
          {(['instrumental','full'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
              style={{ background: mode === m ? '#D500F9' : '#111', color: mode === m ? '#000' : '#666', border: `1px solid ${mode === m ? '#D500F9' : '#222'}` }}>
              {m === 'instrumental' ? '🎵 AI Music (Instrumental)' : '🎤 Full Song (with Vocals)'}
            </button>
          ))}
        </div>

        {/* Note: app/globals.css is a limited Tailwind bundle — use gap-4 / inline gap so chip spacing actually applies */}
        <div
          className="grid w-full min-w-0"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {/* Genre */}
          <div className="rounded-xl p-4 flex flex-col gap-4 min-w-0" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <span className="text-xs font-bold uppercase tracking-widest shrink-0 block pb-0.5" style={{ color: '#D500F9' }}>Genre</span>
            <div className="flex flex-wrap content-start" style={{ gap: '0.65rem 0.85rem' }}>
              {GENRES.map(g => (
                <button key={g} type="button" onClick={() => setGenre(g)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap"
                  style={{ background: genre === g ? '#D500F922' : '#111', color: genre === g ? '#D500F9' : '#888', border: `1px solid ${genre === g ? '#D500F9' : '#333'}` }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div className="rounded-xl p-4 flex flex-col gap-4 min-w-0" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <span className="text-xs font-bold uppercase tracking-widest shrink-0 block pb-0.5" style={{ color: '#00E5FF' }}>Mood / Style</span>
            <div className="flex flex-wrap content-start" style={{ gap: '0.65rem 0.85rem' }}>
              {MOODS.map(m => (
                <button key={m} type="button" onClick={() => setMood(m)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap"
                  style={{ background: mood === m ? '#00E5FF22' : '#111', color: mood === m ? '#00E5FF' : '#888', border: `1px solid ${mood === m ? '#00E5FF' : '#333'}` }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vocal options (Full Song only) */}
        {mode === 'full' && (
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #D500F933' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#D500F9' }}>Vocal Style</span>
            <div className="flex flex-wrap content-start mb-2" style={{ gap: '0.65rem 0.85rem' }}>
              {VOCAL_STYLES.map(v => (
                <button key={v} type="button" onClick={() => setVocalStyle(v)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap"
                  style={{ background: vocalStyle === v ? '#D500F922' : '#111', color: vocalStyle === v ? '#D500F9' : '#888', border: `1px solid ${vocalStyle === v ? '#D500F9' : '#333'}` }}>
                  {v}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#888' }}>Lyrics (optional)</span>
                <button onClick={generateLyrics} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold" style={{ background: '#1a1a1a', color: '#D500F9', border: '1px solid #D500F944' }}>
                  <Sparkles size={10} /> Generate Lyrics
                </button>
              </div>
              <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder="Enter or generate lyrics…" rows={5}
                className="w-full rounded-lg p-3 text-xs resize-none outline-none font-mono"
                style={{ background: '#111', color: '#ccc', border: '1px solid #222' }} />
            </div>
          </div>
        )}

        {/* Generate button */}
        <button onClick={generate} disabled={generating}
          className="py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2"
          style={{ background: generating ? '#1a1a1a' : 'linear-gradient(135deg,#D500F9,#00E5FF)', color: generating ? '#444' : '#000', cursor: generating ? 'not-allowed' : 'pointer' }}>
          {generating ? <><RefreshCw size={14} className="animate-spin" /> Generating…</> : <><Sparkles size={14} /> Generate {mode === 'full' ? 'Full Song' : 'Instrumental'}</>}
        </button>

        {/* Progress */}
        {(generating || done) && (
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <div className="flex justify-between text-xs" style={{ color: '#555' }}>
              <span>{stage}</span>
              <span style={{ color: '#D500F9' }}>{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#D500F9,#00E5FF)', boxShadow: '0 0 10px #D500F9' }} />
            </div>

            {done && (
              <div className="rounded-lg p-4 flex items-center gap-4 mt-1" style={{ background: '#111', border: '1px solid #D500F944' }}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#D500F922', color: '#D500F9' }}>
                  <Music size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-snug break-words" style={{ color: '#fff' }}>{mood} · {genre} · {mode === 'full' ? 'Song' : 'Instrumental'}</p>
                  <p className="text-xs" style={{ color: '#555' }}>{bpm} BPM · 4/4 · Generated {new Date().toLocaleTimeString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setPreviewPlaying(p => !p)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#D500F9', color: '#000' }}>
                    {previewPlaying ? '⏸' : <Play size={14} />}
                  </button>
                  <button onClick={() => onExport('studio-editor')} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF55' }}>→ Studio</button>
                  <button onClick={() => onExport('master-arranger')} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: '#1a1a1a', color: '#D500F9', border: '1px solid #D500F955' }}>→ Arrange</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
