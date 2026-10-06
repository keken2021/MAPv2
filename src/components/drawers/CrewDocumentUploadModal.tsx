/* 
  file summary: master crew document upload & replacement modal for submitting stcw certificates in light theme with AI information extraction screen.
  responsibilities: captures crew document title, stcw layer, regulation, certificate number, issuing authority, expiry date, file attachment, and supports simulated AI OCR metadata extraction.
  role in system: invoked from CrewView.tsx and CrewDetailView.tsx for uploading or updating STCW seafarer certificates.
*/

import React, { useState, useEffect, useRef } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { STCWDocumentItem, STCWLayer } from '../../types/crew';
import { formatDocumentId } from '../../utils/formatters';
import { Upload, FileText, Check, AlertCircle, X } from 'lucide-react';

interface CrewDocumentUploadModalProps {
  isOpen: boolean;
  crewId: string;
  crewName: string;
  existingDocument?: STCWDocumentItem | null;
  initialLayer?: STCWLayer;
  onClose: () => void;
}

/**
  what: renders STCW crew certificate upload / update modal with file picker and simulated AI metadata extraction.
  how: pre-populates metadata if existingDocument is passed, simulates AI extraction upon file attach, and populates extracted certificate attributes into form state.
  with what file: src/components/drawers/CrewDocumentUploadModal.tsx loaded by CrewDetailView.tsx and CrewView.tsx.
*/
export const CrewDocumentUploadModal: React.FC<CrewDocumentUploadModalProps> = ({
  isOpen,
  crewId,
  crewName,
  existingDocument,
  initialLayer,
  onClose,
}) => {
  const { documents, addCrewDocument, updateCrewDocument, activePersona } = useMapStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [layer, setLayer] = useState<STCWLayer>(initialLayer || 'Layer 1 - Universal Core');
  const [stcwRegulation, setStcwRegulation] = useState('STCW Reg VI/1');
  const [certificateNo, setCertificateNo] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('Australian Maritime Safety Authority (AMSA)');
  const [flagState, setFlagState] = useState('Australia');
  const [issueDate, setIssueDate] = useState('2026-01-01');
  const [expiryDate, setExpiryDate] = useState('2031-01-01');
  const [verificationStatus, setVerificationStatus] = useState<'Verified' | 'Pending' | 'Expiring' | 'Expired'>('Verified');
  const [fileName, setFileName] = useState('');
  const [changeSummary, setChangeSummary] = useState('');

  /* Option A / Option B intake source selection */
  const [uploadOption, setUploadOption] = useState<'option_a_library' | 'option_b_file'>('option_b_file');
  const [selectedLibraryDocId, setSelectedLibraryDocId] = useState('');

  /* simulated AI extraction states */
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [isAiExtracted, setIsAiExtracted] = useState(false);
  const [isNewExtractionAnimate, setIsNewExtractionAnimate] = useState(false);
  const [extractionKey, setExtractionKey] = useState(0);
  const [aiOcrConfidence, setAiOcrConfidence] = useState(99.2);

  /* manual inline field editing state */
  const [isManualEditActive, setIsManualEditActive] = useState(false);
  const [correctedFields, setCorrectedFields] = useState<Set<string>>(new Set());
  const [, setRevealedFields] = useState<{ certNo: boolean; authority: boolean; expiry: boolean; summary: boolean }>({
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

  /* autofill animation state for programmatically populated fields */
  const [animatingFields, setAnimatingFields] = useState<Set<string>>(new Set());

  /* unassigned crew documents in document library */
  const unassignedCrewDocs = documents.filter((d) => {
    if (d.entityType !== 'Crew Certificate') return false;
    const vId = d.vesselId?.trim().toUpperCase();
    const isVesselUnassigned = !vId || vId === '' || vId === 'UNASSIGNED' || vId === 'UNLINKED' || vId.startsWith('VESSEL-PENDING');
    return isVesselUnassigned;
  });

  /*
    what: triggers map-autofill-animate shimmer on specified form inputs or display values.
    how: adds field keys to animatingFields set and removes them after 750ms.
    with what file: src/components/drawers/CrewDocumentUploadModal.tsx.
  */
  const triggerAutofillAnimation = (fieldIds: string[]) => {
    setAnimatingFields((prev) => {
      const next = new Set(prev);
      fieldIds.forEach((id) => next.add(id));
      return next;
    });
    setTimeout(() => {
      setAnimatingFields((prev) => {
        const next = new Set(prev);
        fieldIds.forEach((id) => next.delete(id));
        return next;
      });
    }, 750);
  };

  /*
    what: handles selecting an unassigned crew certificate from document library (option a).
    how: populates certificate form values, layer, dates, filename, sets extraction review active, and triggers autofill animations.
    with what file: src/components/drawers/CrewDocumentUploadModal.tsx.
  */
  const handleSelectLibraryDoc = (docId: string) => {
    setSelectedLibraryDocId(docId);
    if (!docId) return;

    const chosenDoc = unassignedCrewDocs.find((d) => d.id === docId);
    if (!chosenDoc) return;

    setTitle(chosenDoc.title.replace(/\s*—\s*.*$/, ''));
    if (
      chosenDoc.title.toLowerCase().includes('layer 2') ||
      chosenDoc.title.toLowerCase().includes('endorsement') ||
      chosenDoc.title.toLowerCase().includes('dp ') ||
      chosenDoc.title.toLowerCase().includes('tanker') ||
      chosenDoc.title.toLowerCase().includes('master unlimited') ||
      chosenDoc.title.toLowerCase().includes('chief engineer')
    ) {
      setLayer('Layer 2 - Vessel Specific & Endorsements');
    } else {
      setLayer('Layer 1 - Universal Core');
    }
    setStcwRegulation(chosenDoc.crewAttributes?.certType || chosenDoc.title);
    setCertificateNo(chosenDoc.certificateNo);
    setIssuingAuthority(chosenDoc.issuingAuthority);
    setFlagState(chosenDoc.crewAttributes?.nationality || 'Australia');
    setIssueDate(chosenDoc.crewAttributes?.issueDate || '2026-01-01');
    setExpiryDate(chosenDoc.expiryDate);
    setVerificationStatus('Verified');
    setFileName(chosenDoc.versions[0]?.fileName || `${chosenDoc.id.toLowerCase()}.pdf`);
    setChangeSummary(`Linked unassigned certificate ${chosenDoc.certificateNo} from Document Library.`);
    setIsAiExtracted(true);
    setIsNewExtractionAnimate(true);
    setExtractionKey((prev) => prev + 1);
    setIsExtractingAi(false);
    setIsPendingVerification(false);
    setRevealedFields({ certNo: true, authority: true, expiry: true, summary: true });
    triggerAutofillAnimation(['doc-title', 'doc-layer', 'stcw-reg', 'doc-cert-no', 'doc-issuing-auth', 'doc-flag-state', 'doc-expiry-date']);
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedLibraryDocId('');
      setUploadOption('option_b_file');
      if (existingDocument) {
        setTitle(existingDocument.title);
        setLayer(existingDocument.layer);
        setStcwRegulation(existingDocument.stcwRegulation);
        setCertificateNo(existingDocument.certificateNo);
        setIssuingAuthority(existingDocument.issuingAuthority);
        setFlagState(existingDocument.flagState || 'Australia');
        setIssueDate(existingDocument.issueDate);
        setExpiryDate(existingDocument.expiryDate);
        setVerificationStatus(existingDocument.verificationStatus === 'Expired' ? 'Verified' : existingDocument.verificationStatus);
        setFileName(existingDocument.fileName || `${existingDocument.title.toLowerCase().replace(/\s+/g, '_')}_v2.pdf`);
        setChangeSummary('Replacement STCW certificate scan uploaded by submitter.');
        setIsAiExtracted(true);
        setAiOcrConfidence(98.5);
        triggerAutofillAnimation(['doc-title', 'doc-cert-no', 'doc-issuing-auth', 'doc-flag-state', 'doc-expiry-date']);
      } else {
        setTitle('');
        setLayer(initialLayer || 'Layer 1 - Universal Core');
        setStcwRegulation('STCW Reg VI/1');
        setCertificateNo('');
        setIssuingAuthority('Australian Maritime Safety Authority (AMSA)');
        setFlagState('Australia');
        setIssueDate('2026-01-01');
        setExpiryDate('2031-01-01');
        setVerificationStatus('Verified');
        setFileName('');
        setChangeSummary('');
        setIsAiExtracted(false);
        setAiOcrConfidence(99.2);
      }
      setIsExtractingAi(false);
      setIsUploading(false);
      setUploadProgress(0);
      setStatusMessage('');
      setIsDraggingOver(false);
      setIsPendingVerification(false);
      setHasAttemptedSubmit(false);
      setErrorMessage('');
      setRevealedFields({ certNo: false, authority: false, expiry: false, summary: false });
    }
  }, [isOpen, existingDocument, initialLayer]);

  if (!isOpen) return null;

  const canManage = activePersona === 'Administrator' || activePersona === 'C Admin' || activePersona === 'Submitter';
  const isEditing = Boolean(existingDocument);

  /* handles file attachment selection and stages document for user verification before AI extraction */
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

  /* handles drag and drop file interactions */
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

  /* simulates AI information extraction when a file is uploaded or selected */
  const triggerAiExtraction = (selectedName: string) => {
    setFileName(selectedName);
    setIsExtractingAi(true);
    setIsAiExtracted(false);
    setIsNewExtractionAnimate(false);
    setRevealedFields({ certNo: false, authority: false, expiry: false, summary: false });

    const generatedCertNo = `AMSA-STCW-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    setTimeout(() => {
      setIsExtractingAi(false);
      setIsAiExtracted(true);
      setIsNewExtractionAnimate(true);
      setExtractionKey((prev) => prev + 1);
      setAiOcrConfidence(99.2);

      /* stagger 1: certificate number */
      setTimeout(() => {
        setCertificateNo(generatedCertNo);
        setRevealedFields((prev) => ({ ...prev, certNo: true }));
        triggerAutofillAnimation(['doc-cert-no']);
      }, 120);

      /* stagger 2: issuing authority */
      setTimeout(() => {
        setIssuingAuthority('Australian Maritime Safety Authority (AMSA)');
        setRevealedFields((prev) => ({ ...prev, authority: true }));
        triggerAutofillAnimation(['doc-issuing-auth']);
      }, 420);

      /* stagger 3: expiry date */
      setTimeout(() => {
        setExpiryDate('2031-01-01');
        setRevealedFields((prev) => ({ ...prev, expiry: true }));
        triggerAutofillAnimation(['doc-title', 'doc-layer', 'stcw-reg', 'doc-flag-state', 'doc-expiry-date']);
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
    setErrorMessage('');

    if (!canManage) {
      setErrorMessage('Permission Denied: Document modifications are restricted exclusively to Administrator or Submitter roles.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Document title is required.');
      return;
    }

    const finalCertNo = certificateNo.trim() || `AMSA-STCW-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalAuthority = issuingAuthority.trim() || 'Australian Maritime Safety Authority (AMSA)';

    setIsUploading(true);
    setUploadProgress(15);
    setStatusMessage('Reading STCW document byte stream and preparing secure payload...');

    setTimeout(() => {
      setUploadProgress(45);
      setStatusMessage('Uploading certificate bytes to seafarer compliance vault...');
    }, 350);

    setTimeout(() => {
      setUploadProgress(80);
      setStatusMessage('Verifying AI extracted attributes and validating AMSA / Flag authority...');
    }, 750);

    setTimeout(() => {
      setUploadProgress(100);
      setStatusMessage('Upload complete! Updating crew compliance log...');
    }, 1150);

    setTimeout(() => {
      const docToSave: STCWDocumentItem = {
        id: existingDocument ? existingDocument.id : (selectedLibraryDocId || formatDocumentId('CRW', 2026, 'STCW')),
        title: title.trim(),
        layer,
        stcwRegulation: stcwRegulation.trim() || 'STCW Convention Standard',
        certificateNo: finalCertNo,
        issuingAuthority: finalAuthority,
        flagState: flagState.trim() || 'Australia',
        issueDate,
        expiryDate,
        verificationStatus,
        fileName: fileName.trim() || `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        fileSizeBytes: existingDocument?.fileSizeBytes || 1500000,
      };

      if (isEditing) {
        updateCrewDocument(crewId, docToSave);
      } else {
        addCrewDocument(crewId, docToSave);
      }

      setIsUploading(false);
      onClose();
    }, 1500);
  };

  const hasExtractedSpecs = Boolean(isAiExtracted || (existingDocument && fileName));

  /* dynamic confidence computation based on user edits and extraction status */
  const certNoScore = correctedFields.has('certNo') ? 100 : (certificateNo && certificateNo.trim() !== '' && !certificateNo.includes('partially legible') ? 98 : 61);
  const authorityScore = correctedFields.has('authority') ? 100 : (issuingAuthority && issuingAuthority.trim() !== '' && !issuingAuthority.includes('illegible') ? 97 : 44);
  const expiryScore = correctedFields.has('expiry') ? 100 : (expiryDate && expiryDate.trim() !== '' ? 98 : 79);
  const nameScore = 95;
  const dynamicScore = correctedFields.size >= 3
    ? 100
    : Math.min(100, Math.round((nameScore + certNoScore + authorityScore + expiryScore) / 4));
  const isFullPageCaptured = certNoScore >= 90 && expiryScore >= 90;
  const isSignaturePresent = authorityScore >= 90;

  return (
    <>
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
              <div>
                <h5 className="modal-title fw-bold text-slate-900 m-0">
                  {existingDocument
                    ? `Upload Replacement Revision — ${existingDocument.title}`
                    : `Upload STCW Certificate — ${crewName}`}
                </h5>
                <div className="text-secondary small font-mono-code">
                  Seafarer: <strong>{crewName}</strong> ({crewId})
                </div>
              </div>
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
                {errorMessage && (
                  <div className="alert alert-danger py-2 small mb-3">
                    {errorMessage}
                  </div>
                )}

                {/* Simulated Upload Progress Bar */}
                {isUploading && (
                  <div className="p-3 mb-4 bg-light border border-primary rounded shadow-2xs">
                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                      <span className="fw-bold text-primary small d-flex align-items-center gap-2">
                        <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
                        Simulating STCW Certificate Upload &amp; Re-upload...
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
                  {/* Column 1 (Left): Extraction Review Screen (shown dynamically only when file attached / extracted) */}
                  {hasExtractedSpecs && (
                    <div className="col-lg-7 col-md-6 border-end pe-md-4">
                      <div key={`review-box-${extractionKey}`} className="map-extraction-preview-container p-4 h-100 d-flex flex-column justify-between">
                        <div>
                          {/* Subtitle & Confidence Indicator */}
                          <div className="d-flex flex-wrap align-items-start justify-content-between mb-3 border-bottom pb-3">
                            <div>
                              <div className="font-mono-code text-uppercase text-muted small fw-bold mb-0.5" style={{ fontSize: '0.675rem', letterSpacing: '0.08em' }}>
                                EXTRACTION REVIEW
                              </div>
                              <h5 className="fw-bold text-dark m-0 mb-1" style={{ fontSize: '1.15rem' }}>
                                {title || existingDocument?.title || 'Master Unlimited Certificate of Competency (CoC)'}
                              </h5>
                              <div className="font-mono-code text-muted small" style={{ fontSize: '0.75rem' }}>
                                {(fileName || 'stcw_coc_scan.pdf')} · 1.5 MB · 1 page
                              </div>
                            </div>

                            <div className="text-end">
                              <div className="fw-bold lh-1" style={{ fontSize: '1.65rem', color: dynamicScore >= 90 ? '#059669' : '#c2410c' }}>
                                {dynamicScore}%
                              </div>
                              <div className="small lh-sm text-muted" style={{ fontSize: '0.65rem' }}>
                                overall confidence<br />threshold 90%
                              </div>
                            </div>
                          </div>

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

                              <div key={`criteria-list-${extractionKey}`} className="d-flex flex-column gap-2 mt-2 p-2 bg-light rounded border">
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
                                  <span className="ps-0.5 text-dark fw-medium">Signature / stamp present</span>
                                </div>
                              </div>
                            </div>

                            {/* Extracted Attributes List */}
                            <div key={`specs-list-${extractionKey}`} className="col-md-8 d-flex flex-column gap-1">
                              {/* Crew Member Name */}
                              <div className="map-extraction-field-row py-1">
                                <div className="d-flex flex-column flex-grow-1 me-2">
                                  <div className="font-mono-code text-uppercase small fw-bold mb-0.5" style={{ fontSize: '0.6rem', color: '#64748b' }}>
                                    CREW MEMBER NAME
                                  </div>
                                  <div className="font-mono-code fw-bold text-dark small">
                                    {crewName}
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end flex-shrink-0" style={{ width: '80px' }}>
                                  <div className="font-mono-code small text-success fw-bold" style={{ fontSize: '0.7rem' }}>{nameScore}%</div>
                                </div>
                              </div>

                              {/* Certificate Number */}
                              <div className="map-extraction-field-row py-1">
                                <div className="d-flex flex-column flex-grow-1 me-2">
                                  <div className="font-mono-code text-uppercase small fw-bold mb-0.5" style={{ fontSize: '0.6rem', color: '#64748b' }}>
                                    CERTIFICATE / DOCUMENT NUMBER
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
                                    <div className={`font-mono-code fw-bold text-dark small cursor-pointer${animatingFields.has('doc-cert-no') ? ' map-autofill-animate' : ''}`} onClick={() => canManage && setIsManualEditActive(true)}>
                                      {certificateNo || 'AMSA-COC-2026-8812 (partially legible)'}
                                    </div>
                                  )}
                                  {certNoScore < 90 ? (
                                    <div className="small mt-0.5" style={{ fontSize: '0.675rem', color: '#b45309' }}>
                                      Below 90% threshold — human review required
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
                                    <div className={`font-mono-code fw-bold text-dark small cursor-pointer${animatingFields.has('doc-issuing-auth') ? ' map-autofill-animate' : ''}`} onClick={() => canManage && setIsManualEditActive(true)}>
                                      {issuingAuthority || 'illegible stamp'}
                                    </div>
                                  )}
                                  {authorityScore < 90 ? (
                                    <div className="small mt-0.5" style={{ fontSize: '0.675rem', color: '#b45309' }}>
                                      Below 90% threshold — human review required
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
                                    <div className={`font-mono-code fw-bold text-dark small cursor-pointer${animatingFields.has('doc-expiry-date') ? ' map-autofill-animate' : ''}`} onClick={() => canManage && setIsManualEditActive(true)}>
                                      {expiryDate || '2031-01-01'}
                                    </div>
                                  )}
                                  {expiryScore < 90 ? (
                                    <div className="small mt-0.5" style={{ fontSize: '0.675rem', color: '#b45309' }}>
                                      Below 90% threshold — human review required
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
                        </div>

                        {/* Exception Action Banner */}
                        {canManage && (
                          <div className="map-exception-banner mt-3">
                            <div>
                              <div className="fw-bold text-dark mb-0.5" style={{ fontSize: '0.825rem', color: '#92400e' }}>
                                Exception identified — Submitter action required
                              </div>
                              <div className="small" style={{ fontSize: '0.725rem', color: '#b45309' }}>
                                Issuing authority illegible, certificate number partially legible. Replace with a clearer scan or provide a renewed certificate.
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

                    {/* Document Title & Entity / Layer Selection (Same Row matching reference design) */}
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="doc-title">
                          Document Title <span className="text-danger">*</span>
                        </label>
                        <input
                          id="doc-title"
                          type="text"
                          className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !title.trim() ? 'is-invalid' : ''}${animatingFields.has('doc-title') ? ' map-autofill-animate' : ''}`}
                          placeholder="e.g. Master Unlimited CoC / IGF Code Training"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          disabled={isUploading || isExtractingAi || !!existingDocument}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="doc-layer">
                          Entity Type <span className="text-danger">*</span>
                        </label>
                        <select
                          id="doc-layer"
                          className={`form-select form-select-sm bg-white text-dark border-secondary${animatingFields.has('doc-layer') ? ' map-autofill-animate' : ''}`}
                          value={layer}
                          onChange={(e) => setLayer(e.target.value as STCWLayer)}
                          disabled={isUploading || isExtractingAi || !!existingDocument}
                        >
                          <option value="Layer 1 - Universal Core">Crew Certificate</option>
                          <option value="Layer 2 - Vessel Specific & Endorsements">Vessel Certificate</option>
                        </select>
                      </div>
                    </div>

                    {/* Option A: Auto-Fill from Document Library (if unassigned certs exist) */}
                    {!existingDocument && (
                      <div className="p-2.5 bg-light border rounded-3 d-flex flex-column gap-2 mb-1">
                        <div className="d-flex flex-column">
                          <label className="form-label text-secondary small fw-semibold mb-1 text-truncate" htmlFor="crew-unassigned-doc-select">
                            Option A: Auto-Fill from Document Library
                          </label>
                          <select
                            id="crew-unassigned-doc-select"
                            className={`form-select form-select-sm bg-white text-dark border-secondary w-100 font-mono-code ${selectedLibraryDocId ? 'border-primary shadow-2xs' : ''}`}
                            style={{ height: '36px', fontSize: '0.8125rem' }}
                            value={selectedLibraryDocId}
                            onChange={(e) => {
                              handleSelectLibraryDoc(e.target.value);
                              if (e.target.value) setUploadOption('option_a_library');
                            }}
                            disabled={isExtractingAi || isUploading}
                          >
                            <option value="">
                              {unassignedCrewDocs.length > 0
                                ? `-- Select from ${unassignedCrewDocs.length} Unassigned Cert${unassignedCrewDocs.length > 1 ? 's' : ''} --`
                                : '-- No unassigned crew certificates --'}
                            </option>
                            {unassignedCrewDocs.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {doc.title} ({doc.certificateNo || doc.id})
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedLibraryDocId && (
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white border border-success rounded small font-mono-code">
                            <div className="d-flex align-items-center gap-2 text-truncate">
                              <span className="badge bg-success text-white flex-shrink-0">Document Library Entity</span>
                              <span className="fw-bold text-dark text-truncate">{selectedLibraryDocId}</span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-link p-0 text-danger small text-decoration-none ms-2"
                              onClick={() => {
                                setSelectedLibraryDocId('');
                                setFileName('');
                                setTitle('');
                                setCertificateNo('');
                                setIsAiExtracted(false);
                                setIsExtractingAi(false);
                                setIsPendingVerification(false);
                              }}
                            >
                              Clear Selection
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Option B: Drag & Drop / Clickable File Upload for AI Extraction */}
                    <div className="w-100 d-flex flex-column">
                      <label className="form-label text-secondary small fw-semibold mb-1 text-truncate">
                        Option B: Drag &amp; Drop / Click File
                      </label>
                      <div
                        className="border border-dashed border-primary rounded bg-white p-2 text-center cursor-pointer hover-bg-light transition-all d-flex align-items-center justify-content-center gap-2 w-100"
                        style={{ borderStyle: 'dashed', borderWidth: '1.5px', height: '38px' }}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleSelectFileForPreview(file.name);
                        }}
                      >
                        <Upload className="w-4 h-4 text-primary shrink-0" />
                        <span className="small text-dark fw-semibold text-truncate" style={{ fontSize: '0.8125rem' }}>
                          Drop document file here or <span className="text-primary text-decoration-underline">browse</span>
                        </span>
                      </div>
                    </div>

                    {/* STCW Regulation & Certificate Number */}
                    <div className="row g-2">
                      <div className="col-md-5">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="stcw-reg">
                          STCW Reg Ref
                        </label>
                        <input
                          id="stcw-reg"
                          type="text"
                          className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code${animatingFields.has('stcw-reg') ? ' map-autofill-animate' : ''}`}
                          placeholder="STCW Reg II/2"
                          value={stcwRegulation}
                          onChange={(e) => setStcwRegulation(e.target.value)}
                          disabled={isUploading || isExtractingAi}
                        />
                      </div>
                      <div className="col-md-7">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="cert-no">
                          Certificate No <span className="text-danger">*</span>
                        </label>
                        <input
                          id="cert-no"
                          type="text"
                          className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code${animatingFields.has('doc-cert-no') ? ' map-autofill-animate' : ''}`}
                          placeholder="e.g. CoC-II-2-0041"
                          value={certificateNo}
                          onChange={(e) => setCertificateNo(e.target.value)}
                          disabled={isUploading || isExtractingAi}
                        />
                      </div>
                    </div>

                    {/* Issuing Authority & Flag State */}
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="issuing-auth">
                          Issuing Body <span className="text-danger">*</span>
                        </label>
                        <input
                          id="issuing-auth"
                          type="text"
                          className={`form-control form-control-sm bg-white text-dark border-secondary${animatingFields.has('doc-issuing-auth') ? ' map-autofill-animate' : ''}`}
                          placeholder="AMSA Australia"
                          value={issuingAuthority}
                          onChange={(e) => setIssuingAuthority(e.target.value)}
                          disabled={isUploading || isExtractingAi}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="flag-state">
                          Flag State Authority
                        </label>
                        <input
                          id="flag-state"
                          type="text"
                          className={`form-control form-control-sm bg-white text-dark border-secondary${animatingFields.has('doc-flag-state') ? ' map-autofill-animate' : ''}`}
                          placeholder="e.g. Australia / Liberia"
                          value={flagState}
                          onChange={(e) => setFlagState(e.target.value)}
                          disabled={isUploading || isExtractingAi}
                        />
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div>
                      <label className="form-label text-secondary small fw-semibold" htmlFor="expiry-date">
                        Expiry Date <span className="text-danger">*</span>
                      </label>
                      <input
                        id="expiry-date"
                        type="date"
                        className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code${animatingFields.has('doc-expiry-date') ? ' map-autofill-animate' : ''}`}
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        disabled={isUploading || isExtractingAi}
                        required
                      />
                    </div>

                    {/* Reason for revision / change summary field when editing */}
                    {existingDocument && (
                      <div>
                        <label className="form-label text-dark fw-semibold small mb-1" htmlFor="revision-summary">
                          Reason for Revision / Change Summary
                        </label>
                        <textarea
                          id="revision-summary"
                          className="form-control form-control-sm bg-white text-dark border-secondary"
                          rows={3}
                          placeholder="e.g. Uploading renewed STCW master certificate scan with updated AMSA seal..."
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
                            AI OCR Scanning in Progress...
                          </span>
                          <span className="badge bg-primary text-white font-mono-code">AI Processing</span>
                        </div>
                        <div className="ai-scan-bar" />
                        <div className="font-mono-code text-muted small mt-2" style={{ fontSize: '0.725rem' }}>
                          Extracting Certificate Attributes from <strong>{fileName}</strong>...
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
                  disabled={isUploading || isExtractingAi || !title.trim() || !canManage}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      Uploading...
                    </>
                  ) : existingDocument ? (
                    'Submit Replacement Revision'
                  ) : (
                    'Upload Certificate'
                  )}
                </button>
              </div>
            </form>
          </div>
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
                <div>
                  <h5 className="modal-title fw-bold text-dark m-0">
                    Document Preview
                  </h5>
                  <div className="text-secondary small mt-0.5">
                    Verify seafarer certificate scan clarity before authorizing AI metadata extraction
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
                <div className="alert alert-info py-2 px-3 small font-mono-code mb-3">
                  <strong>File Staged:</strong> {fileName} (Ready for automated AI spec extraction)
                </div>

                {/* Simulated Document Preview Box */}
                <div
                  className="p-5 border rounded-3 text-center d-flex flex-column align-items-center justify-content-center bg-light shadow-2xs"
                  style={{ minHeight: '260px', borderStyle: 'dashed', borderColor: '#cbd5e1' }}
                >
                  <FileText className="w-12 h-12 text-primary mb-2" />
                  <div className="fw-bold text-dark mb-1">{fileName}</div>
                  <div className="text-secondary small font-mono-code">240 DPI · Scanned STCW Certificate · 1 Page</div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer border-top bg-light d-flex align-items-center justify-content-end gap-2 p-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setIsPendingVerification(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-bold px-3 d-inline-flex align-items-center gap-1.5"
                  onClick={handleConfirmVerifyAndExtract}
                >
                  Confirm Document &amp; Extract Specs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
