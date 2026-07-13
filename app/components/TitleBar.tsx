import { useMasterClock, LOOP_BAR_OPTIONS, PPQ, type QuantizeValue } from '@/app/context/MasterClockContext';
import type { ScreenId } from '@/app/lib/navigation/moduleNav';
import ModulesMenu from '@/app/components/ModulesMenu';
import type { CreationSubScreenId } from '@/app/lib/creationStation/creationSubScreens';
import type { VocalLabSubScreenId } from '@/app/lib/vocalLab/vocalLabSubScreens';

import { Play, Square, Pause, Circle, Repeat, SkipBack, Save, Plus, Trash2, Settings, Sparkles } from 'lucide-react';

const DMB_STUDIO_PRECOUNT_CANCEL = 'dmb-studio-precount-cancel';

import { useState, useEffect, useRef, useMemo } from 'react';

import MasterVU from './MasterVU';

import { Se2FeatureShowcaseTicker } from '@/app/components/studio/Se2FeatureShowcaseTicker';
import { Se2PerformanceStrip } from '@/app/components/studio/Se2PerformanceStrip';

import { saveService } from '@/app/lib/saveService';
import { getStudioProjectJsonForCloudSave } from '@/app/lib/studioProjectBridge';


const QUANTIZE_OPTIONS: QuantizeValue[] = ['1/4', '1/8', '1/16', '1/32', '1/16T'];


