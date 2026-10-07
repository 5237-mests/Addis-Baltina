import React from 'react';
import { Sparkles, ShieldCheck, Truck, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Hero: React.FC = () => {
  const { t, setActiveOrderForTracking } = useApp();

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-stone-100 py-10 md:py-14 border-b border-stone-800">
      {/* Decorative Warm Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-amber-600/10 blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('hero.badge')}</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
            {t('hero.title')}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base md:text-lg text-stone-300 mb-8 leading-relaxed font-light">
            {t('hero.subtitle')}
          </p>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-800/60 border border-stone-700/60">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-stone-200">
                {t('hero.feature1')}
              </span>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-800/60 border border-stone-700/60">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Truck className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-stone-200">
                {t('hero.feature2')}
              </span>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-800/60 border border-stone-700/60">
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-stone-200">
                {t('hero.feature3')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
