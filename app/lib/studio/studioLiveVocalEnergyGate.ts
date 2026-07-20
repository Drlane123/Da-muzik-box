/**
 * Live Vocal DSP energy gate — duck idle carrier hum when modulator is silent.
 * Fail-open: start audible, close only after sustained silence.
 */

export type StudioLiveVocalEnergyGate = {
  setGains: (gains: number[]) => void;
  stop: () => void;
};

/** Match live Pitch Tune — quiet mics still open the FX path. */
const VOICED_RMS = 0.0025;
const VOICED_PEAK = 0.006;
/** Require this many quiet ticks before closing (avoid chopping consonants). */
const CLOSE_HOLD_TICKS = 8;

/** Duck target gains when modProbe is silent — starts open so FX is audible immediately. */
export function attachStudioLiveVocalEnergyGate(
  ctx: BaseAudioContext,
  modProbe: AudioNode,
  gates: GainNode[],
  fullGains: number[],
): StudioLiveVocalEnergyGate {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.55;
  modProbe.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let open = true;
  let quietTicks = 0;
  let noiseRms = 0.0015;
  let noisePeak = 0.004;
  let targets = fullGains.slice();

  const apply = () => {
    const t = ctx.currentTime;
    for (let i = 0; i < gates.length; i += 1) {
      const g = gates[i];
      if (!g) continue;
      const v = open ? (targets[i] ?? 0) : 0;
      g.gain.setTargetAtTime(v, t, open ? 0.01 : 0.08);
    }
  };

  for (let i = 0; i < gates.length; i += 1) {
    const g = gates[i];
    if (g) g.gain.value = targets[i] ?? 1;
  }

  const id = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = buf[i] ?? 0;
      const av = Math.abs(v);
      if (av > peak) peak = av;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / Math.max(1, buf.length));

    const rmsGate = Math.max(VOICED_RMS, noiseRms * 1.7 + 0.001);
    const peakGate = Math.max(VOICED_PEAK, noisePeak * 1.55 + 0.0025);
    const voiced = rms >= rmsGate && peak >= peakGate;

    if (voiced) {
      quietTicks = 0;
      if (!open) {
        open = true;
        apply();
      }
      return;
    }

    noiseRms = noiseRms * 0.995 + Math.min(rms, rmsGate) * 0.005;
    noisePeak = noisePeak * 0.995 + Math.min(peak, peakGate) * 0.005;
    quietTicks = Math.min(CLOSE_HOLD_TICKS, quietTicks + 1);
    if (quietTicks >= CLOSE_HOLD_TICKS && open) {
      open = false;
      apply();
    }
  }, 24);

  return {
    setGains: (gains) => {
      targets = gains.slice();
      apply();
    },
    stop: () => {
      clearInterval(id);
      try {
        modProbe.disconnect(analyser);
      } catch {
        /* */
      }
      try {
        analyser.disconnect();
      } catch {
        /* */
      }
    },
  };
}
