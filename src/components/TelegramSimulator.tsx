import React from 'react';
import { Send, X, ArrowLeft, MoreVertical, Smartphone } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TelegramSimulator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isTelegramMode, setIsTelegramMode, t, telegramUser } = useApp();

  if (!isTelegramMode) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-stone-900/90 py-6 px-2 sm:px-4 flex flex-col items-center justify-center">
      {/* Top Banner Notice */}
      <div className="max-w-md w-full mb-3 flex items-center justify-between px-4 py-2 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-200 text-xs shadow-md">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-sky-400" />
          <span>{t('telegram.banner')}</span>
        </div>
        <button
          onClick={() => setIsTelegramMode(false)}
          className="text-sky-300 hover:text-white font-bold flex items-center gap-1 text-[11px] underline"
        >
          <span>{t('telegram.exit')}</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Simulated Telegram Device Container */}
      <div className="tg-container w-full bg-stone-950 border-4 border-stone-800 text-stone-100 flex flex-col">
        {/* Mock Telegram Top Bar */}
        <div className="bg-stone-900 border-b border-stone-800 px-4 py-2.5 flex items-center justify-between text-xs sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <button className="text-stone-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-600 text-stone-950 flex items-center justify-center font-bold text-xs">
                አ
              </div>
              <div>
                <div className="font-bold text-xs text-white leading-tight">Addis Baltina Bot</div>
                <div className="text-[10px] text-stone-400">bot</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-stone-400">
            <MoreVertical className="w-4 h-4" />
            <button onClick={() => setIsTelegramMode(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Telegram App Body */}
        <div className="flex-1 overflow-y-auto bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
          {children}
        </div>
      </div>
    </div>
  );
};
