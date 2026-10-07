import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Package, RefreshCw, AlertCircle } from 'lucide-react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { CategoryNav } from './components/CategoryNav';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { AdminDashboard } from './components/AdminDashboard';
import { TelegramSimulator } from './components/TelegramSimulator';
import { Category, Product } from './types';

export const App: React.FC = () => {
  const { t } = useApp();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high'>('featured');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial catalog data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch('/api/v1/categories').then((r) => r.json()),
        fetch('/api/v1/products').then((r) => r.json()),
      ]);

      if (catRes.success) setCategories(catRes.data);
      if (prodRes.success) setProducts(prodRes.data);
    } catch (err: any) {
      setError('Could not connect to the Baltina server. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to real-time inventory updates via SSE
    const es = new EventSource('/api/v1/events');
    es.addEventListener('inventory:updated', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        setProducts((prev) =>
          prev.map((p) => (p.id === payload.productId ? { ...p, stock: payload.stock } : p))
        );
      } catch {}
    });

    es.addEventListener('order:created', () => {
      // Refresh products to get updated stock
      fetch('/api/v1/products')
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setProducts(d.data);
        });
    });

    return () => es.close();
  }, []);

  // Filter and sort products
  const filteredProducts = products
    .filter((prod) => {
      if (selectedCategorySlug !== 'all') {
        const cat = categories.find((c) => c.slug === selectedCategorySlug);
        if (cat && prod.category_id !== cat.id) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          prod.name_en.toLowerCase().includes(q) ||
          prod.name_am.includes(q) ||
          prod.name_om.toLowerCase().includes(q) ||
          prod.description_en.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'featured') {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
      }
      return 0;
    });

  return (
    <TelegramSimulator>
      <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
        <Header />
        <Hero />
        <CategoryNav
          categories={categories}
          selectedCategorySlug={selectedCategorySlug}
          onSelectCategory={setSelectedCategorySlug}
        />

        {/* Catalog Main Section */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {/* Controls Bar: Search & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-8">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('catalog.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden shadow-xs"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <SlidersHorizontal className="w-4 h-4 text-stone-400" />
              <label htmlFor="catalog-sort-select" className="text-xs font-semibold text-stone-500">{t('catalog.sort')}:</label>
              <select
                id="catalog-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-semibold text-stone-800 dark:text-stone-200 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                <option value="featured">{t('catalog.sortFeatured')}</option>
                <option value="price-low">{t('catalog.sortPriceLow')}</option>
                <option value="price-high">{t('catalog.sortPriceHigh')}</option>
              </select>
            </div>
          </div>

          {/* Product Grid Area */}
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-stone-500">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <p className="text-xs font-semibold">Loading authentic Ethiopian Baltina...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-xs text-red-700 dark:text-red-300 font-semibold">{error}</p>
              <button
                onClick={fetchData}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition"
              >
                Retry
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 text-stone-500">
              <Package className="w-12 h-12 text-stone-300 dark:text-stone-700 mb-3" />
              <h3 className="text-base font-bold text-stone-800 dark:text-stone-200 mb-1">
                {t('catalog.noProducts')}
              </h3>
              <button
                onClick={() => {
                  setSelectedCategorySlug('all');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-stone-900 border-t border-stone-800 text-stone-400 py-10 mt-12 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-600 text-stone-950 flex items-center justify-center font-black">
                  አ
                </div>
                <span className="font-bold text-stone-200 text-sm">Addis Baltina</span>
                <span className="text-stone-500">· Addis Ababa, Ethiopia</span>
              </div>
              <div className="flex gap-4 text-stone-400 text-xs">
                <span>Telegram Mini App</span>
                <span>·</span>
                <span>PWA Ready</span>
                <span>·</span>
                <span>Multi-language (EN / አማ / OM)</span>
              </div>
            </div>
          </div>
        </footer>

        {/* Modals */}
        <ProductDetailModal />
        <CartDrawer />
        <CheckoutModal />
        <OrderTrackingModal />
        <AdminDashboard />
      </div>
    </TelegramSimulator>
  );
};
