'use client';

import { useEffect, useRef } from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div
        ref={modalRef}
        className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 my-8 border border-gray-700"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Help & Documentation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 max-h-96 overflow-y-auto">
          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-lg font-semibold text-blue-400 mb-3">
              ⌨️ Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-300">
                <span className="font-mono bg-gray-800 px-2 py-1 rounded">SPACE</span> Play/Pause
              </div>
              <div className="text-gray-300">
                <span className="font-mono bg-gray-800 px-2 py-1 rounded">S</span> Stop
              </div>
              <div className="text-gray-300">
                <span className="font-mono bg-gray-800 px-2 py-1 rounded">Ctrl+Z</span> Undo
              </div>
              <div className="text-gray-300">
                <span className="font-mono bg-gray-800 px-2 py-1 rounded">Ctrl+Shift+Z</span> Redo
              </div>
              <div className="text-gray-300">
                <span className="font-mono bg-gray-800 px-2 py-1 rounded">Ctrl+S</span> Save
              </div>
              <div className="text-gray-300">
                <span className="font-mono bg-gray-800 px-2 py-1 rounded">R</span> Record
              </div>
              <div className="text-gray-300">
                <span className="font-mono bg-gray-800 px-2 py-1 rounded">Delete</span> Delete Selected
              </div>
              <div className="text-gray-300">
                <span className="font-mono bg-gray-800 px-2 py-1 rounded">Ctrl+,</span> Settings
              </div>
            </div>
          </section>

          {/* Modules */}
          <section>
            <h3 className="text-lg font-semibold text-blue-400 mb-3">
              🎛️ All 10 Modules
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><strong>AI Vocal Lab:</strong> Upload and process vocal tracks with AI enhancement</li>
              <li><strong>AI Song Generator:</strong> Rebuild in progress — placeholder screen for now</li>
              <li><strong>AI Pattern Generator:</strong> Create drum patterns and loops with AI</li>
              <li><strong>Melody-to-MIDI:</strong> Record melodies and convert to MIDI</li>
              <li><strong>Creation Station:</strong> 16 pads, piano roll, 8 kits, mixer with tracks 1-17</li>
              <li><strong>Studio Editor:</strong> Multi-track editing and management</li>
              <li><strong>Mastering Bay:</strong> Bass X → DMB Match → Master X1 · optional De-Noise from the top bar (before or after Master)</li>
              <li><strong>Piano Roll:</strong> Precise MIDI note editing</li>
              <li><strong>My Projects:</strong> Create, manage, and organize your projects</li>
              <li><strong>Export & Playback:</strong> Export audio and test your mixes</li>
            </ul>
          </section>

          {/* Track Allocation */}
          <section>
            <h3 className="text-lg font-semibold text-blue-400 mb-3">
              🎚️ Track Allocation System
            </h3>
            <p className="text-sm text-gray-300 mb-2">
              Da Music Box uses a DAW-style track allocation system:
            </p>
            <ul className="space-y-1 text-sm text-gray-300 ml-4">
              <li>✓ <strong>Tracks 1-17:</strong> Reserved exclusively for Creation Station</li>
              <li>✓ <strong>Tracks 18+:</strong> Available for all other modules</li>
              <li>✓ <strong>Exclusive:</strong> Once a track is selected, it cannot be used by other modules</li>
              <li>✓ <strong>Mixing:</strong> Route each sound to its own track for independent mixing</li>
            </ul>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-lg font-semibold text-blue-400 mb-3">
              💡 Pro Tips
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Disable keyboard shortcuts in Settings if they conflict with typing</li>
              <li>• Enable Auto Save to automatically save your projects every 30 seconds</li>
              <li>• Use Grid Snap to keep notes aligned with the beat</li>
              <li>• Adjust Master Volume to prevent clipping</li>
              <li>• Use Undo/Redo frequently - you have up to 50 steps!</li>
            </ul>
          </section>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400">
          Press ESC to close • Press H or ? for help
        </div>
      </div>
    </div>
  );
}