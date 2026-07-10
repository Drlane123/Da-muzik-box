'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Se2BeatPadsLaneExportFormat = 'wav' | 'midi' | 'both';

export type Se2BeatPadsLaneExportRequest = {
  lanes: readonly number[];
  format: Se2BeatPadsLaneExportFormat;
};

export type Se2BeatPadsExportBridge = {
  padLabels: readonly string[];
  disabled?: boolean;
  exportStatus: string | null;
  runLaneExport: (req: Se2BeatPadsLaneExportRequest) => void | Promise<void>;
};

type BridgeCtxValue = {
  bridge: Se2BeatPadsExportBridge | null;
  setBridge: (bridge: Se2BeatPadsExportBridge | null) => void;
};

const Se2BeatPadsExportBridgeCtx = createContext<BridgeCtxValue | null>(null);

export function Se2BeatPadsExportBridgeProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<Se2BeatPadsExportBridge | null>(null);
  return (
    <Se2BeatPadsExportBridgeCtx.Provider value={{ bridge, setBridge }}>
      {children}
    </Se2BeatPadsExportBridgeCtx.Provider>
  );
}

export function useSe2BeatPadsExportBridge(): Se2BeatPadsExportBridge | null {
  return useContext(Se2BeatPadsExportBridgeCtx)?.bridge ?? null;
}

export function useRegisterSe2BeatPadsExportBridge(bridge: Se2BeatPadsExportBridge | null) {
  const ctx = useContext(Se2BeatPadsExportBridgeCtx);
  useEffect(() => {
    if (!ctx) return;
    ctx.setBridge(bridge);
    return () => {
      ctx.setBridge(null);
    };
  }, [bridge, ctx]);
}
