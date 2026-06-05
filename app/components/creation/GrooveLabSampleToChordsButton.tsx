/**
 * Upload audio → stacked MIDI on the Groove Lab ORCH HITS channel roll.
 */
import { useRef, type CSSProperties } from 'react';
import { Upload } from 'lucide-react';

const btnStyle = (busy: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: busy ? '#1a2530' : '#1e1530',
  color: busy ? '#67e8f9' : '#c4b5fd',
  border: `1px solid ${busy ? '#67e8f988' : '#a78bfa66'}`,
  borderRadius: 5,
  padding: '3px 10px',
  fontSize: 9,
  fontWeight: 900,
  cursor: busy ? 'wait' : 'pointer',
  letterSpacing: 0.2,
  flexShrink: 0,
});

export function GrooveLabSampleToChordsButton({
  busy = false,
  disabled = false,
  onFile,
  title = 'Upload audio — multi-note MIDI on the ORCH HITS channel roll',
}: {
  busy?: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
  title?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        title={title}
        disabled={busy || disabled}
        onClick={() => fileRef.current?.click()}
        style={{
          ...btnStyle(busy),
          opacity: disabled && !busy ? 0.45 : 1,
        }}
      >
        <Upload size={11} aria-hidden />
        {busy ? '…' : 'ORCH → MIDI'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
