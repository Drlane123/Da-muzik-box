/**
 * ViewContext — Shared zoom / panel / playhead sync state across all screens
 * Global zoom, V-zoom, panel heights, selected bar highlight, auto-scroll
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

import { BEATS_PER_BAR } from '@/app/context/MasterClockContext';


interface ViewContextValue {
  /** Shared horizontal zoom — 1 = 60px/bar */
  globalZoom: number;
  setGlobalZoom: (z: number) => void;

  /** Per-screen vertical panel heights (px), 0 = auto */
  studioHeight: number;
  setStudioHeight: (h: number) => void;
  pianoHeight: number;
  setPianoHeight: (h: number) => void;
  arrangerHeight: number;
  setArrangerHeight: (h: number) => void;

  /** V-zoom for waveform amplitude */
  globalVZoom: number;
  setGlobalVZoom: (z: number) => void;

  /**
   * selectedBar — bar currently highlighted in Studio Editor ruler.
   * Piano Roll auto-centers on this bar when it changes.
   */
  selectedBar: number | null;
  /** Beat / quarter column within the bar (1..BEATS_PER_BAR). Null when no bar selected. */
  selectedMeasureInBar: number | null;
  setSelectedBar: (bar: number | null, measureInBar?: number | null) => void;

  /** Total bars to display (linked across screens) */
  totalDisplayBars: number;
  setTotalDisplayBars: (n: number) => void;

  /** Fit-to-window: compute zoom so N bars fill a given px width */
  fitBarsToWidth: (bars: number, widthPx: number, labelPx?: number) => void;
}


const ViewContext = createContext<ViewContextValue | null>(null);


export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [globalZoom, setGlobalZoom] = useState(1);
  const [studioHeight, setStudioHeight] = useState(0);
  const [pianoHeight, setPianoHeight] = useState(0);
  const [arrangerHeight, setArrangerHeight] = useState(0);
  const [globalVZoom, setGlobalVZoom] = useState(1);
  const [selectedBar, setSelectedBarState] = useState<number | null>(null);
  const [selectedMeasureInBar, setSelectedMeasureInBarState] = useState<number | null>(null);
  const [totalDisplayBars, setTotalDisplayBars] = useState(64);

  const setSelectedBar = useCallback((bar: number | null, measureInBar?: number | null) => {
    setSelectedBarState(bar);
    if (bar === null) {
      setSelectedMeasureInBarState(null);
      return;
    }
    const m =
      measureInBar === undefined || measureInBar === null
        ? 1
        : Math.max(1, Math.min(BEATS_PER_BAR, Math.round(measureInBar)));
    setSelectedMeasureInBarState(m);
  }, []);

  const fitBarsToWidth = useCallback((bars: number, widthPx: number, labelPx = 0) => {
    const availW = widthPx - labelPx;
    if (availW <= 0 || bars <= 0) return;
    const pxPerBar = availW / bars;
    // globalZoom: 1 = 60px/bar
    const z = Math.max(0.1, Math.min(4, pxPerBar / 60));
    setGlobalZoom(parseFloat(z.toFixed(3)));
  }, []);

  return (
    <ViewContext.Provider value={{
      globalZoom, setGlobalZoom,
      studioHeight, setStudioHeight,
      pianoHeight, setPianoHeight,
      arrangerHeight, setArrangerHeight,
      globalVZoom, setGlobalVZoom,
      selectedBar,
      selectedMeasureInBar,
      setSelectedBar,
      totalDisplayBars, setTotalDisplayBars,
      fitBarsToWidth,
    }}>
      {children}
    </ViewContext.Provider>
  );
}


export function useView() {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error('useView must be inside ViewProvider');
  return ctx;
}
