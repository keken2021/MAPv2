/*
  file summary: active filter pills / chips display bar.
  responsibilities: renders active filter tags with dismiss buttons and a clear all trigger.
  role in system: provides visibility of active filters on tables and marketplace views.
*/

import React from 'react';
import { X, RotateCcw } from 'lucide-react';

export interface FilterChip {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  chips: FilterChip[];
  onClearAll: () => void;
  className?: string;
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  chips,
  onClearAll,
  className = '',
}) => {
  if (chips.length === 0) return null;

  return (
    <div className={`d-flex flex-wrap align-items-center gap-1.5 py-1 ${className}`}>
      <span className="text-muted small fw-medium me-1" style={{ fontSize: '0.78rem' }}>
        Filters:
      </span>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2 py-1 font-sans"
          style={{ fontSize: '0.76rem', fontWeight: 500, borderColor: '#CBD5E1' }}
        >
          <span className="text-secondary">{chip.label}:</span>
          <strong className="text-dark">{chip.value}</strong>
          <button
            type="button"
            className="btn btn-link p-0 text-muted ms-1 d-inline-flex align-items-center border-0"
            onClick={chip.onRemove}
            title={`Remove ${chip.label} filter`}
            aria-label={`Remove ${chip.label} filter`}
            style={{ textDecoration: 'none', lineHeight: 1 }}
          >
            <X size={12} className="hover-danger" />
          </button>
        </span>
      ))}

      {chips.length > 1 && (
        <button
          type="button"
          className="btn btn-link btn-sm text-primary p-0 ms-1 d-inline-flex align-items-center gap-1 font-sans small"
          onClick={onClearAll}
          style={{ fontSize: '0.76rem', textDecoration: 'none' }}
        >
          <RotateCcw size={11} />
          <span>Clear All</span>
        </button>
      )}
    </div>
  );
};
