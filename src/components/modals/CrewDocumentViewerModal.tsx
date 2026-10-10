/* 
  file summary: modal component for viewing and inspecting stcw crew member certificate details and file scan preview.
  responsibilities: displays document metadata, stcw regulation, issuing authority, expiry dates, verification status, and file preview card.
  role in system: launched by CrewDetailView.tsx when admin, submitter, or reviewer clicks view document.
*/

import React from 'react';
import { STCWDocumentItem } from '../../types/crew';
import { formatMaritimeDate } from '../../utils/formatters';

interface CrewDocumentViewerModalProps {
  isOpen: boolean;
  crewName: string;
  document: STCWDocumentItem | null;
  canManage: boolean;
  onClose: () => void;
  onOpenReupload: (doc: STCWDocumentItem) => void;
}

/**
  what: renders modal for inspecting stcw certificate details and attachment scan preview.
  how: displays detailed metadata grid, simulated pdf certificate preview, and offers direct reupload button for admin/submitter.
  with what file: src/components/modals/CrewDocumentViewerModal.tsx loaded by CrewDetailView.tsx.
*/
export const CrewDocumentViewerModal: React.FC<CrewDocumentViewerModalProps> = ({
  isOpen,
  crewName,
  document,
  canManage,
  onClose,
  onOpenReupload,
}) => {
  if (!isOpen || !document) return null;

  return (
    <div className="map-modal-backdrop d-flex align-items-center justify-content-center p-3">
      <div className="card map-card-custom shadow-lg" style={{ width: '100%', maxWidth: '720px', zIndex: 1100 }}>
        {/* Modal Header */}
        <div className="card-header d-flex align-items-center justify-content-between p-3 border-bottom bg-light">
          <div>
            <h5 className="fw-bold text-dark mb-0">{document.title}</h5>
            <div className="text-secondary small font-mono-code">
              Crew: <strong>{crewName}</strong> | Ref: <strong>{document.stcwRegulation}</strong>
            </div>
          </div>
          <button
            type="button"
            className="btn-close ms-2"
            onClick={onClose}
            aria-label="Close"
          />
        </div>

        {/* Modal Body */}
        <div className="card-body p-4 d-flex flex-column gap-3" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Metadata Grid */}
          <div className="p-3 bg-light border rounded-3">
            <div className="row g-3 small">
              <div className="col-md-6">
                <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Certificate No.</span>
                <strong className="text-dark font-mono-code fs-6">{document.certificateNo}</strong>
              </div>
              <div className="col-md-6">
                <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Issuing Authority</span>
                <strong className="text-dark">{document.issuingAuthority}</strong>
              </div>
              <div className="col-md-4">
                <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Flag State</span>
                <strong className="text-dark">{document.flagState || 'Universal'}</strong>
              </div>
              <div className="col-md-4">
                <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Issue Date</span>
                <strong className="text-dark font-mono-code">{formatMaritimeDate(document.issueDate)}</strong>
              </div>
              <div className="col-md-4">
                <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Expiry Date</span>
                <strong className={`font-mono-code ${document.verificationStatus === 'Expired' ? 'text-danger fw-bold' : document.verificationStatus === 'Expiring' ? 'text-warning fw-bold' : 'text-dark'}`}>
                  {formatMaritimeDate(document.expiryDate)}
                </strong>
              </div>
            </div>
          </div>

          {/* Outdated Notice Alert */}
          {(document.verificationStatus === 'Expired' || document.verificationStatus === 'Expiring') && (
            <div className={`alert ${document.verificationStatus === 'Expired' ? 'alert-danger' : 'alert-warning'} py-2 px-3 mb-0 small d-flex align-items-center justify-between`}>
              <div>
                <strong>{document.verificationStatus === 'Expired' ? 'Certificate Expired:' : 'Renewal Required Soon:'}</strong> This document is {document.verificationStatus.toLowerCase()} and requires an updated scan and renewal verification.
              </div>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary ms-3 flex-shrink-0"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => {
                    onClose();
                    onOpenReupload(document);
                  }}
                >
                  Upload New Version
                </button>
              )}
            </div>
          )}

          {/* Scanned Document Attachment Viewer Card */}
          <div className="border rounded-3 p-3 bg-white">
            <div className="d-flex align-items-center justify-between mb-3 border-bottom pb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-secondary font-mono-code">PDF ATTACHMENT</span>
                <span className="fw-semibold text-dark small font-mono-code">{document.fileName || `${document.title.toLowerCase().replace(/\s+/g, '_')}.pdf`}</span>
                <span className="text-muted small">({((document.fileSizeBytes || 1500000) / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
              <span className="badge bg-success-subtle text-success border border-success-subtle small">
                Verified
              </span>
            </div>

            {/* Document Rendered Preview Mockup */}
            <div
              className="p-4 rounded-3 border bg-light text-center d-flex flex-column align-items-center justify-content-center gap-2"
              style={{ minHeight: '220px', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '16px 16px' }}
            >
              <div className="p-3 bg-white border rounded shadow-sm" style={{ width: '100%', maxWidth: '440px' }}>
                <div className="text-uppercase fw-bold text-primary mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.08em' }}>
                  {document.issuingAuthority}
                </div>
                <div className="fw-bold text-dark fs-6 mb-2">{document.title}</div>
                <div className="badge bg-light text-dark border font-mono-code mb-3" style={{ fontSize: '0.7rem' }}>
                  STCW Regulation {document.stcwRegulation}
                </div>
                <div className="p-2 bg-light rounded text-start font-mono-code text-secondary" style={{ fontSize: '0.7rem' }}>
                  <div>Certificate No.: <strong className="text-dark">{document.certificateNo}</strong></div>
                  <div>Issued To: <strong className="text-dark">{crewName}</strong></div>
                  <div>Valid Until: <strong className={document.verificationStatus === 'Expired' ? 'text-danger' : 'text-dark'}>{document.expiryDate}</strong></div>
                </div>
                <div className="mt-3 pt-2 border-top text-muted text-uppercase font-mono-code" style={{ fontSize: '0.65rem' }}>
                  Verified copy
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="card-footer d-flex align-items-center justify-content-between p-3 border-top bg-light">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onClose}
          >
            Close
          </button>
          {canManage && (
            <button
              type="button"
              className="btn btn-sm btn-primary d-flex align-items-center gap-2"
              onClick={() => {
                onClose();
                onOpenReupload(document);
              }}
            >
              <span>Upload New Version</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
