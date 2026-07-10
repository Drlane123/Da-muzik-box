/**
 * Groove Lab — Guitar Lick sample bank.
 *
 * Loads one-shot guitar lick buffers from /samples/guitar-licks/manifest.json
 * (CDN URLs defined in that file). Falls back to the synth voice if fetch fails.
 *
 * Pitch-shifted at playback time via AudioBufferSourceNode.detune so one sample
 * covers the full melody range (same approach as the 808 Lab pad engine).
 */

import { resolveGrooveLabAudioDest } from '@/app/lib/creationStation/grooveLabAudio';
import { truncateGrooveLabLeadMonoGroup } from '@/app/lib/creationStation/grooveLabLeadMono';
import type { GrooveLabLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadVoices';

const MANIFEST_URL = '/samples/guitar-licks/manifest.json';

export type GuitarLickId = string; // e.g. "lickSample_bluesRiff"

export type GuitarLickDef = {
  id: GuitarLickId;
  label: string;
  tag: string;
  /** MIDI note the sample was recorded at (used for pitch-shift math). */
  rootMidi: number;
  url: string;
  /** Synth preset ID to use if sample fails to load. */
  fallbackSynth: GrooveLabLeadSoundId;
};

type ManifestFile = {
  version: number;
  licks: GuitarLickDef[];
};

/** Baked catalog so guitar licks work even if manifest.json fetch fails offline. */
export const BAKED_GUITAR_LICK_MANIFEST: readonly GuitarLickDef[] = [
  {
    id: 'lickSample_bluesRiff',
    label: 'Blues riff',
    tag: 'blues',
    rootMidi: 52,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-electric/E2.mp3',
    fallbackSynth: 'lickBluesSlide',
  },
  {
    id: 'lickSample_cleanPick',
    label: 'Clean pick',
    tag: 'clean',
    rootMidi: 57,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-acoustic/A3.mp3',
    fallbackSynth: 'leadGtrPick',
  },
  {
    id: 'lickSample_neoSoulBend',
    label: 'Neo soul bend',
    tag: 'neo-soul',
    rootMidi: 60,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-electric/C4.mp3',
    fallbackSynth: 'lickNeoSoulPhrase',
  },
  {
    id: 'lickSample_arenaHook',
    label: 'Arena hook',
    tag: 'rock',
    rootMidi: 55,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-electric/Fs3.mp3',
    fallbackSynth: 'lickArenaHook',
  },
  {
    id: 'lickSample_chimeHarmonic',
    label: 'Chime harmonic',
    tag: 'clean',
    rootMidi: 64,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-acoustic/E4.mp3',
    fallbackSynth: 'leadGtrHarmonic',
  },
  {
    id: 'lickSample_palmMute',
    label: 'Palm mute',
    tag: 'rhythm',
    rootMidi: 48,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-electric/C3.mp3',
    fallbackSynth: 'leadGtrPalmMute',
  },
  {
    id: 'lickSample_mandolinRun',
    label: 'Mandolin run',
    tag: 'folk',
    rootMidi: 60,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-acoustic/C4.mp3',
    fallbackSynth: 'pluckMandolin',
  },
  {
    id: 'lickSample_slideSoul',
    label: 'Slide soul',
    tag: 'soul',
    rootMidi: 53,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-electric/Fs3.mp3',
    fallbackSynth: 'leadGtrSlide',
  },
  {
    id: 'lickSample_wahClean',
    label: 'Wah clean live',
    tag: 'wah-clean',
    rootMidi: 62,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-acoustic/D4.mp3',
    fallbackSynth: 'leadGtrWahClean',
  },
  {
    id: 'lickSample_wahDrive',
    label: 'Wah drive live',
    tag: 'wah-drive',
    rootMidi: 59,
    url: 'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/guitar-electric/A3.mp3',
    fallbackSynth: 'leadGtrWahDrive',
  },
];

// --- module-level cache ---

let manifestPromise: Promise<GuitarLickDef[]> | null = null;
let manifestCache: GuitarLickDef[] = BAKED_GUITAR_LICK_MANIFEST.map((d) => ({ ...d }));

const bufferCache = new Map<string, AudioBuffer | 'failed'>();
const loadingMap = new Map<string, Promise<AudioBuffer | null>>();
/** Buffers are bound to the AudioContext that decoded them — invalidate on context swap. */
let bufferCacheCtx: BaseAudioContext | null = null;

function pinGuitarLickBufferCache(ctx: BaseAudioContext): void {
  if (bufferCacheCtx === ctx) return;
  bufferCache.clear();
  loadingMap.clear();
  bufferCacheCtx = ctx;
}

export function getLoadedGuitarLickDefs(): GuitarLickDef[] {
  return manifestCache;
}

export function getGuitarLickDef(id: GuitarLickId): GuitarLickDef | undefined {
  return manifestCache.find((d) => d.id === id);
}

export function loadedGuitarLickLabelById(id: GuitarLickId): string | null {
  return getGuitarLickDef(id)?.label ?? null;
}

export async function loadGuitarLickManifest(): Promise<GuitarLickDef[]> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const resp = await fetch(MANIFEST_URL, { cache: 'default' });
      if (!resp.ok) throw new Error(`manifest ${resp.status}`);
      const data = (await resp.json()) as ManifestFile;
      if (Array.isArray(data.licks) && data.licks.length > 0) {
        manifestCache = data.licks;
      }
    } catch {
      /* keep baked manifestCache */
    }
    return manifestCache;
  })();
  return manifestPromise;
}

