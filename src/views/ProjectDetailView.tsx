/*
  file summary: project detail with asset roster, master assurance rollup, and cross-org composition.
  responsibilities: displays project summary, asset tabs, AS dropdowns, and master AS-02-P001 view.
  role in system: rendered for #/project/{id}.
*/

import React, { useMemo, useState } from 'react';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { useMapStore } from '../store/useMapStore';
import { ProjectAssetLink, ProjectAssetType } from '../types/project';
import {
  getEligibleAssuranceSetsForAsset,
  filterProjectsForPersona,
} from '../utils/projectHelpers';

interface ProjectDetailViewProps {
  projectId: string;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ projectId }) => {
  const {
    projects,
    assuranceSets,
    vessels,
    crew,
    equipment,
    activePersona,
    users,
    setCurrentHashView,
    previousHashView,
    previousEntityId,
    linkAssuranceSetToProjectAsset,
    removeAssetFromProject,
    addAssetToProject,
    syncProjectMasterAssurance,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<'roster' | 'master' | 'assurance'>('roster');
  const [assetFilter, setAssetFilter] = useState<'All' | ProjectAssetType>('All');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () => filterProjectsForPersona(projects, activePersona, users),
    [projects, activePersona, users],
  );

  const project = visibleProjects.find((p) => p.id === projectId);
  const masterSet = assuranceSets.find((s) => s.id === project?.masterAssuranceSetId);

  const filteredLinks = useMemo(() => {
    if (!project) return [];
    if (assetFilter === 'All') return project.assetLinks;
    return project.assetLinks.filter((l) => l.assetType === assetFilter);
  }, [project, assetFilter]);

  const canManage = activePersona === 'Administrator' || activePersona === 'C Admin';

  const availableToAdd = useMemo(() => {
    if (!project) return [];
    const linked = new Set(project.assetLinks.map((l) => `${l.assetType}:${l.assetId}`));
    const items: Omit<ProjectAssetLink, 'id' | 'projectId' | 'addedAt' | 'addedByPersona'>[] = [];
    vessels.forEach((v) => {
      if (linked.has(`Vessel:${v.id}`)) return;
      items.push({
        assetType: 'Vessel',
        assetId: v.id,
        assetName: v.name,
        providerOrganization: v.registeredOwner,
        assuranceSetId: getEligibleAssuranceSetsForAsset('Vessel', v.id, assuranceSets)[0]?.id || '',
      });
    });
    crew.forEach((c) => {
      if (linked.has(`Crew:${c.id}`)) return;
      items.push({
        assetType: 'Crew',
        assetId: c.id,
        assetName: c.fullName,
        providerOrganization: c.organization || project.operatorOrganization,
        assuranceSetId: getEligibleAssuranceSetsForAsset('Crew', c.id, assuranceSets)[0]?.id || '',
      });
    });
    equipment.forEach((e) => {
      if (linked.has(`Equipment:${e.id}`)) return;
      items.push({
        assetType: 'Equipment',
        assetId: e.id,
        assetName: e.name,
        providerOrganization: e.owningOrganization,
        assuranceSetId: getEligibleAssuranceSetsForAsset('Equipment', e.id, assuranceSets)[0]?.id || '',
      });
    });
    return items.filter((a) => assetFilter === 'All' || a.assetType === assetFilter);
  }, [project, vessels, crew, equipment, assuranceSets, assetFilter]);

  if (!project) {
    return (
      <div className="alert alert-warning">
        Project not found or not accessible.
        <button type="button" className="btn btn-sm btn-link" onClick={() => setCurrentHashView('project')}>
          Back to Projects
        </button>
      </div>
    );
  }

  const handleRefreshMaster = () => {
    syncProjectMasterAssurance(project.id);
    setToast('Project master assurance set refreshed.');
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddAsset = (item: typeof availableToAdd[0]) => {
    if (!item.assuranceSetId) {
      setToast('No assurance set available for this asset.');
      return;
    }
    const result = addAssetToProject(project.id, item);
    if (result.success) {
      setToast(`${item.assetName} added to project.`);
      setShowAddPanel(false);
    } else {
      setToast(result.message || 'Could not add asset.');
    }
    setTimeout(() => setToast(null), 3500);
  };

  const groupedMasterReqs = useMemo(() => {
    if (!masterSet) return [];
    return project.assetLinks.map((link) => {
      const sourceSet = assuranceSets.find((s) => s.id === link.assuranceSetId);
      const reqs = masterSet.requirements.filter((r) =>
        r.id.includes(link.assuranceSetId) || r.description?.includes(link.assuranceSetId),
      );
      return {
        link,
        sourceSet,
        requirements: reqs.length > 0 ? reqs : sourceSet?.requirements || [],
      };
    });
  }, [masterSet, project.assetLinks, assuranceSets]);

  return (
    <div className="d-flex flex-column gap-3">
      {toast && (
        <div className="alert alert-success py-2 mb-0">{toast}</div>
      )}

      <div className="card map-card-custom p-3">
        <div className="d-flex flex-wrap justify-between align-items-start gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
              <span className="badge bg-primary font-mono-code">{project.id}</span>
              <span className={`badge ${project.riskProfile.includes('High') || project.riskProfile.includes('Armed') ? 'bg-danger' : 'bg-warning text-dark'}`}>
                {project.riskProfile}
              </span>
              <span className="badge bg-secondary">{project.status}</span>
            </div>
            <h2 className="h4 fw-bold text-dark mb-1">{project.name}</h2>
            <div className="text-muted small">
              {project.operatorOrganization} · Charterer: {project.charterer}
            </div>
            <div className="text-muted small mt-1">{project.routeDescription}</div>
            <div className="font-mono-code small mt-1">
              {project.charterWindowStart} → {project.charterWindowEnd}
            </div>
          </div>
          <div className="text-end">
            <div className="small text-secondary mb-1">Master AS: {project.masterAssuranceSetId}</div>
            <ReadinessGauge score={project.readinessScore ?? masterSet?.readinessScore ?? 0} size="md" />
            {canManage && (
              <div className="d-flex flex-wrap gap-2 justify-content-end mt-2">
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setShowAddPanel((p) => !p)}>
                  + Add Asset
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleRefreshMaster}>
                  Refresh Project Assurance
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setCurrentHashView('assurance-sets', project.masterAssuranceSetId)}
                >
                  Open Master Set →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs">
        {(['roster', 'master', 'assurance'] as const).map((tab) => (
          <li className="nav-item" key={tab}>
            <button
              type="button"
              className={`nav-link ${activeTab === tab ? 'active fw-semibold' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'roster' ? 'Asset Roster' : tab === 'master' ? 'Master Assurance' : 'Assurance Sets'}
            </button>
          </li>
        ))}
      </ul>

      {showAddPanel && canManage && (
        <div className="card map-card-custom p-3">
          <h6 className="fw-bold mb-2">Add Asset to Project</h6>
          <div className="d-flex gap-2 mb-2">
            {(['All', 'Vessel', 'Crew', 'Equipment'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn btn-sm ${assetFilter === t ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setAssetFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="border rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {availableToAdd.length === 0 ? (
              <div className="p-3 text-muted small text-center">No additional assets available.</div>
            ) : (
              availableToAdd.map((a) => (
                <div key={`${a.assetType}-${a.assetId}`} className="d-flex justify-between align-items-center p-2 border-bottom small">
                  <div>
                    <strong>{a.assetName}</strong>
                    <div className="text-muted">{a.assetType} · {a.providerOrganization}</div>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleAddAsset(a)}>
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'roster' && (
        <div className="card map-card-custom">
          <div className="card-header d-flex gap-2 p-3">
            {(['All', 'Vessel', 'Crew', 'Equipment'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn btn-sm ${assetFilter === t ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setAssetFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Organization</th>
                  <th>Assurance Set</th>
                  <th>Certificates</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No assets linked yet. Use + Add Asset to compose this charter.
                    </td>
                  </tr>
                ) : (
                  filteredLinks.map((link) => {
                    const sets = getEligibleAssuranceSetsForAsset(link.assetType, link.assetId, assuranceSets);
                    const activeSet = assuranceSets.find((s) => s.id === link.assuranceSetId);
                    return (
                      <tr key={link.id}>
                        <td className="fw-semibold">{link.assetName}</td>
                        <td>{link.assetType}</td>
                        <td className="small">{link.providerOrganization}</td>
                        <td>
                          {canManage ? (
                            <select
                              className="form-select form-select-sm"
                              value={link.assuranceSetId}
                              onChange={(e) => linkAssuranceSetToProjectAsset(project.id, link.id, e.target.value)}
                            >
                              {sets.map((s) => (
                                <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-mono-code small">{link.assuranceSetId}</span>
                          )}
                        </td>
                        <td className="small">
                          {activeSet?.requirements.map((r) => r.title).join(', ') || '—'}
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => {
                              if (link.assetType === 'Vessel') setCurrentHashView('vessels', link.assetId);
                              else if (link.assetType === 'Crew') setCurrentHashView('crew', link.assetId);
                              else if (link.assetType === 'Equipment') setCurrentHashView('equipment', link.assetId);
                            }}
                          >
                            Open Asset
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeAssetFromProject(project.id, link.id)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'master' && masterSet && (
        <div className="card map-card-custom p-3">
          <div className="d-flex align-items-center justify-between mb-3">
            <div>
              <h5 className="fw-bold m-0">{masterSet.id} — Project Master Assurance Set</h5>
              <div className="text-muted small">{masterSet.title}</div>
            </div>
            <ReadinessGauge score={masterSet.readinessScore} size="sm" />
          </div>
          {groupedMasterReqs.map(({ link, sourceSet, requirements }) => (
            <div key={link.id} className="mb-3 border rounded p-3 bg-light">
              <div className="fw-semibold small mb-2">
                From {link.assetName} ({link.assetType}) · {link.assuranceSetId}
              </div>
              <ul className="mb-0 small">
                {requirements.map((r) => (
                  <li key={r.id}>
                    {r.title}
                    <span className={`badge ms-2 ${r.verifierStatus === 'Verified' ? 'bg-success' : 'bg-secondary'}`}>
                      {r.verifierStatus}
                    </span>
                  </li>
                ))}
                {requirements.length === 0 && sourceSet && (
                  <li className="text-muted">No requirements synced — click Refresh Project Assurance</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'assurance' && (
        <div className="card map-card-custom">
          <div className="table-responsive">
            <table className="table map-table-custom mb-0">
              <thead>
                <tr>
                  <th>Set ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Stage</th>
                  <th>Readiness</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {[masterSet, ...project.assetLinks.map((l) => assuranceSets.find((s) => s.id === l.assuranceSetId)).filter(Boolean)]
                  .filter((s, i, arr) => s && arr.findIndex((x) => x?.id === s.id) === i)
                  .map((s) => s && (
                    <tr key={s.id}>
                      <td className="font-mono-code text-primary">{s.id}</td>
                      <td>{s.title}</td>
                      <td>{s.isProjectMaster ? 'Project Master' : s.assuranceType || 'Asset'}</td>
                      <td><span className="badge bg-secondary">{s.stage}</span></td>
                      <td><ReadinessGauge score={s.readinessScore} size="sm" /></td>
                      <td className="text-end">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setCurrentHashView('assurance-sets', s.id)}>
                          Open →
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
