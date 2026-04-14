/**
 * Paste into DevTools console on the **same tab** as Da Music Box (or any tab you want to probe).
 * Stress the app while this runs: scroll, open menus, switch tabs.
 *
 * Interpretation:
 * - Mostly ~25ms deltas: worker timers are behaving; transport "skips" are more likely mapping/UI vs AudioContext.
 * - Frequent deltas >35ms: tab or browser is throttling; workers are not immune when backgrounded.
 */
(function workerJitterProbe() {
  const workerBlob = new Blob(
    [
      `
      let last = performance.now();
      setInterval(() => {
        const now = performance.now();
        const delta = now - last;
        last = now;
        if (delta > 35) {
          postMessage({ type: 'SKIP', delta });
        } else {
          postMessage({ type: 'TICK', delta });
        }
      }, 25);
    `,
    ],
    { type: 'application/javascript' },
  );

  const testWorker = new Worker(URL.createObjectURL(workerBlob));

  testWorker.onmessage = (e) => {
    if (e.data.type === 'SKIP') {
      console.warn('CLOCK DRIFT:', e.data.delta.toFixed(2) + 'ms');
    } else {
      console.log('CLOCK LOCKED:', e.data.delta.toFixed(2) + 'ms');
    }
  };

  console.info(
    '[worker-jitter] Running. Assign window.__stopWorkerJitter = () => worker.terminate() if needed.',
  );
  window.__stopWorkerJitter = () => {
    testWorker.terminate();
    console.info('[worker-jitter] Stopped.');
  };
})();
