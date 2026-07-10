/** Beat Lab boot gate — splash stays until chunk loads (+ brief mount window). */

let beatLabChunkPromise: Promise<typeof import('@/app/screens/CreationStationScreen')> | null = null;
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

/** Single shared dynamic import — splash preload and React.lazy must not race separate imports. */
export function loadCreationStationScreen(): Promise<typeof import('@/app/screens/CreationStationScreen')> {
  if (!beatLabChunkPromise) {
    beatLabChunkPromise = import('@/app/screens/CreationStationScreen');
  }
  return beatLabChunkPromise;
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

/** Dev/Cursor: splash skipped — mark gate open so transport helpers never wait on a missing overlay. */
export function prepareDevBootFastPath(): void {
  if (!isDevBoot) return;
  bootSplashCovering = false;
}

/** Chunk downloaded; then short window for Beat Lab mount (never blocks forever). */
export function preloadBeatLabBootChunk(): Promise<void> {
  const chunkWait = loadCreationStationScreen()
    .then(() => waitForBeatLabMountOrTimeout())
    .then(() => undefined);
  if (!isDevBoot) return chunkWait;
  /** Dev: Vite first compile of Creation Station can take 1–2 min — don't block splash that long. */
  return Promise.race([
    chunkWait,
    new Promise<void>((resolve) => window.setTimeout(resolve, 6000)),
  ]);
}
