import React, { useState } from 'react';
import { Play, Square, Mic, Settings, Clock } from 'lucide-react';

interface TransportBarProps {
  isPlaying: boolean;
  isRecording: boolean;
  currentTime: number;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  tempo: number;
  onTempoChange: (tempo: number) => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  isRecording,
  currentTime,
  onPlay,
  onStop,
  onRecord,
  tempo,
  onTempoChange,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const minutes = Math.floor(currentTime / 60);
  const seconds = Math.floor(currentTime % 60);
  const milliseconds = Math.floor((currentTime % 1) * 100);

  return (
    <div className="bg-gray-900 border-t border-gray-700 h-16 px-4 py-2 flex items-center justify-between">
      
      {/* Left: Transport Controls */}
      <div className="flex items-center gap-3">
        {/* Stop Button */}
        <button
          onClick={onStop}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-200 hover:text-white transition-colors"
          title="Stop (S)"
        >
          <Square size={20} fill="currentColor" />
        </button>

        {/* Play Button */}
        <button
          onClick={onPlay}
          className={`p-2 rounded transition-colors ${
            isPlaying
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
          }`}
          title="Play (Space)"
        >
          <Play size={20} fill="currentColor" />
        </button>

        {/* Record Button */}
        <button
          onClick={onRecord}
          className={`p-2 rounded transition-colors ${
            isRecording
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
          }`}
          title="Record (R)"
        >
          <Mic size={20} />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-700" />

        {/* Time Display */}
        <div className="font-mono text-sm text-gray-300 min-w-20">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}.
          {String(milliseconds).padStart(2, '0')}
        </div>
      </div>

      {/* Center: Tempo Control */}
      <div className="flex items-center gap-2">
        <Clock size={18} className="text-gray-400" />
        <input
          type="number"
          min="40"
          max="300"
          value={tempo}
          onChange={(e) => onTempoChange(parseInt(e.target.value))}
          className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded focus:outline-none focus:border-blue-500"
          title="Tempo (BPM)"
        />
        <span className="text-gray-500 text-sm">BPM</span>
      </div>

      {/* Right: Settings & Indicators */}
      <div className="flex items-center gap-2 relative">
        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            <span className="text-xs text-red-600 font-semibold">REC</span>
          </div>
        )}

        {/* Playing Indicator */}
        {isPlaying && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
            <span className="text-xs text-green-600 font-semibold">PLAYING</span>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-200 hover:text-white transition-colors"
          title="Recording Settings"
        >
          <Settings size={18} />
        </button>

        {/* Settings Dropdown */}
        {showSettings && (
          <div className="absolute bottom-full right-0 mb-2 bg-gray-800 border border-gray-700 rounded shadow-lg p-4 min-w-64 text-sm z-50">
            <h3 className="text-white font-semibold mb-3">Recording Settings</h3>

            <div className="space-y-3">
              {/* Pre-Roll */}
              <div>
                <label className="block text-gray-300 mb-1">Pre-Roll (bars)</label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  defaultValue="2"
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Count-In */}
              <div>
                <label className="block text-gray-300 mb-1">Count-In</label>
                <select className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded focus:outline-none focus:border-blue-500">
                  <option>None</option>
                  <option>1 bar</option>
                  <option>2 bars</option>
                </select>
              </div>

              {/* Buffer Size */}
              <div>
                <label className="block text-gray-300 mb-1">Buffer Size</label>
                <select className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded focus:outline-none focus:border-blue-500">
                  <option>256 samples (5.8ms) - Ultra Low</option>
                  <option>512 samples (11.6ms) - Low</option>
                  <option>1024 samples (23.2ms) - Balanced</option>
                  <option>2048 samples (46.4ms) - Stable</option>
                </select>
              </div>

              {/* Punch In/Out */}
              <div className="border-t border-gray-700 pt-3">
                <label className="flex items-center gap-2 text-gray-300 mb-2">
                  <input type="checkbox" className="w-4 h-4" />
                  <span>Enable Punch In/Out</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Bar</label>
                    <input
                      type="number"
                      min="1"
                      defaultValue="1"
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Bar</label>
                    <input
                      type="number"
                      min="1"
                      defaultValue="8"
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 text-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
