/* 
  file summary: extraction review drawer matching exact mockup layout with document scan preview, OCR confidence scores, and action banner.
  responsibilities: presents OCR extraction review with confidence threshold progress bars, quality indicators, and verifier action controls.
  role in system: invoked from verifier workspace, document detail view, or requirements register.
*/

import React, { useEffect, useRef, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { MasterDocument } from '../../types/document';
import { DocumentUploadModal } from '../modals/DocumentUploadModal';
import { Check, AlertCircle } from 'lucide-react';
import { isUserDocumentSubmitter } from '../../utils/userRoleHelpers';
import { Drawer } from './Drawer';

interface DocumentReviewDrawerProps {
  document: MasterDocument | null;
  requirementNotes?: string;
  onClose: () => void;
  /* false when the caller's assurance set does not grant the active persona submit actions */
  allowSubmit?: boolean;
  /* false when the caller's assurance set does not grant the active persona verify actions */
  allowVerify?: boolean;
}

interface ExtractedAttribute {
  id: string;
  label: string;
  value: string;
  confidence: number;
  isMandatoryMissing?: boolean;
}

/**
  what: renders extraction review drawer matching exact mockup layout.
  how: displays document metadata header, scanned page preview box with quality checks, OCR extracted attributes with progress bars, and exception action banner.
  with what file: src/components/drawers/DocumentReviewDrawer.tsx loaded by VerifierWorkspaceView.tsx and AssuranceDetailView.tsx.
*/
export const DocumentReviewDrawer: React.FC<DocumentReviewDrawerProps> = ({ document, requirementNotes, onClose, allowSubmit = true, allowVerify = true }) => {
  const { verifyDocument, activePersona, assuranceSets } = useMapStore();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  /* the notes field takes focus when a footer action needs notes, so the error is in view */
  const notesRef = useRef<HTMLTextAreaElement>(null);
  /* manual inline field editing state */
  const [isManualEditActive, setIsManualEditActive] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [correctedFieldIds, setCorrectedFieldIds] = useState<Set<string>>(new Set());
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const linkedSet = document
    ? assuranceSets.find(
      (set) =>
        set.requirements?.some(
          (req) =>
            req.documentId === document.id ||
            req.linkedDocumentId === document.id ||
            (req.title && document.title && req.title.toLowerCase().includes(document.title.toLowerCase())) ||
            (document.title && req.title && document.title.toLowerCase().includes(req.title.toLowerCase()))
        ) || (set.vesselId === document.vesselId)
    )
    : undefined;

  useEffect(() => {
    if (!document) return;
    setComment('');
    setCommentError('');
    setIsManualEditActive(false);
    setEditedValues({});
    setCorrectedFieldIds(new Set());
  }, [document?.id, linkedSet?.id, linkedSet?.mandatoryInspectionRequired]);

  /* triggers one-shot shimmer on all ocr-extracted value cells when drawer opens or document changes */
  const [isJustLoaded, setIsJustLoaded] = useState(true);
  useEffect(() => {
    if (!document) return;
    setIsJustLoaded(true);
    const timer = setTimeout(() => setIsJustLoaded(false), 800);
    return () => clearTimeout(timer);
  }, [document?.id]);

  if (!document) return null;

  const isVerified = document.verificationStatus === 'Verified';

  const linkedReq = linkedSet?.requirements?.find(
    (req) =>
      req.documentId === document.id ||
      req.linkedDocumentId === document.id ||
      (req.title && document.title && req.title.toLowerCase().includes(document.title.toLowerCase())) ||
      (document.title && req.title && document.title.toLowerCase().includes(req.title.toLowerCase()))
  );

  const isSubmitter = isUserDocumentSubmitter(
    null,
    activePersona,
    document,
    linkedReq,
    linkedSet
  );

  const canSubmit = allowSubmit && (activePersona === 'Submitter' || activePersona === 'Administrator');
  const canVerify = allowVerify && !isSubmitter && (activePersona === 'Verifier' || activePersona === 'Administrator');

  const requireComment = () => {
    if (!comment.trim()) {
      setCommentError('Notes are required to return or reject a document.');
      notesRef.current?.focus();
      return false;
    }
    setCommentError('');
    return true;
  };

  const isReuploaded = document.versions.length > 1 || document.currentVersion !== 'v1.0' || (document.ocrConfidence && document.ocrConfidence >= 90);
  const activeNotes = requirementNotes || document.verificationNotes || (document.versions.length > 0 ? document.versions[0].changeSummary : undefined);

  /* mock extracted attributes matching design screenshot */
  const extractedAttributes: ExtractedAttribute[] = document.crewAttributes
    ? [
      { id: '1', label: 'CREW NAME', value: document.crewAttributes.crewName || 'A. Mendoza', confidence: isReuploaded ? 98 : 91 },
      { id: '2', label: 'PASSPORT NUMBER', value: isReuploaded ? (document.crewAttributes.passportId || 'P9912447') : `${document.crewAttributes.passportId || 'P9912447'} (partially legible)`, confidence: isReuploaded ? 98 : 61 },
      { id: '3', label: 'RANK', value: document.crewAttributes.rank || 'Able Seaman', confidence: isReuploaded ? 97 : 88 },
      { id: '4', label: 'CERTIFICATE TYPE', value: document.title || 'Medical Fitness Certificate', confidence: isReuploaded ? 99 : 94 },
      { id: '5', label: 'ISSUING AUTHORITY', value: isReuploaded ? (document.issuingAuthority || 'AMSA (Verified Seal)') : `${document.issuingAuthority || 'illegible stamp'}`, confidence: isReuploaded ? 97 : 44 },
      { id: '6', label: 'ISSUE DATE', value: '2024-11-02', confidence: isReuploaded ? 98 : 79 },
      { id: '7', label: 'EXPIRY DATE', value: '2026-10-29', confidence: isReuploaded ? 99 : 86 },
      { id: '8', label: 'VESSEL', value: 'MV Torrens Supporter', confidence: isReuploaded ? 98 : 72 },
      { id: '9', label: 'NATIONALITY', value: 'Philippines', confidence: isReuploaded ? 98 : 90 },
      { id: '10', label: 'TRAINING COMPLETION DATE', value: isReuploaded ? '2024-10-15' : 'not present', confidence: isReuploaded ? 96 : 0, isMandatoryMissing: isReuploaded ? false : true },
    ]
    : [
      { id: '1', label: 'CERTIFICATE NO.', value: document.certificateNo || 'CERT-99412', confidence: isReuploaded ? 99 : 94 },
      { id: '2', label: 'VESSEL NAME', value: document.vesselAttributes?.vesselName || 'MV Torrens Supporter', confidence: isReuploaded ? 98 : 91 },
      { id: '3', label: 'IMO NUMBER', value: document.vesselAttributes?.imoNumber || 'IMO 9840123', confidence: isReuploaded ? 99 : 88 },
      { id: '4', label: 'ISSUING AUTHORITY', value: isReuploaded ? (document.issuingAuthority || 'DNV GL (Verified)') : (document.issuingAuthority || 'DNV GL (partially legible)'), confidence: isReuploaded ? 97 : 65 },
      { id: '5', label: 'EXPIRY DATE', value: document.expiryDate || '2026-10-29', confidence: isReuploaded ? 98 : 79 },
    ];

  /* dynamic confidence calculation aligned with data entry edits and manual corrections */
  const totalEffectiveConfidence = extractedAttributes.reduce((sum, attr) => {
    const isCorrected = correctedFieldIds.has(attr.id) || (editedValues[attr.id] !== undefined && editedValues[attr.id].trim() !== '' && editedValues[attr.id] !== attr.value);
    return sum + (isCorrected ? 100 : attr.confidence);
  }, 0);
  const overallConfidence = document.verificationStatus === 'Verified'
    ? 100
    : Math.min(100, Math.round(totalEffectiveConfidence / extractedAttributes.length));

  /* dynamic quality checks aligned with document attributes and manual data entry */
  const hasUncorrectedMissingMandatory = extractedAttributes.some(
    (attr) => attr.isMandatoryMissing && !correctedFieldIds.has(attr.id) && !(editedValues[attr.id] && editedValues[attr.id].trim() !== '')
  );
  const isFullPagePassed = !hasUncorrectedMissingMandatory && overallConfidence >= 85;
  const isSignaturePassed = isReuploaded ||
    correctedFieldIds.has('5') ||
    correctedFieldIds.has('4') ||
    (editedValues['5'] && editedValues['5'].trim() !== '') ||
    (editedValues['4'] && editedValues['4'].trim() !== '') ||
    overallConfidence >= 90 ||
    document.verificationStatus === 'Verified';

  const handleVerify = () => {
    verifyDocument(
      document.id,
      'Verified',
      comment.trim() || 'Verified extracted fields.',
    );
    onClose();
  };

  const handleCorrection = () => {
    if (!requireComment()) return;
    verifyDocument(document.id, 'Correction Requested', comment.trim());
    onClose();
  };

  const handleReject = () => {
    if (!requireComment()) return;
    verifyDocument(document.id, 'Rejected', comment.trim());
    onClose();
  };



  /* review actions sit in the drawer footer so they stay in view while the fields scroll */
  const showReviewActions = !isVerified && canVerify;

  return (
    <>
      <Drawer
        title={document.title}
        meta={`${document.title.toLowerCase().replace(/\s+/g, '-')}-scan.jpg · 640 KB · 1 page · ${document.currentVersion}`}
        size="xl"
        onClose={onClose}
        paused={isUploadModalOpen}
        headerAside={
          <div className="text-end">
            <div className="fw-bold lh-1" style={{ fontSize: '1.5rem', color: overallConfidence >= 90 ? '#047857' : '#c2410c' }}>
              {overallConfidence}%
            </div>
            <div className="lh-sm text-muted" style={{ fontSize: '0.75rem' }}>
              overall confidence, threshold 90%
            </div>
          </div>
        }
        footer={
          showReviewActions ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <div className="map-drawer-footer-actions">
                {canSubmit && (
                  <button type="button" className="btn btn-primary" onClick={() => setIsUploadModalOpen(true)}>
                    Upload New Version
                  </button>
                )}
                <button type="button" className="btn btn-outline-danger" onClick={handleReject}>
                  Reject
                </button>
                <button
                  type="button"
                  className="btn text-dark"
                  style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a' }}
                  onClick={handleCorrection}
                >
                  Return for Correction
                </button>
                <button type="button" className="btn btn-success" onClick={handleVerify}>
                  Verify
                </button>
              </div>
            </>
          ) : undefined
        }
      >
        <div className="row g-4">
          {/* left column: scanned document page preview box & quality checks */}
          <div className="col-md-4 col-lg-3 d-flex flex-column gap-3">
            <div
              className="p-3 border rounded-3 text-center d-flex flex-column align-items-center justify-content-center bg-white shadow-2xs"
              style={{
                borderStyle: 'dashed',
                borderColor: overallConfidence >= 90 ? '#86efac' : '#cbd5e1',
                minHeight: '260px',
                background: overallConfidence >= 90 ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' : '#ffffff',
              }}
            >
              <div className="font-mono-code text-uppercase text-muted small fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.08em' }}>
                SCANNED PAGE
              </div>
              <div className="font-mono-code text-muted small mt-1" style={{ fontSize: '0.75rem' }}>
                1 of 1 · 240 DPI
              </div>
              <div
                className="mt-3 px-2 py-1 rounded border font-mono-code fw-semibold"
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: overallConfidence >= 90 ? '#dcfce7' : '#ffedd5',
                  color: overallConfidence >= 90 ? '#15803d' : '#c2410c',
                }}
              >
                OCR {overallConfidence}% · {overallConfidence >= 90 ? 'High Fidelity' : 'Human Review'}
              </div>
            </div>

            {/* quality checks list */}
            <div className="map-drawer-card d-flex flex-column gap-2">
              <div className={`${isJustLoaded ? 'map-criteria-item-1' : ''} d-flex align-items-center gap-2 small`} style={{ fontSize: '0.75rem', color: '#475569' }}>
                <span
                  className="d-flex align-items-center justify-content-center rounded text-white fw-bold me-1.5 flex-shrink-0"
                  style={{ width: '18px', height: '18px', backgroundColor: '#059669' }}
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
                <span className="ps-0.5 text-dark fw-medium">Resolution 240 DPI</span>
              </div>
              <div className={`${isJustLoaded ? 'map-criteria-item-2' : ''} d-flex align-items-center gap-2 small`} style={{ fontSize: '0.75rem', color: '#475569' }}>
                <span
                  className="d-flex align-items-center justify-content-center rounded text-white fw-bold me-1.5 flex-shrink-0"
                  style={{
                    width: '18px',
                    height: '18px',
                    backgroundColor: isFullPagePassed ? '#059669' : '#c2410c',
                  }}
                >
                  {isFullPagePassed ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : <AlertCircle className="w-3 h-3 text-white" />}
                </span>
                <span className="ps-0.5 text-dark fw-medium">Full page captured</span>
              </div>
              <div className={`${isJustLoaded ? 'map-criteria-item-3' : ''} d-flex align-items-center gap-2 small`} style={{ fontSize: '0.75rem', color: '#475569' }}>
                <span
                  className="d-flex align-items-center justify-content-center rounded text-white fw-bold me-1.5 flex-shrink-0"
                  style={{
                    width: '18px',
                    height: '18px',
                    backgroundColor: isSignaturePassed ? '#059669' : '#c2410c',
                  }}
                >
                  {isSignaturePassed ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : <AlertCircle className="w-3 h-3 text-white" />}
                </span>
                <span className="ps-0.5 text-dark fw-medium">Signature or stamp present</span>
              </div>
            </div>
          </div>

          {/* right column: extracted metadata attributes & ocr confidence bars */}
          <div className="col-md-8 col-lg-9 d-flex flex-column gap-3">
            {/* Verification Notes & Audit Feedback Card */}
            {activeNotes && (
              <div className="map-drawer-card font-mono-code small">
                <div className="fw-bold text-uppercase text-secondary mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.06em' }}>
                  Notes
                </div>
                <div className="text-dark fw-semibold" style={{ fontSize: '0.825rem' }}>
                  {activeNotes}
                </div>
              </div>
            )}

            <div className="map-drawer-card map-extraction-field-list">
            {extractedAttributes.map((attr) => {
              const isFieldCorrected = correctedFieldIds.has(attr.id);
              const currentValue = editedValues[attr.id] !== undefined ? editedValues[attr.id] : attr.value;
              const isBelowThreshold = !isFieldCorrected && attr.confidence < 90 && attr.confidence > 0;
              const isMissing = !isFieldCorrected && attr.isMandatoryMissing;
              const effectiveConfidence = isFieldCorrected ? 100 : attr.confidence;
              const barColor = isMissing ? '#e2e8f0' : effectiveConfidence >= 90 ? '#059669' : '#c2410c';

              return (
                <div key={attr.id} className="map-extraction-field-row">
                  <div className="d-flex flex-column flex-grow-1 me-3">
                    <div className="font-mono-code text-uppercase small fw-bold mb-0.5" style={{ fontSize: '0.75rem', color: '#64748b', letterSpacing: '0.06em' }}>
                      {attr.label}
                    </div>
                    {isManualEditActive ? (
                      <input
                        type="text"
                        className="map-extraction-field-input"
                        value={currentValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditedValues((prev) => ({ ...prev, [attr.id]: val }));
                          setCorrectedFieldIds((prev) => new Set(prev).add(attr.id));
                        }}
                        placeholder={`Enter ${attr.label.toLowerCase()}...`}
                      />
                    ) : (
                      <div
                        className={`font-mono-code fw-bold ${isMissing ? 'text-danger' : `text-dark${isJustLoaded && !isMissing ? ' map-autofill-animate' : ''}`}`}
                        style={{ fontSize: '0.875rem', cursor: canSubmit ? 'pointer' : 'default' }}
                        title={canSubmit ? "Click to edit field manually" : undefined}
                        onClick={() => canSubmit && setIsManualEditActive(true)}
                      >
                        {currentValue}
                      </div>
                    )}
                    {isFieldCorrected ? (
                      <div className="small mt-0.5 fw-bold text-success d-inline-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                        <Check className="w-3 h-3 text-success" /> Manually Corrected (100% Verified)
                      </div>
                    ) : isBelowThreshold ? (
                      <div className="small mt-0.5" style={{ fontSize: '0.75rem', color: '#b45309' }}>
                        Below 90%. Check this field.
                      </div>
                    ) : isMissing ? (
                      <div className="small mt-0.5 fw-semibold" style={{ fontSize: '0.75rem', color: '#dc2626' }}>
                        Mandatory field missing
                      </div>
                    ) : null}
                  </div>

                  {/* ocr confidence bar */}
                  <div className="d-flex flex-column align-items-end flex-shrink-0" style={{ width: '140px' }}>
                    <div className="w-100 bg-light rounded-pill overflow-hidden" style={{ height: '6px', backgroundColor: '#f1f5f9' }}>
                      <div
                        className="h-100 rounded-pill transition-all"
                        style={{
                          width: `${effectiveConfidence}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    <div className="font-mono-code small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                      {effectiveConfidence}%
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Exception Action Banner matching design screenshot - hidden for Verifiers, only shown for Submitter / Vessel Admin roles */}
            {canSubmit && (
              <div className="map-exception-banner">
                <div>
                  <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.875rem', color: '#92400e' }}>
                    Submitter action required
                  </div>
                  <div className="small" style={{ fontSize: '0.775rem', color: '#b45309' }}>
                    The issuing authority and passport number are hard to read, and the training completion date is missing. Upload a clearer scan or a renewed certificate.
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className={`btn btn-sm map-btn-outline-manual ${isManualEditActive ? 'is-active' : ''}`}
                    onClick={() => setIsManualEditActive(!isManualEditActive)}
                  >
                    {isManualEditActive ? 'Done' : 'Edit Fields'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm map-btn-orange-action"
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    Upload New Version
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* locked notice if verified / approved */}
        {isVerified ? (
          (() => {
            const isSetApproved = linkedSet?.stage === 'Approval' || linkedSet?.approverDecision === 'Approved';
            return (
              <div
                className="p-4 rounded-3 d-flex flex-column gap-3 border mt-4"
                style={{
                  backgroundColor: isSetApproved ? '#f0fdf4' : '#f0f9ff',
                  borderColor: isSetApproved ? '#bbf7d0' : '#bae6fd',
                }}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div
                      className={`fw-bold mb-1 ${isSetApproved ? 'text-success-emphasis' : 'text-primary-emphasis'}`}
                      style={{ fontSize: '0.95rem' }}
                    >
                      {isSetApproved
                        ? 'Approved'
                        : 'Verified'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: isSetApproved ? '#166534' : '#0369a1',
                        lineHeight: '1.4',
                      }}
                    >
                      {isSetApproved
                        ? 'This document is verified and approved.'
                        : 'This document is verified and waiting for approval.'}
                    </div>
                  </div>
                  <span
                    className={`badge font-mono-code px-3 py-2 ${isSetApproved ? 'bg-success text-white' : 'bg-info text-dark'}`}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {isSetApproved ? 'Approved' : 'Verified'}
                  </span>
                </div>
                {document.verificationNotes && (
                  <div
                    className={`p-3 rounded-3 bg-white border text-dark small shadow-2xs ${isSetApproved ? 'border-success-subtle' : 'border-info-subtle'}`}
                    style={{ fontSize: '0.8rem' }}
                  >
                    <div
                      className={`fw-bold mb-1 ${isSetApproved ? 'text-success-emphasis' : 'text-info-emphasis'}`}
                      style={{ fontSize: '0.75rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}
                    >
                      Notes
                    </div>
                    <div className="text-dark">{document.verificationNotes}</div>
                  </div>
                )}
              </div>
            );
          })()
        ) : canVerify ? (
          /* review notes for the verifier; the verify, return and reject actions are in the drawer footer */
          <div className="map-drawer-card mt-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.95rem' }}>
                  Review
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Check the extracted fields, then verify, return, or reject.
                </div>
              </div>
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
                Pending Approval
              </span>
            </div>

            {isSubmitter && !isVerified && (
              <div className="alert alert-warning d-flex align-items-center gap-2 mb-3 py-2 px-3 border border-warning font-mono-code" style={{ fontSize: '0.775rem' }}>
                <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                <div>
                  <strong>Segregation of Duties:</strong> You submitted this document, so you cannot verify or approve it. A verifier or the client must review it.
                </div>
              </div>
            )}

            {/* justification & feedback notes field */}
            {canVerify && (
              <div>
                <label className="map-drawer-label" htmlFor="review-notes">
                  Notes
                </label>
                <textarea
                  id="review-notes"
                  ref={notesRef}
                  className={`form-control bg-white text-dark border p-3 ${commentError ? 'border-danger' : ''}`}
                  rows={2}
                  placeholder="Required to return or reject. Optional to verify."
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (commentError && e.target.value.trim()) setCommentError('');
                  }}
                  style={{ fontSize: '0.825rem', borderRadius: '6px' }}
                />
                {commentError && (
                  <div className="text-danger small mt-1">{commentError}</div>
                )}
              </div>
            )}

          </div>
        ) : null}
      </Drawer>

      {/* Master Document Upload & Replacement Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        existingDocument={document}
        onUploadComplete={() => {
          setIsUploadModalOpen(false);
          onClose();
        }}
      />
    </>
  );
};

