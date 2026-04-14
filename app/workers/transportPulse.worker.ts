/**
 * Fires periodic pulses on a thread that is not blocked by main-thread UI work.
 * The main thread still reads `AudioContext.currentTime` and schedules audio — this only wakes
 * the scheduler so lookahead can catch up after long tasks.
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
