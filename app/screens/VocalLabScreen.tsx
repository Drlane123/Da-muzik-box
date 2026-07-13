import { useCallback, useRef, useState } from 'react';

import { HelpCircle, Mic2, FileAudio, Send } from 'lucide-react';

import NeuralHumPanel from './vocal-lab/NeuralHumPanel';

import VoiceSwapPanel from './vocal-lab/VoiceSwapPanel';

import RVCSingingConverterPanel from './vocal-lab/RVCSingingConverterPanel';

import EnhancementSuite from './vocal-lab/EnhancementSuite';

import VocalTracksPanel from './vocal-lab/VocalTracksPanel';
import type { PendingNeuralHumStudioImport } from '@/app/lib/vocalLab/neuralHumStudioExport';
import type { PendingNeuralHumCreationImport } from '@/app/lib/vocalLab/neuralHumCreationExport';
import {
  downloadVocalLabMp3,
  downloadVocalLabWav,
  vocalLabBlobIsMp3,
} from '@/app/lib/vocalLab/vocalLabAudioDownload';
import { VOCAL_LAB_HELP_INTRO_STORAGE } from '@/app/lib/vocalLab/vocalLabInstructions';
import {
  VocalLabHelpProvider,
  VocalLabHelpTip,
  useVocalLabHelpContext,
} from '@/app/components/vocalLab/VocalLabHelpHub';


interface VocalLabScreenProps {
  /** Second arg: optional audio blob when sending recorded/uploaded audio to Studio Editor. */
  onExport: (dest: string, audioBlob?: Blob) => void;
  /** Neural Hum melody → Studio Editor 2 (MIDI + optional render WAV). */
  onNeuralHumToStudio?: (payload: PendingNeuralHumStudioImport) => void;
  /** Neural Hum melody → Groove Lab or Beat Lab NEW SYNTH. */
  onNeuralHumToCreation?: (payload: PendingNeuralHumCreationImport) => void;
}


