/**
 * RVC Singing Voice Converter — open-source paths (no paid APIs).
 *
 * 1. **Browser DSP** (default): formant shift + EQ + pitch character presets
 * 2. **Local RVC server** (optional): POST to `VITE_MUSIC_ENHANCER_URL/rvc/convert`
 *    when you run RVC WebUI / a local infer service — free, self-hosted
 *
 * Imported `.pth` / `.index` models are forwarded to the local server when available.
 */
import {
  audioBufferToMonophonicTimedNotes,
  type TimedMonophonicNote,
} from '@/app/lib/studio/audioToMidiNotes';

export type RvcVoicePresetId =
  | 'soprano-angel'
  | 'deep-bass'
  | 'smooth-alto'
  | 'powerful-tenor';

export type RvcVoicePreset = {
  id: RvcVoicePresetId;
  name: string;
  description: string;
  timbre: string;
  /** Full pitch shift when Preserve Pitch is off (cents). */
  pitchShiftCents: number;
  /** Per-band character shift at 100% intensity (cents). */
  bandShiftCents: { low: number; mid: number; high: number };
  /** Optional harmonic doubler interval (cents, e.g. ±1200). */
  harmonicCents: number;
  harmonicMix: number;
  eq: { low: number; mid: number; high: number; presence: number };
};

export const RVC_BUILTIN_PRESETS: readonly RvcVoicePreset[] = [
  {
    id: 'soprano-angel',
    name: 'Soprano Angel',
    description: 'Bright, airy high voice — lifts formants & highs',
    timbre: 'Bright Soprano',
    pitchShiftCents: 220,
    bandShiftCents: { low: -320, mid: 140, high: 480 },
    harmonicCents: 400,
    harmonicMix: 0.04,
    eq: { low: -10, mid: -2, high: 11, presence: 9 },
  },
  {
    id: 'deep-bass',
    name: 'Deep Bass',
    description: 'Dark, chesty low voice — drops formants & lows',
    timbre: 'Deep Bass',
    pitchShiftCents: -380,
    bandShiftCents: { low: -520, mid: -240, high: -380 },
    harmonicCents: -400,
    harmonicMix: 0.04,
    eq: { low: 12, mid: 4, high: -11, presence: -8 },
  },
  {
    id: 'smooth-alto',
    name: 'Smooth Alto',
    description: 'Warm mid-focused voice',
    timbre: 'Warm Alto',
    pitchShiftCents: -160,
    bandShiftCents: { low: -200, mid: -40, high: 80 },
    harmonicCents: -300,
    harmonicMix: 0.03,
    eq: { low: 5, mid: 6, high: -1, presence: 3 },
  },
  {
    id: 'powerful-tenor',
    name: 'Powerful Tenor',
    description: 'Forward mid presence & chest',
    timbre: 'Dramatic Tenor',
    pitchShiftCents: 80,
    bandShiftCents: { low: -90, mid: 200, high: 280 },
    harmonicCents: 350,
    harmonicMix: 0.04,
    eq: { low: -2, mid: 9, high: 6, presence: 10 },
  },
] as const;

export type RvcImportedModel = {
  id: string;
  name: string;
  pthFile: File;
  indexFile: File | null;
  addedAt: number;
};

export type RvcConvertSettings = {
  presetId: RvcVoicePresetId;
  /** 0..100 */
  intensity: number;
  /** 0..100 wet */
  mixPercentage: number;
  preservePitch: boolean;
  enableFormantShift: boolean;
  /** Optional imported model — used when local RVC server is online. */
  importedModel?: RvcImportedModel | null;
};

export type RvcProgressStage = 'decode' | 'analyze' | 'server' | 'render' | 'done';

export type RvcProgress = {
  stage: RvcProgressStage;
  progress: number;
  message: string;
};

export type RvcConvertResult = {
  audioBuffer: AudioBuffer;
  wavBlob: Blob;
  durationSec: number;
  engine: 'browser-dsp' | 'rvc-server';
  noteCount: number;
};

export type RvcServerHealth = {
  ok: boolean;
  rvcConnected: boolean;
  message: string;
};

