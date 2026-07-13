/**
 * Music Match: upload stem → detect key → chords + bass that fit (genre/mood).
 * Standalone module — not part of AI Song Generator.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Mic2, RefreshCw, Upload, Wand2 } from 'lucide-react';

import AiMusicMatchLoopPanel from '@/app/components/aiMusicMatch/AiMusicMatchLoopPanel';
import { useMasterClock } from '@/app/context/MasterClockContext';
import { chordBassSeqChannelLabel } from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  AI_MATCH_GENRES,
  AI_MATCH_MOODS,
  AI_MATCH_SOURCE_OPTIONS,
  analyzeAudioForMatch,
  buildGrooveLabMatchSession,
  formatAudioDuration,
  keyModeLabel,
  type AiMatchGenre,
  type AiMatchMood,
  type AiMatchSource,
} from '@/app/lib/aiMusicMatch/aiMusicMatch';
import {
  stopAiMusicMatchPreview,
} from '@/app/lib/aiMusicMatch/aiMusicMatchPreview';
import type { PendingAiMatchStudioImport } from '@/app/lib/aiMusicMatch/aiMusicMatchStudioExport';
import {
  extractPitchEventsForMatchAsync,
  filterCachedPitchEvents,
  matchAnalysisWindowLabel,
} from '@/app/lib/aiMusicMatch/pitchExtract';
import { coerceMatchLoopBars, type MatchLoopBarCount } from '@/app/lib/aiMusicMatch/aiMusicMatchRollData';
import { useAiMusicMatchPlayback } from '@/app/lib/aiMusicMatch/useAiMusicMatchPlayback';
import type { PitchEvent } from '@/app/lib/pitchDetection';
import { grooveLabPickChordChannel, saveGrooveLabSession } from '@/app/lib/creationStation/grooveLabRoll';
import type { MelodyProgressionCandidate } from '@/app/lib/creationStation/melodyToChordProgression';

const MINT = '#7cf4c6';
const CYAN = '#00E5FF';
const PURPLE = '#D500F9';
const UPLOAD_TIMEOUT_MS = 90_000;

type MatchProgressPhase = 'idle' | 'upload' | 'match' | 'export' | 'complete' | 'error';

function MatchProgressPanel({
  phase,
  label,
  progress,
}: {
  phase: MatchProgressPhase;
  label: string;
  progress: number;
}) {
  if (phase === 'idle') return null;

  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const isComplete = phase === 'complete';
  const isError = phase === 'error';
  const accent = isError ? '#f4a0a0' : isComplete ? MINT : CYAN;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: isComplete ? 'rgba(124, 244, 198, 0.08)' : '#1c1c1c',
        border: `1px solid ${isComplete ? `${MINT}55` : isError ? '#f4a0a044' : '#222'}`,
      }}
    >
      <div className="flex justify-between items-center gap-3 text-xs">
        <span className="flex items-center gap-2 font-bold min-w-0" style={{ color: accent }}>
          {isComplete ? <CheckCircle2 size={14} /> : <RefreshCw size={14} className="animate-spin" />}
          <span className="truncate">{label}</span>
        </span>
        <span style={{ color: accent, fontWeight: 900 }}>{pct}%</span>
      </div>
      <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: '#2c2c2c' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: isError
              ? '#f4a0a0'
              : isComplete
                ? `linear-gradient(90deg, ${MINT}, ${CYAN})`
                : `linear-gradient(90deg, ${CYAN}, ${MINT})`,
            boxShadow: isComplete ? `0 0 12px ${MINT}66` : undefined,
          }}
        />
      </div>
      {isComplete ? (
        <p className="text-[10px]" style={{ color: '#7a9a8a' }}>
          Done — hit Preview to hear chords + bass against your stem.
        </p>
      ) : null}
    </div>
  );
}

export default function AiMusicMatchTab({
  onOpenGrooveLab,
  onExportStudio,
}: {
  onOpenGrooveLab: () => void;
  onExportStudio: (payload: PendingAiMatchStudioImport) => void;
}) {
  const { bpm, getOrCreateAudioContext } = useMasterClock();
  const fileRef = useRef<HTMLInputElement>(null);

  const [matchSource, setMatchSource] = useState<AiMatchSource>('vocals');
  const [genre, setGenre] = useState<AiMatchGenre>('R&B');
  const [mood, setMood] = useState<AiMatchMood>('Chill');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [pitchCount, setPitchCount] = useState(0);
  const [detectedKey, setDetectedKey] = useState<{ keyRoot: number; mode: import('@/app/lib/creationStation/chordBuilder').ChordMode } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pitchExtracting, setPitchExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MelodyProgressionCandidate[] | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    keyRoot: number;
    mode: import('@/app/lib/creationStation/chordBuilder').ChordMode;
    barCount: number;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progressPhase, setProgressPhase] = useState<MatchProgressPhase>('idle');
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [analysisWindowNote, setAnalysisWindowNote] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [loopBarCount, setLoopBarCount] = useState<MatchLoopBarCount>(4);
  const rawPitchEventsRef = useRef<PitchEvent[]>([]);
  const loopEditorRef = useRef<HTMLDivElement | null>(null);

  const stopStemOnlyPreview = useCallback(() => {}, []);

  const stopMatchPreview = useCallback(() => {
    stopAiMusicMatchPreview();
  }, []);

  const selectedCandidate =
    candidates?.find((c) => c.id === selectedCandidateId) ?? candidates?.[0] ?? null;

  const playback = useAiMusicMatchPlayback({
    audioBuffer,
    candidate: selectedCandidate,
    keyRoot: analysisMeta?.keyRoot ?? detectedKey?.keyRoot ?? 0,
    mode: analysisMeta?.mode ?? detectedKey?.mode ?? 'major',
    loopBarCount,
    genre,
    mood,
    bpm,
    getOrCreateAudioContext,
  });

  useEffect(
    () => () => {
      stopAiMusicMatchPreview();
    },
    [],
  );

  const setProgress = useCallback((phase: MatchProgressPhase, label: string, pct: number) => {
    setProgressPhase(phase);
    setProgressLabel(label);
    setProgressPct(pct);
  }, []);

  const tickProgress = useCallback(async (phase: MatchProgressPhase, label: string, pct: number) => {
    setProgress(phase, label, pct);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }, [setProgress]);

  const applyFilteredPitch = useCallback(
    (filtered: PitchEvent[]) => {
      setPitchCount(filtered.length);
      if (filtered.length >= 8) {
        const peek = analyzeAudioForMatch(filtered, bpm, { genre, mood, topK: 1 });
        setDetectedKey(peek ? { keyRoot: peek.keyRoot, mode: peek.mode } : null);
      } else {
        setDetectedKey(null);
      }
      return filtered;
    },
    [bpm, genre, mood],
  );

  const peekKeyLight = useCallback((filtered: PitchEvent[]) => {
    setPitchCount(filtered.length);
    if (filtered.length < 8) {
      setDetectedKey(null);
      return filtered;
    }
    window.setTimeout(() => {
      const peek = analyzeAudioForMatch(filtered, bpm, { genre, mood, topK: 1 });
      setDetectedKey(peek ? { keyRoot: peek.keyRoot, mode: peek.mode } : null);
    }, 0);
    return filtered;
  }, [bpm, genre, mood]);

  const extractAndCachePitch = useCallback(
    async (buffer: AudioBuffer, source: AiMatchSource, onExtractProgress: (pct: number) => void) => {
      const raw = await extractPitchEventsForMatchAsync(buffer, onExtractProgress);
      rawPitchEventsRef.current = raw;
      setAnalysisWindowNote(matchAnalysisWindowLabel(buffer.duration));
      return peekKeyLight(filterCachedPitchEvents(raw, source));
    },
    [peekKeyLight],
  );

  const loadFile = useCallback(
    async (file: File) => {
      stopMatchPreview();
      playback.stopAll();
      stopStemOnlyPreview();
      setError(null);
      setCandidates(null);
      setAnalysisMeta(null);
      setSelectedCandidateId(null);
      setStatus(null);
      setDetectedKey(null);
      setAnalysisWindowNote(null);
      rawPitchEventsRef.current = [];
      setBusy(true);
      setPitchExtracting(false);
      const uploadTimeout = window.setTimeout(() => {
        setError('Upload timed out — try a shorter clip (under 2 min) or hard refresh (Ctrl+Shift+R)');
        setProgress('error', 'Upload timed out', 100);
        setBusy(false);
        setPitchExtracting(false);
      }, UPLOAD_TIMEOUT_MS);
      setProgress('upload', 'Reading audio file…', 8);
      try {
        await tickProgress('upload', 'Reading audio file…', 18);
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        await tickProgress('upload', 'Decoding audio…', 38);
        const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
        const windowNote = matchAnalysisWindowLabel(buffer.duration);

        setAudioFile(file);
        setAudioBuffer(buffer);
        setBusy(false);
        setStatus('Stem decoded — chord roll is below; analyzing pitch…');
        window.requestAnimationFrame(() => {
          loopEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        setPitchExtracting(true);
        await tickProgress(
          'upload',
          windowNote ? 'Analyzing pitch (first 45 sec)…' : 'Analyzing pitch in your stem…',
          50,
        );
        const filtered = await extractAndCachePitch(buffer, matchSource, (pct) => {
          setProgress('upload', windowNote ?? 'Analyzing pitch in your stem…', 50 + Math.round(pct * 0.38));
        });
        setPitchExtracting(false);
        await tickProgress('upload', 'Detecting key…', 92);
        if (filtered.length < 8) {
          setError(
            `Not enough pitch for “${AI_MATCH_SOURCE_OPTIONS.find((o) => o.id === matchSource)?.label}” — try Vocals or Full mix, or a longer clip (3+ sec).`,
          );
          setProgress('error', 'Upload finished — not enough pitch detected', 100);
        } else {
          setProgress('complete', 'Stem loaded — ready to match chords + bass', 100);
          setStatus('Stem loaded — chord roll is ready below your vocal');
        }
      } catch {
        setError('Could not read that audio file');
        setAudioFile(null);
        setAudioBuffer(null);
        setProgress('error', 'Could not read audio file', 100);
      } finally {
        window.clearTimeout(uploadTimeout);
        setBusy(false);
        setPitchExtracting(false);
      }
    },
    [extractAndCachePitch, getOrCreateAudioContext, matchSource, playback.stopAll, setProgress, stopMatchPreview, stopStemOnlyPreview, tickProgress],
  );

  const runMatch = useCallback(async () => {
    if (!audioBuffer) {
      setError('Upload a vocal or melody stem first');
      return;
    }
    if (rawPitchEventsRef.current.length === 0) {
      setError('Pitch data missing — re-upload your stem');
      return;
    }
    playback.stopAll();
    setMatching(true);
    setBusy(true);
    setError(null);
    setProgress('match', 'Preparing match…', 10);
    try {
      await tickProgress('match', 'Filtering pitch for your source…', 28);
      const events = filterCachedPitchEvents(rawPitchEventsRef.current, matchSource);
      applyFilteredPitch(events);
      if (events.length < 8) {
        setError('Not enough pitch — try Vocals or Full mix, or use a cleaner vocal stem');
        setProgress('error', 'Match failed — not enough pitch', 100);
        setMatching(false);
        setBusy(false);
        return;
      }
      await tickProgress('match', 'Detecting key…', 48);
      await tickProgress('match', 'Matching chord progressions…', 72);
      const result = analyzeAudioForMatch(events, bpm, { genre, mood, topK: 6 });
      await tickProgress('match', 'Building bass ideas for your style…', 90);
      if (!result) {
        setError('Could not detect a clear key — try a cleaner vocal stem');
        setProgress('error', 'Match failed — key not clear', 100);
        setMatching(false);
        setBusy(false);
        return;
      }
      setDetectedKey({ keyRoot: result.keyRoot, mode: result.mode });
      setAnalysisMeta({ keyRoot: result.keyRoot, mode: result.mode, barCount: result.barCount });
      setLoopBarCount(coerceMatchLoopBars(result.barCount));
      setCandidates(result.candidates);
      setSelectedCandidateId(result.candidates[0]?.id ?? null);
      setProgress('complete', `Complete · ${result.candidates.length} chord matches ready`, 100);
      setStatus(
        `${keyModeLabel(result.keyRoot, result.mode)} · ${genre} · ${mood} · chord roll updated below`,
      );
      window.requestAnimationFrame(() => {
        loopEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } finally {
      setMatching(false);
      setBusy(false);
    }
  }, [
    applyFilteredPitch,
    bpm,
    genre,
    matchSource,
    mood,
    setProgress,
    stopMatchPreview,
    playback.stopAll,
    tickProgress,
  ]);

  const applyToGrooveLab = useCallback(
    async (candidate: MelodyProgressionCandidate) => {
      if (!analysisMeta) return;
      setBusy(true);
      setError(null);
      setProgress('export', 'Building chord columns…', 25);
      try {
        await tickProgress('export', 'Generating bass line…', 55);
        const built = buildGrooveLabMatchSession({
          candidate,
          keyRoot: analysisMeta.keyRoot,
          mode: analysisMeta.mode,
          barCount: analysisMeta.barCount,
          genre,
          mood,
        });
        await tickProgress('export', 'Saving to Groove Lab…', 85);
        if ('message' in built) {
          setError(built.message);
          setProgress('error', 'Could not load Groove Lab', 100);
          return;
        }
        saveGrooveLabSession(built.notesByChannel, built.barCount);
        const ch = grooveLabPickChordChannel();
        setProgress('complete', 'Loaded in Groove Lab · chords + bass', 100);
        setStatus(
          `Groove Lab · ${chordBassSeqChannelLabel(ch)} · ${candidate.label} · chords + bass (${genre} / ${mood})`,
        );
        onOpenGrooveLab();
      } finally {
        setBusy(false);
      }
    },
    [analysisMeta, genre, mood, onOpenGrooveLab, setProgress, tickProgress],
  );

  const onDropFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0];
      if (f && f.type.startsWith('audio/')) void loadFile(f);
    },
    [loadFile],
  );

  return (
    <div className="flex flex-col gap-5 w-full min-w-0 max-w-none">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs leading-relaxed flex-1 min-w-0" style={{ color: '#888' }}>
          Upload a vocal stem — Music Match detects key and genre, then opens a Geno Build-style chord roll: vocals on
          top, matched chords + auto bass below (4–8 bars). Send to Studio Editor 2 when it sits right.
        </p>
        <span
          className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded"
          style={{ color: MINT, background: `${MINT}12`, border: `1px solid ${MINT}33` }}
        >
          Match v8
        </span>
      </div>

      <MatchProgressPanel phase={progressPhase} label={progressLabel} progress={progressPct} />

      <div
        className="rounded-xl p-6 flex flex-col gap-4"
        style={{
          background: dragOver ? 'rgba(124, 244, 198, 0.12)' : 'rgba(124, 244, 198, 0.06)',
          border: `2px dashed ${dragOver ? MINT : `${MINT}66`}`,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onDropFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center gap-2">
          <Upload size={18} style={{ color: MINT }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: MINT }}>
            1 · Upload your stem
          </span>
        </div>
        <p className="text-sm" style={{ color: '#bbb' }}>
          Drop a vocal, melody, bass, or full mix — WAV or MP3. Music Match listens first; we match chords and bass to what
          you upload.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-black"
            style={{ background: MINT, color: '#000' }}
          >
            <Upload size={16} /> Choose audio file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {audioFile ? (
          <div className="flex flex-wrap gap-3 items-center text-xs" style={{ color: '#aaa' }}>
            <span className="font-bold" style={{ color: '#ddd' }}>
              {audioFile.name}
            </span>
            {audioBuffer ? <span>{formatAudioDuration(audioBuffer.duration)}</span> : null}
            <span>{pitchCount} pitch frames</span>
            {detectedKey ? (
              <span className="px-2 py-0.5 rounded font-black" style={{ background: `${MINT}22`, color: MINT }}>
                Key: {keyModeLabel(detectedKey.keyRoot, detectedKey.mode)}
              </span>
            ) : null}
            {analysisWindowNote ? (
              <span className="text-[10px]" style={{ color: '#777' }}>
                {analysisWindowNote}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs" style={{ color: '#555' }}>
            Tip: start with an acapella — clearest matches come from Vocals
          </p>
        )}
      </div>

      {audioBuffer && audioFile ? (
        <div ref={loopEditorRef} className="w-full min-w-0 scroll-mt-4">
          <AiMusicMatchLoopPanel
              audioBuffer={audioBuffer}
              audioFile={audioFile}
              candidates={candidates}
              selectedCandidateId={selectedCandidateId ?? candidates?.[0]?.id ?? null}
              onSelectCandidate={setSelectedCandidateId}
              keyRoot={analysisMeta?.keyRoot ?? detectedKey?.keyRoot ?? 0}
              mode={analysisMeta?.mode ?? detectedKey?.mode ?? 'major'}
              analysisBarCount={analysisMeta?.barCount ?? 4}
              genre={genre}
              mood={mood}
              matching={matching}
              onExportStudio={onExportStudio}
              onOpenGrooveLab={(c) => void applyToGrooveLab(c)}
              onGenerate={() => void runMatch()}
              canGenerate={!busy && !pitchExtracting && pitchCount >= 8}
              loopBarCount={loopBarCount}
              onLoopBarCountChange={setLoopBarCount}
              playing={playback.playing}
              previewBeat={playback.previewBeat}
              onTogglePlayback={playback.togglePlayback}
              hasMatchedChords={playback.hasMatchedChords}
              onStopPlayback={playback.stopAll}
              mix={playback.mix}
              onMixChange={playback.setMixPartial}
          />
        </div>
      ) : null}

      <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #222' }}>
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: CYAN }}>
          2 · Based on Music Match
        </span>
        <div className="flex flex-wrap gap-2">
          {AI_MATCH_SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.hint}
              onClick={() => {
                playback.stopAll();
                stopMatchPreview();
                setMatchSource(opt.id);
                if (rawPitchEventsRef.current.length > 0) {
                  applyFilteredPitch(filterCachedPitchEvents(rawPitchEventsRef.current, opt.id));
                  setCandidates(null);
                  setAnalysisMeta(null);
                }
              }}
              className="px-3 py-2 rounded-lg text-xs font-bold"
              style={{
                background: matchSource === opt.id ? `${CYAN}22` : '#242424',
                color: matchSource === opt.id ? CYAN : '#888',
                border: `1px solid ${matchSource === opt.id ? CYAN : '#333'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid w-full min-w-0 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #222' }}>
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: PURPLE }}>
            3 · Genre
          </span>
          <div className="flex flex-wrap gap-2">
            {AI_MATCH_GENRES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  background: genre === g ? `${PURPLE}22` : '#242424',
                  color: genre === g ? PURPLE : '#888',
                  border: `1px solid ${genre === g ? PURPLE : '#333'}`,
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #222' }}>
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: CYAN }}>
            Mood / style
          </span>
          <div className="flex flex-wrap gap-2">
            {AI_MATCH_MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  background: mood === m ? `${CYAN}22` : '#242424',
                  color: mood === m ? CYAN : '#888',
                  border: `1px solid ${mood === m ? CYAN : '#333'}`,
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void runMatch()}
        disabled={busy || !audioBuffer}
        className="py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2"
        style={{
          background: busy || !audioBuffer ? '#2c2c2c' : `linear-gradient(135deg, ${MINT}, ${CYAN})`,
          color: busy || !audioBuffer ? '#555' : '#000',
        }}
      >
        {busy && progressPhase === 'match' ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : (
          <Wand2 size={16} />
        )}
        {busy && progressPhase === 'match' ? 'Matching…' : 'Generate chords + bass'}
      </button>

      {(busy || pitchExtracting) && progressPhase === 'upload' ? (
        <p className="text-[10px] text-center" style={{ color: '#666' }}>
          {pitchExtracting
            ? 'Analyzing pitch in background — chord roll is already visible above…'
            : 'Loading stem — longer files may take a few seconds…'}
        </p>
      ) : null}

      {error ? (
        <p className="text-xs font-bold" style={{ color: '#f4a0a0' }}>
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="text-xs font-bold" style={{ color: MINT }}>
          {status}
        </p>
      ) : null}

      <div className="flex items-center gap-2 text-[10px]" style={{ color: '#555' }}>
        <Mic2 size={12} /> Music Match analyzes your upload — stem separation coming later.
      </div>
    </div>
  );
}
