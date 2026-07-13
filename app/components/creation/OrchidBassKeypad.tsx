import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { OrchidBassKeyDef } from '@/app/lib/creationStation/orchidChordEngine';
import type { BassKeypadPreviewMode } from '@/app/hooks/useGrooveLabOrchid';
import { GrooveOctaveShiftButtons } from '@/app/components/creation/GrooveOctaveShiftButtons';
import { GROOVE_LAB_808_SUBROOTS_BANK_LABEL, GROOVE_LAB_SUBROOT_KEYPAD_LABEL } from '@/app/lib/creationStation/grooveLabBranding';
import {
  GROOVE_LAB_808_SUBROOT_SOUND_IDS,
  GROOVE_LAB_BASS_SOUNDS,
  type GrooveLabBassSoundId,
} from '@/app/lib/creationStation/grooveLabBassSounds';

export interface OrchidBassKeypadProps {
  chordBrandShort?: string;
  chordSoundBankLabel?: string;
  keys: OrchidBassKeyDef[];
  matchLabel: string;
  linkedChordVolume: number;
  onLinkedChordVolumeChange: (v: number) => void;
  linkedChordsMuted: boolean;
  onLinkedChordsMutedChange: (muted: boolean) => void;
  bassMuted?: boolean;
  onBassMutedChange?: (muted: boolean) => void;
  writeToPianoRoll: boolean;
  onWriteToPianoRollChange: (on: boolean) => void;
  onKeyDown: (midi: number) => void;
  onKeyUp?: (midi: number) => void;
  subRootNoteCount?: number;
  onClearAllSubRoots?: () => void;
  onSubOctaveDown?: () => void;
  onSubOctaveUp?: () => void;
  bassAutoAdvance?: boolean;
  onBassAutoAdvanceChange?: (on: boolean) => void;
  bassDrawNotes?: boolean;
  onBassDrawNotesChange?: (on: boolean) => void;
  /** Same as GEN MIDI BASS — fills roll with the selected MIDI pattern. */
  onDropMidiToGrid?: () => void;
  previewMode?: BassKeypadPreviewMode;
  onPreviewModeChange?: (mode: BassKeypadPreviewMode) => void;
  bassSoundId?: GrooveLabBassSoundId;
  onBassSoundChange?: (id: GrooveLabBassSoundId) => void;
  bassSoundLabel?: string;
  chordVoiceLabel?: string;
  /** In-key sub roots for the current chord path (keypad only until pushed). */
  suggestedSubMidis?: readonly number[];
  guideAuditionMidi?: number | null;
  subGuideStepCount?: number;
  onRegenerateSubGuide?: () => void;
  onAuditionSubGuide?: () => void;
  onStopSubGuideAudition?: () => void;
  onPushSubGuideToRoll?: () => void;
}

