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
import { isAssuranceSetCreatedByCAdmin } from '../../utils/rbacHelpers';
import { getDocumentReuploadBlockReason } from '../../utils/documentRenewalHelpers';
import { Drawer } from './Drawer';
import { DocumentCertificatePreview } from '../common/DocumentCertificatePreview';
import type { VerificationMethod } from '../../types/assurance';
import {
  VERIFICATION_METHODS,
  VERIFICATION_SCOPE_STATEMENT,
  getFieldChecks,
  getVerifyBlockReasons,
  type FieldCheck,
  type FieldCheckKey,
  type FieldCheckState,
} from '../../utils/verificationPolicy';

/* text colour of a field check line: green pass, amber warning, red fail, grey not checked */
const FIELD_CHECK_COLORS: Record<FieldCheckState, string> = {
  pass: '#047857',
  warn: '#b45309',
  fail: '#dc2626',
  not_checked: '#64748b',
  info: '#64748b',
};
import { getInspectionValidUntil } from '../../utils/inspectionEvidence';
import { maskRestrictedValue } from '../../utils/restrictedData';

interface DocumentReviewDrawerProps {
  document: MasterDocument | null;
  requirementNotes?: string;
  onClose: () => void;
  /* false when the caller's assurance set does not grant the active persona submit actions */
  allowSubmit?: boolean;
  /* false when the caller's assurance set does not grant the active persona verify actions */
  allowVerify?: boolean;
  /* the requirement this review was opened from; its own status decides whether Verify is still offered */
  requirementId?: string;
  requirementVerifierStatus?: string;
  /* the set the review was opened from; without it the first set using the document is taken */
  assuranceSetId?: string;
  /* true when the document is pinned to the version an approved set was approved against: no new version, no reupload */
  isVersionLocked?: boolean;
}

interface ExtractedAttribute {
  id: string;
  label: string;
  value: string;
  confidence: number;
  isMandatoryMissing?: boolean;
  /* the check that belongs to this field, shown under it */
  check?: FieldCheck;
}