function musicEnhancerApiBase(): string {
  const raw = import.meta.env.VITE_MUSIC_ENHANCER_URL ?? 'http://localhost:8000';
  return String(raw).replace(/\/$/, '');
}

export function rvcPresetById(id: RvcVoicePresetId): RvcVoicePreset {
  return RVC_BUILTIN_PRESETS.find((p) => p.id === id) ?? RVC_BUILTIN_PRESETS[0]!;
}

export async function checkRvcServerHealth(): Promise<RvcServerHealth> {
  try {
    const res = await fetch(`${musicEnhancerApiBase()}/rvc/health`, { method: 'GET' });
    if (!res.ok) return { ok: false, rvcConnected: false, message: 'Local server offline' };
    const data = (await res.json()) as { ok?: boolean; rvc_connected?: boolean; message?: string };
    return {
      ok: Boolean(data.ok),
      rvcConnected: Boolean(data.rvc_connected),
      message: data.message ?? (data.rvc_connected ? 'RVC infer ready' : 'Server up — browser DSP fallback'),
    };
  } catch {
    return { ok: false, rvcConnected: false, message: 'Browser DSP only (start: npm run music-enhancer-server)' };
  }
}

async function decodeBlob(ctx: BaseAudioContext, blob: Blob): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer();
  return ctx.decodeAudioData(bytes.slice(0));
}

