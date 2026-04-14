/**
 * TrackAllocationContext — Global Exclusive Track Pool Manager
 *
 * Aligns with `sessionChannelTracks` master session slots (defaults + manifest-driven growth):
 * - 1–17: Creation Station (reserved)
 * - 18+: AI Pattern (default 8 lanes; expands when manifest grows)
 * - Master Arranger: dynamic base after last AI slot (default base 26) + default pool + manifest
 * - Studio Editor user tracks: from `getNextStudioUserAudioTrackFloor()` upward (≥62 minimum)
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

import {
  AI_PATTERN_SESSION_BASE,
  AI_PATTERN_TRACK_COUNT,
  DA_SESSION_TRACKS_SYNC_EVENT,
  getMasterArrangerSessionBase,
  getNextStudioUserAudioTrackFloor,
  getSessionReservedTrackNumbers,
  MASTER_ARRANGER_RESERVED_SLOT_COUNT,
  readAiPatternSessionManifestFromStorage,
  readMasterArrangerSessionManifestFromStorage,
} from '@/app/lib/sessionChannelTracks';

export type ModuleId = 
  | 'creation-station' 
  | 'studio-editor' 
  | 'piano-roll' 
  | 'master-arranger'
  | 'ai-vocal-lab'
  | 'ai-song-gen'
  | 'ai-pattern-gen'
  | 'melody-transcription'
  | 'export-playback';

interface TrackAllocationContextType {
  // Get all tracks allocated to a module
  getModuleTracks: (moduleId: ModuleId) => number[];
  
  // Allocate tracks for a module
  allocateTracks: (moduleId: ModuleId, count: number) => number[];
  
  // Release all tracks from a module
  releaseModuleTracks: (moduleId: ModuleId) => void;
  
  // Check if a track is available
  isTrackAvailable: (trackNumber: number) => boolean;
  
  // Get which module owns a track (if any)
  getTrackOwner: (trackNumber: number) => ModuleId | null;
  
  // Get all allocations (for debugging/UI)
  getAllAllocations: () => Record<ModuleId, number[]>;
  
  // Get next available track number
  getNextAvailableTrack: () => number;
}

const TrackAllocationContext = createContext<TrackAllocationContextType | null>(null);

function buildInitialAiPatternReservedSet(): Set<number> {
  const s = new Set<number>();
  readAiPatternSessionManifestFromStorage().forEach((_, k) => {
    if (k >= AI_PATTERN_SESSION_BASE) s.add(k);
  });
  if (s.size === 0) {
    for (let i = 0; i < AI_PATTERN_TRACK_COUNT; i++) s.add(AI_PATTERN_SESSION_BASE + i);
  }
  return s;
}

function buildInitialMasterArrangerReservedSet(): Set<number> {
  const base = getMasterArrangerSessionBase();
  let maxK = base + MASTER_ARRANGER_RESERVED_SLOT_COUNT - 1;
  readMasterArrangerSessionManifestFromStorage().forEach((_, k) => {
    if (k >= base) maxK = Math.max(maxK, k);
  });
  const s = new Set<number>();
  for (let k = base; k <= maxK; k++) s.add(k);
  return s;
}

export function TrackAllocationProvider({ children }: { children: React.ReactNode }) {
  const [allocations, setAllocations] = useState<Map<ModuleId, Set<number>>>(
    new Map([
      ['creation-station', new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])],
      ['studio-editor', new Set()],
      ['piano-roll', new Set()],
      ['master-arranger', buildInitialMasterArrangerReservedSet()],
      ['ai-vocal-lab', new Set()],
      ['ai-song-gen', new Set()],
      ['ai-pattern-gen', buildInitialAiPatternReservedSet()],
      ['melody-transcription', new Set()],
      ['export-playback', new Set()],
    ])
  );

  /** Next pool slot for Studio-only rows — never overlaps module session ranges. */
  const nextGlobalTrackRef = useRef(getNextStudioUserAudioTrackFloor());

  useEffect(() => {
    const bump = () => {
      nextGlobalTrackRef.current = Math.max(
        nextGlobalTrackRef.current,
        getNextStudioUserAudioTrackFloor(),
      );
    };
    bump();
    window.addEventListener(DA_SESSION_TRACKS_SYNC_EVENT, bump);
    return () => window.removeEventListener(DA_SESSION_TRACKS_SYNC_EVENT, bump);
  }, []);

  const getModuleTracks = useCallback((moduleId: ModuleId): number[] => {
    const tracks = allocations.get(moduleId);
    return tracks ? Array.from(tracks).sort((a, b) => a - b) : [];
  }, [allocations]);

  const isTrackAvailable = useCallback((trackNumber: number): boolean => {
    if (getSessionReservedTrackNumbers().has(trackNumber)) {
      return false;
    }

    // Check if any module owns this track
    for (const moduleId of allocations.keys()) {
      if (allocations.get(moduleId)?.has(trackNumber)) {
        return false;
      }
    }
    return true;
  }, [allocations]);

  const getNextAvailableTrack = useCallback((): number => {
    while (!isTrackAvailable(nextGlobalTrackRef.current)) {
      nextGlobalTrackRef.current++;
    }
    return nextGlobalTrackRef.current;
  }, [isTrackAvailable]);

  const allocateTracks = useCallback((moduleId: ModuleId, count: number): number[] => {
    const allocated: number[] = [];
    
    setAllocations(prev => {
      const newAllocations = new Map(prev);
      const moduleSet = new Set(newAllocations.get(moduleId) || []);
      
      for (let i = 0; i < count; i++) {
        // Find next available track
        let trackNum = nextGlobalTrackRef.current;
        while (!isTrackAvailable(trackNum)) {
          trackNum++;
        }
        
        moduleSet.add(trackNum);
        allocated.push(trackNum);
        nextGlobalTrackRef.current = trackNum + 1;
      }
      
      newAllocations.set(moduleId, moduleSet);
      return newAllocations;
    });
    
    return allocated;
  }, [isTrackAvailable]);

  const releaseModuleTracks = useCallback((moduleId: ModuleId) => {
    setAllocations((prev) => {
      const newAllocations = new Map(prev);

      if (moduleId === 'creation-station') {
        return newAllocations;
      }
      if (moduleId === 'ai-pattern-gen') {
        newAllocations.set(moduleId, buildInitialAiPatternReservedSet());
        return newAllocations;
      }
      if (moduleId === 'master-arranger') {
        newAllocations.set(moduleId, buildInitialMasterArrangerReservedSet());
        return newAllocations;
      }
      newAllocations.set(moduleId, new Set());
      return newAllocations;
    });
  }, []);

  const getTrackOwner = useCallback((trackNumber: number): ModuleId | null => {
    for (const [moduleId, tracks] of allocations.entries()) {
      if (tracks.has(trackNumber)) {
        return moduleId;
      }
    }
    return null;
  }, [allocations]);

  const getAllAllocations = useCallback((): Record<ModuleId, number[]> => {
    const result = {} as Record<ModuleId, number[]>;
    for (const [moduleId] of allocations.entries()) {
      result[moduleId] = getModuleTracks(moduleId);
    }
    return result;
  }, [allocations, getModuleTracks]);

  const value: TrackAllocationContextType = {
    getModuleTracks,
    allocateTracks,
    releaseModuleTracks,
    isTrackAvailable,
    getTrackOwner,
    getAllAllocations,
    getNextAvailableTrack,
  };

  return (
    <TrackAllocationContext.Provider value={value}>
      {children}
    </TrackAllocationContext.Provider>
  );
}

export function useTrackAllocation(): TrackAllocationContextType {
  const context = useContext(TrackAllocationContext);
  if (!context) {
    throw new Error('useTrackAllocation must be used within TrackAllocationProvider');
  }
  return context;
}
