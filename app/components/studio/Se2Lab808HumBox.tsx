'use client';

/**
 * 808 Lab Hum Box — hum a 4/8-bar bassline; notes land on the tone grid in the Lab key.
 * Capture UX mirrors VocalBox (count-in → Rec); pitch uses Neural Hum analyze + 808 key lock.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Mic, Square } from 'lucide-react';
import { useVocalCapture } from '@/app/hooks/useVocalCapture';
import {
  trimAudioBufferFromSec,
  vocalBoxBarSec,
} from '@/app/lib/creationStation/beatPadsVocalBoxAnalyze';
import { se2Lab808ApplyHumNotesToToneGrid } from '@/app/lib/studio/se2Lab808HumBoxApply';
import {
  se2Lab808NormalizeToneGridLoopBars,
  type Se2Lab808ToneGridLoopBars,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';
import {
  createSe2PrecountRimshotBuffer,
  ensureSe2PrecountRimshotBuffer,
  runSe2Precount,
  SE2_PRECOUNT_CLICK_VOLUME,
} from '@/app/lib/studio/se2Precount';
import { analyzeNeuralHumMelody } from '@/app/lib/vocalLab/neuralHumToInstrument';

const HUM_ACCENT = '#c4a0ff';
const BEATS_PER_BAR = 4;

function humBoxCaptureDurationSec(bpm: number, captureBars: 4 | 8): number {
  const b = Math.max(30, Math.min(300, bpm));
  return captureBars * BEATS_PER_BAR * (60 / b);
}

export type Se2Lab808HumBoxProps = {
  bpm: number;
  voice: Se2Lab808VoiceParams;
  keyRoot: number;
  keyMode: 'major' | 'minor';
  keyLabel: string;
  disabled?: boolean;
  getAudioContext: () => AudioContext;
  getPreviewDestination?: (ctx: AudioContext) => AudioNode;
  warmAudio?: () => void | Promise<void>;
  onVoiceChange: (voice: Se2Lab808VoiceParams) => void;
  onStatus?: (msg: string) => void;
};

function captureBarsForLoop(loopBars: Se2Lab808ToneGridLoopBars): 4 | 8 {
  return loopBars === 4 ? 4 : 8;
}

export function Se2Lab808HumBox({
  bpm,
  voice,
  keyRoot,
  keyMode,
  keyLabel,
  disabled = false,
  getAudioContext,
  getPreviewDestination,
  warmAudio,
  onVoiceChange,
  onStatus,
}: Se2Lab808HumBoxProps) {
  const loopBars = se2Lab808NormalizeToneGridLoopBars(voice.toneGridLoopBars);
  const [captureBars, setCaptureBars] = useState<4 | 8>(() => captureBarsForLoop(loopBars));
  const [merge, setMerge] = useState(false);
  const [status, setStatus] = useState('Hum bass · holds full notes · Lab key');
  const [busy, setBusy] = useState(false);
  const [isPrecounting, setIsPrecounting] = useState(false);
  const [precountBeat, setPrecountBeat] = useState<number | null>(null);

  const gridOriginFileSecRef = useRef(0);
  const precountCancelRef = useRef(false);
  const precountBufRef = useRef<AudioBuffer | null>(null);
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzingRef = useRef(false);

  const flash = useCallback(
    (msg: string) => {
      setStatus(msg);
      onStatus?.(msg);
    },
    [onStatus],
  );

  const cancelScheduled = useCallback(() => {
    for (const n of scheduledNodesRef.current) {
      try {
        n.stop();
      } catch {
        /* */
      }
    }
    scheduledNodesRef.current = [];
  }, []);

  const applyBlob = useCallback(
    async (blob: Blob | null) => {
      if (!blob || blob.size < 200 || analyzingRef.current) return;
      analyzingRef.current = true;
      setBusy(true);
      flash('Analyzing hum…');
      try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
        const bytes = await blob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        const takeSec = humBoxCaptureDurationSec(bpm, captureBars);
        const trimmed = trimAudioBufferFromSec(decoded, gridOriginFileSecRef.current, takeSec + 0.05);
        const scaleId = keyMode === 'minor' ? 'minor' : 'major';
        const analyzed = analyzeNeuralHumMelody(trimmed, {
          mode: 'manual',
          keyRoot,
          scaleId,
        });
        if (analyzed.notes.length === 0) {
          flash('No pitched notes — hum louder / closer.');
          return;
        }
        const applied = se2Lab808ApplyHumNotesToToneGrid({
          notes: analyzed.notes,
          bpm,
          voice,
          keyRoot,
          keyMode,
          mode: merge ? 'merge' : 'replace',
        });
        if (applied.hitCount < 1) {
          flash('Notes out of pad range — shift pads or hum lower.');
          return;
        }
        onVoiceChange({
          ...voice,
          toneGridSteps: applied.pattern,
          tonePadBaseMidi: applied.tonePadBaseMidi,
        });
        flash(
          `${applied.noteCount} held note${applied.noteCount === 1 ? '' : 's'} → ${keyLabel}${
            merge ? ' · merged' : ' · replaced'
          }`,
        );
      } catch (err) {
        flash(err instanceof Error ? err.message : 'Hum analyze failed');
      } finally {
        analyzingRef.current = false;
        setBusy(false);
      }
    },
    [bpm, captureBars, flash, getAudioContext, keyLabel, keyMode, keyRoot, merge, onVoiceChange, voice],
  );

  const capture = useVocalCapture((blob) => {
    void applyBlob(blob);
  });

  useEffect(() => {
    setCaptureBars((prev) => {
      const max = captureBarsForLoop(loopBars);
      return prev > max ? max : prev;
    });
  }, [loopBars]);

  useEffect(
    () => () => {
      precountCancelRef.current = true;
      cancelScheduled();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      capture.releaseMic();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    [],
  );

  const scheduleClick = useCallback(
    (ctx: AudioContext, idealT: number, downbeat: boolean) => {
      let buf = precountBufRef.current;
      if (!buf && ctx.state !== 'closed') {
        buf = createSe2PrecountRimshotBuffer(ctx);
        precountBufRef.current = buf;
      }
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = downbeat ? SE2_PRECOUNT_CLICK_VOLUME * 1.12 : SE2_PRECOUNT_CLICK_VOLUME;
      src.connect(g);
      g.connect(getPreviewDestination?.(ctx) ?? ctx.destination);
      try {
        src.start(Math.max(ctx.currentTime, idealT));
        scheduledNodesRef.current.push(src);
      } catch {
        /* */
      }
    },
    [getPreviewDestination],
  );

  const stopRecording = useCallback(() => {
    precountCancelRef.current = true;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    cancelScheduled();
    if (capture.isRecording) capture.stopRecord();
    else capture.releaseMic();
    setIsPrecounting(false);
    setPrecountBeat(null);
    flash('Stopped.');
  }, [cancelScheduled, capture, flash]);

  const beginRecord = useCallback(async () => {
    if (disabled || busy || capture.isRecording || isPrecounting) return;
    setBusy(true);
    setIsPrecounting(true);
    setPrecountBeat(null);
    flash(`Arming @ ${Math.round(bpm)} BPM…`);
    void warmAudio?.();

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
      setBusy(false);
      setIsPrecounting(false);
      flash('Audio not ready — tap Play once, then Rec.');
      return;
    }

    const micOk = await capture.armMic();
    if (!micOk) {
      setBusy(false);
      setIsPrecounting(false);
      flash('Mic blocked — allow microphone.');
      return;
    }

    precountCancelRef.current = false;
    try {
      precountBufRef.current = await ensureSe2PrecountRimshotBuffer(ctx);
      const countInDurSec = vocalBoxBarSec(bpm, BEATS_PER_BAR);
      gridOriginFileSecRef.current = countInDurSec;
      cancelScheduled();

      flash(`${Math.round(bpm)} BPM — count-in…`);
      await capture.startRecord();

      const result = await runSe2Precount({
        ctx,
        bpm,
        beatsPerBar: BEATS_PER_BAR,
        bars: 1,
        scheduleClick: (idealT, downbeat) => scheduleClick(ctx, idealT, downbeat),
        onBeat: (beat, total) => {
          setPrecountBeat(beat);
          flash(`${Math.round(bpm)} BPM — ${beat}/${total}`);
        },
        isCancelled: () => precountCancelRef.current,
      });

      cancelScheduled();
      if (result.cancelled) {
        capture.releaseMic();
        if (capture.isRecording) capture.stopRecord();
        flash('Count-in cancelled.');
        return;
      }

      setIsPrecounting(false);
      setPrecountBeat(null);
      flash(`Hum ${captureBars} bars in ${keyLabel}…`);

      // Soft quarter click through the take
      const takeSec = humBoxCaptureDurationSec(bpm, captureBars);
      const spb = 60 / Math.max(30, Math.min(300, bpm));
      const totalBeats = Math.ceil(takeSec / spb) + 1;
      for (let i = 0; i < totalBeats; i += 1) {
        scheduleClick(ctx, result.downbeatAudioTime + i * spb, i % BEATS_PER_BAR === 0);
      }

      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = setTimeout(() => {
        stopTimerRef.current = null;
        cancelScheduled();
        if (capture.isRecording) capture.stopRecord();
        flash('Analyzing hum…');
      }, Math.ceil(takeSec * 1000) + 40);
    } catch (err) {
      capture.releaseMic();
      flash(err instanceof Error ? err.message : 'Record failed');
    } finally {
      setBusy(false);
      setIsPrecounting(false);
    }
  }, [
    bpm,
    busy,
    cancelScheduled,
    capture,
    captureBars,
    disabled,
    flash,
    getAudioContext,
    isPrecounting,
    keyLabel,
    scheduleClick,
    warmAudio,
  ]);

  const recording = capture.isRecording || isPrecounting;
  const canRec = !disabled && !busy && !recording;

  const btn = (active: boolean, accent = HUM_ACCENT): CSSProperties => ({
    height: 24,
    minHeight: 24,
    padding: '0 8px',
    borderRadius: 5,
    border: `1px solid ${active ? accent : 'rgba(196,160,255,0.35)'}`,
    background: active ? 'rgba(196,160,255,0.22)' : 'rgba(196,160,255,0.06)',
    color: active ? '#f3e8ff' : HUM_ACCENT,
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div
      className="se2-lab808-hum-box flex flex-col gap-1.5 shrink-0 rounded-md border px-2 py-1.5"
      style={{
        width: 168,
        borderColor: 'rgba(196,160,255,0.45)',
        background: 'linear-gradient(165deg, rgba(28,18,40,0.95) 0%, rgba(10,8,16,0.98) 100%)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
      }}
      data-se2-lab808-hum-box
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span
          className="text-[9px] font-black uppercase tracking-wide shrink-0"
          style={{ color: HUM_ACCENT }}
          title="Hum a bassline — notes snap to the 808 Lab key"
        >
          Hum Box
        </span>
        <span
          className="text-[7px] font-bold truncate"
          style={{ color: 'rgba(196,160,255,0.7)' }}
          title={`Key lock: ${keyLabel}`}
        >
          {keyLabel}
        </span>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {([4, 8] as const).map((bars) => {
          const max = captureBarsForLoop(loopBars);
          const allowed = bars <= max;
          return (
            <button
              key={bars}
              type="button"
              disabled={disabled || !allowed}
              style={btn(captureBars === bars)}
              onClick={() => setCaptureBars(bars)}
              title={
                allowed
                  ? `Capture ${bars} bars`
                  : `Loop is ${loopBars} bars — capture max ${max}`
              }
            >
              {bars}b
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          style={btn(merge, merge ? '#4ade80' : HUM_ACCENT)}
          onClick={() => setMerge((m) => !m)}
          title={merge ? 'Merge onto existing grid' : 'Replace grid with hum'}
        >
          {merge ? 'Add' : 'Rpl'}
        </button>
      </div>

      <div className="flex items-center gap-1">
        {recording ? (
          <button
            type="button"
            disabled={disabled}
            style={{ ...btn(true, '#f87171'), flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            onClick={stopRecording}
            title="Stop recording"
          >
            <Square size={11} fill="currentColor" aria-hidden />
            Stop
            {precountBeat != null ? ` ${precountBeat}` : ''}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canRec}
            style={{ ...btn(false), flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            onClick={() => void beginRecord()}
            title={`Count-in, then hum ${captureBars} bars in ${keyLabel}`}
          >
            <Mic size={12} aria-hidden />
            Rec
          </button>
        )}
      </div>

      <span
        className="text-[7px] font-semibold leading-snug min-h-[1.6em]"
        style={{ color: '#a89ab8' }}
        title={status}
      >
        {status}
      </span>
    </div>
  );
}
