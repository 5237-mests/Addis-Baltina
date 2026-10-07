import React from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateQuantity,
    cartSubtotal,
    t,
    language,
    setIsCheckoutOpen,
  } = useApp();

  if (!isCartOpen) return null;

  const FREE_DELIVERY_THRESHOLD = 1200;
  const isFreeDelivery = cartSubtotal >= FREE_DELIVERY_THRESHOLD;
  const remainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - cartSubtotal);
  const progressPercent = Math.min(100, Math.round((cartSubtotal / FREE_DELIVERY_THRESHOLD) * 100));

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-stone-950/70 backdrop-blur-xs animate-fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">
                {t('cart.title')}
              </h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Delivery Progress */}
          {cart.length > 0 && (
            <div className="px-5 py-3 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/50 dark:border-amber-800/30">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-900 dark:text-amber-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  {isFreeDelivery
                    ? t('cart.freeDeliveryUnlocked')
                    : t('cart.freeDeliveryProgress', { amount: remainingForFree })}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-amber-200/60 dark:bg-amber-900/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Item List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
                <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-stone-400" />
                </div>
                <h3 className="font-bold text-base text-stone-800 dark:text-stone-200 mb-1">
                  {t('cart.empty')}
                </h3>
                <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                  {t('cart.emptySub')}
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const prod = item.product;
                const name =
                  language === 'am' ? prod.name_am : language === 'om' ? prod.name_om : prod.name_en;

                return (
                  <div
                    key={prod.id}
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-700/60"
                  >
                    <img
                      src={prod.image_url}
                      alt={prod.name_en}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                          {name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(prod.id)}
                          className="p-1 text-stone-400 hover:text-red-500 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-[11px] text-stone-500 dark:text-stone-400 mb-2">
                        {prod.unit} · {prod.price} ETB
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Quantity Controls */}
                        <div className="flex items-center bg-white dark:bg-stone-700 rounded-lg border border-stone-200 dark:border-stone-600 p-0.5">
                          <button
                            onClick={() => updateQuantity(prod.id, item.quantity - 1)}
                            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-600 rounded transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(prod.id, item.quantity + 1)}
                            disabled={item.quantity >= prod.stock}
                            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-600 rounded disabled:opacity-40 transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-black text-sm text-amber-700 dark:text-amber-400">
                          {prod.price * item.quantity} ETB
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-600 dark:text-stone-400">
                  <span>{t('cart.subtotal')}</span>
                  <span className="font-semibold">{cartSubtotal} ETB</span>
                </div>
                <div className="flex justify-between text-stone-600 dark:text-stone-400">
                  <span>{t('cart.deliveryFee')}</span>
                  <span className="font-semibold">
                    {isFreeDelivery ? 'FREE' : '100 ETB'}
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-between text-base font-black text-stone-900 dark:text-stone-100">
                  <span>{t('cart.total')}</span>
                  <span className="text-amber-700 dark:text-amber-400">
                    {cartSubtotal + (isFreeDelivery ? 0 : 100)} ETB
                  </span>
                </div>
              </div>

              <button
                onClick={handleProceedToCheckout}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-black text-sm shadow-lg shadow-amber-600/20 active:scale-98 transition"
              >
                <span>{t('cart.checkout')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
