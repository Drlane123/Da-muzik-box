import type { CSSProperties } from 'react';
import type { GrooveLabBassGrooveId } from '@/app/lib/creationStation/grooveLabBassGrooves';
import {
  GROOVE_LAB_BASS_GROOVES,
  GROOVE_LAB_MIDI_PATTERN_GROUPS,
  grooveLabBassGroovesForFamily,
} from '@/app/lib/creationStation/grooveLabBassGrooves';
import type { GrooveLabBassSoundId } from '@/app/lib/creationStation/grooveLabBassSounds';
import {
  GROOVE_LAB_BASS_SOUND_GROUPS,
  GROOVE_LAB_BASS_SOUNDS,
} from '@/app/lib/creationStation/grooveLabBassSounds';

export interface GrooveLabBassGroovePanelProps {
  grooveBranding?: boolean;
  bassSoundId: GrooveLabBassSoundId;
  onBassSoundChange: (id: GrooveLabBassSoundId) => void;
  grooveId: GrooveLabBassGrooveId;
  onGrooveChange: (id: GrooveLabBassGrooveId) => void;
  onGenerateBassline: () => void;
  onLockChords: () => void;
  onMatchBassToChords?: () => void;
  chordColumnCount?: number;
  bassNoteCount: number;
  bassMuted?: boolean;
  onBassMutedChange?: (muted: boolean) => void;
}

const selectStyle: CSSProperties = {
  background: '#0a0e16',
  color: '#93c5fd',
  border: '1px solid #1e3a5f',
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

export function GrooveLabBassGroovePanel({
  grooveBranding = false,
  bassSoundId,
  onBassSoundChange,
  grooveId,
  onGrooveChange,
  onGenerateBassline,
  onLockChords,
  onMatchBassToChords,
  chordColumnCount = 0,
  bassNoteCount,
  bassMuted = false,
  onBassMutedChange,
}: GrooveLabBassGroovePanelProps) {
  const chordBrand = grooveBranding ? 'Groove' : 'Orchid';
  const currentGroove = GROOVE_LAB_BASS_GROOVES.find((g) => g.id === grooveId);

  return (
    <div
      style={{
        padding: '6px 10px 8px',
        borderBottom: '1px solid #1a2e22',
        background: '#060a10',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5, color: '#67e8f9' }}>
          MIDI BASSLINE LIBRARY
        </span>
        <span style={{ fontSize: 7, color: '#60a5fa', fontWeight: 800 }}>
          blue B = low root notes only (C1–C3)
        </span>
        {onBassMutedChange ? (
          <button
            type="button"
            onClick={() => onBassMutedChange(!bassMuted)}
            title="Mute blue bass playback (keypad + piano roll transport)"
            style={btnStyle(bassMuted ? '#fb923c' : '#67e8f9', bassMuted ? '#7c2d12' : '#3b82f688')}
          >
            {bassMuted ? 'BASS MUTED' : 'BASS ON'}
          </button>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6b7280' }}>
          SOUND
          <select
            value={bassSoundId}
            onChange={(e) => onBassSoundChange(e.target.value as GrooveLabBassSoundId)}
            style={selectStyle}
            title="Playback timbre — 808 sub, bass guitar, or Moog (does not change MIDI pattern)"
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#6b7280' }}>
          MIDI PATTERN
          <select
            value={grooveId}
            onChange={(e) => onGrooveChange(e.target.value as GrooveLabBassGrooveId)}
            style={{ ...selectStyle, maxWidth: 220 }}
            title="808 vs guitar rhythm templates — writes blue bass MIDI to the grid"
          >
            {GROOVE_LAB_MIDI_PATTERN_GROUPS.map((group) => (
              <optgroup key={group.family} label={group.label}>
                {grooveLabBassGroovesForFamily(group.family).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} · {g.genre}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onGenerateBassline}
          style={btnStyle('#93c5fd', '#3b82f666')}
          title="Generate bass-only MIDI into the piano roll (uses pattern + bass root)"
        >
          GEN MIDI BASS
        </button>
        <button
          type="button"
          onClick={onLockChords}
          disabled={bassNoteCount === 0}
          style={{
            ...btnStyle('#86efac', '#22c55e66'),
            opacity: bassNoteCount === 0 ? 0.45 : 1,
            cursor: bassNoteCount === 0 ? 'not-allowed' : 'pointer',
          }}
          title={`Adds green C notes (${chordBrand} piano/strings) on the chord channel — follows each blue bass column`}
        >
          MATCH CHORDS ←
        </button>
        {onMatchBassToChords ? (
          <button
            type="button"
            onClick={onMatchBassToChords}
            disabled={chordColumnCount === 0}
            style={{
              ...btnStyle('#93c5fd', '#3b82f666'),
              opacity: chordColumnCount === 0 ? 0.45 : 1,
              cursor: chordColumnCount === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Generate blue bass from existing green chord columns"
          >
            MATCH BASS →
          </button>
        ) : null}
      </div>
      <p style={{ margin: 0, fontSize: 8, color: '#4b5563', lineHeight: 1.35 }}>
        <strong style={{ color: '#60a5fa' }}>Blue bass only</strong> —{' '}
        <strong style={{ color: '#93c5fd' }}>GEN MIDI BASS</strong> writes the low lane (C1–C3).{' '}
        <strong style={{ color: '#4ade80' }}>Green chords only</strong> — use {chordBrand} Studio /{' '}
        <strong style={{ color: '#86efac' }}>DROP CHORDS</strong> first, then optional{' '}
        <strong style={{ color: '#93c5fd' }}>MATCH BASS →</strong>.{' '}
        <strong style={{ color: '#86efac' }}>MATCH CHORDS ←</strong> is optional after bass exists.
        {currentGroove ? (
          <span style={{ color: '#374151' }}>
            {' '}
            · now: {currentGroove.label} ({currentGroove.family})
          </span>
        ) : null}
      </p>
    </div>
  );
}
