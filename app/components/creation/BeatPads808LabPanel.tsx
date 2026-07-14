'use client';

/**
 * Beat Pads — SE2 808 Lab drop-down (piano-roll tone grid).
 * Own voice state (not linked to the main 808 Lab lane). Same sounds + Preview + export.
 * Sync to BeatPads locks tempo + playback to the drum machine clock (survives close).
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
  /** Sync 808 Lab tone/perc to Beat Pads transport (tempo + play together). */
  syncedToBeatPads?: boolean;
  onSyncedToBeatPadsChange?: (synced: boolean) => void;
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
  syncedToBeatPads = false,
  onSyncedToBeatPadsChange,
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

  const toggleSync = useCallback(() => {
    if (disabled || !onSyncedToBeatPadsChange) return;
    onSyncedToBeatPadsChange(!syncedToBeatPads);
  }, [disabled, onSyncedToBeatPadsChange, syncedToBeatPads]);

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
      data-beat-pads-808lab-synced={syncedToBeatPads ? '1' : undefined}
    >
      <div
        className="flex items-center justify-between gap-2 shrink-0 px-2 py-1 border-b"
        style={{ borderColor: 'rgba(0, 229, 255, 0.28)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-black uppercase tracking-wide shrink-0"
            style={{ color: accentHex }}
          >
            {LAB808_DISPLAY_NAME}
          </span>
          <span className="text-[8px] font-bold truncate" style={{ color: 'rgba(0, 229, 255, 0.75)' }}>
            Piano roll · Scope · Preview · Export
          </span>
        </div>
        {onSyncedToBeatPadsChange ? (
          <button
            type="button"
            disabled={disabled}
            onClick={toggleSync}
            aria-pressed={syncedToBeatPads}
            title={
              syncedToBeatPads
                ? 'Synced — 808 Lab plays with Beat Pads at the same tempo (pattern kept when you close)'
                : 'Sync to BeatPads — lock tempo and play 808 Lab together with the drum machine'
            }
            className="beat-pads-808lab-sync-btn shrink-0"
            style={{
              height: 26,
              padding: '0 10px',
              borderRadius: 5,
              border: syncedToBeatPads
                ? `1px solid ${accentHex}`
                : '1px solid rgba(0, 229, 255, 0.35)',
              background: syncedToBeatPads ? 'rgba(0, 229, 255, 0.22)' : 'rgba(0, 229, 255, 0.06)',
              color: syncedToBeatPads ? '#b8f7ff' : accentHex,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              whiteSpace: 'nowrap',
              boxShadow: syncedToBeatPads ? `0 0 10px ${accentHex}44` : undefined,
            }}
          >
            {syncedToBeatPads ? '● Synced to BeatPads' : '○ Sync to BeatPads'}
          </button>
        ) : null}
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
