import { PlanTier } from '../types';

export interface PricingPlan {
  id: PlanTier;
  name: string;
  tagline: string;
  priceUsd: number;
  period: 'month' | 'forever';
  accent: {
    ring: string;
    text: string;
    bg: string;
    button: string;
  };
  badge?: string;
  features: string[];
  ctaLabel: string;
}

// Keep priceUsd here in sync with server/payway.js — the backend is the source
// of truth for what a customer is actually charged.
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'Free Plan',
    name: 'Free',
    tagline: 'Try JobifyCV',
    priceUsd: 0,
    period: 'forever',
    accent: {
      ring: 'ring-slate-200',
      text: 'text-slate-700',
      bg: 'bg-slate-50',
      button: 'bg-slate-900 hover:bg-slate-800 text-white',
    },
    features: [
      '3 core CV templates',
      'Unlimited edits & autosave',
      'PDF export with watermark',
      'Basic ATS check',
    ],
    ctaLabel: 'Current plan',
  },
  {
    id: 'Basic Plan',
    name: 'Basic',
    tagline: 'For active jobseekers',
    priceUsd: 2.99,
    period: 'month',
    accent: {
      ring: 'ring-amber-300',
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      button: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    features: [
      'Everything in Free',
      '12+ modern CV templates',
      'Watermark-free PDF export',
      'Cover letter builder',
      'Job application tracker',
    ],
    ctaLabel: 'Upgrade to Basic',
  },
  {
    id: 'Pro Plan',
    name: 'Pro',
    tagline: 'Get noticed by recruiters',
    priceUsd: 6.99,
    period: 'month',
    badge: 'Most popular',
    accent: {
      ring: 'ring-[#0057B8]',
      text: 'text-[#0057B8]',
      bg: 'bg-[#0057B8]/5',
      button: 'bg-[#0057B8] hover:bg-[#004494] text-white',
    },
    features: [
      'Everything in Basic',
      'All ATS-optimized templates',
      'Deep ATS match scoring',
      'AI resume enhancement',
      'Verified job board access',
      'Priority cloud storage',
    ],
    ctaLabel: 'Upgrade to Pro',
  },
  {
    id: 'Premium Plan',
    name: 'Premium',
    tagline: 'Maximum visibility',
    priceUsd: 14.99,
    period: 'month',
    accent: {
      ring: 'ring-violet-400',
      text: 'text-violet-700',
      bg: 'bg-violet-50',
      button: 'bg-violet-600 hover:bg-violet-700 text-white',
    },
    features: [
      'Everything in Pro',
      'Direct hiring company access',
      'Telegram application alerts',
      'Priority human review',
      'Dedicated support',
    ],
    ctaLabel: 'Upgrade to Premium',
  },
];

export const getPlanById = (id: PlanTier) => PRICING_PLANS.find((p) => p.id === id);
