/**
 * MELODY-TO-MIDI TRANSCRIPTION ENGINE
 * 
 * Captures monophonic audio → converts to MIDI with transposition & tempo control.
 * Features: Real-time pitch visualization, quantization, export as .mid
 */

import { useState, useRef, useEffect } from 'react';

import { Mic, Upload, Play, Pause, SkipBack, RefreshCw, Download, ChevronUp, ChevronDown, AlertCircle, Check } from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';

import { WaveformVisualizer, VolumeMeter, PianoRollEditor } from '@/app/screens/melody-lab/TranscriptionVisualizer';

import {
  detectPitchACF,
  frequencyToMidiNote,
  transposeMidiNote,
  pitchEventsToMidiNotes,
  extractEnvelope,
  type PitchEvent,
  type MidiNote
} from '@/app/lib/pitchDetection';


const PPQ = 960;


interface TranscriptionState {
  isRecording: boolean;
  isProcessing: boolean;
  audioBuffer: AudioBuffer | null;
  pitchEvents: PitchEvent[];
  midiNotes: MidiNote[];
  currentPlayhead: number;
  error: string | null;
}


export default function MelodyTranscriptionScreen({ onExport, onBack }: { onExport?: (notes: MidiNote[], dest: string) => void, onBack?: () => void }) {
  const { bpm, getOrCreateAudioContext } = useMasterClock();
  
  // Recording & processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const [state, setState] = useState<TranscriptionState>({
    isRecording: false,
    isProcessing: false,
    audioBuffer: null,
    pitchEvents: [],
    midiNotes: [],
    currentPlayhead: 0,
    error: null
  });

  // Undo history
  const [midiHistory, setMidiHistory] = useState<Array<MidiNote[]>>([]);

  // Transcription options
  const [transposition, setTransposition] = useState(0);
  const [tempoScale, setTempoScale] = useState(100);
  const [quantization, setQuantization] = useState<'none' | '1/4' | '1/8' | '1/16'>('1/8');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Playback
  const playbackRef = useRef<number | null>(null);
  const [isPlayingMidi, setIsPlayingMidi] = useState(false);
  const [playheadBeat, setPlayheadBeat] = useState(0);
  const [transcriptionBpm, setTranscriptionBpm] = useState(bpm);

  // Track analyzer for visualization
  const [recordingAnalyzer, setRecordingAnalyzer] = useState<AnalyserNode | null>(null);
  const [loopLength, setLoopLength] = useState(4);

  /**
   * Start recording from microphone
   */
  async function startRecording() {
    try {
      setState(prev => ({ ...prev, error: null, isRecording: true, pitchEvents: [], midiNotes: [] }));
      
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      audioContextRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      mediaStreamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 4096;
      analyzerRef.current = analyzer;
      setRecordingAnalyzer(analyzer);

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(analyzer);
      analyzer.connect(processor);
      processor.connect(ctx.destination);

      const events: PitchEvent[] = [];
      const startTime = Date.now();

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const audioData = e.inputBuffer.getChannelData(0);
        const { frequency, confidence } = detectPitchACF(audioData, ctx.sampleRate);

        if (confidence > 0.1) {
          events.push({
            time: Date.now() - startTime,
            frequency,
            confidence,
            velocity: 100
          });
        }
      };

      setState(prev => ({ ...prev, pitchEvents: events }));
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Microphone access denied', isRecording: false }));
    }
  }

  /**
   * Stop recording
   */
  function stopRecording() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    setState(prev => ({ ...prev, isRecording: false }));
  }

  /**
   * Upload audio file
   */
  async function uploadAudioFile(file: File) {
    try {
      setState(prev => ({ ...prev, error: null, isProcessing: true }));

      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      audioContextRef.current = ctx;

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      setState(prev => ({ ...prev, audioBuffer, isProcessing: true }));

      // Process audio for pitch events
      const channelData = audioBuffer.getChannelData(0);
      const events: PitchEvent[] = [];
      const hopSize = 512; // samples between analysis frames
      const frameSize = 4096;

      for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
        const frame = channelData.slice(i, i + frameSize);
        const { frequency, confidence } = detectPitchACF(frame, audioBuffer.sampleRate);

        if (confidence > 0.1) {
          events.push({
            time: (i / audioBuffer.sampleRate) * 1000,
            frequency,
            confidence,
            velocity: 100
          });
        }
      }

      setState(prev => ({ ...prev, pitchEvents: events, isProcessing: false }));
    } catch (err) {
      setState(prev => ({ ...prev, error: 'Failed to process audio file', isProcessing: false }));
    }
  }

  /**
   * Convert pitch events to MIDI notes with current settings
   */
  function transcribeToMidi() {
    if (state.pitchEvents.length === 0) {
      setState(prev => ({ ...prev, error: 'No pitch data detected' }));
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    // Adjust tempo in pitch events
    const scaledEvents = state.pitchEvents.map(e => ({
      ...e,
      time: e.time * (100 / tempoScale)
    }));

    // Generate MIDI notes with quantization
    let notes = pitchEventsToMidiNotes(scaledEvents, bpm, confidenceThreshold, quantization);

    // Apply transposition
    notes = notes.map(n => ({
      ...n,
      pitch: transposeMidiNote(n.pitch, transposition)
    }));

    setState(prev => ({ ...prev, midiNotes: notes, isProcessing: false }));
  }

  /**
   * Play transcribed MIDI with playhead tracking
   */
  function playTranscribedMidi() {
    console.log('playTranscribedMidi called, notes:', state.midiNotes.length);
    if (state.midiNotes.length === 0) {
      console.log('No notes to play');
      return;
    }

    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    audioContextRef.current = ctx;

    console.log('Starting playback, ctx:', ctx.state, 'bpm:', transcriptionBpm, 'notes:', state.midiNotes);
    setIsPlayingMidi(true);
    setPlayheadBeat(0);

    const msPerQuarter = (60000 / transcriptionBpm);
    const totalBeats = loopLength * 4;
    const tickDuration = msPerQuarter / 4; // 16th note
    let currentTick = 0;
    const playedNotes = new Set<string>();

    const scheduler = () => {
      const currentBeat = currentTick / 4; // Convert ticks to beats
      setPlayheadBeat(currentBeat);

      // Play notes starting at current position
      state.midiNotes.forEach((note, idx) => {
        const noteStartTick = note.start / (PPQ / 4); // Convert PPQ to ticks
        const noteEndTick = noteStartTick + note.duration / (PPQ / 4);
        const noteKey = `${idx}_${note.start}`;

        // Play note if we're at its start and haven't played it yet
        if (currentTick >= noteStartTick && currentTick < noteEndTick && !playedNotes.has(noteKey)) {
          playedNotes.add(noteKey);
          
          const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
          const noteDurationMs = (note.duration / PPQ) * msPerQuarter;
          const duration = noteDurationMs / 1000;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.connect(gain);
          gain.connect(ctx.destination);

          const now = ctx.currentTime;
          const velocity = note.velocity / 127;
          gain.gain.setValueAtTime(velocity * 0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          osc.start(now);
          osc.stop(now + duration);
          
          console.log(`Playing note: pitch=${note.pitch}, freq=${freq.toFixed(2)}Hz, duration=${duration.toFixed(2)}s`);
        }
      });

      currentTick++;

      if (currentBeat >= totalBeats) {
        console.log('Playback finished');
        setIsPlayingMidi(false);
        setPlayheadBeat(0);
        return;
      }

      playbackRef.current = window.setTimeout(scheduler, tickDuration);
    };

    scheduler();
  }

  function stopTranscribedPlayback() {
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
    setIsPlayingMidi(false);
    setPlayheadBeat(0);
  }

  function rewindTranscription() {
    stopTranscribedPlayback();
    setPlayheadBeat(0);
  }

  function forwardTranscription() {
    const totalBeats = loopLength * 4;
    stopTranscribedPlayback();
    setPlayheadBeat(Math.max(0, totalBeats - 1));
  }

  function stopPlayback() {
    stopTranscribedPlayback();
  }

  function exportMidi(dest: string) {
    if (onExport) {
      onExport(state.midiNotes, dest);
      setShowExportModal(false);
    }
  }

  useEffect(() => {
    return () => {
      stopRecording();
      stopPlayback();
    };
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: '#050505', color: '#ccc' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #1a1a1a', background: '#080808' }}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1.5 rounded hover:bg-slate-800">
              <SkipBack size={18} style={{ color: '#888' }} />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ff6b3522', color: '#ff6b35' }}>
            <Mic size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold">Melody-to-MIDI Transcription</h2>
            <p className="text-xs" style={{ color: '#555' }}>
              {state.midiNotes.length > 0 ? `${state.midiNotes.length} notes · ${bpm} BPM` : 'Capture or upload audio'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {state.midiNotes.length > 0 && (
            <button onClick={() => setShowExportModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg, #ff6b35, #D500F9)', color: '#000', cursor: 'pointer' }}>
              <Download size={11} /> Export
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-0">
        {/* Section 1: Input */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ff6b35' }}>Audio Input</span>
          
          <div className="flex gap-2">
            <button onClick={state.isRecording ? stopRecording : startRecording}
              className="flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all"
              style={{ background: state.isRecording ? '#ff6b3522' : '#111', color: state.isRecording ? '#ff6b35' : '#666', border: `1px solid ${state.isRecording ? '#ff6b3544' : '#222'}`, cursor: 'pointer' }}>
              <Mic size={16} />
              {state.isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            <label className="flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer"
              style={{ background: '#111', color: '#666', border: '1px solid #222' }}>
              <Upload size={16} />
              Upload Audio
              <input type="file" accept="audio/*" onChange={e => {
                if (e.target.files?.[0]) uploadAudioFile(e.target.files[0]);
              }} style={{ display: 'none' }} />
            </label>
          </div>

          {state.error && (
            <div className="flex items-center gap-2 p-2 rounded" style={{ background: '#ff444433', color: '#ff4444' }}>
              <AlertCircle size={14} />
              <span className="text-xs">{state.error}</span>
            </div>
          )}

          {state.isProcessing && (
            <div className="flex items-center gap-2" style={{ color: '#00E5FF' }}>
              <RefreshCw size={12} className="animate-spin" />
              <span className="text-xs">Processing audio…</span>
            </div>
          )}
        </div>

        {/* Section 1b: Waveform & Level Visualizer */}
        {state.isRecording && (
          <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>Recording Monitor</span>
            <div className="flex gap-4">
              <div className="flex-1">
                <WaveformVisualizer analyzerNode={recordingAnalyzer} isRecording={state.isRecording} />
              </div>
              <div>
                <VolumeMeter analyzerNode={recordingAnalyzer} isRecording={state.isRecording} />
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Transcription Controls */}
        {state.pitchEvents.length > 0 && (
          <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>Transcription Options</span>

            {/* Transposition */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Transposition</label>
                <span className="text-xs px-2 py-1 rounded" style={{ background: '#a78bfa22', color: '#a78bfa' }}>
                  {transposition > 0 ? '+' : ''}{transposition} semitones
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTransposition(Math.max(-12, transposition - 1))} className="p-1.5"
                  style={{ color: '#a78bfa' }}>
                  <ChevronDown size={20} />
                </button>
                <input type="range" min="-12" max="12" value={transposition} onChange={e => setTransposition(Number(e.target.value))}
                  className="flex-1" style={{ accentColor: '#a78bfa' }} />
                <button onClick={() => setTransposition(Math.min(12, transposition + 1))} className="p-1.5"
                  style={{ color: '#a78bfa' }}>
                  <ChevronUp size={20} />
                </button>
              </div>
            </div>

            {/* Tempo Scale */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: '#00ff88' }}>Tempo Scale</label>
                <span className="text-xs px-2 py-1 rounded" style={{ background: '#00ff8822', color: '#00ff88' }}>
                  {tempoScale}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTempoScale(Math.max(50, tempoScale - 5))} className="p-1.5"
                  style={{ color: '#00ff88' }}>
                  <ChevronDown size={20} />
                </button>
                <input type="range" min="50" max="200" step="5" value={tempoScale} onChange={e => setTempoScale(Number(e.target.value))}
                  className="flex-1" style={{ accentColor: '#00ff88' }} />
                <button onClick={() => setTempoScale(Math.min(200, tempoScale + 5))} className="p-1.5"
                  style={{ color: '#00ff88' }}>
                  <ChevronUp size={20} />
                </button>
              </div>
            </div>

            {/* Quantization */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold" style={{ color: '#ffcc00' }}>Quantize To Grid</label>
              <div className="flex gap-2">
                {['none', '1/4', '1/8', '1/16'].map(q => (
                  <button key={q} onClick={() => setQuantization(q as any)}
                    className="flex-1 py-1.5 rounded text-xs font-semibold"
                    style={{ background: quantization === q ? '#ffcc0022' : '#111', color: quantization === q ? '#ffcc00' : '#666', border: `1px solid ${quantization === q ? '#ffcc0044' : '#222'}`, cursor: 'pointer' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence Threshold */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: '#60a5fa' }}>Confidence Threshold</label>
                <span className="text-xs px-2 py-1 rounded" style={{ background: '#60a5fa22', color: '#60a5fa' }}>
                  {confidenceThreshold.toFixed(2)}
                </span>
              </div>
              <input type="range" min="0.1" max="1" step="0.1" value={confidenceThreshold} onChange={e => setConfidenceThreshold(Number(e.target.value))}
                className="w-full" style={{ accentColor: '#60a5fa' }} />
            </div>

            <button onClick={transcribeToMidi} className="py-3 rounded-lg font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg, #ff6b35, #ffcc00)', color: '#000', cursor: 'pointer' }}>
              <RefreshCw size={14} className="inline mr-2" />
              Transcribe to MIDI
            </button>
          </div>
        )}

        {/* Section 2b: Loop Length */}
        {state.pitchEvents.length > 0 && (
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ffcc00' }}>Pattern Length</span>
            <div className="flex gap-2">
              {[1, 2, 4, 8, 16].map(len => (
                <button key={len} onClick={() => setLoopLength(len)}
                  className="flex-1 py-1.5 rounded text-xs font-semibold"
                  style={{ background: loopLength === len ? '#ffcc0022' : '#111', color: loopLength === len ? '#ffcc00' : '#666', border: `1px solid ${loopLength === len ? '#ffcc0044' : '#222'}`, cursor: 'pointer' }}>
                  {len}B
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Piano Roll Editor */}
        {state.pitchEvents.length > 0 && (
          <div className="flex flex-col gap-2" style={{ marginTop: 12 }}>
            <div className="rounded-xl p-4 pb-2" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
                Piano Roll - Detected Pitch Notes + Manual Editing
              </span>
              <p className="text-10px mt-2" style={{ color: '#666' }}>
                Click to add notes • Click on notes to delete • Ctrl+Scroll to zoom • Scroll to pan
              </p>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', height: 650 }}>
              <PianoRollEditor
                midiNotes={state.midiNotes}
                onNotesChange={(notes) => {
                  setMidiHistory(prev => [...prev, state.midiNotes]);
                  setState(prev => ({ ...prev, midiNotes: notes }));
                }}
                bpm={transcriptionBpm}
                loopLength={loopLength}
                pitchEvents={state.pitchEvents}
                onBpmChange={(newBpm) => setTranscriptionBpm(newBpm)}
                isPlaying={isPlayingMidi}
                onPlayStop={() => isPlayingMidi ? stopTranscribedPlayback() : playTranscribedMidi()}
                playheadPosition={playheadBeat}
                onUndo={() => {
                  if (midiHistory.length > 0) {
                    const newHistory = [...midiHistory];
                    const previousNotes = newHistory.pop();
                    setMidiHistory(newHistory);
                    setState(prev => ({ ...prev, midiNotes: previousNotes || [] }));
                    console.log('Undo performed');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Section 4: Playback & Export */}
        {state.midiNotes.length > 0 && (
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>
                Playback & Export ({state.midiNotes.length} notes)
              </span>
              <button onClick={() => isPlayingMidi ? stopTranscribedPlayback() : playTranscribedMidi()}
                className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style={{ background: isPlayingMidi ? '#ff6b3522' : '#111', color: isPlayingMidi ? '#ff6b35' : '#666', border: `1px solid ${isPlayingMidi ? '#ff6b3544' : '#222'}`, cursor: 'pointer' }}>
                {isPlayingMidi ? <>⏸ Stop</> : <>▶ Play</>}
              </button>
            </div>

            {/* Notes Summary Table */}
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 4, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
              <div className="sticky top-0 grid gap-0" style={{ gridTemplateColumns: '30px 50px 60px 80px 60px', background: '#0a0a0a', borderBottom: '1px solid #222', padding: 6 }}>
                <span className="text-10px font-bold" style={{ color: '#666' }}>#</span>
                <span className="text-10px font-bold" style={{ color: '#666' }}>Pitch</span>
                <span className="text-10px font-bold" style={{ color: '#666' }}>Start</span>
                <span className="text-10px font-bold" style={{ color: '#666' }}>Duration</span>
                <span className="text-10px font-bold" style={{ color: '#666' }}>Vel</span>
              </div>
              {state.midiNotes.map((note, idx) => {
                const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][note.pitch % 12];
                const octave = Math.floor(note.pitch / 12) - 1;
                const beatStart = (note.start / PPQ).toFixed(2);
                const durationBeats = (note.duration / PPQ).toFixed(2);
                return (
                  <div key={idx} className="grid gap-0 border-b py-2 px-6 text-10px"
                    style={{ gridTemplateColumns: '30px 50px 60px 80px 60px', borderColor: '#1a1a1a', color: idx % 2 === 0 ? '#00ff88' : '#ff6b35' }}>
                    <span>{idx + 1}</span>
                    <span style={{ fontWeight: 'bold' }}>{noteName}{octave}</span>
                    <span style={{ color: '#888' }}>{beatStart}b</span>
                    <span style={{ color: '#888' }}>{durationBeats}b</span>
                    <span style={{ color: '#888' }}>{note.velocity}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {state.pitchEvents.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: '#333' }}>
            <Mic size={32} style={{ color: '#1a1a1a' }} />
            <p className="text-sm">Record or upload audio to begin</p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="rounded-xl p-6 max-w-md w-full" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#fff' }}>Export Transcription</h3>
            
            <div className="mb-4 p-3 rounded" style={{ background: '#111', border: '1px solid #222' }}>
              <p className="text-xs mb-2" style={{ color: '#888' }}>
                <strong>{state.midiNotes.length} MIDI Notes</strong>
              </p>
              <p className="text-10px" style={{ color: '#666' }}>
                Transposition: {transposition > 0 ? '+' : ''}{transposition} semitones<br/>
                Tempo: {tempoScale}%<br/>
                Quantization: {quantization}
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowExportModal(false)} className="flex-1 py-2 rounded text-xs font-bold" 
                style={{ background: '#111', color: '#666', border: '1px solid #222', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => exportMidi('creation-station')} className="flex-1 py-2 rounded text-xs font-bold" 
                style={{ background: '#D500F922', color: '#D500F9', border: '1px solid #D500F944', cursor: 'pointer' }}>
                Creation Station
              </button>
              <button onClick={() => exportMidi('studio-editor')} className="flex-1 py-2 rounded text-xs font-bold" 
                style={{ background: '#00E5FF22', color: '#00E5FF', border: '1px solid #00E5FF44', cursor: 'pointer' }}>
                Studio Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
