/*
  file summary: project registry list for charter composition campaigns.
  responsibilities: search, filter, and navigate to project detail or create flow.
  role in system: main view for #/project route.
*/

import React, { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { FilterModal } from '../components/common/FilterModal';
import { FilterButton } from '../components/common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { useMapStore } from '../store/useMapStore';
import { calculateProjectReadiness, countProjectAssets, filterProjectsForPersona } from '../utils/projectHelpers';
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
        activePersona === 'C Admin' ? activeDemoOrganization : undefined,
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

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap align-items-center justify-between gap-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '280px' }}
          />
          <FilterButton
            onClick={() => setIsFilterModalOpen(true)}
            activeCount={activeFilterCount}
          />
        </div>
        {canCreate && (
          <button
            type="button"
            className="btn btn-sm btn-primary fw-semibold"
            onClick={() => setCurrentHashView('project', 'new')}
          >
            Create Project
          </button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="px-3 py-2 bg-light rounded border">
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        </div>
      )}

      <div className="card map-card-custom">
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
                      <td className="font-mono-code text-primary fw-semibold">{p.id}</td>
                      <td>
                        <div className="fw-semibold text-dark">{p.name}</div>
                        <div className="small text-muted font-mono-code" style={{ fontSize: '0.72rem' }}>
                          {countProjectAssets(p.assetLinks)} linked
                        </div>
                      </td>
                      <td className="small">
                        <div className="d-flex align-items-center gap-1.5 mb-0.5">
                          <span className="badge bg-light text-dark border">{p.projectType}</span>
                        </div>
                        <div className="text-secondary small">{p.requestingOrganization}</div>
                      </td>
                      <td className="font-mono-code small">
                        {p.charterWindowStart} → {p.charterWindowEnd}
                      </td>
                      <td>
                        <ReadinessGauge score={calculateProjectReadiness(p, assuranceSets)} size="sm" />
                      </td>
                      <td>
                        <span className="badge bg-secondary">{p.status}</span>
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