export async function loadGuitarLickBuffer(
  ctx: BaseAudioContext,
  def: GuitarLickDef,
): Promise<AudioBuffer | null> {
  pinGuitarLickBufferCache(ctx);
  const cached = bufferCache.get(def.id);
  if (cached === 'failed') return null;
  if (cached) return cached;

  const existing = loadingMap.get(def.id);
  if (existing) return existing;

  const p = (async (): Promise<AudioBuffer | null> => {
    try {
      const resp = await fetch(def.url, { cache: 'default' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const ab = await resp.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      bufferCache.set(def.id, buf);
      return buf;
    } catch {
      bufferCache.set(def.id, 'failed');
      return null;
    } finally {
      loadingMap.delete(def.id);
    }
  })();
  loadingMap.set(def.id, p);
  return p;
}

/** Pre-warm all lick buffers in the background (call on Groove Lab mount). */
export async function preloadGuitarLickBank(ctx: BaseAudioContext): Promise<void> {
  const defs = await loadGuitarLickManifest();
  await Promise.allSettled(defs.map((d) => loadGuitarLickBuffer(ctx, d)));
}

export function guitarLickBufferReady(lickId: GuitarLickId, ctx?: BaseAudioContext): boolean {
  if (ctx) pinGuitarLickBufferCache(ctx);
  const cached = bufferCache.get(lickId);
  return cached != null && cached !== 'failed';
}

/** Decode one lick if needed — call before preview/transport so playback is not silent. */
export async function ensureGuitarLickBuffer(
  ctx: BaseAudioContext,
  def: GuitarLickDef,
): Promise<AudioBuffer | null> {
  return loadGuitarLickBuffer(ctx, def);
}

/** True if this id is a sample lick id (starts with "lickSample_"). */
export function isGuitarLickSampleId(id: string): id is GuitarLickId {
  return id.startsWith('lickSample_');
}

export function grooveLabGuitarBarSec(bpm: number, bars = 1): number {
  return (bars * 4 * 60) / Math.max(40, bpm);
}

/** Playback FX for sample licks on the guitar lane (wah on by default). */
export function grooveLabGuitarLickPlayOpts(
  lickId: GuitarLickId,
  sustainSec: number,
): import('@/app/lib/creationStation/grooveLabLeadSounds').PlayGrooveLabLeadSoundOpts {
  const def = getGuitarLickDef(lickId);
  const tag = def?.tag ?? '';
  const wah = tag.includes('wah');
  const drive = tag.includes('drive') ? 0.38 : tag.includes('blues') ? 0.22 : 0.1;
  return {
    pitchRegister: 'guitar',
    monophonic: true,
    transportClean: false,
    wahAmount: wah ? 0.92 : 0.58,
    wahRateHz: tag.includes('drive') ? 4.2 : 2.6,
    drive,
    distortion: tag.includes('drive') ? 0.12 : 0,
    maxSustainSec: Math.max(0.35, sustainSec),
  };
}

export type PlayGuitarLickSampleOpts = {
  monophonic?: boolean;
  monoGroup?: string;
  outputNode?: AudioNode;
  wahAmount?: number;
  wahRateHz?: number;
  drive?: number;
  distortion?: number;
  lowCutHz?: number;
  highCutHz?: number;
  transportClean?: boolean;
  /** Round-robin humanization on top of pitch-shift. */
  extraDetuneCents?: number;
};

const activeLickStops = new Map<string, (t: number) => void>();

function monoGroupKey(opts?: PlayGuitarLickSampleOpts): string {
  return opts?.monoGroup?.trim() || '__default__';
}

export function truncateGrooveLabGuitarLickMonoGroup(when: number, group: string): void {
  const stop = activeLickStops.get(group);
  if (!stop) return;
  try {
    stop(when);
  } catch {
    /* */
  }
  activeLickStops.delete(group);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Play a guitar lick sample, pitch-shifted to `targetMidi`.
 * Returns true if sample played, false → caller should fall back to synth.
 */
export function playGuitarLickSample(
  ctx: AudioContext,
  def: GuitarLickDef,
  targetMidi: number,
  when: number,
  velocity01 = 0.88,
  sustainSec = 0.45,
  opts?: PlayGuitarLickSampleOpts,
): boolean {
  pinGuitarLickBufferCache(ctx);
  const buf = bufferCache.get(def.id);
  if (!buf || buf === 'failed') return false;

  const transportClean = opts?.transportClean === true;
  const now = ctx.currentTime;
  const startAt = Math.max(when, now + (transportClean ? 0.001 : 0.01));
  const monoGroup = monoGroupKey(opts);
  if (opts?.monophonic !== false && when <= now + 0.05) {
    truncateGrooveLabLeadMonoGroup(Math.max(now, startAt - 0.04), monoGroup);
  }
  const semitoneOffset = targetMidi - def.rootMidi;
  const detuneCents = semitoneOffset * 100 + (opts?.extraDetuneCents ?? 0);
  const wahAmount = transportClean ? 0 : clamp01(opts?.wahAmount ?? 0);
  const drive = clamp01(opts?.drive ?? 0);
  const distortion = clamp01(opts?.distortion ?? 0);
  const fxHeat = Math.max(drive, distortion);

  const gainNode = ctx.createGain();
  const gainAttackEnd = startAt + 0.006;
  const playSec = transportClean ? Math.min(sustainSec, 0.55) : sustainSec;
  const releaseStart = startAt + Math.max(transportClean ? 0.08 : 0.14, playSec);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(velocity01 * (1.05 + drive * 0.4), gainAttackEnd);
  gainNode.gain.setTargetAtTime(
    0.0001,
    releaseStart,
    transportClean ? 0.04 : Math.max(0.08, playSec * 0.45),
  );
  const out =
    opts?.outputNode && opts.outputNode.context === ctx
      ? opts.outputNode
      : resolveGrooveLabAudioDest(ctx);
  const lowCut = Math.max(20, Math.min(800, opts?.lowCutHz ?? 90));
  const highCut = Math.max(400, Math.min(18000, opts?.highCutHz ?? 8200));
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(lowCut, startAt);
  highpass.Q.value = 0.6;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, startAt);
  compressor.knee.setValueAtTime(18, startAt);
  compressor.ratio.setValueAtTime(3.2, startAt);
  compressor.attack.setValueAtTime(0.006, startAt);
  compressor.release.setValueAtTime(0.14, startAt);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.detune.value = detuneCents;
  // Wah is temporarily opt-in only while we stabilize Melody & Riffs core tone.
  const isWah = wahAmount > 0.01;
  let chain: AudioNode = highpass;
  let wahLfo: OscillatorNode | null = null;
  let wahLfoGain: GainNode | null = null;
  const preDrive = ctx.createGain();
  preDrive.gain.setValueAtTime(1 + drive * 1.1, startAt);
  const outTrim = ctx.createGain();
  outTrim.gain.setValueAtTime(1 / (1 + drive * 0.65 + distortion * 0.75), startAt);
  const distortionNode: WaveShaperNode | null = (() => {
    const amount = Math.max(distortion, drive * 0.65);
    if (amount < 0.02) return null;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    const k = 6 + amount * 44;
    for (let i = 0; i < curve.length; i += 1) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    shaper.curve = curve;
    shaper.oversample = '4x';
    return shaper;
  })();
  if (isWah) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const extWahAmount = wahAmount;
    const center = 760;
    const travel = 780 + 1700 * Math.max(0.1, extWahAmount) * (1 - fxHeat * 0.3);
    filter.Q.value = (def.tag.includes('drive') ? 3.5 : 2.8) + extWahAmount * 4.2 - fxHeat * 1.6;
    filter.frequency.setValueAtTime(center, startAt);
    wahLfo = ctx.createOscillator();
    wahLfo.type = 'triangle';
    const extWahRate = Math.max(0.2, opts?.wahRateHz ?? 0);
    wahLfo.frequency.setValueAtTime(
      extWahRate > 0 ? Math.min(4.2, extWahRate) : def.tag.includes('drive') ? 2.6 : 1.9,
      startAt,
    );
    wahLfoGain = ctx.createGain();
    wahLfoGain.gain.setValueAtTime(travel, startAt);
    wahLfo.connect(wahLfoGain).connect(filter.frequency);
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const wetMix = Math.max(0.12, extWahAmount);
    dry.gain.setValueAtTime(1 - wetMix * 0.75, startAt);
    wet.gain.setValueAtTime(0.28 + wetMix * 0.82, startAt);

    src.connect(preDrive);
    preDrive.connect(dry);
    preDrive.connect(filter);
    filter.connect(wet);

    const wahSum = ctx.createGain();
    dry.connect(wahSum);
    wet.connect(wahSum);
    if (distortionNode) {
      wahSum.connect(distortionNode);
      distortionNode.connect(highpass);
    } else {
      wahSum.connect(highpass);
    }
    chain = highpass;
    wahLfo.start(startAt);
    wahLfo.stop(startAt + Math.max(0.35, sustainSec + 0.7));
  } else {
    src.connect(preDrive);
    if (distortionNode) {
      preDrive.connect(distortionNode);
      distortionNode.connect(highpass);
    } else {
      preDrive.connect(highpass);
    }
  }
  const toneGuard = ctx.createBiquadFilter();
  toneGuard.type = 'lowpass';
  toneGuard.frequency.setValueAtTime(Math.min(highCut, 8600 - fxHeat * 2800), startAt);
  toneGuard.Q.value = 0.55;
  chain.connect(toneGuard);
  toneGuard.connect(compressor);
  compressor.connect(outTrim);
  outTrim.connect(gainNode);
  gainNode.connect(out);
  try {
    src.start(startAt);
    src.stop(startAt + Math.max(0.35, sustainSec + 0.55));
  } catch {
    try {
      gainNode.disconnect();
      src.disconnect();
    } catch {
      /* */
    }
    return false;
  }

  activeLickStops.set(monoGroup, (t) => {
    const stopAt = Math.max(t, ctx.currentTime);
    try {
      gainNode.gain.cancelScheduledValues(stopAt);
      gainNode.gain.setTargetAtTime(0.0001, stopAt, 0.06);
      src.stop(stopAt + 0.07);
      if (wahLfo) wahLfo.stop(stopAt + 0.08);
    } catch {
      /* */
    }
    try {
      wahLfo?.disconnect();
      wahLfoGain?.disconnect();
      distortionNode?.disconnect();
      preDrive.disconnect();
      outTrim.disconnect();
      highpass.disconnect();
      compressor.disconnect();
      src.disconnect();
      gainNode.disconnect();
    } catch {
      /* */
    }
    activeLickStops.delete(monoGroup);
  });

  return true;
}
