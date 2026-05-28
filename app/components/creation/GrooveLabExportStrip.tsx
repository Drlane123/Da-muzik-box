import type { CSSProperties } from 'react';

export type GrooveLabExportStripProps = {
  busy?: boolean;
  status?: string | null;
  /** Green chord notes on the roll (WAV / pad). */
  hasChords: boolean;
  /** Any note on the roll (MIDI download). */
  hasRollNotes: boolean;
  onExportMidi?: () => void;
  onExportWav?: () => void | Promise<void>;
  onExportToPad?: () => void | Promise<void>;
  /** Creation Station: send green chord roll → Beat Lab NEW SYNTH piano roll. */
  onSendToNewSynth?: () => void;
  /** False when not inside Creation Station (pad loader unavailable). */
  padExportEnabled?: boolean;
  compact?: boolean;
};

function exportBtn(enabled: boolean, accent: string): CSSProperties {
  return {
    background: enabled ? '#0c1520' : '#111',
    color: enabled ? accent : '#444',
    border: `1px solid ${enabled ? accent + '66' : '#222'}`,
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 8,
    fontWeight: 900,
    cursor: enabled ? 'pointer' : 'not-allowed',
    letterSpacing: 0.3,
    opacity: enabled ? 1 : 0.55,
  };
}

export function GrooveLabExportStrip({
  busy = false,
  status = null,
  hasChords,
  hasRollNotes,
  onExportMidi,
  onExportWav,
  onExportToPad,
  onSendToNewSynth,
  padExportEnabled = true,
  compact = false,
}: GrooveLabExportStripProps) {
  if (!onExportMidi && !onExportWav && !onExportToPad && !onSendToNewSynth) return null;

  const midiOk = !busy && hasRollNotes;
  const wavOk = !busy && hasChords;
  const padOk = !busy && hasChords && padExportEnabled;
  const synthOk = !busy && hasChords;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 5 : 8,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 900,
          color: '#fde68a',
          letterSpacing: 0.5,
        }}
      >
        EXPORT
      </span>
      {onExportMidi ? (
        <button
          type="button"
          disabled={!midiOk}
          onClick={() => onExportMidi()}
          title="Download piano roll as .mid (bass + chords) — drag into any DAW or Beat Lab"
          style={exportBtn(midiOk, '#93c5fd')}
        >
          MIDI
        </button>
      ) : null}
      {onExportWav ? (
        <button
          type="button"
          disabled={!wavOk}
          onClick={() => void onExportWav()}
          title="Download green chord layer as .wav (Orchid voice)"
          style={exportBtn(wavOk, '#86efac')}
        >
          WAV
        </button>
      ) : null}
      {onExportToPad ? (
        <button
          type="button"
          disabled={!padOk}
          onClick={() => void onExportToPad()}
          title={
            padExportEnabled
              ? 'Pick Beat Lab sampler pad 1–16, then render chords to WAV on that pad'
              : 'Pad export is available in Creation Station (Groove Lab tab)'
          }
          style={exportBtn(padOk, '#fbbf24')}
        >
          TO PAD
        </button>
      ) : null}
      {onSendToNewSynth ? (
        <button
          type="button"
          disabled={!synthOk}
          onClick={() => onSendToNewSynth()}
          title="Send green chord notes on this roll into Beat Lab NEW SYNTH piano roll (CH 17) — no Chord Builder"
          style={exportBtn(synthOk, '#c4b5fd')}
        >
          TO NEW SYNTH
        </button>
      ) : null}
      {status ? (
        <span
          style={{
            fontSize: 7,
            color: status.startsWith('✓') ? '#86efac' : '#fca5a5',
            maxWidth: compact ? 200 : 360,
            lineHeight: 1.3,
          }}
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}
