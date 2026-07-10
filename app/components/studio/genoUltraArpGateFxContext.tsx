'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { genoArpGateLaneIsBlank } from '@/app/lib/studio/genoUltraArpAnalogGate';
import { emptyGenoArpLaneLevels } from '@/app/lib/studio/genoUltraArpPattern';
import {
  type GenoArpPumperRateIdx,
  genoArpSanitizePumperRateIdx,
} from '@/app/lib/studio/genoUltraArpPumper';

export type GenoUltraArpGateFxSnapshot = {
  gateLevels?: number[];
  gateFxOn?: boolean;
  gateFxDepth?: number;
  gateFxAttackMs?: number;
  gateFxReleaseMs?: number;
  pumperOn?: boolean;
  pumperRate?: GenoArpPumperRateIdx;
  pumperDepth?: number;
  pumperAttackMs?: number;
  pumperReleaseMs?: number;
  pumperHighFilter?: number;
  pumperLowFilter?: number;
};

const DEFAULT_GATE_FX_DEPTH = 0.88;
const DEFAULT_GATE_FX_ATTACK_MS = 4;
const DEFAULT_GATE_FX_RELEASE_MS = 52;
const DEFAULT_PUMPER_RATE: GenoArpPumperRateIdx = 2;
const DEFAULT_PUMPER_DEPTH = 0.72;
const DEFAULT_PUMPER_ATTACK_MS = 4;
const DEFAULT_PUMPER_RELEASE_MS = 120;

type GenoUltraArpGateFxContextValue = {
  gateLevels: number[];
  setGateLevels: Dispatch<SetStateAction<number[]>>;
  gateFxOn: boolean;
  setGateFxOn: (on: boolean) => void;
  gateFxDepth: number;
  setGateFxDepth: (n: number) => void;
  gateFxAttackMs: number;
  setGateFxAttackMs: (n: number) => void;
  gateFxReleaseMs: number;
  setGateFxReleaseMs: (n: number) => void;
  pumperOn: boolean;
  setPumperOn: (on: boolean) => void;
  pumperRate: GenoArpPumperRateIdx;
  setPumperRate: (idx: GenoArpPumperRateIdx) => void;
  pumperDepth: number;
  setPumperDepth: (n: number) => void;
  pumperAttackMs: number;
  setPumperAttackMs: (n: number) => void;
  pumperReleaseMs: number;
  setPumperReleaseMs: (n: number) => void;
  pumperHighFilter: number;
  setPumperHighFilter: (n: number) => void;
  pumperLowFilter: number;
  setPumperLowFilter: (n: number) => void;
  resetGateFx: () => void;
  applyGateFxSnapshot: (snap: GenoUltraArpGateFxSnapshot) => void;
  gateLevelsRef: { current: number[] };
  gateFxOnRef: { current: boolean };
  gateFxDepthRef: { current: number };
  gateFxAttackMsRef: { current: number };
  gateFxReleaseMsRef: { current: number };
  pumperOnRef: { current: boolean };
  pumperRateRef: { current: GenoArpPumperRateIdx };
  pumperDepthRef: { current: number };
  pumperAttackMsRef: { current: number };
  pumperReleaseMsRef: { current: number };
  pumperHighFilterRef: { current: number };
  pumperLowFilterRef: { current: number };
};

const GenoUltraArpGateFxContext = createContext<GenoUltraArpGateFxContextValue | null>(null);

