import React, { useState, useEffect } from 'react';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

import {
  Mic2, Music, Layers, Radio, Sparkles,
  FolderOpen, Sliders, Download, GripVertical,
  ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';

import {
  CREATION_SUB_SCREENS_NAV,
  type CreationSubScreenId,
} from '@/app/lib/creationStation/creationSubScreens';
import {
  VOCAL_LAB_SUB_SCREENS,
  isVocalLabScreen,
  type VocalLabSubScreenId,
} from '@/app/lib/vocalLab/vocalLabSubScreens';


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

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  groupId?: string; // items with same groupId move together
}


const NAV_SIDEBAR_COLLAPSED_KEY = 'navModulesCollapsed';
/** Bump when adding sidebar modules — triggers merge of new DEFAULT_ITEMS into saved order. */
const NAV_ITEM_ORDER_VERSION = 3;
const NAV_ITEM_ORDER_VERSION_KEY = 'navItemOrderVersion';

/** Top-level nav only — Melody-to-MIDI and Harmony live under AI Vocal Lab sub-nav. */
const VOCAL_LAB_NESTED_SCREEN_IDS = new Set<ScreenId>(['melody-transcription', 'harmony-match']);

/** Retired modules — stripped from saved nav order (e.g. standalone Piano Roll → use Studio Editor 2). */
const RETIRED_MODULE_SCREEN_IDS = new Set<string>(['piano-roll']);

const DEFAULT_ITEMS: NavItem[] = [
  { id: 'vocal-lab',       label: 'AI Vocal Lab',       icon: <Mic2 size={15} />,       badge: 'NEW' },
  { id: 'ai-song',         label: 'AI Song Generator',  icon: <Music size={15} /> },
  { id: 'ai-music-match',  label: 'AI Music Match',     icon: <Sparkles size={15} />, badge: 'NEW' },
  { id: 'creation-station',label: 'Creation Station',   icon: <Layers size={15} /> },
  {
    id: 'studio-editor-2',
    label: 'Studio Editor 2',
    icon: <Radio size={15} />,
    badge: 'β',
  },
  { id: 'my-projects',     label: 'My Projects',        icon: <FolderOpen size={15} /> },
  { id: 'master-arranger', label: 'Mastering Bay',      icon: <Sliders size={15} /> },
  { id: 'export',          label: 'Export / Playback',  icon: <Download size={15} /> },
];

function mergeNavItemsWithDefaults(savedIds: string[]): NavItem[] {
  const itemMap = new Map(DEFAULT_ITEMS.map((item) => [item.id, item]));
  const reordered = savedIds
    .map((id) => itemMap.get(id as ScreenId))
    .filter((item): item is NavItem => item !== undefined)
    .filter((item) => !VOCAL_LAB_NESTED_SCREEN_IDS.has(item.id));
  const seen = new Set(reordered.map((i) => i.id));
  for (const def of DEFAULT_ITEMS) {
    if (seen.has(def.id)) continue;
    const afterAiSong = def.id === 'ai-music-match' ? reordered.findIndex((i) => i.id === 'ai-song') : -1;
    if (afterAiSong >= 0) {
      reordered.splice(afterAiSong + 1, 0, def);
    } else {
      reordered.push(def);
    }
    seen.add(def.id);
  }
  return reordered.length > 0 ? reordered : DEFAULT_ITEMS;
}

function loadNavItemsFromStorage(): NavItem[] {
  if (typeof window === 'undefined') return DEFAULT_ITEMS;
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
  return DEFAULT_ITEMS;
}

interface SortableItemProps {
  item: NavItem;
  isActive: boolean;
  isGrouped: boolean;
  onClick: () => void;
}


