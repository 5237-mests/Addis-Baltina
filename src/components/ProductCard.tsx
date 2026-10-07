import React from 'react';
import { Plus, Eye, AlertCircle, CheckCircle2, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { language, t, addToCart, setSelectedProductForModal } = useApp();

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

  return (
    <div className="group relative flex flex-col bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300">
      {/* Product Image Container */}
      <div className="relative aspect-4/3 w-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
        <img
          src={product.image_url}
          alt={product.name_en}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            // Fallback placeholder
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80';
          }}
        />

        {/* Origin Badge */}
        <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-900/80 backdrop-blur-md text-[11px] font-medium text-stone-200">
          <MapPin className="w-3 h-3 text-amber-400" />
          <span className="truncate max-w-[120px]">{product.origin.split(',')[0]}</span>
        </div>

        {/* Stock Status Badge */}
        <div className="absolute top-2.5 right-2.5">
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[11px] font-bold">
              {t('catalog.outOfStock')}
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-stone-950 text-[11px] font-bold shadow-xs">
              <AlertCircle className="w-3 h-3 text-stone-950" />
              <span>
                {product.stock} {t('catalog.unitsLeft')}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-700/80 backdrop-blur-md text-emerald-100 text-[11px] font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
              <span>{t('catalog.inStock')}</span>
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">{product.sku}</span>
            <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 font-semibold text-stone-700 dark:text-stone-300">
              {product.unit}
            </span>
          </div>

          <h3
            onClick={() => setSelectedProductForModal(product)}
            className="font-bold text-base text-stone-900 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer line-clamp-1 mb-1.5"
          >
            {getProductName()}
          </h3>

          <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed mb-3">
            {getProductDescription()}
          </p>
        </div>

        {/* Price & Add Action */}
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
              ዋጋ / Price
            </div>
            <div className="text-lg font-black text-amber-700 dark:text-amber-400 leading-none">
              {product.price}{' '}
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">ETB</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedProductForModal(product)}
              className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              title={t('catalog.quickView')}
            >
              <Eye className="w-4 h-4" />
            </button>

            <button
              onClick={() => addToCart(product, 1)}
              disabled={isOutOfStock}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition shadow-xs ${
                isOutOfStock
                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                  : 'bg-amber-600 text-stone-950 hover:bg-amber-500 active:scale-95'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{t('catalog.addToCart')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
