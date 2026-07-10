/** Top-level module routes — shared by Modules menu and legacy nav helpers. */

export type ScreenId =
  | 'vocal-lab'
  | 'ai-song'
  | 'ai-music-match'
  | 'ai-pattern'
  | 'melody-transcription'
  | 'harmony-match'
  | 'creation-station'
  | 'studio-editor'
  | 'studio-editor-2'
  | 'my-projects'
  | 'master-arranger'
  | 'export';

export interface NavItem {
  id: ScreenId;
  label: string;
  badge?: string;
  groupId?: string;
}

const NAV_ITEM_ORDER_VERSION = 4;
const NAV_ITEM_ORDER_VERSION_KEY = 'navItemOrderVersion';

/** Modules menu — top-to-bottom order (Studio One–style workflow). */
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'studio-editor-2', label: 'Studio Editor 2', badge: 'β' },
  { id: 'master-arranger', label: 'Mastering Bay' },
  { id: 'creation-station', label: 'Creation Station' },
  { id: 'ai-music-match', label: 'AI Music Match', badge: 'NEW' },
  { id: 'vocal-lab', label: 'AI Vocal Lab', badge: 'NEW' },
  { id: 'my-projects', label: 'My Projects' },
  { id: 'export', label: 'Export / Playback' },
  { id: 'ai-song', label: 'AI Song Generator' },
];

export function loadNavItemsFromStorage(): NavItem[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(NAV_ITEM_ORDER_VERSION_KEY, String(NAV_ITEM_ORDER_VERSION));
      localStorage.setItem('navItemOrder', JSON.stringify(DEFAULT_NAV_ITEMS.map((i) => i.id)));
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_NAV_ITEMS;
}
