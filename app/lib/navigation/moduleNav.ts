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

const NAV_ITEM_ORDER_VERSION = 3;
const NAV_ITEM_ORDER_VERSION_KEY = 'navItemOrderVersion';

const VOCAL_LAB_NESTED_SCREEN_IDS = new Set<ScreenId>(['melody-transcription', 'harmony-match']);
const RETIRED_MODULE_SCREEN_IDS = new Set<string>(['piano-roll']);

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'vocal-lab', label: 'AI Vocal Lab', badge: 'NEW' },
  { id: 'ai-song', label: 'AI Song Generator' },
  { id: 'ai-music-match', label: 'AI Music Match', badge: 'NEW' },
  { id: 'creation-station', label: 'Creation Station' },
  { id: 'studio-editor-2', label: 'Studio Editor 2', badge: 'β' },
  { id: 'my-projects', label: 'My Projects' },
  { id: 'master-arranger', label: 'Mastering Bay' },
  { id: 'export', label: 'Export / Playback' },
];

function mergeNavItemsWithDefaults(savedIds: string[]): NavItem[] {
  const itemMap = new Map(DEFAULT_NAV_ITEMS.map((item) => [item.id, item]));
  const reordered = savedIds
    .map((id) => itemMap.get(id as ScreenId))
    .filter((item): item is NavItem => item !== undefined)
    .filter((item) => !VOCAL_LAB_NESTED_SCREEN_IDS.has(item.id));
  const seen = new Set(reordered.map((i) => i.id));
  for (const def of DEFAULT_NAV_ITEMS) {
    if (seen.has(def.id)) continue;
    const afterAiSong = def.id === 'ai-music-match' ? reordered.findIndex((i) => i.id === 'ai-song') : -1;
    if (afterAiSong >= 0) {
      reordered.splice(afterAiSong + 1, 0, def);
    } else {
      reordered.push(def);
    }
    seen.add(def.id);
  }
  return reordered.length > 0 ? reordered : DEFAULT_NAV_ITEMS;
}

export function loadNavItemsFromStorage(): NavItem[] {
  if (typeof window === 'undefined') return DEFAULT_NAV_ITEMS;
  try {
    const version = Number(localStorage.getItem(NAV_ITEM_ORDER_VERSION_KEY) ?? '0');
    const saved = localStorage.getItem('navItemOrder');
    if (saved && version >= NAV_ITEM_ORDER_VERSION) {
      const savedIds = (JSON.parse(saved) as string[]).filter((id) => !RETIRED_MODULE_SCREEN_IDS.has(id));
      return mergeNavItemsWithDefaults(savedIds);
    }
    if (saved) {
      const savedIds = (JSON.parse(saved) as string[]).filter((id) => !RETIRED_MODULE_SCREEN_IDS.has(id));
      const merged = mergeNavItemsWithDefaults(savedIds);
      localStorage.setItem(NAV_ITEM_ORDER_VERSION_KEY, String(NAV_ITEM_ORDER_VERSION));
      localStorage.setItem('navItemOrder', JSON.stringify(merged.map((i) => i.id)));
      return merged;
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_NAV_ITEMS;
}
