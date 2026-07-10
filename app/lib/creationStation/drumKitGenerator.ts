/**
 * Procedural drum one-shots + starter grooves for Creation Station Beat Lab.
 * Browser-only synthesis (no network) — WAV bytes match {@link fileToStoredPadSample} storage shape.
 */

import type { StoredPadSample } from '@/app/lib/padSampleStorage';

export type DrumKitGeneratorStyle = 'house' | 'trap' | 'lofi' | 'rnb' | 'dance' | 'disco';

export type CreationDrumPattern = boolean[][];

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** 16-bit PCM WAV from AudioBuffer (mono or stereo → interleaved). */
function encodeWavFromAudioBuffer(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  const ch0 = buffer.getChannelData(0);
  const ch1 = numChannels > 1 ? buffer.getChannelData(1) : ch0;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, ch === 0 ? ch0[i] : ch1[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return out;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(sub) as unknown as number[]);
  }
  return btoa(binary);
}

export function audioBufferToStoredKitSample(
  buffer: AudioBuffer,
  label: string,
  rootBpm: number,
): StoredPadSample {
  const ab = encodeWavFromAudioBuffer(buffer);
  const data = uint8ToBase64(new Uint8Array(ab));
  return { mime: 'audio/wav', data, label, rootBpm };
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic one-shot per pad index (0–15), style flavors gain/decay. */
export function synthesizeKitPadBuffer(
  sampleRate: number,
  padIndex: number,
  style: DrumKitGeneratorStyle,
  seed: number,
): AudioBuffer {
  const rng = mulberry32(seed * 9973 + padIndex * 104729);
  const styleGain =
    style === 'house'
      ? 1.05
      : style === 'trap'
        ? 1.12
        : style === 'dance'
          ? 1.1
          : style === 'disco'
            ? 1.08
            : style === 'rnb'
              ? 0.9
              : 0.92;
  const decayMul = style === 'lofi' || style === 'rnb' ? 0.82 : 1;

  const durBase = 0.14 + padIndex * 0.004;
  const dur = Math.min(0.42, durBase * (style === 'trap' ? 1.05 : 1));
  const n = Math.max(1, Math.floor(sampleRate * dur));
  const buf = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate });
  const ch = buf.getChannelData(0);

  const noise = (amp: number) => (rng() * 2 - 1) * amp;

  if (padIndex === 0) {
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * (22 * decayMul) * (style === 'trap' ? 1.08 : 1));
      const f0 = style === 'lofi' || style === 'rnb' ? 95 : style === 'dance' ? 122 : 118;
      const f = f0 * Math.exp(-t * (38 + padIndex)) + 42;
      const body = Math.sin(2 * Math.PI * f * t) * env * 0.88 * styleGain;
      const click = i < 45 ? noise(0.45) * (1 - i / 45) : 0;
      ch[i] = Math.tanh(body + click);
    }
  } else if (padIndex === 1) {
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * (26 + (style === 'house' ? 4 : 0)));
      const tone = Math.sin(2 * Math.PI * 185 * t) * env * 0.22;
      const nse = noise(0.55) * env;
      ch[i] = Math.tanh((tone + nse) * styleGain);
    }
  } else if (padIndex === 2) {
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const e1 = Math.exp(-Math.max(0, t - 0.001) * 90);
      const e2 = Math.exp(-Math.max(0, t - 0.008) * 70);
      ch[i] = Math.tanh((noise(0.35) * e1 + noise(0.3) * e2) * styleGain);
    }
  } else if (padIndex === 3 || padIndex === 4) {
    const short = padIndex === 3;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * (short ? 140 : 55));
      const hp = noise(0.5) - (i > 0 ? ch[i - 1] * 0.15 : 0);
      ch[i] = Math.tanh(hp * env * (short ? 0.85 : 1) * styleGain);
    }
  } else if (padIndex === 5 || padIndex === 6) {
    const base = padIndex === 5 ? 210 : 140;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 14);
      const f = base * Math.exp(-t * 10);
      ch[i] = Math.tanh(Math.sin(2 * Math.PI * f * t) * env * 0.75 * styleGain);
    }
  } else if (padIndex === 7) {
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 180);
      ch[i] = Math.tanh(noise(0.55) * env * styleGain);
    }
  } else if (padIndex === 10 || padIndex === 11) {
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * (padIndex === 10 ? 4.5 : 6));
      const s = Math.sin(2 * Math.PI * (padIndex === 10 ? 4200 : 3100 + rng() * 80) * t);
      ch[i] = Math.tanh((noise(0.25) + s * 0.12) * env * styleGain);
    }
  } else if (padIndex === 15) {
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 7);
      const f = 36 + rng() * 4;
      ch[i] = Math.tanh(Math.sin(2 * Math.PI * f * t) * env * 0.9 * styleGain);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * (30 + padIndex * 2));
      ch[i] = Math.tanh(noise(0.4) * env * styleGain);
    }
  }

  const fade = Math.min(80, n);
  for (let i = 0; i < fade; i++) {
    ch[n - 1 - i] *= i / fade;
  }
  return buf;
}

