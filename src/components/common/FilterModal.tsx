/*
  file summary: universal filter modal component conforming to enterprise design system rule 9.
  responsibilities: provides unified modal shell for filtering across all tables and marketplace views.
  role in system: reusable dialog for filtering criteria across all table views.
*/

import React from 'react';
import { SlidersHorizontal, RotateCcw, Check } from 'lucide-react';

export interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  onApply?: () => void;
  title: string;
  subtitle?: string;
  activeCount?: number;
  maxWidth?: string;
  children: React.ReactNode;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  onReset,
  onApply,
  title,
  subtitle,
  activeCount = 0,
  maxWidth = '560px',
  children,
}) => {
  if (!isOpen) return null;

  const handleApply = () => {
    if (onApply) onApply();
    onClose();
  };

  return (
    <div
      className="modal fade show d-block map-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: 'rgba(11, 27, 43, 0.65)', zIndex: 1060 }}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        style={{ maxWidth, width: '95%', margin: '1.75rem auto' }}
      >
        <div
          className="modal-content shadow-lg border-0 overflow-hidden"
          style={{ borderRadius: '10px' }}
        >
          {/* Unified Header */}
          <div
            className="modal-header p-3.5 d-flex align-items-center justify-content-between"
            style={{ backgroundColor: '#0B1B2B', color: '#FFFFFF', borderBottom: '1px solid #1E3A5F' }}
          >
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="d-flex align-items-center justify-content-center rounded"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38BDF8',
                }}
              >
                <SlidersHorizontal size={16} />
              </div>
              <div>
                <div className="fw-bold fs-6 d-flex align-items-center gap-2" style={{ color: '#FFFFFF' }}>
                  <span>{title}</span>
                  {activeCount > 0 && (
                    <span
                      className="badge font-mono-code"
                      style={{
                        backgroundColor: '#38BDF8',
                        color: '#0B1B2B',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                      }}
                    >
                      {activeCount} Active
                    </span>
                  )}
                </div>
                {subtitle && (
                  <div className="small" style={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          {/* Unified Body */}
          <div
            className="modal-body p-4 d-flex flex-column gap-3"
            style={{ backgroundColor: '#F8FAFC', maxHeight: 'calc(85vh - 130px)', overflowY: 'auto' }}
          >
            {children}
          </div>

          {/* Unified Footer */}
          <div
            className="modal-footer p-3 bg-white d-flex align-items-center justify-content-between"
            style={{ borderTop: '1px solid #E2E8F0' }}
          >
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-1.5"
              onClick={onReset}
              title="Clear all filters"
            >
              <RotateCcw size={14} />
              <span>Clear All</span>
            </button>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-light border px-3 py-1.5"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary d-flex align-items-center gap-1.5 px-3.5 py-1.5 fw-semibold"
                onClick={handleApply}
              >
                <Check size={14} />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
