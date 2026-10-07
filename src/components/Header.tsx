import React from 'react';
import { ShoppingBag, Globe, Sun, Moon, Laptop, ShieldCheck, Send, Compass } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Language, Theme } from '../types';

export const Header: React.FC = () => {
  const {
    language,
    setLanguage,
    t,
    theme,
    setTheme,
    isTelegramMode,
    setIsTelegramMode,
    cartCount,
    setIsCartOpen,
    setIsAdminOpen,
    setActiveOrderForTracking,
  } = useApp();

  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 text-stone-100 backdrop-blur-md border-b border-stone-800 shadow-sm">
      {/* Ethiopian Tricolor / Cultural Accent Bar */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-amber-500 to-rose-600" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              setIsAdminOpen(false);
              setActiveOrderForTracking(null);
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-700 flex items-center justify-center shadow-md border border-amber-400/30">
              <span className="text-xl font-black text-stone-950">አ</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-amber-100">
                  {t('brand.name')}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30 hidden sm:inline-block">
                  በአዲስ አበባ
                </span>
              </div>
              <p className="text-[11px] text-stone-400 hidden sm:block leading-none">
                {t('brand.tagline')}
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Track Orders Link */}
            <button
              onClick={() => setActiveOrderForTracking({} as any)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-stone-300 hover:text-amber-200 hover:bg-stone-800/80 transition"
              title={t('nav.orders')}
            >
              <Compass className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">{t('nav.orders')}</span>
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-stone-800/90 rounded-lg p-0.5 border border-stone-700">
              {(['en', 'am', 'om'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 text-xs font-semibold rounded transition ${
                    language === lang
                      ? 'bg-amber-600 text-stone-950 shadow-xs'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {lang === 'en' ? 'EN' : lang === 'am' ? 'አማ' : 'OM'}
                </button>
              ))}
            </div>

            {/* Theme Toggle */}
            <div className="hidden sm:flex items-center bg-stone-800/90 rounded-lg p-0.5 border border-stone-700">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded text-xs transition ${
                  theme === 'light' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Light"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded text-xs transition ${
                  theme === 'dark' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Dark"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded text-xs transition ${
                  theme === 'system' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
                }`}
                title="System"
              >
                <Laptop className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Telegram Mini App Simulator Toggle */}
            <button
              onClick={() => setIsTelegramMode(!isTelegramMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                isTelegramMode
                  ? 'bg-sky-600/30 text-sky-300 border-sky-500/50 ring-1 ring-sky-500/30'
                  : 'bg-stone-800/70 text-stone-300 border-stone-700 hover:bg-stone-800'
              }`}
              title="Telegram Mini App view"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Mini App</span>
            </button>

            {/* Admin Portal Toggle */}
            <button
              onClick={() => setIsAdminOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-stone-800 text-stone-300 hover:text-white border border-stone-700 hover:border-amber-500/40 transition"
              title="Admin Portal"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">{t('nav.admin')}</span>
            </button>

            {/* Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center justify-center p-2 rounded-xl bg-amber-600 text-stone-950 hover:bg-amber-500 font-bold transition shadow-md shadow-amber-600/20"
              aria-label="View Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-stone-900 shadow-sm animate-pulse">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
