/**
 * Load a screen module via promise + useState (not React.lazy / Suspense).
 * Suspense left the spinner up until the user navigated away and came back —
 * the chunk was ready, but React never swapped the fallback.
 */
import { useEffect, useState, type ComponentType } from 'react';

// Screens take varied props; callers cast when rendering.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScreenComponent = ComponentType<any>;

const moduleCache = new Map<string, ScreenComponent>();
const inflight = new Map<string, Promise<ScreenComponent>>();

export function loadScreenModule(
  cacheKey: string,
  loader: () => Promise<{ default: ScreenComponent }>,
): Promise<ScreenComponent> {
  const hit = moduleCache.get(cacheKey);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(cacheKey);
  if (!p) {
    p = loader()
      .then((m) => {
        moduleCache.set(cacheKey, m.default);
        inflight.delete(cacheKey);
        return m.default;
      })
      .catch((err) => {
        inflight.delete(cacheKey);
        throw err;
      });
    inflight.set(cacheKey, p);
  }
  return p;
}

export function peekScreenModule(cacheKey: string): ScreenComponent | null {
  return moduleCache.get(cacheKey) ?? null;
}

export function useScreenModule(
  cacheKey: string,
  loader: () => Promise<{ default: ScreenComponent }>,
  enabled: boolean,
): { Comp: ScreenComponent | null; error: Error | null } {
  const [Comp, setComp] = useState<ScreenComponent | null>(() => peekScreenModule(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const cached = peekScreenModule(cacheKey);
    if (cached) {
      setComp(() => cached);
      setError(null);
      return;
    }
    let cancelled = false;
    loadScreenModule(cacheKey, loader)
      .then((C) => {
        if (!cancelled) {
          setComp(() => C);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
    // loader is a stable module-level function keyed by cacheKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  return { Comp, error };
}
