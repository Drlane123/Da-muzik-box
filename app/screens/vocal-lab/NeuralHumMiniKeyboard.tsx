import { useMemo } from 'react';

import { Lock, Unlock } from 'lucide-react';

import {
  NEURAL_HUM_KEY_NAMES,
  neuralHumScaleMeta,
  neuralHumScalePitchClasses,
  type NeuralHumKeyLockMode,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import { NH_PIANO, NH_SCALE } from '@/app/lib/vocalLab/neuralHumTheme';

type NeuralHumMiniKeyboardProps = {
  keyRoot: number;
  scaleId: NeuralHumScaleId;
  keyLockMode: NeuralHumKeyLockMode;
  keyLabel: string | null;
  octave: number;
  onOctaveChange: (oct: number) => void;
  liveMidi: number | null;
  melodyMidis: ReadonlySet<number>;
  pressedMidi: number | null;
  onNoteDown: (midi: number) => void;
  onNoteUp: () => void;
};

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11] as const;
const BLACK_OFFSETS: { afterWhite: number; pc: number }[] = [
  { afterWhite: 0, pc: 1 },
  { afterWhite: 1, pc: 3 },
  { afterWhite: 3, pc: 6 },
  { afterWhite: 4, pc: 8 },
  { afterWhite: 5, pc: 10 },
];

const OCTAVE_COUNT = 2;

const PIANO = NH_PIANO;

