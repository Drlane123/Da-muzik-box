import { useCallback, useEffect, useState } from 'react'
import {
  FolderOpen, Trash2, Clock, Music, Plus, Mic2, Piano,
  Cpu, Layers, Download, Settings, BookOpen, Zap, ChevronRight,
  Radio, Star, Headphones, Volume2, AlertCircle,
} from 'lucide-react'
import { saveService, type ProjectRow } from '@/app/lib/saveService'
import { SUPABASE_STUDIO_PROJECT_DATA_KEY } from '@/app/lib/studioProjectPersistence'

type Project = ProjectRow

type MyProjectsScreenProps = {
  onOpenStudioWithCloudProject?: (studioTimelineJson: string) => void
  onNavigate?: (screen: string) => void
}

/* ── Smart Templates ─────────────────────────────────────────────────────── */
const TEMPLATES = [
  {
    id: 'beat',
    label: 'Beat Session',
    desc: 'Drums, bass, and synths ready to go',
    icon: <Cpu size={20} />,
    color: '#7c3aed',
    glow: '#7c3aed33',
    screen: 'studio-editor-2',
    tag: 'Popular',
  },
  {
    id: 'vocal',
    label: 'Record Now',
    desc: 'AI vocal processing & capture',
    icon: <Mic2 size={20} />,
    color: '#e11d48',
    glow: '#e11d4833',
    screen: 'vocal-lab',
    tag: 'AI',
  },
  {
    id: 'midi',
    label: 'Studio Editor 2',
    desc: 'Full DAW with built-in piano roll & MIDI editing',
    icon: <Radio size={20} />,
    color: '#0ea5e9',
    glow: '#0ea5e933',
    screen: 'studio-editor-2',
    tag: 'β',
  },
  {
    id: 'ai',
    label: 'AI Songwriting',
    desc: 'Full song generation — rebuild coming soon',
    icon: <Zap size={20} />,
    color: '#f59e0b',
    glow: '#f59e0b33',
    screen: 'ai-song',
    tag: 'AI',
  },
  {
    id: 'arrange',
    label: 'Master Arrange',
    desc: 'Full arrangement & song structure',
    icon: <Layers size={20} />,
    color: '#10b981',
    glow: '#10b98133',
    screen: 'master-arranger',
    tag: null,
  },
  {
    id: 'mix',
    label: 'Mix & Export',
    desc: 'Final mixdown and export options',
    icon: <Download size={20} />,
    color: '#f97316',
    glow: '#f9731633',
    screen: 'export',
    tag: null,
  },
]

/* ── Tips / What's New ───────────────────────────────────────────────────── */
const TIPS = [
  {
    icon: <Zap size={14} />,
    title: 'Smooth Playhead',
    body: 'The Studio Editor 2 playhead now runs on the GPU compositor — zero stutter at any BPM.',
    color: '#7cf4c6',
  },
  {
    icon: <Piano size={14} />,
    title: 'Piano Roll Quantize',
    body: 'Notes snap to 1/4, 1/8, 1/16, 1/32, and 1/64 — select your snap in the toolbar.',
    color: '#60a5fa',
  },
  {
    icon: <Mic2 size={14} />,
    title: 'AI Vocal Lab',
    body: 'Neural Hum, RVC voice conversion, and enhancement suite — all in one panel.',
    color: '#f472b6',
  },
  {
    icon: <Radio size={14} />,
    title: 'Metronome Sync',
    body: 'Metronome uses lookahead scheduling — stays in sync even under heavy CPU load.',
    color: '#a78bfa',
  },
]

/* ── Setup Checklist ─────────────────────────────────────────────────────── */
const SETUP_ITEMS = [
  { icon: <Volume2 size={14} />, label: 'Audio Device', sub: 'Web Audio API — no drivers needed', done: true },
  { icon: <Headphones size={14} />, label: 'Low-Latency Mode', sub: 'AudioContext latencyHint: playback', done: true },
  { icon: <Settings size={14} />, label: 'MIDI Controller', sub: 'Plug in and use the piano roll keys', done: false },
  { icon: <Star size={14} />, label: 'Cloud Save', sub: 'Supabase project sync enabled', done: true },
]

