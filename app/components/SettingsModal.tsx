'use client';

import { useSettings } from '@/app/context/SettingsContext';
import { useEffect, useState, useCallback, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import {
  enumerateAudioDevices,
  getAudioOutputSupport,
} from '@/app/lib/audioRouting';
import {
  AUDIO_LATENCY_HINT_OPTIONS,
  AUDIO_SAMPLE_RATE_OPTIONS,
  formatHz,
  formatMs,
  probeInputLatencyMs,
  readAudioDeviceStats,
  type AudioDeviceStats,
  type AudioLatencyHint,
  type AudioSampleRateSetting,
} from '@/app/lib/audioDeviceInfo';
import { useMasterClock } from '@/app/context/MasterClockContext';
import {
  listMidiExternalPorts,
  portStatusLabel,
  requestMidiAccess,
  resolvePortRouting,
  type MidiExternalPort,
  type MidiPortRouting,
} from '@/app/lib/midi/midiDevices';
import { isTouchLikeDevice } from '@/app/lib/touch/touchDevice';
import type { TouchInputMode } from '@/app/lib/touch/touchDevice';

const CYAN = '#00E5FF';
const PANEL_BG = '#0a0a10';
const SECTION_BG = '#0d0d14';
const BORDER = 'rgba(0, 229, 255, 0.28)';
const LABEL = '#c8c8d4';
const MUTED = '#8a8a98';
const INPUT_BG = '#12121a';
const INPUT_BORDER = '#2a2a36';

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: INPUT_BG,
  color: '#e8e8f0',
  borderRadius: 6,
  border: `1px solid ${INPUT_BORDER}`,
  fontSize: 12,
  outline: 'none',
  cursor: 'pointer',
};

const sectionBtnStyle = (open: boolean): CSSProperties => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  background: open ? 'rgba(0, 229, 255, 0.08)' : SECTION_BG,
  border: 'none',
  borderBottom: `1px solid ${open ? 'rgba(0, 229, 255, 0.15)' : '#1a1a24'}`,
  color: open ? CYAN : LABEL,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textAlign: 'left',
  cursor: 'pointer',
});

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SectionId = 'general' | 'touch' | 'audio' | 'external';

function SettingsSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid #16161e' }}>
      <button type="button" onClick={() => onToggle(id)} style={sectionBtnStyle(open)}>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
            color: open ? CYAN : MUTED,
          }}
        />
        <span>{title}</span>
      </button>
      {open && (
        <div style={{ padding: '12px 14px 14px', background: '#08080c' }}>
          {children}
        </div>
      )}
    </div>
  );
}

const statCell: CSSProperties = {
  padding: '8px 10px',
  background: INPUT_BG,
  border: `1px solid ${INPUT_BORDER}`,
  borderRadius: 6,
};

const statLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.5,
  color: MUTED,
  marginBottom: 4,
  textTransform: 'uppercase',
};

