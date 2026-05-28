import type { CSSProperties } from 'react';
import { GrooveOctaveShiftButtons } from '@/app/components/creation/GrooveOctaveShiftButtons';
import type { GrooveComposerPart } from '@/app/lib/creationStation/grooveComposerEngine';
import { GROOVE_LAB_808_SUBROOTS_BANK_LABEL } from '@/app/lib/creationStation/grooveLabBranding';
import { GROOVE_LAB_REGISTER_LABELS } from '@/app/lib/creationStation/grooveLabPitch';
import type { GrooveLabBassSoundId } from '@/app/lib/creationStation/grooveLabBassSounds';
import { GROOVE_LAB_BASS_SOUND_GROUPS, GROOVE_LAB_BASS_SOUNDS } from '@/app/lib/creationStation/grooveLabBassSounds';

export interface GrooveLabComposerPanelProps {
  grooveBranding?: boolean;
  /** Preview timbre for melody/riff/arp (guitar / pluck presets). */
  melodySoundId: GrooveLabBassSoundId;
  onMelodySoundChange: (id: GrooveLabBassSoundId) => void;
  complexity: number;
  onComplexityChange: (v: number) => void;
  onGeneratePart: (part: GrooveComposerPart) => void;
  onLockChords: () => void;
  chordColumnCount: number;
  melodyNoteCount: number;
  subRootNoteCount?: number;
  onClearAllSubRoots?: () => void;
  onSubOctaveDown?: () => void;
  onSubOctaveUp?: () => void;
  melodyLayerNoteCount?: number;
  onMelodyOctaveDown?: () => void;
  onMelodyOctaveUp?: () => void;
  onRegenerateSubGuide?: () => void;
  onAuditionSubGuide?: () => void;
  onPushSubGuideToRoll?: () => void;
  subGuideStepCount?: number;
}

const selectStyle: CSSProperties = {
  background: '#0a0e16',
  color: '#fbbf24',
  border: '1px solid #422006',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 8,
  fontWeight: 800,
  maxWidth: 200,
};

const btnStyle = (accent: string, border: string): CSSProperties => ({
  background: '#111820',
  color: accent,
  border: `1px solid ${border}`,
  borderRadius: 5,
  padding: '4px 10px',
  fontSize: 8,
  fontWeight: 900,
  cursor: 'pointer',
});

