import React, { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, AlertCircle, Phone, MapPin, CreditCard, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PaymentMethod, Order } from '../types';

const ADDIS_SUBCITIES = [
  'Bole (ቦሌ)',
  'Yeka (የካ)',
  'Kirkos (ቂርቆስ)',
  'Arada (አራዳ)',
  'Gullele (ጉለሌ)',
  'Lideta (ልደታ)',
  'Nifas Silk-Lafto (ንፋስ ስልክ)',
  'Kolfe Keranio (ኮልፌ ቀራንዮ)',
  'Akaky Kaliti (አቃቂ ቃሊቲ)',
  'Lemi Kura (ለሚ ኩራ)',
];

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    cart,
    clearCart,
    cartSubtotal,
    t,
    isTelegramMode,
    telegramUser,
    addTrackedOrderId,
    setActiveOrderForTracking,
  } = useApp();

  const [fullName, setFullName] = useState(
    telegramUser ? `${telegramUser.first_name} ${telegramUser.username ? '@' + telegramUser.username : ''}` : ''
  );
  const [phone, setPhone] = useState('+251 ');
  const [subcity, setSubcity] = useState(ADDIS_SUBCITIES[0].split(' ')[0]);
  const [woreda, setWoreda] = useState('03');
  const [landmark, setLandmark] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isCheckoutOpen) return null;

  const isFreeDelivery = cartSubtotal >= 1200;
  const deliveryFee = isFreeDelivery ? 0 : 100;
  const grandTotal = cartSubtotal + deliveryFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage(t('checkout.fullName') + ' is required');
      return;
    }

    if (phone.trim().length < 9) {
      setErrorMessage('Please enter a valid phone number');
      return;
    }

    setIsSubmitting(true);

    try {
      const idempotencyKey = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const payload = {
        customer_name: fullName.trim(),
        customer_phone: phone.trim(),
        delivery_subcity: subcity,
        delivery_woreda: woreda,
        delivery_landmark: landmark.trim(),
        delivery_notes: deliveryNotes.trim(),
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim() || undefined,
        items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
        })),
        idempotency_key: idempotencyKey,
        source: isTelegramMode ? 'TELEGRAM_MINI_APP' : 'WEB',
      };

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to place order');
      }

      const createdOrder: Order = data.data;

      // Order placed successfully
      clearCart();
      addTrackedOrderId(createdOrder.id);
      setIsCheckoutOpen(false);
      setActiveOrderForTracking(createdOrder);

      // Telegram haptic
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      } catch {}
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while creating order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">
                {t('checkout.title')}
              </h2>
              <p className="text-xs text-stone-500">
                Authoritative Addis Ababa Delivery & Payment
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCheckoutOpen(false)}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmitOrder} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Customer Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                {t('checkout.fullName')} *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Almaz Tadesse"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                {t('checkout.phone')} *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('checkout.phonePlaceholder')}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
                <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-3" />
              </div>
            </div>
          </div>

          {/* Delivery Location */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-700/60 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
              <MapPin className="w-4 h-4 text-amber-500" />
              <span>Addis Ababa Delivery Location</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  {t('checkout.subcity')} *
                </label>
                <select
                  value={subcity}
                  onChange={(e) => setSubcity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  {ADDIS_SUBCITIES.map((sc) => (
                    <option key={sc} value={sc.split(' ')[0]}>
                      {sc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                  {t('checkout.woreda')}
                </label>
                <input
                  type="text"
                  value={woreda}
                  onChange={(e) => setWoreda(e.target.value)}
                  placeholder="e.g. 03"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                {t('checkout.landmark')} *
              </label>
              <input
                type="text"
                required
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder={t('checkout.landmarkPlaceholder')}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                {t('checkout.deliveryNotes')}
              </label>
              <input
                type="text"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Gate color, building name, bell number..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
              {t('checkout.paymentMethod')} *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                className={`p-3 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                  paymentMethod === 'CASH_ON_DELIVERY'
                    ? 'border-amber-500 bg-amber-500/10 text-stone-950 dark:text-white font-bold ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>{t('checkout.cod')}</span>
                {paymentMethod === 'CASH_ON_DELIVERY' && (
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('TELEBIRR')}
                className={`p-3 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                  paymentMethod === 'TELEBIRR'
                    ? 'border-amber-500 bg-amber-500/10 text-stone-950 dark:text-white font-bold ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>{t('checkout.telebirr')}</span>
                {paymentMethod === 'TELEBIRR' && (
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CBE_BIRR')}
                className={`p-3 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                  paymentMethod === 'CBE_BIRR'
                    ? 'border-amber-500 bg-amber-500/10 text-stone-950 dark:text-white font-bold ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>{t('checkout.cbeBirr')}</span>
                {paymentMethod === 'CBE_BIRR' && (
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('IN_STORE_PICKUP')}
                className={`p-3 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                  paymentMethod === 'IN_STORE_PICKUP'
                    ? 'border-amber-500 bg-amber-500/10 text-stone-950 dark:text-white font-bold ring-1 ring-amber-500'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
              >
                <span>{t('checkout.inStore')}</span>
                {paymentMethod === 'IN_STORE_PICKUP' && (
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                )}
              </button>
            </div>

            {/* Payment Reference field for Telebirr / CBE */}
            {(paymentMethod === 'TELEBIRR' || paymentMethod === 'CBE_BIRR') && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs space-y-2 mt-2">
                <p className="text-stone-700 dark:text-stone-300">
                  {paymentMethod === 'TELEBIRR'
                    ? t('checkout.telebirrInstructions')
                    : t('checkout.cbeInstructions')}
                </p>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={t('checkout.referencePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
            )}
          </div>

          {/* Total Summary */}
          <div className="p-3.5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-xs space-y-1.5">
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>{t('cart.subtotal')}</span>
              <span>{cartSubtotal} ETB</span>
            </div>
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>{t('cart.deliveryFee')}</span>
              <span>{isFreeDelivery ? 'FREE' : '100 ETB'}</span>
            </div>
            <div className="pt-2 border-t border-stone-200 dark:border-stone-700 flex justify-between font-black text-sm text-stone-900 dark:text-stone-100">
              <span>{t('cart.total')}</span>
              <span className="text-amber-700 dark:text-amber-400">{grandTotal} ETB</span>
            </div>
          </div>

          {/* Place Order Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-black text-sm shadow-lg shadow-amber-600/20 active:scale-98 transition"
          >
            <Lock className="w-4 h-4" />
            <span>{isSubmitting ? t('checkout.placing') : t('checkout.placeOrder')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
