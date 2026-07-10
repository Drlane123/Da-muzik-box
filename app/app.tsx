'use client';


import '@/app/globals.css';

import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { MasterClockProvider } from '@/app/context/MasterClockContext';

import { SettingsProvider, useSettings } from '@/app/context/SettingsContext';

import { studioMicTrackConstraints } from '@/app/lib/audioRouting';

import AudioDeviceBinder from '@/app/components/AudioDeviceBinder';

import SettingsModal from '@/app/components/SettingsModal';

import { SongArrangerProvider } from '@/app/context/SongArrangerContext';

import { ViewProvider } from '@/app/context/ViewContext';

import { PianoNotesProvider } from '@/app/context/PianoNotesContext';

import { TrackAllocationProvider } from '@/app/context/TrackAllocationContext';

import TitleBar from '@/app/components/TitleBar';
import { MusicBoxOverviewModal } from '@/app/components/MusicBoxOverviewHub';
import TouchDeviceBootstrap from '@/app/components/TouchDeviceBootstrap';
import KeyboardShortcutsBootstrap from '@/app/components/KeyboardShortcutsBootstrap';
import MidiInputFocus from '@/app/components/MidiInputFocus';

import NavigationSidebar, { type ScreenId } from '@/app/components/NavigationSidebar';
import type { CreationSubScreenId } from '@/app/lib/creationStation/creationSubScreens';
import {
  screenToVocalLabSubScreen,
  type VocalLabSubScreenId,
} from '@/app/lib/vocalLab/vocalLabSubScreens';


const AiSongScreen = lazy(() => import('@/app/screens/AiSongScreen'));
const AiMusicMatchScreen = lazy(() => import('@/app/screens/AiMusicMatchScreen'));
const CreationStationScreen = lazy(() => import('@/app/screens/CreationStationScreen'));
const VocalLabScreen = lazy(() => import('@/app/screens/VocalLabScreen'));
const AiPatternScreen = lazy(() => import('@/app/screens/AiPatternScreen'));
const MelodyTranscriptionScreen = lazy(() => import('@/app/screens/MelodyTranscriptionScreen'));
const HarmonyMatchScreen = lazy(() => import('@/app/screens/HarmonyMatchScreen'));
const StudioEditorScreen = lazy(() => import('@/app/screens/StudioEditorScreen'));
const StudioEditor2Screen = lazy(() => import('@/app/screens/StudioEditor2Screen'));
const MyProjectsScreen = lazy(() => import('@/app/screens/MyProjectsScreen'));
const MasterArrangerScreen = lazy(() => import('@/app/screens/MasterArrangerScreen'));
const ExportScreen = lazy(() => import('@/app/screens/ExportScreen'));
import type { PendingNeuralHumStudioImport } from '@/app/lib/vocalLab/neuralHumStudioExport';
import { BEAT_PADS_OPEN_SE2_EVENT, markBeatPadsSe2BridgeInactive } from '@/app/lib/creationStation/beatPadsSe2Bridge';
import type { PendingBeatPadsStudioImport } from '@/app/lib/creationStation/beatPadsStudioExport';
import type { PendingAiMatchStudioImport } from '@/app/lib/aiMusicMatch/aiMusicMatchStudioExport';
import { setPendingMasteringBayImport } from '@/app/lib/masteringBay/masteringBayPendingImport';
import { DaMuzikBoxBootSplash } from '@/app/components/DaMuzikBoxBootSplash';
import {
  publishNeuralHumCreationImport,
  type PendingNeuralHumCreationImport,
} from '@/app/lib/vocalLab/neuralHumCreationExport';


