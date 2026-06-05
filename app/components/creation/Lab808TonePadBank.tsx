import {
  GrooveStyleTCapVolumeFader,
  GrooveStyleTCapVolumeFaderStyles,
} from '@/app/components/creation/GrooveStyleTCapVolumeFader';
import { useCallback, useState, type CSSProperties, type PointerEvent } from 'react';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { pointerStrikeVelocity, type Lab808SoundLane } from '@/app/lib/creationStation/eightZeroEightVoice';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import {
  LAB808_CHORD_LOCK_SOURCE_LABELS,
  type Lab808ChordLockSource,
} from '@/app/lib/creationStation/lab808ChordLockSources';
import {
  LAB808_TONE_PAD_COUNT,
  isLab808BlackKeyMidi,
  lab808DefaultTonePadBaseMidi,
  lab808ShiftTonePadBase,
  lab808TonePadMidi,
  lab808TonePadNoteLabel,
  lab808TonePadRangeLabel,
} from '@/app/lib/creationStation/lab808TonePads';
import { Lab808MuteSoloButtons } from '@/app/components/creation/Lab808MuteSoloButtons';
const PAD_CELL_MIN_H = 52;
const PAD_GRID_GAP = 5;

/** Compact toolbar controls — short height so the 4×4 pad grid sits higher. */
const TONE_TOOL_BTN: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 6,
  border: '1px solid #52525b',
  background: '#27272f',
  color: '#fde68a',
  fontWeight: 800,
  fontSize: 11,
  lineHeight: 1.1,
  cursor: 'pointer',
  minHeight: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
};

const TONE_OCT_BTN: CSSProperties = {
  ...TONE_TOOL_BTN,
  padding: '2px 6px',
  minHeight: 24,
  fontSize: 10,
  color: '#d4d4d8',
  background: '#18181b',
  borderColor: '#3f3f46',
};

export interface Lab808TonePadBankProps {
  soundLane: Lab808SoundLane;
  onSoundLaneChange: (lane: Lab808SoundLane) => void;
  presetLabel: string;
  onPlayMidi: (midi: number, velocity01: number, holdBeats?: number, rootIndex?: number) => void;
  baseMidi?: number;
  onBaseMidiChange?: (midi: number) => void;
  chordRootLock: boolean;
  onChordRootLockChange: (on: boolean) => void;
  chordLockSource: Lab808ChordLockSource;
  onChordLockSourceChange: (source: Lab808ChordLockSource) => void;
  canGenerateChordRoots?: boolean;
  onGenerateChordRoots?: () => void;
  progressionRoots: readonly Lab808ProgressionRoot[];
  progressionConnected: boolean;
  progressionLabel: string | null;
  activeRootHighlight: number | null;
  /** 0–1 master level for kick/bass voice + roll. */
  masterLevel?: number;
  onMasterLevelChange?: (level: number) => void;
  muted?: boolean;
  solo?: boolean;
  onMutedToggle?: () => void;
  onSoloToggle?: () => void;
  /** When false, pad hits are silent (mute/solo — fader unchanged). */
  audible?: boolean;
}

function tonePadSurface(
  lane: Lab808SoundLane,
  blackKey: boolean,
  selected: boolean,
  lockedChord: boolean,
  playing: boolean,
): string {
  const kick = lane === 'kick';
  const accent = playing ? '#fde68a' : lockedChord ? '#7cf4c6' : kick ? '#ca8a04' : '#22c55e';
  const mix = playing ? 88 : selected ? 82 : blackKey ? 42 : 62;
  const base = blackKey ? '#0a0a0e' : '#14141c';
  return `linear-gradient(165deg, color-mix(in srgb, ${accent} ${mix}%, ${base}) 0%, #0c0c10 100%)`;
}

function tonePadBorder(lane: Lab808SoundLane, selected: boolean, lockedChord: boolean, playing: boolean): string {
  if (playing) return '#fde68a';
  if (selected) return lockedChord ? '#7cf4c6' : lane === 'kick' ? '#fde68a' : '#86efac';
  if (lockedChord) return 'color-mix(in srgb, #7cf4c6 55%, #3f3f46)';
  return lane === 'kick' ? 'color-mix(in srgb, #ca8a04 55%, #3f3f46)' : 'color-mix(in srgb, #22c55e 55%, #3f3f46)';
}

