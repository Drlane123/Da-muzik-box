'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type LaneSoundStripGroupCtx = {
  openId: string | null;
  toggle: (id: string) => void;
  close: () => void;
  isOpen: (id: string) => boolean;
};

const Ctx = createContext<LaneSoundStripGroupCtx | null>(null);

export function Se2SynthGenoLaneSoundStripGroup({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);
  const close = useCallback(() => setOpenId(null), []);
  const value = useMemo(
    () => ({
      openId,
      toggle,
      close,
      isOpen: (id: string) => openId === id,
    }),
    [openId, toggle, close],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSe2SynthGenoLaneSoundStripGroup() {
  return useContext(Ctx);
}
