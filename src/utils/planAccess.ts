import { PlanTier } from '../types';

/**
 * Central place for subscription / plan-tier rules so the same logic is used
 * everywhere a template is locked/unlocked, an admin grants a plan, or a
 * subscription is checked for expiry.
 */

// Every paid subscription (Basic / Pro / Premium) — whether the user paid via
// PayWay or an admin granted it manually — lasts exactly this many days.
export const SUBSCRIPTION_DURATION_DAYS = 30;

export const PLAN_RANK: Record<PlanTier, number> = {
  'Free Plan': 0,
  'Basic Plan': 1,
  'Pro Plan': 2,
  'Premium Plan': 3,
};

/** ISO timestamp `days` from now — used to stamp a fresh subscription's expiry. */
export function computeExpiryDate(days: number = SUBSCRIPTION_DURATION_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isPlanExpired(planExpiresAt?: string | null): boolean {
  if (!planExpiresAt) return false;
  const expiry = new Date(planExpiresAt).getTime();
  if (Number.isNaN(expiry)) return false;
  return expiry < Date.now();
}

export function daysRemaining(planExpiresAt?: string | null): number | null {
  if (!planExpiresAt) return null;
  const ms = new Date(planExpiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * The plan a user should actually be treated as RIGHT NOW. Free Plan never
 * expires. A paid plan whose `planExpiresAt` has passed is treated as Free
 * Plan until they pay again / an admin re-grants it, even if the stored
 * `planTier` field on their profile hasn't been rewritten yet.
 */
export function getEffectivePlanTier(profile?: {
  planTier?: PlanTier | null;
  planExpiresAt?: string | null;
} | null): PlanTier {
  const planTier = profile?.planTier || 'Free Plan';
  if (planTier === 'Free Plan') return 'Free Plan';
  if (isPlanExpired(profile?.planExpiresAt)) return 'Free Plan';
  return planTier;
}

/** Can a user on `userPlan` use content that requires `requiredPlan`? Higher tiers include everything below them. */
export function canAccessTemplate(userPlan: PlanTier, requiredPlan: PlanTier): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan];
}

// How many NEW CVs (including duplicating an existing one) each plan tier may
// create per calendar day. `null` means unlimited.
export const DAILY_CV_LIMITS: Record<PlanTier, number | null> = {
  'Free Plan': 2,
  'Basic Plan': 5,
  'Pro Plan': null,
  'Premium Plan': null,
};

/** Today's date as YYYY-MM-DD, used as the rollover key for the daily CV quota. */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
