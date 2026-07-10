/**
 * Per-pad sample persistence for Creation Station (MPC-style sampler).
 * Keys: `${bankIndex}_${padIndex}` (bank 0–7, pad 0–15).
 */

export const CREATION_PAD_SAMPLES_STORAGE_KEY = 'creationStation_padSamples_v1';

/** Per-pad playback shaping (stored with the sample; applied in Web Audio at trigger time). */
export type PadSamplerPlaybackOpts = {
  /** 0 = bypass. Else high-pass frequency in Hz (≈40–8000). */
  hpHz: number;
  /** 0 = bypass. Else low-pass frequency in Hz (≈200–19200). */
  lpHz: number;
  /** Normalized start within buffer [0, 1). */
  trim0: number;
  /** Normalized end within buffer (0, 1], must exceed `trim0`. */
  trim1: number;
  /** Fine pitch in semitones (−12…+12), on top of SRC-BPM `playbackRate`. */
  fineSemi: number;
  /**
   * 0…1 — MPC-style **sample trigger**: brief gain emphasis right on pad hit so one-shots
   * speak harder (tighter “hardware” punch). 0 = neutral (no extra shaping).
   */
  triggerSnap: number;
  /** Low-pass resonance 0…100 (Cubase LP Res). */
  lpRes: number;
  /** Filter envelope depth 0…100 — opens cutoff on hit (Cubase LP Env). */
  lpEnvDepth: number;
  /** Filter envelope decay 5…2000 ms (Cubase LP Dec). */
  lpEnvDecayMs: number;
  /** Pitch envelope decay 5…2000 ms. */
  pitchEnvDecayMs: number;
  /** Pitch envelope depth 0…100 → up to ~1 octave drop on hit. */
  pitchEnvDepth: number;
  /** Transient pitch punch 0…100 — brief upward bend at attack. */
  pitchPunch: number;
  /** Accent boost 0…100 on hard hits (Cubase Accent). */
  ampAccent: number;
  /** Velocity → level curve 0…100 (100 = full dynamic range). */
  velToLevel: number;
  /** Pre-distortion level offset −100…+100 (Cubase Dist Offset). */
  distOffset: number;
  /** Per-pad level 0…150 % (Cubase Amp Level). */
  padLevel: number;
  /** Per-pad pan −100…+100, added to mixer pan. */
  padPan: number;
  /** Brightness tilt −100…+100 (Cubase Tone). */
  tone: number;
  /** Sample color / body 0…100 — mild saturation + low-mid emphasis. */
  color: number;
  /** FX send level 0…100 — scales delay/reverb wet bus. */
  fxSend: number;
  /** Optional hard cap on playback length in seconds (R&B tight kicks, etc.). */
  maxPlaySec?: number;
  /** Native sample MIDI root — chromatic orchestra / hit pads. */
  rootMidi?: number;
  /** When true, play across full MIDI keyboard via detune from {@link rootMidi}. */
  chromatic?: boolean;
};

