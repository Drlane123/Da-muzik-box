import { useCallback, useState, type PointerEvent } from 'react';

import { ChevronDown, ChevronUp, Redo2, Undo2 } from 'lucide-react';

import { pointerStrikeVelocity } from '@/app/lib/creationStation/eightZeroEightVoice';
import {
  lab808PadAccentFromLabel,
  lab808PadBorder,
  lab808PadSurface,
} from '@/app/lib/creationStation/lab808PadColors';
import { NEURAL_HUM_KEY_NAMES } from '@/app/lib/vocalLab/neuralHumKeyLock';
import { NH_SCALE } from '@/app/lib/vocalLab/neuralHumTheme';
import type { NeuralHumKeyLockMode } from '@/app/lib/vocalLab/neuralHumKeyLock';

/** Twelve chromatic roots — 4×3 grid (C → B). */
const CHROMATIC_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

const PAD_CELL_MIN_H = 56;
const PAD_GRID_GAP = 6;
const PAD_ROW_COUNT = 3;
const PAD_BLOCK_H = PAD_CELL_MIN_H * PAD_ROW_COUNT + PAD_GRID_GAP * (PAD_ROW_COUNT - 1);

const MIN_OCTAVE = 2;
const MAX_OCTAVE = 6;

export type NeuralHumPadDownPayload = {
  midi: number;
  pc: number;
  velocity01: number;
};

type NeuralHumDrumPadsProps = {
  octave: number;
  onOctaveChange: (oct: number) => void;
  keyRoot: number;
  keyLockMode: NeuralHumKeyLockMode;
  scalePitchClasses: readonly number[];
  armedPadMidi: number | null;
  isRecording: boolean;
  canUndoRekey: boolean;
  canRedoRekey: boolean;
  onUndoRekey: () => void;
  onRedoRekey: () => void;
  onPadDown: (payload: NeuralHumPadDownPayload) => void;
  onPadUp: () => void;
};

function padMidi(octave: number, pc: number): number {
  return 12 * (octave + 1) + pc;
}

function padLabel(octave: number, pc: number): string {
  const name = NEURAL_HUM_KEY_NAMES[pc] ?? '?';
  return `${name}${octave}`;
}

