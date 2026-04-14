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
  Mic2, Music, Cpu, Layers, Radio,
  FolderOpen, AlignLeft, Piano, Download, GripVertical,
} from 'lucide-react';


export type ScreenId =
  | 'vocal-lab'
  | 'ai-song'
  | 'ai-pattern'
  | 'melody-transcription'
  | 'creation-station'
  | 'studio-editor'
  | 'my-projects'
  | 'master-arranger'
  | 'piano-roll'
  | 'export';

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  groupId?: string; // items with same groupId move together
}


const DEFAULT_ITEMS: NavItem[] = [
  { id: 'vocal-lab',       label: 'AI Vocal Lab',       icon: <Mic2 size={15} />,       badge: 'NEW' },
  { id: 'ai-song',         label: 'AI Song Generator',  icon: <Music size={15} /> },
  { id: 'ai-pattern',      label: 'AI Pattern Gen',     icon: <Cpu size={15} /> },
  { id: 'melody-transcription', label: 'Melody-to-MIDI', icon: <Mic2 size={15} />, badge: 'NEW' },
  { id: 'creation-station',label: 'Creation Station',   icon: <Layers size={15} /> },
  { id: 'studio-editor',   label: 'Studio Editor',      icon: <Radio size={15} /> },
  { id: 'my-projects',     label: 'My Projects',        icon: <FolderOpen size={15} /> },
  { id: 'master-arranger', label: 'Master Arranger',    icon: <AlignLeft size={15} /> },
  { id: 'piano-roll',      label: 'Piano Roll',         icon: <Piano size={15} /> },
  { id: 'export',          label: 'Export / Playback',  icon: <Download size={15} /> },
];


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
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all group relative active:scale-95 active:opacity-70"
        style={{
          background: isActive ? 'rgba(213,0,249,0.15)' : 'transparent',
          color: isActive ? '#D500F9' : '#888',
          border: '1px solid',
          borderColor: isActive ? 'rgba(213,0,249,0.3)' : 'transparent',
          paddingLeft: isGrouped ? 14 : undefined,
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
}


export default function NavigationSidebar({ activeScreen, onScreenChange }: NavigationSidebarProps) {
  const [items, setItems] = useState<NavItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('navItemOrder');
      if (saved) {
        try {
          const savedIds = JSON.parse(saved) as ScreenId[];
          const itemMap = new Map(DEFAULT_ITEMS.map(item => [item.id, item]));
          const reordered = savedIds
            .map(id => itemMap.get(id))
            .filter((item): item is NavItem => item !== undefined);
          return reordered.length > 0 ? reordered : DEFAULT_ITEMS;
        } catch {
          return DEFAULT_ITEMS;
        }
      }
    }
    return DEFAULT_ITEMS;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('navItemOrder', JSON.stringify(items.map(i => i.id)));
    }
  }, [items]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
      className="flex flex-col gap-1 px-2 py-3 shrink-0 overflow-y-auto"
      style={{
        width: 188,
        background: '#080808',
        borderRight: '1px solid #1a1a1a',
        minHeight: 0,
      }}
    >
      {/* Section label */}
      <div className="px-2 mb-1">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#333' }}>
          Modules
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableItem
              key={item.id}
              item={item}
              isActive={activeScreen === item.id}
              isGrouped={!!item.groupId}
              onClick={() => onScreenChange(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Group legend */}
      <div className="mt-auto pt-4 px-2">
        <div className="flex items-center gap-1 text-xs" style={{ color: '#333' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#D500F9' }} />
          Linked group
        </div>
        <p className="text-xs mt-1 leading-tight" style={{ color: '#2a2a2a' }}>
          Drag to reorder. Grouped items move together.
        </p>
      </div>
    </aside>
  );
}
