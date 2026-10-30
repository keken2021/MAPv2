import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Download, ChevronDown, FileSpreadsheet, FileText, X } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export interface DetailMetaItem {
  label?: string;
  value: string;
}

export interface DetailHeaderProps {
  title: string;
  status?: string;
  metaItems?: (string | DetailMetaItem)[];
  backLink?: {
    label: string;
    onClick: () => void;
  };
  mainAction?: React.ReactNode;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  exportDisabled?: boolean;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({
  title,
  status,
  metaItems,
  backLink,
  mainAction,
  onExportCsv,
  onExportPdf,
  exportDisabled = false,
  onClose,
  closeLabel = 'Close',
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
  const formattedMeta = metaItems
    ?.map((item) => (typeof item === 'string' ? item : item.label ? `${item.label}: ${item.value}` : item.value))
    .filter(Boolean);

  return (
    <div className={`map-detail-header bg-white border-bottom p-4 ${className}`}>
      {/* Back link if present */}
      {backLink && (
        <div className="mb-2">
          <button
            type="button"
            className="btn btn-link p-0 text-muted text-decoration-none d-inline-flex align-items-center gap-1 font-mono-code"
            style={{ fontSize: '0.8rem' }}
            onClick={backLink.onClick}
            aria-label={`Back to ${backLink.label}`}
          >
            <ChevronLeft size={14} />
            <span>Back to {backLink.label}</span>
          </button>
        </div>
      )}

      {/* Main Title Row */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* Title and Status Badge */}
        <div className="d-flex flex-wrap align-items-center gap-2.5 min-w-0">
          <h1
            className="h3 mb-0 fw-bold text-dark text-truncate"
            style={{ letterSpacing: '-0.01em' }}
          >
            {title}
          </h1>
          {status && <StatusBadge value={status} />}
        </div>

        {/* Actions slot in strict order: 1. main action, 2. Export, 3. Close */}
        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* 1. Main Action */}
          {mainAction && <div className="detail-header-action-main">{mainAction}</div>}

          {/* 2. Export */}
          {hasExport && (
            <div className="position-relative detail-header-action-export" ref={exportRef}>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-1.5 bg-white text-dark"
                style={{ height: '36px' }}
                disabled={exportDisabled}
                onClick={() => setIsExportOpen(!isExportOpen)}
                aria-expanded={isExportOpen}
                aria-haspopup="true"
                aria-label="Export record"
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

          {/* 3. Close */}
          {onClose && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 px-3 py-1.5 bg-white text-dark detail-header-action-close"
              style={{ height: '36px' }}
              onClick={onClose}
              aria-label={closeLabel}
            >
              <X size={15} className="text-muted" />
              <span className="fw-medium">{closeLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Monospace Metadata Line */}
      {formattedMeta && formattedMeta.length > 0 && (
        <div
          className="map-detail-header-meta font-mono-code text-muted mt-2 d-flex flex-wrap align-items-center gap-2"
          style={{ fontSize: '0.8125rem' }}
        >
          {formattedMeta.map((meta, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="opacity-50">·</span>}
              <span>{meta}</span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

