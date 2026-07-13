/**
 * Prefetch lazy module chunks before the user clicks them.
 * First Modules click used to wait on a cold download/parse — felt like the screen “wouldn’t load”
 * until you left and came back (second visit hit the browser cache).
 */
import { loadCreationStationScreen } from '@/app/lib/boot/beatLabBootGate';
import type { ScreenId } from '@/app/lib/navigation/moduleNav';

const started = new Set<string>();

function once(key: string, run: () => Promise<unknown>): void {
  if (started.has(key)) return;
  started.add(key);
  void run().catch(() => {
    started.delete(key);
  });
}

export function prefetchModuleScreen(id: ScreenId | string): void {
  switch (id) {
    case 'vocal-lab':
      once('vocal-lab', () => import('@/app/screens/VocalLabScreen'));
      break;
    case 'melody-transcription':
      once('melody-transcription', () => import('@/app/screens/MelodyTranscriptionScreen'));
      break;
    case 'harmony-match':
      once('harmony-match', () => import('@/app/screens/HarmonyMatchScreen'));
      break;
    case 'creation-station':
    case 'beat-lab':
    case 'groove-lab':
    case 'chord-builder':
    case '808-lab':
    case 'drum-kit-generator':
    case 'chord-bass-sequencer':
    case 'more':
      once('creation-station', () => loadCreationStationScreen());
      break;
    case 'master-arranger':
      once('master-arranger', () => import('@/app/screens/MasterArrangerScreen'));
      break;
    case 'export':
      once('export', () => import('@/app/screens/ExportScreen'));
      break;
    case 'my-projects':
      once('my-projects', () => import('@/app/screens/MyProjectsScreen'));
      break;
    case 'ai-song':
      once('ai-song', () => import('@/app/screens/AiSongScreen'));
      break;
    case 'ai-music-match':
      once('ai-music-match', () => import('@/app/screens/AiMusicMatchScreen'));
      break;
    case 'ai-pattern':
      once('ai-pattern', () => import('@/app/screens/AiPatternScreen'));
      break;
    case 'studio-editor':
      once('studio-editor', () => import('@/app/screens/StudioEditorScreen'));
      break;
    case 'studio-editor-2':
      once('studio-editor-2', () => import('@/app/screens/StudioEditor2Screen'));
      break;
    default:
      break;
  }
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