export default function TitleBar({
  onOpenSettings,
  onOpenOverview,
  activeScreen,
  onScreenChange,
  activeCreationSubScreen,
  onCreationSubScreenChange,
  activeVocalLabSubScreen,
  onVocalLabSubScreenChange,
}: {
  onOpenSettings?: () => void;
  onOpenOverview?: () => void;
  activeScreen?: ScreenId;
  onScreenChange?: (id: ScreenId) => void;
  activeCreationSubScreen?: CreationSubScreenId;
  onCreationSubScreenChange?: (sub: CreationSubScreenId) => void;
  activeVocalLabSubScreen?: VocalLabSubScreenId;
  onVocalLabSubScreenChange?: (sub: VocalLabSubScreenId) => void;
}) {
  const [saveMessage, setSaveMessage] = useState('');
  const [projectName, setProjectName] = useState('');
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const saveAsRef = useRef<HTMLDivElement>(null);
  const {
    transport,
    play, pause, stop, record, seekToTick,
    metronomeEnabled, setMetronomeEnabled,
    midiClockEnabled, setMidiClockEnabled,
    countInEnabled, setCountInEnabled,
    countInBeats, setCountInBeats,
    countDownTicks,
    patternMode, setPatternMode,
    loopEnabled,
    setLoopEnabled,
    setLoopRange,
    clearLoop,
    loopSection,
    loopStartBar,
    loopEndBar,
    quantize, setQuantize,
    channelLevels, channelVolumes,
  } = useMasterClock();

  const isPlaying   = transport === 'playing';
  const isRecording = transport === 'recording';
  const isCounting  = transport === 'counting';
  const isPaused    = transport === 'paused';
  const isRunning   = isPlaying || isRecording;
  /** Play button shows Pause whenever transport is moving (incl. record / count-in). */
  const transportNeedsPause = isPlaying || isRecording || isCounting;

  const masterLevel = Math.min(1, Object.entries(channelLevels).reduce((sum, [id, lvl]) => {
    const vol = (channelVolumes[Number(id)] ?? 80) / 100;
    return sum + lvl * vol * 0.08;
  }, 0));
  const loopDisabledScreens: ScreenId[] = [
    'vocal-lab',
    'ai-song',
    'ai-music-match',
    'ai-pattern',
    'melody-transcription',
    'harmony-match',
    'my-projects',
    'export',
    'studio-editor-2',
    'creation-station',
    'master-arranger',
  ];
  const loopDisabledForScreen = !!activeScreen && loopDisabledScreens.includes(activeScreen);
  const topLoopDisabled = loopDisabledForScreen;
  /** Global title-bar transport only on legacy Studio Editor (v1); every other module has its own controls. */
  const showMasterTransportBar = activeScreen === 'studio-editor';
  const hideMasterTransportBar = !showMasterTransportBar;
  const disableMasterTransport = hideMasterTransportBar;

  const selectedLoopLength = loopEndBar - loopStartBar + 1;
  const loopLengthSelectOptions = useMemo(() => {
    const set = new Set<number>([...LOOP_BAR_OPTIONS, selectedLoopLength]);
    return [...set].sort((a, b) => a - b);
  }, [selectedLoopLength]);

  const handleSaveAll = () => {
    setShowSaveAsDialog(true);
    setSaveAsName('');
  };

  const handleSaveAsConfirm = async () => {
  const name = saveAsName.trim() || `Project ${new Date().toLocaleString()}`

  try {
    const studioJson = await getStudioProjectJsonForCloudSave()
    await saveService.saveProject(name, studioJson ?? undefined)
    setSaveAsName('')
    setShowSaveAsDialog(false)
    setSaveMessage(`✓ Saved as: ${name}`)
    window.dispatchEvent(new Event('projectsChanged'))
    setTimeout(() => setSaveMessage(''), 3000)
  } catch (error) {
    console.error(error)
    setSaveMessage('✗ Save failed')
    setTimeout(() => setSaveMessage(''), 3000)
  }
}

 const handleNewProject = async () => {
  const name = projectName.trim() || `Project ${new Date().toLocaleString()}`

  localStorage.removeItem('vocalLabState')
  localStorage.removeItem('patternState')
  localStorage.removeItem('trackState')
  localStorage.removeItem('navItemOrder')

  try {
    const studioJson = await getStudioProjectJsonForCloudSave()
    await saveService.saveProject(name, studioJson ?? undefined)
    setProjectName('')
    setShowNewProjectDialog(false)
    setSaveMessage(`✓ New project: ${name}`)
    setTimeout(() => setSaveMessage(''), 2000)
    window.location.reload()
  } catch (error) {
    console.error(error)
    setSaveMessage('✗ Save failed')
    setTimeout(() => setSaveMessage(''), 3000)
  }
}

  const handleDeleteProject = () => {
    if (confirm('Delete current project? This cannot be undone.')) {
      localStorage.removeItem('vocalLabState');
      localStorage.removeItem('patternState');
      localStorage.removeItem('trackState');
      localStorage.removeItem('activeScreen');
      setSaveMessage('✓ Project deleted');
      setTimeout(() => setSaveMessage(''), 2000);
      window.location.reload();
    }
  };

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowNewProjectDialog(false);
      }
      if (saveAsRef.current && !saveAsRef.current.contains(event.target as Node)) {
        setShowSaveAsDialog(false);
      }
    }
    if (showNewProjectDialog || showSaveAsDialog) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNewProjectDialog, showSaveAsDialog]);

  // Listen for Ctrl+S
  useEffect(() => {
    const handleSaveEvent = () => handleSaveAll();
    window.addEventListener('saveProject', handleSaveEvent);
    return () => window.removeEventListener('saveProject', handleSaveEvent);
  }, []);

  /** Same chrome as Settings / MET / MIDI: 32×32 icon buttons, `active:scale-90`. */
  const transportIconBtn =
    'w-8 h-8 rounded flex items-center justify-center shrink-0 transition-all active:scale-90 active:opacity-70';

  const toolbarGap = 'gap-3';

  const platinumSuiteStyle = {
    fontFamily: 'Rajdhani, system-ui, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: '0.28em',
    textTransform: 'uppercase' as const,
    background:
      'linear-gradient(180deg, #ffffff 0%, #eef2f5 18%, #c5ced6 38%, #f4f7f9 52%, #9aa8b4 72%, #dce3e9 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.65))',
    whiteSpace: 'nowrap' as const,
  };

  return (
    <div
      className="select-none w-full min-w-0 shrink-0 px-3 py-1"
      style={{
        background: '#1c1c1c',
        borderBottom: '2px solid #2c2c2c',
        minHeight: 72,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        columnGap: 12,
      }}
    >
      {/* Left — logo + Modules menu */}
      <div className="flex items-center gap-2 shrink-0 justify-self-start min-w-0">
        <div
          style={{
            height: 44,
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 12,
            padding: '0 12px',
            border: '1px solid #00E5FF44',
            background: 'linear-gradient(90deg, #0b1018 0%, #0d1520 55%, #0b1018 100%)',
            boxShadow: 'inset 0 1px 0 rgba(99,230,255,0.12), 0 0 20px rgba(0,229,255,0.06)',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            className="font-bold whitespace-nowrap shrink-0"
            style={{
              fontFamily: 'Orbitron, "Audiowide", "Exo 2", "Rajdhani", sans-serif',
              fontWeight: 800,
              fontSize: 21,
              letterSpacing: 1.4,
              background: 'linear-gradient(135deg, #fff8ec 0%, #ffe082 42%, #ffb74d 78%, #ff8a65 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 10px rgba(255, 183, 77, 0.45))',
            }}
          >
            Da Muzik Box
          </span>
          <span
            aria-hidden
            style={{
              width: 1,
              height: 26,
              flexShrink: 0,
              background:
                'linear-gradient(180deg, transparent 0%, rgba(94, 200, 232, 0.5) 45%, rgba(255, 183, 77, 0.35) 55%, transparent 100%)',
            }}
          />
          <span
            className="font-bold whitespace-nowrap shrink-0"
            style={{
              fontFamily: 'Orbitron, "Audiowide", "Exo 2", "Rajdhani", sans-serif',
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: 4,
              color: '#9defff',
              textShadow: '0 0 8px rgba(99,230,255,0.28)',
            }}
          >
            Gen-DAW
          </span>
          <span
            aria-hidden
            style={{
              width: 1,
              height: 26,
              flexShrink: 0,
              marginLeft: 2,
              background:
                'linear-gradient(180deg, transparent 0%, rgba(255, 183, 77, 0.4) 50%, transparent 100%)',
            }}
          />
          <span
            className="font-bold whitespace-nowrap shrink-0"
            style={{
              fontFamily: 'Orbitron, "Audiowide", "Exo 2", "Rajdhani", sans-serif',
              fontWeight: 800,
              letterSpacing: 5,
              fontStyle: 'italic',
              fontSize: 16,
              background: 'linear-gradient(135deg, #fff8ec 0%, #ffe082 42%, #ffb74d 78%, #ff8a65 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 8px rgba(255, 183, 77, 0.4))',
            }}
          >
            Hybrid
          </span>
        </div>
        {onScreenChange && (
          <ModulesMenu
            activeScreen={activeScreen ?? 'creation-station'}
            onScreenChange={onScreenChange}
            activeCreationSubScreen={activeCreationSubScreen}
            onCreationSubScreenChange={onCreationSubScreenChange}
            activeVocalLabSubScreen={activeVocalLabSubScreen}
            onVocalLabSubScreenChange={onVocalLabSubScreenChange}
          />
        )}
      </div>

      {/* Center — title bar (between logo and transport / settings) */}
      <div className="flex items-center justify-center justify-self-center px-2 pointer-events-none min-w-0">
        <span style={platinumSuiteStyle}>Music Production Suite</span>
      </div>

      {/* Right — transport + settings */}
      <div
        className={`flex items-center ${toolbarGap} justify-self-end min-w-0 overflow-x-auto overflow-y-hidden`}
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}
      >
      {!hideMasterTransportBar && (
      <>
      <div className="w-px h-8 shrink-0 self-center mx-1" style={{ background: '#2a2a2a' }} />

      {/* Transport + loop on top; compact MASTER VU tucked underneath */}
      <div className="flex flex-col justify-center gap-1 shrink-0 self-center">
        <div className={`flex items-center ${toolbarGap} shrink-0`}>
      {/* ── Transport — same 32×32 + border treatment as Settings; active = solid fills like MET/MIDI ── */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={disableMasterTransport}
          onClick={() => {
            if (disableMasterTransport) return;
            seekToTick(0);
          }}
          title={disableMasterTransport ? 'Use transport in Studio Editor 2 (footer)' : 'Return to start'}
          className={transportIconBtn}
          style={{
            background: '#2c2c2c',
            color: '#888',
            border: '1px solid #333',
            opacity: disableMasterTransport ? 0.45 : 1,
            cursor: disableMasterTransport ? 'not-allowed' : undefined,
          }}
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          disabled={disableMasterTransport}
          onClick={() => {
            if (disableMasterTransport) return;
            window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
            stop();
          }}
          title={disableMasterTransport ? 'Use transport in Studio Editor 2 (footer)' : 'Stop'}
          className={transportIconBtn}
          style={{
            background: isRunning ? '#ef4444' : '#2c2c2c',
            color: isRunning ? '#000' : '#888',
            border: `1px solid ${isRunning ? '#ef4444' : '#333'}`,
            opacity: disableMasterTransport ? 0.45 : 1,
            cursor: disableMasterTransport ? 'not-allowed' : undefined,
          }}
        >
          <Square size={14} />
        </button>
        <button
          type="button"
          disabled={disableMasterTransport}
          onClick={() => {
            if (disableMasterTransport) return;
            if (transportNeedsPause) pause();
            else {
              window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
              play();
            }
          }}
          title={
            disableMasterTransport
              ? 'Use transport in Studio Editor 2 (footer)'
              : isRecording
                ? 'Pause — recording'
                : isCounting
                  ? 'Pause — count-in'
                  : isPlaying
                    ? 'Pause — playing'
                    : isPaused
                      ? 'Resume'
                      : 'Play'
          }
          aria-pressed={transportNeedsPause}
          className={transportIconBtn}
          style={(() => {
            const faded = {
              opacity: disableMasterTransport ? 0.45 : 1,
              cursor: disableMasterTransport ? ('not-allowed' as const) : undefined,
            };
            if (disableMasterTransport) {
              return { ...faded, background: '#2c2c2c', color: '#555', border: '1px solid #333' };
            }
            if (isRecording) {
              return {
                ...faded,
                background: '#ef4444',
                color: '#000',
                border: '1px solid #ef4444',
              };
            }
            if (isCounting) {
              return {
                ...faded,
                background: '#ff9800',
                color: '#000',
                border: '1px solid #ff9800',
              };
            }
            if (isPlaying) {
              return {
                ...faded,
                background: '#D500F9',
                color: '#000',
                border: '1px solid #D500F9',
              };
            }
            if (isPaused) {
              return {
                ...faded,
                background: '#ff9800',
                color: '#000',
                border: '1px solid #ff9800',
              };
            }
            return {
              ...faded,
              background: '#00E5FF22',
              color: '#00E5FF',
              border: '1px solid #00E5FF44',
            };
          })()}
        >
          {transportNeedsPause ? <Pause size={16} /> : <Play size={16} className="ml-px" />}
        </button>
        <button
          type="button"
          disabled={disableMasterTransport}
          onClick={() => {
            if (disableMasterTransport) return;
            if (isRecording) {
              stop();
              return;
            }
            if (activeScreen === 'studio-editor') {
              const w = window as unknown as {
                __daMusicStudioTryRecord?: () => Promise<void>;
              };
              if (typeof w.__daMusicStudioTryRecord === 'function') {
                void w.__daMusicStudioTryRecord();
                return;
              }
              /**
               * Never use global Settings count-in on Studio: optional bars-only pre-count lives in
               * {@link StudioEditorScreen} (`studioPrecountEnabled`). If `__daMusicStudioTryRecord` is
               * missing (mount race), falling through to `countInEnabled` put transport in `counting`
               * even when Studio pre-count was off — same “surprise count-in” users reported.
               */
              record({ countIn: false, countInBeats });
              return;
            }
            record({ countIn: countInEnabled, countInBeats });
          }}
          title={disableMasterTransport ? 'Use transport in Studio Editor 2 (footer)' : isRecording ? 'Stop recording' : 'Record'}
          aria-pressed={isRecording}
          className={transportIconBtn}
          style={{
            background: isRecording ? '#ef4444' : '#2c2c2c',
            color: isRecording ? '#000' : '#888',
            border: `1px solid ${isRecording ? '#ef4444' : '#333'}`,
            opacity: disableMasterTransport ? 0.45 : 1,
            cursor: disableMasterTransport ? 'not-allowed' : undefined,
          }}
        >
          <Circle size={14} fill={isRecording ? '#000' : 'transparent'} />
        </button>
      </div>

      <div className="w-px h-8 shrink-0 mx-1" style={{ background: '#2a2a2a' }} />

      {/* ── Loop ── */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            if (loopEnabled) clearLoop();
            else setLoopEnabled(true);
          }}
          disabled={topLoopDisabled}
          className="flex items-center gap-1 px-2 h-7 rounded text-xs font-bold transition-all active:scale-90 active:opacity-70 disabled:opacity-45 disabled:cursor-not-allowed"
          style={{
            background: topLoopDisabled ? '#0d0d0d' : loopEnabled ? '#00E5FF22' : '#242424',
            color: topLoopDisabled ? '#444' : loopEnabled ? '#00E5FF' : '#555',
            border: `1px solid ${topLoopDisabled ? '#262626' : loopEnabled ? '#00E5FF44' : '#333'}`,
          }}
          title={loopDisabledForScreen ? 'Loop controls are disabled for this module' : undefined}
        >
          <Repeat size={11} /> LOOP
        </button>
        <select
          value={selectedLoopLength}
          onChange={e => {
            const n = Number(e.target.value);
            setLoopRange(loopStartBar, loopStartBar + n - 1, loopSection ?? undefined);
          }}
          disabled={topLoopDisabled}
          className="h-7 px-1.5 rounded text-xs font-bold outline-none transition-all active:scale-90 active:opacity-70 disabled:opacity-45 disabled:cursor-not-allowed"
          style={{
            background: topLoopDisabled ? '#0d0d0d' : '#242424',
            color: topLoopDisabled ? '#444' : loopEnabled ? '#00E5FF' : '#555',
            border: `1px solid ${topLoopDisabled ? '#262626' : loopEnabled ? '#00E5FF44' : '#333'}`,
          }}
          title={loopDisabledForScreen ? 'Loop controls are disabled for this module' : undefined}
        >
          {loopLengthSelectOptions.map(b => (
            <option key={b} value={b}>{b} bars</option>
          ))}
        </select>
        {loopSection != null && loopSection !== '' && (
          <span
            className="px-1.5 h-7 rounded text-xs font-bold flex items-center"
            style={{ background: '#242424', color: '#00E5FF', border: '1px solid #00E5FF44' }}
            title="Loop section label"
          >
            {loopSection}
          </span>
        )}
      </div>

      {/* ── Quantize ── */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-bold" style={{ color: '#555' }}>Q</span>
        <select value={quantize} onChange={e => setQuantize(e.target.value as QuantizeValue)}
          className="h-7 px-1.5 rounded text-xs font-bold outline-none transition-all active:scale-90 active:opacity-70"
          style={{ background: '#242424', color: '#D500F9', border: '1px solid #D500F944' }}>
          {QUANTIZE_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      </div>
        </div>
        <MasterVU masterLevel={masterLevel} barWidth={200} />
      </div>

      <div className="w-px h-8 shrink-0 mx-1" style={{ background: '#2a2a2a' }} />

      <button
        onClick={() => setMetronomeEnabled(!metronomeEnabled)}
        title="Metronome: audible click track. Studio timeline playhead is cyan; this MET button is magenta for clicks only. Toolbar MET lamp = visual quarter pulse."
        className="px-2 h-7 rounded text-xs font-bold shrink-0 transition-all active:scale-90 active:opacity-70"
        style={{ background: metronomeEnabled ? '#D500F9' : '#2c2c2c', color: metronomeEnabled ? '#000' : '#888', border: `1px solid ${metronomeEnabled ? '#D500F9' : '#2a2a2a'}` }}
      >
        MET
      </button>

      <button onClick={() => setMidiClockEnabled(!midiClockEnabled)} title="Send MIDI clock to hardware"
        className="px-2 h-7 rounded text-xs font-bold shrink-0 transition-all active:scale-90 active:opacity-70"
        style={{ background: midiClockEnabled ? '#00E5FF' : '#2c2c2c', color: midiClockEnabled ? '#000' : '#888', border: `1px solid ${midiClockEnabled ? '#00E5FF' : '#2a2a2a'}` }}>
        MIDI
      </button>

      {/* Pre-Count — metronome clicks before Record (MasterClock record path) */}
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={countInBeats}
          onChange={(e) => setCountInBeats(Number(e.target.value))}
          title="Number of metronome clicks (quarter notes) before Record starts"
          className="h-7 rounded text-[10px] font-bold shrink-0 cursor-pointer"
          style={{
            background: '#141414',
            color: countInEnabled ? '#ff9800' : '#666',
            border: '1px solid #333',
            padding: '0 2px',
            maxWidth: 52,
          }}
        >
          <option value={1}>1 beat</option>
          <option value={2}>2 beats</option>
          <option value={3}>3 beats</option>
          <option value={4}>4 beats</option>
          <option value={8}>8 beats</option>
        </select>
        <button onClick={() => setCountInEnabled(!countInEnabled)} title={`Precount on/off (default ON): ${countInBeats} beat(s) before Record — same click as MET.`}
          className="px-2 h-7 rounded text-xs font-bold shrink-0 transition-all active:scale-90 active:opacity-70"
          style={{ background: countInEnabled ? (transport === 'counting' ? '#ff6b6b' : '#ff9800') : '#2c2c2c', color: countInEnabled ? '#000' : '#888', border: `1px solid ${countInEnabled ? '#ff9800' : '#2a2a2a'}`, boxShadow: transport === 'counting' ? '0 0 12px #ff6b6b' : 'none' }}>
          {transport === 'counting' && countDownTicks > 0 ? Math.max(1, Math.ceil(countDownTicks / PPQ)) : 'PRE'}
        </button>
        
        {/* Visual beat indicators during pre-count */}
        {transport === 'counting' && countInEnabled && (
          <div className="flex gap-1 items-center">
            {Array.from({ length: Math.min(8, countInBeats) }, (_, i) => i + 1).map((beatNum) => {
              const remainingBeats = Math.max(0, Math.ceil(countDownTicks / PPQ));
              const completed = Math.max(0, countInBeats - remainingBeats);
              const isActive = beatNum <= completed;
              return (
                <div key={beatNum}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: isActive ? '#ff9800' : '#2c2c2c',
                    border: `2px solid ${isActive ? '#ff9800' : '#333'}`,
                    boxShadow: isActive ? '0 0 6px #ff9800' : 'none',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    color: isActive ? '#000' : '#444'
                  }}>
                  {beatNum}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={() => setPatternMode(!patternMode)}
        className="px-2 h-7 rounded text-xs font-bold shrink-0 transition-all active:scale-90 active:opacity-70"
        style={{ background: '#2c2c2c', color: patternMode ? '#D500F9' : '#00E5FF', border: `1px solid ${patternMode ? '#D500F9' : '#00E5FF'}` }}>
        {patternMode ? 'PAT' : 'SONG'}
      </button>

      <div className="w-px h-8 shrink-0 mx-1" style={{ background: '#2a2a2a' }} />

      {/* ── Project Management ── */}
      <div className="flex items-center gap-2 shrink-0">
        <div style={{ position: 'relative' }} ref={saveAsRef}>
          <button onClick={handleSaveAll} title="Save project with name (Ctrl+S)"
            className="px-2 h-7 rounded text-xs font-bold transition-all active:scale-90 active:opacity-70 flex items-center gap-1.5"
            style={{ background: '#1a2a1a', color: '#00ff88', border: '1px solid #00ff8844' }}>
            <Save size={14} />
            SAVE
          </button>
        </div>
        <button onClick={() => setShowNewProjectDialog(true)} title="Create new project"
          className="px-2 h-7 rounded text-xs font-bold transition-all active:scale-90 active:opacity-70 flex items-center gap-1"
          style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF44' }}>
          <Plus size={12} />
          NEW
        </button>
        <button onClick={handleDeleteProject} title="Delete current project"
          className="px-2 h-7 rounded text-xs font-bold transition-all active:scale-90 active:opacity-70 flex items-center gap-1 whitespace-nowrap"
          style={{ background: '#2a1a1a', color: '#ff4444', border: '1px solid #ff444444' }}>
          <Trash2 size={12} />
          DEL
        </button>
      </div>

      {saveMessage && (
        <span className="text-xs font-bold shrink-0 ml-2" style={{ color: '#00ff88' }}>
          {saveMessage}
        </span>
      )}

      {/* ── Status dot ── */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full shrink-0"
          style={{ background: isPlaying ? '#00ff88' : isRecording ? '#ff4444' : '#2a2a2a',
            boxShadow: isPlaying ? '0 0 6px #00ff88' : isRecording ? '0 0 6px #ff4444' : 'none' }} />
        <span className="font-mono" style={{ color: isPlaying ? '#00ff88' : isRecording ? '#ff4444' : '#2a2a2a', fontSize: 9 }}>
          {isRecording ? 'REC' : isPlaying ? 'PLAY' : 'STOP'}
        </span>
      </div>
      </>
      )}

      {activeScreen === 'studio-editor-2' ? (
        <div className="shrink-0 flex items-center gap-2" style={{ marginRight: 14 }}>
          <Se2PerformanceStrip />
          <Se2FeatureShowcaseTicker />
        </div>
      ) : null}

      {onOpenOverview && (
        <button
          type="button"
          onClick={onOpenOverview}
          title="Da Music Box — product overview"
          className="h-8 rounded flex items-center justify-center shrink-0 transition-all active:scale-90 gap-1 px-2"
          style={{ background: '#2c2c2c', color: '#c8d0dc', border: '1px solid rgba(212, 220, 232, 0.25)' }}
        >
          <Sparkles size={14} />
          <span className="hidden sm:inline" style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4 }}>
            OVERVIEW
          </span>
        </button>
      )}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings — Audio I/O (Ctrl+,)"
          className="w-8 h-8 rounded flex items-center justify-center shrink-0 transition-all active:scale-90"
          style={{ background: '#2c2c2c', color: '#888', border: '1px solid #333' }}
        >
          <Settings size={15} />
        </button>
      )}
      </div>

      {/* Save / New dialogs — always mounted (Ctrl+S works on every screen) */}
      {showSaveAsDialog && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#222222',
          border: '2px solid #00ff88',
          borderRadius: 12,
          padding: 24,
          zIndex: 10000,
          minWidth: 320,
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0, 255, 136, 0.3), 0 0 40px rgba(0, 255, 136, 0.1)'
        }}>
          <h3 style={{ color: '#00ff88', fontSize: 14, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
            SAVE PROJECT
          </h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Project Name
            </label>
            <input
              type="text"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveAsConfirm()}
              placeholder="Enter project name..."
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#2c2c2c',
                border: '1px solid #333',
                borderRadius: 6,
                color: '#00ff88',
                fontSize: 13,
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#00ff88';
                e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 255, 136, 0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              onClick={handleSaveAsConfirm}
              style={{
                padding: '10px 16px',
                background: '#00ff88',
                color: '#000',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveAsDialog(false)}
              style={{
                padding: '10px 16px',
                background: '#2c2c2c',
                color: '#888',
                border: '1px solid #444',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {showSaveAsDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9999,
          backdropFilter: 'blur(2px)'
        }} onClick={() => setShowSaveAsDialog(false)} />
      )}

      {showNewProjectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} ref={menuRef}>
          <div className="p-6 rounded-xl" style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', minWidth: 300 }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: '#fff' }}>New Project</h2>
            <input
              type="text"
              placeholder="Project name (optional)"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
              autoFocus
              className="w-full px-3 py-2 rounded text-xs mb-4 outline-none"
              style={{ background: '#2c2c2c', color: '#fff', border: '1px solid #2a2a2a' }}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNewProjectDialog(false)}
                className="flex-1 px-3 py-2 rounded text-xs font-bold"
                style={{ background: '#2c2c2c', color: '#888' }}>
                Cancel
              </button>
              <button onClick={handleNewProject}
                className="flex-1 px-3 py-2 rounded text-xs font-bold"
                style={{ background: '#00ff88', color: '#000' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
