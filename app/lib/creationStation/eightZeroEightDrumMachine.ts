/**
 * Lightweight synth drums for 808 Lab companion sequencer (no sample fetch).
 * Recipes mirror the spirit of `scheduleDrumVoice` in aiPatternRender.ts (kick sweep, etc.).
 */

export const EIGHT_ZERO_EIGHT_DRUM_LANE_LABELS = ['Kick', 'Snare', 'Closed hat', 'Open hat'] as const;
export type EightZeroEightDrumLane = 0 | 1 | 2 | 3;

const CH_IDS = [1, 2, 4, 5] as const; // kick, snare, closed HH, open HH — same as aiPatternRender

function scheduleDrumVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  chId: number,
  velocity: number,
  startTime: number,
): void {
  const vol = (velocity / 127) * 0.42;
  const makeOsc = (
    freq: number | null,
    freqEnd: number | null,
    duration: number,
    type: OscillatorType = 'sine',
    volScale = 1,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    if (freq !== null) osc.frequency.setValueAtTime(freq, startTime);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
    }
    gain.gain.setValueAtTime(vol * volScale, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  };

  switch (chId) {
    case 1:
      makeOsc(150, 0.01, 0.5);
      break;
    case 2:
      makeOsc(200, null, 0.15, 'triangle');
      break;
    case 4:
      makeOsc(8000 + Math.random() * 4000, null, 0.08, 'square', 0.5);
      break;
    case 5:
      makeOsc(9000 + Math.random() * 5000, null, 0.3, 'square', 0.6);
      break;
    default:
      makeOsc(440, null, 0.1, 'sine', 0.4);
  }
}

/** Schedule one drum hit on `ctx` at `whenSec` (audio clock). */
export function play808LabDrum(
  ctx: AudioContext,
  whenSec: number,
  lane: EightZeroEightDrumLane,
  velocity = 110,
): void {
  const ch = CH_IDS[lane] ?? 1;
  scheduleDrumVoice(ctx, ctx.destination, ch, velocity, whenSec);
}
