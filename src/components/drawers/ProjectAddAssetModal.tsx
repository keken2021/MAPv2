/*
  file summary: dedicated modal for ProjectDetailView to browse external assets, inspect pre-assurance vault documents, and choose between applicable assurance sets for comparison matrix.
  responsibilities: filters strictly for non-owned external assets, renders marketplace-aligned inspection UI with multiple assurance set selection, and handles roster linking.
  role in system: opened when clicking 'Add Asset' on ProjectDetailView.
*/

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Ship,
  Wrench,
  Users,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileCheck,
  Building2,
  MapPin,
  Search,
  ArrowLeft,
  Plus,
  Eye,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { Project, ProjectAssetLink, ProjectAssetType } from '../../types/project';
import { MasterDocument, ComplianceState } from '../../types/document';
import { AssuranceRequirementCategory, AssuranceSet } from '../../types/assurance';
import { VesselInformation } from '../../types/vessel';
import { CrewMember } from '../../types/crew';
import { EquipmentAsset } from '../../types/equipment';
import {
  getLinkableProjectAssets,
  PROJECT_ASSET_LINK_HINT,
} from '../../utils/projectHelpers';
import { normalizeText, matchesVesselRequirement } from '../../utils/documentMatchingHelpers';

export interface VaultCertificateDisplay {
  id: string;
  title: string;
  certificateNo: string;
  issuingAuthority: string;
  expiryDate: string;
  complianceState: ComplianceState | 'Verified';
  ocrConfidence: number;
  sourceType: 'vault_document' | 'statutory_cert' | 'stcw_cert' | 'equipment_spec';
}

export interface RequirementMatchComparison {
  requirementId: string;
  requirementTitle: string;
  category: AssuranceRequirementCategory;
  isMandatory: boolean;
  matchedDoc?: VaultCertificateDisplay;
  matchStatus: 'matched_valid' | 'matched_expiring' | 'gap_missing';
  matchScore: number;
}

export interface CandidateAsset {
  assetType: ProjectAssetType;
  assetId: string;
  assetName: string;
  providerOrganization: string;
  location: string;
  subtypeOrRole: string;
  operationalStatus: string;
  complianceScore: number;
  eligibleAssuranceSets: AssuranceSet[];
  vesselRef?: VesselInformation;
  crewRef?: CrewMember;
  equipmentRef?: EquipmentAsset;
}