export function GrooveLabComposerPanel({
  grooveBranding = false,
  melodySoundId,
  onMelodySoundChange,
  complexity,
  onComplexityChange,
  onGeneratePart,
  onLockChords,
  chordColumnCount,
  melodyNoteCount,
  subRootNoteCount = 0,
  onClearAllSubRoots,
  onSubOctaveDown,
  onSubOctaveUp,
  melodyLayerNoteCount = 0,
  onMelodyOctaveDown,
  onMelodyOctaveUp,
  onRegenerateSubGuide,
  onAuditionSubGuide,
  onPushSubGuideToRoll,
  subGuideStepCount = 0,
}: GrooveLabComposerPanelProps) {
  const chordBrand = grooveBranding ? 'Groove' : 'Orchid';
  const hasChords = chordColumnCount > 0;
  const disabled = !hasChords;

  return (
    <div
      style={{
        padding: '6px 10px 8px',
        borderBottom: '1px solid #1a2e22',
        background: '#060a10',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5, color: '#fbbf24' }}>
          MELODY & RIFFS
        </span>
        <span style={{ fontSize: 7, color: '#a78bfa', fontWeight: 800 }}>
          follows green chords · {GROOVE_LAB_REGISTER_LABELS.melody} lead lane
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6b7280' }}>
          SOUND
          <select
            value={melodySoundId}
            onChange={(e) => onMelodySoundChange(e.target.value as GrooveLabBassSoundId)}
            style={selectStyle}
            title="Melody / riff preview timbre"
          >
            {GROOVE_LAB_BASS_SOUND_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.ids.map((id) => {
                    const s = GROOVE_LAB_BASS_SOUNDS.find((x) => x.id === id);
                    return (
                      <option key={id} value={id}>
                        {s?.label ?? id}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8, color: '#6b7280' }}>
          COMPLEXITY
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(complexity * 100)}
            onChange={(e) => onComplexityChange(Number(e.target.value) / 100)}
            style={{ width: 72, accentColor: '#fbbf24' }}
          />
          <span style={{ color: '#fbbf24', fontWeight: 800, minWidth: 24 }}>{Math.round(complexity * 100)}%</span>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGeneratePart('melody')}
          style={{
            ...btnStyle('#fde68a', '#ca8a04aa'),
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          title="Lead melody from chord timeline"
        >
          MELODY
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGeneratePart('riff')}
          style={{
            ...btnStyle('#fcd34d', '#eab308aa'),
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          title="Guitar-style rhythmic cells"
        >
          RIFF
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGeneratePart('arp')}
          style={{
            ...btnStyle('#fbbf24', '#d97706aa'),
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          title="Chord-tone arpeggio fills"
        >
          ARP
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGeneratePart('melody')}
          style={{
            ...btnStyle('#a78bfa', '#7c3aed88'),
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 7,
          }}
          title="New seed — regenerates melody"
        >
          VARIATION
        </button>
        {onMelodyOctaveDown && onMelodyOctaveUp ? (
          <GrooveOctaveShiftButtons
            layerLabel="LEAD"
            accentColor="#fbbf24"
            borderColor="#d97706"
            noteCount={melodyLayerNoteCount}
            onOctaveDown={onMelodyOctaveDown}
            onOctaveUp={onMelodyOctaveUp}
            downTitle="All amber melody / riff notes — down one octave"
            upTitle="All amber melody / riff notes — up one octave"
          />
        ) : null}
        {onSubOctaveDown && onSubOctaveUp ? (
          <GrooveOctaveShiftButtons
            layerLabel="SUB"
            accentColor="#fb923c"
            borderColor="#ea580c"
            noteCount={subRootNoteCount}
            onOctaveDown={onSubOctaveDown}
            onOctaveUp={onSubOctaveUp}
            downTitle="All blue 808 sub roots — down one octave"
            upTitle="All blue 808 sub roots — up one octave"
          />
        ) : null}
        {onRegenerateSubGuide ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onRegenerateSubGuide}
            style={{
              ...btnStyle('#93c5fd', '#3b82f666'),
              opacity: disabled ? 0.45 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 7,
            }}
            title="Light orange sub keys on the 808 keypad (does not write the roll)"
          >
            LIGHT SUB KEYS
          </button>
        ) : null}
        {onAuditionSubGuide ? (
          <button
            type="button"
            disabled={disabled || subGuideStepCount === 0}
            onClick={onAuditionSubGuide}
            style={{
              ...btnStyle('#67e8f9', '#22d3ee55'),
              opacity: disabled || subGuideStepCount === 0 ? 0.45 : 1,
              cursor: disabled || subGuideStepCount === 0 ? 'not-allowed' : 'pointer',
              fontSize: 7,
            }}
          >
            HEAR SUB PATH
          </button>
        ) : null}
        {onPushSubGuideToRoll ? (
          <button
            type="button"
            disabled={disabled || subGuideStepCount === 0}
            onClick={onPushSubGuideToRoll}
            style={{
              ...btnStyle('#fb923c', '#ea580c88'),
              opacity: disabled || subGuideStepCount === 0 ? 0.45 : 1,
              cursor: disabled || subGuideStepCount === 0 ? 'not-allowed' : 'pointer',
              fontSize: 7,
            }}
            title="Optional — write the lit sub path to the blue roll lane"
          >
            PUSH SUBS
          </button>
        ) : null}
        {onClearAllSubRoots ? (
          <button
            type="button"
            disabled={subRootNoteCount === 0}
            onClick={onClearAllSubRoots}
            style={{
              ...btnStyle('#fb923c', '#7c2d12aa'),
              opacity: subRootNoteCount === 0 ? 0.45 : 1,
              cursor: subRootNoteCount === 0 ? 'not-allowed' : 'pointer',
              fontSize: 7,
            }}
            title={`Remove all blue ${GROOVE_LAB_808_SUBROOTS_BANK_LABEL} from the roll — keeps chords and melody`}
          >
            ERASE ALL SUB{subRootNoteCount > 0 ? ` (${subRootNoteCount})` : ''}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onLockChords}
          style={btnStyle('#86efac', '#22c55e66')}
          title={`Adds green chord stacks from ${chordBrand} — optional after you have a bass column`}
        >
          MATCH CHORDS ←
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 8, color: '#4b5563', lineHeight: 1.35 }}>
        <strong style={{ color: '#fbbf24' }}>Amber lane</strong> = melody / riffs / arps from{' '}
        <strong style={{ color: '#4ade80' }}>green chords</strong> ({chordColumnCount} col
        {chordColumnCount === 1 ? '' : 's'}). {melodyNoteCount} melody hit
        {melodyNoteCount === 1 ? '' : 's'}. Drop chords first ({chordBrand} Studio), then MELODY / RIFF / ARP.
        <strong style={{ color: '#fb923c' }}>808 keypad</strong> lights in-key subs — <strong style={{ color: '#fdba74' }}>PUSH SUBS</strong> only if you want the roll.
      </p>
    </div>
  );
}
