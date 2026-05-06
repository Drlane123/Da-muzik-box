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
import StudioEditor2Screen from '@/app/screens/StudioEditor2Screen';

import MyProjectsScreen from '@/app/screens/MyProjectsScreen';

import MasterArrangerScreen from '@/app/screens/MasterArrangerScreen';

import PianoRollScreen from '@/app/screens/PianoRollScreen';

import ExportScreen from '@/app/screens/ExportScreen';


/**
 * Default behavior: keep screens mounted and hide via CSS.
 * Some modules may still be conditionally unmounted by AppContent to enforce
 * strict runtime isolation from Studio transport/sync while hidden.
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
    /** Studio Editor 2 uses its own AudioContext — only Studio 1 holds master transport authority. */
    w.__daMusicStudioTransportAuthority = activeScreen === 'studio-editor';
    return () => {
      delete w.__daMusicStudioTransportAuthority;
    };
  }, [activeScreen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Spacebar: Play/Stop
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' &&
          (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        if (activeScreen === 'studio-editor-2') return;
        if (activeScreen !== 'studio-editor') return;
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
  }, [activeScreen, transport, play, pause, stop]);

  /** Supports: (screenId), (screenId, audioBlob), or (midiNotes[], screenId) from Melody Transcription. */
  function handleExport(a: string | unknown[], b?: string | Blob) {
    if (typeof a === 'string') {
      if ((a === 'studio-editor' || a === 'studio-editor-2') && b instanceof Blob && b.size > 0) {
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
            {activeScreen === 'ai-pattern' ? (
              <AiPatternScreen
                onExport={handleExport}
                isScreenActive
              />
            ) : null}
          </ScreenMount>
          <ScreenMount active={activeScreen === 'melody-transcription'}>
            <MelodyTranscriptionScreen onExport={handleExport} onBack={() => setActiveScreen('vocal-lab')} />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'creation-station'}>
            {activeScreen === 'creation-station' ? (
              <CreationStationScreen onExport={handleExport} isScreenActive />
            ) : null}
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
          <ScreenMount active={activeScreen === 'studio-editor-2'}>
            <StudioEditor2Screen
              isScreenActive={activeScreen === 'studio-editor-2'}
              pendingStudioAudioBlob={pendingStudioAudioBlob}
              onPendingStudioAudioConsumed={clearPendingStudioAudio}
            />
          </ScreenMount>
          <ScreenMount active={activeScreen === 'my-projects'}>
            <MyProjectsScreen
              onOpenStudioWithCloudProject={(studioTimelineJson) => {
                setPendingStudioCloudJson(studioTimelineJson);
                setActiveScreen('studio-editor');
              }}
              onNavigate={(screen) => setActiveScreen(screen as ScreenId)}
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
