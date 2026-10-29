import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { StatusBadge } from '../components/common/StatusBadge';
import { ListToolbar } from '../components/common/ListToolbar';
import { VerifierWorkspaceView } from './VerifierWorkspaceView';
import { InspectorWorkspaceView } from './InspectorWorkspaceView';
import { ApproverDashboardView } from './ApproverDashboardView';
import { Vessel } from '../types/vessel';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { isAssuranceSetAssignedToPersona, filterVesselsForPersona } from '../utils/rbacHelpers';
import {
  calculateAssuranceSetReadiness,
  calculateVesselReadiness,
  getAssuranceSetOnTimeStatus,
  getAssuranceSetOpenFindingsCount,
  getAssuranceSetRemainingItems,
  getFleetPerformanceSummary,
} from '../utils/readinessHelpers';
import { getAssuranceSetScopes } from '../utils/assuranceTemplates';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { ReturnedDocumentsDrawer } from '../components/drawers/ReturnedDocumentsDrawer';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { filterProjectsForPersona } from '../utils/projectHelpers';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

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
  const [cAdminSearchTerm, setCAdminSearchTerm] = useState('');
  const [cAdminProjectSearchTerm, setCAdminProjectSearchTerm] = useState('');
  const [cAdminSortField, setCAdminSortField] = useState<'title' | 'scope' | 'charterWindowStart' | 'stage'>('title');
  const [cAdminSortDirection, setCAdminSortDirection] = useState<'asc' | 'desc'>('asc');
  const [cAdminProjectSortField, setCAdminProjectSortField] = useState<'name' | 'status'>('name');
  const [cAdminProjectSortDirection, setCAdminProjectSortDirection] = useState<'asc' | 'desc'>('asc');
  const [submitterSearchTerm, setSubmitterSearchTerm] = useState('');
  const [submitterSortField, setSubmitterSortField] = useState<'id' | 'title' | 'stage' | 'readinessScore'>('id');
  const [submitterSortDirection, setSubmitterSortDirection] = useState<'asc' | 'desc'>('asc');
  const [fleetSearchTerm, setFleetSearchTerm] = useState('');
  const [fleetSortField, setFleetSortField] = useState<'name' | 'imoNumber' | 'flagState' | 'classificationSociety' | 'status' | 'readiness'>('name');
  const [fleetSortDirection, setFleetSortDirection] = useState<'asc' | 'desc'>('asc');

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

  /* c admin specific assurance sets */
  const cAdminAssuranceSets = assuranceSets.filter((s) => isAssuranceSetAssignedToPersona(s, 'C Admin', activeDemoOrganization));

  /* every scope a set covers as one label, shared by the c admin scope cell, sort and search */
  const getScopeLabel = (s: AssuranceSet) => getAssuranceSetScopes(s).join(', ');

  /* submitter specific assurance sets */
  const submitterAssuranceSets = assuranceSets.filter((s) => isAssuranceSetAssignedToPersona(s, 'Submitter', activeDemoOrganization));
  const visibleSubmitterSets = submitterAssuranceSets.length > 0 ? submitterAssuranceSets : assuranceSets;

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

  const filteredSubmitterSets = visibleSubmitterSets.filter((s) => {
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
    else if (submitterSortField === 'stage') comp = a.stage.localeCompare(b.stage);
    else if (submitterSortField === 'readinessScore') comp = calculateAssuranceSetReadiness(a) - calculateAssuranceSetReadiness(b);
    return submitterSortDirection === 'asc' ? comp : -comp;
  });

  const handleSubmitterSort = (field: 'id' | 'title' | 'stage' | 'readinessScore') => {
    if (submitterSortField === field) {
      setSubmitterSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setSubmitterSortField(field);
      setSubmitterSortDirection('asc');
    }
  };

  const filteredFleetVessels = useMemo(() => {
    const term = fleetSearchTerm.toLowerCase();
    if (!term) return visibleVessels;
    return visibleVessels.filter(
      (v) =>
        v.name.toLowerCase().includes(term) ||
        v.imoNumber.includes(term) ||
        v.flagState.toLowerCase().includes(term) ||
        v.classificationSociety.toLowerCase().includes(term) ||
        v.status.toLowerCase().includes(term),
    );
  }, [visibleVessels, fleetSearchTerm]);

  const sortedFleetVessels = useMemo(() => {
    return [...filteredFleetVessels].sort((a, b) => {
      let comp = 0;
      if (fleetSortField === 'name') comp = a.name.localeCompare(b.name);
      else if (fleetSortField === 'imoNumber') comp = a.imoNumber.localeCompare(b.imoNumber);
      else if (fleetSortField === 'flagState') comp = a.flagState.localeCompare(b.flagState);
      else if (fleetSortField === 'classificationSociety') comp = a.classificationSociety.localeCompare(b.classificationSociety);
      else if (fleetSortField === 'status') comp = a.status.localeCompare(b.status);
      else if (fleetSortField === 'readiness') comp = calculateVesselReadiness(a, assuranceSets, documents) - calculateVesselReadiness(b, assuranceSets, documents);
      return fleetSortDirection === 'asc' ? comp : -comp;
    });
  }, [filteredFleetVessels, fleetSortField, fleetSortDirection, assuranceSets, documents]);

  const cAdminProjectsPagination = usePagination(sortedCAdminProjects, [cAdminProjectSearchTerm, cAdminProjectSortField, cAdminProjectSortDirection]);
  const cAdminSetsPagination = usePagination(sortedCAdminSets, [cAdminSearchTerm, cAdminSortField, cAdminSortDirection]);
  const submitterSetsPagination = usePagination(sortedSubmitterSets, [submitterSearchTerm, submitterSortField, submitterSortDirection]);
  const fleetPagination = usePagination(sortedFleetVessels, [fleetSearchTerm, fleetSortField, fleetSortDirection]);

  const relevantSetsForPerformance = useMemo(() => {
    if (activePersona === 'C Admin') return cAdminAssuranceSets;
    if (activePersona === 'Submitter') return visibleSubmitterSets;
    return assuranceSets;
  }, [activePersona, cAdminAssuranceSets, visibleSubmitterSets, assuranceSets]);

  const performanceSummary = useMemo(
    () => getFleetPerformanceSummary(relevantSetsForPerformance, capaItems),
    [relevantSetsForPerformance, capaItems],
  );

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

  return (
    <div className="d-flex flex-column gap-4">
      {/* Performance strip: on-time completion, open findings, remaining tasks & certificates */}
      <div className="card map-card-custom p-3 bg-white border">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold text-dark font-mono-code" style={{ fontSize: '0.8rem', letterSpacing: '0.05em' }}>
              PERFORMANCE
            </span>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-4 ms-auto small">
            <div>
              <span className="text-secondary me-1.5">On-Time Status:</span>
              <span className={`fw-semibold font-mono-code ${performanceSummary.lateSets > 0 ? 'text-danger' : 'text-success'}`}>
                {performanceSummary.onTimeSets} / {performanceSummary.totalSets} on time {performanceSummary.lateSets > 0 ? `(${performanceSummary.lateSets} late)` : ''}
              </span>
            </div>
            <div className="border-start ps-3">
              <span className="text-secondary me-1.5">Open Findings:</span>
              <span className={`fw-semibold font-mono-code ${performanceSummary.openFindings > 0 ? 'text-warning-emphasis' : 'text-success'}`}>
                {performanceSummary.openFindings} {performanceSummary.openFindings === 1 ? 'finding' : 'findings'}
              </span>
            </div>
            <div className="border-start ps-3">
              <span className="text-secondary me-1.5">Remaining Work:</span>
              <span className="fw-semibold font-mono-code text-dark">
                {performanceSummary.remainingTasks} {performanceSummary.remainingTasks === 1 ? 'task' : 'tasks'} · {performanceSummary.remainingCertificates} {performanceSummary.remainingCertificates === 1 ? 'certificate' : 'certificates'}
              </span>
            </div>
          </div>
        </div>
      </div>

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
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setCurrentHashView('project')}
                  >
                    View All
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
                              <StatusBadge value={p.status} />
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
                <span className="fw-bold text-dark">Assurance Sets</span>
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
                                <span className={`font-mono-code small ${onTime.isOnTime ? 'text-success' : 'text-danger'}`} title={onTime.detail}>
                                  {onTime.statusLabel}{!onTime.isOnTime && onTime.lateItemsCount > 0 ? ` (${onTime.lateItemsCount})` : ''}
                                </span>
                              </td>
                              <td>
                                <span className={`font-mono-code small ${openFindings > 0 ? 'text-warning-emphasis' : 'text-muted'}`}>
                                  {openFindings > 0 ? `${openFindings} open` : '0'}
                                </span>
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
                <div className="fw-bold text-dark">
                  Assurance Sets
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
                          style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          onClick={() => handleSubmitterSort('title')}
                        >
                          Title {renderSortIndicator(submitterSortField, 'title', submitterSortDirection)}
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
                        <th style={{ whiteSpace: 'nowrap' }}>Findings</th>
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
                          const onTime = getAssuranceSetOnTimeStatus(s);
                          const openFindings = getAssuranceSetOpenFindingsCount(s, capaItems);
                          return (
                            <tr
                              key={s.id}
                              onClick={() => setCurrentHashView('assurance-sets', s.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="fw-semibold text-primary font-mono-code">{s.id}</td>
                              <td>
                                <div className="fw-semibold text-slate-900">{s.title}</div>
                                <div className="small text-muted">{s.vesselName}</div>
                              </td>
                              <td>
                                <StatusBadge value={s.stage} />
                              </td>
                              <td>
                                <ReadinessGauge score={calculateAssuranceSetReadiness(s)} size="sm" />
                              </td>
                              <td>
                                <span
                                  className={`font-mono-code small ${onTime.isOnTime ? 'text-success' : 'text-danger'}`}
                                  title={onTime.detail}
                                >
                                  {onTime.statusLabel}{!onTime.isOnTime && onTime.lateItemsCount > 0 ? ` (${onTime.lateItemsCount})` : ''}
                                </span>
                              </td>
                              <td>
                                <span className={`font-mono-code small ${openFindings > 0 ? 'text-warning-emphasis' : 'text-muted'}`}>
                                  {openFindings > 0 ? `${openFindings} open` : '0'}
                                </span>
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
                <TablePagination {...submitterSetsPagination.controls} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-12">
            <div className="card map-card-custom">
              <div className="card-header d-flex align-items-center justify-between p-3">
                <span className="fw-bold text-dark">Fleet Overview</span>
              </div>
              <ListToolbar
                searchValue={fleetSearchTerm}
                onSearchChange={setFleetSearchTerm}
                searchPlaceholder="Search vessels..."
                primaryAction={
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setCurrentHashView('vessels')}
                  >
                    View All
                  </button>
                }
              />
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
                      {fleetPagination.pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-muted">
                            No vessels found.
                          </td>
                        </tr>
                      ) : (
                        fleetPagination.pageItems.map((v) => (
                          <tr
                            key={v.id}
                            onClick={() => setCurrentHashView('vessels', v.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="font-mono-code fw-semibold text-primary">{v.imoNumber}</td>
                            <td className="fw-semibold text-dark">{v.name}</td>
                            <td>{v.flagState}</td>
                            <td className="small text-muted">{v.classificationSociety}</td>
                            <td>
                              <StatusBadge value={v.status} />
                            </td>
                            <td>
                              <ReadinessGauge score={calculateVesselReadiness(v, assuranceSets, documents)} size="sm" />
                            </td>
                          </tr>
                        ))
                      )}
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
