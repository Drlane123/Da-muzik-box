'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

import type { TouchInputMode } from '@/app/lib/touch/touchDevice';
import type { AudioLatencyHint, AudioSampleRateSetting } from '@/app/lib/audioDeviceInfo';
import type { MidiPortRoutingMap } from '@/app/lib/midi/midiDevices';
import type { UiScaleMode } from '@/app/lib/uiScale';
import { clampUiScale } from '@/app/lib/uiScale';
import {
  clampUiBrightness,
  UI_BRIGHTNESS_DEFAULT,
} from '@/app/lib/uiBrightness';

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
  /**
   * Whole-app display size for laptops / smaller windows.
   * `auto` — fit to window vs ~1440×900 reference; `manual` — use `uiScale`.
   */
  uiScaleMode: UiScaleMode;
  /** Manual scale 0.28–1.00 (28%–100%). Ignored when `uiScaleMode` is `auto`. */
  uiScale: number;
  /**
   * Soft UI brighten / darken (1.0 = current lightened chrome).
   * Range ~0.75–1.35 — does not replace Theme.
   */
  uiBrightness: number;
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
  uiScaleMode: 'auto',
  uiScale: 0.85,
  uiBrightness: UI_BRIGHTNESS_DEFAULT,
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
        const merged: Settings = { ...DEFAULT_SETTINGS, ...parsed };
        merged.uiScale = clampUiScale(
          typeof parsed.uiScale === 'number' ? parsed.uiScale : DEFAULT_SETTINGS.uiScale,
        );
        if (parsed.uiScaleMode !== 'auto' && parsed.uiScaleMode !== 'manual') {
          merged.uiScaleMode = DEFAULT_SETTINGS.uiScaleMode;
        }
        merged.uiBrightness = clampUiBrightness(
          typeof parsed.uiBrightness === 'number'
            ? parsed.uiBrightness
            : DEFAULT_SETTINGS.uiBrightness,
        );
        setSettings(merged);
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