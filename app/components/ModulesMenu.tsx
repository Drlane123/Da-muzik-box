'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  ChevronDown,
  ChevronRight,
  Download,
  FolderOpen,
  Layers,
  Mic2,
  Music,
  Radio,
  Sliders,
  Sparkles,
} from 'lucide-react';

import {
  CREATION_SUB_SCREENS_NAV,
  type CreationSubScreenId,
} from '@/app/lib/creationStation/creationSubScreens';
import {
  loadNavItemsFromStorage,
  type NavItem,
  type ScreenId,
} from '@/app/lib/navigation/moduleNav';
import {
  isVocalLabScreen,
  VOCAL_LAB_SUB_SCREENS,
  type VocalLabSubScreenId,
} from '@/app/lib/vocalLab/vocalLabSubScreens';

const MENU_BG = '#0a0a0a';
const MENU_BORDER = '#333333';
const MENU_ROW = '#0a0a0a';
const MENU_HOVER = '#1a1a1a';
const MENU_ACTIVE = '#241428';
const MENU_Z = 10000;
const ACCENT = '#D500F9';

function navIcon(id: ScreenId, size = 14) {
  switch (id) {
    case 'vocal-lab':
      return <Mic2 size={size} />;
    case 'ai-song':
      return <Music size={size} />;
    case 'ai-music-match':
      return <Sparkles size={size} />;
    case 'creation-station':
      return <Layers size={size} />;
    case 'studio-editor-2':
      return <Radio size={size} />;
    case 'my-projects':
      return <FolderOpen size={size} />;
    case 'master-arranger':
      return <Sliders size={size} />;
    case 'export':
      return <Download size={size} />;
    default:
      return null;
  }
}

interface ModulesMenuProps {
  activeScreen: ScreenId;
  onScreenChange: (id: ScreenId) => void;
  activeCreationSubScreen?: CreationSubScreenId;
  onCreationSubScreenChange?: (sub: CreationSubScreenId) => void;
  activeVocalLabSubScreen?: VocalLabSubScreenId;
  onVocalLabSubScreenChange?: (sub: VocalLabSubScreenId) => void;
}

function menuRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    color: active ? ACCENT : '#c8c8c8',
    background: active ? MENU_ACTIVE : MENU_ROW,
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  };
}

