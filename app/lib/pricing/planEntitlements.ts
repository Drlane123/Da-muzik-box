/**
 * Session plan from Pricing → Open Music Box.
 * Basic locks Beat Lab, Beat Pads, and Mastering Bay (nav + add-track) — only when
 * BILLING_PREVIEW_UNLOCK_ALL is false (after Stripe + D1 go live).
 * Persist in sessionStorage so a refresh mid-session keeps the choice until a full new Pricing entry.
 * Full page load still starts on Pricing (app.tsx); choosing a plan overwrites this.
 */

import type { PricingPlanId } from '@/app/lib/pricing/daMusicBoxPricing';
import { BILLING_PREVIEW_UNLOCK_ALL } from '@/app/lib/pricing/billingPreview';
import type { CreationSubScreenId } from '@/app/lib/creationStation/creationSubScreens';
import type { ScreenId } from '@/app/lib/navigation/moduleNav';

const STORAGE_KEY = 'dmb-pricing-plan-v1';

export type AppPlanId = PricingPlanId;

let currentPlan: AppPlanId | null = null;
const listeners = new Set<() => void>();

function readStored(): AppPlanId | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === 'basic' || v === 'premium') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStored(plan: AppPlanId | null) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (!plan) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, plan);
  } catch {
    /* ignore */
  }
}

function emit() {
  for (const l of listeners) l();
  if (typeof document !== 'undefined') {
    if (currentPlan) document.body.dataset.dmbPlan = currentPlan;
    else delete document.body.dataset.dmbPlan;
  }
}

/** Call once at app boot so body dataset matches storage. */
export function hydratePlanEntitlement(): AppPlanId | null {
  currentPlan = readStored();
  emit();
  return currentPlan;
}

export function getAppPlan(): AppPlanId | null {
  return currentPlan;
}

export function setAppPlan(plan: AppPlanId) {
  currentPlan = plan;
  writeStored(plan);
  emit();
}

export function clearAppPlan() {
  currentPlan = null;
  writeStored(null);
  emit();
}

export function subscribeAppPlan(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Plan used for feature gates. Preview unlock forces Premium so you never lose access
 * while the Payment Center is being built (before Stripe).
 */
export function effectiveAppPlan(plan: AppPlanId | null = currentPlan): AppPlanId | null {
  if (BILLING_PREVIEW_UNLOCK_ALL) return 'premium';
  return plan;
}

export function isPremiumPlan(plan: AppPlanId | null = currentPlan): boolean {
  return effectiveAppPlan(plan) === 'premium';
}

export function isBasicPlan(plan: AppPlanId | null = currentPlan): boolean {
  return effectiveAppPlan(plan) === 'basic';
}

/** Premium-only top-level modules. */
export function screenAllowedForPlan(screen: ScreenId, plan: AppPlanId | null = currentPlan): boolean {
  if (effectiveAppPlan(plan) !== 'basic') return true;
  if (screen === 'master-arranger') return false;
  return true;
}

/** Premium-only Creation Station rooms. */
export function creationSubAllowedForPlan(
  sub: CreationSubScreenId,
  plan: AppPlanId | null = currentPlan,
): boolean {
  if (effectiveAppPlan(plan) !== 'basic') return true;
  if (sub === 'beat-lab' || sub === 'drum-kit-generator') return false;
  return true;
}

export function defaultCreationSubForPlan(plan: AppPlanId | null = currentPlan): CreationSubScreenId {
  return effectiveAppPlan(plan) === 'basic' ? 'groove-lab' : 'beat-lab';
}

export function canUseBeatPads(plan: AppPlanId | null = currentPlan): boolean {
  return effectiveAppPlan(plan) !== 'basic';
}

export function canUseMasteringBay(plan: AppPlanId | null = currentPlan): boolean {
  return effectiveAppPlan(plan) !== 'basic';
}

export function canUseBeatLab(plan: AppPlanId | null = currentPlan): boolean {
  return effectiveAppPlan(plan) !== 'basic';
}
