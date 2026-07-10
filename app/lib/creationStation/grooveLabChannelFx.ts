/**

 * Groove Lab CH 33–48 per-channel insert FX (cutoff · 5-band EQ · compressor).

 * Persisted in localStorage; applied on each channel bus in `grooveLabAudio`.

 */



import {

  CHORD_BASS_SEQ_CHANNEL_BASE,

  CHORD_BASS_SEQ_CHANNEL_COUNT,

} from '@/app/lib/creationStation/chordBassSequencerSession';

import type { PadSamplerCompressorFx, PadSamplerEqFx } from '@/app/lib/creationStation/padSamplerFxRack';

import {

  clampGrooveLabChannelEq,

  clampGrooveLabEqBands,

  defaultGrooveLabChannelCutoff,

  defaultGrooveLabChannelFxRack,

  grooveLabChannelFxActive,

  migratePadEqToGrooveLabEq,

  normalizeGrooveLabChannelFxRack,

  type GrooveLabChannelCutoffFx,

  type GrooveLabChannelEqFx,

  type GrooveLabChannelFxRack,

  type GrooveLabEqBand,

} from '@/app/lib/creationStation/grooveLabChannelFxEq';



export type {

  GrooveLabChannelCutoffFx,

  GrooveLabChannelEqFx,

  GrooveLabChannelFxRack,

  GrooveLabEqBand,

} from '@/app/lib/creationStation/grooveLabChannelFxEq';



export {

  defaultGrooveLabChannelFxRack,

  grooveLabChannelFxActive,

  normalizeGrooveLabChannelFxRack,

};



export const GROOVE_LAB_CHANNEL_FX_CHANGED = 'groove-lab-channel-fx-changed';



const STORAGE_KEY_V2 = 'groove-lab-channel-fx-v2';

const STORAGE_KEY_V1 = 'groove-lab-channel-fx-v1';



type GrooveLabFxGlobals = {

  __daMusicGrooveLabChannelFx?: Record<number, GrooveLabChannelFxRack>;

};



function windowFxRef(): Record<number, GrooveLabChannelFxRack> {

  const w = globalThis as unknown as GrooveLabFxGlobals;

  w.__daMusicGrooveLabChannelFx ??= {};

  return w.__daMusicGrooveLabChannelFx;

}



function migrateV1Stored(obj: Record<string, unknown>): Record<number, GrooveLabChannelFxRack> {

  const out: Record<number, GrooveLabChannelFxRack> = {};

  for (let i = 0; i < CHORD_BASS_SEQ_CHANNEL_COUNT; i += 1) {

    const ch = CHORD_BASS_SEQ_CHANNEL_BASE + i;

    const row = obj[String(ch)];

    if (row && typeof row === 'object') {

      const legacy = row as { eq?: PadSamplerEqFx; compressor?: PadSamplerCompressorFx };

      out[ch] = normalizeGrooveLabChannelFxRack({

        cutoff: defaultGrooveLabChannelCutoff(),

        eq: legacy.eq ? migratePadEqToGrooveLabEq(legacy.eq) : undefined,

        compressor: legacy.compressor,

      });

    }

  }

  return out;

}



function readStoredFx(): Record<number, GrooveLabChannelFxRack> {

  try {

    const raw =

      typeof localStorage !== 'undefined'

        ? localStorage.getItem(STORAGE_KEY_V2) ?? localStorage.getItem(STORAGE_KEY_V1)

        : null;

    if (!raw) return {};

    const obj = JSON.parse(raw) as Record<string, unknown>;

    const isV1 = typeof localStorage !== 'undefined' && !localStorage.getItem(STORAGE_KEY_V2);

    const migrated = isV1 ? migrateV1Stored(obj) : null;

    const out: Record<number, GrooveLabChannelFxRack> = migrated ?? {};

    for (let i = 0; i < CHORD_BASS_SEQ_CHANNEL_COUNT; i += 1) {

      const ch = CHORD_BASS_SEQ_CHANNEL_BASE + i;

      if (migrated?.[ch]) continue;

      const row = obj[String(ch)];

      if (row && typeof row === 'object') {

        out[ch] = normalizeGrooveLabChannelFxRack(row as Partial<GrooveLabChannelFxRack>);

      }

    }

    if (isV1 && Object.keys(out).length > 0) {

      writeStoredFx(out);

    }

    return out;

  } catch {

    return {};

  }

}



function writeStoredFx(all: Record<number, GrooveLabChannelFxRack>): void {

  try {

    const flat: Record<string, GrooveLabChannelFxRack> = {};

    for (let i = 0; i < CHORD_BASS_SEQ_CHANNEL_COUNT; i += 1) {

      const ch = CHORD_BASS_SEQ_CHANNEL_BASE + i;

      flat[String(ch)] = all[ch] ?? defaultGrooveLabChannelFxRack();

    }

    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(flat));

  } catch {

    /* quota / privacy mode */

  }

}



export function readGrooveLabChannelFx(ch: number): GrooveLabChannelFxRack {

  const live = windowFxRef()[ch];

  if (live) return normalizeGrooveLabChannelFxRack(live);

  const stored = readStoredFx()[ch];

  if (stored) {

    windowFxRef()[ch] = stored;

    return stored;

  }

  const d = defaultGrooveLabChannelFxRack();

  windowFxRef()[ch] = d;

  return d;

}



