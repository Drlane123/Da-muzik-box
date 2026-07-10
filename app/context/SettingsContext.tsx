'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

import type { TouchInputMode } from '@/app/lib/touch/touchDevice';
import type { AudioLatencyHint, AudioSampleRateSetting } from '@/app/lib/audioDeviceInfo';
import type { MidiPortRoutingMap } from '@/app/lib/midi/midiDevices';

export interface Settings {
  masterVolume: number;
  theme: 'light' | 'dark';
  gridSnapSize: 16 | 32 | 64 | 128;
  autoSave: boolean;
  keyboardShortcutsEnabled: boolean;
  audioLatency: number;
  audioInput: string;
  audioOutput: string;
  /** Preferred engine sample rate — `'device'` uses the browser default. */
  audioSampleRate: AudioSampleRateSetting;
  /** Maps to AudioContext `latencyHint` (closest browser equivalent to DAW block size). */
  audioLatencyHint: AudioLatencyHint;
  /** Listen to Web MIDI inputs (USB keyboards, audio interface MIDI). */
  midiInputEnabled: boolean;
  /** `'all'` or a `MIDIInput.id` from the browser. Legacy fallback when `midiPortRouting` has no entry. */
  midiInputDeviceId: string;
  /** Per-port Receive / Send toggles (Studio One–style External Devices). */
  midiPortRouting: MidiPortRoutingMap;
  /**
   * Touchscreen / stylus optimizations (larger taps, pointer→mouse bridge for grids and faders).
   * `auto` — on when this device has touch; `on` — always; `off` — never.
   */
  touchInput: TouchInputMode;
}

const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  theme: 'dark',
  gridSnapSize: 16,
  autoSave: true,
  keyboardShortcutsEnabled: true,
  audioLatency: 0,
  audioInput: 'default',
  audioOutput: 'default',
  audioSampleRate: 'device',
  audioLatencyHint: 'interactive',
  midiInputEnabled: false,
  midiInputDeviceId: 'all',
  midiPortRouting: {},
  touchInput: 'auto',
};

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('da-music-box-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<Settings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
    setMounted(true);
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('da-music-box-settings', JSON.stringify(settings));
    }
  }, [settings, mounted]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('da-music-box-settings');
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}