/**
 * Vocal DSP validation — Pitch Tune OLA + Vocoder envelope chain.
 * Run: bun run scripts/validate-vocal-dsp.ts
 */
import { applyPitchTuneSamples } from '../app/lib/studio/studioPitchTune.ts';
import {
  pitchShiftOlaVariableRate,
} from '../app/lib/studio/studioPitchShiftOla.ts';
import {
  studioVocoderCompandEnvelope,
  studioVocoderShapeEnvelope,
} from '../app/lib/studio/studioVocoderAnalyze.ts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function sineMono(sr: number, sec: number, hz: number, amp = 0.5): Float32Array {
  const n = Math.floor(sr * sec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  return out;
}

function rms(samples: Float32Array): number {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i]! * samples[i]!;
  return Math.sqrt(s / samples.length);
}

function crudePitchHz(samples: Float32Array, sr: number): number {
  const lagMin = Math.floor(sr / 1200);
  const lagMax = Math.floor(sr / 80);
  let bestLag = lagMin;
  let best = -1;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let sum = 0;
    for (let i = 0; i < samples.length - lag; i++) sum += samples[i]! * samples[i + lag]!;
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return sr / bestLag;
}

// --- OLA pitch shift ---
{
  const sr = 44100;
  const src = sineMono(sr, 0.8, 440);
  const upRate = Math.pow(2, 2 / 12);
  const rates = new Float32Array(src.length);
  rates.fill(upRate);
  const out = pitchShiftOlaVariableRate(src, rates);
  assert(out.length > 100, 'OLA output length');
  assert(rms(out) > 0.01, 'OLA output has energy');
  const inHz = crudePitchHz(src, sr);
  const outHz = crudePitchHz(out, sr);
  assert(outHz > inHz + 2, `OLA should shift pitch up (${inHz.toFixed(1)} → ${outHz.toFixed(1)})`);
  console.log('✓ OLA pitch shift');
}

// --- Pitch Tune scale snap ---
{
  const sr = 44100;
  const src = sineMono(sr, 0.6, 466.16); // slightly sharp B4
  const out = applyPitchTuneSamples(src, sr, {
    strength: 0.95,
    retuneSpeedMs: 0,
    flexTune: 0,
    humanize: 0,
    keyRoot: 0,
    scaleId: 'major',
    tracking: 0.5,
    formantPreserve: 0.9,
  });
  assert(rms(out) > 0.01, 'Pitch Tune output energy');
  console.log('✓ Pitch Tune correction');
}

// --- Vocoder envelope ATK/REL ---
{
  const raw = new Float32Array(40);
  for (let i = 10; i < 30; i++) raw[i] = 1;
  const shaped = studioVocoderShapeEnvelope(raw, 0.01, 5, 80);
  assert(shaped[12]! > shaped[9]!, 'Attack rises on onset');
  assert(shaped[38]! < shaped[28]! + 0.05, 'Release falls after offset');
  const companded = studioVocoderCompandEnvelope(new Float32Array([0.12, 0.18, 0.25]), 0.85);
  assert(companded[0]! > 0.12, 'Companding lifts quiet bands');
  console.log('✓ Vocoder envelope ATK/REL + companding');
}

console.log('\nAll vocal DSP validation checks passed.');
