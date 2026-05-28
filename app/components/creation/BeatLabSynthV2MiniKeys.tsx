import React, { useCallback, useEffect, useRef } from 'react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

type Props = {
  rootMidi: number;
  onPlayMidi: (midi: number) => void;
  onReleaseMidi?: () => void;
  playingMidis?: ReadonlySet<number>;
  disabled?: boolean;
};

/** One-octave preview keyboard — pointer down, drag, release (Vital-style). */
export function BeatLabSynthV2MiniKeys({
  rootMidi,
  onPlayMidi,
  onReleaseMidi,
  playingMidis,
  disabled,
}: Props) {
  const keyPointerRef = useRef({ down: false, lastMidi: 0 });
  const keys = Array.from({ length: 12 }, (_, i) => rootMidi + i);
  const isBlack = (i: number) => [1, 3, 6, 8, 10].includes(i % 12);

  useEffect(() => {
    const endKeyPointer = () => {
      if (!keyPointerRef.current.down) return;
      keyPointerRef.current.down = false;
      onReleaseMidi?.();
    };
    window.addEventListener('pointerup', endKeyPointer);
    window.addEventListener('pointercancel', endKeyPointer);
    return () => {
      window.removeEventListener('pointerup', endKeyPointer);
      window.removeEventListener('pointercancel', endKeyPointer);
    };
  }, [onReleaseMidi]);

  const playKey = useCallback(
    (midi: number) => {
      if (disabled || midi <= 0) return;
      keyPointerRef.current.down = true;
      keyPointerRef.current.lastMidi = midi;
      onPlayMidi(midi);
    },
    [disabled, onPlayMidi],
  );

  const enterKey = useCallback(
    (midi: number) => {
      if (disabled || !keyPointerRef.current.down || midi <= 0) return;
      if (midi === keyPointerRef.current.lastMidi) return;
      keyPointerRef.current.lastMidi = midi;
      onPlayMidi(midi);
    },
    [disabled, onPlayMidi],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 8, color: '#7a8899', fontWeight: 700 }}>Preview keys</span>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {keys.map((midi, i) => {
          const black = isBlack(i);
          const name = NOTE_NAMES[i % 12]!;
          const oct = Math.floor(midi / 12) - 1;
          const active = playingMidis?.has(midi) ?? false;
          return (
            <button
              key={midi}
              type="button"
              disabled={disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                playKey(midi);
              }}
              onPointerEnter={() => enterKey(midi)}
              style={{
                minWidth: black ? 22 : 28,
                height: black ? 26 : 32,
                padding: '2px 4px',
                fontSize: 8,
                fontWeight: 800,
                borderRadius: 4,
                border: `1px solid ${active ? '#c59cff' : black ? '#2a3040' : '#3a4a60'}`,
                background: active
                  ? 'linear-gradient(180deg, #6a4a9a 0%, #3a2858 100%)'
                  : black
                    ? 'linear-gradient(180deg, #1a1e28 0%, #0e1018 100%)'
                    : 'linear-gradient(180deg, #2a3448 0%, #1a2230 100%)',
                color: active ? '#fff' : black ? '#9aa8bc' : '#e8eef8',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                touchAction: 'none',
              }}
              title={`${name}${oct} — click or drag`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
