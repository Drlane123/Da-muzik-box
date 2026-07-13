'use client';

/**
 * Beat Pads — SE2 808 Lab drop-down (piano-roll tone grid).
 * Own voice state (not linked to the main 808 Lab lane). Same sounds + Preview + export.
 * fullBleed: spans the Beat Pads work stage (pads/FX/sequencer) while open.
 */
import { useCallback, useMemo, useState } from 'react';
import { Se2Lab808Panel, type Se2Lab808PanelTrack } from '@/app/components/studio/Se2Lab808Panel';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { LAB808_DISPLAY_NAME } from '@/app/lib/creationStation/lab808UiTheme';
import type { Se2Lab808ChordLockHarmonyTrack } from '@/app/lib/studio/se2Lab808ChordLock';
import type { Se2Lab808ToneGridRollNote } from '@/app/lib/studio/se2Lab808ToneGridExport';
import {
  se2Lab808DefaultVoice,
  type Se2Lab808VoiceParams,
} from '@/app/lib/studio/se2Lab808Types';

export const BEAT_PADS_808_LAB_ACCENT = '#00E5FF';

export type BeatPads808LabPanelProps = {
  bpm: number;
  trackId: string;
  trackName?: string;
  accentHex?: string;
  disabled?: boolean;
  songKeyRoot: number;
  songKeyMode: ChordMode;
  studioTracks: readonly Se2Lab808ChordLockHarmonyTrack[];
  lanePad?: number;
  voice?: Se2Lab808VoiceParams;
  onVoiceChange?: (voice: Se2Lab808VoiceParams) => void;
  getAudioContext: () => AudioContext | null;
  getPreviewDestination: (ctx: AudioContext) => AudioNode | null;
  warmAudio?: () => void | Promise<void>;
  onExportToneGridToPianoRoll?: (notes: Se2Lab808ToneGridRollNote[]) => void;
  onExportToneGridWavToTrack?: (args: {
    buffer: AudioBuffer;
    loopBars: number;
    bpm: number;
    sourceTrackName: string;
  }) => void;
  /** Full-width overlay over Beat Pads pads/FX/sequencer (scope + piano roll). */
  fullBleed?: boolean;
};

export function BeatPads808LabPanel({
  bpm,
  trackId,
  trackName = 'Beat Pads 808 Lab',
  accentHex = BEAT_PADS_808_LAB_ACCENT,
  disabled = false,
  songKeyRoot,
  songKeyMode,
  studioTracks,
  lanePad = 2,
  voice: voiceProp,
  onVoiceChange: onVoiceChangeProp,
  getAudioContext,
  getPreviewDestination,
  warmAudio,
  onExportToneGridToPianoRoll,
  onExportToneGridWavToTrack,
  fullBleed = false,
}: BeatPads808LabPanelProps) {
  const [localVoice, setLocalVoice] = useState<Se2Lab808VoiceParams>(() => se2Lab808DefaultVoice());
  const voice = voiceProp ?? localVoice;
  const onVoiceChange = onVoiceChangeProp ?? setLocalVoice;

  const track = useMemo(
    (): Se2Lab808PanelTrack => ({
      id: `${trackId}__beatPads808Lab`,
      name: trackName,
      colorHex: accentHex,
      kind: 'lab808',
      notes: [],
      audioClips: [],
    }),
    [accentHex, trackId, trackName],
  );

  const resolveCtx = useCallback((): AudioContext => {
    void warmAudio?.();
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'closed') {
      throw new Error('Audio not ready — tap Preview or Play once.');
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  }, [getAudioContext, warmAudio]);

  const resolveDest = useCallback(
    (ctx: AudioContext): AudioNode => {
      return getPreviewDestination(ctx) ?? ctx.destination;
    },
    [getPreviewDestination],
  );

  return (
    <div
      className={
        fullBleed
          ? 'beat-pads-808lab-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border'
          : 'beat-pads-808lab-panel flex shrink-0 flex-col overflow-hidden rounded-md border'
      }
      style={{
        borderColor: 'rgba(0, 229, 255, 0.55)',
        background: 'linear-gradient(165deg, #0a1820 0%, #05080c 100%)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.7)',
        ...(fullBleed ? { height: '100%', width: '100%', maxHeight: 'none' } : { maxHeight: 420 }),
      }}
      data-beat-pads-808lab-panel
      data-beat-pads-808lab-fullbleed={fullBleed ? '1' : undefined}
    >
      <div
        className="flex items-center justify-between gap-2 shrink-0 px-2 py-1 border-b"
        style={{ borderColor: 'rgba(0, 229, 255, 0.28)' }}
      >
        <span
          className="text-[10px] font-black uppercase tracking-wide"
          style={{ color: accentHex }}
        >
          {LAB808_DISPLAY_NAME}
        </span>
        <span className="text-[8px] font-bold" style={{ color: 'rgba(0, 229, 255, 0.75)' }}>
          Piano roll · Scope · Preview · Export
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
        <Se2Lab808Panel
          track={track}
          voice={voice}
          bpm={bpm}
          disabled={disabled}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          studioTracks={studioTracks}
          lanePad={lanePad}
          getAudioContext={resolveCtx}
          getPreviewDestination={resolveDest}
          onVoiceChange={onVoiceChange}
          onExportToneGridToPianoRoll={onExportToneGridToPianoRoll}
          onExportToneGridWavToTrack={onExportToneGridWavToTrack}
          miniature={!fullBleed}
          playButtonLabel="Preview"
          accentPads
        />
      </div>
    </div>
  );
}
