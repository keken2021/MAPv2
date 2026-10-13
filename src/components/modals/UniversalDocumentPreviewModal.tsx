/* 
  file summary: universal modal component for inspecting and previewing statutory, crew, vessel, and equipment documents in strict A4 format.
  responsibilities: provides uniform modal header with document title, maritime metadata, print export, escape key handler, and full A4 certificate preview matching the Document Library Show Document modal layout.
  role in system: unified document preview modal used across DocumentDetailView, VersionHistoryDrawer, DocumentTable, EquipmentDetailView, MarketplaceDetailModal, and VesselDetailView.
*/

import React, { useEffect } from 'react';
import { MasterDocument } from '../../types/document';
import { formatMaritimeDate } from '../../utils/formatters';
import { DocumentCertificatePreview } from '../common/DocumentCertificatePreview';
import { FileText, X } from 'lucide-react';

export interface UniversalDocumentPreviewModalProps {
  isOpen: boolean;
  document: MasterDocument | null;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  versionLabel?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  extraAction?: React.ReactNode;
}

/**
 * what: renders the universal document preview modal using the exact layout, spacing, and styling of the Document Library Show Document modal.
 * how: standardizes dark navy header (#0B1B2B), metadata subtitle, print action, footer revision info, and embeds DocumentCertificatePreview with strict A4 portrait aspect ratio.
 * with what file: src/components/modals/UniversalDocumentPreviewModal.tsx.
 */
export const UniversalDocumentPreviewModal: React.FC<UniversalDocumentPreviewModalProps> = ({
  isOpen,
  document,
  onClose,
  title,
  subtitle,
  versionLabel,
  uploadedAt,
  uploadedBy,
  extraAction,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !document) return null;

  const modalTitle = title || 'Certificate Layout & PDF Review';
  const modalSubtitle =
    subtitle ||
    `${document.title} · ${
      versionLabel
        ? `Version ${versionLabel}`
        : `Active Version ${document.currentVersion || 'v1.0'}`
    } (${document.certificateNo})`;

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 1070 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content bg-white text-dark border shadow-lg overflow-hidden">
          {/* Universal Modal Header: Dark Navy Theme */}
          <div
            className="modal-header d-flex align-items-center justify-content-between px-4 py-3"
            style={{ backgroundColor: '#0B1B2B', color: '#FFFFFF' }}
          >
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 bg-primary-subtle text-primary rounded-3 flex-shrink-0">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h5
                  className="modal-title fw-bold text-white m-0 text-truncate"
                  style={{ fontSize: '1.05rem' }}
                >
                  {modalTitle}
                </h5>
                <div
                  className="small font-mono-code text-truncate"
                  style={{ color: '#94A3B8' }}
                >
                  {modalSubtitle}
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              <button
                type="button"
                className="btn btn-sm text-white p-2 border-0 bg-transparent opacity-75 hover-opacity-100"
                onClick={onClose}
                aria-label="Close"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Universal Modal Body: Exact Layout & Spacing of Document Library Modal */}
          <div className="modal-body p-4 bg-slate-50 d-flex justify-content-center">
            <DocumentCertificatePreview
              document={document}
              compact={false}
              showToolbar={true}
              showOuterCard={true}
            />
          </div>

          {/* Universal Modal Footer */}
          <div className="modal-footer border-top bg-light d-flex align-items-center justify-content-between p-3">
            <div className="text-secondary small font-mono-code text-truncate me-2">
              {versionLabel ? (
                <span>
                  Previewing file revision: <strong>{versionLabel}</strong>
                  {uploadedAt && (
                    <> · Uploaded {formatMaritimeDate(uploadedAt)}</>
                  )}
                  {uploadedBy && <> by {uploadedBy}</>}
                </span>
              ) : (
                <span>
                  Active current document revision:{' '}
                  <strong>{document.currentVersion || 'v1.0'}</strong> ·{' '}
                  {document.entityType} · {document.issuingAuthority}
                </span>
              )}
            </div>

            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              {extraAction}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
