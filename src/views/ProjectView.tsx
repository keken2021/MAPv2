/*
  file summary: project registry list for charter composition campaigns.
  responsibilities: search, filter, and navigate to project detail or create flow.
  role in system: main view for #/project route.
*/

import React, { useMemo, useState } from 'react';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { useMapStore } from '../store/useMapStore';
import { countProjectAssets, filterProjectsForPersona } from '../utils/projectHelpers';

export const ProjectView: React.FC = () => {
  const { projects, assuranceSets, activePersona, users, setCurrentHashView } = useMapStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const visibleProjects = useMemo(
    () => filterProjectsForPersona(projects, activePersona, users),
    [projects, activePersona, users],
  );

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
        (p.serviceProvider && p.serviceProvider.toLowerCase().includes(q)) ||
        p.masterAssuranceSetId.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [visibleProjects, search, statusFilter]);

  const canCreate = activePersona === 'Administrator' || activePersona === 'C Admin';

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap align-items-center justify-between gap-3">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search project name, ID, type, org..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '280px' }}
          />
          <select
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Composing">Composing</option>
            <option value="Assurance In Progress">Assurance In Progress</option>
            <option value="Ready for Charter">Ready for Charter</option>
            <option value="Closed">Closed</option>
          </select>
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

      <div className="card map-card-custom">
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Type</th>
                <th>Requesting Org</th>
                <th>Project Window</th>
                <th>Assets</th>
                <th>Master AS</th>
                <th>Readiness</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-4 text-muted">
                    No projects match your search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const master = assuranceSets.find((s) => s.id === p.masterAssuranceSetId);
                  return (
                    <tr key={p.id}>
                      <td className="font-mono-code text-primary fw-semibold">{p.id}</td>
                      <td>{p.name}</td>
                      <td className="small">
                        <span className="badge bg-light text-dark border">{p.projectType}</span>
                      </td>
                      <td className="small">
                        <div>{p.requestingOrganization}</div>
                        {p.serviceProvider && (
                          <div className="text-muted">via {p.serviceProvider}</div>
                        )}
                      </td>
                      <td className="font-mono-code small">
                        {p.charterWindowStart} → {p.charterWindowEnd}
                      </td>
                      <td className="small">{countProjectAssets(p.assetLinks)}</td>
                      <td className="font-mono-code small">{p.masterAssuranceSetId}</td>
                      <td>
                        <ReadinessGauge score={p.readinessScore ?? master?.readinessScore ?? 0} size="sm" />
                      </td>
                      <td>
                        <span className="badge bg-secondary">{p.status}</span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setCurrentHashView('project', p.id)}
                        >
                          Open →
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
    </div>
  );
};
