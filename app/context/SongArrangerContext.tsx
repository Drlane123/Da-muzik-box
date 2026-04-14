/**
 * SongArrangerContext — manages Song Sections (Isle Containers)
 * Each section = { id, name, startBar, lenBars, color, type, wavePreviewId }
 * Templates auto-divide 100 bars into industry-standard song structures
 */
import React, { createContext, useCallback, useContext, useState } from 'react';


export type SectionType = 'Intro' | 'Verse' | 'Pre-Chorus' | 'Chorus' | 'Bridge' | 'Breakdown' | 'Outro' | 'Drop' | 'Build';


export interface SongSection {
  id: number;
  name: string;
  type: SectionType;
  startBar: number;
  lenBars: number;
  color: string;
  wavePreviewId?: number; // clipId for waveform preview
  locked?: boolean;
}


const TYPE_COLORS: Record<SectionType, string> = {
  'Intro':      '#00E5FF',
  'Verse':      '#00ff88',
  'Pre-Chorus': '#ffcc00',
  'Chorus':     '#D500F9',
  'Bridge':     '#ff6b35',
  'Breakdown':  '#a78bfa',
  'Outro':      '#60a5fa',
  'Drop':       '#f472b6',
  'Build':      '#fbbf24',
};


export const SECTION_TYPE_COLORS = TYPE_COLORS;


export interface SongArrangerTemplate {
  name: string;
  sections: Omit<SongSection, 'id' | 'color'>[];
}


export const TEMPLATES: Record<string, SongArrangerTemplate> = {
  Pop: {
    name: 'Pop',
    sections: [
      { name: 'Intro',      type: 'Intro',      startBar: 1,  lenBars: 4 },
      { name: 'Verse 1',    type: 'Verse',      startBar: 5,  lenBars: 8 },
      { name: 'Pre-Chorus', type: 'Pre-Chorus', startBar: 13, lenBars: 4 },
      { name: 'Chorus 1',   type: 'Chorus',     startBar: 17, lenBars: 8 },
      { name: 'Verse 2',    type: 'Verse',      startBar: 25, lenBars: 8 },
      { name: 'Chorus 2',   type: 'Chorus',     startBar: 33, lenBars: 8 },
      { name: 'Bridge',     type: 'Bridge',     startBar: 41, lenBars: 8 },
      { name: 'Chorus Out', type: 'Chorus',     startBar: 49, lenBars: 8 },
      { name: 'Outro',      type: 'Outro',      startBar: 57, lenBars: 8 },
    ],
  },
  'Hip-Hop': {
    name: 'Hip-Hop',
    sections: [
      { name: 'Intro',   type: 'Intro',      startBar: 1,  lenBars: 4  },
      { name: 'Verse 1', type: 'Verse',      startBar: 5,  lenBars: 16 },
      { name: 'Hook 1',  type: 'Chorus',     startBar: 21, lenBars: 8  },
      { name: 'Verse 2', type: 'Verse',      startBar: 29, lenBars: 16 },
      { name: 'Hook 2',  type: 'Chorus',     startBar: 45, lenBars: 8  },
      { name: 'Bridge',  type: 'Bridge',     startBar: 53, lenBars: 8  },
      { name: 'Outro',   type: 'Outro',      startBar: 61, lenBars: 4  },
    ],
  },
  EDM: {
    name: 'EDM',
    sections: [
      { name: 'Intro',      type: 'Intro',     startBar: 1,  lenBars: 8  },
      { name: 'Build 1',    type: 'Build',     startBar: 9,  lenBars: 8  },
      { name: 'Drop 1',     type: 'Drop',      startBar: 17, lenBars: 16 },
      { name: 'Breakdown',  type: 'Breakdown', startBar: 33, lenBars: 8  },
      { name: 'Build 2',    type: 'Build',     startBar: 41, lenBars: 8  },
      { name: 'Drop 2',     type: 'Drop',      startBar: 49, lenBars: 16 },
      { name: 'Outro',      type: 'Outro',     startBar: 65, lenBars: 8  },
    ],
  },
  Trap: {
    name: 'Trap',
    sections: [
      { name: 'Intro',   type: 'Intro',      startBar: 1,  lenBars: 4  },
      { name: 'Verse 1', type: 'Verse',      startBar: 5,  lenBars: 8  },
      { name: 'Hook',    type: 'Chorus',     startBar: 13, lenBars: 8  },
      { name: 'Verse 2', type: 'Verse',      startBar: 21, lenBars: 8  },
      { name: 'Hook 2',  type: 'Chorus',     startBar: 29, lenBars: 8  },
      { name: 'Breakdown', type: 'Breakdown', startBar: 37, lenBars: 4 },
      { name: 'Outro',   type: 'Outro',      startBar: 41, lenBars: 4  },
    ],
  },
  Cinematic: {
    name: 'Cinematic',
    sections: [
      { name: 'Prelude',    type: 'Intro',      startBar: 1,  lenBars: 8  },
      { name: 'Theme A',    type: 'Verse',      startBar: 9,  lenBars: 16 },
      { name: 'Transition', type: 'Bridge',     startBar: 25, lenBars: 4  },
      { name: 'Climax',     type: 'Chorus',     startBar: 29, lenBars: 16 },
      { name: 'Breakdown',  type: 'Breakdown',  startBar: 45, lenBars: 8  },
      { name: 'Theme B',    type: 'Verse',      startBar: 53, lenBars: 16 },
      { name: 'Finale',     type: 'Chorus',     startBar: 69, lenBars: 8  },
      { name: 'Coda',       type: 'Outro',      startBar: 77, lenBars: 8  },
    ],
  },
};


