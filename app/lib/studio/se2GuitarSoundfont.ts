/**
 * SE2 Guitar lane — MusyngKite GM guitars via smplr (open-source sampled instruments).
 * @see https://github.com/danigb/smplr
 */
import { Scheduler, Soundfont, type Soundfont as SmplrSoundfont } from 'smplr';
import { CREATION_SCHEDULE_AHEAD_SEC } from '@/app/lib/creationStation/creationTransportSystem';
import {
  SE2_GUITAR_DEFAULT_INSTRUMENT,
  se2SanitizeGuitarInstrumentId,
  type Se2GuitarInstrumentId,
} from '@/app/lib/studio/se2GuitarInstruments';
import { emitSe2GuitarVisualNote } from '@/app/lib/studio/se2GuitarVisualBus';
import type { Se2GuitarFretDot } from '@/app/lib/studio/se2GuitarFretboard';
import { scheduleSe2GuitarHybridLayers } from '@/app/lib/studio/se2GuitarVoiceEngine';
import { warmupSe2GuitarSampleLayer } from '@/app/lib/studio/se2GuitarSampleLayer';
import { previewSe2GuitarQuickPluck } from '@/app/lib/studio/se2GuitarQuickPluck';
import type { Se2GuitarArticulationId } from '@/app/lib/studio/se2GuitarArticulation';
import {
  se2GuitarHumanizePolyNotes,
  se2GuitarShapePlaybackVelocity,
  type Se2GuitarPlaybackNote,
} from '@/app/lib/studio/se2GuitarPlaybackHumanize';

const SE2_GUITAR_KIT = 'MusyngKite' as const;
const SMPLR_LOOKAHEAD_MS = Math.ceil(CREATION_SCHEDULE_AHEAD_SEC * 1000) + 250;
/** Leave headroom — dense poly strums clip if pegged too hot. */
const SMPLR_INSTRUMENT_VOLUME = 78;

const transportSchedulerByCtx = new WeakMap<BaseAudioContext, ReturnType<typeof Scheduler>>();
const instrumentCache = new Map<string, Promise<SmplrSoundfont>>();
const instrumentReady = new Map<string, SmplrSoundfont>();
const destinationCacheIds = new WeakMap<AudioNode, number>();
const transportStops = new Set<() => void>();
const previewStops = new Set<() => void>();
let cacheCtx: BaseAudioContext | null = null;
let nextDestinationCacheId = 0;

export type Se2GuitarNoteScope = 'preview' | 'transport';

/** smplr only (loops / transport) vs smplr + DI samples + body/noise (single-note performance). */
export type Se2GuitarRenderMode = 'smplr' | 'hybrid';

function resolveRenderMode(opts?: {
  renderMode?: Se2GuitarRenderMode;
  articulation?: Se2GuitarArticulationId;
  strokeNoise?: boolean;
  releaseNoise?: boolean;
  polyphonic?: boolean;
}): Se2GuitarRenderMode {
  if (opts?.polyphonic) return 'smplr';
  if (opts?.renderMode) return opts.renderMode;
  if (opts?.articulation || opts?.strokeNoise || opts?.releaseNoise) return 'hybrid';
  return 'smplr';
}

