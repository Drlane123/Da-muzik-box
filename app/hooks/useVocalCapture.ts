import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

export type UseVocalCaptureResult = {
  blob: Blob | null;
  hasAudio: boolean;
  isRecording: boolean;
  recordingTime: number;
  /** Open mic stream without recording (for count-in before capture). */
  armMic: () => Promise<boolean>;
  startRecord: () => Promise<void>;
  stopRecord: () => void;
  /** Drop mic stream when count-in is cancelled before record. */
  releaseMic: () => void;
  handleUpload: (file: File) => void;
  handleDelete: () => void;
  captureStream: MediaStream | null;
  /** Stable ref for export handlers that need latest blob without re-render. */
  blobRef: MutableRefObject<Blob | null>;
};

/** Mic record + file upload — shared by Neural Hum (Dubler-style capture) and Vocal Lab. */
export type UseVocalCaptureOptions = {
  /** Raw mic for beatbox / mouth percussion — disables browser AGC & noise gate. */
  percussiveMic?: boolean;
  /**
   * Voice / hum capture — echo cancel + noise suppress so speakers/metro clicks
   * are not treated as pitched notes (Hum Melody).
   */
  isolatedMic?: boolean;
};

const PERCUSSIVE_MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/** Prefer voice; cancel speaker / metronome bleed into the mic. */
const ISOLATED_VOICE_MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export function useVocalCapture(
  onBlobChange?: (blob: Blob | null) => void,
  options?: UseVocalCaptureOptions,
): UseVocalCaptureResult {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const percussiveMicRef = useRef(Boolean(options?.percussiveMic));
  percussiveMicRef.current = Boolean(options?.percussiveMic);
  const isolatedMicRef = useRef(Boolean(options?.isolatedMic));
  isolatedMicRef.current = Boolean(options?.isolatedMic);

  const commitBlob = useCallback(
    (next: Blob | null) => {
      blobRef.current = next && next.size > 0 ? next : null;
      setBlob(blobRef.current);
      onBlobChange?.(blobRef.current);
    },
    [onBlobChange],
  );

  const releaseMic = useCallback(() => {
    if (isRecordingRef.current) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCaptureStream(null);
  }, []);

  const armMic = useCallback(async (): Promise<boolean> => {
    if (streamRef.current?.active) {
      setCaptureStream(streamRef.current);
      return true;
    }
    releaseMic();
    try {
      const audio: boolean | MediaTrackConstraints = percussiveMicRef.current
        ? PERCUSSIVE_MIC_CONSTRAINTS
        : isolatedMicRef.current
          ? ISOLATED_VOICE_MIC_CONSTRAINTS
          : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      streamRef.current = stream;
      setCaptureStream(stream);
      return true;
    } catch (err) {
      console.error('Vocal capture mic error:', err);
      alert('Microphone access is required. Allow the mic for this site (or use https / localhost).');
      return false;
    }
  }, [releaseMic]);

  const startRecorderOnStream = useCallback(
    (stream: MediaStream) => {
      const chunks: BlobPart[] = [];
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
          : new MediaRecorder(stream);
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || 'audio/webm';
        const recorded = new Blob(chunks, { type });
        commitBlob(recorded.size > 0 ? recorded : null);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setCaptureStream(null);
        mediaRecorderRef.current = null;
      };
      mediaRecorder.start(100);
      isRecordingRef.current = true;
      setIsRecording(true);
      commitBlob(null);
      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    },
    [commitBlob],
  );

  const startRecord = useCallback(async () => {
    if (isRecordingRef.current) return;
    if (!streamRef.current?.active) {
      const ok = await armMic();
      if (!ok) return;
    }
    startRecorderOnStream(streamRef.current!);
  }, [armMic, startRecorderOnStream]);

  const stopRecord = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecordingRef.current) return;
    mediaRecorderRef.current.stop();
    isRecordingRef.current = false;
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleUpload = useCallback(
    (file: File) => {
      commitBlob(file);
      isRecordingRef.current = false;
      setIsRecording(false);
    },
    [commitBlob],
  );

  const handleDelete = useCallback(() => {
    commitBlob(null);
    setRecordingTime(0);
  }, [commitBlob]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return {
    blob,
    hasAudio: Boolean(blob && blob.size > 0),
    isRecording,
    recordingTime,
    armMic,
    startRecord,
    stopRecord,
    releaseMic,
    captureStream,
    handleUpload,
    handleDelete,
    blobRef,
  };
}
