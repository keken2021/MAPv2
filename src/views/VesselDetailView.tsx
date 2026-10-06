/* 
  file summary: vessel detail deep-dive view presenting 11 Information categories in light accordions, pre-assurance vault, assurance sets, and audit logs.
  responsibilities: displays complete vessel Information, statutory cert expiries (<90 days amber warning), and category details in light theme.
  role in system: deep-dive view rendered when a vessel row is selected from Fleet Master.
*/

import React, { useState, useEffect, useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
  VesselInformation,
  VesselClientHistoryRecord,
  ClassificationSociety,
  VesselRegistrationStatus,
  VesselStatusDimension,
  VESSEL_STATUS_DIMENSION_LABELS,
} from '../types/vessel';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { formatMaritimeDate, getDaysUntilExpiry, getVesselStatusBadgeClass } from '../utils/formatters';
import { filterAuditTrailForPersona, filterVesselsForPersona, getBackButtonInfo, isVesselOwnedByAdmin, isVesselOwnedByClientOrg } from '../utils/rbacHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { calculateAssuranceSetReadiness, calculateVesselReadiness, isVesselAssuranceApproved, isVesselStatusPermitted } from '../utils/readinessHelpers';
import { CapaReinspectionDrawer } from '../components/drawers/CapaReinspectionDrawer';
import { InspectionDrawer } from '../components/drawers/InspectionDrawer';
import { AddCrewModal } from '../components/drawers/AddCrewModal';
import { CapaItem } from '../types/capa';
import { getVesselStockPhoto, getVesselCharterBadge, CURATED_VESSEL_PHOTOS } from '../utils/vesselImageHelpers';
import { VesselImageCropModal } from '../components/drawers/VesselImageCropModal';
import { DocumentUploadModal } from '../components/drawers/DocumentUploadModal';
import { AssetStatusCard } from '../components/assets/AssetStatusCard';
import { getVesselAssetStatus } from '../types/asset';
import {
  dimensionLabel,
  formatStatusDuration,
  getCurrentStatusByDimension,
  statusHistoryBadgeClass,
} from '../utils/vesselStatusHistoryHelpers';
import { AddToProjectModal } from '../components/drawers/AddToProjectModal';
import { getFallbackPhysicalInspections } from '../store/inspectionMockData';
import {
  MapPin,
  Download,
  Edit2,
  X,
  Camera,
  Info,
  Navigation,
  Shield,
  History,
  Activity,
  Flag,
  FileText,
  Maximize2,
  Settings,
  Package,
  Building,
  Building2,
  Mail,
  Globe,
  Phone,
  Anchor,
  Plus,
  Image,
  Crop,
  Upload,
  Trash2,
  Save,
  ChevronDown,
  Check,
} from 'lucide-react';


interface VesselDetailViewProps {
  vesselId: string;
}

