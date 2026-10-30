import React, { useState, useRef, useEffect } from 'react';
import { Search, Download, ChevronDown, FileSpreadsheet, FileText, X } from 'lucide-react';
import { FilterButton } from './FilterButton';

export interface ListToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onFilterClick?: () => void;
  activeFilterCount?: number;
  filterLabel?: string;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  exportDisabled?: boolean;
  primaryAction?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const ListToolbar: React.FC<ListToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onFilterClick,
  activeFilterCount = 0,
  filterLabel = 'Filters',
  onExportCsv,
  onExportPdf,
  exportDisabled = false,
  primaryAction,
  children,
  className = '',
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    if (isExportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportOpen]);

  const hasExport = Boolean(onExportCsv || onExportPdf);

  return (
    <div
      className={`map-list-toolbar d-flex flex-wrap align-items-center justify-content-between gap-3 p-3 bg-white border-bottom ${className}`}
    >
      <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
        {/* Search input with leading icon */}
        <div
          className="position-relative flex-grow-1"
          style={{ maxWidth: '360px', minWidth: '220px' }}
        >
          <Search
            size={16}
            aria-hidden="true"
            className="position-absolute top-50 translate-middle-y text-muted"
            style={{ left: '12px', pointerEvents: 'none' }}
          />
          <input
            type="text"
            className="form-control form-control-sm map-list-toolbar-search-input"
            style={{
              paddingLeft: '36px',
              paddingRight: searchValue ? '32px' : '12px',
              height: '36px',
              fontSize: '0.875rem',
            }}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={searchPlaceholder}
          />
          {searchValue && (
            <button
              type="button"
              className="btn btn-link btn-sm position-absolute top-50 translate-middle-y text-muted p-0"
              style={{ right: '10px', textDecoration: 'none' }}
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Filter button */}
        {onFilterClick && (
          <FilterButton
            onClick={onFilterClick}
            activeCount={activeFilterCount}
            label={filterLabel}
          />
        )}

        {/* Export dropdown */}
        {hasExport && (
          <div className="position-relative" ref={exportRef}>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-1.5 bg-white text-dark"
              style={{ height: '36px' }}
              disabled={exportDisabled}
              onClick={() => setIsExportOpen(!isExportOpen)}
              aria-expanded={isExportOpen}
              aria-haspopup="true"
              aria-label="Export options"
            >
              <Download size={15} className="text-secondary" />
              <span className="fw-medium">Export</span>
              <ChevronDown size={14} className="text-muted ms-0.5" />
            </button>

            {isExportOpen && (
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
                      setIsExportOpen(false);
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
                      setIsExportOpen(false);
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
        )}

        {/* Optional additional controls */}
        {children}
      </div>

      {/* Primary Action Slot */}
      {primaryAction && (
        <div className="d-flex align-items-center gap-2">
          {primaryAction}
        </div>
      )}
    </div>
  );
};

