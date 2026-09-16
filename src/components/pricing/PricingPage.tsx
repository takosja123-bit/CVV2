import React, { useState } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { PlanTier } from '../../types';
import { PRICING_PLANS, PricingPlan } from '../../data/pricingPlans';
import { CheckoutModal } from './CheckoutModal';

interface PricingPageProps {
  currentTier: PlanTier;
  userEmail?: string;
  userName?: string;
  onClose: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({
  currentTier,
  userEmail,
  userName,
  onClose,
}) => {
  const [checkoutPlan, setCheckoutPlan] = useState<PricingPlan | null>(null);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1220]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#0B1220]/95 backdrop-blur border-b border-white/10 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/jobify-logo.png" alt="JobifyCV" className="h-8 w-8 rounded-lg" />
          <span className="text-white font-display font-bold text-sm">JobifyCV Cambodia</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Hero */}
      <div className="px-5 pt-12 pb-8 text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
          Choose your plan
        </h1>
        <p className="text-white/60 text-sm mt-2 max-w-md mx-auto">
          Simple pricing built for Cambodian jobseekers. Upgrade any time, cancel any time.
        </p>
      </div>

      {/* Plans */}
      <div className="px-5 pb-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRICING_PLANS.map((plan) => {
            const isCurrent = plan.id === currentTier;
            const isRecommended = !!plan.badge;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-white p-5 flex flex-col ${
                  isRecommended ? `ring-2 ${plan.accent.ring}` : 'ring-1 ring-white/10'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#0057B8] text-white flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {plan.badge}
                  </span>
                )}

                <div className="mt-1">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    {plan.name}
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-1">{plan.tagline}</div>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold text-slate-900">
                    ${plan.priceUsd.toFixed(plan.priceUsd % 1 === 0 ? 0 : 2)}
                  </span>
                  <span className="text-slate-500 text-xs font-medium">
                    {plan.period === 'forever' ? '' : '/ month'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (!isCurrent) setCheckoutPlan(plan);
                  }}
                  disabled={isCurrent}
                  className={`mt-4 w-full py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-[0.99] disabled:cursor-default ${
                    isCurrent ? 'bg-slate-100 text-slate-400' : plan.accent.button
                  }`}
                >
                  {isCurrent ? 'Your current plan' : plan.ctaLabel}
                </button>

                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-[11.5px] text-slate-600">
                      <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${plan.accent.text}`} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-white/40 text-[11px] mt-8">
          Payments processed securely by ABA PayWay. Cambodia's leading payment gateway.
        </p>
      </div>

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          userEmail={userEmail}
          userName={userName}
          onClose={() => setCheckoutPlan(null)}
        />
      )}
    </div>
  );
};