export const VesselDetailView: React.FC<VesselDetailViewProps> = ({ vesselId }) => {
  const {
    vessels,
    equipment,
    crew,
    assignCrewToVessel,
    capaItems,
    updateVessel,
    updateVesselAvailability,
    setCreateAssuranceForVesselId,
    setCurrentHashView,
    previousHashView,
    previousEntityId,
    activePersona,
    assuranceSets,
    documents,
    auditEvents,
    vesselStatusHistory,
  } = useMapStore();

  const isAccessible =
    activePersona === 'Administrator' ||
    filterVesselsForPersona(vessels, assuranceSets, activePersona).some((v) => v.id === vesselId);

  const vessel = isAccessible ? vessels.find((v) => v.id === vesselId) : undefined;

  const [activeTab, setActiveTab] = useState<
    'Information' | 'vault' | 'assurance' | 'clients' | 'crew' | 'audit' | 'inspections' | 'statusHistory'
  >('Information');

  const linkedCapas = vessel
    ? capaItems.filter((c) => c.vesselId === vessel.id || c.vesselName.toLowerCase() === vessel.name.toLowerCase())
    : [];

  const linkedEquipment = useMemo(
    () => (vessel ? equipment.filter((e) => e.parentVesselId === vessel.id) : []),
    [equipment, vessel],
  );
  const [activeAccordion, setActiveAccordion] = useState<number | null>(1);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VesselInformation | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAddToProjectModal, setShowAddToProjectModal] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedCapaForDrawer, setSelectedCapaForDrawer] = useState<CapaItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [showGeneralInfo, setShowGeneralInfo] = useState(true);
  const [showDimensionsInfo, setShowDimensionsInfo] = useState(true);
  const [showClassificationInfo, setShowClassificationInfo] = useState(false);
  const [showEngineRoomInfo, setShowEngineRoomInfo] = useState(false);
  const [showShipCapacityInfo, setShowShipCapacityInfo] = useState(false);
  const [showVoyageProgress, setShowVoyageProgress] = useState(false);
  const [showArrivalDetails, setShowArrivalDetails] = useState(false);
  const [showRegOwnerInfo, setShowRegOwnerInfo] = useState(false);
  const [showIsmManagerInfo, setShowIsmManagerInfo] = useState(false);
  const [showShipManagerInfo, setShowShipManagerInfo] = useState(true);

  /* interactive modals for quick actions, voyage history, company fleet, and certificate details */
  const [showVoyageHistoryModal, setShowVoyageHistoryModal] = useState(false);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [selectedCompanyForFleetModal, setSelectedCompanyForFleetModal] = useState<string | null>(null);
  const [selectedVaultCertForModal, setSelectedVaultCertForModal] = useState<any | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [photoModalUrl, setPhotoModalUrl] = useState('');
  const [modalPhotos, setModalPhotos] = useState<string[]>([]);
  const [selectedViewPhotoUrl, setSelectedViewPhotoUrl] = useState<string>('');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropModalImageSrc, setCropModalImageSrc] = useState('');
  const [cropTargetIdx, setCropTargetIdx] = useState<number | null>(null);
  const [draggedPhotoIdx, setDraggedPhotoIdx] = useState<number | null>(null);
  const [dragOverPhotoIdx, setDragOverPhotoIdx] = useState<number | null>(null);
  const photoFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (vessel) {
      const stockUrl = getVesselStockPhoto(vessel.id, vessel.name, vessel.vesselType, vessel.vesselSubtype);
      const coverUrl = vessel.imageUrl || (vessel.photos && vessel.photos.length > 0 ? vessel.photos[0] : stockUrl);
      setPhotoModalUrl(coverUrl);
      setSelectedViewPhotoUrl(coverUrl);
      let initialPhotos = vessel.photos && vessel.photos.length > 0 ? [...vessel.photos] : [coverUrl];
      if (coverUrl && !initialPhotos.includes(coverUrl)) {
        initialPhotos = [coverUrl, ...initialPhotos];
      }
      setModalPhotos(initialPhotos);
    }
  }, [vessel, showPhotoUploadModal]);

  /* triggers one-shot shimmer on all vessel attribute value cells on mount or vesselId change */
  const [isJustLoaded, setIsJustLoaded] = useState(true);
  useEffect(() => {
    setIsJustLoaded(true);
    const timer = setTimeout(() => setIsJustLoaded(false), 800);
    return () => clearTimeout(timer);
  }, [vesselId]);

  /* vessel crew management modal & assignment states */
  const [isAddCrewModalOpen, setIsAddCrewModalOpen] = useState(false);
  const [isAssignExistingOpen, setIsAssignExistingOpen] = useState(false);
  const [selectedCrewToAssign, setSelectedCrewToAssign] = useState<string>('');

  /* crew table search, filter, and sorting states */
  const [crewSearch, setCrewSearch] = useState('');
  const [crewRankFilter, setCrewRankFilter] = useState('All');
  const [crewComplianceFilter, setCrewComplianceFilter] = useState('All');
  const [crewSortField, setCrewSortField] = useState<'id' | 'fullName' | 'nationality' | 'assignmentStatus' | 'overallComplianceScore' | 'complianceStatus'>('fullName');
  const [crewSortDirection, setCrewSortDirection] = useState<'asc' | 'desc'>('asc');

  /* pre-assurance vault search, filter, and sorting states */
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultStatusFilter, setVaultStatusFilter] = useState('ALL');
  const [vaultSortField, setVaultSortField] = useState<'name' | 'number' | 'issuingBody' | 'expiryDate' | 'ocr' | 'status'>('name');
  const [vaultSortDirection, setVaultSortDirection] = useState<'asc' | 'desc'>('asc');

  /* assurance sets search, filter, and sorting states */
  const [assuranceSearch, setAssuranceSearch] = useState('');
  const [assuranceStageFilter, setAssuranceStageFilter] = useState('ALL');
  const [assuranceSortField, setAssuranceSortField] = useState<'id' | 'title' | 'initiatorOrg' | 'charterWindow' | 'stage' | 'readinessScore'>('id');
  const [assuranceSortDirection, setAssuranceSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedAssuranceSetId, setSelectedAssuranceSetId] = useState('');

  /* client history search, filter, and sorting states */
  const [clientSearch, setClientSearch] = useState('');
  const [clientOutcomeFilter, setClientOutcomeFilter] = useState('ALL');
  const [clientSortField, setClientSortField] = useState<'clientOrganization' | 'charterTitle' | 'charterStart' | 'assuranceSetId' | 'outcome' | 'notes'>('charterStart');
  const [clientSortDirection, setClientSortDirection] = useState<'asc' | 'desc'>('desc');

  /* status history search, filter, and sorting states */
  const [statusHistorySearch, setStatusHistorySearch] = useState('');
  const [statusHistoryDimensionFilter, setStatusHistoryDimensionFilter] = useState<'ALL' | VesselStatusDimension>('ALL');
  const [statusHistoryCurrentOnly, setStatusHistoryCurrentOnly] = useState(false);
  const [statusHistorySortField, setStatusHistorySortField] = useState<
    'effectiveFrom' | 'dimension' | 'previousValue' | 'newValue' | 'changedBy'
  >('effectiveFrom');
  const [statusHistorySortDirection, setStatusHistorySortDirection] = useState<'asc' | 'desc'>('desc');

  /* audit trail search, filter, and sorting states */
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditSortField, setAuditSortField] = useState<'timestampUtc' | 'action' | 'userId' | 'organization' | 'justificationNotes'>('timestampUtc');
  const [auditSortDirection, setAuditSortDirection] = useState<'asc' | 'desc'>('desc');

  /* CAPA search, filter, and sorting states */
  const [capaSearch, setCapaSearch] = useState('');
  const [capaStatusFilter, setCapaStatusFilter] = useState('ALL');
  const [capaSortField, setCapaSortField] = useState<'id' | 'title' | 'owner' | 'dueDate' | 'status'>('id');
  const [capaSortDirection, setCapaSortDirection] = useState<'asc' | 'desc'>('asc');

  /* Physical Inspections search, filter, sorting, and detail modal states */
  const [inspectionSearch, setInspectionSearch] = useState('');
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState('ALL');
  const [inspectionSortField, setInspectionSortField] = useState<'id' | 'title' | 'assuranceSetId' | 'inspector' | 'date' | 'status'>('id');
  const [inspectionSortDirection, setInspectionSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedInspectionForDetail, setSelectedInspectionForDetail] = useState<any | null>(null);
  const [showInspectionDrawer, setShowInspectionDrawer] = useState(false);
  const [modalChecklistSortField, setModalChecklistSortField] = useState<'id' | 'category' | 'status' | 'notes'>('id');
  const [modalChecklistSortDirection, setModalChecklistSortDirection] = useState<'asc' | 'desc'>('asc');
  const [modalCapaSortField, setModalCapaSortField] = useState<'id' | 'title' | 'owner' | 'dueDate' | 'status'>('id');
  const [modalCapaSortDirection, setModalCapaSortDirection] = useState<'asc' | 'desc'>('asc');

  /* Audit Log detail modal state */
  const [selectedAuditForDetail, setSelectedAuditForDetail] = useState<any | null>(null);

  const renderSortIndicator = (currentField: string, field: string, direction: 'asc' | 'desc') => {
    if (currentField !== field) return <span className="text-muted ms-1 small opacity-50">↕</span>;
    return <span className="text-primary ms-1 small fw-bold">{direction === 'asc' ? '▲' : '▼'}</span>;
  };

  useEffect(() => {
    const found = vessels.find((v) => v.id === vesselId);
    if (found) {
      setFormData(found);
      setIsEditing(false);
    }
  }, [vesselId, vessels]);

  /* rbac & ownership: owner or organization owning the vessel has full editing rights */
  const isAdmin = activePersona === 'Administrator';
  const isSubmitter = activePersona === 'Submitter';
  const isCAdmin = activePersona === 'C Admin';
  const isOwned =
    (isAdmin || isSubmitter)
      ? isVesselOwnedByAdmin(vessel)
      : isCAdmin
        ? isVesselOwnedByClientOrg(vessel, 'Southern Basin Energy')
        : false;
  const isReadOnly = (isCAdmin && !isOwned) || activePersona === 'Inspector' || activePersona === 'Verifier' || activePersona === 'Approver';
  const canEditFull = !isReadOnly && isOwned;
  const canEditStatus = canEditFull || (isSubmitter && isOwned);
  const canShowEditButton = canEditFull || canEditStatus;
  const canUploadDocs = isAdmin || isSubmitter || isOwned;
  const canExport = isAdmin || isCAdmin || isOwned;
  const canManagePhotos = canEditFull;
  const showManagementSection = isCAdmin;

  const canCreateAssurance = isAdmin || isCAdmin;

  /* fallback active tab to Information if current tab is restricted for non-owned vessels */
  useEffect(() => {
    if (!isOwned && (activeTab === 'clients' || activeTab === 'crew' || activeTab === 'audit')) {
      setActiveTab('Information');
    }
  }, [isOwned, activeTab]);

  /*
    what: exports vessel 11-category Information and statutory details to csv format.
    how: constructs key-value records for all technical Information and triggers browser csv file download.
    with what file: src/views/VesselDetailView.tsx using src/utils/exportHelpers.ts.
  */
  const handleExportCsv = () => {
    if (!vessel) return;
    const vesselDetails = [
      { Category: 'Vessel Identification', Field: 'Vessel Name', Value: vessel.name },
      { Category: 'Vessel Identification', Field: 'IMO Number', Value: vessel.imoNumber },
      { Category: 'Vessel Identification', Field: 'Official Reg Number', Value: vessel.officialRegNumber },
      { Category: 'Vessel Identification', Field: 'MMSI Number', Value: vessel.mmsiNumber },
      { Category: 'Vessel Identification', Field: 'Call Sign', Value: vessel.callSign },
      { Category: 'Vessel Identification', Field: 'Flag State', Value: vessel.flagState },
      { Category: 'Vessel Identification', Field: 'Port of Registry', Value: vessel.portOfRegistry },
      { Category: 'Classification', Field: 'Vessel Type', Value: vessel.vesselType },
      { Category: 'Classification', Field: 'Vessel', Value: vessel.vesselSubtype },
      { Category: 'Classification', Field: 'Class Society', Value: vessel.classificationSociety },
      { Category: 'Classification', Field: 'Class Notation', Value: vessel.classNotation },
      { Category: 'Classification', Field: 'Hull Type', Value: vessel.hullType },
      { Category: 'Construction & Dimensions', Field: 'Year Built', Value: vessel.yearBuilt },
      { Category: 'Construction & Dimensions', Field: 'Shipyard Builder', Value: vessel.shipyardBuilder },
      { Category: 'Construction & Dimensions', Field: 'LOA (m)', Value: vessel.lengthOverallMeters },
      { Category: 'Construction & Dimensions', Field: 'Beam (m)', Value: vessel.beamMeters },
      { Category: 'Construction & Dimensions', Field: 'Draft (m)', Value: vessel.draftMeters },
      { Category: 'Tonnage & Propulsion', Field: 'Gross Tonnage (GT)', Value: vessel.grossTonnageGT },
      { Category: 'Tonnage & Propulsion', Field: 'Deadweight (DWT)', Value: vessel.deadweightTonnageDWT },
      { Category: 'Tonnage & Propulsion', Field: 'DP Class', Value: vessel.dynamicPositioningClass },
      { Category: 'Ownership & Management', Field: 'Registered Owner', Value: vessel.registeredOwner },
      { Category: 'Ownership & Management', Field: 'Technical Manager', Value: vessel.technicalManager },
      { Category: 'Ownership & Management', Field: 'DOC Number', Value: vessel.docNumber },
      { Category: 'Ownership & Management', Field: '24/7 Ops Contact', Value: vessel.contact247 },
      { Category: 'Insurance & Crew', Field: 'P&I Club', Value: vessel.piClubName },
      { Category: 'Insurance & Crew', Field: 'Policy Number', Value: vessel.policyNumber },
      { Category: 'Insurance & Crew', Field: 'Master Name', Value: vessel.masterName },
      { Category: 'Insurance & Crew', Field: 'Safe Manning Complement', Value: vessel.safeManningComplement },
      { Category: 'Insurance & Crew', Field: 'Lifeboat Capacity', Value: vessel.lifeboatCapacity },
      { Category: 'Status', Field: 'Operating Status', Value: vessel.status },
      { Category: 'Compliance', Field: 'Readiness Score', Value: `${vessel.complianceReadinessScore}%` },
    ];

    exportToCsv(`${vessel.name.replace(/\s+/g, '_')}_Information`, vesselDetails);
  };

  /*
    what: exports vessel 11-category Information and statutory details to pdf printable report.
    how: constructs table headers and rows for vessel technical specs and invokes window print pdf generator.
    with what file: src/views/VesselDetailView.tsx using src/utils/exportHelpers.ts.
  */
  const handleExportPdf = () => {
    if (!vessel) return;
    const headers = ['Category', 'Specification Field', 'Value'];
    const rows = [
      ['Vessel Identification', 'Vessel Name', vessel.name],
      ['Vessel Identification', 'IMO Number', vessel.imoNumber],
      ['Vessel Identification', 'Official Reg Number', vessel.officialRegNumber],
      ['Vessel Identification', 'MMSI Number', vessel.mmsiNumber],
      ['Vessel Identification', 'Call Sign', vessel.callSign],
      ['Vessel Identification', 'Flag State / Port', `${vessel.flagState} (${vessel.portOfRegistry})`],
      ['Classification', 'Vessel Type / Subtype', `${vessel.vesselType} - ${vessel.vesselSubtype}`],
      ['Classification', 'Class Society & Notation', `${vessel.classificationSociety} - ${vessel.classNotation}`],
      ['Classification', 'Hull Type', vessel.hullType],
      ['Construction & Dimensions', 'Year Built & Builder', `${vessel.yearBuilt} by ${vessel.shipyardBuilder}`],
      ['Construction & Dimensions', 'LOA x Beam x Draft', `${vessel.lengthOverallMeters}m x ${vessel.beamMeters}m x ${vessel.draftMeters}m`],
      ['Tonnage & Propulsion', 'GT / DWT / DP Class', `${vessel.grossTonnageGT} GT / ${vessel.deadweightTonnageDWT} DWT / ${vessel.dynamicPositioningClass}`],
      ['Ownership & Management', 'Registered Owner', vessel.registeredOwner],
      ['Ownership & Management', 'Technical Manager', vessel.technicalManager],
      ['Ownership & Management', 'DOC Number', vessel.docNumber],
      ['Ownership & Management', '24/7 Ops Contact', vessel.contact247],
      ['Insurance & Crew', 'P&I Club & Policy #', `${vessel.piClubName} (#${vessel.policyNumber})`],
      ['Insurance & Crew', 'Master & Manning', `${vessel.masterName} (${vessel.safeManningComplement} Crew / Cap: ${vessel.lifeboatCapacity})`],
      ['Operating Status', 'Current Status', vessel.status],
      ['Compliance', 'Readiness Score', `${vessel.complianceReadinessScore}%`],
    ];

    exportToPdf(`${vessel.name} Technical Dossier`, headers, rows);
  };

  const visibleAuditEvents = filterAuditTrailForPersona(auditEvents, activePersona, assuranceSets, vessels);

  // Linked assurance sets, documents, crew, and audit items for this vessel
  const linkedSets = vessel ? assuranceSets.filter((s) => s.vesselId === vessel.id) : [];
  const linkedDocs = vessel ? documents.filter((d) => d.vesselId === vessel.id) : [];

  useEffect(() => {
    if (linkedSets.length > 0 && !selectedAssuranceSetId) {
      setSelectedAssuranceSetId(linkedSets[0].id);
    }
    if (linkedSets.length === 0) {
      setSelectedAssuranceSetId('');
    }
  }, [linkedSets, selectedAssuranceSetId]);

  const handleCreateAssuranceForVessel = (templateSetId?: string) => {
    if (!vessel) return;
    setCreateAssuranceForVesselId(vessel.id);
    setCurrentHashView('create-assurance-set', templateSetId);
  };
  const linkedCrew = useMemo(() => {
    if (!vessel) return [];
    return crew.filter((c) => c.currentVesselId === vessel.id || c.assignments.some((a) => a.vesselId === vessel.id));
  }, [crew, vessel]);

  const crewRanks = useMemo(() => {
    return Array.from(new Set(linkedCrew.map((c) => c.rank))).sort();
  }, [linkedCrew]);

  const filteredCrew = useMemo(() => {
    return linkedCrew
      .filter((c) => {
        const matchesSearch =
          !crewSearch ||
          c.fullName.toLowerCase().includes(crewSearch.toLowerCase()) ||
          c.rank.toLowerCase().includes(crewSearch.toLowerCase()) ||
          c.nationality.toLowerCase().includes(crewSearch.toLowerCase()) ||
          c.id.toLowerCase().includes(crewSearch.toLowerCase()) ||
          (c.seamansBookNo && c.seamansBookNo.toLowerCase().includes(crewSearch.toLowerCase()));

        const matchesRank = crewRankFilter === 'All' || c.rank === crewRankFilter;
        const matchesCompliance = crewComplianceFilter === 'All' || c.complianceStatus === crewComplianceFilter;

        return matchesSearch && matchesRank && matchesCompliance;
      })
      .sort((a, b) => {
        let comp = 0;
        if (crewSortField === 'id') {
          comp = a.id.localeCompare(b.id);
        } else if (crewSortField === 'fullName') {
          comp = a.fullName.localeCompare(b.fullName);
        } else if (crewSortField === 'nationality') {
          comp = (a.nationality || '').localeCompare(b.nationality || '');
        } else if (crewSortField === 'assignmentStatus') {
          const statusA = a.currentVesselId === vessel?.id ? 'Current' : 'Historical';
          const statusB = b.currentVesselId === vessel?.id ? 'Current' : 'Historical';
          comp = statusA.localeCompare(statusB);
        } else if (crewSortField === 'overallComplianceScore') {
          comp = a.overallComplianceScore - b.overallComplianceScore;
        } else if (crewSortField === 'complianceStatus') {
          comp = a.complianceStatus.localeCompare(b.complianceStatus);
        }
        return crewSortDirection === 'asc' ? comp : -comp;
      });
  }, [linkedCrew, crewSearch, crewRankFilter, crewComplianceFilter, crewSortField, crewSortDirection]);

  const linkedAudits = vessel
    ? visibleAuditEvents.filter(
      (a) => a.targetAsset.includes(vessel.imoNumber) || a.targetAsset.includes(vessel.name)
    )
    : [];

  const linkedStatusHistory = useMemo(
    () => (vessel ? vesselStatusHistory.filter((entry) => entry.vesselId === vessel.id) : []),
    [vessel, vesselStatusHistory],
  );

  const currentStatusByDimension = useMemo(
    () => (vessel ? getCurrentStatusByDimension(vesselStatusHistory, vessel.id) : {}),
    [vessel, vesselStatusHistory],
  );

  const vesselAssetStatus = vessel ? getVesselAssetStatus(vessel) : null;

  const filteredStatusHistory = useMemo(() => {
    return linkedStatusHistory
      .filter((entry) => {
        const matchesDimension =
          statusHistoryDimensionFilter === 'ALL' || entry.dimension === statusHistoryDimensionFilter;
        const matchesCurrent = !statusHistoryCurrentOnly || !entry.effectiveTo;
        const search = statusHistorySearch.toLowerCase();
        const matchesSearch =
          !search ||
          entry.newValue.toLowerCase().includes(search) ||
          (entry.previousValue && entry.previousValue.toLowerCase().includes(search)) ||
          (entry.notes && entry.notes.toLowerCase().includes(search)) ||
          entry.changedBy.toLowerCase().includes(search) ||
          dimensionLabel(entry.dimension).toLowerCase().includes(search);
        return matchesDimension && matchesCurrent && matchesSearch;
      })
      .sort((a, b) => {
        let comp = 0;
        if (statusHistorySortField === 'effectiveFrom') {
          comp = new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime();
        } else if (statusHistorySortField === 'dimension') {
          comp = dimensionLabel(a.dimension).localeCompare(dimensionLabel(b.dimension));
        } else if (statusHistorySortField === 'previousValue') {
          comp = (a.previousValue || '').localeCompare(b.previousValue || '');
        } else if (statusHistorySortField === 'newValue') {
          comp = a.newValue.localeCompare(b.newValue);
        } else if (statusHistorySortField === 'changedBy') {
          comp = a.changedBy.localeCompare(b.changedBy);
        }
        return statusHistorySortDirection === 'asc' ? comp : -comp;
      });
  }, [
    linkedStatusHistory,
    statusHistoryDimensionFilter,
    statusHistoryCurrentOnly,
    statusHistorySearch,
    statusHistorySortField,
    statusHistorySortDirection,
  ]);

  const allVaultCerts = useMemo(() => {
    if (!vessel) return [];

    // Track unique keys (by certificate number, or lowercase name) to prevent duplicate entries
    const seen = new Set<string>();
    const certs: Array<any> = [];

    // Prioritize linked master documents
    linkedDocs.forEach((doc, idx) => {
      const key = (doc.certificateNo ? doc.certificateNo.trim().toLowerCase() : '') || doc.title.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const daysLeft = getDaysUntilExpiry(doc.expiryDate);
        let statusLabel: string = doc.verificationStatus || 'Valid';
        if (daysLeft < 0) statusLabel = 'EXPIRED';
        else if (daysLeft < 90) statusLabel = `Expiring in ${daysLeft} days`;

        const score = doc.ocrConfidence || (98.0 + (idx * 0.3) % 1.9);
        const formattedOcr = score % 1 === 0 ? `OCR: ${score}%` : `OCR: ${score.toFixed(1)}%`;

        certs.push({
          id: doc.id,
          docId: doc.id,
          name: doc.title,
          number: doc.certificateNo || doc.id,
          issuingBody: doc.issuingAuthority || 'AMSA',
          issueDate: (doc as any).issueDate || (doc.vesselAttributes as any)?.issueDate || '2024-01-15',
          expiryDate: doc.expiryDate,
          ocr: formattedOcr,
          ocrScore: score,
          status: statusLabel,
          rawStatus: doc.verificationStatus || (daysLeft < 0 ? 'EXPIRED' : daysLeft < 90 ? 'Expiring' : 'Valid'),
          entityType: doc.entityType || 'Statutory Vessel Certificate',
          version: doc.currentVersion || 'v1.0',
          fileName: doc.versions?.[0]?.fileName || `${doc.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          fileSize: doc.versions?.[0]?.fileSizeBytes ? `${(doc.versions[0].fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : '2.15 MB',
          uploadedBy: doc.versions?.[0]?.uploadedBy || 'Document Vault Submitter',
          uploadedAt: doc.versions?.[0]?.uploadedAt || '2026-09-18T10:15:00Z',
          extractedAttributes: {
            vesselName: (doc.vesselAttributes as any)?.vesselName || vessel.name,
            imoNumber: (doc.vesselAttributes as any)?.imoNumber || vessel.imoNumber,
            officialRegNumber: (doc.vesselAttributes as any)?.officialRegNumber || vessel.officialRegNumber,
            mmsiNumber: (doc.vesselAttributes as any)?.mmsiNumber || vessel.mmsiNumber || '503728940',
            callSign: (doc.vesselAttributes as any)?.callSign || vessel.callSign || 'VJQ4821',
            flagState: (doc.vesselAttributes as any)?.flagState || vessel.flagState,
            portOfRegistry: (doc.vesselAttributes as any)?.portOfRegistry || vessel.portOfRegistry,
            vesselType: vessel.vesselType,
            vesselSubtype: vessel.vesselSubtype,
            classificationSociety: doc.issuingAuthority || vessel.classificationSociety,
            classNotation: vessel.classNotation,
            hullType: vessel.hullType,
            grossTonnageGT: vessel.grossTonnageGT,
            deadweightTonnageDWT: vessel.deadweightTonnageDWT,
            yearBuilt: vessel.yearBuilt,
            shipyardBuilder: vessel.shipyardBuilder,
            lengthOverallMeters: vessel.lengthOverallMeters,
            beamMeters: vessel.beamMeters,
            draftMeters: vessel.draftMeters,
            dynamicPositioningClass: vessel.dynamicPositioningClass,
            mainEnginePowerKW: vessel.mainEnginePowerKW,
            piClubName: vessel.piClubName,
            policyNumber: vessel.policyNumber,
            masterName: vessel.masterName,
            safeManningComplement: vessel.safeManningComplement,
          },
          validationRules: doc.validationRules || {
            charterBufferPassed: daysLeft > 30,
            assetMatch100Percent: true,
            iacsAuthorityValid: true,
            overallValid: daysLeft > 0,
          },
          rawOcrText: `STATUTORY CERTIFICATE DOCUMENT PAYLOAD\n======================================\nCERTIFICATE TYPE: ${doc.title}\nISSUING BODY: ${doc.issuingAuthority}\nCERTIFICATE NUMBER: ${doc.certificateNo || doc.id}\nVESSEL NAME: ${vessel.name.toUpperCase()}\nIMO NUMBER: ${vessel.imoNumber}\nFLAG STATE: ${vessel.flagState.toUpperCase()}\nVALIDITY: ${(doc as any).issueDate || '2024-01-15'} UNTIL ${doc.expiryDate}\nOCR ENGINE: Tesseract v5.3-Maritime / Confidence: ${score.toFixed(1)}%\nDIGITAL WATERMARK: VALID SHA-256 HASH MATCH`,
        });
      }
    });

    // Deterministic OCR score pool matching exact screenshot values
    const ocrPool = [99.1, 98.1, 98.9, 98.3, 98.6, 98.4, 99.5, 96.0];

    // Add statutory certificates if not already present
    vessel.statutoryCertificates.forEach((cert: { certificateNumber: string; name: string; expiryDate: string; id: any; issuingBody: any; issueDate: any; }, idx: number) => {
      const key = (cert.certificateNumber ? cert.certificateNumber.trim().toLowerCase() : '') || cert.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const daysLeft = getDaysUntilExpiry(cert.expiryDate);
        let statusLabel = 'Valid';
        if (daysLeft < 0) statusLabel = 'EXPIRED';
        else if (daysLeft < 90) statusLabel = `Expiring in ${daysLeft} days`;

        const score = ocrPool[idx % ocrPool.length];
        const formattedOcr = score % 1 === 0 ? `OCR: ${score}%` : `OCR: ${score.toFixed(1)}%`;
        const matchedDoc = documents.find((d) => d.certificateNo === cert.certificateNumber || d.title.toLowerCase() === cert.name.toLowerCase());

        certs.push({
          id: matchedDoc ? matchedDoc.id : cert.id,
          docId: matchedDoc ? matchedDoc.id : cert.id,
          name: cert.name,
          number: cert.certificateNumber,
          issuingBody: cert.issuingBody,
          issueDate: cert.issueDate,
          expiryDate: cert.expiryDate,
          ocr: formattedOcr,
          ocrScore: score,
          status: statusLabel,
          rawStatus: daysLeft < 0 ? 'EXPIRED' : daysLeft < 90 ? 'Expiring' : 'Valid',
          entityType: 'Statutory Vessel Certificate',
          version: 'v1.0',
          fileName: `${cert.name.replace(/[^a-zA-Z0-9]/g, '_')}_${vessel.imoNumber}.pdf`,
          fileSize: '2.40 MB',
          uploadedBy: 'Statutory Authority Upload Integration',
          uploadedAt: cert.issueDate ? `${cert.issueDate}T08:00:00Z` : '2024-01-15T08:00:00Z',
          extractedAttributes: {
            vesselName: vessel.name,
            imoNumber: vessel.imoNumber,
            officialRegNumber: vessel.officialRegNumber,
            mmsiNumber: vessel.mmsiNumber || '503728940',
            callSign: vessel.callSign || 'VJQ4821',
            flagState: vessel.flagState,
            portOfRegistry: vessel.portOfRegistry,
            vesselType: vessel.vesselType,
            vesselSubtype: vessel.vesselSubtype,
            classificationSociety: cert.issuingBody || vessel.classificationSociety,
            classNotation: vessel.classNotation,
            hullType: vessel.hullType,
            grossTonnageGT: vessel.grossTonnageGT,
            deadweightTonnageDWT: vessel.deadweightTonnageDWT,
            yearBuilt: vessel.yearBuilt,
            shipyardBuilder: vessel.shipyardBuilder,
            lengthOverallMeters: vessel.lengthOverallMeters,
            beamMeters: vessel.beamMeters,
            draftMeters: vessel.draftMeters,
            dynamicPositioningClass: vessel.dynamicPositioningClass,
            mainEnginePowerKW: vessel.mainEnginePowerKW,
            piClubName: vessel.piClubName,
            policyNumber: vessel.policyNumber,
            masterName: vessel.masterName,
            safeManningComplement: vessel.safeManningComplement,
          },
          validationRules: {
            charterBufferPassed: daysLeft > 30,
            assetMatch100Percent: true,
            iacsAuthorityValid: true,
            overallValid: daysLeft > 0,
          },
          rawOcrText: `STATUTORY CERTIFICATE DOCUMENT PAYLOAD\n======================================\nCERTIFICATE TYPE: ${cert.name}\nISSUING BODY: ${cert.issuingBody}\nCERTIFICATE NUMBER: ${cert.certificateNumber}\nVESSEL NAME: ${vessel.name.toUpperCase()}\nIMO NUMBER: ${vessel.imoNumber}\nFLAG STATE: ${vessel.flagState.toUpperCase()}\nVALIDITY: ${cert.issueDate} UNTIL ${cert.expiryDate}\nOCR ENGINE: Tesseract v5.3-Maritime / Confidence: ${score.toFixed(1)}%\nDIGITAL WATERMARK: VALID SHA-256 HASH MATCH`,
        });
      }
    });

    return certs;
  }, [vessel, linkedDocs, documents]);

  const filteredVaultCerts = useMemo(() => {
    return allVaultCerts
      .filter((c) => {
        const matchesSearch =
          !vaultSearch ||
          c.name.toLowerCase().includes(vaultSearch.toLowerCase()) ||
          c.number.toLowerCase().includes(vaultSearch.toLowerCase()) ||
          c.issuingBody.toLowerCase().includes(vaultSearch.toLowerCase());

        const matchesStatus =
          vaultStatusFilter === 'ALL' ||
          c.rawStatus.toLowerCase() === vaultStatusFilter.toLowerCase() ||
          c.status.toLowerCase().includes(vaultStatusFilter.toLowerCase());

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let comp = 0;
        if (vaultSortField === 'name') comp = a.name.localeCompare(b.name);
        else if (vaultSortField === 'number') comp = (a.number || '').localeCompare(b.number || '');
        else if (vaultSortField === 'issuingBody') comp = (a.issuingBody || '').localeCompare(b.issuingBody || '');
        else if (vaultSortField === 'expiryDate') comp = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        else if (vaultSortField === 'ocr') comp = (a.ocr || '').localeCompare(b.ocr || '');
        else if (vaultSortField === 'status') comp = a.status.localeCompare(b.status);
        return vaultSortDirection === 'asc' ? comp : -comp;
      });
  }, [allVaultCerts, vaultSearch, vaultStatusFilter, vaultSortField, vaultSortDirection]);

  const filteredAssuranceSets = useMemo(() => {
    return linkedSets
      .filter((s) => {
        const matchesSearch =
          !assuranceSearch ||
          s.id.toLowerCase().includes(assuranceSearch.toLowerCase()) ||
          s.title.toLowerCase().includes(assuranceSearch.toLowerCase()) ||
          s.initiatorOrg.toLowerCase().includes(assuranceSearch.toLowerCase());

        const matchesStage = assuranceStageFilter === 'ALL' || s.stage === assuranceStageFilter;

        return matchesSearch && matchesStage;
      })
      .sort((a, b) => {
        let comp = 0;
        if (assuranceSortField === 'id') comp = a.id.localeCompare(b.id);
        else if (assuranceSortField === 'title') comp = a.title.localeCompare(b.title);
        else if (assuranceSortField === 'initiatorOrg') comp = (a.initiatorOrg || '').localeCompare(b.initiatorOrg || '');
        else if (assuranceSortField === 'charterWindow') comp = (a.charterWindowStart || '').localeCompare(b.charterWindowStart || '');
        else if (assuranceSortField === 'stage') comp = a.stage.localeCompare(b.stage);
        else if (assuranceSortField === 'readinessScore') comp = calculateAssuranceSetReadiness(a) - calculateAssuranceSetReadiness(b);
        return assuranceSortDirection === 'asc' ? comp : -comp;
      });
  }, [linkedSets, assuranceSearch, assuranceStageFilter, assuranceSortField, assuranceSortDirection]);

  const filteredClientHistory = useMemo(() => {
    if (!vessel || !vessel.clientHistory) return [];
    return vessel.clientHistory
      .filter((r: VesselClientHistoryRecord) => {
        const matchesSearch =
          !clientSearch ||
          r.clientOrganization.toLowerCase().includes(clientSearch.toLowerCase()) ||
          r.charterTitle.toLowerCase().includes(clientSearch.toLowerCase()) ||
          (r.notes && r.notes.toLowerCase().includes(clientSearch.toLowerCase()));

        const matchesOutcome = clientOutcomeFilter === 'ALL' || r.outcome === clientOutcomeFilter;

        return matchesSearch && matchesOutcome;
      })
      .sort((a: VesselClientHistoryRecord, b: VesselClientHistoryRecord) => {
        let comp = 0;
        if (clientSortField === 'clientOrganization') comp = a.clientOrganization.localeCompare(b.clientOrganization);
        else if (clientSortField === 'charterTitle') comp = (a.charterTitle || '').localeCompare(b.charterTitle || '');
        else if (clientSortField === 'charterStart') comp = new Date(a.charterStart).getTime() - new Date(b.charterStart).getTime();
        else if (clientSortField === 'assuranceSetId') comp = (a.assuranceSetId || '').localeCompare(b.assuranceSetId || '');
        else if (clientSortField === 'outcome') comp = a.outcome.localeCompare(b.outcome);
        else if (clientSortField === 'notes') comp = (a.notes || '').localeCompare(b.notes || '');
        return clientSortDirection === 'asc' ? comp : -comp;
      });
  }, [vessel, clientSearch, clientOutcomeFilter, clientSortField, clientSortDirection]);

  const auditActions = useMemo(() => {
    return Array.from(new Set(linkedAudits.map((a) => a.action))).sort();
  }, [linkedAudits]);

  const filteredAudits = useMemo(() => {
    return linkedAudits
      .filter((a) => {
        const matchesSearch =
          !auditSearch ||
          a.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
          a.userId.toLowerCase().includes(auditSearch.toLowerCase()) ||
          a.organization.toLowerCase().includes(auditSearch.toLowerCase()) ||
          (a.justificationNotes && a.justificationNotes.toLowerCase().includes(auditSearch.toLowerCase()));

        const matchesAction = auditActionFilter === 'ALL' || a.action === auditActionFilter;

        return matchesSearch && matchesAction;
      })
      .sort((a, b) => {
        let comp = 0;
        if (auditSortField === 'timestampUtc') comp = new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime();
        else if (auditSortField === 'action') comp = a.action.localeCompare(b.action);
        else if (auditSortField === 'userId') comp = a.userId.localeCompare(b.userId);
        else if (auditSortField === 'organization') comp = (a.organization || '').localeCompare(b.organization || '');
        else if (auditSortField === 'justificationNotes') comp = (a.justificationNotes || '').localeCompare(b.justificationNotes || '');
        return auditSortDirection === 'asc' ? comp : -comp;
      });
  }, [linkedAudits, auditSearch, auditActionFilter, auditSortField, auditSortDirection]);

  const filteredCapas = useMemo(() => {
    return linkedCapas
      .filter((c) => {
        const matchesSearch =
          !capaSearch ||
          c.id.toLowerCase().includes(capaSearch.toLowerCase()) ||
          c.title.toLowerCase().includes(capaSearch.toLowerCase()) ||
          c.findingDescription.toLowerCase().includes(capaSearch.toLowerCase()) ||
          c.owner.toLowerCase().includes(capaSearch.toLowerCase());

        const matchesStatus = capaStatusFilter === 'ALL' || c.status === capaStatusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let comp = 0;
        if (capaSortField === 'id') comp = a.id.localeCompare(b.id);
        else if (capaSortField === 'title') comp = a.title.localeCompare(b.title);
        else if (capaSortField === 'owner') comp = (a.owner || '').localeCompare(b.owner || '');
        else if (capaSortField === 'dueDate') comp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        else if (capaSortField === 'status') comp = a.status.localeCompare(b.status);
        return capaSortDirection === 'asc' ? comp : -comp;
      });
  }, [linkedCapas, capaSearch, capaStatusFilter, capaSortField, capaSortDirection]);

  const physicalInspections = useMemo(() => {
    if (!vessel) return [];

    const derivedInspections = linkedSets.map((s, idx) => ({
      id: `INSP-2026-${101 + idx}`,
      assuranceSetId: s.id,
      title: `Visual Vessel Inspection & Safety Audit — ${s.title}`,
      inspector: s.assignedInspector || 'N. Technical (AMSA Marine Audit Division)',
      inspectorRole: 'Lead Marine Vetting Inspector',
      date: '14 Oct 2026',
      location: 'Dampier Port Facility, WA',
      client: s.initiatorOrg || 'Southern Basin Energy Pty Ltd',
      status: s.inspectionCompleted ? 'Completed' : 'Scheduled',
      findingsSummary: {
        satisfactory: 12,
        observations: 2,
        deficiencies: 1,
        capaCode: 'CAPA-118'
      },
      checklists: [
        {
          id: 'CHK-01',
          category: 'Life-Saving Appliances (LSA)',
          ref: 'SOLAS Reg III/20',
          status: 'Satisfactory',
          notes: 'All lifeboats, davits, and hydrostatic release units in good working condition.',
          evidence: ['lsa_locker_01.jpg', 'davits_test_cert.pdf']
        },
        {
          id: 'CHK-02',
          category: 'Fire-Fighting Equipment (FFE)',
          ref: 'SOLAS Reg II-2/10',
          status: 'Satisfactory',
          notes: 'Fixed CO2 system pressure gauges verified within operational green zone.',
          evidence: ['ffe_station3.jpg']
        },
        {
          id: 'CHK-03',
          category: 'Liferaft HRU Serviceability',
          ref: 'LSA Code IV/4.1',
          status: 'Observation',
          notes: 'Port-side liferaft HRU service date exceeded by 3 weeks. Replacement on order; CAPA-118 raised.',
          evidence: ['hru_tag_port.jpg', 'hru_cert_2026.pdf'],
          capaId: 'CAPA-118'
        },
        {
          id: 'CHK-04',
          category: 'Deck Cargo Securing Arrangement',
          ref: 'IMO Cargo Securing Manual',
          status: 'Satisfactory',
          notes: 'Turnbuckles and D-rings inspected with 0% heavy corrosion.',
          evidence: ['deck_securing_aft.jpg']
        },
        {
          id: 'CHK-05',
          category: 'Navigation & Bridge Equipment',
          ref: 'SOLAS Reg V/19',
          status: 'Satisfactory',
          notes: 'ECDIS dual redundancy verified with latest ENC chart vector packs.',
          evidence: ['ecdis_log_oct2026.pdf']
        }
      ],
      auditTrail: [
        { time: '2026-10-14 08:30 UTC', action: 'INSPECTION_INITIATED', user: s.assignedInspector || 'N. Technical', notes: 'Inspector boarded vessel at Dampier Berth 3.' },
        { time: '2026-10-14 11:45 UTC', action: 'FINDING_LOGGED', user: s.assignedInspector || 'N. Technical', notes: 'Observation logged for Port Liferaft HRU expiration date.' },
        { time: '2026-10-14 14:15 UTC', action: 'CAPA_RAISED', user: s.assignedInspector || 'N. Technical', notes: 'Corrective Action CAPA-118 automatically generated.' },
        { time: '2026-10-14 16:00 UTC', action: 'INSPECTION_COMPLETED', user: s.assignedInspector || 'N. Technical', notes: 'Visual inspection completed with score 94%. Report signed off.' }
      ]
    }));

    if (derivedInspections.length === 0) {
      return getFallbackPhysicalInspections(vessel.name);
    }

    return derivedInspections;
  }, [vessel, linkedSets]);

  const filteredInspections = useMemo(() => {
    return physicalInspections
      .filter((item) => {
        const matchesSearch =
          !inspectionSearch ||
          item.id.toLowerCase().includes(inspectionSearch.toLowerCase()) ||
          item.title.toLowerCase().includes(inspectionSearch.toLowerCase()) ||
          item.inspector.toLowerCase().includes(inspectionSearch.toLowerCase()) ||
          item.client.toLowerCase().includes(inspectionSearch.toLowerCase()) ||
          item.location.toLowerCase().includes(inspectionSearch.toLowerCase());

        const matchesStatus = inspectionStatusFilter === 'ALL' || item.status === inspectionStatusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let comp = 0;
        if (inspectionSortField === 'id') comp = a.id.localeCompare(b.id);
        else if (inspectionSortField === 'title') comp = a.title.localeCompare(b.title);
        else if (inspectionSortField === 'assuranceSetId') comp = (a.assuranceSetId || '').localeCompare(b.assuranceSetId || '');
        else if (inspectionSortField === 'inspector') comp = (a.inspector || '').localeCompare(b.inspector || '');
        else if (inspectionSortField === 'date') comp = new Date(a.date).getTime() - new Date(b.date).getTime();
        else if (inspectionSortField === 'status') comp = a.status.localeCompare(b.status);
        return inspectionSortDirection === 'asc' ? comp : -comp;
      });
  }, [physicalInspections, inspectionSearch, inspectionStatusFilter, inspectionSortField, inspectionSortDirection]);

  const sortedModalChecklists = useMemo(() => {
    if (!selectedInspectionForDetail?.checklists) return [];
    return [...selectedInspectionForDetail.checklists].sort((a: any, b: any) => {
      let comp = 0;
      if (modalChecklistSortField === 'id') comp = (a.id || '').localeCompare(b.id || '');
      else if (modalChecklistSortField === 'category') comp = (a.category || '').localeCompare(b.category || '');
      else if (modalChecklistSortField === 'status') comp = (a.status || '').localeCompare(b.status || '');
      else if (modalChecklistSortField === 'notes') comp = (a.notes || '').localeCompare(b.notes || '');
      return modalChecklistSortDirection === 'asc' ? comp : -comp;
    });
  }, [selectedInspectionForDetail, modalChecklistSortField, modalChecklistSortDirection]);

  const sortedModalCapas = useMemo(() => {
    return [...linkedCapas].sort((a, b) => {
      let comp = 0;
      if (modalCapaSortField === 'id') comp = a.id.localeCompare(b.id);
      else if (modalCapaSortField === 'title') comp = a.title.localeCompare(b.title);
      else if (modalCapaSortField === 'owner') comp = a.owner.localeCompare(b.owner);
      else if (modalCapaSortField === 'dueDate') comp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      else if (modalCapaSortField === 'status') comp = a.status.localeCompare(b.status);
      return modalCapaSortDirection === 'asc' ? comp : -comp;
    });
  }, [linkedCapas, modalCapaSortField, modalCapaSortDirection]);

  if (!vessel || !isAccessible) {
    return (
      <div className="container-fluid px-4 py-5 text-center">
        <div className="card map-card-custom p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <h4 className="fw-bold text-dark mb-2">Vessel Access Restricted</h4>
          <p className="text-secondary small mb-4">
            You do not have authorization to view this vessel. Vessel Admins can only view vessels owned or managed by their organization.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mx-auto"
            onClick={() => setCurrentHashView('vessels')}
          >
            Back to Fleet Registry
          </button>
        </div>
      </div>
    );
  }

  if (!formData) {
    return <div className="p-4 text-center">Loading vessel dossier...</div>;
  }

  const canEditField = (field: keyof VesselInformation): boolean => {
    if (isReadOnly) return false;
    if (canEditFull) return true;
    if (isSubmitter && field === 'status') return true;
    return false;
  };

  const fieldEditable = (field: keyof VesselInformation) => isEditing && canEditField(field);

  const toggleAccordion = (index: number) => {
    setActiveAccordion(activeAccordion === index ? null : index);
  };

  const handleInputChange = (field: keyof VesselInformation, val: VesselInformation[keyof VesselInformation]) => {
    setFormData((prev) => (prev ? { ...prev, [field]: val } : prev));
  };

  const isAssuranceApproved = vessel ? isVesselAssuranceApproved(vessel, assuranceSets, documents) : false;

  const handleSave = () => {
    const statusPermCheck = isVesselStatusPermitted(formData.status, vessel, assuranceSets, documents);
    if (!statusPermCheck.isPermitted) {
      setToastMessage(statusPermCheck.reason || 'Cannot set status: 100% approved assurance set required.');
      setTimeout(() => setToastMessage(null), 4500);
      return;
    }

    if (canEditFull) {
      updateVessel(formData);
      setToastMessage('Vessel specifications updated successfully & recorded in audit trail.');
    } else if (isSubmitter) {
      updateVessel({ ...vessel, status: formData.status });
      setToastMessage('Operating status updated successfully & recorded in audit trail.');
    }
    setIsEditing(false);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const renderClientOutcomeBadge = (outcome: VesselInformation['clientHistory'][0]['outcome']) => {
    switch (outcome) {
      case 'Approved':
      case 'Completed':
        return <span className="badge bg-success text-white">{outcome}</span>;
      case 'Rejected':
        return <span className="badge bg-danger text-white">{outcome}</span>;
      case 'Returned for Correction':
        return <span className="badge bg-warning text-dark">{outcome}</span>;
      case 'In Progress':
        return <span className="badge bg-primary text-white">{outcome}</span>;
      default:
        return <span className="badge bg-secondary">{outcome}</span>;
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="alert alert-success d-flex align-items-center justify-between shadow-sm p-2 mb-0">
          <span>{toastMessage}</span>
          <button type="button" className="btn-close" onClick={() => setToastMessage(null)} />
        </div>
      )}

      {/* Top Header Navigation & Action Bar matching mockup */}
      <div className="map-vessel-topbar d-flex flex-wrap align-items-center justify-content-between gap-3 shadow-sm mb-1">
        <div className="d-flex align-items-center gap-3 min-w-0">
          {/* Flag Status Badge */}
          <div
            className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0 text-white fw-bold shadow-sm"
            style={{
              width: '42px',
              height: '30px',
              background: 'linear-gradient(135deg, rgb(11, 27, 43), rgb(22, 45, 69))',
              fontSize: '0.72rem',
              letterSpacing: '0.05em',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
            title={vessel.flagState}
          >
            {vessel.flagState ? vessel.flagState.slice(0, 3).toUpperCase() : 'FLG'}
          </div>

          <div className="d-flex flex-column min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-bold text-dark mb-0 text-truncate" style={{ fontSize: '1.35rem', letterSpacing: '0.02em' }}>
                {vessel.name.toUpperCase()}
              </h3>
              {fieldEditable('status') ? (
                <div className="d-flex align-items-center gap-1">
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 'auto' }}
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value as VesselRegistrationStatus)}
                  >
                    <option value="Active">Active</option>
                    <option value="In Operations" disabled={!isAssuranceApproved}>
                      In Operations {!isAssuranceApproved ? '(Requires 100% Approved Assurance)' : ''}
                    </option>
                    <option value="In Transit" disabled={!isAssuranceApproved}>
                      In Transit {!isAssuranceApproved ? '(Requires 100% Approved Assurance)' : ''}
                    </option>
                    <option value="Port Stay">Port Stay</option>
                    <option value="Under Charter" disabled={!isAssuranceApproved}>
                      Under Charter {!isAssuranceApproved ? '(Requires 100% Approved Assurance)' : ''}
                    </option>
                    <option value="Standby">Standby</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Dry Docking">Dry Docking</option>
                    <option value="Lay-up">Lay-up</option>
                    <option value="Decommissioned">Decommissioned</option>
                  </select>
                </div>
              ) : (
                <span className={`badge ${getVesselStatusBadgeClass(vessel.status)} text-uppercase`} style={{ fontSize: '0.75rem' }}>
                  {vessel.status}
                </span>
              )}
            </div>
            <div className="d-flex align-items-center gap-2 text-secondary small mt-0.5 flex-wrap" style={{ fontSize: '0.84rem' }}>
              <span className="fw-semibold text-dark font-mono-code">{vessel.imoNumber}</span>
              <span className="d-inline-flex align-items-center text-danger">
                <MapPin className="w-2.5 h-2.5 fill-current" />
              </span>
              <span className="text-secondary">{vessel.vesselSubtype || vessel.vesselType || 'Commercial Maritime Vessel'}</span>
              <span className="text-muted">•</span>
              <span className="text-muted">{vessel.flagState} ({vessel.portOfRegistry})</span>
            </div>
          </div>
        </div>

        {/* Right Action Controls & Close Button */}
        <div className="d-flex align-items-center gap-2 ms-auto">
          {canExport && (
            <div className="position-relative">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5"
                onClick={() => setIsExportOpen(!isExportOpen)}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
              {isExportOpen && (
                <div className="dropdown-menu show position-absolute end-0 mt-1 shadow border p-1 z-3 bg-white" style={{ minWidth: '140px' }}>
                  <button
                    type="button"
                    className="dropdown-item small py-1 px-2 border-0 bg-transparent text-start w-100"
                    onClick={() => {
                      handleExportCsv();
                      setIsExportOpen(false);
                    }}
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    className="dropdown-item small py-1 px-2 border-0 bg-transparent text-start w-100"
                    onClick={() => {
                      handleExportPdf();
                      setIsExportOpen(false);
                    }}
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          )}

          {canShowEditButton && (
            <div>
              {isEditing ? (
                <div className="d-flex gap-1">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setFormData(vessel);
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-success" onClick={handleSave}>
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{canEditFull ? 'Edit Information' : 'Update Status'}</span>
                </button>
              )}
            </div>
          )}

          {/* Close / Return button */}
          <button
            type="button"
            className="btn btn-sm btn-light border d-flex align-items-center justify-content-center ms-1"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
            onClick={() => setCurrentHashView(previousHashView || 'vessels', previousEntityId)}
            title="Close and Return to Fleet Registry"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AssetStatusCard
        assetType="Vessel"
        status={getVesselAssetStatus(vessel)}
        canEditAvailability={canEditStatus}
        onAvailabilityChange={(value) => updateVesselAvailability(vessel.id, value)}
      />

      {linkedEquipment.length > 0 && (
        <div className="card map-card-custom">
          <div className="card-header fw-bold bg-white d-flex justify-between align-items-center">
            <span>Linked Equipment ({linkedEquipment.length})</span>
          </div>
          <div className="list-group list-group-flush">
            {linkedEquipment.map((item) => (
              <button
                key={item.id}
                type="button"
                className="list-group-item list-group-item-action d-flex justify-between align-items-center"
                onClick={() => setCurrentHashView('equipment', item.id)}
              >
                <div>
                  <div className="fw-semibold">{item.name}</div>
                  <div className="text-muted small">{item.category} · {item.equipmentIdentifier}</div>
                </div>
                <span className="badge bg-light text-dark border">{item.availabilityStatus}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tabs Navigation */}
      <ul className="nav nav-tabs border-bottom">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'Information' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('Information')}
          >
            Datasheet &amp; Information
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'vault' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('vault')}
          >
            Pre-Assurance Vault ({allVaultCerts.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'assurance' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('assurance')}
          >
            Assurance Sets ({linkedSets.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'inspections' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('inspections')}
          >
            Physical Inspections ({linkedSets.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'statusHistory' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('statusHistory')}
          >
            Status History ({linkedStatusHistory.length})
          </button>
        </li>
        {isAdmin && isOwned && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'clients' ? 'active fw-bold text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('clients')}
            >
              Client History ({vessel.clientHistory?.length ?? 0})
            </button>
          </li>
        )}
        {isAdmin && isOwned && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'crew' ? 'active fw-bold text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('crew')}
            >
              Assigned Crew ({linkedCrew.length})
            </button>
          </li>
        )}
        {isAdmin && isOwned && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'audit' ? 'active fw-bold text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('audit')}
            >
              Asset Trail ({linkedAudits.length})
            </button>
          </li>
        )}
      </ul>

      {/* Tab 1: 3-Column Technical Breakdown Layout matching Mockup */}
      {activeTab === 'Information' && (
        <div className="row g-3">
          {/* ========================================================= */}
          {/* Column 1: Vessel Photo, Quick Actions & Voyage Tracking */}
          {/* ========================================================= */}
          <div className={showManagementSection ? 'col-12 col-lg-4 col-xl-4' : 'col-12 col-lg-5 col-xl-5'}>
            {/* 1. Large Vessel Photo with Direct Edit / Manage Overlay (Only clickable for Vessel Owner / Admin) */}
            <div
              className={`position-relative overflow-hidden rounded-3 shadow-sm mb-1.5 ${canManagePhotos ? 'cursor-pointer group-photo-container' : ''}`}
              style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0b1b2b' }}
              onClick={() => {
                if (canManagePhotos) setShowPhotoUploadModal(true);
              }}
              title={canManagePhotos ? 'Click to add, update or delete vessel images' : vessel.name}
            >
              <img
                src={getVesselStockPhoto(vessel.id, vessel.name, vessel.vesselType, vessel.vesselSubtype, selectedViewPhotoUrl || vessel.imageUrl)}
                alt={vessel.name}
                className="w-100 h-100"
                style={{ objectFit: 'cover' }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://plus.unsplash.com/premium_photo-1661880889658-6c3ac991146f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
                }}
              />
              {/* Photo Status Floating Badges */}
              <div
                className="position-absolute top-0 end-0 m-2 d-flex align-items-center gap-1.5"
                style={{ zIndex: 3 }}
                onClick={(e) => e.stopPropagation()}
              >
                {vessel.photos && vessel.photos.length > 1 ? (
                  <span
                    className="badge bg-primary text-white shadow-2xs font-mono-code"
                    style={{ fontSize: '0.65rem' }}
                  >
                    {vessel.photos.length} Photos
                  </span>
                ) : vessel.imageUrl ? (
                  <span
                    className="badge bg-success text-white shadow-2xs font-mono-code"
                    style={{ fontSize: '0.65rem' }}
                  >
                    Custom Photo
                  </span>
                ) : null}
              </div>
            </div>



            {/* 2. Quick Action Buttons Row (with margin-top) */}
            <div className="d-flex align-items-center justify-content-between gap-1 mb-2 mt-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn"
                onClick={() => {
                  setShowGeneralInfo(true);
                  setShowDimensionsInfo(true);
                  setShowClassificationInfo(true);
                  setShowEngineRoomInfo(true);
                  setShowShipCapacityInfo(true);
                  setToastMessage('Expanded all technical datasheet specifications.');
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                title="Expand all technical specification accordions"
              >
                <Info className="w-3.5 h-3.5" />
                <span style={{ fontSize: '0.68rem' }}>Details</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn"
                onClick={() => {
                  setShowVoyageProgress(true);
                  setShowArrivalDetails(true);
                  setShowVoyageHistoryModal(true);
                }}
                title="View voyage tracking and historical transit logs"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span style={{ fontSize: '0.68rem' }}>Voyage</span>
              </button>
              {canManagePhotos && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn"
                  onClick={() => setShowPhotoUploadModal(true)}
                  title="Update vessel image or choose from fleet photos"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span style={{ fontSize: '0.68rem' }}>{vessel.photos && vessel.photos.length > 1 ? 'Photos' : 'Add Photo'}</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn"
                onClick={() => {
                  setToastMessage(`${vessel.name} is verified and active in the Master Fleet Registry.`);
                  setTimeout(() => setToastMessage(null), 3500);
                }}
                title="Verify vessel registration in master fleet"
              >
                <Shield className="w-3.5 h-3.5" />
                <span style={{ fontSize: '0.68rem' }}>Fleet Status</span>
              </button>
            </div>

            {/* 3. Draught & Speed Metrics Row (Status is in header next to name) */}
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="badge bg-light text-primary border border-primary-subtle py-1.5 px-3 rounded-pill fw-semibold flex-fill text-center" style={{ fontSize: '0.74rem' }}>
                {vessel.draftMeters ? `${vessel.draftMeters}m Draught` : '5.80m Draught'}
              </span>
              <span className="badge bg-light text-danger border border-danger-subtle py-1.5 px-3 rounded-pill fw-semibold flex-fill text-center" style={{ fontSize: '0.74rem' }}>
                {vessel.vesselType.toLowerCase().includes('tug') ? '12.0 knots' : '14.5 knots'}
              </span>
            </div>

            {/* 4. Departure & Arrival Tracking Card */}
            <div className="card shadow-sm border p-3 mb-3 bg-white rounded-3">
              <div className="d-flex justify-content-between align-items-start mb-1">
                <div>
                  <div className="text-secondary small" style={{ fontSize: '0.72rem' }}>Departure from {vessel.portOfRegistry || 'Fremantle, WA'}</div>
                  <div className="d-flex align-items-center gap-1.5 mt-0.5">
                    <span className="badge bg-dark text-white fw-bold px-1.5 py-0.5" style={{ fontSize: '0.7rem' }}>
                      {vessel.portOfRegistry ? vessel.portOfRegistry.replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() : 'AUFRE'}
                    </span>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-secondary small" style={{ fontSize: '0.72rem' }}>Arrival at {vessel.intendedUse || 'Offshore Platform'}</div>
                  <div className="d-flex align-items-center justify-content-end gap-1.5 mt-0.5">
                    <span className="badge bg-danger text-white fw-bold px-1.5 py-0.5" style={{ fontSize: '0.7rem' }}>
                      {vessel.tradingArea ? vessel.tradingArea.replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() : 'AUDMP'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Slider Track */}
              <div className="map-voyage-track">
                <div className="map-voyage-track-fill"></div>
                <div className="map-voyage-track-thumb"></div>
              </div>

              <div className="d-flex justify-content-between align-items-center text-muted small mt-1 font-mono-code" style={{ fontSize: '0.68rem' }}>
                <div>
                  <div>Actual Time of Departure</div>
                  <strong className="text-dark">2026-09-28T09:29:56Z</strong>
                </div>
                <div className="text-end">
                  <div>Estimated Time of Arrival</div>
                  <strong className="text-dark">2026-10-04T16:00:00Z</strong>
                </div>
              </div>
            </div>

            {/* 5. Historical Voyage Data Card (Clickable) */}
            <div
              className="card shadow-sm border p-3 mb-3 bg-white rounded-3 map-mgmt-item"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowVoyageHistoryModal(true)}
              title="Click to view full historical voyage logs"
            >
              <div className="d-flex align-items-center justify-content-between fw-bold text-dark mb-2" style={{ fontSize: '0.85rem' }}>
                <div className="d-flex align-items-center gap-2">
                  <History className="w-3.5 h-3.5 text-primary" />
                  <span>Historical Voyage Data</span>
                </div>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code" style={{ fontSize: '0.7rem' }}>
                  4 Logs
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-between p-2 rounded bg-light border mb-2">
                <span className="fw-bold text-dark small">{vessel.portOfRegistry ? vessel.portOfRegistry.replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() : 'AUFRE'}</span>
                <span className="text-muted small">⟷</span>
                <span className="fw-bold text-dark small">{vessel.tradingArea ? vessel.tradingArea.replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() : 'AUDMP'}</span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-light border w-100 py-1.5 text-secondary small d-flex align-items-center justify-content-center gap-1.5"
                style={{ fontSize: '0.74rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVoyageHistoryModal(true);
                }}
              >
                <Info className="w-3 h-3 text-primary shrink-0" />
                <span>View historical data</span>
              </button>
            </div>

            {/* 6. Voyage Progress Accordion */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showVoyageProgress ? 'is-open' : ''}`}
                onClick={() => setShowVoyageProgress(!showVoyageProgress)}
              >
                <div className="map-datasheet-card-title">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Voyage Progress</span>
                </div>
                <span className="text-muted small">{showVoyageProgress ? '▲' : '▼'}</span>
              </div>
              {showVoyageProgress && (
                <div className="p-3 bg-white border-top small text-secondary">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Distance Travelled:</span>
                    <strong className="text-dark">1,420 NM (68%)</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span>Remaining Distance:</span>
                    <strong className="text-dark">670 NM</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Current Waypoint:</span>
                    <strong className="text-dark">WP-04 Strait Passage</strong>
                  </div>
                </div>
              )}
            </div>

            {/* 7. Arrival Details Accordion */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showArrivalDetails ? 'is-open' : ''}`}
                onClick={() => setShowArrivalDetails(!showArrivalDetails)}
              >
                <div className="map-datasheet-card-title">
                  <Flag className="w-3.5 h-3.5" />
                  <span>Arrival Details</span>
                </div>
                <span className="text-muted small">{showArrivalDetails ? '▲' : '▼'}</span>
              </div>
              {showArrivalDetails && (
                <div className="p-3 bg-white border-top small text-secondary">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Designated Terminal:</span>
                    <strong className="text-dark">Berth 4A East</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span>Pilot Boarding:</span>
                    <strong className="text-dark">14:30 UTC</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Tug Assistance:</span>
                    <strong className="text-dark">2 Harbour Tugs Assigned</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* Column 2: Vessel Datasheet Technical Breakdown */}
          {/* ========================================================= */}
          <div className={showManagementSection ? 'col-12 col-lg-5 col-xl-5' : 'col-12 col-lg-7 col-xl-7'}>
            {/* Section Header Divider */}
            <div className="map-section-divider">
              <FileText className="w-4 h-4" />
              <span>Vessel Datasheet</span>
            </div>

            {/* Accordion 1: General Information */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showGeneralInfo ? 'is-open' : ''}`}
                onClick={() => setShowGeneralInfo(!showGeneralInfo)}
              >
                <div className="map-datasheet-card-title">
                  <FileText className="w-3.5 h-3.5" />
                  <span>General Information</span>
                </div>
                <span className="text-muted small">{showGeneralInfo ? '▲' : '▼'}</span>
              </div>
              {showGeneralInfo && (
                <div className="map-datasheet-grid">
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">AIS Name</span>
                    {fieldEditable('name') ? (
                      <input
                        type="text"
                        className={`form-control form-control-sm${isJustLoaded ? ' map-autofill-animate' : ''}`}
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.name}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Type</span>
                    {fieldEditable('vesselType') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.vesselType}
                        onChange={(e) => handleInputChange('vesselType', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.vesselSubtype || vessel.vesselType}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Flag</span>
                    {fieldEditable('flagState') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.flagState}
                        onChange={(e) => handleInputChange('flagState', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.flagState}</span>
                    )}
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">IMO</span>
                    {fieldEditable('imoNumber') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={formData.imoNumber}
                        onChange={(e) => handleInputChange('imoNumber', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val font-mono-code">{vessel.imoNumber}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">MMSI</span>
                    {fieldEditable('mmsiNumber') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={formData.mmsiNumber || ''}
                        onChange={(e) => handleInputChange('mmsiNumber', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val font-mono-code">{vessel.mmsiNumber || '319302900'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Callsign</span>
                    {fieldEditable('callSign') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={formData.callSign || ''}
                        onChange={(e) => handleInputChange('callSign', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val font-mono-code">{vessel.callSign || 'ZGUB'}</span>
                    )}
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Shipyard Built</span>
                    {fieldEditable('shipyardBuilder') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.shipyardBuilder || ''}
                        onChange={(e) => handleInputChange('shipyardBuilder', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.shipyardBuilder || 'Damen Shipyards'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Year Built</span>
                    {fieldEditable('yearBuilt') ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.yearBuilt || ''}
                        onChange={(e) => handleInputChange('yearBuilt', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.yearBuilt || '2021'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Build Number</span>
                    {fieldEditable('officialRegNumber') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={formData.officialRegNumber || ''}
                        onChange={(e) => handleInputChange('officialRegNumber', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val font-mono-code">{vessel.officialRegNumber || 'HN-2021-08'}</span>
                    )}
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Lenght</span>
                    {fieldEditable('lengthOverallMeters') ? (
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={formData.lengthOverallMeters || ''}
                        onChange={(e) => handleInputChange('lengthOverallMeters', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.lengthOverallMeters ? `${vessel.lengthOverallMeters} m` : '83.4 m'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Width</span>
                    {fieldEditable('beamMeters') ? (
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={formData.beamMeters || ''}
                        onChange={(e) => handleInputChange('beamMeters', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.beamMeters ? `${vessel.beamMeters} m` : '18.0 m'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Draught</span>
                    {fieldEditable('draftMeters') ? (
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={formData.draftMeters || ''}
                        onChange={(e) => handleInputChange('draftMeters', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.draftMeters ? `${vessel.draftMeters} m` : '5.8 m'}</span>
                    )}
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Speed</span>
                    <span className="map-datasheet-val">{vessel.vesselType.toLowerCase().includes('tug') ? '12.0 kn' : '14.5 kn'}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Course</span>
                    <span className="map-datasheet-val">36° NNE</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Deadweight</span>
                    {fieldEditable('deadweightTonnageDWT') ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.deadweightTonnageDWT || ''}
                        onChange={(e) => handleInputChange('deadweightTonnageDWT', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.deadweightTonnageDWT ? `${vessel.deadweightTonnageDWT.toLocaleString()} MTs` : '4,100 MTs'}</span>
                    )}
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">GrossTonnage</span>
                    {fieldEditable('grossTonnageGT') ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.grossTonnageGT || ''}
                        onChange={(e) => handleInputChange('grossTonnageGT', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.grossTonnageGT ? `${vessel.grossTonnageGT.toLocaleString()} MTs` : '3,250 MTs'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Port Of Registry</span>
                    {fieldEditable('portOfRegistry') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.portOfRegistry || ''}
                        onChange={(e) => handleInputChange('portOfRegistry', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.portOfRegistry || 'MONROVIA'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Current Status</span>
                    {fieldEditable('status') ? (
                      <select
                        className="form-select form-select-sm"
                        value={formData.status}
                        onChange={(e) => handleInputChange('status', e.target.value as VesselRegistrationStatus)}
                      >
                        <option value="Active">Active</option>
                        <option value="In Operations" disabled={!isAssuranceApproved}>
                          In Operations {!isAssuranceApproved ? '(Requires 100% Approved Assurance)' : ''}
                        </option>
                        <option value="In Transit" disabled={!isAssuranceApproved}>
                          In Transit {!isAssuranceApproved ? '(Requires 100% Approved Assurance)' : ''}
                        </option>
                        <option value="Port Stay">Port Stay</option>
                        <option value="Under Charter" disabled={!isAssuranceApproved}>
                          Under Charter {!isAssuranceApproved ? '(Requires 100% Approved Assurance)' : ''}
                        </option>
                        <option value="Standby">Standby</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Dry Docking">Dry Docking</option>
                        <option value="Lay-up">Lay-up</option>
                        <option value="Decommissioned">Decommissioned</option>
                      </select>
                    ) : (
                      <span className="map-datasheet-val">{vessel.status}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Dimensions Information */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showDimensionsInfo ? 'is-open' : ''}`}
                onClick={() => setShowDimensionsInfo(!showDimensionsInfo)}
              >
                <div className="map-datasheet-card-title">
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Dimensions Information</span>
                </div>
                <span className="text-muted small">{showDimensionsInfo ? '▲' : '▼'}</span>
              </div>
              {showDimensionsInfo && (
                <div className="map-datasheet-grid">
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Loa</span>
                    {fieldEditable('lengthOverallMeters') ? (
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={formData.lengthOverallMeters || ''}
                        onChange={(e) => handleInputChange('lengthOverallMeters', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.lengthOverallMeters || 83.4}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Lbp</span>
                    <span className="map-datasheet-val">{(formData.lengthOverallMeters ? formData.lengthOverallMeters * 0.92 : 76.8).toFixed(1)}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Lload</span>
                    <span className="map-datasheet-val">{(formData.lengthOverallMeters ? formData.lengthOverallMeters * 0.96 : 80.0).toFixed(1)}</span>
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Bext</span>
                    {fieldEditable('beamMeters') ? (
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={formData.beamMeters || ''}
                        onChange={(e) => handleInputChange('beamMeters', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.beamMeters || 18.0}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">B</span>
                    <span className="map-datasheet-val">{formData.beamMeters || 18.0}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">D</span>
                    <span className="map-datasheet-val">{(formData.draftMeters ? formData.draftMeters * 1.5 : 7.2).toFixed(1)}</span>
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Draught</span>
                    {fieldEditable('draftMeters') ? (
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={formData.draftMeters || ''}
                        onChange={(e) => handleInputChange('draftMeters', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.draftMeters || 5.8}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Summer Draught</span>
                    <span className="map-datasheet-val">{(formData.draftMeters ? formData.draftMeters * 1.08 : 6.2).toFixed(1)}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Freeboard</span>
                    <span className="map-datasheet-val">1165</span>
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Gross Tonnage</span>
                    {fieldEditable('grossTonnageGT') ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.grossTonnageGT || ''}
                        onChange={(e) => handleInputChange('grossTonnageGT', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.grossTonnageGT?.toLocaleString() || '3,250'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Net Tonnage</span>
                    <span className="map-datasheet-val">{Math.round((formData.grossTonnageGT || 3250) * 0.35).toLocaleString()}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Suez Gross T</span>
                    <span className="map-datasheet-val">{Math.round((formData.grossTonnageGT || 3250) * 1.05).toLocaleString()}</span>
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Suez Net T</span>
                    <span className="map-datasheet-val">{Math.round((formData.grossTonnageGT || 3250) * 0.38).toLocaleString()}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Panama Gross T</span>
                    <span className="map-datasheet-val">{Math.round((formData.grossTonnageGT || 3250) * 1.02).toLocaleString()}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Panama Net T</span>
                    <span className="map-datasheet-val">{Math.round((formData.grossTonnageGT || 3250) * 0.36).toLocaleString()}</span>
                  </div>

                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Deadweight</span>
                    {fieldEditable('deadweightTonnageDWT') ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.deadweightTonnageDWT || ''}
                        onChange={(e) => handleInputChange('deadweightTonnageDWT', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.deadweightTonnageDWT?.toLocaleString() || '4,100'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Summer DWT</span>
                    <span className="map-datasheet-val">{formData.deadweightTonnageDWT?.toLocaleString() || '4,100'}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">TPC / TPI</span>
                    <span className="map-datasheet-val">{((formData.deadweightTonnageDWT || 4100) / 120).toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Classification & Analogous Information */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showClassificationInfo ? 'is-open' : ''}`}
                onClick={() => setShowClassificationInfo(!showClassificationInfo)}
              >
                <div className="map-datasheet-card-title">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Classification &amp; Analogous Information</span>
                </div>
                <span className="text-muted small">{showClassificationInfo ? '▲' : '▼'}</span>
              </div>
              {showClassificationInfo && (
                <div className="map-datasheet-grid">
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Class Society</span>
                    {fieldEditable('classificationSociety') ? (
                      <select
                        className="form-select form-select-sm"
                        value={formData.classificationSociety}
                        onChange={(e) => handleInputChange('classificationSociety', e.target.value as ClassificationSociety)}
                      >
                        <option value="DNV">DNV</option>
                        <option value="ABS">ABS</option>
                        <option value="Lloyd's Register">Lloyd's Register</option>
                        <option value="Bureau Veritas">Bureau Veritas</option>
                        <option value="RINA">RINA</option>
                      </select>
                    ) : (
                      <span className="map-datasheet-val">{vessel.classificationSociety}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Class Notation</span>
                    {fieldEditable('classNotation') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.classNotation}
                        onChange={(e) => handleInputChange('classNotation', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.classNotation}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Hull Type</span>
                    {fieldEditable('hullType') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.hullType}
                        onChange={(e) => handleInputChange('hullType', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.hullType}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">DP Class</span>
                    {fieldEditable('dynamicPositioningClass') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.dynamicPositioningClass || ''}
                        onChange={(e) => handleInputChange('dynamicPositioningClass', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.dynamicPositioningClass || 'DP2'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">P&amp;I Club</span>
                    {fieldEditable('piClubName') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.piClubName || ''}
                        onChange={(e) => handleInputChange('piClubName', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.piClubName || 'Gard P&I Club'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Policy Number</span>
                    {fieldEditable('policyNumber') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={formData.policyNumber || ''}
                        onChange={(e) => handleInputChange('policyNumber', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val font-mono-code">{vessel.policyNumber || 'POL-GARD-2026-99'}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 4: Engine Room Information */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showEngineRoomInfo ? 'is-open' : ''}`}
                onClick={() => setShowEngineRoomInfo(!showEngineRoomInfo)}
              >
                <div className="map-datasheet-card-title">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Engine Room Information</span>
                </div>
                <span className="text-muted small">{showEngineRoomInfo ? '▲' : '▼'}</span>
              </div>
              {showEngineRoomInfo && (
                <div className="map-datasheet-grid">
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Main Engine</span>
                    {fieldEditable('mainEnginePowerKW') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.mainEnginePowerKW || ''}
                        onChange={(e) => handleInputChange('mainEnginePowerKW', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.mainEnginePowerKW || '2x 2400 kW Wärtsilä 8L26'}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Total Power</span>
                    <span className="map-datasheet-val">{formData.mainEnginePowerKW || '4,800 kW (6,430 BHP)'}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Propulsion</span>
                    <span className="map-datasheet-val">{formData.dynamicPositioningClass ? 'Twin Screw CPP with Kort Nozzles' : 'Twin Screw CPP'}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Bow Thruster</span>
                    <span className="map-datasheet-val">{formData.dynamicPositioningClass?.includes('DP2') ? '2x 650 kW Tunnel' : '1x 500 kW Tunnel'}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Stern Thruster</span>
                    <span className="map-datasheet-val">{formData.dynamicPositioningClass?.includes('DP2') ? '1x 600 kW Tunnel' : '1x 400 kW Tunnel'}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Fuel Types</span>
                    {fieldEditable('fuelType') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.fuelType || ''}
                        onChange={(e) => handleInputChange('fuelType', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.fuelType || 'MGO / Low Sulphur DMA'}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 5: Ship Capacity & Equipment Information */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showShipCapacityInfo ? 'is-open' : ''}`}
                onClick={() => setShowShipCapacityInfo(!showShipCapacityInfo)}
              >
                <div className="map-datasheet-card-title">
                  <Package className="w-3.5 h-3.5" />
                  <span>Ship Capacity &amp; Equipment Information</span>
                </div>
                <span className="text-muted small">{showShipCapacityInfo ? '▲' : '▼'}</span>
              </div>
              {showShipCapacityInfo && (
                <div className="map-datasheet-grid">
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Deck Area</span>
                    <span className="map-datasheet-val">{`${Math.round((formData.lengthOverallMeters || 80) * (formData.beamMeters || 18) * 0.45)} m²`}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Deck Cargo</span>
                    <span className="map-datasheet-val">{`${Math.round((formData.deadweightTonnageDWT || 4000) * 0.4)} MT`}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Fuel Oil</span>
                    <span className="map-datasheet-val">{`${Math.round((formData.deadweightTonnageDWT || 4000) * 0.2)} m³`}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Fresh Water</span>
                    <span className="map-datasheet-val">{`${Math.round((formData.deadweightTonnageDWT || 4000) * 0.12)} m³`}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Liquid Mud</span>
                    <span className="map-datasheet-val">{`${Math.round((formData.deadweightTonnageDWT || 4000) * 0.15)} m³`}</span>
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Towing Winch</span>
                    <span className="map-datasheet-val">{formData.vesselSubtype?.includes('AHTS') ? 'Hydraulic Double Drum 150T' : 'Standard Mooring Winches'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* Column 3: Management Information & Fleet Companies (Client Admin Only) */}
          {/* ========================================================= */}
          {showManagementSection && (
            <div className="col-12 col-lg-3 col-xl-3">
              {/* Section Header Divider */}
              <div className="map-section-divider">
                <Building className="w-4 h-4" />
                <span>Management Information</span>
              </div>

              {/* Accordion 1: Registered Owner Information */}
              <div className="map-datasheet-card">
                <div
                  className={`map-datasheet-card-header ${showRegOwnerInfo ? 'is-open' : ''}`}
                  onClick={() => setShowRegOwnerInfo(!showRegOwnerInfo)}
                >
                  <div className="d-flex align-items-center gap-1.5 fw-bold text-primary small text-truncate" style={{ fontSize: '0.8rem' }}>
                    <span className="text-truncate">Registered Owner</span>
                    <div className="d-flex align-items-center gap-1 text-muted ms-1 opacity-75">
                      <Mail className="w-2.5 h-2.5" />
                      <Globe className="w-2.5 h-2.5" />
                      <Phone className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showRegOwnerInfo ? "rotate-180" : ""}`} />
                </div>
                {showRegOwnerInfo && (
                  <div className="p-3 bg-white border-top small">
                    <div className="mb-2">
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Company Name</span>
                      {fieldEditable('registeredOwner') ? (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.registeredOwner}
                          onChange={(e) => handleInputChange('registeredOwner', e.target.value)}
                        />
                      ) : (
                        <strong className="text-dark">{vessel.registeredOwner}</strong>
                      )}
                    </div>
                    <div className="mb-2">
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Mails</span>
                      <span className="text-primary">{`owner@${formData.registeredOwner.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Phones</span>
                      {fieldEditable('contact247') ? (
                        <input
                          type="text"
                          className="form-control form-control-sm font-mono-code"
                          value={formData.contact247}
                          onChange={(e) => handleInputChange('contact247', e.target.value)}
                        />
                      ) : (
                        <span className="font-mono-code text-dark">{vessel.contact247 || '+65 6789 0123'}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Location</span>
                      <span className="text-dark">{formData.portOfRegistry || 'Singapore'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: ISM Manager Information */}
              <div className="map-datasheet-card">
                <div
                  className={`map-datasheet-card-header ${showIsmManagerInfo ? 'is-open' : ''}`}
                  onClick={() => setShowIsmManagerInfo(!showIsmManagerInfo)}
                >
                  <div className="d-flex align-items-center gap-1.5 fw-bold text-primary small text-truncate" style={{ fontSize: '0.8rem' }}>
                    <span className="text-truncate">ISM Manager</span>
                    <div className="d-flex align-items-center gap-1 text-muted ms-1 opacity-75">
                      <Mail className="w-2.5 h-2.5" />
                      <Globe className="w-2.5 h-2.5" />
                      <Phone className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showIsmManagerInfo ? "rotate-180" : ""}`} />
                </div>
                {showIsmManagerInfo && (
                  <div className="p-3 bg-white border-top small">
                    <div className="mb-2">
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Company Name</span>
                      {fieldEditable('ismCompany') ? (
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.ismCompany || ''}
                          onChange={(e) => handleInputChange('ismCompany', e.target.value)}
                        />
                      ) : (
                        <strong className="text-dark">{vessel.ismCompany || vessel.registeredOwner}</strong>
                      )}
                    </div>
                    <div className="mb-2">
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Mails</span>
                      <span className="text-primary">{`ism@${(formData.ismCompany || formData.registeredOwner).toLowerCase().replace(/[^a-z0-9]/g, '')}.com`}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Phones</span>
                      <span className="font-mono-code text-dark">+65 6789 0124</span>
                    </div>
                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Location</span>
                      <span className="text-dark">{formData.portOfRegistry || 'Singapore'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 3: Ship Manager Information (Open by default matching mockup) */}
              <div className="map-datasheet-card">
                <div
                  className={`map-datasheet-card-header ${showShipManagerInfo ? 'is-open' : ''}`}
                  onClick={() => setShowShipManagerInfo(!showShipManagerInfo)}
                >
                  <div className="d-flex align-items-center gap-1.5 fw-bold text-primary small text-truncate" style={{ fontSize: '0.8rem' }}>
                    <span className="text-truncate">Ship Manager</span>
                    <div className="d-flex align-items-center gap-1 text-muted ms-1 opacity-75">
                      <Mail className="w-2.5 h-2.5" />
                      <Globe className="w-2.5 h-2.5" />
                      <Phone className="w-2.5 h-2.5" />
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showShipManagerInfo ? "rotate-180" : ""}`} />
                </div>
                {showShipManagerInfo && (
                  <div className="p-3 bg-white border-top small">
                    <div className="row g-2">
                      <div className="col-12">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Company Name</span>
                        {fieldEditable('technicalManager') ? (
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={formData.technicalManager || ''}
                            onChange={(e) => handleInputChange('technicalManager', e.target.value)}
                          />
                        ) : (
                          <strong className="text-dark d-block text-truncate">{vessel.technicalManager || vessel.registeredOwner}</strong>
                        )}
                      </div>
                      <div className="col-12">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Mails</span>
                        <span className="text-primary d-block text-truncate">{`ops@${(formData.technicalManager || formData.registeredOwner).toLowerCase().replace(/[^a-z0-9]/g, '')}.com`}</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Phones</span>
                        <span className="font-mono-code text-dark d-block text-truncate">+65 6789 0125</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Faxes</span>
                        <span className="font-mono-code text-dark d-block text-truncate">+65 6789 0126</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Website</span>
                        <span className="text-primary d-block text-truncate">{`www.${(formData.technicalManager || formData.registeredOwner).toLowerCase().replace(/[^a-z0-9]/g, '')}.com`}</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Date of Effect</span>
                        <span className="text-dark d-block text-truncate font-mono-code">2021-01-15</span>
                      </div>
                      <div className="col-12">
                        <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Location</span>
                        <span className="text-dark d-block text-truncate">{formData.portOfRegistry ? `${formData.portOfRegistry} Marine Industrial Terminal` : 'Jurong Port, Singapore'}</span>
                      </div>
                      <div className="col-12 pt-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary w-100 py-1"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => {
                            setShowRegOwnerInfo(true);
                            setShowIsmManagerInfo(true);
                            setShowShipManagerInfo(true);
                            setToastMessage('Expanded all management and company dossiers.');
                            setTimeout(() => setToastMessage(null), 3000);
                          }}
                        >
                          Show All Details
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section Header Divider: Companies Other Vessels */}
              <div className="map-section-divider mt-3">
                <Anchor className="w-4 h-4" />
                <span>Companies Other Vessels</span>
              </div>

              {/* Company Fleet Card 1 */}
              <div
                className="card shadow-sm border p-2.5 mb-2 bg-white rounded-3 map-mgmt-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedCompanyForFleetModal(vessel.registeredOwner)}
                title={`View fleet for ${vessel.registeredOwner}`}
              >
                <div className="d-flex align-items-center gap-1.5 fw-bold text-dark mb-1.5" style={{ fontSize: '0.78rem' }}>
                  <Building2 className="w-3 h-3 text-secondary" />
                  <span className="text-truncate">{vessel.registeredOwner.toUpperCase()}</span>
                </div>
                <div className="alert alert-light border py-1.5 px-2 mb-0 text-secondary d-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
                  <Info className="w-2.5 h-2.5 text-primary shrink-0" />
                  <span className="text-truncate">View company fleet</span>
                </div>
              </div>

              {/* Company Fleet Card 2 */}
              <div
                className="card shadow-sm border p-2.5 mb-2 bg-white rounded-3 map-mgmt-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedCompanyForFleetModal(vessel.technicalManager || vessel.registeredOwner)}
                title="View fleet for technical manager"
              >
                <div className="d-flex align-items-center gap-1.5 fw-bold text-dark mb-1.5" style={{ fontSize: '0.78rem' }}>
                  <Building2 className="w-3 h-3 text-secondary" />
                  <span className="text-truncate">{vessel.technicalManager ? vessel.technicalManager.toUpperCase() : 'ANGLO-EASTERN SHIPMANAGEMENT S'}</span>
                </div>
                <div className="alert alert-light border py-1.5 px-2 mb-0 text-secondary d-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
                  <Info className="w-2.5 h-2.5 text-primary shrink-0" />
                  <span className="text-truncate">View company fleet</span>
                </div>
              </div>

              {/* Company Fleet Card 3 */}
              <div
                className="card shadow-sm border p-2.5 mb-2 bg-white rounded-3 map-mgmt-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedCompanyForFleetModal(vessel.ismCompany || vessel.registeredOwner)}
                title="View fleet for ISM company"
              >
                <div className="d-flex align-items-center gap-1.5 fw-bold text-dark mb-1.5" style={{ fontSize: '0.78rem' }}>
                  <Building2 className="w-3 h-3 text-secondary" />
                  <span className="text-truncate">{vessel.ismCompany ? vessel.ismCompany.toUpperCase() : 'AL SEER MARINE SUPPLIES'}</span>
                </div>
                <div className="alert alert-light border py-1.5 px-2 mb-0 text-secondary d-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
                  <Info className="w-2.5 h-2.5 text-primary shrink-0" />
                  <span className="text-truncate">View company fleet</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Pre-Assurance Document Vault (BR-5) */}
      {activeTab === 'vault' && (
        <div className="card map-card-custom">
          {/* Table Header Controls Row */}
          <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="Search Certificate, Number, Body..."
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                style={{ width: '250px' }}
              />

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={vaultStatusFilter}
                onChange={(e) => setVaultStatusFilter(e.target.value)}
                style={{ width: '160px' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="Valid">Valid</option>
                <option value="Expiring">Expiring &lt; 90 Days</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="Verified">Verified</option>
              </select>

            </div>

            {canUploadDocs && (
              <button
                type="button"
                className="btn btn-sm btn-primary ms-auto"
                onClick={() => setIsUploadModalOpen(true)}
              >
                Upload Certificate
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (vaultSortField === 'name') setVaultSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setVaultSortField('name'); setVaultSortDirection('asc'); }
                    }}
                  >
                    Certificate Name {renderSortIndicator(vaultSortField, 'name', vaultSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (vaultSortField === 'number') setVaultSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setVaultSortField('number'); setVaultSortDirection('asc'); }
                    }}
                  >
                    Certificate Number {renderSortIndicator(vaultSortField, 'number', vaultSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (vaultSortField === 'issuingBody') setVaultSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setVaultSortField('issuingBody'); setVaultSortDirection('asc'); }
                    }}
                  >
                    Issuing Body {renderSortIndicator(vaultSortField, 'issuingBody', vaultSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (vaultSortField === 'expiryDate') setVaultSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setVaultSortField('expiryDate'); setVaultSortDirection('asc'); }
                    }}
                  >
                    Validity Dates {renderSortIndicator(vaultSortField, 'expiryDate', vaultSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (vaultSortField === 'ocr') setVaultSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setVaultSortField('ocr'); setVaultSortDirection('asc'); }
                    }}
                  >
                    OCR CONFIDENCE {renderSortIndicator(vaultSortField, 'ocr', vaultSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (vaultSortField === 'status') setVaultSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setVaultSortField('status'); setVaultSortDirection('asc'); }
                    }}
                  >
                    Status {renderSortIndicator(vaultSortField, 'status', vaultSortDirection)}
                  </th>
                  <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredVaultCerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      No statutory certificates or documents match the search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredVaultCerts.map((cert) => {
                    let badgeClass = 'bg-success text-white';
                    if (cert.status === 'EXPIRED') badgeClass = 'bg-danger text-white';
                    else if (cert.status.includes('Expiring')) badgeClass = 'bg-warning text-dark';
                    else if (cert.status === 'Verified') badgeClass = 'bg-info text-dark';

                    return (
                      <tr
                        key={cert.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedVaultCertForModal(cert)}
                      >
                        <td className="fw-semibold text-dark">
                          <button
                            type="button"
                            className="btn btn-link p-0 text-primary text-start fw-semibold text-decoration-underline border-0 bg-transparent align-baseline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVaultCertForModal(cert);
                            }}
                          >
                            {cert.name}
                          </button>
                        </td>
                        <td className="font-mono-code">{cert.number}</td>
                        <td>{cert.issuingBody}</td>
                        <td className="font-mono-code small">
                          {cert.issueDate !== '—' ? `${formatMaritimeDate(cert.issueDate)} → ` : ''}{formatMaritimeDate(cert.expiryDate)}
                        </td>
                        <td>
                          <span className="map-ocr-badge">{cert.ocr}</span>
                        </td>
                        <td>
                          <span className={`badge ${badgeClass}`}>{cert.status}</span>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-1 px-2"
                            style={{ fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVaultCertForModal(cert);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )
      }

      {/* Tab 3: Assurance Sets */}
      {activeTab === 'assurance' && (
        <div className="card map-card-custom">
          {/* Table Controls Header */}
          <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              {linkedSets.length > 0 && (
                <>
                  <select
                    className="form-select form-select-sm bg-white text-dark border-secondary"
                    value={selectedAssuranceSetId}
                    onChange={(e) => setSelectedAssuranceSetId(e.target.value)}
                    style={{ width: '280px' }}
                  >
                    {linkedSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} — {s.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    disabled={!selectedAssuranceSetId}
                    onClick={() => selectedAssuranceSetId && setCurrentHashView('assurance-sets', selectedAssuranceSetId)}
                  >
                    Open Selected
                  </button>
                  {canCreateAssurance && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={!selectedAssuranceSetId}
                      onClick={() => selectedAssuranceSetId && handleCreateAssuranceForVessel(selectedAssuranceSetId)}
                    >
                      Copy as Template
                    </button>
                  )}
                </>
              )}

              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="Search Set ID, Title, Initiator..."
                value={assuranceSearch}
                onChange={(e) => setAssuranceSearch(e.target.value)}
                style={{ width: '250px' }}
              />

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={assuranceStageFilter}
                onChange={(e) => setAssuranceStageFilter(e.target.value)}
                style={{ width: '170px' }}
              >
                <option value="ALL">All Stages</option>
                <option value="Drafting">Drafting</option>
                <option value="Data Gathering">Data Gathering</option>
                <option value="Physical Inspection">Physical Inspection</option>
                <option value="Desktop Assessment">Desktop Assessment</option>
                <option value="Verification">Verification</option>
                <option value="Assurance Granted">Assurance Granted</option>
              </select>

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={assuranceSortField}
                onChange={(e) => setAssuranceSortField(e.target.value as any)}
                style={{ width: '170px' }}
              >
                <option value="id">Sort: Set ID</option>
                <option value="title">Sort: Title</option>
                <option value="initiatorOrg">Sort: Initiator</option>
                <option value="charterWindow">Sort: Charter Window</option>
                <option value="stage">Sort: Stage</option>
                <option value="readinessScore">Sort: Readiness</option>
              </select>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark"
                onClick={() => setAssuranceSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'))}
                title={`Sort direction: ${assuranceSortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {assuranceSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>

            {canCreateAssurance && (
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary fw-semibold"
                  onClick={() => setShowAddToProjectModal(true)}
                >
                  Add to Project
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-semibold"
                  onClick={() => handleCreateAssuranceForVessel()}
                >
                  Create Assurance Set
                </button>
              </div>
            )}
          </div>

          <div className="card-body p-0">
            {filteredAssuranceSets.length === 0 ? (
              <div className="p-4 text-center text-muted">
                {linkedSets.length === 0 ? (
                  <>
                    <div className="mb-3">No assurance sets linked to this vessel yet.</div>
                    {canCreateAssurance && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary fw-semibold"
                        onClick={() => handleCreateAssuranceForVessel()}
                      >
                        Create Assurance Set for this Vessel
                      </button>
                    )}
                  </>
                ) : (
                  'No assurance sets match the search and filter criteria.'
                )}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table map-table-custom align-middle mb-0">
                  <thead>
                    <tr>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (assuranceSortField === 'id') setAssuranceSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setAssuranceSortField('id'); setAssuranceSortDirection('asc'); }
                        }}
                      >
                        Set ID {renderSortIndicator(assuranceSortField, 'id', assuranceSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (assuranceSortField === 'initiatorOrg') setAssuranceSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setAssuranceSortField('initiatorOrg'); setAssuranceSortDirection('asc'); }
                        }}
                      >
                        Initiating Organization {renderSortIndicator(assuranceSortField, 'initiatorOrg', assuranceSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (assuranceSortField === 'charterWindow') setAssuranceSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setAssuranceSortField('charterWindow'); setAssuranceSortDirection('asc'); }
                        }}
                      >
                        Charter Window {renderSortIndicator(assuranceSortField, 'charterWindow', assuranceSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (assuranceSortField === 'stage') setAssuranceSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setAssuranceSortField('stage'); setAssuranceSortDirection('asc'); }
                        }}
                      >
                        Stage {renderSortIndicator(assuranceSortField, 'stage', assuranceSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (assuranceSortField === 'readinessScore') setAssuranceSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setAssuranceSortField('readinessScore'); setAssuranceSortDirection('asc'); }
                        }}
                      >
                        Readiness {renderSortIndicator(assuranceSortField, 'readinessScore', assuranceSortDirection)}
                      </th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssuranceSets.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="fw-semibold font-mono-code text-primary">{s.id}</div>

                        </td>
                        <td className="small">
                          <div>{s.initiatorOrg}</div>
                        </td>
                        <td className="font-mono-code small">
                          {s.charterWindowStart} &rarr; {s.charterWindowEnd}
                        </td>
                        <td>
                          <span className="badge bg-secondary">{s.stage}</span>
                        </td>
                        <td>
                          <ReadinessGauge score={calculateAssuranceSetReadiness(s)} size="sm" />
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setCurrentHashView('assurance-sets', s.id)}
                          >
                            Open Set
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Status History — availability, registration, class, compliance timelines */}
      {activeTab === 'statusHistory' && (
        <div className="card map-card-custom">
          <div className="card-header bg-white border-bottom py-3 px-3">
            <div className="fw-bold text-dark mb-2">Current Status</div>
            <div className="d-flex flex-wrap gap-2">
              {(Object.keys(VESSEL_STATUS_DIMENSION_LABELS) as VesselStatusDimension[]).map((dimension) => {
                const currentEntry = currentStatusByDimension[dimension];
                const fallbackValue =
                  dimension === 'availability'
                    ? vesselAssetStatus?.availabilityStatus
                    : dimension === 'registration'
                      ? vesselAssetStatus?.registrationStatus
                      : dimension === 'class'
                        ? vesselAssetStatus?.classStatus
                        : vesselAssetStatus?.complianceStatus;
                const value = currentEntry?.newValue ?? fallbackValue ?? 'Unknown';
                return (
                  <div
                    key={dimension}
                    className="d-flex align-items-center gap-2 px-2 py-1 border rounded bg-light"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <span className="text-secondary text-uppercase fw-bold" style={{ fontSize: '0.65rem' }}>
                      {dimensionLabel(dimension)}
                    </span>
                    <span className={`badge ${statusHistoryBadgeClass(value)}`}>{value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3 border-top-0">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="Search status, notes, user..."
                value={statusHistorySearch}
                onChange={(e) => setStatusHistorySearch(e.target.value)}
                style={{ width: '220px' }}
              />

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={statusHistoryDimensionFilter}
                onChange={(e) => setStatusHistoryDimensionFilter(e.target.value as 'ALL' | VesselStatusDimension)}
                style={{ width: '160px' }}
              >
                <option value="ALL">All Dimensions</option>
                {(Object.keys(VESSEL_STATUS_DIMENSION_LABELS) as VesselStatusDimension[]).map((dim) => (
                  <option key={dim} value={dim}>
                    {dimensionLabel(dim)}
                  </option>
                ))}
              </select>

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={statusHistorySortField}
                onChange={(e) =>
                  setStatusHistorySortField(
                    e.target.value as 'effectiveFrom' | 'dimension' | 'previousValue' | 'newValue' | 'changedBy',
                  )
                }
                style={{ width: '160px' }}
              >
                <option value="effectiveFrom">Sort: Effective From</option>
                <option value="dimension">Sort: Dimension</option>
                <option value="previousValue">Sort: Previous</option>
                <option value="newValue">Sort: New Status</option>
                <option value="changedBy">Sort: Changed By</option>
              </select>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark"
                onClick={() => setStatusHistorySortDirection((p) => (p === 'asc' ? 'desc' : 'asc'))}
                title={`Sort direction: ${statusHistorySortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {statusHistorySortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>

              <div className="form-check form-switch ms-1 mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="statusHistoryCurrentOnly"
                  checked={statusHistoryCurrentOnly}
                  onChange={(e) => setStatusHistoryCurrentOnly(e.target.checked)}
                />
                <label className="form-check-label small text-secondary" htmlFor="statusHistoryCurrentOnly">
                  Current only
                </label>
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (statusHistorySortField === 'dimension') {
                        setStatusHistorySortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setStatusHistorySortField('dimension');
                        setStatusHistorySortDirection('asc');
                      }
                    }}
                  >
                    Dimension {renderSortIndicator(statusHistorySortField, 'dimension', statusHistorySortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (statusHistorySortField === 'previousValue') {
                        setStatusHistorySortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setStatusHistorySortField('previousValue');
                        setStatusHistorySortDirection('asc');
                      }
                    }}
                  >
                    Previous {renderSortIndicator(statusHistorySortField, 'previousValue', statusHistorySortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (statusHistorySortField === 'newValue') {
                        setStatusHistorySortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setStatusHistorySortField('newValue');
                        setStatusHistorySortDirection('asc');
                      }
                    }}
                  >
                    New Status {renderSortIndicator(statusHistorySortField, 'newValue', statusHistorySortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (statusHistorySortField === 'effectiveFrom') {
                        setStatusHistorySortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setStatusHistorySortField('effectiveFrom');
                        setStatusHistorySortDirection('desc');
                      }
                    }}
                  >
                    From {renderSortIndicator(statusHistorySortField, 'effectiveFrom', statusHistorySortDirection)}
                  </th>
                  <th style={{ whiteSpace: 'nowrap' }}>To</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Duration</th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (statusHistorySortField === 'changedBy') {
                        setStatusHistorySortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setStatusHistorySortField('changedBy');
                        setStatusHistorySortDirection('asc');
                      }
                    }}
                  >
                    Changed By {renderSortIndicator(statusHistorySortField, 'changedBy', statusHistorySortDirection)}
                  </th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatusHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      No status history records match the search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStatusHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <span className="badge bg-light text-dark border">{dimensionLabel(entry.dimension)}</span>
                      </td>
                      <td>
                        {entry.previousValue ? (
                          <span className={`badge ${statusHistoryBadgeClass(entry.previousValue)}`}>
                            {entry.previousValue}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${statusHistoryBadgeClass(entry.newValue)}`}>{entry.newValue}</span>
                        {!entry.effectiveTo && (
                          <span className="badge bg-primary text-white ms-1" style={{ fontSize: '0.6rem' }}>
                            Current
                          </span>
                        )}
                      </td>
                      <td className="font-mono-code small">{formatMaritimeDate(entry.effectiveFrom)}</td>
                      <td className="font-mono-code small">
                        {entry.effectiveTo ? formatMaritimeDate(entry.effectiveTo) : 'present'}
                      </td>
                      <td className="small text-secondary">
                        {formatStatusDuration(entry.effectiveFrom, entry.effectiveTo)}
                      </td>
                      <td className="small">
                        <div className="fw-semibold">{entry.changedBy}</div>
                        <div className="text-muted">{entry.changedByRole}</div>
                      </td>
                      <td className="small text-secondary">{entry.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Client / Charter History */}
      {activeTab === 'clients' && isAdmin && isOwned && (
        <div className="card map-card-custom">
          {/* Table Controls Header */}
          <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="Search Client Org, Charter..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                style={{ width: '250px' }}
              />

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={clientOutcomeFilter}
                onChange={(e) => setClientOutcomeFilter(e.target.value)}
                style={{ width: '160px' }}
              >
                <option value="ALL">All Outcomes</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
                <option value="Conditional">Conditional</option>
                <option value="Pending">Pending</option>
              </select>

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={clientSortField}
                onChange={(e) => setClientSortField(e.target.value as any)}
                style={{ width: '170px' }}
              >
                <option value="charterStart">Sort: Charter Period</option>
                <option value="clientOrganization">Sort: Client Org</option>
                <option value="charterTitle">Sort: Campaign</option>
                <option value="assuranceSetId">Sort: Assurance Set</option>
                <option value="outcome">Sort: Status</option>
                <option value="notes">Sort: Notes</option>
              </select>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark"
                onClick={() => setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'))}
                title={`Sort direction: ${clientSortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {clientSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>

          <div className="card-body p-0">
            {filteredClientHistory.length === 0 ? (
              <div className="p-4 text-center text-muted">No client or charter history records match the search and filter criteria.</div>
            ) : (
              <div className="table-responsive">
                <table className="table map-table-custom align-middle mb-0">
                  <thead>
                    <tr>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'clientOrganization') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('clientOrganization'); setClientSortDirection('asc'); }
                        }}
                      >
                        Client Organization {renderSortIndicator(clientSortField, 'clientOrganization', clientSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'charterTitle') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('charterTitle'); setClientSortDirection('asc'); }
                        }}
                      >
                        Charter / Campaign {renderSortIndicator(clientSortField, 'charterTitle', clientSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'charterStart') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('charterStart'); setClientSortDirection('asc'); }
                        }}
                      >
                        Charter Period {renderSortIndicator(clientSortField, 'charterStart', clientSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'assuranceSetId') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('assuranceSetId'); setClientSortDirection('asc'); }
                        }}
                      >
                        Assurance Set {renderSortIndicator(clientSortField, 'assuranceSetId', clientSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'outcome') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('outcome'); setClientSortDirection('asc'); }
                        }}
                      >
                        Status {renderSortIndicator(clientSortField, 'outcome', clientSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'notes') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('notes'); setClientSortDirection('asc'); }
                        }}
                      >
                        Notes {renderSortIndicator(clientSortField, 'notes', clientSortDirection)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientHistory.map((record) => (
                      <tr key={record.id}>
                        <td className="fw-semibold text-dark">{record.clientOrganization}</td>
                        <td className="small">{record.charterTitle}</td>
                        <td className="font-mono-code small">
                          {formatMaritimeDate(record.charterStart)} &rarr; {formatMaritimeDate(record.charterEnd)}
                        </td>
                        <td className="font-mono-code small">
                          {record.assuranceSetId ? (
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 font-mono-code"
                              onClick={() => setCurrentHashView('assurance-sets', record.assuranceSetId!)}
                            >
                              {record.assuranceSetId}
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>{renderClientOutcomeBadge(record.outcome)}</td>
                        <td className="small text-secondary">{record.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Assigned Crew Directory */}
      {activeTab === 'crew' && isAdmin && isOwned && (
        <div className="card map-card-custom">
          {/* Table Header Controls Row matching standard CrewTable.tsx layout */}
          <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
            {/* Left Side: Search Box & Filter Dropdowns */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="Search Crew ID, Name, Rank..."
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
                style={{ width: '250px' }}
              />

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={crewRankFilter}
                onChange={(e) => setCrewRankFilter(e.target.value)}
                style={{ width: '150px' }}
              >
                <option value="All">All Ranks / Officers</option>
                {crewRanks.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={crewComplianceFilter}
                onChange={(e) => setCrewComplianceFilter(e.target.value)}
                style={{ width: '170px' }}
              >
                <option value="All">All STCW Statuses</option>
                <option value="Fully Compliant">Fully Compliant</option>
                <option value="Expiring < 60 Days">Expiring &lt; 60 Days</option>
                <option value="Document Deficient">Document Deficient</option>
              </select>

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={crewSortField}
                onChange={(e) => setCrewSortField(e.target.value as any)}
                style={{ width: '170px' }}
              >
                <option value="fullName">Sort: Full Name</option>
                <option value="id">Sort: Crew ID</option>
                <option value="nationality">Sort: Nationality</option>
                <option value="assignmentStatus">Sort: Assignment</option>
                <option value="overallComplianceScore">Sort: STCW Score</option>
                <option value="complianceStatus">Sort: Compliance</option>
              </select>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark"
                onClick={() => setCrewSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={`Sort direction: ${crewSortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {crewSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>

            {/* Right Side: Action Triggers */}
            <div className="d-flex align-items-center gap-2 ms-auto">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary fw-semibold"
                onClick={() => setIsAssignExistingOpen(!isAssignExistingOpen)}
              >
                Assign Existing Seafarer
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold"
                onClick={() => setIsAddCrewModalOpen(true)}
              >
                Register New Seafarer
              </button>
            </div>
          </div>

          {/* Inline Assign Existing Seafarer Toolbar */}
          {isAssignExistingOpen && (
            <div className="p-3 bg-light border-bottom d-flex flex-wrap align-items-center gap-3">
              <div className="fw-semibold text-dark small">Assign Unassigned Seafarer:</div>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                style={{ width: '320px' }}
                value={selectedCrewToAssign}
                onChange={(e) => setSelectedCrewToAssign(e.target.value)}
              >
                <option value="">-- Select Seafarer from Directory --</option>
                {crew
                  .filter((c) => c.currentVesselId !== vessel.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.rank} · {c.nationality}) {c.currentVesselName ? `[Currently: ${c.currentVesselName}]` : '[Unassigned]'}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-success fw-semibold"
                disabled={!selectedCrewToAssign}
                onClick={() => {
                  if (selectedCrewToAssign) {
                    assignCrewToVessel(selectedCrewToAssign, vessel.id);
                    setToastMessage(`Successfully assigned seafarer to ${vessel.name}`);
                    setSelectedCrewToAssign('');
                    setIsAssignExistingOpen(false);
                  }
                }}
              >
                Assign to Vessel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setIsAssignExistingOpen(false)}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Master Assigned Crew Data Table */}
          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (crewSortField === 'id') setCrewSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setCrewSortField('id'); setCrewSortDirection('asc'); }
                    }}
                  >
                    Crew ID {renderSortIndicator(crewSortField, 'id', crewSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (crewSortField === 'fullName') {
                        setCrewSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setCrewSortField('fullName');
                        setCrewSortDirection('asc');
                      }
                    }}
                  >
                    Full Name &amp; Rank {renderSortIndicator(crewSortField, 'fullName', crewSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (crewSortField === 'nationality') setCrewSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setCrewSortField('nationality'); setCrewSortDirection('asc'); }
                    }}
                  >
                    Nationality &amp; Seaman Book {renderSortIndicator(crewSortField, 'nationality', crewSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (crewSortField === 'assignmentStatus') setCrewSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setCrewSortField('assignmentStatus'); setCrewSortDirection('asc'); }
                    }}
                  >
                    Assignment Status {renderSortIndicator(crewSortField, 'assignmentStatus', crewSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (crewSortField === 'overallComplianceScore') {
                        setCrewSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setCrewSortField('overallComplianceScore');
                        setCrewSortDirection('asc');
                      }
                    }}
                  >
                    STCW Score {renderSortIndicator(crewSortField, 'overallComplianceScore', crewSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (crewSortField === 'complianceStatus') {
                        setCrewSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      } else {
                        setCrewSortField('complianceStatus');
                        setCrewSortDirection('asc');
                      }
                    }}
                  >
                    Compliance Status {renderSortIndicator(crewSortField, 'complianceStatus', crewSortDirection)}
                  </th>
                  <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCrew.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      {linkedCrew.length === 0
                        ? 'No crew members currently registered for this vessel.'
                        : 'No crew members match the search and filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredCrew.map((c) => (
                    <tr key={c.id}>
                      <td className="font-mono-code small text-dark fw-semibold">{c.id}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-primary text-start fw-semibold text-decoration-underline border-0 bg-transparent align-baseline"
                          onClick={() => setCurrentHashView('crew', c.id)}
                          title={`View ${c.fullName} STCW seafarer dossier`}
                        >
                          {c.fullName}
                        </button>
                        <div className="small text-secondary">{c.rank}</div>
                      </td>
                      <td>
                        <div className="small fw-semibold">{c.nationality}</div>
                        <div className="font-mono-code text-muted" style={{ fontSize: '0.75rem' }}>{c.seamansBookNo}</div>
                      </td>
                      <td>
                        <span className={`badge ${c.currentVesselId === vessel.id ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                          {c.currentVesselId === vessel.id ? 'Current Assignment' : 'Historical Assignment'}
                        </span>
                      </td>
                      <td className="font-mono-code fw-semibold">{c.overallComplianceScore}%</td>
                      <td>
                        <span className={`badge ${c.complianceStatus === 'Fully Compliant' ? 'bg-success text-white' : c.complianceStatus === 'Expiring < 60 Days' ? 'bg-warning text-dark' : 'bg-danger text-white'}`}>
                          {c.complianceStatus}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-2">
                          {c.currentVesselId === vessel.id ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-1 px-2"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => {
                                assignCrewToVessel(c.id, undefined);
                                setToastMessage(`Unassigned ${c.fullName} from ${vessel.name}`);
                              }}
                            >
                              Unassign
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success py-1 px-2"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => {
                                assignCrewToVessel(c.id, vessel.id);
                                setToastMessage(`Reassigned ${c.fullName} to ${vessel.name}`);
                              }}
                            >
                              Make Current
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-1 px-2"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => setCurrentHashView('crew', c.id)}
                          >
                            View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Audit Trail */}
      {activeTab === 'audit' && isAdmin && isOwned && (
        <div className="card map-card-custom">
          {/* Table Controls Header */}
          <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="Search Action, User, Org, Notes..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                style={{ width: '250px' }}
              />

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                style={{ width: '180px' }}
              >
                <option value="ALL">All Action Types</option>
                {auditActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>

              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={auditSortField}
                onChange={(e) => setAuditSortField(e.target.value as any)}
                style={{ width: '170px' }}
              >
                <option value="timestampUtc">Sort: Timestamp</option>
                <option value="action">Sort: Action</option>
                <option value="userId">Sort: User ID</option>
                <option value="organization">Sort: Organization</option>
                <option value="justificationNotes">Sort: Justification</option>
              </select>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark"
                onClick={() => setAuditSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'))}
                title={`Sort direction: ${auditSortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {auditSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (auditSortField === 'timestampUtc') setAuditSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setAuditSortField('timestampUtc'); setAuditSortDirection('desc'); }
                    }}
                  >
                    Timestamp (UTC) {renderSortIndicator(auditSortField, 'timestampUtc', auditSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (auditSortField === 'action') setAuditSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setAuditSortField('action'); setAuditSortDirection('asc'); }
                    }}
                  >
                    Action {renderSortIndicator(auditSortField, 'action', auditSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (auditSortField === 'userId') setAuditSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setAuditSortField('userId'); setAuditSortDirection('asc'); }
                    }}
                  >
                    User &amp; Role {renderSortIndicator(auditSortField, 'userId', auditSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (auditSortField === 'organization') setAuditSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setAuditSortField('organization'); setAuditSortDirection('asc'); }
                    }}
                  >
                    Organization {renderSortIndicator(auditSortField, 'organization', auditSortDirection)}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      if (auditSortField === 'justificationNotes') setAuditSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                      else { setAuditSortField('justificationNotes'); setAuditSortDirection('asc'); }
                    }}
                  >
                    Justification &amp; Details {renderSortIndicator(auditSortField, 'justificationNotes', auditSortDirection)}
                  </th>
                  <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No tamper-evident audit entries match the search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map((event) => (
                    <tr key={event.id}>
                      <td className="font-mono-code small text-muted" style={{ fontSize: '0.75rem' }}>
                        {new Date(event.timestampUtc).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code">
                          {event.action}
                        </span>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark small">{event.userId}</div>
                        <span className="badge bg-light text-secondary border" style={{ fontSize: '0.7rem' }}>
                          {event.userRole}
                        </span>
                      </td>
                      <td className="small text-secondary">{event.organization}</td>
                      <td className="small text-dark font-mono-code">{event.justificationNotes}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary py-1 px-2"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => setSelectedAuditForDetail(event)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Physical Inspections & CAPA Tracker */}
      {
        activeTab === 'inspections' && (
          <div className="d-flex flex-column gap-4">
            {/* Section 1: Physical Inspection Reports Table */}
            <div className="card map-card-custom">
              <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <input
                    type="text"
                    className="form-control form-control-sm bg-white text-dark border-secondary"
                    placeholder="Search Inspection ID, Title, Inspector..."
                    value={inspectionSearch}
                    onChange={(e) => setInspectionSearch(e.target.value)}
                    style={{ width: '250px' }}
                  />

                  <select
                    className="form-select form-select-sm bg-white text-dark border-secondary"
                    value={inspectionStatusFilter}
                    onChange={(e) => setInspectionStatusFilter(e.target.value)}
                    style={{ width: '160px' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Completed">Completed</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                  </select>

                </div>

                {activePersona !== 'C Admin' && (
                  <div className="d-flex align-items-center gap-2 ms-auto">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary fw-semibold d-flex align-items-center gap-1.5"
                      onClick={() => setShowInspectionDrawer(true)}
                    >
                      <Plus className="w-4 h-4" />
                      New Live Inspection Checklist
                    </button>
                  </div>
                )}
              </div>

              <div className="table-responsive">
                <table className="table map-table-custom align-middle mb-0">
                  <thead>
                    <tr>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (inspectionSortField === 'id') setInspectionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setInspectionSortField('id'); setInspectionSortDirection('asc'); }
                        }}
                      >
                        Inspection Campaign {renderSortIndicator(inspectionSortField, 'id', inspectionSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (inspectionSortField === 'assuranceSetId') setInspectionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setInspectionSortField('assuranceSetId'); setInspectionSortDirection('asc'); }
                        }}
                      >
                        Assigned Assurance Set {renderSortIndicator(inspectionSortField, 'assuranceSetId', inspectionSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (inspectionSortField === 'inspector') setInspectionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setInspectionSortField('inspector'); setInspectionSortDirection('asc'); }
                        }}
                      >
                        Assigned Inspector {renderSortIndicator(inspectionSortField, 'inspector', inspectionSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (inspectionSortField === 'date') setInspectionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setInspectionSortField('date'); setInspectionSortDirection('asc'); }
                        }}
                      >
                        Date &amp; Location {renderSortIndicator(inspectionSortField, 'date', inspectionSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (inspectionSortField === 'status') setInspectionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setInspectionSortField('status'); setInspectionSortDirection('asc'); }
                        }}
                      >
                        Status {renderSortIndicator(inspectionSortField, 'status', inspectionSortDirection)}
                      </th>
                      <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInspections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          No physical inspection records match the search and filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredInspections.map((insp) => (
                        <tr
                          key={insp.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedInspectionForDetail(insp)}
                        >
                          <td>
                            <button
                              type="button"
                              className="btn btn-link p-0 text-primary fw-bold text-decoration-underline border-0 bg-transparent text-start font-mono-code"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInspectionForDetail(insp);
                              }}
                            >
                              {insp.id}
                            </button>
                            <div className="small fw-semibold text-dark mt-0.5">{insp.title}</div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-link p-0 font-mono-code text-primary fw-semibold text-decoration-underline border-0 bg-transparent text-start"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentHashView('assurance-sets', insp.assuranceSetId);
                              }}
                              title="Open assigned Assurance Set"
                            >
                              {insp.assuranceSetId}
                            </button>
                          </td>
                          <td>
                            <div className="fw-semibold text-dark small">{insp.inspector}</div>
                            <div className="text-secondary font-mono-code" style={{ fontSize: '0.725rem' }}>{insp.inspectorRole}</div>
                          </td>
                          <td>
                            <div className="font-mono-code small text-dark fw-semibold">{insp.date}</div>
                            <div className="text-secondary small">{insp.location}</div>
                          </td>
                          <td>
                            <span className={`badge ${insp.status === 'Completed' ? 'bg-success text-white' : 'bg-primary text-white'} font-mono-code`}>
                              {insp.status}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1.5">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary py-1 px-2 fw-semibold"
                                style={{ fontSize: '0.75rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInspectionForDetail(insp);
                                }}
                              >
                                View Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }

      {/* Inline CAPA Re-Inspection Drawer Overlay for Physical Inspections Page */}
      {
        selectedCapaForDrawer && (
          <CapaReinspectionDrawer
            capa={selectedCapaForDrawer}
            onClose={() => setSelectedCapaForDrawer(null)}
          />
        )
      }

      {/* Register New Crew Member Modal for vessel admin */}
      {
        isAddCrewModalOpen && vessel && (
          <AddCrewModal
            isOpen={isAddCrewModalOpen}
            onClose={() => setIsAddCrewModalOpen(false)}
            initialVesselId={vessel.id}
            onViewCrewDetail={(crewId) => setCurrentHashView('crew', crewId)}
          />
        )
      }

      {/* Physical Inspection Table Detail Page Modal */}
      {
        selectedInspectionForDetail && (
          <div
            className="modal show d-block map-modal-backdrop"
            tabIndex={-1}
            style={{ zIndex: 1060 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedInspectionForDetail(null);
            }}
          >
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content bg-white text-dark border shadow-lg">
                {/* Header */}
                <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-primary text-white font-mono-code">{selectedInspectionForDetail.id}</span>
                      <h5 className="modal-title fw-bold text-dark m-0">
                        {selectedInspectionForDetail.title}
                      </h5>
                    </div>
                    <div className="text-secondary small mt-0.5">
                      Physical Vetting Inspection &amp; Audit Log Dossier — {vessel.name} (IMO {vessel.imoNumber})
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedInspectionForDetail(null)}
                    aria-label="Close"
                  />
                </div>

                {/* Body */}
                <div className="modal-body p-4 overflow-y-auto" style={{ maxHeight: '72vh' }}>
                  {/* Key Metadata Cards */}
                  <div className="row g-3 mb-4">
                    <div className="col-md-3">
                      <div className="p-3 bg-light border rounded h-100">
                        <div className="text-secondary small text-uppercase fw-semibold mb-1">Target Vessel</div>
                        <div className="fw-bold text-primary">{vessel.name}</div>
                        <div className="font-mono-code small text-muted">IMO: {vessel.imoNumber}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 bg-light border rounded h-100">
                        <div className="text-secondary small text-uppercase fw-semibold mb-1">Assigned Inspector</div>
                        <div className="fw-bold text-dark">{selectedInspectionForDetail.inspector}</div>
                        <div className="text-secondary small">{selectedInspectionForDetail.inspectorRole}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 bg-light border rounded h-100">
                        <div className="text-secondary small text-uppercase fw-semibold mb-1">Date &amp; Location</div>
                        <div className="fw-bold font-mono-code text-dark">{selectedInspectionForDetail.date}</div>
                        <div className="text-secondary small">{selectedInspectionForDetail.location}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 bg-light border rounded h-100">
                        <div className="text-secondary small text-uppercase fw-semibold mb-1">Assigned Assurance Set</div>
                        <button
                          type="button"
                          className="btn btn-link p-0 fw-bold text-primary font-mono-code text-decoration-underline text-start"
                          onClick={() => {
                            const setCode = selectedInspectionForDetail.assuranceSetId;
                            setSelectedInspectionForDetail(null);
                            setCurrentHashView('assurance-sets', setCode);
                          }}
                          title="Open assigned Assurance Set"
                        >
                          {selectedInspectionForDetail.assuranceSetId}
                        </button>
                        <div className="small text-secondary text-truncate" title={selectedInspectionForDetail.assuranceSetTitle}>
                          {selectedInspectionForDetail.assuranceSetTitle || 'Standard Vetting Audit'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit Findings Summary Bar */}
                  <div className="p-3 bg-primary-subtle border border-primary-subtle rounded mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-primary small">Audit Findings Summary:</span>
                      <span className="badge bg-success text-white font-mono-code">{selectedInspectionForDetail.findingsSummary.satisfactory} Satisfactory</span>
                      <span className="badge bg-info text-white font-mono-code">{selectedInspectionForDetail.findingsSummary.observations} Observations</span>
                      <span className="badge bg-danger text-white font-mono-code">{selectedInspectionForDetail.findingsSummary.deficiencies} Deficiencies</span>
                    </div>
                  </div>

                  {/* Physical Checklist Breakdown Table */}
                  <div className="mb-4">
                    <h6 className="fw-bold text-dark mb-2">Physical Survey Checklist Items &amp; Observations</h6>
                    <div className="table-responsive border rounded">
                      <table className="table map-table-custom align-middle mb-0">
                        <thead>
                          <tr>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalChecklistSortField === 'id') setModalChecklistSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalChecklistSortField('id'); setModalChecklistSortDirection('asc'); }
                              }}
                            >
                              Item ID {renderSortIndicator(modalChecklistSortField, 'id', modalChecklistSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalChecklistSortField === 'category') setModalChecklistSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalChecklistSortField('category'); setModalChecklistSortDirection('asc'); }
                              }}
                            >
                              Category &amp; Standard Ref {renderSortIndicator(modalChecklistSortField, 'category', modalChecklistSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalChecklistSortField === 'status') setModalChecklistSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalChecklistSortField('status'); setModalChecklistSortDirection('asc'); }
                              }}
                            >
                              Finding Status {renderSortIndicator(modalChecklistSortField, 'status', modalChecklistSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalChecklistSortField === 'notes') setModalChecklistSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalChecklistSortField('notes'); setModalChecklistSortDirection('asc'); }
                              }}
                            >
                              Inspector Findings &amp; Observations {renderSortIndicator(modalChecklistSortField, 'notes', modalChecklistSortDirection)}
                            </th>
                            <th style={{ whiteSpace: 'nowrap' }}>Evidence Files</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedModalChecklists.map((chk: any) => (
                            <tr key={chk.id}>
                              <td className="font-mono-code fw-semibold text-dark">{chk.id}</td>
                              <td>
                                <div className="fw-semibold text-dark small">{chk.category}</div>
                                <div className="text-secondary font-mono-code" style={{ fontSize: '0.725rem' }}>{chk.ref}</div>
                              </td>
                              <td>
                                <span className={`badge ${chk.status === 'Satisfactory' ? 'bg-success text-white' : chk.status === 'Observation' ? 'bg-warning text-dark' : 'bg-danger text-white'} font-mono-code`}>
                                  {chk.status}
                                </span>
                              </td>
                              <td className="small text-dark">
                                {chk.notes}
                                {chk.capaId && (
                                  <div className="mt-1">
                                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle font-mono-code" style={{ fontSize: '0.7rem' }}>
                                      {chk.capaId} Action Item Active
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="d-flex flex-wrap gap-1">
                                  {chk.evidence.map((ev: string) => (
                                    <span key={ev} className="badge bg-light text-secondary border font-mono-code" style={{ fontSize: '0.7rem' }}>
                                      {ev}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Linked Corrective Actions (CAPA) Section */}
                  <div className="mb-4">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="fw-bold text-dark m-0">Corrective &amp; Preventive Actions (CAPA)</h6>
                      <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle font-mono-code">
                        {linkedCapas.length} CAPA Item{linkedCapas.length !== 1 ? 's' : ''} Linked
                      </span>
                    </div>
                    <div className="table-responsive border rounded">
                      <table className="table map-table-custom align-middle mb-0">
                        <thead>
                          <tr>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalCapaSortField === 'id') setModalCapaSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalCapaSortField('id'); setModalCapaSortDirection('asc'); }
                              }}
                            >
                              CAPA ID {renderSortIndicator(modalCapaSortField, 'id', modalCapaSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalCapaSortField === 'title') setModalCapaSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalCapaSortField('title'); setModalCapaSortDirection('asc'); }
                              }}
                            >
                              Title &amp; Finding {renderSortIndicator(modalCapaSortField, 'title', modalCapaSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalCapaSortField === 'owner') setModalCapaSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalCapaSortField('owner'); setModalCapaSortDirection('asc'); }
                              }}
                            >
                              Owner / Dept {renderSortIndicator(modalCapaSortField, 'owner', modalCapaSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalCapaSortField === 'dueDate') setModalCapaSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalCapaSortField('dueDate'); setModalCapaSortDirection('asc'); }
                              }}
                            >
                              Due Date {renderSortIndicator(modalCapaSortField, 'dueDate', modalCapaSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalCapaSortField === 'status') setModalCapaSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalCapaSortField('status'); setModalCapaSortDirection('asc'); }
                              }}
                            >
                              Status {renderSortIndicator(modalCapaSortField, 'status', modalCapaSortDirection)}
                            </th>
                            <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedModalCapas.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-3 text-muted small">
                                No corrective actions raised for this inspection campaign.
                              </td>
                            </tr>
                          ) : (
                            sortedModalCapas.map((capa) => (
                              <tr key={capa.id}>
                                <td className="font-mono-code fw-semibold text-warning-emphasis">{capa.id}</td>
                                <td>
                                  <div className="fw-semibold text-dark small">{capa.title}</div>
                                  <div className="text-secondary" style={{ fontSize: '0.75rem' }}>{capa.findingDescription}</div>
                                </td>
                                <td className="small">{capa.owner}</td>
                                <td className="font-mono-code small">{capa.dueDate}</td>
                                <td>
                                  <span className={`badge ${capa.status === 'Verified & Closed' ? 'bg-success text-white' : capa.status === 'Under Re-Inspection' ? 'bg-warning text-dark' : 'bg-danger text-white'} font-mono-code`}>
                                    {capa.status}
                                  </span>
                                </td>
                                <td className="text-end">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary py-1 px-2"
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={() => setSelectedCapaForDrawer(capa)}
                                  >
                                    View / Re-inspect
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Inspection Campaign Event Log */}
                  <div>
                    <h6 className="fw-bold text-dark mb-2">Inspection Campaign Activity Log</h6>
                    <div className="border rounded bg-light p-3">
                      <div className="d-flex flex-column gap-2">
                        {selectedInspectionForDetail.auditTrail.map((log: any, i: number) => (
                          <div key={i} className="d-flex align-items-center justify-content-between p-2 bg-white border rounded small">
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge bg-primary-subtle text-primary font-mono-code" style={{ fontSize: '0.7rem' }}>{log.action}</span>
                              <strong className="text-dark">{log.user}:</strong>
                              <span className="text-secondary">{log.notes}</span>
                            </div>
                            <span className="font-mono-code text-muted" style={{ fontSize: '0.725rem' }}>{log.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="modal-footer border-top bg-light d-flex justify-between">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setSelectedInspectionForDetail(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary fw-semibold d-flex align-items-center gap-1.5"
                    onClick={() => {
                      setSelectedInspectionForDetail(null);
                      setShowInspectionDrawer(true);
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Audit Log Table Detail Page Modal */}
      {
        selectedAuditForDetail && (
          <div
            className="modal show d-block map-modal-backdrop"
            tabIndex={-1}
            style={{ zIndex: 1060 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedAuditForDetail(null);
            }}
          >
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content bg-white text-dark border shadow-lg">
                {/* Header */}
                <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-primary text-white font-mono-code">{selectedAuditForDetail.id}</span>
                      <h5 className="modal-title fw-bold text-dark m-0">
                        Audit Event Log Detail
                      </h5>
                    </div>
                    <div className="text-secondary small mt-0.5">
                      Tamper-evident cryptographically verified audit log entry
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedAuditForDetail(null)}
                    aria-label="Close"
                  />
                </div>

                {/* Body */}
                <div className="modal-body p-4">
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <div className="p-3 bg-light border rounded">
                        <span className="text-secondary small d-block">Timestamp (UTC):</span>
                        <strong className="font-mono-code text-dark d-block mt-0.5">
                          {new Date(selectedAuditForDetail.timestampUtc).toUTCString()}
                        </strong>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 bg-light border rounded">
                        <span className="text-secondary small d-block">Action Type:</span>
                        <span className="badge bg-primary text-white font-mono-code mt-1" style={{ fontSize: '0.85rem' }}>
                          {selectedAuditForDetail.action}
                        </span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 bg-light border rounded">
                        <span className="text-secondary small d-block">User &amp; Role:</span>
                        <strong className="text-dark d-block mt-0.5">{selectedAuditForDetail.userId}</strong>
                        <span className="badge bg-secondary text-white font-mono-code mt-1">{selectedAuditForDetail.userRole}</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 bg-light border rounded">
                        <span className="text-secondary small d-block">Organization:</span>
                        <strong className="text-dark d-block mt-0.5">{selectedAuditForDetail.organization}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-light border rounded mb-3">
                    <span className="text-secondary small d-block fw-semibold mb-1">Target Asset / Vessel:</span>
                    <div className="font-mono-code text-primary fw-bold">{selectedAuditForDetail.targetAsset}</div>
                  </div>

                  <div className="p-3 bg-light border rounded mb-3">
                    <span className="text-secondary small d-block fw-semibold mb-1">Justification Notes &amp; Payload Diffs:</span>
                    <div className="font-mono-code bg-white p-2.5 border rounded text-dark small" style={{ lineHeight: '1.4' }}>
                      {selectedAuditForDetail.justificationNotes || 'No additional notes recorded for this action.'}
                    </div>
                  </div>

                  <div className="p-2.5 bg-success-subtle border border-success-subtle rounded d-flex align-items-center justify-content-between font-mono-code small text-success">
                    <span>CRYPTO HASH VERIFICATION: SHA256-MATCH</span>
                    <span className="fw-bold">TAMPER-EVIDENT VERIFIED</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="modal-footer border-top bg-light">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setSelectedAuditForDetail(null)}
                  >
                    Close Detail Modal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Live Interactive Inspection Drawer Workspace */}
      {showInspectionDrawer && vessel && (
        <InspectionDrawer
          vesselName={vessel.name}
          onClose={() => setShowInspectionDrawer(false)}
        />
      )}

      {/* Pre-Assurance Vault Upload Document Modal */}
      {isUploadModalOpen && vessel && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          defaultVesselId={vessel.id}
          modalTitle="Upload Preassurance Document"
          onUploadComplete={() => {
            setIsUploadModalOpen(false);
            setToastMessage('Preassurance document uploaded & indexed in vault.');
            setTimeout(() => setToastMessage(null), 3500);
          }}
        />
      )}

      {/* Historical Voyage Data Modal */}
      {showVoyageHistoryModal && vessel && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1060 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVoyageHistoryModal(false);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary text-white font-mono-code">AIS-TRANSIT</span>
                    <h5 className="modal-title fw-bold text-dark m-0">Historical Voyage Logs</h5>
                  </div>
                  <div className="text-secondary small mt-0.5">
                    {vessel.name} (IMO {vessel.imoNumber}) — Real-time &amp; archived AIS voyage history
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowVoyageHistoryModal(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body p-4">
                <div className="table-responsive border rounded mb-3">
                  <table className="table map-table-custom align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Voyage Ref</th>
                        <th>Origin &rarr; Destination</th>
                        <th>Departure (UTC)</th>
                        <th>Arrival (UTC)</th>
                        <th>Distance / Speed</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-mono-code fw-semibold text-primary">VOY-2026-09-A</td>
                        <td className="small">
                          <strong>{vessel.portOfRegistry || 'Fremantle, WA'}</strong> &rarr; {vessel.tradingArea || 'Dampier Port, WA'}
                        </td>
                        <td className="font-mono-code small">2026-09-20 08:00</td>
                        <td className="font-mono-code small">2026-09-23 16:30</td>
                        <td className="font-mono-code small">820 NM / 14.2 kn</td>
                        <td><span className="badge bg-success text-white">Completed</span></td>
                      </tr>
                      <tr>
                        <td className="font-mono-code fw-semibold text-primary">VOY-2026-08-B</td>
                        <td className="small">
                          <strong>Dampier Port, WA</strong> &rarr; NWS Offshore Platform Alpha
                        </td>
                        <td className="font-mono-code small">2026-08-14 06:15</td>
                        <td className="font-mono-code small">2026-08-15 11:45</td>
                        <td className="font-mono-code small">180 NM / 12.8 kn</td>
                        <td><span className="badge bg-success text-white">Completed</span></td>
                      </tr>
                      <tr>
                        <td className="font-mono-code fw-semibold text-primary">VOY-2026-07-C</td>
                        <td className="small">
                          <strong>Singapore Jurong</strong> &rarr; Fremantle Outer Anchorage
                        </td>
                        <td className="font-mono-code small">2026-07-02 10:00</td>
                        <td className="font-mono-code small">2026-07-09 18:20</td>
                        <td className="font-mono-code small">2,150 NM / 14.5 kn</td>
                        <td><span className="badge bg-success text-white">Completed</span></td>
                      </tr>
                      <tr>
                        <td className="font-mono-code fw-semibold text-primary">VOY-2026-06-D</td>
                        <td className="small">
                          <strong>Darwin Port, NT</strong> &rarr; Ichthys LNG Field
                        </td>
                        <td className="font-mono-code small">2026-06-11 12:00</td>
                        <td className="font-mono-code small">2026-06-12 19:30</td>
                        <td className="font-mono-code small">240 NM / 13.0 kn</td>
                        <td><span className="badge bg-success text-white">Completed</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="p-2.5 bg-light border rounded text-secondary small d-flex align-items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>AIS telemetry streams are validated against satellite transponder archives with sub-meter positioning accuracy.</span>
                </div>
              </div>
              <div className="modal-footer border-top bg-light">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowVoyageHistoryModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Company Fleet Registry Modal */}
      {selectedCompanyForFleetModal && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1060 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCompanyForFleetModal(null);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary text-white font-mono-code">FLEET REGISTRY</span>
                    <h5 className="modal-title fw-bold text-dark m-0">{selectedCompanyForFleetModal}</h5>
                  </div>
                  <div className="text-secondary small mt-0.5">
                    Associated vessels and commercial assets managed by this organization
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedCompanyForFleetModal(null)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body p-4">
                <div className="table-responsive border rounded">
                  <table className="table map-table-custom align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Vessel Name &amp; IMO</th>
                        <th>Vessel Type</th>
                        <th>Flag State</th>
                        <th>Operating Status</th>
                        <th>Readiness</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vessels
                        .filter(
                          (v) =>
                            v.registeredOwner.toLowerCase().includes(selectedCompanyForFleetModal.toLowerCase()) ||
                            (v.technicalManager && v.technicalManager.toLowerCase().includes(selectedCompanyForFleetModal.toLowerCase())) ||
                            (v.ismCompany && v.ismCompany.toLowerCase().includes(selectedCompanyForFleetModal.toLowerCase()))
                        )
                        .map((v) => (
                          <tr key={v.id}>
                            <td>
                              <div className="fw-semibold text-primary">{v.name}</div>
                              <div className="font-mono-code text-muted" style={{ fontSize: '0.75rem' }}>IMO: {v.imoNumber}</div>
                            </td>
                            <td className="small">{v.vesselSubtype || v.vesselType}</td>
                            <td>{v.flagState}</td>
                            <td>
                              <span className={`badge ${getVesselStatusBadgeClass(v.status)}`}>{v.status}</span>
                            </td>
                            <td>
                              <ReadinessGauge score={calculateVesselReadiness(v, assuranceSets, documents)} size="sm" />
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary py-1 px-2"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => {
                                  setSelectedCompanyForFleetModal(null);
                                  setCurrentHashView('vessels', v.id);
                                }}
                              >
                                View Dossier
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer border-top bg-light">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSelectedCompanyForFleetModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Document Data Inspector Modal */}
      {selectedVaultCertForModal && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1060 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedVaultCertForModal(null);
          }}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              {/* Header */}
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div className="min-w-0 pe-2">
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                    <span className="map-ocr-badge">{selectedVaultCertForModal.ocr}</span>
                    <span className="badge bg-primary text-white font-mono-code">{selectedVaultCertForModal.docId || selectedVaultCertForModal.id}</span>
                  </div>
                  <h5 className="modal-title fw-bold text-dark m-0 text-truncate" title={selectedVaultCertForModal.name}>
                    {selectedVaultCertForModal.name}
                  </h5>
                  <div className="text-secondary small mt-0.5 font-mono-code">
                    Certificate Number: <span className="fw-semibold text-dark">{selectedVaultCertForModal.number}</span> · Asset: <span className="fw-semibold text-dark">{vessel.name} (IMO {vessel.imoNumber})</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close flex-shrink-0"
                  onClick={() => setSelectedVaultCertForModal(null)}
                  aria-label="Close"
                />
              </div>

              {/* Modal Body: Complete Document Data */}
              <div className="modal-body p-4 overflow-y-auto" style={{ maxHeight: '72vh' }}>
                {/* 1. Core Summary Cards */}
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-3">
                    <div className="p-3 bg-light border rounded h-100">
                      <span className="text-secondary small text-uppercase fw-semibold d-block">Issuing Authority</span>
                      <strong className="text-dark d-block mt-1">{selectedVaultCertForModal.issuingBody}</strong>
                      <span className="text-muted small font-mono-code" style={{ fontSize: '0.72rem' }}>IACS Verified Statutory Authority</span>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="p-3 bg-light border rounded h-100">
                      <span className="text-secondary small text-uppercase fw-semibold d-block">Validity Window</span>
                      <strong className="font-mono-code text-dark d-block mt-1">
                        {formatMaritimeDate(selectedVaultCertForModal.expiryDate)}
                      </strong>
                      <span className={`badge ${selectedVaultCertForModal.status === 'EXPIRED' ? 'bg-danger' : selectedVaultCertForModal.status.includes('Expiring') ? 'bg-warning text-dark' : 'bg-success'} text-white mt-1 font-mono-code`} style={{ fontSize: '0.72rem' }}>
                        {selectedVaultCertForModal.status}
                      </span>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="p-3 bg-light border rounded h-100">
                      <span className="text-secondary small text-uppercase fw-semibold d-block">File &amp; Version</span>
                      <strong className="text-dark font-mono-code d-block mt-1 text-truncate" title={selectedVaultCertForModal.fileName}>
                        {selectedVaultCertForModal.fileName}
                      </strong>
                      <span className="text-muted small font-mono-code" style={{ fontSize: '0.72rem' }}>
                        {selectedVaultCertForModal.version} · {selectedVaultCertForModal.fileSize}
                      </span>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="p-3 bg-light border rounded h-100">
                      <span className="text-secondary small text-uppercase fw-semibold d-block">Uploader &amp; Audit</span>
                      <strong className="text-dark d-block mt-1 text-truncate">{selectedVaultCertForModal.uploadedBy}</strong>
                      <span className="text-muted small font-mono-code" style={{ fontSize: '0.72rem' }}>
                        {formatMaritimeDate(selectedVaultCertForModal.uploadedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Extracted Technical Data Attributes Table */}
                <div className="mb-4">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="fw-bold text-dark m-0 d-flex align-items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Extracted Document Data &amp; Vessel Specifications
                    </h6>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code">
                      13 Attributes Extracted
                    </span>
                  </div>

                  <div className="map-datasheet-grid border rounded p-2 bg-light">
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Vessel AIS Name</span>
                      <span className="map-datasheet-val fw-bold text-dark">{selectedVaultCertForModal.extractedAttributes?.vesselName || vessel.name}</span>
                    </div>
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">IMO Number</span>
                      <span className="map-datasheet-val font-mono-code fw-bold text-primary">{selectedVaultCertForModal.extractedAttributes?.imoNumber || vessel.imoNumber}</span>
                    </div>
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Official Reg Number</span>
                      <span className="map-datasheet-val font-mono-code">{selectedVaultCertForModal.extractedAttributes?.officialRegNumber || vessel.officialRegNumber || 'OSV-44-2019'}</span>
                    </div>

                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Flag State &amp; Port</span>
                      <span className="map-datasheet-val">{selectedVaultCertForModal.extractedAttributes?.flagState || vessel.flagState} ({selectedVaultCertForModal.extractedAttributes?.portOfRegistry || vessel.portOfRegistry})</span>
                    </div>
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Call Sign / MMSI</span>
                      <span className="map-datasheet-val font-mono-code">{selectedVaultCertForModal.extractedAttributes?.callSign || vessel.callSign} / {selectedVaultCertForModal.extractedAttributes?.mmsiNumber || vessel.mmsiNumber}</span>
                    </div>
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Vessel Classification</span>
                      <span className="map-datasheet-val">{selectedVaultCertForModal.extractedAttributes?.classificationSociety || vessel.classificationSociety}</span>
                    </div>

                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Class Notation</span>
                      <span className="map-datasheet-val">{selectedVaultCertForModal.extractedAttributes?.classNotation || vessel.classNotation}</span>
                    </div>
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Hull Type</span>
                      <span className="map-datasheet-val">{selectedVaultCertForModal.extractedAttributes?.hullType || vessel.hullType}</span>
                    </div>
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Year Built &amp; Shipyard</span>
                      <span className="map-datasheet-val">{selectedVaultCertForModal.extractedAttributes?.yearBuilt || vessel.yearBuilt} ({selectedVaultCertForModal.extractedAttributes?.shipyardBuilder || vessel.shipyardBuilder})</span>
                    </div>

                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Gross Tonnage (GT)</span>
                      <span className="map-datasheet-val font-mono-code">{selectedVaultCertForModal.extractedAttributes?.grossTonnageGT?.toLocaleString() || vessel.grossTonnageGT?.toLocaleString()} GT</span>
                    </div>
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Deadweight (DWT)</span>
                      <span className="map-datasheet-val font-mono-code">{selectedVaultCertForModal.extractedAttributes?.deadweightTonnageDWT?.toLocaleString() || vessel.deadweightTonnageDWT?.toLocaleString()} DWT</span>
                    </div>
                    <div className="map-datasheet-cell bg-white">
                      <span className="map-datasheet-label">Dimensions (LOA x B x D)</span>
                      <span className="map-datasheet-val font-mono-code">{selectedVaultCertForModal.extractedAttributes?.lengthOverallMeters || vessel.lengthOverallMeters}m x {selectedVaultCertForModal.extractedAttributes?.beamMeters || vessel.beamMeters}m x {selectedVaultCertForModal.extractedAttributes?.draftMeters || vessel.draftMeters}m</span>
                    </div>
                  </div>
                </div>

                {/* 3. Automated Validation & Rules Verification */}
                <div className="mb-4">
                  <h6 className="fw-bold text-dark mb-2">Automated Rules &amp; Compliance Validation</h6>
                  <div className="row g-2">
                    <div className="col-12 col-md-4">
                      <div className="p-2.5 bg-light border rounded d-flex align-items-center justify-content-between">
                        <div className="small">
                          <strong className="text-dark d-block">Charter Buffer Rule</strong>
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>&ge; 30 Days Expiry Buffer</span>
                        </div>
                        <span className="badge bg-success text-white font-mono-code">PASSED</span>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="p-2.5 bg-light border rounded d-flex align-items-center justify-content-between">
                        <div className="small">
                          <strong className="text-dark d-block">Asset Match Integrity</strong>
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>IMO &amp; Name 100% Match</span>
                        </div>
                        <span className="badge bg-success text-white font-mono-code">VERIFIED</span>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="p-2.5 bg-light border rounded d-flex align-items-center justify-content-between">
                        <div className="small">
                          <strong className="text-dark d-block">IACS Authority Check</strong>
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>Recognized Organization</span>
                        </div>
                        <span className="badge bg-success text-white font-mono-code">AUTHENTIC</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer border-top bg-light d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSelectedVaultCertForModal(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-semibold d-flex align-items-center gap-1.5"
                  onClick={() => {
                    const docId = selectedVaultCertForModal.docId || selectedVaultCertForModal.id;
                    setSelectedVaultCertForModal(null);
                    setCurrentHashView('documents', docId);
                  }}
                >
                  <span>Open Full Document Workspace</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Vessel Profile Image Manager Modal (Add, Update, or Delete Photo) */}
      {/* ========================================================================= */}
      {showPhotoUploadModal && canManagePhotos && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1060 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPhotoUploadModal(false);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              {/* Header */}
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    <Image className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.05rem' }}>
                      Manage Vessel Profile Image
                    </h5>
                    <div className="text-secondary small font-mono-code">
                      {vessel.name} (IMO {vessel.imoNumber}) · {vessel.vesselSubtype || vessel.vesselType}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPhotoUploadModal(false)}
                  aria-label="Close"
                />
              </div>

              {/* Body */}
              <div className="modal-body p-4">
                {/* 1. Live Cover Preview */}
                <div className="mb-4">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <label className="form-label fw-bold text-dark small mb-0">
                      Active Cover Photo Preview
                    </label>
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-secondary fw-normal font-mono-code" style={{ fontSize: '0.75rem' }}>
                        {photoModalUrl ? (photoModalUrl.startsWith('data:') ? 'Custom Uploaded File' : 'External Stock / Custom URL') : 'Default Category Stock Photo'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded shadow-2xs fw-semibold"
                        onClick={() => {
                          const srcToCrop = photoModalUrl || getVesselStockPhoto(vessel.id, vessel.name, vessel.vesselType, vessel.vesselSubtype);
                          setCropModalImageSrc(srcToCrop);
                          setCropTargetIdx(modalPhotos.indexOf(photoModalUrl) >= 0 ? modalPhotos.indexOf(photoModalUrl) : null);
                          setIsCropModalOpen(true);
                        }}
                        title="Crop and resize active cover photo"
                      >
                        <Crop className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                        <span className="text-white" style={{ fontSize: '0.75rem' }}>Crop</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className="position-relative overflow-hidden rounded-3 shadow-sm border bg-dark d-flex align-items-center justify-content-center mb-3"
                    style={{ width: '100%', aspectRatio: '16 / 9' }}
                  >
                    <img
                      src={getVesselStockPhoto(vessel.id, vessel.name, vessel.vesselType, vessel.vesselSubtype, photoModalUrl || undefined)}
                      alt={vessel.name}
                      className="w-100 h-100"
                      style={{ objectFit: 'cover' }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://plus.unsplash.com/premium_photo-1661880889658-6c3ac991146f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
                      }}
                    />
                    <div
                      className="position-absolute bottom-0 start-0 w-100 p-2 d-flex align-items-center justify-content-between text-white"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}
                    >
                      <span className="small fw-semibold">{vessel.name} (Primary Cover)</span>
                    </div>
                  </div>

                  {/* 2. Attached Photos Gallery (Always visible, even with stock photo) */}
                  <div className="p-3 bg-slate-50 border rounded-3 shadow-2xs">
                    <div className="d-flex align-items-center justify-content-between mb-2.5 flex-wrap gap-2">
                      <div>
                        <span className="small fw-bold text-dark d-block">
                          Vessel Photo Gallery ({modalPhotos.length} image{modalPhotos.length > 1 ? 's' : ''})
                        </span>
                        <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                          Drag photos to reorder · Click any photo to set as primary cover
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1 fw-semibold shadow-2xs"
                        onClick={() => setShowAddPhotoModal(true)}
                        title="Add a new photo to vessel gallery"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                        <span className="text-white">Add Photo</span>
                      </button>
                    </div>

                    <div className="row g-2">
                      {modalPhotos.map((pUrl, pIdx) => {
                        const isCover = photoModalUrl === pUrl;
                        const isDragging = draggedPhotoIdx === pIdx;
                        const isDragOver = dragOverPhotoIdx === pIdx;
                        return (
                          <div key={pIdx} className="col-6 col-sm-4 col-md-3 col-lg-3">
                            <div
                              draggable
                              onDragStart={(e) => {
                                setDraggedPhotoIdx(pIdx);
                                e.dataTransfer.setData('text/plain', pIdx.toString());
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                              }}
                              onDragEnter={() => setDragOverPhotoIdx(pIdx)}
                              onDragEnd={() => {
                                setDraggedPhotoIdx(null);
                                setDragOverPhotoIdx(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedPhotoIdx !== null && draggedPhotoIdx !== pIdx) {
                                  const updated = [...modalPhotos];
                                  const [moved] = updated.splice(draggedPhotoIdx, 1);
                                  updated.splice(pIdx, 0, moved);
                                  setModalPhotos(updated);
                                  if (isCover || draggedPhotoIdx === 0 || pIdx === 0) {
                                    setPhotoModalUrl(updated[0]);
                                  }
                                }
                                setDraggedPhotoIdx(null);
                                setDragOverPhotoIdx(null);
                              }}
                              className={`position-relative p-1 bg-white border rounded-2 overflow-hidden cursor-grab active-cursor-grabbing transition-all ${
                                isCover
                                  ? 'border-primary border-2 shadow-sm ring-2 ring-primary'
                                  : isDragOver
                                  ? 'border-primary border-2 shadow-md ring-2 ring-sky-400 scale-105'
                                  : 'border-secondary-subtle opacity-90 hover-opacity-100 hover:shadow-xs'
                              } ${isDragging ? 'opacity-40 scale-95' : ''}`}
                              onClick={() => setPhotoModalUrl(pUrl)}
                              title={isCover ? 'Active Primary Cover (Drag to reorder)' : 'Click to set as cover · Drag to reorder'}
                            >
                              <div className="position-relative overflow-hidden rounded-1" style={{ width: '100%', aspectRatio: '16 / 9' }}>
                                <img src={pUrl} alt={`Photo ${pIdx + 1}`} className="w-100 h-100 pointer-events-none" style={{ objectFit: 'cover' }} />
                                {isCover && (
                                  <div
                                    className="position-absolute top-0 start-0 bg-primary text-white px-1.5 font-mono-code fw-bold"
                                    style={{ fontSize: '0.55rem', borderBottomRightRadius: '3px' }}
                                  >
                                    Cover
                                  </div>
                                )}
                                
                                {/* Index badge at bottom left */}
                                <div
                                  className="position-absolute bottom-0 start-0 px-1 py-0.5 text-white font-mono-code"
                                  style={{ background: 'rgba(0,0,0,0.65)', fontSize: '0.55rem', borderTopRightRadius: '3px' }}
                                >
                                  #{pIdx + 1}
                                </div>

                                {/* Top-right action buttons with high-contrast white border */}
                                <div className="position-absolute top-0 end-0 d-flex align-items-center gap-1 m-1">
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-primary p-0 d-flex align-items-center justify-content-center rounded-circle border border-white shadow-sm"
                                    style={{ width: '22px', height: '22px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCropTargetIdx(pIdx);
                                      setCropModalImageSrc(pUrl);
                                      setIsCropModalOpen(true);
                                    }}
                                    title="Crop photo"
                                  >
                                    <Crop className="w-3 h-3 text-white" strokeWidth={2.2} />
                                  </button>
                                  {modalPhotos.length > 1 && (
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-danger p-0 d-flex align-items-center justify-content-center rounded-circle border border-white shadow-sm"
                                      style={{ width: '22px', height: '22px' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = modalPhotos.filter((_, i) => i !== pIdx);
                                        setModalPhotos(updated);
                                        if (isCover) {
                                          setPhotoModalUrl(updated.length > 0 ? updated[0] : '');
                                        }
                                      }}
                                      title="Delete photo"
                                    >
                                      <X className="w-3 h-3 text-white" strokeWidth={2.2} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer with Save, Delete / Reset, and Cancel actions */}
              <div className="modal-footer border-top bg-light d-flex align-items-center justify-content-between p-3">
                <div>
                  {(vessel.imageUrl || modalPhotos.length > 0) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5"
                      onClick={() => {
                        const updated: VesselInformation = {
                          ...vessel,
                          imageUrl: undefined,
                          photos: undefined,
                        };
                        updateVessel(updated);
                        const defaultStock = getVesselStockPhoto(vessel.id, vessel.name, vessel.vesselType, vessel.vesselSubtype);
                        setPhotoModalUrl(defaultStock);
                        setModalPhotos([defaultStock]);
                        setSelectedViewPhotoUrl(defaultStock);
                        setShowPhotoUploadModal(false);
                        setToastMessage(`Profile photos for ${vessel.name} reset to default stock.`);
                        setTimeout(() => setToastMessage(null), 3500);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset to Default Stock</span>
                    </button>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowPhotoUploadModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-1.5"
                    onClick={() => {
                      const finalCover = photoModalUrl.trim() || (modalPhotos.length > 0 ? modalPhotos[0] : '');
                      const updated: VesselInformation = {
                        ...vessel,
                        imageUrl: finalCover || undefined,
                        photos: modalPhotos.length > 0 ? modalPhotos : undefined,
                      };
                      updateVessel(updated);
                      setSelectedViewPhotoUrl(finalCover);
                      setShowPhotoUploadModal(false);
                      setToastMessage(`Photos for ${vessel.name} successfully updated.`);
                      setTimeout(() => setToastMessage(null), 3500);
                    }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Photos ({modalPhotos.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Separate Dedicated Modal / Popup: Add Photo Options */}
      {/* ========================================================================= */}
      {showAddPhotoModal && canManagePhotos && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1065 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddPhotoModal(false);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              {/* Header */}
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.05rem' }}>
                      Add Vessel Photo
                    </h5>
                    <div className="text-secondary small font-mono-code">
                      {vessel.name} · Choose upload, curated stock, or image link
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddPhotoModal(false)}
                  aria-label="Close"
                />
              </div>

              {/* Body */}
              <div className="modal-body p-4">
                {/* Option A: Upload & Crop */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-bold text-dark small">Option A: Upload &amp; Crop New Vessel Image</span>
                    <span className="text-secondary" style={{ fontSize: '0.75rem' }}>JPEG, PNG, WEBP</span>
                  </div>

                  <input
                    type="file"
                    ref={photoFileInputRef}
                    className="d-none"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(reader.result);
                            setIsCropModalOpen(true);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }
                    }}
                  />

                  <div
                    className="border border-dashed border-primary rounded bg-white p-3 text-center cursor-pointer hover-bg-light transition-all d-flex flex-column align-items-center justify-content-center gap-1.5"
                    style={{ borderStyle: 'dashed', borderWidth: '1.5px' }}
                    onClick={() => photoFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = e.dataTransfer.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(reader.result);
                            setIsCropModalOpen(true);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  >
                    <Upload className="w-6 h-6 text-primary" />
                    <span className="small text-dark fw-semibold">
                      Drag &amp; drop vessel image here or <span className="text-primary text-decoration-underline">browse files</span>
                    </span>
                    <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                      Picks image and opens universal 16:9 sizing &amp; crop tool before adding to gallery.
                    </span>
                  </div>
                </div>

                {/* Option B: Curated Stock Presets */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="fw-bold text-dark small mb-2">Option B: Select &amp; Crop from Maritime Fleet Stock Photos</div>
                  <div className="row g-2">
                    {CURATED_VESSEL_PHOTOS.map((p, idx) => (
                      <div key={idx} className="col-6 col-md-3">
                        <div
                          className="position-relative border rounded overflow-hidden cursor-pointer transition-all border-secondary-subtle opacity-90 hover-opacity-100 hover:shadow-xs"
                          style={{ height: '75px' }}
                          onClick={() => {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(p.url);
                            setIsCropModalOpen(true);
                          }}
                          title={`Crop and add ${p.title}`}
                        >
                          <img src={p.url} alt={p.title} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                          <div
                            className="position-absolute bottom-0 start-0 w-100 px-1 py-0.5 text-truncate text-white fw-semibold"
                            style={{ background: 'rgba(0,0,0,0.65)', fontSize: '0.62rem' }}
                          >
                            {p.title}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Option C: Direct Image URL */}
                <div className="p-3 bg-light border rounded shadow-2xs">
                  <label className="form-label fw-bold text-dark small mb-1" htmlFor="custom-vessel-image-url">
                    Option C: Direct Image URL
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      id="custom-vessel-image-url"
                      type="url"
                      className="form-control font-mono-code"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={customPhotoUrl}
                      onChange={(e) => setCustomPhotoUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => {
                        const url = customPhotoUrl.trim();
                        if (url) {
                          setShowAddPhotoModal(false);
                          setCropTargetIdx(null);
                          setCropModalImageSrc(url);
                          setIsCropModalOpen(true);
                          setCustomPhotoUrl('');
                        }
                      }}
                    >
                      Crop &amp; Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer border-top bg-light d-flex justify-content-end p-3">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowAddPhotoModal(false)}
                >
                  Close
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
          vesselName={vessel?.name || 'Vessel'}
          initialPreset="16:9"
          onSave={(croppedUrl) => {
            if (cropTargetIdx !== null && cropTargetIdx >= 0 && cropTargetIdx < modalPhotos.length) {
              const updated = [...modalPhotos];
              const oldUrl = updated[cropTargetIdx];
              updated[cropTargetIdx] = croppedUrl;
              setModalPhotos(updated);
              if (photoModalUrl === oldUrl || !photoModalUrl) {
                setPhotoModalUrl(croppedUrl);
              }
            } else {
              // Adding new photo to gallery: always preserve current cover photo instead of overwriting it!
              setModalPhotos((prev) => {
                if (!prev.includes(croppedUrl)) {
                  return [...prev, croppedUrl];
                }
                return prev;
              });
              if (!photoModalUrl) {
                setPhotoModalUrl(croppedUrl);
              }
            }
            setIsCropModalOpen(false);
            setToastMessage(`Universal image crop applied to ${vessel?.name || 'vessel'} gallery.`);
            setTimeout(() => setToastMessage(null), 3500);
          }}
          onClose={() => setIsCropModalOpen(false)}
        />
      )}

      {vessel && (
        <AddToProjectModal
          isOpen={showAddToProjectModal}
          onClose={() => setShowAddToProjectModal(false)}
          assetType="Vessel"
          assetId={vessel.id}
          assetName={vessel.name}
          providerOrganization={vessel.registeredOwner}
        />
      )}
    </div>
  );
};
