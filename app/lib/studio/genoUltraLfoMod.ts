/**
 * Geno Ultra — shared LFO rate, routing, and Web Audio modulation helpers.
 */
import type {
  GenoUltraLfoShape,
  GenoUltraModDest,
  GenoUltraSynthVoiceParams,
} from '@/app/lib/studio/genoUltraSynthTypes';

export type GenoUltraLfoRoute = {
  source: 'lfo1' | 'lfo2';
  dest: GenoUltraModDest;
  amount: number;
  depth: number;
};

export function genoUltraLfoRateHz(voice: GenoUltraSynthVoiceParams, which: 1 | 2, bpm: number): number {
  const sync = which === 1 ? voice.lfo1Sync : voice.lfo2Sync;
  const free = which === 1 ? voice.lfo1RateHz : voice.lfo2RateHz;
  if (!sync) return Math.max(0.02, free);
  const beatHz = bpm / 60;
  return Math.max(0.02, beatHz * Math.max(0.25, free));
}

export function genoUltraLfoOscType(shape: GenoUltraLfoShape): OscillatorType {
  return shape === 'saw' ? 'sawtooth' : shape;
}

/** Active LFO routes — matrix slots plus default filter wobble when depth > 0. */
export function genoUltraCollectLfoRoutes(voice: GenoUltraSynthVoiceParams): GenoUltraLfoRoute[] {
  const routes: GenoUltraLfoRoute[] = [];
  for (const source of ['lfo1', 'lfo2'] as const) {
    const depth = source === 'lfo1' ? voice.lfo1Depth : voice.lfo2Depth;
    if (depth < 0.001) continue;

    const matrixSlots = voice.modSlots.filter(
      (s) => s.source === source && s.dest !== 'off' && Math.abs(s.amount) > 0.001,
    );

    if (matrixSlots.length === 0) {
      routes.push({ source, dest: 'filterCutoff', amount: 1, depth });
      continue;
    }

    for (const slot of matrixSlots) {
      routes.push({ source, dest: slot.dest, amount: slot.amount, depth });
    }
  }
  return routes;
}

function lfoModGain(baseValue: number, scale: number, amount: number, depth: number): number {
  return Math.abs(baseValue * scale * amount * depth);
}

/** One-shot LFO for per-note voices (keyboard preview, transport notes). */
export function genoUltraConnectLfoMod(
  ctx: AudioContext,
  when: number,
  until: number,
  route: GenoUltraLfoRoute,
  voice: GenoUltraSynthVoiceParams,
  bpm: number,
  param: AudioParam,
  baseValue: number,
  scale: number,
): OscillatorNode | null {
  const mod = lfoModGain(baseValue, scale, route.amount, route.depth);
  if (mod < 0.001) return null;

  const which = route.source === 'lfo1' ? 1 : 2;
  const lfo = ctx.createOscillator();
  lfo.type = genoUltraLfoOscType(which === 1 ? voice.lfo1Shape : voice.lfo2Shape);
  lfo.frequency.setValueAtTime(genoUltraLfoRateHz(voice, which, bpm), when);
  const g = ctx.createGain();
  g.gain.setValueAtTime(mod, when);
  lfo.connect(g);
  g.connect(param);
  lfo.start(when);
  lfo.stop(until + 0.08);
  return lfo;
}

/** Persistent LFO on the ARP mono voice chain — stopped when the chain is rebuilt. */
export function genoUltraStartContinuousLfo(
  ctx: AudioContext,
  route: GenoUltraLfoRoute,
  voice: GenoUltraSynthVoiceParams,
  bpm: number,
  param: AudioParam,
  baseValue: number,
  scale: number,
): OscillatorNode | null {
  const mod = lfoModGain(baseValue, scale, route.amount, route.depth);
  if (mod < 0.001) return null;

  const when = ctx.currentTime;
  const which = route.source === 'lfo1' ? 1 : 2;
  const lfo = ctx.createOscillator();
  lfo.type = genoUltraLfoOscType(which === 1 ? voice.lfo1Shape : voice.lfo2Shape);
  lfo.frequency.setValueAtTime(genoUltraLfoRateHz(voice, which, bpm), when);
  const g = ctx.createGain();
  g.gain.setValueAtTime(mod, when);
  lfo.connect(g);
  g.connect(param);
  lfo.start(when);
  return lfo;
}