function encodeWavMono16(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = samples[i]!;
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function formantNeutralPlaybackRate(cents: number): number {
  /** Resample rate paired with matching detune → formant move, net pitch unchanged. */
  return Math.pow(2, -cents / 1200);
}

function pitchPlaybackRate(cents: number): number {
  return Math.pow(2, cents / 1200);
}

function connectEqChain(
  ctx: BaseAudioContext,
  source: AudioNode,
  preset: RvcVoicePreset,
  intensity: number,
): AudioNode {
  const k = Math.max(0.5, Math.min(1, intensity));
  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 220;
  low.gain.value = preset.eq.low * k;

  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1000;
  mid.Q.value = 1;
  mid.gain.value = preset.eq.mid * k;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3400;
  presence.Q.value = 1.3;
  presence.gain.value = preset.eq.presence * k;

  const high = ctx.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 6500;
  high.gain.value = preset.eq.high * k;

  const sat = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  const drive = 1 + 2.5 * k;
  for (let i = 0; i < 256; i++) {
    const x = (i / 128 - 1) * drive;
    curve[i] = Math.tanh(x);
  }
  sat.curve = curve;

  source.connect(low);
  low.connect(mid);
  mid.connect(presence);
  presence.connect(high);
  high.connect(sat);
  return sat;
}

/** One band-isolated copy — formant/timbre only (net pitch unchanged). */
function addShiftedBand(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  buffer: AudioBuffer,
  type: 'low' | 'mid' | 'high',
  shiftCents: number,
  bandGain: number,
): void {
  if (Math.abs(shiftCents) < 1 || bandGain < 0.001) return;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = formantNeutralPlaybackRate(shiftCents);
  src.detune.value = shiftCents;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';

  if (type === 'low') {
    hp.frequency.value = 60;
    lp.frequency.value = 420;
    lp.Q.value = 0.8;
  } else if (type === 'mid') {
    hp.frequency.value = 380;
    lp.frequency.value = 3200;
    hp.Q.value = 0.7;
    lp.Q.value = 0.7;
  } else {
    hp.frequency.value = 2800;
    lp.frequency.value = 14000;
    hp.Q.value = 0.7;
  }

  const g = ctx.createGain();
  g.gain.value = bandGain;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(g);
  g.connect(dest);
  src.start(0);
}

/** Full-signal pitch layer — one shift only, keeps melody interval. */
function addPitchedFullLayer(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  buffer: AudioBuffer,
  pitchCents: number,
  gain: number,
): number {
  if (Math.abs(pitchCents) < 1 || gain < 0.001) return 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = pitchPlaybackRate(pitchCents);
  src.detune.value = 0;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(dest);
  src.start(0);
  return src.playbackRate.value;
}

function renderBrowserDspVoice(
  sourceBuffer: AudioBuffer,
  preset: RvcVoicePreset,
  settings: RvcConvertSettings,
): Promise<AudioBuffer> {
  const intensity = Math.max(0.35, Math.min(1, settings.intensity / 100));
  const mix = Math.max(0, Math.min(1, settings.mixPercentage / 100));
  const wetMix = mix * intensity;
  /** Converted WAV is always processed-only — never blend unprocessed dry vocal. */
  const dryMix = 0;

  const globalPitchCents = settings.preservePitch ? 0 : preset.pitchShiftCents * intensity;
  const pitchActive = !settings.preservePitch && Math.abs(globalPitchCents) > 1;

  const band = preset.bandShiftCents;
  const formantOn = settings.enableFormantShift;
  const lowCents = formantOn ? band.low * intensity : 0;
  const midCents = formantOn ? band.mid * intensity : 0;
  const highCents = formantOn ? band.high * intensity : 0;

  let minRate = 1;
  if (pitchActive) {
    minRate = Math.min(minRate, pitchPlaybackRate(globalPitchCents));
  }
  const totalSec = sourceBuffer.duration / Math.max(0.35, minRate) + 0.4;
  const sr = 44100;
  const offline = new OfflineAudioContext(1, Math.ceil(totalSec * sr), sr);

  if (wetMix > 0.001) {
    const wetSum = offline.createGain();
    wetSum.gain.value = 1;

    if (pitchActive) {
      /** Single pitched voice — no parallel original-pitch layers. */
      addPitchedFullLayer(offline, wetSum, sourceBuffer, globalPitchCents, 1);
    } else if (formantOn) {
      addShiftedBand(offline, wetSum, sourceBuffer, 'low', lowCents, 0.34);
      addShiftedBand(offline, wetSum, sourceBuffer, 'mid', midCents, 0.38);
      addShiftedBand(offline, wetSum, sourceBuffer, 'high', highCents, 0.3);
    } else {
      const body = offline.createBufferSource();
      body.buffer = sourceBuffer;
      const bodyG = offline.createGain();
      bodyG.gain.value = 1;
      body.connect(bodyG).connect(wetSum);
      body.start(0);
    }

    const eqOut = connectEqChain(offline, wetSum, preset, intensity);
    const comp = offline.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.005;
    comp.release.value = 0.14;
    eqOut.connect(comp);
    const wetG = offline.createGain();
    wetG.gain.value = wetMix;
    comp.connect(wetG).connect(offline.destination);
  }

  return offline.startRendering();
}

async function tryServerRvcConvert(
  sourceBlob: Blob,
  settings: RvcConvertSettings,
  onProgress?: (p: RvcProgress) => void,
): Promise<Blob | null> {
  const health = await checkRvcServerHealth();
  /** Dev server echoes audio unless real RVC infer is connected — never treat that as converted. */
  if (!health.ok || !health.rvcConnected) return null;

  onProgress?.({ stage: 'server', progress: 45, message: 'Running local RVC infer…' });

  const form = new FormData();
  form.append('audio', sourceBlob, 'vocal.webm');
  form.append('preset_id', settings.presetId);
  form.append('intensity', String(settings.intensity));
  form.append('mix', String(settings.mixPercentage));
  form.append('preserve_pitch', settings.preservePitch ? '1' : '0');
  form.append('formant_shift', settings.enableFormantShift ? '1' : '0');

  if (settings.importedModel) {
    form.append('model', settings.importedModel.pthFile, settings.importedModel.pthFile.name);
    if (settings.importedModel.indexFile) {
      form.append('index', settings.importedModel.indexFile, settings.importedModel.indexFile.name);
    }
    form.append('model_name', settings.importedModel.name);
  }

  try {
    const res = await fetch(`${musicEnhancerApiBase()}/rvc/convert`, { method: 'POST', body: form });
    if (!res.ok) return null;
    const engineHdr = (res.headers.get('x-rvc-engine') ?? res.headers.get('X-RVC-Engine') ?? '').toLowerCase();
    if (engineHdr === 'stub' || engineHdr === 'passthrough') return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('audio') && !ct.includes('octet')) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/**
 * Convert a vocal recording to the selected voice model.
 */
export async function convertRvcVoice(
  liveCtx: AudioContext,
  sourceBlob: Blob,
  settings: RvcConvertSettings,
  onProgress?: (p: RvcProgress) => void,
): Promise<RvcConvertResult> {
  const report = (stage: RvcProgressStage, progress: number, message: string) => {
    onProgress?.({ stage, progress, message });
  };

  report('decode', 10, 'Decoding vocal…');
  const sourceBuffer = await decodeBlob(liveCtx, sourceBlob);
  if (sourceBuffer.duration < 0.25) {
    throw new Error('Recording is too short — sing or hum at least a few seconds.');
  }

  report('analyze', 25, 'Analyzing pitch & expression…');
  const notes = audioBufferToMonophonicTimedNotes(sourceBuffer);
  const preset = rvcPresetById(settings.presetId);

  const serverBlob = await tryServerRvcConvert(sourceBlob, settings, onProgress);
  if (serverBlob) {
    report('render', 85, 'RVC server render complete…');
    const audioBuffer = await decodeBlob(liveCtx, serverBlob);
    const pcm = audioBuffer.getChannelData(0);
    const wavBytes = encodeWavMono16(pcm, audioBuffer.sampleRate);
    const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
    report('done', 100, 'Complete!');
    return {
      audioBuffer,
      wavBlob,
      durationSec: audioBuffer.duration,
      engine: 'rvc-server',
      noteCount: notes.length,
    };
  }

  report('render', 55, `Rendering ${preset.name} (browser DSP)…`);
  const audioBuffer = await renderBrowserDspVoice(sourceBuffer, preset, settings);
  const pcm = audioBuffer.getChannelData(0);
  const wavBytes = encodeWavMono16(pcm, audioBuffer.sampleRate);
  const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });

  report('done', 100, 'Complete!');
  return {
    audioBuffer,
    wavBlob,
    durationSec: audioBuffer.duration,
    engine: 'browser-dsp',
    noteCount: notes.length,
  };
}

