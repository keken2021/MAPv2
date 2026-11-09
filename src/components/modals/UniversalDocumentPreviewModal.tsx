/* 
  file summary: universal modal component for inspecting and previewing statutory, crew, vessel, and equipment documents in strict A4 format.
  responsibilities: provides uniform modal header with document title, maritime metadata, print export, escape key handler, and full A4 certificate preview matching the Document Library Show Document modal layout.
  role in system: unified document preview modal used across DocumentDetailView, VersionHistoryDrawer, DocumentTable, EquipmentDetailView, MarketplaceDetailModal, and VesselDetailView.
*/

import React from 'react';
import { MasterDocument } from '../../types/document';
import { formatMaritimeDate } from '../../utils/formatters';
import { DocumentCertificatePreview } from '../common/DocumentCertificatePreview';
import { Modal } from './Modal';

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
  zIndex?: number;
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
  zIndex,
}) => {
  if (!isOpen || !document) return null;

  const modalTitle = title || 'Certificate Layout & PDF Review';
  const modalSubtitle =
    subtitle ||
    `${document.title} · ${
      versionLabel
        ? `Version ${versionLabel}`
        : `Active Version ${document.currentVersion || 'v1.0'}`
    } (${document.certificateNo})`;

  const footerNode = (
    <>
      <div className="text-secondary small font-mono-code text-truncate me-2">
        {versionLabel ? (
          <span>
            Previewing file revision: <strong>{versionLabel}</strong>
            {uploadedAt && <> · Uploaded {formatMaritimeDate(uploadedAt)}</>}
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
        <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={modalTitle}
      meta={
        <span className="font-mono-code d-inline-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.75rem' }}>
          {modalSubtitle}
          {document.isHandEntered && (
            <span
              className="badge text-dark"
              data-testid="hand-entered-badge"
              style={{ backgroundColor: '#fde68a', border: '1px solid #f59e0b', fontSize: '0.7rem' }}
            >
              Hand-entered (Manual Fallback)
            </span>
          )}
        </span>
      }
      size="xl"
      footer={footerNode}
      bodyClassName="p-4 bg-slate-50 d-flex justify-content-center"
      zIndex={zIndex}
    >
      <DocumentCertificatePreview
        document={document}
        compact={false}
        showToolbar={true}
        showOuterCard={true}
      />
    </Modal>
  );
};
