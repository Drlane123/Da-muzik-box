'use client';


import '@/app/globals.css';

import React, { useCallback, useEffect, useState, type ReactNode } from 'react';

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
import {
  prefetchModuleScreen,
  prefetchCommonModuleScreens,
  SCREEN_MODULE_LOADERS,
} from '@/app/lib/navigation/prefetchModuleScreens';
import { useScreenModule, type ScreenComponent } from '@/app/lib/navigation/useScreenModule';
import type { CreationSubScreenId } from '@/app/lib/creationStation/creationSubScreens';
import {
  screenToVocalLabSubScreen,
  type VocalLabSubScreenId,
} from '@/app/lib/vocalLab/vocalLabSubScreens';

import type { PendingNeuralHumStudioImport } from '@/app/lib/vocalLab/neuralHumStudioExport';
import { BEAT_PADS_OPEN_SE2_EVENT, markBeatPadsSe2BridgeInactive } from '@/app/lib/creationStation/beatPadsSe2Bridge';
import type { PendingBeatPadsStudioImport } from '@/app/lib/creationStation/beatPadsStudioExport';
import type { PendingAiMatchStudioImport } from '@/app/lib/aiMusicMatch/aiMusicMatchStudioExport';
import { setPendingMasteringBayImport } from '@/app/lib/masteringBay/masteringBayPendingImport';
import type { MasteringBaySourcePayload } from '@/app/lib/masteringBay/masteringBaySourceTrack';
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
        gap: 12,
        minWidth: 0,
        minHeight: 0,
        background: '#121214',
        color: '#9a9ab0',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid rgba(0,229,255,0.25)',
          borderTopColor: '#00E5FF',
          animation: 'dmb-module-spin 0.7s linear infinite',
        }}
      />
      <div
        style={{
          fontFamily: 'Rajdhani, system-ui, sans-serif',
          fontSize: 18,
          fontWeight: 700,
          color: '#ececf4',
          letterSpacing: '0.06em',
        }}
      >
        {moduleName ? `Loading ${moduleName}` : 'Loading module'}
      </div>
      <div style={{ fontSize: 11, opacity: 0.75, maxWidth: 280, textAlign: 'center', lineHeight: 1.4 }}>
        First open downloads this module — stay on this screen, it will appear when ready.
      </div>
      <style>{`@keyframes dmb-module-spin { to { transform: rotate(360deg); } }`}</style>
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
 * Loads a screen with promise + useState (not React.lazy / Suspense).
 * Suspense + navigation left the spinner spinning until the user left and came back.
 */
function DeferredScreenMount({
  active,
  enabled,
  moduleName,
  screenId,
  children,
}: {
  active: boolean;
  enabled: boolean;
  moduleName: string;
  screenId: ScreenId;
  children: (Comp: ScreenComponent) => ReactNode;
}) {
  const { Comp, error } = useScreenModule(screenId, SCREEN_MODULE_LOADERS[screenId], enabled);

  let body: ReactNode = null;
  if (enabled) {
    if (error) {
      body = (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 24,
            background: '#121214',
            color: '#e8e8f0',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, color: '#00E5FF', margin: 0 }}>
            {moduleName} failed to load
          </p>
          <p style={{ fontSize: 12, color: '#9a9aa8', margin: 0 }}>{error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(0,229,255,0.45)',
              background: 'rgba(0,229,255,0.12)',
              color: '#00E5FF',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    } else if (!Comp) {
      body = <AppBootFallback moduleName={moduleName} />;
    } else {
      body = children(Comp);
    }
  }

  return (
    <ScreenMount active={active} screenId={screenId}>
      <LazyScreenErrorBoundary moduleName={moduleName}>{body}</LazyScreenErrorBoundary>
    </ScreenMount>
  );
}