const LOCK_STRIP_W = 128;
const VOL_STRIP_W = 42;
const PAD_BLOCK_H = PAD_CELL_MIN_H * 4 + PAD_GRID_GAP * 3;
/** Reserve space for M/S row under the fader so the vol column matches pad height. */
const MS_ROW_H = 22;
const VOL_CHROME_H = 30;
const FADER_AREA_H = Math.max(48, PAD_BLOCK_H - VOL_CHROME_H - MS_ROW_H);

const CHORD_LOCK_SOURCES: Lab808ChordLockSource[] = ['chord-builder', 'groove-lab', 'new-synth'];

const SOURCE_SHORT: Record<Lab808ChordLockSource, string> = {
  'chord-builder': 'CB',
  'groove-lab': 'GL',
  'new-synth': 'NS',
};

export function Lab808TonePadBank({
  soundLane,
  onSoundLaneChange,
  presetLabel,
  onPlayMidi,
  baseMidi: baseMidiProp,
  onBaseMidiChange,
  chordRootLock,
  onChordRootLockChange,
  chordLockSource,
  onChordLockSourceChange,
  canGenerateChordRoots = false,
  onGenerateChordRoots,
  progressionRoots,
  progressionConnected,
  progressionLabel,
  activeRootHighlight,
  masterLevel = 0.92,
  onMasterLevelChange,
  muted = false,
  solo = false,
  onMutedToggle,
  onSoloToggle,
  audible = true,
}: Lab808TonePadBankProps) {
  const [baseInner, setBaseInner] = useState(lab808DefaultTonePadBaseMidi);
  const baseMidi = baseMidiProp ?? baseInner;
  const setBaseMidi = onBaseMidiChange ?? setBaseInner;
  const [selectedPad, setSelectedPad] = useState(-1);

  const locked = chordRootLock && progressionConnected;
  const rootCount = progressionRoots.length;

  const onPadPointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>, padIndex: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setSelectedPad(padIndex);
      if (!audible) return;
      const vel = pointerStrikeVelocity(e);
      if (locked) {
        const root = progressionRoots[padIndex];
        if (!root) return;
        onPlayMidi(root.midi, vel, root.durBeats, padIndex);
        return;
      }
      const midi = lab808TonePadMidi(baseMidi, padIndex);
      onPlayMidi(midi, vel);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [audible, baseMidi, locked, onPlayMidi, progressionRoots],
  );

  const laneBtn = (lane: Lab808SoundLane): CSSProperties => ({
    ...TONE_TOOL_BTN,
    borderColor: soundLane === lane ? (lane === 'kick' ? '#ca8a04' : '#22c55e') : '#52525b',
    background: soundLane === lane ? (lane === 'kick' ? '#422006' : '#052e16') : '#27272f',
    color: soundLane === lane ? (lane === 'kick' ? '#fde68a' : '#86efac') : '#a1a1aa',
  });

  const lockBtnStyle: CSSProperties = {
    ...TONE_TOOL_BTN,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    minHeight: 0,
    height: '100%',
    padding: '6px 6px',
    borderColor: chordRootLock ? '#7cf4c6' : '#3f3f46',
    background: chordRootLock ? 'rgba(124, 244, 198, 0.12)' : '#12121a',
    color: chordRootLock ? '#7cf4c6' : '#71717a',
    cursor: progressionConnected ? 'pointer' : 'not-allowed',
    opacity: progressionConnected ? 1 : 0.55,
  };

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '4px 8px 4px',
        flex: '0 0 auto',
        minHeight: 0,
      }}
      aria-label="808 Lab kick and bass keyboard pads"
    >
      <GrooveStyleTCapVolumeFaderStyles />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', color: '#71717a' }}>808 KEYS</span>
        <button type="button" onClick={() => onSoundLaneChange('kick')} style={laneBtn('kick')}>
          Kick
        </button>
        <button type="button" onClick={() => onSoundLaneChange('bass')} style={laneBtn('bass')}>
          Bass
        </button>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: soundLane === 'kick' ? '#ca8a04' : '#86efac',
            flex: '1 1 80px',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title="Same preset as piano roll"
        >
          {presetLabel}
        </span>
        {!locked ? (
          <>
            <button
              type="button"
              aria-label="Lower octave"
              onClick={() => setBaseMidi(lab808ShiftTonePadBase(baseMidi, -12))}
              style={TONE_OCT_BTN}
              title="Pads down one octave"
            >
              <ChevronDown size={14} />
              Oct−
            </button>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#a1a1aa', minWidth: 58, textAlign: 'center', lineHeight: 1.1 }}>
              {lab808TonePadRangeLabel(baseMidi)}
            </span>
            <button
              type="button"
              aria-label="Raise octave"
              onClick={() => setBaseMidi(lab808ShiftTonePadBase(baseMidi, 12))}
              style={TONE_OCT_BTN}
              title="Pads up one octave"
            >
              Oct+
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => setBaseMidi(lab808ShiftTonePadBase(baseMidi, -LAB808_TONE_PAD_COUNT))}
              style={TONE_OCT_BTN}
              title="Show 16 notes lower on the keyboard"
            >
              ◀ Rng
            </button>
            <button
              type="button"
              onClick={() => setBaseMidi(lab808ShiftTonePadBase(baseMidi, LAB808_TONE_PAD_COUNT))}
              style={TONE_OCT_BTN}
              title="Show 16 notes higher on the keyboard"
            >
              Rng ▶
            </button>
          </>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 800, color: '#7cf4c6', lineHeight: 1.2 }}>
            {rootCount} chord root{rootCount === 1 ? '' : 's'}
            {progressionLabel ? ` · ${progressionLabel}` : ''}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 6,
          flex: '0 0 auto',
          minHeight: 0,
          width: '100%',
          maxWidth: 720 + LOCK_STRIP_W + VOL_STRIP_W + 16,
          margin: '8px auto 0',
        }}
      >
        <aside
          style={{
            width: VOL_STRIP_W,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            height: PAD_BLOCK_H,
            maxHeight: PAD_BLOCK_H,
            padding: '4px 3px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.28)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
          aria-label="808 kick bass volume"
        >
          <span style={{ fontSize: 7, fontWeight: 800, color: '#6f7e8e', letterSpacing: '0.08em' }}>VOL</span>
          <div
            style={{
              position: 'relative',
              flex: '1 1 auto',
              width: '100%',
              minHeight: 0,
              maxHeight: FADER_AREA_H,
              height: FADER_AREA_H,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              borderRadius: 4,
              background: 'rgba(0,0,0,0.2)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            <GrooveStyleTCapVolumeFader
              channelId={0}
              volume={Math.round(Math.max(0, Math.min(1, masterLevel)) * 100)}
              accent={soundLane === 'kick' ? '#ca8a04' : '#22c55e'}
              onVolumeChange={(v) => onMasterLevelChange?.(Math.max(0, Math.min(1, v / 100)))}
              ariaLabel="808 kick bass level"
              style={{ height: '100%', minHeight: 0 }}
            />
          </div>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: '#aab6c4',
              fontFamily: 'monospace',
              lineHeight: 1,
            }}
          >
            {Math.round(Math.max(0, Math.min(1, masterLevel)) * 100)}
          </span>
          {onMutedToggle && onSoloToggle ? (
            <Lab808MuteSoloButtons
              muted={muted}
              solo={solo}
              accent={soundLane === 'kick' ? '#ca8a04' : '#22c55e'}
              onMuteToggle={onMutedToggle}
              onSoloToggle={onSoloToggle}
              bankLabel="Kick/Bass"
            />
          ) : null}
        </aside>
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
            gap: PAD_GRID_GAP,
            minWidth: 0,
            minHeight: PAD_BLOCK_H,
            height: PAD_BLOCK_H,
          }}
        >
          {Array.from({ length: LAB808_TONE_PAD_COUNT }, (_, padIndex) => {
            const root = locked ? progressionRoots[padIndex] : null;
            const inactive = locked && !root;
            const midi = root ? root.midi : lab808TonePadMidi(baseMidi, padIndex);
            const label = root ? root.chord : lab808TonePadNoteLabel(midi);
            const sub = root ? lab808TonePadNoteLabel(midi) : null;
            const black = !root && isLab808BlackKeyMidi(midi);
          const selected = selectedPad === padIndex;
          const playing = activeRootHighlight === padIndex;
          return (
            <button
              key={locked ? `root-${padIndex}-${root?.midi}` : `${baseMidi}-${padIndex}`}
              type="button"
              className="cs-pad-hit lab808-pad-hit"
              disabled={inactive}
              aria-label={root ? `${root.chord} root ${sub}` : `${soundLane} ${label}`}
              aria-pressed={selected || playing}
              onPointerDown={(e) => onPadPointerDown(e, padIndex)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minHeight: 0,
                height: '100%',
                padding: '6px 4px',
                borderRadius: 10,
                border: `2px solid ${tonePadBorder(soundLane, selected, Boolean(root), playing)}`,
                background: inactive
                  ? '#0a0a0c'
                  : tonePadSurface(soundLane, black, selected, Boolean(root), playing),
                boxShadow: playing
                  ? '0 0 22px rgba(253, 224, 108, 0.75), 0 0 12px rgba(124, 244, 198, 0.4)'
                  : selected
                    ? `0 0 16px color-mix(in srgb, ${root ? '#7cf4c6' : soundLane === 'kick' ? '#ca8a04' : '#22c55e'} 50%, transparent)`
                    : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  cursor: inactive ? 'default' : 'pointer',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  opacity: inactive ? 0.28 : 1,
                }}
              >
                <span
                  style={{
                    fontSize: root ? 13 : 15,
                    fontWeight: 900,
                    color: inactive ? '#52525b' : playing ? '#422006' : root ? '#ecfdf5' : black ? '#d4d4d8' : '#f4f4f5',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  {label}
                </span>
                {sub ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(124, 244, 198, 0.75)' }}>{sub}</span>
                ) : (
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.28)' }}>{padIndex + 1}</span>
                )}
              </button>
            );
          })}
        </div>

        <aside
          style={{
            width: LOCK_STRIP_W,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!progressionConnected) return;
              onChordRootLockChange(!chordRootLock);
            }}
            style={lockBtnStyle}
            title={
              progressionConnected
                ? chordRootLock
                  ? `Chord lock ON — following ${LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]}`
                  : `Lock pads to roots from ${LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]}`
                : `Add chords in ${LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]}, then enable lock`
            }
            aria-pressed={chordRootLock}
          >
            <Lock size={16} strokeWidth={chordRootLock ? 2.5 : 2} />
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.06em', lineHeight: 1.2, textAlign: 'center' }}>
              CHORD
              <br />
              LOCK
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 800,
                lineHeight: 1.15,
                textAlign: 'center',
                color: chordRootLock ? '#7cf4c6' : '#a1a1aa',
                letterSpacing: '0.02em',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
              title={LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]}
            >
              {LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]}
            </span>
          </button>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
            role="group"
            aria-label="Chord lock source"
          >
            {CHORD_LOCK_SOURCES.map((src) => {
              const active = chordLockSource === src;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => onChordLockSourceChange(src)}
                  style={{
                    ...TONE_OCT_BTN,
                    width: '100%',
                    minHeight: 22,
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    borderColor: active ? '#7cf4c6' : '#3f3f46',
                    background: active ? 'rgba(124, 244, 198, 0.14)' : '#18181b',
                    color: active ? '#7cf4c6' : '#71717a',
                  }}
                  title={`Lock to ${LAB808_CHORD_LOCK_SOURCE_LABELS[src]}`}
                  aria-pressed={active}
                >
                  {SOURCE_SHORT[src]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!chordRootLock || !canGenerateChordRoots || !onGenerateChordRoots}
            onClick={() => onGenerateChordRoots?.()}
            style={{
              ...TONE_OCT_BTN,
              width: '100%',
              minHeight: 28,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: '0.06em',
              borderColor: chordRootLock && canGenerateChordRoots ? '#ca8a04' : '#3f3f46',
              background:
                chordRootLock && canGenerateChordRoots
                  ? 'rgba(202, 138, 4, 0.18)'
                  : '#18181b',
              color: chordRootLock && canGenerateChordRoots ? '#fde68a' : '#52525b',
              cursor: chordRootLock && canGenerateChordRoots ? 'pointer' : 'default',
              opacity: chordRootLock ? 1 : 0.55,
            }}
            title={
              !chordRootLock
                ? 'Turn on CHORD LOCK first'
                : canGenerateChordRoots
                  ? `Write ${LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]} root notes to 808 Kick/Bass roll`
                  : `Add chords in ${LAB808_CHORD_LOCK_SOURCE_LABELS[chordLockSource]} first`
            }
          >
            GENERATE
            <br />
            ROOTS
          </button>
          <span style={{ fontSize: 7, fontWeight: 700, color: '#52525b', textAlign: 'center', lineHeight: 1.2 }}>
            {progressionConnected
              ? progressionLabel && chordLockSource === 'chord-builder'
                ? progressionLabel
                : `${rootCount} root${rootCount === 1 ? '' : 's'}`
              : 'No chords'}
          </span>
        </aside>
      </div>

    </section>
  );
}
