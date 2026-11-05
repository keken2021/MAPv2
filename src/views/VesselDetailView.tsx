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
import { DetailHeader } from '../components/common/DetailHeader';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { formatMaritimeDate, getDaysUntilExpiry, getStatusDisplayLabel, getVesselStatusBadgeClass } from '../utils/formatters';
import {
  getDemoSessionContext,
  getRoleDisplayLabel,
  getSessionUserForPersona,
  pickSessionUserForOrgPersona,
} from '../utils/userRoleHelpers';
import { filterCAdminAvailableToCharter, filterVesselAdminAvailableToCharter, filterVesselsForPersona, getBackButtonInfo, getClientAdminOrganization, isVesselOwnedByClientOrg } from '../utils/rbacHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { calculateVesselReadiness, isVesselAssuranceApproved, isVesselStatusPermitted } from '../utils/readinessHelpers';
import { CapaReinspectionDrawer } from '../components/drawers/CapaReinspectionDrawer';
import { InspectionDrawer } from '../components/drawers/InspectionDrawer';
import { AddCrewModal } from '../components/modals/AddCrewModal';
import { CrewTable } from '../components/tables/CrewTable';
import { DocumentTable } from '../components/tables/DocumentTable';
import { AssuranceTable } from '../components/tables/AssuranceTable';
import { AuditTrailTable } from '../components/tables/AuditTrailTable';
import { CapaTable } from '../components/tables/CapaTable';
import { CapaItem } from '../types/capa';
import { getVesselStockPhoto, CURATED_VESSEL_PHOTOS } from '../utils/vesselImageHelpers';
import { VesselImageCropModal } from '../components/modals/VesselImageCropModal';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { AssetStatusCard } from '../components/assets/AssetStatusCard';
import { getVesselAssetStatus } from '../types/asset';
import {
  dimensionLabel,
  formatStatusDuration,
  getCurrentStatusByDimension,
  statusHistoryBadgeClass,
} from '../utils/vesselStatusHistoryHelpers';
import { getPhysicalInspectionsForAssuranceSets } from '../store/inspectionMockData';
import { VesselActivityTab } from '../components/vessels/VesselActivityTab';
import { VesselActivityEntry } from '../utils/vesselActivityHelpers';
import {
  Edit2,
  X,
  Camera,
  Shield,
  FileText,
  Maximize2,
  Settings,
  Building,
  Plus,
  Image,
  Crop,
  Upload,
  Trash2,
  Save,
  Check,
  Eye,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';
import { UniversalDocumentPreviewModal } from '../components/modals/UniversalDocumentPreviewModal';
import { deriveObjectVerification } from '../utils/documentVersionSnapshot';
import { filterDocumentsVisibleToOrganization } from '../utils/rbacHelpers';
import { ObjectVerificationBadge } from '../components/common/ObjectVerificationBadge';
import { organizationContactFields, useOrganizationProfileStore } from '../store/organizationProfileStore';
import {
  ORGANIZATION_FIELD_NOT_RECORDED,
  vesselManagerRoleFromLabel,
} from '../types/organization';

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
    setCreateAssuranceForAsset,
    setCurrentHashView,
    previousHashView,
    previousEntityId,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    users,
    assuranceSets,
    documents,
    vesselStatusHistory,
  } = useMapStore();

  const isAccessible =
    activePersona === 'Administrator' ||
    filterVesselsForPersona(vessels, assuranceSets, activePersona).some((v) => v.id === vesselId);

  const vessel = isAccessible ? vessels.find((v) => v.id === vesselId) : undefined;

  const [activeTab, setActiveTab] = useState<
    'overview' | 'vault' | 'assurance' | 'crew' | 'inspections' | 'history' | 'clients'
  >('overview');

  const linkedCapas = vessel
    ? capaItems.filter((c) => c.vesselId === vessel.id || c.vesselName.toLowerCase() === vessel.name.toLowerCase())
    : [];

  const linkedEquipment = useMemo(
    () => (vessel ? equipment.filter((e) => e.parentVesselId === vessel.id) : []),
    [equipment, vessel],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VesselInformation | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedCapaForDrawer, setSelectedCapaForDrawer] = useState<CapaItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [showGeneralInfo, setShowGeneralInfo] = useState(true);
  const [showDimensionsInfo, setShowDimensionsInfo] = useState(true);
  const [showClassificationInfo, setShowClassificationInfo] = useState(false);
  const [showEngineRoomInfo, setShowEngineRoomInfo] = useState(false);

  /* interactive modals for photo management, company fleet, and certificate details */
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

  /* rbac & ownership: match vessel owner/manager fields to the active demo organization */
  const isAdmin = activePersona === 'Administrator';
  const isSubmitter = activePersona === 'Submitter';
  const isCAdmin = activePersona === 'C Admin';
  const isOwned =
    (isAdmin || isSubmitter || isCAdmin) &&
    Boolean(activeDemoOrganization) &&
    isVesselOwnedByClientOrg(vessel, activeDemoOrganization);
  const isReadOnly = (isCAdmin && !isOwned) || activePersona === 'Inspector' || activePersona === 'Verifier' || activePersona === 'Approver';
  const canEditFull = !isReadOnly && isOwned;
  const canEditStatus = canEditFull || (isSubmitter && isOwned);
  const canShowEditButton = canEditFull || canEditStatus;
  const canUploadDocs = isAdmin || isSubmitter || isOwned;
  const canExport = isAdmin || isCAdmin || isOwned;
  const canManagePhotos = canEditFull;
  const showManagementSection = isCAdmin;

  const getManagerDateOfEffect = useOrganizationProfileStore((s) => s.getManagerDateOfEffect);
  const getManagerDateOfEffectForOrganization = useOrganizationProfileStore(
    (s) => s.getManagerDateOfEffectForOrganization,
  );
  const organizationProfiles = useOrganizationProfileStore((s) => s.profiles);

  const canCreateAssurance = isAdmin || isCAdmin;
  const clientOrg = getClientAdminOrganization(
    users,
    isCAdmin ? activeDemoOrganization : undefined,
  );
  const canCreateAssuranceForThisVessel = Boolean(
    vessel &&
    canCreateAssurance &&
    (isCAdmin
      ? filterCAdminAvailableToCharter([vessel], assuranceSets, clientOrg).length > 0
      : filterVesselAdminAvailableToCharter([vessel]).length > 0),
  );

  /* owning-organization Administrator alone sees Past charters; others stay on Overview */
  useEffect(() => {
    if (activeTab === 'clients' && !(isAdmin && isOwned)) {
      setActiveTab('overview');
    }
  }, [isAdmin, isOwned, activeTab]);

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
      { Category: 'Compliance', Field: 'Readiness (average of all sets)', Value: `${calculateVesselReadiness(vessel, assuranceSets, documents)}%` },
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
      ['Compliance', 'Readiness (average of all sets)', `${calculateVesselReadiness(vessel, assuranceSets, documents)}%`],
    ];

    exportToPdf(`${vessel.name} Datasheet`, headers, rows);
  };

  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ) ?? pickSessionUserForOrgPersona(users, activeDemoOrganization, activePersona),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );
  const currentUserId = sessionUser?.id || activeSessionUserId;


  // Linked assurance sets, documents, crew, and audit items for this vessel
  const linkedSets = vessel ? assuranceSets.filter((s) => s.vesselId === vessel.id) : [];
  const linkedDocs = vessel ? documents.filter((d) => d.vesselId === vessel.id) : [];
  const objectVerification = vessel
    ? deriveObjectVerification(vessel.id, assuranceSets, activeDemoOrganization)
    : null;
  const visibleObjectDocuments = vessel
    ? filterDocumentsVisibleToOrganization(linkedDocs, assuranceSets, activeDemoOrganization)
    : [];

  const handleCreateAssuranceForVessel = (templateSetId?: string) => {
    if (!vessel || !canCreateAssuranceForThisVessel) return;
    setCreateAssuranceForVesselId(vessel.id);
    /* charter hand-off: lock the wizard to vessel scope and this vessel */
    setCreateAssuranceForAsset({ scope: 'Vessel', assetId: vessel.id });
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
          dimensionLabel(entry.dimension).toLowerCase().includes(search) ||
          entry.id.toLowerCase().includes(search);
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

    const seen = new Set<string>();
    const certs: Array<any> = [];

    /* linked Document Library records only — attributes come from the document, never invented here */
    linkedDocs.forEach((doc) => {
      const key = (doc.certificateNo ? doc.certificateNo.trim().toLowerCase() : '') || doc.title.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const daysLeft = getDaysUntilExpiry(doc.expiryDate);
      let statusLabel: string = doc.verificationStatus || doc.complianceState || 'Valid';
      if (daysLeft < 0) statusLabel = 'EXPIRED';
      else if (daysLeft < 90 && statusLabel !== 'EXPIRED') statusLabel = `Expiring in ${daysLeft} days`;

      const score = typeof doc.ocrConfidence === 'number' ? doc.ocrConfidence : undefined;
      const formattedOcr =
        score === undefined ? '—' : score % 1 === 0 ? `OCR: ${score}%` : `OCR: ${score.toFixed(1)}%`;
      const attrs = doc.vesselAttributes;

      certs.push({
        id: doc.id,
        docId: doc.id,
        hasDocument: true,
        name: doc.title,
        number: doc.certificateNo || doc.id,
        issuingBody: doc.issuingAuthority || attrs?.issuingBody || '—',
        issueDate: attrs?.issueDate || '',
        expiryDate: doc.expiryDate,
        ocr: formattedOcr,
        ocrScore: score,
        status: statusLabel,
        rawStatus: doc.verificationStatus || (daysLeft < 0 ? 'EXPIRED' : daysLeft < 90 ? 'Expiring' : 'Valid'),
        entityType: doc.entityType || 'Vessel Certificate',
        version: doc.currentVersion || 'v1.0',
        fileName: doc.versions?.[0]?.fileName || '—',
        fileSize: doc.versions?.[0]?.fileSizeBytes
          ? `${(doc.versions[0].fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
          : '—',
        uploadedBy: doc.versions?.[0]?.uploadedBy || '—',
        uploadedAt: doc.versions?.[0]?.uploadedAt || '',
        extractedAttributes: attrs
          ? {
              vesselName: attrs.vesselName,
              imoNumber: attrs.imoNumber,
              flagState: attrs.flagState,
              certificateNumber: attrs.certificateNumber,
              certType: attrs.certType,
              issuingBody: attrs.issuingBody,
              issueDate: attrs.issueDate,
              expiryDate: attrs.expiryDate,
              lastSurveyDate: attrs.lastSurveyDate,
              placeOfIssue: attrs.placeOfIssue,
              recognisedOrganisation: attrs.recognisedOrganisation,
              grossTonnagePrinted: attrs.grossTonnagePrinted,
            }
          : {},
        validationRules: doc.validationRules,
        rawOcrText: undefined,
      });
    });

    /* statutory summary rows with no matching library document — show No document on file, do not invent a file */
    vessel.statutoryCertificates.forEach((cert) => {
      const key =
        (cert.certificateNumber ? cert.certificateNumber.trim().toLowerCase() : '') ||
        cert.name.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const daysLeft = getDaysUntilExpiry(cert.expiryDate);
      certs.push({
        id: cert.id,
        docId: undefined,
        hasDocument: false,
        name: cert.name,
        number: cert.certificateNumber,
        issuingBody: cert.issuingBody || '—',
        issueDate: cert.issueDate || '',
        expiryDate: cert.expiryDate,
        ocr: '—',
        ocrScore: undefined,
        status: 'No document on file',
        rawStatus: 'No document on file',
        entityType: 'Statutory Vessel Certificate',
        version: '—',
        fileName: '—',
        fileSize: '—',
        uploadedBy: '—',
        uploadedAt: '',
        extractedAttributes: {},
        validationRules: {
          charterBufferPassed: daysLeft > 30,
          assetMatch100Percent: false,
          iacsAuthorityValid: false,
          overallValid: false,
          rulesNotChecked: true,
        },
        rawOcrText: undefined,
      });
    });

    return certs;
  }, [vessel, linkedDocs]);

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

  const filteredClientHistory = useMemo(() => {
    if (!vessel || !vessel.clientHistory) return [];
    return vessel.clientHistory
      .filter((r: VesselClientHistoryRecord) => {
        // Confidentiality shielding: client admins only see charter history of their own organization (gap review R2-E10)
        if (isCAdmin) {
          const userOrg = (clientOrg || '').toLowerCase();
          const recOrg = r.clientOrganization.toLowerCase();
          if (!userOrg || (!recOrg.includes(userOrg) && !userOrg.includes(recOrg))) {
            return false;
          }
        }

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
  }, [vessel, clientSearch, clientOutcomeFilter, clientSortField, clientSortDirection, isCAdmin, clientOrg]);


  /* one Management row per distinct organization across owner / ISM / ship manager fields */
  const managementOrganizations = useMemo(() => {
    if (!vessel) return [] as { organization: string; roles: string[] }[];
    const order: { role: string; value?: string }[] = [
      { role: 'Registered Owner', value: vessel.registeredOwner },
      { role: 'ISM Manager', value: vessel.ismCompany },
      { role: 'Ship Manager', value: vessel.technicalManager },
    ];
    const rows: { organization: string; roles: string[] }[] = [];
    const indexByKey = new Map<string, number>();
    for (const entry of order) {
      const organization = (entry.value || '').trim();
      if (!organization) continue;
      const key = organization.toLowerCase();
      const existing = indexByKey.get(key);
      if (existing === undefined) {
        indexByKey.set(key, rows.length);
        rows.push({ organization, roles: [entry.role] });
      } else if (!rows[existing].roles.includes(entry.role)) {
        rows[existing].roles.push(entry.role);
      }
    }
    return rows;
  }, [vessel]);

  /* inspections come from inspectionMockData for linked sets only — empty when none are recorded */
  const physicalInspections = useMemo(() => {
    if (!vessel) return [];
    return getPhysicalInspectionsForAssuranceSets(linkedSets);
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

  const vaultPagination = usePagination(filteredVaultCerts, [vaultSearch, vaultStatusFilter, vaultSortField, vaultSortDirection]);
  const statusHistoryPagination = usePagination(filteredStatusHistory, [statusHistorySearch, statusHistoryDimensionFilter, statusHistoryCurrentOnly, statusHistorySortField, statusHistorySortDirection]);
  const clientPagination = usePagination(filteredClientHistory, [clientSearch, clientOutcomeFilter, clientSortField, clientSortDirection]);
  const crewPagination = usePagination(filteredCrew, [crewSearch, crewRankFilter, crewComplianceFilter, crewSortField, crewSortDirection]);
  const inspectionPagination = usePagination(filteredInspections, [inspectionSearch, inspectionStatusFilter, inspectionSortField, inspectionSortDirection]);
  const modalChecklistPagination = usePagination(sortedModalChecklists, [selectedInspectionForDetail?.id, modalChecklistSortField, modalChecklistSortDirection]);
  const modalCapaPagination = usePagination(sortedModalCapas, [selectedInspectionForDetail?.id, modalCapaSortField, modalCapaSortDirection]);
  /* vessels owned or managed by the company opened in the fleet modal */
  const companyFleetVessels = selectedCompanyForFleetModal
    ? vessels.filter(
        (v) =>
          v.registeredOwner.toLowerCase().includes(selectedCompanyForFleetModal.toLowerCase()) ||
          (v.technicalManager && v.technicalManager.toLowerCase().includes(selectedCompanyForFleetModal.toLowerCase())) ||
          (v.ismCompany && v.ismCompany.toLowerCase().includes(selectedCompanyForFleetModal.toLowerCase())),
      )
    : [];
  const companyFleetPagination = usePagination(companyFleetVessels, [selectedCompanyForFleetModal]);

  if (!vessel || !isAccessible) {
    return (
      <div className="container-fluid px-4 py-5 text-center">
        <div className="card map-card-custom p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <h4 className="fw-bold text-dark mb-2">No Access</h4>
          <p className="text-secondary small mb-0">
            You cannot view this vessel. Providers can only view vessels their organization owns or manages.
          </p>
        </div>
      </div>
    );
  }

  if (!formData) {
    return <div className="p-4 text-center">Loading vessel...</div>;
  }

  const canEditField = (field: keyof VesselInformation): boolean => {
    if (isReadOnly) return false;
    if (canEditFull) return true;
    if (isSubmitter && field === 'status') return true;
    return false;
  };

  const fieldEditable = (field: keyof VesselInformation) => isEditing && canEditField(field);

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

      <DetailHeader
        title={vessel.name}
        status={isEditing && fieldEditable('status') ? undefined : vessel.status}
        metaItems={[
          `IMO: ${vessel.imoNumber}`,
          vessel.vesselSubtype || vessel.vesselType || 'Commercial Maritime Vessel',
          vessel.portOfRegistry ? `${vessel.flagState} · ${vessel.portOfRegistry}` : vessel.flagState,
        ]}
        mainAction={
          canShowEditButton || (isEditing && fieldEditable('status')) ? (
            <div className="d-flex align-items-center gap-1">
              {isEditing && fieldEditable('status') && (
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  aria-label="Operating Status"
                  value={formData?.status ?? vessel.status}
                  onChange={(e) => handleInputChange('status', e.target.value as VesselRegistrationStatus)}
                >
                  <option value="Active">Active</option>
                  <option value="In Operations" disabled={!isAssuranceApproved}>
                    In Operations {!isAssuranceApproved ? '(needs an approved set for a current contract period)' : ''}
                  </option>
                  <option value="In Transit" disabled={!isAssuranceApproved}>
                    In Transit {!isAssuranceApproved ? '(needs an approved set for a current contract period)' : ''}
                  </option>
                  <option value="Port Stay">Port Stay</option>
                  <option value="Under Charter" disabled={!isAssuranceApproved}>
                    Under Charter {!isAssuranceApproved ? '(needs an approved set for a current contract period)' : ''}
                  </option>
                  <option value="Standby">Standby</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Dry Docking">Dry Docking</option>
                  <option value="Lay-up">Lay-up</option>
                  <option value="Decommissioned">Decommissioned</option>
                </select>
              )}
              {canShowEditButton && (
                isEditing ? (
                  <>
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
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{canEditFull ? 'Edit Information' : 'Update Status'}</span>
                  </button>
                )
              )}
            </div>
          ) : undefined
        }
        onExportCsv={canExport ? handleExportCsv : undefined}
        onExportPdf={canExport ? handleExportPdf : undefined}
      />
      <ObjectVerificationBadge verification={objectVerification} />

      <AssetStatusCard
        assetType="Vessel"
        status={getVesselAssetStatus(vessel)}
        registrationFact={vessel.portOfRegistry ? `${vessel.flagState} · ${vessel.portOfRegistry}` : vessel.flagState}
        canEditAvailability={canEditStatus}
        onAvailabilityChange={(value) => updateVesselAvailability(vessel.id, value)}
      />

      {/* Sub-Tabs Navigation — Overview…History for all; Audit Trail for owning-organization Administrator */}
      <ul className="nav nav-tabs border-bottom" role="tablist" aria-label="Vessel detail tabs">
        <li className="nav-item">
          <button
            type="button"
            role="tab"
            className={`nav-link ${activeTab === 'overview' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            role="tab"
            className={`nav-link ${activeTab === 'vault' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('vault')}
          >
            Documents ({allVaultCerts.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            role="tab"
            className={`nav-link ${activeTab === 'assurance' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('assurance')}
          >
            Assurance ({linkedSets.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            role="tab"
            className={`nav-link ${activeTab === 'inspections' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('inspections')}
          >
            Inspections ({physicalInspections.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            role="tab"
            className={`nav-link ${activeTab === 'crew' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('crew')}
          >
            Crew and Equipment ({linkedCrew.length + linkedEquipment.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            role="tab"
            className={`nav-link ${activeTab === 'history' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            History and Audit Trail
          </button>
        </li>
        {isAdmin && isOwned && (
          <li className="nav-item">
            <button
              type="button"
              role="tab"
              className={`nav-link ${activeTab === 'clients' ? 'active fw-bold text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('clients')}
            >
              Past charters ({vessel.clientHistory?.length ?? 0})
            </button>
          </li>
        )}
      </ul>

      {/* Tab 1: Overview datasheet */}
      {activeTab === 'overview' && (
        <div className="row g-3">
          {/* ========================================================= */}
          {/* Column 1: Vessel Photo & Photo Actions */}
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

            {canManagePhotos && (
              <div className="d-flex align-items-center justify-content-between gap-1 mb-3 mt-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn"
                  onClick={() => setShowPhotoUploadModal(true)}
                  title="Manage photos"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span style={{ fontSize: '0.68rem' }}>{vessel.photos && vessel.photos.length > 1 ? 'Photos' : 'Add Photo'}</span>
                </button>
              </div>
            )}
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
                <div className="map-datasheet-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
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
                    <span className="map-datasheet-label">Flag State</span>
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
                    <span className="map-datasheet-label">Port of Registry</span>
                    {fieldEditable('portOfRegistry') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.portOfRegistry || ''}
                        onChange={(e) => handleInputChange('portOfRegistry', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.portOfRegistry}</span>
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
                      <span className="map-datasheet-val font-mono-code">{vessel.mmsiNumber}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Call Sign</span>
                    {fieldEditable('callSign') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={formData.callSign || ''}
                        onChange={(e) => handleInputChange('callSign', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val font-mono-code">{vessel.callSign}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Official Reg. No.</span>
                    {fieldEditable('officialRegNumber') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={formData.officialRegNumber || ''}
                        onChange={(e) => handleInputChange('officialRegNumber', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val font-mono-code">{vessel.officialRegNumber}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Shipyard</span>
                    {fieldEditable('shipyardBuilder') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.shipyardBuilder || ''}
                        onChange={(e) => handleInputChange('shipyardBuilder', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.shipyardBuilder}</span>
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
                      <span className="map-datasheet-val">{vessel.yearBuilt}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Dimensions and tonnage (merged Dimensions + Capacity) */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showDimensionsInfo ? 'is-open' : ''}`}
                onClick={() => setShowDimensionsInfo(!showDimensionsInfo)}
              >
                <div className="map-datasheet-card-title">
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Dimensions and tonnage</span>
                </div>
                <span className="text-muted small">{showDimensionsInfo ? '▲' : '▼'}</span>
              </div>
              {showDimensionsInfo && (
                <div className="map-datasheet-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">LOA</span>
                    {fieldEditable('lengthOverallMeters') ? (
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={formData.lengthOverallMeters || ''}
                        onChange={(e) => handleInputChange('lengthOverallMeters', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.lengthOverallMeters ? `${vessel.lengthOverallMeters} m` : ''}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Beam</span>
                    {fieldEditable('beamMeters') ? (
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm"
                        value={formData.beamMeters || ''}
                        onChange={(e) => handleInputChange('beamMeters', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.beamMeters ? `${vessel.beamMeters} m` : ''}</span>
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
                      <span className="map-datasheet-val">{vessel.draftMeters ? `${vessel.draftMeters} m` : ''}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">GT</span>
                    {fieldEditable('grossTonnageGT') ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.grossTonnageGT || ''}
                        onChange={(e) => handleInputChange('grossTonnageGT', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.grossTonnageGT ? vessel.grossTonnageGT.toLocaleString() : ''}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">DWT</span>
                    {fieldEditable('deadweightTonnageDWT') ? (
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.deadweightTonnageDWT || ''}
                        onChange={(e) => handleInputChange('deadweightTonnageDWT', Number(e.target.value))}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.deadweightTonnageDWT ? vessel.deadweightTonnageDWT.toLocaleString() : ''}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Class and insurance */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showClassificationInfo ? 'is-open' : ''}`}
                onClick={() => setShowClassificationInfo(!showClassificationInfo)}
              >
                <div className="map-datasheet-card-title">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Class and insurance</span>
                </div>
                <span className="text-muted small">{showClassificationInfo ? '▲' : '▼'}</span>
              </div>
              {showClassificationInfo && (
                <div className="map-datasheet-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
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
                        <option value="Austral Classification Society">Austral Classification Society</option>
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
                      <span className="map-datasheet-val">{vessel.dynamicPositioningClass}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">H&amp;M Insurer</span>
                    {fieldEditable('hmInsurer') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.hmInsurer || ''}
                        onChange={(e) => handleInputChange('hmInsurer', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.hmInsurer}</span>
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
                      <span className="map-datasheet-val">{vessel.piClubName}</span>
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
                      <span className="map-datasheet-val font-mono-code">{vessel.policyNumber}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Policy Expiry</span>
                    {fieldEditable('policyExpiryDate') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm font-mono-code"
                        value={formData.policyExpiryDate || ''}
                        onChange={(e) => handleInputChange('policyExpiryDate', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val font-mono-code">{vessel.policyExpiryDate}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 4: Machinery */}
            <div className="map-datasheet-card">
              <div
                className={`map-datasheet-card-header ${showEngineRoomInfo ? 'is-open' : ''}`}
                onClick={() => setShowEngineRoomInfo(!showEngineRoomInfo)}
              >
                <div className="map-datasheet-card-title">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Machinery</span>
                </div>
                <span className="text-muted small">{showEngineRoomInfo ? '▲' : '▼'}</span>
              </div>
              {showEngineRoomInfo && (
                <div className="map-datasheet-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Engine</span>
                    {fieldEditable('mainEnginePowerKW') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.mainEnginePowerKW || ''}
                        onChange={(e) => handleInputChange('mainEnginePowerKW', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.mainEnginePowerKW}</span>
                    )}
                  </div>
                  <div className="map-datasheet-cell">
                    <span className="map-datasheet-label">Fuel</span>
                    {fieldEditable('fuelType') ? (
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.fuelType || ''}
                        onChange={(e) => handleInputChange('fuelType', e.target.value)}
                      />
                    ) : (
                      <span className="map-datasheet-val">{vessel.fuelType}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* Column 3: Management — one row per organization (Client Admin) */}
          {/* ========================================================= */}
          {showManagementSection && (
            <div className="col-12 col-lg-3 col-xl-3">
              <div className="map-section-divider">
                <Building className="w-4 h-4" />
                <span>Management</span>
              </div>

              <div className="list-group border rounded-3 overflow-hidden bg-white shadow-sm">
                {managementOrganizations.map((row) => {
                  /* organizationProfiles in deps keeps contacts live after Settings edits */
                  void organizationProfiles;
                  const contact = organizationContactFields(row.organization);
                  const effectDates = row.roles.map((roleLabel) => {
                    const roleKey = vesselManagerRoleFromLabel(roleLabel);
                    const raw = roleKey ? getManagerDateOfEffect(vessel.id, roleKey) : '';
                    return {
                      roleLabel,
                      display: raw.trim()
                        ? formatMaritimeDate(raw)
                        : ORGANIZATION_FIELD_NOT_RECORDED,
                    };
                  });
                  return (
                    <div
                      key={row.organization}
                      className="list-group-item py-3"
                    >
                      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.85rem' }}>
                            {row.organization}
                          </div>
                          <div className="text-muted small text-truncate">{row.roles.join(' · ')}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary shrink-0"
                          onClick={() => setSelectedCompanyForFleetModal(row.organization)}
                        >
                          View vessels
                        </button>
                      </div>
                      <div className="small" style={{ fontSize: '0.75rem' }}>
                        <div className="d-flex justify-content-between gap-2">
                          <span className="text-muted">Email</span>
                          <span className={contact.email === ORGANIZATION_FIELD_NOT_RECORDED ? 'text-muted' : 'text-dark text-truncate'}>{contact.email}</span>
                        </div>
                        <div className="d-flex justify-content-between gap-2">
                          <span className="text-muted">Phone</span>
                          <span className={contact.phone === ORGANIZATION_FIELD_NOT_RECORDED ? 'text-muted' : 'text-dark text-truncate'}>{contact.phone}</span>
                        </div>
                        <div className="d-flex justify-content-between gap-2">
                          <span className="text-muted">Fax</span>
                          <span className={contact.fax === ORGANIZATION_FIELD_NOT_RECORDED ? 'text-muted' : 'text-dark text-truncate'}>{contact.fax}</span>
                        </div>
                        <div className="d-flex justify-content-between gap-2">
                          <span className="text-muted">Website</span>
                          <span className={contact.website === ORGANIZATION_FIELD_NOT_RECORDED ? 'text-muted' : 'text-dark text-truncate'}>{contact.website}</span>
                        </div>
                        <div className="d-flex justify-content-between gap-2">
                          <span className="text-muted">Address</span>
                          <span className={`text-end ${contact.address === ORGANIZATION_FIELD_NOT_RECORDED ? 'text-muted' : 'text-dark'}`}>{contact.address}</span>
                        </div>
                        {effectDates.map((entry) => (
                          <div key={entry.roleLabel} className="d-flex justify-content-between gap-2 mt-1">
                            <span className="text-muted">Date of effect · {entry.roleLabel}</span>
                            <span className={entry.display === ORGANIZATION_FIELD_NOT_RECORDED ? 'text-muted' : 'text-dark font-mono-code'}>
                              {entry.display}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {managementOrganizations.length === 0 && (
                  <div className="list-group-item text-muted small py-3">No management organizations recorded.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Pre-Assurance Document Vault (BR-5) */}
      {activeTab === 'vault' && (
        <div data-testid="vessel-scoped-document-table">
          <DocumentTable
            documents={visibleObjectDocuments}
            onSelectDocument={(doc) => setCurrentHashView('documents', doc.id)}
            onUploadDocument={canUploadDocs ? () => setIsUploadModalOpen(true) : undefined}
          />
        </div>
      )}

      {/* Tab 3: Assurance Sets */}
      {activeTab === 'assurance' && (
        <div data-testid="vessel-scoped-assurance-table">
          <AssuranceTable
            vesselId={vessel?.id}
            defaultTab="organization"
            onSelectSet={(set) => setCurrentHashView('assurance-sets', set.id)}
            onInitiateSet={
              canCreateAssuranceForThisVessel
                ? () => handleCreateAssuranceForVessel()
                : undefined
            }
          />
        </div>
      )}

      {/* Tab: Status History — availability, registration, class, compliance timelines */}
      {activeTab === 'history' && vessel && (
        <VesselActivityTab
          vesselId={vessel.id}
          statusHistory={linkedStatusHistory}
          inspections={physicalInspections}
          capaItems={linkedCapas}
          assuranceSets={linkedSets}
          onOpen={(entry: VesselActivityEntry) => {
            if (entry.kind === 'status') {
              setStatusHistorySearch(entry.recordId);
              setStatusHistoryDimensionFilter('ALL');
              setStatusHistoryCurrentOnly(false);
              return;
            }
            if (entry.kind === 'inspection') {
              const inspection = physicalInspections.find((item) => item.id === entry.recordId);
              if (inspection) setSelectedInspectionForDetail(inspection);
              return;
            }
            if (entry.kind === 'capa') {
              setCurrentHashView('capa', entry.recordId);
              return;
            }
            setCurrentHashView('assurance-sets', entry.recordId);
          }}
        />
      )}

      {activeTab === 'history' && (
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
                placeholder="Search status history..."
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
                <option value="effectiveFrom">Sort: From</option>
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
                  Current Only
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
                      No status history found.
                    </td>
                  </tr>
                ) : (
                  statusHistoryPagination.pageItems.map((entry) => (
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
          <TablePagination {...statusHistoryPagination.controls} />
        </div>
      )}

      {/* Past charters — owning-organization Administrator */}
      {activeTab === 'clients' && isAdmin && isOwned && (
        <div className="card map-card-custom">
          {/* Table Controls Header */}
          <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="Search past charters..."
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
                <option value="clientOrganization">Sort: Client</option>
                <option value="charterTitle">Sort: Charter</option>
                <option value="assuranceSetId">Sort: Set ID</option>
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
              <div className="p-4 text-center text-muted">No client history found.</div>
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
                        Client {renderSortIndicator(clientSortField, 'clientOrganization', clientSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'charterTitle') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('charterTitle'); setClientSortDirection('asc'); }
                        }}
                      >
                        Charter {renderSortIndicator(clientSortField, 'charterTitle', clientSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'charterStart') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('charterStart'); setClientSortDirection('asc'); }
                        }}
                      >
                        Contract Period {renderSortIndicator(clientSortField, 'charterStart', clientSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (clientSortField === 'assuranceSetId') setClientSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setClientSortField('assuranceSetId'); setClientSortDirection('asc'); }
                        }}
                      >
                        Set ID {renderSortIndicator(clientSortField, 'assuranceSetId', clientSortDirection)}
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
                    {clientPagination.pageItems.map((record) => (
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
            <TablePagination {...clientPagination.controls} />
          </div>
        </div>
      )}

      {/* Tab 5: Assigned Crew Directory */}
      {activeTab === 'crew' && (
        <>
          <div className="card map-card-custom mb-3">
            <div className="card-header fw-bold bg-white d-flex justify-between align-items-center">
              <span>Equipment ({linkedEquipment.length})</span>
            </div>
            {linkedEquipment.length === 0 ? (
              <div className="p-4 text-center text-muted">No equipment linked to this vessel.</div>
            ) : (
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
            )}
          </div>
      {isAdmin && isOwned && vessel && (
        <>
          {isAssignExistingOpen && (
            <div className="card map-card-custom mb-3">
              <div className="p-3 bg-light d-flex flex-wrap align-items-center gap-3">
                <div className="fw-semibold text-dark small">Assign Crew:</div>
                <select
                  className="form-select form-select-sm bg-white text-dark border-secondary"
                  style={{ width: '320px' }}
                  value={selectedCrewToAssign}
                  onChange={(e) => setSelectedCrewToAssign(e.target.value)}
                >
                  <option value="">Select crew</option>
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
                    assignCrewToVessel(selectedCrewToAssign, vessel.id);
                    const member = crew.find((c) => c.id === selectedCrewToAssign);
                    setToastMessage(`Assigned ${member?.fullName || selectedCrewToAssign} to ${vessel.name}`);
                    setSelectedCrewToAssign('');
                    setIsAssignExistingOpen(false);
                  }}
                >
                  Confirm Assign
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setIsAssignExistingOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <CrewTable
            vesselId={vessel.id}
            onSelectCrew={(selectedCrew) => setCurrentHashView('crew', selectedCrew.id)}
            onRegisterCrew={() => setIsAddCrewModalOpen(true)}
            primaryActions={
              <button
                type="button"
                className="btn btn-sm btn-outline-primary fw-semibold"
                onClick={() => setIsAssignExistingOpen((open) => !open)}
              >
                Assign Crew
              </button>
            }
          />
        </>
      )}

        </>
      )}

      {/* Audit Trail — under History and Audit Trail for owning-organization Administrator */}
      {activeTab === 'history' && isAdmin && isOwned && vessel && (
        <div className="mt-3">
          <AuditTrailTable vesselId={vessel.id} />
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
                    placeholder="Search inspections..."
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
                      New Inspection
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
                        Inspection {renderSortIndicator(inspectionSortField, 'id', inspectionSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (inspectionSortField === 'assuranceSetId') setInspectionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setInspectionSortField('assuranceSetId'); setInspectionSortDirection('asc'); }
                        }}
                      >
                        Assurance Set {renderSortIndicator(inspectionSortField, 'assuranceSetId', inspectionSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (inspectionSortField === 'inspector') setInspectionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setInspectionSortField('inspector'); setInspectionSortDirection('asc'); }
                        }}
                      >
                        Inspector {renderSortIndicator(inspectionSortField, 'inspector', inspectionSortDirection)}
                      </th>
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          if (inspectionSortField === 'date') setInspectionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                          else { setInspectionSortField('date'); setInspectionSortDirection('asc'); }
                        }}
                      >
                        Date {renderSortIndicator(inspectionSortField, 'date', inspectionSortDirection)}
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
                          No inspections recorded.
                        </td>
                      </tr>
                    ) : (
                      inspectionPagination.pageItems.map((insp) => (
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
                              title="View assurance set"
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
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInspectionForDetail(insp);
                                }}
                                title="View"
                                aria-label="View"
                              >
                                <Eye size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination {...inspectionPagination.controls} />
            </div>

            {/* Section 2: CAPA Tracker — shared CAPA table scoped to vessel */}
            <CapaTable vesselId={vessel?.id} />
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
                      Inspection — {vessel.name} (IMO {vessel.imoNumber})
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
                        <div className="text-secondary small text-uppercase fw-semibold mb-1">Vessel</div>
                        <div className="fw-bold text-primary">{vessel.name}</div>
                        <div className="font-mono-code small text-muted">IMO: {vessel.imoNumber}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="p-3 bg-light border rounded h-100">
                        <div className="text-secondary small text-uppercase fw-semibold mb-1">Inspector</div>
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
                        <div className="text-secondary small text-uppercase fw-semibold mb-1">Assurance Set</div>
                        <button
                          type="button"
                          className="btn btn-link p-0 fw-bold text-primary font-mono-code text-decoration-underline text-start"
                          onClick={() => {
                            const setCode = selectedInspectionForDetail.assuranceSetId;
                            setSelectedInspectionForDetail(null);
                            setCurrentHashView('assurance-sets', setCode);
                          }}
                          title="View assurance set"
                        >
                          {selectedInspectionForDetail.assuranceSetId}
                        </button>
                        <div className="small text-secondary text-truncate" title={selectedInspectionForDetail.assuranceSetTitle}>
                          {selectedInspectionForDetail.assuranceSetTitle || 'Inspection'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit Findings Summary Bar */}
                  <div className="p-3 bg-primary-subtle border border-primary-subtle rounded mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-primary small">Findings:</span>
                      <span className="badge bg-success text-white font-mono-code">{selectedInspectionForDetail.findingsSummary.satisfactory} Satisfactory</span>
                      <span className="badge bg-info text-white font-mono-code">{selectedInspectionForDetail.findingsSummary.observations} Observations</span>
                      <span className="badge bg-danger text-white font-mono-code">{selectedInspectionForDetail.findingsSummary.deficiencies} Deficiencies</span>
                    </div>
                  </div>

                  {/* Physical Checklist Breakdown Table */}
                  <div className="mb-4">
                    <h6 className="fw-bold text-dark mb-2">Checklist Items</h6>
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
                              Category {renderSortIndicator(modalChecklistSortField, 'category', modalChecklistSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalChecklistSortField === 'status') setModalChecklistSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalChecklistSortField('status'); setModalChecklistSortDirection('asc'); }
                              }}
                            >
                              Status {renderSortIndicator(modalChecklistSortField, 'status', modalChecklistSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalChecklistSortField === 'notes') setModalChecklistSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalChecklistSortField('notes'); setModalChecklistSortDirection('asc'); }
                              }}
                            >
                              Findings {renderSortIndicator(modalChecklistSortField, 'notes', modalChecklistSortDirection)}
                            </th>
                            <th style={{ whiteSpace: 'nowrap' }}>Evidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalChecklistPagination.pageItems.map((chk: any) => (
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
                    <TablePagination {...modalChecklistPagination.controls} />
                  </div>

                  {/* Linked Corrective Actions (CAPA) Section */}
                  <div className="mb-4">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="fw-bold text-dark m-0">CAPAs</h6>
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
                              Title {renderSortIndicator(modalCapaSortField, 'title', modalCapaSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => {
                                if (modalCapaSortField === 'owner') setModalCapaSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                                else { setModalCapaSortField('owner'); setModalCapaSortDirection('asc'); }
                              }}
                            >
                              Owner {renderSortIndicator(modalCapaSortField, 'owner', modalCapaSortDirection)}
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
                            <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedModalCapas.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-3 text-muted small">
                                No CAPAs yet.
                              </td>
                            </tr>
                          ) : (
                            modalCapaPagination.pageItems.map((capa) => (
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
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination {...modalCapaPagination.controls} />
                  </div>

                  {/* Inspection Campaign Event Log */}
                  <div>
                    <h6 className="fw-bold text-dark mb-2">Inspection Log</h6>
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
            setToastMessage('Document uploaded.');
            setTimeout(() => setToastMessage(null), 3500);
          }}
        />
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
                    <span className="badge bg-primary text-white font-mono-code">VESSELS</span>
                    <h5 className="modal-title fw-bold text-dark m-0">{selectedCompanyForFleetModal}</h5>
                  </div>
                  <div className="text-secondary small mt-0.5">
                    Other vessels managed by this organization
                  </div>
                  {(() => {
                    const fleetContact = organizationContactFields(selectedCompanyForFleetModal);
                    return (
                      <div className="small text-secondary mt-2" style={{ fontSize: '0.75rem' }}>
                        <div>Email · {fleetContact.email}</div>
                        <div>Phone · {fleetContact.phone}</div>
                        <div>Website · {fleetContact.website}</div>
                        <div>Address · {fleetContact.address}</div>
                      </div>
                    );
                  })()}
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
                        <th>IMO Number</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Flag State</th>
                        <th>Date of effect</th>
                        <th>Operating Status</th>
                        <th>Readiness</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyFleetPagination.pageItems.map((v) => {
                        const effectRaw = getManagerDateOfEffectForOrganization(
                          v.id,
                          selectedCompanyForFleetModal,
                          v,
                        );
                        const effectDisplay = effectRaw.trim()
                          ? formatMaritimeDate(effectRaw)
                          : ORGANIZATION_FIELD_NOT_RECORDED;
                        return (
                          <tr key={v.id}>
                            <td className="font-mono-code fw-semibold text-primary">{v.imoNumber}</td>
                            <td className="fw-semibold text-dark">{v.name}</td>
                            <td className="small">{v.vesselSubtype || v.vesselType}</td>
                            <td>{v.flagState}</td>
                            <td className={effectDisplay === ORGANIZATION_FIELD_NOT_RECORDED ? 'text-muted small' : 'font-mono-code small'}>
                              {effectDisplay}
                            </td>
                            <td>
                              <span className={`badge ${getVesselStatusBadgeClass(v.status)}`}>{v.status}</span>
                            </td>
                            <td>
                              <ReadinessGauge score={calculateVesselReadiness(v, assuranceSets, documents)} size="sm" />
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => {
                                  setSelectedCompanyForFleetModal(null);
                                  setCurrentHashView('vessels', v.id);
                                }}
                                title="View"
                                aria-label="View"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePagination {...companyFleetPagination.controls} />
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

      {/* Document preview — only for vault rows that have a real Document Library record */}
      {selectedVaultCertForModal?.hasDocument && (() => {
        const matchingDoc = documents.find(
          (d) =>
            d.id === selectedVaultCertForModal.docId ||
            d.id === selectedVaultCertForModal.id ||
            d.certificateNo === selectedVaultCertForModal.number,
        );

        if (!matchingDoc) {
          return null;
        }

        return (
          <UniversalDocumentPreviewModal
            isOpen={Boolean(selectedVaultCertForModal)}
            document={matchingDoc}
            onClose={() => setSelectedVaultCertForModal(null)}
            title="Certificate Layout & PDF Review"
            subtitle={`${matchingDoc.title} · Version ${matchingDoc.currentVersion || 'v1.0'} (${matchingDoc.certificateNo})`}
            versionLabel={matchingDoc.currentVersion || 'v1.0'}
            uploadedAt={matchingDoc.versions?.[0]?.uploadedAt}
            uploadedBy={matchingDoc.versions?.[0]?.uploadedBy}
            extraAction={
              <button
                type="button"
                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                style={{ width: '32px', height: '32px' }}
                title="View Document"
                aria-label="View Document"
                onClick={() => {
                  const docId = matchingDoc.id;
                  setSelectedVaultCertForModal(null);
                  setCurrentHashView('documents', docId);
                }}
              >
                <Eye size={16} />
              </button>
            }
          />
        );
      })()}

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
                      Manage Photos
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
                      Cover Photo
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
                        title="Crop cover photo"
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
                          Photos ({modalPhotos.length})
                        </span>
                        <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                          Drag to reorder. Click a photo to set it as the cover.
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1 fw-semibold shadow-2xs"
                        onClick={() => setShowAddPhotoModal(true)}
                        title="Add photo"
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
                              className={`position-relative p-1 bg-white border rounded-2 overflow-hidden cursor-grab active-cursor-grabbing transition-all ${isCover
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
                      <span>Reset to Default</span>
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
                      Add Photo
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
                    <span className="fw-bold text-dark small">Upload a Photo</span>
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
                      You can crop the photo before it is added.
                    </span>
                  </div>
                </div>

                {/* Option B: Curated Stock Presets */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="fw-bold text-dark small mb-2">Choose a Preset</div>
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
                          title={`Add ${p.title}`}
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
                    Image URL
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
                      Add
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

    </div>
  );
};
