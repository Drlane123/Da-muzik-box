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
import UiScaleBootstrap from '@/app/components/UiScaleBootstrap';
import UiBrightnessBootstrap from '@/app/components/UiBrightnessBootstrap';
import KeyboardShortcutsBootstrap from '@/app/components/KeyboardShortcutsBootstrap';
import MidiInputFocus from '@/app/components/MidiInputFocus';
import PwaUpdateBanner from '@/app/components/PwaUpdateBanner';

import { type ScreenId } from '@/app/lib/navigation/moduleNav';
import type { CreationSubScreenId } from '@/app/lib/creationStation/creationSubScreens';
import {
  screenToVocalLabSubScreen,
  type VocalLabSubScreenId,
} from '@/app/lib/vocalLab/vocalLabSubScreens';


const AiSongScreen = lazy(() => import('@/app/screens/AiSongScreen'));
const AiMusicMatchScreen = lazy(() => import('@/app/screens/AiMusicMatchScreen'));
const CreationStationScreen = lazy(() => loadCreationStationScreen());
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
import { loadCreationStationScreen } from '@/app/lib/boot/beatLabBootGate';
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
        background: '#0a0a0a',
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
      {import.meta.env.DEV ? (
        <div
          style={{
            fontSize: 10,
            opacity: 0.55,
            maxWidth: 320,
            textAlign: 'center',
            lineHeight: 1.45,
          }}
        >
          First open compiles large screens in Cursor — Beat Lab can take 1–2 minutes. Keep one tab on{' '}
          <code style={{ opacity: 0.9 }}>localhost:5173</code>.
        </div>
      ) : null}
    </div>
  );
}

