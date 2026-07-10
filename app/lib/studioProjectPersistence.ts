/**
 * Studio Editor timeline persistence (localStorage + Supabase `projects.data`).
 * Audio: 16-bit WAV base64 per clip. Cloud: same JSON object as `studioProjectV1` in Supabase.
 */

/** Supabase `projects.data` field that holds the full timeline JSON object. */
export const SUPABASE_STUDIO_PROJECT_DATA_KEY = 'studioProjectV1' as const;

export const STUDIO_PROJECT_STORAGE_KEY = 'da-music-box-studio-editor-v1';

export const STUDIO_PROJECT_VERSION = 1;

export type SerializedTrackType = 'MIDI' | 'Audio' | 'Drum' | 'Bus' | 'Vocal';

export interface SerializedClip {
  id: number;
  bar: number;
  len: number;
  label: string;
  /** Exact session tick start when set (aligns playback with real record start). */
  startTick?: number;
  /** WAV file, base64 (no data: prefix) */
  audioWavBase64?: string;
}

export interface SerializedTrack {
  id: number;
  name: string;
  type: SerializedTrackType;
  color: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number;
  clips: SerializedClip[];
  audioTrack?: number;
}

export interface StudioProjectFileV1 {
  version: typeof STUDIO_PROJECT_VERSION;
  savedAt: string;
  /** Master Clock session tempo when saved (restored on open for correct transport + clip render). */
  bpm?: number;
  tracks: SerializedTrack[];
  trackPans: Record<string, number>;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** 16-bit PCM WAV from AudioBuffer (interleaved if stereo). */
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

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function audioBufferToWavBase64(buf: AudioBuffer): Promise<string> {
  const ab = encodeWavFromAudioBuffer(buf);
  return uint8ToBase64(new Uint8Array(ab));
}

export async function wavBase64ToAudioBuffer(b64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const bytes = base64ToUint8(b64);
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return ctx.decodeAudioData(copy);
}

export async function serializeStudioProject(
  tracks: {
    id: number;
    name: string;
    type: string;
    color: string;
    muted: boolean;
    solo: boolean;
    locked: boolean;
    volume: number;
    clips: {
      id: number;
      bar: number;
      len: number;
      label: string;
      startTick?: number;
      audioBuffer?: AudioBuffer;
    }[];
    audioTrack?: number;
  }[],
  trackPans: Record<number, number>,
  /** Current Master Clock BPM — persisted so reload matches timeline/transport. */
  sessionBpm?: number,
): Promise<string> {
  const serTracks: SerializedTrack[] = [];
  for (const t of tracks) {
    const clips: SerializedClip[] = [];
    for (const c of t.clips) {
      const sc: SerializedClip = {
        id: c.id,
        bar: c.bar,
        len: c.len,
        label: c.label,
      };
      if (c.audioBuffer) {
        try {
          sc.audioWavBase64 = await audioBufferToWavBase64(c.audioBuffer);
        } catch (e) {
          console.warn('Studio persist: failed to encode clip audio', c.id, e);
        }
      }
      clips.push(sc);
    }
    serTracks.push({
      id: t.id,
      name: t.name,
      type: t.type as SerializedTrackType,
      color: t.color,
      muted: t.muted,
      solo: t.solo,
      locked: t.locked,
      volume: t.volume,
      clips,
      audioTrack: t.audioTrack,
    });
  }

  const bpmOut =
    typeof sessionBpm === 'number' && Number.isFinite(sessionBpm) && sessionBpm >= 40 && sessionBpm <= 300
      ? Math.round(sessionBpm)
      : undefined;

  const payload: StudioProjectFileV1 = {
    version: STUDIO_PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    ...(bpmOut != null ? { bpm: bpmOut } : {}),
    tracks: serTracks,
    trackPans: Object.fromEntries(Object.entries(trackPans).map(([k, v]) => [String(k), v])),
  };

  return JSON.stringify(payload);
}

// Minimal track shape at runtime (matches Studio editor)
type RestoredTrack = {
  id: number;
  name: string;
  type: SerializedTrackType;
  color: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number;
  clips: {
    id: number;
    bar: number;
    len: number;
    label: string;
    startTick?: number;
    audioBuffer?: AudioBuffer;
  }[];
  audioTrack?: number;
};

export async function deserializeStudioProject(
  json: string,
  audioContext: AudioContext,
): Promise<{
  tracks: RestoredTrack[];
  trackPans: Record<number, number>;
  nextClipId: number;
  /** Restored Master Clock BPM when present in file. */
  sessionBpm?: number;
}> {
  const payload = JSON.parse(json) as StudioProjectFileV1;
  if (payload.version !== 1 || !Array.isArray(payload.tracks)) {
    throw new Error('Invalid studio project file');
  }

  const rawBpm = payload.bpm;
  const sessionBpm =
    typeof rawBpm === 'number' && Number.isFinite(rawBpm) && rawBpm >= 40 && rawBpm <= 300
      ? Math.round(rawBpm)
      : undefined;

  let maxClipId = 100;
  const tracks: RestoredTrack[] = [];

  for (const st of payload.tracks) {
    const clips: RestoredTrack['clips'] = [];
    for (const sc of st.clips) {
      maxClipId = Math.max(maxClipId, sc.id);
      const clip: RestoredTrack['clips'][0] = {
        id: sc.id,
        bar: sc.bar,
        len: sc.len,
        label: sc.label,
      };
      if (typeof sc.startTick === 'number' && Number.isFinite(sc.startTick)) {
        clip.startTick = Math.round(sc.startTick);
      }
      if (sc.audioWavBase64) {
        try {
          clip.audioBuffer = await wavBase64ToAudioBuffer(sc.audioWavBase64, audioContext);
        } catch (e) {
          console.warn('Studio persist: failed to decode clip audio', sc.id, e);
        }
      }
      clips.push(clip);
    }
    tracks.push({
      id: st.id,
      name: st.name,
      type: st.type,
      color: st.color,
      muted: st.muted,
      solo: st.solo,
      locked: st.locked,
      volume: st.volume,
      clips,
      audioTrack: st.audioTrack,
    });
  }

  const trackPans: Record<number, number> = {};
  for (const [k, v] of Object.entries(payload.trackPans || {})) {
    trackPans[Number(k)] = v;
  }

  return { tracks, trackPans, nextClipId: maxClipId + 1, sessionBpm };
}