/* ─────────────────────────────────────────────────────────────────────────── */

export default function MyProjectsScreen({ onOpenStudioWithCloudProject, onNavigate }: MyProjectsScreenProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [tipIdx, setTipIdx] = useState(0)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const data = await saveService.loadProjects()
      setProjects(data || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchProjects() }, [fetchProjects])

  useEffect(() => {
    window.addEventListener('projectsChanged', fetchProjects as EventListener)
    return () => window.removeEventListener('projectsChanged', fetchProjects as EventListener)
  }, [fetchProjects])

  /* Rotate tips every 6 s */
  useEffect(() => {
    const id = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 6000)
    return () => clearInterval(id)
  }, [])

  async function openStudioProject(p: Project) {
    let data = p.data as Record<string, unknown> | null | undefined
    if (!data?.[SUPABASE_STUDIO_PROJECT_DATA_KEY]) {
      try {
        const row = await saveService.loadProjectById(p.id)
        data = (row?.data as Record<string, unknown>) ?? undefined
      } catch { /* use list row */ }
    }
    const studio = data?.[SUPABASE_STUDIO_PROJECT_DATA_KEY]
    if (!studio || typeof studio !== 'object') {
      window.alert('No cloud Studio timeline found. Save again from Studio Editor after editing.')
      return
    }
    onOpenStudioWithCloudProject?.(JSON.stringify(studio))
  }

  async function deleteProject(id: string) {
    try {
      await saveService.deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (error) { console.error(error) }
  }

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const tip = TIPS[tipIdx]

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#16161c', color: '#ccc' }}>

      {/* ── Header / Hero ──────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, #0d0d14 0%, #0a0f1a 100%)', borderBottom: '1px solid #1a1a24' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
            style={{ background: 'linear-gradient(135deg, #7cf4c6, #00d4ff)', color: '#050a0c' }}
          >
            D
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight" style={{ color: '#fff' }}>DaMusicBox</h1>
            <p className="text-[11px]" style={{ color: '#4a5568' }}>Professional Music Production Suite</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded text-[10px] font-mono" style={{ background: '#0ff2', color: '#7cf4c6', border: '1px solid #7cf4c622' }}>
            v4.0 SOURCE
          </div>
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6 flex flex-col gap-8 max-w-[1400px] mx-auto w-full">

          {/* ── Smart Templates ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4a5568' }}>
                Start a New Session
              </h2>
              <span className="text-[10px]" style={{ color: '#2d3748' }}>Smart Templates</span>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => onNavigate?.(t.screen)}
                  className="group text-left rounded-xl p-4 flex flex-col gap-3 transition-all duration-150 relative overflow-hidden"
                  style={{
                    background: '#0d0d14',
                    border: `1px solid ${t.color}33`,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = t.glow; (e.currentTarget as HTMLButtonElement).style.borderColor = t.color + '88' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0d0d14'; (e.currentTarget as HTMLButtonElement).style.borderColor = t.color + '33' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.glow, color: t.color }}>
                      {t.icon}
                    </div>
                    {t.tag && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: t.glow, color: t.color }}>
                        {t.tag}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{t.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#4a5568' }}>{t.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium mt-auto" style={{ color: t.color }}>
                    Open <ChevronRight size={12} />
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── Two-column: Recent Projects + Sidebar ────────────────── */}
          <div className="flex gap-6 items-start">

            {/* Recent Projects (left, wider) */}
            <section className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4a5568' }}>
                  Recent Projects
                </h2>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="px-2.5 py-1 rounded text-[11px] outline-none"
                  style={{ background: '#242424', color: '#aaa', border: '1px solid #222', width: 140 }}
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7cf4c666', borderTopColor: 'transparent' }} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl py-12 text-center" style={{ background: '#0d0d14', border: '1px solid #1a1a24' }}>
                  <FolderOpen size={32} className="mx-auto mb-3" style={{ color: '#2d3748' }} />
                  <p className="text-sm" style={{ color: '#4a5568' }}>
                    {search ? 'No projects match your search.' : 'No projects yet — start a new session above.'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                  {filtered.map(p => (
                    <div
                      key={p.id}
                      className="rounded-xl p-4 flex flex-col gap-3"
                      style={{ background: '#0d0d14', border: '1px solid #1a1a24' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#7cf4c611', color: '#7cf4c6' }}>
                          <Music size={18} />
                        </div>
                        <button
                          onClick={() => void deleteProject(p.id)}
                          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                          style={{ color: '#2d3748' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2d3748' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{p.name}</p>
                        <p className="flex items-center gap-1 text-[10px] mt-1" style={{ color: '#2d3748' }}>
                          <Clock size={9} />
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                      {onOpenStudioWithCloudProject && (
                        <button
                          onClick={() => void openStudioProject(p)}
                          className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                          style={{ background: '#7cf4c611', color: '#7cf4c6', border: '1px solid #7cf4c622' }}
                        >
                          Open in Studio
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right Sidebar */}
            <div className="flex flex-col gap-4 shrink-0" style={{ width: 260 }}>

              {/* What's New / Tips */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a24', background: '#0d0d14' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a1a24' }}>
                  <BookOpen size={13} style={{ color: '#7cf4c6' }} />
                  <span className="text-[11px] font-bold" style={{ color: '#7cf4c6' }}>What's New</span>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5" style={{ background: tip.color + '22', color: tip.color }}>
                      {tip.icon}
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: '#e2e8f0' }}>{tip.title}</p>
                      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#4a5568' }}>{tip.body}</p>
                    </div>
                  </div>
                  {/* Dots */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {TIPS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setTipIdx(i)}
                        className="rounded-full transition-all"
                        style={{ width: i === tipIdx ? 14 : 6, height: 6, background: i === tipIdx ? '#7cf4c6' : '#1a1a24' }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Setup Checklist */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a24', background: '#0d0d14' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a1a24' }}>
                  <Settings size={13} style={{ color: '#f59e0b' }} />
                  <span className="text-[11px] font-bold" style={{ color: '#f59e0b' }}>Setup</span>
                </div>
                <div className="p-3 flex flex-col gap-1">
                  {SETUP_ITEMS.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-1 py-1.5 rounded" style={{ background: 'transparent' }}>
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: item.done ? '#10b98122' : '#ef444422', color: item.done ? '#10b981' : '#ef4444' }}>
                        {item.done ? item.icon : <AlertCircle size={11} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium truncate" style={{ color: item.done ? '#cbd5e0' : '#e2e8f0' }}>{item.label}</p>
                        <p className="text-[10px] truncate" style={{ color: '#2d3748' }}>{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a24', background: '#0d0d14' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a1a24' }}>
                  <Radio size={13} style={{ color: '#a78bfa' }} />
                  <span className="text-[11px] font-bold" style={{ color: '#a78bfa' }}>Quick Access</span>
                </div>
                <div className="p-2 flex flex-col gap-0.5">
                  {[
                    { label: 'Studio Editor 2', screen: 'studio-editor-2', icon: <Cpu size={12} />, color: '#7cf4c6' },
                    { label: 'AI Pattern Lab', screen: 'ai-pattern', icon: <Zap size={12} />, color: '#f59e0b' },
                    { label: 'Creation Station', screen: 'creation-station', icon: <Music size={12} />, color: '#60a5fa' },
                    { label: 'Melody Lab', screen: 'melody-transcription', icon: <Headphones size={12} />, color: '#f472b6' },
                  ].map(link => (
                    <button
                      key={link.screen}
                      onClick={() => onNavigate?.(link.screen)}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors w-full"
                      style={{ color: '#4a5568' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = link.color + '11'; el.style.color = link.color }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = 'transparent'; el.style.color = '#4a5568' }}
                    >
                      <span style={{ color: 'inherit' }}>{link.icon}</span>
                      <span className="text-[11px] font-medium">{link.label}</span>
                      <ChevronRight size={11} className="ml-auto" />
                    </button>
                  ))}
                </div>
              </div>

              {/* New Session Button */}
              <button
                onClick={() => onNavigate?.('studio-editor-2')}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #7cf4c6, #00d4ff)', color: '#050a0c' }}
              >
                <Plus size={16} />
                New Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
