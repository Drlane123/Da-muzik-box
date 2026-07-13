// AI Pattern Generator — session lanes CH18+ (expandable), tempo synced to Master Clock for Studio

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';

import { Cpu, RefreshCw, Sparkles, Send, AlertCircle, Info, Check, Download, Play, Pause, SkipBack, SkipForward, FastForward, Rewind, ChevronUp, ChevronDown, Plus, X } from 'lucide-react';

import { renderAiPatternToWav, scheduleAiPatternHit, getAiPatternSampleBankKey } from '@/app/lib/aiPatternRender';
import { ensureBankLoaded, getBankLoadStatus } from '@/app/lib/aiPatternSampleBank';

import { useMasterClock } from '@/app/context/MasterClockContext';
import TransportPulseWorker from '../workers/transportPulse.worker?worker';

import { generateDrumPattern, generateMelodyPattern, generateRandomPattern, generateArpeggioPattern } from '@/app/lib/magentaPatternGenerator';
import { filterPresets, instrumentToPresetRole, PRESET_GENRES } from '@/app/lib/patternPresets';
import type { PatternPreset } from '@/app/lib/patternPresets';
import { prefetchMagentaPatternModels } from '@/app/lib/magentaRnnPatterns';

import {
  AI_PATTERN_SESSION_BASE,
  AI_PATTERN_TRACK_COUNT,
  computeAiPatternSessionMeta,
  getAiPatternLaneCountEffective,
  readAiPatternSessionManifestFromStorage,
  writeAiPatternSessionManifestToStorage,
  DA_SESSION_TRACKS_SYNC_EVENT,
} from '@/app/lib/sessionChannelTracks';

import { AI_PATTERN_CLIP_DATA_KEY, readAiPatternClipPayloadFromStorage } from '@/app/lib/sessionClipContent';


const INSTRUMENTS = ['Drums','Piano','Bass','Lead Synth','Pads','Brass','Strings','Percussion','Pluck Guitar','Muted Guitar'];

const STYLES = ['Trap','Boom Bap','Lo-Fi','House','Techno','Jazz','Soul','Cinematic','Arpeggio','Dark','Disco','Southern Soul','Country','R&B','Blues','Doo Wap'];

/** Available pattern lengths in bars. Each bar = 16 sixteenth-note
 *  steps. At 120 BPM: 1 bar = 2 s, 2 bars = 4 s, 4 bars = 8 s. */
const LOOP_LENGTHS = [1, 2, 4, 8];

/** Sixteenth-note steps per bar. The step grid uses 1/16 resolution so
 *  drum patterns, basslines, and melodies all play at the correct speed.
 *  At 120 BPM each step = 60/120/4 = 0.125 s. */
const STEPS_PER_BAR = 16;

const TOTAL_STEPS = 16;
/** Same class as Creation Station lookahead — worker wakes main; times are AudioContext seconds. */
const AI_LOCAL_SCHEDULER_PULSE_MS = 8;
const AI_LOCAL_SCHEDULE_AHEAD_SEC = 0.16;

/** Magenta RNN can be slow on first load; abort UI lock and fall back after this. */
const MAGENTA_GENERATION_TIMEOUT_MS = 120_000;

const DRUM_ROW_NAMES  = ['Kick','Snare','Clap','Hi-Hat','Open HH','Tom Hi','Tom Lo','Rim'];
const MELODY_ROW_NAMES = ['Root','2nd','3rd','4th','5th','6th','7th','Oct'];
const BASS_ROW_NAMES   = ['Root','2nd','b3/3','4th','5th','b6/6','b7/7','Oct'];

/** Row labels shown in the step-grid sidebar. For bass/melody, shows
 *  the scale degree so the user knows which pitch each row plays.
 *  For drums, shows the hit type (Kick, Snare, etc.). */
function getRowNames(instrument: string): string[] {
  const i = instrument.toLowerCase();
  if (i.includes('drum') || i.includes('percussion')) return DRUM_ROW_NAMES;
  if (i.includes('bass')) return BASS_ROW_NAMES;
  return MELODY_ROW_NAMES;
}

const NOTE_COLORS = ['#D500F9','#00E5FF','#ff6b35','#00ff88','#ffcc00','#a78bfa','#f472b6','#60a5fa'];


interface PatternVersion {
  id: string;
  pattern: boolean[][];
  timestamp: number;
  temperature: number;
}


interface TrackState {
  name: string;
  versions: PatternVersion[];
  selectedVersionId: string | null;
  generating: boolean;
  selected: boolean; // For export selection
  volume: number; // 0-100
  sequenceMode: 'steps' | 'bars'; // steps for drums, bars for strings/bass
}


const TRACK_NAMES = ['Track 1 (Drums)', 'Track 2 (Bass)', 'Track 3 (Lead)', 'Track 4 (Pad)', 'Track 5 (Guitar)', 'Track 6 (Strings)', 'Track 7 (Keys)', 'Track 8 (FX)'];

/** Max lanes so UI + session manifest stay bounded (sessionChannelTracks supports growth beyond default). */
const MAX_AI_PATTERN_LANES = 32;

function defaultNameForLane(idx: number): string {
  return idx < TRACK_NAMES.length ? TRACK_NAMES[idx] : `Track ${idx + 1}`;
}

/** Restore lane count + display names from session manifest / clip payload (survives navigation + reload). */
function buildInitialAiPatternTracksState(): TrackState[] {
  let laneCount = AI_PATTERN_TRACK_COUNT;
  try {
    const payload = readAiPatternClipPayloadFromStorage();
    if (payload?.tracks?.length) {
      laneCount = Math.max(laneCount, payload.tracks.length);
      const maxIdx = payload.tracks.reduce((m, x) => Math.max(m, x.idx), -1);
      if (maxIdx >= 0) laneCount = Math.max(laneCount, maxIdx + 1);
    }
    laneCount = Math.max(laneCount, getAiPatternLaneCountEffective());
  } catch {
    /* private mode / parse error */
  }
  laneCount = Math.min(MAX_AI_PATTERN_LANES, Math.max(TRACK_NAMES.length, laneCount));

  const manifest = readAiPatternSessionManifestFromStorage();

  return Array.from({ length: laneCount }, (_, i) => {
    const slot = AI_PATTERN_SESSION_BASE + i;
    const meta = manifest.get(slot);
    const fromManifest = meta?.name?.replace(/^AI:\s*/i, '').trim();
    const name =
      fromManifest && fromManifest.length > 0 ? fromManifest : defaultNameForLane(i);
    return {
      name,
      versions: [],
      selectedVersionId: null,
      generating: false,
      selected: false,
      volume: 75,
      sequenceMode: 'steps' as const,
    };
  });
}

