/**
 * Prefetch module chunks before the user clicks them.
 * Shares the same cache as {@link loadScreenModule} so the first open paints immediately.
 */
import { loadCreationStationScreen } from '@/app/lib/boot/beatLabBootGate';
import type { ScreenId } from '@/app/lib/navigation/moduleNav';
import { loadScreenModule } from '@/app/lib/navigation/useScreenModule';
import type { ScreenComponent } from '@/app/lib/navigation/useScreenModule';

type Loader = () => Promise<{ default: ScreenComponent }>;

export const SCREEN_MODULE_LOADERS: Record<ScreenId, Loader> = {
  'vocal-lab': () => import('@/app/screens/VocalLabScreen'),
  'ai-song': () => import('@/app/screens/AiSongScreen'),
  'ai-music-match': () => import('@/app/screens/AiMusicMatchScreen'),
  'ai-pattern': () => import('@/app/screens/AiPatternScreen'),
  'melody-transcription': () => import('@/app/screens/MelodyTranscriptionScreen'),
  'harmony-match': () => import('@/app/screens/HarmonyMatchScreen'),
  'creation-station': () => loadCreationStationScreen(),
  'studio-editor': () => import('@/app/screens/StudioEditorScreen'),
  'studio-editor-2': () => import('@/app/screens/StudioEditor2Screen'),
  'my-projects': () => import('@/app/screens/MyProjectsScreen'),
  'master-arranger': () => import('@/app/screens/MasterArrangerScreen'),
  export: () => import('@/app/screens/ExportScreen'),
};

export function prefetchModuleScreen(id: ScreenId | string): void {
  const key = id === 'beat-lab' ||
    id === 'groove-lab' ||
    id === 'chord-builder' ||
    id === '808-lab' ||
    id === 'drum-kit-generator' ||
    id === 'chord-bass-sequencer' ||
    id === 'more'
    ? 'creation-station'
    : id;
  const loader = SCREEN_MODULE_LOADERS[key as ScreenId];
  if (!loader) return;
  void loadScreenModule(key, loader);
}

/** Warm the modules people open from the Modules menu most often. */
export function prefetchCommonModuleScreens(): void {
  prefetchModuleScreen('vocal-lab');
  prefetchModuleScreen('creation-station');
  prefetchModuleScreen('master-arranger');
  prefetchModuleScreen('export');
  prefetchModuleScreen('my-projects');
  prefetchModuleScreen('ai-music-match');
  prefetchModuleScreen('ai-song');
}
