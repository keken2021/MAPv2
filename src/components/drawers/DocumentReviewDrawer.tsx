/* 
  file summary: extraction review drawer matching exact mockup layout with document scan preview, OCR confidence scores, and action banner.
  responsibilities: presents OCR extraction review with confidence threshold progress bars, quality indicators, and verifier action controls.
  role in system: invoked from verifier workspace, document detail view, or requirements register.
*/

import React, { useEffect, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { MasterDocument } from '../../types/document';
import { DocumentUploadModal } from './DocumentUploadModal';
import { Check, AlertCircle } from 'lucide-react';

interface DocumentReviewDrawerProps {
  document: MasterDocument | null;
  requirementNotes?: string;
  onClose: () => void;
}

interface ExtractedAttribute {
  id: string;
  label: string;
  value: string;
  confidence: number;
  isMandatoryMissing?: boolean;
}

/**
  what: renders extraction review modal drawer matching exact mockup layout.
  how: displays document metadata header, scanned page preview box with quality checks, OCR extracted attributes with progress bars, and exception action banner.
  with what file: src/components/drawers/DocumentReviewDrawer.tsx loaded by VerifierWorkspaceView.tsx and AssuranceDetailView.tsx.
*/
export const DocumentReviewDrawer: React.FC<DocumentReviewDrawerProps> = ({ document, requirementNotes, onClose }) => {
  const { verifyDocument, activePersona, assuranceSets } = useMapStore();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
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
  const canSubmit = activePersona === 'Submitter' || activePersona === 'Administrator';
  const canVerify = activePersona === 'Verifier';

  const requireComment = () => {
    if (!comment.trim()) {
      setCommentError('Defect comments are required when returning or rejecting a document.');
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
      { id: '1', label: 'CREW MEMBER NAME', value: document.crewAttributes.crewName || 'A. Mendoza', confidence: isReuploaded ? 98 : 91 },
      { id: '2', label: 'CREW ID / PASSPORT NUMBER', value: isReuploaded ? (document.crewAttributes.passportId || 'P9912447') : `${document.crewAttributes.passportId || 'P9912447'} (partially legible)`, confidence: isReuploaded ? 98 : 61 },
      { id: '3', label: 'RANK / ROLE', value: document.crewAttributes.rank || 'Able Seafarer', confidence: isReuploaded ? 97 : 88 },
      { id: '4', label: 'CERTIFICATE TYPE', value: document.title || 'Medical Fitness Certificate', confidence: isReuploaded ? 99 : 94 },
      { id: '5', label: 'ISSUING AUTHORITY', value: isReuploaded ? (document.issuingAuthority || 'AMSA (Verified Seal)') : `${document.issuingAuthority || 'illegible stamp'}`, confidence: isReuploaded ? 97 : 44 },
      { id: '6', label: 'ISSUE DATE', value: '2024-11-02', confidence: isReuploaded ? 98 : 79 },
      { id: '7', label: 'EXPIRY DATE', value: '2026-10-29', confidence: isReuploaded ? 99 : 86 },
      { id: '8', label: 'VESSEL ASSIGNMENT', value: 'MV Torrens Supporter', confidence: isReuploaded ? 98 : 72 },
      { id: '9', label: 'NATIONALITY', value: 'Philippines', confidence: isReuploaded ? 98 : 90 },
      { id: '10', label: 'TRAINING COMPLETION DATE', value: isReuploaded ? '2024-10-15' : 'not present', confidence: isReuploaded ? 96 : 0, isMandatoryMissing: isReuploaded ? false : true },
    ]
    : [
      { id: '1', label: 'CERTIFICATE NUMBER', value: document.certificateNo || 'CERT-99412', confidence: isReuploaded ? 99 : 94 },
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
      comment.trim() || 'Verified extracted document attributes.',
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



  return (
    <>
      <div className="map-modal-backdrop" onClick={onClose} style={{ zIndex: 1040 }} />
      <div
        className="offcanvas offcanvas-end show bg-white text-dark border-start shadow-lg"
        style={{ width: '92vw', maxWidth: '1240px', visibility: 'visible', zIndex: 1050 }}
        tabIndex={-1}
      >
        {/* drawer header: red category accent bar, document title, and overall confidence score */}
        <div className="offcanvas-header border-bottom p-4 bg-white d-flex align-items-start justify-content-between">
          <div>
            <div className="map-extraction-header-accent" />
            <h4 className="offcanvas-title fw-bold text-dark m-0 mb-1" style={{ fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
              {document.title}
            </h4>
            <div className="font-mono-code small" style={{ fontSize: '0.775rem', color: '#94a3b8' }}>
              {document.title.toLowerCase().replace(/\s+/g, '-')}-scan.jpg · 640 KB · 1 page · {document.currentVersion}
            </div>
          </div>

          <div className="d-flex align-items-center gap-4">
            <div className="text-end">
              <div className="fw-bold lh-1" style={{ fontSize: '1.75rem', color: overallConfidence >= 90 ? '#059669' : '#c2410c' }}>
                {overallConfidence}%
              </div>
              <div className="small lh-sm text-muted" style={{ fontSize: '0.675rem' }}>
                overall confidence<br />threshold 90%
              </div>
            </div>
            <button type="button" className="btn-close ms-2" onClick={onClose} aria-label="Close" />
          </div>
        </div>

        {/* drawer body */}
        <div className="offcanvas-body p-4 d-flex flex-column justify-between" style={{ backgroundColor: '#fcfcfd' }}>
          <div className="row g-4 mb-4">
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
                <div className="font-mono-code text-uppercase text-muted small fw-bold" style={{ fontSize: '0.725rem', letterSpacing: '0.08em' }}>
                  SCANNED PAGE
                </div>
                <div className="font-mono-code text-muted small mt-1" style={{ fontSize: '0.725rem' }}>
                  1 of 1 · 240 DPI
                </div>
                <div
                  className="mt-3 px-2 py-1 rounded border font-mono-code fw-semibold"
                  style={{
                    fontSize: '0.7rem',
                    backgroundColor: overallConfidence >= 90 ? '#dcfce7' : '#ffedd5',
                    color: overallConfidence >= 90 ? '#15803d' : '#c2410c',
                  }}
                >
                  OCR {overallConfidence}% · {overallConfidence >= 90 ? 'High Fidelity' : 'Human Review'}
                </div>
              </div>

              {/* quality checks list */}
              <div className="d-flex flex-column gap-2 mt-2 p-2 bg-light rounded border">
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
                  <span className="ps-0.5 text-dark fw-medium">Signature / stamp present</span>
                </div>
              </div>
            </div>

            {/* right column: extracted metadata attributes & ocr confidence bars */}
            <div className="col-md-8 col-lg-9 d-flex flex-column gap-1">
              {/* Verification Notes & Audit Feedback Card */}
              {activeNotes && (
                <div className="p-3 bg-light border border-info-subtle rounded-3 mb-2.5 font-mono-code small">
                  <div className="fw-bold text-uppercase text-secondary mb-1" style={{ fontSize: '0.675rem', letterSpacing: '0.06em' }}>
                    Requirement Verification Notes & Feedback
                  </div>
                  <div className="text-dark fw-semibold" style={{ fontSize: '0.825rem' }}>
                    {activeNotes}
                  </div>
                </div>
              )}

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
                      <div className="font-mono-code text-uppercase small fw-bold mb-0.5" style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.06em' }}>
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
                        <div className="small mt-0.5 fw-bold text-success d-inline-flex align-items-center gap-1" style={{ fontSize: '0.7rem' }}>
                          <Check className="w-3 h-3 text-success" /> Manually Corrected (100% Verified)
                        </div>
                      ) : isBelowThreshold ? (
                        <div className="small mt-0.5" style={{ fontSize: '0.7rem', color: '#b45309' }}>
                          Below 90% threshold — human review required
                        </div>
                      ) : isMissing ? (
                        <div className="small mt-0.5 fw-semibold" style={{ fontSize: '0.7rem', color: '#dc2626' }}>
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
                      <div className="font-mono-code small text-muted mt-1" style={{ fontSize: '0.725rem' }}>
                        {effectiveConfidence}%
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Exception Action Banner matching design screenshot - hidden for Verifiers, only shown for Submitter / Vessel Admin roles */}
              {canSubmit && (
                <div className="map-exception-banner mt-3">
                  <div>
                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.875rem', color: '#92400e' }}>
                      Exception identified — Submitter action required
                    </div>
                    <div className="small" style={{ fontSize: '0.775rem', color: '#b45309' }}>
                      Issuing authority illegible, crew ID partially legible, training completion date absent. Replace with a clearer scan or provide a renewed certificate.
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      className={`btn btn-sm map-btn-outline-manual ${isManualEditActive ? 'is-active' : ''}`}
                      onClick={() => setIsManualEditActive(!isManualEditActive)}
                    >
                      {isManualEditActive ? 'Done Editing Fields' : 'Correct field manually'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm map-btn-orange-action"
                      onClick={() => setIsUploadModalOpen(true)}
                    >
                      Upload replacement version
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
                  className="p-4 rounded-3 d-flex flex-column gap-3 border shadow-2xs my-3"
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
                          ? 'Approvals & Readiness Review'
                          : 'Document Verification Review'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: isSetApproved ? '#166534' : '#0369a1',
                          lineHeight: '1.4',
                        }}
                      >
                        {isSetApproved
                          ? 'This statutory document has been approved and verified for compliance readiness.'
                          : 'This statutory document has been verified by the verifier and is awaiting final approver sign-off.'}
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
                        style={{ fontSize: '0.725rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}
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
            /* bottom sticky compact approvals & readiness review section - verifier role only */
            <div
              className="p-4 rounded-3 border shadow-sm my-3"
              style={{
                backgroundColor: '#f8fafc',
                borderColor: '#cbd5e1',
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.95rem' }}>
                    Document Verification & Readiness Review
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Review extracted attributes and record verification notes before verifying or returning for correction.
                  </div>
                </div>
                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
                  Pending Sign-Off
                </span>
              </div>

              {/* justification & feedback notes field */}
              <div className="mb-3.5">
                <label className="form-label text-dark small fw-semibold mb-1.5" style={{ fontSize: '0.8rem' }}>
                  Verifier Defect / Justification Notes
                </label>
                <textarea
                  className={`form-control bg-white text-dark border p-3 ${commentError ? 'border-danger' : ''}`}
                  rows={2}
                  placeholder="Required when returning for correction or rejecting. Optional for verification sign-off."
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

              <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top flex-wrap">
                {canSubmit && (
                  <button
                    type="button"
                    className="btn btn-primary text-white px-3.5 py-2 fw-bold shadow-sm"
                    style={{ fontSize: '0.8rem' }}
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    Upload Replacement Revision
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-danger px-3.5 py-2 fw-bold shadow-sm"
                  style={{ fontSize: '0.8rem' }}
                  onClick={handleReject}
                >
                  Reject Document
                </button>
                <button
                  type="button"
                  className="btn text-dark px-3.5 py-2 fw-bold shadow-sm"
                  style={{ fontSize: '0.8rem', backgroundColor: '#fef3c7', borderColor: '#fde68a' }}
                  onClick={handleCorrection}
                >
                  Return for Correction
                </button>
                <button
                  type="button"
                  className="btn btn-success text-white px-3.5 py-2 fw-bold shadow-sm"
                  style={{ fontSize: '0.8rem', backgroundColor: '#059669', borderColor: '#059669' }}
                  onClick={handleVerify}
                >
                  Verify Document
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

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

