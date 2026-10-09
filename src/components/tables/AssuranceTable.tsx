/* 
  file summary: assurance sets data table component with grouped search box/filters on left, interactive column sorting, and grouped export/initiate buttons on right.
  responsibilities: presents set ids, target vessels, stage badges, readiness gauges, multi-column sorting by header clicks, and action controls.
  role in system: main data table for AssuranceSetsView.tsx.
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Copy, Play, Eye } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { AssuranceSet, AssuranceStage } from '../../types/assurance';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { FilterModal } from '../common/FilterModal';
import { FilterButton } from '../common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { formatMaritimeDate } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';

import {
  getAssuranceSetCreatedByLabel,
  isAssuranceSetAssignedToPersona,
  isAssuranceSetOwnedOrInitiatedByOrganization,
  isAssuranceSetsReadOnlyPersona,
} from '../../utils/rbacHelpers';
import { getProjectForAssuranceSet, ORPHANED_ASSURANCE_SET_LABEL as ORPHANED_LABEL } from '../../utils/projectHelpers';
import { canPerform } from '../../utils/permissionHelpers';
import { calculateAssuranceSetReadiness } from '../../utils/readinessHelpers';
import { ASSURANCE_SCOPE_OPTIONS } from '../../utils/assuranceTemplates';
import { usePagination } from '../../utils/usePagination';
import { TablePagination } from '../common/TablePagination';

type AssuranceSortField =
  | 'id'
  | 'title'
  | 'project'
  | 'initiatorOrg'
  | 'stage'
  | 'readinessScore';

export type AssuranceViewTab = 'public' | 'organization' | 'drafts';

interface AssuranceTableProps {
  onSelectSet: (set: AssuranceSet) => void;
  onInitiateSet?: () => void;
  defaultTab?: AssuranceViewTab;
}

/**
  what: renders assurance projects data table with universal tabs (Public, Organization, Drafts), search filters, column sorting, and export/initiate actions.
  how: filters assuranceSets array by active persona role assignment, tab view mode, and search parameters, then sorts by sortField.
  with what file: src/components/tables/AssuranceTable.tsx loaded by AssuranceSetsView.tsx.
*/
export const AssuranceTable: React.FC<AssuranceTableProps> = ({ onSelectSet, onInitiateSet, defaultTab = 'organization' }) => {
  const {
    assuranceSets,
    activePersona,
    setCurrentHashView,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
    users,
    projects,
  } = useMapStore();
  const [activeTab, setActiveTab] = useState<AssuranceViewTab>(defaultTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortField, setSortField] = useState<AssuranceSortField>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const matchingUser = users.find((u) => u.roles.includes(activePersona)) ?? null;
  /* workflow roles get the list read-only: no create, template, or draft editing */
  const isReadOnly = isAssuranceSetsReadOnlyPersona(activePersona);
  const canInitiate =
    !isReadOnly &&
    (activePersona === 'Administrator' ||
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'assurance_sets',
      'create',
      customScopes,
    ));

  const accessibleSets = assuranceSets.filter(
    (s) =>
      isAssuranceSetAssignedToPersona(s, activePersona) &&
      !(isReadOnly && s.visibility === 'draft'),
  );

  const isPublicSet = (s: AssuranceSet) =>
    s.visibility === 'public' || s.templateSource === 'public' || s.stage === 'Approved' || s.stage === 'Certified';

  const isDraftSet = (s: AssuranceSet) =>
    s.visibility === 'draft' || s.stage === 'Initiated';

  /* organization tab: only sets owned or initiated by the current user organization */
  const viewerOrg = matchingUser?.organization;
  const isOrgSet = (s: AssuranceSet) =>
    isAssuranceSetOwnedOrInitiatedByOrganization(s, viewerOrg) &&
    (s.visibility === 'organization' || (!isDraftSet(s) && !isPublicSet(s)) || (s.stage !== 'Initiated' && s.visibility !== 'public'));

  /* project id shown in the project column; empty for an orphaned set */
  const getProjectId = (s: AssuranceSet) => getProjectForAssuranceSet(s, projects)?.id ?? '';

  const publicCount = accessibleSets.filter(isPublicSet).length;
  const orgCount = accessibleSets.filter(isOrgSet).length;
  const draftsCount = accessibleSets.filter(isDraftSet).length;

  const filteredSets = accessibleSets.filter((s) => {
    let matchesTab = true;
    if (activeTab === 'public') {
      matchesTab = isPublicSet(s);
    } else if (activeTab === 'organization') {
      matchesTab = isOrgSet(s);
    } else if (activeTab === 'drafts') {
      matchesTab = isDraftSet(s);
    }

    const matchesSearch =
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (getProjectId(s) || ORPHANED_LABEL).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.initiatorOrg && s.initiatorOrg.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStage = stageFilter === 'ALL' || s.stage === stageFilter;
    const matchesScope = scopeFilter === 'ALL' || s.assuranceType === scopeFilter || (s.subtypes && s.subtypes.includes(scopeFilter as any));
    const setProjectId = getProjectId(s);
    const matchesProject =
      projectFilter === 'ALL' ||
      (projectFilter === 'ORPHANED' ? !setProjectId : setProjectId === projectFilter);
    return matchesTab && matchesSearch && matchesStage && matchesScope && matchesProject;
  });

  /* projects that at least one listed set belongs to, offered in the project filter */
  const projectFilterOptions = projects.filter((p) =>
    accessibleSets.some((s) => getProjectId(s) === p.id),
  );

  const activeFilterCount =
    (stageFilter !== 'ALL' ? 1 : 0) +
    (scopeFilter !== 'ALL' ? 1 : 0) +
    (projectFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(stageFilter !== 'ALL' ? [{ id: 'stage', label: 'Stage', value: stageFilter, onRemove: () => setStageFilter('ALL') }] : []),
    ...(scopeFilter !== 'ALL' ? [{ id: 'scope', label: 'Scope', value: scopeFilter, onRemove: () => setScopeFilter('ALL') }] : []),
    ...(projectFilter !== 'ALL'
      ? [{
          id: 'project',
          label: 'Project',
          value: projectFilter === 'ORPHANED' ? ORPHANED_LABEL : projectFilter,
          onRemove: () => setProjectFilter('ALL'),
        }]
      : []),
  ];

  const handleResetFilters = () => {
    setStageFilter('ALL');
    setScopeFilter('ALL');
    setProjectFilter('ALL');
  };

  const handleSort = (field: AssuranceSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field: AssuranceSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const sortedSets = [...filteredSets].sort((a, b) => {
    let valA: any = sortField === 'project' ? getProjectId(a) || ORPHANED_LABEL : a[sortField] ?? '';
    let valB: any = sortField === 'project' ? getProjectId(b) || ORPHANED_LABEL : b[sortField] ?? '';

    /* sort the created-by column by what it displays */
    if (sortField === 'initiatorOrg') {
      valA = getAssuranceSetCreatedByLabel(a, users, activePersona);
      valB = getAssuranceSetCreatedByLabel(b, users, activePersona);
    }

    if (sortField === 'readinessScore') {
      valA = calculateAssuranceSetReadiness(a);
      valB = calculateAssuranceSetReadiness(b);
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getStageBadgeClass = (stage: AssuranceStage) => {
    switch (stage) {
      case 'Approved':
      case 'Certified': return 'bg-success text-white';
      case 'Approval': return 'bg-info text-dark';
      case 'Inspection': return 'bg-primary text-white';
      case 'Verification': return 'bg-warning text-dark';
      case 'Validation': return 'bg-secondary text-white';
      default: return 'bg-light text-dark border';
    }
  };

  const handleExportCsv = () => {
    const exportData = sortedSets.map((s) => ({
      SetID: s.id,
      Title: s.title,
      Project: getProjectId(s) || ORPHANED_LABEL,
      CreatedBy: getAssuranceSetCreatedByLabel(s, users, activePersona),
      Organization: s.initiatorOrg,
      Stage: s.stage,
      ReadinessScore: `${calculateAssuranceSetReadiness(s)}%`,
      CharterPeriodStart: s.charterWindowStart,
      CharterPeriodEnd: s.charterWindowEnd,
    }));
    exportToCsv('Assurance_Sets', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Set ID', 'Title', 'Project', 'Created By', 'Stage', 'Readiness'];
    const rows = sortedSets.map((s) => [
      s.id,
      s.title,
      getProjectId(s) || ORPHANED_LABEL,
      s.initiatorOrg,
      s.stage,
      `${calculateAssuranceSetReadiness(s)}%`,
    ]);
    exportToPdf('Assurance Sets', headers, rows);
    setIsExportOpen(false);
  };

  const setsPagination = usePagination(sortedSets, [activeTab, searchTerm, stageFilter, scopeFilter, projectFilter, sortField, sortDirection]);

  return (
    <div className="d-flex flex-column gap-3">
      {/* Universal Design Tabs: Public, Organization, and Drafts (Placed above card, matching Vessels layout) */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="nav nav-pills bg-light p-1 rounded-3 border">
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeTab === 'public' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveTab('public')}
          >
            Public ({publicCount})
          </button>
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeTab === 'organization' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveTab('organization')}
          >
            Organization ({orgCount})
          </button>
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeTab === 'drafts' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveTab('drafts')}
          >
            Drafts ({draftsCount})
          </button>
        </div>
      </div>

      <div className="card map-card-custom">
        {/* Table Header Controls Row: Search/Filter on Left, Export & Initiate on Right */}
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3 p-3">
          <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
            <input
              type="text"
              className="form-control form-control-sm bg-white text-dark border-secondary"
              placeholder="Search assurance sets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '260px' }}
            />
            <FilterButton
              onClick={() => setIsFilterModalOpen(true)}
              activeCount={activeFilterCount}
            />
          </div>

          {/* Right Side: Export & Initiate Buttons */}
          <div className="d-flex align-items-center gap-2 ms-auto">
            {/* Export Dropdown */}
            <div className="dropdown position-relative">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                onClick={() => setIsExportOpen(!isExportOpen)}
              >
                Export
              </button>
              {isExportOpen && (
                <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border">
                  <li>
                    <button type="button" className="dropdown-item small" onClick={handleExportCsv}>
                      CSV
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item small" onClick={handleExportPdf}>
                      PDF
                    </button>
                  </li>
                </ul>
              )}
            </div>

            {/* Initiate Action Button */}
            {canInitiate && onInitiateSet && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={onInitiateSet}
              >
                Create Assurance Set
              </button>
            )}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-light border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          </div>
        )}

      <div className="table-responsive">
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Set ID {renderSortIndicator('id')}
              </th>
              <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Title {renderSortIndicator('title')}
              </th>
              <th onClick={() => handleSort('project')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Project {renderSortIndicator('project')}
              </th>
              <th onClick={() => handleSort('initiatorOrg')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Created By {renderSortIndicator('initiatorOrg')}
              </th>
              <th onClick={() => handleSort('stage')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Stage {renderSortIndicator('stage')}
              </th>
              <th onClick={() => handleSort('readinessScore')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Readiness {renderSortIndicator('readinessScore')}
              </th>
              <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {setsPagination.pageItems.map((s) => {
              /* only roles that can edit a draft are routed to the wizard */
              const isDraft = canInitiate && isDraftSet(s);
              return (
                <tr
                  key={s.id}
                  onClick={() => {
                    if (isDraft) {
                      setCurrentHashView('create-assurance-set', s.id);
                    } else {
                      onSelectSet(s);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-mono-code fw-bold text-primary">{s.id}</td>
                  <td className="fw-semibold">
                    <div className="d-flex align-items-center gap-2">
                      <span>{s.title}</span>
                      {isDraft && (
                        <span className="badge bg-warning-subtle text-dark border border-warning-subtle font-mono-code" style={{ fontSize: '0.65rem' }}>
                          Draft
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {getProjectId(s) ? (
                      <span className="font-mono-code">{getProjectId(s)}</span>
                    ) : (
                      <span className="text-secondary">{ORPHANED_LABEL}</span>
                    )}
                  </td>
                  <td>
                    {/* creator name for sets made inside the viewer organization, otherwise the initiating organization */}
                    <span title={s.initiatorOrg}>{getAssuranceSetCreatedByLabel(s, users, activePersona)}</span>
                  </td>
                  <td>
                    <span className={`badge ${getStageBadgeClass(s.stage)}`}>{s.stage}</span>
                  </td>
                  <td>
                    <ReadinessGauge score={calculateAssuranceSetReadiness(s)} size="sm" />
                  </td>
                  <td className="text-end">
                    <div className="d-flex align-items-center justify-content-end gap-1.5">
                      {!isDraft && canInitiate && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          title="Use as template"
                          aria-label="Use as template"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentHashView('create-assurance-set', s.id);
                          }}
                        >
                          <Copy size={16} />
                        </button>
                      )}
                      {isDraft ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center p-0 text-white"
                          style={{ width: '32px', height: '32px' }}
                          title="Continue setup"
                          aria-label="Continue setup"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentHashView('create-assurance-set', s.id);
                          }}
                        >
                          <Play size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          title="View"
                          aria-label="View"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSet(s);
                          }}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedSets.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-secondary py-4">
                  {accessibleSets.length > 0
                    ? 'No assurance sets found.'
                    : isReadOnly
                      ? 'No assurance sets yet.'
                      : 'No assurance sets yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination {...setsPagination.controls} />

      {/* Assurance Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="card p-3 bg-white border rounded">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Stage</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="ALL">All Stages</option>
                <option value="Initiated">Initiated</option>
                <option value="Validation">Validation</option>
                <option value="Verification">Verification</option>
                <option value="Inspection">Inspection</option>
                <option value="Approval">Approval</option>
                <option value="Approved">Approved</option>
                <option value="Certified">Certified</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Scope</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
              >
                <option value="ALL">All Scopes</option>
                {ASSURANCE_SCOPE_OPTIONS.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="assurance-filter-project">Project</label>
              <select
                id="assurance-filter-project"
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="ALL">All Projects</option>
                <option value="ORPHANED">{ORPHANED_LABEL}</option>
                {projectFilterOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} &mdash; {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </FilterModal>
    </div>
  </div>
);
};