export default function NeuralHumDrumPads({
  octave,
  onOctaveChange,
  keyRoot,
  keyLockMode,
  scalePitchClasses,
  armedPadMidi,
  isRecording,
  canUndoRekey,
  canRedoRekey,
  onUndoRekey,
  onRedoRekey,
  onPadDown,
  onPadUp,
}: NeuralHumDrumPadsProps) {
  const [hitPc, setHitPc] = useState<number | null>(null);
  const rootPc = ((Math.round(keyRoot) % 12) + 12) % 12;
  const setMode = keyLockMode === 'set';
  const scaleSet = keyLockMode !== 'off' ? new Set(scalePitchClasses) : null;

  const bumpOctave = (delta: number) => {
    onOctaveChange(Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, octave + delta)));
  };

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>, pc: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const midi = padMidi(octave, pc);
      onPadDown({ midi, pc, velocity01: pointerStrikeVelocity(e) });
      setHitPc(pc);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [octave, onPadDown],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      setHitPc(null);
      onPadUp();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* */
      }
    },
    [onPadUp],
  );

  return (
    <section
      style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
      aria-label="Key pads — set root or hold while humming to lock pitch"
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.14em', color: '#71717a' }}>
            12 KEY PADS
          </span>
          <p className="text-10px mt-0.5" style={{ color: '#555' }}>
            {setMode
              ? 'Tap a pad to re-key the melody & audition · hold while recording to lock hum to that note'
              : isRecording
                ? 'Hold a pad while humming to lock pitch to that note'
                : 'Tap a pad to set key root & re-key melody (works after Auto detect too)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center rounded overflow-hidden"
            style={{ border: '1px solid #333', background: '#242424' }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUndoRekey();
              }}
              disabled={!canUndoRekey}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
              style={{
                color: canUndoRekey ? NH_SCALE.primary : '#444',
                cursor: canUndoRekey ? 'pointer' : 'not-allowed',
              }}
              title="Undo key root change"
            >
              <Undo2 size={14} />
              Undo
            </button>
            <div style={{ width: 1, alignSelf: 'stretch', background: '#333' }} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRedoRekey();
              }}
              disabled={!canRedoRekey}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
              style={{
                color: canRedoRekey ? NH_SCALE.primary : '#444',
                cursor: canRedoRekey ? 'pointer' : 'not-allowed',
              }}
              title="Redo key root change"
            >
              <Redo2 size={14} />
              Redo
            </button>
          </div>

          <div
            className="flex items-center rounded overflow-hidden"
            style={{ border: '1px solid #333', background: '#242424' }}
          >
          <button
            type="button"
            onClick={() => bumpOctave(-1)}
            disabled={octave <= MIN_OCTAVE}
            className="px-2 py-1"
            style={{ color: octave <= MIN_OCTAVE ? '#444' : NH_SCALE.primary }}
            title="Octave down"
          >
            <ChevronDown size={14} />
          </button>
          <span
            className="text-xs font-mono font-bold px-2"
            style={{ color: NH_SCALE.primary, minWidth: 52, textAlign: 'center' }}
          >
            Oct {octave}
          </span>
          <button
            type="button"
            onClick={() => bumpOctave(1)}
            disabled={octave >= MAX_OCTAVE}
            className="px-2 py-1"
            style={{ color: octave >= MAX_OCTAVE ? '#444' : NH_SCALE.primary }}
            title="Octave up"
          >
            <ChevronUp size={14} />
          </button>
        </div>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${PAD_ROW_COUNT}, minmax(${PAD_CELL_MIN_H}px, 1fr))`,
            gap: PAD_GRID_GAP,
            minHeight: PAD_BLOCK_H,
            height: PAD_BLOCK_H,
          }}
        >
          {CHROMATIC_PCS.map((pc, row) => {
            const label = padLabel(octave, pc);
            const midi = padMidi(octave, pc);
            const isBlack = BLACK_PCS.has(pc);
            const isRoot = rootPc === pc && keyLockMode !== 'off';
            const inScale = !scaleSet || scaleSet.has(pc);
            const armed = armedPadMidi != null && Math.round(armedPadMidi) === midi;
            const accent = isRoot ? NH_SCALE.accent : isBlack ? '#8b5cf6' : lab808PadAccentFromLabel(label, row);
            const striking = hitPc === pc;
            const lit = armed || striking || (setMode && isRoot);

            return (
              <button
                key={pc}
                type="button"
                className="cs-pad-hit lab808-pad-hit"
                aria-label={`Key pad ${label}${isRoot ? ' — key root' : ''}${armed ? ' — hum locked' : ''}`}
                aria-pressed={armed || (setMode && isRoot)}
                onPointerDown={(e) => handlePointerDown(e, pc)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-end',
                  minHeight: PAD_CELL_MIN_H,
                  padding: '6px 8px 8px',
                  borderRadius: 10,
                  border: `2px solid ${
                    armed
                      ? '#00ff88'
                      : isRoot
                        ? NH_SCALE.borderHi
                        : lab808PadBorder(accent, lit)
                  }`,
                  background: armed
                    ? 'rgba(0,255,136,0.18)'
                    : isRoot
                      ? NH_SCALE.bgTintStrong
                      : lab808PadSurface(accent, lit),
                  opacity: inScale || setMode || keyLockMode === 'off' ? 1 : 0.45,
                  boxShadow: armed
                    ? '0 0 20px rgba(0,255,136,0.35), inset 0 1px 0 rgba(255,255,255,0.12)'
                    : lit
                      ? `0 0 18px color-mix(in srgb, ${accent} 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.12)`
                      : 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 0 rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  color: '#e4e4e7',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: isRoot ? NH_SCALE.primary : 'rgba(255,255,255,0.35)',
                    letterSpacing: '0.06em',
                    alignSelf: 'flex-start',
                  }}
                >
                  {isRoot ? 'ROOT' : isBlack ? '♯' : '♮'}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    lineHeight: 1.15,
                    textAlign: 'center',
                    color: armed ? '#00ff88' : lit ? '#f0fdf4' : inScale ? '#d4d4d8' : '#888',
                  }}
                  title={label}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