export type StoredPadSample = {
  /** MIME e.g. audio/wav, audio/mpeg */
  mime: string;
  /** Base64-encoded file bytes */
  data: string;
  /** Display name (file / library name) — shown in sampler + Beat Lab sequencer lane. */
  label?: string;
  /**
   * Optional “source BPM” for the pad SRC-BPM control (preview only).
   * Does **not** retune samples when the main project tempo changes — only pad fine-tune / pitch does.
   */
  rootBpm?: number;
  /** High-pass Hz; omit or low value = off. */
  samplerHpHz?: number;
  /** Low-pass Hz; omit or very high = off. */
  samplerLpHz?: number;
  /** Trim start fraction [0,1). */
  samplerTrim0?: number;
  /** Trim end fraction (0,1]. */
  samplerTrim1?: number;
  /** Fine tune semitones. */
  samplerFineSemi?: number;
  /** 0…1 trigger snap / transient punch (optional). */
  samplerTriggerSnap?: number;
  samplerLpRes?: number;
  samplerLpEnvDepth?: number;
  samplerLpEnvDecayMs?: number;
  samplerPitchEnvDecayMs?: number;
  samplerPitchEnvDepth?: number;
  samplerPitchPunch?: number;
  samplerAmpAccent?: number;
  samplerVelToLevel?: number;
  samplerDistOffset?: number;
  samplerPadLevel?: number;
  samplerPadPan?: number;
  samplerTone?: number;
  samplerColor?: number;
  samplerFxSend?: number;
  /** Insert FX rack — drive (0…1). */
  samplerFxDrive?: number;
  samplerFxEqOn?: boolean;
  samplerFxEqLowDb?: number;
  samplerFxEqMidDb?: number;
  samplerFxEqHighDb?: number;
  samplerFxEqLowHz?: number;
  samplerFxEqMidHz?: number;
  samplerFxEqHighHz?: number;
  samplerFxEqMidQ?: number;
  samplerFxCompOn?: boolean;
  samplerFxCompThrDb?: number;
  samplerFxCompRatio?: number;
  samplerFxCompAttack?: number;
  samplerFxCompRelease?: number;
  samplerFxCompKnee?: number;
  samplerFxCompMakeupDb?: number;
  samplerFxLimiterOn?: boolean;
  samplerFxLimiterCeilDb?: number;
  samplerFxLimiterSoftClip?: number;
  samplerFxDelayOn?: boolean;
  samplerFxDelaySync?: boolean;
  samplerFxDelayNote?: string;
  samplerFxDelayMs?: number;
  samplerFxDelayFb?: number;
  samplerFxDelayMix?: number;
  samplerFxReverbOn?: boolean;
  samplerFxReverbMix?: number;
  samplerFxReverbDecay?: number;
  /** Chromatic hit pad — native pitch (MIDI 0–127). */
  samplerRootMidi?: number;
  /** Chromatic hit pad — default strike pitch when no MIDI note is passed (spread pads). */
  samplerStrikeMidi?: number;
  /** Chromatic hit pad — full keyboard pitch range. */
  samplerChromatic?: boolean;
};

export type PadSampleStore = Record<string, StoredPadSample>;

function clampNum(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}

export function defaultPadSamplerPlaybackOpts(): PadSamplerPlaybackOpts {
  return {
    hpHz: 0,
    lpHz: 0,
    trim0: 0,
    trim1: 1,
    fineSemi: 0,
    triggerSnap: 0,
    lpRes: 0,
    lpEnvDepth: 0,
    lpEnvDecayMs: 120,
    pitchEnvDecayMs: 80,
    pitchEnvDepth: 0,
    pitchPunch: 0,
    ampAccent: 0,
    velToLevel: 100,
    distOffset: 0,
    padLevel: 100,
    padPan: 0,
    tone: 0,
    color: 0,
    fxSend: 100,
  };
}

