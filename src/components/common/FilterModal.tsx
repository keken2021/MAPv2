/*
  file summary: universal filter modal component conforming to enterprise design system rule 9.
  responsibilities: provides unified modal shell for filtering across all tables and marketplace views.
  role in system: reusable dialog for filtering criteria across all table views.
*/

import React from 'react';
import { SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import { Modal } from '../modals/Modal';

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
  children,
}) => {
  const handleApply = () => {
    if (onApply) onApply();
    onClose();
  };

  const headerAside = activeCount > 0 ? (
    <span
      className="badge font-mono-code"
      style={{ backgroundColor: '#38BDF8', color: '#0B1B2B', fontSize: '0.72rem', fontWeight: 600 }}
    >
      {activeCount} Active
    </span>
  ) : undefined;

  const footerNode = (
    <div className="d-flex justify-content-between w-100">
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
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="d-flex align-items-center gap-2">
          <SlidersHorizontal size={16} style={{ color: '#38BDF8' }} />
          {title}
        </span>
      }
      meta={subtitle}
      headerAside={headerAside}
      size="md"
      footer={footerNode}
      bodyClassName="p-4 d-flex flex-column gap-3 overflow-y-auto"
    >
      {children}
    </Modal>
  );
};
