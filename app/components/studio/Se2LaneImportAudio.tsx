'use client';

import { useRef } from 'react';

const SE2_AUDIO_IMPORT_ACCEPT = 'audio/*,.wav,.mp3,.ogg,.aac,.m4a,.flac,.opus,.webm';

export type Se2LaneImportAudioProps = {
  disabled?: boolean;
  accentHex?: string;
  title?: string;
  /** Tighter chip for A2M rows — leaves room for BPM / key detect. */
  compact?: boolean;
  /** Minimal flat chip — audio / A2M track row. */
  micro?: boolean;
  label?: string;
  onImportFile: (file: File) => void;
};

/** SE2 track row — pick audio or drop on the lane / timeline. */
export function Se2LaneImportAudio({
  disabled = false,
  accentHex = '#6ee7f9',
  title = 'Import audio — places clip at playhead',
  compact = false,
  micro = false,
  label,
  onImportFile,
}: Se2LaneImportAudioProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accent = accentHex.trim() || '#6ee7f9';
  const buttonLabel = label ?? 'Import audio';
  const fontPx = micro ? 5 : compact ? 5 : 6;
  const chipH = micro ? 7 : compact ? 8 : 9;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={SE2_AUDIO_IMPORT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled}
        className="inline-flex shrink-0 self-center items-center justify-center appearance-none border-0 p-0 m-0 rounded-sm leading-none transition-opacity disabled:opacity-40"
        style={{
          color: accent,
          background: `${accent}18`,
          boxShadow: `0 0 0 0.5px ${accent}55`,
          height: chipH,
          minHeight: chipH,
          maxHeight: chipH,
          padding: '0 3px',
          fontSize: fontPx,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) inputRef.current?.click();
        }}
      >
        {buttonLabel}
      </button>
    </>
  );
}

/** @deprecated Use Se2LaneImportAudio */
export const Se2TrackAlignLaneImport = Se2LaneImportAudio;