/**
  what: renders extraction review drawer matching exact mockup layout.
  how: displays document metadata header, scanned page preview box with quality checks, OCR extracted attributes with progress bars, and exception action banner.
  with what file: src/components/drawers/DocumentReviewDrawer.tsx loaded by VerifierWorkspaceView.tsx and AssuranceDetailView.tsx.
*/
export const DocumentReviewDrawer: React.FC<DocumentReviewDrawerProps> = ({ document, requirementNotes, onClose, allowSubmit = true, allowVerify = true, requirementId, requirementVerifierStatus, assuranceSetId, isVersionLocked = false }) => {
  const { verifyDocument, requestDocumentReupload, activePersona, assuranceSets, notifications } = useMapStore();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  /* the notes field takes focus when a footer action needs notes, so the error is in view */
  const notesRef = useRef<HTMLTextAreaElement>(null);
  /* manual inline field editing state */
  const [isManualEditActive, setIsManualEditActive] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [correctedFieldIds, setCorrectedFieldIds] = useState<Set<string>>(new Set());
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  /* how the verifier confirmed the document, and the reason for verifying past a failed check */
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod | ''>('');
  const [isOverrideActive, setIsOverrideActive] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const openedFromSet = assuranceSetId ? assuranceSets.find((set) => set.id === assuranceSetId) : undefined;
  /* the set is the one the review was opened from, or the set that holds the requirement; never a guess by title or vessel */
  const linkedSet = openedFromSet || (document
    ? assuranceSets.find((set) =>
      requirementId
        ? set.requirements?.some((req) => req.id === requirementId)
        : set.requirements?.some((req) => req.documentId === document.id || req.linkedDocumentId === document.id)
    )
    : undefined);

  useEffect(() => {
    if (!document) return;
    setComment('');
    setCommentError('');
    setIsManualEditActive(false);
    setEditedValues({});
    setCorrectedFieldIds(new Set());
    setVerificationMethod('');
    setIsOverrideActive(false);
    setOverrideReason('');
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

  const linkedReq = linkedSet?.requirements?.find((req) =>
    requirementId ? req.id === requirementId : req.documentId === document.id || req.linkedDocumentId === document.id
  );
  /* a decision is made on one requirement of one set; opened without one, the drawer only shows the document on file */
  const reviewedSetId = requirementId ? linkedSet?.id : undefined;
  const hasReviewContext = Boolean(requirementId && reviewedSetId);
  /* verified here means verified on this requirement; the same document verified on another set does not count */
  const isVerified = hasReviewContext
    ? (requirementVerifierStatus ?? linkedReq?.verifierStatus) === 'Verified'
    : false;
  const decisionsClosed = isVerified;

  const isSubmitter = isUserDocumentSubmitter(
    null,
    activePersona,
    document,
    linkedReq,
    linkedSet
  );

  /* a version locked on an approved set takes no new upload */
  const canSubmit = allowSubmit && !isVersionLocked && (activePersona === 'Submitter' || activePersona === 'Administrator');
  /* the client admin verifies the documents on a set a client admin created; it never edits or uploads them */
  const isClientVerifier =
    activePersona === 'C Admin' && Boolean(linkedSet) && isAssuranceSetCreatedByCAdmin(linkedSet!);
  const canVerify =
    allowVerify &&
    hasReviewContext &&
    !isSubmitter &&
    (activePersona === 'Verifier' || activePersona === 'Administrator' || isClientVerifier);
  /* a document on record is re-uploaded only once it is expired or a reviewer sent it back */
  const reuploadBlockReason = getDocumentReuploadBlockReason(document, notifications);

  const requireComment = (message = 'Notes are required to return or reject a document.') => {
    if (!comment.trim()) {
      setCommentError(message);
      notesRef.current?.focus();
      return false;
    }
    setCommentError('');
    return true;
  };

  const versions = document.versions ?? [];
  const isReuploaded = versions.length > 1 || document.currentVersion !== 'v1.0' || (document.ocrConfidence && document.ocrConfidence >= 90);
  const activeNotes = requirementNotes || document.verificationNotes || (versions.length > 0 ? versions[0].changeSummary : undefined);

  /* each check is shown under the field it belongs to, judged against the set the review was opened from */
  const fieldChecks = getFieldChecks(document, linkedSet);

  /* extracted fields come from the document record; a value the record does not hold shows as not extracted (gap review E7) */
  const NOT_EXTRACTED = 'Not extracted';
  const field = (
    id: string,
    label: string,
    value: string | undefined,
    readConfidence: number,
    firstScanConfidence: number,
    mandatory = false,
    checkKey?: FieldCheckKey,
  ): ExtractedAttribute => {
    const hasValue = Boolean(value && value.trim());
    return {
      id,
      label,
      value: hasValue ? value!.trim() : NOT_EXTRACTED,
      confidence: hasValue ? (isReuploaded ? readConfidence : firstScanConfidence) : 0,
      isMandatoryMissing: mandatory && !hasValue,
      check: checkKey ? fieldChecks[checkKey] : undefined,
    };
  };
  const crew = document.crewAttributes;
  const vessel = document.vesselAttributes;
  const extractedAttributes: ExtractedAttribute[] = crew
    ? [
      field('1', 'CREW NAME', crew.crewName, 98, 91, true),
      /* restricted identity data is shown masked to reviewers (gap review G12) */
      field('2', 'PASSPORT NUMBER', maskRestrictedValue(crew.passportId), 98, 61, true),
      field('3', 'RANK', crew.rank, 97, 88),
      field('4', 'CERTIFICATE TYPE', crew.certType || document.title, 99, 94, true),
      field('5', 'ISSUING AUTHORITY', crew.issuingCenter || document.issuingAuthority, 97, 44, true, 'issuingAuthority'),
      field('6', 'ISSUE DATE', crew.issueDate, 98, 79),
      /* the current version's expiry comes first; the certificate details can hold an older one */
      field('7', 'EXPIRY DATE', document.expiryDate || crew.expiryDate, 99, 86, true, 'expiryDate'),
      field('8', 'VESSEL', crew.assignedVessel, 98, 72),
      field('9', 'NATIONALITY', crew.nationality, 98, 90),
      field('10', 'TRAINING COMPLETION DATE', crew.trainingDate, 96, 70),
    ]
    : [
      field('1', 'CERTIFICATE NO.', document.certificateNo, 99, 94, true, 'certificateNo'),
      field('2', 'VESSEL NAME', vessel?.vesselName, 98, 91, true, 'vesselName'),
      field('3', 'IMO NUMBER', vessel?.imoNumber, 99, 88, true, 'imoNumber'),
      field('4', 'ISSUING AUTHORITY', document.issuingAuthority, 97, 65, true, 'issuingAuthority'),
      field('5', 'EXPIRY DATE', document.expiryDate, 98, 79, true, 'expiryDate'),
    ];

  /* confidence is averaged over the fields that hold a value; an empty field is flagged on its own row, not counted as 0% */
  const isAttrCorrected = (attr: ExtractedAttribute) =>
    correctedFieldIds.has(attr.id) || (editedValues[attr.id] !== undefined && editedValues[attr.id].trim() !== '' && editedValues[attr.id] !== attr.value);
  const readAttributes = extractedAttributes.filter((attr) => attr.value !== NOT_EXTRACTED || isAttrCorrected(attr));
  const totalEffectiveConfidence = readAttributes.reduce(
    (sum, attr) => sum + (isAttrCorrected(attr) ? 100 : attr.confidence),
    0,
  );
  const overallConfidence = isVerified
    ? 100
    : readAttributes.length === 0
      ? 0
      : Math.min(100, Math.round(totalEffectiveConfidence / readAttributes.length));

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
    isVerified;

  /* verify needs a method, and either every check passed or an override with a reason (gap review E6, G1) */
  const verifyBlockReasons = getVerifyBlockReasons({
    document,
    set: linkedSet,
    overallConfidence,
    fullPagePassed: isFullPagePassed,
    signaturePassed: Boolean(isSignaturePassed),
  });
  const needsOverride = verifyBlockReasons.length > 0;
  const hasOverride = isOverrideActive && overrideReason.trim().length > 0;
  const verifyDisabledReason = !verificationMethod
    ? 'Choose how you checked the document.'
    : needsOverride && !hasOverride
      ? 'A check failed. Override with a reason to verify.'
      : undefined;

  const handleVerify = () => {
    if (verifyDisabledReason || !verificationMethod) return;
    verifyDocument(
      document.id,
      'Verified',
      comment.trim() || 'Verified extracted fields.',
      undefined,
      requirementId,
      reviewedSetId,
      { verificationMethod, overrideReason: needsOverride ? overrideReason.trim() : undefined },
    );
    onClose();
  };

  const handleCorrection = () => {
    if (!requireComment()) return;
    verifyDocument(document.id, 'Correction Requested', comment.trim(), undefined, requirementId, reviewedSetId);
    onClose();
  };

  const handleReject = () => {
    if (!requireComment()) return;
    verifyDocument(document.id, 'Rejected', comment.trim(), undefined, requirementId, reviewedSetId);
    onClose();
  };

  /* asks the submitter for a new version of an outdated document; the verification status does not change */
  const handleRequestReupload = () => {
    if (!requireComment('A reason is required to request a reupload.')) return;
    requestDocumentReupload(document.id, comment.trim());
    onClose();
  };


  /* review actions sit in the drawer footer so they stay in view while the fields scroll; a verified document keeps the reupload request only */
  const showReviewActions = canVerify;

  /* justification & feedback notes field */
  const notesField = (
    <div>
      <label className="map-drawer-label" htmlFor="review-notes">
        Notes
      </label>
      <textarea
        id="review-notes"
        ref={notesRef}
        className={`form-control bg-white text-dark border p-3 ${commentError ? 'border-danger' : ''}`}
        rows={2}
        placeholder={
          decisionsClosed
            ? 'Required to request a reupload. Say why the document is outdated.'
            : 'Required to return, reject or request a reupload. Optional to verify.'
        }
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
  );

  return (
    <>
      <Drawer
        title={document.title}
        meta={`${document.title.toLowerCase().replace(/\s+/g, '-')}-scan.jpg · 640 KB · 1 page · ${document.currentVersion}${isVersionLocked ? ' · approved version, locked' : ''}`}
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsUploadModalOpen(true)}
                    disabled={Boolean(reuploadBlockReason)}
                    title={reuploadBlockReason}
                  >
                    Upload New Version
                  </button>
                )}
                {!isVersionLocked && (
                  <button type="button" className="btn btn-outline-secondary" onClick={handleRequestReupload}>
                    Request Reupload
                  </button>
                )}
                {!decisionsClosed && (
                  <>
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
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleVerify}
                      disabled={Boolean(verifyDisabledReason)}
                      title={verifyDisabledReason}
                    >
                      Verify
                    </button>
                  </>
                )}
              </div>
            </>
          ) : undefined
        }
      >
        <div className="row g-4">
          {/* left column: scanned document page preview box & quality checks */}
          <div className="col-md-5 col-lg-5 d-flex flex-column gap-3">
            <DocumentCertificatePreview document={document} compact={true} maxHeight="530px" />

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
          <div className="col-md-7 col-lg-7 d-flex flex-column gap-3">
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

            {/* the facts of an inspection report, read for this set's requirement (gap review G4) */}
            {linkedReq?.inspectionReport && (
              <div className="map-drawer-card small" style={{ fontSize: '0.8rem' }}>
                <div className="map-drawer-section-title mb-2">Inspection Report</div>
                <div className="row g-2">
                  <div className="col-6"><span className="text-secondary">Source:</span> <strong>{linkedReq.inspectionReport.source}</strong></div>
                  <div className="col-6"><span className="text-secondary">Report Date:</span> <strong className="font-mono-code">{linkedReq.inspectionReport.reportDate}</strong></div>
                  <div className="col-6">
                    <span className="text-secondary">Valid Until:</span>{' '}
                    <strong className="font-mono-code">
                      {getInspectionValidUntil(linkedReq.inspectionReport.reportDate, linkedReq.inspectionReport.validityMonths) || 'Not recorded'}
                    </strong>{' '}
                    <span className="text-muted">({linkedReq.inspectionReport.validityMonths} months)</span>
                  </div>
                  <div className="col-6">
                    <span className="text-secondary">Inspector:</span>{' '}
                    <strong>{linkedReq.inspectionReport.inspectorAccreditation || 'Accreditation not recorded'}</strong>
                  </div>
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
                        <Check className="w-3 h-3 text-success" /> Entered by hand
                      </div>
                    ) : isMissing ? (
                      <div className="small mt-0.5 fw-semibold" style={{ fontSize: '0.75rem', color: '#dc2626' }}>
                        Mandatory field missing
                      </div>
                    ) : (
                      <>
                        {/* the field's own check, so the reviewer sees which value failed */}
                        {attr.check && (
                          <div
                            className="small mt-0.5 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '0.75rem', color: FIELD_CHECK_COLORS[attr.check.state] }}
                          >
                            {attr.check.state === 'pass' ? (
                              <Check className="w-3 h-3" />
                            ) : attr.check.state === 'not_checked' ? null : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {attr.check.message}
                          </div>
                        )}
                        {isBelowThreshold && (
                          <div className="small mt-0.5" style={{ fontSize: '0.75rem', color: '#b45309' }}>
                            Below 90%. Check this field.
                          </div>
                        )}
                      </>
                    )}
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
                    {extractedAttributes.some((attr) => attr.isMandatoryMissing || (attr.confidence > 0 && attr.confidence < 90))
                      ? `Check ${extractedAttributes
                        .filter((attr) => attr.isMandatoryMissing || (attr.confidence > 0 && attr.confidence < 90))
                        .map((attr) => attr.label.toLowerCase())
                        .join(', ')}. Upload a clearer scan or enter the values.`
                      : 'Upload a clearer scan or a renewed certificate if a value is wrong.'}
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
                    disabled={Boolean(reuploadBlockReason)}
                    title={reuploadBlockReason}
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
                <div className="small" style={{ fontSize: '0.8rem', color: '#334155' }}>
                  <div>
                    <span className="fw-semibold">Method:</span> {linkedReq?.verificationMethod || 'Not recorded'}
                    {linkedReq?.verifiedVersion?.verifiedBy && (
                      <> · <span className="fw-semibold">By:</span> {linkedReq.verifiedVersion.verifiedBy}</>
                    )}
                    {linkedReq?.verifiedVersion?.verifiedAt && (
                      <> · {new Date(linkedReq.verifiedVersion.verifiedAt).toLocaleDateString()}</>
                    )}
                  </div>
                  {linkedReq?.overrideReason && (
                    <div className="mt-1">
                      <span className="fw-semibold">Override:</span> {linkedReq.overrideReason}
                    </div>
                  )}
                  <div className="text-muted mt-1">{VERIFICATION_SCOPE_STATEMENT}</div>
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
                {canVerify && notesField}
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
                  Check the extracted fields, then verify, return, or reject. Request a reupload when the document is outdated.
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

            <div className="map-drawer-inset small text-muted mb-3">{VERIFICATION_SCOPE_STATEMENT}</div>

            <div className="mb-3">
              <label className="map-drawer-label" htmlFor="review-method">
                Method <span className="text-danger">*</span>
              </label>
              <select
                id="review-method"
                className="form-select bg-white"
                value={verificationMethod}
                onChange={(e) => setVerificationMethod(e.target.value as VerificationMethod | '')}
                style={{ fontSize: '0.825rem' }}
              >
                <option value="">Choose how you checked it</option>
                {VERIFICATION_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            {needsOverride && (
              <div className="alert alert-warning py-3 px-3 mb-3" style={{ fontSize: '0.8rem' }}>
                {/* every reason names the field or scan check and what to do; the same text shows under the field */}
                <div className="fw-semibold mb-1">Verify is blocked because:</div>
                <ul className="mb-2 ps-3">
                  {verifyBlockReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <div className="mb-2">Fix these, ask the submitter for a new version, or override with a reason.</div>
                <div className="form-check">
                  <input
                    id="review-override"
                    className="form-check-input"
                    type="checkbox"
                    checked={isOverrideActive}
                    onChange={(e) => setIsOverrideActive(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="review-override">
                    Override
                  </label>
                </div>
                {isOverrideActive && (
                  <div className="mt-2">
                    <label className="map-drawer-label" htmlFor="review-override-reason">
                      Override Reason <span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="review-override-reason"
                      className="form-control bg-white"
                      rows={2}
                      placeholder="Say why the document can be verified anyway."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      style={{ fontSize: '0.825rem' }}
                    />
                  </div>
                )}
              </div>
            )}

            {notesField}

          </div>
        ) : !hasReviewContext && (activePersona === 'Verifier' || activePersona === 'C Admin' || activePersona === 'Administrator') ? (
          /* without a set requirement there is no decision to record; each set verifies the document for itself */
          <div className="map-drawer-card mt-4 small text-muted">
            Verification is recorded per assurance set. Open this document from a set's requirement to verify, return or reject it.
          </div>
        ) : null}
      </Drawer>

      {/* Master Document Upload & Replacement Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        existingDocument={document}
        assuranceSetId={reviewedSetId}
        requirementId={hasReviewContext ? requirementId : undefined}
        onUploadComplete={() => {
          setIsUploadModalOpen(false);
          onClose();
        }}
      />
    </>
  );
};

