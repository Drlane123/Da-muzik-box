/**
 * GET /api/billing/plans
 * Plan catalog for the Payment Center (mirrors client pricing; Stripe price IDs later).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PagesFunction = (context: any) => Response | Promise<Response>;

type PlanRow = {
  id: 'basic' | 'premium';
  name: string;
  monthlyPriceUsd: number;
  yearlyPerMonthUsd: number;
  stripePriceMonthly: string | null;
  stripePriceYearly: string | null;
  checkoutReady: boolean;
};

const PLANS: PlanRow[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPriceUsd: 29.99,
    yearlyPerMonthUsd: 23.99,
    stripePriceMonthly: null,
    stripePriceYearly: null,
    checkoutReady: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPriceUsd: 59.99,
    yearlyPerMonthUsd: 47.99,
    stripePriceMonthly: null,
    stripePriceYearly: null,
    checkoutReady: false,
  },
];

export const onRequestGet: PagesFunction = async () => {
  return new Response(
    JSON.stringify({
      ok: true,
      mode: 'preview',
      checkoutReady: false,
      currency: 'usd',
      plans: PLANS,
      message: 'Plans are display-ready. Stripe Price IDs will fill in when checkout is wired.',
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      },
    },
  );
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
