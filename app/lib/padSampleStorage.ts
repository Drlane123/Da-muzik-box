/**
 * Per-pad sample persistence for Creation Station (MPC-style sampler).
 * Keys: `${bankIndex}_${padIndex}` (bank 0–7, pad 0–15).
 */

export const CREATION_PAD_SAMPLES_STORAGE_KEY = 'creationStation_padSamples_v1';

export type StoredPadSample = {
  /** MIME e.g. audio/wav, audio/mpeg */
  mime: string;
  /** Base64-encoded file bytes */
  data: string;
};

export type PadSampleStore = Record<string, StoredPadSample>;

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
      resolve({ mime, data: base64 });
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
