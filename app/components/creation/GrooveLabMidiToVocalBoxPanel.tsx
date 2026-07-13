import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

import {
  grooveRollHitsToVocalBoxNotes,
  mapLyricsToVocalBoxNotes,
  previewVocalBoxPhrase,
  VOCALBOX_DEFAULT_SETTINGS,
  vocalBoxNoteLabel,
  vocalBoxPhraseDurationSec,
  type VocalBoxInputSource,
  type VocalBoxNote,
  type VocalBoxPreviewHandle,
  type VocalBoxSettings,
} from '@/app/lib/creationStation/grooveLabVocalBoxEngine';
import { resolveGrooveLabAudioDest } from '@/app/lib/creationStation/grooveLabAudio';
import {
  classifyMicBuffer,
  createVocalBoxMicRecorder,
  getVocalBoxSessionMicClip,
  playVocalBoxRawMicClip,
  setVocalBoxSessionMicClip,
  vocalBoxMicDurationLabel,
  vocalBoxMicWaveformPeaks,
  type VocalBoxMicRecorder,
  type VocalBoxRawPlaybackHandle,
} from '@/app/lib/creationStation/grooveLabVocalBoxMic';
import {
  vocalBoxSpeakTextWithBrowserTts,
  type VocalBoxSpeechMode,
  type VocalBoxSpeechStyle,
} from '@/app/lib/creationStation/grooveLabVocalBoxSpeech';
import type { GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

const VOCAL_ACCENT = '#c084fc';
const VOCAL_ACCENT_HI = '#e9d5ff';
const VOCAL_BORDER = '#581c87';
const VIEWPORT_PAD = 6;
const PANEL_W = 288;
const PANEL_MIN_H = 380;

function computeDropdownPosition(anchor: DOMRect): { top: number; left: number } {
  const gap = 4;
  let left = anchor.left;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - PANEL_W - VIEWPORT_PAD));
  let top = anchor.bottom + gap;
  if (top + PANEL_MIN_H > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, anchor.top - gap - PANEL_MIN_H);
  }
  return { top, left };
}

export type GrooveLabMidiToVocalBoxPanelProps = {
  bpm: number;
  melodyHits: GrooveRollHit[];
  getAudioContext: () => AudioContext | Promise<AudioContext>;
};

