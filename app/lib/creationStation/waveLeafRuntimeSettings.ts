/**
 * Live Groove Lead synth settings — panel writes here; transport reads on every note.
 * Avoids localStorage lag so GENERATE + PLAY use the preset you just picked.
 */
import {
  readWaveLeafSynthSettings as readStoredWaveLeafSynthSettings,
  type WaveLeafSynthSettings,
} from '@/app/lib/creationStation/waveLeafSettings';

let runtime: WaveLeafSynthSettings | null = null;
let outputGain = 0.82;

export function writeWaveLeafRuntimeSettings(
  settings: WaveLeafSynthSettings,
  opts?: { outputGain?: number },
): void {
  runtime = settings;
  if (opts?.outputGain != null) {
    outputGain = Math.max(0.2, Math.min(1, opts.outputGain));
  }
}

export function readWaveLeafOutputGain(): number {
  return outputGain;
}

/** Prefer in-memory panel state; fall back to localStorage. */
export function readWaveLeafSynthSettings(): WaveLeafSynthSettings {
  return runtime ?? readStoredWaveLeafSynthSettings();
}
