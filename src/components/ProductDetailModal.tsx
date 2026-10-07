import React, { useState } from 'react';
import { X, Plus, Minus, ShoppingBag, MapPin, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ProductDetailModal: React.FC = () => {
  const {
    selectedProductForModal,
    setSelectedProductForModal,
    language,
    t,
    addToCart,
    setIsCartOpen,
  } = useApp();

  const [quantity, setQuantity] = useState(1);

  if (!selectedProductForModal) return null;
  const product = selectedProductForModal;

  const getProductName = () => {
    if (language === 'am') return product.name_am;
    if (language === 'om') return product.name_om;
    return product.name_en;
  };

  const getProductDescription = () => {
    if (language === 'am') return product.description_am;
    if (language === 'om') return product.description_om;
    return product.description_en;
  };

  const isLowStock = product.stock > 0 && product.stock <= product.min_stock_alert;
  const isOutOfStock = product.stock <= 0;

  const handleAddAndCheckout = () => {
    addToCart(product, quantity);
    setSelectedProductForModal(null);
    setIsCartOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden my-8">
        {/* Close Button */}
        <button
          onClick={() => setSelectedProductForModal(null)}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-stone-900/60 hover:bg-stone-900 text-white transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Image Column */}
          <div className="relative aspect-square md:aspect-auto h-full min-h-[260px] bg-stone-100 dark:bg-stone-800">
            <img
              src={product.image_url}
              alt={product.name_en}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-950/80 backdrop-blur-md text-xs font-semibold text-amber-300">
              <MapPin className="w-3.5 h-3.5" />
              <span>{product.origin}</span>
            </div>
          </div>

          {/* Details Column */}
          <div className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-semibold">
                  {product.sku}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold">
                  {product.unit}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 mb-2">
                {getProductName()}
              </h2>

              <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mb-4">
                {product.price}{' '}
                <span className="text-sm font-semibold text-stone-600 dark:text-stone-400">
                  ETB
                </span>
              </div>

              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-4">
                {getProductDescription()}
              </p>

              {/* Ingredients */}
              {product.ingredients_en && (
                <div className="mb-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/60">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                    {t('product.ingredients')}
                  </div>
                  <p className="text-xs text-stone-700 dark:text-stone-300">
                    {product.ingredients_en}
                  </p>
                </div>
              )}

              {/* Culinary Usage */}
              {product.usage_en && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>{t('product.usage')}</span>
                  </div>
                  <p className="text-xs text-stone-700 dark:text-stone-300">
                    {product.usage_en}
                  </p>
                </div>
              )}

              {/* Stock Status Indicator */}
              <div className="flex items-center gap-2 mb-6">
                {isOutOfStock ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{t('catalog.outOfStock')}</span>
                  </span>
                ) : isLowStock ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      {t('catalog.lowStock')} — {product.stock} {t('catalog.unitsLeft')}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('catalog.inStock')} ({product.stock} units)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quantity Stepper & Add to Cart */}
            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-600 dark:text-stone-400">
                  {t('product.quantity')}
                </span>
                <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-xl p-1 border border-stone-200 dark:border-stone-700">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-stone-700 disabled:opacity-40 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-bold text-sm">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-stone-700 disabled:opacity-40 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddAndCheckout}
                disabled={isOutOfStock}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm shadow-md transition ${
                  isOutOfStock
                    ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-500 text-stone-950 active:scale-98 shadow-amber-600/20'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {t('catalog.addToCart')} — {product.price * quantity} ETB
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
