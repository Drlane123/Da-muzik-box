import { supabase } from './supabaseClient'
import {
  STUDIO_PROJECT_STORAGE_KEY,
  SUPABASE_STUDIO_PROJECT_DATA_KEY,
  type StudioProjectFileV1,
} from './studioProjectPersistence'

export type ProjectRow = {
  id: string
  name: string
  created_at?: string
  data?: Record<string, unknown> | null
}

function buildProjectData(studioProjectJson?: string): Record<string, unknown> {
  if (studioProjectJson) {
    try {
      return {
        [SUPABASE_STUDIO_PROJECT_DATA_KEY]: JSON.parse(studioProjectJson) as StudioProjectFileV1,
      }
    } catch (e) {
      console.warn('saveService: invalid studio JSON, saving metadata only', e)
    }
  }
  /** Fallback when Studio isn’t mounted or JSON failed — same key as local autosave. */
  return { studioTimelineLocalStorageKey: STUDIO_PROJECT_STORAGE_KEY }
}

export const saveService = {
  /**
   * @param studioProjectJson — result of serializeStudioProject (full timeline + WAV base64 clips). If omitted, only metadata / localStorage pointer is stored.
   */
  async saveProject(
    name: string = 'Untitled Project',
    studioProjectJson?: string,
  ) {
    const payload = {
      name,
      data: buildProjectData(studioProjectJson),
    }

    console.log('Saving payload (studio blob size ~chars):', {
      name,
      studioChars: studioProjectJson?.length ?? 0,
    })

    const { data, error } = await supabase
      .from('projects')
      .insert([payload])
      .select()

    if (error) {
      console.error('Save error FULL:', error)
      throw error
    }

    return data
  },

  async loadProjectById(id: string): Promise<ProjectRow | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Load project by id:', error)
      throw error
    }

    return data as ProjectRow | null
  },

  async loadProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Load error:', error)
      throw error
    }

    return data || []
  },

  async deleteProject(id: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete error:', error)
      throw error
    }
  },
}