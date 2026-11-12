/* 
  file summary: document version history drawer component in light theme.
  responsibilities: displays chronological file revision table (v1.0, v1.1) and enables submitters to upload replacement revisions.
  role in system: invoked from document vault table or document deep-dive view.
*/

import React, { useState, useMemo } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { MasterDocument, DocumentVersion } from '../../types/document';
import { formatMaritimeDate } from '../../utils/formatters';
import { documentExpiresBeforeContractEnd, getDocumentReuploadBlockReason } from '../../utils/documentRenewalHelpers';
import { canEditOwnedEvidence, EVIDENCE_NOT_OWNED_EDIT } from '../../utils/documentOwnershipHelpers';
import { getAssuranceSetRoleActions } from '../../utils/rbacHelpers';
import { isClosedAssuranceSet } from '../../utils/documentVersionSnapshot';
import { getDemoSessionContext, getSessionUserForPersona } from '../../utils/userRoleHelpers';
import { exportDocumentAsPdf } from '../../utils/documentTemplateHelpers';
import { getNextVersionLabel } from '../../utils/documentObjectHelpers';
import { UniversalDocumentPreviewModal } from '../modals/UniversalDocumentPreviewModal';
import { Drawer } from './Drawer';

const UPLOAD_FORM_ID = 'version-upload-form';

interface VersionHistoryDrawerProps {
  document: MasterDocument | null;
  onClose: () => void;
}

