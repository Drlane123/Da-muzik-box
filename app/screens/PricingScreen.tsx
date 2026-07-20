/**
 * Da Music Box — pricing / Payment Center (Ace Studio–style two-tier layout).
 * Beta gate: invite code required before Open Muzik Box / leaving this screen.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Sparkles, X } from 'lucide-react';

import {
  DA_MUSIC_BOX_PRICING_FAQS,
  DA_MUSIC_BOX_PRICING_FEATURES,
  DA_MUSIC_BOX_PRICING_PLANS,
  type PricingPlanId,
} from '@/app/lib/pricing/daMusicBoxPricing';
import {
  LOCAL_BILLING_STATUS,
  type BillingCenterStatus,
} from '@/app/lib/pricing/billingPreview';
import { fetchBillingStatus } from '@/app/lib/pricing/fetchBillingStatus';
import {
  isBetaAccessUnlocked,
  tryUnlockBetaAccess,
} from '@/app/lib/pricing/betaAccessGate';

const BG = '#07090c';
const PANEL = 'rgba(12, 16, 22, 0.92)';
const GOLD = '#d4af37';
const CYAN = '#00E5FF';
const PLATINUM = '#d4dce8';
const MUTED = 'rgba(212, 220, 232, 0.55)';
const LINE = 'rgba(255,255,255,0.1)';

export default function PricingScreen({
  onEnterApp,
}: {
  /** Opens the software after beta code unlock + short load. */
  onEnterApp?: (planId: PricingPlanId) => void;
} = {}) {
  const [loadingPlan, setLoadingPlan] = useState<PricingPlanId | null>(null);
  const [billing, setBilling] = useState<BillingCenterStatus>(LOCAL_BILLING_STATUS);
  const [accessCode, setAccessCode] = useState('');
  const [accessUnlocked, setAccessUnlocked] = useState(() => isBetaAccessUnlocked());
  const [accessError, setAccessError] = useState<string | null>(null);

  const plans = DA_MUSIC_BOX_PRICING_PLANS;

  useEffect(() => {
    const ac = new AbortController();
    void fetchBillingStatus(ac.signal).then(setBilling);
    return () => ac.abort();
  }, []);

  const unlockWithCode = () => {
    if (tryUnlockBetaAccess(accessCode)) {
      setAccessUnlocked(true);
      setAccessError(null);
      setAccessCode('');
      return true;
    }
    setAccessError('Invalid beta code. Try again.');
    return false;
  };

  const onChoose = (planId: PricingPlanId) => {
    if (loadingPlan) return;
    if (!accessUnlocked && !unlockWithCode()) return;
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
            Loading Da Muzik Box…
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
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
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
              }}
            >
              <Sparkles size={12} /> Plans
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                border: `1px solid rgba(0,229,255,0.45)`,
                background: 'rgba(0,229,255,0.1)',
                color: CYAN,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
              }}
            >
              Beta
            </div>
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
            Choose your Muzik Box
          </h1>
          <p style={{ margin: '12px auto 0', maxWidth: 560, color: MUTED, fontSize: 15, lineHeight: 1.45 }}>
            Two tiers. Basic is full suite access for recording, writing, and arrangement.
            Premium Plus unlocks <strong style={{ color: GOLD }}>Beat Lab</strong>,{' '}
            <strong style={{ color: GOLD }}>Beat Pads</strong>, and{' '}
            <strong style={{ color: GOLD }}>Mastering Bay</strong>.
            This build is <strong style={{ color: CYAN }}>beta</strong> — enter your invite code below to open the app.
          </p>

          <section
            aria-label="Beta access code"
            style={{
              margin: '22px auto 0',
              maxWidth: 420,
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: 12,
              border: `1px solid ${accessUnlocked ? 'rgba(93,255,154,0.35)' : 'rgba(212,175,55,0.4)'}`,
              background: accessUnlocked ? 'rgba(93,255,154,0.06)' : 'rgba(212,175,55,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1,
                color: accessUnlocked ? '#5dff9a' : GOLD,
                textTransform: 'uppercase',
              }}
            >
              <Lock size={14} />
              {accessUnlocked ? 'Beta unlocked' : 'Beta invite code'}
            </div>
            {accessUnlocked ? (
              <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.4 }}>
                You’re in. Choose a plan and open Da Muzik Box.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Enter beta code"
                    value={accessCode}
                    onChange={(e) => {
                      setAccessCode(e.target.value);
                      if (accessError) setAccessError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        unlockWithCode();
                      }
                    }}
                    style={{
                      flex: '1 1 160px',
                      minWidth: 0,
                      height: 40,
                      borderRadius: 8,
                      border: `1px solid ${LINE}`,
                      background: 'rgba(0,0,0,0.45)',
                      color: PLATINUM,
                      padding: '0 12px',
                      fontFamily: 'Rajdhani, sans-serif',
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: 1,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => unlockWithCode()}
                    style={{
                      height: 40,
                      padding: '0 16px',
                      borderRadius: 8,
                      border: '1px solid rgba(212,175,55,0.55)',
                      background: 'rgba(212,175,55,0.18)',
                      color: GOLD,
                      fontFamily: 'Rajdhani, sans-serif',
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    Unlock
                  </button>
                </div>
                {accessError && (
                  <p style={{ margin: '8px 0 0', color: '#ff7b7b', fontSize: 12, fontWeight: 700 }}>
                    {accessError}
                  </p>
                )}
                <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 12, lineHeight: 1.4 }}>
                  Open Muzik Box stays locked until this code is accepted.
                </p>
              </>
            )}
          </section>

          <section
            aria-label="Payment Center status"
            style={{
              margin: '22px auto 0',
              maxWidth: 720,
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: 12,
              border: `1px solid rgba(0,229,255,0.28)`,
              background: 'rgba(0, 229, 255, 0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  color: CYAN,
                  textTransform: 'uppercase',
                }}
              >
                {billing.paymentCenter}
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: `1px solid ${billing.mode === 'preview' ? 'rgba(212,175,55,0.45)' : 'rgba(0,229,255,0.45)'}`,
                  color: billing.mode === 'preview' ? GOLD : CYAN,
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {billing.mode}
              </span>
            </div>
            <p style={{ margin: 0, color: MUTED, fontSize: 13, lineHeight: 1.45 }}>{billing.message}</p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 10,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: PLATINUM,
              }}
            >
              <span style={{ color: billing.d1Ready ? '#5dff9a' : MUTED }}>
                D1 {billing.d1Ready ? 'ready' : 'pending'}
              </span>
              <span style={{ opacity: 0.35 }}>·</span>
              <span style={{ color: billing.stripeConnected ? '#5dff9a' : MUTED }}>
                Stripe {billing.stripeConnected ? 'connected' : 'not connected'}
              </span>
              <span style={{ opacity: 0.35 }}>·</span>
              <span style={{ color: billing.unlockAll ? '#5dff9a' : MUTED }}>
                Access {billing.unlockAll ? 'full (preview)' : 'entitlement-gated'}
              </span>
              <span style={{ opacity: 0.35 }}>·</span>
              <span style={{ color: billing.apiReached ? CYAN : MUTED }}>
                API {billing.apiReached ? 'online' : 'local fallback'}
              </span>
            </div>
          </section>

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
                <p style={{ margin: '0 0 18px', color: MUTED, fontSize: 13, lineHeight: 1.4, minHeight: 56 }}>
                  {plan.blurb}
                </p>

                <button
                  type="button"
                  disabled={Boolean(loadingPlan) || !accessUnlocked}
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
                    cursor: loadingPlan || !accessUnlocked ? 'not-allowed' : 'pointer',
                    opacity: !accessUnlocked || (loadingPlan && loadingPlan !== plan.id) ? 0.45 : 1,
                  }}
                >
                  {loadingPlan === plan.id
                    ? 'Loading…'
                    : accessUnlocked
                      ? 'Open Muzik Box'
                      : 'Enter beta code first'}
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
                              <Lock size={10} /> Premium Plus only
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
            Premium Plus unlocks
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
