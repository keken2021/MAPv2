/* 
  file summary: modal component for viewing and inspecting stcw crew member certificate details in uniform A4 PDF layout.
  responsibilities: presents STCW qualification certificate in strict A4 format using UniversalDocumentPreviewModal reading live crew and document records.
  role in system: launched by CrewDetailView.tsx when admin, submitter, or reviewer clicks view document.
*/

import React from 'react';
import { STCWDocumentItem } from '../../types/crew';
import { MasterDocument } from '../../types/document';
import { UniversalDocumentPreviewModal } from './UniversalDocumentPreviewModal';
import { Upload } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { MOCK_CREW } from '../../store/crewMockData';

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
  how: standardizes on UniversalDocumentPreviewModal reading genuine crew member and document records.
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

  let crewMembers = MOCK_CREW;
  let documents: MasterDocument[] = [];
  try {
    if (typeof useMapStore !== 'undefined' && useMapStore.getState) {
      const state = useMapStore.getState();
      if (state.crew && state.crew.length > 0) crewMembers = state.crew;
      if (state.documents && state.documents.length > 0) documents = state.documents;
    }
  } catch {
    // fallback to mock arrays outside zustand context
  }

  const member = crewMembers.find(
    (c) => (crewName && c.fullName.toLowerCase() === crewName.toLowerCase()) ||
           c.layer1CoreDocuments?.some((d) => d.id === document.id || (document.certificateNo && d.certificateNo === document.certificateNo)) ||
           c.layer2Endorsements?.some((d) => d.id === document.id || (document.certificateNo && d.certificateNo === document.certificateNo))
  );

  const matchedDoc = documents.find(
    (d) => d.id === document.id || (document.certificateNo && d.certificateNo === document.certificateNo)
  );

  const resolvedRank = member?.rank || 'Crew Member';
  const resolvedNationality = member?.nationality || document.flagState || 'N/A';
  const resolvedVessel = member?.currentVesselName || member?.assignments?.find((a) => a.isCurrent)?.vesselName || 'Unassigned';
  const resolvedPassport = member?.passportNo || '';
  const resolvedFileSizeBytes = document.fileSizeBytes || matchedDoc?.versions?.[0]?.fileSizeBytes || 0;
  const resolvedFileName = document.fileName || matchedDoc?.versions?.[0]?.fileName || `${document.title.toLowerCase().replace(/\s+/g, '_')}.pdf`;
  const resolvedUploadedBy = matchedDoc?.versions?.[0]?.uploadedBy || 'Submitter';
  const resolvedVersion = matchedDoc?.currentVersion || 'v1.0';
  const resolvedConfidence = matchedDoc?.ocrConfidence ?? (document.verificationStatus === 'Verified' ? 99 : 92);
  const resolvedUploadedAt = matchedDoc?.versions?.[0]?.uploadedAt || (document.issueDate ? `${document.issueDate}T00:00:00Z` : new Date().toISOString());

  const docAsMaster: MasterDocument = {
    id: document.id,
    title: document.title,
    entityType: 'Crew Certificate',
    vesselId: '',
    certificateNo: document.certificateNo,
    issuingAuthority: document.issuingAuthority,
    expiryDate: document.expiryDate,
    ocrConfidence: resolvedConfidence,
    complianceState: document.verificationStatus === 'Expired' ? 'Expired' : document.verificationStatus === 'Expiring' ? 'Expiring < 6 Mos' : 'Valid',
    currentVersion: resolvedVersion,
    versions: matchedDoc?.versions && matchedDoc.versions.length > 0
      ? matchedDoc.versions
      : [{
          versionLabel: resolvedVersion,
          uploadedAt: resolvedUploadedAt,
          uploadedBy: resolvedUploadedBy,
          fileSizeBytes: resolvedFileSizeBytes,
          fileName: resolvedFileName,
          changeSummary: 'Uploaded STCW qualification certificate.'
        }],
    crewAttributes: {
      crewName: member?.fullName || crewName,
      passportId: resolvedPassport,
      rank: resolvedRank,
      certType: document.stcwRegulation || document.title,
      issuingCenter: document.issuingAuthority,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      assignedVessel: resolvedVessel,
      nationality: resolvedNationality,
      trainingDate: document.issueDate,
      ocrConfidence: resolvedConfidence,
    },
    validationRules: matchedDoc?.validationRules || {
      charterBufferPassed: true,
      assetMatch100Percent: Boolean(member?.currentVesselName),
      iacsAuthorityValid: Boolean(document.issuingAuthority),
      overallValid: document.verificationStatus === 'Verified',
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
      versionLabel={docAsMaster.currentVersion}
      uploadedAt={resolvedUploadedAt}
      uploadedBy={resolvedUploadedBy}
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