function AppBootFallback({ moduleName }: { moduleName?: string }) {
  return (
    <div
      style={{
        flex: '1 1 0%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minWidth: 0,
        minHeight: 0,
        background: '#050508',
        color: '#9a9ab0',
      }}
    >
      <div
        style={{
          fontFamily: 'Rajdhani, system-ui, sans-serif',
          fontSize: 20,
          fontWeight: 600,
          color: '#ececf4',
          letterSpacing: '0.04em',
        }}
      >
        Da Music Box
      </div>
      <div style={{ fontSize: 11, opacity: 0.85 }}>
        {moduleName ? `Loading ${moduleName}…` : 'Loading module…'}
      </div>
      <div
        style={{
          fontSize: 10,
          opacity: 0.55,
          maxWidth: 320,
          textAlign: 'center',
          lineHeight: 1.45,
        }}
      >
        Dev mode compiles large screens on first open — Beat Lab ~1–2 min, Studio Editor 2 ~1–2 min.
        Use one browser tab only; extra tabs can freeze the dev server. Hard refresh after restarting{' '}
        <code style={{ opacity: 0.9 }}>bun run dev</code>. For instant load, run{' '}
        <code style={{ opacity: 0.9 }}>bun run preview</code> after a build.
      </div>
    </div>
  );
}

