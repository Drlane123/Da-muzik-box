import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Trash2, Clock, Music } from 'lucide-react'
import { saveService, type ProjectRow } from '@/app/lib/saveService'
import { SUPABASE_STUDIO_PROJECT_DATA_KEY } from '@/app/lib/studioProjectPersistence'

type Project = ProjectRow

type MyProjectsScreenProps = {
  /** Pass full Studio timeline JSON (serializeStudioProject output as string). */
  onOpenStudioWithCloudProject?: (studioTimelineJson: string) => void
}

export default function MyProjectsScreen({ onOpenStudioWithCloudProject }: MyProjectsScreenProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    function onProjectsChanged() {
      void fetchProjects()
    }
    window.addEventListener('projectsChanged', onProjectsChanged)
    return () => window.removeEventListener('projectsChanged', onProjectsChanged)
  }, [fetchProjects])

  async function openStudioProject(p: Project) {
    let data = p.data as Record<string, unknown> | null | undefined
    if (!data?.[SUPABASE_STUDIO_PROJECT_DATA_KEY]) {
      try {
        const row = await saveService.loadProjectById(p.id)
        data = (row?.data as Record<string, unknown>) ?? undefined
      } catch {
        /* use list row only */
      }
    }
    const studio = data?.[SUPABASE_STUDIO_PROJECT_DATA_KEY]
    if (!studio || typeof studio !== 'object') {
      window.alert(
        'No cloud Studio timeline on this project. Save again from Studio (SAVE) after editing so tracks and audio are stored in Supabase.',
      )
      return
    }
    onOpenStudioWithCloudProject?.(JSON.stringify(studio))
  }

  async function deleteProject(id: string) {
    try {
      await saveService.deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (error) {
      console.error(error)
    }
  }

  const filtered = projects.filter(
    p => p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full" style={{ background: '#050505', color: '#ccc' }}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ffcc0022', color: '#ffcc00' }}>
            <FolderOpen size={16} />
          </div>
          <h2 className="text-sm font-bold" style={{ color: '#fff' }}>My Projects</h2>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="px-3 py-1.5 rounded text-xs outline-none"
          style={{ background: '#111', color: '#ccc', border: '1px solid #222', width: 180 }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-5 min-h-0">
        {loading ? (
          <p className="text-sm text-center py-8" style={{ color: '#555' }}>Loading projects...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#333' }}>No projects found.</p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{ background: '#0a0a0a', border: '1px solid #333' }}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#00E5FF22', color: '#00E5FF' }}>
                    <Music size={18} />
                  </div>

                  <button
                    onClick={() => deleteProject(p.id)}
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ color: '#555' }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                <div>
                  <p className="text-sm font-bold" style={{ color: '#fff' }}>{p.name}</p>
                </div>

                {onOpenStudioWithCloudProject && (
                  <button
                    type="button"
                    onClick={() => void openStudioProject(p)}
                    className="w-full py-2 rounded-lg text-xs font-bold"
                    style={{ background: '#00ff8822', color: '#00ff88', border: '1px solid #00ff8844' }}
                  >
                    Open in Studio
                  </button>
                )}

                <div className="flex items-center justify-between text-xs" style={{ color: '#444' }}>
                  <span className="flex items-center gap-1">
                    <Clock size={9} />
                    {p.created_at ? new Date(p.created_at).toLocaleString() : 'Unknown'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}