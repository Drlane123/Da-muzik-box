'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cbPianoIsBlackKey,
  cbPianoMidiToNoteName,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  se2GuitarComputerKeyTargetIsTyping,
  se2GuitarMidiFromComputerKey,
} from '@/app/lib/studio/se2GuitarComputerKeys';

import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

const ACCENT = SE2_GUITAR_UI.accent;
const KEY_ROW_H = 76;

/** Ample Main — C2 through C6 (octaves 0–6 on C keys). */
const PIANO_LO = 36;
const PIANO_HI = 84;

const BLACK_KEY_OFFSET: Record<number, number> = {
  1: 0.68,
  3: 0.68,
  6: 0.4,
  8: 0.52,
  10: 0.62,
};

function buildKeyRange(low: number, high: number) {
  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];
  for (let m = low; m <= high; m += 1) {
    if (cbPianoIsBlackKey(m)) blackKeys.push(m);
    else whiteKeys.push(m);
  }
  return { whiteKeys, blackKeys };
}

function blackKeyLeftPct(midi: number, whiteKeys: readonly number[]): number {
  const pc = ((midi % 12) + 12) % 12;
  const offset = BLACK_KEY_OFFSET[pc] ?? 0.55;
  let whiteIdx = 0;
  for (let i = 0; i < whiteKeys.length; i += 1) {
    if (whiteKeys[i]! < midi) whiteIdx = i;
    else break;
  }
  if (whiteKeys.length <= 1) return 50;
  return ((whiteIdx + offset) / whiteKeys.length) * 100;
}

function octaveLabel(midi: number): string {
  return String(Math.floor(midi / 12) - 1);
}

export type Se2GuitarPianoKeyboardProps = {
  disabled?: boolean;
  activeMidi?: number | null;
  activeMidis?: readonly number[];
  /** Listen for QWERTY keys while the panel is open (default on). */
  computerKeysEnabled?: boolean;
  onKeyPlay: (midi: number, velocity?: number) => void;
  onKeyInsert?: (midi: number) => void;
};

