'use client';

import React, { createContext, useContext, useCallback, useState } from 'react';

export interface HistoryAction {
  id: string;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}

interface UndoRedoContextType {
  history: HistoryAction[];
  currentIndex: number;
  addAction: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

const UndoRedoContext = createContext<UndoRedoContextType | undefined>(undefined);

export function UndoRedoProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const addAction = useCallback((action: HistoryAction) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(action);
      // Keep only last 50 actions
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex >= 0) {
      history[currentIndex]?.undo();
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      history[currentIndex + 1]?.redo();
    }
  }, [currentIndex, history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return (
    <UndoRedoContext.Provider
      value={{
        history,
        currentIndex,
        addAction,
        undo,
        redo,
        canUndo: currentIndex >= 0,
        canRedo: currentIndex < history.length - 1,
        clearHistory,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedo must be used within UndoRedoProvider');
  }
  return context;
}