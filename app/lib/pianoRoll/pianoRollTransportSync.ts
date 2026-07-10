/** Piano Roll local SE2 transport — master metronome / suspend must yield while playing. */

export function setPianoRollTransportRunning(running: boolean): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __daMusicPianoRollTransportRunning?: boolean }).__daMusicPianoRollTransportRunning =
    running;
}

export function isPianoRollTransportRunning(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as unknown as { __daMusicPianoRollTransportRunning?: boolean })
      .__daMusicPianoRollTransportRunning === true
  );
}
