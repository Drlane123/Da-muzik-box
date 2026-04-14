/**
 * 25ms-class pulses on a worker thread so metronome lookahead keeps waking the main thread
 * during UI jank (main-thread setInterval is throttled more aggressively).
 * Scheduling still uses AudioContext.currentTime on the main thread.
 */

type PulseMsg =
  | { cmd: 'start'; intervalMs: number }
  | { cmd: 'stop' };

let timer: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<PulseMsg>) => {
  const d = e.data;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (d.cmd === 'start') {
    const ms = Math.max(4, Math.min(50, Math.floor(d.intervalMs)));
    timer = setInterval(() => {
      void self.postMessage({ type: 'pulse' as const });
    }, ms);
  }
};

export {};
