'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Se2SynthGenoLiveKeyboardKey } from '@/app/lib/studio/se2SynthGenoLiveChordMap';

export type Se2SynthGenoLiveChordKeyboardProps = {
  keys: readonly Se2SynthGenoLiveKeyboardKey[];
  slotEnabled: readonly boolean[];
  activeSlot: number | null;
  accentHex?: string;
  disabled?: boolean;
  onPlaySlot: (slotIndex: number) => void;
  onToggleSlot: (slotIndex: number) => void;
};

/** Progression-order trigger row — root labels per preset (Rip Chord style). */
export function Se2SynthGenoLiveChordKeyboard({
  keys,
  slotEnabled,
  activeSlot,
  accentHex = '#00E5CC',
  disabled = false,
  onPlaySlot,
  onToggleSlot,
}: Se2SynthGenoLiveChordKeyboardProps) {
  const keyBySlot = useMemo(() => new Map(keys.map((k) => [k.slotIndex, k])), [keys]);
  const keyPointerRef = useRef({ down: false, lastSlot: -1 });
  const [pressedSlot, setPressedSlot] = useState<number | null>(null);

  const progressionKeys = useMemo(
    () => keys.filter((k) => k.hasChord).sort((a, b) => a.slotIndex - b.slotIndex),
    [keys],
  );

  useEffect(() => {
    const end = () => {
      if (!keyPointerRef.current.down) return;
      keyPointerRef.current.down = false;
      setPressedSlot(null);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  const tryPlaySlot = useCallback(
    (slotIndex: number) => {
      const slot = keyBySlot.get(slotIndex);
      if (!slot?.hasChord || disabled) return;
      if (!slotEnabled[slotIndex]) return;
      keyPointerRef.current.down = true;
      keyPointerRef.current.lastSlot = slotIndex;
      setPressedSlot(slotIndex);
      onPlaySlot(slotIndex);
    },
    [disabled, keyBySlot, onPlaySlot, slotEnabled],
  );

  const enterSlot = useCallback(
    (slotIndex: number) => {
      if (disabled || !keyPointerRef.current.down || slotIndex < 0) return;
      if (slotIndex === keyPointerRef.current.lastSlot) return;
      tryPlaySlot(slotIndex);
    },
    [disabled, tryPlaySlot],
  );

  const colCount = Math.max(1, progressionKeys.length);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[7px] font-bold uppercase tracking-widest opacity-55">
          Progression chord triggers
        </span>
        <span className="text-[7px] font-mono opacity-40">
          in preset order · press to play
        </span>
      </div>
      <div
        className="grid gap-1 w-full"
        style={{
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
          height: 96,
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {progressionKeys.map((key) => {
          const { slotIndex, triggerLabel, roman } = key;
          const enabled = slotEnabled[slotIndex] ?? true;
          const lit = enabled && (pressedSlot === slotIndex || activeSlot === slotIndex);

          return (
            <button
              key={slotIndex}
              type="button"
              disabled={disabled || !enabled}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                tryPlaySlot(slotIndex);
              }}
              onPointerEnter={() => enterSlot(slotIndex)}
              title={`${triggerLabel} · ${roman}${enabled ? '' : ' (off)'}`}
              className="flex flex-col items-center justify-end rounded-md border disabled:opacity-40 min-w-0"
              style={{
                borderColor: lit ? accentHex : enabled ? '#4a5568' : '#2a2a34',
                background: lit
                  ? `linear-gradient(180deg, ${accentHex}cc 0%, ${accentHex}33 100%)`
                  : enabled
                    ? 'linear-gradient(180deg, #3a4458 0%, #1a2230 100%)'
                    : 'linear-gradient(180deg, #1a1c24 0%, #1e1e26 100%)',
                color: lit ? '#0c0c14' : enabled ? '#ececf4' : '#5a5a68',
                opacity: enabled ? 1 : 0.42,
                cursor: disabled || !enabled ? 'default' : 'pointer',
                padding: '4px 2px 6px',
              }}
            >
              <span className="text-[10px] font-black font-mono leading-none">{triggerLabel}</span>
              {roman ? (
                <span
                  role="button"
                  tabIndex={-1}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleSlot(slotIndex);
                  }}
                  className="mt-1 rounded border px-0.5 max-w-full truncate text-[6px] font-bold font-mono leading-tight cursor-pointer"
                  style={{
                    borderColor: enabled ? `${accentHex}55` : '#3a3a44',
                    color: enabled ? (lit ? '#0c0c14' : accentHex) : '#6a6a78',
                    background: enabled ? `${accentHex}18` : 'transparent',
                  }}
                  title={enabled ? 'Deactivate this trigger' : 'Activate this trigger'}
                >
                  {roman}
                </span>
              ) : (
                <span className="mt-1 text-[6px] opacity-30">—</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
