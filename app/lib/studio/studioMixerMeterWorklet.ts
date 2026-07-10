/**
 * Load + create studio channel meter AudioWorklet nodes.
 */
let loadPromise: Promise<void> | null = null;
let loadedCtx: AudioContext | null = null;
let loaded = false;
/** When addModule succeeds but AudioWorkletNode ctor fails, stop rebuild thrashing. */
let nodeCreateFailedCtx: AudioContext | null = null;

export function ensureStudioChannelMeterWorklet(ctx: AudioContext): Promise<void> {
  if (loaded && loadedCtx === ctx) return Promise.resolve();
  if (typeof AudioWorkletNode === 'undefined') {
    return Promise.reject(new Error('AudioWorklet not supported'));
  }
  /** Reuse in-flight load — parallel ensureCtx/play must not reset addModule mid-flight. */
  if (loadPromise && loadedCtx === ctx) return loadPromise;
  loadedCtx = ctx;
  loaded = false;
  loadPromise = ctx.audioWorklet
    .addModule('/studio-channel-meter-processor.js')
    .then(() => {
      loaded = true;
    })
    .catch((err) => {
      loadPromise = null;
      loadedCtx = null;
      loaded = false;
      throw err;
    });
  return loadPromise;
}

export function studioChannelMeterWorkletReady(ctx: AudioContext): boolean {
  return loaded && loadedCtx === ctx;
}

/** Module loaded and node creation has not permanently failed for this context. */
export function studioChannelMeterWorkletUsable(ctx: AudioContext): boolean {
  return studioChannelMeterWorkletReady(ctx) && nodeCreateFailedCtx !== ctx;
}

export function createStudioChannelMeterNode(ctx: AudioContext): AudioWorkletNode | null {
  if (!studioChannelMeterWorkletUsable(ctx)) return null;
  try {
    return new AudioWorkletNode(ctx, 'studio-channel-meter', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
  } catch {
    nodeCreateFailedCtx = ctx;
    return null;
  }
}
