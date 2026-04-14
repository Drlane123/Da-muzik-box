import React, { createContext, useContext, useState } from 'react';


export interface PianoNote { row: number; col: number; }


interface PianoNotesContextValue {
  notes: PianoNote[];
  setNotes: (notes: PianoNote[]) => void;
  addNote: (row: number, col: number) => void;
  removeNote: (row: number, col: number) => void;
  clearNotes: () => void;
}


const PianoNotesContext = createContext<PianoNotesContextValue | null>(null);


export function PianoNotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<PianoNote[]>([]);

  function addNote(row: number, col: number) {
    setNotes(prev => {
      if (prev.some(n => n.row === row && n.col === col)) return prev;
      return [...prev, { row, col }];
    });
  }

  function removeNote(row: number, col: number) {
    setNotes(prev => prev.filter(n => !(n.row === row && n.col === col)));
  }

  function clearNotes() {
    setNotes([]);
  }

  return (
    <PianoNotesContext.Provider value={{ notes, setNotes, addNote, removeNote, clearNotes }}>
      {children}
    </PianoNotesContext.Provider>
  );
}


export function usePianoNotes() {
  const ctx = useContext(PianoNotesContext);
  if (!ctx) throw new Error('usePianoNotes must be used within PianoNotesProvider');
  return ctx;
}
