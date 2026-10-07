/*
  file summary: comprehensive modal to inspect an asset's pre-assurance vault documents and link it into an existing project charter.
  responsibilities: project picker, assurance set mapping, pre-assurance vault document viewer, and intelligent requirement-to-vault comparison matrix.
  role in system: used across MarketplaceView, VesselDetailView, CrewDetailView, and EquipmentDetailView.
*/

import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  FolderPlus,
  Ship,
  Wrench,
  Users,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Building2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { ProjectAssetType } from '../../types/project';
import { MarketplaceItem } from '../../types/marketplace';
import { MasterDocument, ComplianceState } from '../../types/document';
import { AssuranceRequirementCategory } from '../../types/assurance';
import {
  filterProjectsForPersona,
  getEligibleAssuranceSetsForAsset,
  getProjectOrganizationForPersona,
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

export interface AddToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetType: ProjectAssetType;
  assetId: string;
  assetName: string;
  providerOrganization: string;
  marketplaceItem?: MarketplaceItem | null;
  initialProjectId?: string;
}

export const AddToProjectModal: React.FC<AddToProjectModalProps> = ({
  isOpen,
  onClose,
  assetType,
  assetId,
  assetName,
  providerOrganization,
  marketplaceItem,
  initialProjectId,
}) => {
  const {
    projects,
    assuranceSets,
    vessels,
    crew,
    equipment,
    documents,
    activePersona,
    users,
    addAssetToProject,
    addAssuranceSet,
    setCurrentHashView,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<'comparison' | 'vault'>('comparison');
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [selectedAssuranceSetId, setSelectedAssuranceSetId] = useState('');
  const [roleInProject, setRoleInProject] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // 1. Gather visible projects for current persona
  const visibleProjects = useMemo(
    () => filterProjectsForPersona(projects, activePersona, users, assuranceSets),
    [projects, activePersona, users, assuranceSets],
  );

  // Initialize selected project
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setIsSubmitting(false);
    setSuccessToast(false);

    if (initialProjectId && visibleProjects.some((p) => p.id === initialProjectId)) {
      setSelectedProjectId(initialProjectId);
    } else if (visibleProjects.length > 0 && (!selectedProjectId || !visibleProjects.some((p) => p.id === selectedProjectId))) {
      setSelectedProjectId(visibleProjects[0].id);
    }
  }, [isOpen, visibleProjects, initialProjectId, selectedProjectId]);

  const selectedProject = useMemo(
    () => visibleProjects.find((p) => p.id === selectedProjectId),
    [visibleProjects, selectedProjectId],
  );

  const effectiveProviderOrg =
    providerOrganization ||
    marketplaceItem?.providerOrg ||
    getProjectOrganizationForPersona(activePersona, users);

  // 2. Fetch or compute Pre-Assurance Vault Documents for this asset
  const vaultDocuments = useMemo<VaultCertificateDisplay[]>(() => {
    const list: VaultCertificateDisplay[] = [];

    // Match master documents from the Document Library Vault
    const storeMatchingDocs = documents.filter((d: MasterDocument) => {
      if (assetType === 'Vessel') {
        return (
          d.vesselId === assetId ||
          (d.vesselAttributes && d.vesselAttributes.vesselName.toLowerCase() === assetName.toLowerCase()) ||
          (marketplaceItem?.linkedEntityId && d.vesselId === marketplaceItem.linkedEntityId)
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

    // Check vessel statutory certificates if asset is vessel
    if (assetType === 'Vessel') {
      const v = vessels.find((ves) => ves.id === assetId || ves.name.toLowerCase() === assetName.toLowerCase());
      if (v?.statutoryCertificates) {
        v.statutoryCertificates.forEach((cert, idx) => {
          if (!list.some((existing) => existing.title.toLowerCase() === cert.name.toLowerCase())) {
            list.push({
              id: `MAP-VES-STAT-${idx + 100}`,
              title: cert.name,
              certificateNo: cert.certificateNumber || `DNV-STAT-${idx + 400}`,
              issuingAuthority: cert.issuingBody || v.classificationSociety || 'DNV',
              expiryDate: cert.expiryDate || '2027-09-30',
              complianceState: cert.status === 'Expired' ? 'Expired' : 'Valid',
              ocrConfidence: 98,
              sourceType: 'statutory_cert',
            });
          }
        });
      }
    }

    // Check crew STCW documents if asset is crew
    if (assetType === 'Crew') {
      const c = crew.find((crw) => crw.id === assetId || crw.fullName.toLowerCase() === assetName.toLowerCase());
      if (c) {
        const allStcw = [...(c.layer1CoreDocuments || []), ...(c.layer2Endorsements || [])];
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
    }

    // Check equipment certifications if asset is equipment
    if (assetType === 'Equipment') {
      const eq = equipment.find((e) => e.id === assetId || e.name.toLowerCase() === assetName.toLowerCase());
      if (eq) {
        list.push({
          id: `MAP-EQP-STAT-001`,
          title: 'Class Survey & Proof Load Test',
          certificateNo: `ABS-EQP-${eq.equipmentIdentifier || 'PL-992'}`,
          issuingAuthority: eq.classStatus || 'American Bureau of Shipping (ABS)',
          expiryDate: '2027-11-15',
          complianceState: 'Valid',
          ocrConfidence: 98,
          sourceType: 'equipment_spec',
        });
        list.push({
          id: `MAP-EQP-STAT-002`,
          title: 'Manufacturer Factory Acceptance Certificate',
          certificateNo: `OEM-FAC-${eq.model || 'CERT-401'}`,
          issuingAuthority: eq.manufacturer || 'Certified OEM',
          expiryDate: '2029-01-01',
          complianceState: 'Valid',
          ocrConfidence: 99,
          sourceType: 'equipment_spec',
        });
      }
    }

    // If item comes from marketplace, include certifications and fallback pre-assurance items
    if (marketplaceItem?.certifications && marketplaceItem.certifications.length > 0) {
      marketplaceItem.certifications.forEach((certName, idx) => {
        if (!list.some((existing) => normalizeText(existing.title).includes(normalizeText(certName)))) {
          list.push({
            id: `MAP-MKT-STAT-${idx + 300}`,
            title: certName,
            certificateNo: `MAP-${marketplaceItem.category.toUpperCase().slice(0, 3)}-2026-STAT-${idx + 101}`,
            issuingAuthority: marketplaceItem.providerOrg || 'IACS Classification Society',
            expiryDate: '2028-05-30',
            complianceState: 'Valid',
            ocrConfidence: 98,
            sourceType: 'vault_document',
          });
        }
      });
    }

    // Ensure baseline statutory pack if empty for rich demonstration
    if (list.length === 0) {
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
        {
          id: 'MAP-VES-2026-STAT-00415',
          title: 'Dynamic Positioning Annual FMEA & Capability Plot',
          certificateNo: 'IMCA-DP2-2026-88',
          issuingAuthority: 'IMCA Accredited Surveyor',
          expiryDate: '2027-08-20',
          complianceState: 'Valid',
          ocrConfidence: 99,
          sourceType: 'vault_document',
        },
      );
    }

    return list;
  }, [assetType, assetId, assetName, marketplaceItem, documents, vessels, crew, equipment]);

  // Helper to match requirement title and category against a vault document
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

    // Domain keyword matching
    if (
      (reqNorm.includes('class') || reqNorm.includes('hull')) &&
      (docNorm.includes('class') || docNorm.includes('100a1') || docNorm.includes('hull') || docNorm.includes('lloyd') || docNorm.includes('dnv') || docNorm.includes('abs') || docNorm.includes('register'))
    ) return true;

    if (
      (reqNorm.includes('solas') || reqNorm.includes('safety') || reqNorm.includes('construction') || reqNorm.includes('equipment') || reqNorm.includes('cargo ship')) &&
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
      (reqNorm.includes('iopp') || reqNorm.includes('marpol') || reqNorm.includes('environmental') || reqNorm.includes('annex') || reqNorm.includes('pollution')) &&
      (docNorm.includes('iopp') || docNorm.includes('marpol') || docNorm.includes('environmental') || docNorm.includes('tier') || docNorm.includes('pollution'))
    ) return true;

    if (
      (reqNorm.includes('stcw') || reqNorm.includes('master') || reqNorm.includes('officer') || reqNorm.includes('coc')) &&
      (docNorm.includes('stcw') || docNorm.includes('master') || docNorm.includes('coc') || docNorm.includes('deck'))
    ) return true;

    if (
      (reqNorm.includes('medical') || reqNorm.includes('eng1') || reqNorm.includes('fitness')) &&
      (docNorm.includes('medical') || docNorm.includes('eng1') || docNorm.includes('fitness'))
    ) return true;

    if (
      (reqNorm.includes('guard') || reqNorm.includes('firearms') || reqNorm.includes('security')) &&
      (docNorm.includes('guard') || docNorm.includes('firearms') || docNorm.includes('security'))
    ) return true;

    if (
      (reqNorm.includes('bosiet') || reqNorm.includes('huet') || reqNorm.includes('survival')) &&
      (docNorm.includes('bosiet') || docNorm.includes('huet') || docNorm.includes('survival'))
    ) return true;

    if (
      (reqNorm.includes('load test') || reqNorm.includes('proof load') || reqNorm.includes('swl') || reqNorm.includes('survey')) &&
      (docNorm.includes('load') || docNorm.includes('proof') || docNorm.includes('swl') || docNorm.includes('survey'))
    ) return true;

    if (
      (reqNorm.includes('factory') || reqNorm.includes('fac') || reqNorm.includes('oem') || reqNorm.includes('acceptance')) &&
      (docNorm.includes('factory') || docNorm.includes('fac') || docNorm.includes('oem') || docNorm.includes('acceptance'))
    ) return true;

    return false;
  };

  // 3. Find eligible and matching assurance sets for the selected project
  const eligibleSets = useMemo(() => {
    if (!selectedProject) return [];
    return getEligibleAssuranceSetsForAsset(assetType, assetId, assuranceSets, {
      requestingOrganization: selectedProject.requestingOrganization,
      providerOrganization: effectiveProviderOrg,
    });
  }, [assetType, assetId, assuranceSets, selectedProject, effectiveProviderOrg]);

  // All assurance sets related to the project with match scoring, strictly filtered by assetType
  const projectAssuranceSets = useMemo(() => {
    if (!selectedProject) return [];

    const candidatesMap = new Map<string, any>();

    // Helper: checks if a set matches the current asset type
    const matchesCurrentAssetType = (s: any) => {
      if (!s) return false;
      if (s.assuranceType === assetType) return true;
      if (s.subtypes && Array.isArray(s.subtypes) && s.subtypes.includes(assetType as any)) return true;
      return false;
    };

    // A. Master aggregated child sets that match assetType
    const masterSet = assuranceSets.find((s) => s.id === selectedProject.masterAssuranceSetId);
    if (masterSet) {
      if (masterSet.aggregatedFromSetIds) {
        masterSet.aggregatedFromSetIds.forEach((childId) => {
          const child = assuranceSets.find((s) => s.id === childId);
          if (child && matchesCurrentAssetType(child)) {
            candidatesMap.set(child.id, child);
          }
        });
      }
      if (matchesCurrentAssetType(masterSet)) {
        candidatesMap.set(masterSet.id, masterSet);
      }
    }

    // B. Direct project sets matching assetType
    assuranceSets.forEach((s) => {
      if (
        (s.projectId === selectedProject.id || selectedProject.assetLinks.some((l) => l.assuranceSetId === s.id)) &&
        matchesCurrentAssetType(s)
      ) {
        candidatesMap.set(s.id, s);
      }
    });

    // C. Eligible sets from helper matching assetType
    eligibleSets.forEach((es) => {
      if (matchesCurrentAssetType(es)) {
        candidatesMap.set(es.id, es);
      }
    });

    // D. Organization sets matching assetType
    assuranceSets.forEach((s) => {
      if (
        !s.isProjectMaster &&
        matchesCurrentAssetType(s) &&
        (!s.projectId ||
          s.projectId === selectedProject.id ||
          s.charterer === selectedProject.requestingOrganization ||
          s.initiatorOrg === selectedProject.requestingOrganization)
      ) {
        candidatesMap.set(s.id, s);
      }
    });

    const list = Array.from(candidatesMap.values());

    return list.map((s) => {
      let reqs = s.requirements || [];
      if (s.isProjectMaster && s.aggregatedFromSetIds) {
        const childReqs = assuranceSets
          .filter((cs) => s.aggregatedFromSetIds?.includes(cs.id))
          .flatMap((cs) => cs.requirements || []);
        if (childReqs.length > 0) reqs = childReqs;
      }
      const directReqs = reqs.filter((r: any) => r.fulfillmentType !== 'assurance_set');
      const targetReqs = directReqs.length > 0 ? directReqs : reqs;

      let matchedDocsCount = 0;
      targetReqs.forEach((r: any) => {
        if (vaultDocuments.some((doc) => checkDocumentMatchesRequirement(r.title, r.category, doc))) {
          matchedDocsCount++;
        }
      });

      return {
        ...s,
        _matchedDocsCount: matchedDocsCount,
        _totalReqsCount: targetReqs.length,
      };
    }).sort((a, b) => b._matchedDocsCount - a._matchedDocsCount);
  }, [selectedProject, assuranceSets, eligibleSets, assetType, vaultDocuments]);

  // Auto-select assurance set
  useEffect(() => {
    if (projectAssuranceSets.length > 0 && !selectedAssuranceSetId) {
      setSelectedAssuranceSetId('AUTO_GEN');
    } else if (projectAssuranceSets.length === 0) {
      setSelectedAssuranceSetId('AUTO_GEN');
    }
  }, [projectAssuranceSets, selectedAssuranceSetId]);

  const activeAssuranceSet = useMemo(() => {
    if (selectedAssuranceSetId === 'AUTO_GEN') return null;
    return assuranceSets.find((s) => s.id === selectedAssuranceSetId);
  }, [assuranceSets, selectedAssuranceSetId]);

  // 4. Compute Comparison Matrix (Project Assurance Requirements vs. Pre-Assurance Vault)
  const comparisonResults = useMemo<RequirementMatchComparison[]>(() => {
    let requirementsToCompare: any[] = [];

    if (activeAssuranceSet) {
      // Use active set's direct certificate requirements
      let reqs = activeAssuranceSet.requirements || [];
      if (activeAssuranceSet.isProjectMaster && activeAssuranceSet.aggregatedFromSetIds) {
        const childReqs = assuranceSets
          .filter((cs) => activeAssuranceSet.aggregatedFromSetIds?.includes(cs.id))
          .flatMap((cs) => cs.requirements || []);
        if (childReqs.length > 0) reqs = childReqs;
      }
      const nonLinkReqs = reqs.filter((r) => r.fulfillmentType !== 'assurance_set');
      requirementsToCompare = nonLinkReqs.length > 0 ? nonLinkReqs : reqs;
    } else {
      // AUTO_GEN: Auto-Attach Campaign Assurance Set (Recommended)
      // First check if the project has an existing assurance set matching this asset type
      const existingMatchingSet = projectAssuranceSets.find(
        (s) =>
          s.id !== selectedProject?.masterAssuranceSetId &&
          (s.assuranceType === assetType || s.subtypes?.includes(assetType as any)) &&
          s.requirements &&
          s.requirements.length > 0,
      );

      if (existingMatchingSet && existingMatchingSet.requirements) {
        const nonLinks = existingMatchingSet.requirements.filter((r: any) => r.fulfillmentType !== 'assurance_set');
        if (nonLinks.length > 0) {
          requirementsToCompare = nonLinks;
        }
      }

      // If requirements are still empty, build standard campaign scope for this asset type
      if (requirementsToCompare.length === 0) {
        if (assetType === 'Vessel') {
          requirementsToCompare = [
            {
              id: 'REQ-CLASS-001',
              category: 'Class Notation Certificate',
              title: 'Certificate of Class & Hull Survey',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 98,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-SOLAS-002',
              category: 'Statutory Certificate',
              title: 'SOLAS Safety Construction & Equipment',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 96,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-REG-003',
              category: 'Flag Administration Registry',
              title: 'Flag State Registry & Load Line Certificate',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 97,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-DP-004',
              category: 'Equipment Register',
              title: 'Dynamic Positioning / Operations Clearance',
              isMandatory: false,
              isFulfilled: true,
              ocrConfidence: 99,
              verifierStatus: 'Verified',
            },
          ];
        } else if (assetType === 'Crew') {
          requirementsToCompare = [
            {
              id: 'REQ-STCW-001',
              category: 'Crew Credential',
              title: 'STCW Master / CoC Endorsement',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 99,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-MED-002',
              category: 'Medical Fitness Certificate',
              title: 'ENG1 Medical Fitness Certification',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 97,
              verifierStatus: 'Verified',
            },
          ];
        } else if (assetType === 'Equipment') {
          requirementsToCompare = [
            {
              id: 'REQ-EQP-001',
              category: 'Statutory Certificate',
              title: 'Class Survey & Proof Load Test',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 98,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-EQP-002',
              category: 'Equipment Register',
              title: 'Manufacturer Factory Acceptance Certificate (FAC)',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 99,
              verifierStatus: 'Verified',
            },
          ];
        } else {
          requirementsToCompare = [
            {
              id: 'REQ-ACT-001',
              category: 'Custom Requirement',
              title: 'Risk Assessment & Method Statement (RAMS)',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 95,
              verifierStatus: 'Verified',
            },
          ];
        }
      }
    }

    return requirementsToCompare.map((req) => {
      // Find matching vault document
      const matched = vaultDocuments.find((doc) => checkDocumentMatchesRequirement(req.title, req.category, doc));

      if (matched) {
        const isExpiring = matched.complianceState === 'Expiring < 6 Mos' || matched.complianceState === 'Expired';
        return {
          requirementId: req.id,
          requirementTitle: req.title,
          category: req.category || 'Statutory Certificate',
          isMandatory: req.isMandatory !== false,
          matchedDoc: matched,
          matchStatus: isExpiring ? 'matched_expiring' : 'matched_valid',
          matchScore: matched.ocrConfidence || 98,
        };
      }

      return {
        requirementId: req.id,
        requirementTitle: req.title,
        category: req.category || 'Statutory Certificate',
        isMandatory: req.isMandatory !== false,
        matchStatus: 'gap_missing',
        matchScore: 0,
      };
    });
  }, [activeAssuranceSet, selectedProject, projectAssuranceSets, assuranceSets, vaultDocuments, assetType]);

  // Match Summary Metrics
  const matchSummary = useMemo(() => {
    const total = comparisonResults.length;
    const matchedCount = comparisonResults.filter(
      (c) => c.matchStatus === 'matched_valid' || c.matchStatus === 'matched_expiring',
    ).length;
    const percentage = total > 0 ? Math.round((matchedCount / total) * 100) : 100;
    const gapsCount = total - matchedCount;

    return { total, matchedCount, percentage, gapsCount };
  }, [comparisonResults]);

  if (!isOpen) return null;

  const getCategoryIcon = () => {
    switch (assetType) {
      case 'Vessel':
        return <Ship size={18} className="text-primary" />;
      case 'Equipment':
        return <Wrench size={18} className="text-warning" />;
      case 'Crew':
        return <Users size={18} className="text-info" />;
      default:
        return <Briefcase size={18} className="text-success" />;
    }
  };

  const handleConfirmAddAsset = () => {
    if (!selectedProjectId) {
      setError('Please select a project to proceed.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Determine target assurance set ID
    let finalAssuranceSetId = selectedAssuranceSetId;

    if (finalAssuranceSetId === 'AUTO_GEN' || !finalAssuranceSetId) {
      const generatedSetId = `AS-PRJ-${Date.now().toString().slice(-4)}`;
      finalAssuranceSetId = generatedSetId;

      // Auto-create a linked assurance set in the store
      addAssuranceSet({
        id: generatedSetId,
        title: `${assetName} — Project Campaign Assurance`,
        stage: 'Approved',
        assuranceType:
          assetType === 'Crew' ? 'Crew' : assetType === 'Equipment' ? 'Equipment' : 'Vessel',
        initiatorOrg: selectedProject?.requestingOrganization || 'Chevron Australia',
        initiatorRole: 'Client Admin',
        serviceProviderOrg: effectiveProviderOrg,
        vesselId: assetType === 'Vessel' ? assetId : '',
        vesselName: assetType === 'Vessel' ? assetName : '',
        imoNumber: marketplaceItem?.detailedSpecs.find((s) => s.label === 'IMO Number')?.value || '9123456',
        crewId: assetType === 'Crew' ? assetId : undefined,
        crewName: assetType === 'Crew' ? assetName : undefined,
        equipmentId: assetType === 'Equipment' ? assetId : undefined,
        equipmentName: assetType === 'Equipment' ? assetName : undefined,
        charterWindowStart: new Date().toISOString().split('T')[0],
        charterWindowEnd: '2027-12-31',
        mandatoryInspectionRequired: false,
        inspectionCompleted: true,
        readinessScore: matchSummary.percentage,
        requirements: comparisonResults.map((c, i) => ({
          id: `REQ-${i + 1}`,
          category: c.category,
          title: c.requirementTitle,
          isMandatory: c.isMandatory,
          isFulfilled: c.matchStatus === 'matched_valid',
          verifierStatus: 'Verified',
          linkedDocumentId: c.matchedDoc?.id,
          ocrConfidence: c.matchedDoc?.ocrConfidence || 98,
        })),
        projectId: selectedProjectId,
      });
    }

    const result = addAssetToProject(selectedProjectId, {
      assetType,
      assetId,
      assetName,
      providerOrganization: effectiveProviderOrg,
      assuranceSetId: finalAssuranceSetId,
      roleInProject: roleInProject.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setError(result.message || 'Could not add asset to project.');
      setIsSubmitting(false);
      return;
    }

    setSuccessToast(true);
    setTimeout(() => {
      onClose();
      setCurrentHashView('project', selectedProjectId);
    }, 1200);
  };

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      style={{
        zIndex: 1060,
        overflowY: 'auto',
      }}
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
          style={{
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
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
                {getCategoryIcon()}
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

          {/* Modal Body */}
          <div className="modal-body p-4" style={{ backgroundColor: '#F8FAFC' }}>
            {/* 1. Asset Overview Banner */}
            <div
              className="bg-white border rounded-2 shadow-2xs mb-4"
              style={{ borderColor: '#E2E8F0', padding: '16px 20px' }}
            >
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3.5 min-w-0">
                  <div className="d-flex flex-column min-w-0">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="fw-bold text-dark mb-0 text-truncate" style={{ fontSize: '1.02rem', color: '#0B1B2B' }}>
                        {assetName}
                      </h6>
                    </div>
                    <span className="text-secondary small mt-1 text-truncate" style={{ fontSize: '0.82rem', color: '#64748B' }}>
                      Provided by <strong className="text-dark fw-semibold">{effectiveProviderOrg}</strong>
                      {marketplaceItem?.location && ` · Base: ${marketplaceItem.location}`}
                    </span>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-3 pe-1">
                  <div className="text-end">
                    <div className="text-secondary text-uppercase fw-semibold" style={{ fontSize: '0.68rem', color: '#64748B', letterSpacing: '0.04em' }}>
                      Pre-Assurance Score
                    </div>
                    <div className="fw-bold font-mono-code text-primary" style={{ fontSize: '1rem' }}>
                      {marketplaceItem?.complianceReadinessScore || 95}% Verified
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Select Target Project */}
            <div
              className="card border bg-white rounded-2 shadow-2xs mb-4"
              style={{ borderColor: '#E2E8F0', padding: '20px' }}
            >
              <div className="d-flex align-items-center justify-content-between mb-3">
                <label className="form-label fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem', color: '#0B1B2B' }}>
                  Select Target Project <span className="text-danger">*</span>
                </label>
                <span className="text-secondary small" style={{ fontSize: '0.8rem' }}>
                  {visibleProjects.length} Available Projects
                </span>
              </div>

              {visibleProjects.length === 0 ? (
                <div className="alert alert-warning small mb-0 py-2.5">
                  No active projects found for your organization. Please create a project first before nominating assets.
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="position-relative">
                      <select
                        className="form-select"
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
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
                        {visibleProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.id} — {p.name}
                          </option>
                        ))}
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

                  <div className="col-12 col-lg-6">
                    <div className="position-relative">
                      <select
                        className="form-select"
                        value={selectedAssuranceSetId}
                        onChange={(e) => setSelectedAssuranceSetId(e.target.value)}
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
                        <option value="AUTO_GEN">
                          Auto-Attach Campaign Set (Recommended)
                        </option>
                        {projectAssuranceSets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id} — {s.title}
                          </option>
                        ))}
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
              )}

              {/* Selected Project Summary Pill Strip */}
              {selectedProject && (
                <div
                  className="mt-3 rounded-2 border d-flex flex-wrap align-items-center justify-content-between gap-3"
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderColor: '#E2E8F0',
                    padding: '12px 18px',
                    fontSize: '0.82rem',
                  }}
                >
                  <div className="d-flex align-items-center gap-3.5">
                    <span className="d-flex align-items-center gap-1.5 text-secondary">
                      <Building2 size={15} className="text-primary flex-shrink-0" />
                      <span>Requester: <strong className="text-dark">{selectedProject.requestingOrganization}</strong></span>
                    </span>
                    <span className="d-flex align-items-center gap-1.5 text-secondary">
                      <MapPin size={15} className="text-warning flex-shrink-0" />
                      <span>{selectedProject.location || 'Western Australia'}</span>
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-2.5">
                    <span
                      className="badge px-3 py-1.5 rounded-pill"
                      style={{
                        backgroundColor: '#EFF6FF',
                        color: '#1E40AF',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                      }}
                    >
                      {selectedProject.status}
                    </span>
                    <span className="text-secondary small">
                      {selectedProject.assetLinks.length} Assets Linked
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Pre-Assurance Vault & Comparison Tabs */}
            <div className="card border bg-white rounded-2 shadow-2xs overflow-hidden mb-4" style={{ borderColor: '#E2E8F0' }}>
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
                          className="badge rounded-pill ms-1"
                          style={{
                            backgroundColor: matchSummary.percentage >= 80 ? '#DCFCE7' : '#FEF3C7',
                            color: matchSummary.percentage >= 80 ? '#15803D' : '#D97706',
                            fontSize: '0.7rem',
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
                        <span className="badge bg-secondary text-white rounded-pill ms-1" style={{ fontSize: '0.7rem' }}>
                          {vaultDocuments.length}
                        </span>
                      </span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* Tab 1: Comparison Matrix */}
              {activeTab === 'comparison' && (
                <div className="p-3.5">
                  <div
                    className="p-3 mb-3 rounded-2 border d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: matchSummary.gapsCount === 0 ? '#F0FDF4' : '#FFFBEB',
                      borderColor: matchSummary.gapsCount === 0 ? '#BBF7D0' : '#FDE68A',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2.5">
                      {matchSummary.gapsCount === 0 ? (
                        <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                      ) : (
                        <AlertCircle size={18} className="text-warning flex-shrink-0" />
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
                      <span className="fw-bold font-mono-code" style={{ fontSize: '1.1rem', color: '#0B1B2B' }}>
                        {matchSummary.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Comparison Table */}
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
                          <th className="px-3 py-2.5 text-uppercase fw-semibold text-center" style={{ fontSize: '0.7rem', width: '130px' }}>
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
                                  className="badge rounded-pill px-2.5 py-1"
                                  style={{
                                    backgroundColor: '#DCFCE7',
                                    color: '#15803D',
                                    border: '1px solid #BBF7D0',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  Auto-Attached
                                </span>
                              )}
                              {comp.matchStatus === 'matched_expiring' && (
                                <span
                                  className="badge rounded-pill px-2.5 py-1"
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
                                  className="badge rounded-pill px-2.5 py-1"
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

              {/* Tab 2: Full Vault Records (List View) */}
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

            {/* 4. Operational Role & Notes */}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold text-dark mb-1.5" style={{ fontSize: '0.82rem' }}>
                  Nominated Role in Project (Optional)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Primary Support Vessel / Subsea Heavy Lift"
                  value={roleInProject}
                  onChange={(e) => setRoleInProject(e.target.value)}
                  style={{
                    fontSize: '0.85rem',
                    minHeight: '40px',
                    borderColor: '#CBD5E1',
                    padding: '8px 14px',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold text-dark mb-1.5" style={{ fontSize: '0.82rem' }}>
                  Charter Notes (Optional)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Mobilization approved from shorebase"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    fontSize: '0.85rem',
                    minHeight: '40px',
                    borderColor: '#CBD5E1',
                    padding: '8px 14px',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>

            {error && (
              <div className="alert alert-danger py-2 small mb-0 mt-3 d-flex align-items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successToast && (
              <div
                className="alert alert-success py-2.5 small mb-0 mt-3 d-flex align-items-center gap-2"
                style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', color: '#15803D' }}
              >
                <CheckCircle2 size={18} className="flex-shrink-0" />
                <span>
                  Asset successfully linked to <strong>{selectedProject?.name}</strong> with {matchSummary.matchedCount} vault documents verified. Redirecting...
                </span>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            className="modal-footer d-flex align-items-center justify-content-between px-4 py-3 border-top flex-shrink-0"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E2E8F0',
            }}
          >
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary px-3.5 py-1.5 fw-medium"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ fontSize: '0.84rem', height: '38px', borderRadius: '6px' }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn-sm btn-primary px-4 py-1.5 fw-medium d-flex align-items-center gap-1.5 text-white"
              onClick={handleConfirmAddAsset}
              disabled={visibleProjects.length === 0 || isSubmitting}
              style={{
                backgroundColor: '#0B1B2B',
                borderColor: '#0B1B2B',
                fontSize: '0.84rem',
                height: '38px',
                borderRadius: '6px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1E3A5F';
                e.currentTarget.style.borderColor = '#1E3A5F';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0B1B2B';
                e.currentTarget.style.borderColor = '#0B1B2B';
              }}
            >
              <FolderPlus size={15} />
              <span>{isSubmitting ? 'Linking Asset...' : 'Add Asset to Project'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
