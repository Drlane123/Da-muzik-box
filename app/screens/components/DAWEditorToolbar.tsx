import React, { useState } from 'react';
import {
  Scissors,
  Copy,
  Clipboard,
  Files,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
  Settings,
  Clock,
} from 'lucide-react';
import type { SnapGridType } from '@/app/screens/utils/dawUtils';

interface DAWEditorToolbarProps {
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  snapType: SnapGridType;
  onSnapChange: (snap: SnapGridType) => void;
  onZoom: (direction: 'in' | 'out') => void;
  hasSelection: boolean;
  hasClipboard: boolean;
  showShortcutHelp?: boolean;
  bpm: number;
  onBpmChange: (nextBpm: number) => void;
}

const SNAP_OPTIONS: { value: SnapGridType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: '1/2', label: '1/2' },
  { value: '1/4', label: '1/4' },
  { value: '1/8', label: '1/8' },
  { value: '1/16', label: '1/16' },
  { value: '1/32', label: '1/32' },
  { value: 'off', label: 'Free' },
];

export const DAWEditorToolbar: React.FC<DAWEditorToolbarProps> = ({
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onSelectAll,
  snapType,
  onSnapChange,
  onZoom,
  hasSelection,
  hasClipboard,
  showShortcutHelp = false,
  bpm,
  onBpmChange,
}) => {
  const [showHelp, setShowHelp] = useState(showShortcutHelp);

  return (
    <div className="relative bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center gap-5">
      {/* Edit Tools */}
      <div className="flex gap-3.5 border-r border-gray-700 pr-5 mr-2">
        <button
          onClick={onCut}
          disabled={!hasSelection}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          title="Cut (Ctrl+X)"
        >
          <Scissors size={16} />
        </button>
        
        <button
          onClick={onCopy}
          disabled={!hasSelection}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          title="Copy (Ctrl+C)"
        >
          <Copy size={16} />
        </button>
        
        <button
          onClick={onPaste}
          disabled={!hasClipboard}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          title="Paste (Ctrl+V)"
        >
          <Clipboard size={16} />
        </button>
        
        <button
          onClick={onDuplicate}
          disabled={!hasSelection}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          title="Duplicate (Ctrl+D)"
        >
          <Files size={16} />
        </button>
        
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Clip drag snap */}
      <div className="flex items-center gap-1.5 border-r border-gray-700 pr-4">
        <label className="text-[10px] text-gray-500 uppercase tracking-wide whitespace-nowrap">
          Snap
        </label>
        <select
          value={snapType}
          onChange={(e) => onSnapChange(e.target.value as SnapGridType)}
          className="text-[11px] bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-gray-200 max-w-[88px]"
          title="Clip drag grid (hold Alt while dragging to bypass)"
        >
          {SNAP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Zoom */}
      <div className="flex gap-2.5 border-r border-gray-700 pr-4">
        <button
          onClick={() => onZoom('in')}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 rounded"
          title="Zoom In (Ctrl+Scroll)"
        >
          <ZoomIn size={16} />
        </button>
        
        <button
          onClick={() => onZoom('out')}
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 rounded"
          title="Zoom Out (Ctrl+Scroll)"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      {/* Select All */}
      <button
        onClick={onSelectAll}
        className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 rounded text-xs mx-2"
        title="Select All (Ctrl+A)"
      >
        <Type size={16} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Tempo */}
      <div className="flex items-center gap-1.5 border-r border-gray-700 pr-3">
        <Clock size={14} className="text-gray-500" />
        <button
          type="button"
          onClick={() => onBpmChange(Math.round((bpm ?? 120) - 1))}
          className="w-6 h-6 flex items-center justify-center rounded border text-indigo-200"
          style={{ background: '#312e81', borderColor: '#6366f1' }}
          title="Tempo down (−1 BPM)"
        >
          -
        </button>
        <input
          type="number"
          min={40}
          max={300}
          step={1}
          value={Math.round(bpm || 120)}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onBpmChange(Math.round(next));
          }}
          className="w-16 h-6 text-[11px] border rounded px-1.5 text-right font-mono"
          style={{
            background: '#111827',
            borderColor: '#4b5563',
            color: '#f3f4f6',
            appearance: 'textfield',
            WebkitAppearance: 'none',
            MozAppearance: 'textfield',
          }}
          title="Tempo BPM"
        />
        <button
          type="button"
          onClick={() => onBpmChange(Math.round((bpm ?? 120) + 1))}
          className="w-6 h-6 flex items-center justify-center rounded border text-indigo-200"
          style={{ background: '#312e81', borderColor: '#6366f1' }}
          title="Tempo up (+1 BPM)"
        >
          +
        </button>
        <span className="text-[10px] text-gray-500 font-mono">BPM</span>
      </div>

      {/* Help */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="w-7 h-7 flex items-center justify-center hover:bg-gray-700 rounded ml-2"
        title="Keyboard Shortcuts"
      >
        <Settings size={16} />
      </button>

      {/* Help Panel */}
      {showHelp && (
        <div className="absolute top-full right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg p-4 w-80 max-h-96 overflow-y-auto z-50">
          <div className="text-white text-sm">
            <h3 className="font-bold mb-3 text-lg">Keyboard Shortcuts</h3>
            
            <div className="space-y-2">
              <div>
                <strong className="text-blue-400">Editing</strong>
                <div className="text-gray-300 text-xs ml-2 space-y-1">
                  <div>Ctrl+X (Cmd+X) - Cut</div>
                  <div>Ctrl+C (Cmd+C) - Copy</div>
                  <div>Ctrl+V (Cmd+V) - Paste</div>
                  <div>Ctrl+D (Cmd+D) - Duplicate</div>
                  <div>Ctrl+E (Cmd+E) - Split at Playhead</div>
                  <div>Delete - Delete Selection</div>
                </div>
              </div>

              <div>
                <strong className="text-blue-400">Selection</strong>
                <div className="text-gray-300 text-xs ml-2 space-y-1">
                  <div>Ctrl+A (Cmd+A) - Select All</div>
                  <div>Click + Drag - Lasso Selection</div>
                </div>
              </div>

              <div>
                <strong className="text-blue-400">View</strong>
                <div className="text-gray-300 text-xs ml-2 space-y-1">
                  <div>Ctrl+Scroll (Cmd+Scroll) - Zoom</div>
                  <div>Space - Play/Pause</div>
                </div>
              </div>

              <div>
                <strong className="text-blue-400">Advanced</strong>
                <div className="text-gray-300 text-xs ml-2 space-y-1">
                  <div>Ctrl+Drag - Duplicate & Drag</div>
                  <div>Alt+Drag - Bypass Snapping</div>
                  <div>M or 0 - Mute Selection</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DAWEditorToolbar;
