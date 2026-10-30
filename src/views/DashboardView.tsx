import { ArrowUpDown, ArrowUp, ArrowDown, Eye, AlertTriangle } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { StatusBadge } from '../components/common/StatusBadge';
import { getReadinessTextClass } from '../config/readinessScale';
import { formatMaritimeDate } from '../utils/formatters';
import { VerifierWorkspaceView } from './VerifierWorkspaceView';
import { InspectorWorkspaceView } from './InspectorWorkspaceView';
import { ApproverDashboardView } from './ApproverDashboardView';
import { Vessel } from '../types/vessel';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { filterAssuranceSetsForSession, isAssuranceSetAssignedToPersona, filterVesselsForPersona } from '../utils/rbacHelpers';
import { useSessionUser } from '../utils/useSessionUser';
import {
  calculateAssuranceSetReadiness,
  calculateVesselReadiness,
  getAssuranceSetOnTimeStatus,
  getAssuranceSetOpenFindingsCount,
  getAssuranceSetRemainingItems,
  getFleetPerformanceSummary,
  isTaskOpen,
} from '../utils/readinessHelpers';
import { toIsoLocalDate } from '../utils/validation';
import { getAssuranceSetScopes } from '../utils/assuranceTemplates';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { ReturnedDocumentsDrawer } from '../components/drawers/ReturnedDocumentsDrawer';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { filterProjectsForPersona } from '../utils/projectHelpers';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';
import { DueCell } from '../components/common/DueCell';
import { EXPIRY_WARNING_DAYS, isExpiringWithinWarning } from '../utils/expiryPolicy';