function OctaveKeys({
  octave,
  keyRoot,
  scaleSet,
  keyLockOff,
  liveMidi,
  melodyMidis,
  pressedMidi,
  onNoteDown,
  onNoteUp,
}: {
  octave: number;
  keyRoot: number;
  scaleSet: Set<number> | null;
  keyLockOff: boolean;
  liveMidi: number | null;
  melodyMidis: ReadonlySet<number>;
  pressedMidi: number | null;
  onNoteDown: (midi: number) => void;
  onNoteUp: () => void;
}) {
  const base = 12 * (octave + 1);
  const whiteKeys = WHITE_PCS.map((pc) => base + pc);
  const blackKeys = BLACK_OFFSETS.map(({ pc }) => base + pc);
  const whiteW = 100 / 7;

  const keyStyle = (midi: number, black: boolean) => {
    const pc = ((midi % 12) + 12) % 12;
    const inScale = !scaleSet || scaleSet.has(pc);
    const isRoot = !keyLockOff && pc === keyRoot;
    const isLive = liveMidi != null && Math.round(liveMidi) === midi;
    const inMelody = melodyMidis.has(midi);
    const pressed = pressedMidi === midi;
    const outOfScale = !keyLockOff && !inScale;

    let bg = black ? PIANO.black : PIANO.white;
    let border = black ? PIANO.blackBorder : PIANO.whiteBorder;
    let labelColor = black ? PIANO.label : PIANO.label;
    let keyOpacity = 1;

    if (outOfScale) {
      bg = black ? '#1c1c1c' : '#303030';
      border = '#252525';
      labelColor = '#333';
      keyOpacity = black ? 0.28 : 0.32;
    } else if (isRoot && !black) {
      labelColor = PIANO.labelRoot;
    }

    if (inMelody && inScale && !isLive && !pressed) {
      bg = black ? '#1a3328' : '#eefdf4';
      border = black ? '#2d6b4a' : '#7cf4c688';
    }
    if (isLive) {
      bg = '#00ff88';
      border = '#00cc6a';
      labelColor = '#003318';
      keyOpacity = 1;
    }
    if (pressed) {
      bg = black ? '#2a2040' : NH_SCALE.accent;
      border = NH_SCALE.accent;
      labelColor = black ? '#e9e0ff' : '#1a1030';
      keyOpacity = 1;
    }

    return {
      bg,
      border,
      labelColor,
      keyOpacity,
      inScale,
      isRoot,
      disabled: outOfScale,
      showLabel: !black && (keyLockOff || inScale),
      noteName: NEURAL_HUM_KEY_NAMES[pc],
    };
  };

  return (
    <div className="relative flex-1 min-w-0" style={{ height: '100%' }}>
      <div className="absolute inset-0 flex">
        {whiteKeys.map((midi) => {
          const st = keyStyle(midi, false);
          return (
            <button
              key={midi}
              type="button"
              disabled={st.disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                if (!st.disabled) onNoteDown(midi);
              }}
              onPointerUp={onNoteUp}
              onPointerLeave={onNoteUp}
              className="relative h-full border-r flex flex-col justify-end items-center pb-0.5"
              style={{
                width: `${whiteW}%`,
                background: st.bg,
                borderColor: st.border,
                boxShadow: st.isRoot
                  ? `inset 0 -3px 0 0 ${NH_SCALE.accent}, inset 0 0 0 1px ${NH_SCALE.borderHi}`
                  : 'inset 0 -1px 0 rgba(0,0,0,0.06)',
                cursor: st.disabled ? 'not-allowed' : 'pointer',
                opacity: st.keyOpacity,
              }}
              title={st.noteName}
            >
              {st.showLabel && (
                <span style={{ fontSize: 7, fontWeight: 700, color: st.labelColor, lineHeight: 1 }}>
                  {st.noteName}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {blackKeys.map((midi, i) => {
        const offset = BLACK_OFFSETS[i]!.afterWhite;
        const left = offset * whiteW + whiteW * 0.66;
        const st = keyStyle(midi, true);
        return (
          <button
            key={midi}
            type="button"
            disabled={st.disabled}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!st.disabled) onNoteDown(midi);
            }}
            onPointerUp={onNoteUp}
            onPointerLeave={onNoteUp}
            className="absolute z-10 rounded-b-sm"
            style={{
              left: `${left}%`,
              width: `${whiteW * 0.58}%`,
              height: '52%',
              top: 0,
              background: st.bg,
              border: `1px solid ${st.border}`,
              boxShadow: st.isRoot
                ? `0 0 0 1px ${NH_SCALE.accent}, 0 2px 4px rgba(0,0,0,0.5)`
                : '0 2px 4px rgba(0,0,0,0.45)',
              cursor: st.disabled ? 'not-allowed' : 'pointer',
              opacity: st.keyOpacity,
            }}
            title={st.noteName}
          />
        );
      })}
    </div>
  );
}

export default function NeuralHumMiniKeyboard({
  keyRoot,
  scaleId,
  keyLockMode,
  keyLabel,
  octave,
  onOctaveChange,
  liveMidi,
  melodyMidis,
  pressedMidi,
  onNoteDown,
  onNoteUp,
}: NeuralHumMiniKeyboardProps) {
  const keyLockOff = keyLockMode === 'off';

  const scaleSet = useMemo(() => {
    if (keyLockOff) return null;
    return new Set(neuralHumScalePitchClasses(keyRoot, scaleId));
  }, [keyLockOff, keyRoot, scaleId]);

  const scaleLabel = neuralHumScaleMeta(scaleId).label;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5"
        style={{
          background: keyLockOff ? '#242424' : NH_SCALE.bgTint,
          border: `1px solid ${keyLockOff ? '#222' : NH_SCALE.borderHi}`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {keyLockOff ? (
            <Unlock size={13} style={{ color: '#555', flexShrink: 0 }} />
          ) : (
            <Lock size={13} style={{ color: NH_SCALE.primary, flexShrink: 0 }} />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-10px uppercase tracking-wider font-bold" style={{ color: '#666' }}>
              {keyLockOff ? 'No key lock' : keyLockMode === 'auto' ? 'Key locked · auto' : keyLockMode === 'set' ? 'Key locked · set' : 'Key locked · manual'}
            </span>
            <span
              className="text-sm font-bold truncate"
              style={{ color: keyLockOff ? '#888' : NH_SCALE.primary }}
            >
              {keyLockOff ? 'Chromatic — all notes' : keyLabel ?? `${NEURAL_HUM_KEY_NAMES[keyRoot]} ${scaleLabel}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOctaveChange(Math.max(2, octave - 1))}
            className="px-1.5 py-0.5 rounded text-xs font-bold"
            style={{ background: '#242424', color: '#888', border: '1px solid #333' }}
          >
            −
          </button>
          <span className="text-10px font-mono" style={{ color: '#888', minWidth: 22, textAlign: 'center' }}>
            C{octave}
          </span>
          <button
            type="button"
            onClick={() => onOctaveChange(Math.min(5, octave + 1))}
            className="px-1.5 py-0.5 rounded text-xs font-bold"
            style={{ background: '#242424', color: '#888', border: '1px solid #333' }}
          >
            +
          </button>
        </div>
      </div>

      {!keyLockOff && (
        <div className="flex items-center gap-3 text-10px flex-wrap" style={{ color: '#666' }}>
          <span className="flex items-center gap-1">
            <span
              className="inline-block rounded-sm"
              style={{ width: 10, height: 10, background: PIANO.white, border: `1px solid ${PIANO.whiteBorder}` }}
            />
            In scale
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block rounded-sm"
              style={{
                width: 10,
                height: 10,
                background: PIANO.white,
                border: `1px solid ${PIANO.whiteBorder}`,
                boxShadow: `inset 0 -2px 0 0 ${NH_SCALE.accent}`,
              }}
            />
            Root ({NEURAL_HUM_KEY_NAMES[keyRoot]})
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block rounded-sm"
              style={{ width: 10, height: 10, background: '#303030', border: '1px solid #252525', opacity: 0.45 }}
            />
            Out of scale
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block rounded-sm"
              style={{ width: 10, height: 10, background: '#00ff88' }}
            />
            Live pitch
          </span>
        </div>
      )}

      <div
        className="relative select-none rounded-md overflow-hidden flex gap-px"
        style={{ height: 96, background: '#2a2a2a', border: '1px solid #333', padding: 2 }}
      >
        {Array.from({ length: OCTAVE_COUNT }, (_, i) => (
          <OctaveKeys
            key={octave + i}
            octave={octave + i}
            keyRoot={keyRoot}
            scaleSet={scaleSet}
            keyLockOff={keyLockOff}
            liveMidi={liveMidi}
            melodyMidis={melodyMidis}
            pressedMidi={pressedMidi}
            onNoteDown={onNoteDown}
            onNoteUp={onNoteUp}
          />
        ))}
      </div>

      {liveMidi != null && (
        <p className="text-10px text-center" style={{ color: '#00ff88' }}>
          Singing: {NEURAL_HUM_KEY_NAMES[((Math.round(liveMidi) % 12) + 12) % 12]}
          {Math.floor(Math.round(liveMidi) / 12) - 1}
        </p>
      )}
    </div>
  );
}
