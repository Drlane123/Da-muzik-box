/**
 * Groove Lab — Orchestra hit sample bank (CH 36 / ORCH lane).
 * One-shot WAV hits from /samples/orchestra-hits/manifest.json — native pitch playback.
 */
import { resolveGrooveLabAudioDest } from '@/app/lib/creationStation/grooveLabAudio';
import type { GrooveLabLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadVoices';

const MANIFEST_URL = '/samples/orchestra-hits/manifest.json';

export type OrchestraHitId = string;

export type OrchestraHitDef = {
  id: OrchestraHitId;
  label: string;
  url: string;
  rootMidi: number;
  nativePitch: boolean;
  playbackGain: number;
  fallbackSynth: GrooveLabLeadSoundId;
};

type ManifestFile = {
  version: number;
  hits: OrchestraHitDef[];
};

/** Baked catalog — works offline if manifest fetch fails. */
export const BAKED_ORCHESTRA_HIT_MANIFEST: readonly OrchestraHitDef[] = [
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
  { id: 'orchHit_cine', label: 'Cine', url: '/samples/orchestra-hits/trap-cinematic-hit.wav', rootMidi: 48, nativePitch: true, playbackGain: 1.4, fallbackSynth: 'orchHit_cine' },
];

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
        manifestCache = data.hits;
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
  const cached = bufferCache.get(hitId);
  return cached != null && cached !== 'failed';
}

export type PlayOrchestraHitSampleOpts = {
  outputNode?: AudioNode;
  /** When false, pitch-shift to targetMidi. Default = native pitch from manifest. */
  nativePitch?: boolean;
  targetMidi?: number;
};

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
  const buf = bufferCache.get(def.id);
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
  src.connect(gainNode);
  gainNode.connect(out);
  src.start(startAt);
  src.stop(startAt + buf.duration + 0.05);
  return true;
}