function SortableItem({ item, isActive, isGrouped, onClick }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Group indicator bar */}
      {isGrouped && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
          style={{ background: '#D500F9' }}
        />
      )}
      <button
        onClick={onClick}
        className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-left transition-all group relative active:scale-95 active:opacity-70"
        style={{
          background: isActive ? 'rgba(213,0,249,0.15)' : 'transparent',
          color: isActive ? '#D500F9' : '#888',
          border: '1px solid',
          borderColor: isActive ? 'rgba(213,0,249,0.3)' : 'transparent',
          paddingLeft: isGrouped ? 12 : undefined,
        }}
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>

        <span className="shrink-0" style={{ color: isActive ? '#D500F9' : '#666' }}>
          {item.icon}
        </span>
        <span className="text-xs font-medium truncate flex-1">{item.label}</span>
        {item.badge && (
          <span
            className="text-xs px-1 rounded font-bold shrink-0"
            style={{ background: '#D500F9', color: '#000', fontSize: 9 }}
          >
            {item.badge}
          </span>
        )}
      </button>
    </div>
  );
}


interface NavigationSidebarProps {
  activeScreen: ScreenId;
  onScreenChange: (id: ScreenId) => void;
  activeCreationSubScreen?: CreationSubScreenId;
  onCreationSubScreenChange?: (sub: CreationSubScreenId) => void;
  activeVocalLabSubScreen?: VocalLabSubScreenId;
  onVocalLabSubScreenChange?: (sub: VocalLabSubScreenId) => void;
}

interface CreationStationNavGroupProps {
  item: NavItem;
  isActive: boolean;
  isGrouped: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  activeSubScreen: CreationSubScreenId;
  onSelectSub: (sub: CreationSubScreenId) => void;
  onSelectModule: () => void;
}

interface VocalLabNavGroupProps {
  item: NavItem;
  isActive: boolean;
  isGrouped: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  activeSubScreen: VocalLabSubScreenId;
  onSelectSub: (sub: VocalLabSubScreenId) => void;
  onSelectModule: () => void;
}

