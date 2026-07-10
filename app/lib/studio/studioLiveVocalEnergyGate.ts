/**
 * Live Vocal DSP energy gate — mute inserts until real modulator signal (mic / clip).
 * Shared by Pitch Tune output and Vocoder wet/dry paths.
 */

export type StudioLiveVocalEnergyGate = {
  setGains: (gains: number[]) => void;
  stop: () => void;
};

/** Mute target gains until voiced energy on modProbe — prevents idle hum on silence. */
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
  let open = false;
  let noiseRms = 0.002;
  let noisePeak = 0.006;
  let calib = 0;
  let targets = fullGains.slice();

  const apply = () => {
    const t = ctx.currentTime;
    for (let i = 0; i < gates.length; i += 1) {
      const g = gates[i];
      if (!g) continue;
      const v = open ? (targets[i] ?? 0) : 0;
      g.gain.setTargetAtTime(v, t, open ? 0.01 : 0.05);
    }
  };

  for (const g of gates) g.gain.value = 0;

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

    if (calib < 28) {
      calib += 1;
      noiseRms = Math.max(noiseRms, rms);
      noisePeak = Math.max(noisePeak, peak);
      return;
    }

    const rmsGate = Math.max(0.011, noiseRms * 3.2 + 0.004);
    const peakGate = Math.max(0.028, noisePeak * 2.8 + 0.01);
    const voiced = rms >= rmsGate && peak >= peakGate;

    if (!voiced) {
      noiseRms = noiseRms * 0.992 + rms * 0.008;
      noisePeak = noisePeak * 0.992 + peak * 0.008;
    }

    if (voiced !== open) {
      open = voiced;
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