function ScreenMount({
  active,
  screenId,
  children,
}: {
  active: boolean;
  screenId?: ScreenId;
  children: React.ReactNode;
}) {
  return (
    <div
      data-dmb-screen-mount={screenId ?? undefined}
      data-dmb-screen-active={active ? '1' : '0'}
      style={{
        display: active ? 'flex' : 'none',
        flexDirection: 'column',
        /** Fill <main> flex row — without flex:1 the only visible screen can collapse to 0 width (blank area). */
        flex: active ? '1 1 0%' : '0 0 0',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  );
}


function AppContent() {
  const [showSettings, setShowSettings] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  /**
   * Always land on Pricing for every full load (preview / gate UI).
   * Do NOT pre-mount Studio Editor 2 — its portals were painting over Pricing after the first visit.
   * Plan CTAs call navigateToScreen('studio-editor-2') with no paywall yet.
   */
  const [activeScreen, setActiveScreen] = useState<ScreenId>('pricing');
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
   * Pricing only at boot — SE2 joins after Open Music Box (or Modules).
   */
  const [visitedScreens, setVisitedScreens] = useState<ReadonlySet<ScreenId>>(
    () => new Set<ScreenId>(['pricing']),
  );
  const { settings } = useSettings();

  const navigateToScreen = useCallback((id: ScreenId) => {
    prefetchModuleScreen(id);
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

  /** Tag <body> so CSS can hide SE2/Beat Lab body portals when another module is active. */
  useEffect(() => {
    document.body.dataset.dmbScreen = activeScreen;
    return () => {
      delete document.body.dataset.dmbScreen;
    };
  }, [activeScreen]);

  /**
   * Prefetch module JS only — do not React-mount every screen on boot (that freezes the UI).
   * Modules menu also prefetches on hover/open so the first click rarely waits on the network.
   */
  useEffect(() => {
    const t = window.setTimeout(() => prefetchCommonModuleScreens(), 400);
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
    <div
      className="dmb-app-monitor-bezel"
      style={{
        height: 'var(--dmb-ui-shell-h, 100dvh)',
        width: 'var(--dmb-ui-shell-w, 100%)',
      }}
      data-dmb-app-monitor-bezel
    >
      <div
        className="dmb-app-monitor-bezel__screen flex flex-col w-full overflow-hidden"
        style={{
          background: '#303030',
          color: '#f0f0f0',
        }}
      >
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
          <DeferredScreenMount
            active={activeScreen === 'vocal-lab'}
            enabled={shouldMountScreen('vocal-lab')}
            moduleName="Vocal Lab"
            screenId="vocal-lab"
          >
            {(VocalLabScreen) => (
              <VocalLabScreen
                onExport={handleExport}
                onNeuralHumToStudio={(payload: PendingNeuralHumStudioImport) => {
                  setPendingNeuralHumStudioImport(payload);
                  navigateToScreen('studio-editor-2');
                }}
                onNeuralHumToCreation={(payload: PendingNeuralHumCreationImport) => {
                  publishNeuralHumCreationImport(payload);
                  setCreationSubScreen(payload.target === 'groove-lab' ? 'groove-lab' : 'beat-lab');
                  navigateToScreen('creation-station');
                }}
              />
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'ai-song'}
            enabled={shouldMountScreen('ai-song')}
            moduleName="AI Song"
            screenId="ai-song"
          >
            {(AiSongScreen) => <AiSongScreen onExport={handleExport} />}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'ai-music-match'}
            enabled={shouldMountScreen('ai-music-match')}
            moduleName="AI Music Match"
            screenId="ai-music-match"
          >
            {(AiMusicMatchScreen) => (
              <AiMusicMatchScreen
                onOpenGrooveLab={() => {
                  setCreationSubScreen('groove-lab');
                  navigateToScreen('creation-station');
                }}
                onExportStudio={(payload: PendingAiMatchStudioImport) => {
                  setPendingAiMatchStudioImport(payload);
                  navigateToScreen('studio-editor-2');
                }}
              />
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'ai-pattern'}
            enabled={shouldMountScreen('ai-pattern')}
            moduleName="AI Pattern"
            screenId="ai-pattern"
          >
            {(AiPatternScreen) => (
              <AiPatternScreen
                onExport={handleExport}
                isScreenActive={activeScreen === 'ai-pattern'}
              />
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'melody-transcription'}
            enabled={shouldMountScreen('melody-transcription')}
            moduleName="Melody Transcription"
            screenId="melody-transcription"
          >
            {(MelodyTranscriptionScreen) => (
              <MelodyTranscriptionScreen
                onExport={handleExport}
                onBack={() => navigateToScreen('vocal-lab')}
              />
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'harmony-match'}
            enabled={shouldMountScreen('harmony-match')}
            moduleName="Harmony Match"
            screenId="harmony-match"
          >
            {(HarmonyMatchScreen) => (
              <HarmonyMatchScreen
                onOpenGrooveLab={() => {
                  setCreationSubScreen('groove-lab');
                  navigateToScreen('creation-station');
                }}
              />
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'creation-station'}
            enabled={shouldMountScreen('creation-station')}
            moduleName="Beat Lab"
            screenId="creation-station"
          >
            {(CreationStationScreen) => (
              <CreationStationScreen
                onExport={handleExport}
                onBeatPadsToStudio={(payload: PendingBeatPadsStudioImport) => {
                  setPendingBeatPadsStudioImport(payload);
                  navigateToScreen('studio-editor-2');
                }}
                isScreenActive={activeScreen === 'creation-station'}
                creationSubScreen={creationSubScreen}
                onCreationSubScreenChange={setCreationSubScreen}
              />
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'studio-editor'}
            enabled={shouldMountScreen('studio-editor')}
            moduleName="Studio Editor"
            screenId="studio-editor"
          >
            {(StudioEditorScreen) => (
              <StudioEditorScreen
                onExport={handleExport}
                pendingStudioAudioBlob={pendingStudioAudioBlob}
                onPendingStudioAudioConsumed={clearPendingStudioAudio}
                pendingCloudStudioJson={pendingStudioCloudJson}
                onPendingCloudStudioConsumed={clearPendingStudioCloud}
                isStudioScreenActive={activeScreen === 'studio-editor'}
              />
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'studio-editor-2'}
            enabled={shouldMountScreen('studio-editor-2')}
            moduleName="Studio Editor 2"
            screenId="studio-editor-2"
          >
            {(StudioEditor2Screen) => (
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
                  onExportToMasteringBay={(payload: MasteringBaySourcePayload) => {
                    setPendingMasteringBayImport(payload);
                    navigateToScreen('master-arranger');
                  }}
                />
              </StudioEditor2ErrorBoundary>
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'my-projects'}
            enabled={shouldMountScreen('my-projects')}
            moduleName="My Projects"
            screenId="my-projects"
          >
            {(MyProjectsScreen) => (
              <MyProjectsScreen
                onOpenStudioWithCloudProject={(studioTimelineJson: string) => {
                  setPendingStudioCloudJson(studioTimelineJson);
                  navigateToScreen('studio-editor');
                }}
                onNavigate={(screen: string) => navigateToScreen(screen as ScreenId)}
              />
            )}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'master-arranger'}
            enabled={shouldMountScreen('master-arranger')}
            moduleName="Mastering Bay"
            screenId="master-arranger"
          >
            {(MasterArrangerScreen) => <MasterArrangerScreen onExport={handleExport} />}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'export'}
            enabled={shouldMountScreen('export')}
            moduleName="Export"
            screenId="export"
          >
            {(ExportScreen) => <ExportScreen />}
          </DeferredScreenMount>
          <DeferredScreenMount
            active={activeScreen === 'pricing'}
            enabled
            moduleName="Pricing"
            screenId="pricing"
          >
            {(PricingScreen) => (
              <PricingScreen onEnterApp={() => navigateToScreen('studio-editor-2')} />
            )}
          </DeferredScreenMount>
        </main>
      </div>
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