export function downloadRvcWav(blob: Blob, modelName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rvc-${modelName.toLowerCase().replace(/\s+/g, '-')}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}

export function createImportedRvcModel(pthFile: File, indexFile: File | null): RvcImportedModel {
  const base = pthFile.name.replace(/\.pth$/i, '');
  return {
    id: `import-${Date.now()}`,
    name: base || 'Imported RVC',
    pthFile,
    indexFile,
    addedAt: Date.now(),
  };
}

export type VocalCharacterDsp = Pick<RvcVoicePreset, 'bandShiftCents' | 'eq' | 'pitchShiftCents'>;

/** Formant + EQ character pass — same melody pitch, artist-style tone (Voice Swap, etc.). */
export async function renderVocalCharacterDsp(
  sourceBuffer: AudioBuffer,
  character: VocalCharacterDsp,
  intensityPct: number,
): Promise<AudioBuffer> {
  const preset: RvcVoicePreset = {
    id: 'smooth-alto',
    name: 'Character',
    description: '',
    timbre: '',
    pitchShiftCents: character.pitchShiftCents ?? 0,
    bandShiftCents: character.bandShiftCents,
    harmonicCents: 0,
    harmonicMix: 0,
    eq: character.eq,
  };
  return renderBrowserDspVoice(sourceBuffer, preset, {
    presetId: 'smooth-alto',
    intensity: intensityPct,
    mixPercentage: 100,
    preservePitch: true,
    enableFormantShift: true,
  });
}

export async function decodeAudioBlob(ctx: BaseAudioContext, blob: Blob): Promise<AudioBuffer> {
  return decodeBlob(ctx, blob);
}

export function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const pcm = audioBuffer.getChannelData(0);
  const wavBytes = encodeWavMono16(pcm, audioBuffer.sampleRate);
  return new Blob([wavBytes], { type: 'audio/wav' });
}
