/**
 * Groove Lab — Orchestra hit sample bank (CH 36 / ORCH lane).
 * One-shot WAV hits from /samples/orchestra-hits/manifest.json — pitch-shifted to roll MIDI at playback.
 */
import { resolveGrooveLabAudioDest } from '@/app/lib/creationStation/grooveLabAudio';
import type { GrooveLabLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadVoices';

const MANIFEST_URL = '/samples/orchestra-hits/manifest.json';

export type OrchestraHitId = string;

export type OrchestraHitPlaybackFilter = {
  type: BiquadFilterType;
  frequency: number;
  q?: number;
  gainDb?: number;
};

export type OrchestraHitDef = {
  id: OrchestraHitId;
  label: string;
  url: string;
  rootMidi: number;
  nativePitch: boolean;
  playbackGain: number;
  fallbackSynth: GrooveLabLeadSoundId;
  /** SE2 instrument picker subgroup (Cinematic Hits, Tight Strings, …). */
  pickerSubgroup?: string;
  /** Optional playback EQ — same WAV, filtered character (e.g. Cinematic Impact variants). */
  playbackFilter?: readonly OrchestraHitPlaybackFilter[];
};

const CINE_IMPACT_URL = '/samples/orchestra-hits/trap-cinematic-hit.wav';

const CINE_IMPACT_BASE = {
  url: CINE_IMPACT_URL,
  rootMidi: 48,
  nativePitch: true,
  playbackGain: 1.4,
  fallbackSynth: 'orchHit_cine' as GrooveLabLeadSoundId,
};

/** User-facing names — no hardware trademarks. */
export const ORCHESTRA_HIT_DISPLAY: Record<
  string,
  { label: string; pickerSubgroup: string }
> = {
  orchHit_cine: { label: 'Cinematic Impact', pickerSubgroup: 'Cinematic Hits' },
  orchHit_cineDark: { label: 'Cinematic Impact (Dark)', pickerSubgroup: 'Cinematic Hits' },
  orchHit_cineSub: { label: 'Cinematic Impact (Sub)', pickerSubgroup: 'Cinematic Hits' },
  orchHit_cineBright: { label: 'Cinematic Impact (Bright)', pickerSubgroup: 'Cinematic Hits' },
  orchHit_cineFiltered: { label: 'Cinematic Impact (Filtered)', pickerSubgroup: 'Cinematic Hits' },
  orchHit_brass: { label: 'Symphony Hit', pickerSubgroup: 'Cinematic Hits' },
  orchHit_proteus: { label: 'Brass Impact', pickerSubgroup: 'Cinematic Hits' },
  orchHit_jv2080: { label: 'Big Brass Hit', pickerSubgroup: 'Cinematic Hits' },
  orchHit_sc88: { label: 'Classic Orch Hit', pickerSubgroup: 'Cinematic Hits' },
  orchHit_strings: { label: 'Tight Low String Stab', pickerSubgroup: 'Tight Strings' },
  orchHit_pizz: { label: 'Pizzicato Stab', pickerSubgroup: 'Tight Strings' },
  orchHit_pizzChord: { label: 'Pizz Chord', pickerSubgroup: 'Tight Strings' },
  orchHit_trapBrass: { label: 'Brass Stab', pickerSubgroup: 'Brass Stabs' },
  orchHit_tg500: { label: 'Sharp Brass Stab', pickerSubgroup: 'Brass Stabs' },
  orchHit_timpHard: { label: 'Perc Hard', pickerSubgroup: 'Perc & Crashes' },
  orchHit_timpSmack: { label: 'Perc Smack', pickerSubgroup: 'Perc & Crashes' },
  orchHit_timpHop: { label: 'Perc Hop', pickerSubgroup: 'Perc & Crashes' },
  orchHit_choir: { label: 'Choir Stab', pickerSubgroup: 'Cinematic Hits' },
  orchHit_cym: { label: 'Orch Crash', pickerSubgroup: 'Perc & Crashes' },
  orchHit_cymSym: { label: 'Symphony Crash', pickerSubgroup: 'Perc & Crashes' },
};

function withOrchestraHitDisplay(def: OrchestraHitDef): OrchestraHitDef {
  const meta = ORCHESTRA_HIT_DISPLAY[def.id];
  if (!meta) return def;
  return { ...def, label: meta.label, pickerSubgroup: meta.pickerSubgroup };
}

type ManifestFile = {
  version: number;
  hits: OrchestraHitDef[];
};

/** Baked catalog — works offline if manifest fetch fails. */
const BAKED_ORCHESTRA_HIT_MANIFEST_RAW: readonly OrchestraHitDef[] = [
  { id: 'orchHit_cine', label: 'Cine', ...CINE_IMPACT_BASE },
  {
    id: 'orchHit_cineDark',
    label: 'Cine Dark',
    ...CINE_IMPACT_BASE,
    playbackGain: 1.42,
    playbackFilter: [{ type: 'lowpass', frequency: 1050, q: 0.85 }],
  },
  {
    id: 'orchHit_cineSub',
    label: 'Cine Sub',
    ...CINE_IMPACT_BASE,
    playbackGain: 1.48,
    playbackFilter: [
      { type: 'lowshelf', frequency: 95, gainDb: 5.5 },
      { type: 'lowpass', frequency: 880, q: 0.72 },
    ],
  },
  {
    id: 'orchHit_cineBright',
    label: 'Cine Bright',
    ...CINE_IMPACT_BASE,
    playbackGain: 1.36,
    playbackFilter: [
      { type: 'highpass', frequency: 340, q: 0.62 },
      { type: 'highshelf', frequency: 4200, gainDb: 3.2 },
    ],
  },
  {
    id: 'orchHit_cineFiltered',
    label: 'Cine Filtered',
    ...CINE_IMPACT_BASE,
    playbackGain: 1.38,
    playbackFilter: [{ type: 'bandpass', frequency: 820, q: 1.55 }],
  },
  { id: 'orchHit_brass', label: 'K2000', url: '/samples/orchestra-hits/k2000-symphony-hit.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.4, fallbackSynth: 'orchHit_brass' },
  { id: 'orchHit_proteus', label: 'Proteus', url: '/samples/orchestra-hits/proteus-brass-hit.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.38, fallbackSynth: 'orchHit_brass' },
  { id: 'orchHit_jv2080', label: 'JV2080', url: '/samples/orchestra-hits/jv2080-symphony-hit.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.35, fallbackSynth: 'orchHit_brass' },
  { id: 'orchHit_sc88', label: 'SC-88', url: '/samples/orchestra-hits/sc88-orchestra-hit.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.32, fallbackSynth: 'orchHit_brass' },
  { id: 'orchHit_strings', label: 'Trap Stab', url: '/samples/orchestra-hits/trap-orchestra-stab.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.35, fallbackSynth: 'orchHit_strings' },
  { id: 'orchHit_trapBrass', label: 'Trap Brs', url: '/samples/orchestra-hits/trap-brass-stab.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.35, fallbackSynth: 'orchHit_brass' },
  { id: 'orchHit_pizz', label: 'Pizz', url: '/samples/orchestra-hits/pizz-stab.wav', rootMidi: 60, nativePitch: true, playbackGain: 1.2, fallbackSynth: 'orchHit_pizz' },
  { id: 'orchHit_pizzChord', label: 'Pizz+', url: '/samples/orchestra-hits/pizz-chord-stab.wav', rootMidi: 72, nativePitch: true, playbackGain: 1.2, fallbackSynth: 'orchHit_pizzChord' },
  { id: 'orchHit_tg500', label: 'TG Stab', url: '/samples/orchestra-hits/tg500-brass-stab.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.3, fallbackSynth: 'orchHit_brass' },
  { id: 'orchHit_timpHard', label: 'Hard', url: '/samples/orchestra-hits/ensoniq-hit-hard.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.35, fallbackSynth: 'orchHit_timp' },
  { id: 'orchHit_timpSmack', label: 'Smack', url: '/samples/orchestra-hits/ensoniq-smack-hit.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.32, fallbackSynth: 'orchHit_timp' },
  { id: 'orchHit_timpHop', label: 'Hop', url: '/samples/orchestra-hits/ensoniq-hop-hit.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.3, fallbackSynth: 'orchHit_timp' },
  { id: 'orchHit_choir', label: 'Choir', url: '/samples/orchestra-hits/choir-stab.wav', rootMidi: 60, nativePitch: true, playbackGain: 1.25, fallbackSynth: 'orchHit_choir' },
  { id: 'orchHit_cym', label: 'Crash', url: '/samples/orchestra-hits/trap-orchestra-crash.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.3, fallbackSynth: 'orchHit_cym' },
  { id: 'orchHit_cymSym', label: 'Sym Cr', url: '/samples/orchestra-hits/trap-symphony-crash.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.3, fallbackSynth: 'orchHit_cym' },
];

export const BAKED_ORCHESTRA_HIT_MANIFEST: readonly OrchestraHitDef[] =
  BAKED_ORCHESTRA_HIT_MANIFEST_RAW.map((d) => withOrchestraHitDisplay(d));

let manifestPromise: Promise<OrchestraHitDef[]> | null = null;
let manifestCache: OrchestraHitDef[] = BAKED_ORCHESTRA_HIT_MANIFEST.map((d) => ({ ...d }));

const bufferCache = new Map<string, AudioBuffer | 'failed'>();
const loadingMap = new Map<string, Promise<AudioBuffer | null>>();
let bufferCacheCtx: BaseAudioContext | null = null;

function pinOrchestraHitBufferCache(ctx: BaseAudioContext): void {
  if (bufferCacheCtx === ctx) return;
  bufferCache.clear();
  loadingMap.clear();
  bufferCacheCtx = ctx;
}

export function isOrchestraHitId(id: string): id is OrchestraHitId {
  return id.startsWith('orchHit_');
}

export function getLoadedOrchestraHitDefs(): OrchestraHitDef[] {
  return manifestCache;
}

export function getOrchestraHitDef(id: OrchestraHitId): OrchestraHitDef | undefined {
  return manifestCache.find((d) => d.id === id);
}

export function loadedOrchestraHitLabelById(id: OrchestraHitId): string | null {
  return getOrchestraHitDef(id)?.label ?? null;
}

export async function loadOrchestraHitManifest(): Promise<OrchestraHitDef[]> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const resp = await fetch(MANIFEST_URL, { cache: 'default' });
      if (!resp.ok) throw new Error(`manifest ${resp.status}`);
      const data = (await resp.json()) as ManifestFile;
      if (Array.isArray(data.hits) && data.hits.length > 0) {
        manifestCache = data.hits.map((h) => withOrchestraHitDisplay(h));
      }
    } catch {
      /* keep baked manifestCache */
    }
    return manifestCache;
  })();
  return manifestPromise;
}

export async function loadOrchestraHitBuffer(
  ctx: BaseAudioContext,
  def: OrchestraHitDef,
): Promise<AudioBuffer | null> {
  pinOrchestraHitBufferCache(ctx);
  const cacheKey = def.url;
  const cached = bufferCache.get(cacheKey);
  if (cached === 'failed') return null;
  if (cached) return cached;

  const existing = loadingMap.get(cacheKey);
  if (existing) return existing;

  const p = (async (): Promise<AudioBuffer | null> => {
    try {
      const resp = await fetch(def.url, { cache: 'default' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const ab = await resp.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      bufferCache.set(cacheKey, buf);
      return buf;
    } catch {
      bufferCache.set(cacheKey, 'failed');
      return null;
    } finally {
      loadingMap.delete(cacheKey);
    }
  })();
  loadingMap.set(cacheKey, p);
  return p;
}

export async function preloadOrchestraHitBank(ctx: BaseAudioContext): Promise<void> {
  const defs = await loadOrchestraHitManifest();
  await Promise.allSettled(defs.map((d) => loadOrchestraHitBuffer(ctx, d)));
}

export async function ensureOrchestraHitBuffer(
  ctx: BaseAudioContext,
  def: OrchestraHitDef,
): Promise<AudioBuffer | null> {
  return loadOrchestraHitBuffer(ctx, def);
}

export function orchestraHitBufferReady(hitId: OrchestraHitId, ctx?: BaseAudioContext): boolean {
  if (ctx) pinOrchestraHitBufferCache(ctx);
  const def = getOrchestraHitDef(hitId);
  if (!def) return false;
  const cached = bufferCache.get(def.url);
  return cached != null && cached !== 'failed';
}

function connectOrchestraHitPlaybackChain(
  ctx: AudioContext,
  src: AudioBufferSourceNode,
  dest: AudioNode,
  filters: readonly OrchestraHitPlaybackFilter[] | undefined,
  t0: number,
): void {
  let node: AudioNode = src;
  if (filters?.length) {
    for (const f of filters) {
      const bq = ctx.createBiquadFilter();
      bq.type = f.type;
      bq.frequency.setValueAtTime(f.frequency, t0);
      if (f.q != null) bq.Q.setValueAtTime(f.q, t0);
      if (f.gainDb != null) bq.gain.setValueAtTime(f.gainDb, t0);
      node.connect(bq);
      node = bq;
    }
  }
  node.connect(dest);
}

export type PlayOrchestraHitSampleOpts = {
  outputNode?: AudioNode;
  /** When false, pitch-shift to targetMidi. Default = native pitch from manifest. */
  nativePitch?: boolean;
  targetMidi?: number;
};

const activeOrchestraHitSources = new Set<AudioBufferSourceNode>();
const activeOrchestraHitGains = new Set<GainNode>();
/** Bumped on halt so in-flight `ensureBuffer().then(play)` callbacks are dropped. */
let orchestraHitScheduleGeneration = 0;

export function getOrchestraHitScheduleGeneration(): number {
  return orchestraHitScheduleGeneration;
}

/** Cut ringing cinematic / orchestra hit tails (SE2 / Beat Pads / ORCH Stop). */
export function haltOrchestraHitPlayback(ctx?: AudioContext | null): void {
  orchestraHitScheduleGeneration += 1;
  const now = ctx && ctx.state !== 'closed' ? ctx.currentTime : 0;
  for (const gain of [...activeOrchestraHitGains]) {
    try {
      if (ctx && ctx.state !== 'closed' && gain.context === ctx) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
      }
    } catch {
      /* */
    }
    try {
      gain.disconnect();
    } catch {
      /* */
    }
  }
  activeOrchestraHitGains.clear();
  for (const src of [...activeOrchestraHitSources]) {
    try {
      src.stop(now);
    } catch {
      try {
        src.stop();
      } catch {
        /* */
      }
    }
    try {
      src.disconnect();
    } catch {
      /* */
    }
  }
  activeOrchestraHitSources.clear();
}

/**
 * Play one orchestra hit sample. Returns true if WAV played, false → caller uses synth fallback.
 */
export function playOrchestraHitSample(
  ctx: AudioContext,
  def: OrchestraHitDef,
  when: number,
  velocity01 = 0.92,
  opts?: PlayOrchestraHitSampleOpts,
): boolean {
  pinOrchestraHitBufferCache(ctx);
  const buf = bufferCache.get(def.url);
  if (!buf || buf === 'failed') return false;

  const now = ctx.currentTime;
  const startAt = Math.max(when, now + 0.008);
  const native = opts?.nativePitch ?? def.nativePitch;
  const gain = def.playbackGain * Math.min(1, Math.max(0.05, velocity01));

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(gain, startAt + 0.004);
  const releaseAt = startAt + Math.min(buf.duration * 0.98, 2.8);
  gainNode.gain.setTargetAtTime(0.0001, releaseAt, 0.12);

  const out =
    opts?.outputNode && opts.outputNode.context === ctx
      ? opts.outputNode
      : resolveGrooveLabAudioDest(ctx);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (!native && opts?.targetMidi != null) {
    src.detune.value = (opts.targetMidi - def.rootMidi) * 100;
  }
  connectOrchestraHitPlaybackChain(ctx, src, gainNode, def.playbackFilter, startAt);
  gainNode.connect(out);
  activeOrchestraHitSources.add(src);
  activeOrchestraHitGains.add(gainNode);
  src.onended = () => {
    activeOrchestraHitSources.delete(src);
    activeOrchestraHitGains.delete(gainNode);
  };
  src.start(startAt);
  src.stop(startAt + buf.duration + 0.05);
  return true;
}