/** Groove Lab chord strip — MIDI melody + lyrics → tempo-locked VocalBox auto-tune preview. */
export function GrooveLabMidiToVocalBoxPanel({
  bpm,
  melodyHits,
  getAudioContext,
}: GrooveLabMidiToVocalBoxPanelProps) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [notes, setNotes] = useState<VocalBoxNote[]>([]);
  const [lyrics, setLyrics] = useState('');
  const [settings, setSettings] = useState<VocalBoxSettings>({ ...VOCALBOX_DEFAULT_SETTINGS });
  const [inputSource, setInputSource] = useState<VocalBoxInputSource>('type');
  const [status, setStatus] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [micRecording, setMicRecording] = useState(false);
  const [micBuffer, setMicBuffer] = useState<AudioBuffer | null>(() => getVocalBoxSessionMicClip());
  const [micLevel, setMicLevel] = useState(0);
  const [micSec, setMicSec] = useState(0);

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<VocalBoxPreviewHandle | null>(null);
  const previewEndRef = useRef<number>(0);
  const micRecorderRef = useRef<VocalBoxMicRecorder | null>(null);
  const micStartedAtRef = useRef<number>(0);
  const micLevelSmoothRef = useRef(0);
  const micLevelRafRef = useRef(0);
  /** Source of truth — state can lag one frame after capture. */
  const micBufferRef = useRef<AudioBuffer | null>(getVocalBoxSessionMicClip());
  const rawPlayRef = useRef<VocalBoxRawPlaybackHandle | null>(null);

  const micPeaks = useMemo(
    () => (micBuffer ? vocalBoxMicWaveformPeaks(micBuffer, 52) : []),
    [micBuffer],
  );

  const storeMicClip = useCallback((buffer: AudioBuffer | null) => {
    micBufferRef.current = buffer;
    setVocalBoxSessionMicClip(buffer);
    setMicBuffer(buffer);
  }, []);

  const clearMicClip = useCallback(() => {
    rawPlayRef.current?.stop();
    rawPlayRef.current = null;
    storeMicClip(null);
    setStatus('Mic clip cleared');
  }, [storeMicClip]);

  const stopPreview = useCallback(() => {
    previewRef.current?.stop();
    previewRef.current = null;
    previewEndRef.current = 0;
    setPreviewing(false);
  }, []);

  const repositionPanel = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    setPanelPos(computeDropdownPosition(btn.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    repositionPanel();
    window.addEventListener('resize', repositionPanel);
    window.addEventListener('scroll', repositionPanel, true);
    return () => {
      window.removeEventListener('resize', repositionPanel);
      window.removeEventListener('scroll', repositionPanel, true);
    };
  }, [open, repositionPanel]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!previewing) return;
    const id = window.setInterval(() => {
      if (performance.now() >= previewEndRef.current) {
        stopPreview();
        setStatus('Preview done');
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [previewing, stopPreview]);

  useEffect(() => {
    if (!micRecording) return;
    const id = window.setInterval(() => {
      setMicSec((performance.now() - micStartedAtRef.current) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, [micRecording]);

  useEffect(() => () => {
    stopPreview();
    rawPlayRef.current?.stop();
    if (micLevelRafRef.current) cancelAnimationFrame(micLevelRafRef.current);
    micRecorderRef.current?.dispose();
    micRecorderRef.current = null;
  }, [stopPreview]);

  const applyMicCapture = useCallback((raw: AudioBuffer | null) => {
    setMicRecording(false);
    setMicLevel(0);
    setMicSec(0);
    const { buffer, error } = classifyMicBuffer(raw);
    if (buffer) {
      storeMicClip(buffer);
      setInputSource('mic');
      setStatus(`Mic clip saved · ${vocalBoxMicDurationLabel(buffer.duration)} — stays until you CLEAR`);
    } else if (error === 'silent') {
      setStatus('Mic heard nothing — check Windows input device / speak louder');
    } else if (error === 'short') {
      setStatus('Recording too short — hold MIC longer while you speak');
    } else {
      setStatus('Mic capture failed — tap MIC and try again');
    }
  }, [storeMicClip]);

  const playRawMicClip = useCallback(async () => {
    const buf = micBufferRef.current;
    if (!buf) {
      setStatus('No mic clip in box — tap 🎤 MIC first');
      return;
    }
    rawPlayRef.current?.stop();
    stopPreview();
    try {
      const ctx = await Promise.resolve(getAudioContext());
      if (ctx.state === 'suspended') await ctx.resume();
      rawPlayRef.current = playVocalBoxRawMicClip(ctx, buf, resolveGrooveLabAudioDest(ctx));
      setStatus(`Playing raw mic · ${vocalBoxMicDurationLabel(buf.duration)}`);
    } catch {
      setStatus('Could not play mic clip');
    }
  }, [getAudioContext, stopPreview]);

  const toggleMicRecord = useCallback(async () => {
    setInputSource('mic');

    if (micRecording) {
      const raw = await micRecorderRef.current?.stop();
      applyMicCapture(raw);
      return;
    }

    stopPreview();
    try {
      const ctx = await Promise.resolve(getAudioContext());
      if (ctx.state === 'suspended') await ctx.resume();
      micRecorderRef.current?.dispose();
      micRecorderRef.current = createVocalBoxMicRecorder(ctx);
      await micRecorderRef.current.start({
        onLevel: (rms) => {
          micLevelSmoothRef.current = micLevelSmoothRef.current * 0.65 + rms * 0.35;
          if (!micLevelRafRef.current) {
            micLevelRafRef.current = requestAnimationFrame(() => {
              micLevelRafRef.current = 0;
              setMicLevel(micLevelSmoothRef.current);
            });
          }
        },
        onAutoStop: (raw) => applyMicCapture(raw),
      });
      micStartedAtRef.current = performance.now();
      setMicRecording(true);
      setMicSec(0);
      setStatus('● REC — speak now, tap MIC again to stop (replaces clip when saved)');
    } catch (e) {
      setMicRecording(false);
      setMicLevel(0);
      const msg = e instanceof Error ? e.message : '';
      setStatus(
        msg.includes('not supported')
          ? 'Mic not supported in this browser'
          : 'Mic blocked — click lock icon in address bar → allow microphone',
      );
    }
  }, [applyMicCapture, getAudioContext, micRecording, stopPreview]);

  const grabMelody = useCallback(() => {
    const grabbed = grooveRollHitsToVocalBoxNotes(melodyHits);
    setNotes(grabbed);
    setStatus(
      grabbed.length > 0
        ? `Loaded ${grabbed.length} melody note${grabbed.length === 1 ? '' : 's'} from roll`
        : 'No melody notes on the roll yet',
    );
  }, [melodyHits]);

  const addManualNote = useCallback(() => {
    setNotes((prev) => {
      const last = prev[prev.length - 1];
      const slot = last ? last.slot + Math.max(4, last.sustainSlots) : 0;
      return [
        ...prev,
        { slot, sustainSlots: 16, midi: 72, vel: 0.85, syllable: '' },
      ];
    });
    setStatus('Added C5 — space syllables in lyrics to match note order');
  }, []);

  const mappedNotes = mapLyricsToVocalBoxNotes(notes, lyrics);

  const runPreview = useCallback(async () => {
    if (mappedNotes.length === 0) {
      setStatus('Grab melody or add a note first');
      return;
    }
    const clip = micBufferRef.current;
    if (!clip && inputSource === 'mic') {
      setStatus('Tap 🎤 MIC — speak, stop, then VOCALBOX');
      return;
    }
    if (clip) setInputSource('mic');
    stopPreview();
    rawPlayRef.current?.stop();
    setRendering(true);
    setStatus(
      clip
        ? 'Mic → auto-tune + vocoder on each note…'
        : 'Synthesizing speech → vocoder + auto-tune…',
    );
    try {
      const ctx = await Promise.resolve(getAudioContext());
      if (ctx.state === 'suspended') await ctx.resume();
      const handle = await previewVocalBoxPhrase(ctx, bpm, mappedNotes, settings, {
        phrase: lyrics.trim() || mappedNotes.map((n) => n.syllable || 'la').join(' '),
        micPhraseBuffer: clip ?? undefined,
      });
      previewRef.current = handle;
      const durMs = vocalBoxPhraseDurationSec(bpm, mappedNotes) * 1000;
      previewEndRef.current = performance.now() + durMs;
      setPreviewing(true);
      const srcLabel =
        handle.speechSource === 'mic'
          ? 'your mic voice'
          : handle.speechSource === 'cloud'
            ? 'computer speech'
            : 'offline speech';
      setStatus(`VocalBox @ ${Math.round(bpm)} BPM · ${mappedNotes.length} notes · ${srcLabel}`);
    } catch {
      setStatus('VocalBox failed — check mic permission or connection');
    } finally {
      setRendering(false);
    }
  }, [bpm, getAudioContext, inputSource, lyrics, mappedNotes, settings, stopPreview]);

  const runListen = useCallback(() => {
    const text = lyrics.trim() || mappedNotes.map((n) => n.syllable || 'la').join(' ');
    if (!text) {
      setStatus('Type lyrics first — one word/syllable per note');
      return;
    }
    const ok = vocalBoxSpeakTextWithBrowserTts(text, 0.92);
    setStatus(ok ? `Browser listen: "${text.slice(0, 40)}${text.length > 40 ? '…' : ''}"` : 'Browser speech unavailable');
  }, [lyrics, mappedNotes]);

  const selectRow = (
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (v: string) => void,
  ) => (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontSize: 7,
        fontWeight: 800,
        color: '#9ca3af',
        letterSpacing: 0.4,
      }}
    >
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: '#0a0a0c',
          border: '1px solid #2a2a32',
          borderRadius: 4,
          color: '#e5e7eb',
          fontSize: 9,
          fontWeight: 700,
          padding: '3px 4px',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const sliderRow = (
    label: string,
    value: number,
    onChange: (v: number) => void,
  ) => (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontSize: 7,
        fontWeight: 800,
        color: '#9ca3af',
        letterSpacing: 0.4,
      }}
    >
      {label}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ width: '100%', accentColor: VOCAL_ACCENT }}
      />
    </label>
  );

  const menu =
    open && typeof document !== 'undefined' ? (
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: panelPos.top,
          left: panelPos.left,
          width: PANEL_W,
          maxHeight: 'min(420px, 72vh)',
          overflowY: 'auto',
          zIndex: 10050,
          background: 'linear-gradient(180deg, #120818 0%, #0a0510 100%)',
          border: `1px solid ${VOCAL_BORDER}`,
          borderRadius: 6,
          padding: '10px 12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 8,
              fontWeight: 900,
              color: VOCAL_ACCENT_HI,
              letterSpacing: 0.6,
            }}
          >
            MIDI TO VOCALBOX
          </span>
          <span
            style={{
              fontSize: 7,
              fontWeight: 800,
              color: '#67e8f9',
              background: '#0e2838',
              border: '1px solid #3b82f655',
              borderRadius: 4,
              padding: '2px 6px',
            }}
            title="Locked to Groove Lab session tempo"
          >
            {Math.round(bpm)} BPM
          </span>
        </div>

        <div style={{ marginBottom: 8 }}>
          {selectRow('SOURCE', inputSource, [
            { value: 'type', label: 'Type words' },
            { value: 'mic', label: 'Mic voice' },
          ], (v) => {
            setInputSource(v as VocalBoxInputSource);
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <button
            type="button"
            onClick={grabMelody}
            style={miniBtn('#1a1030', VOCAL_ACCENT_HI, VOCAL_BORDER)}
          >
            GRAB MELODY
          </button>
          <button
            type="button"
            onClick={addManualNote}
            style={miniBtn('#242424', '#d1d5db', '#333')}
          >
            + NOTE
          </button>
          <button
            type="button"
            onClick={runListen}
            disabled={inputSource === 'mic'}
            style={miniBtn('#0f172a', inputSource === 'mic' ? '#4b5563' : '#67e8f9', '#1e3a5f')}
            title="Hear plain typed text (browser TTS)"
          >
            LISTEN
          </button>
          <button
            type="button"
            onClick={() => void toggleMicRecord()}
            disabled={previewing}
            style={miniBtn(
              micRecording ? '#3b0a0a' : '#1a1030',
              micRecording ? '#fca5a5' : '#f472b6',
              micRecording ? '#ef4444' : '#831843',
            )}
            title="Record your voice — auto-tune + robot on VOCALBOX"
          >
            {micRecording ? `■ ${micSec.toFixed(1)}s` : '🎤 MIC'}
          </button>
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={previewing || rendering || mappedNotes.length === 0}
            style={miniBtn('#1a1030', '#4ade80', '#22c55e88')}
          >
            {rendering ? '…' : '▶'} VOCALBOX
          </button>
          <button
            type="button"
            onClick={stopPreview}
            disabled={!previewing}
            style={miniBtn('#1a0f0f', '#f87171', '#3a1f1f')}
          >
            ■ STOP
          </button>
        </div>

        {micRecording ? (
          <div
            style={{
              marginBottom: 8,
              padding: '5px 8px',
              borderRadius: 4,
              background: '#1a0a12',
              border: '1px solid #831843',
            }}
          >
            <div
              style={{
                fontSize: 7,
                fontWeight: 800,
                color: '#fca5a5',
                marginBottom: 4,
                letterSpacing: 0.4,
              }}
            >
              ● RECORDING {micSec.toFixed(1)}s — tap MIC to stop
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: '#2a1020',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, micLevel * 900)}%`,
                  background: 'linear-gradient(90deg, #f472b6, #ef4444)',
                  transition: 'width 60ms linear',
                }}
              />
            </div>
          </div>
        ) : null}

        {micBuffer && !micRecording ? (
          <div
            style={{
              marginBottom: 8,
              padding: '6px 8px',
              borderRadius: 5,
              background: '#120818',
              border: '1px solid #831843',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                marginBottom: 5,
              }}
            >
              <span style={{ fontSize: 7, fontWeight: 900, color: '#f9a8d4', letterSpacing: 0.4 }}>
                MIC CLIP · {vocalBoxMicDurationLabel(micBuffer.duration)}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => void playRawMicClip()}
                  style={miniBtn('#1a1030', '#67e8f9', '#1e3a5f')}
                >
                  HEAR
                </button>
                <button
                  type="button"
                  onClick={clearMicClip}
                  style={miniBtn('#1a0f0f', '#f87171', '#3a1f1f')}
                >
                  CLEAR
                </button>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
                height: 28,
                padding: '2px 0',
              }}
            >
              {micPeaks.map((p, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    minWidth: 2,
                    height: `${Math.max(8, p * 100)}%`,
                    borderRadius: 1,
                    background: 'linear-gradient(180deg, #f472b6, #a855f7)',
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 6, color: '#6b7280', marginTop: 4, fontWeight: 700 }}>
              Stays in the box until CLEAR or new MIC recording
            </div>
          </div>
        ) : null}

        <textarea
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder={
            inputSource === 'mic'
              ? 'Optional note labels (one word per note)&#10;Mic mode: speak on MIC, then VOCALBOX'
              : 'Type your line — one word per melody note&#10;e.g. I want to make love to you'
          }
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            minHeight: 52,
            background: '#0a0a0c',
            border: `1px solid ${inputSource === 'mic' && micBuffer ? '#831843' : '#2a2a32'}`,
            borderRadius: 5,
            color: '#e5e7eb',
            fontSize: 10,
            lineHeight: 1.4,
            padding: '6px 8px',
            marginBottom: 8,
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {selectRow('MODE', settings.mode, [
            { value: 'normal', label: 'Normal' },
            { value: 'breathy', label: 'Breathy' },
            { value: 'whisper', label: 'Whisper' },
          ], (v) =>
            setSettings((s) => ({ ...s, mode: v as VocalBoxSpeechMode })),
          )}
          {selectRow('STYLE', settings.style, [
            { value: 'sing', label: 'Sing' },
            { value: 'monotone', label: 'Monotone' },
          ], (v) =>
            setSettings((s) => ({ ...s, style: v as VocalBoxSpeechStyle })),
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {sliderRow('AUTO-TUNE', settings.autotuneStrength, (v) =>
            setSettings((s) => ({ ...s, autotuneStrength: v })),
          )}
          {sliderRow('ROBOT', settings.robotMix, (v) =>
            setSettings((s) => ({ ...s, robotMix: v })),
          )}
        </div>

        {notes.length > 0 ? (
          <div
            style={{
              fontSize: 7,
              color: '#6b7280',
              fontWeight: 700,
              lineHeight: 1.5,
              maxHeight: 72,
              overflowY: 'auto',
              marginBottom: 6,
              padding: '4px 6px',
              background: '#08080a',
              borderRadius: 4,
              border: '1px solid #1f1f28',
            }}
          >
            {mappedNotes.slice(0, 12).map((n, i) => (
              <div key={`${n.slot}-${n.midi}-${i}`}>{vocalBoxNoteLabel(n)}</div>
            ))}
            {mappedNotes.length > 12 ? (
              <div style={{ color: '#4b5563' }}>+{mappedNotes.length - 12} more…</div>
            ) : null}
          </div>
        ) : null}

        {status ? (
          <p
            style={{
              margin: 0,
              fontSize: 8,
              lineHeight: 1.4,
              color: '#a78bfa',
              fontWeight: 700,
            }}
          >
            {status}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 8, color: '#6b7280', lineHeight: 1.45 }}>
            SOURCE: type words or mic voice. Mic → 🎤 record your line → ▶ VOCALBOX runs the same
            auto-tune + robot on your melody notes.
          </p>
        )}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="MIDI melody + lyrics → VocalBox auto-tune (tempo-locked preview)"
        style={{
          background: open ? '#1a0f28' : '#242424',
          color: open ? VOCAL_ACCENT_HI : '#a78bfa',
          border: `1px solid ${open ? `${VOCAL_ACCENT}88` : '#2c2c2c'}`,
          borderRadius: 5,
          padding: '3px 8px',
          fontSize: 8,
          fontWeight: 900,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        MIDI TO VOCALBOX{micBuffer ? ` · ${vocalBoxMicDurationLabel(micBuffer.duration)}` : ''}
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}

function miniBtn(bg: string, color: string, border: string): CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${border}`,
    borderRadius: 5,
    padding: '3px 8px',
    fontSize: 8,
    fontWeight: 900,
    cursor: 'pointer',
  };
}
