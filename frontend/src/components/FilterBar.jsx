/**
 * FilterBar — category + period dropdowns with clear button
 * Props: categories [], selectedCategory, onCategoryChange,
 *        selectedPeriod, onPeriodChange
 */
import React from 'react';

const PERIOD_OPTIONS = [
  { label: 'This Week',    days: 7  },
  { label: 'This Month',   days: 30 },
  { label: 'Last Quarter', days: 90 },
  { label: 'This Year',    days: 365 }
];

const FilterBar = ({ categories = [], selectedCategory, onCategoryChange, selectedPeriod, onPeriodChange }) => {
  const hasActiveFilter = !!selectedCategory;

  return (
    <div className="filter-bar">
      {/* Category */}
      <div className="filter-group">
        <label className="filter-label">Category</label>
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Period */}
      <div className="filter-group">
        <label className="filter-label">Period</label>
        <select
          className="filter-select"
          value={selectedPeriod}
          onChange={(e) => onPeriodChange(Number(e.target.value))}
        >
          {PERIOD_OPTIONS.map(opt => (
            <option key={opt.days} value={opt.days}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Active filter indicator + clear */}
      {hasActiveFilter && (
        <>
          <span className="filter-active-tag">
            Showing: {categories.find(c => String(c.id) === String(selectedCategory))?.name || 'filtered'}
          </span>
          <button className="filter-clear-btn" onClick={() => onCategoryChange('')}>
            ✕ Clear
          </button>
        </>
      )}
    </div>
  );
};

export default FilterBar;