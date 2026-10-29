/*
  file summary: project registry list for charter composition campaigns.
  responsibilities: search, filter, and navigate to project detail or create flow.
  role in system: main view for #/project route.
*/

import React, { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { FilterModal } from '../components/common/FilterModal';
import { CountTabs } from '../components/common/CountTabs';
import { ListToolbar } from '../components/common/ListToolbar';
import { StatusBadge } from '../components/common/StatusBadge';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { useMapStore } from '../store/useMapStore';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { calculateProjectReadiness, filterProjectsForPersona } from '../utils/projectHelpers';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

export const ProjectView: React.FC = () => {
  const { projects, assuranceSets, activePersona, activeDemoOrganization, users, setCurrentHashView } =
    useMapStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const visibleProjects = useMemo(
    () =>
      filterProjectsForPersona(
        projects,
        activePersona,
        users,
        assuranceSets,
        activeDemoOrganization,
      ),
    [projects, activePersona, activeDemoOrganization, users, assuranceSets],
  );

  const projectTypes = useMemo(() => {
    const set = new Set(visibleProjects.map((p) => p.projectType).filter(Boolean));
    return Array.from(set).sort();
  }, [visibleProjects]);

  const filtered = useMemo(() => {
    return visibleProjects.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.projectType.toLowerCase().includes(q) ||
        p.requestingOrganization.toLowerCase().includes(q) ||
        (p.charterer && p.charterer.toLowerCase().includes(q)) ||
        (p.serviceProvider && p.serviceProvider.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || p.projectType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [visibleProjects, search, statusFilter, typeFilter]);

  const activeFilterCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (typeFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(statusFilter !== 'ALL' ? [{ id: 'status', label: 'Status', value: statusFilter, onRemove: () => setStatusFilter('ALL') }] : []),
    ...(typeFilter !== 'ALL' ? [{ id: 'type', label: 'Type', value: typeFilter, onRemove: () => setTypeFilter('ALL') }] : []),
  ];

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  };

  const canCreate = activePersona === 'Administrator' || activePersona === 'C Admin';

  const projectsPagination = usePagination(filtered, [search, statusFilter, typeFilter]);

  const projectStatuses = ['Draft', 'Composing', 'Assurance In Progress', 'Ready for Charter', 'Closed'] as const;
  const projectTabs = [
    { key: 'ALL', label: 'All', count: visibleProjects.length },
    ...projectStatuses.map((status) => ({
      key: status,
      label: status,
      count: visibleProjects.filter((project) => project.status === status).length,
      tone: status === 'Assurance In Progress' ? ('warn' as const) : undefined,
    })),
  ];
  const activeProjectTab = projectTabs.some((tab) => tab.key === statusFilter) ? statusFilter : '';

  const handleExportCsv = () => {
    exportToCsv(
      'Projects',
      filtered.map((project) => ({
        ProjectId: project.id,
        Name: project.name,
        Type: project.projectType,
        Period: `${project.charterWindowStart} → ${project.charterWindowEnd}`,
        Readiness: `${calculateProjectReadiness(project, assuranceSets)}%`,
        Status: project.status,
      })),
    );
  };

  const handleExportPdf = () => {
    exportToPdf(
      'Projects',
      ['Project ID', 'Name', 'Type', 'Project Period', 'Readiness', 'Status'],
      filtered.map((project) => [
        project.id,
        project.name,
        project.projectType,
        `${project.charterWindowStart} → ${project.charterWindowEnd}`,
        `${calculateProjectReadiness(project, assuranceSets)}%`,
        project.status,
      ]),
    );
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card map-card-custom">
        <div className="p-3 border-bottom">
          <CountTabs
            tabs={projectTabs}
            active={activeProjectTab}
            onChange={setStatusFilter}
            aria-label="Project tabs"
          />
        </div>
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search projects..."
          onFilterClick={() => setIsFilterModalOpen(true)}
          activeFilterCount={activeFilterCount}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          primaryAction={
            canCreate ? (
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold"
                onClick={() => setCurrentHashView('project', 'new')}
              >
                Create Project
              </button>
            ) : undefined
          }
        />

      {activeChips.length > 0 && (
        <div className="px-3 py-2 bg-light border-bottom">
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        </div>
      )}

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Project Period</th>
                <th>Readiness</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    No projects found.
                  </td>
                </tr>
              ) : (
                projectsPagination.pageItems.map((p) => {
                  return (
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setCurrentHashView('project', p.id)}
                    >
                      <td className="font-mono-code text-primary fw-semibold text-nowrap">{p.id}</td>
                      <td className="fw-semibold text-dark text-nowrap">{p.name}</td>
                      <td className="small text-nowrap">
                        {p.projectType}
                        {p.requestingOrganization ? ` · ${p.requestingOrganization}` : ''}
                      </td>
                      <td className="font-mono-code small text-nowrap">
                        {p.charterWindowStart} → {p.charterWindowEnd}
                      </td>
                      <td>
                        <ReadinessGauge score={calculateProjectReadiness(p, assuranceSets)} size="sm" />
                      </td>
                      <td>
                        <StatusBadge value={p.status} />
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentHashView('project', p.id);
                          }}
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
        <TablePagination {...projectsPagination.controls} />
      </div>

      {/* Project Filter Modal */}
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
              <label className="form-label small fw-semibold text-secondary mb-1">Status</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Composing">Composing</option>
                <option value="Assurance In Progress">Assurance In Progress</option>
                <option value="Ready for Charter">Ready for Charter</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Type</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                {projectTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};
