import React from 'react';
import type { Category } from '../types/jira';

interface TabsProps {
  categories: Category[];
  counts: Record<Category, number>;
  labels: Record<Category, string>;
  activeCategory: Category;
  onSelect: (category: Category) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  categories,
  counts,
  labels,
  activeCategory,
  onSelect,
}) => {
  return (
    <div className="tabs" role="tablist">
      {categories.map((category) => {
        const isActive = category === activeCategory;

        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab ${isActive ? 'tab-active' : ''}`}
            onClick={() => onSelect(category)}
          >
            <span className="tab-label">{labels[category]}</span>
            <span className="tab-count">{counts[category]}</span>
          </button>
        );
      })}
    </div>
  );
};
