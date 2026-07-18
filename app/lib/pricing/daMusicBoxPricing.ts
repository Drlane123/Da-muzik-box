/**
 * Da Music Box — display pricing (Stripe + D1 entitlements come later).
 * Edit amounts here; the Pricing screen reads this file only.
 */

export type PricingPlanId = 'basic' | 'premium';
export type PricingBillingCycle = 'monthly' | 'yearly';

export interface PricingFeatureRow {
  label: string;
  /** Short note under the label (optional). */
  detail?: string;
  basic: boolean;
  premium: boolean;
  /** Call out Premium-only rows in the UI. */
  premiumOnly?: boolean;
  /** Not shipping yet — show unchecked + Coming soon on both plans. */
  comingSoon?: boolean;
}

export interface PricingPlan {
  id: PricingPlanId;
  name: string;
  blurb: string;
  badge?: string;
  /** Display dollars per month when billed monthly. */
  monthlyPriceUsd: number;
  /** Effective dollars per month when billed yearly. */
  yearlyPerMonthUsd: number;
  ctaLabel: string;
  highlighted?: boolean;
}

/** Placeholder display prices — swap when Stripe products are ready. */
export const DA_MUSIC_BOX_PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    blurb: 'Full suite access for writing and arranging — without Beat Lab, Beat Pads, or Mastering Bay.',
    monthlyPriceUsd: 29.99,
    yearlyPerMonthUsd: 23.99,
    ctaLabel: 'Get Basic',
  },
  {
    id: 'premium',
    name: 'Premium',
    blurb: 'Everything in Basic, plus Beat Lab, Beat Pads, and Mastering Bay for finish-ready productions.',
    badge: 'Most popular',
    monthlyPriceUsd: 59.99,
    yearlyPerMonthUsd: 47.99,
    ctaLabel: 'Get Premium',
    highlighted: true,
  },
] as const;

/**
 * Comparison rows.
 * Premium-only (Basic locked out): Beat Lab · Beat Pads · Mastering Bay.
 */
export const DA_MUSIC_BOX_PRICING_FEATURES: readonly PricingFeatureRow[] = [
  { label: 'Studio Editor 2', detail: 'Full DAW timeline, mix, and arrangement', basic: true, premium: true },
  { label: 'SE2 Chord Generator & MIDI Composer', basic: true, premium: true },
  { label: 'Synth Geno · Drum Generator · Groove Lead', basic: true, premium: true },
  { label: 'Groove Lab', detail: 'Progressions, Orchid strip, WaveLeaf', basic: true, premium: true },
  { label: 'Chord Builder', basic: true, premium: true },
  { label: '808 Lab', basic: true, premium: true },
  { label: 'Kit Generator', basic: true, premium: true },
  { label: 'Chord / Bass Sequencer', basic: true, premium: true },
  { label: 'AI Vocal Lab', basic: true, premium: true },
  { label: 'AI Music Match', basic: true, premium: true },
  {
    label: 'AI Song Generator',
    detail: 'Not built into the system yet',
    basic: false,
    premium: false,
    comingSoon: true,
  },
  { label: 'My Projects & Export', basic: true, premium: true },
  {
    label: 'Beat Lab',
    detail: 'Creation Station pads + synth lanes (CH 1–32)',
    basic: false,
    premium: true,
    premiumOnly: true,
  },
  {
    label: 'Beat Pads',
    detail: 'Studio Editor 2 drum machine · VocalBox · Lane Placements',
    basic: false,
    premium: true,
    premiumOnly: true,
  },
  {
    label: 'Mastering Bay',
    detail: 'Bass X → DMB Match → Master X1 · Save New Master',
    basic: false,
    premium: true,
    premiumOnly: true,
  },
] as const;

export const DA_MUSIC_BOX_PRICING_FAQS: readonly { q: string; a: string }[] = [
  {
    q: 'What is locked on Basic?',
    a: 'Beat Lab, Beat Pads (in Studio Editor 2), and Mastering Bay are Premium only. Open Muzik Box on Basic hides those from Modules and the SE2 add-track menu. Premium unlocks all three.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. When Stripe checkout is live you will be able to upgrade from Basic to Premium (and manage billing) from your account. This page is the plan preview until that wires up.',
  },
  {
    q: 'Is this charged yet?',
    a: 'Not yet. For now, Open Muzik Box loads the full app so you can preview the pricing page. Stripe and Cloudflare D1 entitlements come later — no features are locked today.',
  },
] as const;

export function formatUsd(amount: number): string {
  const whole = Number.isInteger(amount);
  return whole
    ? `$${amount}`
    : `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function yearlyDiscountPercent(plan: PricingPlan): number {
  if (plan.monthlyPriceUsd <= 0) return 0;
  return Math.round((1 - plan.yearlyPerMonthUsd / plan.monthlyPriceUsd) * 100);
}

export function planPriceLabel(plan: PricingPlan, cycle: PricingBillingCycle): {
  perMonth: string;
  billedNote: string;
  /** Shown only on yearly — Ace-style compare-at monthly price. */
  compareAtPerMonth?: string;
  discountPercent?: number;
  savePerYear?: string;
} {
  if (cycle === 'monthly') {
    return {
      perMonth: formatUsd(plan.monthlyPriceUsd),
      billedNote: 'Billed monthly',
    };
  }
  const yearlyTotal = Math.round(plan.yearlyPerMonthUsd * 12 * 100) / 100;
  const fullYearTotal = Math.round(plan.monthlyPriceUsd * 12 * 100) / 100;
  const saveYear = Math.round((fullYearTotal - yearlyTotal) * 100) / 100;
  const discountPercent = yearlyDiscountPercent(plan);
  return {
    perMonth: formatUsd(plan.yearlyPerMonthUsd),
    compareAtPerMonth: formatUsd(plan.monthlyPriceUsd),
    discountPercent,
    savePerYear: formatUsd(saveYear),
    billedNote: `Billed yearly · ${formatUsd(yearlyTotal)}/yr · save ${formatUsd(saveYear)}`,
  };
}
