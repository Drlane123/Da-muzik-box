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
  /** Inline on piano roll toolbar — hides status line; use showExportLabel to keep EXPORT tag. */
  toolbarInline?: boolean;
  /** Show EXPORT label even when toolbarInline (808 Lab roll toolbar). */
  showExportLabel?: boolean;
  /** Slightly wider MIDI / WAV / TO PAD chips (808 Lab). */
  widerButtons?: boolean;
  /** Override flex gap between export chips (808 Lab toolbar). */
  chipGap?: number;
  /** TO PAD picker open — highlight the pad button (Groove Lab / 808 Lab). */
  padPickerOpen?: boolean;
};

function exportBtn(
  enabled: boolean,
  accent: string,
  wider = false,
  active = false,
): CSSProperties {
  const lit = enabled || active;
  return {
    background: active ? `${accent}28` : lit ? '#0c1520' : '#111',
    color: lit ? accent : '#444',
    border: `1px solid ${active ? accent : lit ? accent + '66' : '#222'}`,
    borderRadius: 6,
    padding: wider ? '5px 14px' : '4px 10px',
    minWidth: wider ? 56 : undefined,
    fontSize: wider ? 9 : 8,
    fontWeight: 900,
    cursor: lit ? 'pointer' : 'not-allowed',
    letterSpacing: wider ? 0.4 : 0.3,
    opacity: lit ? 1 : 0.55,
    boxShadow: active ? `0 0 10px ${accent}44` : undefined,
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
  toolbarInline = false,
  showExportLabel = false,
  widerButtons = false,
  chipGap,
  padPickerOpen = false,
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
        gap: chipGap ?? (widerButtons ? 8 : toolbarInline || compact ? 6 : 8),
        flexWrap: toolbarInline ? 'nowrap' : 'wrap',
      }}
    >
      {toolbarInline && !showExportLabel ? null : (
        <span
          style={{
            fontSize: widerButtons ? 9 : 8,
            fontWeight: 900,
            color: '#fde68a',
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          EXPORT
        </span>
      )}
      {onExportMidi ? (
        <button
          type="button"
          disabled={!midiOk}
          onClick={() => onExportMidi()}
          title="Download piano roll as .mid (bass + chords) — drag into any DAW or Beat Lab"
          style={exportBtn(midiOk, '#93c5fd', widerButtons)}
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
          style={exportBtn(wavOk, '#86efac', widerButtons)}
        >
          WAV
        </button>
      ) : null}
      {onExportToPad ? (
        <button
          type="button"
          disabled={!padOk && !padPickerOpen}
          onClick={() => void onExportToPad()}
          title={
            padExportEnabled
              ? padPickerOpen
                ? 'Choose Beat Lab sampler pad 1–16 (click again to cancel)'
                : 'Pick Beat Lab sampler pad 1–16, then render to WAV on that pad'
              : 'Pad export is available in Creation Station (Groove Lab tab)'
          }
          style={exportBtn(padOk || padPickerOpen, '#fbbf24', widerButtons, padPickerOpen)}
        >
          {padPickerOpen ? 'PAD…' : 'TO PAD'}
        </button>
      ) : null}
      {onSendToNewSynth ? (
        <button
          type="button"
          disabled={!synthOk}
          onClick={() => onSendToNewSynth()}
          title="Send green chord notes on this roll into Beat Lab NEW SYNTH piano roll (CH 17) — no Chord Builder"
          style={exportBtn(synthOk, '#c4b5fd', widerButtons)}
        >
          TO NEW SYNTH
        </button>
      ) : null}
      {status && !toolbarInline ? (
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
