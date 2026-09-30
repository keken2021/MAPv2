/* 
  file summary: comprehensive vessel registration wizard matching UI Screen 2 (UC-02) and all 11 BRD categories.
  responsibilities: captures full maritime specification across a 4-step wizard with validation and store dispatch.
  role in system: invoked from fleet master view (FleetRegistryView.tsx) when clicking "+ Register Vessel".
*/

import React, { useEffect, useState, useRef } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { VesselInformation, ClassificationSociety } from '../../types/vessel';
import { MasterDocument } from '../../types/document';
import { isDuplicateVessel, validateImoNumber } from '../../utils/validation';
import { CURATED_VESSEL_PHOTOS } from '../../utils/vesselImageHelpers';
import { VesselImageCropModal } from './VesselImageCropModal';
import { formatDocumentId } from '../../utils/formatters';

interface VesselModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered?: (vesselId: string) => void;
}

export const VesselModal: React.FC<VesselModalProps> = ({ isOpen, onClose, onRegistered }) => {
  const { addVessel, vessels, documents, addDocument, linkDocumentToVessel, activePersona } = useMapStore();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState('');

  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropModalImageSrc, setCropModalImageSrc] = useState('');
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);

  /* AI extraction and Document Library lookup states (tracked per step/stage) */
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<Record<number, string>>({});
  const [activeVerifiedDocs, setActiveVerifiedDocs] = useState<Record<number, { title: string; certNo: string; docId?: string }>>({});
  const [pendingVerificationState, setPendingVerificationState] = useState<{ fileName: string; stepNumber: number } | null>(null);

  /* per-field reveal state for staggered ai animation */
  const [revealedVesselFields, setRevealedVesselFields] = useState({
    name: false, imoNumber: false, officialRegNumber: false, flagState: false,
    classificationSociety: false, yearBuilt: false, gt: false, dwt: false, registeredOwner: false,
  });

  /* autofill animation state for programmatically populated fields */
  const [animatingFields, setAnimatingFields] = useState<Set<string>>(new Set());

  /*
    what: triggers map-autofill-animate shimmer on specified form inputs.
    how: adds field keys to animatingFields set and removes them after 750ms.
    with what file: src/components/drawers/VesselModal.tsx.
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

  // 1. Vessel Identification
  const [name, setName] = useState('');
  const [previousNames, setPreviousNames] = useState('');
  const [proposedName, setProposedName] = useState('');
  const [imoNumber, setImoNumber] = useState('');
  const [officialRegNumber, setOfficialRegNumber] = useState('');
  const [mmsiNumber, setMmsiNumber] = useState('');
  const [callSign, setCallSign] = useState('');
  const [flagState, setFlagState] = useState('Australia');
  const [portOfRegistry, setPortOfRegistry] = useState('Fremantle, WA');
  const [vesselRegStatus, setVesselRegStatus] = useState<VesselInformation['status']>('Port Stay');
  const [hullIdSmallCraft, setHullIdSmallCraft] = useState('');

  // 2. Vessel Classification
  const [vesselType, setVesselType] = useState('Offshore Support Vessel (OSV)');
  const [vesselSubtype, setVesselSubtype] = useState('AHTS / PSV');
  const [intendedUse, setIntendedUse] = useState('Offshore Supply & Towing');
  const [tradingArea, setTradingArea] = useState('International');
  const [classificationSociety, setClassificationSociety] = useState<ClassificationSociety>('DNV');
  const [classNotation, setClassNotation] = useState('+100A1 Offshore Support Vessel DP2');
  const [classStatus, setClassStatus] = useState('Active / Full Class');
  const [solasMarpolApplicable, setSolasMarpolApplicable] = useState(true);

  // 3. Construction Details
  const [shipyardBuilder, setShipyardBuilder] = useState('');
  const [constructionCountry, setConstructionCountry] = useState('Netherlands');
  const [hullNumber, setHullNumber] = useState('');
  const [yearBuilt, setYearBuilt] = useState<number>(2023);
  const [hullType, setHullType] = useState('Double Hull / Double Bottom Steel');
  const [isNewBuild, setIsNewBuild] = useState('Existing Vessel');
  const [loa, setLoa] = useState<number>(84.5);
  const [beam, setBeam] = useState<number>(18.0);
  const [draft, setDraft] = useState<number>(5.8);
  const [gt, setGt] = useState<number>(3400);
  const [dwt, setDwt] = useState<number>(4200);

  // 4 & 5. Ownership, Operators & Management
  const isInitialAdmin = useMapStore.getState().activePersona === 'Administrator';
  const [registeredOwner, setRegisteredOwner] = useState(isInitialAdmin ? 'Northwind Marine Pty Ltd' : '');
  const [ownerType, setOwnerType] = useState('Corporate Entity');
  const [corporateRegNo, setCorporateRegNo] = useState(isInitialAdmin ? 'ACN 552 109 841' : '');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [ismCompany, setIsmCompany] = useState(isInitialAdmin ? 'Northwind Marine Pty Ltd' : '');
  const [technicalManager, setTechnicalManager] = useState(isInitialAdmin ? 'Northwind Marine Pty Ltd' : '');
  const [commercialManager, setCommercialManager] = useState(isInitialAdmin ? 'Northwind Marine Pty Ltd' : '');
  const [docNumber, setDocNumber] = useState('');
  const [contact247, setContact247] = useState(isInitialAdmin ? '+61 8 9185 2200 (24/7 Ops)' : '');

  // 6. Purchase & Title
  const [methodOfAcquisition, setMethodOfAcquisition] = useState('Outright Purchase');
  const [mortgageStatus, setMortgageStatus] = useState('Free from Encumbrance');

  // 8. Insurance & Security
  const [hmInsurer, setHmInsurer] = useState('Gard Marine Underwriters');
  const [piClubName, setPiClubName] = useState('Gard P&I Club');
  const [policyNumber, setPolicyNumber] = useState('PI-2026-9041');
  const [policyExpiryDate, setPolicyExpiryDate] = useState('2027-02-20');

  // 9. Crew & Safety Information
  const [safeManningComplement, setSafeManningComplement] = useState<number>(14);
  const [maxCrewCapacity, setMaxCrewCapacity] = useState<number>(28);
  const [masterName, setMasterName] = useState('');
  const [lifeboatCapacity, setLifeboatCapacity] = useState<number>(30);

  // 10. Environmental Information
  const [fuelType, setFuelType] = useState('MGO Low-Sulphur 0.1%');
  const [bwtsSpec, setBwtsSpec] = useState('Alfa Laval PureBallast 3.2');
  const [registrationDocName, setRegistrationDocName] = useState('');
  const [classCertDocName, setClassCertDocName] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep(1);
    setErrorMessage('');
    setUploadNotice('');
    setRegistrationDocName('');
    setClassCertDocName('');
    setIsExtractingAi(false);
    setAiNotice('');
    setSelectedDocIds({});
    setActiveVerifiedDocs({});
    setPendingVerificationState(null);
    setVesselRegStatus('Port Stay');
    setImageUrl('');
    setPhotos([]);
    setRevealedVesselFields({ name: false, imoNumber: false, officialRegNumber: false, flagState: false, classificationSociety: false, yearBuilt: false, gt: false, dwt: false, registeredOwner: false });

    if (activePersona === 'Administrator') {
      setRegisteredOwner('Northwind Marine Pty Ltd');
      setCorporateRegNo('ACN 552 109 841');
      setIsmCompany('Northwind Marine Pty Ltd');
      setTechnicalManager('Northwind Marine Pty Ltd');
      setCommercialManager('Northwind Marine Pty Ltd');
      setContact247('+61 8 9185 2200 (24/7 Ops)');
    } else {
      setRegisteredOwner('');
      setCorporateRegNo('');
      setIsmCompany('');
      setTechnicalManager('');
      setCommercialManager('');
      setContact247('');
    }
  }, [isOpen, activePersona]);


  if (!isOpen) return null;

  const validateStepOneIdentifiers = () => {
    if (!name.trim()) {
      setErrorMessage('Vessel Name is mandatory.');
      return false;
    }
    if (!validateImoNumber(imoNumber)) {
      setErrorMessage('IMO Number must be exactly 7 digits (e.g. 9123456).');
      return false;
    }
    if (!officialRegNumber.trim()) {
      setErrorMessage('Official Registration Number is mandatory.');
      return false;
    }

    const dupCheck = isDuplicateVessel(imoNumber, officialRegNumber, vessels);
    if (dupCheck.isDuplicate) {
      setErrorMessage(dupCheck.reason || 'A vessel with this IMO or Official Registration Number is already registered.');
      return false;
    }

    return true;
  };

  const validateCurrentStep = () => {
    setErrorMessage('');
    if (currentStep === 1) {
      return validateStepOneIdentifiers();
    }
    if (currentStep === 2) {
      if (!registeredOwner.trim()) {
        setErrorMessage('Registered Owner Name is required.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrevious = () => {
    setErrorMessage('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e?: React.SyntheticEvent) => {
    e?.preventDefault();

    if (currentStep !== 4) {
      return;
    }

    if (!validateStepOneIdentifiers()) {
      setCurrentStep(1);
      return;
    }

    if (!validateCurrentStep()) return;

    const newVessel: VesselInformation = {
      id: `VESSEL-${Math.floor(100 + Math.random() * 900)}`,
      name,
      previousNames: previousNames || undefined,
      imoNumber,
      officialRegNumber,
      mmsiNumber: mmsiNumber || '503998124',
      callSign: callSign || 'VJQ8821',
      flagState,
      portOfRegistry,
      status: vesselRegStatus,
      complianceReadinessScore: registrationDocName || classCertDocName ? 92 : 85,
      imageUrl: imageUrl.trim() ? imageUrl.trim() : (photos.length > 0 ? photos[0] : undefined),
      photos: photos.length > 0 ? photos : (imageUrl.trim() ? [imageUrl.trim()] : undefined),
      vesselType,
      vesselSubtype,
      intendedUse,
      tradingArea,
      classificationSociety,
      classNotation,
      hullType,
      ispsSolasStatus: solasMarpolApplicable ? 'Certified SOLAS / ISPS' : 'Exempt',
      yearBuilt,
      shipyardBuilder: shipyardBuilder || 'Damen Shipyards',
      lengthOverallMeters: loa,
      beamMeters: beam,
      draftMeters: draft,
      grossTonnageGT: gt,
      deadweightTonnageDWT: dwt,
      dynamicPositioningClass: 'DP2 (Kongsberg)',
      mainEnginePowerKW: '2x 2600 kW Wärtsilä',
      registeredOwner,
      ownerType,
      corporateRegistryNo: corporateRegNo || 'ACN 912 345 678',
      ismCompany: ismCompany || registeredOwner,
      technicalManager: technicalManager || registeredOwner,
      docNumber: docNumber || 'DOC-DNV-2026-01',
      contact247: contact247 || '+61 8 9222 3344',
      statutoryCertificates: [
        {
          id: formatDocumentId('VES', yearBuilt, 'STAT'),
          name: 'Certificate of Class',
          certificateNumber: `${classificationSociety}-STAT-${yearBuilt}-01`,
          issuingBody: classificationSociety,
          issueDate: '2024-01-15',
          expiryDate: '2029-01-14',
          status: 'Valid',
        },
      ],
      hmInsurer,
      piClubName,
      policyNumber,
      policyExpiryDate,
      safeManningComplement,
      certifiedOfficersRatings: '6 Officers / 8 Ratings',
      masterName: masterName || 'Capt. Andrew Fraser',
      lifeboatCapacity,
      fuelType,
      lowSulphurCompliant: true,
      bwtsSpec,
      owCalibrationDate: '2026-01-10',
      masterCertificateUploadCount: (registrationDocName ? 1 : 0) + (classCertDocName ? 1 : 0),
      clientHistory: [],
    };

    const res = addVessel(newVessel);
    if (!res.success) {
      setErrorMessage(res.message || 'Error registering vessel.');
      if (res.message?.toLowerCase().includes('already registered')) {
        setCurrentStep(1);
      }
      return;
    }

    if (res.vesselId) {
      Object.values(selectedDocIds).forEach((docId) => {
        if (docId) {
          linkDocumentToVessel(docId, res.vesselId!, name, imoNumber);
        }
      });
    }

    onClose();
    if (res.vesselId && onRegistered) {
      onRegistered(res.vesselId);
    }
  };

  const handleMockFileSelect = (file: File | undefined, type: 'registration' | 'class') => {
    if (!file) return;
    if (type === 'registration') {
      setRegistrationDocName(file.name);
    } else {
      setClassCertDocName(file.name);
    }
    setUploadNotice(`${file.name} queued for Pre-Assurance Vault (mock upload).`);
  };

  /*
    what: auto-fills vessel registration fields from an existing document library record for a specific stage.
    how: extracts vessel attributes from MasterDocument model, updates form fields and updates activeVerifiedDocs for that step.
    with what file: src/components/drawers/VesselModal.tsx.
  */
  const autoFillFromDocument = (doc: MasterDocument, stepNumber: number) => {
    /* reset all reveal flags before staggered fill */
    setRevealedVesselFields({ name: false, imoNumber: false, officialRegNumber: false, flagState: false, classificationSociety: false, yearBuilt: false, gt: false, dwt: false, registeredOwner: false });

    const doFill = () => {
      if (doc.vesselAttributes) {
        if (doc.vesselAttributes.vesselName) {
          setTimeout(() => {
            setName(doc.vesselAttributes!.vesselName!);
            setRevealedVesselFields((p) => ({ ...p, name: true }));
            triggerAutofillAnimation(['vessel-name']);
          }, 0);
        }
        if (doc.vesselAttributes.imoNumber) {
          setTimeout(() => {
            setImoNumber(doc.vesselAttributes!.imoNumber!);
            setRevealedVesselFields((p) => ({ ...p, imoNumber: true }));
            triggerAutofillAnimation(['imo-number']);
          }, 150);
        }
        if (doc.vesselAttributes.flagState) {
          setTimeout(() => {
            setFlagState(doc.vesselAttributes!.flagState!);
            setRevealedVesselFields((p) => ({ ...p, flagState: true }));
            triggerAutofillAnimation(['flag-state']);
          }, 300);
        }
        if (doc.vesselAttributes.issuingBody) {
          const body = doc.vesselAttributes.issuingBody;
          if (['DNV', 'ABS', "Lloyd's Register", 'Bureau Veritas', 'RINA'].includes(body)) {
            setTimeout(() => {
              setClassificationSociety(body as ClassificationSociety);
              setRevealedVesselFields((p) => ({ ...p, classificationSociety: true }));
              triggerAutofillAnimation(['classification-society']);
            }, 450);
          }
        }
      } else {
        if (doc.title) {
          const cleaned = doc.title.replace(/Certificate of Class|Certificate of Registry/i, '').trim();
          setTimeout(() => {
            setName(cleaned || 'MV Pacific Leader');
            setRevealedVesselFields((p) => ({ ...p, name: true }));
            triggerAutofillAnimation(['vessel-name']);
          }, 0);
        }
      }

      if (doc.certificateNo) {
        setTimeout(() => {
          setOfficialRegNumber(doc.certificateNo);
          setRevealedVesselFields((p) => ({ ...p, officialRegNumber: true }));
          triggerAutofillAnimation(['official-reg-number']);
        }, 200);
      }
      if (!registeredOwner) {
        setTimeout(() => {
          setRegisteredOwner('Pacific Ocean Logistics Pty Ltd');
          setRevealedVesselFields((p) => ({ ...p, registeredOwner: true }));
          triggerAutofillAnimation(['registered-owner']);
        }, 550);
      }

      setSelectedDocIds((prev) => ({ ...prev, [stepNumber]: doc.id }));
      setActiveVerifiedDocs((prev) => ({
        ...prev,
        [stepNumber]: { title: doc.title, certNo: doc.certificateNo || doc.id, docId: doc.id },
      }));
      setAiNotice(`Auto-filled & verified specs from Document Library record: "${doc.title}" (${doc.certificateNo || doc.id}) for Stage ${stepNumber}!`);
    };

    doFill();
  };

  const handleStageVesselFileForVerification = (fileOrName: File | string, stepNumber: number) => {
    const nameStr = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
    setPendingVerificationState({ fileName: nameStr, stepNumber });
    setAiNotice('');
  };

  const handleConfirmVesselFileVerification = () => {
    if (pendingVerificationState) {
      const { fileName, stepNumber } = pendingVerificationState;
      setPendingVerificationState(null);
      handleAiFileUpload(fileName, stepNumber);
    }
  };

  /*
    what: processes file attachment during vessel registration for AI OCR extraction and document library insertion per stage.
    how: checks if matching document exists in store; if present, auto-fills from it; if missing, extracts details, auto-fills form, and calls addDocument.
    with what file: src/components/drawers/VesselModal.tsx.
  */
  const handleAiFileUpload = (fileOrName: File | string, stepNumber: number) => {
    const fileNameStr = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
    setIsExtractingAi(true);
    setAiNotice('');
    setRevealedVesselFields({ name: false, imoNumber: false, officialRegNumber: false, flagState: false, classificationSociety: false, yearBuilt: false, gt: false, dwt: false, registeredOwner: false });

    setTimeout(() => {
      const extractedImo = `94${Math.floor(10000 + Math.random() * 90000)}`;
      const extractedCertNo = `DNV-STAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const extractedVesselName = fileNameStr.toLowerCase().includes('coral')
        ? 'MV Coral Titan'
        : fileNameStr.toLowerCase().includes('tasman')
          ? 'MV Tasman Pioneer'
          : fileNameStr.toLowerCase().includes('leader')
            ? 'MV Pacific Leader'
            : 'MV Pacific Pioneer';

      /* check if document already exists in document library */
      const existingDoc = documents.find(
        (d) =>
          d.certificateNo === extractedCertNo ||
          d.title.toLowerCase().includes(fileNameStr.toLowerCase()) ||
          (d.vesselAttributes?.vesselName?.toLowerCase() === extractedVesselName.toLowerCase() && d.entityType === 'Vessel Certificate')
      );

      if (existingDoc) {
        autoFillFromDocument(existingDoc, stepNumber);
        setAiNotice(`Found matching document in Document Library ("${existingDoc.title}", Cert: ${existingDoc.certificateNo}). Automatically filled vessel Information for Stage ${stepNumber}!`);
      } else {
        /* stagger each field reveal by 150ms */
        setTimeout(() => {
          setName(extractedVesselName);
          setRevealedVesselFields((p) => ({ ...p, name: true }));
          triggerAutofillAnimation(['vessel-name']);
        }, 0);
        setTimeout(() => {
          setImoNumber(extractedImo);
          setRevealedVesselFields((p) => ({ ...p, imoNumber: true }));
          triggerAutofillAnimation(['imo-number']);
        }, 150);
        setTimeout(() => {
          setOfficialRegNumber(`OSV-REG-${Math.floor(100 + Math.random() * 900)}`);
          setRevealedVesselFields((p) => ({ ...p, officialRegNumber: true }));
          triggerAutofillAnimation(['official-reg-number']);
        }, 300);
        setTimeout(() => {
          setFlagState('Australia');
          setRevealedVesselFields((p) => ({ ...p, flagState: true }));
          triggerAutofillAnimation(['flag-state']);
        }, 450);
        setTimeout(() => {
          setClassificationSociety('DNV');
          setRevealedVesselFields((p) => ({ ...p, classificationSociety: true }));
          triggerAutofillAnimation(['classification-society']);
        }, 600);
        setTimeout(() => {
          setYearBuilt(2023);
          setRevealedVesselFields((p) => ({ ...p, yearBuilt: true }));
          triggerAutofillAnimation(['year-built']);
        }, 750);
        setTimeout(() => {
          setGt(3800);
          setDwt(4600);
          setRevealedVesselFields((p) => ({ ...p, gt: true, dwt: true }));
          triggerAutofillAnimation(['gt', 'dwt']);
        }, 900);
        setTimeout(() => {
          setRegisteredOwner('Pacific Ocean Logistics Pty Ltd');
          setRevealedVesselFields((p) => ({ ...p, registeredOwner: true }));
          triggerAutofillAnimation(['registered-owner']);
        }, 1050);

        const newDocId = formatDocumentId('VES', 2026, 'CLAS');
        const newMasterDoc: MasterDocument = {
          id: newDocId,
          title: `Certificate of Class — ${extractedVesselName}`,
          entityType: 'Vessel Certificate',
          vesselId: `VESSEL-PENDING-${Math.floor(100 + Math.random() * 900)}`,
          certificateNo: extractedCertNo,
          issuingAuthority: 'DNV Classification Society',
          expiryDate: '2029-06-30',
          ocrConfidence: 99.1,
          complianceState: 'Valid',
          currentVersion: 'v1.0',
          versions: [
            {
              versionLabel: 'v1.0',
              uploadedAt: new Date().toISOString(),
              uploadedBy: 'Vessel Registration Admin',
              fileSizeBytes: 2400000,
              fileName: fileNameStr,
              changeSummary: 'Uploaded during Vessel Registration with AI OCR extracted specifications.',
            },
          ],
          vesselAttributes: {
            title: `Certificate of Class — ${extractedVesselName}`,
            certificateNumber: extractedCertNo,
            certType: 'Statutory Certificate',
            issuingBody: 'DNV',
            issueDate: '2024-01-15',
            expiryDate: '2029-06-30',
            vesselName: extractedVesselName,
            imoNumber: extractedImo,
            flagState: 'Australia',
            assetMatchFlag: true,
            lastSurveyDate: '2025-06-01',
            ocrConfidence: 99.1,
            status: 'Valid',
          },
          validationRules: {
            charterBufferPassed: true,
            assetMatch100Percent: true,
            iacsAuthorityValid: true,
            overallValid: true,
          },
          verificationStatus: 'Verified',
        };

        addDocument(newMasterDoc);
        setSelectedDocIds((prev) => ({ ...prev, [stepNumber]: newDocId }));
        setRegistrationDocName(fileNameStr);
        setActiveVerifiedDocs((prev) => ({
          ...prev,
          [stepNumber]: { title: newMasterDoc.title, certNo: extractedCertNo, docId: newDocId },
        }));
        setAiNotice(`AI Extracted vessel specs from "${fileNameStr}" for Stage ${stepNumber} & added Certificate (${extractedCertNo}) to Document Library!`);
      }

      setIsExtractingAi(false);
    }, 1100);
  };

  const handleSelectExistingDoc = (docId: string, stepNumber: number) => {
    if (!docId) {
      setSelectedDocIds((prev) => {
        const next = { ...prev };
        delete next[stepNumber];
        return next;
      });
      setActiveVerifiedDocs((prev) => {
        const next = { ...prev };
        delete next[stepNumber];
        return next;
      });
      return;
    }
    const found = documents.find((d) => d.id === docId);
    if (found) {
      autoFillFromDocument(found, stepNumber);
    }
  };

  /*
    what: checks if a document is already attached or assigned to a registered vessel.
    how: checks document vesselId and vesselAttributes vesselName against registered fleet.
    with what file: src/components/drawers/VesselModal.tsx.
  */
  const isDocumentAttachedToVessel = (doc: MasterDocument): boolean => {
    if (doc.vesselId && doc.vesselId !== '' && doc.vesselId !== 'UNASSIGNED' && doc.vesselId !== 'UNLINKED' && !doc.vesselId.startsWith('VESSEL-PENDING')) {
      if (vessels.some((v) => v.id === doc.vesselId)) {
        return true;
      }
    }

    if (doc.vesselAttributes?.vesselName) {
      const vName = doc.vesselAttributes.vesselName.trim().toLowerCase();
      if (vName && vName !== 'unassigned' && vName !== 'pending' && vessels.some((v) => v.name.trim().toLowerCase() === vName)) {
        return true;
      }
    }

    return false;
  };

  /* Filter documents to ONLY show unassigned / unconnected documents for vessel registration auto-fill */
  const unassignedDocuments = documents.filter((d) => {
    if (d.entityType !== 'Vessel Certificate') return false;
    return !isDocumentAttachedToVessel(d);
  });

  /*
    what: retrieves available unassigned certificates for a specific registration stage.
    how: excludes certificates that are already selected in any other stage of this registration session.
    with what file: src/components/drawers/VesselModal.tsx.
  */
  const getAvailableDocsForStep = (stepNumber: number) => {
    return unassignedDocuments.filter((doc) => {
      const isSelectedInOtherStep = Object.entries(selectedDocIds).some(
        ([step, id]) => Number(step) !== stepNumber && id === doc.id
      );
      return !isSelectedInOtherStep;
    });
  };

  /*
    what: renders the reusable AI Document Intake & Library Auto-Fill card for each section of vessel registration.
    how: combines auto-fill select from unassigned master docs and drag-and-drop / clickable file upload with verification gate.
    with what file: src/components/drawers/VesselModal.tsx.
  */
  const renderAiDocumentIntakeCard = (sectionTitle: string, stepNumber: number) => {
    const activeDoc = activeVerifiedDocs[stepNumber];
    const stepSelectedDocId = selectedDocIds[stepNumber] || '';
    const availableDocs = getAvailableDocsForStep(stepNumber);

    return (
      <div className="p-3 bg-light border rounded shadow-2xs mb-3 overflow-hidden">
        <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
          <span className="fw-bold text-dark small d-flex align-items-center gap-2">
            <span>AI Document Intake &amp; Auto-Fill — {sectionTitle}</span>
            <span className="badge bg-primary text-white font-mono-code" style={{ fontSize: '0.7rem' }}>
              Automated OCR
            </span>
          </span>
        </div>

        {/* Single Unified Active Extracted & Verified Document Status Banner for this section */}
        {activeDoc && (
          <div className="p-3 bg-success-subtle border border-success-subtle rounded mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2.5">
              <div>
                <strong className="text-dark small d-block">Active Extracted &amp; Verified Document</strong>
                <div className="text-success-emphasis small font-mono-code fw-bold">
                  "{activeDoc.title}" ({activeDoc.certNo || 'VERIFIED'})
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
              <button
                type="button"
                className="btn btn-sm btn-outline-success bg-white text-success fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs"
                style={{ fontSize: '0.75rem' }}
                onClick={() => {
                  setActiveVerifiedDocs((prev) => {
                    const next = { ...prev };
                    delete next[stepNumber];
                    return next;
                  });
                  setSelectedDocIds((prev) => {
                    const next = { ...prev };
                    delete next[stepNumber];
                    return next;
                  });
                }}
                title="Clear active document for this section and re-upload or select a different file"
              >
                Re-upload / Change File
              </button>
            </div>
          </div>
        )}

        {/* Option A & Option B Intake Row (Hidden when a document is active & verified for this section) */}
        {!activeDoc && (
          <div className="row g-2 align-items-start mb-2">
            {/* Option A: Auto-fill from Existing Document Library */}
            <div className="col-md-6 d-flex flex-column">
              <label className="form-label text-secondary small fw-semibold mb-1 text-truncate" htmlFor={`existing-doc-select-${stepNumber}`}>
                Option A: Auto-Fill from the Document Library
              </label>
              <select
                id={`existing-doc-select-${stepNumber}`}
                className="form-select form-select-sm bg-white text-dark border-secondary w-100"
                style={{ height: '38px', fontSize: '0.8125rem' }}
                value={stepSelectedDocId}
                onChange={(e) => handleSelectExistingDoc(e.target.value, stepNumber)}
                disabled={isExtractingAi}
              >
                <option value="">
                  {availableDocs.length > 0
                    ? `-- Select from ${availableDocs.length} Unassigned Document${availableDocs.length > 1 ? 's' : ''} --`
                    : '-- No available unassigned certificates --'}
                </option>
                {availableDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.certificateNo || doc.id}) — Unassigned
                  </option>
                ))}
              </select>
            </div>

            {/* Option B: Drag & Drop / Clickable File Upload for AI Extraction */}
            <div className="col-md-6 d-flex flex-column">
              <label className="form-label text-secondary small fw-semibold mb-1 text-truncate">
                Option B: Drag &amp; Drop / Click File
              </label>
              <div
                className="border border-dashed border-primary rounded bg-white p-2 text-center cursor-pointer hover-bg-light transition-all d-flex align-items-center justify-content-center gap-2 w-100"
                style={{ borderStyle: 'dashed', borderWidth: '1.5px', height: '38px' }}
                onClick={() => aiFileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleStageVesselFileForVerification(file, stepNumber);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="small text-dark fw-semibold text-truncate" style={{ fontSize: '0.8125rem' }}>
                  Drop document file here or <span className="text-primary text-decoration-underline">browse</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Active Extraction Indicator */}
        {isExtractingAi && (
          <div className="mt-2 p-3 bg-primary-subtle border border-primary-subtle rounded small text-primary">
            <div className="d-flex align-items-center justify-content-between">
              <span className="d-flex align-items-center gap-2 fw-bold">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                AI is scanning OCR bytes, extracting vessel specs for {sectionTitle}...
              </span>
              <span className="badge bg-primary text-white font-mono-code">AI Processing</span>
            </div>
            {/* animated scan sweep bar */}
            <div className="ai-scan-bar mt-2" />
            <div className="font-mono-code text-muted mt-2" style={{ fontSize: '0.7rem' }}>
              Extracting Vessel Name, IMO Number, Flag State, Classification Society and Ownership details...
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      style={{ zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content bg-white text-dark border shadow-lg">
          {/* hidden native file input for AI extraction */}
          <input
            type="file"
            ref={aiFileInputRef}
            className="d-none"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleStageVesselFileForVerification(file, currentStep);
            }}
          />

          {/* Header */}
          <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
            <div>
              <h5 className="modal-title fw-bold text-dark m-0">
                Register Vessel
              </h5>
              <div className="text-secondary small">
                Complete all 11 statutory categories for offshore compliance onboarding
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>

          {/* Step Progress Bar */}
          <div className="bg-light px-4 py-2 border-bottom">
            <div className="d-flex justify-between small text-secondary fw-semibold">
              <span className={currentStep === 1 ? 'text-primary fw-bold' : ''}>
                1. Identification & Class (Cat 1-2)
              </span>
              <span className={currentStep === 2 ? 'text-primary fw-bold' : ''}>
                2. Construction & Ownership (Cat 3-6)
              </span>
              <span className={currentStep === 3 ? 'text-primary fw-bold' : ''}>
                3. Safety, Crew & Insurance (Cat 8-10)
              </span>
              <span className={currentStep === 4 ? 'text-primary fw-bold' : ''}>
                4. Statutory Certs & Uploads (Cat 7 & 11)
              </span>
            </div>
            <div className="progress mt-2" style={{ height: '5px' }}>
              <div
                className="progress-bar bg-primary"
                role="progressbar"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (currentStep === 4) {
                handleSubmit(e);
              }
            }}
          >
            <div className="modal-body p-4 overflow-y-auto" style={{ maxHeight: '68vh' }}>
              {errorMessage && (
                <div className="alert alert-danger py-2 small mb-3">{errorMessage}</div>
              )}

              {/* STEP 1: Identification & Classification */}
              {currentStep === 1 && (
                <div className="d-flex flex-column gap-3">
                  {renderAiDocumentIntakeCard('Identification & Classification', 1)}

                  <div className="text-uppercase text-primary small fw-bold">
                    Section 1: Vessel Identification
                  </div>

                  <div className="row g-2">
                    <div className={`col-md-4 ${revealedVesselFields.name ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">Vessel Name <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className={`form-control form-control-sm ${errorMessage && !name.trim() ? 'is-invalid' : ''}${animatingFields.has('vessel-name') ? ' map-autofill-animate' : ''}`}
                        placeholder="e.g. MV Pacific Supporter"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Previous Name(s)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="None or previous names"
                        value={previousNames}
                        onChange={(e) => setPreviousNames(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Proposed Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={proposedName}
                        onChange={(e) => setProposedName(e.target.value)}
                      />
                    </div>

                    <div className={`col-md-3 ${revealedVesselFields.imoNumber ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">IMO Number (7 Digits) <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className={`form-control form-control-sm font-mono-code ${errorMessage && (!imoNumber.trim() || !validateImoNumber(imoNumber)) ? 'is-invalid' : ''}${animatingFields.has('imo-number') ? ' map-autofill-animate' : ''}`}
                        placeholder="e.g. 9481234"
                        value={imoNumber}
                        onChange={(e) => setImoNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className={`col-md-3 ${revealedVesselFields.officialRegNumber ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">Official Registration Number <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className={`form-control form-control-sm font-mono-code ${errorMessage && !officialRegNumber.trim() ? 'is-invalid' : ''}${animatingFields.has('official-reg-number') ? ' map-autofill-animate' : ''}`}
                        placeholder="e.g. OSV-99-2023"
                        value={officialRegNumber}
                        onChange={(e) => setOfficialRegNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">MMSI Number (9 Digits)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        placeholder="e.g. 503889120"
                        value={mmsiNumber}
                        onChange={(e) => setMmsiNumber(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Radio Call Sign</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        placeholder="e.g. VJQ5511"
                        value={callSign}
                        onChange={(e) => setCallSign(e.target.value)}
                      />
                    </div>

                    <div className={`col-md-4 ${revealedVesselFields.flagState ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">Flag State / Country</label>
                      <input
                        type="text"
                        className={`form-control form-control-sm${animatingFields.has('flag-state') ? ' map-autofill-animate' : ''}`}
                        value={flagState}
                        onChange={(e) => setFlagState(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Port of Registry</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={portOfRegistry}
                        onChange={(e) => setPortOfRegistry(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Registration Status</label>
                      <select
                        className="form-select form-select-sm"
                        value={vesselRegStatus}
                        onChange={(e) => setVesselRegStatus(e.target.value as VesselInformation['status'])}
                      >
                        <option value="In Operations" disabled>In Operations (Requires 100% Approved Assurance)</option>
                        <option value="Under Charter" disabled>Under Charter (Requires 100% Approved Assurance)</option>
                        <option value="In Transit" disabled>In Transit (Requires 100% Approved Assurance)</option>
                        <option value="Port Stay">Port Stay</option>
                        <option value="Dry Docking">Dry Docking</option>
                        <option value="Lay-up">Lay-up</option>
                      </select>
                    </div>
                  </div>

                  {/* Vessel Profile Photography & Multi-Image Upload Section */}
                  <div className="p-3 bg-light border rounded shadow-2xs mb-1">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-bold text-dark small d-flex align-items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span>Vessel Photography &amp; Gallery ({photos.length || (imageUrl ? 1 : 0)} photo{photos.length === 1 || (!photos.length && imageUrl) ? '' : 's'})</span>
                      </span>
                      {(imageUrl || photos.length > 0) && (
                        <span className="badge bg-success-subtle text-success border border-success-subtle font-mono-code" style={{ fontSize: '0.7rem' }}>
                          {photos.length > 1 ? `${photos.length} Photos Attached` : 'Cover Photo Attached'}
                        </span>
                      )}
                    </div>

                    <div className="row g-3">
                      {/* Left: Main Cover Photo Preview */}
                      <div className="col-md-4 text-center">
                        <div
                          className="position-relative border rounded overflow-hidden bg-dark d-flex align-items-center justify-content-center shadow-2xs group"
                          style={{ height: '140px' }}
                          title={imageUrl ? 'Cover Photo Preview' : 'Click to upload vessel images'}
                        >
                          {imageUrl ? (
                            <>
                              <img src={imageUrl} alt="Vessel preview" className="w-100 h-100" style={{ objectFit: 'cover' }} />
                              <div
                                className="position-absolute bottom-0 start-0 w-100 px-2 py-0.5 text-white fw-bold text-start d-flex align-items-center justify-content-between"
                                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', fontSize: '0.68rem' }}
                              >
                                <span>Primary Cover (16:9)</span>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-light py-0 px-1.5 fw-semibold text-dark rounded-pill d-inline-flex align-items-center gap-1"
                                  style={{ fontSize: '0.62rem' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCropModalImageSrc(imageUrl);
                                    setCropTargetIndex(photos.indexOf(imageUrl) >= 0 ? photos.indexOf(imageUrl) : null);
                                    setIsCropModalOpen(true);
                                  }}
                                  title="Universal Sizing & Crop Tool"
                                >
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
                                    <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
                                  </svg>
                                  <span>Crop</span>
                                </button>
                              </div>
                            </>
                          ) : (
                            <div
                              className="text-muted small d-flex flex-column align-items-center gap-1.5 p-2 cursor-pointer w-100 h-100 justify-content-center"
                              onClick={() => imageFileInputRef.current?.click()}
                            >
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-secondary">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                              <span className="text-secondary fw-semibold" style={{ fontSize: '0.75rem' }}>No Photo Uploaded</span>
                              <span className="text-primary text-decoration-underline" style={{ fontSize: '0.7rem' }}>Upload multiple photos</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Upload controls and Multi-Photo Gallery */}
                      <div className="col-md-8 d-flex flex-column gap-2">
                        <input
                          type="file"
                          ref={imageFileInputRef}
                          multiple
                          className="d-none"
                          accept="image/png,image/jpeg,image/webp,image/jpg"
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              const newPhotosList: string[] = [];
                              let loadedCount = 0;
                              Array.from(files).forEach((file) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  if (typeof reader.result === 'string') {
                                    newPhotosList.push(reader.result);
                                  }
                                  loadedCount++;
                                  if (loadedCount === files.length) {
                                    setPhotos((prev) => {
                                      const combined = [...prev, ...newPhotosList];
                                      if (!imageUrl && combined.length > 0) {
                                        setImageUrl(combined[0]);
                                      }
                                      return combined;
                                    });
                                  }
                                };
                                reader.readAsDataURL(file);
                              });
                            }
                          }}
                        />

                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => imageFileInputRef.current?.click()}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span>Upload Photos (Multiple)</span>
                          </button>
                          {(photos.length > 0 || imageUrl) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => {
                                setImageUrl('');
                                setPhotos([]);
                              }}
                            >
                              Clear All Photos
                            </button>
                          )}
                        </div>

                        {/* Uploaded Photos Gallery Thumbnails */}
                        {photos.length > 0 && (
                          <div className="d-flex align-items-center gap-2 overflow-x-auto p-1.5 bg-white border rounded">
                            {photos.map((photo, pIdx) => {
                              const isCover = photo === imageUrl;
                              return (
                                <div
                                  key={pIdx}
                                  className={`position-relative border rounded overflow-hidden flex-shrink-0 cursor-pointer transition-all ${isCover ? 'border-primary border-2 shadow-sm' : 'border-secondary-subtle'}`}
                                  style={{ width: '64px', height: '50px' }}
                                  onClick={() => setImageUrl(photo)}
                                  title={isCover ? 'Primary Cover Photo' : 'Click to set as primary cover'}
                                >
                                  <img src={photo} alt={`Photo ${pIdx + 1}`} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                  {isCover && (
                                    <div className="position-absolute top-0 start-0 bg-primary text-white px-1 font-mono-code" style={{ fontSize: '0.55rem', borderBottomRightRadius: '3px' }}>
                                      Cover
                                    </div>
                                  )}
                                  <div className="position-absolute top-0 end-0 d-flex align-items-center gap-0.5 m-0.5">
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-dark p-0 d-flex align-items-center justify-content-center rounded-circle"
                                      style={{ width: '16px', height: '16px', fontSize: '0.6rem' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCropTargetIndex(pIdx);
                                        setCropModalImageSrc(photo);
                                        setIsCropModalOpen(true);
                                      }}
                                      title="Crop / Reframe this photo"
                                    >
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
                                        <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-danger p-0 d-flex align-items-center justify-content-center rounded-circle"
                                      style={{ width: '16px', height: '16px', fontSize: '0.65rem' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = photos.filter((_, i) => i !== pIdx);
                                        setPhotos(updated);
                                        if (isCover) {
                                          setImageUrl(updated.length > 0 ? updated[0] : '');
                                        }
                                      }}
                                      title="Remove this photo"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Curated Presets */}
                        <div className="d-flex flex-wrap align-items-center gap-1.5">
                          <span className="small text-secondary fw-semibold" style={{ fontSize: '0.72rem' }}>Add stock photo:</span>
                          {CURATED_VESSEL_PHOTOS.slice(0, 4).map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="btn btn-xs btn-outline-secondary py-0.5 px-1.5 rounded-pill"
                              style={{ fontSize: '0.68rem' }}
                              onClick={() => {
                                if (!photos.includes(p.url)) {
                                  setPhotos((prev) => [...prev, p.url]);
                                }
                                if (!imageUrl) {
                                  setImageUrl(p.url);
                                }
                              }}
                            >
                              + {p.title.split('/')[0].trim()}
                            </button>
                          ))}
                        </div>

                        {/* Image URL fallback */}
                        <div className="d-flex align-items-center gap-2">
                          <span className="small text-secondary" style={{ fontSize: '0.75rem' }}>Or URL:</span>
                          <input
                            type="url"
                            className="form-control form-control-sm flex-grow-1 font-mono-code"
                            style={{ fontSize: '0.75rem' }}
                            placeholder="https://images.unsplash.com/..."
                            value={imageUrl}
                            onChange={(e) => {
                              const val = e.target.value;
                              setImageUrl(val);
                              if (val && !photos.includes(val)) {
                                setPhotos((prev) => [val, ...prev]);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-uppercase text-primary small fw-bold mt-2">
                    Section 2: Vessel Classification &amp; Notations
                  </div>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Vessel Type</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={vesselType}
                        readOnly
                        title="MVP scope: Offshore Support Vessel (OSV) only"
                      />
                      <div className="form-text">MVP scope: OSV only</div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Vessel</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. AHTS, PSV, Crew Boat"
                        value={vesselSubtype}
                        onChange={(e) => setVesselSubtype(e.target.value)}
                      />
                    </div>
                    <div className={`col-md-4 ${revealedVesselFields.classificationSociety ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">Classification Society</label>
                      <select
                        className={`form-select form-select-sm${animatingFields.has('classification-society') ? ' map-autofill-animate' : ''}`}
                        value={classificationSociety}
                        onChange={(e) => setClassificationSociety(e.target.value as ClassificationSociety)}
                      >
                        <option value="DNV">DNV</option>
                        <option value="ABS">ABS</option>
                        <option value="Lloyd's Register">Lloyd's Register</option>
                        <option value="Bureau Veritas">Bureau Veritas</option>
                        <option value="RINA">RINA</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Class Notation</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={classNotation}
                        onChange={(e) => setClassNotation(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Trading Area</label>
                      <select
                        className="form-select form-select-sm"
                        value={tradingArea}
                        onChange={(e) => setTradingArea(e.target.value)}
                      >
                        <option value="International">International</option>
                        <option value="Domestic / Coastal">Domestic / Coastal</option>
                        <option value="Harbour / Port Limits">Harbour / Port Limits</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">SOLAS / MARPOL</label>
                      <select
                        className="form-select form-select-sm"
                        value={solasMarpolApplicable ? 'Yes' : 'No'}
                        onChange={(e) => setSolasMarpolApplicable(e.target.value === 'Yes')}
                      >
                        <option value="Yes">Applicable</option>
                        <option value="No">Exempt</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Construction, Ownership, Management & Title */}
              {currentStep === 2 && (
                <div className="d-flex flex-column gap-3">
                  {renderAiDocumentIntakeCard('Construction, Ownership & Title', 2)}
                  <div className="text-uppercase text-primary small fw-bold">
                    Section 3: Construction & Dimensions
                  </div>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Shipyard / Builder</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Damen Shipyards Group"
                        value={shipyardBuilder}
                        onChange={(e) => setShipyardBuilder(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Country of Construction</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={constructionCountry}
                        onChange={(e) => setConstructionCountry(e.target.value)}
                      />
                    </div>
                    <div className={`col-md-4 ${revealedVesselFields.yearBuilt ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">Year Built / Completed</label>
                      <input
                        type="number"
                        className={`form-control form-control-sm${animatingFields.has('year-built') ? ' map-autofill-animate' : ''}`}
                        value={yearBuilt}
                        onChange={(e) => setYearBuilt(parseInt(e.target.value) || 2023)}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">LOA (Meters)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={loa}
                        onChange={(e) => setLoa(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Beam (Meters)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={beam}
                        onChange={(e) => setBeam(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className={`col-md-3 ${revealedVesselFields.gt ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">Gross Tonnage (GT)</label>
                      <input
                        type="number"
                        className={`form-control form-control-sm${animatingFields.has('gt') ? ' map-autofill-animate' : ''}`}
                        value={gt}
                        onChange={(e) => setGt(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className={`col-md-3 ${revealedVesselFields.dwt ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">Deadweight (DWT)</label>
                      <input
                        type="number"
                        className={`form-control form-control-sm${animatingFields.has('dwt') ? ' map-autofill-animate' : ''}`}
                        value={dwt}
                        onChange={(e) => setDwt(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="text-uppercase text-primary small fw-bold mt-3">
                    Section 4 & 5: Ownership, ISM & Operating Management
                  </div>
                  <div className="row g-2">
                    <div className={`col-md-6 ${revealedVesselFields.registeredOwner ? 'ai-field-reveal ai-field-highlight' : ''}`}>
                      <label className="form-label text-secondary small fw-semibold">Registered Owner Name <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className={`form-control form-control-sm ${errorMessage && !registeredOwner.trim() ? 'is-invalid' : ''}${animatingFields.has('registered-owner') ? ' map-autofill-animate' : ''}`}
                        placeholder="e.g. Pacific Ocean Logistics Pty Ltd"
                        value={registeredOwner}
                        onChange={(e) => setRegisteredOwner(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Owner Type</label>
                      <select
                        className="form-select form-select-sm"
                        value={ownerType}
                        onChange={(e) => setOwnerType(e.target.value)}
                      >
                        <option value="Corporate Entity">Company / Corporate</option>
                        <option value="Individual">Individual</option>
                        <option value="Government">Government / State</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Company Reg / ACN</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        placeholder="e.g. ACN 894 123 765"
                        value={corporateRegNo}
                        onChange={(e) => setCorporateRegNo(e.target.value)}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">ISM Management Company</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Ocean Fleet Management Ltd"
                        value={ismCompany}
                        onChange={(e) => setIsmCompany(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Technical Manager</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Pacific Ship Management"
                        value={technicalManager}
                        onChange={(e) => setTechnicalManager(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">DOC Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        placeholder="e.g. DOC-DNV-2024-88"
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="text-uppercase text-primary small fw-bold mt-3">
                    Section 6: Purchase & Title Encumbrance
                  </div>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Method of Acquisition</label>
                      <select
                        className="form-select form-select-sm"
                        value={methodOfAcquisition}
                        onChange={(e) => setMethodOfAcquisition(e.target.value)}
                      >
                        <option value="Outright Purchase">Outright Purchase</option>
                        <option value="New Build Delivery">New Build Delivery</option>
                        <option value="Bareboat Charter with Purchase Option">Bareboat Charter / Lease</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Mortgage / Encumbrance</label>
                      <select
                        className="form-select form-select-sm"
                        value={mortgageStatus}
                        onChange={(e) => setMortgageStatus(e.target.value)}
                      >
                        <option value="Free from Encumbrance">Free from Encumbrance (Clean Title)</option>
                        <option value="Mortgaged to Commercial Bank">Mortgaged / Bank Financing</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Insurance, Crew, Safety & Environmental */}
              {currentStep === 3 && (
                <div className="d-flex flex-column gap-3">
                  {renderAiDocumentIntakeCard('Safety, Crew, Insurance & Environment', 3)}
                  <div className="text-uppercase text-primary small fw-bold">
                    Section 8: Insurance & Financial Security
                  </div>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Protection & Indemnity (P&I) Club</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={piClubName}
                        onChange={(e) => setPiClubName(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">P&I Policy Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={policyNumber}
                        onChange={(e) => setPolicyNumber(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label text-secondary small fw-semibold">Policy Expiry Date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={policyExpiryDate}
                        onChange={(e) => setPolicyExpiryDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="text-uppercase text-primary small fw-bold mt-3">
                    Section 9: Crew & Safety Information
                  </div>
                  <div className="row g-2">
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Minimum Safe Manning</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={safeManningComplement}
                        onChange={(e) => setSafeManningComplement(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Max Crew / Berth Capacity</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={maxCrewCapacity}
                        onChange={(e) => setMaxCrewCapacity(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Lifeboat Capacity</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={lifeboatCapacity}
                        onChange={(e) => setLifeboatCapacity(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label text-secondary small fw-semibold">Master's Full Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Capt. James Stirling"
                        value={masterName}
                        onChange={(e) => setMasterName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="text-uppercase text-primary small fw-bold mt-3">
                    Section 10: Environmental Information
                  </div>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Bunker Fuel Specification</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={fuelType}
                        onChange={(e) => setFuelType(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Ballast Water Treatment System (BWTS)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={bwtsSpec}
                        onChange={(e) => setBwtsSpec(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Initial Statutory Certificates & File Attachments */}
              {currentStep === 4 && (
                <div className="d-flex flex-column gap-3">
                  {renderAiDocumentIntakeCard('Statutory Certificates & Master Documents', 4)}
                  <div className="text-uppercase text-primary small fw-bold">
                    Section 7 & 11: Statutory Certificates & Master Documents
                  </div>
                  <p className="text-secondary small mb-2">
                    Pre-attached foundational statutory certificates and extracted specifications are automatically linked to the Pre-Assurance Vault and fleet compliance readiness score.
                  </p>

                  <div className="alert alert-info py-2 small mt-2">
                    <strong>Note:</strong> Additional statutory certificates (Safety Equipment, Load Line, IOPP) can be uploaded at any time in the <strong>Pre-Assurance Vault</strong> inside the vessel detail page.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="modal-footer border-top bg-light d-flex justify-between">
              <div>
                <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
                  Cancel
                </button>
              </div>

              <div className="d-flex gap-2">
                {currentStep > 1 && (
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handlePrevious}>
                    &larr; Back
                  </button>
                )}
                {currentStep < 4 ? (
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleNext}>
                    Next Step &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={() => handleSubmit()}
                  >
                    Confirm & Complete Registration
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Universal Document Preview & AI Verification Gate Popup Modal */}
      {pendingVerificationState && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1070 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingVerificationState(null);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              {/* Header */}
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 rounded bg-primary-subtle text-primary">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0">
                      Document Preview &amp; Verification Gate
                    </h5>
                    <div className="text-secondary small mt-0.5">
                      Review document clarity before authorizing AI OCR metadata extraction for Stage {pendingVerificationState.stepNumber}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setPendingVerificationState(null)}
                  aria-label="Close"
                />
              </div>

              {/* Body */}
              <div className="modal-body p-4">
                <div className="bg-light border rounded p-3 mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-danger text-white font-mono-code" style={{ fontSize: '0.7rem' }}>PDF SCAN</span>
                      <span className="fw-bold text-dark font-mono-code">{pendingVerificationState.fileName}</span>
                    </div>
                    <span className="badge bg-success text-white font-mono-code" style={{ fontSize: '0.7rem' }}>OCR LEGIBILITY: 100% CLEAR</span>
                  </div>

                  {/* Document Scan Wireframe Graphic */}
                  <div className="bg-white p-3 border rounded font-mono-code text-start" style={{ fontSize: '0.775rem', lineHeight: '1.5' }}>
                    <div className="text-uppercase fw-bold text-primary border-bottom pb-1 mb-2 d-flex justify-content-between">
                      <span>MARITIME STATUTORY CERTIFICATE SCAN</span>
                      <span className="text-muted">PAGE 1 OF 1</span>
                    </div>

                    <div className="text-secondary mt-1">TARGET STAGE: Registration Stage {pendingVerificationState.stepNumber}</div>
                    <div className="text-secondary">EXTRACTABLE FIELDS: Vessel Name, IMO Number, Flag State, Classification Society, Year Built, GT/DWT</div>

                    {/* OCR Criteria with universal staggered animation */}
                    <div className="d-flex flex-column gap-2 mt-2.5 p-2 bg-light rounded border font-sans">
                      <div className="map-criteria-item-1 d-flex align-items-center gap-2 small" style={{ fontSize: '0.725rem', color: '#475569' }}>
                        <span className="d-flex align-items-center justify-content-center rounded text-white fw-bold bg-success flex-shrink-0" style={{ width: '18px', height: '18px', fontSize: '0.65rem' }}>✓</span>
                        <span className="ps-0.5 text-dark fw-medium">Resolution 240 DPI</span>
                      </div>
                      <div className="map-criteria-item-2 d-flex align-items-center gap-2 small" style={{ fontSize: '0.725rem', color: '#475569' }}>
                        <span className="d-flex align-items-center justify-content-center rounded text-white fw-bold bg-success flex-shrink-0" style={{ width: '18px', height: '18px', fontSize: '0.65rem' }}>✓</span>
                        <span className="ps-0.5 text-dark fw-medium">Full page captured</span>
                      </div>
                      <div className="map-criteria-item-3 d-flex align-items-center gap-2 small" style={{ fontSize: '0.725rem', color: '#475569' }}>
                        <span className="d-flex align-items-center justify-content-center rounded text-white fw-bold bg-success flex-shrink-0" style={{ width: '18px', height: '18px', fontSize: '0.65rem' }}>✓</span>
                        <span className="ps-0.5 text-dark fw-medium">Signature / stamp present</span>
                      </div>
                    </div>

                    <div className="p-2 bg-light border rounded mt-2 text-muted text-center" style={{ fontSize: '0.725rem' }}>
                      [ High resolution scan ready for automated AI OCR parsing &amp; form auto-population for Stage {pendingVerificationState.stepNumber} ]
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer border-top bg-light d-flex justify-between">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setPendingVerificationState(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-success fw-bold px-3 d-inline-flex align-items-center gap-1.5"
                  onClick={handleConfirmVesselFileVerification}
                >
                  Extract Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Universal Vessel Image Crop & Sizing Modal */}
      {isCropModalOpen && cropModalImageSrc && (
        <VesselImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropModalImageSrc}
          vesselName="New Vessel Registration"
          initialPreset="16:9"
          onSave={(croppedUrl) => {
            if (cropTargetIndex !== null && cropTargetIndex >= 0 && cropTargetIndex < photos.length) {
              const updated = [...photos];
              const oldUrl = updated[cropTargetIndex];
              updated[cropTargetIndex] = croppedUrl;
              setPhotos(updated);
              if (imageUrl === oldUrl || !imageUrl) {
                setImageUrl(croppedUrl);
              }
            } else {
              setImageUrl(croppedUrl);
              setPhotos((prev) => {
                if (!prev.includes(croppedUrl)) {
                  return [croppedUrl, ...prev];
                }
                return prev;
              });
            }
            setIsCropModalOpen(false);
          }}
          onClose={() => setIsCropModalOpen(false)}
        />
      )}
    </div>
  );
};