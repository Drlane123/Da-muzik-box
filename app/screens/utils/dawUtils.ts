/**
 * Professional DAW Editing Utilities
 * Snap-to-Grid, Lasso Selection, Crossfades, etc.
 */

export type SnapGridType =
  | 'bar'
  | '1/2'
  | '1/4'
  | '1/8'
  | '1/16'
  | '1/32'
  | 'off';

/**
 * Snap clip start (0-based absolute beat, float) to the Studio ruler grid.
 * Note values are note *lengths* in 4/4: 1/2 = half note (2 beats), 1/4 = quarter (1 beat), etc.
 */
export function snapClipStartBeat0(
  startBeat0: number,
  snapType: SnapGridType,
  beatsPerBar: number,
): number {
  return snapClipStartTick0(startBeat0 * 960, snapType, beatsPerBar, 960) / 960;
}

/**
 * Snap clip start in PPQ ticks so visual placement and stored `startTick`
 * use the same grid as recording and future MIDI note data.
 */
export function snapClipStartTick0(
  startTick0: number,
  snapType: SnapGridType,
  beatsPerBar: number,
  ppq: number,
): number {
  if (snapType === 'off') return Math.round(startTick0);
  if (snapType === 'bar') {
    const barTicks = Math.max(1, Math.round(beatsPerBar * ppq));
    return Math.round(startTick0 / barTicks) * barTicks;
  }
  const stepTicks: Record<'1/2' | '1/4' | '1/8' | '1/16' | '1/32', number> = {
    '1/2': ppq * 2,
    '1/4': ppq,
    '1/8': ppq / 2,
    '1/16': ppq / 4,
    '1/32': ppq / 8,
  };
  const step = Math.max(1, Math.round(stepTicks[snapType]));
  return Math.round(startTick0 / step) * step;
}

/**
 * SNAP-TO-GRID: Align clips to beat divisions
 */
export const snapToGrid = (
  time: number,
  snapType: SnapGridType,
  bpm: number,
  beatsPerBar: number = 4
): number => {
  if (snapType === 'off') return time;

  // Calculate beat duration in seconds
  const beatDuration = (60 / bpm);

  if (snapType === 'bar') {
    const barDuration = beatDuration * beatsPerBar;
    return Math.round(time / barDuration) * barDuration;
  }

  // Map snap types to subdivisions per quarter-note beat
  const subdivisions: Record<Exclude<SnapGridType, 'off' | 'bar'>, number> = {
    '1/2': 2,
    '1/4': 4,
    '1/8': 8,
    '1/16': 16,
    '1/32': 32,
  };

  const subdivision = subdivisions[snapType];
  const snapInterval = beatDuration / subdivision;

  return Math.round(time / snapInterval) * snapInterval;
};

/**
 * LASSO SELECTION: Select multiple clips within a box
 */
export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const getClipsInSelection = (
  clips: any[],
  selectionBox: SelectionBox,
  clipPositions: Map<string, { x: number; y: number; width: number; height: number }>
): string[] => {
  const { startX, startY, endX, endY } = selectionBox;
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const maxX = Math.max(startX, endX);
  const maxY = Math.max(startY, endY);

  return clips
    .filter(clip => {
      const pos = clipPositions.get(clip.id);
      if (!pos) return false;

      return (
        pos.x < maxX &&
        pos.x + pos.width > minX &&
        pos.y < maxY &&
        pos.y + pos.height > minY
      );
    })
    .map(c => c.id);
};

/**
 * CROSSFADE: Create smooth fade between overlapping clips
 */
export interface Crossfade {
  clipId: string;
  type: 'fadeIn' | 'fadeOut';
  duration: number; // in seconds
}

export const createCrossfade = (
  clip1: any,
  clip2: any,
  fadeDuration: number = 0.1
): Crossfade[] => {
  const clip1End = clip1.startTime + clip1.duration;
  const clip2Start = clip2.startTime;

  // Only crossfade if clips overlap
  if (clip1End <= clip2Start) return [];

  return [
    {
      clipId: clip1.id,
      type: 'fadeOut',
      duration: fadeDuration,
    },
    {
      clipId: clip2.id,
      type: 'fadeIn',
      duration: fadeDuration,
    },
  ];
};

