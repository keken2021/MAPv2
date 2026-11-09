/*
  file summary: unified document upload & replacement modal for general statutory certificates and crew STCW certificates.
  responsibilities: captures document title and entity type, supports file uploading with simulated AI OCR metadata extraction, and dispatches store actions; crew kind adds STCW fields.
  role in system: invoked from DocumentLibraryView, DocumentReviewDrawer, AssuranceDetailView, CrewView and CrewDetailView.
*/

import React, { useState, useEffect, useRef } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { MasterDocument, DocumentEntityType } from '../../types/document';
import { STCWDocumentItem, STCWLayer } from '../../types/crew';
import { formatDocumentId } from '../../utils/formatters';
import { formatFileSize } from '../../utils/imageCropHelpers';
import type { InspectionReportEvidence, InspectionReportSource } from '../../types/assurance';
import {
  INSPECTION_REPORT_SOURCES,
  INSPECTION_VALIDITY_MONTHS,
  getDefaultInspectionValidityMonths,
  getInspectionValidUntil,
} from '../../utils/inspectionEvidence';
import { getDemoSessionContext, getSessionUserForPersona } from '../../utils/userRoleHelpers';
import { getComplianceStateForExpiry, getDocumentReuploadBlockReason } from '../../utils/documentRenewalHelpers';
import { Upload, Check, AlertCircle, X, FileText } from 'lucide-react';
import { DocumentCertificatePreview } from '../common/DocumentCertificatePreview';
import { UniversalDocumentPreviewModal } from './UniversalDocumentPreviewModal';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  kind?: 'document' | 'crew';
  /* crew kind */
  crewId?: string;
  crewName?: string;
  existingDocument?: MasterDocument | STCWDocumentItem | null;
  initialLayer?: STCWLayer;
  onUploadComplete?: () => void;
  /** When uploading from an assurance set requirement row (demo mock link). */
  assuranceSetId?: string;
  requirementId?: string;
  requirementTitle?: string;
  /* the requirement's category; an inspection report asks for its source, date and validity */
  requirementCategory?: string;
  defaultVesselId?: string;
  modalTitle?: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  kind = 'document',
  crewId,
  crewName,
  existingDocument,
  initialLayer,
  onUploadComplete,
  assuranceSetId,
  requirementId,
  requirementTitle,
  requirementCategory,
  defaultVesselId,
  modalTitle,
}) => {
  const { vessels, documents, notifications, addDocument, uploadDocumentForRequirement, addDocumentVersion, addCrewDocument, updateCrewDocument, activePersona, users, activeDemoOrganization, activeSessionUserId } =
    useMapStore();
  const isCrew = kind === 'crew';
  /* the version is recorded against the signed-in user, not a placeholder name */
  const sessionUser = getSessionUserForPersona(activePersona, users, getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }));

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* crew kind STCW fields */
  const [layer, setLayer] = useState<STCWLayer>(initialLayer || 'Layer 1 - Universal Core');
  const [stcwRegulation, setStcwRegulation] = useState('STCW Reg VI/1');
  const [flagState, setFlagState] = useState('Australia');
  const [issuingState, setIssuingState] = useState('');
  const [endorsingState, setEndorsingState] = useState('');
  const [dpLoggedDays, setDpLoggedDays] = useState('');
  const [issueDate, setIssueDate] = useState('2026-01-01');
  const [verificationStatus, setVerificationStatus] = useState<STCWDocumentItem['verificationStatus']>('Pending');
  const [extractionKey, setExtractionKey] = useState(0);

  const [title, setTitle] = useState('');
  const [entityType, setEntityType] = useState<DocumentEntityType>('Vessel Certificate');
  const [vesselId, setVesselId] = useState('');
  const [certificateNo, setCertificateNo] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  /* inspection report facts (gap review G4) */
  const [inspectionSource, setInspectionSource] = useState<InspectionReportSource | ''>('');
  const [inspectionReportDate, setInspectionReportDate] = useState('');
  const [inspectionValidityMonths, setInspectionValidityMonths] = useState<number>(INSPECTION_VALIDITY_MONTHS);
  const [inspectorAccreditation, setInspectorAccreditation] = useState('');
  const [fileName, setFileName] = useState('');
  const masterDocExisting = !isCrew ? (existingDocument as MasterDocument | null | undefined) : null;
  const crewDocExisting = isCrew ? (existingDocument as STCWDocumentItem | null | undefined) : null;
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(masterDocExisting?.versions?.[0]?.fileSizeBytes || crewDocExisting?.fileSizeBytes || 2100000);
  const [changeSummary, setChangeSummary] = useState('');

  /* tracks which right-column form field ids are playing the ocr autofill shimmer */
  const [animatingFields, setAnimatingFields] = useState<Set<string>>(new Set());

  /* simulated AI extraction states */
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [isAiExtracted, setIsAiExtracted] = useState(false);
  const [isNewExtractionAnimate, setIsNewExtractionAnimate] = useState(false);
  const [aiOcrConfidence, setAiOcrConfidence] = useState(99.2);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [isHandEntered, setIsHandEntered] = useState(false);

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
  /* kept with the other hooks: this state used to sit after the closed-modal return and crashed the page when the modal opened */
  const [leftPaneMode, setLeftPaneMode] = useState<'pdf' | 'attributes'>('pdf');

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
      setFileName(found.versions?.[0]?.fileName || `${found.title}.pdf`);
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
      setExtractionFailed(false);
      setIsHandEntered(Boolean((existingDocument as MasterDocument | null | undefined)?.isHandEntered));
      if (existingDocument) {
        setTitle(existingDocument.title);
        setCertificateNo(existingDocument.certificateNo);
        setIssuingAuthority(existingDocument.issuingAuthority);
        setExpiryDate(existingDocument.expiryDate);
        setIsAiExtracted(true);
        if (isCrew) {
          const crewDoc = existingDocument as STCWDocumentItem;
          setLayer(crewDoc.layer);
          setStcwRegulation(crewDoc.stcwRegulation);
          setFlagState(crewDoc.flagState || 'Australia');
          setIssuingState(crewDoc.issuingState || '');
          setEndorsingState(crewDoc.endorsingState || '');
          setDpLoggedDays(crewDoc.dpLoggedDays !== undefined ? String(crewDoc.dpLoggedDays) : '');
          setIssueDate(crewDoc.issueDate);
          setVerificationStatus('Pending');
          setEntityType('Crew Certificate');
          setFileName(crewDoc.fileName || `${crewDoc.title.toLowerCase().replace(/\s+/g, '_')}_v2.pdf`);
          setChangeSummary('Replacement STCW certificate scan uploaded by submitter.');
          setAiOcrConfidence(98.5);
        } else {
          const doc = existingDocument as MasterDocument;
          setEntityType(doc.entityType);
          setVesselId(doc.vesselId);
          setFileName(doc.versions?.[0]?.fileName || `${doc.title.replace(/\s+/g, '_')}_Rev.pdf`);
          setChangeSummary('New version uploaded by submitter.');
          setAiOcrConfidence(doc.ocrConfidence || 98.5);
        }
      } else {
        setTitle(isCrew ? '' : (requirementTitle || ''));
        setEntityType(isCrew ? 'Crew Certificate' : 'Vessel Certificate');
        setVesselId(defaultVesselId || '');
        setCertificateNo('');
        setIssuingAuthority(isCrew ? 'Australian Maritime Safety Authority (AMSA)' : '');
        setExpiryDate(isCrew ? '2031-01-01' : '');
        setIsAiExtracted(false);
        setAiOcrConfidence(99.2);
        if (isCrew) {
          setLayer(initialLayer || 'Layer 1 - Universal Core');
          setStcwRegulation('STCW Reg VI/1');
          setFlagState('Australia');
          setIssuingState('');
          setEndorsingState('');
          setDpLoggedDays('');
          setIssueDate('2026-01-01');
          setVerificationStatus('Pending');
          setFileName('');
          setChangeSummary('');
        } else {
          setInspectionSource('');
          setInspectionReportDate('');
          setInspectionValidityMonths(
            getDefaultInspectionValidityMonths(vessels.find((v) => v.id === (defaultVesselId || ''))?.yearBuilt),
          );
          setInspectorAccreditation('');
          setFileName('');
          setChangeSummary(requirementTitle ? `Initial upload for assurance requirement: ${requirementTitle}.` : '');
        }
      }
      setIsExtractingAi(false);
      setIsUploading(false);
      setUploadProgress(0);
      setStatusMessage('');
      setIsDraggingOver(false);
      setIsPendingVerification(false);
      setRevealedFields({ certNo: false, authority: false, expiry: false, summary: false });
    }
  }, [isOpen, existingDocument, isCrew, vessels, requirementTitle, defaultVesselId, initialLayer]);

  if (!isOpen) return null;

  const canUpload = activePersona === 'Administrator' || activePersona === 'Submitter';

  /*
    what: handles file attachment selection and stages document for user verification before AI extraction.
    how: sets fileName state and enables isPendingVerification preview gate.
    with what file: src/components/modals/DocumentUploadModal.tsx.
  */
  const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
  const EVIDENCE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.tif,.tiff';

  const validateEvidenceFile = (name: string, size?: number): string | null => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
      return 'Word documents (.doc, .docx) are not accepted. Please upload PDF, TIFF, or image files.';
    }
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff'];
    if (!allowed.some((ext) => lower.endsWith(ext))) {
      return 'Unsupported file type. Please upload PDF, TIFF, or image files.';
    }
    if (typeof size === 'number' && size > MAX_EVIDENCE_BYTES) {
      return 'File size exceeds the maximum allowed limit of 25 MB.';
    }
    return null;
  };

  const handleSelectFileForPreview = (selectedName: string, selectedSize?: number) => {
    const validationError = validateEvidenceFile(selectedName, selectedSize);
    if (validationError) {
      setErrorMessage(validationError);
      setIsPendingVerification(false);
      return;
    }
    setErrorMessage('');
    setFileName(selectedName);
    if (typeof selectedSize === 'number') {
      setFileSizeBytes(selectedSize);
    }
    setIsPendingVerification(true);
    setIsAiExtracted(false);
    setIsExtractingAi(false);
    setExtractionFailed(false);
    setIsHandEntered(false);
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
      handleSelectFileForPreview(droppedFile.name, droppedFile.size);
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
    setExtractionFailed(false);
    setRevealedFields({ certNo: false, authority: false, expiry: false, summary: false });

    const selectedVesselObj = vessels.find((v) => v.id === vesselId);
    const authority = isCrew
      ? 'Australian Maritime Safety Authority (AMSA)'
      : selectedVesselObj?.classificationSociety
      ? `${selectedVesselObj.classificationSociety} Classification Society`
      : 'DNV Classification Society';

    /* demo failure when the file name signals a bad scan (A55 / Task 5492) */
    const shouldFailExtraction = /fail|corrupt|illegible/i.test(selectedName);

    /* step 1: complete ai scan after 1100ms then reveal fields with staggered delays */
    setTimeout(() => {
      setIsExtractingAi(false);
      if (shouldFailExtraction) {
        setExtractionFailed(true);
        setIsAiExtracted(false);
        setAiOcrConfidence(0);
        return;
      }
      setIsAiExtracted(true);
      setIsNewExtractionAnimate(true);
      setExtractionKey((prev) => prev + 1);
      setAiOcrConfidence(99.2);

      /* stagger 1: certificate number — the demo extraction fills a mock number the user can edit, so the upload can finish */
      setTimeout(() => {
        const mockCertNo = isCrew
          ? `AMSA-STCW-2026-${Math.floor(1000 + Math.random() * 9000)}`
          : `DEMO-${selectedName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'DOC'}-${String(Math.abs(Array.from(selectedName).reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7)) % 100000).padStart(5, '0')}`;
        setCertificateNo((prev) => (prev.trim() ? prev : mockCertNo));
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

      /* stagger 3: expiry date — the demo extraction fills a mock date two years out the user can edit */
      setTimeout(() => {
        const mockExpiry = new Date();
        mockExpiry.setFullYear(mockExpiry.getFullYear() + 2);
        setExpiryDate((prev) => (prev ? prev : mockExpiry.toISOString().slice(0, 10)));
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

  const handleRetryExtraction = () => {
    setExtractionFailed(false);
    setIsHandEntered(false);
    triggerAiExtraction(fileName);
  };

  const handleEnterByHand = () => {
    setExtractionFailed(false);
    setIsHandEntered(true);
    setIsAiExtracted(true);
    setIsManualEditActive(true);
    setAiOcrConfidence(0);
    setRevealedFields({ certNo: true, authority: true, expiry: true, summary: true });
    setCertificateNo('');
    setIssuingAuthority('');
    setExpiryDate('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleSelectFileForPreview(selectedFile.name, selectedFile.size);
    }
    e.target.value = '';
  };

  const handleSampleFileClick = (sampleName: string) => {
    handleSelectFileForPreview(sampleName);
  };

  /* an inspection report on a requirement: its validity sets the expiry date */
  const isInspectionUpload = !existingDocument && requirementCategory === 'Inspection Report';
  const updateInspectionValidity = (reportDate: string, months: number) => {
    setInspectionReportDate(reportDate);
    setInspectionValidityMonths(months);
    const validUntil = getInspectionValidUntil(reportDate, months);
    if (validUntil) setExpiryDate(validUntil);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    if (!canUpload || !title.trim()) return;

    if (isCrew) {
      const finalCertNo = certificateNo.trim() || `AMSA-STCW-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const finalAuthority = issuingAuthority.trim() || 'Australian Maritime Safety Authority (AMSA)';
      const finalExpiry = expiryDate || '2031-01-01';

      setIsUploading(true);
      setUploadProgress(15);
      setStatusMessage('Reading STCW document byte stream and preparing secure payload...');
      setTimeout(() => { setUploadProgress(45); setStatusMessage('Uploading document...'); }, 350);
      setTimeout(() => { setUploadProgress(80); setStatusMessage('Verifying AI extracted attributes and validating AMSA / Flag authority...'); }, 750);
      setTimeout(() => { setUploadProgress(100); setStatusMessage('Upload complete! Updating crew compliance log...'); }, 1150);
      setTimeout(() => {
        const crewDoc = existingDocument as STCWDocumentItem | null | undefined;
        const docToSave: STCWDocumentItem = {
          id: crewDoc ? crewDoc.id : (selectedUnassignedDocId || formatDocumentId('CRW', 2026, 'STCW')),
          title: title.trim(),
          layer,
          stcwRegulation: stcwRegulation.trim() || 'STCW Convention Standard',
          certificateNo: finalCertNo,
          issuingAuthority: finalAuthority,
          flagState: flagState.trim() || 'Australia',
          issuingState: issuingState.trim() || undefined,
          endorsingState: endorsingState.trim() || undefined,
          dpLoggedDays: dpLoggedDays.trim() ? Number(dpLoggedDays) : undefined,
          issueDate,
          expiryDate: finalExpiry,
          verificationStatus,
          fileName: (fileName.trim() || `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`),
          fileSizeBytes,
        };
        if (crewDoc) {
          updateCrewDocument(crewId!, docToSave);
        } else {
          addCrewDocument(crewId!, docToSave);
        }
        setIsUploading(false);
        if (onUploadComplete) onUploadComplete();
        onClose();
      }, 1500);
      return;
    }

    /* a document on record is re-uploaded only once it is expired or a reviewer sent it back */
    if (existingDocument && getDocumentReuploadBlockReason(existingDocument as MasterDocument, notifications)) return;

    /* a new document needs its certificate no. and expiry entered; nothing is made up for it (gap review E7) */
    if (!existingDocument && (!certificateNo.trim() || !expiryDate)) return;
    if (isInspectionUpload && (!inspectionSource || !inspectionReportDate)) return;
    const inspectionReport: InspectionReportEvidence | undefined =
      isInspectionUpload && inspectionSource
        ? {
          source: inspectionSource,
          reportDate: inspectionReportDate,
          validityMonths: inspectionValidityMonths,
          inspectorAccreditation: inspectorAccreditation.trim() || undefined,
        }
        : undefined;
    const finalCertNo = certificateNo.trim() || (existingDocument as MasterDocument)?.certificateNo || '';
    const finalAuthority = issuingAuthority.trim() || (existingDocument as MasterDocument)?.issuingAuthority || '';
    const finalExpiry = expiryDate || (existingDocument as MasterDocument)?.expiryDate || '';

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
      const masterDoc = existingDocument as MasterDocument | null | undefined;

      if (masterDoc) {
        const nextVerLabel = `v1.${masterDoc.versions.length}`;
        addDocumentVersion(
          masterDoc.id,
          nextVerLabel,
          finalFileName,
          fileSizeBytes,
          changeSummary.trim() || 'New version uploaded.',
          finalExpiry,
          assuranceSetId && requirementId ? { assuranceSetId, requirementId } : undefined,
        );
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
          complianceState: getComplianceStateForExpiry(finalExpiry),
          currentVersion: 'v1.0',
          versions: [
            {
              versionLabel: 'v1.0',
              uploadedAt: new Date().toISOString(),
              uploadedBy: sessionUser?.id || activePersona,
              fileSizeBytes: fileSizeBytes,
              fileName: finalFileName,
              changeSummary: changeSummary.trim() || 'Initial Master Document submission with AI extracted metadata.',
              scanDetails: { dpi: 300, pageCount: 1, resolutionDpi: 300 },
              perFieldConfidence: { certNo: finalCertNo && !finalCertNo.includes('partially legible') ? 98 : 61, certificateNo: finalCertNo && !finalCertNo.includes('partially legible') ? 98 : 61, issuingAuthority: finalAuthority && !finalAuthority.includes('illegible') ? 97 : 44, expiryDate: finalExpiry ? 98 : 79 },
            },
          ],
          vesselAttributes:
            entityType === 'Vessel Certificate'
              ? {
                title,
                certificateNumber: finalCertNo,
                certType: 'Statutory Certificate',
                issuingBody: finalAuthority,
                issueDate: '',
                expiryDate: finalExpiry,
                vesselName: targetVesselObj?.name || '',
                imoNumber: targetVesselObj?.imoNumber || '',
                flagState: targetVesselObj?.flagState || '',
                assetMatchFlag: false,
                lastSurveyDate: '',
                ocrConfidence: aiOcrConfidence || 99,
                status: getComplianceStateForExpiry(finalExpiry),
              }
              : undefined,
          validationRules: {
            charterBufferPassed: false,
            assetMatch100Percent: false,
            iacsAuthorityValid: false,
            overallValid: false,
            rulesNotChecked: true,
          },
          verificationStatus: 'Pending',
          isHandEntered: isHandEntered || undefined,
        };
        if (selectedUnassignedDocId) {
          const chosenDoc = documents.find((d) => d.id === selectedUnassignedDocId);
          if (chosenDoc) {
            if (assuranceSetId) {
              uploadDocumentForRequirement(assuranceSetId, requirementId, chosenDoc, inspectionReport);
            }
          }
        } else if (assuranceSetId) {
          uploadDocumentForRequirement(assuranceSetId, requirementId, newDoc, inspectionReport);
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
  const hasExtractedSpecs = Boolean(isAiExtracted || isHandEntered || (existingDocument && fileName));

  const previewDoc: MasterDocument = {
    id: existingDocument?.id || 'DOC-UPLOAD-PREVIEW',
    title: title || existingDocument?.title || fileName || 'International Oil Pollution Prevention (IOPP)',
    entityType,
    vesselId: vesselId || masterDocExisting?.vesselId || 'AUSP1VSR619',
    certificateNo: certificateNo || existingDocument?.certificateNo || '',
    issuingAuthority: issuingAuthority || existingDocument?.issuingAuthority || '',
    expiryDate: expiryDate || existingDocument?.expiryDate || '',
    ocrConfidence: Math.round(aiOcrConfidence),
    complianceState: masterDocExisting?.complianceState || 'Valid',
    currentVersion: masterDocExisting?.currentVersion || 'v1.0',
    versions: masterDocExisting?.versions || [
      {
        versionLabel: 'v1.0',
        uploadedAt: new Date().toISOString(),
        uploadedBy: activePersona,
        fileSizeBytes: 640000,
        fileName: fileName || 'iopp-annex1-scan.pdf',
        changeSummary: changeSummary || 'Uploaded statutory certificate',
      },
    ],
    vesselAttributes: masterDocExisting?.vesselAttributes || {
      title: title || 'International Oil Pollution Prevention (IOPP)',
      certificateNumber: certificateNo || '',
      certType: 'Statutory Pollution Prevention Certificate',
      issuingBody: issuingAuthority || '',
      issueDate: '',
      expiryDate: expiryDate || '',
      vesselName: vessels.find((v) => v.id === vesselId)?.name || 'MAP Demo Vessel AUSP1',
      imoNumber: vessels.find((v) => v.id === vesselId)?.imoNumber || '9123453',
      flagState: vessels.find((v) => v.id === vesselId)?.flagState || 'Australia (Sample)',
      assetMatchFlag: false,
      lastSurveyDate: '',
      ocrConfidence: Math.round(aiOcrConfidence),
      status: 'Valid',
    },
    validationRules: masterDocExisting?.validationRules || {
      charterBufferPassed: false,
      assetMatch100Percent: false,
      iacsAuthorityValid: false,
      overallValid: false,
      rulesNotChecked: true,
    },
    verificationStatus: masterDocExisting?.verificationStatus || 'Pending',
  };

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
            accept={EVIDENCE_ACCEPT}
          />

          <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3 position-relative">
            <div>
              <h5 className="modal-title fw-bold text-slate-900 m-0">
                {modalTitle
                  ? modalTitle
                  : existingDocument
                    ? `Upload New Version — ${existingDocument.title}`
                    : isCrew
                      ? `Upload Document — ${crewName}`
                      : requirementTitle
                        ? `Upload Document — ${requirementTitle}`
                        : assuranceSetId
                          ? 'Upload Document'
                          : 'Upload Preassurance Document'}
              </h5>
              {isCrew && crewName && (
                <div className="text-secondary small font-mono-code">
                  Crew: <strong>{crewName}</strong> ({crewId})
                </div>
              )}
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
                <div className="alert alert-danger py-2 px-3 mb-3" role="alert" data-testid="upload-file-error">
                  {errorMessage}
                </div>
              )}

              {extractionFailed && (
                <div className="alert alert-warning py-3 px-3 mb-3" role="alert" data-testid="extraction-failed-alert">
                  <div className="fw-semibold mb-1">Extraction failed</div>
                  <div className="small mb-3">
                    The scan could not be read with enough confidence. Retry extraction or enter the certificate details by hand.
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleRetryExtraction}>
                      Retry Extraction
                    </button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={handleEnterByHand}>
                      Enter by Hand
                    </button>
                  </div>
                </div>
              )}

              {isHandEntered && (
                <div
                  className="badge text-dark mb-3 align-self-start"
                  data-testid="hand-entered-badge"
                  style={{ backgroundColor: '#fde68a', border: '1px solid #f59e0b', fontSize: '0.75rem' }}
                >
                  Hand-entered (Manual Fallback)
                </div>
              )}

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
                              DOCUMENT PREVIEW
                            </div>
                            <h5 className="fw-bold text-dark m-0 mb-1" style={{ fontSize: '1.15rem' }}>
                              {title || existingDocument?.title || 'International Oil Pollution Prevention (IOPP)'}
                            </h5>
                            <div className="font-mono-code text-muted small" style={{ fontSize: '0.75rem' }}>
                              {(fileName || masterDocExisting?.versions?.[0]?.fileName || crewDocExisting?.fileName || 'iopp-annex1-scan.jpg')} · {formatFileSize(fileSizeBytes)} · 1 page
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <div className="btn-group btn-group-sm">
                              <button
                                type="button"
                                className={`btn btn-xs fw-semibold ${leftPaneMode === 'pdf' ? 'btn-primary text-white shadow-2xs' : 'btn-outline-secondary'}`}
                                onClick={() => setLeftPaneMode('pdf')}
                              >
                                <FileText className="w-3.5 h-3.5 d-inline me-1" />
                                PDF Form
                              </button>
                              <button
                                type="button"
                                className={`btn btn-xs fw-semibold ${leftPaneMode === 'attributes' ? 'btn-primary text-white shadow-2xs' : 'btn-outline-secondary'}`}
                                onClick={() => setLeftPaneMode('attributes')}
                              >
                                Extracted Data
                              </button>
                            </div>
                          </div>
                        </div>

                        {leftPaneMode === 'pdf' ? (
                          <div className="mb-3">
                            <DocumentCertificatePreview document={previewDoc} height="520px" />
                          </div>
                        ) : (
                          (() => {
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
                                    1 of 1 · 300 DPI
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
                                    <span className="ps-0.5 text-dark fw-medium">Resolution 300 DPI</span>
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
                                        {certificateNo || 'Not extracted'}
                                      </div>
                                    )}
                                    {certNoScore < 90 ? (
                                      <div className="small mt-0.5" style={{ fontSize: '0.675rem', color: '#b45309' }}>
                                        Below 90%. Check this field.
                                      </div>
                                    ) : (
                                      <div className="small mt-0.5 text-success fw-bold d-inline-flex align-items-center gap-1" style={{ fontSize: '0.675rem' }}>
                                        <Check className="w-3 h-3 text-success" /> Entered
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
                                        <Check className="w-3 h-3 text-success" /> Entered
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
                                        {expiryDate || 'Not extracted'}
                                      </div>
                                    )}
                                    {expiryScore < 90 ? (
                                      <div className="small mt-0.5" style={{ fontSize: '0.675rem', color: '#b45309' }}>
                                        Below 90%. Check this field.
                                      </div>
                                    ) : (
                                      <div className="small mt-0.5 text-success fw-bold d-inline-flex align-items-center gap-1" style={{ fontSize: '0.675rem' }}>
                                        <Check className="w-3 h-3 text-success" /> Entered
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
                        })())}
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
                  {isInspectionUpload && (
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="inspection-source">
                          Report Source <span className="text-danger">*</span>
                        </label>
                        <select
                          id="inspection-source"
                          className={`form-select form-select-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !inspectionSource ? 'is-invalid' : ''}`}
                          value={inspectionSource}
                          onChange={(e) => setInspectionSource(e.target.value as InspectionReportSource | '')}
                          disabled={isUploading}
                        >
                          <option value="">Choose a source</option>
                          {INSPECTION_REPORT_SOURCES.map((source) => (
                            <option key={source} value={source}>{source}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="inspection-date">
                          Report Date <span className="text-danger">*</span>
                        </label>
                        <input
                          id="inspection-date"
                          type="date"
                          className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !inspectionReportDate ? 'is-invalid' : ''}`}
                          value={inspectionReportDate}
                          onChange={(e) => updateInspectionValidity(e.target.value, inspectionValidityMonths)}
                          disabled={isUploading}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="inspection-validity">
                          Validity (Months)
                        </label>
                        <input
                          id="inspection-validity"
                          type="number"
                          min={1}
                          className="form-control form-control-sm bg-white text-dark border-secondary"
                          value={inspectionValidityMonths}
                          onChange={(e) => updateInspectionValidity(inspectionReportDate, Number(e.target.value) || 0)}
                          disabled={isUploading}
                        />
                        <div className="small text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                          12 months, or 6 for vessels aged 15 or more, per one published charterer procedure. Set the client&apos;s own period.
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="inspection-accreditation">
                          Inspector Accreditation
                        </label>
                        <input
                          id="inspection-accreditation"
                          type="text"
                          className="form-control form-control-sm bg-white text-dark border-secondary"
                          placeholder="e.g. OVID accredited inspector"
                          value={inspectorAccreditation}
                          onChange={(e) => setInspectorAccreditation(e.target.value)}
                          disabled={isUploading}
                        />
                      </div>
                    </div>
                  )}
                  {/* Option A: Upload from Document Library */}
                  {!existingDocument && (() => {
                    const libDocs = isCrew
                      ? documents.filter((d) => {
                          if (d.entityType !== 'Crew Certificate') return false;
                          const vId = d.vesselId?.trim().toUpperCase();
                          return !vId || vId === '' || vId === 'UNASSIGNED' || vId === 'UNLINKED' || vId.startsWith('VESSEL-PENDING');
                        })
                      : unassignedDocuments;
                    return (
                      <div className="p-2.5 bg-light border rounded-3 d-flex flex-column gap-2 mb-1">
                        <div className="d-flex flex-column">
                          <label className="form-label text-secondary small fw-semibold mb-1 text-truncate" htmlFor="lib-doc-select">
                            {isCrew ? 'Fill from Document Library' : 'Select from Document Library'}
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
                              {libDocs.length > 0
                                ? `-- Select from ${libDocs.length} Available Document${libDocs.length > 1 ? 's' : ''} --`
                                : isCrew ? '-- No unassigned crew certificates --' : '-- No library documents available --'}
                            </option>
                            {libDocs.map((doc) => (
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
                    );
                  })()}

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

                  {/* STCW fields — crew kind only */}
                  {isCrew && (
                    <>
                      <div className="row g-2">
                        <div className="col-md-5">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="stcw-reg">
                            STCW Regulation
                          </label>
                          <input
                            id="stcw-reg"
                            type="text"
                            className="form-control form-control-sm bg-white text-dark border-secondary font-mono-code"
                            placeholder="STCW Reg II/2"
                            value={stcwRegulation}
                            onChange={(e) => setStcwRegulation(e.target.value)}
                            disabled={isUploading || isExtractingAi}
                          />
                        </div>
                        <div className="col-md-7">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="cert-no-crew">
                            Certificate No. <span className="text-danger">*</span>
                          </label>
                          <input
                            id="cert-no-crew"
                            type="text"
                            className="form-control form-control-sm bg-white text-dark border-secondary font-mono-code"
                            placeholder="e.g. CoC-II-2-0041"
                            value={certificateNo}
                            onChange={(e) => setCertificateNo(e.target.value)}
                            disabled={isUploading || isExtractingAi}
                          />
                        </div>
                      </div>
                      <div className="row g-2">
                        <div className="col-md-6">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="issuing-auth-crew">
                            Issuing Authority <span className="text-danger">*</span>
                          </label>
                          <input
                            id="issuing-auth-crew"
                            type="text"
                            className="form-control form-control-sm bg-white text-dark border-secondary"
                            placeholder="AMSA Australia"
                            value={issuingAuthority}
                            onChange={(e) => setIssuingAuthority(e.target.value)}
                            disabled={isUploading || isExtractingAi}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="flag-state">
                            Flag State
                          </label>
                          <input
                            id="flag-state"
                            type="text"
                            className="form-control form-control-sm bg-white text-dark border-secondary"
                            placeholder="e.g. Australia / Liberia"
                            value={flagState}
                            onChange={(e) => setFlagState(e.target.value)}
                            disabled={isUploading || isExtractingAi}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="issuing-state">
                            Issuing State
                          </label>
                          <input
                            id="issuing-state"
                            type="text"
                            className="form-control form-control-sm bg-white text-dark border-secondary"
                            placeholder="e.g. Philippines"
                            value={issuingState}
                            onChange={(e) => setIssuingState(e.target.value)}
                            disabled={isUploading || isExtractingAi}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="endorsing-state">
                            Endorsing State
                          </label>
                          <input
                            id="endorsing-state"
                            type="text"
                            className="form-control form-control-sm bg-white text-dark border-secondary"
                            placeholder="e.g. Australia (CoR)"
                            value={endorsingState}
                            onChange={(e) => setEndorsingState(e.target.value)}
                            disabled={isUploading || isExtractingAi}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="dp-days">
                            DP Logged Days
                          </label>
                          <input
                            id="dp-days"
                            type="number"
                            min={0}
                            className="form-control form-control-sm bg-white text-dark border-secondary"
                            placeholder="DP certificates only"
                            value={dpLoggedDays}
                            onChange={(e) => setDpLoggedDays(e.target.value)}
                            disabled={isUploading || isExtractingAi}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="form-label text-secondary small fw-semibold" htmlFor="expiry-date-crew">
                          Expiry Date <span className="text-danger">*</span>
                        </label>
                        <input
                          id="expiry-date-crew"
                          type="date"
                          className="form-control form-control-sm bg-white text-dark border-secondary font-mono-code"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(e.target.value)}
                          disabled={isUploading || isExtractingAi}
                          required
                        />
                      </div>
                    </>
                  )}

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
                disabled={isUploading || isExtractingAi || !title.trim() || (!existingDocument && (!certificateNo.trim() || !expiryDate))}
                title={!existingDocument && (!certificateNo.trim() || !expiryDate) ? 'Enter the certificate no. and expiry date.' : undefined}
              >
                {isUploading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    Uploading...
                  </>
                ) : existingDocument ? (
                  isCrew ? 'Submit Replacement Revision' : 'Upload New Version'
                ) : (
                  isCrew ? 'Upload Certificate' : 'Upload Document'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <UniversalDocumentPreviewModal
        isOpen={isPendingVerification}
        document={previewDoc}
        onClose={() => setIsPendingVerification(false)}
        title="Document Preview (PDF Form)"
        subtitle="Check document scan layout before reading and metadata extraction."
        zIndex={1070}
        extraAction={
          <button
            type="button"
            className="btn btn-sm btn-success fw-bold px-3 d-inline-flex align-items-center gap-1.5"
            onClick={handleConfirmVerifyAndExtract}
          >
            Read Document
          </button>
        }
      />
    </div>
  );
};