export function samplerOptsFromStored(row: StoredPadSample): PadSamplerPlaybackOpts {
  const d = defaultPadSamplerPlaybackOpts();
  const hp = typeof row.samplerHpHz === 'number' && Number.isFinite(row.samplerHpHz) ? row.samplerHpHz : 0;
  const lp = typeof row.samplerLpHz === 'number' && Number.isFinite(row.samplerLpHz) ? row.samplerLpHz : 0;
  const t0 = typeof row.samplerTrim0 === 'number' && Number.isFinite(row.samplerTrim0) ? row.samplerTrim0 : 0;
  const t1 = typeof row.samplerTrim1 === 'number' && Number.isFinite(row.samplerTrim1) ? row.samplerTrim1 : 1;
  const fine = typeof row.samplerFineSemi === 'number' && Number.isFinite(row.samplerFineSemi) ? row.samplerFineSemi : 0;
  const snap =
    typeof row.samplerTriggerSnap === 'number' && Number.isFinite(row.samplerTriggerSnap) ? row.samplerTriggerSnap : 0;
  d.hpHz = hp >= 25 ? Math.min(12000, hp) : 0;
  d.lpHz = lp >= 200 && lp < 19900 ? Math.min(19200, lp) : 0;
  d.trim0 = Math.max(0, Math.min(0.9999, t0));
  d.trim1 = Math.max(d.trim0 + 1e-4, Math.min(1, t1));
  d.fineSemi = Math.max(-12, Math.min(12, fine));
  d.triggerSnap = Math.max(0, Math.min(1, snap));
  d.lpRes = clampNum(row.samplerLpRes, d.lpRes, 0, 100);
  d.lpEnvDepth = clampNum(row.samplerLpEnvDepth, d.lpEnvDepth, 0, 100);
  d.lpEnvDecayMs = clampNum(row.samplerLpEnvDecayMs, d.lpEnvDecayMs, 5, 2000);
  d.pitchEnvDecayMs = clampNum(row.samplerPitchEnvDecayMs, d.pitchEnvDecayMs, 5, 2000);
  d.pitchEnvDepth = clampNum(row.samplerPitchEnvDepth, d.pitchEnvDepth, 0, 100);
  d.pitchPunch = clampNum(row.samplerPitchPunch, d.pitchPunch, 0, 100);
  d.ampAccent = clampNum(row.samplerAmpAccent, d.ampAccent, 0, 100);
  d.velToLevel = clampNum(row.samplerVelToLevel, d.velToLevel, 0, 100);
  d.distOffset = clampNum(row.samplerDistOffset, d.distOffset, -100, 100);
  d.padLevel = clampNum(row.samplerPadLevel, d.padLevel, 0, 150);
  d.padPan = clampNum(row.samplerPadPan, d.padPan, -100, 100);
  d.tone = clampNum(row.samplerTone, d.tone, -100, 100);
  d.color = clampNum(row.samplerColor, d.color, 0, 100);
  d.fxSend = clampNum(row.samplerFxSend, d.fxSend, 0, 100);
  return d;
}

export function writeSamplerOptsToStored(row: StoredPadSample, o: PadSamplerPlaybackOpts): void {
  const d = defaultPadSamplerPlaybackOpts();
  const hp = o.hpHz >= 25 ? Math.min(12000, o.hpHz) : 0;
  const lp = o.lpHz >= 200 && o.lpHz < 19900 ? Math.min(19200, o.lpHz) : 0;
  const t0 = Math.max(0, Math.min(0.9999, o.trim0));
  const t1 = Math.max(t0 + 1e-4, Math.min(1, o.trim1));
  const fine = Math.max(-12, Math.min(12, o.fineSemi));
  const snap = Math.max(0, Math.min(1, o.triggerSnap ?? 0));
  row.samplerHpHz = hp > 0 ? hp : undefined;
  row.samplerLpHz = lp > 0 ? lp : undefined;
  row.samplerTrim0 = t0 > 1e-6 ? t0 : undefined;
  row.samplerTrim1 = t1 < 1 - 1e-6 ? t1 : undefined;
  row.samplerFineSemi = Math.abs(fine) > 1e-6 ? fine : undefined;
  row.samplerTriggerSnap = snap > 1e-3 ? snap : undefined;
  row.samplerLpRes = o.lpRes > 0.5 ? Math.round(o.lpRes) : undefined;
  row.samplerLpEnvDepth = o.lpEnvDepth > 0.5 ? Math.round(o.lpEnvDepth) : undefined;
  row.samplerLpEnvDecayMs =
    Math.abs(o.lpEnvDecayMs - d.lpEnvDecayMs) > 0.5 ? Math.round(o.lpEnvDecayMs) : undefined;
  row.samplerPitchEnvDecayMs =
    Math.abs(o.pitchEnvDecayMs - d.pitchEnvDecayMs) > 0.5 ? Math.round(o.pitchEnvDecayMs) : undefined;
  row.samplerPitchEnvDepth = o.pitchEnvDepth > 0.5 ? Math.round(o.pitchEnvDepth) : undefined;
  row.samplerPitchPunch = o.pitchPunch > 0.5 ? Math.round(o.pitchPunch) : undefined;
  row.samplerAmpAccent = o.ampAccent > 0.5 ? Math.round(o.ampAccent) : undefined;
  row.samplerVelToLevel =
    Math.abs(o.velToLevel - d.velToLevel) > 0.5 ? Math.round(o.velToLevel) : undefined;
  row.samplerDistOffset = Math.abs(o.distOffset) > 0.5 ? Math.round(o.distOffset) : undefined;
  row.samplerPadLevel = Math.abs(o.padLevel - d.padLevel) > 0.5 ? Math.round(o.padLevel) : undefined;
  row.samplerPadPan = Math.abs(o.padPan) > 0.5 ? Math.round(o.padPan) : undefined;
  row.samplerTone = Math.abs(o.tone) > 0.5 ? Math.round(o.tone) : undefined;
  row.samplerColor = o.color > 0.5 ? Math.round(o.color) : undefined;
  row.samplerFxSend = Math.abs(o.fxSend - d.fxSend) > 0.5 ? Math.round(o.fxSend) : undefined;
}