export function OrchidBassKeypad({
  chordBrandShort = 'Orchid',
  chordSoundBankLabel = 'ORCHID CHORD',
  keys,
  matchLabel,
  linkedChordVolume,
  onLinkedChordVolumeChange,
  linkedChordsMuted,
  onLinkedChordsMutedChange,
  bassMuted = false,
  onBassMutedChange,
  writeToPianoRoll,
  onWriteToPianoRollChange,
  onKeyDown,
  onKeyUp,
  subRootNoteCount = 0,
  onClearAllSubRoots,
  onSubOctaveDown,
  onSubOctaveUp,
  bassAutoAdvance = false,
  onBassAutoAdvanceChange,
  bassDrawNotes = false,
  onBassDrawNotesChange,
  onDropMidiToGrid,
  previewMode = 'bass',
  onPreviewModeChange,
  bassSoundId,
  onBassSoundChange,
  bassSoundLabel = 'Bass',
  chordVoiceLabel = 'Piano',
  suggestedSubMidis = [],
  guideAuditionMidi = null,
  subGuideStepCount = 0,
  onRegenerateSubGuide,
  onAuditionSubGuide,
  onStopSubGuideAudition,
  onPushSubGuideToRoll,
}: OrchidBassKeypadProps) {
  const suggestedSet = useMemo(
    () => new Set(suggestedSubMidis.map((m) => Math.round(m))),
    [suggestedSubMidis],
  );
  const [active, setActive] = useState<Set<number>>(() => new Set());
  const pointerIdsRef = useRef<Map<number, number>>(new Map());

  const press = useCallback(
    (midi: number) => {
      setActive((prev) => {
        const next = new Set(prev);
        next.add(midi);
        return next;
      });
      onKeyDown(midi);
    },
    [onKeyDown],
  );

  const release = useCallback(
    (midi: number) => {
      setActive((prev) => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
      onKeyUp?.(midi);
    },
    [onKeyUp],
  );

  const linkedAudible = !linkedChordsMuted && linkedChordVolume > 0.02;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        borderLeft: '1px solid #1a2e22',
        padding: '6px 10px 8px 12px',
        background: 'linear-gradient(180deg, #080a12 0%, #050508 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.6, color: '#93c5fd' }}>
          {GROOVE_LAB_SUBROOT_KEYPAD_LABEL}
        </span>
        <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 700 }}>sub roots</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#e0e7ff' }}>{matchLabel}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 8,
          padding: '5px 8px',
          borderRadius: 6,
          background: '#0a0f18',
          border: '1px solid #1e293b',
        }}
      >
        <span style={{ fontSize: 8, color: '#60a5fa', fontWeight: 900 }}>HEAR: SUB</span>
        {onBassMutedChange ? (
          <button
            type="button"
            onClick={() => onBassMutedChange(!bassMuted)}
            title="Mute blue 808 sub layer (keypad, roll transport, pitch preview)"
            style={{
              background: bassMuted ? '#2a1411' : '#0e2838',
              color: bassMuted ? '#fb923c' : '#67e8f9',
              border: `1px solid ${bassMuted ? '#7c2d12' : '#3b82f688'}`,
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {bassMuted ? 'SUB MUTED' : 'SUB ON'}
          </button>
        ) : null}
        {onBassSoundChange && bassSoundId ? (
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6b7280' }}
            title={`${GROOVE_LAB_808_SUBROOTS_BANK_LABEL} timbre — not bass guitar / Moog (production bass → NEW SYNTH)`}
          >
            SUB SOUND
            <select
              value={bassSoundId}
              onChange={(e) => onBassSoundChange(e.target.value as GrooveLabBassSoundId)}
              style={{
                background: '#0a0e16',
                color: '#93c5fd',
                border: '1px solid #1e3a5f',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 8,
                fontWeight: 800,
                maxWidth: 160,
              }}
            >
              {GROOVE_LAB_808_SUBROOT_SOUND_IDS.map((id) => {
                const s = GROOVE_LAB_BASS_SOUNDS.find((x) => x.id === id);
                return (
                  <option key={id} value={id}>
                    {s?.label ?? id}
                  </option>
                );
              })}
            </select>
          </label>
        ) : (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: '#93c5fd',
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={`Key press = ${GROOVE_LAB_808_SUBROOTS_BANK_LABEL} only (blue C1–C3 layer)`}
          >
            {bassSoundLabel}
          </span>
        )}
        <span style={{ fontSize: 8, color: '#4b5563' }}>|</span>
        <span style={{ fontSize: 8, color: '#4ade80', fontWeight: 800 }}>+ CHORD</span>
        <button
          type="button"
          onClick={() => onLinkedChordsMutedChange(!linkedChordsMuted)}
          title={`Optional: also audition ${chordBrandShort} chord with each key (turn off to hear 808 sub alone)`}
          style={{
            background: linkedChordsMuted ? '#2a1411' : '#112015',
            color: linkedChordsMuted ? '#fb923c' : '#86efac',
            border: `1px solid ${linkedChordsMuted ? '#7c2d12' : '#1f3a29'}`,
            borderRadius: 5,
            padding: '2px 8px',
            fontSize: 8,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {linkedChordsMuted ? 'CHORD LAYER OFF' : 'CHORD LAYER ON'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={linkedChordVolume}
          onChange={(e) => onLinkedChordVolumeChange(Number(e.target.value))}
          title={`${chordBrandShort} chord layer: ${chordVoiceLabel}`}
          style={{ width: 72, accentColor: '#22c55e' }}
          disabled={linkedChordsMuted}
        />
        <span
          style={{
            fontSize: 9,
            color: linkedAudible ? '#86efac' : '#6b7280',
            fontWeight: 900,
            minWidth: 28,
          }}
          title={chordVoiceLabel}
        >
          {linkedChordsMuted ? '—' : `${Math.round(linkedChordVolume * 100)}%`}
        </span>

        <div style={{ width: 1, height: 14, background: '#1f2937' }} />

        {onRegenerateSubGuide ? (
          <button
            type="button"
            disabled={subGuideStepCount === 0}
            onClick={onRegenerateSubGuide}
            title="New in-key sub path for your chord columns — lights keys only (roll unchanged)"
            style={{
              background: subGuideStepCount === 0 ? '#242424' : '#1a2744',
              color: subGuideStepCount === 0 ? '#4b5563' : '#93c5fd',
              border: `1px solid ${subGuideStepCount === 0 ? '#2c2c2c' : '#3b82f688'}`,
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: subGuideStepCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            REGEN SUB PATH
          </button>
        ) : null}
        {onAuditionSubGuide ? (
          <button
            type="button"
            disabled={subGuideStepCount === 0}
            onClick={onAuditionSubGuide}
            title="Hear the suggested sub roots across your chord columns"
            style={{
              background: subGuideStepCount === 0 ? '#242424' : '#0e2838',
              color: subGuideStepCount === 0 ? '#4b5563' : '#67e8f9',
              border: `1px solid ${subGuideStepCount === 0 ? '#2c2c2c' : '#22d3ee55'}`,
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: subGuideStepCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            HEAR PATH
          </button>
        ) : null}
        {onStopSubGuideAudition && guideAuditionMidi != null ? (
          <button
            type="button"
            onClick={onStopSubGuideAudition}
            style={{
              background: '#2a1411',
              color: '#fb923c',
              border: '1px solid #7c2d12',
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            STOP
          </button>
        ) : null}
        {onPushSubGuideToRoll ? (
          <button
            type="button"
            disabled={subGuideStepCount === 0}
            onClick={onPushSubGuideToRoll}
            title="Write the lit sub path to the blue piano-roll lane"
            style={{
              background: subGuideStepCount === 0 ? '#242424' : '#2a1411',
              color: subGuideStepCount === 0 ? '#4b5563' : '#fdba74',
              border: `1px solid ${subGuideStepCount === 0 ? '#2c2c2c' : '#ea580c'}`,
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: subGuideStepCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            → PUSH SUBS
          </button>
        ) : null}
        {onSubOctaveDown && onSubOctaveUp ? (
          <GrooveOctaveShiftButtons
            layerLabel="SUB"
            accentColor="#fb923c"
            borderColor="#ea580c"
            noteCount={subRootNoteCount}
            onOctaveDown={onSubOctaveDown}
            onOctaveUp={onSubOctaveUp}
            downTitle="All blue 808 sub roots — down one octave (C1–C3)"
            upTitle="All blue 808 sub roots — up one octave (C1–C3)"
          />
        ) : null}

        {onClearAllSubRoots ? (
          <button
            type="button"
            disabled={subRootNoteCount === 0}
            onClick={onClearAllSubRoots}
            title={`Remove all blue ${GROOVE_LAB_808_SUBROOTS_BANK_LABEL} notes from the piano roll — keeps green chords and amber melody`}
            style={{
              background: subRootNoteCount === 0 ? '#242424' : '#2a1411',
              color: subRootNoteCount === 0 ? '#4b5563' : '#fb923c',
              border: `1px solid ${subRootNoteCount === 0 ? '#2c2c2c' : '#7c2d12'}`,
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: subRootNoteCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ERASE ALL SUB{subRootNoteCount > 0 ? ` (${subRootNoteCount})` : ''}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onWriteToPianoRollChange(!writeToPianoRoll)}
          title="Write 808 sub roots to the piano roll (click a grid column first, or turn ADVANCE on)"
          style={{
            background: writeToPianoRoll ? '#0e2838' : '#242424',
            color: writeToPianoRoll ? '#67e8f9' : '#6b7280',
            border: `1px solid ${writeToPianoRoll ? '#3b82f688' : '#2c2c2c'}`,
            borderRadius: 5,
            padding: '2px 8px',
            fontSize: 8,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {writeToPianoRoll ? '→ PIANO ROLL ON' : '→ PIANO ROLL OFF'}
        </button>
        {onDropMidiToGrid ? (
          <button
            type="button"
            onClick={onDropMidiToGrid}
            title="Generate melody from green chords onto the amber roll lane"
            style={{
              background: '#1a2744',
              color: '#c4b5fd',
              border: '1px solid #6366f188',
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            DROP MELODY
          </button>
        ) : null}
        {onBassDrawNotesChange ? (
          <button
            type="button"
            onClick={() => onBassDrawNotesChange(!bassDrawNotes)}
            title="Paint blue 808 sub roots on the piano roll grid"
            style={{
              background: bassDrawNotes ? '#1e3a8a' : '#242424',
              color: bassDrawNotes ? '#bfdbfe' : '#6b7280',
              border: `1px solid ${bassDrawNotes ? '#60a5fa' : '#2c2c2c'}`,
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {bassDrawNotes ? 'DRAW NOTES ON' : 'DRAW NOTES'}
          </button>
        ) : null}
        {onBassAutoAdvanceChange ? (
          <button
            type="button"
            onClick={() => onBassAutoAdvanceChange(!bassAutoAdvance)}
            title="After each sub key, move the edit column to the next step"
            style={{
              background: bassAutoAdvance ? '#1a2e4a' : '#242424',
              color: bassAutoAdvance ? '#93c5fd' : '#6b7280',
              border: `1px solid ${bassAutoAdvance ? '#3b82f688' : '#2c2c2c'}`,
              borderRadius: 5,
              padding: '2px 8px',
              fontSize: 8,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {bassAutoAdvance ? 'ADVANCE ON' : 'ADVANCE OFF'}
          </button>
        ) : null}
      </div>

      <p style={{ margin: '0 0 8px', fontSize: 8, color: '#4b5563', fontWeight: 600, lineHeight: 1.35 }}>
        <strong style={{ color: '#fb923c' }}>Orange keys</strong> = in-key subs for your green chords
        {subGuideStepCount > 0 ? ` (${subGuideStepCount} steps)` : ''}. Play them live — use{' '}
        <strong style={{ color: '#fdba74' }}>→ PUSH SUBS</strong> only if you want the roll. Production bass →{' '}
        <strong style={{ color: '#a78bfa' }}>NEW SYNTH</strong>.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: 3,
          height: 92,
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {keys.map((k) => {
          const on = active.has(k.midi);
          const suggested = suggestedSet.has(k.midi);
          const auditioning = guideAuditionMidi === k.midi;
          return (
            <button
              key={k.midi}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                pointerIdsRef.current.set(e.pointerId, k.midi);
                press(k.midi);
              }}
              onPointerUp={(e) => {
                if (pointerIdsRef.current.get(e.pointerId) === k.midi) {
                  pointerIdsRef.current.delete(e.pointerId);
                  release(k.midi);
                }
              }}
              onPointerCancel={(e) => {
                if (pointerIdsRef.current.get(e.pointerId) === k.midi) {
                  pointerIdsRef.current.delete(e.pointerId);
                  release(k.midi);
                }
              }}
              title={
                suggested
                  ? `${k.label} — suggested sub for your chord path`
                  : k.isDiatonic
                    ? `${k.label} — in key`
                    : `${k.label} — chromatic`
              }
              style={{
                borderRadius: 6,
                border: `1px solid ${
                  on || auditioning
                    ? '#60a5fa'
                    : suggested
                      ? '#fb923c'
                      : k.isDiatonic
                        ? '#1e40af88'
                        : '#2a2a2a'
                }`,
                boxShadow:
                  suggested && !on
                    ? auditioning
                      ? '0 0 12px #fb923caa'
                      : '0 0 8px #ea580c66'
                    : undefined,
                background: on || auditioning
                  ? 'linear-gradient(180deg,#2563eb 0%,#1d4ed8 100%)'
                  : suggested
                    ? 'linear-gradient(180deg,#431407 0%,#1c0a04 100%)'
                    : k.isBlack
                      ? 'linear-gradient(180deg,#121218 0%,#18181e 100%)'
                      : k.isDiatonic
                        ? 'linear-gradient(180deg,#1a2744 0%,#111827 100%)'
                        : 'linear-gradient(180deg,#2a2a2a 0%,#0e0e0e 100%)',
                color: on || auditioning ? '#f0f9ff' : suggested ? '#fdba74' : k.isDiatonic ? '#93c5fd' : '#6b7280',
                fontSize: k.isBlack ? 8 : 10,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 6,
              }}
            >
              {k.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