/**
 * Starter groove on columns `[0, patternCols)`; respects `subdiv` steps per quarter and `qpb` quarters per bar.
 */
export function buildKitGroovePattern(opts: {
  totalCols: number;
  patternCols: number;
  subdiv: number;
  qpb: number;
  style: DrumKitGeneratorStyle;
  seed: number;
}): CreationDrumPattern {
  const { totalCols, patternCols, subdiv, qpb, style, seed } = opts;
  const cols = Math.max(0, Math.min(patternCols, totalCols));
  const rows = 16;
  const out: CreationDrumPattern = Array.from({ length: rows }, () =>
    Array.from({ length: totalCols }, () => false),
  );
  const sub = Math.max(1, Math.round(subdiv));
  const q = Math.max(2, Math.min(16, Math.round(qpb)));
  const stepsPerBar = q * sub;

  for (let c = 0; c < cols; c++) {
    const stepInBar = c % stepsPerBar;
    const beatInBar = Math.floor(stepInBar / sub) % q;
    const stepInQuarter = stepInBar % sub;

    const rCol = mulberry32(seed + c * 2654435761)();

    let kick = false;
    if (style === 'house' || style === 'disco' || style === 'dance') {
      kick = stepInQuarter === 0;
    } else if (style === 'trap') {
      kick = stepInQuarter === 0 && (beatInBar % 2 === 0 || (beatInBar === 3 && rCol > 0.55));
      if (stepInQuarter === Math.max(1, Math.floor(sub * 0.5)) && beatInBar === 3 && rCol > 0.72) kick = true;
    } else if (style === 'rnb') {
      kick =
        stepInQuarter === 0 &&
        (beatInBar === 0 ||
          (beatInBar === 2 && rCol > 0.38) ||
          (beatInBar === 3 && rCol > 0.52));
      if (!kick && beatInBar === 2 && stepInQuarter === Math.floor(sub * 0.5) && rCol > 0.68) {
        kick = true;
      }
    } else {
      kick = stepInQuarter === 0 && (beatInBar === 0 || beatInBar === 2);
    }
    if (kick) out[0]![c] = true;

    if (stepInQuarter === 0 && (beatInBar === 1 || beatInBar === 3)) {
      out[1]![c] = true;
    }

    if (out[1]![c] && clapOnSnare(style, rCol)) {
      out[2]![c] = true;
    }

    if (sub >= 2) {
      const eighth = Math.max(1, Math.floor(sub / 2));
      if (style === 'house' || style === 'disco') {
        if (stepInQuarter % eighth === 0 && rCol > 0.08) out[3]![c] = true;
        if (style === 'disco' && sub >= 4 && rCol > 0.42) out[3]![c] = true;
      } else if (style === 'dance') {
        const sixt = Math.max(1, Math.floor(sub / 4));
        if (stepInQuarter % sixt === 0 && rCol > 0.1) out[3]![c] = true;
      } else if (style === 'trap') {
        const sixt = Math.max(1, Math.floor(sub / 4));
        if (stepInQuarter % sixt === 0 && rCol > 0.18) out[3]![c] = true;
      } else if (style === 'rnb') {
        if ((stepInQuarter === 0 || stepInQuarter === eighth) && rCol > 0.14) out[3]![c] = true;
      } else {
        if ((stepInQuarter === 0 || stepInQuarter === eighth) && rCol > 0.25) out[3]![c] = true;
      }
    }

    if (openHatStep(style, beatInBar, stepInQuarter, sub, rCol)) {
      out[4]![c] = true;
    }

    if (style === 'rnb') {
      if (beatInBar === 3 && stepInQuarter === Math.floor(sub * 0.75) && rCol > 0.78) out[12]![c] = true;
    } else if (style !== 'trap' && stepInQuarter % Math.max(1, Math.floor(sub / 2)) === 0 && rCol > 0.5) {
      out[12]![c] = true;
    }
  }

  return out;
}

function clapOnSnare(style: DrumKitGeneratorStyle, r: number): boolean {
  if (style === 'house') return r > 0.55;
  if (style === 'rnb') return r > 0.62;
  if (style === 'disco' || style === 'dance') return r > 0.42;
  return r > 0.35;
}

function openHatStep(
  style: DrumKitGeneratorStyle,
  beatInBar: number,
  stepInQuarter: number,
  sub: number,
  r: number,
): boolean {
  if (style === 'house') return beatInBar === 3 && stepInQuarter === Math.floor(sub * 0.75) && r > 0.4;
  if (style === 'trap') return beatInBar === 2 && stepInQuarter === 0 && r > 0.65;
  if (style === 'disco') {
    return (beatInBar === 1 || beatInBar === 3) && stepInQuarter === Math.floor(sub / 2) && r > 0.32;
  }
  if (style === 'dance') return stepInQuarter === Math.floor(sub * 0.75) && r > 0.28;
  if (style === 'rnb') return beatInBar === 2 && stepInQuarter === Math.floor(sub / 2) && r > 0.58;
  return beatInBar === 1 && stepInQuarter === Math.floor(sub / 2) && r > 0.55;
}
