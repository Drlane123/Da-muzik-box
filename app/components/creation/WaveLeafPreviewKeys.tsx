/** Groove Lead — full-width preview keyboard (C4–C6, matches bottom piano roll). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cbPianoIsBlackKey,
  cbPianoKeyLabel,
  cbPianoMidiToNoteName,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { WAVE_LEAF_MIDI_MAX, WAVE_LEAF_MIDI_MIN, WAVE_LEAF_REGISTER_LABEL } from '@/app/lib/creationStation/waveLeafPitch';
import { WAVE_LEAF_UI } from '@/app/lib/creationStation/waveLeafBranding';

/** Black-key center within the gap after its lower white neighbor (0–1). */
const BLACK_KEY_OFFSET: Record<number, number> = {
  1: 0.68,
  3: 0.68,
  6: 0.4,
  8: 0.52,
  10: 0.62,
};

type Props = {
  onPlayMidi: (midi: number) => void;
  onReleaseMidi?: () => void;
  playingMidis?: ReadonlySet<number>;
  disabled?: boolean;
  midiMin?: number;
  midiMax?: number;
  registerLabel?: string;
};

function buildKeysInRange(low: number, high: number) {
  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];
  for (let m = low; m <= high; m++) {
    if (cbPianoIsBlackKey(m)) blackKeys.push(m);
    else whiteKeys.push(m);
  }
  return { whiteKeys, blackKeys };
}

function blackKeyLeftPercent(midi: number, whiteKeys: readonly number[]): number {
  const pc = ((midi % 12) + 12) % 12;
  const offset = BLACK_KEY_OFFSET[pc] ?? 0.55;
  let whiteIdx = 0;
  for (let i = 0; i < whiteKeys.length; i++) {
    if (whiteKeys[i]! < midi) whiteIdx = i;
    else break;
  }
  if (whiteKeys.length <= 1) return 50;
  return ((whiteIdx + offset) / whiteKeys.length) * 100;
}

export function WaveLeafPreviewKeys({
  onPlayMidi,
  onReleaseMidi,
  playingMidis,
  disabled,
  midiMin = WAVE_LEAF_MIDI_MIN,
  midiMax = WAVE_LEAF_MIDI_MAX,
  registerLabel = WAVE_LEAF_REGISTER_LABEL,
}: Props) {
  const keyPointerRef = useRef({ down: false, lastMidi: 0 });
  const [activeMidi, setActiveMidi] = useState<number | null>(null);

  const { whiteKeys, blackKeys } = useMemo(
    () => buildKeysInRange(midiMin, midiMax),
    [midiMin, midiMax],
  );

  useEffect(() => {
    const end = () => {
      if (!keyPointerRef.current.down) return;
      keyPointerRef.current.down = false;
      setActiveMidi(null);
      onReleaseMidi?.();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [onReleaseMidi]);

  const playKey = useCallback(
    (midi: number) => {
      if (disabled) return;
      keyPointerRef.current.down = true;
      keyPointerRef.current.lastMidi = midi;
      setActiveMidi(midi);
      onPlayMidi(midi);
    },
    [disabled, onPlayMidi],
  );

  const enterKey = useCallback(
    (midi: number) => {
      if (disabled || !keyPointerRef.current.down || midi <= 0) return;
      if (midi === keyPointerRef.current.lastMidi) return;
      keyPointerRef.current.lastMidi = midi;
      setActiveMidi(midi);
      onPlayMidi(midi);
    },
    [disabled, onPlayMidi],
  );

  const keyBtn = (midi: number, black: boolean) => {
    const lit = playingMidis?.has(midi) || activeMidi === midi;
    const label = cbPianoKeyLabel(midi);
    return (
      <button
        key={midi}
        type="button"
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
          playKey(midi);
        }}
        onPointerEnter={() => enterKey(midi)}
        title={cbPianoMidiToNoteName(midi)}
        style={{
          touchAction: 'none',
          position: black ? 'absolute' : 'relative',
          zIndex: black ? 3 : 1,
          flex: black ? undefined : '1 1 0',
          minWidth: black ? 0 : 0,
          width: black ? '5.2%' : undefined,
          maxWidth: black ? 28 : undefined,
          height: black ? '62%' : '100%',
          top: black ? 0 : undefined,
          left: black ? `calc(${blackKeyLeftPercent(midi, whiteKeys)}% - 2.6%)` : undefined,
          transform: black ? undefined : undefined,
          borderRadius: black ? 3 : 4,
          border: `1px solid ${lit ? WAVE_LEAF_UI.presetBorderOn : black ? '#020810' : WAVE_LEAF_UI.borderHi}`,
          background: lit
            ? `linear-gradient(180deg, ${WAVE_LEAF_UI.accentHi}, ${WAVE_LEAF_UI.accentDim})`
            : black
              ? `linear-gradient(180deg, #1a2a3a, ${WAVE_LEAF_UI.keyBlack})`
              : `linear-gradient(180deg, ${WAVE_LEAF_UI.keyWhite}, #a8d4e8)`,
          boxShadow: lit ? `0 0 8px ${WAVE_LEAF_UI.accent}66` : 'none',
          cursor: disabled ? 'default' : 'pointer',
          padding: black ? '2px 0 0' : '0 0 3px',
          margin: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <span
          style={{
            fontSize: black ? 6 : 7,
            fontWeight: 800,
            lineHeight: 1,
            color: lit ? '#041018' : black ? WAVE_LEAF_UI.textDim : '#1a3a52',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
          padding: '0 2px',
        }}
      >
        <span style={{ fontSize: 6, fontWeight: 800, color: WAVE_LEAF_UI.textDim, letterSpacing: 0.5 }}>
          PREVIEW · {registerLabel}
        </span>
        <span style={{ fontSize: 6, color: WAVE_LEAF_UI.textDim }}>drag across keys</span>
      </div>
      <div
        style={{
          width: '100%',
          padding: '4px 4px 6px',
          borderRadius: 6,
          border: `1px solid ${WAVE_LEAF_UI.border}`,
          background: WAVE_LEAF_UI.bgModule,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 44,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
          }}
        >
          {whiteKeys.map((midi) => keyBtn(midi, false))}
          {blackKeys.map((midi) => keyBtn(midi, true))}
        </div>
      </div>
    </div>
  );
}