function VocalLabNavGroup({
  item,
  isActive,
  isGrouped,
  expanded,
  onToggleExpand,
  activeSubScreen,
  onSelectSub,
  onSelectModule,
}: VocalLabNavGroupProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isGrouped && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
          style={{ background: '#D500F9' }}
        />
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectModule}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectModule();
          }
        }}
        className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-left transition-all group relative active:scale-95 active:opacity-70 cursor-pointer"
        style={{
          background: isActive ? 'rgba(213,0,249,0.15)' : 'transparent',
          color: isActive ? '#D500F9' : '#888',
          border: '1px solid',
          borderColor: isActive ? 'rgba(213,0,249,0.3)' : 'transparent',
          paddingLeft: isGrouped ? 12 : undefined,
        }}
      >
        <span
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
        <span className="shrink-0" style={{ color: isActive ? '#D500F9' : '#666' }}>
          {item.icon}
        </span>
        <span className="text-xs font-medium truncate flex-1 min-w-0">{item.label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="shrink-0 flex items-center justify-center rounded ml-auto"
          style={{
            width: 22,
            height: 22,
            border: 'none',
            background: 'transparent',
            color: isActive ? '#D500F9' : '#666',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title={expanded ? 'Collapse Vocal Lab tools' : 'Expand Vocal Lab tools'}
          aria-expanded={expanded}
        >
          <ChevronDown
            size={14}
            style={{
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
      </div>
      {expanded && (
        <div className="flex flex-col gap-0.5 pl-1 pr-0 pb-1" style={{ marginLeft: 8 }}>
          {VOCAL_LAB_SUB_SCREENS.map((sub) => {
            const subActive = isActive && activeSubScreen === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSub(sub.id)}
                className="w-full text-left rounded-md transition-all active:scale-[0.98]"
                style={{
                  padding: '5px 6px 5px 18px',
                  fontSize: 10,
                  fontWeight: subActive ? 700 : 500,
                  color: subActive ? '#f472b6' : '#6a6a78',
                  background: subActive ? 'rgba(244, 114, 182, 0.10)' : 'transparent',
                  border: '1px solid',
                  borderColor: subActive ? 'rgba(244, 114, 182, 0.28)' : 'transparent',
                }}
                title={sub.label}
              >
                {sub.shortLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreationStationNavGroup({
  item,
  isActive,
  isGrouped,
  expanded,
  onToggleExpand,
  activeSubScreen,
  onSelectSub,
  onSelectModule,
}: CreationStationNavGroupProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isGrouped && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
          style={{ background: '#D500F9' }}
        />
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectModule}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectModule();
          }
        }}
        className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-left transition-all group relative active:scale-95 active:opacity-70 cursor-pointer"
        style={{
          background: isActive ? 'rgba(213,0,249,0.15)' : 'transparent',
          color: isActive ? '#D500F9' : '#888',
          border: '1px solid',
          borderColor: isActive ? 'rgba(213,0,249,0.3)' : 'transparent',
          paddingLeft: isGrouped ? 12 : undefined,
        }}
      >
        <span
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
        <span className="shrink-0" style={{ color: isActive ? '#D500F9' : '#666' }}>
          {item.icon}
        </span>
        <span className="text-xs font-medium truncate flex-1 min-w-0">{item.label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="shrink-0 flex items-center justify-center rounded"
          style={{
            width: 22,
            height: 22,
            border: 'none',
            background: 'transparent',
            color: isActive ? '#D500F9' : '#666',
            cursor: 'pointer',
          }}
          title={expanded ? 'Collapse Creation Station tools' : 'Expand Creation Station tools'}
          aria-expanded={expanded}
        >
          <ChevronDown
            size={14}
            style={{
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
      </div>
      {expanded && (
        <div className="flex flex-col gap-0.5 pl-1 pr-0 pb-1" style={{ marginLeft: 8 }}>
          {CREATION_SUB_SCREENS_NAV.map((sub) => {
            const subActive = isActive && activeSubScreen === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSub(sub.id)}
                className="w-full text-left rounded-md transition-all active:scale-[0.98]"
                style={{
                  padding: '5px 6px 5px 18px',
                  fontSize: 10,
                  fontWeight: subActive ? 700 : 500,
                  color: subActive ? '#7cf4c6' : '#6a6a78',
                  background: subActive ? 'rgba(124, 244, 198, 0.10)' : 'transparent',
                  border: '1px solid',
                  borderColor: subActive ? 'rgba(124, 244, 198, 0.28)' : 'transparent',
                }}
                title={sub.label}
              >
                {sub.shortLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


export default function NavigationSidebar({
  activeScreen,
  onScreenChange,
  activeCreationSubScreen = 'beat-lab',
  onCreationSubScreenChange,
  activeVocalLabSubScreen = 'vocal-lab',
  onVocalLabSubScreenChange,
}: NavigationSidebarProps) {
  const [modulesCollapsed, setModulesCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(NAV_SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(NAV_SIDEBAR_COLLAPSED_KEY, modulesCollapsed ? '1' : '0');
    } catch {
      /* ignore quota */
    }
  }, [modulesCollapsed]);

  const [items, setItems] = useState<NavItem[]>(() => loadNavItemsFromStorage());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('navItemOrder', JSON.stringify(items.map(i => i.id)));
      localStorage.setItem(NAV_ITEM_ORDER_VERSION_KEY, String(NAV_ITEM_ORDER_VERSION));
    }
  }, [items]);

  /** Drop legacy top-level Melody/Harmony and retired modules — keep the user's module order intact. */
  useEffect(() => {
    setItems((prev) => {
      const filtered = prev.filter(
        (i) => !VOCAL_LAB_NESTED_SCREEN_IDS.has(i.id) && !RETIRED_MODULE_SCREEN_IDS.has(i.id),
      );
      return filtered.length === prev.length ? prev : filtered;
    });
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [creationExpanded, setCreationExpanded] = useState(true);
  /** Vocal Lab sub-nav starts expanded so Melody-to-MIDI / Harmony are visible without an extra click. */
  const [vocalLabExpanded, setVocalLabExpanded] = useState(true);

  useEffect(() => {
    if (activeScreen === 'creation-station') {
      setCreationExpanded(true);
    }
  }, [activeScreen]);

  useEffect(() => {
    if (isVocalLabScreen(activeScreen)) {
      setVocalLabExpanded(true);
    }
  }, [activeScreen]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const draggedItem = items[oldIndex];

    // If item is in a group, move whole group together
    if (draggedItem.groupId) {
      const groupItems = items.filter(i => i.groupId === draggedItem.groupId);
      const nonGroupItems = items.filter(i => i.groupId !== draggedItem.groupId);
      // Find where over item is among non-group items
      const overItem = items[newIndex];
      if (overItem.groupId === draggedItem.groupId) return; // same group, ignore

      // Place group before the over item
      const overNonGroupIndex = nonGroupItems.findIndex(i => i.id === over.id);
      const insertAt = overNonGroupIndex >= 0 ? overNonGroupIndex : nonGroupItems.length;
      const result = [...nonGroupItems];
      result.splice(insertAt, 0, ...groupItems);
      setItems(result);
    } else {
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  }

  return (
    <aside
      className="flex flex-col shrink-0 overflow-y-auto overflow-x-hidden"
      style={{
        width: modulesCollapsed ? 44 : 168,
        paddingLeft: modulesCollapsed ? 6 : 5,
        paddingRight: modulesCollapsed ? 6 : 6,
        paddingTop: 12,
        paddingBottom: 12,
        gap: modulesCollapsed ? 8 : 4,
        background: '#080808',
        borderRight: '1px solid #1a1a1a',
        minHeight: 0,
        transition: 'width 0.18s ease',
      }}
    >
      {modulesCollapsed ? (
        <button
          type="button"
          onClick={() => setModulesCollapsed(false)}
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{
            width: '100%',
            minHeight: 36,
            border: '1px solid #2a2a2a',
            background: '#121212',
            color: '#D500F9',
            cursor: 'pointer',
          }}
          title="Show modules — expand navigation"
        >
          <ChevronRight size={18} strokeWidth={2.25} />
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 mb-1 px-0 min-w-0">
            <span
              className="text-xs font-bold tracking-widest uppercase truncate"
              style={{ color: '#333' }}
            >
              Modules
            </span>
            <button
              type="button"
              onClick={() => setModulesCollapsed(true)}
              className="flex items-center justify-center rounded-md shrink-0"
              style={{
                width: 28,
                height: 28,
                border: '1px solid #2a2a2a',
                background: '#121212',
                color: '#888',
                cursor: 'pointer',
              }}
              title="Hide modules — full width for the current screen"
            >
              <ChevronLeft size={16} strokeWidth={2.25} />
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {items.map((item) =>
                item.id === 'vocal-lab' ? (
                  <VocalLabNavGroup
                    key={item.id}
                    item={item}
                    isActive={isVocalLabScreen(activeScreen)}
                    isGrouped={!!item.groupId}
                    expanded={vocalLabExpanded}
                    onToggleExpand={() => setVocalLabExpanded((v) => !v)}
                    activeSubScreen={activeVocalLabSubScreen}
                    onSelectSub={(sub) => {
                      onVocalLabSubScreenChange?.(sub);
                      onScreenChange(sub);
                    }}
                    onSelectModule={() => {
                      onScreenChange(activeVocalLabSubScreen);
                      onVocalLabSubScreenChange?.(activeVocalLabSubScreen);
                      setVocalLabExpanded(true);
                    }}
                  />
                ) : item.id === 'creation-station' && onCreationSubScreenChange ? (
                  <CreationStationNavGroup
                    key={item.id}
                    item={item}
                    isActive={activeScreen === 'creation-station'}
                    isGrouped={!!item.groupId}
                    expanded={creationExpanded}
                    onToggleExpand={() => setCreationExpanded((v) => !v)}
                    activeSubScreen={activeCreationSubScreen}
                    onSelectSub={(sub) => {
                      onCreationSubScreenChange(sub);
                      onScreenChange('creation-station');
                    }}
                    onSelectModule={() => {
                      onScreenChange('creation-station');
                      onCreationSubScreenChange(activeCreationSubScreen);
                      setCreationExpanded(true);
                    }}
                  />
                ) : (
                  <SortableItem
                    key={item.id}
                    item={item}
                    isActive={activeScreen === item.id}
                    isGrouped={!!item.groupId}
                    onClick={() => onScreenChange(item.id)}
                  />
                ),
              )}
            </SortableContext>
          </DndContext>

          <div className="mt-auto pt-4 px-0">
            <div className="flex items-center gap-1 text-xs" style={{ color: '#333' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: '#D500F9' }} />
              Linked group
            </div>
            <p className="text-xs mt-1 leading-tight" style={{ color: '#2a2a2a' }}>
              Drag to reorder. Grouped items move together.
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
