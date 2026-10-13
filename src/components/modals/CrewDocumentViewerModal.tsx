/* 
  file summary: modal component for viewing and inspecting stcw crew member certificate details in uniform A4 PDF layout.
  responsibilities: presents STCW qualification certificate in strict A4 format using UniversalDocumentPreviewModal matching Document Library modal.
  role in system: launched by CrewDetailView.tsx when admin, submitter, or reviewer clicks view document.
*/

import React from 'react';
import { STCWDocumentItem } from '../../types/crew';
import { MasterDocument } from '../../types/document';
import { UniversalDocumentPreviewModal } from './UniversalDocumentPreviewModal';
import { Upload } from 'lucide-react';

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
  how: standardizes on UniversalDocumentPreviewModal matching Document Library modal with A4 layout.
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

  const docAsMaster: MasterDocument = {
    id: document.id,
    title: document.title,
    entityType: 'Crew Certificate',
    vesselId: '',
    certificateNo: document.certificateNo,
    issuingAuthority: document.issuingAuthority,
    expiryDate: document.expiryDate,
    ocrConfidence: 98,
    complianceState: document.verificationStatus === 'Expired' ? 'Expired' : document.verificationStatus === 'Expiring' ? 'Expiring < 6 Mos' : 'Valid',
    currentVersion: 'v1.0',
    versions: [{
      versionLabel: 'v1.0',
      uploadedAt: document.issueDate ? `${document.issueDate}T00:00:00Z` : new Date().toISOString(),
      uploadedBy: 'Crewing Administrator',
      fileSizeBytes: document.fileSizeBytes || 1500000,
      fileName: document.fileName || `${document.title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
      changeSummary: 'Uploaded STCW qualification certificate.'
    }],
    crewAttributes: {
      crewName,
      passportId: 'PA-AU-7739102',
      rank: 'Seafarer',
      certType: document.stcwRegulation || document.title,
      issuingCenter: document.issuingAuthority,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      assignedVessel: 'Assigned Vessel',
      nationality: document.flagState || 'Australian',
      trainingDate: document.issueDate,
      ocrConfidence: 98,
    },
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    verificationStatus: document.verificationStatus === 'Verified' ? 'Verified' : 'Pending',
  };

  return (
    <UniversalDocumentPreviewModal
      isOpen={isOpen}
      document={docAsMaster}
      onClose={onClose}
      title="Certificate Layout & PDF Review"
      subtitle={`${document.title} · STCW Reg: ${document.stcwRegulation} · Crew: ${crewName}`}
      versionLabel="v1.0"
      uploadedAt={document.issueDate ? `${document.issueDate}T00:00:00Z` : undefined}
      uploadedBy="Crewing Administrator"
      extraAction={
        canManage ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
            style={{ width: '32px', height: '32px' }}
            title="Upload New Version"
            aria-label="Upload New Version"
            onClick={() => {
              onClose();
              onOpenReupload(document);
            }}
          >
            <Upload size={16} />
          </button>
        ) : undefined
      }
    />
  );
};
