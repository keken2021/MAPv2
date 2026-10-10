/* 
  file summary: master document upload & replacement modal form for submitting statutory certificates in light theme with AI information extraction.
  responsibilities: captures document title and entity type, supports file uploading with simulated AI OCR metadata extraction (certificate number, issuing authority, expiry date), and dispatches store actions.
  role in system: invoked from DocumentLibraryView, DocumentReviewDrawer, and AssuranceDetailView for document creation and submitter revision re-uploads.
*/

import React, { useState, useEffect, useRef } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { MasterDocument, DocumentEntityType } from '../../types/document';
import { formatDocumentId } from '../../utils/formatters';
import { Upload, Check, AlertCircle, X } from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingDocument?: MasterDocument | null;
  onUploadComplete?: () => void;
  /** When uploading from an assurance set requirement row (demo mock link). */
  assuranceSetId?: string;
  requirementId?: string;
  requirementTitle?: string;
  defaultVesselId?: string;
  modalTitle?: string;
}

/**
  what: renders document upload / re-upload modal with file picker and simulated AI metadata extraction.
  how: pre-populates metadata if existingDocument is passed, simulates AI extraction upon file attach for new uploads, and populates extracted certificate attributes automatically into the form.
  with what file: src/components/modals/DocumentUploadModal.tsx loaded by DocumentLibraryView.tsx and DocumentReviewDrawer.tsx.
*/
export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  existingDocument,
  onUploadComplete,
  assuranceSetId,
  requirementId,
  requirementTitle,
  defaultVesselId,
  modalTitle,
}) => {
  const { vessels, documents, addDocument, uploadDocumentForRequirement, addDocumentVersion, verifyDocument, activePersona } =
    useMapStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [entityType, setEntityType] = useState<DocumentEntityType>('Vessel Certificate');
  const [vesselId, setVesselId] = useState('');
  const [certificateNo, setCertificateNo] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [expiryDate, setExpiryDate] = useState('2029-06-30');
  const [fileName, setFileName] = useState('');
  const [changeSummary, setChangeSummary] = useState('');

  /* tracks which right-column form field ids are playing the ocr autofill shimmer */
  const [animatingFields, setAnimatingFields] = useState<Set<string>>(new Set());

  /* simulated AI extraction states */
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [isAiExtracted, setIsAiExtracted] = useState(false);
  const [isNewExtractionAnimate, setIsNewExtractionAnimate] = useState(false);
  const [aiOcrConfidence, setAiOcrConfidence] = useState(99.2);

  /* manual inline field editing state */
  const [isManualEditActive, setIsManualEditActive] = useState(false);
  const [correctedFields, setCorrectedFields] = useState<Set<string>>(new Set());
  const [revealedFields, setRevealedFields] = useState<{ certNo: boolean; authority: boolean; expiry: boolean; summary: boolean }>({
    certNo: true,
    authority: true,
    expiry: true,
    summary: true,
  });

  /* simulated upload state */
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPendingVerification, setIsPendingVerification] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [uploadOption, setUploadOption] = useState<'new_file' | 'unassigned_doc'>('new_file');
  const [selectedUnassignedDocId, setSelectedUnassignedDocId] = useState<string>('');

  /* filter unassigned master documents available in library to link to requirement */
  const unassignedDocuments = documents.filter((doc) => {
    if (vesselId && doc.vesselId && doc.vesselId !== vesselId) return false;
    return true;
  });

  /*
    what: triggers brief shimmer sweep across newly extracted or populated form fields.
    how: populates animatingFields set and clears each field after 800ms.
    with what file: src/components/modals/DocumentUploadModal.tsx.
  */
  const triggerAutofillAnimation = (fieldIds: string[]) => {
    fieldIds.forEach((id) => {
      setAnimatingFields((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setAnimatingFields((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 850);
    });
  };

  /*
    what: handles selecting an existing unassigned document from the document library.
    how: populates certificate metadata fields and prepares document linking for assurance requirement.
    with what file: src/components/modals/DocumentUploadModal.tsx.
  */
  const handleSelectUnassignedDoc = (docId: string) => {
    setSelectedUnassignedDocId(docId);
    const found = documents.find((d) => d.id === docId);
    if (found) {
      setTitle(found.title);
      setEntityType(found.entityType);
      if (found.vesselId) setVesselId(found.vesselId);
      setCertificateNo(found.certificateNo);
      setIssuingAuthority(found.issuingAuthority);
      setExpiryDate(found.expiryDate);
      setFileName(found.versions[0]?.fileName || `${found.title}.pdf`);
      setIsAiExtracted(true);
      setIsNewExtractionAnimate(true);
      setAiOcrConfidence(found.ocrConfidence || 99.2);
      setRevealedFields({ certNo: true, authority: true, expiry: true, summary: true });
      triggerAutofillAnimation(['doc-title', 'doc-cert-no', 'doc-issuing-authority', 'doc-expiry-date', 'doc-vessel']);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setUploadOption('new_file');
      setSelectedUnassignedDocId('');
      setIsNewExtractionAnimate(false);
      setHasAttemptedSubmit(false);
      setErrorMessage('');
      if (existingDocument) {
        setTitle(existingDocument.title);
        setEntityType(existingDocument.entityType);
        setVesselId(existingDocument.vesselId);
        setCertificateNo(existingDocument.certificateNo);
        setIssuingAuthority(existingDocument.issuingAuthority);
        setExpiryDate(existingDocument.expiryDate);
        setFileName(
          existingDocument.versions[0]?.fileName ||
          `${existingDocument.title.replace(/\s+/g, '_')}_Rev.pdf`
        );
        setChangeSummary('New version uploaded by submitter.');
        setIsAiExtracted(true);
        setAiOcrConfidence(existingDocument.ocrConfidence || 98.5);
      } else {
        setTitle(requirementTitle || '');
        setEntityType('Vessel Certificate');
        setVesselId(defaultVesselId || '');
        setCertificateNo('');
        setIssuingAuthority('');
        setExpiryDate('2029-06-30');
        setFileName('');
        setChangeSummary(
          requirementTitle ? `Initial upload for assurance requirement: ${requirementTitle}.` : '',
        );
        setIsAiExtracted(false);
        setAiOcrConfidence(99.2);
      }
      setIsExtractingAi(false);
      setIsUploading(false);
      setUploadProgress(0);
      setStatusMessage('');
      setIsDraggingOver(false);
      setIsPendingVerification(false);
      setRevealedFields({ certNo: false, authority: false, expiry: false, summary: false });
    }
  }, [isOpen, existingDocument, vessels, requirementTitle, defaultVesselId]);

  if (!isOpen) return null;

  const canUpload = activePersona === 'Administrator' || activePersona === 'Submitter';

  /*
    what: handles file attachment selection and stages document for user verification before AI extraction.
    how: sets fileName state and enables isPendingVerification preview gate.
    with what file: src/components/modals/DocumentUploadModal.tsx.
  */
  const handleSelectFileForPreview = (selectedName: string) => {
    setFileName(selectedName);
    setIsPendingVerification(true);
    setIsAiExtracted(false);
    setIsExtractingAi(false);
  };

  const handleConfirmVerifyAndExtract = () => {
    setIsPendingVerification(false);
    triggerAiExtraction(fileName);
  };

  /*
    what: handles drag and drop file interactions.
    how: tracks dragover, dragleave, and drop events to trigger file preview verification.
    with what file: src/components/modals/DocumentUploadModal.tsx.
  */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading && !isExtractingAi) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (isUploading || isExtractingAi) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      handleSelectFileForPreview(droppedFile.name);
    }
  };

  /*
    what: simulates AI information extraction when a file is uploaded or selected.
    how: sets loading state, extracts certificate number, issuing authority, expiry date, and OCR confidence, and automatically populates form state.
    with what file: src/components/modals/DocumentUploadModal.tsx.
  */
  const triggerAiExtraction = (selectedName: string) => {
    setFileName(selectedName);
    setIsExtractingAi(true);
    setIsAiExtracted(false);
    setRevealedFields({ certNo: false, authority: false, expiry: false, summary: false });

    const generatedCertNo = `DNV-STAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const selectedVesselObj = vessels.find((v) => v.id === vesselId);
    const authority = selectedVesselObj?.classificationSociety
      ? `${selectedVesselObj.classificationSociety} Classification Society`
      : 'DNV Classification Society';

    /* step 1: complete ai scan after 1100ms then reveal fields with staggered delays */
    setTimeout(() => {
      setIsExtractingAi(false);
      setIsAiExtracted(true);
      setIsNewExtractionAnimate(true);
      setAiOcrConfidence(99.2);

      /* stagger 1: certificate number — add shimmer, remove after 750ms */
      setTimeout(() => {
        setCertificateNo(generatedCertNo);
        setRevealedFields((prev) => ({ ...prev, certNo: true }));
        setAnimatingFields((prev) => new Set(prev).add('doc-cert-no'));
        setTimeout(() => setAnimatingFields((prev) => { const n = new Set(prev); n.delete('doc-cert-no'); return n; }), 750);
      }, 120);

      /* stagger 2: issuing authority — add shimmer, remove after 750ms */
      setTimeout(() => {
        setIssuingAuthority(authority);
        setRevealedFields((prev) => ({ ...prev, authority: true }));
        setAnimatingFields((prev) => new Set(prev).add('doc-issuing-authority'));
        setTimeout(() => setAnimatingFields((prev) => { const n = new Set(prev); n.delete('doc-issuing-authority'); return n; }), 750);
      }, 420);

      /* stagger 3: expiry date — add shimmer, remove after 750ms */
      setTimeout(() => {
        setExpiryDate('2029-06-30');
        setRevealedFields((prev) => ({ ...prev, expiry: true }));
        setAnimatingFields((prev) => new Set(prev).add('doc-expiry-date'));
        setTimeout(() => setAnimatingFields((prev) => { const n = new Set(prev); n.delete('doc-expiry-date'); return n; }), 750);
      }, 720);

      /* stagger 4: revision summary */
      setTimeout(() => {
        setRevealedFields((prev) => ({ ...prev, summary: true }));
      }, 980);
    }, 1100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleSelectFileForPreview(selectedFile.name);
    }
  };

  const handleSampleFileClick = (sampleName: string) => {
    handleSelectFileForPreview(sampleName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    if (!canUpload || !title.trim()) return;

    const finalCertNo = certificateNo.trim() || `DNV-STAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalAuthority = issuingAuthority.trim() || 'DNV Classification Society';
    const finalExpiry = expiryDate || '2029-06-30';

    /* start simulated upload sequence */
    setIsUploading(true);
    setUploadProgress(15);
    setStatusMessage('Reading document byte stream and preparing secure payload...');

    setTimeout(() => {
      setUploadProgress(45);
      setStatusMessage('Uploading document bytes to secure maritime vault...');
    }, 350);

    setTimeout(() => {
      setUploadProgress(80);
      setStatusMessage('Verifying AI extracted attributes and validating IACS authority...');
    }, 750);

    setTimeout(() => {
      setUploadProgress(100);
      setStatusMessage('Upload complete! Registering document audit trail...');
    }, 1150);

    setTimeout(() => {
      const finalFileName = fileName.trim() || `${title.replace(/\s+/g, '_')}_document.pdf`;

      if (existingDocument) {
        const nextVerLabel = `v1.${existingDocument.versions.length + 1}`;
        addDocumentVersion(
          existingDocument.id,
          nextVerLabel,
          finalFileName,
          2400000,
          changeSummary.trim() || 'New version uploaded.'
        );
        verifyDocument(existingDocument.id, 'Pending', 'New version submitted.');
      } else {
        const targetVesselObj = vesselId ? vessels.find((v) => v.id === vesselId) : undefined;
        const entityPrefix = entityType === 'Crew Certificate' ? 'CRW' : vesselId ? 'VES' : 'DOC';
        const categoryCode = entityType === 'Crew Certificate' ? 'STCW' : vesselId ? 'STAT' : 'UNAS';
        const newDoc: MasterDocument = {
          id: formatDocumentId(entityPrefix, 2026, categoryCode),
          title,
          entityType,
          vesselId: vesselId || defaultVesselId || '',
          certificateNo: finalCertNo,
          issuingAuthority: finalAuthority,
          expiryDate: finalExpiry,
          ocrConfidence: aiOcrConfidence || 99,
          complianceState: 'Valid',
          currentVersion: 'v1.0',
          versions: [
            {
              versionLabel: 'v1.0',
              uploadedAt: new Date().toISOString(),
              uploadedBy: 'Ops Submitter',
              fileSizeBytes: 2100000,
              fileName: finalFileName,
              changeSummary: changeSummary.trim() || 'Initial Master Document submission with AI extracted metadata.',
            },
          ],
          vesselAttributes:
            entityType === 'Vessel Certificate'
              ? {
                title,
                certificateNumber: finalCertNo,
                certType: 'Statutory Certificate',
                issuingBody: finalAuthority,
                issueDate: '2024-01-01',
                expiryDate: finalExpiry,
                vesselName: targetVesselObj?.name || '',
                imoNumber: targetVesselObj?.imoNumber || '',
                flagState: 'Australia',
                assetMatchFlag: true,
                lastSurveyDate: '2025-06-01',
                ocrConfidence: aiOcrConfidence || 99,
                status: 'Valid',
              }
              : undefined,
          validationRules: {
            charterBufferPassed: true,
            assetMatch100Percent: true,
            iacsAuthorityValid: true,
            overallValid: true,
          },
          verificationStatus: 'Pending',
        };
        if (selectedUnassignedDocId) {
          const chosenDoc = documents.find((d) => d.id === selectedUnassignedDocId);
          if (chosenDoc) {
            if (assuranceSetId) {
              uploadDocumentForRequirement(assuranceSetId, requirementId, chosenDoc);
            }
          }
        } else if (assuranceSetId) {
          uploadDocumentForRequirement(assuranceSetId, requirementId, newDoc);
        } else {
          addDocument(newDoc);
        }
      }

      setIsUploading(false);
      if (onUploadComplete) onUploadComplete();
      onClose();
    }, 1500);
  };

  /* extraction review is rendered only after ai ocr scan animation is completed */
  const hasExtractedSpecs = Boolean(isAiExtracted || (existingDocument && fileName));

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      style={{ zIndex: 1060 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading && !isExtractingAi) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered transition-all" style={{ maxWidth: hasExtractedSpecs ? '1180px' : '620px', width: '95%' }}>
        <div className="modal-content bg-white text-dark border shadow-lg">
          {/* hidden native file input */}
          <input
            type="file"
            ref={fileInputRef}
            className="d-none"
            onChange={handleFileChange}
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          />

          <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3 position-relative">
            <h5 className="modal-title fw-bold text-slate-900 m-0">
              {modalTitle
                ? modalTitle
                : existingDocument
                  ? `Upload New Version — ${existingDocument.title}`
                  : requirementTitle
                    ? `Upload Document — ${requirementTitle}`
                    : assuranceSetId
                      ? 'Upload Document'
                      : 'Upload Preassurance Document'}
            </h5>
            <button
              type="button"
              className="btn-close ms-auto"
              onClick={onClose}
              aria-label="Close"
              disabled={isUploading || isExtractingAi}
            />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {/* Simulated Upload Progress Bar */}
              {isUploading && (
                <div className="p-3 mb-4 bg-light border border-primary rounded shadow-2xs">
                  <div className="d-flex align-items-center justify-content-between mb-1.5">
                    <span className="fw-bold text-primary small d-flex align-items-center gap-2">
                      <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
                      Uploading...
                    </span>
                    <span className="font-mono-code fw-bold text-primary small">{uploadProgress}%</span>
                  </div>
                  <div className="progress mb-2" style={{ height: '8px' }}>
                    <div
                      className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                      role="progressbar"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="font-mono-code text-muted small" style={{ fontSize: '0.75rem' }}>
                    {statusMessage}
                  </div>
                </div>
              )}

              {/* Dynamic Column Layout Container */}
              <div className="row g-4">
                {/* Column 1 (Left): Extraction Review Screen (shown dynamically only when extract specs & verify is clicked) */}
                {hasExtractedSpecs && (
                  <div className="col-lg-7 col-md-6 border-end pe-md-4">
                    <div className="map-extraction-preview-container p-4 h-100 d-flex flex-column justify-between">
                      <div>
                        {/* Subtitle & Confidence Indicator */}
                        <div className="d-flex flex-wrap align-items-start justify-content-between mb-3 border-bottom pb-3">
                          <div>
                            <div className="font-mono-code text-uppercase text-muted small fw-bold mb-0.5" style={{ fontSize: '0.675rem', letterSpacing: '0.08em' }}>
                              REVIEW
                            </div>
                            <h5 className="fw-bold text-dark m-0 mb-1" style={{ fontSize: '1.15rem' }}>
                              {title || existingDocument?.title || 'International Oil Pollution Prevention (IOPP)'}
                            </h5>
                            <div className="font-mono-code text-muted small" style={{ fontSize: '0.75rem' }}>
                              {(fileName || existingDocument?.versions[0]?.fileName || 'iopp-annex1-scan.jpg')} · 640 KB · 1 page
                            </div>
                          </div>

                          {(() => {
                            const certNoScore = correctedFields.has('certNo') ? 100 : (certificateNo && certificateNo.trim() !== '' && !certificateNo.includes('partially legible') ? 98 : 61);
                            const authorityScore = correctedFields.has('authority') ? 100 : (issuingAuthority && issuingAuthority.trim() !== '' && !issuingAuthority.includes('illegible') ? 97 : 44);
                            const expiryScore = correctedFields.has('expiry') ? 100 : (expiryDate && expiryDate.trim() !== '' ? 98 : 79);
                            const titleScore = 91;
                            const dynamicScore = correctedFields.size >= 3
                              ? 100
                              : Math.min(100, Math.round((titleScore + certNoScore + authorityScore + expiryScore) / 4));
                            const isFullPageCaptured = certNoScore >= 90 && expiryScore >= 90;
                            const isSignaturePresent = authorityScore >= 90;

                            return (
                              <div className="text-end">
                                <div className="fw-bold lh-1" style={{ fontSize: '1.65rem', color: dynamicScore >= 90 ? '#059669' : '#c2410c' }}>
                                  {dynamicScore}%
                                </div>
                                <div className="small lh-sm text-muted" style={{ fontSize: '0.65rem' }}>
                                  overall confidence<br />threshold 90%
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {(() => {
                          const certNoScore = correctedFields.has('certNo') ? 100 : (certificateNo && certificateNo.trim() !== '' && !certificateNo.includes('partially legible') ? 98 : 61);
                          const authorityScore = correctedFields.has('authority') ? 100 : (issuingAuthority && issuingAuthority.trim() !== '' && !issuingAuthority.includes('illegible') ? 97 : 44);
                          const expiryScore = correctedFields.has('expiry') ? 100 : (expiryDate && expiryDate.trim() !== '' ? 98 : 79);
                          const titleScore = 91;
                          const dynamicScore = correctedFields.size >= 3
                            ? 100
                            : Math.min(100, Math.round((titleScore + certNoScore + authorityScore + expiryScore) / 4));
                          const isFullPageCaptured = certNoScore >= 90 && expiryScore >= 90;
                          const isSignaturePresent = authorityScore >= 90;

                          return (
                            <div className="row g-3 mb-3">
                              {/* Thumbnail + Quality Checks */}
                              <div className="col-md-4 d-flex flex-column gap-2">
                                <div
                                  className="p-3 border rounded-3 text-center d-flex flex-column align-items-center justify-content-center bg-white shadow-2xs"
                                  style={{
                                    borderStyle: 'dashed',
                                    borderColor: dynamicScore >= 90 ? '#86efac' : '#cbd5e1',
                                    minHeight: '180px',
                                    background: dynamicScore >= 90 ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' : '#ffffff',
                                  }}
                                >
                                  <div className="font-mono-code text-uppercase text-muted small fw-bold" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>
                                    SCANNED PAGE
                                  </div>
                                  <div className="font-mono-code text-muted small mt-1" style={{ fontSize: '0.7rem' }}>
                                    1 of 1 · 240 DPI
                                  </div>
                                  <div
                                    className="mt-2.5 px-2 py-0.5 rounded border font-mono-code fw-semibold"
                                    style={{
                                      fontSize: '0.65rem',
                                      backgroundColor: dynamicScore >= 90 ? '#dcfce7' : '#ffedd5',
                                      color: dynamicScore >= 90 ? '#15803d' : '#c2410c',
                                    }}
                                  >
                                    OCR {dynamicScore}%
                                  </div>
                                </div>

                                <div className="d-flex flex-column gap-2 mt-2 p-2 bg-light rounded border">
                                  <div className={`${isNewExtractionAnimate ? 'map-criteria-item-1' : ''} d-flex align-items-center gap-2 small`} style={{ fontSize: '0.725rem', color: '#475569' }}>
                                    <span className="d-flex align-items-center justify-content-center rounded text-white fw-bold bg-success flex-shrink-0" style={{ width: '18px', height: '18px' }}>
                                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                    </span>
                                    <span className="ps-0.5 text-dark fw-medium">Resolution 240 DPI</span>
                                  </div>
                                  <div className={`${isNewExtractionAnimate ? 'map-criteria-item-2' : ''} d-flex align-items-center gap-2 small`} style={{ fontSize: '0.725rem', color: '#475569' }}>
                                    <span
                                      className="d-flex align-items-center justify-content-center rounded text-white fw-bold flex-shrink-0"
                                      style={{ width: '18px', height: '18px', backgroundColor: isFullPageCaptured ? '#059669' : '#c2410c' }}
                                    >
                                      {isFullPageCaptured ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : <AlertCircle className="w-3 h-3 text-white" />}
                                    </span>
                                    <span className="ps-0.5 text-dark fw-medium">Full page captured</span>
                                  </div>
                                  <div className={`${isNewExtractionAnimate ? 'map-criteria-item-3' : ''} d-flex align-items-center gap-2 small`} style={{ fontSize: '0.725rem', color: '#475569' }}>
                                    <span
                                      className="d-flex align-items-center justify-content-center rounded text-white fw-bold flex-shrink-0"
                                      style={{ width: '18px', height: '18px', backgroundColor: isSignaturePresent ? '#059669' : '#c2410c' }}
                                    >
                                      {isSignaturePresent ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : <AlertCircle className="w-3 h-3 text-white" />}
                                    </span>
                                    <span className="ps-0.5 text-dark fw-medium">Signature or stamp present</span>
                                  </div>
                                </div>
                              </div>

                              {/* Extracted Attributes List matching screenshot */}
                              <div className="col-md-8 d-flex flex-column gap-1">
                                {/* Certificate Title */}
                                <div className="map-extraction-field-row py-1">
                                  <div className="d-flex flex-column flex-grow-1 me-2">
                                    <div className="font-mono-code text-uppercase small fw-bold mb-0.5" style={{ fontSize: '0.6rem', color: '#64748b' }}>
                                      CERTIFICATE TITLE
                                    </div>
                                    <div className="font-mono-code fw-bold text-dark small">
                                      {title || 'International Oil Pollution Prevention (IOPP)'}
                                    </div>
                                  </div>
                                  <div className="d-flex flex-column align-items-end flex-shrink-0" style={{ width: '80px' }}>
                                    <div className="font-mono-code small text-success fw-bold" style={{ fontSize: '0.7rem' }}>{titleScore}%</div>
                                  </div>
                                </div>

                                {/* Certificate Number / Crew ID */}
                                <div className="map-extraction-field-row py-1">
                                  <div className="d-flex flex-column flex-grow-1 me-2">
                                    <div className="font-mono-code text-uppercase small fw-bold mb-0.5" style={{ fontSize: '0.6rem', color: '#64748b' }}>
                                      PASSPORT NUMBER
                                    </div>
                                    {isManualEditActive ? (
                                      <input
                                        type="text"
                                        className="map-extraction-field-input"
                                        value={certificateNo}
                                        onChange={(e) => {
                                          setCertificateNo(e.target.value);
                                          setCorrectedFields((prev) => new Set(prev).add('certNo'));
                                        }}
                                      />
                                    ) : (
                                      <div className={`font-mono-code fw-bold text-dark small cursor-pointer${animatingFields.has('doc-cert-no') ? ' map-autofill-animate' : ''}`} onClick={() => canUpload && setIsManualEditActive(true)}>
                                        {certificateNo || 'P9912447 (partially legible)'}
                                      </div>
                                    )}
                                    {certNoScore < 90 ? (
                                      <div className="small mt-0.5" style={{ fontSize: '0.675rem', color: '#b45309' }}>
                                        Below 90%. Check this field.
                                      </div>
                                    ) : (
                                      <div className="small mt-0.5 text-success fw-bold d-inline-flex align-items-center gap-1" style={{ fontSize: '0.675rem' }}>
                                        <Check className="w-3 h-3 text-success" /> Field verified / corrected
                                      </div>
                                    )}
                                  </div>
                                  <div className="d-flex flex-column align-items-end flex-shrink-0" style={{ width: '80px' }}>
                                    <div className="font-mono-code small fw-bold" style={{ fontSize: '0.7rem', color: certNoScore >= 90 ? '#059669' : '#c2410c' }}>{certNoScore}%</div>
                                  </div>
                                </div>

                                {/* Issuing Authority */}
                                <div className="map-extraction-field-row py-1">
                                  <div className="d-flex flex-column flex-grow-1 me-2">
                                    <div className="font-mono-code text-uppercase small fw-bold mb-0.5" style={{ fontSize: '0.6rem', color: '#64748b' }}>
                                      ISSUING AUTHORITY
                                    </div>
                                    {isManualEditActive ? (
                                      <input
                                        type="text"
                                        className="map-extraction-field-input"
                                        value={issuingAuthority}
                                        onChange={(e) => {
                                          setIssuingAuthority(e.target.value);
                                          setCorrectedFields((prev) => new Set(prev).add('authority'));
                                        }}
                                      />
                                    ) : (
                                      <div className={`font-mono-code fw-bold text-dark small cursor-pointer${animatingFields.has('doc-issuing-authority') ? ' map-autofill-animate' : ''}`} onClick={() => canUpload && setIsManualEditActive(true)}>
                                        {issuingAuthority || 'illegible stamp'}
                                      </div>
                                    )}
                                    {authorityScore < 90 ? (
                                      <div className="small mt-0.5" style={{ fontSize: '0.675rem', color: '#b45309' }}>
                                        Below 90%. Check this field.
                                      </div>
                                    ) : (
                                      <div className="small mt-0.5 text-success fw-bold d-inline-flex align-items-center gap-1" style={{ fontSize: '0.675rem' }}>
                                        <Check className="w-3 h-3 text-success" /> Field verified / corrected
                                      </div>
                                    )}
                                  </div>
                                  <div className="d-flex flex-column align-items-end flex-shrink-0" style={{ width: '80px' }}>
                                    <div className="font-mono-code small fw-bold" style={{ fontSize: '0.7rem', color: authorityScore >= 90 ? '#059669' : '#c2410c' }}>{authorityScore}%</div>
                                  </div>
                                </div>

                                {/* Expiry Date */}
                                <div className="map-extraction-field-row py-1">
                                  <div className="d-flex flex-column flex-grow-1 me-2">
                                    <div className="font-mono-code text-uppercase small fw-bold mb-0.5" style={{ fontSize: '0.6rem', color: '#64748b' }}>
                                      EXPIRY DATE
                                    </div>
                                    {isManualEditActive ? (
                                      <input
                                        type="date"
                                        className="map-extraction-field-input"
                                        value={expiryDate}
                                        onChange={(e) => {
                                          setExpiryDate(e.target.value);
                                          setCorrectedFields((prev) => new Set(prev).add('expiry'));
                                        }}
                                      />
                                    ) : (
                                      <div className={`font-mono-code fw-bold text-dark small cursor-pointer${animatingFields.has('doc-expiry-date') ? ' map-autofill-animate' : ''}`} onClick={() => canUpload && setIsManualEditActive(true)}>
                                        {expiryDate || '2026-10-29'}
                                      </div>
                                    )}
                                    {expiryScore < 90 ? (
                                      <div className="small mt-0.5" style={{ fontSize: '0.675rem', color: '#b45309' }}>
                                        Below 90%. Check this field.
                                      </div>
                                    ) : (
                                      <div className="small mt-0.5 text-success fw-bold d-inline-flex align-items-center gap-1" style={{ fontSize: '0.675rem' }}>
                                        <Check className="w-3 h-3 text-success" /> Field verified / corrected
                                      </div>
                                    )}
                                  </div>
                                  <div className="d-flex flex-column align-items-end flex-shrink-0" style={{ width: '80px' }}>
                                    <div className="font-mono-code small fw-bold" style={{ fontSize: '0.7rem', color: expiryScore >= 90 ? '#059669' : '#c2410c' }}>{expiryScore}%</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Exception Action Banner matching screenshot */}
                      {canUpload && (
                        <div className="map-exception-banner mt-3">
                          <div>
                            <div className="fw-bold text-dark mb-0.5" style={{ fontSize: '0.825rem', color: '#92400e' }}>
                              Submitter action required
                            </div>
                            <div className="small" style={{ fontSize: '0.725rem', color: '#b45309' }}>
                              The issuing authority and passport number are hard to read, and the training completion date is missing. Upload a clearer scan or a renewed certificate.
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              className={`btn btn-sm map-btn-outline-manual py-1 ${isManualEditActive ? 'is-active' : ''}`}
                              onClick={() => setIsManualEditActive(!isManualEditActive)}
                            >
                              {isManualEditActive ? 'Done Editing Fields' : 'Correct field manually'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Column 2 (Right): Document Upload Panel */}
                <div className={hasExtractedSpecs ? "col-lg-5 col-md-6 ps-md-4 d-flex flex-column gap-3" : "col-12 d-flex flex-column gap-3"}>

                  {/* Document Title & Entity Type (Same Row) */}
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="doc-title">
                        Title <span className="text-danger">*</span>
                      </label>
                      <input
                        id="doc-title"
                        type="text"
                        className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !title.trim() ? 'is-invalid' : ''}${animatingFields.has('doc-title') ? ' map-autofill-animate' : ''}`}
                        placeholder="e.g. Certificate of Class"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isUploading || isExtractingAi || !!existingDocument}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="doc-type">
                        Type <span className="text-danger">*</span>
                      </label>
                      <select
                        id="doc-type"
                        className="form-select form-select-sm bg-white text-dark border-secondary"
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value as DocumentEntityType)}
                        disabled={isUploading || isExtractingAi || !!existingDocument}
                      >
                        <option value="Vessel Certificate">Vessel Certificate</option>
                        <option value="Crew Certificate">Crew Certificate</option>
                      </select>
                    </div>
                  </div>
                  {/* Option A: Upload from Document Library (if not replacing existing doc revision) */}
                  {!existingDocument && (
                    <div className="p-2.5 bg-light border rounded-3 d-flex flex-column gap-2 mb-1">
                      <div className="d-flex flex-column">
                        <label className="form-label text-secondary small fw-semibold mb-1 text-truncate" htmlFor="lib-doc-select">
                          Select from Document Library
                        </label>
                        <select
                          id="lib-doc-select"
                          className={`form-select form-select-sm bg-white text-dark border-secondary w-100 font-mono-code ${selectedUnassignedDocId ? 'border-primary shadow-2xs' : ''}`}
                          style={{ height: '36px', fontSize: '0.8125rem' }}
                          value={selectedUnassignedDocId}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleSelectUnassignedDoc(e.target.value);
                              setUploadOption('unassigned_doc');
                            } else {
                              setSelectedUnassignedDocId('');
                              setUploadOption('new_file');
                            }
                          }}
                          disabled={isExtractingAi || isUploading}
                        >
                          <option value="">
                            {unassignedDocuments.length > 0
                              ? `-- Select from ${unassignedDocuments.length} Available Document${unassignedDocuments.length > 1 ? 's' : ''} --`
                              : '-- No library documents available --'}
                          </option>
                          {unassignedDocuments.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.title} ({doc.certificateNo || doc.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedUnassignedDocId && (
                        <div className="d-flex align-items-center justify-content-between p-2 bg-white border border-success rounded small font-mono-code">
                          <div className="d-flex align-items-center gap-2 text-truncate">
                            <span className="badge bg-success text-white flex-shrink-0">Document</span>
                            <span className="fw-bold text-dark text-truncate">{selectedUnassignedDocId}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-danger small text-decoration-none ms-2"
                            onClick={() => {
                              setSelectedUnassignedDocId('');
                              setFileName('');
                              if (!requirementTitle) setTitle('');
                              setCertificateNo('');
                              setIssuingAuthority('');
                              setIsAiExtracted(false);
                              setIsExtractingAi(false);
                              setIsPendingVerification(false);
                              setUploadOption('new_file');
                            }}
                          >
                            Clear Selection
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Option B: Drag/Drop or Click */}
                  <div className="w-100 d-flex flex-column">
                    <label className="form-label text-secondary small fw-semibold mb-1 text-truncate">
                      Upload a File
                    </label>
                    <div
                      className="border border-dashed border-primary rounded bg-white p-2 text-center cursor-pointer hover-bg-light transition-all d-flex align-items-center justify-content-center gap-2 w-100"
                      style={{ borderStyle: 'dashed', borderWidth: '1.5px', height: '38px', cursor: isUploading || isExtractingAi ? 'not-allowed' : 'pointer' }}
                      onClick={() => {
                        if (!isUploading && !isExtractingAi) {
                          fileInputRef.current?.click();
                        }
                      }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <Upload className="w-4 h-4 text-primary shrink-0" />
                      <span className="small text-dark fw-semibold text-truncate" style={{ fontSize: '0.8125rem' }}>
                        {fileName && uploadOption === 'new_file' ? (
                          <span className="text-success font-mono-code">{fileName}</span>
                        ) : (
                          <span>Drop document file here or <span className="text-primary text-decoration-underline">browse</span></span>
                        )}
                      </span>
                    </div>

                    {/* Quick File Selection Chips */}
                    <div className="d-flex align-items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-secondary small me-1" style={{ fontSize: '0.7rem' }}>
                        Sample:
                      </span>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-secondary font-mono-code py-0 px-2"
                        style={{ fontSize: '0.675rem' }}
                        onClick={() => {
                          setUploadOption('new_file');
                          setSelectedUnassignedDocId('');
                          handleSampleFileClick(
                            requirementTitle
                              ? `${requirementTitle.replace(/\s+/g, '_')}_Scan_2026.pdf`
                              : `IOPP_MARPOL_Annex1_Certificate_2026.pdf`
                          );
                        }}
                        disabled={isUploading || isExtractingAi}
                      >
                        + {requirementTitle ? `${requirementTitle.replace(/\s+/g, '_')}_Scan_2026.pdf` : 'IOPP_MARPOL_Annex1_Certificate_2026.pdf'}
                      </button>
                    </div>
                  </div>

                  {/* reason for revision / change summary field - only rendered when uploading a revision to an existing document */}
                  {existingDocument && (
                    <div>
                      <label className="form-label text-dark fw-semibold small mb-1" htmlFor="revision-summary">
                        Change Summary
                      </label>
                      <textarea
                        id="revision-summary"
                        className="form-control form-control-sm bg-white text-dark border-secondary"
                        rows={3}
                        placeholder="e.g. Renewed certificate"
                        value={changeSummary}
                        onChange={(e) => setChangeSummary(e.target.value)}
                        disabled={isUploading || isExtractingAi}
                      />
                    </div>
                  )}

                  {/* Simulated AI Extraction Progress Indicator */}
                  {isExtractingAi && (
                    <div className="p-3 bg-primary-subtle border border-primary-subtle rounded shadow-2xs">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="fw-bold text-primary small d-flex align-items-center gap-2">
                          <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
                          Reading document...
                        </span>
                        <span className="badge bg-primary text-white font-mono-code">Processing</span>
                      </div>
                      <div className="ai-scan-bar" />
                      <div className="font-mono-code text-muted small mt-2" style={{ fontSize: '0.725rem' }}>
                        Reading <strong>{fileName}</strong>...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer border-top bg-light">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={onClose}
                disabled={isUploading || isExtractingAi}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary fw-bold px-4 d-inline-flex align-items-center gap-2"
                disabled={isUploading || isExtractingAi || !title.trim()}
              >
                {isUploading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    Uploading...
                  </>
                ) : existingDocument ? (
                  'Submit Replacement Revision'
                ) : (
                  ' Upload Document'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Document File Preview & Verification Gate Popup Modal */}
      {isPendingVerification && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1070 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPendingVerification(false);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              {/* Header */}
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div className="d-flex align-items-center gap-2">
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0">
                      Document Preview
                    </h5>
                    <div className="text-secondary small mt-0.5">
                      Check the scan is clear before reading it.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-icon border-0 bg-transparent text-secondary p-1"
                  onClick={() => setIsPendingVerification(false)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="modal-body p-4">
                <div className="bg-light border rounded p-3 mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-danger text-white font-mono-code" style={{ fontSize: '0.7rem' }}>PDF SCAN</span>
                      <span className="fw-bold text-dark font-mono-code">{fileName}</span>
                    </div>
                    <span className="badge bg-success text-white font-mono-code" style={{ fontSize: '0.7rem' }}>CLEAR</span>
                  </div>

                  {/* Document Wireframe Scan Graphic */}
                  <div className="bg-white p-3 border rounded font-mono-code text-start" style={{ fontSize: '0.775rem', lineHeight: '1.5' }}>
                    <div className="text-uppercase fw-bold text-primary border-bottom pb-1 mb-2 d-flex justify-content-between">
                      <span className="text-muted">PAGE 1 OF 1</span>
                    </div>

                    <div className="p-2.5 bg-light border rounded mt-2.5 text-muted text-center" style={{ fontSize: '0.725rem' }}>
                      [ High resolution scan ready for automated AI OCR parsing &amp; metadata extraction ]
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer border-top bg-light d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setIsPendingVerification(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-success fw-bold px-3 d-inline-flex align-items-center gap-1.5"
                  onClick={handleConfirmVerifyAndExtract}
                >
                  Read Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