export function GenoUltraArpGateFxProvider({ children }: { children: ReactNode }) {
  const [gateLevels, setGateLevels] = useState(() => emptyGenoArpLaneLevels(0));
  const [gateFxOn, setGateFxOn] = useState(false);
  const [gateFxDepth, setGateFxDepth] = useState(DEFAULT_GATE_FX_DEPTH);
  const [gateFxAttackMs, setGateFxAttackMs] = useState(DEFAULT_GATE_FX_ATTACK_MS);
  const [gateFxReleaseMs, setGateFxReleaseMs] = useState(DEFAULT_GATE_FX_RELEASE_MS);
  const [pumperOn, setPumperOn] = useState(false);
  const [pumperRate, setPumperRateState] = useState<GenoArpPumperRateIdx>(DEFAULT_PUMPER_RATE);
  const [pumperDepth, setPumperDepth] = useState(DEFAULT_PUMPER_DEPTH);
  const [pumperAttackMs, setPumperAttackMs] = useState(DEFAULT_PUMPER_ATTACK_MS);
  const [pumperReleaseMs, setPumperReleaseMs] = useState(DEFAULT_PUMPER_RELEASE_MS);
  const [pumperHighFilter, setPumperHighFilter] = useState(0);
  const [pumperLowFilter, setPumperLowFilter] = useState(0);

  const setPumperRate = useCallback((idx: GenoArpPumperRateIdx) => {
    setPumperRateState(genoArpSanitizePumperRateIdx(idx));
  }, []);

  const gateLevelsRef = useRef(gateLevels);
  gateLevelsRef.current = gateLevels;
  const gateFxOnRef = useRef(gateFxOn);
  gateFxOnRef.current = gateFxOn;
  const gateFxDepthRef = useRef(gateFxDepth);
  gateFxDepthRef.current = gateFxDepth;
  const gateFxAttackMsRef = useRef(gateFxAttackMs);
  gateFxAttackMsRef.current = gateFxAttackMs;
  const gateFxReleaseMsRef = useRef(gateFxReleaseMs);
  gateFxReleaseMsRef.current = gateFxReleaseMs;
  const pumperOnRef = useRef(pumperOn);
  pumperOnRef.current = pumperOn;
  const pumperRateRef = useRef(pumperRate);
  pumperRateRef.current = pumperRate;
  const pumperDepthRef = useRef(pumperDepth);
  pumperDepthRef.current = pumperDepth;
  const pumperAttackMsRef = useRef(pumperAttackMs);
  pumperAttackMsRef.current = pumperAttackMs;
  const pumperReleaseMsRef = useRef(pumperReleaseMs);
  pumperReleaseMsRef.current = pumperReleaseMs;
  const pumperHighFilterRef = useRef(pumperHighFilter);
  pumperHighFilterRef.current = pumperHighFilter;
  const pumperLowFilterRef = useRef(pumperLowFilter);
  pumperLowFilterRef.current = pumperLowFilter;

  const resetGateFx = useCallback(() => {
    setGateLevels(emptyGenoArpLaneLevels(0));
    setGateFxOn(false);
    setGateFxDepth(DEFAULT_GATE_FX_DEPTH);
    setGateFxAttackMs(DEFAULT_GATE_FX_ATTACK_MS);
    setGateFxReleaseMs(DEFAULT_GATE_FX_RELEASE_MS);
    setPumperOn(false);
    setPumperRateState(DEFAULT_PUMPER_RATE);
    setPumperDepth(DEFAULT_PUMPER_DEPTH);
    setPumperAttackMs(DEFAULT_PUMPER_ATTACK_MS);
    setPumperReleaseMs(DEFAULT_PUMPER_RELEASE_MS);
    setPumperHighFilter(0);
    setPumperLowFilter(0);
  }, []);

  const applyGateFxSnapshot = useCallback((snap: GenoUltraArpGateFxSnapshot) => {
    if (snap.gateLevels) setGateLevels([...snap.gateLevels]);
    if (snap.gateFxOn != null) setGateFxOn(snap.gateFxOn);
    if (snap.gateFxDepth != null) setGateFxDepth(snap.gateFxDepth);
    if (snap.gateFxAttackMs != null) setGateFxAttackMs(snap.gateFxAttackMs);
    if (snap.gateFxReleaseMs != null) setGateFxReleaseMs(snap.gateFxReleaseMs);
    if (snap.pumperOn != null) setPumperOn(snap.pumperOn);
    if (snap.pumperRate != null) setPumperRateState(genoArpSanitizePumperRateIdx(snap.pumperRate));
    if (snap.pumperDepth != null) setPumperDepth(snap.pumperDepth);
    if (snap.pumperAttackMs != null) setPumperAttackMs(snap.pumperAttackMs);
    if (snap.pumperReleaseMs != null) setPumperReleaseMs(snap.pumperReleaseMs);
    if (snap.pumperHighFilter != null) setPumperHighFilter(snap.pumperHighFilter);
    if (snap.pumperLowFilter != null) setPumperLowFilter(snap.pumperLowFilter);
  }, []);

  const value = useMemo(
    () => ({
      gateLevels,
      setGateLevels,
      gateFxOn,
      setGateFxOn,
      gateFxDepth,
      setGateFxDepth,
      gateFxAttackMs,
      setGateFxAttackMs,
      gateFxReleaseMs,
      setGateFxReleaseMs,
      pumperOn,
      setPumperOn,
      pumperRate,
      setPumperRate,
      pumperDepth,
      setPumperDepth,
      pumperAttackMs,
      setPumperAttackMs,
      pumperReleaseMs,
      setPumperReleaseMs,
      pumperHighFilter,
      setPumperHighFilter,
      pumperLowFilter,
      setPumperLowFilter,
      resetGateFx,
      applyGateFxSnapshot,
      gateLevelsRef,
      gateFxOnRef,
      gateFxDepthRef,
      gateFxAttackMsRef,
      gateFxReleaseMsRef,
      pumperOnRef,
      pumperRateRef,
      pumperDepthRef,
      pumperAttackMsRef,
      pumperReleaseMsRef,
      pumperHighFilterRef,
      pumperLowFilterRef,
    }),
    [
      gateLevels,
      gateFxOn,
      gateFxDepth,
      gateFxAttackMs,
      gateFxReleaseMs,
      pumperOn,
      pumperRate,
      pumperDepth,
      pumperAttackMs,
      pumperReleaseMs,
      pumperHighFilter,
      pumperLowFilter,
      resetGateFx,
      applyGateFxSnapshot,
    ],
  );

  return (
    <GenoUltraArpGateFxContext.Provider value={value}>{children}</GenoUltraArpGateFxContext.Provider>
  );
}

