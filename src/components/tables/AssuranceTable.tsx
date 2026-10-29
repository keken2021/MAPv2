/* 
  file summary: assurance sets data table component with grouped search box/filters on left, interactive column sorting, and grouped export/initiate buttons on right.
  responsibilities: presents set ids, target vessels, stage badges, readiness gauges, multi-column sorting by header clicks, and action controls.
  role in system: main data table for AssuranceSetsView.tsx.
*/

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Copy, Play, Eye } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { AssuranceSet, AssuranceStage, AssuranceTemplate } from '../../types/assurance';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { FilterModal } from '../common/FilterModal';
import { FilterButton } from '../common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { CountTabs, CountTab } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { StatusBadge } from '../common/StatusBadge';
import { formatMaritimeDate } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';

import { useSessionUser } from '../../utils/useSessionUser';
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
  | 'readinessScore'
  | 'scope'
  | 'scopeType';

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
    assuranceTemplates = [],
    activePersona,
    setCurrentHashView,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
    users,
    projects,
    activeDemoOrganization,
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

  const sessionUser = useSessionUser();
  const matchingUser = users.find((u) => u.roles.includes(activePersona)) ?? null;
  /* workflow roles get the list read-only: no create, template, or draft editing */
  const isReadOnly = isAssuranceSetsReadOnlyPersona(activePersona);
  const canInitiate =
    !isReadOnly &&
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'assurance_sets',
      'create',
      customScopes,
    );

  const accessibleSets = assuranceSets.filter(
    (s) =>
      isAssuranceSetAssignedToPersona(s, activePersona, activeDemoOrganization, sessionUser) &&
      !(isReadOnly && s.visibility === 'draft'),
  );

  const isDraftSet = (s: AssuranceSet) =>
    s.visibility === 'draft' || s.stage === 'Initiated';

  /* organization tab: sets this organization owns, or is appointed on, once they leave the draft stage */
  const viewerOrg = activeDemoOrganization || matchingUser?.organization;
  const isOrgSet = (s: AssuranceSet) =>
    (isAssuranceSetOwnedOrInitiatedByOrganization(s, viewerOrg) ||
      isAssuranceSetAssignedToPersona(s, activePersona, viewerOrg, sessionUser)) &&
    !isDraftSet(s);

  /* project id shown in the project column; empty for an orphaned set */
  const getProjectId = (s: AssuranceSet) => getProjectForAssuranceSet(s, projects)?.id ?? '';

  const publicCount = (assuranceTemplates || []).length;
  const orgCount = accessibleSets.filter(isOrgSet).length;
  const draftsCount = accessibleSets.filter(isDraftSet).length;

  const tabs: CountTab[] = useMemo(() => [
    { key: 'public', label: 'Public', count: publicCount },
    { key: 'organization', label: 'Organization', count: orgCount },
    { key: 'drafts', label: 'Drafts', count: draftsCount },
  ], [publicCount, orgCount, draftsCount]);

  // Filter public templates
  const filteredTemplates = (assuranceTemplates || []).filter((t) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      t.title.toLowerCase().includes(term) ||
      (t.scope || t.assuranceType || '').toLowerCase().includes(term) ||
      (t.scopeType || '').toLowerCase().includes(term) ||
      (t.initiatorOrg && t.initiatorOrg.toLowerCase().includes(term)) ||
      (t.description && t.description.toLowerCase().includes(term));
    const matchesScope = scopeFilter === 'ALL' || t.scope === scopeFilter || t.assuranceType === scopeFilter;
    return matchesSearch && matchesScope;
  });

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (sortField === 'scope') {
      comparison = (a.scope || a.assuranceType || '').localeCompare(b.scope || b.assuranceType || '');
    } else if (sortField === 'scopeType') {
      comparison = (a.scopeType || '').localeCompare(b.scopeType || '');
    } else if (sortField === 'initiatorOrg') {
      const aOrg = a.initiatorOrg || '';
      const bOrg = b.initiatorOrg || '';
      comparison = aOrg.localeCompare(bOrg);
    } else {
      comparison = a.title.localeCompare(b.title);
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const filteredSets = accessibleSets.filter((s) => {
    let matchesTab = true;
    if (activeTab === 'organization') {
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
    activeTab === 'public'
      ? (scopeFilter !== 'ALL' ? 1 : 0)
      : (stageFilter !== 'ALL' ? 1 : 0) +
        (scopeFilter !== 'ALL' ? 1 : 0) +
        (projectFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(stageFilter !== 'ALL' && activeTab !== 'public' ? [{ id: 'stage', label: 'Stage', value: stageFilter, onRemove: () => setStageFilter('ALL') }] : []),
    ...(scopeFilter !== 'ALL' ? [{ id: 'scope', label: 'Scope', value: scopeFilter, onRemove: () => setScopeFilter('ALL') }] : []),
    ...(projectFilter !== 'ALL' && activeTab !== 'public'
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
    let valA: any =
      sortField === 'project'
        ? getProjectId(a) || ORPHANED_LABEL
        : sortField === 'scope'
          ? a.assuranceType || ''
          : a[sortField as keyof AssuranceSet] ?? '';
    let valB: any =
      sortField === 'project'
        ? getProjectId(b) || ORPHANED_LABEL
        : sortField === 'scope'
          ? b.assuranceType || ''
          : b[sortField as keyof AssuranceSet] ?? '';

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
    if (activeTab === 'public') {
      const exportData = sortedTemplates.map((t) => ({
        Title: t.title,
        Scope: t.scope || t.assuranceType || 'Vessel',
        ScopeType: t.scopeType || 'General',
        CreatedBy: t.initiatorOrg || 'Global',
        Organization: t.initiatorOrg,
        RequirementsCount: t.requirements?.length || 0,
      }));
      exportToCsv('Public_Assurance_Templates', exportData);
      setIsExportOpen(false);
      return;
    }
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
    if (activeTab === 'public') {
      const headers = ['Title', 'Scope', 'Scope Type', 'Created By', 'Organization'];
      const rows = sortedTemplates.map((t) => [
        t.title,
        t.scope || t.assuranceType || 'Vessel',
        t.scopeType || 'General',
        t.initiatorOrg || 'Global',
        t.initiatorOrg,
      ]);
      exportToPdf('Public Assurance Templates', headers, rows);
      setIsExportOpen(false);
      return;
    }
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
  const templatesPagination = usePagination(sortedTemplates, [activeTab, searchTerm, scopeFilter, sortField, sortDirection]);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card map-card-custom">
        <div className="p-3 border-bottom">
          <CountTabs
            tabs={tabs}
            active={activeTab}
            onChange={(key) => setActiveTab(key as AssuranceViewTab)}
            aria-label="Assurance set tabs"
          />
        </div>

        <ListToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={activeTab === 'public' ? 'Search templates...' : 'Search assurance sets...'}
          onFilterClick={() => setIsFilterModalOpen(true)}
          activeFilterCount={activeFilterCount}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          primaryAction={canInitiate && onInitiateSet ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onInitiateSet}
            >
              Create Assurance Set
            </button>
          ) : undefined}
        />

        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-light border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          </div>
        )}

      <div className="table-responsive">
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            {activeTab === 'public' ? (
              <tr>
                <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Title {renderSortIndicator('title')}
                </th>
                <th onClick={() => handleSort('scope')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Scope {renderSortIndicator('scope')}
                </th>
                <th onClick={() => handleSort('initiatorOrg')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  Created By {renderSortIndicator('initiatorOrg')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            ) : (
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
            )}
          </thead>
          <tbody>
            {activeTab === 'public' ? (
              templatesPagination.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No public assurance templates found.
                  </td>
                </tr>
              ) : (
                templatesPagination.pageItems.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => {
                      if (canInitiate) {
                        setCurrentHashView('create-assurance-set', t.id);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="fw-semibold">
                      <div className="d-flex flex-column">
                        <span className="text-dark">{t.title}</span>
                        {t.description && (
                          <span className="text-secondary small text-truncate mt-0.5" style={{ maxWidth: '440px', fontSize: '0.775rem' }}>
                            {t.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span>
                        {t.scope || t.assuranceType || 'Vessel'}
                        {t.scopeType ? ` · ${t.scopeType}` : ''}
                      </span>
                    </td>
                    <td>
                      <span title={t.initiatorOrg}>
                        {t.initiatorOrg || 'Global'}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1.5">
                        {canInitiate && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: '32px', height: '32px' }}
                            title="Use as template"
                            aria-label="Use as template"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentHashView('create-assurance-set', t.id);
                            }}
                          >
                            <Copy size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )
            ) : (
              setsPagination.pageItems.map((s) => {
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
                      <span>{s.title}</span>
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
                      <StatusBadge value={s.stage} />
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
              })
            )}
            {activeTab !== 'public' && sortedSets.length === 0 && (
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
      <TablePagination {...(activeTab === 'public' ? templatesPagination.controls : setsPagination.controls)} />

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

