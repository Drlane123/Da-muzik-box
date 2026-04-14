import { useEffect, useCallback } from 'react';

export interface DAWShortcuts {
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onMute: () => void;
  onPlayPause: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export const useDAWKeyboardShortcuts = (
  shortcuts: Partial<DAWShortcuts>,
  /** When false, shortcuts are not handled (e.g. Studio tab hidden — avoids hijacking global copy/paste). */
  enabled = true,
) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;

      const t = event.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
          return;
        }
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlCmd = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl/Cmd + X = Cut
      if (ctrlCmd && event.key === 'x') {
        event.preventDefault();
        shortcuts.onCut?.();
      }

      // Ctrl/Cmd + C = Copy
      if (ctrlCmd && event.key === 'c') {
        event.preventDefault();
        shortcuts.onCopy?.();
      }

      // Ctrl/Cmd + V = Paste
      if (ctrlCmd && event.key === 'v') {
        event.preventDefault();
        shortcuts.onPaste?.();
      }

      // Ctrl/Cmd + D = Duplicate
      if (ctrlCmd && event.key === 'd') {
        event.preventDefault();
        shortcuts.onDuplicate?.();
      }

      // Ctrl/Cmd + E = Split at Playhead
      if (ctrlCmd && event.key === 'e') {
        event.preventDefault();
        shortcuts.onSplit?.();
      }

      // Delete = Delete Selection
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        shortcuts.onDelete?.();
      }

      // Ctrl/Cmd + A = Select All
      if (ctrlCmd && event.key === 'a') {
        event.preventDefault();
        shortcuts.onSelectAll?.();
      }

      // Ctrl/Cmd + Z = Undo
      if (ctrlCmd && event.key === 'z') {
        event.preventDefault();
        shortcuts.onUndo?.();
      }

      // Ctrl/Cmd + Y = Redo
      if (ctrlCmd && event.key === 'y') {
        event.preventDefault();
        shortcuts.onRedo?.();
      }

      // M = Mute Selection
      if (event.key === 'm' || event.key === '0') {
        event.preventDefault();
        shortcuts.onMute?.();
      }

      // Space = Play/Pause
      if (event.key === ' ') {
        event.preventDefault();
        shortcuts.onPlayPause?.();
      }

      // Ctrl/Cmd + Mouse Wheel = Zoom (handled in component)
      // Alt + Drag = Bypass Snap (handled in component)
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
};

// Professional DAW Shortcut Reference
export const DAW_SHORTCUT_REFERENCE = {
  WINDOWS: {
    'Cut (Split)': 'Ctrl + X',
    'Split at Playhead': 'Ctrl + E',
    'Copy': 'Ctrl + C',
    'Paste': 'Ctrl + V',
    'Duplicate': 'Ctrl + D',
    'Select All': 'Ctrl + A',
    'Undo': 'Ctrl + Z',
    'Redo': 'Ctrl + Y',
    'Delete': 'Delete',
    'Mute Selection': 'M or 0',
    'Play/Pause': 'Space',
    'Duplicate & Drag': 'Ctrl + Drag',
    'Bypass Snapping': 'Alt + Drag',
    'Zoom In/Out': 'Ctrl + Scroll',
  },
  MAC: {
    'Cut (Split)': 'Cmd + X',
    'Split at Playhead': 'Cmd + E',
    'Copy': 'Cmd + C',
    'Paste': 'Cmd + V',
    'Duplicate': 'Cmd + D',
    'Select All': 'Cmd + A',
    'Undo': 'Cmd + Z',
    'Redo': 'Cmd + Y',
    'Delete': 'Delete',
    'Mute Selection': 'M or 0',
    'Play/Pause': 'Space',
    'Duplicate & Drag': 'Option + Drag',
    'Bypass Snapping': 'Alt + Drag',
    'Zoom In/Out': 'Cmd + Scroll',
  },
};