interface ProjectAddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ProjectAddAssetModal: React.FC<ProjectAddAssetModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const {
    assuranceSets,
    vessels,
    crew,
    equipment,
    documents,
    addAssetToProject,
  } = useMapStore();

  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Vessel' | 'Equipment' | 'Crew'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<CandidateAsset | null>(null);
  const [activeTab, setActiveTab] = useState<'comparison' | 'vault'>('comparison');
  const [selectedAssuranceSetId, setSelectedAssuranceSetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  // Reset state on modal open/close
  useEffect(() => {
    if (isOpen) {
      setSelectedAsset(null);
      setSearchQuery('');
      setCategoryFilter('All');
      setActiveTab('comparison');
      setSelectedAssuranceSetId('');
      setErrorMessage('');
      setSuccessToast(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // 2. Shared linkable list — chartered/rented external assets with eligible assurance sets
  const candidateAssets = useMemo<CandidateAsset[]>(() => {
    if (!project) return [];

    const linkable = getLinkableProjectAssets({
      vessels,
      crew,
      equipment,
      assuranceSets,
      requestingOrganization: project.requestingOrganization,
      excludeAssetKeys: project.assetLinks.map((l) => `${l.assetType}:${l.assetId}`),
    });

    return linkable.map((asset) => {
      if (asset.assetType === 'Vessel') {
        const vesselRef = vessels.find((v) => v.id === asset.assetId);
        return {
          ...asset,
          location: vesselRef?.portOfRegistry || 'Dampier, WA',
          subtypeOrRole: `${vesselRef?.vesselType || 'Vessel'} · ${vesselRef?.vesselSubtype || 'General'}`,
          operationalStatus: vesselRef?.status || 'Available',
          complianceScore: vesselRef?.complianceReadinessScore ?? 0,
          vesselRef,
        };
      }

      if (asset.assetType === 'Equipment') {
        const equipmentRef = equipment.find((e) => e.id === asset.assetId);
        return {
          ...asset,
          location: 'Henderson Marine Base, WA',
          subtypeOrRole: `${equipmentRef?.category || 'Equipment'} · ${equipmentRef?.model || 'Standard'}`,
          operationalStatus: equipmentRef?.availabilityStatus || 'Available',
          complianceScore:
            equipmentRef?.complianceStatus === 'Compliant'
              ? 95
              : equipmentRef?.complianceStatus === 'Partially Compliant'
                ? 65
                : 40,
          equipmentRef,
        };
      }

      const crewRef = crew.find((c) => c.id === asset.assetId);
      return {
        ...asset,
        location: 'Perth, WA (Available Worldwide)',
        subtypeOrRole: `${crewRef?.rank || 'Crew'} · ${crewRef?.nationality || 'STCW Certified'}`,
        operationalStatus: crewRef?.complianceStatus || 'Available',
        complianceScore:
          crewRef?.complianceStatus === 'Fully Compliant'
            ? 98
            : crewRef?.complianceStatus === 'Expiring < 60 Days'
              ? 75
              : 45,
        crewRef,
      };
    });
  }, [project, vessels, equipment, crew, assuranceSets]);

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedAssuranceSetId('');
      return;
    }
    setSelectedAssuranceSetId(selectedAsset.eligibleAssuranceSets[0]?.id || '');
  }, [selectedAsset]);

  // Filtered by Category and Search
  const filteredAssets = useMemo(() => {
    return candidateAssets.filter((item) => {
      if (categoryFilter !== 'All' && item.assetType !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.assetName.toLowerCase().includes(q);
        const matchesId = item.assetId.toLowerCase().includes(q);
        const matchesOrg = item.providerOrganization.toLowerCase().includes(q);
        const matchesSubtype = item.subtypeOrRole.toLowerCase().includes(q);
        return matchesName || matchesId || matchesOrg || matchesSubtype;
      }
      return true;
    });
  }, [candidateAssets, categoryFilter, searchQuery]);

  // Counts for Category Tabs
  const counts = useMemo(() => {
    const total = candidateAssets.length;
    const vesselCount = candidateAssets.filter((a) => a.assetType === 'Vessel').length;
    const equipmentCount = candidateAssets.filter((a) => a.assetType === 'Equipment').length;
    const crewCount = candidateAssets.filter((a) => a.assetType === 'Crew').length;
    return { total, vesselCount, equipmentCount, crewCount };
  }, [candidateAssets]);

  // 3. Document Vault for Selected Asset
  const vaultDocuments = useMemo<VaultCertificateDisplay[]>(() => {
    if (!selectedAsset) return [];

    const list: VaultCertificateDisplay[] = [];
    const { assetType, assetId, assetName, vesselRef, crewRef, equipmentRef } = selectedAsset;

    // Master documents from Library Vault
    const storeMatchingDocs = documents.filter((d: MasterDocument) => {
      if (assetType === 'Vessel') {
        return (
          d.vesselId === assetId ||
          (d.vesselAttributes && d.vesselAttributes.vesselName.toLowerCase() === assetName.toLowerCase())
        );
      }
      if (assetType === 'Crew') {
        return (
          d.entityType === 'Crew Certificate' &&
          ((d.crewAttributes && d.crewAttributes.crewName.toLowerCase() === assetName.toLowerCase()) ||
            d.vesselId === assetId)
        );
      }
      return false;
    });

    storeMatchingDocs.forEach((d) => {
      list.push({
        id: d.id,
        title: d.title,
        certificateNo: d.certificateNo || d.id,
        issuingAuthority: d.issuingAuthority || 'IACS Recognized Body',
        expiryDate: d.expiryDate || '2028-12-31',
        complianceState: d.complianceState || 'Valid',
        ocrConfidence: d.ocrConfidence || 98,
        sourceType: 'vault_document',
      });
    });

    // Vessel statutory certificates
    if (assetType === 'Vessel' && vesselRef?.statutoryCertificates) {
      vesselRef.statutoryCertificates.forEach((cert, idx) => {
        if (!list.some((existing) => existing.title.toLowerCase() === cert.name.toLowerCase())) {
          list.push({
            id: `MAP-VES-STAT-${idx + 100}`,
            title: cert.name,
            certificateNo: cert.certificateNumber || `DNV-STAT-${idx + 400}`,
            issuingAuthority: cert.issuingBody || vesselRef.classificationSociety || 'DNV',
            expiryDate: cert.expiryDate || '2027-09-30',
            complianceState: cert.status === 'Expired' ? 'Expired' : 'Valid',
            ocrConfidence: 98,
            sourceType: 'statutory_cert',
          });
        }
      });
    }

    // Crew STCW documents
    if (assetType === 'Crew' && crewRef) {
      const allStcw = [...(crewRef.layer1CoreDocuments || []), ...(crewRef.layer2Endorsements || [])];
      allStcw.forEach((doc, idx) => {
        if (!list.some((existing) => existing.title.toLowerCase() === doc.title.toLowerCase())) {
          list.push({
            id: `MAP-CRW-STCW-${idx + 100}`,
            title: doc.title,
            certificateNo: doc.certificateNo || `AMSA-STCW-${idx + 200}`,
            issuingAuthority: doc.issuingAuthority || 'AMSA Marine Authority',
            expiryDate: doc.expiryDate || '2028-06-30',
            complianceState: doc.verificationStatus === 'Expired' ? 'Expired' : 'Valid',
            ocrConfidence: 97,
            sourceType: 'stcw_cert',
          });
        }
      });
    }

    // Equipment specifications & load certificates
    if (assetType === 'Equipment' && equipmentRef) {
      list.push({
        id: 'MAP-EQP-STAT-001',
        title: 'Class Survey & Proof Load Test',
        certificateNo: `ABS-EQP-${equipmentRef.equipmentIdentifier || 'PL-992'}`,
        issuingAuthority: equipmentRef.classStatus || 'American Bureau of Shipping (ABS)',
        expiryDate: '2027-11-15',
        complianceState: 'Valid',
        ocrConfidence: 98,
        sourceType: 'equipment_spec',
      });
      list.push({
        id: 'MAP-EQP-STAT-002',
        title: 'Manufacturer Factory Acceptance Certificate',
        certificateNo: `OEM-FAC-${equipmentRef.model || 'CERT-401'}`,
        issuingAuthority: equipmentRef.manufacturer || 'Certified OEM',
        expiryDate: '2029-01-01',
        complianceState: 'Valid',
        ocrConfidence: 99,
        sourceType: 'equipment_spec',
      });
    }

    // Fallback baseline statutory pack if empty
    if (list.length === 0) {
      if (assetType === 'Vessel') {
        list.push(
          {
            id: 'MAP-VES-2026-STAT-00412',
            title: 'Certificate of Class (100A1 Offshore Support)',
            certificateNo: 'DNV-STAT-2026-99',
            issuingAuthority: 'DNV',
            expiryDate: '2028-04-15',
            complianceState: 'Valid',
            ocrConfidence: 98,
            sourceType: 'vault_document',
          },
          {
            id: 'MAP-VES-2026-STAT-00413',
            title: 'SOLAS Safety Construction & Equipment',
            certificateNo: 'DNV-SE-8841-A',
            issuingAuthority: 'DNV / AMSA',
            expiryDate: '2027-10-30',
            complianceState: 'Valid',
            ocrConfidence: 96,
            sourceType: 'vault_document',
          },
          {
            id: 'MAP-VES-2026-STAT-00414',
            title: 'International Load Line & Stability Booklet',
            certificateNo: 'ILL-AU-44810',
            issuingAuthority: 'Australian Maritime Safety Authority',
            expiryDate: '2028-01-10',
            complianceState: 'Valid',
            ocrConfidence: 97,
            sourceType: 'vault_document',
          },
        );
      } else if (assetType === 'Equipment') {
        list.push({
          id: 'MAP-EQP-STAT-001',
          title: 'Class Survey & Proof Load Test',
          certificateNo: 'ABS-EQP-LOAD-412',
          issuingAuthority: 'American Bureau of Shipping (ABS)',
          expiryDate: '2027-11-15',
          complianceState: 'Valid',
          ocrConfidence: 98,
          sourceType: 'equipment_spec',
        });
      } else if (assetType === 'Crew') {
        list.push(
          {
            id: 'MAP-CRW-STCW-001',
            title: 'STCW Certificate of Competency (CoC)',
            certificateNo: 'AMSA-COC-99120',
            issuingAuthority: 'AMSA',
            expiryDate: '2028-06-30',
            complianceState: 'Valid',
            ocrConfidence: 99,
            sourceType: 'stcw_cert',
          },
          {
            id: 'MAP-CRW-STCW-002',
            title: 'STCW Basic Safety Training (BST Refresher)',
            certificateNo: 'BST-2024-991',
            issuingAuthority: 'AMSA Approved Training Center',
            expiryDate: '2029-03-15',
            complianceState: 'Valid',
            ocrConfidence: 98,
            sourceType: 'stcw_cert',
          },
        );
      }
    }

    return list;
  }, [selectedAsset, documents]);

  // Helper: Requirement matching
  const checkDocumentMatchesRequirement = (
    reqTitle: string,
    reqCategory: string | undefined,
    doc: VaultCertificateDisplay,
  ): boolean => {
    const reqClean = reqTitle.replace(/^(cert\d+|crewcert\d+|req-\w+)\s*[-—:]\s*/i, '');
    const reqNorm = normalizeText(reqClean);
    const docNorm = normalizeText(doc.title);

    if (reqNorm === docNorm) return true;
    if (matchesVesselRequirement(reqTitle, doc.title, undefined, doc.certificateNo)) return true;

    if (
      (reqNorm.includes('class') || reqNorm.includes('hull')) &&
      (docNorm.includes('class') || docNorm.includes('100a1') || docNorm.includes('hull') || docNorm.includes('lloyd') || docNorm.includes('dnv') || docNorm.includes('abs') || docNorm.includes('rina'))
    ) return true;

    if (
      (reqNorm.includes('solas') || reqNorm.includes('safety') || reqNorm.includes('construction') || reqNorm.includes('equipment')) &&
      (docNorm.includes('solas') || docNorm.includes('safety') || docNorm.includes('construction') || docNorm.includes('equipment') || docNorm.includes('amsa'))
    ) return true;

    if (
      (reqNorm.includes('load line') || reqNorm.includes('stability')) &&
      (docNorm.includes('load line') || docNorm.includes('stability') || docNorm.includes('ill-'))
    ) return true;

    if (
      (reqNorm.includes('positioning') || reqNorm.includes('dp') || reqNorm.includes('fmea')) &&
      (docNorm.includes('positioning') || docNorm.includes('dp') || docNorm.includes('fmea'))
    ) return true;

    if (
      (reqNorm.includes('stcw') || reqNorm.includes('master') || reqNorm.includes('officer') || reqNorm.includes('coc') || reqNorm.includes('crewcert')) &&
      (docNorm.includes('stcw') || docNorm.includes('master') || docNorm.includes('coc') || docNorm.includes('deck') || docNorm.includes('engineer') || docNorm.includes('training') || docNorm.includes('bst'))
    ) return true;

    if (
      (reqNorm.includes('medical') || reqNorm.includes('eng1') || reqNorm.includes('fitness')) &&
      (docNorm.includes('medical') || docNorm.includes('eng1') || docNorm.includes('fitness'))
    ) return true;

    if (
      (reqNorm.includes('load test') || reqNorm.includes('proof load') || reqNorm.includes('survey') || reqNorm.includes('lifting')) &&
      (docNorm.includes('load') || docNorm.includes('proof') || docNorm.includes('survey') || docNorm.includes('crane') || docNorm.includes('lifting'))
    ) return true;

    if (
      (reqNorm.includes('factory') || reqNorm.includes('fac') || reqNorm.includes('oem') || reqNorm.includes('acceptance')) &&
      (docNorm.includes('factory') || docNorm.includes('fac') || docNorm.includes('oem') || docNorm.includes('acceptance'))
    ) return true;

    return false;
  };

  const assetEligibleAssuranceSets = useMemo(
    () => selectedAsset?.eligibleAssuranceSets ?? [],
    [selectedAsset],
  );

  const activeAssuranceSet = useMemo(() => {
    if (!selectedAssuranceSetId) return null;
    return (
      assetEligibleAssuranceSets.find((s) => s.id === selectedAssuranceSetId) ||
      assuranceSets.find((s) => s.id === selectedAssuranceSetId) ||
      null
    );
  }, [selectedAssuranceSetId, assetEligibleAssuranceSets, assuranceSets]);

  // 5. Comparison Matrix Calculation (Project Assurance Requirements vs Pre-Assurance Vault)
  const comparisonResults = useMemo<RequirementMatchComparison[]>(() => {
    if (!selectedAsset) return [];

    let requirementsToCompare: any[] = [];

    if (activeAssuranceSet) {
      const reqs = activeAssuranceSet.requirements || [];
      const directReqs = reqs.filter((r) => r.fulfillmentType !== 'assurance_set');
      requirementsToCompare = directReqs.length > 0 ? directReqs : reqs;
    }

    return requirementsToCompare.map((req) => {
      const matched = vaultDocuments.find((doc) =>
        checkDocumentMatchesRequirement(req.title, req.category, doc),
      );

      let matchStatus: RequirementMatchComparison['matchStatus'] = 'gap_missing';
      let matchScore = 0;

      if (matched) {
        if (matched.complianceState === 'Expired') {
          matchStatus = 'matched_expiring';
          matchScore = 50;
        } else {
          matchStatus = 'matched_valid';
          matchScore = 100;
        }
      }

      return {
        requirementId: req.id,
        requirementTitle: req.title,
        category: (req.category || 'Statutory Certificate') as AssuranceRequirementCategory,
        isMandatory: req.isMandatory !== false,
        matchedDoc: matched,
        matchStatus,
        matchScore,
      };
    });
  }, [selectedAsset, activeAssuranceSet, vaultDocuments]);

  // Match Summary Metrics
  const matchSummary = useMemo(() => {
    const total = comparisonResults.length;
    if (total === 0) return { matchedCount: 0, gapsCount: 0, percentage: 100, total: 0 };

    const matchedCount = comparisonResults.filter(
      (c) => c.matchStatus === 'matched_valid' || c.matchStatus === 'matched_expiring',
    ).length;
    const percentage = total > 0 ? Math.round((matchedCount / total) * 100) : 100;
    const gapsCount = total - matchedCount;

    return { total, matchedCount, percentage, gapsCount };
  }, [comparisonResults]);

  // 6. Handle Confirm Add Asset
  const handleConfirmAddAsset = () => {
    if (!selectedAsset) return;

    if (!selectedAssuranceSetId) {
      setErrorMessage('Select an assurance set for this asset.');
      return;
    }

    const assuranceSetExists = selectedAsset.eligibleAssuranceSets.some(
      (s) => s.id === selectedAssuranceSetId,
    );
    if (!assuranceSetExists) {
      setErrorMessage('Selected assurance set is not eligible for this asset.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    const payload: Omit<ProjectAssetLink, 'id' | 'projectId' | 'addedAt' | 'addedByPersona'> = {
      assetType: selectedAsset.assetType,
      assetId: selectedAsset.assetId,
      assetName: selectedAsset.assetName,
      providerOrganization: selectedAsset.providerOrganization,
      assuranceSetId: selectedAssuranceSetId,
      roleInProject: selectedAsset.subtypeOrRole,
    };

    const result = addAssetToProject(project.id, payload);

    if (result.success) {
      setSuccessToast(true);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1100);
    } else {
      setIsSubmitting(false);
      setErrorMessage(result.message || 'Failed to add asset to project.');
    }
  };

  if (!isOpen) return null;

  const getCategoryIcon = (type?: ProjectAssetType) => {
    switch (type || selectedAsset?.assetType) {
      case 'Vessel':
        return <Ship size={18} className="text-primary" />;
      case 'Equipment':
        return <Wrench size={18} className="text-warning" />;
      case 'Crew':
        return <Users size={18} className="text-info" />;
      default:
        return <Briefcase size={18} className="text-primary" />;
    }
  };

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      style={{ zIndex: 1060, overflowY: 'auto' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        role="document"
        style={{ maxWidth: '940px', width: '94%', margin: '1.75rem auto' }}
      >
        <div
          className="modal-content border-0 shadow-lg overflow-hidden w-100"
          style={{ borderRadius: '10px', backgroundColor: '#FFFFFF' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Modal Header (Exact Marketplace Header Styling) */}
          <div
            className="modal-header d-flex align-items-center justify-content-between px-4 py-3 border-bottom flex-shrink-0"
            style={{
              backgroundColor: '#0B1B2B',
              color: '#FFFFFF',
              borderBottomColor: 'rgba(255, 255, 255, 0.12)',
            }}
          >
            <div className="d-flex align-items-center gap-3 min-w-0">
              <div
                className="d-flex align-items-center justify-content-center bg-white rounded-2 p-1.5 shadow-sm flex-shrink-0"
                style={{ width: '38px', height: '38px' }}
              >
                {selectedAsset ? getCategoryIcon(selectedAsset.assetType) : <Users size={18} className="text-primary" />}
              </div>
              <div className="d-flex flex-column min-w-0">
                <h5
                  className="modal-title fw-bold text-white mb-0 text-truncate"
                  style={{ fontSize: '1.15rem', letterSpacing: '0.01em', fontFamily: "'IBM Plex Sans', sans-serif" }}
                >
                  Add Asset to Project
                </h5>
                <span className="small text-truncate mt-0.5" style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  Pre-Assurance Vault Verification & Project Roster Nomination
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm text-white p-2 rounded-2 border-0 bg-transparent opacity-75 hover-opacity-100 ms-3 flex-shrink-0"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close modal"
              style={{ cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* 2. Modal Body */}
          <div className="modal-body p-4" style={{ backgroundColor: '#F8FAFC' }}>
            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center gap-2 py-2.5 px-3 mb-3 small">
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {successToast && (
              <div className="alert alert-success d-flex align-items-center gap-2 py-2.5 px-3 mb-3 small">
                <CheckCircle2 size={16} />
                <span>{selectedAsset?.assetName} successfully nominated and linked to {project.name}.</span>
              </div>
            )}

            {/* VIEW A: ASSET SELECTION CATALOG */}
            {!selectedAsset ? (
              <div className="d-flex flex-column gap-3">
                {/* Search & Category Filter Header */}
                <div className="card p-3 border shadow-sm bg-white" style={{ borderColor: '#E2E8F0' }}>
                  <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                    {/* Category Filter Pills (Mono & Counter Standard) */}
                    <div className="d-flex flex-wrap align-items-center gap-1.5">
                      {(
                        [
                          { key: 'All', label: `All (${counts.total})` },
                          { key: 'Vessel', label: `Vessels (${counts.vesselCount})` },
                          { key: 'Equipment', label: `Equipment (${counts.equipmentCount})` },
                          { key: 'Crew', label: `Crew (${counts.crewCount})` },
                        ] as const
                      ).map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          className="btn btn-sm rounded-pill font-mono-code px-3 py-1.5 transition-all"
                          style={{
                            fontSize: '0.8rem',
                            backgroundColor: categoryFilter === cat.key ? '#0B1B2B' : 'transparent',
                            color: categoryFilter === cat.key ? '#FFFFFF' : '#64748B',
                            border: categoryFilter === cat.key ? '1px solid #0B1B2B' : '1px solid #E2E8F0',
                            fontWeight: categoryFilter === cat.key ? 600 : 400,
                          }}
                          onClick={() => setCategoryFilter(cat.key)}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Search Field */}
                    <div className="position-relative" style={{ minWidth: '240px' }}>
                      <Search
                        size={15}
                        className="position-absolute text-muted"
                        style={{ left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                      />
                      <input
                        type="text"
                        className="form-control form-control-sm ps-5 pe-3"
                        placeholder="Search asset, ID, provider..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Candidate Asset Cards List */}
                <div style={{ maxHeight: '420px', overflowY: 'auto' }} className="d-flex flex-column gap-2.5 pe-1">
                  {filteredAssets.length === 0 ? (
                    <div className="card p-5 text-center bg-white border" style={{ borderColor: '#E2E8F0' }}>
                      <Layers size={36} className="text-muted mx-auto mb-2 opacity-50" />
                      <h6 className="fw-semibold text-dark mb-1">No Linkable Assets Available</h6>
                      <p className="text-muted small mb-1">
                        Only chartered or rented external assets with eligible assurance sets appear here.
                      </p>
                      <p className="text-muted small mb-0 fst-italic">{PROJECT_ASSET_LINK_HINT}</p>
                    </div>
                  ) : (
                    filteredAssets.map((asset) => (
                      <div
                        key={`${asset.assetType}-${asset.assetId}`}
                        className="card p-3 border shadow-sm bg-white transition-all hover-border-primary"
                        style={{ borderRadius: '8px', borderColor: '#E2E8F0' }}
                      >
                        <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                          {/* Asset Info */}
                          <div className="d-flex align-items-start gap-3 min-w-0">
                            <div
                              className="d-flex align-items-center justify-content-center rounded-2 p-2 flex-shrink-0"
                              style={{
                                backgroundColor:
                                  asset.assetType === 'Vessel'
                                    ? 'rgba(11, 27, 43, 0.08)'
                                    : asset.assetType === 'Equipment'
                                    ? 'rgba(245, 158, 11, 0.12)'
                                    : 'rgba(14, 165, 233, 0.12)',
                                width: '42px',
                                height: '42px',
                              }}
                            >
                              {getCategoryIcon(asset.assetType)}
                            </div>

                            <div className="d-flex flex-column min-w-0">
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <span className="fw-bold text-dark font-mono-code" style={{ fontSize: '0.95rem' }}>
                                  {asset.assetId}
                                </span>
                                <h6 className="fw-bold text-dark mb-0 text-truncate" style={{ fontSize: '0.95rem' }}>
                                  {asset.assetName}
                                </h6>
                                <span
                                  className="badge rounded-pill font-mono-code px-2 py-0.5"
                                  style={{
                                    fontSize: '0.7rem',
                                    backgroundColor: 'rgba(11, 27, 43, 0.08)',
                                    color: '#0B1B2B',
                                    fontWeight: 600,
                                  }}
                                >
                                  {asset.assetType}
                                </span>
                              </div>

                              <div className="text-muted small mt-1 text-truncate">
                                {asset.subtypeOrRole}
                              </div>

                              <div className="d-flex align-items-center gap-2 mt-1 flex-wrap small">
                                <span className="d-inline-flex align-items-center gap-1 text-muted">
                                  <Building2 size={13} />
                                  <strong className="text-dark fw-semibold">{asset.providerOrganization}</strong>
                                </span>
                                <span className="text-muted">·</span>
                                <span
                                  className="badge rounded-pill px-2 py-0.5"
                                  style={{
                                    fontSize: '0.7rem',
                                    backgroundColor:
                                      asset.operationalStatus === 'In Operations' || asset.operationalStatus === 'Available' || asset.operationalStatus === 'Fully Compliant'
                                        ? '#ECFDF5'
                                        : '#FEF3C7',
                                    color:
                                      asset.operationalStatus === 'In Operations' || asset.operationalStatus === 'Available' || asset.operationalStatus === 'Fully Compliant'
                                        ? '#059669'
                                        : '#D97706',
                                    border: '1px solid rgba(0,0,0,0.05)',
                                  }}
                                >
                                  {asset.operationalStatus}
                                </span>
                                <span className="text-muted">·</span>
                                <span className="font-mono-code text-primary fw-semibold" style={{ fontSize: '0.75rem' }}>
                                  {asset.complianceScore}% Verified
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="d-flex align-items-center gap-2 flex-shrink-0 justify-content-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium"
                              style={{ fontSize: '0.82rem', borderRadius: '6px' }}
                              onClick={() => setSelectedAsset(asset)}
                              title="Inspect Pre-Assurance Vault & Compare Requirements"
                            >
                              <Eye size={15} />
                              <span>Inspect Asset</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium"
                              style={{
                                fontSize: '0.82rem',
                                borderRadius: '6px',
                                backgroundColor: '#0B1B2B',
                                borderColor: '#0B1B2B',
                              }}
                              onClick={() => setSelectedAsset(asset)}
                              title="Nominate Asset for Project"
                            >
                              <Plus size={15} />
                              <span>Select</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* VIEW B: INSPECTION & ASSURANCE MATCH COMPARISON (EXACT MATCH TO USER SCREENSHOT) */
              <div className="d-flex flex-column gap-3">
                {/* 1. Asset Overview Banner */}
                <div
                  className="bg-white border rounded-2 shadow-2xs"
                  style={{ borderColor: '#E2E8F0', padding: '16px 20px' }}
                >
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="d-flex align-items-center gap-3.5 min-w-0">
                      <div className="d-flex flex-column min-w-0">
                        <div className="d-flex align-items-center gap-2">
                          <h6 className="fw-bold text-dark mb-0 text-truncate" style={{ fontSize: '1.02rem', color: '#0B1B2B' }}>
                            {selectedAsset.assetName}
                          </h6>
                        </div>
                        <span className="text-secondary small mt-1 text-truncate" style={{ fontSize: '0.82rem', color: '#64748B' }}>
                          Provided by <strong className="text-dark fw-semibold">{selectedAsset.providerOrganization}</strong> · Base: {selectedAsset.location}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-3 pe-1">
                      <div className="text-end">
                        <div className="text-secondary text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748B', letterSpacing: '0.04em' }}>
                          PRE-ASSURANCE SCORE
                        </div>
                        <div className="fw-bold font-mono-code text-primary" style={{ fontSize: '1.05rem' }}>
                          {selectedAsset.complianceScore || 98}% Verified
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Select Target Project & Multi Assurance Set Picker */}
                <div
                  className="card border bg-white rounded-2 shadow-2xs"
                  style={{ borderColor: '#E2E8F0', padding: '20px' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <label className="form-label fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem', color: '#0B1B2B' }}>
                      Select Target Project <span className="text-danger">*</span>
                    </label>
                    <span className="text-secondary small" style={{ fontSize: '0.8rem' }}>
                      {assetEligibleAssuranceSets.length > 0
                        ? `${assetEligibleAssuranceSets.length} Eligible Set${assetEligibleAssuranceSets.length !== 1 ? 's' : ''}`
                        : 'No eligible assurance sets'}
                    </span>
                  </div>

                  <div className="row g-3">
                    {/* Project Selector (Pre-selected to current project) */}
                    <div className="col-12 col-lg-6">
                      <div className="position-relative">
                        <select
                          className="form-select"
                          value={project.id}
                          disabled
                          style={{
                            fontSize: '0.85rem',
                            minHeight: '42px',
                            borderColor: '#CBD5E1',
                            padding: '9px 42px 9px 14px',
                            borderRadius: '6px',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            backgroundColor: '#F8FAFC',
                          }}
                        >
                          <option value={project.id}>
                            {project.id} — {project.name}
                          </option>
                        </select>
                        <div
                          className="position-absolute pe-none"
                          style={{
                            top: '2px',
                            bottom: '2px',
                            right: '28px',
                            width: '28px',
                            background: 'linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1))',
                            zIndex: 1,
                          }}
                        />
                      </div>
                    </div>

                    {/* Multi-Assurance Set Selector Dropdown */}
                    <div className="col-12 col-lg-6">
                      <div className="position-relative">
                        <select
                          className="form-select"
                          value={selectedAssuranceSetId}
                          onChange={(e) => setSelectedAssuranceSetId(e.target.value)}
                          disabled={assetEligibleAssuranceSets.length === 0}
                          style={{
                            fontSize: '0.85rem',
                            minHeight: '42px',
                            borderColor: '#CBD5E1',
                            padding: '9px 42px 9px 14px',
                            borderRadius: '6px',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                          }}
                        >
                          {assetEligibleAssuranceSets.length === 0 ? (
                            <option value="">No eligible assurance sets</option>
                          ) : (
                            assetEligibleAssuranceSets.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.id} — {s.title} ({s.stage || 'Validation'})
                              </option>
                            ))
                          )}
                        </select>
                        <div
                          className="position-absolute pe-none"
                          style={{
                            top: '2px',
                            bottom: '2px',
                            right: '28px',
                            width: '28px',
                            background: 'linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1))',
                            zIndex: 1,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Project Highlight Strip (Exact Match to Screenshot) */}
                  <div
                    className="mt-3 rounded-2 border d-flex flex-wrap align-items-center justify-content-between gap-3"
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderColor: '#E2E8F0',
                      padding: '12px 18px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div className="d-flex align-items-center gap-3.5 flex-wrap">
                      <span className="d-flex align-items-center gap-1.5 text-secondary">
                        <Building2 size={15} className="text-primary flex-shrink-0" />
                        <span>Requester: <strong className="text-dark">{project.requestingOrganization}</strong></span>
                      </span>
                      <span className="d-flex align-items-center gap-1.5 text-secondary">
                        <MapPin size={15} className="text-warning flex-shrink-0" />
                        <span>{project.routeDescription || project.workLocationType || 'Timor Sea — High-Risk Transit Corridor'}</span>
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-2.5">
                      <span
                        className="badge px-3 py-1.5 rounded-pill font-mono-code"
                        style={{
                          backgroundColor: '#EFF6FF',
                          color: '#1E40AF',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                        }}
                      >
                        {project.status}
                      </span>
                      <span className="text-secondary small">
                        {project.assetLinks.length} Assets Linked
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Pre-Assurance Vault & Comparison Tabs Card */}
                <div className="card border bg-white rounded-2 shadow-2xs overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                  {/* Tabs Header */}
                  <div
                    className="d-flex align-items-center justify-content-between px-3.5 pt-2.5 border-bottom"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                  >
                    <ul className="nav nav-tabs border-0 gap-2">
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link border-0 px-3 py-2 small fw-semibold ${activeTab === 'comparison'
                            ? 'active border-bottom border-primary border-3 fw-bold text-primary'
                            : 'text-secondary'
                            }`}
                          style={{
                            fontSize: '0.84rem',
                            color: activeTab === 'comparison' ? '#0B1B2B' : '#64748B',
                            borderBottomColor: activeTab === 'comparison' ? '#0B1B2B' : 'transparent',
                          }}
                          onClick={() => setActiveTab('comparison')}
                        >
                          <span className="d-flex align-items-center gap-1.5">
                            <Sparkles size={14} className="text-primary" />
                            <span>Assurance Match Comparison</span>
                            <span
                              className="badge rounded-pill ms-1 font-mono-code"
                              style={{
                                backgroundColor: matchSummary.percentage >= 80 ? '#DCFCE7' : '#FEF3C7',
                                color: matchSummary.percentage >= 80 ? '#15803D' : '#D97706',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}
                            >
                              {matchSummary.percentage}% Match
                            </span>
                          </span>
                        </button>
                      </li>

                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link border-0 px-3 py-2 small fw-semibold ${activeTab === 'vault'
                            ? 'active border-bottom border-primary border-3 fw-bold text-primary'
                            : 'text-secondary'
                            }`}
                          style={{
                            fontSize: '0.84rem',
                            color: activeTab === 'vault' ? '#0B1B2B' : '#64748B',
                            borderBottomColor: activeTab === 'vault' ? '#0B1B2B' : 'transparent',
                          }}
                          onClick={() => setActiveTab('vault')}
                        >
                          <span className="d-flex align-items-center gap-1.5">
                            <FileCheck size={14} />
                            <span>Pre-Assurance Vault Records</span>
                            <span className="badge bg-secondary text-white rounded-pill ms-1 font-mono-code" style={{ fontSize: '0.7rem' }}>
                              {vaultDocuments.length}
                            </span>
                          </span>
                        </button>
                      </li>
                    </ul>
                  </div>

                  {/* Tab Content 1: Comparison Matrix */}
                  {activeTab === 'comparison' && (
                    <div className="p-3.5">
                      {/* Comparison Metric Callout Banner */}
                      <div
                        className="p-3 mb-3 rounded-2 border d-flex align-items-center justify-content-between"
                        style={{
                          backgroundColor: matchSummary.gapsCount === 0 ? '#F0FDF4' : '#FFFBEB',
                          borderColor: matchSummary.gapsCount === 0 ? '#BBF7D0' : '#FDE68A',
                        }}
                      >
                        <div className="d-flex align-items-center gap-2.5">
                          {matchSummary.gapsCount === 0 ? (
                            <CheckCircle2 size={20} className="text-success flex-shrink-0" />
                          ) : (
                            <AlertCircle size={20} className="text-warning flex-shrink-0" />
                          )}
                          <div>
                            <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>
                              {matchSummary.matchedCount} of {matchSummary.total} Project Assurance Requirements Satisfied
                            </div>
                            <div className="text-secondary small mt-0.5" style={{ fontSize: '0.78rem' }}>
                              {matchSummary.gapsCount === 0
                                ? 'All statutory and operational requirements are 100% matched by valid pre-assurance vault documents.'
                                : `${matchSummary.gapsCount} requirement requires document review or supplementary certificate upload.`}
                            </div>
                          </div>
                        </div>

                        <div className="text-end ps-3">
                          <span className="fw-bold font-mono-code" style={{ fontSize: '1.15rem', color: '#0B1B2B' }}>
                            {matchSummary.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Requirements vs Pre-Assurance Document Table */}
                      <div className="table-responsive border rounded-2" style={{ borderColor: '#E2E8F0' }}>
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                          <thead style={{ backgroundColor: '#F8FAFC', color: '#64748B' }}>
                            <tr>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>
                                Project Requirement
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>
                                Matched Pre-Assurance Document
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold text-center" style={{ fontSize: '0.7rem', width: '140px' }}>
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {comparisonResults.map((comp) => (
                              <tr key={comp.requirementId}>
                                <td className="px-3 py-2.5">
                                  <div className="fw-semibold text-dark">{comp.requirementTitle}</div>
                                  <span className="text-secondary small" style={{ fontSize: '0.74rem' }}>
                                    {comp.category} · {comp.isMandatory ? <span className="text-danger fw-semibold">Mandatory</span> : 'Supplementary'}
                                  </span>
                                </td>

                                <td className="px-3 py-2.5">
                                  {comp.matchedDoc ? (
                                    <div>
                                      <div className="d-flex align-items-center gap-1.5 fw-medium text-dark">
                                        <FileCheck size={14} className="text-primary flex-shrink-0" />
                                        <span className="text-truncate">{comp.matchedDoc.title}</span>
                                      </div>
                                      <div className="d-flex align-items-center gap-2 text-secondary small font-mono-code mt-0.5" style={{ fontSize: '0.74rem' }}>
                                        <span>{comp.matchedDoc.certificateNo}</span>
                                        <span>·</span>
                                        <span>{comp.matchedDoc.issuingAuthority}</span>
                                        <span>·</span>
                                        <span>Exp: {comp.matchedDoc.expiryDate}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted fst-italic small">No direct match in vault</span>
                                  )}
                                </td>

                                <td className="px-3 py-2.5 text-center">
                                  {comp.matchStatus === 'matched_valid' && (
                                    <span
                                      className="badge rounded-pill px-2.5 py-1 font-mono-code"
                                      style={{
                                        backgroundColor: '#DCFCE7',
                                        color: '#15803D',
                                        border: '1px solid #BBF7D0',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Matched
                                    </span>
                                  )}
                                  {comp.matchStatus === 'matched_expiring' && (
                                    <span
                                      className="badge rounded-pill px-2.5 py-1 font-mono-code"
                                      style={{
                                        backgroundColor: '#FEF3C7',
                                        color: '#B45309',
                                        border: '1px solid #FDE68A',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Expiring Soon
                                    </span>
                                  )}
                                  {comp.matchStatus === 'gap_missing' && (
                                    <span
                                      className="badge rounded-pill px-2.5 py-1 font-mono-code"
                                      style={{
                                        backgroundColor: '#FEE2E2',
                                        color: '#B91C1C',
                                        border: '1px solid #FECACA',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Action Required
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab Content 2: Pre-Assurance Vault Records */}
                  {activeTab === 'vault' && (
                    <div className="p-3.5">
                      <div className="table-responsive border rounded-2" style={{ borderColor: '#E2E8F0' }}>
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                          <thead style={{ backgroundColor: '#F8FAFC', color: '#64748B' }}>
                            <tr>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>
                                Certificate No / ID
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>
                                Document Title
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>
                                Issuing Authority
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold font-mono-code" style={{ fontSize: '0.7rem', width: '130px' }}>
                                Expiry Date
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold text-center" style={{ fontSize: '0.7rem', width: '110px' }}>
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {vaultDocuments.map((doc) => (
                              <tr key={doc.id}>
                                <td className="px-3 py-2.5">
                                  <span className="font-mono-code fw-semibold text-primary" style={{ fontSize: '0.8rem' }}>
                                    {doc.certificateNo}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="d-flex align-items-center gap-1.5 fw-semibold text-dark">
                                    <FileCheck size={14} className="text-primary flex-shrink-0" />
                                    <span className="text-truncate">{doc.title}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-secondary small">
                                  {doc.issuingAuthority}
                                </td>
                                <td className="px-3 py-2.5 font-mono-code text-secondary small">
                                  {doc.expiryDate}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span
                                    className="badge rounded-pill px-2.5 py-1"
                                    style={{
                                      backgroundColor: doc.complianceState === 'Expired' ? '#FEE2E2' : '#DCFCE7',
                                      color: doc.complianceState === 'Expired' ? '#B91C1C' : '#15803D',
                                      border: `1px solid ${doc.complianceState === 'Expired' ? '#FECACA' : '#BBF7D0'}`,
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {doc.complianceState}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Modal Footer */}
          <div
            className="modal-footer d-flex align-items-center justify-content-between px-4 py-3 border-top flex-shrink-0"
            style={{ backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0' }}
          >
            {selectedAsset ? (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-3 py-2 fw-medium"
                  onClick={() => setSelectedAsset(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 px-4 py-2 fw-semibold"
                  style={{
                    backgroundColor: '#0B1B2B',
                    borderColor: '#0B1B2B',
                  }}
                  onClick={handleConfirmAddAsset}
                  disabled={isSubmitting || !selectedAssuranceSetId}
                >
                  <Plus size={16} />
                  <span>{isSubmitting ? 'Linking to Charter...' : 'Add Asset to Project'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-3 py-2 fw-medium"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <div className="text-muted small">
                  Showing {filteredAssets.length} external provider assets
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
