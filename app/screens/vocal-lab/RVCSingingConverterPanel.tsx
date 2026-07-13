/**
 * RVC Singing Voice Converter — open-source browser DSP + optional local RVC server.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Download, Mic, Pause, Play, Square, Upload, Volume2, Zap, ChevronDown, ChevronUp } from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';
import {
  checkRvcServerHealth,
  convertRvcVoice,
  createImportedRvcModel,
  downloadRvcWav,
  RVC_BUILTIN_PRESETS,
  type RvcConvertResult,
  type RvcImportedModel,
  type RvcServerHealth,
  type RvcVoicePresetId,
} from '@/app/lib/vocalLab/rvcVoiceConverter';

type RvcSettings = {
  presetId: RvcVoicePresetId;
  intensity: number;
  preservePitch: boolean;
  mixPercentage: number;
  enableFormantShift: boolean;
};

export default function RVCSingingConverterPanel() {
  const { getOrCreateAudioContext } = useMasterClock();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingConverted, setIsPlayingConverted] = useState(false);
  const [originalVolume, setOriginalVolume] = useState(75);
  const [convertedVolume, setConvertedVolume] = useState(75);

  const [isProcessing, setIsProcessing] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState('');
  const [convertError, setConvertError] = useState<string | null>(null);
  const [result, setResult] = useState<RvcConvertResult | null>(null);

  const [settings, setSettings] = useState<RvcSettings>({
    presetId: 'smooth-alto',
    intensity: 100,
    preservePitch: true,
    mixPercentage: 100,
    enableFormantShift: true,
  });

  const [importedModel, setImportedModel] = useState<RvcImportedModel | null>(null);
  const [serverHealth, setServerHealth] = useState<RvcServerHealth | null>(null);
  const [open, setOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pthInputRef = useRef<HTMLInputElement>(null);
  const convertGenRef = useRef(0);

  const originalUrlRef = useRef<string | null>(null);
  const convertedUrlRef = useRef<string | null>(null);
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const convertedAudioRef = useRef<HTMLAudioElement | null>(null);

  const revokeUrl = (url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    void checkRvcServerHealth().then(setServerHealth);
  }, []);

  useEffect(() => {
    return () => {
      revokeUrl(originalUrlRef.current);
      revokeUrl(convertedUrlRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chunks: BlobPart[] = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : undefined;
      const mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        revokeUrl(originalUrlRef.current);
        originalUrlRef.current = URL.createObjectURL(blob);
        setRecordingBlob(blob);
        setResult(null);
        setConvertError(null);
        if (originalAudioRef.current) originalAudioRef.current.src = originalUrlRef.current;
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((p) => p + 1), 1000);
    } catch {
      alert('Please allow microphone access to record vocals');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const toggleOriginalPlay = () => {
    const el = originalAudioRef.current;
    if (!el || !originalUrlRef.current) return;
    if (isPlayingOriginal) {
      el.pause();
      setIsPlayingOriginal(false);
      return;
    }
    convertedAudioRef.current?.pause();
    setIsPlayingConverted(false);
    el.src = originalUrlRef.current;
    el.volume = originalVolume / 100;
    void el.play().then(() => setIsPlayingOriginal(true)).catch(() => setIsPlayingOriginal(false));
  };

  const toggleConvertedPlay = () => {
    const el = convertedAudioRef.current;
    if (!el || !convertedUrlRef.current) return;
    if (isPlayingConverted) {
      el.pause();
      setIsPlayingConverted(false);
      return;
    }
    originalAudioRef.current?.pause();
    setIsPlayingOriginal(false);
    el.src = convertedUrlRef.current;
    el.volume = convertedVolume / 100;
    void el.play().then(() => setIsPlayingConverted(true)).catch(() => setIsPlayingConverted(false));
  };

  const convertVocals = useCallback(
    async (overrideSettings?: RvcSettings) => {
      if (!recordingBlob || recordingBlob.size === 0) return;

      const activeSettings = overrideSettings ?? settings;
      const gen = convertGenRef.current + 1;
      convertGenRef.current = gen;
      setIsProcessing(true);
      setConvertError(null);
      setResult(null);
      setConversionProgress(0);
      setStageMessage('Starting…');
      revokeUrl(convertedUrlRef.current);
      convertedUrlRef.current = null;
      originalAudioRef.current?.pause();
      setIsPlayingOriginal(false);
      convertedAudioRef.current?.pause();
      setIsPlayingConverted(false);

      try {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();

        const out = await convertRvcVoice(
          ctx,
          recordingBlob,
          { ...activeSettings, importedModel },
          (p) => {
            if (convertGenRef.current !== gen) return;
            setConversionProgress(p.progress);
            setStageMessage(p.message);
          },
        );

        if (convertGenRef.current !== gen) return;

        revokeUrl(convertedUrlRef.current);
        convertedUrlRef.current = URL.createObjectURL(out.wavBlob);
        if (convertedAudioRef.current) convertedAudioRef.current.src = convertedUrlRef.current;
        setResult(out);
      } catch (err) {
        if (convertGenRef.current !== gen) return;
        setConvertError(err instanceof Error ? err.message : 'Conversion failed');
        setConversionProgress(0);
        setStageMessage('');
      } finally {
        if (convertGenRef.current === gen) setIsProcessing(false);
      }
    },
    [getOrCreateAudioContext, importedModel, recordingBlob, settings],
  );

  const handlePthUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pth = e.target.files?.[0];
    if (!pth) return;
    if (!pth.name.toLowerCase().endsWith('.pth')) {
      alert('Select an RVC .pth model file');
      e.target.value = '';
      return;
    }
    setImportedModel(createImportedRvcModel(pth, null));
    e.target.value = '';
  };

  const selectedPreset = RVC_BUILTIN_PRESETS.find((p) => p.id === settings.presetId)!;
  const hasRecording = Boolean(recordingBlob && recordingBlob.size > 0);

  return (
    <div className="flex flex-col w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-3 w-full px-3 py-2 rounded-lg text-left"
        style={{
          background: open ? '#0a2a2a' : '#0a1a1a',
          border: '1px solid #00E5FF44',
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <span className="text-sm font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>
          RVC Singing Voice Converter
        </span>
        {open ? (
          <ChevronUp size={18} style={{ color: '#00E5FF', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={18} style={{ color: '#00E5FF', flexShrink: 0 }} />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-4 mt-3">
        <p className="text-xs" style={{ color: '#888' }}>
          Browser voice transform (multi-band formant) — not AI RVC. For real .pth models, connect a local RVC server.
        </p>
        {serverHealth && (
          <p className="text-10px" style={{ color: serverHealth.rvcConnected ? '#00ff88' : '#888' }}>
            {serverHealth.message}
          </p>
        )}

      <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: '#0a2a2a', border: '1px solid #00E5FF44' }}>
        <span className="text-xs font-bold" style={{ color: '#00E5FF' }}>STEP 1: RECORD VOCALS</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded font-bold text-sm transition-all"
            style={{
              background: isRecording ? '#ff4444' : '#2c2c2c',
              color: isRecording ? '#fff' : '#00E5FF',
              border: `1px solid ${isRecording ? '#ff4444' : '#00E5FF44'}`,
              cursor: 'pointer',
            }}
          >
            {isRecording ? <Square size={14} /> : <Mic size={14} />}
            {isRecording ? 'STOP' : 'RECORD'}
          </button>
          <span style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', minWidth: '50px' }}>
            {formatTime(recordingDuration)}
          </span>
          {hasRecording && <span style={{ fontSize: '11px', color: '#00ff88', fontWeight: 'bold' }}>✓ Ready</span>}
        </div>
      </div>

      {hasRecording && (
        <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: '#1a2a1a', border: '1px solid #00ff8844' }}>
          <span className="text-xs font-bold" style={{ color: '#00ff88' }}>ORIGINAL VOCAL</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleOriginalPlay}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded font-bold text-xs"
              style={{
                background: isPlayingOriginal ? '#00ff88' : '#2c2c2c',
                color: isPlayingOriginal ? '#000' : '#00ff88',
                border: '1px solid #00ff8844',
                cursor: 'pointer',
              }}
            >
              {isPlayingOriginal ? <Pause size={12} /> : <Play size={12} />}
              {isPlayingOriginal ? 'PAUSE' : 'PLAY'}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={originalVolume}
              onChange={(e) => {
                setOriginalVolume(Number(e.target.value));
                if (originalAudioRef.current) originalAudioRef.current.volume = Number(e.target.value) / 100;
              }}
              style={{ flex: 1, cursor: 'pointer', accentColor: '#00ff88' }}
            />
            <Volume2 size={12} style={{ color: '#00ff88' }} />
          </div>
          <audio
            ref={originalAudioRef}
            onEnded={() => setIsPlayingOriginal(false)}
            style={{ display: 'none' }}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>STEP 2: SELECT VOICE MODEL</span>
          <button
            type="button"
            onClick={() => pthInputRef.current?.click()}
            className="flex items-center gap-1 text-9px font-bold px-2 py-1 rounded"
            style={{ background: '#1a1a2a', color: '#a78bfa', border: '1px solid #a78bfa44' }}
          >
            <Upload size={10} /> Import .pth
          </button>
          <input ref={pthInputRef} type="file" accept=".pth" className="hidden" onChange={handlePthUpload} />
        </div>

        {importedModel && (
          <p className="text-9px px-2 py-1 rounded" style={{ background: '#1a1a2a', color: '#00ff88' }}>
            Imported: {importedModel.name} — used when local RVC server is connected
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {RVC_BUILTIN_PRESETS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                const next = { ...settings, presetId: model.id };
                setSettings(next);
                if (hasRecording && !isProcessing) {
                  void convertVocals(next);
                }
              }}
              className="p-2 rounded-lg text-9px transition-all text-left"
              style={{
                background: settings.presetId === model.id ? 'rgba(167, 139, 250, 0.2)' : '#242424',
                border: `1px solid ${settings.presetId === model.id ? '#a78bfa' : '#222'}`,
                color: settings.presetId === model.id ? '#a78bfa' : '#555',
              }}
            >
              <div className="font-semibold">{model.name}</div>
              <div style={{ fontSize: '8px', marginTop: '2px' }}>{model.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>SETTINGS</span>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-9px">
            <span style={{ color: '#888' }}>Conversion Intensity</span>
            <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{settings.intensity}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.intensity}
            onChange={(e) => setSettings((prev) => ({ ...prev, intensity: Number(e.target.value) }))}
            style={{ accentColor: '#00ff88', width: '100%' }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-9px">
            <span style={{ color: '#888' }}>Converted Strength</span>
            <span style={{ color: '#ff6b35', fontWeight: 'bold' }}>{settings.mixPercentage}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.mixPercentage}
            onChange={(e) => setSettings((prev) => ({ ...prev, mixPercentage: Number(e.target.value) }))}
            style={{ accentColor: '#ff6b35', width: '100%' }}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-9px">
          <input
            type="checkbox"
            checked={settings.preservePitch}
            onChange={(e) => setSettings((prev) => ({ ...prev, preservePitch: e.target.checked }))}
            style={{ accentColor: '#00FFFF' }}
          />
          <span style={{ color: '#888' }}>Preserve Original Pitch</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-9px">
          <input
            type="checkbox"
            checked={settings.enableFormantShift}
            onChange={(e) => setSettings((prev) => ({ ...prev, enableFormantShift: e.target.checked }))}
            style={{ accentColor: '#00FFFF' }}
          />
          <span style={{ color: '#888' }}>Enable Formant Shifting</span>
        </label>
      </div>

      <button
        type="button"
        onClick={() => void convertVocals()}
        disabled={!hasRecording || isProcessing}
        className="py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
        style={{
          background: hasRecording && !isProcessing ? '#ff6b35' : '#66663344',
          color: '#fff',
          cursor: hasRecording && !isProcessing ? 'pointer' : 'not-allowed',
          opacity: hasRecording && !isProcessing ? 1 : 0.5,
        }}
      >
        <Zap size={16} />
        {isProcessing
          ? `${stageMessage || 'Converting…'} ${Math.round(conversionProgress)}%`
          : `CONVERT TO ${selectedPreset.name.toUpperCase()}`}
      </button>

      {isProcessing && (
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#2c2c2c' }}>
          <div
            style={{
              width: `${conversionProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #ff6b35, #ffaa00)',
              transition: 'width 0.3s',
            }}
          />
        </div>
      )}

      {convertError && (
        <p className="text-xs text-center" style={{ color: '#ff6666' }}>
          {convertError}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: '#2a1a2a', border: '1px solid #D500F944' }}>
          <span className="text-xs font-bold" style={{ color: '#D500F9' }}>
            CONVERTED VOCAL ({result.engine === 'rvc-server' ? 'RVC SERVER' : 'BROWSER DSP'})
          </span>
          <p className="text-9px" style={{ color: '#888' }}>
            {result.noteCount} pitch segments · {result.durationSec.toFixed(1)}s ·{' '}
            {result.engine === 'rvc-server'
              ? 'real RVC infer'
              : settings.preservePitch
                ? 'formant + EQ — same melody pitch, different voice color'
                : 'formant + pitch shift — check Preserve Pitch to keep your melody'}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleConvertedPlay}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded font-bold text-xs"
              style={{
                background: isPlayingConverted ? '#D500F9' : '#2c2c2c',
                color: isPlayingConverted ? '#000' : '#D500F9',
                border: '1px solid #D500F944',
                cursor: 'pointer',
              }}
            >
              {isPlayingConverted ? <Pause size={12} /> : <Play size={12} />}
              {isPlayingConverted ? 'PAUSE' : 'PLAY'}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={convertedVolume}
              onChange={(e) => {
                setConvertedVolume(Number(e.target.value));
                if (convertedAudioRef.current) convertedAudioRef.current.volume = Number(e.target.value) / 100;
              }}
              style={{ flex: 1, cursor: 'pointer', accentColor: '#D500F9' }}
            />
            <button
              type="button"
              onClick={() => downloadRvcWav(result.wavBlob, selectedPreset.name)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-bold"
              style={{ background: '#D500F944', color: '#D500F9', border: '1px solid #D500F9' }}
            >
              <Download size={12} />
            </button>
          </div>

          <audio
            ref={convertedAudioRef}
            onEnded={() => setIsPlayingConverted(false)}
            style={{ display: 'none' }}
          />
        </div>
      )}

      <div className="p-2 rounded text-9px" style={{ background: '#2c2c2c', color: '#888', borderLeft: '2px solid #00FFFF' }}>
        <strong>Open source:</strong> Browser formant + EQ presets work offline. For real RVC .pth models, run{' '}
        <code style={{ color: '#00E5FF' }}>npm run music-enhancer-server</code> and set{' '}
        <code style={{ color: '#00E5FF' }}>RVC_INFER_URL</code> to your local RVC WebUI.
      </div>
        </div>
      )}
    </div>
  );
}