export function useGenoUltraArpGateFx(): GenoUltraArpGateFxContextValue {
  const ctx = useContext(GenoUltraArpGateFxContext);
  if (!ctx) {
    throw new Error('useGenoUltraArpGateFx must be used within GenoUltraArpGateFxProvider');
  }
  return ctx;
}

export function useGenoUltraArpGateFxPreviewGetters() {
  const ctx = useGenoUltraArpGateFx();
  return {
    getGateFxOn: () => ctx.gateFxOnRef.current,
    getGateLaneAtStep: (step: number) => ctx.gateLevelsRef.current[step] ?? 0,
    getGateLaneBlank: () => genoArpGateLaneIsBlank(ctx.gateLevelsRef.current),
    getGateFxDepth: () => ctx.gateFxDepthRef.current,
    getGateFxAttackMs: () => ctx.gateFxAttackMsRef.current,
    getGateFxReleaseMs: () => ctx.gateFxReleaseMsRef.current,
    getPumperOn: () => ctx.pumperOnRef.current,
    getPumperRate: () => ctx.pumperRateRef.current,
    getPumperDepth: () => ctx.pumperDepthRef.current,
    getPumperAttackMs: () => ctx.pumperAttackMsRef.current,
    getPumperReleaseMs: () => ctx.pumperReleaseMsRef.current,
    getPumperHighFilter: () => ctx.pumperHighFilterRef.current,
    getPumperLowFilter: () => ctx.pumperLowFilterRef.current,
  };
}
