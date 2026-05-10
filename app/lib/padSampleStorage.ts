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
};

export type StoredPadSample = {
  /** MIME e.g. audio/wav, audio/mpeg */
  mime: string;
  /** Base64-encoded file bytes */
  data: string;
  /** Display name (file / library name) — shown in sampler + Beat Lab sequencer lane. */
  label?: string;
  /**
   * Optional “source BPM” for simple session sync (tape-style pitch+speed via Web Audio playbackRate).
   * When set: rate = clamp(projectBpm / rootBpm). Omit or clear to play file at native speed (best for one-shots).
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
};

export type PadSampleStore = Record<string, StoredPadSample>;

export function defaultPadSamplerPlaybackOpts(): PadSamplerPlaybackOpts {
  return { hpHz: 0, lpHz: 0, trim0: 0, trim1: 1, fineSemi: 0, triggerSnap: 0 };
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
  return d;
}

export function writeSamplerOptsToStored(row: StoredPadSample, o: PadSamplerPlaybackOpts): void {
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
