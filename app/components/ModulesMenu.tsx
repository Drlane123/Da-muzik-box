'use client';

import React, { useEffect, useRef, useState } from 'react';

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
  DEFAULT_NAV_ITEMS,
  type NavItem,
  type ScreenId,
} from '@/app/lib/navigation/moduleNav';
import {
  prefetchCommonModuleScreens,
  prefetchModuleScreen,
} from '@/app/lib/navigation/prefetchModuleScreens';
import {
  isVocalLabScreen,
  VOCAL_LAB_SUB_SCREENS,
  type VocalLabSubScreenId,
} from '@/app/lib/vocalLab/vocalLabSubScreens';

const MENU_BG = '#0a0a0a';
const MENU_BORDER = '#333333';
const MENU_ROW = '#0a0a0a';
const MENU_HOVER = '#1a1a1a';
const MENU_ACTIVE = '#0a1a22';
const MENU_Z = 10000;
/** Gen-DAW cyan — matches Da Muzik Box / Gen-DAW title bar */
const ACCENT = '#00E5FF';

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
    padding: '8px 12px',
    fontFamily: 'Rajdhani, system-ui, sans-serif',
    fontSize: 13,
    fontWeight: active ? 700 : 600,
    letterSpacing: '0.08em',
    lineHeight: 1.35,
    color: active ? ACCENT : '#e8e8e8',
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
  const items = DEFAULT_NAV_ITEMS;

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
    prefetchModuleScreen(id);
    onScreenChange(id);
    closeMenu();
  };

  const openMenu = () => {
    prefetchCommonModuleScreens();
    setOpen(true);
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
        className="dmb-modules-dropdown"
        style={{
          position: 'fixed',
          top: submenuAnchor.top,
          left: submenuAnchor.right + 2,
          minWidth: 240,
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
            onClick={() => {
              /** First click opens Vocal Lab immediately — don't wait for a submenu-only gesture. */
              prefetchModuleScreen('vocal-lab');
              onVocalLabSubScreenChange?.('vocal-lab');
              onScreenChange('vocal-lab');
              closeMenu();
            }}
            onMouseEnter={(e) => {
              if (!parentActive) e.currentTarget.style.background = MENU_HOVER;
              prefetchModuleScreen('vocal-lab');
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
                  prefetchModuleScreen(sub.id);
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
            onClick={() => {
              /** First click opens Beat Lab immediately — submenu hover is for switching tools. */
              prefetchModuleScreen('creation-station');
              onCreationSubScreenChange('beat-lab');
              onScreenChange('creation-station');
              closeMenu();
            }}
            onMouseEnter={(e) => {
              if (!parentActive) e.currentTarget.style.background = MENU_HOVER;
              prefetchModuleScreen('creation-station');
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
                  prefetchModuleScreen('creation-station');
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
          prefetchModuleScreen(item.id);
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
      className="dmb-modules-menu-wrap relative shrink-0"
      style={{ zIndex: MENU_Z }}
    >
      <span className="dmb-modules-side-arrows" aria-hidden>
        <ChevronRight size={16} strokeWidth={2.75} className="dmb-modules-side-arrow--1" />
        <ChevronRight size={16} strokeWidth={2.75} className="dmb-modules-side-arrow--2" />
      </span>
      <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerEnter={() => prefetchCommonModuleScreens()}
        onPointerDown={() => prefetchCommonModuleScreens()}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="dmb-modules-trigger flex items-center justify-center gap-1.5 rounded-md transition-colors active:scale-[0.98]"
        style={{
          height: 44,
          minWidth: 144,
          padding: '0 14px',
          border: `1px solid ${open ? 'rgba(0,229,255,0.55)' : 'rgba(0,229,255,0.32)'}`,
          background: open
            ? 'linear-gradient(180deg, rgba(0,229,255,0.16) 0%, rgba(10,24,32,0.95) 100%)'
            : 'linear-gradient(180deg, #0f1a22 0%, #0a1218 100%)',
          color: '#ffffff',
          fontFamily: 'Rajdhani, system-ui, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          boxShadow: 'none',
        }}
        title="Open module menu"
      >
        Modules
        <ChevronDown
          size={15}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {open && (
      <div
        role="menu"
        className="dmb-modules-dropdown"
        style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 260,
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
    </div>
  );
}
