/*
  file summary: dedicated modal for ProjectDetailView to browse external assets, inspect pre-assurance vault documents, and choose between applicable assurance sets for comparison matrix.
  responsibilities: filters strictly for non-owned external assets, renders marketplace-aligned inspection UI with multiple assurance set selection, and handles roster linking.
  role in system: opened when clicking 'Add Asset' on ProjectDetailView.
*/

import React, { useState, useMemo, useEffect } from 'react';
import {
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
  ArrowLeft,
  Plus,
  Eye,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';
import { useMapStore } from '../../store/useMapStore';
import { Project, ProjectAssetLink, ProjectAssetType } from '../../types/project';
import { MasterDocument, ComplianceState } from '../../types/document';
import { AssuranceRequirementCategory, AssuranceSet } from '../../types/assurance';
import { VesselInformation } from '../../types/vessel';
import { CrewMember } from '../../types/crew';
import { EquipmentAsset } from '../../types/equipment';
import {
  getLinkableProjectAssets,
  getProjectClientOrganization,
  getProjectIncludedOrganizations,
  sameOrganization,
} from '../../utils/projectHelpers';
import { orgFieldMatches } from '../../utils/rbacHelpers';
import { normalizeText, matchesVesselRequirement } from '../../utils/documentMatchingHelpers';
import {
  calculateCrewComplianceScore,
  calculateEquipmentReadiness,
  calculateVesselReadiness,
} from '../../utils/readinessHelpers';
import { formatReadinessScore, getStatusDisplayLabel } from '../../utils/formatters';
import { usePagination } from '../../utils/usePagination';
import { Tabs } from '../common/Tabs';
import { TablePagination } from '../common/TablePagination';
import { ProjectAssetPicker } from '../common/ProjectAssetPicker';

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

/** shown when an asset has no recorded base / port */
export const PROJECT_ASSET_LOCATION_NOT_RECORDED = 'Not recorded';

/**
  what: location for a project add-asset candidate — vessel port, equipment parent-vessel port, or crew current-vessel port.
  how: reads only registry fields; never invents Dampier / Henderson / Perth defaults.
*/
export function projectAssetLocation(input: {
  assetType: ProjectAssetType;
  vesselRef?: VesselInformation;
  crewRef?: CrewMember;
  equipmentRef?: EquipmentAsset;
  vessels: VesselInformation[];
}): string {
  if (input.assetType === 'Vessel') {
    return input.vesselRef?.portOfRegistry?.trim() || PROJECT_ASSET_LOCATION_NOT_RECORDED;
  }
  if (input.assetType === 'Equipment') {
    const parentId = input.equipmentRef?.parentVesselId;
    const parent = parentId ? input.vessels.find((v) => v.id === parentId) : undefined;
    return parent?.portOfRegistry?.trim() || PROJECT_ASSET_LOCATION_NOT_RECORDED;
  }
  const crewVesselId = input.crewRef?.currentVesselId;
  const crewVessel = crewVesselId ? input.vessels.find((v) => v.id === crewVesselId) : undefined;
  return crewVessel?.portOfRegistry?.trim() || PROJECT_ASSET_LOCATION_NOT_RECORDED;
}

function pushUniqueVaultDoc(list: VaultCertificateDisplay[], doc: VaultCertificateDisplay): void {
  if (list.some((existing) => existing.id === doc.id || existing.title.toLowerCase() === doc.title.toLowerCase())) {
    return;
  }
  list.push(doc);
}

/** store / asset-record certificates for the selected candidate — never invents a baseline pack */
export function buildProjectAssetVaultDocuments(input: {
  assetType: ProjectAssetType;
  assetId: string;
  assetName: string;
  vesselRef?: VesselInformation;
  crewRef?: CrewMember;
  equipmentRef?: EquipmentAsset;
  documents: MasterDocument[];
}): VaultCertificateDisplay[] {
  const list: VaultCertificateDisplay[] = [];
  const { assetType, assetId, assetName, vesselRef, crewRef, equipmentRef, documents } = input;

  const storeMatchingDocs = documents.filter((d) => {
    if (assetType === 'Vessel') {
      return (
        d.vesselId === assetId ||
        (d.vesselAttributes && d.vesselAttributes.vesselName.toLowerCase() === assetName.toLowerCase())
      );
    }
    if (assetType === 'Crew') {
      const nameMatch =
        d.crewAttributes && d.crewAttributes.crewName.toLowerCase() === assetName.toLowerCase();
      const idInText = `${d.id} ${d.title} ${d.certificateNo}`.toLowerCase().includes(assetId.toLowerCase());
      return d.entityType === 'Crew Certificate' && Boolean(nameMatch || idInText);
    }
    if (assetType === 'Equipment' && equipmentRef) {
      const haystack = `${d.id} ${d.title} ${d.certificateNo}`.toLowerCase();
      return (
        haystack.includes(equipmentRef.id.toLowerCase()) ||
        haystack.includes(equipmentRef.equipmentIdentifier.toLowerCase()) ||
        haystack.includes(equipmentRef.name.toLowerCase())
      );
    }
    return false;
  });

  storeMatchingDocs.forEach((d) => {
    pushUniqueVaultDoc(list, {
      id: d.id,
      title: d.title,
      certificateNo: d.certificateNo || '—',
      issuingAuthority: d.issuingAuthority || '—',
      expiryDate: d.expiryDate || '—',
      complianceState: d.complianceState || 'Valid',
      ocrConfidence: d.ocrConfidence ?? 0,
      sourceType: 'vault_document',
    });
  });

  if (assetType === 'Vessel' && vesselRef?.statutoryCertificates) {
    vesselRef.statutoryCertificates.forEach((cert, idx) => {
      pushUniqueVaultDoc(list, {
        id: cert.certificateNumber || `statutory-${assetId}-${idx}`,
        title: cert.name,
        certificateNo: cert.certificateNumber || '—',
        issuingAuthority: cert.issuingBody || vesselRef.classificationSociety || '—',
        expiryDate: cert.expiryDate || '—',
        complianceState: cert.status === 'Expired' ? 'Expired' : 'Valid',
        ocrConfidence: 0,
        sourceType: 'statutory_cert',
      });
    });
  }

  if (assetType === 'Crew' && crewRef) {
    const allStcw = [...(crewRef.layer1CoreDocuments || []), ...(crewRef.layer2Endorsements || [])];
    allStcw.forEach((doc) => {
      pushUniqueVaultDoc(list, {
        id: doc.id,
        title: doc.title,
        certificateNo: doc.certificateNo || '—',
        issuingAuthority: doc.issuingAuthority || '—',
        expiryDate: doc.expiryDate || '—',
        complianceState: doc.verificationStatus === 'Expired' ? 'Expired' : 'Valid',
        ocrConfidence: 0,
        sourceType: 'stcw_cert',
      });
    });
  }

  /* equipment certificates come only from the document store above — no invented load-test cards */
  return list;
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
  /* calculated readiness of the asset; null when no assurance evidence covers it */
  complianceScore: number | null;
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
    projects,
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

    const clientOrganization = getProjectClientOrganization(project);
    const providerOrganizations = getProjectIncludedOrganizations(project).filter(
      (organization) =>
        !sameOrganization(organization, clientOrganization) &&
        !orgFieldMatches(clientOrganization, organization),
    );

    const linkable = getLinkableProjectAssets({
      vessels,
      crew,
      equipment,
      assuranceSets,
      requestingOrganization: project.requestingOrganization,
      excludeAssetKeys: project.assetLinks.map((l) => `${l.assetType}:${l.assetId}`),
      /* a set belongs to at most one project, so only orphaned sets are offered */
      orphanedAmongProjects: projects,
      /* when provider parties exist, only their assets; always require sets inside the project window */
      allowedProviderOrganizations:
        providerOrganizations.length > 0 ? providerOrganizations : undefined,
      projectWindowStart: project.charterWindowStart,
      projectWindowEnd: project.charterWindowEnd,
    });

    return linkable.map((asset) => {
      if (asset.assetType === 'Vessel') {
        const vesselRef = vessels.find((v) => v.id === asset.assetId);
        return {
          ...asset,
          location: projectAssetLocation({ assetType: 'Vessel', vesselRef, vessels }),
          subtypeOrRole: `${vesselRef?.vesselType || 'Vessel'} · ${vesselRef?.vesselSubtype || 'General'}`,
          operationalStatus: vesselRef?.status || 'Available',
          complianceScore: vesselRef ? calculateVesselReadiness(vesselRef, assuranceSets, documents) : null,
          vesselRef,
        };
      }

      if (asset.assetType === 'Equipment') {
        const equipmentRef = equipment.find((e) => e.id === asset.assetId);
        return {
          ...asset,
          location: projectAssetLocation({ assetType: 'Equipment', equipmentRef, vessels }),
          subtypeOrRole: `${equipmentRef?.category || 'Equipment'} · ${equipmentRef?.model || 'Standard'}`,
          operationalStatus: equipmentRef?.availabilityStatus || 'Available',
          complianceScore: equipmentRef ? calculateEquipmentReadiness(equipmentRef, assuranceSets) : null,
          equipmentRef,
        };
      }

      const crewRef = crew.find((c) => c.id === asset.assetId);
      return {
        ...asset,
        location: projectAssetLocation({ assetType: 'Crew', crewRef, vessels }),
        subtypeOrRole: `${crewRef?.rank || 'Crew'} · ${crewRef?.nationality || 'STCW Certified'}`,
        operationalStatus: crewRef?.complianceStatus || 'Available',
        complianceScore: crewRef ? calculateCrewComplianceScore(crewRef) : null,
        crewRef,
      };
    });
  }, [project, projects, vessels, equipment, crew, assuranceSets, documents]);

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedAssuranceSetId('');
      return;
    }
    setSelectedAssuranceSetId(selectedAsset.eligibleAssuranceSets[0]?.id || '');
  }, [selectedAsset]);

  const pickerAssets = useMemo(
    () =>
      candidateAssets.map((asset) => ({
        ...asset,
        searchExtra: `${asset.subtypeOrRole} ${asset.operationalStatus} ${asset.location}`,
      })),
    [candidateAssets],
  );

  // 3. Document Vault for Selected Asset — store and asset records only
  const vaultDocuments = useMemo<VaultCertificateDisplay[]>(() => {
    if (!selectedAsset) return [];
    return buildProjectAssetVaultDocuments({
      assetType: selectedAsset.assetType,
      assetId: selectedAsset.assetId,
      assetName: selectedAsset.assetName,
      vesselRef: selectedAsset.vesselRef,
      crewRef: selectedAsset.crewRef,
      equipmentRef: selectedAsset.equipmentRef,
      documents,
    });
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

  const comparisonPagination = usePagination(comparisonResults, [selectedAsset?.assetId, selectedAssuranceSetId]);
  const vaultPagination = usePagination(vaultDocuments, [selectedAsset?.assetId]);

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

  const footerNode = selectedAsset ? (
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
        style={{ backgroundColor: '#0B1B2B', borderColor: '#0B1B2B' }}
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
      <div className="text-muted small">{pickerAssets.length} assets</div>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Asset to Project"
      meta={<span>Check the asset's documents against the project requirements.</span>}
      size="xl"
      dismissible={!isSubmitting}
      footer={footerNode}
      bodyClassName="p-0"
    >
      <div className="p-4" style={{ backgroundColor: '#F8FAFC' }}>
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
              <ProjectAssetPicker
                assets={pickerAssets}
                typeFilter={categoryFilter}
                onTypeFilterChange={setCategoryFilter}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                variant="card"
                maxHeight={420}
                emptyTitle="No Assets Available"
                emptyHint="Only chartered or rented assets with an assurance set that is not in a project appear here."
                showAssuranceSetSelect={false}
                renderAssetMeta={(asset) => (
                  <>
                    <div className="text-muted small mt-1 text-truncate">{asset.subtypeOrRole}</div>
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
                            asset.operationalStatus === 'In Operations' ||
                            asset.operationalStatus === 'Available' ||
                            asset.operationalStatus === 'Fully Compliant'
                              ? '#ECFDF5'
                              : '#FEF3C7',
                          color:
                            asset.operationalStatus === 'In Operations' ||
                            asset.operationalStatus === 'Available' ||
                            asset.operationalStatus === 'Fully Compliant'
                              ? '#059669'
                              : '#D97706',
                          border: '1px solid rgba(0,0,0,0.05)',
                        }}
                      >
                        {asset.operationalStatus}
                      </span>
                      <span className="text-muted">·</span>
                      <span className="font-mono-code text-primary fw-semibold" style={{ fontSize: '0.75rem' }}>
                        {asset.complianceScore === null
                          ? formatReadinessScore(null)
                          : `${formatReadinessScore(asset.complianceScore)} Verified`}
                      </span>
                    </div>
                  </>
                )}
                renderActions={(asset) => (
                  <div className="d-flex align-items-center gap-2 flex-shrink-0 justify-content-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-3 py-1.5 fw-medium"
                      style={{ fontSize: '0.82rem', borderRadius: '6px' }}
                      onClick={() => setSelectedAsset(asset)}
                      title="Check documents against requirements"
                    >
                      <Eye size={15} />
                      <span>Check</span>
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
                      title="Select asset"
                    >
                      <Plus size={15} />
                      <span>Select</span>
                    </button>
                  </div>
                )}
              />
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
                          READINESS
                        </div>
                        <div className="fw-bold font-mono-code text-primary" style={{ fontSize: '1.05rem' }}>
                          {selectedAsset.complianceScore === null
                            ? formatReadinessScore(null)
                            : `${formatReadinessScore(selectedAsset.complianceScore)} Verified`}
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
                      Project <span className="text-danger">*</span>
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
                            <option value="">No assurance sets</option>
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
                    <Tabs
                      variant="section"
                      aria-label="Asset match and documents tabs"
                      active={activeTab}
                      onChange={(key) => setActiveTab(key as typeof activeTab)}
                      tabs={[
                        {
                          key: 'comparison',
                          label: 'Requirement Match',
                          icon: Sparkles,
                          count: matchSummary.percentage,
                          tone: matchSummary.percentage >= 80 ? 'default' : 'warn',
                        },
                        {
                          key: 'vault',
                          label: 'Documents',
                          icon: FileCheck,
                          count: vaultDocuments.length,
                        },
                      ]}
                    />
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
                                Requirement
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>
                                Matched Document
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold text-center" style={{ fontSize: '0.7rem', width: '140px' }}>
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {comparisonPagination.pageItems.map((comp) => (
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
                                        <span>Expires: {comp.matchedDoc.expiryDate}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted fst-italic small">No matching document</span>
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
                      <TablePagination {...comparisonPagination.controls} />
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
                                Certificate No.
                              </th>
                              <th className="px-3 py-2.5 text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>
                                Title
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
                            {vaultPagination.pageItems.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3 py-4 text-center text-muted">
                                  No document on file.
                                </td>
                              </tr>
                            ) : (
                              vaultPagination.pageItems.map((doc) => (
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
                                    {getStatusDisplayLabel(doc.complianceState)}
                                  </span>
                                </td>
                              </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <TablePagination {...vaultPagination.controls} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
    </Modal>
  );
};