export function setGrooveLabChannelFx(

  ch: number,

  patch: {

    cutoff?: Partial<GrooveLabChannelCutoffFx>;

    eq?: Partial<GrooveLabChannelEqFx> & { bands?: Array<Partial<GrooveLabEqBand>> };

    compressor?: Partial<PadSamplerCompressorFx>;

  },

): GrooveLabChannelFxRack {

  const prev = readGrooveLabChannelFx(ch);

  let eq = prev.eq;

  if (patch.eq) {

    const { bands: bandPatch, ...eqRest } = patch.eq;

    eq = clampGrooveLabChannelEq({ ...eq, ...eqRest });

    if (bandPatch) {

      eq = clampGrooveLabChannelEq({

        ...eq,

        bands: clampGrooveLabEqBands(eq.bands.map((b, i) => ({ ...b, ...(bandPatch[i] ?? {}) }))),

      });

    }

  }

  const next = normalizeGrooveLabChannelFxRack({

    cutoff: { ...prev.cutoff, ...(patch.cutoff ?? {}) },

    eq,

    compressor: { ...prev.compressor, ...(patch.compressor ?? {}) },

  });

  windowFxRef()[ch] = next;

  writeStoredFx(windowFxRef());

  if (typeof window !== 'undefined') {

    window.dispatchEvent(new CustomEvent(GROOVE_LAB_CHANNEL_FX_CHANGED, { detail: { ch, rack: next } }));

  }

  return next;

}



function dbToLinear(db: number): number {

  return Math.pow(10, db / 20);

}



export type GrooveLabChannelFxNodes = {

  highpass: BiquadFilterNode;

  lowpass: BiquadFilterNode;

  eqBands: BiquadFilterNode[];

  userComp: DynamicsCompressorNode;

  compMakeup: GainNode;

};



/** Push rack settings onto live Web Audio nodes (call from `resolveGrooveLabChannelDest`). */

export function applyGrooveLabChannelFxNodes(

  ctx: AudioContext,

  nodes: GrooveLabChannelFxNodes,

  rack: GrooveLabChannelFxRack,

): void {

  const t = ctx.currentTime;

  const sr = ctx.sampleRate;

  const ny = sr * 0.48;



  try {

    const cutoff = rack.cutoff;

    if (cutoff.enabled) {

      nodes.highpass.frequency.setValueAtTime(Math.min(Math.max(20, cutoff.lowCutHz), ny * 0.4), t);

      nodes.highpass.Q.setValueAtTime(0.707, t);

      nodes.lowpass.frequency.setValueAtTime(Math.min(Math.max(400, cutoff.highCutHz), ny * 0.98), t);

      nodes.lowpass.Q.setValueAtTime(0.707, t);

    } else {

      nodes.highpass.frequency.setValueAtTime(20, t);

      nodes.lowpass.frequency.setValueAtTime(ny * 0.98, t);

    }



    const eq = rack.eq;

    for (let i = 0; i < nodes.eqBands.length; i += 1) {

      const node = nodes.eqBands[i]!;

      const band = eq.bands[i];

      if (!band) continue;

      node.type = band.kind;

      if (eq.enabled) {

        node.frequency.setValueAtTime(Math.min(Math.max(30, band.freqHz), ny * 0.45), t);

        node.gain.setValueAtTime(Math.max(-12, Math.min(12, band.gainDb)), t);

        node.Q.setValueAtTime(band.kind === 'peaking' ? Math.max(0.35, Math.min(12, band.q)) : 0.707, t);

      } else {

        node.gain.setValueAtTime(0, t);

      }

    }



    const comp = rack.compressor;

    if (comp.enabled) {

      nodes.userComp.threshold.setValueAtTime(Math.max(-48, Math.min(0, comp.thresholdDb)), t);

      nodes.userComp.knee.setValueAtTime(Math.max(0, Math.min(40, comp.kneeDb)), t);

      nodes.userComp.ratio.setValueAtTime(Math.max(1.01, Math.min(20, comp.ratio)), t);

      nodes.userComp.attack.setValueAtTime(Math.max(1e-4, Math.min(0.95, comp.attackSec)), t);

      nodes.userComp.release.setValueAtTime(Math.max(0.02, Math.min(1.2, comp.releaseSec)), t);

      nodes.compMakeup.gain.setValueAtTime(

        Math.min(8, dbToLinear(Math.max(0, Math.min(18, comp.makeupDb)))),

        t,

      );

    } else {

      nodes.userComp.threshold.setValueAtTime(0, t);

      nodes.userComp.ratio.setValueAtTime(1, t);

      nodes.userComp.knee.setValueAtTime(0, t);

      nodes.compMakeup.gain.setValueAtTime(1, t);

    }

  } catch {

    /* closed ctx */

  }

}



export function createGrooveLabChannelFxNodes(ctx: AudioContext): GrooveLabChannelFxNodes {

  const highpass = ctx.createBiquadFilter();

  highpass.type = 'highpass';

  highpass.frequency.value = 20;

  highpass.Q.value = 0.707;



  const lowpass = ctx.createBiquadFilter();

  lowpass.type = 'lowpass';

  lowpass.frequency.value = ctx.sampleRate * 0.48;

  lowpass.Q.value = 0.707;



  const eqBands: BiquadFilterNode[] = [];

  const defaults = defaultGrooveLabChannelFxRack().eq.bands;

  let tail: AudioNode = lowpass;

  for (const band of defaults) {

    const f = ctx.createBiquadFilter();

    f.type = band.kind;

    f.frequency.value = band.freqHz;

    f.gain.value = 0;

    f.Q.value = band.kind === 'peaking' ? band.q : 0.707;

    tail.connect(f);

    tail = f;

    eqBands.push(f);

  }



  const userComp = ctx.createDynamicsCompressor();

  userComp.threshold.value = 0;

  userComp.ratio.value = 1;



  const compMakeup = ctx.createGain();

  compMakeup.gain.value = 1;



  highpass.connect(lowpass);

  tail.connect(userComp);

  userComp.connect(compMakeup);



  return { highpass, lowpass, eqBands, userComp, compMakeup };

}


