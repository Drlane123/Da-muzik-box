import type { CSSProperties, MouseEvent } from 'react';
import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';

export interface OrchidTransportControlsProps {
  playing: boolean;
  /** Block Play when there is nothing to schedule — Stop/Pause stay active while playing. */
  playDisabled?: boolean;
  /** @deprecated use playDisabled */
  disabled?: boolean;
  onRewind: () => void;
  onStop: () => void;
  onPlayPause: () => void;
  onFastForward: () => void;
}

const btnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #1f3a29',
  borderRadius: 5,
  background: '#0d120f',
  color: '#86efac',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};

export function OrchidTransportControls({
  playing,
  playDisabled,
  disabled = false,
  onRewind,
  onStop,
  onPlayPause,
  onFastForward,
}: OrchidTransportControlsProps) {
  const blockPlay = (playDisabled ?? disabled) && !playing;
  const playAccent = playing && !blockPlay;

  const handleStop = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Pause path is verified to halt Groove transport; run it before stop when playing.
    if (playing) onPlayPause();
    onStop();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 6px',
        borderRadius: 6,
        background: 'rgba(5, 8, 5, 0.92)',
        border: '1px solid #1f3a29',
        boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
      }}
      title="Groove Lab transport — play piano roll (green chords + blue bass)"
    >
      <button
        type="button"
        onClick={onRewind}
        style={{ ...btnBase, width: 26, height: 26 }}
        title="Rewind to start"
      >
        <SkipBack size={13} />
      </button>
      <button
        type="button"
        onClick={handleStop}
        style={{ ...btnBase, width: 26, height: 26, position: 'relative', zIndex: 2 }}
        title="Stop"
      >
        <Square size={12} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={onPlayPause}
        disabled={blockPlay}
        style={{
          ...btnBase,
          width: 32,
          height: 26,
          background: playAccent ? '#15321e' : '#112015',
          borderColor: playAccent ? '#22c55e88' : '#1f3a29',
          color: playAccent ? '#4ade80' : blockPlay ? '#5c5c68' : '#86efac',
          opacity: blockPlay ? 0.42 : 1,
          cursor: blockPlay ? 'not-allowed' : 'pointer',
        }}
        title={playing ? 'Pause' : blockPlay ? 'Nothing to play — add notes or enable MET' : 'Play'}
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
      <button
        type="button"
        onClick={onFastForward}
        style={{ ...btnBase, width: 26, height: 26 }}
        title="Fast-forward one bar"
      >
        <SkipForward size={13} />
      </button>
    </div>
  );
}