/**
  what: renders document version history drawer in light theme.
  how: lists version entries array from document and exposes revision upload form.
  with what file: src/components/drawers/VersionHistoryDrawer.tsx loaded by DocumentLibraryView.tsx.
*/
export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({ document, onClose }) => {
  const {
    addDocumentVersion,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    assuranceSets,
    vessels,
    crew,
    equipment,
    assuranceObjects,
    users,
    notifications,
  } = useMapStore();
  const defaultNextVer = document ? getNextVersionLabel(document.versions, document.currentVersion) : 'v1.1';
  const [newVersionLabel, setNewVersionLabel] = useState(defaultNextVer);
  const [newFileName, setNewFileName] = useState('');
  const [newFileSizeBytes, setNewFileSizeBytes] = useState<number>(0);
  const [changeSummary, setChangeSummary] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [selectedVersionForModal, setSelectedVersionForModal] = useState<DocumentVersion | null>(null);

  React.useEffect(() => {
    if (document) {
      setNewVersionLabel(getNextVersionLabel(document.versions, document.currentVersion));
      setNewFileName('');
      setNewFileSizeBytes(0);
      setChangeSummary('');
      setNewExpiryDate('');
    }
  }, [document?.id]);

  const activeModalDoc: MasterDocument = useMemo(() => {
    if (!document) return {} as MasterDocument;
    if (!selectedVersionForModal) return document;
    return {
      ...document,
      currentVersion: selectedVersionForModal.versionLabel,
      versions: [
        selectedVersionForModal,
        ...document.versions.filter((v) => v.versionLabel !== selectedVersionForModal.versionLabel),
      ],
    };
  }, [document, selectedVersionForModal]);

  const sessionUser = getSessionUserForPersona(
    activePersona,
    users,
    getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
  );
  const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || '';
  const linkedSets = document
    ? assuranceSets.filter((set) =>
        set.requirements?.some((req) => req.documentId === document.id || req.linkedDocumentId === document.id),
      )
    : [];
  const hasOpenLinkedSetUploadRights =
    linkedSets.length === 0 ||
    linkedSets.some((set) => {
      if (isClosedAssuranceSet(set) || set.stage === 'Cancelled') return false;
      return getAssuranceSetRoleActions(set, activePersona, activeDemoOrganization, sessionUser).canUpload;
    });

  const ownsEvidence = document
    ? canEditOwnedEvidence(document, effectiveOrg, {
        persona: activePersona,
        vessels,
        users,
        equipment,
        crew,
        assuranceObjects,
      })
    : false;

  const linkedCharterWindowEnd = linkedSets
    .map((set) => set.charterWindowEnd)
    .find((end) => end && documentExpiresBeforeContractEnd(document!, end));

  const linkedReqVerifierStatus = linkedSets
    .flatMap((set) => set.requirements.filter((r) => r.documentId === document?.id || r.linkedDocumentId === document?.id))
    .find((r) => r.verifierStatus === 'Correction Requested' || r.verifierStatus === 'Rejected')?.verifierStatus;

  const isUnlinked = linkedSets.length === 0;
  const renewalBlockReason = document
    ? getDocumentReuploadBlockReason(
        document,
        notifications,
        new Date(),
        linkedCharterWindowEnd,
        linkedReqVerifierStatus,
        isUnlinked,
      )
    : undefined;
  const reuploadBlockReason = !ownsEvidence ? EVIDENCE_NOT_OWNED_EDIT : renewalBlockReason;
  const canUpload =
    Boolean(sessionUser) &&
    (activePersona === 'Administrator' || activePersona === 'Submitter') &&
    ownsEvidence &&
    hasOpenLinkedSetUploadRights;

  if (!document) return null;

  const handleUploadRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpload || !newFileName.trim() || reuploadBlockReason) return;

    const sizeToSave = newFileSizeBytes > 0 ? newFileSizeBytes : (document.versions[0]?.fileSizeBytes || 1024 * 1024);

    if (newExpiryDate.trim()) {
      addDocumentVersion(
        document.id,
        newVersionLabel,
        newFileName,
        sizeToSave,
        changeSummary || 'New version uploaded.',
        newExpiryDate.trim(),
      );
    } else {
      addDocumentVersion(
        document.id,
        newVersionLabel,
        newFileName,
        sizeToSave,
        changeSummary || 'New version uploaded.',
      );
    }

    setNewFileName('');
    setChangeSummary('');
    setNewExpiryDate('');
    onClose();
  };

  return (
    <>
      <Drawer
      title={document.title}
      meta={document.certificateNo}
      onClose={onClose}
      footer={
        canUpload ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form={UPLOAD_FORM_ID}
              className="btn btn-primary"
              disabled={Boolean(reuploadBlockReason)}
              title={reuploadBlockReason}
            >
              Upload New Version
            </button>
          </>
        ) : undefined
      }
    >
      {/* Upload New Revision Form (For Submitter / Admin) */}
      {canUpload && (
        <form id={UPLOAD_FORM_ID} onSubmit={handleUploadRevision} className="map-drawer-card mb-4">
          <h3 className="map-drawer-section-title">Upload New Version</h3>
          {reuploadBlockReason && (
            <div className="alert alert-secondary py-2 small mb-3">{reuploadBlockReason}</div>
          )}

          <div className="mb-3">
            <label className="map-drawer-label" htmlFor="ver-file-input">
              Select File <span className="text-muted small fw-normal">(optional)</span>
            </label>
            <input
              id="ver-file-input"
              type="file"
              className="form-control bg-white text-dark"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setNewFileName(f.name);
                  setNewFileSizeBytes(f.size);
                }
              }}
            />
          </div>

          <div className="row g-3 mb-3">
            <div className="col-4">
              <label className="map-drawer-label" htmlFor="ver-label">
                Version <span className="text-danger">*</span>
              </label>
              <input
                id="ver-label"
                type="text"
                className="form-control bg-white text-dark font-mono-code"
                style={{ fontSize: '1rem' }}
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                required
              />
            </div>
            <div className="col-8">
              <label className="map-drawer-label" htmlFor="ver-filename">
                File Name <span className="text-danger">*</span>
              </label>
              <input
                id="ver-filename"
                type="text"
                className="form-control bg-white text-dark"
                placeholder="e.g. DNV_Cert_Rev_1.2.pdf"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="map-drawer-label" htmlFor="ver-expiry-date">
              Expiry Date <span className="text-muted small fw-normal">(optional — leaves current {document.expiryDate ? formatMaritimeDate(document.expiryDate) : 'expiry'} if blank)</span>
            </label>
            <input
              id="ver-expiry-date"
              type="date"
              className="form-control bg-white text-dark font-mono-code"
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
            />
          </div>

          <div>
            <label className="map-drawer-label" htmlFor="ver-summary">
              Change Summary <span className="text-danger">*</span>
            </label>
            <textarea
              id="ver-summary"
              className="form-control bg-white text-dark"
              rows={2}
              placeholder="What changed"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              required
            />
          </div>
        </form>
      )}

      {/* Version History Timeline */}
      <h3 className="map-drawer-section-title">Version History</h3>

      <div className="map-drawer-stack">
        {document.versions.map((ver) => (
          <div key={ver.versionLabel} className="map-drawer-card">
            <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
              <span className="badge bg-info text-dark font-mono-code" style={{ fontSize: '0.8rem' }}>
                {ver.versionLabel}
              </span>
              <div className="d-flex align-items-center gap-2">
                <span className="text-secondary small font-mono-code">
                  {formatMaritimeDate(ver.uploadedAt)}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                  style={{ width: '26px', height: '26px' }}
                  onClick={() => {
                    setSelectedVersionForModal(ver);
                    setIsCertModalOpen(true);
                  }}
                  title={`Show document (${ver.versionLabel})`}
                  aria-label={`Show document (${ver.versionLabel})`}
                >
                  <FileText size={13} />
                </button>
              </div>
            </div>

            <div className="fw-bold text-dark mb-1">{ver.fileName}</div>
            <div className="text-secondary small mb-2">
              Uploaded By: <strong>{ver.uploadedBy}</strong> ({Math.round(ver.fileSizeBytes / 1024 / 1024 * 10) / 10} MB)
            </div>
            <div className="map-drawer-inset fst-italic">
              "{ver.changeSummary}"
            </div>
          </div>
        ))}
      </div>
    </Drawer>

    {/* Certificate Layout & PDF Review Modal */}
    <UniversalDocumentPreviewModal
      isOpen={isCertModalOpen}
      document={activeModalDoc}
      onClose={() => setIsCertModalOpen(false)}
      versionLabel={selectedVersionForModal?.versionLabel}
      uploadedAt={selectedVersionForModal?.uploadedAt}
      uploadedBy={selectedVersionForModal?.uploadedBy}
    />
  </>
  );
};
