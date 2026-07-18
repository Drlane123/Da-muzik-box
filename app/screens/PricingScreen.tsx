/**
 * Da Music Box — pricing page (Ace Studio–style two-tier layout).
 * Preview mode: plan CTAs load the app (no paywall / Stripe yet).
 */

import { useMemo, useState, type CSSProperties } from 'react';
import { Check, Lock, Sparkles, X } from 'lucide-react';

import {
  DA_MUSIC_BOX_PRICING_FAQS,
  DA_MUSIC_BOX_PRICING_FEATURES,
  DA_MUSIC_BOX_PRICING_PLANS,
  planPriceLabel,
  yearlyDiscountPercent,
  type PricingBillingCycle,
  type PricingPlanId,
} from '@/app/lib/pricing/daMusicBoxPricing';

const BG = '#07090c';
const PANEL = 'rgba(12, 16, 22, 0.92)';
const GOLD = '#d4af37';
const CYAN = '#00E5FF';
const PLATINUM = '#d4dce8';
const MUTED = 'rgba(212, 220, 232, 0.55)';
const LINE = 'rgba(255,255,255,0.1)';

function cycleToggleStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 18px',
    borderRadius: 999,
    border: `1px solid ${active ? 'rgba(0, 229, 255, 0.55)' : LINE}`,
    background: active ? 'rgba(0, 229, 255, 0.14)' : 'transparent',
    color: active ? CYAN : MUTED,
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
}

