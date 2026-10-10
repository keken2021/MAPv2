import { ArrowUpDown, ArrowUp, ArrowDown, Eye, AlertTriangle } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { formatMaritimeDate } from '../utils/formatters';
import { VerifierWorkspaceView } from './VerifierWorkspaceView';
import { InspectorWorkspaceView } from './InspectorWorkspaceView';
import { ApproverDashboardView } from './ApproverDashboardView';
import { Vessel } from '../types/vessel';
import { AssuranceSet, AssuranceStage, AssuranceRequirement } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { isAssuranceSetAssignedToPersona, filterVesselsForPersona } from '../utils/rbacHelpers';
import { calculateAssuranceSetReadiness, calculateVesselReadiness } from '../utils/readinessHelpers';
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
  const [submitterSortField, setSubmitterSortField] = useState<'id' | 'title' | 'vesselName' | 'charterWindowStart' | 'stage' | 'readinessScore'>('id');
  const [submitterSortDirection, setSubmitterSortDirection] = useState<'asc' | 'desc'>('asc');
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

  const totalVessels = visibleVessels.length;
  const avgReadiness = Math.round(
    visibleVessels.reduce(
      (acc: number, v: Vessel) => acc + calculateVesselReadiness(v, assuranceSets, documents),
      0
    ) / (totalVessels || 1)
  );
  const activeAssurances = assuranceSets.filter((s) => s.stage !== 'Certified' && s.stage !== 'Approved').length;

  /* c admin specific assurance sets */
  const cAdminAssuranceSets = assuranceSets.filter((s) => isAssuranceSetAssignedToPersona(s, 'C Admin'));

  /* every scope a set covers as one label, shared by the c admin scope cell, sort and search */
  const getScopeLabel = (s: AssuranceSet) => getAssuranceSetScopes(s).join(', ');

  /* submitter specific assurance sets */
  const submitterAssuranceSets = assuranceSets.filter((s) => isAssuranceSetAssignedToPersona(s, 'Submitter'));
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
  const cAdminSetsPagination = usePagination(sortedCAdminSets, [cAdminSearchTerm, cAdminSortField, cAdminSortDirection]);
  const submitterSetsPagination = usePagination(sortedSubmitterSets, [submitterSearchTerm, submitterSortField, submitterSortDirection]);
  const fleetPagination = usePagination(sortedFleetVessels, [fleetSortField, fleetSortDirection]);

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

  const getStageBadgeClass = (stage: AssuranceStage) => {
    switch (stage) {
      case 'Approved':
      case 'Certified':
        return 'bg-success text-white';
      case 'Approval':
        return 'bg-info text-dark';
      case 'Inspection':
        return 'bg-primary text-white';
      case 'Verification':
        return 'bg-warning text-dark';
      case 'Validation':
        return 'bg-secondary text-white';
      default:
        return 'bg-light text-dark border';
    }
  };

  /* compute role-specific top summary metrics for activePersona */
  const renderDashboardCards = () => {
    if (activePersona === 'Submitter') {
      const assignedSets = assuranceSets.filter((s) => isAssuranceSetAssignedToPersona(s, 'Submitter'));
      const pendingUploads = documents.filter((d) => d.verificationStatus === 'Pending').length;
      const revisionsRequested = documents.filter(
        (d) => d.verificationStatus === 'Correction Requested' || d.verificationStatus === 'Rejected'
      ).length;
      const verifiedCerts = documents.filter((d) => d.verificationStatus === 'Verified').length;

      return (
        <div className="row g-3">
          <div className="col-md-3">
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                Assurance Sets
              </div>
              <div className="map-kpi-value text-primary mt-1">{assignedSets.length}</div>
              <div className="map-kpi-subtitle mt-1">Assigned to you</div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                Awaiting Upload
              </div>
              <div className="map-kpi-value text-warning mt-1">{pendingUploads}</div>
              <div className="map-kpi-subtitle mt-1">Documents still to upload</div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                Returned for Correction
              </div>
              <div className="map-kpi-value text-danger mt-1">{revisionsRequested}</div>
              <div className="map-kpi-subtitle mt-1">Documents to fix and upload again</div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                Verified
              </div>
              <div className="map-kpi-value text-success mt-1">{verifiedCerts}</div>
              <div className="map-kpi-subtitle mt-1">Verified documents</div>
            </div>
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
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                Assurance Sets
              </div>
              <div className="map-kpi-value text-primary mt-1">{totalCreated}</div>
              <div className="map-kpi-subtitle mt-1">Created by your organization</div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                Average Readiness
              </div>
              <div className="map-kpi-value text-success mt-1">{avgCampaignReadiness}%</div>
              <div className="map-kpi-subtitle mt-1">Across your assurance sets</div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                In Progress
              </div>
              <div className="map-kpi-value text-warning mt-1">{activeCampaigns}</div>
              <div className="map-kpi-subtitle mt-1">Being verified or reviewed</div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card map-kpi-card shadow-2xs">
              <div className="map-kpi-label">
                Approved
              </div>
              <div className="map-kpi-value text-primary mt-1">{certifiedCampaigns}</div>
              <div className="map-kpi-subtitle mt-1">Approved assurance sets</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="row g-3">
        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Vessels
            </div>
            <div className="map-kpi-value text-primary mt-1">{totalVessels}</div>
            <div className="map-kpi-subtitle mt-1">In your fleet</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Average Readiness
            </div>
            <div className="map-kpi-value text-success mt-1">{avgReadiness}%</div>
            <div className="map-kpi-subtitle mt-1">Across your fleet</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Assurance Sets
            </div>
            <div className="map-kpi-value text-warning mt-1">{activeAssurances}</div>
            <div className="map-kpi-subtitle mt-1">In progress</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Expiring Soon
            </div>
            <div className="map-kpi-value text-danger mt-1">4</div>
            <div className="map-kpi-subtitle mt-1">Documents expiring within 90 days</div>
          </div>
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
                        <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCAdminSets.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-muted">
                            No assurance sets found.
                          </td>
                        </tr>
                      ) : (
                        cAdminSetsPagination.pageItems.map((s) => (
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
                              <span className={`badge ${getStageBadgeClass(s.stage)} font-mono-code`}>
                                {s.stage}
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
                        ))
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
                          onClick={() => handleSubmitterSort('vesselName')}
                        >
                          Vessel {renderSortIndicator(submitterSortField, 'vesselName', submitterSortDirection)}
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

                          return (
                            <tr
                              key={s.id}
                              onClick={() => setCurrentHashView('assurance-sets', s.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="fw-semibold text-primary font-mono-code">{s.id}</td>
                              <td>
                                <div className="fw-semibold text-slate-900">{s.title}</div>
                                <div className="small text-muted">{s.initiatorOrg || s.charterer}</div>
                              </td>
                              <td>
                                <div className="fw-semibold">{s.vesselName}</div>
                                <div className="font-mono-code small text-muted">IMO {s.imoNumber}</div>
                              </td>
                              <td className="small font-mono-code text-muted">
                                {s.charterWindowStart && s.charterWindowEnd
                                  ? `${formatMaritimeDate(s.charterWindowStart)} – ${formatMaritimeDate(s.charterWindowEnd)}`
                                  : 'Not specified'}
                              </td>
                              <td>
                                <span className={`badge ${getStageBadgeClass(s.stage)} font-mono-code`}>
                                  {s.stage}
                                </span>
                              </td>
                              <td>
                                <ReadinessGauge score={calculateAssuranceSetReadiness(s)} size="sm" />
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
          defaultVesselId={selectedReturnedSet?.vesselId}
          onUploadComplete={() => {
            setUploadModalTarget(null);
          }}
        />
      )}
    </div>
  );
};
