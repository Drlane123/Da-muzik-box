'use client';

import { useSettings } from '@/app/context/SettingsContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  enumerateAudioDevices,
  getAudioOutputSupport,
} from '@/app/lib/audioRouting';
import { isTouchLikeDevice } from '@/app/lib/touch/touchDevice';
import type { TouchInputMode } from '@/app/lib/touch/touchDevice';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const modalRef = useRef<HTMLDivElement>(null);
  const [audioInputs, setAudioInputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioRoutingNote, setAudioRoutingNote] = useState<string | null>(null);
  const [midiInputPorts, setMidiInputPorts] = useState<{ id: string; label: string }[]>([]);
  const [midiWebMidiError, setMidiWebMidiError] = useState<string | null>(null);

  const refreshDevices = useCallback(async (requestMicPermission: boolean) => {
    setAudioRoutingNote(null);
    try {
      if (requestMicPermission && navigator.mediaDevices?.getUserMedia) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      }
      const { inputs, outputs } = await enumerateAudioDevices();
      setAudioInputs(inputs.map((d) => ({ deviceId: d.deviceId, label: d.label })));
      setAudioOutputs(outputs.map((d) => ({ deviceId: d.deviceId, label: d.label })));
    } catch (e) {
      console.warn('[Settings] enumerate devices:', e);
      setAudioRoutingNote(
        'Could not access device list. Grant microphone permission when prompted, then refresh.',
      );
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void refreshDevices(false);
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onDeviceChange = () => void refreshDevices(false);
    md.addEventListener('devicechange', onDeviceChange);
    return () => md.removeEventListener('devicechange', onDeviceChange);
  }, [isOpen, refreshDevices]);

  useEffect(() => {
    if (!isOpen) return;
    setMidiWebMidiError(null);
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setMidiInputPorts([]);
      setMidiWebMidiError(
        'Web MIDI API not available in this browser. Try Chrome or Edge for hardware MIDI.',
      );
      return;
    }
    let access: MIDIAccess | null = null;
    navigator
      .requestMIDIAccess({ sysex: false })
      .then((a) => {
        access = a;
        const list = () =>
          [...a.inputs.values()].map((p) => ({
            id: p.id,
            label: p.name?.trim() ? p.name : p.id || 'MIDI input',
          }));
        setMidiInputPorts(list());
        a.onstatechange = () => setMidiInputPorts(list());
      })
      .catch(() => {
        setMidiInputPorts([]);
        setMidiWebMidiError(
          'MIDI access was blocked or failed. Use a supported browser and allow the prompt if shown.',
        );
      });
    return () => {
      if (access) access.onstatechange = null;
    };
  }, [isOpen]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-gray-900 rounded-lg p-6 max-w-lg w-full mx-4 border border-gray-700 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Master Volume */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Master Volume: {Math.round(settings.masterVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.masterVolume}
              onChange={(e) =>
                updateSetting('masterVolume', parseFloat(e.target.value))
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Theme
            </label>
            <select
              value={settings.theme}
              onChange={(e) =>
                updateSetting('theme', e.target.value as 'light' | 'dark')
              }
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          {/* Grid Snap Size */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Grid Snap Size
            </label>
            <select
              value={settings.gridSnapSize}
              onChange={(e) =>
                updateSetting('gridSnapSize', parseInt(e.target.value) as any)
              }
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
            >
              <option value={16}>16 (Fine)</option>
              <option value={32}>32 (Medium)</option>
              <option value={64}>64 (Coarse)</option>
              <option value={128}>128 (Very Coarse)</option>
            </select>
          </div>

          {/* Auto Save */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">Auto Save</label>
            <input
              type="checkbox"
              checked={settings.autoSave}
              onChange={(e) => updateSetting('autoSave', e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Keyboard Shortcuts */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              Keyboard Shortcuts
            </label>
            <input
              type="checkbox"
              checked={settings.keyboardShortcutsEnabled}
              onChange={(e) =>
                updateSetting('keyboardShortcutsEnabled', e.target.checked)
              }
              className="w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Touch input */}
          <div className="border border-gray-700 rounded-lg p-3 space-y-3">
            <span className="text-sm font-semibold text-gray-200">Touch mode</span>
            <p className="text-xs text-gray-500">
              Optimizes the app for touchscreens and stylus (Beat Lab grid paint, faders, transport,
              piano rolls). Uses a pointer bridge so existing controls work with your finger or pen.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Touch optimizations</label>
              <select
                value={settings.touchInput}
                onChange={(e) =>
                  updateSetting('touchInput', e.target.value as TouchInputMode)
                }
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
              >
                <option value="auto">Auto — on when this PC has touch</option>
                <option value="on">Always on</option>
                <option value="off">Off — mouse / trackpad only</option>
              </select>
            </div>
            <p className="text-[10px] text-gray-600">
              {settings.touchInput === 'auto'
                ? isTouchLikeDevice()
                  ? 'Touch hardware detected — optimizations are active.'
                  : 'No touch hardware detected — using standard mouse UI until you choose Always on.'
                : settings.touchInput === 'on'
                  ? 'Touch mode is forced on (useful on touch laptops or for testing).'
                  : 'Touch mode is off — grids and drags expect mouse or trackpad.'}
            </p>
          </div>

          {/* Audio I/O — browser-supported routing only */}
          <div className="border border-gray-700 rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm font-semibold text-gray-200">Audio setup / routing</span>
              <button
                type="button"
                onClick={() => void refreshDevices(true)}
                className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
              >
                Refresh devices
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Input/output device IDs are saved with your settings. Recording uses the selected input; playback uses
              the shared master bus, then the selected output when supported (
              {getAudioOutputSupport() === 'setSinkId' ? 'this browser: setSinkId' : 'this browser: system default only'}
              ).
            </p>
            {audioRoutingNote && (
              <p className="text-xs text-amber-400">{audioRoutingNote}</p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Recording input (microphone)</label>
              <select
                value={settings.audioInput}
                onChange={(e) => updateSetting('audioInput', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
              >
                <option value="default">Default system input</option>
                {audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Playback / master output</label>
              <select
                value={settings.audioOutput}
                onChange={(e) => updateSetting('audioOutput', e.target.value)}
                disabled={getAudioOutputSupport() === 'none'}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 text-sm disabled:opacity-50"
              >
                <option value="default">Default system output</option>
                {audioOutputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
              {getAudioOutputSupport() === 'none' && (
                <p className="text-xs text-gray-500 mt-1">
                  This browser does not expose output device selection; audio uses the system default.
                </p>
              )}
            </div>
          </div>

          {/* MIDI input — Web MIDI (USB interface, keyboard, audio interface DIN/USB-MIDI) */}
          <div className="border border-gray-700 rounded-lg p-3 space-y-3">
            <span className="text-sm font-semibold text-gray-200">MIDI input</span>
            <p className="text-xs text-gray-500">
              When enabled, notes from your MIDI port play through the app: melodic channels use a
              light built-in synth; channel 10 (standard drums) triggers the drum-kit sounds. Devices
              listed here are whatever the OS and browser expose (same as many DAWs).
            </p>
            {midiWebMidiError && (
              <p className="text-xs text-amber-400">{midiWebMidiError}</p>
            )}
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="midi-input-enabled" className="text-sm font-medium text-gray-300">
                Listen to MIDI input
              </label>
              <input
                id="midi-input-enabled"
                type="checkbox"
                checked={settings.midiInputEnabled}
                onChange={(e) => updateSetting('midiInputEnabled', e.target.checked)}
                className="w-4 h-4 cursor-pointer shrink-0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">MIDI port</label>
              <select
                value={settings.midiInputDeviceId}
                disabled={!settings.midiInputEnabled || !!midiWebMidiError}
                onChange={(e) => updateSetting('midiInputDeviceId', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 text-sm disabled:opacity-50"
              >
                <option value="all">All inputs (merge)</option>
                {midiInputPorts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-600 mt-1">
                Plug in a device and reopen Settings or switch away and back to refresh the list.
              </p>
            </div>
          </div>

          {/* Audio Latency */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Audio Latency Compensation: {settings.audioLatency}ms
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.audioLatency}
              onChange={(e) =>
                updateSetting('audioLatency', parseInt(e.target.value))
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              resetSettings();
              onClose();
            }}
            className="w-full mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition"
          >
            Reset to Defaults
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400">
          Press ESC to close • Ctrl+, to open settings
        </div>
      </div>
    </div>
  );
}