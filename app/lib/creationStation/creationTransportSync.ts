/**
 * Creation Station — shared **musical beat** from audio-domain time (seconds).
 * Playhead / HUD / grid all use this one function so they cannot disagree.
 */

/** @deprecated Oscillator clicks; kept for any stale imports. Buffer clicks use {@link CREATION_METRO_VOLUME}. */
export const CREATION_METRO_CLICK_ATTACK_SEC = 0.002;

/** Same level as Studio Editor 2 `METRO_VOLUME`. */
export const CREATION_METRO_VOLUME = 0.7;

/** Sine × exponential decay — same generator as SE2 `createMusioClickBuffer`. */
export function createCreationMetronomeClickBuffer(
  ctx: AudioContext,
  frequencyHz: number,
  durationSec: number,
  peakLevel: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const envelope = Math.exp(-t * 50);
    ch[i] = Math.sin(2 * Math.PI * frequencyHz * t) * envelope * peakLevel;
  }
  return buf;
}

export type CreationMetronomeClickBuffers = {
  click: AudioBuffer;
  accent: AudioBuffer;
};

export function ensureCreationMetronomeClickBuffers(
  ctx: AudioContext,
  prev: CreationMetronomeClickBuffers | null,
): CreationMetronomeClickBuffers {
  if (prev && prev.click.sampleRate === ctx.sampleRate) return prev;
  return {
    click: createCreationMetronomeClickBuffer(ctx, 1000, 0.02, 0.8),
    accent: createCreationMetronomeClickBuffer(ctx, 1500, 0.03, 1.0),
  };
}

export type CreationScheduledMetroNode = {
  src: AudioBufferSourceNode;
  gain: GainNode;
};

/**
 * Wilson-style metronome click on the shared master bus (SE2 `playClick` contract).
 */
export function scheduleCreationMetronomeClickAt(
  ctx: AudioContext,
  idealT: number,
  accent: boolean,
  ctSnap: number,
  buffers: CreationMetronomeClickBuffers,
  getMetronomeBusGain: () => GainNode | null,
  scheduled: CreationScheduledMetroNode[],
): void {
  const buf = accent ? buffers.accent : buffers.click;
  const now = Number.isFinite(ctSnap) ? Math.max(0, ctSnap) : ctx.currentTime;
  const t0 = Math.max(idealT, now + 0.001);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = CREATION_METRO_VOLUME;
  src.connect(gain);
  /** Beat Lab metro always uses master gain — survives `attachNewMetronomeBus` disconnecting the metro bus. */
  const master =
    typeof window !== 'undefined'
      ? (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain
      : null;
  if (master && master.context === ctx) {
    gain.connect(master);
  } else {
    const bus = getMetronomeBusGain();
    if (bus && bus.context === ctx) gain.connect(bus);
    else gain.connect(ctx.destination);
  }
  src.start(t0);
  const entry = { src, gain };
  scheduled.push(entry);
  src.onended = () => {
    const idx = scheduled.indexOf(entry);
    if (idx !== -1) scheduled.splice(idx, 1);
    try {
      src.disconnect();
      gain.disconnect();
    } catch {
      /* already disconnected */
    }
  };
}

export function beatAtSessionTime(
  t: number,
  sessionStartAudio: number,
  originBeat: number,
  bpm: number,
): number {
  const spb = 60 / Math.max(1, bpm);
  const b = originBeat + Math.max(0, t - sessionStartAudio) / spb;
  return Math.max(0, b);
}

/** Beat Lab local transport is playing — master `pause`/`stop` must not suspend the shared graph. */
export function setCreationBeatLabTransportRunning(running: boolean): void {
  if (typeof window === 'undefined') return;
  (
    window as unknown as { __daMusicCreationBeatLabRunning?: boolean }
  ).__daMusicCreationBeatLabRunning = running;
}

export function isCreationBeatLabTransportRunning(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as unknown as { __daMusicCreationBeatLabRunning?: boolean })
      .__daMusicCreationBeatLabRunning === true
  );
}

/** Groove Lab local transport — master metronome must not run in parallel. */
export function setGrooveLabTransportRunning(running: boolean): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __daMusicGrooveLabTransportRunning?: boolean }).__daMusicGrooveLabTransportRunning =
    running;
}

export function isGrooveLabTransportRunning(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as unknown as { __daMusicGrooveLabTransportRunning?: boolean })
      .__daMusicGrooveLabTransportRunning === true
  );
}

/**
 * Groove Lab metronome — **groove playback bus only** (never `__daMusicMasterGain` / master metro bus).
 * Prevents double clicks when master clock or Beat Lab also schedules metronome on the shared graph.
 */
export function scheduleGrooveLabMetronomeClickAt(
  ctx: AudioContext,
  idealT: number,
  accent: boolean,
  ctSnap: number,
  buffers: CreationMetronomeClickBuffers,
  grooveBus: GainNode,
  scheduled: CreationScheduledMetroNode[],
): void {
  const buf = accent ? buffers.accent : buffers.click;
  const now = Number.isFinite(ctSnap) ? Math.max(0, ctSnap) : ctx.currentTime;
  const t0 = Math.max(idealT, now + 0.001);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = CREATION_METRO_VOLUME;
  src.connect(gain);
  if (grooveBus.context === ctx) {
    gain.connect(grooveBus);
  } else {
    gain.connect(ctx.destination);
  }
  src.start(t0);
  const entry = { src, gain };
  scheduled.push(entry);
  src.onended = () => {
    const idx = scheduled.indexOf(entry);
    if (idx !== -1) scheduled.splice(idx, 1);
    try {
      src.disconnect();
      gain.disconnect();
    } catch {
      /* */
    }
  };
}