export function writeChromaticPadMetaToStored(
  row: StoredPadSample,
  rootMidi?: number,
  chromatic?: boolean,
  strikeMidi?: number,
): void {
  if (chromatic) {
    row.samplerChromatic = true;
    const root =
      typeof rootMidi === 'number' && Number.isFinite(rootMidi)
        ? Math.max(0, Math.min(127, Math.round(rootMidi)))
        : 60;
    row.samplerRootMidi = root;
    const strike =
      typeof strikeMidi === 'number' && Number.isFinite(strikeMidi)
        ? Math.max(0, Math.min(127, Math.round(strikeMidi)))
        : undefined;
    row.samplerStrikeMidi = strike != null && strike !== root ? strike : undefined;
  } else {
    row.samplerChromatic = undefined;
    row.samplerRootMidi = undefined;
    row.samplerStrikeMidi = undefined;
  }
}

export function chromaticPadMetaFromStored(
  row: StoredPadSample,
): { rootMidi: number; chromatic: true; strikeMidi?: number } | null {
  if (!row.samplerChromatic) return null;
  const root =
    typeof row.samplerRootMidi === 'number' && Number.isFinite(row.samplerRootMidi)
      ? Math.max(0, Math.min(127, Math.round(row.samplerRootMidi)))
      : 60;
  const strikeRaw = row.samplerStrikeMidi;
  const strike =
    typeof strikeRaw === 'number' && Number.isFinite(strikeRaw)
      ? Math.max(0, Math.min(127, Math.round(strikeRaw)))
      : undefined;
  return {
    rootMidi: root,
    chromatic: true,
    ...(strike != null && strike !== root ? { strikeMidi: strike } : {}),
  };
}

export function padSampleKey(bankIndex: number, padIndex: number): string {
  return `${bankIndex}_${padIndex}`;
}

export function loadPadSampleStore(): PadSampleStore {
  try {
    const raw = localStorage.getItem(CREATION_PAD_SAMPLES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PadSampleStore;
  } catch {
    return {};
  }
}

export function savePadSampleStore(store: PadSampleStore): void {
  try {
    localStorage.setItem(CREATION_PAD_SAMPLES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function fileToStoredPadSample(file: File): Promise<StoredPadSample> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('read failed'));
        return;
      }
      const comma = result.indexOf(',');
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      const mime = file.type || 'application/octet-stream';
      const base =
        file.name.replace(/\.[^/.]+$/i, '').trim() || file.name.trim() || 'Sample';
      resolve({ mime, data: base64, label: base });
    };
    reader.onerror = () => reject(reader.error ?? new Error('read error'));
    reader.readAsDataURL(file);
  });
}

export function storedToArrayBuffer(stored: StoredPadSample): ArrayBuffer {
  const binary = atob(stored.data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
