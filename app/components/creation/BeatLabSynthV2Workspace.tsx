/**
 * Logic-style NEW SYNTH layout: instrument editor (top) + piano roll / MIDI keys (bottom).
 */
import React, { useEffect, useState } from 'react';

type WorkspaceProps = {
  synthEditor: React.ReactNode;
  pianoRoll: React.ReactNode;
  /** Extra controls in the piano-roll strip (octave, chord guide, …). */
  rollHeaderExtra?: React.ReactNode;
  /** Open the roll when transport plays (playhead DOM must exist for WAAPI). */
  isPlaying?: boolean;
  /** Bump (e.g. Groove → NEW SYNTH import) to expand the roll and show chords. */
  expandRollKey?: number;
  /** Parent can relaunch compositor playline after the roll mounts mid-play. */
  onRollOpenChange?: (open: boolean) => void;
};

export function BeatLabSynthV2Workspace({
  synthEditor,
  pianoRoll,
  rollHeaderExtra,
  isPlaying = false,
  expandRollKey = 0,
  onRollOpenChange,
}: WorkspaceProps) {
  const [rollOpen, setRollOpen] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    setRollOpen((prev) => {
      if (!prev) onRollOpenChange?.(true);
      return true;
    });
  }, [isPlaying, onRollOpenChange]);

  useEffect(() => {
    if (expandRollKey <= 0) return;
    setRollOpen((prev) => {
      if (!prev) onRollOpenChange?.(true);
      return true;
    });
  }, [expandRollKey, onRollOpenChange]);

  const setRollOpenTracked = (next: boolean | ((prev: boolean) => boolean)) => {
    setRollOpen((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (resolved !== prev) onRollOpenChange?.(resolved);
      return resolved;
    });
  };
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
        background: '#050508',
      }}
    >
      <div
        style={{
          flex: rollOpen ? '0 1 42%' : '1 1 auto',
          minHeight: 140,
          maxHeight: rollOpen ? '46vh' : undefined,
          overflow: 'auto',
          borderBottom: rollOpen ? '1px solid rgba(124, 244, 198, 0.14)' : 'none',
          background: 'linear-gradient(180deg, #06080f 0%, #050507 100%)',
        }}
      >
        {synthEditor}
      </div>
      <div
        style={{
          flex: rollOpen ? '1 1 58%' : '0 0 auto',
          minHeight: rollOpen ? 220 : 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: rollOpen ? undefined : '1px solid rgba(88, 196, 255, 0.12)',
          background: rollOpen ? undefined : 'rgba(88, 196, 255, 0.03)',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: '4px 10px',
            borderBottom: '1px solid rgba(88, 196, 255, 0.12)',
            background: 'rgba(88, 196, 255, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 900, color: '#58c4ff', letterSpacing: 0.6 }}>
            PIANO ROLL
          </span>
          {rollOpen ? (
            <span style={{ fontSize: 8, color: '#7a8899', fontWeight: 600, lineHeight: 1.35 }}>
              Chord progression only (piano, strings, organ) — separate from bass presets in the panel above
            </span>
          ) : (
            <span style={{ fontSize: 8, color: '#7a8899', fontWeight: 600, lineHeight: 1.35 }}>
              Minimized for Glide-first view
            </span>
          )}
          <button
            type="button"
            onClick={() => setRollOpenTracked((v) => !v)}
            style={{
              marginLeft: 'auto',
              fontSize: 8,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid #3a4860',
              background: '#121820',
              color: '#d8e4f8',
              cursor: 'pointer',
            }}
          >
            {rollOpen ? 'Minimize piano roll' : 'Open piano roll'}
          </button>
          {rollOpen && rollHeaderExtra ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {rollHeaderExtra}
            </div>
          ) : null}
        </div>
        {rollOpen ? (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>{pianoRoll}</div>
        ) : null}
      </div>
    </div>
  );
}
