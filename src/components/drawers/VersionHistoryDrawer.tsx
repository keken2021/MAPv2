/* 
  file summary: document version history drawer component in light theme.
  responsibilities: displays chronological file revision table (v1.0, v1.1) and enables submitters to upload replacement revisions.
  role in system: invoked from document vault table or document deep-dive view.
*/

import React, { useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { MasterDocument } from '../../types/document';
import { formatMaritimeDate } from '../../utils/formatters';
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
  const { addDocumentVersion, activePersona } = useMapStore();
  const [newVersionLabel, setNewVersionLabel] = useState('v1.2');
  const [newFileName, setNewFileName] = useState('');
  const [changeSummary, setChangeSummary] = useState('');

  if (!document) return null;

  const isCAdmin = activePersona === 'C Admin';

  const handleUploadRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    addDocumentVersion(
      document.id,
      newVersionLabel,
      newFileName,
      2500000,
      changeSummary || 'New version uploaded.'
    );

    setNewFileName('');
    setChangeSummary('');
    onClose();
  };

  const canUpload = activePersona === 'Administrator' || activePersona === 'Submitter';

  return (
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
            <button type="submit" form={UPLOAD_FORM_ID} className="btn btn-primary">
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
              <span className="text-secondary small font-mono-code">
                {formatMaritimeDate(ver.uploadedAt)}
              </span>
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
  );
};
