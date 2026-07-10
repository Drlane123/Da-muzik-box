/**
 * Instant guitar pluck — plays immediately while smplr / samples load.
 */
function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function previewSe2GuitarQuickPluck(
  ctx: AudioContext,
  destination: AudioNode,
  midi: number,
  velocity127 = 96,
  durationSec = 0.42,
): void {
  const when = ctx.currentTime + 0.002;
  const vel = Math.max(0.05, velocity127 / 127);
  const fund = midiToHz(midi);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(0.28 * vel, when + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, when + durationSec);

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(Math.min(5200, fund * 8), when);
  lpf.frequency.exponentialRampToValueAtTime(Math.max(600, fund * 2.2), when + durationSec * 0.85);
  lpf.Q.value = 0.75;

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = fund;

  const harm = ctx.createOscillator();
  harm.type = 'sawtooth';
  harm.frequency.value = fund * 2;
  const harmGain = ctx.createGain();
  harmGain.gain.value = 0.12 * vel;

  osc.connect(env);
  harm.connect(harmGain).connect(env);
  env.connect(lpf).connect(destination);

  const stopAt = when + durationSec + 0.05;
  osc.start(when);
  harm.start(when);
  osc.stop(stopAt);
  harm.stop(stopAt);
}