const DEFAULT_SECTIONS: SongSection[] = TEMPLATES['Hip-Hop'].sections.map((s, i) => ({
  ...s, id: i + 1, color: TYPE_COLORS[s.type],
}));


interface SongArrangerContextValue {
  sections: SongSection[];
  setSections: (s: SongSection[]) => void;
  selectedSectionId: number | null;
  setSelectedSectionId: (id: number | null) => void;
  applyTemplate: (name: string) => void;
  addSection: (type: SectionType, startBar: number, lenBars: number) => void;
  moveSection: (id: number, newStartBar: number) => void;
  resizeSection: (id: number, newLen: number) => void;
  deleteSection: (id: number) => void;
  setSectionWavePreview: (id: number, clipId: number) => void;
  activeTemplateName: string;
}


const SongArrangerContext = createContext<SongArrangerContextValue | null>(null);


let nextSectionId = DEFAULT_SECTIONS.length + 1;


export function SongArrangerProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSections] = useState<SongSection[]>(DEFAULT_SECTIONS);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [activeTemplateName, setActiveTemplateName] = useState('Hip-Hop');

  const applyTemplate = useCallback((name: string) => {
    const tmpl = TEMPLATES[name];
    if (!tmpl) return;
    setSections(tmpl.sections.map((s, i) => ({ ...s, id: i + 1, color: TYPE_COLORS[s.type] })));
    setActiveTemplateName(name);
    nextSectionId = tmpl.sections.length + 1;
  }, []);

  const addSection = useCallback((type: SectionType, startBar: number, lenBars: number) => {
    const id = nextSectionId++;
    setSections(prev => [...prev, { id, name: type, type, startBar, lenBars, color: TYPE_COLORS[type] }]);
  }, []);

  const moveSection = useCallback((id: number, newStartBar: number) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, startBar: Math.max(1, newStartBar) } : s));
  }, []);

  const resizeSection = useCallback((id: number, newLen: number) => {
    // Snap to nearest bar
    const snapped = Math.max(2, Math.round(newLen));
    setSections(prev => prev.map(s => s.id === id ? { ...s, lenBars: snapped } : s));
  }, []);

  const deleteSection = useCallback((id: number) => {
    setSections(prev => prev.filter(s => s.id !== id));
  }, []);

  const setSectionWavePreview = useCallback((id: number, clipId: number) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, wavePreviewId: clipId } : s));
  }, []);

  return (
    <SongArrangerContext.Provider value={{
      sections, setSections,
      selectedSectionId, setSelectedSectionId,
      applyTemplate, addSection, moveSection, resizeSection, deleteSection,
      setSectionWavePreview,
      activeTemplateName,
    }}>
      {children}
    </SongArrangerContext.Provider>
  );
}


export function useSongArranger() {
  const ctx = useContext(SongArrangerContext);
  if (!ctx) throw new Error('useSongArranger must be inside SongArrangerProvider');
  return ctx;
}
