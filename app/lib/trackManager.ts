/**
 * TrackManager — Helper utility for modules to manage track allocation
 * 
 * Usage in a module:
 * ```
 * const trackManager = useTrackAllocation();
 * 
 * // When module mounts or needs new tracks:
 * const tracks = trackManager.allocateTracks('studio-editor', 14);
 * 
 * // When module unmounts or user clears tracks:
 * trackManager.releaseModuleTracks('studio-editor');
 * 
 * // Check track status:
 * const available = trackManager.isTrackAvailable(42);
 * const owner = trackManager.getTrackOwner(18);
 * ```
 */

import { useTrackAllocation, type ModuleId } from '@/app/context/TrackAllocationContext';

export function useTrackManager(moduleId: ModuleId) {
  const allocation = useTrackAllocation();

  return {
    /**
     * Allocate N new tracks for this module
     */
    allocateNewTracks: (count: number) => {
      return allocation.allocateTracks(moduleId, count);
    },

    /**
     * Release all tracks owned by this module
     */
    releaseAllTracks: () => {
      allocation.releaseModuleTracks(moduleId);
    },

    /**
     * Get all tracks currently owned by this module
     */
    getMyTracks: () => {
      return allocation.getModuleTracks(moduleId);
    },

    /**
     * Check if a specific track is available
     */
    isAvailable: (trackNumber: number) => {
      return allocation.isTrackAvailable(trackNumber);
    },

    /**
     * Get which module owns a track
     */
    getOwner: (trackNumber: number) => {
      return allocation.getTrackOwner(trackNumber);
    },

    /**
     * Get next available track number
     */
    getNextTrack: () => {
      return allocation.getNextAvailableTrack();
    },
  };
}
