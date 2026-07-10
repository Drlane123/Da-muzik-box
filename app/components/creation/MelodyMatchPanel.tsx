/**
 * Voice → Chords: compact hum / upload / live voice-MIDI → progression MATCH.
 */

import { useRef, type ReactNode } from 'react';
import { Mic, Radio, Upload, Wand2 } from 'lucide-react';

import type { MelodyProgressionCandidate } from '@/app/lib/creationStation/melodyToChordProgression';
import { ChordBuilderHelpTip } from '@/app/components/creation/ChordBuilderHelpHub';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.35)';
const MINT_BG = 'rgba(124, 244, 198, 0.12)';
const AMBER = '#e8c47a';
const AMBER_DIM = 'rgba(232, 196, 122, 0.35)';
const AMBER_BG = 'rgba(232, 196, 122, 0.10)';

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '4px 10px',
  minWidth: 56,
  minHeight: 26,
  borderRadius: 4,
  border: `1px solid ${MINT_DIM}`,
  background: MINT_BG,
  color: MINT,
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.5,
  cursor: 'pointer',
  flexShrink: 0,
};

export function MelodyMatchPanel({
  isRecording,
  isBusy,
  error,
  candidates,
  onToggleRecord,
  onUploadFile,
  onAnalyze,
  onApplyCandidate,
  voiceMidiLive,
  voiceMidiLiveNote,
  voiceMidiCaptureCount,
  onToggleVoiceMidiLive,
  helpTip,
}: {
  isRecording: boolean;
  isBusy: boolean;
  error: string | null;
  candidates: MelodyProgressionCandidate[] | null;
  onToggleRecord: () => void;
  onUploadFile: (file: File) => void;
  onAnalyze: () => void;
  onApplyCandidate: (candidate: MelodyProgressionCandidate) => void;
  voiceMidiLive: boolean;
  voiceMidiLiveNote: string | null;
  voiceMidiCaptureCount: number;
  onToggleVoiceMidiLive: () => void;
  /** Override default Chord Builder help tip (e.g. Vocal Lab Harmony Match). */
  helpTip?: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const anyCapture = isRecording || voiceMidiLive;

  const statusLine = anyCapture
    ? voiceMidiLive
      ? voiceMidiLiveNote
        ? `${voiceMidiLiveNote} · ${voiceMidiCaptureCount} notes`
        : `LIVE · ${voiceMidiCaptureCount} notes`
      : 'Recording…'
    : isBusy
      ? 'Matching…'
      : voiceMidiCaptureCount >= 8
        ? `${voiceMidiCaptureCount} notes — MATCH`
        : 'HUM · FILE · LIVE · MATCH';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 900, color: MINT, letterSpacing: 0.8, flexShrink: 0 }}>
          VOICE→CHORDS
          {helpTip ?? <ChordBuilderHelpTip tab="melody" title="Melody Match — hum to chords" />}
        </span>
        <button
          type="button"
          title={isRecording ? 'Stop' : 'Hum (no live synth)'}
          onClick={onToggleRecord}
          disabled={isBusy || voiceMidiLive}
          style={{
            ...btnBase,
            border: `1px solid ${isRecording ? '#f47c7c' : MINT_DIM}`,
            background: isRecording ? 'rgba(244, 124, 124, 0.15)' : MINT_BG,
            color: isRecording ? '#f4a0a0' : MINT,
            opacity: isBusy || voiceMidiLive ? 0.5 : 1,
          }}
        >
          <Mic size={12} />
          {isRecording ? 'STOP' : 'HUM'}
        </button>
        <button
          type="button"
          title="Upload audio"
          onClick={() => fileRef.current?.click()}
          disabled={isBusy || anyCapture}
          style={{ ...btnBase, opacity: isBusy || anyCapture ? 0.5 : 1 }}
        >
          <Upload size={12} />
          FILE
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadFile(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          title="Match to progressions"
          onClick={onAnalyze}
          disabled={isBusy || anyCapture}
          style={{ ...btnBase, opacity: isBusy || anyCapture ? 0.5 : 1 }}
        >
          <Wand2 size={12} />
          {isBusy ? '…' : 'MATCH'}
        </button>
        <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} aria-hidden />
        <button
          type="button"
          title={voiceMidiLive ? 'Stop live voice MIDI' : 'Sing — hear notes live'}
          onClick={onToggleVoiceMidiLive}
          disabled={isBusy || isRecording}
          style={{
            ...btnBase,
            minWidth: 52,
            border: `1px solid ${voiceMidiLive ? '#f47c7c' : AMBER_DIM}`,
            background: voiceMidiLive ? 'rgba(244, 124, 124, 0.15)' : AMBER_BG,
            color: voiceMidiLive ? '#f4a0a0' : AMBER,
            opacity: isRecording ? 0.5 : 1,
          }}
        >
          <Radio size={12} />
          {voiceMidiLive ? 'STOP' : 'LIVE'}
        </button>
        <span style={{ fontSize: 8, fontWeight: 600, color: '#6a6a78', flex: '1 1 72px', lineHeight: 1.2 }}>
          {statusLine}
        </span>
      </div>

      {error ? <span style={{ fontSize: 9, fontWeight: 700, color: '#f4a0a0' }}>{error}</span> : null}

      {candidates && candidates.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {candidates.map((c, i) => (
            <button
              key={c.id}
              type="button"
              title={`Apply: ${c.label}`}
              onClick={() => onApplyCandidate(c)}
              style={{
                padding: '4px 8px',
                minHeight: 22,
                borderRadius: 4,
                border: `1px solid ${i === 0 ? MINT : 'rgba(255,255,255,0.14)'}`,
                background: i === 0 ? 'rgba(124, 244, 198, 0.18)' : 'rgba(255,255,255,0.04)',
                color: i === 0 ? MINT : '#b8b8c4',
                fontSize: 9,
                fontWeight: 900,
                cursor: 'pointer',
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {String.fromCharCode(0x2460 + i)} {c.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
