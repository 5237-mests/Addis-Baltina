import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Theme, CartItem, Product, Order } from '../types';
import { translations } from '../i18n/translations';

interface AppContextType {
  // i18n
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;

  // Theme
  theme: Theme;
  setTheme: (th: Theme) => void;

  // Telegram Mini App
  isTelegramMode: boolean;
  setIsTelegramMode: (val: boolean) => void;
  isRealTelegram: boolean;
  telegramUser: { id: number; first_name: string; username?: string } | null;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartCount: number;

  // Tracked orders
  trackedOrderIds: string[];
  addTrackedOrderId: (id: string) => void;

  // Modals / active views
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  selectedProductForModal: Product | null;
  setSelectedProductForModal: (prod: Product | null) => void;
  activeOrderForTracking: Order | null;
  setActiveOrderForTracking: (order: Order | null) => void;
  isAdminOpen: boolean;
  setIsAdminOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Language
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('ab_lang') as Language) || 'en';
  });

  // Theme
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('ab_theme') as Theme) || 'system';
  });

  // Telegram detection
  const [isRealTelegram, setIsRealTelegram] = useState(false);
  const [isTelegramMode, setIsTelegramMode] = useState(false);
  const [telegramUser, setTelegramUser] = useState<{ id: number; first_name: string; username?: string } | null>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('ab_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Tracked Orders
  const [trackedOrderIds, setTrackedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ab_orders');
      return saved ? JSON.parse(saved) : ['AB-2026-1049'];
    } catch {
      return ['AB-2026-1049'];
    }
  });

  // UI state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [activeOrderForTracking, setActiveOrderForTracking] = useState<Order | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Apply Theme
  useEffect(() => {
    localStorage.setItem('ab_theme', theme);
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Save Language
  useEffect(() => {
    localStorage.setItem('ab_lang', language);
  }, [language]);

  // Save Cart
  useEffect(() => {
    localStorage.setItem('ab_cart', JSON.stringify(cart));
  }, [cart]);

  // Save Tracked Orders
  useEffect(() => {
    localStorage.setItem('ab_orders', JSON.stringify(trackedOrderIds));
  }, [trackedOrderIds]);

  // Check Telegram WebApp environment
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initDataUnsafe && Object.keys(tg.initDataUnsafe).length > 0) {
      setIsRealTelegram(true);
      setIsTelegramMode(true);
      if (tg.initDataUnsafe.user) {
        setTelegramUser({
          id: tg.initDataUnsafe.user.id,
          first_name: tg.initDataUnsafe.user.first_name,
          username: tg.initDataUnsafe.user.username,
        });
      }
      tg.ready();
      tg.expand();
    }
  }, []);

  const t = (key: string, params?: Record<string, string | number>): string => {
    const langDict = translations[language] || translations.en;
    let text = langDict[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx > -1) {
        const updated = [...prev];
        const newQty = Math.min(updated[idx].quantity + quantity, product.stock);
        updated[idx] = { ...updated[idx], quantity: newQty };
        return updated;
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock), selected_unit: product.unit }];
    });
    // Haptic feedback if in Telegram
    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch {}
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const max = item.product.stock;
          return { ...item, quantity: Math.min(quantity, max) };
        }
        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  const addTrackedOrderId = (id: string) => {
    setTrackedOrderIds((prev) => (prev.includes(id) ? prev : [id, ...prev]));
  };

  const cartSubtotal = cart.reduce((acc, curr) => acc + curr.product.price * curr.quantity, 0);
  const cartCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        t,
        theme,
        setTheme,
        isTelegramMode,
        setIsTelegramMode,
        isRealTelegram,
        telegramUser,
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartSubtotal,
        cartCount,
        trackedOrderIds,
        addTrackedOrderId,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        selectedProductForModal,
        setSelectedProductForModal,
        activeOrderForTracking,
        setActiveOrderForTracking,
        isAdminOpen,
        setIsAdminOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
