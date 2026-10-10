/*
  file summary: returned documents drawer for the submitter dashboard.
  responsibilities: lists the requirements of one assurance set whose document was returned for correction or rejected, with the verifier notes and the review and upload actions.
  role in system: opened from the returned queue of DashboardView.tsx.
*/

import React from 'react';
import { useMapStore } from '../../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import { MasterDocument } from '../../types/document';
import { Drawer } from './Drawer';

interface ReturnedDocumentsDrawerProps {
  assuranceSet: AssuranceSet;
  onClose: () => void;
  onReview: (doc: MasterDocument, notes: string) => void;
  onUpload: (req: AssuranceRequirement, doc?: MasterDocument) => void;
  onViewAssuranceSet: (setId: string) => void;
  /* true while the upload modal opened from this drawer covers it */
  paused?: boolean;
}

/**
  what: renders the returned documents drawer for one assurance set.
  how: finds each requirement whose verifier status or linked document status is Correction Requested or Rejected, and shows it as a card with the notes and actions.
  with what file: src/components/drawers/ReturnedDocumentsDrawer.tsx loaded by DashboardView.tsx.
*/
export const ReturnedDocumentsDrawer: React.FC<ReturnedDocumentsDrawerProps> = ({
  assuranceSet,
  onClose,
  onReview,
  onUpload,
  onViewAssuranceSet,
  paused,
}) => {
  const { documents } = useMapStore();

  const findLinkedDoc = (req: AssuranceRequirement) =>
    documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));

  const returnedRequirements = assuranceSet.requirements.filter((r) => {
    const linkedDoc = findLinkedDoc(r);
    return (
      r.verifierStatus === 'Correction Requested' ||
      r.verifierStatus === 'Rejected' ||
      linkedDoc?.verificationStatus === 'Correction Requested' ||
      linkedDoc?.verificationStatus === 'Rejected'
    );
  });

  return (
    <Drawer
      title="Returned Documents"
      meta={`${assuranceSet.id} · ${assuranceSet.title}`}
      onClose={onClose}
      paused={paused}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => onViewAssuranceSet(assuranceSet.id)}
          >
            View Assurance Set
          </button>
        </>
      }
    >
      <div className="map-drawer-stack">
        <div className="alert alert-warning border-warning py-2.5 px-3 mb-0 small">
          <div className="fw-semibold text-dark">Action Required</div>
          <div className="text-secondary">
            These documents were returned or rejected. Read the notes and upload a new version.
          </div>
        </div>

        {returnedRequirements.map((req) => {
          const linkedDoc = findLinkedDoc(req);
          const status = req.verifierStatus === 'Rejected' || linkedDoc?.verificationStatus === 'Rejected' ? 'Rejected' : 'Correction Requested';
          const defectNote = req.notes || linkedDoc?.verificationNotes || 'Returned for correction. Upload a new version.';

          return (
            <div key={req.id} className="map-drawer-card">
              <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                <div>
                  <div className="fw-bold text-dark">{req.title}</div>
                  <div className="font-mono-code text-secondary small">
                    {req.category} {linkedDoc?.certificateNo ? `· ${linkedDoc.certificateNo}` : ''}
                  </div>
                </div>
                <span className={`badge ${status === 'Rejected' ? 'bg-danger text-white' : 'bg-warning text-dark'} font-mono-code`} style={{ fontSize: '0.75rem' }}>
                  {status}
                </span>
              </div>

              <div className="map-drawer-inset mb-3">
                <div className="fw-semibold mb-1" style={{ fontSize: '0.75rem' }}>
                  Notes
                </div>
                <div className="text-dark font-mono-code" style={{ fontSize: '0.8rem' }}>
                  {defectNote}
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-end gap-2">
                {linkedDoc && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => onReview(linkedDoc, defectNote)}
                  >
                    Review
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-primary text-white"
                  onClick={() => onUpload(req, linkedDoc)}
                >
                  Upload New Version
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
};
