/** Bumps when Geno Build 1/2 in-memory sessions change — Geno Ultra CHORD IN refreshes. */
let genoBuildSessionVersion = 0;
const listeners = new Set<() => void>();

export function getGenoBuildSessionVersion(): number {
  return genoBuildSessionVersion;
}

export function notifyGenoBuildSessionChanged(): void {
  genoBuildSessionVersion += 1;
  for (const fn of listeners) fn();
}

export function subscribeGenoBuildSessionChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