export function Se2GuitarPianoKeyboard({
  disabled = false,
  activeMidi = null,
  activeMidis,
  computerKeysEnabled = true,
  onKeyPlay,
  onKeyInsert,
}: Se2GuitarPianoKeyboardProps) {
  const [lit, setLit] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const heldCodesRef = useRef<Set<string>>(new Set());

  const { whiteKeys, blackKeys } = useMemo(() => buildKeyRange(PIANO_LO, PIANO_HI), []);

  const handleKey = useCallback(
    (midi: number, insert = false) => {
      if (disabled) return;
      setLit(midi);
      onKeyPlay(midi, cbPianoIsBlackKey(midi) ? 94 : 98);
      if (insert && onKeyInsert) onKeyInsert(midi);
      window.setTimeout(() => setLit(null), 140);
    },
    [disabled, onKeyInsert, onKeyPlay],
  );

  useEffect(() => {
    if (!computerKeysEnabled || disabled) return;

    const dock = rootRef.current?.closest('[data-studio-guitar-dock]');
    if (!dock) return;

    let armed = false;
    const arm = (e: Event) => {
      if (dock.contains(e.target as Node)) armed = true;
    };
    const disarm = () => {
      armed = false;
    };

    dock.addEventListener('pointerdown', arm);
    window.addEventListener('blur', disarm);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!armed) return;
      if (e.repeat) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (se2GuitarComputerKeyTargetIsTyping(e.target)) return;
      const midi = se2GuitarMidiFromComputerKey(e.code, PIANO_LO, PIANO_HI);
      if (midi == null) return;
      e.preventDefault();
      heldCodesRef.current.add(e.code);
      handleKey(midi, e.shiftKey);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldCodesRef.current.delete(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      dock.removeEventListener('pointerdown', arm);
      window.removeEventListener('blur', disarm);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      heldCodesRef.current.clear();
    };
  }, [computerKeysEnabled, disabled, handleKey]);

  const highlightedSet = useMemo(() => {
    const s = new Set<number>();
    if (activeMidis?.length) {
      for (const m of activeMidis) s.add(m);
    } else if (activeMidi != null) {
      s.add(activeMidi);
    }
    if (lit != null) s.add(lit);
    return s;
  }, [activeMidi, activeMidis, lit]);

  return (
    <div
      ref={rootRef}
      className="flex w-full min-w-0 flex-col outline-none"
      data-se2-guitar-keyboard
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="px-1 pb-0.5 text-center text-[6px] font-semibold uppercase tracking-wider text-[#6a6458]">
        Click panel once, then Z–M · Q–P · Shift+key inserts
      </p>
      {/* Wood bezel — keys only; no dead strip below the white keys */}
      <div
        className="overflow-hidden rounded-sm border px-1 pt-1 pb-0"
        style={{
          borderColor: '#4a3828',
          background: 'linear-gradient(180deg, #2a1e14 0%, #1a120c 100%)',
          boxShadow: 'inset 0 2px 4px #0006, 0 2px 8px #0008',
        }}
      >
        <div
          className="relative w-full overflow-hidden rounded-sm border border-[#1a1410]"
          style={{ height: KEY_ROW_H }}
        >
          <div className="relative flex h-full w-full flex-row">
            {whiteKeys.map((midi) => {
              const isLit = highlightedSet.has(midi);
              const isC = midi % 12 === 0;
              return (
                <button
                  key={`w-${midi}`}
                  type="button"
                  disabled={disabled}
                  title={`${cbPianoMidiToNoteName(midi)} — right-click to insert`}
                  onClick={() => handleKey(midi)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleKey(midi, true);
                  }}
                  className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end border-r transition-all disabled:opacity-40"
                  style={{
                    zIndex: 1,
                    borderColor: '#9a9080',
                    borderRightWidth: 1,
                    background: isLit
                      ? `linear-gradient(180deg, #fffef8 0%, ${ACCENT} 35%, ${ACCENT}cc 100%)`
                      : 'linear-gradient(180deg, #fffff8 0%, #f0ebe0 22%, #e8e0d0 55%, #d8d0c0 78%, #c8c0b0 100%)',
                    boxShadow: isLit
                      ? `inset 0 -2px 4px ${ACCENT}88, 0 1px 0 #fff8`
                      : 'inset 0 -3px 6px #b8b0a088, inset 0 1px 0 #fffef8, 0 1px 0 #0004',
                    transform: isLit ? 'translateY(1px)' : undefined,
                  }}
                >
                  {isC ? (
                    <span
                      className="absolute top-1 text-[8px] font-black tabular-nums"
                      style={{ color: isLit ? '#2a2010' : '#5a5048' }}
                    >
                      {octaveLabel(midi)}
                    </span>
                  ) : null}
                </button>
              );
            })}

            {blackKeys.map((midi) => {
              const isLit = highlightedSet.has(midi);
              return (
                <button
                  key={`b-${midi}`}
                  type="button"
                  disabled={disabled}
                  title={`${cbPianoMidiToNoteName(midi)}`}
                  onClick={() => handleKey(midi)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleKey(midi, true);
                  }}
                  className="absolute rounded-b-[2px] border transition-all disabled:opacity-40"
                  style={{
                    zIndex: 3,
                    top: 0,
                    left: `calc(${blackKeyLeftPct(midi, whiteKeys)}% - 2.8%)`,
                    width: '5.6%',
                    maxWidth: 20,
                    height: '58%',
                    borderColor: isLit ? ACCENT : '#0a0806',
                    borderBottomWidth: 2,
                    background: isLit
                      ? `linear-gradient(180deg, #6a6058 0%, ${ACCENT}aa 40%, #1a1408 100%)`
                      : 'linear-gradient(180deg, #4a4438 0%, #2a2420 30%, #1a1814 70%, #0a0806 100%)',
                    boxShadow: isLit
                      ? `0 0 8px ${ACCENT}66, inset 0 -1px 0 #0008`
                      : 'inset 0 -2px 3px #000c, 0 2px 3px #0006',
                    transform: isLit ? 'translateY(1px)' : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