/**
 * SMART TOOL: Context-aware cursor behavior
 */
export type SmartToolZone = 'grab' | 'trimLeft' | 'trimRight' | 'fadeIn' | 'fadeOut' | 'none';

export const getSmartToolZone = (
  mouseX: number,
  clipX: number,
  clipWidth: number,
  edgeThreshold: number = 10
): SmartToolZone => {
  const relativeX = mouseX - clipX;

  // Fade zones (5% of clip width from edges)
  const fadeZoneWidth = clipWidth * 0.05;

  if (relativeX < fadeZoneWidth) return 'fadeIn';
  if (relativeX > clipWidth - fadeZoneWidth) return 'fadeOut';
  if (relativeX < edgeThreshold) return 'trimLeft';
  if (relativeX > clipWidth - edgeThreshold) return 'trimRight';

  return 'grab';
};

/**
 * GHOST/POOLED COPIES: Track linked instances
 */
export interface PooledClip {
  sourceId: string;
  instances: string[];
  isPooled: boolean;
}

export const createPooledClip = (clipId: string): PooledClip => ({
  sourceId: clipId,
  instances: [clipId],
  isPooled: true,
});

export const addInstanceToPool = (
  pool: PooledClip,
  newInstanceId: string
): PooledClip => ({
  ...pool,
  instances: [...pool.instances, newInstanceId],
});

export const breakPoolLink = (
  pool: PooledClip,
  instanceId: string
): PooledClip | null => {
  const remaining = pool.instances.filter(id => id !== instanceId);
  if (remaining.length === 0) return null;
  return { ...pool, instances: remaining };
};

/**
 * DRAG & DROP: Handle file URI and positioning
 */
export const parseDroppedFile = (dataTransfer: DataTransfer): File | null => {
  const files = dataTransfer.files;
  if (files.length === 0) return null;

  const file = files[0];
  // Only accept audio files
  if (!file.type.startsWith('audio/')) return null;

  return file;
};

export const calculateDropPosition = (
  dropX: number,
  timelineLeft: number,
  pixelsPerSecond: number,
  snapGrid: SnapGridType,
  bpm: number
): number => {
  const relativeX = dropX - timelineLeft;
  const timeAtDrop = relativeX / pixelsPerSecond;
  return snapToGrid(timeAtDrop, snapGrid, bpm);
};

/**
 * MULTI-SELECTION: Helper functions for managing selected clips
 */
export const toggleSelection = (
  selectedIds: string[],
  clipId: string,
  multiSelect: boolean
): string[] => {
  if (!multiSelect) {
    return [clipId];
  }

  if (selectedIds.includes(clipId)) {
    return selectedIds.filter(id => id !== clipId);
  }

  return [...selectedIds, clipId];
};

export const selectRange = (
  allClips: any[],
  startId: string,
  endId: string
): string[] => {
  const startIdx = allClips.findIndex(c => c.id === startId);
  const endIdx = allClips.findIndex(c => c.id === endId);

  if (startIdx === -1 || endIdx === -1) return [];

  const min = Math.min(startIdx, endIdx);
  const max = Math.max(startIdx, endIdx);

  return allClips.slice(min, max + 1).map(c => c.id);
};

/**
 * ZOOM & PAN: Timeline navigation
 */
export const calculateZoom = (
  currentZoom: number,
  zoomDirection: 'in' | 'out',
  zoomSensitivity: number = 0.1
): number => {
  const minZoom = 0.1;
  const maxZoom = 10;
  
  const newZoom = zoomDirection === 'in' 
    ? currentZoom * (1 + zoomSensitivity)
    : currentZoom / (1 + zoomSensitivity);

  return Math.max(minZoom, Math.min(maxZoom, newZoom));
};

/**
 * QUANTIZE: Snap timing to strict grid
 */
export const quantizeClips = (
  clips: any[],
  snapType: SnapGridType,
  bpm: number,
  strength: number = 1.0 // 0-1, where 1 is perfect quantize
): any[] => {
  return clips.map(clip => {
    const snappedStart = snapToGrid(clip.startTime, snapType, bpm);
    const diff = snappedStart - clip.startTime;
    
    return {
      ...clip,
      startTime: clip.startTime + diff * strength,
    };
  });
};
