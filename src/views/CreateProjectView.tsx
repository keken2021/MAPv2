/*
  file summary: two-step create project wizard with asset roster and assurance set dropdowns.
  responsibilities: captures project header fields and links vessels/crew with existing assurance sets.
  role in system: rendered when hash route is #/project/new.
*/

import React, { useMemo, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { ProjectAssetType, ProjectRiskProfile } from '../types/project';
import { getEligibleAssuranceSetsForAsset } from '../utils/projectHelpers';
import { getBackButtonInfo, getClientAdminOrganization } from '../utils/rbacHelpers';

type DraftAssetLink = {
  assetType: ProjectAssetType;
  assetId: string;
  assetName: string;
  providerOrganization: string;
  assuranceSetId: string;
};

export const CreateProjectView: React.FC = () => {
  const {
    vessels,
    crew,
    equipment,
    assuranceSets,
    activePersona,
    users,
    addProject,
    setCurrentHashView,
    previousHashView,
    previousEntityId,
  } = useMapStore();

  const defaultOrg =
    activePersona === 'C Admin'
      ? getClientAdminOrganization(users)
      : 'Northwind Marine Pty Ltd';

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [charterer, setCharterer] = useState(defaultOrg);
  const [location, setLocation] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [riskProfile, setRiskProfile] = useState<ProjectRiskProfile>('Standard');
  const [charterWindowStart, setCharterWindowStart] = useState('2026-11-01');
  const [charterWindowEnd, setCharterWindowEnd] = useState('2027-02-28');
  const [description, setDescription] = useState('');
  const [draftLinks, setDraftLinks] = useState<DraftAssetLink[]>([]);
  const [assetTypeFilter, setAssetTypeFilter] = useState<'All' | ProjectAssetType>('All');
  const [error, setError] = useState('');

  const backInfo = getBackButtonInfo('project', 'Projects', previousHashView, activePersona, previousEntityId);

  const availableAssets = useMemo(() => {
    const list: DraftAssetLink[] = [];
    vessels.forEach((v) => {
      list.push({
        assetType: 'Vessel',
        assetId: v.id,
        assetName: v.name,
        providerOrganization: v.registeredOwner,
        assuranceSetId: '',
      });
    });
    crew.forEach((c) => {
      list.push({
        assetType: 'Crew',
        assetId: c.id,
        assetName: c.fullName,
        providerOrganization: c.organization || defaultOrg,
        assuranceSetId: '',
      });
    });
    equipment.forEach((e) => {
      list.push({
        assetType: 'Equipment',
        assetId: e.id,
        assetName: e.name,
        providerOrganization: e.owningOrganization,
        assuranceSetId: '',
      });
    });
    return list;
  }, [vessels, crew, equipment, defaultOrg]);

  const filteredAvailable = useMemo(() => {
    const linked = new Set(draftLinks.map((l) => `${l.assetType}:${l.assetId}`));
    return availableAssets.filter((a) => {
      if (linked.has(`${a.assetType}:${a.assetId}`)) return false;
      if (assetTypeFilter !== 'All' && a.assetType !== assetTypeFilter) return false;
      return true;
    });
  }, [availableAssets, draftLinks, assetTypeFilter]);

  const handleAddAsset = (asset: DraftAssetLink) => {
    const sets = getEligibleAssuranceSetsForAsset(asset.assetType, asset.assetId, assuranceSets);
    setDraftLinks((prev) => [
      ...prev,
      {
        ...asset,
        assuranceSetId: sets[0]?.id || '',
      },
    ]);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    const incomplete = draftLinks.filter((l) => !l.assuranceSetId);
    if (incomplete.length > 0) {
      setError('Each linked asset must have an assurance set selected.');
      return;
    }

    const result = addProject({
      name: name.trim(),
      clientOperator: defaultOrg,
      charterer: charterer.trim() || defaultOrg,
      location: location.trim() || 'TBD',
      description: description.trim(),
      routeDescription: routeDescription.trim() || 'Charter route TBD',
      riskProfile,
      charterWindowStart,
      charterWindowEnd,
      operatorOrganization: defaultOrg,
      assetLinks: draftLinks.map(({ assetType, assetId, assetName, providerOrganization, assuranceSetId }) => ({
        assetType,
        assetId,
        assetName,
        providerOrganization,
        assuranceSetId,
      })),
    });

    if (result.success && result.projectId) {
      setCurrentHashView('project', result.projectId);
    } else {
      setError(result.message || 'Failed to create project.');
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-between">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setCurrentHashView(backInfo.targetView, backInfo.targetEntityId)}
        >
          {backInfo.label}
        </button>
        <span className="badge bg-primary-subtle text-primary font-mono-code">
          Step {step} of 2
        </span>
      </div>

      <div className="card map-card-custom p-4">
        <h2 className="h4 fw-bold text-dark mb-1">Create Project</h2>
        <p className="text-muted small mb-4">
          Define the charter operation and compose assets from one or more organizations.
        </p>

        {step === 1 && (
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Project Name *</label>
              <input className="form-control form-control-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Charterer *</label>
              <input className="form-control form-control-sm" value={charterer} onChange={(e) => setCharterer(e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Location / Operating Area *</label>
              <input className="form-control form-control-sm" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Risk Profile *</label>
              <select className="form-select form-select-sm" value={riskProfile} onChange={(e) => setRiskProfile(e.target.value as ProjectRiskProfile)}>
                <option value="Standard">Standard</option>
                <option value="Elevated">Elevated</option>
                <option value="High-Risk">High-Risk</option>
                <option value="Armed Escort Required">Armed Escort Required</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Route / Transit Description *</label>
              <textarea className="form-control form-control-sm" rows={2} value={routeDescription} onChange={(e) => setRouteDescription(e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Charter Window Start *</label>
              <input type="date" className="form-control form-control-sm" value={charterWindowStart} onChange={(e) => setCharterWindowStart(e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Charter Window End *</label>
              <input type="date" className="form-control form-control-sm" value={charterWindowEnd} onChange={(e) => setCharterWindowEnd(e.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Description</label>
              <textarea className="form-control form-control-sm" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="col-12 d-flex justify-content-end">
              <button type="button" className="btn btn-sm btn-primary fw-semibold" onClick={() => { setError(''); setStep(2); }}>
                Next: Add Assets →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {(['All', 'Vessel', 'Crew', 'Equipment'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn btn-sm ${assetTypeFilter === t ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setAssetTypeFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-5">
                <h6 className="fw-bold small text-uppercase text-secondary">Available Assets</h6>
                <div className="border rounded" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {filteredAvailable.length === 0 ? (
                    <div className="p-3 text-muted small text-center">No assets available to add.</div>
                  ) : (
                    filteredAvailable.map((a) => (
                      <div key={`${a.assetType}-${a.assetId}`} className="d-flex align-items-center justify-between p-2 border-bottom small">
                        <div>
                          <div className="fw-semibold">{a.assetName}</div>
                          <div className="text-muted">{a.assetType} · {a.providerOrganization}</div>
                        </div>
                        <button type="button" className="btn btn-xs btn-outline-primary btn-sm" onClick={() => handleAddAsset(a)}>
                          + Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="col-md-7">
                <h6 className="fw-bold small text-uppercase text-secondary">Project Asset Roster</h6>
                {draftLinks.length === 0 ? (
                  <div className="p-4 border rounded text-center text-muted small">
                    Add vessels and crew. Attach an existing Assurance Set for each asset.
                  </div>
                ) : (
                  <div className="table-responsive border rounded">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Organization</th>
                          <th>Assurance Set</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {draftLinks.map((link) => {
                          const sets = getEligibleAssuranceSetsForAsset(link.assetType, link.assetId, assuranceSets);
                          return (
                            <tr key={`${link.assetType}-${link.assetId}`}>
                              <td>
                                <div className="fw-semibold">{link.assetName}</div>
                                <div className="text-muted">{link.assetType}</div>
                              </td>
                              <td className="small">{link.providerOrganization}</td>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={link.assuranceSetId}
                                  onChange={(e) =>
                                    setDraftLinks((prev) =>
                                      prev.map((l) =>
                                        l.assetId === link.assetId && l.assetType === link.assetType
                                          ? { ...l, assuranceSetId: e.target.value }
                                          : l,
                                      ),
                                    )
                                  }
                                >
                                  {sets.length === 0 ? (
                                    <option value="">No sets for this asset</option>
                                  ) : (
                                    sets.map((s) => (
                                      <option key={s.id} value={s.id}>{s.id}</option>
                                    ))
                                  )}
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    setDraftLinks((prev) =>
                                      prev.filter((l) => !(l.assetId === link.assetId && l.assetType === link.assetType)),
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            <div className="d-flex justify-content-between">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button type="button" className="btn btn-sm btn-primary fw-semibold" onClick={handleSave}>
                Create Project
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
