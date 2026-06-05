/**
 * Standalone melody → chord progression matcher (sidebar screen).
 * Sends matched progressions to Groove Lab via local session storage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

import { MelodyMatchPanel } from '@/app/components/creation/MelodyMatchPanel';
import { useMasterClock } from '@/app/context/MasterClockContext';
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  chordBassSeqChannelLabel,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import { chordSymbolToName, type ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  newProgressionStepId,
  progressionStepsToGrooveHits,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  GROOVE_LAB_QUANTIZE_DEFAULT,
  grooveLabChannelIds,
  grooveLabPickChordChannel,
  saveGrooveLabSession,
  sanitizeGrooveLabChordChannelHits,
  type GrooveLabBarCount,
} from '@/app/lib/creationStation/grooveLabRoll';
import {
  analyzeMelodyToProgressions,
  expandProgressionToBars,
  extractPitchEventsFromAudioBuffer,
  type MelodyProgressionCandidate,
} from '@/app/lib/creationStation/melodyToChordProgression';
import { detectPitchACF } from '@/app/lib/pitchDetection';
import type { PitchEvent } from '@/app/lib/pitchDetection';
import {
  connectScriptProcessorSilentMonitor,
  midiNoteLabel,
  VOICE_MIDI_MIN_NOTE_GAP_MS,
  voiceMidiNoteFromFrequency,
  voiceMidiPitchEvent,
} from '@/app/lib/creationStation/voiceToMidiEffect';

export interface HarmonyMatchScreenProps {
  onOpenGrooveLab: () => void;
}

export default function HarmonyMatchScreen({ onOpenGrooveLab }: HarmonyMatchScreenProps) {
  const { bpm, getOrCreateAudioContext } = useMasterClock();

  const [melodyRecording, setMelodyRecording] = useState(false);
  const [melodyMatchBusy, setMelodyMatchBusy] = useState(false);
  const [melodyMatchError, setMelodyMatchError] = useState<string | null>(null);
  const [melodyPitchEvents, setMelodyPitchEvents] = useState<PitchEvent[]>([]);
  const [melodyCandidates, setMelodyCandidates] = useState<MelodyProgressionCandidate[] | null>(null);
  const [voiceMidiLive, setVoiceMidiLive] = useState(false);
  const [voiceMidiLiveNote, setVoiceMidiLiveNote] = useState<string | null>(null);
  const [voiceMidiCaptureCount, setVoiceMidiCaptureCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const melodyStreamRef = useRef<MediaStream | null>(null);
  const melodyProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const melodyEventsRef = useRef<PitchEvent[]>([]);
  const voiceMidiStreamRef = useRef<MediaStream | null>(null);
  const voiceMidiProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const voiceMidiEventsRef = useRef<PitchEvent[]>([]);
  const voiceMidiLastMidiRef = useRef<number | null>(null);
  const voiceMidiLastTriggerMsRef = useRef(0);
  const voiceMidiLiveRef = useRef(false);
  voiceMidiLiveRef.current = voiceMidiLive;

  const analysisMetaRef = useRef<{
    keyRoot: number;
    mode: ChordMode;
    barCount: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      melodyStreamRef.current?.getTracks().forEach((t) => t.stop());
      melodyProcessorRef.current?.disconnect();
      voiceMidiStreamRef.current?.getTracks().forEach((t) => t.stop());
      voiceMidiProcessorRef.current?.disconnect();
    };
  }, []);

  const stopVoiceMidiLive = useCallback(() => {
    voiceMidiLiveRef.current = false;
    voiceMidiStreamRef.current?.getTracks().forEach((t) => t.stop());
    voiceMidiStreamRef.current = null;
    voiceMidiProcessorRef.current?.disconnect();
    voiceMidiProcessorRef.current = null;
    voiceMidiLastMidiRef.current = null;
    setVoiceMidiLive(false);
    setVoiceMidiLiveNote(null);
    const events = [...voiceMidiEventsRef.current];
    if (events.length > 0) {
      setMelodyPitchEvents(events);
      setVoiceMidiCaptureCount(events.length);
    }
  }, []);

  const stopMelodyRecording = useCallback(() => {
    melodyStreamRef.current?.getTracks().forEach((t) => t.stop());
    melodyStreamRef.current = null;
    melodyProcessorRef.current?.disconnect();
    melodyProcessorRef.current = null;
    setMelodyPitchEvents([...melodyEventsRef.current]);
    setMelodyRecording(false);
  }, []);

  const toggleVoiceMidiLive = useCallback(async () => {
    if (voiceMidiLive) {
      const noteCount = voiceMidiEventsRef.current.length;
      stopVoiceMidiLive();
      if (noteCount < 8) {
        setMelodyMatchError('Need more notes — sing a short melody while LIVE is on');
      }
      return;
    }
    if (melodyRecording) stopMelodyRecording();
    setMelodyMatchError(null);
    setMelodyCandidates(null);
    analysisMetaRef.current = null;
    voiceMidiEventsRef.current = [];
    voiceMidiLastMidiRef.current = null;
    voiceMidiLastTriggerMsRef.current = 0;
    setVoiceMidiCaptureCount(0);
    setMelodyPitchEvents([]);
    setVoiceMidiLiveNote(null);
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      voiceMidiStreamRef.current = stream;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      voiceMidiProcessorRef.current = processor;
      voiceMidiLiveRef.current = true;
      const startMs = performance.now();
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!voiceMidiLiveRef.current) return;
        const audioData = e.inputBuffer.getChannelData(0);
        const { frequency, confidence } = detectPitchACF(audioData, ctx.sampleRate);
        const stable = voiceMidiNoteFromFrequency(
          frequency,
          confidence,
          voiceMidiLastMidiRef.current,
          0.12,
        );
        if (!stable) {
          setVoiceMidiLiveNote(null);
          return;
        }
        const { midi, changed } = stable;
        setVoiceMidiLiveNote(midiNoteLabel(midi));
        if (!changed) return;
        const now = performance.now();
        if (now - voiceMidiLastTriggerMsRef.current < VOICE_MIDI_MIN_NOTE_GAP_MS) return;
        voiceMidiLastTriggerMsRef.current = now;
        voiceMidiLastMidiRef.current = midi;
        const vel = Math.max(40, Math.min(127, Math.round(confidence * 127)));
        voiceMidiEventsRef.current.push(voiceMidiPitchEvent(now - startMs, midi, vel));
        setVoiceMidiCaptureCount(voiceMidiEventsRef.current.length);
      };
      connectScriptProcessorSilentMonitor(ctx, source, processor);
      setVoiceMidiLive(true);
    } catch {
      voiceMidiLiveRef.current = false;
      setMelodyMatchError('Microphone access denied');
      setVoiceMidiLive(false);
    }
  }, [voiceMidiLive, melodyRecording, stopMelodyRecording, stopVoiceMidiLive, getOrCreateAudioContext]);

  const toggleMelodyRecord = useCallback(async () => {
    if (melodyRecording) {
      stopMelodyRecording();
      return;
    }
    if (voiceMidiLive) stopVoiceMidiLive();
    setMelodyMatchError(null);
    setMelodyCandidates(null);
    analysisMetaRef.current = null;
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      melodyStreamRef.current = stream;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      melodyProcessorRef.current = processor;
      melodyEventsRef.current = [];
      const startMs = performance.now();
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const audioData = e.inputBuffer.getChannelData(0);
        const { frequency, confidence } = detectPitchACF(audioData, ctx.sampleRate);
        if (confidence > 0.12 && frequency > 0) {
          melodyEventsRef.current.push({
            time: performance.now() - startMs,
            frequency,
            confidence,
            velocity: 100,
          });
        }
      };
      connectScriptProcessorSilentMonitor(ctx, source, processor);
      setMelodyRecording(true);
    } catch {
      setMelodyMatchError('Microphone access denied');
      setMelodyRecording(false);
    }
  }, [melodyRecording, stopMelodyRecording, voiceMidiLive, stopVoiceMidiLive, getOrCreateAudioContext]);

  const uploadMelodyFile = useCallback(
    async (file: File) => {
      if (voiceMidiLive) stopVoiceMidiLive();
      setMelodyMatchError(null);
      setMelodyCandidates(null);
      analysisMetaRef.current = null;
      setVoiceMidiCaptureCount(0);
      setMelodyMatchBusy(true);
      try {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
        const events = extractPitchEventsFromAudioBuffer(buffer);
        setMelodyPitchEvents(events);
        setVoiceMidiCaptureCount(events.length);
        if (events.length < 8) setMelodyMatchError('Not enough pitch in that clip — try humming louder');
      } catch {
        setMelodyMatchError('Could not read that audio file');
      } finally {
        setMelodyMatchBusy(false);
      }
    },
    [voiceMidiLive, stopVoiceMidiLive, getOrCreateAudioContext],
  );

  const analyzeMelodyMatch = useCallback(() => {
    if (voiceMidiLive) stopVoiceMidiLive();
    const captured =
      voiceMidiEventsRef.current.length > 0 ? voiceMidiEventsRef.current : melodyPitchEvents;
    const events = melodyRecording ? melodyEventsRef.current : captured;
    if (events.length < 8) {
      setMelodyMatchError('Record, upload, or use LIVE voice MIDI first (a few seconds is enough)');
      return;
    }
    setMelodyMatchBusy(true);
    setMelodyMatchError(null);
    try {
      const result = analyzeMelodyToProgressions(events, bpm, { topK: 4 });
      if (!result) {
        setMelodyMatchError('Could not detect a clear melody — try again');
        setMelodyCandidates(null);
        return;
      }
      analysisMetaRef.current = {
        keyRoot: result.keyRoot,
        mode: result.mode,
        barCount: result.barCount,
      };
      setMelodyCandidates(result.candidates);
      setStatus(null);
    } finally {
      setMelodyMatchBusy(false);
    }
  }, [melodyPitchEvents, melodyRecording, voiceMidiLive, bpm, stopVoiceMidiLive]);

  const applyToGrooveLab = useCallback(
    (candidate: MelodyProgressionCandidate) => {
      const meta = analysisMetaRef.current;
      if (!meta) return;
      const tiled = expandProgressionToBars(candidate.chords, meta.barCount);
      const steps: GrooveProgressionStep[] = tiled.map((sym) => ({
        id: newProgressionStepId(),
        label: chordSymbolToName(sym, meta.keyRoot, meta.mode),
        beats: 4,
      }));
      const built = progressionStepsToGrooveHits(steps, {
        quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
        barCount: meta.barCount as GrooveLabBarCount,
        sustainSlots: 8,
      });
      if ('message' in built) {
        setMelodyMatchError(built.message);
        return;
      }
      const chordCh = grooveLabPickChordChannel();
      const notesByChannel: Record<number, import('@/app/lib/creationStation/grooveLabRoll').GrooveRollHit[]> =
        {};
      for (const ch of grooveLabChannelIds()) notesByChannel[ch] = [];
      notesByChannel[chordCh] = sanitizeGrooveLabChordChannelHits(
        built.chordHits,
        built.barCount,
      );
      saveGrooveLabSession(notesByChannel, built.barCount);
      setMelodyMatchError(null);
      setStatus(
        `Sent to Groove Lab · ${chordBassSeqChannelLabel(chordCh)} · ${built.barCount} bars`,
      );
      onOpenGrooveLab();
    },
    [onOpenGrooveLab],
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#030303',
        color: '#e8e8ee',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          flexShrink: 0,
          padding: '14px 18px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Sparkles size={18} color="#7cf4c6" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.4 }}>Harmony Match</div>
          <div style={{ fontSize: 10, color: '#7a7a88', marginTop: 2 }}>
            Hum or upload a melody → pick a progression → open in Groove Lab
          </div>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 18 }}>
        <div
          style={{
            maxWidth: 720,
            padding: 16,
            borderRadius: 8,
            border: '1px solid rgba(124, 244, 198, 0.2)',
            background: 'rgba(124, 244, 198, 0.06)',
          }}
        >
          <MelodyMatchPanel
            isRecording={melodyRecording}
            isBusy={melodyMatchBusy}
            error={melodyMatchError}
            candidates={melodyCandidates}
            onToggleRecord={toggleMelodyRecord}
            onUploadFile={uploadMelodyFile}
            onAnalyze={analyzeMelodyMatch}
            onApplyCandidate={applyToGrooveLab}
            voiceMidiLive={voiceMidiLive}
            voiceMidiLiveNote={voiceMidiLiveNote}
            voiceMidiCaptureCount={
              voiceMidiLive ? voiceMidiCaptureCount : melodyPitchEvents.length
            }
            onToggleVoiceMidiLive={toggleVoiceMidiLive}
          />
        </div>

        {status ? (
          <p style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: '#7cf4c6' }}>{status}</p>
        ) : null}

        <p style={{ marginTop: 16, fontSize: 10, color: '#6a6a78', lineHeight: 1.5, maxWidth: 520 }}>
          Tip: after a match, tap a numbered progression chip to load chords on the Groove Lab roll.
          Use MATCH BASS there to generate a bass line from the harmony.
        </p>
      </div>
    </div>
  );
}