export default function AiPatternScreen({
  onExport,
  onBack,
  isScreenActive = true,
  embedded = false,
  onExportToPad,
}: {
  onExport: (dest: string) => void;
  onBack?: () => void;
  isScreenActive?: boolean;
  /** When true the screen is being mounted inside Creation Station as a
   *  tab (vs. being navigated to as a standalone module). Hides the
   *  standalone-only chrome and unlocks the "→ PAD" export button. */
  embedded?: boolean;
  /** Set by Creation Station when this screen is embedded as a tab.
   *  Receives a complete RIFF/WAVE byte buffer the parent persists as a
   *  Beat Lab sampler-pad sample (same surface as Chord Builder's
   *  export-to-pad). Hidden in the standalone module. */
  onExportToPad?: (args: {
    padIndex: number;
    wavBytes: Uint8Array;
    label: string;
    rootBpm: number;
  }) => void;
}) {
  const {
    bpm,
    getOrCreateAudioContext,
    transport,
    stop,
  } = useMasterClock();

  // Independent AI transport clock (AudioContext-anchored, master-style math).
  const [patternPlaying, setPatternPlaying] = useState(false);
  const [patternTempo, setPatternTempo] = useState(bpm);
  const [patternPosition, setPatternPosition] = useState(0);
  const patternStepRef = useRef(0);
  
  const [tracks, setTracks] = useState<TrackState[]>(buildInitialAiPatternTracksState);

  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [instrument, setInstrument] = useState('Drums');
  const [style, setStyle] = useState('Trap');
  const [description, setDescription] = useState('');
  const [loopLength, setLoopLength] = useState(2); // default 2 bars = 32 steps
  const [temperature, setTemperature] = useState(1.0);
  const [variation, setVariation] = useState('balanced');
  const [generationTempo, setGenerationTempo] = useState(bpm);
  const [displayTempo, setDisplayTempo] = useState(bpm);
  /** Song key — C…B as a 12-note index. Drives bass + melody pitch
   *  picks via `rowToMidi`. Default C minor (hip-hop / trap default). */
  const [songKey, setSongKey] = useState<number>(0);
  /** Song mode — 'minor' or 'major'. Bass + melody use this to choose
   *  the right scale intervals (b3/b6/b7 in minor, 3/6/7 in major). */
  const [songMode, setSongMode] = useState<'major' | 'minor'>('minor');
  /** When true, generating a bass or melody track uses the FIRST
   *  drum-loaded track's kick pattern as the rhythmic anchor — so the
   *  bass hits on every kick. When false, generation is independent. */
  const [lockToDrums, setLockToDrums] = useState(true);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  /** Whether the Presets browser panel is open. */
  const [presetsOpen, setPresetsOpen] = useState(false);
  /** Genre filter inside the presets browser. */
  const [presetGenreFilter, setPresetGenreFilter] = useState<string>('All');
  /** "→ PAD" pad-picker state — only used when `embedded && onExportToPad`. */
  const [padPickerOpen, setPadPickerOpen] = useState(false);
  /** Busy flag during the offline WAV bounce so we can disable the button. */
  const [padExportBusy, setPadExportBusy] = useState(false);
  /** Transient status string under the pad picker (success / error toast). */
  const [padExportStatus, setPadExportStatus] = useState<string | null>(null);
  const padExportStatusTimerRef = useRef<number | null>(null);

  // Shared DAW session: contiguous lanes from CH18 + pattern payload → Studio clips (same `audioTrack` as mixer).
  useEffect(() => {
    const meta = computeAiPatternSessionMeta(tracks);
    writeAiPatternSessionManifestToStorage(meta);
    const totalSteps = loopLength * STEPS_PER_BAR;
    const payload = {
      bpm: patternTempo,
      loopLength,
      totalSteps,
      tracks: tracks.map((t, idx) => ({
        idx,
        pattern: t.selectedVersionId
          ? t.versions.find((v) => v.id === t.selectedVersionId)?.pattern ?? null
          : null,
      })),
    };
    try {
      localStorage.setItem(AI_PATTERN_CLIP_DATA_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(DA_SESSION_TRACKS_SYNC_EVENT));
  }, [tracks, patternTempo, loopLength]);

  /** Warm Magenta checkpoints in background so first Generate is usually inference-only. */
  useEffect(() => {
    void prefetchMagentaPatternModels();
  }, []);

  const generateSessionRef = useRef(0);

  const currentTrack = tracks[currentTrackIdx];
  const selectedPattern = currentTrack.selectedVersionId ? currentTrack.versions.find(v => v.id === currentTrack.selectedVersionId)?.pattern : undefined;

  const activeBeat = patternPosition % (loopLength * STEPS_PER_BAR);

  const patternRef = useRef<boolean[][]>([]);
  /** Phase at play / after FF&RW: step = (localStartStepRef + quarterIndex) % totalSteps */
  const localStartStepRef = useRef(0);
  /** Audio time of quarter index 0 (first scheduled boundary). */
  const aiGridOriginAudioRef = useRef(0);
  /** Next quarter index to schedule (0,1,2,… never decrements → no double-fire). */
  const aiNextQuarterIndexRef = useRef(0);
  const localClockRunIdRef = useRef(0);
  const localTempoRef = useRef(patternTempo);
  const aiTempoForRealignRef = useRef(patternTempo);
  /** Last step written to React; clamped +1 max per worker pulse (same idea as MasterClock beat UI). */
  const patternUiShownStepRef = useRef(0);

  useEffect(() => { 
    patternRef.current = selectedPattern || []; 
  }, [selectedPattern]);

  /** Live preview reads the instrument via ref so changing the dropdown
   *  (Piano → Bass → Pad …) doesn't restart the schedule loop. The next
   *  scheduled hit will fire on the new voice immediately. */
  const instrumentRef = useRef(instrument);
  useEffect(() => { instrumentRef.current = instrument; }, [instrument]);
  /** Same trick for the song key + mode. Changing the Key/Mode dropdown
   *  mid-playback shifts the next note to the new key without restarting
   *  the scheduler — feels instant to the user. */
  const songKeyRef = useRef(songKey);
  useEffect(() => { songKeyRef.current = songKey; }, [songKey]);
  const songModeRef = useRef(songMode);
  useEffect(() => { songModeRef.current = songMode; }, [songMode]);

  /** Real-sample bank load status — drives the "Loading sounds…" badge
   *  next to the instrument dropdown. `idle` / `loading` / `ready` /
   *  `failed`. Polled briefly while a load is in flight so the UI can
   *  flip to "Ready" without a full state-machine. */
  const [sampleBankStatus, setSampleBankStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  /** Whenever the user switches instruments, kick off the sample-bank
   *  preload for that voice. Fetches happen in the background — the
   *  live preview falls back to synth voices until samples are decoded,
   *  then automatically upgrades on the next hit. */
  useEffect(() => {
    if (!isScreenActive) return;
    const key = getAiPatternSampleBankKey(instrument);
    if (!key) {
      setSampleBankStatus('idle');
      return;
    }
    const status = getBankLoadStatus(key);
    if (status === 'ready' || status === 'failed') {
      setSampleBankStatus(status);
      return;
    }
    const ctx = getOrCreateAudioContext();
    const bank = ensureBankLoaded(key, ctx);
    setSampleBankStatus('loading');
    let cancelled = false;
    bank.readyPromise.then(() => {
      if (cancelled) return;
      setSampleBankStatus(getBankLoadStatus(key));
    });
    return () => { cancelled = true; };
  }, [instrument, isScreenActive, getOrCreateAudioContext]);

  localTempoRef.current = patternTempo;

  const stopPatternStateOnly = useCallback(() => {
    localClockRunIdRef.current += 1;
    setPatternPlaying(false);
    patternStepRef.current = 0;
    localStartStepRef.current = 0;
    aiGridOriginAudioRef.current = 0;
    aiNextQuarterIndexRef.current = 0;
    aiTempoForRealignRef.current = patternTempo;
    patternUiShownStepRef.current = 0;
    setPatternPosition(0);
  }, [patternTempo]);

  /** Preserve grid origin when BPM changes mid-playback (ladder math). */
  useEffect(() => {
    if (!isScreenActive || !patternPlaying) return;
    const oldBpm = Math.max(1, aiTempoForRealignRef.current);
    const newBpm = Math.max(1, patternTempo);
    if (oldBpm === newBpm) return;
    // Each step = 1/16th note, so secPerStep = 60/bpm/4
    const oldSec = 60 / oldBpm / 4;
    const newSec = 60 / newBpm / 4;
    const idx = aiNextQuarterIndexRef.current;
    aiGridOriginAudioRef.current += idx * (oldSec - newSec);
    aiTempoForRealignRef.current = patternTempo;
  }, [patternTempo, patternPlaying]);

  /**
   * Lookahead sequencer — 16th-note step grid.
   * Each step = 1/16th note: secPerStep = 60/bpm/4.
   * At 120 BPM: 0.125 s/step → 16-step loop = 2 s = 1 bar. ✓
   */
  useEffect(() => {
    if (!isScreenActive || !patternPlaying) return;
    const totalSteps = Math.max(1, loopLength * STEPS_PER_BAR);
    const runId = ++localClockRunIdRef.current;

    const scheduleLoop = () => {
      if (localClockRunIdRef.current !== runId) return;
      const ctx = getOrCreateAudioContext();
      const now = ctx.currentTime;
      // 16th-note step duration: 60/bpm/4
      const secPerStep = 60 / Math.max(1, localTempoRef.current) / 4;
      const horizon = now + AI_LOCAL_SCHEDULE_AHEAD_SEC;
      const pat = patternRef.current;
      const origin = aiGridOriginAudioRef.current;
      let idx = aiNextQuarterIndexRef.current;

      while (origin + idx * secPerStep < horizon) {
        const t = origin + idx * secPerStep;
        const step =
          (localStartStepRef.current + idx) % totalSteps;
        if (pat.length > 0) {
          const whenSafe = Math.max(t, now + 0.0015);
          const inst = instrumentRef.current;
          // Fire all active rows at this step. Each row's voice is
          // dispatched by scheduleAiPatternHit → kick, snare, hat, or
          // the scale-degree pitch for melody/bass.
          const isDrumInst = inst.toLowerCase().includes('drum') ||
                            inst.toLowerCase().includes('percussion');
          for (let r = 0; r < pat.length; r++) {
            if (!pat[r]?.[step]) continue;
            // Drums: very short (0.04 s) so each hit stays crisp and punchy.
            // Melody/bass: 1 full step + overlap (2 steps) so notes sustain
            // naturally into the next hit for a legato, musical feel.
            const sustainSec = isDrumInst ? 0.04 : secPerStep * 2;
            scheduleAiPatternHit({
              ctx,
              destination: ctx.destination,
              instrument: inst,
              row: r,
              startTime: whenSafe,
              sustainSec,
              keyRoot: songKeyRef.current,
              mode: songModeRef.current,
            });
          }
        }
        idx += 1;
        aiNextQuarterIndexRef.current = idx;
      }

      const qNow = Math.max(0, Math.floor((now - origin) / secPerStep + 1e-9));
      const transportStep = (localStartStepRef.current + qNow) % totalSteps;
      patternStepRef.current = transportStep;

      const raw = transportStep;
      const prev = patternUiShownStepRef.current;
      const forward = (raw - prev + totalSteps) % totalSteps;
      const backward = (prev - raw + totalSteps) % totalSteps;
      let next = raw;
      if (forward !== 0) {
        if (forward <= backward) {
          next = forward > 1 ? (prev + 1) % totalSteps : raw;
        } else {
          next = backward > 1 ? (prev - 1 + totalSteps) % totalSteps : raw;
        }
      }
      if (next !== prev) {
        patternUiShownStepRef.current = next;
        flushSync(() => setPatternPosition(next));
      }
    };
    const PulseCtor = TransportPulseWorker as unknown as { new (): Worker };
    const pulseWorker = new PulseCtor();
    pulseWorker.postMessage({ cmd: 'start', intervalMs: AI_LOCAL_SCHEDULER_PULSE_MS });
    pulseWorker.onmessage = () => {
      if (localClockRunIdRef.current !== runId) return;
      scheduleLoop();
    };
    scheduleLoop();
    return () => {
      localClockRunIdRef.current += 1;
      pulseWorker.postMessage({ cmd: 'stop' });
      pulseWorker.terminate();
    };
  }, [
    isScreenActive,
    patternPlaying,
    loopLength,
    currentTrackIdx,
    getOrCreateAudioContext,
  ]);

  const stopPattern = useCallback(() => {
    stopPatternStateOnly();
  }, [stopPatternStateOnly]);

  useEffect(() => {
    if (isScreenActive) return;
    stopPatternStateOnly();
  }, [isScreenActive, stopPatternStateOnly]);

  /** Load a pre-built pattern preset into the current track. Follows
   *  the same version-history path as `generatePattern` so the user
   *  can still swap back via the "v1 / v2 / v3" version buttons. */
  function loadPreset(preset: PatternPreset) {
    const trackIdx = currentTrackIdx;
    // Extend to the current loop length by tiling
    const baseLen = preset.pattern[0]?.length ?? 16;
    const targetSteps = loopLength * STEPS_PER_BAR;
    const tiledPattern = preset.pattern.map((row) => {
      const out: boolean[] = [];
      for (let i = 0; i < targetSteps; i++) out[i] = row[i % baseLen] ?? false;
      return out;
    });
    const newVersion = {
      id: `preset-${Date.now()}`,
      pattern: tiledPattern,
      timestamp: Date.now(),
      temperature: 1.0,
    };
    setTracks((prev) => {
      const updated = [...prev];
      updated[trackIdx] = {
        ...updated[trackIdx]!,
        versions: [newVersion, ...updated[trackIdx]!.versions].slice(0, 3),
        selectedVersionId: newVersion.id,
      };
      return updated;
    });
    setPresetsOpen(false);
  }

  async function generatePattern() {
    const session = ++generateSessionRef.current;
    const trackIdx = currentTrackIdx;
    
    setTracks(prev => {
      const updated = [...prev];
      updated[trackIdx].generating = true;
      return updated;
    });
    setModelError(null);
    setModelLoading(true);

    const timeoutId = setTimeout(() => {
      if (generateSessionRef.current !== session) return;
      console.warn('Generation timeout - using fallback pattern');
      setTracks(prev => {
        const updated = [...prev];
        updated[trackIdx].generating = false;
        return updated;
      });
      setModelLoading(false);
      setModelError('Generation took too long — try again or check your connection');
    }, MAGENTA_GENERATION_TIMEOUT_MS);

    try {
      let newPattern: boolean[][] = [];
      const steps = loopLength * STEPS_PER_BAR;
      
      // Set the tempo for this generation (AI pattern local tempo only)
      setPatternTempo(generationTempo);
      setDisplayTempo(generationTempo);
      
      if (style === 'Arpeggio') {
        newPattern = generateArpeggioPattern(variation);
      } else if (instrument === 'Drums') {
        newPattern = await generateDrumPattern(style, temperature);
      } else {
        // "Lock to drums" — find a drum-loaded track (excluding the
        // current one) to feed the bass / melody generator. Bass uses
        // it to lock every note to a kick hit; other instruments
        // currently ignore it but plumbed here for future use.
        const drumPatternForLock: boolean[][] | null = (() => {
          if (!lockToDrums) return null;
          for (let i = 0; i < tracks.length; i++) {
            if (i === trackIdx) continue;
            const t = tracks[i];
            if (!t || !t.selectedVersionId) continue;
            const v = t.versions.find((vv) => vv.id === t.selectedVersionId);
            const p = v?.pattern;
            if (p && p.length > 0 && p[0]?.some((b) => b)) return p;
          }
          return null;
        })();
        newPattern = await generateMelodyPattern(
          instrument,
          style,
          temperature,
          undefined,
          drumPatternForLock,
        );
      }

      if (generateSessionRef.current !== session) {
        clearTimeout(timeoutId);
        return;
      }
      clearTimeout(timeoutId);

      if (!newPattern || newPattern.length === 0) {
        newPattern = generateRandomPattern();
      }

      const basePatternLength = newPattern[0]?.length || 16;
      if (steps !== basePatternLength) {
        newPattern = newPattern.map(row => {
          const newRow: boolean[] = [];
          for (let i = 0; i < steps; i++) {
            newRow[i] = row[i % basePatternLength] || false;
          }
          return newRow;
        });
      }

      const newVersion: PatternVersion = {
        id: Date.now().toString(),
        pattern: newPattern,
        timestamp: Date.now(),
        temperature,
      };

      setTracks(prev => {
        const updated = [...prev];
        updated[trackIdx].versions = [newVersion, ...updated[trackIdx].versions].slice(0, 3);
        updated[trackIdx].selectedVersionId = newVersion.id;
        updated[trackIdx].generating = false;
        return updated;
      });
      
      setModelLoading(false);
      setModelError(null);
    } catch (error) {
      clearTimeout(timeoutId);
      if (generateSessionRef.current !== session) return;
      console.error('Generation error:', error);
      setModelError('Using fallback pattern');
      
      const fallbackPattern = generateRandomPattern();
      const steps = loopLength * STEPS_PER_BAR;
      const baseLength = fallbackPattern[0]?.length || 16;
      
      const adjustedPattern = fallbackPattern.map(row => {
        const newRow: boolean[] = [];
        for (let i = 0; i < steps; i++) {
          newRow[i] = row[i % baseLength] || false;
        }
        return newRow;
      });

      const newVersion: PatternVersion = {
        id: Date.now().toString(),
        pattern: adjustedPattern,
        timestamp: Date.now(),
        temperature,
      };

      setTracks(prev => {
        const updated = [...prev];
        updated[trackIdx].versions = [newVersion, ...updated[trackIdx].versions].slice(0, 3);
        updated[trackIdx].selectedVersionId = newVersion.id;
        updated[trackIdx].generating = false;
        return updated;
      });
      
      setModelLoading(false);
    }
  }

  function updateTrackSelection(idx: number, selected: boolean) {
    setTracks(prev => {
      const updated = [...prev];
      updated[idx].selected = selected;
      return updated;
    });
  }

  const selectedTracksForExport = tracks.filter(t => t.selected && t.selectedVersionId);

  // ── Export currently-focused track to a Beat Lab sampler pad ──────────
  // Only used when this screen is embedded in Creation Station. The flow:
  //   1. Render the focused track's selected pattern + style into a
  //      mono 16-bit WAV via `renderAiPatternToWav`.
  //   2. Hand the bytes to the parent (`onExportToPad` — same surface
  //      Chord Builder uses), which decodes them into the pad sample
  //      buffer map and updates pad label / rootBPM / presence state.
  //   3. Surface a brief success-or-error toast under the picker.
  const exportFocusedTrackToPad = useCallback(
    async (padIndex: number) => {
      if (!onExportToPad) return;
      if (padExportBusy) return;
      if (padIndex < 0 || padIndex > 15) return;
      const track = tracks[currentTrackIdx];
      const version = track?.selectedVersionId
        ? track.versions.find((v) => v.id === track.selectedVersionId)
        : null;
      const pattern = version?.pattern;
      if (!track || !pattern || pattern.length === 0) {
        setPadExportStatus('No pattern on this track — generate one first.');
        return;
      }
      setPadExportBusy(true);
      setPadExportStatus(null);
      try {
        const { wavBytes } = await renderAiPatternToWav({
          pattern,
          loopLength,
          stepsPerBar: STEPS_PER_BAR, // 16 steps per bar (16th notes)
          instrument,
          bpm: patternTempo,
          // Pass the live AudioContext so the renderer can fetch +
          // decode real samples before the offline bounce runs (Safari
          // can't decode in an OfflineAudioContext reliably).
          audioContext: getOrCreateAudioContext(),
          // Honor the user-selected song key + mode so the bounced WAV
          // is in the same key as what they hear during preview.
          keyRoot: songKey,
          mode: songMode,
        });
        const label = `${instrument} · ${style}`;
        onExportToPad({ padIndex, wavBytes, label, rootBpm: patternTempo });
        setPadPickerOpen(false);
        setPadExportStatus(`✓ Pad ${padIndex + 1} ← ${label}`);
      } catch (err) {
        setPadExportStatus(
          err instanceof Error ? err.message : 'Export failed — try regenerating the pattern.',
        );
      } finally {
        setPadExportBusy(false);
        if (padExportStatusTimerRef.current != null) {
          window.clearTimeout(padExportStatusTimerRef.current);
        }
        padExportStatusTimerRef.current = window.setTimeout(() => {
          setPadExportStatus(null);
          padExportStatusTimerRef.current = null;
        }, 3000);
      }
    },
    [onExportToPad, padExportBusy, tracks, currentTrackIdx, loopLength, instrument, patternTempo, style, getOrCreateAudioContext, songKey, songMode],
  );

  // Clean up the toast timer on unmount so we don't leak setState calls
  // into a tree that no longer exists.
  useEffect(() => {
    return () => {
      if (padExportStatusTimerRef.current != null) {
        window.clearTimeout(padExportStatusTimerRef.current);
        padExportStatusTimerRef.current = null;
      }
    };
  }, []);

  function addPatternLane() {
    setTracks((prev) => {
      if (prev.length >= MAX_AI_PATTERN_LANES) return prev;
      const idx = prev.length;
      return [
        ...prev,
        {
          name: defaultNameForLane(idx),
          versions: [],
          selectedVersionId: null,
          generating: false,
          selected: false,
          volume: 75,
          sequenceMode: 'steps' as const,
        },
      ];
    });
  }

  function playPattern() {
    if (patternPlaying) return;
    if (transport === 'playing' || transport === 'recording') {
      void stop();
    }
    const totalSteps = Math.max(1, loopLength * STEPS_PER_BAR);
    const startStep = Math.max(0, patternStepRef.current % totalSteps);
    const ctx = getOrCreateAudioContext();
    const now = ctx.currentTime;
    localStartStepRef.current = startStep;
    patternUiShownStepRef.current = startStep;
    aiGridOriginAudioRef.current = now + 0.0015;
    aiNextQuarterIndexRef.current = 0;
    aiTempoForRealignRef.current = patternTempo;
    setPatternPosition(startStep);
    setPatternPlaying(true);
  }

  /** Prevent dual clocks on shared CH18+ lanes while AI local playback is active. */
  useEffect(() => {
    if (!isScreenActive || !patternPlaying) return;
    if (transport === 'playing' || transport === 'recording') {
      void stop();
    }
  }, [patternPlaying, transport, stop]);

  function fastForwardPattern() {
    const newStep = Math.min(patternStepRef.current + 1, (loopLength * STEPS_PER_BAR) - 1);
    patternStepRef.current = newStep;
    if (patternPlaying) {
      const ctx = getOrCreateAudioContext();
      const now = ctx.currentTime;
      localStartStepRef.current = newStep;
      patternUiShownStepRef.current = newStep;
      aiGridOriginAudioRef.current = now + 0.0015;
      aiNextQuarterIndexRef.current = 0;
    }
    setPatternPosition(newStep);
  }

  function reversePattern() {
    const newStep = Math.max(patternStepRef.current - 1, 0);
    patternStepRef.current = newStep;
    if (patternPlaying) {
      const ctx = getOrCreateAudioContext();
      const now = ctx.currentTime;
      localStartStepRef.current = newStep;
      patternUiShownStepRef.current = newStep;
      aiGridOriginAudioRef.current = now + 0.0015;
      aiNextQuarterIndexRef.current = 0;
    }
    setPatternPosition(newStep);
  }

  // Keep tempos in sync
  useEffect(() => {
    if (patternTempo !== generationTempo) {
      setGenerationTempo(patternTempo);
    }
  }, [patternTempo]);

  useEffect(() => () => {
    localClockRunIdRef.current += 1;
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: '#2a2a2a', color: '#ccc' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #2c2c2c', background: '#2c2c2c' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded hover:bg-slate-800 transition-colors" style={{ color: '#888' }}>
            <SkipBack size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#00E5FF22', color: '#00E5FF' }}>
            <Cpu size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#fff' }}>AI Pattern Generator</h2>
            <p className="text-xs" style={{ color: '#555' }}>
              {tracks.length} lane{tracks.length !== 1 ? 's' : ''} · CH{AI_PATTERN_SESSION_BASE}–CH{AI_PATTERN_SESSION_BASE + tracks.length - 1} · AI Local {patternTempo} BPM
              {patternPlaying && 
                <span style={{ color: '#ff6b35' }}> · Step {(patternPosition % (loopLength * STEPS_PER_BAR)) + 1}</span>
              }
            </p>
          </div>
          {patternPlaying && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-2" style={{ background: '#1a0a0a', border: '1px solid #ff6b3544' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ff6b35' }} />
              <span className="text-xs" style={{ color: '#ff6b35', fontSize: 10 }}>Playing</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {/* Pattern Playback Controls */}
          <div className="flex gap-1 px-3 py-1.5 rounded" style={{ background: '#2c2c2c', border: '1px solid #333' }}>
            {/* Reverse */}
            <button onClick={reversePattern} className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:scale-110"
              style={{ background: '#242424', color: '#666', cursor: 'pointer' }}>
              <Rewind size={14} />
            </button>

            {/* Play/Stop */}
            <button onClick={() => patternPlaying ? stopPattern() : playPattern()} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all"
              style={{ background: patternPlaying ? '#ff6b3522' : '#242424', color: patternPlaying ? '#ff6b35' : '#666', cursor: 'pointer' }}>
              {patternPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>

            {/* Fast Forward */}
            <button onClick={fastForwardPattern} className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:scale-110"
              style={{ background: '#242424', color: '#666', cursor: 'pointer' }}>
              <FastForward size={14} />
            </button>

          </div>

          {/* Tempo Selector - Neon Arrows Only */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: '#2c2c2c', border: '1px solid #333' }}>
            <label className="text-xs" style={{ color: '#666' }}>
              AI Local: {patternTempo} BPM
            </label>
            
            {/* Decrease Arrow */}
            <button onClick={() => {
              const newTempo = Math.max(40, patternTempo - 1);
              setPatternTempo(newTempo);
              setGenerationTempo(newTempo);
              setDisplayTempo(newTempo);
            }} className="p-1 transition-all hover:scale-125"
              style={{ color: '#ff00ff', textShadow: '0 0 10px #ff00ff' }}>
              <ChevronDown size={22} strokeWidth={3} />
            </button>

            {/* Increase Arrow */}
            <button onClick={() => {
              const newTempo = Math.min(240, patternTempo + 1);
              setPatternTempo(newTempo);
              setGenerationTempo(newTempo);
              setDisplayTempo(newTempo);
            }} className="p-1 transition-all hover:scale-125"
              style={{ color: '#00ff88', textShadow: '0 0 10px #00ff88' }}>
              <ChevronUp size={22} strokeWidth={3} />
            </button>
          </div>

          {/* → PAD: bounce the *focused* track's pattern into a Beat Lab
              sampler pad. Only available when this screen is embedded
              inside Creation Station (the standalone module has no pads
              to send to). Uses `currentTrackIdx` instead of the export
              checkboxes because a single pad maps to a single track. */}
          {embedded && onExportToPad && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setPadPickerOpen((v) => !v)}
                disabled={padExportBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
                style={{
                  background: padExportBusy ? '#2c2c2c' : 'linear-gradient(135deg, #7cf4c6, #00E5FF)',
                  color: padExportBusy ? '#555' : '#000',
                  border: `1px solid ${padExportBusy ? '#222' : 'transparent'}`,
                  cursor: padExportBusy ? 'not-allowed' : 'pointer',
                }}
                title="Send the focused track's pattern to a Beat Lab sampler pad as a WAV"
              >
                <Send size={11} /> → PAD
              </button>
              {padPickerOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 50,
                    background: '#0a0a0e',
                    border: '1px solid rgba(124, 244, 198, 0.4)',
                    borderRadius: 8,
                    padding: 10,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
                    minWidth: 220,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: '#7cf4c6' }}>
                      SEND TO BEAT LAB PAD
                    </span>
                    <button
                      type="button"
                      onClick={() => setPadPickerOpen(false)}
                      style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 2, display: 'inline-flex' }}
                      aria-label="Close pad picker"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 4,
                    }}
                  >
                    {Array.from({ length: 16 }, (_, i) => i).map((padIndex) => (
                      <button
                        key={padIndex}
                        type="button"
                        onClick={() => { void exportFocusedTrackToPad(padIndex); }}
                        disabled={padExportBusy}
                        style={{
                          padding: '10px 0',
                          borderRadius: 4,
                          background: 'rgba(124, 244, 198, 0.08)',
                          border: '1px solid rgba(124, 244, 198, 0.25)',
                          color: '#7cf4c6',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: padExportBusy ? 'wait' : 'pointer',
                          opacity: padExportBusy ? 0.5 : 1,
                        }}
                        title={`Replace pad ${padIndex + 1} with this pattern`}
                      >
                        {padIndex + 1}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 9, color: '#666', lineHeight: 1.4 }}>
                    Bounces the focused track (<strong style={{ color: '#aaa' }}>{instrument}</strong>) at{' '}
                    <strong style={{ color: '#aaa' }}>{patternTempo} BPM</strong>, replacing that pad's sample.
                  </div>
                  {padExportStatus && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 10,
                        color: padExportStatus.startsWith('✓') ? '#7cf4c6' : '#ff8888',
                      }}
                    >
                      {padExportStatus}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Export Button */}
          <button onClick={() => setShowExportModal(true)} disabled={selectedTracksForExport.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold" 
            style={{ background: selectedTracksForExport.length === 0 ? '#2c2c2c' : 'linear-gradient(135deg, #00E5FF, #D500F9)', color: selectedTracksForExport.length === 0 ? '#555' : '#000', border: `1px solid ${selectedTracksForExport.length === 0 ? '#222' : 'transparent'}`, cursor: selectedTracksForExport.length === 0 ? 'not-allowed' : 'pointer' }}>
            <Download size={11} /> Export ({selectedTracksForExport.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-0">
        {/* Section 1: AI Engine Info */}
        <div className="rounded-xl p-4" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>AI Pattern Engine</span>
            <button onClick={() => setShowModelInfo(!showModelInfo)} className="p-1 rounded hover:bg-slate-800" style={{ color: '#888' }}>
              <Info size={14} />
            </button>
          </div>
          {showModelInfo && (
            <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: '#242424', border: '1px solid #2c2c2c', color: '#999', lineHeight: 1.5 }}>
              <p style={{ marginBottom: 8 }}>
                <strong>Magenta MusicRNN</strong> (official <code>drum_kit_rnn</code> + <code>basic_rnn</code> checkpoints) loads in the background when you open this screen, then generates drums and melody first. A fast <strong>procedural fallback</strong> runs if a model fails or times out (~2 min). Styles bias priming and lanes; tempo follows the AI local clock in this screen. Up to 3 versions per lane, then export to Studio.
              </p>
              <p style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                <strong>Pro Tip:</strong> Add a description for better results (e.g., "tight kick with swinging hi-hats")
              </p>
            </div>
          )}
        </div>

        {/* Section 2: Track Selector with Volume */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Select lane (session CH)</span>
            <button
              type="button"
              onClick={addPatternLane}
              disabled={tracks.length >= MAX_AI_PATTERN_LANES}
              className="flex items-center gap-1 px-2 py-1 rounded text-10px font-bold"
              style={{
                background: tracks.length >= MAX_AI_PATTERN_LANES ? '#2c2c2c' : '#00E5FF18',
                color: tracks.length >= MAX_AI_PATTERN_LANES ? '#444' : '#00E5FF',
                border: `1px solid ${tracks.length >= MAX_AI_PATTERN_LANES ? '#222' : '#00E5FF44'}`,
                cursor: tracks.length >= MAX_AI_PATTERN_LANES ? 'not-allowed' : 'pointer',
              }}
              title={`Add lane → CH${AI_PATTERN_SESSION_BASE + tracks.length} (max ${MAX_AI_PATTERN_LANES})`}
            >
              <Plus size={12} /> Add lane
            </button>
            {currentTrack.volume !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-10px font-mono" style={{ color: '#00ff88' }}>{currentTrack.volume}%</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="w-1 rounded-sm transition-all" style={{ height: 12, background: i < Math.round(currentTrack.volume / 10) ? (currentTrack.volume < 30 ? '#0066ff' : currentTrack.volume < 70 ? '#00ff88' : '#ffcc00') : '#2c2c2c', boxShadow: i < Math.round(currentTrack.volume / 10) ? `0 0 4px ${currentTrack.volume < 30 ? '#0066ff' : currentTrack.volume < 70 ? '#00ff88' : '#ffcc00'}` : 'none' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))' }}>
            {tracks.map((track, idx) => {
              const name = track.name;
              const sessionCh = AI_PATTERN_SESSION_BASE + idx;
              const trackVol = tracks[idx].volume;
              const meterLevel = Math.round(trackVol / 10);
              const ledColor = trackVol < 30 ? '#0066ff' : trackVol < 70 ? '#00ff88' : '#ffcc00';
              
              return (
                <div key={idx} className="flex flex-col gap-1">
                  <button onClick={() => setCurrentTrackIdx(idx)} className="p-2 rounded text-10px font-semibold flex flex-col gap-1.5"
                    style={{ background: currentTrackIdx === idx ? '#a78bfa22' : '#242424', color: currentTrackIdx === idx ? '#a78bfa' : '#555', border: `1px solid ${currentTrackIdx === idx ? '#a78bfa44' : '#222'}`, cursor: 'pointer', minHeight: 80, flex: 1 }}>
                    <div className="font-mono text-8px" style={{ color: '#666' }}>CH{sessionCh}</div>
                    <div className="font-bold">{name.includes('(') ? name.split('(')[0].trim() : name}</div>
                    
                    {/* LED Meter */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} className="flex-1 rounded-sm transition-all" 
                          style={{ 
                            background: i < meterLevel ? ledColor : '#1c1c1c', 
                            border: `1px solid ${i < meterLevel ? ledColor + '66' : '#2c2c2c'}`,
                            boxShadow: i < meterLevel ? `0 0 3px ${ledColor}` : 'none',
                            height: 3
                          }} />
                      ))}
                    </div>
                    
                    <div className="text-7px font-mono font-bold" style={{ color: ledColor }}>
                      {trackVol}%
                    </div>
                  </button>

                  {/* Volume Control Buttons */}
                  <div className="flex gap-1">
                    <button onClick={e => {
                      e.stopPropagation();
                      setTracks(prev => {
                        const updated = [...prev];
                        updated[idx].volume = Math.max(0, updated[idx].volume - 5);
                        return updated;
                      });
                    }} className="flex-1 py-1 rounded text-8px font-bold transition-colors hover:bg-slate-800"
                      style={{ background: '#2c2c2c', color: '#666', border: '1px solid #333', cursor: 'pointer' }}>
                      −
                    </button>
                    <button onClick={e => {
                      e.stopPropagation();
                      setTracks(prev => {
                        const updated = [...prev];
                        updated[idx].volume = Math.min(100, updated[idx].volume + 5);
                        return updated;
                      });
                    }} className="flex-1 py-1 rounded text-8px font-bold transition-colors hover:bg-slate-800"
                      style={{ background: '#2c2c2c', color: '#666', border: '1px solid #333', cursor: 'pointer' }}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {currentTrack.volume !== undefined && (
            <div className="flex items-center gap-3 mt-2 pt-3" style={{ borderTop: '1px solid #222' }}>
              <span className="text-10px uppercase font-bold" style={{ color: '#666', width: 40 }}>Vol</span>
              <input type="range" min="0" max="100" value={currentTrack.volume} onChange={e => {
                setTracks(prev => {
                  const updated = [...prev];
                  updated[currentTrackIdx].volume = Number(e.target.value);
                  return updated;
                });
              }} className="flex-1 h-1.5 rounded-full outline-none" style={{ accentColor: '#a78bfa', background: 'linear-gradient(to right, #0066ff, #00ff88, #ffcc00)', WebkitAppearance: 'none' }} />
            </div>
          )}
        </div>

        {/* Section 2b: Sequencing Mode */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f472b6' }}>Sequencing Mode</span>
          <div className="flex gap-2">
            <button onClick={() => setTracks(prev => {
              const updated = [...prev];
              updated[currentTrackIdx].sequenceMode = 'steps';
              return updated;
            })} className="flex-1 py-2 rounded text-sm font-bold"
              style={{ background: currentTrack.sequenceMode === 'steps' ? '#f472b622' : '#242424', color: currentTrack.sequenceMode === 'steps' ? '#f472b6' : '#555', border: `1px solid ${currentTrack.sequenceMode === 'steps' ? '#f472b644' : '#222'}`, cursor: 'pointer' }}>
              Step Grid
            </button>
            <button onClick={() => setTracks(prev => {
              const updated = [...prev];
              updated[currentTrackIdx].sequenceMode = 'bars';
              return updated;
            })} className="flex-1 py-2 rounded text-sm font-bold"
              style={{ background: currentTrack.sequenceMode === 'bars' ? '#f472b622' : '#242424', color: currentTrack.sequenceMode === 'bars' ? '#f472b6' : '#555', border: `1px solid ${currentTrack.sequenceMode === 'bars' ? '#f472b644' : '#222'}`, cursor: 'pointer' }}>
              Bar Mode
            </button>
          </div>
          <p className="text-10px" style={{ color: '#666' }}>
            {currentTrack.sequenceMode === 'steps' ? 'Fine-grained step sequencing for drums & percussion' : 'Bar-level note sequencing for strings, bass, keys'}
          </p>
        </div>

        {/* Section 2c: Loop Length */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ffcc00' }}>Pattern Length</span>
          <div className="flex gap-2">
            {LOOP_LENGTHS.map(len => (
              <button key={len} onClick={() => setLoopLength(len)} className="flex-1 py-2 rounded text-sm font-bold"
                style={{ background: loopLength === len ? '#ffcc0022' : '#242424', color: loopLength === len ? '#ffcc00' : '#555', border: `1px solid ${loopLength === len ? '#ffcc0044' : '#222'}`, cursor: 'pointer' }}>
                {len} Bar{len > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <p className="text-10px" style={{ color: '#666' }}>
            {`${loopLength * STEPS_PER_BAR} steps · ${loopLength} bar${loopLength !== 1 ? 's' : ''} · 16th-note grid`}
          </p>
        </div>

        {/* Section 3: Instrument & Style */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>Instrument</span>
              {sampleBankStatus === 'loading' && (
                <span className="text-10px font-semibold" style={{ color: '#FFA500' }}>● Loading sounds…</span>
              )}
              {sampleBankStatus === 'ready' && (
                <span className="text-10px font-semibold" style={{ color: '#7cf4c6' }}>● Real samples</span>
              )}
              {sampleBankStatus === 'failed' && (
                <span className="text-10px font-semibold" style={{ color: '#888' }}>● Synth (offline)</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map(i => (
                <button key={i} onClick={() => setInstrument(i)} className="px-2 py-1 rounded text-10px font-semibold"
                  style={{ background: instrument === i ? '#00E5FF22' : '#242424', color: instrument === i ? '#00E5FF' : '#555', border: `1px solid ${instrument === i ? '#00E5FF44' : '#222'}`, cursor: 'pointer' }}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#D500F9' }}>Style</span>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(s => (
                <button key={s} onClick={() => setStyle(s)} className="px-2 py-1 rounded text-10px font-semibold"
                  style={{ background: style === s ? '#D500F922' : '#242424', color: style === s ? '#D500F9' : '#555', border: `1px solid ${style === s ? '#D500F944' : '#222'}`, cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3b: Description */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Pattern Description (Optional)</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="E.g., 'tight kick with swinging hi-hats' or 'fast arpeggios with chord changes'" className="w-full px-3 py-2 rounded text-xs outline-none resize-none"
            style={{ background: '#242424', color: '#ccc', border: '1px solid #333', fontFamily: 'monospace', height: 60, lineHeight: 1.4 }} />
          <p className="text-10px" style={{ color: '#666' }}>Describe what you want the pattern to sound like for better results</p>
        </div>

        {/* Section 3c: Generation Tempo */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00ff88' }}>Generation Tempo</span>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: '#666' }}>Gen Tempo:</label>

            {/* Decrease Arrow */}
            <button onClick={() => {
              const newTempo = Math.max(40, generationTempo - 1);
              setGenerationTempo(newTempo);
              setPatternTempo(newTempo);
              setDisplayTempo(newTempo);
            }} className="p-1.5 transition-all hover:scale-125"
              style={{ color: '#ff00ff', textShadow: '0 0 10px #ff00ff' }}>
              <ChevronDown size={24} strokeWidth={3} />
            </button>

            {/* Increase Arrow */}
            <button onClick={() => {
              const newTempo = Math.min(240, generationTempo + 1);
              setGenerationTempo(newTempo);
              setPatternTempo(newTempo);
              setDisplayTempo(newTempo);
            }} className="p-1.5 transition-all hover:scale-125"
              style={{ color: '#00ff88', textShadow: '0 0 10px #00ff88' }}>
              <ChevronUp size={24} strokeWidth={3} />
            </button>

            <span className="text-xs px-2 py-1 rounded" style={{ background: '#00ff8822', color: '#00ff88', minWidth: '60px', textAlign: 'center' }}>{generationTempo} BPM</span>
          </div>
          <p className="text-10px" style={{ color: '#666' }}>Updates AI local playback tempo for this screen/export metadata</p>
        </div>

        {/* Section 3d: Song Key + Mode + Lock — drives the scale-aware
            bass/melody pitch mapping (rowToMidi). Bass + melody tracks
            generate notes from this key's diatonic scale and resolve to
            its tonic, so all tracks sound like the same song. */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ffcc00' }}>Song Key</span>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Key root buttons (C…B). Compact 12-button row so the user
                can flip keys without a dropdown menu. */}
            {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((k, i) => (
              <button
                key={k}
                onClick={() => setSongKey(i)}
                className="px-2 py-1 rounded text-10px font-bold"
                style={{
                  background: songKey === i ? '#ffcc0022' : '#242424',
                  color: songKey === i ? '#ffcc00' : '#666',
                  border: `1px solid ${songKey === i ? '#ffcc0066' : '#222'}`,
                  cursor: 'pointer',
                  minWidth: 28,
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-10px" style={{ color: '#666' }}>Mode:</span>
            <button
              onClick={() => setSongMode('minor')}
              className="px-3 py-1 rounded text-10px font-bold"
              style={{
                background: songMode === 'minor' ? '#7cf4c622' : '#242424',
                color: songMode === 'minor' ? '#7cf4c6' : '#666',
                border: `1px solid ${songMode === 'minor' ? '#7cf4c666' : '#222'}`,
                cursor: 'pointer',
              }}
            >
              Minor
            </button>
            <button
              onClick={() => setSongMode('major')}
              className="px-3 py-1 rounded text-10px font-bold"
              style={{
                background: songMode === 'major' ? '#7cf4c622' : '#242424',
                color: songMode === 'major' ? '#7cf4c6' : '#666',
                border: `1px solid ${songMode === 'major' ? '#7cf4c666' : '#222'}`,
                cursor: 'pointer',
              }}
            >
              Major
            </button>

            <div className="flex-1" />

            {/* "Lock to drums" — when on, generating a bass or melody
                track uses the first populated drum track's kick pattern
                as the rhythmic anchor. Off = generate independently. */}
            <button
              onClick={() => setLockToDrums((v) => !v)}
              className="px-3 py-1 rounded text-10px font-bold"
              style={{
                background: lockToDrums ? '#D500F922' : '#242424',
                color: lockToDrums ? '#D500F9' : '#666',
                border: `1px solid ${lockToDrums ? '#D500F966' : '#222'}`,
                cursor: 'pointer',
              }}
              title="When on, bass + melody snap to the drum track's kick hits"
            >
              {lockToDrums ? '🔒 Lock to drums' : '🔓 Lock off'}
            </button>
          </div>
          <p className="text-10px" style={{ color: '#666' }}>Bass + melody tracks pitch into <strong style={{ color: '#aaa' }}>{['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][songKey]} {songMode}</strong>{lockToDrums ? ' • Bass locks to the drum kick' : ''}</p>
        </div>

        {/* Section 4: Variation */}
        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ffcc00' }}>Variation</span>
            <span className="text-xs px-2 py-1 rounded" style={{ background: '#ffcc0022', color: '#ffcc00' }}>{variation}</span>
          </div>
          <div className="flex gap-2">
            {[
              { id: 'conservative', label: 'Conservative', temp: 0.7, desc: 'Predictable, safe' },
              { id: 'balanced', label: 'Balanced', temp: 1.0, desc: 'Default, natural' },
              { id: 'creative', label: 'Creative', temp: 1.3, desc: 'Experimental, risky' },
            ].map(opt => (
              <button key={opt.id} onClick={() => { setVariation(opt.id); setTemperature(opt.temp); }}
                className="flex-1 p-2 rounded text-10px text-center" style={{ background: variation === opt.id ? `${opt.id === 'conservative' ? '#0066ff' : opt.id === 'balanced' ? '#00ff88' : '#ff6b35'}33` : '#242424', color: variation === opt.id ? (opt.id === 'conservative' ? '#0066ff' : opt.id === 'balanced' ? '#00ff88' : '#ff6b35') : '#555', border: `1px solid ${variation === opt.id ? '#333' : '#222'}`, cursor: 'pointer' }}>
                <div style={{ fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 8, marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 5: Status & Generate */}
        <div className="rounded-xl p-4 flex items-center gap-4 flex-wrap" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
          {modelLoading ? (
            <div className="flex items-center gap-2" style={{ color: '#00E5FF' }}>
              <RefreshCw size={12} className="animate-spin" />
              <span className="text-xs">Loading AI model…</span>
            </div>
          ) : modelError ? (
            <div className="flex items-center gap-2" style={{ color: '#ff4444' }}>
              <AlertCircle size={12} />
              <span className="text-xs">{modelError}</span>
            </div>
          ) : currentTrack.versions.length > 0 ? (
            <div className="flex items-center gap-2" style={{ color: '#00ff88' }}>
              <span className="text-xs font-semibold">✓ {currentTrack.versions.length}/3 versions saved</span>
            </div>
          ) : null}
        </div>

        {/* Section 6: Generate Button + Presets toggle */}
        <div className="flex gap-2">
          <button onClick={generatePattern} disabled={currentTrack.generating || modelLoading} className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: currentTrack.generating || modelLoading ? '#2c2c2c' : 'linear-gradient(135deg, #00E5FF, #D500F9)', color: currentTrack.generating || modelLoading ? '#444' : '#000', cursor: currentTrack.generating || modelLoading ? 'not-allowed' : 'pointer' }}>
            {currentTrack.generating ? (
              <><RefreshCw size={14} className="animate-spin" /> Generating…</>
            ) : modelLoading ? (
              <><RefreshCw size={14} className="animate-spin" /> Loading…</>
            ) : (
              <><Sparkles size={14} /> Generate {style} {instrument}</>
            )}
          </button>
          {/* Presets — opens the curated loop library. Shows presets
              relevant to the current instrument's role (drums / bass /
              melody / pad) filtered by genre. */}
          <button
            onClick={() => setPresetsOpen((v) => !v)}
            className="px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-1"
            style={{
              background: presetsOpen ? '#00ff8833' : '#242424',
              color: presetsOpen ? '#00ff88' : '#888',
              border: `1px solid ${presetsOpen ? '#00ff8866' : '#333'}`,
              cursor: 'pointer',
            }}
            title="Browse curated musical pattern presets"
          >
            🎵 Presets
          </button>
        </div>

        {/* Section 6b: Presets Browser
            A scrollable panel of hand-crafted patterns. Genre filter at
            the top narrows the list. Each card shows the name, genre
            tag, and a one-line description. Clicking loads the pattern
            into the current track (tiled to the loop length). */}
        {presetsOpen && (() => {
          const role = instrumentToPresetRole(instrument);
          const visiblePresets = filterPresets(role, presetGenreFilter);
          return (
            <div
              className="rounded-xl flex flex-col gap-3"
              style={{ background: '#060606', border: '1px solid #00ff8844', padding: 12 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00ff88' }}>
                  🎵 Pattern Presets — {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
                <button onClick={() => setPresetsOpen(false)} style={{ color: '#555', cursor: 'pointer', background: 'none', border: 'none', fontSize: 16 }}>✕</button>
              </div>

              {/* Genre filter chips */}
              <div className="flex gap-1 flex-wrap">
                {PRESET_GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setPresetGenreFilter(g)}
                    className="px-2 py-0.5 rounded text-10px font-bold"
                    style={{
                      background: presetGenreFilter === g ? '#00ff8822' : '#242424',
                      color: presetGenreFilter === g ? '#00ff88' : '#555',
                      border: `1px solid ${presetGenreFilter === g ? '#00ff8855' : '#222'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* Preset cards */}
              <div
                className="flex flex-col gap-2"
                style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}
              >
                {visiblePresets.length === 0 ? (
                  <p className="text-10px" style={{ color: '#444', textAlign: 'center', padding: 16 }}>
                    No presets for {presetGenreFilter} {role}. Try "All" or a different genre.
                  </p>
                ) : (
                  visiblePresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => loadPreset(preset)}
                      className="text-left rounded-lg p-3 flex flex-col gap-1"
                      style={{
                        background: '#0d0d0d',
                        border: '1px solid #2c2c2c',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ff8855'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2c2c2c'; }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: '#e0e0e0' }}>{preset.name}</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-10px font-bold"
                          style={{ background: '#00ff8811', color: '#00ff8899', border: '1px solid #00ff8822' }}
                        >
                          {preset.genre}
                        </span>
                      </div>
                      <span className="text-10px" style={{ color: '#555' }}>{preset.desc}</span>
                      {/* Mini step-grid preview — shows which rows have ANY note */}
                      <div className="flex gap-px mt-1" style={{ height: 8 }}>
                        {Array.from({ length: 16 }, (_, s) => {
                          const hit = preset.pattern.some((row) => row[s]);
                          return (
                            <div
                              key={s}
                              style={{
                                flex: 1,
                                background: hit ? '#00ff8866' : '#2c2c2c',
                                borderRadius: 1,
                              }}
                            />
                          );
                        })}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <p className="text-10px" style={{ color: '#444' }}>
                {visiblePresets.length} preset{visiblePresets.length !== 1 ? 's' : ''} shown · click any to load into the current track
              </p>
            </div>
          );
        })()}

        {/* Section 7: Version History */}
        {currentTrack.versions.length > 0 && (
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Pattern Versions</span>
            <div className="flex gap-2 flex-wrap">
              {currentTrack.versions.map((version, idx) => (
                <button key={version.id} onClick={() => setTracks(prev => {
                  const updated = [...prev];
                  updated[currentTrackIdx].selectedVersionId = version.id;
                  return updated;
                })}
                  className="px-3 py-2 rounded text-xs font-semibold flex items-center gap-2"
                  style={{ background: currentTrack.selectedVersionId === version.id ? '#a78bfa22' : '#242424', color: currentTrack.selectedVersionId === version.id ? '#a78bfa' : '#666', border: `1px solid ${currentTrack.selectedVersionId === version.id ? '#a78bfa44' : '#222'}`, cursor: 'pointer' }}>
                  {currentTrack.selectedVersionId === version.id && <Check size={12} />}
                  v{idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section 8: Pattern Grid */}
        {selectedPattern && selectedPattern.length > 0 && (
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#00E5FF' }}>AI Generated Pattern ({currentTrack.sequenceMode === 'steps' ? 'Step Grid' : 'Bar Mode'})</span>
                <p style={{ fontSize: 9, color: '#888', marginTop: 2, fontFamily: 'monospace' }}>Lane CH{AI_PATTERN_SESSION_BASE + currentTrackIdx} · Studio / mixer same channel</p>
                <p style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Variation: <strong>{variation}</strong> • Temp: <strong>{temperature.toFixed(1)}</strong> • {bpm} BPM{description && <span> • <strong style={{ color: '#60a5fa' }}>"{description.substring(0, 30)}{description.length > 30 ? '...' : ''}"</strong></span>}</p>
              </div>
              <button onClick={generatePattern} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: '#242424', color: '#666', border: '1px solid #222', cursor: 'pointer' }}>
                <RefreshCw size={10} /> Regenerate
              </button>
            </div>

            {currentTrack.sequenceMode === 'steps' ? (
              <>
                <div className="flex" style={{ paddingLeft: 72 }}>
                  {Array.from({ length: loopLength }, (_, b) => (
                    <div key={b} className="flex-1 text-center font-mono text-xs font-bold" style={{ color: activeBeat >= b*4 && activeBeat < (b+1)*4 ? '#D500F9' : '#444' }}>
                      {b + 1}
                    </div>
                  ))}
                </div>

                <div className="flex" style={{ paddingLeft: 72 }}>
                  {Array.from({ length: loopLength * STEPS_PER_BAR }, (_, i) => (
                    <div key={i} className="flex-1 text-center font-mono text-6xs" style={{ color: activeBeat === i ? '#D500F9' : '#2a2a2a', fontWeight: activeBeat === i ? 'bold' : 'normal', fontSize: 7 }}>
                      {(i % 4) + 1}
                    </div>
                  ))}
                </div>

                {selectedPattern.map((row, ri) => (
                  <div key={ri} className="flex items-center">
                    <div className="shrink-0 pr-2" style={{ width: 72, color: NOTE_COLORS[ri], fontSize: 10, fontWeight: 700, textAlign: 'right' }}>
                      {getRowNames(instrument)[ri]}
                    </div>
                    <div className="flex flex-1 gap-0.5">
                      {row.map((on, bi) => (
                        <button key={bi}
                          onClick={() => {
                            const updatedPattern = selectedPattern.map((r, ri2) => ri2 !== ri ? r : r.map((v, ci) => ci === bi ? !v : v));
                            setTracks(prev => {
                              const updated = [...prev];
                              const versionIdx = updated[currentTrackIdx].versions.findIndex(v => v.id === currentTrack.selectedVersionId);
                              if (versionIdx >= 0) {
                                updated[currentTrackIdx].versions[versionIdx].pattern = updatedPattern;
                              }
                              return updated;
                            });
                          }}
                          className="flex-1 h-6 rounded-sm transition-all"
                          style={{ background: on ? (activeBeat === bi ? NOTE_COLORS[ri] : `${NOTE_COLORS[ri]}cc`) : (activeBeat === bi ? '#1e1a1e' : '#222222'), boxShadow: on && activeBeat === bi ? `0 0 10px ${NOTE_COLORS[ri]}` : 'none', border: `1px solid ${bi % 4 === 0 ? '#2a2a2a' : '#141414'}`, cursor: 'pointer' }} />
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex" style={{ paddingLeft: 72, marginTop: 2 }}>
                  {Array.from({ length: loopLength * STEPS_PER_BAR }, (_, i) => (
                    <div key={i} className="flex-1 h-0.5 rounded-full transition-all" style={{ background: activeBeat === i ? '#D500F9' : 'transparent', boxShadow: activeBeat === i ? '0 0 6px #D500F9' : 'none' }} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex" style={{ paddingLeft: 72 }}>
                  {Array.from({ length: loopLength }, (_, b) => (
                    <div key={b} className="flex-1 text-center font-mono text-sm font-bold px-2" style={{ color: activeBeat >= b*4 && activeBeat < (b+1)*4 ? '#D500F9' : '#444', borderRight: b < loopLength - 1 ? '1px solid #333' : 'none', paddingRight: b < loopLength - 1 ? 8 : 0 }}>
                      Bar {b + 1}
                    </div>
                  ))}
                </div>

                {selectedPattern.slice(0, 4).map((row, ri) => (
                  <div key={ri} className="flex items-center">
                    <div className="shrink-0 pr-2" style={{ width: 72, color: NOTE_COLORS[ri], fontSize: 10, fontWeight: 700, textAlign: 'right' }}>
                      {getRowNames(instrument)[ri]}
                    </div>
                    <div className="flex flex-1 gap-2">
                      {Array.from({ length: loopLength }, (_, bi) => (
                        <button key={bi}
                          onClick={() => {
                            const updatedPattern = selectedPattern.map((r, ri2) => ri2 !== ri ? r : r.map((v, ci) => ci === bi ? !v : v));
                            setTracks(prev => {
                              const updated = [...prev];
                              const versionIdx = updated[currentTrackIdx].versions.findIndex(v => v.id === currentTrack.selectedVersionId);
                              if (versionIdx >= 0) {
                                updated[currentTrackIdx].versions[versionIdx].pattern = updatedPattern;
                              }
                              return updated;
                            });
                          }}
                          className="flex-1 min-h-10 rounded transition-all flex items-center justify-center"
                          style={{ background: selectedPattern[ri][bi] ? (activeBeat === bi ? NOTE_COLORS[ri] : `${NOTE_COLORS[ri]}cc`) : (activeBeat === bi ? '#1e1a1e' : '#242424'), boxShadow: selectedPattern[ri][bi] && activeBeat === bi ? `0 0 10px ${NOTE_COLORS[ri]}` : 'none', border: `1px solid ${activeBeat === bi ? '#D500F944' : '#222'}`, cursor: 'pointer' }}>
                          {selectedPattern[ri][bi] && <span style={{ fontSize: 8, color: '#fff', fontWeight: 'bold' }}>●</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {currentTrack.versions.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: '#333' }}>
            <Cpu size={32} style={{ color: '#2c2c2c' }} />
            <p className="text-sm">Select instrument & style, then generate</p>
            <p className="text-xs">Track: {currentTrack.name}</p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="rounded-xl p-6 max-w-md w-full" style={{ background: '#1c1c1c', border: '1px solid #303030' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#fff' }}>Export Selected Tracks</h3>
            
            <div className="flex flex-col gap-2 mb-4 max-h-64 overflow-y-auto">
              {tracks.map((track, idx) => (
                <label key={idx} className="flex items-center gap-3 p-2 rounded cursor-pointer" style={{ background: '#242424', border: '1px solid #222' }}>
                  <input type="checkbox" checked={track.selected && track.selectedVersionId !== null} onChange={e => updateTrackSelection(idx, e.target.checked)} style={{ cursor: 'pointer' }} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold" style={{ color: track.selectedVersionId ? '#00E5FF' : '#666' }}>{track.name}</div>
                    <div className="text-10px" style={{ color: '#666' }}>{track.versions.length > 0 ? `${track.versions.length}/3 versions` : 'No patterns'}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowExportModal(false)} className="flex-1 py-2 rounded text-xs font-bold" style={{ background: '#242424', color: '#666', border: '1px solid #222', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => { onExport('creation-station'); setShowExportModal(false); }} className="flex-1 py-2 rounded text-xs font-bold" style={{ background: '#D500F922', color: '#D500F9', border: '1px solid #D500F944', cursor: 'pointer' }}>
                Creation Station
              </button>
              <button onClick={() => { onExport('studio-editor'); setShowExportModal(false); }} className="flex-1 py-2 rounded text-xs font-bold" style={{ background: '#00E5FF22', color: '#00E5FF', border: '1px solid #00E5FF44', cursor: 'pointer' }}>
                Studio Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

