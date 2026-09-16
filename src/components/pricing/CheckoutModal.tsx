import React, { useState } from 'react';
import { X, Landmark, CreditCard, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { PricingPlan } from '../../data/pricingPlans';
import { startPaywayCheckout, PaywayPaymentOption, PaymentServiceError } from '../../utils/paymentService';

interface CheckoutModalProps {
  plan: PricingPlan;
  userEmail?: string;
  userName?: string;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  plan,
  userEmail,
  userName,
  onClose,
}) => {
  const [method, setMethod] = useState<PaywayPaymentOption>('abapay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [first, ...rest] = (userName || '').trim().split(' ');
  const lastGuess = rest.join(' ') || 'Customer';

  const handleContinue = async () => {
    setError(null);
    setIsProcessing(true);
    try {
      await startPaywayCheckout(plan.id, method, {
        email: userEmail || '',
        firstName: first || 'Jobify',
        lastName: lastGuess,
      });
      // On success the browser navigates away to PayWay, so there's
      // normally nothing left to do here.
    } catch (err) {
      setIsProcessing(false);
      setError(
        err instanceof PaymentServiceError
          ? err.message
          : 'Something went wrong starting checkout. Please try again.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-display">Complete your upgrade</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Secure checkout via ABA PayWay</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Order summary */}
        <div className="px-6 pt-4">
          <div className={`rounded-xl border ${plan.accent.ring.replace('ring-', 'border-')} ${plan.accent.bg} p-3.5 flex items-center justify-between`}>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Plan</div>
              <div className={`text-sm font-bold ${plan.accent.text}`}>{plan.name} Plan</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Billed</div>
              <div className="text-sm font-bold text-slate-900">
                ${plan.priceUsd.toFixed(2)}
                <span className="text-[11px] text-slate-500 font-medium">/mo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment method choice */}
        <div className="px-6 pt-4 space-y-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Choose payment method
          </label>

          <button
            type="button"
            onClick={() => setMethod('abapay')}
            className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              method === 'abapay'
                ? 'border-[#0057B8] bg-[#0057B8]/5 ring-2 ring-[#0057B8]/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-[#0057B8] text-white flex items-center justify-center shrink-0">
              <Landmark className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-900">ABA PayWay</div>
              <div className="text-[11px] text-slate-500">ABA account, KHQR, or ABA mobile app</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMethod('cards')}
            className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
              method === 'cards'
                ? 'border-[#0057B8] bg-[#0057B8]/5 ring-2 ring-[#0057B8]/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0">
              <CreditCard className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-900">Credit / Debit Card</div>
              <div className="text-[11px] text-slate-500">Visa, Mastercard — entered on PayWay's secure page</div>
            </div>
          </button>
        </div>

        {error && (
          <div className="px-6 pt-3">
            <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              {error}
            </div>
          </div>
        )}

        {/* Security note */}
        <div className="px-6 pt-3">
          <div className="flex items-start gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              You'll be redirected to ABA PayWay's checkout page to enter your card or ABA
              details. We never see or store your card number.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-4">
          <button
            onClick={handleContinue}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-[#0057B8] hover:bg-[#004494] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Redirecting to PayWay…</span>
              </>
            ) : (
              <>
                <span>Continue to secure payment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
