import React, { useRef, useEffect, useState } from 'react';

interface TimelineContextMenuProps {
  contextMenu: { x: number; y: number } | null;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canPaste: boolean;
}

export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
  contextMenu,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onSplit,
  onDelete,
  onUndo,
  onRedo,
  canPaste,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (contextMenu) {
      let x = contextMenu.x;
      let y = contextMenu.y;

      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) {
          x = window.innerWidth - rect.width - 10;
        }
        if (y + rect.height > window.innerHeight) {
          y = window.innerHeight - rect.height - 10;
        }
      }

      setPosition({ x, y });
    }
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu, onClose]);

  if (!contextMenu) return null;

  const menuItems = [
    { label: 'Cut', action: onCut, shortcut: 'Ctrl+X', disabled: false },
    { label: 'Copy', action: onCopy, shortcut: 'Ctrl+C', disabled: false },
    { label: 'Paste', action: onPaste, shortcut: 'Ctrl+V', disabled: !canPaste },
    { label: 'Duplicate', action: onDuplicate, shortcut: 'Ctrl+D', disabled: false },
    { label: 'Split', action: onSplit, shortcut: 'Ctrl+E', disabled: false },
    { label: 'Delete', action: onDelete, shortcut: 'Del', disabled: false },
    { label: 'Undo', action: onUndo, shortcut: 'Ctrl+Z', disabled: false },
    { label: 'Redo', action: onRedo, shortcut: 'Ctrl+Y', disabled: false },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-700 border border-gray-600 rounded shadow-lg py-1 min-w-[200px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            if (!item.disabled) {
              item.action();
              onClose();
            }
          }}
          disabled={item.disabled}
          className={`w-full px-4 py-2 text-left text-sm flex justify-between items-center ${
            item.disabled
              ? 'text-gray-500 cursor-not-allowed'
              : 'text-gray-100 hover:bg-gray-600 cursor-pointer'
          }`}
        >
          <span>{item.label}</span>
          <span className="text-xs text-gray-400 ml-4">{item.shortcut}</span>
        </button>
      ))}
    </div>
  );
};
