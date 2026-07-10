/**
 * Studio Editor 2 — microphone capture → timeline audio clip.
 * Uses MediaRecorder + decodeAudioData (same pattern as Studio Editor v1).
 */

export function pickSe2MediaRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isSafari = /safari/i.test(ua) && !/chrome|chromium|android/i.test(ua);
  const candidates = isSafari
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac', 'audio/ogg;codecs=opus']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

/** First record-armed audio lane — prefer selected track when it is armed. */
export function findSe2RecordTargetTrackIndex(
  tracks: readonly { kind: string }[],
  trackRecordArmed: readonly boolean[],
  selectedTrackIndex: number,
): number {
  const sel = Math.max(0, Math.min(tracks.length - 1, selectedTrackIndex));
  if (tracks[sel]?.kind === 'audio' && (trackRecordArmed[sel] ?? false)) return sel;
  for (let ti = 0; ti < tracks.length; ti++) {
    if (tracks[ti]?.kind === 'audio' && (trackRecordArmed[ti] ?? false)) return ti;
  }
  return -1;
}

export type Se2RecordingSessionMeta = {
  startBeat: number;
  trackIndex: number;
  trackName: string;
};

export type Se2RecordingStopResult = Se2RecordingSessionMeta & {
  buffer: AudioBuffer;
};

type ActiveRecorder = {
  recorder: MediaRecorder;
  chunks: BlobPart[];
  meta: Se2RecordingSessionMeta;
};

let active: ActiveRecorder | null = null;

export function se2AudioRecordingActive(): boolean {
  return active?.recorder.state === 'recording';
}

/** Start capture on an open mic stream — call after transport anchor is set. */
export function startSe2AudioRecording(stream: MediaStream, meta: Se2RecordingSessionMeta): boolean {
  if (active?.recorder.state === 'recording') return true;
  for (const tr of stream.getAudioTracks()) tr.enabled = true;

  const mimeType = pickSe2MediaRecorderMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    try {
      recorder = new MediaRecorder(stream);
    } catch (e) {
      console.error('[SE2 Record] MediaRecorder construction failed', e);
      return false;
    }
  }

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  active = { recorder, chunks, meta };
  try {
    recorder.start(250);
    return true;
  } catch (e) {
    console.error('[SE2 Record] MediaRecorder.start failed', e);
    active = null;
    return false;
  }
}

  /** Stop capture, decode, and return the take — or null on failure / empty. */
export async function stopSe2AudioRecording(
  decodeCtx: AudioContext,
): Promise<Se2RecordingStopResult | null> {
  const session = active;
  if (!session) return null;

  const { recorder, chunks, meta } = session;
  active = null;

  if (recorder.state === 'inactive') {
    return finalizeSe2RecordingChunks(chunks, recorder.mimeType, meta, decodeCtx);
  }

  return new Promise((resolve) => {
    recorder.onstop = () => {
      void finalizeSe2RecordingChunks(chunks, recorder.mimeType, meta, decodeCtx).then(resolve);
    };
    try {
      recorder.requestData();
    } catch {
      /* ignore */
    }
    try {
      recorder.stop();
    } catch (e) {
      console.error('[SE2 Record] MediaRecorder.stop failed', e);
      void finalizeSe2RecordingChunks(chunks, recorder.mimeType, meta, decodeCtx).then(resolve);
    }
  });
}

async function finalizeSe2RecordingChunks(
  chunks: BlobPart[],
  mimeType: string,
  meta: Se2RecordingSessionMeta,
  decodeCtx: AudioContext,
): Promise<Se2RecordingStopResult | null> {
  try {
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
    if (blob.size === 0) {
      console.error('[SE2 Record] Recording produced no audio data.');
      return null;
    }
    if (decodeCtx.state === 'suspended') {
      try {
        await decodeCtx.resume();
      } catch {
        /* autoplay policy */
      }
    }
    const raw = await blob.arrayBuffer();
    const buffer = await decodeCtx.decodeAudioData(raw.slice(0));
    return { ...meta, buffer };
  } catch (e) {
    console.error('[SE2 Record] Failed to finalize take', e);
    return null;
  }
}
