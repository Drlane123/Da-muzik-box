/**
 * In-memory Beat Pads sampler state per SE2 lane — survives panel hide / track deselect.
 * Pad samples also persist in localStorage; this keeps decoded AudioBuffers hot.
 */
import type { BeatLabDrumPadVoiceOpts } from '@/app/lib/creationStation/beatLabDrumPadVoice';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import type { PadSamplerFxRack } from '@/app/lib/creationStation/padSamplerFxRack';
import type { PadSamplerPlaybackOpts } from '@/app/lib/padSampleStorage';
import type {
  BeatPadsSpreadTrackState,
  BeatPadsSpreadVoice,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';

export type Se2BeatPadsSamplerCacheEntry = {
  padSampleBuffers: Map<string, AudioBuffer>;
  padSamplePlaybackOpts: Record<string, PadSamplerPlaybackOpts>;
  padSampleFxRack: Record<string, PadSamplerFxRack>;
  padSampleRootMidi: Record<string, number>;
  padSampleStrikeMidi: Record<string, number>;
  padSampleChromatic: Record<string, boolean>;
  padDrumVoiceOpts: Record<string, BeatLabDrumPadVoiceOpts>;
  padSamplePresence: Record<string, boolean>;
  padSampleRootBpms: Record<string, number>;
  padSampleLabels: Record<string, string>;
  selectedPad: number;
  producerKitId: BeatLabProducerKitId;
  beatPadsSpreadTrack: BeatPadsSpreadTrackState | null;
  beatPadsSpreadVoice: BeatPadsSpreadVoice | null;
};

const cache = new Map<string, Se2BeatPadsSamplerCacheEntry>();

export function readSe2BeatPadsSamplerCache(trackId: string): Se2BeatPadsSamplerCacheEntry | undefined {
  return cache.get(trackId);
}

export function writeSe2BeatPadsSamplerCache(
  trackId: string,
  entry: Se2BeatPadsSamplerCacheEntry,
): void {
  cache.set(trackId, entry);
}

export function clearSe2BeatPadsSamplerCache(trackId: string): void {
  cache.delete(trackId);
}
