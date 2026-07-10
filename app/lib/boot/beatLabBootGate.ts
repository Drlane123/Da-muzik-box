/** Beat Lab boot gate — splash stays until chunk loads (+ brief mount window). */

let beatLabChunkPromise: Promise<unknown> | null = null;
let beatLabRenderedResolve: (() => void) | null = null;
let beatLabRenderedPromise: Promise<void> | null = null;
let bootSplashCovering = true;

const RENDER_WAIT_AFTER_CHUNK_MS = 2000;

function beatLabRenderedPromiseOnce(): Promise<void> {
  if (!beatLabRenderedPromise) {
    beatLabRenderedPromise = new Promise<void>((resolve) => {
      beatLabRenderedResolve = resolve;
    });
  }
  return beatLabRenderedPromise;
}

export function isBootSplashCovering(): boolean {
  return bootSplashCovering;
}

export function setBootSplashCovering(covering: boolean): void {
  bootSplashCovering = covering;
}

/** Called from CreationStationScreen first paint. */
export function markBeatLabBootRendered(): void {
  beatLabRenderedResolve?.();
  beatLabRenderedResolve = null;
}

function waitForBeatLabMountOrTimeout(): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, RENDER_WAIT_AFTER_CHUNK_MS);
    beatLabRenderedPromiseOnce().then(done);
  });
}

const isDevBoot = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

/** Chunk downloaded; then short window for Beat Lab mount (never blocks forever). */
export function preloadBeatLabBootChunk(): Promise<void> {
  if (!beatLabChunkPromise) {
    beatLabChunkPromise = import('@/app/screens/CreationStationScreen');
  }
  const chunkWait = beatLabChunkPromise
    .then(() => waitForBeatLabMountOrTimeout())
    .then(() => undefined);
  if (!isDevBoot) return chunkWait;
  /** Dev: Vite first compile of Creation Station can take 1–2 min — don't block splash that long. */
  return Promise.race([
    chunkWait,
    new Promise<void>((resolve) => window.setTimeout(resolve, 6000)),
  ]);
}