export function ensureSe2GuitarAudioReady(ctx: AudioContext): void {
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

function guitarTransportScheduler(ctx: BaseAudioContext): ReturnType<typeof Scheduler> {
  let sched = transportSchedulerByCtx.get(ctx);
  if (!sched) {
    sched = Scheduler(ctx, { lookaheadMs: SMPLR_LOOKAHEAD_MS, intervalMs: 16 });
    transportSchedulerByCtx.set(ctx, sched);
  }
  return sched;
}

function ensureCache(ctx: BaseAudioContext): void {
  if (cacheCtx === ctx) return;
  instrumentCache.clear();
  instrumentReady.clear();
  cacheCtx = ctx;
}

function destinationCacheKey(destination: AudioNode): number {
  let id = destinationCacheIds.get(destination);
  if (id == null) {
    id = nextDestinationCacheId;
    nextDestinationCacheId += 1;
    destinationCacheIds.set(destination, id);
  }
  return id;
}

function cacheKey(instrumentId: Se2GuitarInstrumentId, destination: AudioNode): string {
  return `${instrumentId}@${destinationCacheKey(destination)}@${destination.context.sampleRate}`;
}

export function getSe2GuitarInstrument(
  ctx: AudioContext,
  instrumentId: string,
  destination: AudioNode,
): Promise<SmplrSoundfont> {
  ensureCache(ctx);
  const id = se2SanitizeGuitarInstrumentId(instrumentId);
  const key = cacheKey(id, destination);
  let pending = instrumentCache.get(key);
  if (!pending) {
    pending = (async () => {
      const inst = Soundfont(ctx, {
        instrument: id,
        kit: SE2_GUITAR_KIT,
        destination,
        volume: SMPLR_INSTRUMENT_VOLUME,
        scheduler: guitarTransportScheduler(ctx),
      });
      await inst.load;
      instrumentReady.set(key, inst);
      return inst;
    })().catch((err) => {
      instrumentCache.delete(key);
      instrumentReady.delete(key);
      throw err;
    });
    instrumentCache.set(key, pending);
  }
  return pending;
}

export async function warmupSe2GuitarInstrument(
  ctx: AudioContext,
  instrumentId: string = SE2_GUITAR_DEFAULT_INSTRUMENT,
  destination: AudioNode = ctx.destination,
  opts?: { withSampleLayer?: boolean },
): Promise<void> {
  await getSe2GuitarInstrument(ctx, instrumentId, destination);
  if (opts?.withSampleLayer !== false) {
    await warmupSe2GuitarSampleLayer(ctx);
  }
}

function readyInstrument(
  ctx: AudioContext,
  instrumentId: string,
  destination: AudioNode,
): SmplrSoundfont | null {
  ensureCache(ctx);
  return instrumentReady.get(cacheKey(se2SanitizeGuitarInstrumentId(instrumentId), destination)) ?? null;
}

function startVoice(
  inst: SmplrSoundfont,
  midi: number,
  velocity127: number,
  when: number,
  durationSec: number,
  scope: Se2GuitarNoteScope = 'transport',
): () => void {
  const rawStop = inst.start({
    note: Math.max(0, Math.min(127, Math.round(midi))),
    velocity: Math.max(1, Math.min(127, Math.round(se2GuitarShapePlaybackVelocity(velocity127)))),
    time: when,
    duration: Math.max(0.05, durationSec),
  });
  const bucket = scope === 'preview' ? previewStops : transportStops;
  const wrapped = () => {
    bucket.delete(wrapped);
    try {
      rawStop();
    } catch {
      /* */
    }
  };
  bucket.add(wrapped);
  return wrapped;
}

export function scheduleSe2GuitarNote(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  tEnd: number,
  pitch: number,
  velocity127: number,
  instrumentId: string,
  transposeSemis = 0,
  opts?: {
    emitVisual?: boolean;
    placement?: Se2GuitarFretDot;
    articulation?: Se2GuitarArticulationId;
    strokeNoise?: boolean;
    releaseNoise?: boolean;
    scope?: Se2GuitarNoteScope;
    renderMode?: Se2GuitarRenderMode;
    polyphonic?: boolean;
  },
): void {
  ensureSe2GuitarAudioReady(ctx);
  const scope = opts?.scope ?? 'transport';
  const renderMode = resolveRenderMode(opts);
  const midi = Math.max(0, Math.min(127, Math.round(pitch + transposeSemis)));
  const whenLocked = Math.max(when, ctx.currentTime + 0.001);
  const dur = Math.max(0.06, tEnd - when);
  const immediate = whenLocked <= ctx.currentTime + 0.045;
  if (opts?.emitVisual !== false) {
    const leadMs = Math.max(0, (whenLocked - ctx.currentTime) * 1000);
    const durationMs = Math.max(80, dur * 1000);
    const fireVisual = () =>
      emitSe2GuitarVisualNote({
        pitch: midi,
        durationMs,
        placement: opts?.placement,
      });
    if (leadMs <= 4) fireVisual();
    else window.setTimeout(fireVisual, leadMs);
  }

  const inst = readyInstrument(ctx, instrumentId, destination);

  // Hybrid extras (DI samples, body, pick noise) — single-note performance only.
  // Stacking these on every loop strum note overloads the graph → static / dropouts.
  if (renderMode === 'hybrid') {
    if (!inst && immediate) {
      previewSe2GuitarQuickPluck(ctx, destination, midi, velocity127, dur);
    }
    scheduleSe2GuitarHybridLayers(
      ctx,
      destination,
      whenLocked,
      whenLocked + dur,
      midi,
      velocity127,
      instrumentId,
      {
        articulation: opts?.articulation,
        strokeNoise: opts?.strokeNoise,
        releaseNoise: opts?.releaseNoise,
        sampleBlend: 0.28,
      },
    );
  }

  if (inst) {
    startVoice(inst, midi, velocity127, whenLocked, dur, scope);
    return;
  }
  void getSe2GuitarInstrument(ctx, instrumentId, destination)
    .then((loaded) => {
      if (whenLocked < ctx.currentTime - 0.04) return;
      startVoice(
        loaded,
        midi,
        velocity127,
        Math.max(whenLocked, ctx.currentTime + 0.001),
        dur,
        scope,
      );
    })
    .catch(() => {
      if (renderMode === 'hybrid' && immediate) {
        previewSe2GuitarQuickPluck(ctx, destination, midi, velocity127, dur);
      }
    });
}

export function previewSe2GuitarNote(
  ctx: AudioContext,
  destination: AudioNode,
  pitch: number,
  instrumentId: string,
  velocity127 = 96,
  transposeSemis = 0,
  opts?: {
    emitVisual?: boolean;
    placement?: Se2GuitarFretDot;
    durationSec?: number;
    articulation?: Se2GuitarArticulationId;
    strokeNoise?: boolean;
    releaseNoise?: boolean;
    scope?: Se2GuitarNoteScope;
  },
): void {
  ensureSe2GuitarAudioReady(ctx);
  const t = ctx.currentTime;
  const dur = opts?.durationSec ?? 0.55;
  scheduleSe2GuitarNote(
    ctx,
    destination,
    t + 0.008,
    t + dur,
    pitch,
    velocity127,
    instrumentId,
    transposeSemis,
    { ...opts, scope: opts?.scope ?? 'preview' },
  );
}

/** Panel / fretboard preview — play immediately; warm smplr in background (never block on CDN). */
export async function auditionSe2GuitarNote(
  ctx: AudioContext,
  destination: AudioNode,
  pitch: number,
  instrumentId: string,
  velocity127 = 96,
  transposeSemis = 0,
  opts?: {
    emitVisual?: boolean;
    placement?: Se2GuitarFretDot;
    durationSec?: number;
    articulation?: Se2GuitarArticulationId;
    strokeNoise?: boolean;
    releaseNoise?: boolean;
  },
): Promise<void> {
  ensureSe2GuitarAudioReady(ctx);
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* autoplay policy */
    }
  }

  previewSe2GuitarNote(ctx, destination, pitch, instrumentId, velocity127, transposeSemis, {
    ...opts,
    scope: 'preview',
  });
  void warmupSe2GuitarInstrument(ctx, instrumentId, destination);
}

