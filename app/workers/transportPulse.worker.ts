/**
 * Fires periodic pulses on a thread that is not blocked by main-thread UI work.
 * The main thread still reads `AudioContext.currentTime` and schedules audio — this only wakes
 * the scheduler so lookahead can catch up after long tasks.
 *
 * Important: the `intervalMs` here is **not** `60 / BPM` and must never be used as the musical beat period.
 * Beat spacing lives entirely in MasterClock’s `mapGlobalTickToAudioTime` + metronome lookahead.
 *
 * Uses a recursive `setTimeout` chain (web.dev “lookahead scheduler” style) instead of `setInterval`
 * so timer drift does not accumulate across long sessions.
 */

type PulseMsg =
  | { cmd: 'start'; intervalMs: number }
  | { cmd: 'stop' };

let timer: ReturnType<typeof setTimeout> | null = null;
let armed = false;
let pulseMs = 25;

function schedulePulse() {
  if (!armed) return;
  timer = setTimeout(() => {
    if (!armed) return;
    void self.postMessage({ type: 'pulse' as const });
    schedulePulse();
  }, pulseMs);
}

self.onmessage = (e: MessageEvent<PulseMsg>) => {
  const d = e.data;
  armed = false;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (d.cmd === 'start') {
    pulseMs = Math.max(4, Math.min(50, Math.floor(d.intervalMs)));
    armed = true;
    schedulePulse();
  }
};

export {};
