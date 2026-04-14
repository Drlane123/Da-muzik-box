import { Settings } from '@/app/context/SettingsContext';

export type KeyboardShortcutHandler = (e: KeyboardEvent) => void;

export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: { key: ' ', ctrl: false, shift: false, alt: false },
  STOP: { key: 's', ctrl: false, shift: false, alt: false },
  UNDO: { key: 'z', ctrl: true, shift: false, alt: false },
  REDO: { key: 'z', ctrl: true, shift: true, alt: false },
  SAVE: { key: 's', ctrl: true, shift: false, alt: false },
  RECORD: { key: 'r', ctrl: false, shift: false, alt: false },
  DELETE: { key: 'Delete', ctrl: false, shift: false, alt: false },
  SETTINGS: { key: ',', ctrl: true, shift: false, alt: false },
  HELP: { key: 'h', ctrl: false, shift: false, alt: false },
  HELP_ALT: { key: '?', ctrl: false, shift: false, alt: false },
};

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: typeof KEYBOARD_SHORTCUTS[keyof typeof KEYBOARD_SHORTCUTS]
): boolean {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt
  );
}

export function setupKeyboardShortcuts(
  settings: Settings,
  handlers: {
    onPlayPause?: () => void;
    onStop?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onSave?: () => void;
    onRecord?: () => void;
    onDelete?: () => void;
    onSettings?: () => void;
    onHelp?: () => void;
  }
): KeyboardShortcutHandler {
  return (event: KeyboardEvent) => {
    if (!settings.keyboardShortcutsEnabled) return;

    // Prevent shortcuts when typing in inputs
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (matchesShortcut(event, KEYBOARD_SHORTCUTS.PLAY_PAUSE)) {
      event.preventDefault();
      handlers.onPlayPause?.();
    } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.STOP)) {
      event.preventDefault();
      handlers.onStop?.();
    } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.UNDO)) {
      event.preventDefault();
      handlers.onUndo?.();
    } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.REDO)) {
      event.preventDefault();
      handlers.onRedo?.();
    } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SAVE)) {
      event.preventDefault();
      handlers.onSave?.();
    } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.RECORD)) {
      event.preventDefault();
      handlers.onRecord?.();
    } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.DELETE)) {
      event.preventDefault();
      handlers.onDelete?.();
    } else if (matchesShortcut(event, KEYBOARD_SHORTCUTS.SETTINGS)) {
      event.preventDefault();
      handlers.onSettings?.();
    } else if (
      matchesShortcut(event, KEYBOARD_SHORTCUTS.HELP) ||
      matchesShortcut(event, KEYBOARD_SHORTCUTS.HELP_ALT)
    ) {
      event.preventDefault();
      handlers.onHelp?.();
    }
  };
}