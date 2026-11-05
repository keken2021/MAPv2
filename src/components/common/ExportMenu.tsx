/*
  file summary: shared CSV/PDF export dropdown used by list and detail chrome.
  responsibilities: open/close menu, outside click, optional disabled state, CSV and PDF actions.
  role in system: used by ListToolbar, DetailHeader, and AssuranceObjectsView.
*/

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';

export interface ExportMenuProps {
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  disabled?: boolean;
  /** Accessible name for the Export button */
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  onExportCsv,
  onExportPdf,
  disabled = false,
  ariaLabel = 'Export options',
  className = '',
  buttonClassName = 'btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-1.5 bg-white text-dark',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const hasExport = Boolean(onExportCsv || onExportPdf);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!hasExport) return null;

  return (
    <div className={`position-relative ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={buttonClassName}
        style={{ height: '36px' }}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={ariaLabel}
      >
        <Download size={15} className="text-secondary" />
        <span className="fw-medium">Export</span>
        <ChevronDown size={14} className="text-muted ms-0.5" />
      </button>

      {isOpen && (
        <div
          className="dropdown-menu show shadow-sm position-absolute mt-1 end-0"
          style={{ zIndex: 1050, minWidth: '150px' }}
          role="menu"
        >
          {onExportCsv && (
            <button
              type="button"
              className="dropdown-item d-flex align-items-center gap-2 py-2"
              onClick={() => {
                setIsOpen(false);
                onExportCsv();
              }}
              role="menuitem"
            >
              <FileSpreadsheet size={15} className="text-success" />
              <span>CSV</span>
            </button>
          )}
          {onExportPdf && (
            <button
              type="button"
              className="dropdown-item d-flex align-items-center gap-2 py-2"
              onClick={() => {
                setIsOpen(false);
                onExportPdf();
              }}
              role="menuitem"
            >
              <FileText size={15} className="text-danger" />
              <span>PDF</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