export default function VocalLabScreen({
  onExport,
  onNeuralHumToStudio,
  onNeuralHumToCreation,
}: VocalLabScreenProps) {
  const [hasAudio, setHasAudio] = useState(false);
  const [captureBlob, setCaptureBlob] = useState<Blob | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  const handleCaptureBlobChange = useCallback((blob: Blob | null) => {
    recordedBlobRef.current = blob;
    setCaptureBlob(blob);
    setHasAudio(Boolean(blob && blob.size > 0));
  }, []);

  const exportAudioBlob = useCallback((): Blob | undefined => {
    const blob = recordedBlobRef.current;
    return blob && blob.size > 0 ? blob : undefined;
  }, []);

  const canExportMp3 = Boolean(captureBlob && vocalLabBlobIsMp3(captureBlob));

  return (
    <VocalLabHelpProvider autoIntro introTab="hum-capture" introStorageKey={VOCAL_LAB_HELP_INTRO_STORAGE}>
    <div className="flex flex-col h-full" style={{ background: '#16161c', color: '#ccc' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid #1a1a24', background: '#0d0d14' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#D500F922', color: '#D500F9' }}>
            <Mic2 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold inline-flex items-center gap-1.5" style={{ color: '#fff' }}>
              AI Vocal Lab & Neural Transformation
              <VocalLabHelpTip tab="overview" title="AI Vocal Lab quick start" />
            </h2>
            <p className="text-xs" style={{ color: '#7a7a88' }}>Hum-to-MIDI · voice tools · enhancement</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full ml-2" style={{ background: '#0a1a0a', border: '1px solid #00ff8844' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00ff88' }} />
            <span className="text-xs" style={{ color: '#00ff88', fontSize: 10 }}>Neural Engine Active</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <VocalLabHowToBtn />
          <button
            onClick={() => onExport('studio-editor-2', exportAudioBlob())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF55' }}
          >
            <Send size={11} /> Studio Editor 2
          </button>
          <button
            onClick={() => onExport('master-arranger')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: '#0d0d14', color: '#D500F9', border: '1px solid #D500F955' }}
          >
            <Send size={11} /> Arranger
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 min-h-0">

        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-4 flex flex-col gap-3 min-w-0" style={{ background: '#0d0d14', border: '1px solid #1a1a24' }}>
            <NeuralHumPanel
              onCaptureBlobChange={handleCaptureBlobChange}
              onNeuralHumToStudio={onNeuralHumToStudio}
              onNeuralHumToCreation={onNeuralHumToCreation}
            />
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0d0d14', border: '1px solid #1a1a24' }}>
            <RVCSingingConverterPanel />
          </div>
        </div>

        <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#0d0d14', border: '1px solid #1a1a24' }}>
          <VoiceSwapPanel audioBlob={captureBlob} />
        </div>

        <div className="rounded-xl p-4" style={{ background: '#0d0d14', border: '1px solid #1a1a24' }}>
          <EnhancementSuite audioBlob={captureBlob} />
        </div>

        <div className="rounded-xl p-4" style={{ background: '#0d0d14', border: '1px solid #1a1a24' }}>
          <VocalTracksPanel />
        </div>

        <div
          className="flex flex-wrap items-center gap-3 p-4 rounded-xl"
          style={{ background: '#0d0d14', border: '1px solid #1a1a24' }}
        >
          <span className="text-xs font-bold uppercase tracking-widest mr-2" style={{ color: '#555' }}>Export</span>
          <button
            disabled={!hasAudio}
            onClick={() => {
              const blob = exportAudioBlob();
              if (blob) void downloadVocalLabWav(blob);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all"
            style={{
              background: hasAudio ? '#00ff8818' : '#121218',
              color: hasAudio ? '#00ff88' : '#1a1a24',
              border: `1px solid ${hasAudio ? '#00ff8844' : '#1a1a24'}`,
              cursor: hasAudio ? 'pointer' : 'not-allowed',
            }}
          >
            <FileAudio size={11} /> WAV
          </button>
          <button
            disabled={!canExportMp3}
            onClick={() => {
              const blob = exportAudioBlob();
              if (blob) downloadVocalLabMp3(blob);
            }}
            title={canExportMp3 ? 'Download MP3' : 'Import an MP3 file to enable MP3 download'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all"
            style={{
              background: canExportMp3 ? '#00ff8818' : '#121218',
              color: canExportMp3 ? '#00ff88' : '#1a1a24',
              border: `1px solid ${canExportMp3 ? '#00ff8844' : '#1a1a24'}`,
              cursor: canExportMp3 ? 'pointer' : 'not-allowed',
            }}
          >
            <FileAudio size={11} /> MP3
          </button>
          <button
            onClick={() => onExport('studio-editor-2', exportAudioBlob())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF44' }}
          >
            <Send size={11} /> To Studio Editor 2
          </button>
          <button
            onClick={() => onExport('groove-lab', exportAudioBlob())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: '#0d0d14', color: '#7cf4c6', border: '1px solid #7cf4c644' }}
          >
            <Send size={11} /> To Groove Lab
          </button>
          <button
            onClick={() => onExport('new-synth', exportAudioBlob())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: '#0d0d14', color: '#D500F9', border: '1px solid #D500F944' }}
          >
            <Send size={11} /> To NEW SYNTH
          </button>
        </div>
      </div>
    </div>
    </VocalLabHelpProvider>
  );
}

function VocalLabHowToBtn() {
  const { openHelp } = useVocalLabHelpContext();
  return (
    <button
      type="button"
      onClick={() => openHelp('overview')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
      style={{ background: '#1a1018', color: '#f472b6', border: '1px solid #f472b655', cursor: 'pointer' }}
    >
      <HelpCircle size={11} /> HOW TO
    </button>
  );
}
