/**
 * GET /api/billing/status
 * Payment Center health — works in preview without Stripe.
 * When D1 is bound + migrated, reports d1Ready and config flags.
 */
/* Cloudflare Pages Function — types come from the Workers runtime at deploy. */

type D1Prepared = { bind: (...a: unknown[]) => { all: <T>() => Promise<{ results?: T[] }> } };
type D1Like = { prepare: (sql: string) => D1Prepared };
type Env = { DB?: D1Like };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PagesFunction<E = unknown> = (context: any) => Response | Promise<Response>;

type BillingStatus = {
  ok: boolean;
  mode: 'preview' | 'live';
  paymentCenter: string;
  stripeConnected: boolean;
  d1Ready: boolean;
  unlockAll: boolean;
  /** Effective plan while preview unlock is on. */
  effectivePlan: 'basic' | 'premium';
  message: string;
};

function json(data: BillingStatus, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

const PREVIEW: BillingStatus = {
  ok: true,
  mode: 'preview',
  paymentCenter: 'Da Muzik Box Payment Center',
  stripeConnected: false,
  d1Ready: false,
  unlockAll: true,
  effectivePlan: 'premium',
  message:
    'Preview mode — full app access. Cloudflare D1 holds plan state; Stripe checkout comes later. Nothing is charged.',
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  if (!db) {
    return json({
      ...PREVIEW,
      message:
        'Preview mode — D1 not bound yet. Full access stays on. Create da-muzik-box-billing and set database_id in wrangler.toml.',
    });
  }

  try {
    const rows = await db
      .prepare(`SELECT key, value FROM billing_config WHERE key IN (?, ?, ?)`)
      .bind('preview_unlock_all', 'stripe_connected', 'payment_center_label')
      .all<{ key: string; value: string }>();

    const map = new Map((rows.results ?? []).map((r) => [r.key, r.value]));
    const unlockAll = (map.get('preview_unlock_all') ?? 'true') !== 'false';
    const stripeConnected = (map.get('stripe_connected') ?? 'false') === 'true';
    const paymentCenter =
      map.get('payment_center_label') ?? 'Da Muzik Box Payment Center';

    return json({
      ok: true,
      mode: stripeConnected && !unlockAll ? 'live' : 'preview',
      paymentCenter,
      stripeConnected,
      d1Ready: true,
      unlockAll,
      effectivePlan: 'premium',
      message: unlockAll
        ? 'Payment Center online (D1). Preview unlock is ON — full access, no Stripe charge yet.'
        : 'Payment Center online (D1). Entitlements follow subscription rows.',
    });
  } catch {
    return json({
      ...PREVIEW,
      d1Ready: false,
      message:
        'D1 bound but schema missing — run: bunx wrangler d1 migrations apply da-muzik-box-billing --remote. Full access stays on.',
    });
  }
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
