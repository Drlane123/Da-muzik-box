import {
  LOCAL_BILLING_STATUS,
  type BillingCenterStatus,
} from '@/app/lib/pricing/billingPreview';

/** Fetch Payment Center status from Cloudflare Pages Function (falls back locally). */
export async function fetchBillingStatus(
  signal?: AbortSignal,
): Promise<BillingCenterStatus> {
  try {
    const res = await fetch('/api/billing/status', {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
      cache: 'no-store',
    });
    if (!res.ok) return { ...LOCAL_BILLING_STATUS, message: `Billing API HTTP ${res.status}` };
    const data = (await res.json()) as Partial<BillingCenterStatus>;
    return {
      ok: data.ok !== false,
      mode: data.mode === 'live' ? 'live' : 'preview',
      paymentCenter: data.paymentCenter ?? LOCAL_BILLING_STATUS.paymentCenter,
      stripeConnected: Boolean(data.stripeConnected),
      d1Ready: Boolean(data.d1Ready),
      unlockAll: data.unlockAll !== false,
      effectivePlan: data.effectivePlan === 'basic' ? 'basic' : 'premium',
      message: typeof data.message === 'string' ? data.message : LOCAL_BILLING_STATUS.message,
      apiReached: true,
    };
  } catch {
    return LOCAL_BILLING_STATUS;
  }
}
