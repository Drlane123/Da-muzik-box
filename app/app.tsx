'use client';


import '@/app/globals.css';

import { useCallback, useEffect, useState } from 'react';

import { MasterClockProvider, useMasterClock } from '@/app/context/MasterClockContext';

import { SettingsProvider, useSettings } from '@/app/context/SettingsContext';

import { studioMicTrackConstraints } from '@/app/lib/audioRouting';

import AudioSinkBinder from '@/app/components/AudioSinkBinder';

import SettingsModal from '@/app/components/SettingsModal';

import { SongArrangerProvider } from '@/app/context/SongArrangerContext';

import { ViewProvider } from '@/app/context/ViewContext';

import { PianoNotesProvider } from '@/app/context/PianoNotesContext';

import { TrackAllocationProvider } from '@/app/context/TrackAllocationContext';

import TitleBar from '@/app/components/TitleBar';

/** Must match StudioEditorScreen — cancels local count-in before transport changes. */
const DMB_STUDIO_PRECOUNT_CANCEL = 'dmb-studio-precount-cancel';

import NavigationSidebar, { type ScreenId } from '@/app/components/NavigationSidebar';


import VocalLabScreen from '@/app/screens/VocalLabScreen';

import AiSongScreen from '@/app/screens/AiSongScreen';

import AiPatternScreen from '@/app/screens/AiPatternScreen';

import MelodyTranscriptionScreen from '@/app/screens/MelodyTranscriptionScreen';

import CreationStationScreen from '@/app/screens/CreationStationScreen';

import StudioEditorScreen from '@/app/screens/StudioEditorScreen';

import MyProjectsScreen from '@/app/screens/MyProjectsScreen';

import MasterArrangerScreen from '@/app/screens/MasterArrangerScreen';

import PianoRollScreen from '@/app/screens/PianoRollScreen';

import ExportScreen from '@/app/screens/ExportScreen';


/**
 * All screens are always mounted. Visibility is toggled via CSS so that
 * component state (patterns, clips, edits) is never lost when navigating tabs.
 */
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
  const [activeScreen, setActiveScreen] = useState<ScreenId>('vocal-lab');
  /** Passed to Studio Editor when navigating from Vocal Lab with a recorded/uploaded blob. */
  const [pendingStudioAudioBlob, setPendingStudioAudioBlob] = useState<Blob | null>(null);
  /** Full Studio JSON string from Supabase `data.studioProjectV1` (applied once in StudioEditorScreen). */
  const [pendingStudioCloudJson, setPendingStudioCloudJson] = useState<string | null>(null);
  const { transport, play, pause, stop } = useMasterClock();
  const { settings } = useSettings();

  const clearPendingStudioAudio = useCallback(() => {
    setPendingStudioAudioBlob(null);
  }, []);

  const clearPendingStudioCloud = useCallback(() => {
    setPendingStudioCloudJson(null);
  }, []);

  /**
   * Shared DAW record arm: one global hook for getUserMedia + `__daMusicStudioMicStream`.
   * MasterClock `record()` requires `window.__daMusicStudioRecordArm` while any DAW recording
   * screen is active (Studio / Creation Station / Master Arranger). StudioEditorScreen
   * MediaRecorder effect consumes the same stream when transport === 'recording'.
   */
  useEffect(() => {
    const w = window as unknown as {
      __daMusicStudioRecordArm?: () => Promise<void>;
      __daMusicStudioMicStream?: MediaStream | null;
    };
    const dawRecordingScreens: ScreenId[] = [
      'studio-editor',
      'creation-station',
      'master-arranger',
    ];
    if (!dawRecordingScreens.includes(activeScreen)) {
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: studioMicTrackConstraints(settings.audioInput),
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
    function handleKeyDown(e: KeyboardEvent) {
      // Spacebar: Play/Stop
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' &&
          (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (transport === 'counting') {
          pause();
        } else if (transport === 'playing' || transport === 'recording') {
          window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
          stop();
        } else {
          window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
          play();
        }
      }
      // Ctrl+S / Cmd+S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Dispatch custom event for TitleBar to handle
        window.dispatchEvent(new CustomEvent('saveProject'));
      }
      // Ctrl+, / Cmd+,: Settings (audio routing, etc.)
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transport, play, pause, stop]);

  /** Supports: (screenId), (screenId, audioBlob), or (midiNotes[], screenId) from Melody Transcription. */
  function handleExport(a: string | unknown[], b?: string | Blob) {
    if (typeof a === 'string') {
      if (a === 'studio-editor' && b instanceof Blob && b.size > 0) {
        setPendingStudioAudioBlob(b);
      }
      setActiveScreen(a as ScreenId);
      return;
    }
    if (Array.isArray(a) && typeof b === 'string') {
      setActiveScreen(b as ScreenId);
    }
  }

  return (
    <div className="flex flex-col w-full overflow-hidden" style={{ height: '100vh', background: '#000', color: '#ccc' }}>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <TitleBar onOpenSettings={() => setShowSettings(true)} activeScreen={activeScreen} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <NavigationSidebar activeScreen={activeScreen} onScreenChange={setActiveScreen} />
        <main
          className="flex-1 min-w-0 min-h-0 overflow-hidden relative"
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}
        >
          <ScreenMount active={activeScreen === 'vocal-lab'}>
            <VocalLabScreen onExport={handleExport} />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'ai-song'}>
            <AiSongScreen onExport={handleExport} />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'ai-pattern'}>
            <AiPatternScreen onExport={handleExport} />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'melody-transcription'}>
            <MelodyTranscriptionScreen onExport={handleExport} onBack={() => setActiveScreen('vocal-lab')} />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'creation-station'}>
            <CreationStationScreen onExport={handleExport} isScreenActive={activeScreen === 'creation-station'} />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'studio-editor'}>
            <StudioEditorScreen
              onExport={handleExport}
              pendingStudioAudioBlob={pendingStudioAudioBlob}
              onPendingStudioAudioConsumed={clearPendingStudioAudio}
              pendingCloudStudioJson={pendingStudioCloudJson}
              onPendingCloudStudioConsumed={clearPendingStudioCloud}
              isStudioScreenActive={activeScreen === 'studio-editor'}
            />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'my-projects'}>
            <MyProjectsScreen
              onOpenStudioWithCloudProject={(studioTimelineJson) => {
                setPendingStudioCloudJson(studioTimelineJson);
                setActiveScreen('studio-editor');
              }}
            />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'master-arranger'}>
            <MasterArrangerScreen onExport={handleExport} />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'piano-roll'}>
            <PianoRollScreen onExport={handleExport} />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'export'}>
            <ExportScreen />
          </ScreenMount>
        </main>
      </div>
    </div>
  );
}


export default function App() {
  return (
    <SettingsProvider>
      <MasterClockProvider>
        <AudioSinkBinder />
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
    </SettingsProvider>
  );
}
