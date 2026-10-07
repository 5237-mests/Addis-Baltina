import React from 'react';
import { Flame, Wheat, Soup, Cookie, Coffee, LayoutGrid } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Category } from '../types';

interface CategoryNavProps {
  categories: Category[];
  selectedCategorySlug: string;
  onSelectCategory: (slug: string) => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  selectedCategorySlug,
  onSelectCategory,
}) => {
  const { language, t } = useApp();

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame':
        return <Flame className="w-4 h-4 text-rose-500" />;
      case 'Wheat':
        return <Wheat className="w-4 h-4 text-amber-500" />;
      case 'Soup':
        return <Soup className="w-4 h-4 text-orange-500" />;
      case 'Cookie':
        return <Cookie className="w-4 h-4 text-yellow-600" />;
      case 'Coffee':
        return <Coffee className="w-4 h-4 text-amber-700" />;
      default:
        return <LayoutGrid className="w-4 h-4 text-stone-400" />;
    }
  };

  const getCategoryName = (cat: Category) => {
    if (language === 'am') return cat.name_am;
    if (language === 'om') return cat.name_om;
    return cat.name_en;
  };

  return (
    <div className="border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 sticky top-16 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar scroll-smooth">
          {/* All category button */}
          <button
            onClick={() => onSelectCategory('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition shrink-0 ${
              selectedCategorySlug === 'all'
                ? 'bg-amber-600 text-stone-950 shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>{t('categories.all')}</span>
          </button>

          {/* Dynamic categories */}
          {categories.map((cat) => {
            const isSelected = selectedCategorySlug === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.slug)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition shrink-0 ${
                  isSelected
                    ? 'bg-amber-600 text-stone-950 shadow-sm'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {getIcon(cat.icon)}
                <span>{getCategoryName(cat)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
