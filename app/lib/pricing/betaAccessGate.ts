/**
 * Beta invite gate — Pricing screen must unlock before the rest of the app.
 * Cleared on every full page load (same cadence as the session plan).
 */

export const BETA_ACCESS_CODE = '1010222266';

const STORAGE_KEY = 'dmb-beta-access-v1';

export function isBetaAccessUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearBetaAccess(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Digits-only compare so spaces / dashes still work. */
export function normalizeBetaAccessCode(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export function tryUnlockBetaAccess(code: string): boolean {
  if (normalizeBetaAccessCode(code) !== BETA_ACCESS_CODE) return false;
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* still treat as unlocked for this session in memory via caller state */
  }
  return true;
}
