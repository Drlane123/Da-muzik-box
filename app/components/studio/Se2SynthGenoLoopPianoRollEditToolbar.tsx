'use client';

import type { CSSProperties } from 'react';

export type Se2GenoLoopGridTool = 'select' | 'draw';

export type Se2SynthGenoLoopPianoRollEditToolbarProps = {
  accentHex: string;
  disabled?: boolean;
  hasSelection: boolean;
  canUndo: boolean;
  hasNotes: boolean;
  /** Select = ruler/grid scrubs playhead + box-select; Draw = click grid to place notes. */
  gridTool?: Se2GenoLoopGridTool;
  onGridToolChange?: (tool: Se2GenoLoopGridTool) => void;
  onErase: () => void;
  onDuplicate: () => void;
  onCut: () => void;
  onUndo: () => void;
  onClear: () => void;
};

const TOOLBAR_FONT: CSSProperties = {
  fontFamily: 'system-ui, Segoe UI, sans-serif',
  fontSize: 8,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

/** Draw / select / erase / duplicate / cut / undo / clear — compact Geno piano-roll edit strip. */
export function Se2SynthGenoLoopPianoRollEditToolbar({
  accentHex,
  disabled = false,
  hasSelection,
  canUndo,
  hasNotes,
  gridTool,
  onGridToolChange,
  onErase,
  onDuplicate,
  onCut,
  onUndo,
  onClear,
}: Se2SynthGenoLoopPianoRollEditToolbarProps) {
  const showGridTools = gridTool != null && typeof onGridToolChange === 'function';

  const chip = (
    label: string,
    onClick: () => void,
    chipDisabled: boolean,
    colors: { border: string; background: string; color: string },
    title: string,
  ) => (
    <button
      type="button"
      disabled={disabled || chipDisabled}
      onClick={onClick}
      title={title}
      style={{
        ...TOOLBAR_FONT,
        height: 18,
        padding: '0 7px',
        lineHeight: 1,
        borderRadius: 2,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        cursor: disabled || chipDisabled ? 'default' : 'pointer',
        opacity: disabled || chipDisabled ? 0.35 : 1,
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );

  const toolToggle = (
    id: Se2GenoLoopGridTool,
    label: string,
    title: string,
  ) => {
    const active = gridTool === id;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onGridToolChange?.(id)}
        title={title}
        style={{
          ...TOOLBAR_FONT,
          height: 18,
          padding: '0 7px',
          lineHeight: 1,
          borderRadius: 2,
          border: `1px solid ${active ? accentHex : 'rgba(148,163,184,0.35)'}`,
          background: active ? `${accentHex}22` : 'rgba(148,163,184,0.08)',
          color: active ? accentHex : '#b8c4d0',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.35 : 1,
          flexShrink: 0,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 5,
        flexShrink: 0,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignItems: 'center',
        fontFamily: TOOLBAR_FONT.fontFamily,
      }}
    >
      {showGridTools ? (
        <>
          {toolToggle(
            'select',
            'Select',
            'Click ruler or empty grid to move playhead · Shift+drag to box-select notes',
          )}
          {toolToggle(
            'draw',
            'Draw',
            'Click empty grid cells to place chord tones · drag notes to move or resize',
          )}
        </>
      ) : null}
      {chip(
        'Erase',
        onErase,
        !hasSelection,
        { border: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#e8a0a0' },
        'Erase selected note (Del)',
      )}
      {chip(
        'Duplicate',
        onDuplicate,
        !hasSelection,
        { border: `${accentHex}55`, background: `${accentHex}12`, color: accentHex },
        'Duplicate selected note (Ctrl+D)',
      )}
      {chip(
        'Cut',
        onCut,
        !hasSelection,
        { border: 'rgba(148,163,184,0.35)', background: 'rgba(148,163,184,0.08)', color: '#b8c4d0' },
        'Cut selected note (Ctrl+X)',
      )}
      {chip(
        'Undo',
        onUndo,
        !canUndo,
        { border: 'rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.08)', color: '#b8a8e8' },
        'Undo edit (Ctrl+Z)',
      )}
      {chip(
        'Clear',
        onClear,
        !hasNotes,
        { border: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#e8a0a0' },
        'Clear all notes in this roll',
      )}
    </div>
  );
}
