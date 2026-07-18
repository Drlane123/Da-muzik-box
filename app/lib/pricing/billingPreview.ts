/**
 * Billing / Payment Center — preview until Stripe is connected.
 *
 * Cloudflare D1 = store for customers + subscription rows.
 * Stripe = charges / Checkout / Customer Portal (not wired yet).
 *
 * While preview unlock is on, every Open Muzik Box path gets full Premium access.
 * Flip to false only after Stripe webhooks write real entitlements into D1.
 */

/** Client-side safety net — keep true until you ask to enforce paid plans. */
export const BILLING_PREVIEW_UNLOCK_ALL = true;

export type BillingCenterStatus = {
  ok: boolean;
  mode: 'preview' | 'live';
  paymentCenter: string;
  stripeConnected: boolean;
  d1Ready: boolean;
  unlockAll: boolean;
  effectivePlan: 'basic' | 'premium';
  message: string;
  /** True when the API responded (Cloudflare Functions). False = local Vite / offline. */
  apiReached: boolean;
};

export const LOCAL_BILLING_STATUS: BillingCenterStatus = {
  ok: true,
  mode: 'preview',
  paymentCenter: 'Da Muzik Box Payment Center',
  stripeConnected: false,
  d1Ready: false,
  unlockAll: true,
  effectivePlan: 'premium',
  message:
    'Local / preview — Payment Center UI is live. Full access on. D1 + Stripe connect on deploy when you are ready.',
  apiReached: false,
};