export type Se2GuitarPreviewNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

/** Staggered chord / strum preview — uses audio clock, not setTimeout. */
export function previewSe2GuitarStrumNotes(
  ctx: AudioContext,
  destination: AudioNode,
  notes: readonly Se2GuitarPreviewNote[],
  instrumentId: string,
  bpm: number,
  transposeSemis = 0,
  opts?: {
    emitVisual?: boolean;
    durationScale?: number;
    scope?: Se2GuitarNoteScope;
    renderMode?: Se2GuitarRenderMode;
    polyphonic?: boolean;
    articulation?: Se2GuitarArticulationId;
    strokeNoise?: boolean;
    releaseNoise?: boolean;
  },
): void {
  ensureSe2GuitarAudioReady(ctx);
  const spb = 60 / Math.max(40, Math.min(240, bpm));
  const t0 = ctx.currentTime + 0.01;
  const durScale = opts?.durationScale ?? 1;
  const scope = opts?.scope ?? 'preview';
  const renderMode = resolveRenderMode(opts);
  const humanized = se2GuitarHumanizePolyNotes(notes);
  const polyphonic = humanized.length > 1;
  for (const note of humanized) {
    const when = t0 + note.startBeat * spb;
    const dur = Math.max(0.06, note.durationBeats * spb * durScale);
    scheduleSe2GuitarNote(
      ctx,
      destination,
      when,
      when + dur,
      note.pitch,
      note.velocity,
      instrumentId,
      transposeSemis,
      {
        emitVisual: opts?.emitVisual !== false,
        scope,
        renderMode: opts?.renderMode ?? (polyphonic ? 'smplr' : renderMode),
        polyphonic,
        articulation: polyphonic ? undefined : opts?.articulation,
        strokeNoise: polyphonic ? false : opts?.strokeNoise,
        releaseNoise: polyphonic ? false : opts?.releaseNoise,
      },
    );
  }
}

export function stopSe2GuitarLoopPreview(): void {
  for (const stop of previewStops) {
    try {
      stop();
    } catch {
      /* */
    }
  }
  previewStops.clear();
}

/** Audition a loop preset from beat 0 — uses project BPM, does not insert on the roll. */
export async function previewSe2GuitarLoop(
  ctx: AudioContext,
  destination: AudioNode,
  notes: readonly Se2GuitarPreviewNote[],
  instrumentId: string,
  bpm: number,
  transposeSemis = 0,
): Promise<void> {
  stopSe2GuitarLoopPreview();
  ensureSe2GuitarAudioReady(ctx);
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* autoplay policy */
    }
  }
  await warmupSe2GuitarInstrument(ctx, instrumentId, destination, { withSampleLayer: false });

  const spb = 60 / Math.max(40, Math.min(240, bpm));
  const t0 = ctx.currentTime + 0.02;
  const humanized = se2GuitarHumanizePolyNotes(notes as Se2GuitarPlaybackNote[]);
  for (const note of humanized) {
    const when = t0 + note.startBeat * spb;
    const tEnd = when + Math.max(0.06, note.durationBeats * spb);
    scheduleSe2GuitarNote(
      ctx,
      destination,
      when,
      tEnd,
      note.pitch,
      note.velocity,
      instrumentId,
      transposeSemis,
      { emitVisual: true, scope: 'preview', renderMode: 'smplr', polyphonic: humanized.length > 1 },
    );
  }
}

export function haltSe2GuitarTransportNotes(): void {
  for (const stop of transportStops) {
    try {
      stop();
    } catch {
      /* */
    }
  }
  transportStops.clear();
}