const statValue: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#e8e8f0',
  fontVariantNumeric: 'tabular-nums',
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { getOrCreateAudioContext } = useMasterClock();
  const [audioInputs, setAudioInputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioRoutingNote, setAudioRoutingNote] = useState<string | null>(null);
  const [audioStats, setAudioStats] = useState<AudioDeviceStats | null>(null);
  const [midiExternalPorts, setMidiExternalPorts] = useState<MidiExternalPort[]>([]);
  const [midiWebMidiError, setMidiWebMidiError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    general: true,
    touch: false,
    audio: true,
    external: true,
  });

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

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

  const refreshAudioStats = useCallback(async () => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'closed') return;
      const base = readAudioDeviceStats(ctx, settings.audioLatencyHint);
      const inputMs = await probeInputLatencyMs(settings.audioInput);
      setAudioStats({ ...base, inputLatencyMs: inputMs });
    } catch (e) {
      console.warn('[Settings] audio stats:', e);
    }
  }, [getOrCreateAudioContext, settings.audioInput, settings.audioLatencyHint]);

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
    if (!isOpen || !openSections.audio) return;
    void refreshAudioStats();
    const id = window.setInterval(() => void refreshAudioStats(), 1500);
    return () => window.clearInterval(id);
  }, [
    isOpen,
    openSections.audio,
    refreshAudioStats,
    settings.audioOutput,
    settings.audioSampleRate,
    settings.audioLatencyHint,
  ]);

  const refreshMidiDevices = useCallback(async () => {
    setMidiWebMidiError(null);
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setMidiExternalPorts([]);
      setMidiWebMidiError(
        'Web MIDI API not available in this browser. Try Chrome or Edge for hardware MIDI.',
      );
      return null;
    }
    const access = await requestMidiAccess();
    if (!access) {
      setMidiExternalPorts([]);
      setMidiWebMidiError(
        'MIDI access was blocked or failed. Use a supported browser and allow the prompt if shown.',
      );
      return null;
    }
    setMidiExternalPorts(listMidiExternalPorts(access));
    return access;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let access: MIDIAccess | null = null;
    let cancelled = false;
    void refreshMidiDevices().then((a) => {
      if (cancelled || !a) return;
      access = a;
      const onChange = () => setMidiExternalPorts(listMidiExternalPorts(a));
      a.onstatechange = onChange;
    });
    return () => {
      cancelled = true;
      if (access) access.onstatechange = null;
    };
  }, [isOpen, refreshMidiDevices]);

  const setPortRouting = useCallback(
    (portId: string, patch: Partial<MidiPortRouting>) => {
      const prev = settings.midiPortRouting[portId] ?? { receive: false, send: false };
      updateSetting('midiPortRouting', {
        ...settings.midiPortRouting,
        [portId]: { ...prev, ...patch },
      });
    },
    [settings.midiPortRouting, updateSetting],
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const fieldLabel: CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: LABEL,
    marginBottom: 6,
  };

  const hint: CSSProperties = {
    fontSize: 10,
    color: MUTED,
    lineHeight: 1.45,
    marginTop: 6,
  };

  const rowBetween: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  };

  return createPortal(
    <div
      role="dialog"
      aria-label="Settings"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10090,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(520px, 96vw)',
          maxHeight: 'min(640px, 90vh)',
          display: 'flex',
          flexDirection: 'column',
          background: PANEL_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          boxShadow: '0 20px 48px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          color: '#e8e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid #1e1e28',
            flexShrink: 0,
            background: '#08080c',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: CYAN, letterSpacing: 0.6 }}>
            SETTINGS
          </span>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: 5,
              border: '1px solid #2a2a32',
              background: INPUT_BG,
              color: MUTED,
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: '1 1 auto' }}>
          <SettingsSection
            id="general"
            title="GENERAL"
            open={openSections.general}
            onToggle={toggleSection}
          >
            <label style={fieldLabel}>
              Master volume — {Math.round(settings.masterVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.masterVolume}
              onChange={(e) => updateSetting('masterVolume', parseFloat(e.target.value))}
              style={{ width: '100%', marginBottom: 14, accentColor: CYAN }}
            />

            <label style={fieldLabel}>Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value as 'light' | 'dark')}
              style={{ ...selectStyle, marginBottom: 14 }}
            >
              <option value="dark" style={{ background: INPUT_BG, color: '#e8e8f0' }}>Dark</option>
              <option value="light" style={{ background: INPUT_BG, color: '#e8e8f0' }}>Light</option>
            </select>

            <label style={fieldLabel}>Grid snap size</label>
            <select
              value={settings.gridSnapSize}
              onChange={(e) =>
                updateSetting('gridSnapSize', parseInt(e.target.value) as 16 | 32 | 64 | 128)
              }
              style={{ ...selectStyle, marginBottom: 14 }}
            >
              <option value={16} style={{ background: INPUT_BG, color: '#e8e8f0' }}>16 (fine)</option>
              <option value={32} style={{ background: INPUT_BG, color: '#e8e8f0' }}>32 (medium)</option>
              <option value={64} style={{ background: INPUT_BG, color: '#e8e8f0' }}>64 (coarse)</option>
              <option value={128} style={{ background: INPUT_BG, color: '#e8e8f0' }}>128 (very coarse)</option>
            </select>

            <div style={rowBetween}>
              <span style={{ fontSize: 11, fontWeight: 700, color: LABEL }}>Auto save</span>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => updateSetting('autoSave', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: CYAN, cursor: 'pointer' }}
              />
            </div>
            <div style={{ ...rowBetween, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: LABEL }}>Keyboard shortcuts</span>
              <input
                type="checkbox"
                checked={settings.keyboardShortcutsEnabled}
                onChange={(e) => updateSetting('keyboardShortcutsEnabled', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: CYAN, cursor: 'pointer' }}
              />
            </div>
            <p style={{ ...hint, marginTop: 0, marginBottom: 0 }}>
              Space play/pause · S stop (Beat Lab / Studio 2) · Ctrl+S save · Ctrl+, settings · Beat Lab: P/B/D tools,
              Ctrl+Z undo, 1–8 banks
            </p>
          </SettingsSection>

          <SettingsSection
            id="touch"
            title="TOUCH MODE"
            open={openSections.touch}
            onToggle={toggleSection}
          >
            <p style={{ ...hint, marginTop: 0, marginBottom: 10 }}>
              Optimizes Beat Lab grids, faders, transport, and piano rolls for finger or stylus input.
            </p>
            <label style={fieldLabel}>Touch optimizations</label>
            <select
              value={settings.touchInput}
              onChange={(e) => updateSetting('touchInput', e.target.value as TouchInputMode)}
              style={selectStyle}
            >
              <option value="auto" style={{ background: INPUT_BG, color: '#e8e8f0' }}>Auto — on when this PC has touch</option>
              <option value="on" style={{ background: INPUT_BG, color: '#e8e8f0' }}>Always on</option>
              <option value="off" style={{ background: INPUT_BG, color: '#e8e8f0' }}>Off — mouse / trackpad only</option>
            </select>
            <p style={hint}>
              {settings.touchInput === 'auto'
                ? isTouchLikeDevice()
                  ? 'Touch hardware detected — optimizations are active.'
                  : 'No touch hardware detected — standard mouse UI until you choose Always on.'
                : settings.touchInput === 'on'
                  ? 'Touch mode is forced on.'
                  : 'Touch mode is off.'}
            </p>
          </SettingsSection>

          <SettingsSection
            id="audio"
            title="AUDIO DEVICES"
            open={openSections.audio}
            onToggle={toggleSection}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 10, color: MUTED }}>
                Web Audio engine ·{' '}
                {getAudioOutputSupport() === 'setSinkId' ? 'output routing supported' : 'system output only'}
              </span>
              <button
                type="button"
                onClick={() => {
                  void refreshDevices(true);
                  void refreshAudioStats();
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  border: `1px solid ${INPUT_BORDER}`,
                  background: INPUT_BG,
                  color: CYAN,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Refresh
              </button>
            </div>
            {audioRoutingNote && (
              <p style={{ fontSize: 10, color: '#fbbf24', marginBottom: 10 }}>{audioRoutingNote}</p>
            )}

            <label style={fieldLabel}>Playback device (output)</label>
            <select
              value={settings.audioOutput}
              onChange={(e) => updateSetting('audioOutput', e.target.value)}
              disabled={getAudioOutputSupport() === 'none'}
              style={{
                ...selectStyle,
                marginBottom: 14,
                opacity: getAudioOutputSupport() === 'none' ? 0.5 : 1,
              }}
            >
              <option value="default" style={{ background: INPUT_BG, color: '#e8e8f0' }}>
                System default output
              </option>
              {audioOutputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId} style={{ background: INPUT_BG, color: '#e8e8f0' }}>
                  {d.label}
                </option>
              ))}
            </select>

            <label style={fieldLabel}>Recording device (input)</label>
            <select
              value={settings.audioInput}
              onChange={(e) => updateSetting('audioInput', e.target.value)}
              style={{ ...selectStyle, marginBottom: 14 }}
            >
              <option value="default" style={{ background: INPUT_BG, color: '#e8e8f0' }}>
                System default input
              </option>
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId} style={{ background: INPUT_BG, color: '#e8e8f0' }}>
                  {d.label}
                </option>
              ))}
            </select>

            <label style={fieldLabel}>Sample rate</label>
            <select
              value={String(settings.audioSampleRate)}
              onChange={(e) => {
                const raw = e.target.value;
                const next: AudioSampleRateSetting =
                  raw === 'device' ? 'device' : (parseInt(raw, 10) as AudioSampleRateSetting);
                updateSetting('audioSampleRate', next);
              }}
              style={{ ...selectStyle, marginBottom: 14 }}
            >
              {AUDIO_SAMPLE_RATE_OPTIONS.map((opt) => (
                <option
                  key={String(opt.value)}
                  value={String(opt.value)}
                  style={{ background: INPUT_BG, color: '#e8e8f0' }}
                >
                  {opt.label}
                </option>
              ))}
            </select>

            <label style={fieldLabel}>Device block size (buffer)</label>
            <select
              value={settings.audioLatencyHint}
              onChange={(e) => updateSetting('audioLatencyHint', e.target.value as AudioLatencyHint)}
              style={{ ...selectStyle, marginBottom: 6 }}
            >
              {AUDIO_LATENCY_HINT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ background: INPUT_BG, color: '#e8e8f0' }}>
                  {opt.label} — {opt.guide}
                </option>
              ))}
            </select>
            <p style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
              Browsers map block size to a latency profile — actual buffer size is reported below after the engine
              restarts.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <div style={statCell}>
                <div style={statLabel}>Sample rate</div>
                <div style={statValue}>
                  {audioStats ? formatHz(audioStats.sampleRate) : '—'}
                </div>
              </div>
              <div style={statCell}>
                <div style={statLabel}>Block size</div>
                <div style={statValue}>
                  {audioStats ? `${audioStats.estimatedBlockSize} samples` : '—'}
                </div>
              </div>
              <div style={statCell}>
                <div style={statLabel}>Output latency</div>
                <div style={statValue}>
                  {audioStats ? formatMs(audioStats.totalOutputLatencyMs) : '—'}
                </div>
              </div>
              <div style={statCell}>
                <div style={statLabel}>Input latency</div>
                <div style={statValue}>
                  {audioStats?.inputLatencyMs != null
                    ? formatMs(audioStats.inputLatencyMs)
                    : 'Not reported'}
                </div>
              </div>
            </div>

            {audioStats && (
              <p style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
                Engine: {audioStats.contextState} · base {formatMs(audioStats.baseLatencyMs)} + device{' '}
                {formatMs(audioStats.outputLatencyMs)}
              </p>
            )}

            <label style={fieldLabel}>
              Manual latency compensation — {settings.audioLatency} ms
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.audioLatency}
              onChange={(e) => updateSetting('audioLatency', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: CYAN }}
            />
            <p style={{ ...hint, marginTop: 6, marginBottom: 0 }}>
              Nudges metronome / playhead when your interface adds extra delay beyond what the browser reports.
            </p>
          </SettingsSection>

          <SettingsSection
            id="external"
            title="EXTERNAL DEVICES"
            open={openSections.external}
            onToggle={toggleSection}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 10, color: MUTED }}>
                USB MIDI keyboards, interfaces, drum pads, and virtual ports (loopMIDI / IAC)
              </span>
              <button
                type="button"
                onClick={() => void refreshMidiDevices()}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  border: `1px solid ${INPUT_BORDER}`,
                  background: INPUT_BG,
                  color: CYAN,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Refresh
              </button>
            </div>
            {midiWebMidiError && (
              <p style={{ fontSize: 10, color: '#fbbf24', marginBottom: 10 }}>{midiWebMidiError}</p>
            )}
            <div style={rowBetween}>
              <label htmlFor="midi-input-enabled" style={{ fontSize: 11, fontWeight: 700, color: LABEL }}>
                Enable MIDI input (receive)
              </label>
              <input
                id="midi-input-enabled"
                type="checkbox"
                checked={settings.midiInputEnabled}
                onChange={(e) => updateSetting('midiInputEnabled', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: CYAN, cursor: 'pointer' }}
              />
            </div>
            <p style={{ ...hint, marginTop: 0, marginBottom: 10 }}>
              Receive routes hardware notes to the active module (Beat Lab, Groove Lab, 808 Lab, etc.). Send
              routes transport MIDI clock and module MIDI out to external sound modules and synths.
            </p>

            {midiExternalPorts.length === 0 && !midiWebMidiError ? (
              <div
                style={{
                  ...statCell,
                  marginBottom: 10,
                  textAlign: 'center',
                  color: MUTED,
                  fontSize: 11,
                }}
              >
                No external MIDI devices detected. Plug in a device and tap Refresh.
              </div>
            ) : (
              <div
                style={{
                  border: `1px solid ${INPUT_BORDER}`,
                  borderRadius: 6,
                  overflow: 'hidden',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 52px 72px 52px 52px',
                    gap: 6,
                    padding: '6px 8px',
                    background: '#0d0d14',
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    color: MUTED,
                    textTransform: 'uppercase',
                  }}
                >
                  <span>Device</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span style={{ textAlign: 'center' }}>Recv</span>
                  <span style={{ textAlign: 'center' }}>Send</span>
                </div>
                {midiExternalPorts.map((port) => {
                  const routing = resolvePortRouting(
                    port,
                    settings.midiPortRouting,
                    settings.midiInputEnabled,
                    settings.midiInputDeviceId,
                  );
                  const connected = port.state === 'connected';
                  return (
                    <div
                      key={`${port.direction}:${port.id}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 52px 72px 52px 52px',
                        gap: 6,
                        alignItems: 'center',
                        padding: '8px',
                        borderTop: `1px solid ${INPUT_BORDER}`,
                        background: connected ? '#08080c' : 'rgba(20,20,28,0.85)',
                        opacity: connected ? 1 : 0.55,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#e8e8f0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={port.name}
                        >
                          {port.name}
                        </div>
                        <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>{port.manufacturer}</div>
                      </div>
                      <span style={{ fontSize: 10, color: LABEL }}>
                        {port.direction === 'input' ? 'In' : 'Out'}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: connected ? '#86efac' : '#f87171',
                        }}
                      >
                        {portStatusLabel(port.state)}
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {port.direction === 'input' ? (
                          <input
                            type="checkbox"
                            checked={routing.receive}
                            disabled={!settings.midiInputEnabled || !!midiWebMidiError}
                            onChange={(e) => setPortRouting(port.id, { receive: e.target.checked })}
                            title="Receive MIDI from this device"
                            style={{ width: 15, height: 15, accentColor: CYAN, cursor: 'pointer' }}
                          />
                        ) : (
                          <span style={{ fontSize: 10, color: MUTED }}>—</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {port.direction === 'output' ? (
                          <input
                            type="checkbox"
                            checked={routing.send}
                            disabled={!!midiWebMidiError}
                            onChange={(e) => setPortRouting(port.id, { send: e.target.checked })}
                            title="Send MIDI to this device (clock, Chord Builder out, etc.)"
                            style={{ width: 15, height: 15, accentColor: CYAN, cursor: 'pointer' }}
                          />
                        ) : (
                          <span style={{ fontSize: 10, color: MUTED }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ ...hint, marginTop: 0, marginBottom: 0 }}>
              Tip: on Windows use loopMIDI for virtual ports; on macOS enable IAC Driver in Audio MIDI Setup.
            </p>
          </SettingsSection>

        </div>

        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid #1e1e28',
            flexShrink: 0,
            background: '#08080c',
          }}
        >
          <button
            type="button"
            onClick={() => {
              resetSettings();
              onClose();
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 6,
              border: '1px solid rgba(239, 68, 68, 0.45)',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            Reset to defaults
          </button>
          <p style={{ fontSize: 9, color: MUTED, textAlign: 'center', margin: 0 }}>
            ESC to close · Ctrl+, to open
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
