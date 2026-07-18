-- Da Muzik Box billing / entitlements (Cloudflare D1)
-- Stripe owns charges; this DB stores who is on which plan.

CREATE TABLE IF NOT EXISTS billing_customers (
  id TEXT PRIMARY KEY,
  email TEXT,
  stripe_customer_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES billing_customers(id),
  stripe_subscription_id TEXT UNIQUE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('basic', 'premium')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'preview'
    CHECK (status IN ('preview', 'active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_subs_customer
  ON billing_subscriptions(customer_id);

CREATE INDEX IF NOT EXISTS idx_billing_subs_stripe
  ON billing_subscriptions(stripe_subscription_id);

-- App config row: preview unlock until Stripe is live.
CREATE TABLE IF NOT EXISTS billing_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO billing_config (key, value) VALUES
  ('preview_unlock_all', 'true'),
  ('stripe_connected', 'false'),
  ('payment_center_label', 'Da Muzik Box Payment Center');