export default function ModulesMenu({
  activeScreen,
  onScreenChange,
  activeCreationSubScreen = 'beat-lab',
  onCreationSubScreenChange,
  activeVocalLabSubScreen = 'vocal-lab',
  onVocalLabSubScreenChange,
}: ModulesMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const submenuLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [submenuAnchor, setSubmenuAnchor] = useState<DOMRect | null>(null);
  const items = useMemo(() => loadNavItemsFromStorage(), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setOpenSubmenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setOpenSubmenu(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const closeMenu = () => {
    if (submenuLeaveTimer.current) clearTimeout(submenuLeaveTimer.current);
    setOpen(false);
    setOpenSubmenu(null);
    setSubmenuAnchor(null);
  };

  const scheduleCloseSubmenu = () => {
    if (submenuLeaveTimer.current) clearTimeout(submenuLeaveTimer.current);
    submenuLeaveTimer.current = setTimeout(() => {
      setOpenSubmenu(null);
      setSubmenuAnchor(null);
    }, 140);
  };

  const cancelCloseSubmenu = () => {
    if (submenuLeaveTimer.current) clearTimeout(submenuLeaveTimer.current);
  };

  const selectScreen = (id: ScreenId) => {
    onScreenChange(id);
    closeMenu();
  };

  const showSubmenu = (key: string, anchor: DOMRect) => {
    cancelCloseSubmenu();
    setOpenSubmenu(key);
    setSubmenuAnchor(anchor);
  };

  const renderSubmenuPanel = (
    key: string,
    entries: { id: string; label: string; active: boolean; onSelect: () => void }[],
  ) => {
    if (!submenuAnchor || openSubmenu !== key) return null;
    return (
      <div
        role="menu"
        style={{
          position: 'fixed',
          top: submenuAnchor.top,
          left: submenuAnchor.right + 2,
          minWidth: 220,
          maxHeight: 'min(70vh, 480px)',
          overflowY: 'auto',
          backgroundColor: MENU_BG,
          opacity: 1,
          border: `1px solid ${MENU_BORDER}`,
          borderRadius: 6,
          boxShadow: '0 12px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.6)',
          padding: '4px 0',
          zIndex: MENU_Z,
        }}
        onMouseEnter={() => cancelCloseSubmenu()}
        onMouseLeave={scheduleCloseSubmenu}
      >
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            onClick={entry.onSelect}
            style={menuRowStyle(entry.active)}
            onMouseEnter={(e) => {
              if (!entry.active) e.currentTarget.style.background = MENU_HOVER;
            }}
            onMouseLeave={(e) => {
              if (!entry.active) e.currentTarget.style.background = MENU_ROW;
            }}
          >
            <span className="truncate">{entry.label}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderItem = (item: NavItem) => {
    if (item.id === 'vocal-lab') {
      const parentActive = isVocalLabScreen(activeScreen);
      return (
        <div
          key={item.id}
          style={{ position: 'relative' }}
          onMouseLeave={scheduleCloseSubmenu}
        >
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openSubmenu === item.id}
            style={menuRowStyle(parentActive)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (openSubmenu === item.id) {
                setOpenSubmenu(null);
                setSubmenuAnchor(null);
              } else {
                showSubmenu(item.id, rect);
              }
            }}
            onMouseEnter={(e) => {
              if (!parentActive) e.currentTarget.style.background = MENU_HOVER;
              showSubmenu(item.id, e.currentTarget.getBoundingClientRect());
            }}
            onMouseLeave={(e) => {
              if (!parentActive) e.currentTarget.style.background = MENU_ROW;
            }}
          >
            <span style={{ color: parentActive ? ACCENT : '#888', display: 'flex' }}>{navIcon(item.id)}</span>
            <span className="truncate flex-1">{item.label}</span>
            {item.badge && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: ACCENT, color: '#000' }}>
                {item.badge}
              </span>
            )}
            <ChevronRight size={14} style={{ color: '#888', flexShrink: 0 }} />
          </button>
          {renderSubmenuPanel(
              item.id,
              VOCAL_LAB_SUB_SCREENS.map((sub) => ({
                id: sub.id,
                label: sub.label,
                active: parentActive && activeVocalLabSubScreen === sub.id,
                onSelect: () => {
                  onVocalLabSubScreenChange?.(sub.id);
                  onScreenChange(sub.id);
                  closeMenu();
                },
              })),
            )}
        </div>
      );
    }

    if (item.id === 'creation-station' && onCreationSubScreenChange) {
      const parentActive = activeScreen === 'creation-station';
      return (
        <div
          key={item.id}
          style={{ position: 'relative' }}
          onMouseLeave={scheduleCloseSubmenu}
        >
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openSubmenu === item.id}
            style={menuRowStyle(parentActive)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (openSubmenu === item.id) {
                setOpenSubmenu(null);
                setSubmenuAnchor(null);
              } else {
                showSubmenu(item.id, rect);
              }
            }}
            onMouseEnter={(e) => {
              if (!parentActive) e.currentTarget.style.background = MENU_HOVER;
              showSubmenu(item.id, e.currentTarget.getBoundingClientRect());
            }}
            onMouseLeave={(e) => {
              if (!parentActive) e.currentTarget.style.background = MENU_ROW;
            }}
          >
            <span style={{ color: parentActive ? ACCENT : '#888', display: 'flex' }}>{navIcon(item.id)}</span>
            <span className="truncate flex-1">{item.label}</span>
            <ChevronRight size={14} style={{ color: '#888', flexShrink: 0 }} />
          </button>
          {renderSubmenuPanel(
              item.id,
              CREATION_SUB_SCREENS_NAV.map((sub) => ({
                id: sub.id,
                label: sub.label,
                active: parentActive && activeCreationSubScreen === sub.id,
                onSelect: () => {
                  onCreationSubScreenChange(sub.id);
                  onScreenChange('creation-station');
                  closeMenu();
                },
              })),
            )}
        </div>
      );
    }

    const isActive = activeScreen === item.id;
    return (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        onClick={() => selectScreen(item.id)}
        style={menuRowStyle(isActive)}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = MENU_HOVER;
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = MENU_ROW;
        }}
      >
        <span style={{ color: isActive ? ACCENT : '#888', display: 'flex' }}>{navIcon(item.id)}</span>
        <span className="truncate flex-1">{item.label}</span>
        {item.badge && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: ACCENT, color: '#000' }}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      data-dmb-modules-menu
      className="relative shrink-0"
      style={{ zIndex: MENU_Z }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md transition-colors active:scale-95"
        style={{
          height: 32,
          padding: '0 10px',
          border: `1px solid ${open ? 'rgba(213,0,249,0.35)' : MENU_BORDER}`,
          background: open ? 'rgba(213,0,249,0.08)' : '#141414',
          color: open ? ACCENT : '#b0b0b0',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
        title="Open module menu"
      >
        Modules
        <ChevronDown
          size={14}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 240,
            maxHeight: 'min(70vh, 520px)',
            overflowY: 'auto',
            backgroundColor: MENU_BG,
            opacity: 1,
            border: `1px solid ${MENU_BORDER}`,
            borderRadius: 6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.6)',
            padding: '4px 0',
            zIndex: MENU_Z,
          }}
        >
          {items.map((item) => renderItem(item))}
        </div>
      )}
    </div>
  );
}