class StudioEditor2ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            height: '100%',
            padding: 24,
            background: '#060607',
            color: '#e8e8f0',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, color: '#7cf4c6' }}>Studio Editor 2 could not load</p>
          <p style={{ fontSize: 12, color: '#9a9aa8', maxWidth: 420, lineHeight: 1.5 }}>
            Try reloading the page, or open another screen from the sidebar. Your project data is still saved.
          </p>
          <pre
            style={{
              fontSize: 10,
              color: '#6a6a78',
              maxWidth: 480,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(124,244,198,0.45)',
              background: 'rgba(124,244,198,0.12)',
              color: '#7cf4c6',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Default behavior: keep screens mounted and hide via CSS.
 * Some modules may still be conditionally unmounted by AppContent to enforce
 * strict runtime isolation from Studio transport/sync while hidden.
 */
function LazyScreenMount({
  active,
  moduleName,
  children,
}: {
  active: boolean;
  moduleName: string;
  children: React.ReactNode;
}) {
  return (
    <ScreenMount active={active}>
      <Suspense fallback={<AppBootFallback moduleName={moduleName} />}>{children}</Suspense>
    </ScreenMount>
  );
}

function ScreenMount({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: active ? 'flex' : 'none',
        flexDirection: 'column',
        /** Fill <main> flex row — without flex:1 the only visible screen can collapse to 0 width (blank area). */
        flex: active ? '1 1 0%' : '0 0 0',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}


function AppContent() {
  const [showSettings, setShowSettings] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [activeScreen, setActiveScreen] = useState<ScreenId>('creation-station');
  const [creationSubScreen, setCreationSubScreen] = useState<CreationSubScreenId>('beat-lab');
  const [vocalLabSubScreen, setVocalLabSubScreen] = useState<VocalLabSubScreenId>('vocal-lab');
  /** Passed to Studio Editor when navigating from Vocal Lab with a recorded/uploaded blob. */
  const [pendingStudioAudioBlob, setPendingStudioAudioBlob] = useState<Blob | null>(null);
  /** Neural Hum melody + optional instrument WAV → Studio Editor 2 MIDI track. */
  const [pendingNeuralHumStudioImport, setPendingNeuralHumStudioImport] =
    useState<PendingNeuralHumStudioImport | null>(null);
  const [pendingBeatPadsStudioImport, setPendingBeatPadsStudioImport] =
    useState<PendingBeatPadsStudioImport | null>(null);
  const [pendingAiMatchStudioImport, setPendingAiMatchStudioImport] =
    useState<PendingAiMatchStudioImport | null>(null);
  /** Full Studio JSON string from Supabase `data.studioProjectV1` (applied once in StudioEditorScreen). */
  const [pendingStudioCloudJson, setPendingStudioCloudJson] = useState<string | null>(null);
  const { settings } = useSettings();

  const clearPendingStudioAudio = useCallback(() => {
    setPendingStudioAudioBlob(null);
  }, []);

  const clearPendingNeuralHumStudio = useCallback(() => {
    setPendingNeuralHumStudioImport(null);
  }, []);

  const clearPendingBeatPadsStudio = useCallback(() => {
    setPendingBeatPadsStudioImport(null);
  }, []);

  const clearPendingAiMatchStudio = useCallback(() => {
    setPendingAiMatchStudioImport(null);
  }, []);

  const clearPendingStudioCloud = useCallback(() => {
    setPendingStudioCloudJson(null);
  }, []);

  useEffect(() => {
    const sub = screenToVocalLabSubScreen(activeScreen);
    if (sub) setVocalLabSubScreen(sub);
  }, [activeScreen]);

  /** Fresh load always lands on Creation Station → Beat Lab (user can navigate away after). */
  useEffect(() => {
    setActiveScreen('creation-station');
    setCreationSubScreen('beat-lab');
  }, []);

  useEffect(() => {
    const openSe2 = () => setActiveScreen('studio-editor-2');
    window.addEventListener(BEAT_PADS_OPEN_SE2_EVENT, openSe2);
    return () => window.removeEventListener(BEAT_PADS_OPEN_SE2_EVENT, openSe2);
  }, []);

  useEffect(() => {
    if (activeScreen === 'studio-editor-2') return;
    markBeatPadsSe2BridgeInactive();
  }, [activeScreen]);

  /**
   * Studio-only DAW record arm hook: isolates Studio recording pipeline from
   * AI Pattern / Creation Station / Arranger while Studio transport is being hardened.
   */
  useEffect(() => {
    const w = window as unknown as {
      __daMusicStudioRecordArm?: () => Promise<void>;
      __daMusicStudioMicStream?: MediaStream | null;
      __daMusicStudio2RecordInputDeviceId?: string;
    };
    if (activeScreen !== 'studio-editor' && activeScreen !== 'studio-editor-2') {
      delete w.__daMusicStudioRecordArm;
      return;
    }
    w.__daMusicStudioRecordArm = async () => {
      const prev = w.__daMusicStudioMicStream;
      if (prev?.getTracks().some((t) => t.readyState === 'live')) {
        /* Re-open getUserMedia after every count-in without this: `record()` stalls past the downbeat
         * and the transport MET phase-shifts away from Studio precount clicks. */
        return;
      }
      if (prev) prev.getTracks().forEach((t) => t.stop());
      w.__daMusicStudioMicStream = null;
      const v2 = w.__daMusicStudio2RecordInputDeviceId;
      const inputDeviceId =
        activeScreen === 'studio-editor-2' && typeof v2 === 'string' && v2.length > 0
          ? v2
          : settings.audioInput;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: studioMicTrackConstraints(inputDeviceId),
      });
      w.__daMusicStudioMicStream = stream;
    };
    return () => {
      delete w.__daMusicStudioRecordArm;
      const s = w.__daMusicStudioMicStream;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        w.__daMusicStudioMicStream = null;
      }
    };
  }, [activeScreen, settings.audioInput]);

  useEffect(() => {
    const onOpenSettings = () => setShowSettings(true);
    window.addEventListener('openSettings', onOpenSettings);
    return () => window.removeEventListener('openSettings', onOpenSettings);
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      __daMusicStudioTransportAuthority?: boolean;
    };
    /**
     * When false, {@link MasterClockContext} `play` / `record` no-op (avoids other modules starting transport).
     * Studio Editor (v1) and Creation Station share `MasterClockProvider` transport — both may start/stop.
     * Studio Editor 2 uses its own Web Audio transport; it does not call master `play`, so leaving authority
     * false there is fine. Creation Station must be allowed or Play does nothing. Export’s demo preview calls
     * the same `play` / `pause` — include it or the preview strip never receives transport.
     */
    w.__daMusicStudioTransportAuthority =
      activeScreen === 'studio-editor' ||
      activeScreen === 'creation-station' ||
      activeScreen === 'export' ||
      activeScreen === 'master-arranger';
    return () => {
      delete w.__daMusicStudioTransportAuthority;
    };
  }, [activeScreen]);

  /** Supports: (screenId), (screenId, audioBlob), or (midiNotes[], screenId) from Melody Transcription. */
  function handleExport(a: string | unknown[], b?: string | Blob) {
    const resolveScreen = (id: string): ScreenId =>
      id === 'studio-editor' ? 'studio-editor-2' : (id as ScreenId);

    if (typeof a === 'string') {
      if (a === 'groove-lab' || a === 'new-synth') {
        setCreationSubScreen(a === 'groove-lab' ? 'groove-lab' : 'beat-lab');
        setActiveScreen('creation-station');
        return;
      }
      const screen = resolveScreen(a);
      if (screen === 'studio-editor-2' && b instanceof Blob && b.size > 0) {
        setPendingStudioAudioBlob(b);
      }
      setActiveScreen(screen);
      return;
    }
    if (Array.isArray(a) && typeof b === 'string') {
      setActiveScreen(resolveScreen(b));
    }
  }

  return (
    <div className="flex flex-col w-full overflow-hidden" style={{ height: '100vh', background: '#000', color: '#ccc' }}>
      <TouchDeviceBootstrap />
      <KeyboardShortcutsBootstrap
        activeScreen={activeScreen}
        onOpenSettings={() => setShowSettings(true)}
      />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <MusicBoxOverviewModal open={showOverview} onClose={() => setShowOverview(false)} />
      <TitleBar
        onOpenSettings={() => setShowSettings(true)}
        onOpenOverview={() => setShowOverview(true)}
        activeScreen={activeScreen}
      />
      <MidiInputFocus
        activeScreen={activeScreen}
        creationSubScreen={creationSubScreen}
        midiInputEnabled={settings.midiInputEnabled}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <NavigationSidebar
          activeScreen={activeScreen}
          onScreenChange={setActiveScreen}
          activeCreationSubScreen={creationSubScreen}
          onCreationSubScreenChange={setCreationSubScreen}
          activeVocalLabSubScreen={vocalLabSubScreen}
          onVocalLabSubScreenChange={setVocalLabSubScreen}
        />
        <main
          className="flex-1 min-w-0 min-h-0 overflow-hidden relative"
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}
        >
          <LazyScreenMount active={activeScreen === 'vocal-lab'} moduleName="Vocal Lab">
            {activeScreen === 'vocal-lab' ? (
            <VocalLabScreen
              onExport={handleExport}
              onNeuralHumToStudio={(payload) => {
                setPendingNeuralHumStudioImport(payload);
                setActiveScreen('studio-editor-2');
              }}
              onNeuralHumToCreation={(payload) => {
                publishNeuralHumCreationImport(payload);
                setCreationSubScreen(payload.target === 'groove-lab' ? 'groove-lab' : 'beat-lab');
                setActiveScreen('creation-station');
              }}
            />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'ai-song'} moduleName="AI Song">
            {activeScreen === 'ai-song' ? <AiSongScreen onExport={handleExport} /> : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'ai-music-match'} moduleName="AI Music Match">
            {activeScreen === 'ai-music-match' ? (
              <AiMusicMatchScreen
                onOpenGrooveLab={() => {
                  setCreationSubScreen('groove-lab');
                  setActiveScreen('creation-station');
                }}
                onExportStudio={(payload) => {
                  setPendingAiMatchStudioImport(payload);
                  setActiveScreen('studio-editor-2');
                }}
              />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'ai-pattern'} moduleName="AI Pattern">
            {activeScreen === 'ai-pattern' ? (
              <AiPatternScreen
                onExport={handleExport}
                isScreenActive
              />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'melody-transcription'} moduleName="Melody Transcription">
            {activeScreen === 'melody-transcription' ? (
            <MelodyTranscriptionScreen onExport={handleExport} onBack={() => setActiveScreen('vocal-lab')} />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'harmony-match'} moduleName="Harmony Match">
            {activeScreen === 'harmony-match' ? (
            <HarmonyMatchScreen
              onOpenGrooveLab={() => {
                setCreationSubScreen('groove-lab');
                setActiveScreen('creation-station');
              }}
            />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'creation-station'} moduleName="Beat Lab">
            {activeScreen === 'creation-station' ? (
              <CreationStationScreen
                onExport={handleExport}
                onBeatPadsToStudio={(payload) => {
                  setPendingBeatPadsStudioImport(payload);
                  setActiveScreen('studio-editor-2');
                }}
                isScreenActive
                creationSubScreen={creationSubScreen}
                onCreationSubScreenChange={setCreationSubScreen}
              />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'studio-editor'} moduleName="Studio Editor">
            {activeScreen === 'studio-editor' ? (
            <StudioEditorScreen
              onExport={handleExport}
              pendingStudioAudioBlob={pendingStudioAudioBlob}
              onPendingStudioAudioConsumed={clearPendingStudioAudio}
              pendingCloudStudioJson={pendingStudioCloudJson}
              onPendingCloudStudioConsumed={clearPendingStudioCloud}
              isStudioScreenActive
            />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'studio-editor-2'} moduleName="Studio Editor 2">
            <StudioEditor2ErrorBoundary>
              <StudioEditor2Screen
                isScreenActive={activeScreen === 'studio-editor-2'}
                pendingStudioAudioBlob={pendingStudioAudioBlob}
                onPendingStudioAudioConsumed={clearPendingStudioAudio}
                pendingNeuralHumStudioImport={pendingNeuralHumStudioImport}
                onPendingNeuralHumStudioConsumed={clearPendingNeuralHumStudio}
                pendingBeatPadsStudioImport={pendingBeatPadsStudioImport}
                onPendingBeatPadsStudioConsumed={clearPendingBeatPadsStudio}
                onOpenBeatLab={() => {
                  setActiveScreen('creation-station');
                  setCreationSubScreen('beat-lab');
                }}
                pendingAiMatchStudioImport={pendingAiMatchStudioImport}
                onPendingAiMatchStudioConsumed={clearPendingAiMatchStudio}
                onExportToMasteringBay={(payload) => {
                  setPendingMasteringBayImport(payload);
                  setActiveScreen('master-arranger');
                }}
              />
            </StudioEditor2ErrorBoundary>
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'my-projects'} moduleName="My Projects">
            {activeScreen === 'my-projects' ? (
            <MyProjectsScreen
              onOpenStudioWithCloudProject={(studioTimelineJson) => {
                setPendingStudioCloudJson(studioTimelineJson);
                setActiveScreen('studio-editor');
              }}
              onNavigate={(screen) => setActiveScreen(screen as ScreenId)}
            />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'master-arranger'} moduleName="Mastering Bay">
            {activeScreen === 'master-arranger' ? (
            <MasterArrangerScreen onExport={handleExport} />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'export'} moduleName="Export">
            {activeScreen === 'export' ? <ExportScreen /> : null}
          </LazyScreenMount>
        </main>
      </div>
    </div>
  );
}


export default function App() {
  const [bootSplashDone, setBootSplashDone] = useState(false);

  return (
    <SettingsProvider>
      <MasterClockProvider>
        <AudioDeviceBinder />
        <SongArrangerProvider>
          <ViewProvider>
            <PianoNotesProvider>
              <TrackAllocationProvider>
                <AppContent />
              </TrackAllocationProvider>
            </PianoNotesProvider>
          </ViewProvider>
        </SongArrangerProvider>
      </MasterClockProvider>
      {!bootSplashDone ? (
        <DaMuzikBoxBootSplash onComplete={() => setBootSplashDone(true)} />
      ) : null}
    </SettingsProvider>
  );
}