/**
  what: renders the executive dashboard workspace view in light theme.
  how: aggregates stats from zustand vessels, assuranceSets, and documents state arrays, rendering role-aligned KPI cards and tables for Approver, Submitter, C Admin, or default roles.
  with what file: src/views/DashboardView.tsx loaded by App.tsx.
*/
export const DashboardView: React.FC = () => {
  const {
    vessels,
    assuranceSets,
    documents,
    projects,
    users,
    capaItems,
    activePersona,
    activeDemoOrganization,
    setCurrentHashView,
  } = useMapStore();
  const sessionUser = useSessionUser();
  const [cAdminSearchTerm, setCAdminSearchTerm] = useState('');
  const [cAdminProjectSearchTerm, setCAdminProjectSearchTerm] = useState('');
  const [cAdminSortField, setCAdminSortField] = useState<'title' | 'scope' | 'charterWindowStart' | 'stage'>('title');
  const [cAdminSortDirection, setCAdminSortDirection] = useState<'asc' | 'desc'>('asc');
  const [cAdminProjectSortField, setCAdminProjectSortField] = useState<'name' | 'status'>('name');
  const [cAdminProjectSortDirection, setCAdminProjectSortDirection] = useState<'asc' | 'desc'>('asc');
  const [submitterSearchTerm, setSubmitterSearchTerm] = useState('');
  const [submitterSortField, setSubmitterSortField] = useState<'id' | 'title' | 'vesselName' | 'charterWindowStart' | 'stage' | 'readinessScore'>('id');
  const [submitterSortDirection, setSubmitterSortDirection] = useState<'asc' | 'desc'>('asc');
  const [fleetSortField, setFleetSortField] = useState<'name' | 'imoNumber' | 'flagState' | 'classificationSociety' | 'status' | 'readiness'>('name');
  const [fleetSortDirection, setFleetSortDirection] = useState<'asc' | 'desc'>('asc');
  const [submitterTableFilter, setSubmitterTableFilter] = useState<'ALL' | 'awaiting_upload' | 'returned' | 'due_this_week'>('ALL');
  const [cAdminStageFilter, setCAdminStageFilter] = useState<'ALL' | 'in_progress' | 'approved'>('ALL');

  /* returned documents drawer state for submitter */
  const [selectedReturnedSet, setSelectedReturnedSet] = useState<AssuranceSet | null>(null);
  const [uploadModalTarget, setUploadModalTarget] = useState<{ req: AssuranceRequirement; doc?: MasterDocument } | null>(null);
  const [reviewDrawerDoc, setReviewDrawerDoc] = useState<{ doc: MasterDocument; notes?: string } | null>(null);

  const cAdminProjects = useMemo(
    () =>
      filterProjectsForPersona(
        projects,
        'C Admin',
        users,
        assuranceSets,
        activeDemoOrganization,
      ),
    [projects, users, assuranceSets, activeDemoOrganization],
  );

  const visibleVessels: Vessel[] = filterVesselsForPersona(vessels, assuranceSets, activePersona);

  const totalVessels = visibleVessels.length;
  const avgReadiness = Math.round(
    visibleVessels.reduce(
      (acc: number, v: Vessel) => acc + calculateVesselReadiness(v, assuranceSets, documents),
      0
    ) / (totalVessels || 1)
  );
  const activeAssurances = assuranceSets.filter((s) => s.stage !== 'Certified' && s.stage !== 'Approved').length;

  /* c admin specific assurance sets */
  const cAdminAssuranceSets = assuranceSets.filter((s) => isAssuranceSetAssignedToPersona(s, 'C Admin', activeDemoOrganization));

  /* every scope a set covers as one label, shared by the c admin scope cell, sort and search */
  const getScopeLabel = (s: AssuranceSet) => getAssuranceSetScopes(s).join(', ');

  /* submitter specific assurance sets */
  const submitterAssuranceSets = filterAssuranceSetsForSession(
    assuranceSets,
    'Submitter',
    activeDemoOrganization,
    sessionUser,
  );
  const visibleSubmitterSets = submitterAssuranceSets;

  const renderSortIndicator = (currentField: string, field: string, direction: 'asc' | 'desc') => {
    if (currentField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return direction === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const filteredCAdminSets = cAdminAssuranceSets.filter((s) => {
    if (cAdminStageFilter === 'in_progress') {
      if (s.stage === 'Certified' || s.stage === 'Approved') return false;
    } else if (cAdminStageFilter === 'approved') {
      if (s.stage !== 'Certified' && s.stage !== 'Approved' && s.approverDecision !== 'Approved') return false;
    }
    const term = cAdminSearchTerm.toLowerCase();
    return (
      s.id.toLowerCase().includes(term) ||
      s.title.toLowerCase().includes(term) ||
      getScopeLabel(s).toLowerCase().includes(term) ||
      s.vesselName.toLowerCase().includes(term) ||
      s.imoNumber.includes(term) ||
      (s.initiatorOrg && s.initiatorOrg.toLowerCase().includes(term))
    );
  });

  const sortedCAdminSets = [...filteredCAdminSets].sort((a, b) => {
    let comp = 0;
    if (cAdminSortField === 'title') comp = a.title.localeCompare(b.title);
    else if (cAdminSortField === 'scope') comp = getScopeLabel(a).localeCompare(getScopeLabel(b));
    else if (cAdminSortField === 'charterWindowStart') comp = (a.charterWindowStart || '').localeCompare(b.charterWindowStart || '');
    else if (cAdminSortField === 'stage') comp = a.stage.localeCompare(b.stage);
    return cAdminSortDirection === 'asc' ? comp : -comp;
  });

  const handleCAdminSort = (field: 'title' | 'scope' | 'charterWindowStart' | 'stage') => {
    if (cAdminSortField === field) {
      setCAdminSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setCAdminSortField(field);
      setCAdminSortDirection('asc');
    }
  };

  const filteredCAdminProjects = cAdminProjects.filter((p) => {
    const term = cAdminProjectSearchTerm.toLowerCase();
    return (
      p.id.toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      p.projectType.toLowerCase().includes(term) ||
      p.requestingOrganization.toLowerCase().includes(term) ||
      (p.charterer && p.charterer.toLowerCase().includes(term))
    );
  });

  const sortedCAdminProjects = [...filteredCAdminProjects].sort((a, b) => {
    let comp = 0;
    if (cAdminProjectSortField === 'name') comp = a.name.localeCompare(b.name);
    else if (cAdminProjectSortField === 'status') comp = a.status.localeCompare(b.status);
    return cAdminProjectSortDirection === 'asc' ? comp : -comp;
  });

  const handleCAdminProjectSort = (field: 'name' | 'status') => {
    if (cAdminProjectSortField === field) {
      setCAdminProjectSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setCAdminProjectSortField(field);
      setCAdminProjectSortDirection('asc');
    }
  };

  const isSetAwaitingUpload = (s: AssuranceSet) =>
    (s.requirements || []).some((r) => {
      const linkedDoc = documents.find((d) => d.id === r.documentId || (r.linkedDocumentId && d.id === r.linkedDocumentId));
      return (
        (!r.documentId && !r.linkedDocumentId && !r.isFulfilled) ||
        r.verifierStatus === 'Pending' ||
        linkedDoc?.verificationStatus === 'Pending'
      );
    });

  const isSetReturnedForCorrection = (s: AssuranceSet) =>
    (s.requirements || []).some((r) => {
      const linkedDoc = documents.find((d) => d.id === r.documentId || (r.linkedDocumentId && d.id === r.linkedDocumentId));
      return (
        r.verifierStatus === 'Correction Requested' ||
        r.verifierStatus === 'Rejected' ||
        linkedDoc?.verificationStatus === 'Correction Requested' ||
        linkedDoc?.verificationStatus === 'Rejected'
      );
    });

  const isSetDueThisWeek = (s: AssuranceSet, today: Date = new Date()) => {
    if (s.stage === 'Approved' || s.stage === 'Certified' || s.stage === 'Cancelled') return false;
    const todayMs = new Date(toIsoLocalDate(today)).getTime();
    return (s.requirements || []).some((r) => {
      if (!isTaskOpen(r)) return false;
      const target = r.targetDate || s.targetDate || s.complianceDeadline;
      if (!target) return false;
      const targetMs = new Date(toIsoLocalDate(new Date(target))).getTime();
      const diffDays = Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    });
  };

  const filteredSubmitterSets = visibleSubmitterSets.filter((s) => {
    if (submitterTableFilter === 'awaiting_upload' && !isSetAwaitingUpload(s)) return false;
    if (submitterTableFilter === 'returned' && !isSetReturnedForCorrection(s)) return false;
    if (submitterTableFilter === 'due_this_week' && !isSetDueThisWeek(s)) return false;

    const term = submitterSearchTerm.toLowerCase();
    return (
      s.id.toLowerCase().includes(term) ||
      s.title.toLowerCase().includes(term) ||
      s.vesselName.toLowerCase().includes(term) ||
      s.imoNumber.includes(term) ||
      (s.initiatorOrg && s.initiatorOrg.toLowerCase().includes(term)) ||
      (s.charterer && s.charterer.toLowerCase().includes(term))
    );
  });

  const sortedSubmitterSets = [...filteredSubmitterSets].sort((a, b) => {
    let comp = 0;
    if (submitterSortField === 'id') comp = a.id.localeCompare(b.id);
    else if (submitterSortField === 'title') comp = a.title.localeCompare(b.title);
    else if (submitterSortField === 'vesselName') comp = a.vesselName.localeCompare(b.vesselName);
    else if (submitterSortField === 'charterWindowStart') comp = (a.charterWindowStart || '').localeCompare(b.charterWindowStart || '');
    else if (submitterSortField === 'stage') comp = a.stage.localeCompare(b.stage);
    else if (submitterSortField === 'readinessScore') comp = calculateAssuranceSetReadiness(a) - calculateAssuranceSetReadiness(b);
    return submitterSortDirection === 'asc' ? comp : -comp;
  });

  const handleSubmitterSort = (field: 'id' | 'title' | 'vesselName' | 'charterWindowStart' | 'stage' | 'readinessScore') => {
    if (submitterSortField === field) {
      setSubmitterSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setSubmitterSortField(field);
      setSubmitterSortDirection('asc');
    }
  };

  const sortedFleetVessels = [...visibleVessels].sort((a, b) => {
    let comp = 0;
    if (fleetSortField === 'name') comp = a.name.localeCompare(b.name);
    else if (fleetSortField === 'imoNumber') comp = a.imoNumber.localeCompare(b.imoNumber);
    else if (fleetSortField === 'flagState') comp = a.flagState.localeCompare(b.flagState);
    else if (fleetSortField === 'classificationSociety') comp = a.classificationSociety.localeCompare(b.classificationSociety);
    else if (fleetSortField === 'status') comp = a.status.localeCompare(b.status);
    else if (fleetSortField === 'readiness') comp = calculateVesselReadiness(a, assuranceSets, documents) - calculateVesselReadiness(b, assuranceSets, documents);
    return fleetSortDirection === 'asc' ? comp : -comp;
  });

  const cAdminProjectsPagination = usePagination(sortedCAdminProjects, [cAdminProjectSearchTerm, cAdminProjectSortField, cAdminProjectSortDirection]);
  const cAdminSetsPagination = usePagination(sortedCAdminSets, [cAdminSearchTerm, cAdminStageFilter, cAdminSortField, cAdminSortDirection]);
  const submitterSetsPagination = usePagination(sortedSubmitterSets, [submitterSearchTerm, submitterTableFilter, submitterSortField, submitterSortDirection]);
  const fleetPagination = usePagination(sortedFleetVessels, [fleetSortField, fleetSortDirection]);

  const relevantSetsForPerformance = useMemo(() => {
    if (activePersona === 'C Admin') return cAdminAssuranceSets;
    if (activePersona === 'Submitter') return visibleSubmitterSets;
    return assuranceSets;
  }, [activePersona, cAdminAssuranceSets, visibleSubmitterSets, assuranceSets]);

  const performanceSummary = useMemo(
    () => getFleetPerformanceSummary(relevantSetsForPerformance, capaItems),
    [relevantSetsForPerformance, capaItems],
  );

  const adminVesselIds = useMemo(
    () => new Set(visibleVessels.map((v) => v.id)),
    [visibleVessels],
  );

  const needsActionItems = useMemo(() => {
    interface ActionRowItem {
      id: string;
      kind: 'expiring_certificate' | 'returned_document' | 'overdue_capa';
      kindLabel: string;
      title: string;
      vesselId?: string;
      vesselName: string;
      dateStr: string;
      dateMs: number;
      isExpiry: boolean;
      status: string;
      actionView: string;
      actionEntityId?: string;
    }

    const expCerts: ActionRowItem[] = [];
    documents.forEach((d) => {
      if (isExpiringWithinWarning(d.expiryDate) && d.vesselId && adminVesselIds.has(d.vesselId)) {
        const v = visibleVessels.find((ves) => ves.id === d.vesselId);
        expCerts.push({
          id: d.id,
          kind: 'expiring_certificate',
          kindLabel: 'Expiring Certificate',
          title: d.title,
          vesselId: d.vesselId,
          vesselName: v?.name || d.vesselAttributes?.vesselName || 'Unknown Vessel',
          dateStr: d.expiryDate,
          dateMs: new Date(d.expiryDate).getTime(),
          isExpiry: true,
          status: 'Expiring Soon',
          actionView: 'documents',
          actionEntityId: d.id,
        });
      }
    });
    expCerts.sort((a, b) => a.dateMs - b.dateMs);

    const expCertDocIds = new Set(expCerts.map((i) => i.id));

    const returnedDocs: ActionRowItem[] = [];
    documents.forEach((d) => {
      if (
        (d.verificationStatus === 'Correction Requested' || d.verificationStatus === 'Rejected') &&
        d.vesselId &&
        adminVesselIds.has(d.vesselId) &&
        !expCertDocIds.has(d.id)
      ) {
        const v = visibleVessels.find((ves) => ves.id === d.vesselId);
        returnedDocs.push({
          id: d.id,
          kind: 'returned_document',
          kindLabel: 'Returned for Correction',
          title: d.title,
          vesselId: d.vesselId,
          vesselName: v?.name || d.vesselAttributes?.vesselName || 'Unknown Vessel',
          dateStr: d.expiryDate,
          dateMs: new Date(d.expiryDate).getTime(),
          isExpiry: true,
          status: d.verificationStatus || 'Correction Requested',
          actionView: 'documents',
          actionEntityId: d.id,
        });
      }
    });
    returnedDocs.sort((a, b) => a.dateMs - b.dateMs);

    const overdueCapas: ActionRowItem[] = [];
    const now = Date.now();
    capaItems.forEach((c) => {
      if (c.vesselId && adminVesselIds.has(c.vesselId) && c.status !== 'Verified & Closed') {
        const dateMs = new Date(c.dueDate).getTime();
        if (!Number.isNaN(dateMs) && dateMs < now) {
          overdueCapas.push({
            id: c.id,
            kind: 'overdue_capa',
            kindLabel: 'Overdue CAPA',
            title: c.title,
            vesselId: c.vesselId,
            vesselName: c.vesselName,
            dateStr: c.dueDate,
            dateMs,
            isExpiry: false,
            status: c.status,
            actionView: 'capa',
            actionEntityId: c.vesselName,
          });
        }
      }
    });
    overdueCapas.sort((a, b) => a.dateMs - b.dateMs);

    const targetCount = 8;
    const selected: ActionRowItem[] = [];
    const minPerCategory = 2;
    const expPick = expCerts.slice(0, minPerCategory);
    const retPick = returnedDocs.slice(0, minPerCategory);
    const capaPick = overdueCapas.slice(0, minPerCategory);

    selected.push(...expPick, ...retPick, ...capaPick);

    const pickedIds = new Set(selected.map((i) => i.id));
    const pool = [...expCerts, ...returnedDocs, ...overdueCapas].filter((i) => !pickedIds.has(i.id));
    pool.sort((a, b) => a.dateMs - b.dateMs);

    const needed = targetCount - selected.length;
    if (needed > 0) {
      selected.push(...pool.slice(0, needed));
    }

    selected.sort((a, b) => a.dateMs - b.dateMs);
    return selected.slice(0, targetCount);
  }, [documents, capaItems, adminVesselIds, visibleVessels]);

  /* these roles get their own workspace; the check sits below every hook so the hook order never changes */
  if (activePersona === 'Verifier') {
    return <VerifierWorkspaceView />;
  }

  if (activePersona === 'Inspector') {
    return <InspectorWorkspaceView />;
  }

  if (activePersona === 'Approver') {
    return <ApproverDashboardView />;
  }

  const handleFleetSort = (field: 'name' | 'imoNumber' | 'flagState' | 'classificationSociety' | 'status' | 'readiness') => {
    if (fleetSortField === field) {
      setFleetSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setFleetSortField(field);
      setFleetSortDirection('asc');
    }
  };

  /* compute role-specific top summary metrics for activePersona */
  const renderDashboardCards = () => {
    if (activePersona === 'Submitter') {
      const assignedSets = filterAssuranceSetsForSession(
        assuranceSets,
        'Submitter',
        activeDemoOrganization,
        sessionUser,
      );
      const pendingUploads = documents.filter((d) => d.verificationStatus === 'Pending').length;
      const revisionsRequested = documents.filter(
        (d) => d.verificationStatus === 'Correction Requested' || d.verificationStatus === 'Rejected'
      ).length;
      const dueThisWeekSetsCount = assignedSets.filter((s) => isSetDueThisWeek(s)).length;

      return (
        <div className="row g-3">
          <div className="col-md-3">
            <button
              type="button"
              className={`card map-kpi-card map-kpi-clickable shadow-2xs ${submitterTableFilter === 'ALL' ? 'map-kpi-selected' : ''}`}
              onClick={() => setSubmitterTableFilter('ALL')}
              aria-label={`Open ${assignedSets.length} assigned assurance sets`}
              aria-pressed={submitterTableFilter === 'ALL'}
            >
              <div className="map-kpi-label">
                Assurance Sets
              </div>
              <div className="map-kpi-value text-primary mt-1">{assignedSets.length}</div>
              <div className="map-kpi-subtitle mt-1">Assigned to you</div>
            </button>
          </div>

          <div className="col-md-3">
            <button
              type="button"
              className={`card map-kpi-card map-kpi-clickable shadow-2xs ${submitterTableFilter === 'awaiting_upload' ? 'map-kpi-selected' : ''}`}
              onClick={() => setSubmitterTableFilter((p) => p === 'awaiting_upload' ? 'ALL' : 'awaiting_upload')}
              aria-label={`Open ${pendingUploads} documents awaiting upload`}
              aria-pressed={submitterTableFilter === 'awaiting_upload'}
            >
              <div className="map-kpi-label">
                Awaiting Upload
              </div>
              <div className="map-kpi-value text-warning mt-1">{pendingUploads}</div>
              <div className="map-kpi-subtitle mt-1">Documents still to upload</div>
            </button>
          </div>

          <div className="col-md-3">
            <button
              type="button"
              className={`card map-kpi-card map-kpi-clickable shadow-2xs ${submitterTableFilter === 'returned' ? 'map-kpi-selected' : ''}`}
              onClick={() => setSubmitterTableFilter((p) => p === 'returned' ? 'ALL' : 'returned')}
              aria-label={`Open ${revisionsRequested} documents returned for correction`}
              aria-pressed={submitterTableFilter === 'returned'}
            >
              <div className="map-kpi-label">
                Returned for Correction
              </div>
              <div className="map-kpi-value text-danger mt-1">{revisionsRequested}</div>
              <div className="map-kpi-subtitle mt-1">Documents to fix and upload again</div>
            </button>
          </div>

          <div className="col-md-3">
            <button
              type="button"
              className={`card map-kpi-card map-kpi-clickable shadow-2xs ${submitterTableFilter === 'due_this_week' ? 'map-kpi-selected' : ''}`}
              onClick={() => setSubmitterTableFilter((p) => p === 'due_this_week' ? 'ALL' : 'due_this_week')}
              aria-label={`Open ${dueThisWeekSetsCount} assurance sets due this week`}
              aria-pressed={submitterTableFilter === 'due_this_week'}
            >
              <div className="map-kpi-label">
                Due this week
              </div>
              <div className="map-kpi-value text-warning mt-1">{dueThisWeekSetsCount}</div>
              <div className="map-kpi-subtitle mt-1">Sets with a requirement due in 7 days</div>
            </button>
          </div>
        </div>
      );
    }

    if (activePersona === 'C Admin') {
      const totalCreated = cAdminAssuranceSets.length;
      const activeCampaigns = cAdminAssuranceSets.filter((s) => s.stage !== 'Certified' && s.stage !== 'Approved').length;
      const certifiedCampaigns = cAdminAssuranceSets.filter((s) => s.stage === 'Certified' || s.stage === 'Approved' || s.approverDecision === 'Approved').length;
      const avgCampaignReadiness = Math.round(
        cAdminAssuranceSets.reduce((acc: number, s) => acc + calculateAssuranceSetReadiness(s), 0) / (totalCreated || 1)
      );

      return (
        <div className="row g-3">
          <div className="col-md-3">
            <button
              type="button"
              className={`card map-kpi-card map-kpi-clickable shadow-2xs ${cAdminStageFilter === 'ALL' ? 'map-kpi-selected' : ''}`}
              onClick={() => setCAdminStageFilter('ALL')}
              aria-label={`Open ${totalCreated} assurance sets`}
              aria-pressed={cAdminStageFilter === 'ALL'}
            >
              <div className="map-kpi-label">
                Assurance Sets
              </div>
              <div className="map-kpi-value text-primary mt-1">{totalCreated}</div>
              <div className="map-kpi-subtitle mt-1">Created by your organization</div>
            </button>
          </div>

          <div className="col-md-3">
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                Average Readiness
              </div>
              <div className={`map-kpi-value ${getReadinessTextClass(avgCampaignReadiness)} mt-1`}>{avgCampaignReadiness}%</div>
              <div className="map-kpi-subtitle mt-1">Across your assurance sets</div>
            </div>
          </div>

          <div className="col-md-3">
            <button
              type="button"
              className={`card map-kpi-card map-kpi-clickable shadow-2xs ${cAdminStageFilter === 'in_progress' ? 'map-kpi-selected' : ''}`}
              onClick={() => setCAdminStageFilter((p) => p === 'in_progress' ? 'ALL' : 'in_progress')}
              aria-label={`Open ${activeCampaigns} in progress assurance sets`}
              aria-pressed={cAdminStageFilter === 'in_progress'}
            >
              <div className="map-kpi-label">
                In Progress
              </div>
              <div className="map-kpi-value text-warning mt-1">{activeCampaigns}</div>
              <div className="map-kpi-subtitle mt-1">Being verified or reviewed</div>
            </button>
          </div>

          <div className="col-md-3">
            <button
              type="button"
              className={`card map-kpi-card map-kpi-clickable shadow-2xs ${cAdminStageFilter === 'approved' ? 'map-kpi-selected' : ''}`}
              onClick={() => setCAdminStageFilter((p) => p === 'approved' ? 'ALL' : 'approved')}
              aria-label={`Open ${certifiedCampaigns} approved assurance sets`}
              aria-pressed={cAdminStageFilter === 'approved'}
            >
              <div className="map-kpi-label">
                Approved
              </div>
              <div className="map-kpi-value text-primary mt-1">{certifiedCampaigns}</div>
              <div className="map-kpi-subtitle mt-1">Approved assurance sets</div>
            </button>
          </div>
        </div>
      );
    }

    const expiringDocsCount = documents.filter((d) => isExpiringWithinWarning(d.expiryDate)).length;

    return (
      <div className="row g-3">
        <div className="col-md-3">
          <button
            type="button"
            className="card map-kpi-card map-kpi-clickable shadow-2xs"
            onClick={() => setCurrentHashView('vessels')}
            aria-label={`Open ${totalVessels} vessels in your fleet`}
          >
            <div className="map-kpi-label">
              Vessels
            </div>
            <div className="map-kpi-value text-primary mt-1">{totalVessels}</div>
            <div className="map-kpi-subtitle mt-1">In your fleet</div>
          </button>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Average Readiness
            </div>
            <div className={`map-kpi-value ${getReadinessTextClass(avgReadiness)} mt-1`}>{avgReadiness}%</div>
            <div className="map-kpi-subtitle mt-1">Across your fleet</div>
          </div>
        </div>

        <div className="col-md-3">
          <button
            type="button"
            className="card map-kpi-card map-kpi-clickable shadow-2xs"
            onClick={() => setCurrentHashView('assurance-sets')}
            aria-label={`Open ${activeAssurances} in progress assurance sets`}
          >
            <div className="map-kpi-label">
              Assurance Sets
            </div>
            <div className="map-kpi-value text-warning mt-1">{activeAssurances}</div>
            <div className="map-kpi-subtitle mt-1">In progress</div>
          </button>
        </div>

        <div className="col-md-3">
          <button
            type="button"
            className="card map-kpi-card map-kpi-clickable shadow-2xs"
            onClick={() => {
              try {
                sessionStorage.setItem('map_doc_tab_preselect', 'Expiring < 6 Mos');
              } catch {
                /* ignore */
              }
              (window as any).__MAP_DOC_TAB_PRESELECT = 'Expiring < 6 Mos';
              setCurrentHashView('documents');
            }}
            aria-label={`Open ${expiringDocsCount} documents expiring soon`}
          >
            <div className="map-kpi-label">
              Expiring Soon
            </div>
            <div className="map-kpi-value text-danger mt-1">{expiringDocsCount}</div>
            <div className="map-kpi-subtitle mt-1">Documents expiring within {EXPIRY_WARNING_DAYS} days</div>
          </button>
        </div>
      </div>
    );
  };

  const submitterRevisions =
    activePersona === 'Submitter'
      ? documents.filter(
        (d) => d.verificationStatus === 'Correction Requested' || d.verificationStatus === 'Rejected'
      ).length
      : 0;

  return (
    <div className="d-flex flex-column gap-4">
      <style>{`
        .map-kpi-clickable {
          cursor: pointer;
          text-align: left;
          width: 100%;
          border: 1px solid var(--map-border-color, #e2e8f0);
          background-color: var(--map-bg-card, #ffffff);
          transition: transform 0.1s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .map-kpi-clickable:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .map-kpi-clickable:focus-visible {
          outline: 2px solid var(--map-focus-ring, rgb(56, 189, 248));
          outline-offset: var(--map-focus-ring-offset, 2px);
        }
        .map-kpi-clickable.map-kpi-selected {
          border-color: var(--map-focus-ring, rgb(56, 189, 248));
          box-shadow: 0 0 0 1px var(--map-focus-ring, rgb(56, 189, 248));
        }
      `}</style>
      {/* top banner kpi summary cards */}
      {renderDashboardCards()}
      {/* main content area: c admin & submitter display assurance sets; other personas display fleet overview */}
      {activePersona === 'C Admin' ? (
        <div className="row g-4">
          {/* projects table — left half */}
          <div className="col-lg-6">
            <div className="card map-card-custom h-100">
              <div className="card-header d-flex flex-wrap align-items-center justify-between gap-2">
                <span className="fw-bold text-dark">Projects</span>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search projects..."
                    value={cAdminProjectSearchTerm}
                    onChange={(e) => setCAdminProjectSearchTerm(e.target.value)}
                    style={{ width: '160px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setCurrentHashView('project', 'new')}
                  >
                    Create Project
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table map-table-custom align-middle mb-0">
                    <thead>
                      <tr>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleCAdminProjectSort('name')}
                        >
                          Name {renderSortIndicator(cAdminProjectSortField, 'name', cAdminProjectSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleCAdminProjectSort('status')}
                        >
                          Status {renderSortIndicator(cAdminProjectSortField, 'status', cAdminProjectSortDirection)}
                        </th>
                        <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCAdminProjects.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-muted">
                            No projects found.
                          </td>
                        </tr>
                      ) : (
                        cAdminProjectsPagination.pageItems.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => setCurrentHashView('project', p.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <div className="fw-semibold text-slate-900">{p.name}</div>
                              <div className="small text-muted">{p.projectType}</div>
                            </td>
                            <td>
                              <span className="badge bg-secondary">{p.status}</span>
                            </td>
                            <td className="text-end" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => setCurrentHashView('project', p.id)}
                                title="View"
                                aria-label="View"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePagination {...cAdminProjectsPagination.controls} />
              </div>
            </div>
          </div>

          {/* assurance sets table — right half */}
          <div className="col-lg-6">
            <div className="card map-card-custom h-100">
              <div className="card-header d-flex flex-wrap align-items-center justify-between gap-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold text-dark">Assurance Sets</span>
                  {cAdminStageFilter !== 'ALL' && (
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 font-mono-code">
                      {cAdminStageFilter === 'in_progress' ? 'Filter: In progress' : 'Filter: Approved'}
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '0.5rem' }}
                        aria-label="Clear stage filter"
                        onClick={() => setCAdminStageFilter('ALL')}
                      />
                    </span>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search assurance sets..."
                    value={cAdminSearchTerm}
                    onChange={(e) => setCAdminSearchTerm(e.target.value)}
                    style={{ width: '160px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setCurrentHashView('create-assurance-set')}
                  >
                    Create Assurance Set
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table map-table-custom align-middle mb-0">
                    <thead>
                      <tr>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleCAdminSort('title')}
                        >
                          Title {renderSortIndicator(cAdminSortField, 'title', cAdminSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleCAdminSort('scope')}
                        >
                          Scope {renderSortIndicator(cAdminSortField, 'scope', cAdminSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleCAdminSort('stage')}
                        >
                          Stage {renderSortIndicator(cAdminSortField, 'stage', cAdminSortDirection)}
                        </th>
                        <th style={{ whiteSpace: 'nowrap' }}>On-Time</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Findings</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Remaining</th>
                        <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCAdminSets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-4 text-muted">
                            No assurance sets found.
                          </td>
                        </tr>
                      ) : (
                        cAdminSetsPagination.pageItems.map((s) => {
                          const onTime = getAssuranceSetOnTimeStatus(s);
                          const openFindings = getAssuranceSetOpenFindingsCount(s, capaItems);
                          const remaining = getAssuranceSetRemainingItems(s);
                          return (
                            <tr
                              key={s.id}
                              onClick={() => setCurrentHashView('assurance-sets', s.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>
                                <div className="fw-semibold text-slate-900">{s.title}</div>
                                <div className="small text-muted">{s.initiatorOrg}</div>
                              </td>
                              <td>{getScopeLabel(s)}</td>
                              <td>
                                <StatusBadge value={s.stage} />
                              </td>
                              <td>
                                <span className={`badge font-mono-code ${onTime.isOnTime ? 'bg-success-subtle text-success-emphasis border border-success-subtle' : 'bg-danger text-white'}`} title={onTime.detail}>
                                  {onTime.statusLabel}{!onTime.isOnTime && onTime.lateItemsCount > 0 ? ` (${onTime.lateItemsCount})` : ''}
                                </span>
                              </td>
                              <td>
                                {openFindings > 0 ? (
                                  <span className="badge bg-warning text-dark font-mono-code">
                                    {openFindings} open
                                  </span>
                                ) : (
                                  <span className="text-muted font-mono-code small">0</span>
                                )}
                              </td>
                              <td>
                                <div className="small font-mono-code text-dark">
                                  {remaining.remainingTasks} {remaining.remainingTasks === 1 ? 'task' : 'tasks'}
                                </div>
                                <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                                  {remaining.remainingCertificates} {remaining.remainingCertificates === 1 ? 'cert' : 'certs'}
                                </div>
                              </td>
                              <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={() => setCurrentHashView('assurance-sets', s.id)}
                                  title="View"
                                  aria-label="View"
                                >
                                  <Eye size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePagination {...cAdminSetsPagination.controls} />
              </div>
            </div>
          </div>
        </div>
      ) : activePersona === 'Submitter' ? (
        <div className="row g-4">
          <div className="col-12">
            <div className="card map-card-custom">
              <div className="card-header d-flex flex-wrap align-items-center justify-between gap-2 p-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="fw-bold text-dark">
                    Assurance Sets
                  </div>
                  {submitterTableFilter !== 'ALL' && (
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 font-mono-code">
                      {submitterTableFilter === 'awaiting_upload' && 'Filter: Awaiting upload'}
                      {submitterTableFilter === 'returned' && 'Filter: Returned for correction'}
                      {submitterTableFilter === 'due_this_week' && 'Filter: Due this week'}
                      <button
                        type="button"
                        className="btn-close"
                        style={{ fontSize: '0.5rem' }}
                        aria-label="Clear filter"
                        onClick={() => setSubmitterTableFilter('ALL')}
                      />
                    </span>
                  )}
                </div>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  <input
                    type="text"
                    className="form-control form-control-sm bg-white text-dark border-secondary"
                    placeholder="Search assurance sets..."
                    value={submitterSearchTerm}
                    onChange={(e) => setSubmitterSearchTerm(e.target.value)}
                    style={{ width: '240px' }}
                  />
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table map-table-custom align-middle mb-0">
                    <thead>
                      <tr>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleSubmitterSort('id')}
                        >
                          Set ID {renderSortIndicator(submitterSortField, 'id', submitterSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', minWidth: '280px' }}
                          onClick={() => handleSubmitterSort('title')}
                        >
                          Title {renderSortIndicator(submitterSortField, 'title', submitterSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleSubmitterSort('charterWindowStart')}
                        >
                          Contract Period {renderSortIndicator(submitterSortField, 'charterWindowStart', submitterSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleSubmitterSort('stage')}
                        >
                          Stage {renderSortIndicator(submitterSortField, 'stage', submitterSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleSubmitterSort('readinessScore')}
                        >
                          Readiness {renderSortIndicator(submitterSortField, 'readinessScore', submitterSortDirection)}
                        </th>
                        <th style={{ whiteSpace: 'nowrap' }}>On-Time</th>
                        <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSubmitterSets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-4 text-muted">
                            No assurance sets found.
                          </td>
                        </tr>
                      ) : (
                        submitterSetsPagination.pageItems.map((s) => {
                          const returnedDocs = s.requirements.filter((r) => {
                            const linkedDoc = documents.find((d) => d.id === r.documentId || (r.linkedDocumentId && d.id === r.linkedDocumentId));
                            return (
                              r.verifierStatus === 'Correction Requested' ||
                              r.verifierStatus === 'Rejected' ||
                              linkedDoc?.verificationStatus === 'Correction Requested' ||
                              linkedDoc?.verificationStatus === 'Rejected'
                            );
                          });
                          const returnedCount = returnedDocs.length;
                          const openFindings = getAssuranceSetOpenFindingsCount(s, capaItems);
                          const remaining = getAssuranceSetRemainingItems(s);

                          return (
                            <tr
                              key={s.id}
                              onClick={() => setCurrentHashView('assurance-sets', s.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="fw-semibold text-primary font-mono-code">{s.id}</td>
                              <td style={{ minWidth: '280px' }}>
                                <div className="fw-semibold text-slate-900">{s.title}</div>
                                <div className="small text-muted mt-0.5 d-flex flex-wrap align-items-center gap-1.5">
                                  <span className="fw-medium text-dark">{s.vesselName}</span>
                                  {s.imoNumber && <span className="font-mono-code">· IMO {s.imoNumber}</span>}
                                  <span>·</span>
                                  <span className={openFindings > 0 ? 'text-warning-emphasis fw-medium font-mono-code' : 'font-mono-code'}>
                                    {openFindings} {openFindings === 1 ? 'finding' : 'findings'}
                                  </span>
                                  <span>·</span>
                                  <span className="font-mono-code">
                                    {remaining.remainingTasks} {remaining.remainingTasks === 1 ? 'task' : 'tasks'}, {remaining.remainingCertificates} {remaining.remainingCertificates === 1 ? 'cert' : 'certs'} remaining
                                  </span>
                                </div>
                              </td>
                              <td className="small font-mono-code text-muted">
                                {s.charterWindowStart && s.charterWindowEnd
                                  ? `${formatMaritimeDate(s.charterWindowStart)} – ${formatMaritimeDate(s.charterWindowEnd)}`
                                  : 'Not specified'}
                              </td>
                              <td>
                                <StatusBadge value={s.stage} />
                              </td>
                              <td>
                                <ReadinessGauge score={calculateAssuranceSetReadiness(s)} size="sm" />
                              </td>
                              <td>
                                {(() => {
                                  const onTime = getAssuranceSetOnTimeStatus(s);
                                  return (
                                    <span className={`badge font-mono-code ${onTime.isOnTime ? 'bg-success-subtle text-success-emphasis border border-success-subtle' : 'bg-danger text-white'}`} title={onTime.detail}>
                                      {onTime.statusLabel}{!onTime.isOnTime && onTime.lateItemsCount > 0 ? ` (${onTime.lateItemsCount})` : ''}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                <div className="d-flex align-items-center justify-content-end gap-1.5">
                                  {returnedCount > 0 && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                                      style={{ width: '32px', height: '32px' }}
                                      onClick={() => setSelectedReturnedSet(s)}
                                      title={`View ${returnedCount} returned or rejected document(s)`}
                                      aria-label={`View ${returnedCount} returned or rejected document(s)`}
                                    >
                                      <AlertTriangle size={16} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                    style={{ width: '32px', height: '32px' }}
                                    onClick={() => setCurrentHashView('assurance-sets', s.id)}
                                    title="View"
                                    aria-label="View"
                                  >
                                    <Eye size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePagination {...submitterSetsPagination.controls} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Needs action card for Administrator */}
          <div className="col-12">
            <div className="card map-card-custom">
              <div className="card-header d-flex align-items-center justify-between">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold text-dark">Needs action</span>
                  <span className="badge bg-danger-subtle text-danger-emphasis border border-danger-subtle font-mono-code">
                    {needsActionItems.length}
                  </span>
                </div>
                <span className="small text-muted">
                  Certificates expiring, returned documents, and overdue CAPA
                </span>
              </div>
              <div className="card-body p-0">
                {needsActionItems.length === 0 ? (
                  <div className="p-4 text-center text-muted">
                    No urgent actions required. All items are up to date.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table map-table-custom align-middle mb-0" aria-label="Needs action items">
                      <thead>
                        <tr>
                          <th style={{ whiteSpace: 'nowrap' }}>Identifier</th>
                          <th style={{ whiteSpace: 'nowrap' }}>Item</th>
                          <th style={{ whiteSpace: 'nowrap' }}>Vessel</th>
                          <th style={{ whiteSpace: 'nowrap' }}>Due / Expiry</th>
                          <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                          <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {needsActionItems.map((item) => (
                          <tr
                            key={item.id}
                            data-date-ms={item.dateMs}
                            onClick={() => setCurrentHashView(item.actionView, item.actionEntityId)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="font-mono-code fw-semibold text-primary">{item.id}</td>
                            <td>
                              <div className="fw-semibold text-slate-900">{item.title}</div>
                              <div className="small text-muted">{item.kindLabel}</div>
                            </td>
                            <td className="fw-medium text-dark">{item.vesselName}</td>
                            <td>
                              <DueCell
                                date={item.dateStr}
                                isExpiry={item.isExpiry}
                                isClosed={false}
                              />
                            </td>
                            <td>
                              <StatusBadge value={item.status} />
                            </td>
                            <td className="text-end" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => setCurrentHashView(item.actionView, item.actionEntityId)}
                                title="View"
                                aria-label={`View ${item.title}`}
                              >
                                <Eye size={16} />
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
          </div>

          <div className="col-12">
            <div className="card map-card-custom">
              <div className="card-header d-flex align-items-center justify-between">
                <span>Vessels</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setCurrentHashView('vessels')}
                >
                  View All
                </button>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table map-table-custom align-middle mb-0">
                    <thead>
                      <tr>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleFleetSort('imoNumber')}
                        >
                          IMO Number {renderSortIndicator(fleetSortField, 'imoNumber', fleetSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleFleetSort('name')}
                        >
                          Name {renderSortIndicator(fleetSortField, 'name', fleetSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleFleetSort('flagState')}
                        >
                          Flag State {renderSortIndicator(fleetSortField, 'flagState', fleetSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleFleetSort('classificationSociety')}
                        >
                          Class Society {renderSortIndicator(fleetSortField, 'classificationSociety', fleetSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleFleetSort('status')}
                        >
                          Operating Status {renderSortIndicator(fleetSortField, 'status', fleetSortDirection)}
                        </th>
                        <th
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleFleetSort('readiness')}
                        >
                          Readiness {renderSortIndicator(fleetSortField, 'readiness', fleetSortDirection)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleetPagination.pageItems.map((v) => (
                        <tr
                          key={v.id}
                          onClick={() => setCurrentHashView('vessels', v.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="font-mono-code fw-semibold text-primary">{v.imoNumber}</td>
                          <td className="fw-semibold text-dark">{v.name}</td>
                          <td>{v.flagState}</td>
                          <td>
                            <span className="badge bg-light text-dark border">{v.classificationSociety}</span>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">{v.status}</span>
                          </td>
                          <td>
                            <ReadinessGauge score={calculateVesselReadiness(v, assuranceSets, documents)} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination {...fleetPagination.controls} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Returned Documents & Resubmission Drawer for Submitter */}
      {selectedReturnedSet && (
        <ReturnedDocumentsDrawer
          assuranceSet={selectedReturnedSet}
          onClose={() => setSelectedReturnedSet(null)}
          onReview={(doc, notes) => setReviewDrawerDoc({ doc, notes })}
          onUpload={(req, doc) => setUploadModalTarget({ req, doc })}
          onViewAssuranceSet={(setId) => {
            setSelectedReturnedSet(null);
            setCurrentHashView('assurance-sets', setId);
          }}
          paused={Boolean(uploadModalTarget)}
        />
      )}

      {/* Review Drawer opened from Returned Queue */}
      <DocumentReviewDrawer
        document={reviewDrawerDoc?.doc || null}
        requirementNotes={reviewDrawerDoc?.notes}
        onClose={() => setReviewDrawerDoc(null)}
      />

      {/* Upload Modal opened from Returned Queue */}
      {uploadModalTarget && (
        <DocumentUploadModal
          isOpen={Boolean(uploadModalTarget)}
          onClose={() => setUploadModalTarget(null)}
          existingDocument={uploadModalTarget.doc || null}
          assuranceSetId={selectedReturnedSet?.id}
          requirementId={uploadModalTarget.req.id}
          requirementTitle={uploadModalTarget.req.title}
          requirementCategory={uploadModalTarget.req.category}
          defaultVesselId={selectedReturnedSet?.vesselId}
          onUploadComplete={() => {
            setUploadModalTarget(null);
          }}
        />
      )}
    </div>
  );
};