export default function PricingScreen({
  onEnterApp,
}: {
  /** Opens the software after a short load (no access lock yet). */
  onEnterApp?: (planId: PricingPlanId) => void;
} = {}) {
  const [cycle, setCycle] = useState<PricingBillingCycle>('yearly');
  const [loadingPlan, setLoadingPlan] = useState<PricingPlanId | null>(null);

  const plans = DA_MUSIC_BOX_PRICING_PLANS;
  const yearlyOffPct = yearlyDiscountPercent(plans[0]);

  const onChoose = (planId: PricingPlanId) => {
    if (loadingPlan) return;
    setLoadingPlan(planId);
    window.setTimeout(() => {
      onEnterApp?.(planId);
      setLoadingPlan(null);
    }, 700);
  };

  const premiumOnlyLabels = useMemo(
    () => DA_MUSIC_BOX_PRICING_FEATURES.filter((f) => f.premiumOnly).map((f) => f.label),
    [],
  );

  return (
    <div
      className="w-full h-full overflow-y-auto relative"
      style={{
        background: `radial-gradient(1200px 600px at 50% -10%, rgba(212,175,55,0.12), transparent 55%), radial-gradient(900px 500px at 80% 20%, rgba(0,229,255,0.08), transparent 50%), ${BG}`,
        color: PLATINUM,
        fontFamily: 'Rajdhani, sans-serif',
      }}
    >
      {loadingPlan && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            background: 'rgba(7, 9, 12, 0.82)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '3px solid rgba(0,229,255,0.2)',
              borderTopColor: CYAN,
              animation: 'dmbPricingSpin 0.8s linear infinite',
            }}
          />
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 13,
              letterSpacing: 1.2,
              color: CYAN,
              fontWeight: 800,
              textTransform: 'uppercase',
            }}
          >
            Loading Da Music Box…
          </div>
          <style>{`@keyframes dmbPricingSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 64px' }}>
        <header style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              borderRadius: 999,
              border: `1px solid rgba(212,175,55,0.35)`,
              background: 'rgba(212,175,55,0.08)',
              color: GOLD,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            <Sparkles size={12} /> Plans
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(26px, 4vw, 40px)',
              fontWeight: 800,
              letterSpacing: 1,
              color: '#fff',
            }}
          >
            Choose your Music Box
          </h1>
          <p style={{ margin: '12px auto 0', maxWidth: 560, color: MUTED, fontSize: 15, lineHeight: 1.45 }}>
            Two tiers. Basic covers the suite for writing and arranging.
            Premium unlocks <strong style={{ color: GOLD }}>Beat Lab</strong>,{' '}
            <strong style={{ color: GOLD }}>Beat Pads</strong>, and{' '}
            <strong style={{ color: GOLD }}>Mastering Bay</strong>.
          </p>

          <div
            style={{
              display: 'inline-flex',
              gap: 6,
              marginTop: 20,
              padding: 4,
              borderRadius: 999,
              border: `1px solid ${LINE}`,
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            <button type="button" style={cycleToggleStyle(cycle === 'monthly')} onClick={() => setCycle('monthly')}>
              Monthly
            </button>
            <button type="button" style={cycleToggleStyle(cycle === 'yearly')} onClick={() => setCycle('yearly')}>
              Yearly
              <span style={{ marginLeft: 6, color: GOLD, fontSize: 10 }}>{yearlyOffPct}% OFF</span>
            </button>
          </div>
          {cycle === 'yearly' && (
            <p style={{ margin: '10px 0 0', color: GOLD, fontSize: 12, fontWeight: 800, letterSpacing: 0.4 }}>
              Yearly billing — {yearlyOffPct}% off vs monthly
            </p>
          )}
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          {plans.map((plan) => {
            const price = planPriceLabel(plan, cycle);
            const hi = Boolean(plan.highlighted);
            return (
              <article
                key={plan.id}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 22,
                  borderRadius: 16,
                  border: hi ? `1px solid rgba(212,175,55,0.55)` : `1px solid ${LINE}`,
                  background: hi
                    ? 'linear-gradient(165deg, rgba(212,175,55,0.12), rgba(12,16,22,0.96) 40%)'
                    : PANEL,
                  boxShadow: hi ? '0 0 40px rgba(212,175,55,0.12)' : 'none',
                }}
              >
                {plan.badge && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: 'rgba(212,175,55,0.18)',
                      border: '1px solid rgba(212,175,55,0.45)',
                      color: GOLD,
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                <div
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: 1,
                    color: hi ? GOLD : '#fff',
                    marginBottom: 8,
                  }}
                >
                  {plan.name}
                </div>
                <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.4, minHeight: 56 }}>
                  {plan.blurb}
                </p>

                <div style={{ marginTop: 18, marginBottom: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: 36,
                      fontWeight: 800,
                      color: '#fff',
                    }}
                  >
                    {price.perMonth}
                  </span>
                  <span style={{ color: MUTED, fontSize: 14 }}>/mo</span>
                  {cycle === 'yearly' && price.compareAtPerMonth && (
                    <>
                      <span
                        style={{
                          color: MUTED,
                          fontSize: 16,
                          textDecoration: 'line-through',
                          fontWeight: 700,
                        }}
                      >
                        {price.compareAtPerMonth}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(212,175,55,0.18)',
                          border: '1px solid rgba(212,175,55,0.45)',
                          color: GOLD,
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 0.6,
                        }}
                      >
                        {price.discountPercent}% OFF
                      </span>
                    </>
                  )}
                </div>
                <div style={{ color: MUTED, fontSize: 12, marginBottom: 18 }}>{price.billedNote}</div>

                <button
                  type="button"
                  disabled={Boolean(loadingPlan)}
                  onClick={() => onChoose(plan.id)}
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 10,
                    border: hi ? '1px solid rgba(212,175,55,0.65)' : `1px solid rgba(0,229,255,0.4)`,
                    background: hi
                      ? 'linear-gradient(90deg, rgba(212,175,55,0.95), rgba(232,196,80,0.9))'
                      : 'rgba(0,229,255,0.12)',
                    color: hi ? '#1a1408' : CYAN,
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: 15,
                    fontWeight: 900,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    cursor: loadingPlan ? 'wait' : 'pointer',
                    opacity: loadingPlan && loadingPlan !== plan.id ? 0.5 : 1,
                  }}
                >
                  {loadingPlan === plan.id ? 'Loading…' : 'Open Music Box'}
                </button>

                <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, display: 'grid', gap: 10 }}>
                  {DA_MUSIC_BOX_PRICING_FEATURES.map((row) => {
                    const included = !row.comingSoon && (plan.id === 'basic' ? row.basic : row.premium);
                    return (
                      <li
                        key={`${plan.id}-${row.label}`}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          opacity: included ? 1 : 0.45,
                        }}
                      >
                        <span
                          style={{
                            marginTop: 2,
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: included
                              ? row.premiumOnly
                                ? 'rgba(212,175,55,0.2)'
                                : 'rgba(0,229,255,0.15)'
                              : 'rgba(255,255,255,0.06)',
                            color: included ? (row.premiumOnly ? GOLD : CYAN) : MUTED,
                          }}
                        >
                          {included ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                        </span>
                        <span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 13,
                              fontWeight: 700,
                              color: included ? PLATINUM : MUTED,
                            }}
                          >
                            {row.label}
                            {row.comingSoon && (
                              <span style={{ marginLeft: 6, color: GOLD, fontSize: 10, fontWeight: 900 }}>
                                COMING SOON
                              </span>
                            )}
                            {!row.comingSoon && row.premiumOnly && plan.id === 'premium' && (
                              <span style={{ marginLeft: 6, color: GOLD, fontSize: 10, fontWeight: 900 }}>
                                PREMIUM
                              </span>
                            )}
                          </span>
                          {row.detail && (
                            <span style={{ display: 'block', fontSize: 11, color: MUTED, lineHeight: 1.3 }}>
                              {row.detail}
                            </span>
                          )}
                          {row.comingSoon ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 2,
                                fontSize: 10,
                                color: GOLD,
                                fontWeight: 700,
                              }}
                            >
                              Coming soon
                            </span>
                          ) : !included ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 2,
                                fontSize: 10,
                                color: MUTED,
                                fontWeight: 700,
                              }}
                            >
                              <Lock size={10} /> Premium only
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>

        <section
          style={{
            marginTop: 28,
            padding: 18,
            borderRadius: 14,
            border: `1px solid ${LINE}`,
            background: PANEL,
          }}
        >
          <h2
            style={{
              margin: '0 0 8px',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 14,
              letterSpacing: 1,
              color: GOLD,
            }}
          >
            Premium unlocks
          </h2>
          <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.45 }}>
            {premiumOnlyLabels.join(' · ')} — not included on Basic. Everything else in the suite stays on Basic.
          </p>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 14px',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 16,
              letterSpacing: 1,
              color: '#fff',
            }}
          >
            FAQ
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {DA_MUSIC_BOX_PRICING_FAQS.map((item) => (
              <details
                key={item.q}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${LINE}`,
                  background: PANEL,
                  padding: '12px 14px',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 14,
                    color: PLATINUM,
                    listStyle: 'none',
                  }}
                >
                  {item.q}
                </summary>
                <p style={{ margin: '10px 0 0', color: MUTED, fontSize: 13, lineHeight: 1.45 }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