class LazyScreenErrorBoundary extends React.Component<
  { moduleName: string; children: React.ReactNode },
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
            background: '#383839',
            color: '#e8e8f0',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, color: '#7cf4c6' }}>
            {this.props.moduleName} could not load
          </p>
          <p style={{ fontSize: 12, color: '#9a9aa8', maxWidth: 420, lineHeight: 1.5 }}>
            {import.meta.env.DEV
              ? 'In Cursor dev, wait for Vite to finish compiling, then reload. If you used preview before, hard-refresh clears stale chunks (Ctrl+Shift+R).'
              : 'Try a hard refresh (Ctrl+Shift+R). You can open another screen from the sidebar.'}
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
            background: '#383839',
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
      <LazyScreenErrorBoundary moduleName={moduleName}>
        <Suspense fallback={<AppBootFallback moduleName={moduleName} />}>{children}</Suspense>
      </LazyScreenErrorBoundary>
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
  const [activeScreen, setActiveScreen] = useState<ScreenId>(() => 'studio-editor-2');
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
  /**
   * Keep a module mounted after its first open (SE2-style). Conditional unmount + Suspense
   * made the first Modules click look dead until you left and came back.
   */
  const [visitedScreens, setVisitedScreens] = useState<ReadonlySet<ScreenId>>(
    () => new Set<ScreenId>(['studio-editor-2']),
  );
  const { settings } = useSettings();

  const navigateToScreen = useCallback((id: ScreenId) => {
    setVisitedScreens((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setActiveScreen(id);
  }, []);

  const shouldMountScreen = useCallback(
    (id: ScreenId) => visitedScreens.has(id) || activeScreen === id,
    [visitedScreens, activeScreen],
  );

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

  /**
   * Do NOT force `setActiveScreen('studio-editor-2')` on mount — initial state already is SE2.
   * A post-paint force was racing the first Modules click and snapping back to SE2
   * (Beat Lab / Vocal Lab / Mastering Bay looked like they “wouldn’t load” until a second visit).
   */

  /** Warm common module chunks after SE2 has settled so first clicks rarely wait on network. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      void import('@/app/screens/VocalLabScreen');
      void loadCreationStationScreen();
      void import('@/app/screens/MasterArrangerScreen');
      void import('@/app/screens/ExportScreen');
      void import('@/app/screens/MyProjectsScreen');
    }, 600);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const openSe2 = () => navigateToScreen('studio-editor-2');
    window.addEventListener(BEAT_PADS_OPEN_SE2_EVENT, openSe2);
    return () => window.removeEventListener(BEAT_PADS_OPEN_SE2_EVENT, openSe2);
  }, [navigateToScreen]);

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
        navigateToScreen('creation-station');
        return;
      }
      const screen = resolveScreen(a);
      if (screen === 'studio-editor-2' && b instanceof Blob && b.size > 0) {
        setPendingStudioAudioBlob(b);
      }
      navigateToScreen(screen);
      return;
    }
    if (Array.isArray(a) && typeof b === 'string') {
      navigateToScreen(resolveScreen(b));
    }
  }

  return (
    <div className="flex flex-col w-full overflow-hidden" style={{ height: '100vh', background: '#303030', color: '#f0f0f0' }}>
      <TouchDeviceBootstrap />
      <UiScaleBootstrap />
      <UiBrightnessBootstrap />
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
        onScreenChange={navigateToScreen}
        activeCreationSubScreen={creationSubScreen}
        onCreationSubScreenChange={setCreationSubScreen}
        activeVocalLabSubScreen={vocalLabSubScreen}
        onVocalLabSubScreenChange={setVocalLabSubScreen}
      />
      <MidiInputFocus
        activeScreen={activeScreen}
        creationSubScreen={creationSubScreen}
        midiInputEnabled={settings.midiInputEnabled}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main
          className="flex-1 min-w-0 min-h-0 overflow-hidden relative w-full"
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', background: '#303030' }}
        >
          <LazyScreenMount active={activeScreen === 'vocal-lab'} moduleName="Vocal Lab">
            {shouldMountScreen('vocal-lab') ? (
            <VocalLabScreen
              onExport={handleExport}
              onNeuralHumToStudio={(payload) => {
                setPendingNeuralHumStudioImport(payload);
                navigateToScreen('studio-editor-2');
              }}
              onNeuralHumToCreation={(payload) => {
                publishNeuralHumCreationImport(payload);
                setCreationSubScreen(payload.target === 'groove-lab' ? 'groove-lab' : 'beat-lab');
                navigateToScreen('creation-station');
              }}
            />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'ai-song'} moduleName="AI Song">
            {shouldMountScreen('ai-song') ? <AiSongScreen onExport={handleExport} /> : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'ai-music-match'} moduleName="AI Music Match">
            {shouldMountScreen('ai-music-match') ? (
              <AiMusicMatchScreen
                onOpenGrooveLab={() => {
                  setCreationSubScreen('groove-lab');
                  navigateToScreen('creation-station');
                }}
                onExportStudio={(payload) => {
                  setPendingAiMatchStudioImport(payload);
                  navigateToScreen('studio-editor-2');
                }}
              />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'ai-pattern'} moduleName="AI Pattern">
            {shouldMountScreen('ai-pattern') ? (
              <AiPatternScreen
                onExport={handleExport}
                isScreenActive={activeScreen === 'ai-pattern'}
              />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'melody-transcription'} moduleName="Melody Transcription">
            {shouldMountScreen('melody-transcription') ? (
            <MelodyTranscriptionScreen onExport={handleExport} onBack={() => navigateToScreen('vocal-lab')} />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'harmony-match'} moduleName="Harmony Match">
            {shouldMountScreen('harmony-match') ? (
            <HarmonyMatchScreen
              onOpenGrooveLab={() => {
                setCreationSubScreen('groove-lab');
                navigateToScreen('creation-station');
              }}
            />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'creation-station'} moduleName="Beat Lab">
            {shouldMountScreen('creation-station') ? (
              <CreationStationScreen
                onExport={handleExport}
                onBeatPadsToStudio={(payload) => {
                  setPendingBeatPadsStudioImport(payload);
                  navigateToScreen('studio-editor-2');
                }}
                isScreenActive={activeScreen === 'creation-station'}
                creationSubScreen={creationSubScreen}
                onCreationSubScreenChange={setCreationSubScreen}
              />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'studio-editor'} moduleName="Studio Editor">
            {shouldMountScreen('studio-editor') ? (
            <StudioEditorScreen
              onExport={handleExport}
              pendingStudioAudioBlob={pendingStudioAudioBlob}
              onPendingStudioAudioConsumed={clearPendingStudioAudio}
              pendingCloudStudioJson={pendingStudioCloudJson}
              onPendingCloudStudioConsumed={clearPendingStudioCloud}
              isStudioScreenActive={activeScreen === 'studio-editor'}
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
                  setCreationSubScreen('beat-lab');
                  navigateToScreen('creation-station');
                }}
                pendingAiMatchStudioImport={pendingAiMatchStudioImport}
                onPendingAiMatchStudioConsumed={clearPendingAiMatchStudio}
                onExportToMasteringBay={(payload) => {
                  setPendingMasteringBayImport(payload);
                  navigateToScreen('master-arranger');
                }}
              />
            </StudioEditor2ErrorBoundary>
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'my-projects'} moduleName="My Projects">
            {shouldMountScreen('my-projects') ? (
            <MyProjectsScreen
              onOpenStudioWithCloudProject={(studioTimelineJson) => {
                setPendingStudioCloudJson(studioTimelineJson);
                navigateToScreen('studio-editor');
              }}
              onNavigate={(screen) => navigateToScreen(screen as ScreenId)}
            />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'master-arranger'} moduleName="Mastering Bay">
            {shouldMountScreen('master-arranger') ? (
              <MasterArrangerScreen onExport={handleExport} />
            ) : null}
          </LazyScreenMount>
          <LazyScreenMount active={activeScreen === 'export'} moduleName="Export">
            {shouldMountScreen('export') ? <ExportScreen /> : null}
          </LazyScreenMount>
        </main>
      </div>
    </div>
  );
}


export default function App() {
  /** Cursor dev: skip splash — go straight to the app for editing. Production keeps full boot. */
  const [bootSplashDone, setBootSplashDone] = useState(() => import.meta.env.DEV);

  return (
    <SettingsProvider>
      {!bootSplashDone ? (
        <DaMuzikBoxBootSplash onComplete={() => setBootSplashDone(true)} />
      ) : (
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
      )}
      {import.meta.env.PROD ? <PwaUpdateBanner /> : null}
    </SettingsProvider>
  );
}
