/*
  file summary: standardized filter trigger button component.
  responsibilities: renders a compact filter button with active count badge and consistent styling.
  role in system: unified button used across all tables and marketplace views to open filter modals.
*/

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';

export interface FilterButtonProps {
  onClick: () => void;
  activeCount?: number;
  label?: string;
  className?: string;
  title?: string;
}

export const FilterButton: React.FC<FilterButtonProps> = ({
  onClick,
  activeCount = 0,
  label = 'Filters',
  className = '',
  title = 'Filters',
}) => {
  const hasActive = activeCount > 0;
  return (
    <button
      type="button"
      className={`btn btn-sm ${
        hasActive
          ? 'btn-primary text-white border-primary'
          : 'btn-outline-secondary text-dark border-secondary bg-white'
      } d-flex align-items-center gap-1.5 px-3 py-1.5 ${className}`}
      onClick={onClick}
      title={title}
      aria-label={`${label} (${activeCount} active)`}
    >
      <SlidersHorizontal size={14} className={hasActive ? 'text-white' : 'text-secondary'} />
      <span className="fw-medium">{label}</span>
      {hasActive && (
        <span
          className="badge rounded-pill bg-white text-dark font-mono-code ms-1"
          style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
};
