/**

 * Groove Lead header — optional ARP / RIFF preview (off = unchanged single-note preview).

 * Notes are scheduled on the Web Audio clock (one bar per burst), not setInterval + "now".

 */

import type { GrooveLabQuantize } from '@/app/lib/creationStation/grooveLabRoll';

import { waveLeafClampMidi } from '@/app/lib/creationStation/waveLeafPitch';



export type WaveLeafPhraseMode = 'arp' | 'riff';



const ARP_PATTERN = [0, 4, 7, 12, 16, 12, 7, 4] as const;

const RIFF_PATTERN = [0, 4, 7, 4, 0, 7, 12, 7, 4, 0, 7, 4, 12, 7, 4, 0] as const;



export function waveLeafQuantizeStepSec(bpm: number, quantize: GrooveLabQuantize): number {

  const beatSec = 60 / Math.max(40, bpm);

  switch (quantize) {

    case '1/4':

      return beatSec;

    case '1/8':

      return beatSec / 2;

    case '1/16':

      return beatSec / 4;

    case '1/32':

      return beatSec / 8;

    default:

      return beatSec / 4;

  }

}



export function waveLeafPhraseStepsPerBar(quantize: GrooveLabQuantize): number {

  switch (quantize) {

    case '1/4':

      return 4;

    case '1/8':

      return 8;

    case '1/16':

      return 16;

    case '1/32':

      return 32;

    default:

      return 16;

  }

}



export function waveLeafPhraseHoldBeats(bpm: number, quantize: GrooveLabQuantize, mode: WaveLeafPhraseMode): number {

  const stepBeats = (waveLeafQuantizeStepSec(bpm, quantize) * bpm) / 60;

  return mode === 'riff' ? Math.max(0.18, stepBeats * 0.72) : Math.max(0.22, stepBeats * 0.92);

}



export function waveLeafPhraseMidiAtStep(

  mode: WaveLeafPhraseMode,

  rootMidi: number,

  stepIndex: number,

): number {

  const pattern = mode === 'arp' ? ARP_PATTERN : RIFF_PATTERN;

  return waveLeafClampMidi(rootMidi + pattern[stepIndex % pattern.length]!);

}



export type WaveLeafPhraseScheduledStepFn = (midi: number, whenSec: number, holdBeats: number) => void;



/**

 * Schedule `bars` of grid steps starting at `startWhen` (audio seconds).

 * Returns bar length and the next global step index for looping.

 */

export function scheduleWaveLeafPhraseBars(

  ctx: AudioContext,

  startWhen: number,

  bpm: number,

  quantize: GrooveLabQuantize,

  mode: WaveLeafPhraseMode,

  rootMidi: number,

  startStepIndex: number,

  onStep: WaveLeafPhraseScheduledStepFn,

  bars = 1,

): { barDurationSec: number; nextStepIndex: number } {

  const stepSec = waveLeafQuantizeStepSec(bpm, quantize);

  const stepsPerBar = waveLeafPhraseStepsPerBar(quantize);

  const holdBeats = waveLeafPhraseHoldBeats(bpm, quantize, mode);

  const totalSteps = stepsPerBar * Math.max(1, bars);

  const scheduleFloor = ctx.currentTime + 0.004;

  let stepIndex = startStepIndex;



  for (let i = 0; i < totalSteps; i += 1) {

    const when = startWhen + i * stepSec;

    if (when >= scheduleFloor) {

      onStep(waveLeafPhraseMidiAtStep(mode, rootMidi, stepIndex), when, holdBeats);

    }

    stepIndex += 1;

  }



  return { barDurationSec: stepsPerBar * stepSec, nextStepIndex: stepIndex };

}



/**

 * Loop phrase preview: first bar scheduled on `anchorWhen`, then one bar per interval while held.

 */

export function startWaveLeafPhrasePreviewOnCtx(

  ctx: AudioContext,

  anchorWhen: number,

  bpm: number,

  quantize: GrooveLabQuantize,

  mode: WaveLeafPhraseMode,

  rootMidi: number,

  onStep: WaveLeafPhraseScheduledStepFn,

  loop = true,

): () => void {

  if (ctx.state === 'closed') return () => {};



  let cancelled = false;

  let stepIndex = 0;

  let nextBarWhen = anchorWhen;

  let intervalId: ReturnType<typeof setInterval> | null = null;



  const runBar = () => {

    if (cancelled) return;

    const { barDurationSec, nextStepIndex } = scheduleWaveLeafPhraseBars(

      ctx,

      nextBarWhen,

      bpm,

      quantize,

      mode,

      rootMidi,

      stepIndex,

      onStep,

      1,

    );

    stepIndex = nextStepIndex;

    nextBarWhen += barDurationSec;

  };



  runBar();



  if (loop) {

    const barMs = Math.max(

      80,

      Math.round(waveLeafPhraseStepsPerBar(quantize) * waveLeafQuantizeStepSec(bpm, quantize) * 1000),

    );

    intervalId = setInterval(runBar, barMs);

  }



  return () => {

    cancelled = true;

    if (intervalId != null) clearInterval(intervalId);

  };

}


