/*
  file summary: two-step create project wizard with type-driven fields and asset roster.
  responsibilities: captures project header by type and links vessels, crew, equipment, or services.
  role in system: rendered when hash route is #/project/new.
*/

import React, { useMemo, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
  PROJECT_TYPE_OPTIONS,
  ProjectAssetType,
  ProjectRiskProfile,
  ProjectType,
  WORK_LOCATION_OPTIONS,
  WorkLocationType,
} from '../types/project';
import {
  filterCrewForProjectComposition,
  filterEquipmentForProjectComposition,
  filterVesselsForProjectComposition,
  getEligibleAssuranceSetsForAsset,
  getProjectOrganizationForPersona,
  isOrganizationMatch,
  projectTypeRequiresRiskProfile,
  projectTypeRequiresRoute,
  projectTypeShowsServiceFields,
  requiresAssuranceSetForAssetLink,
} from '../utils/projectHelpers';
import { EXISTING_ACTIVITIES } from '../utils/assuranceTemplates';

type DraftAssetLink = {
  assetType: ProjectAssetType;
  assetId: string;
  assetName: string;
  providerOrganization: string;
  assuranceSetId: string;
  roleInProject: string;
  notes?: string;
};

const DEFAULT_ROLES: Partial<Record<ProjectAssetType, string>> = {
  Vessel: 'Subject vessel',
  Crew: 'Service crew',
  Equipment: 'Rented equipment',
  Activity: 'Service / activity',
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

  const defaultOrg = getProjectOrganizationForPersona(activePersona, users);

  const [step, setStep] = useState<1 | 2>(1);
  const [includeExternalProviders, setIncludeExternalProviders] = useState(false);
  const [projectType, setProjectType] = useState<ProjectType>('Service Engagement');
  const [name, setName] = useState('');
  const [requestingOrganization, setRequestingOrganization] = useState(defaultOrg);
  const [location, setLocation] = useState('');
  const [projectWindowStart, setProjectWindowStart] = useState('2026-11-01');
  const [projectWindowEnd, setProjectWindowEnd] = useState('2027-02-28');
  const [description, setDescription] = useState('');
  const [charterer, setCharterer] = useState(defaultOrg);
  const [routeDescription, setRouteDescription] = useState('');
  const [riskProfile, setRiskProfile] = useState<ProjectRiskProfile | ''>('Standard');
  const [serviceProvider, setServiceProvider] = useState('');
  const [workOrderRef, setWorkOrderRef] = useState('');
  const [workLocationType, setWorkLocationType] = useState<WorkLocationType>('Onboard');
  const [primaryVesselId, setPrimaryVesselId] = useState('');
  const [draftLinks, setDraftLinks] = useState<DraftAssetLink[]>([]);
  const [assetTypeFilter, setAssetTypeFilter] = useState<'All' | ProjectAssetType>('All');
  const [error, setError] = useState('');


  const showCharterFields = projectType === 'Charter / Voyage' || projectType === 'Mixed / Composite';
  const showRiskProfile = projectTypeRequiresRiskProfile(projectType);
  const showRoute = projectTypeRequiresRoute(projectType);
  const showServiceFields = projectTypeShowsServiceFields(projectType);

  const composableVessels = useMemo(
    () =>
      filterVesselsForProjectComposition(
        vessels,
        activePersona,
        requestingOrganization,
        assuranceSets,
        includeExternalProviders,
      ),
    [vessels, activePersona, requestingOrganization, assuranceSets, includeExternalProviders],
  );

  const composableCrew = useMemo(
    () => filterCrewForProjectComposition(crew, requestingOrganization, includeExternalProviders),
    [crew, requestingOrganization, includeExternalProviders],
  );

  const composableEquipment = useMemo(
    () => filterEquipmentForProjectComposition(equipment, requestingOrganization, includeExternalProviders),
    [equipment, requestingOrganization, includeExternalProviders],
  );

  const availableAssets = useMemo(() => {
    const list: DraftAssetLink[] = [];
    composableVessels.forEach((v) => {
      list.push({
        assetType: 'Vessel',
        assetId: v.id,
        assetName: v.name,
        providerOrganization: v.registeredOwner,
        assuranceSetId: '',
        roleInProject: DEFAULT_ROLES.Vessel || '',
      });
    });
    composableCrew.forEach((c) => {
      list.push({
        assetType: 'Crew',
        assetId: c.id,
        assetName: c.fullName,
        providerOrganization: c.organization || requestingOrganization,
        assuranceSetId: '',
        roleInProject: DEFAULT_ROLES.Crew || '',
      });
    });
    composableEquipment.forEach((e) => {
      list.push({
        assetType: 'Equipment',
        assetId: e.id,
        assetName: e.name,
        providerOrganization: e.owningOrganization,
        assuranceSetId: '',
        roleInProject: DEFAULT_ROLES.Equipment || '',
      });
    });
    if (includeExternalProviders) {
      EXISTING_ACTIVITIES.forEach((a) => {
        list.push({
          assetType: 'Activity',
          assetId: a.id,
          assetName: a.name,
          providerOrganization: requestingOrganization,
          assuranceSetId: '',
          roleInProject: DEFAULT_ROLES.Activity || '',
          notes: a.category,
        });
      });
    }
    return list;
  }, [composableVessels, composableCrew, composableEquipment, includeExternalProviders, requestingOrganization]);

  const filteredAvailable = useMemo(() => {
    const linked = new Set(draftLinks.map((l) => `${l.assetType}:${l.assetId}`));
    return availableAssets.filter((a) => {
      if (linked.has(`${a.assetType}:${a.assetId}`)) return false;
      if (assetTypeFilter !== 'All' && a.assetType !== assetTypeFilter) return false;
      return true;
    });
  }, [availableAssets, draftLinks, assetTypeFilter]);

  const assuranceSetOptions = (
    assetType: ProjectAssetType,
    assetId: string,
    providerOrganization: string,
  ) =>
    getEligibleAssuranceSetsForAsset(assetType, assetId, assuranceSets, {
      requestingOrganization,
      providerOrganization,
    });

  const handleAddAsset = (asset: DraftAssetLink) => {
    const sets = assuranceSetOptions(asset.assetType, asset.assetId, asset.providerOrganization);
    setDraftLinks((prev) => [
      ...prev,
      {
        ...asset,
        assuranceSetId: sets[0]?.id || '',
      },
    ]);
  };

  const validateStep1 = (): boolean => {
    if (!name.trim()) {
      setError('Project name is required.');
      return false;
    }
    if (!requestingOrganization.trim()) {
      setError('Requesting organization is required.');
      return false;
    }
    if (!location.trim()) {
      setError('Location / site is required.');
      return false;
    }
    if (!projectWindowStart || !projectWindowEnd) {
      setError('Project window start and end dates are required.');
      return false;
    }
    if (showRoute && !routeDescription.trim()) {
      setError('Route / transit description is required for charter / voyage projects.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = () => {
    if (!validateStep1()) return;

    const crossOrgMissing = draftLinks.filter(
      (l) =>
        requiresAssuranceSetForAssetLink(requestingOrganization, l.providerOrganization) &&
        !l.assuranceSetId,
    );
    if (crossOrgMissing.length > 0) {
      setError('Cross-organization assets require an assurance set. Same-org assets may proceed without one.');
      return;
    }

    const result = addProject({
      name: name.trim(),
      projectType,
      clientOperator: defaultOrg,
      requestingOrganization: requestingOrganization.trim(),
      location: location.trim(),
      description: description.trim(),
      charterWindowStart: projectWindowStart,
      charterWindowEnd: projectWindowEnd,
      operatorOrganization: defaultOrg,
      charterer: showCharterFields ? (charterer.trim() || requestingOrganization.trim()) : undefined,
      routeDescription: showRoute ? routeDescription.trim() : undefined,
      riskProfile: showRiskProfile && riskProfile ? riskProfile : null,
      serviceProvider: showServiceFields ? serviceProvider.trim() || undefined : undefined,
      workOrderRef: showServiceFields ? workOrderRef.trim() || undefined : undefined,
      workLocationType: showServiceFields ? workLocationType : undefined,
      primaryVesselId: primaryVesselId || undefined,
      assetLinks: draftLinks.map(
        ({ assetType, assetId, assetName, providerOrganization, assuranceSetId, roleInProject, notes }) => ({
          assetType,
          assetId,
          assetName,
          providerOrganization,
          assuranceSetId,
          roleInProject: roleInProject.trim() || undefined,
          notes,
        }),
      ),
    });

    if (result.success && result.projectId) {
      setCurrentHashView('project', result.projectId);
    } else {
      setError(result.message || 'Failed to create project.');
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-end">
        <span className="badge bg-primary-subtle text-primary font-mono-code">
          Step {step} of 2
        </span>
      </div>

      <div className="card map-card-custom p-4">
        <h2 className="h4 fw-bold text-dark mb-1">Create Project</h2>
        <p className="text-muted small mb-4">
          Compose vessels, crew, equipment, or services from one or more organizations for any type of work.
        </p>

        {step === 1 && (
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label small fw-semibold">Project Name *</label>
              <input
                className="form-control form-control-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pacific Endeavour — Hull Fouling Removal"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Project Type *</label>
              <select
                className="form-select form-select-sm"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectType)}
              >
                {PROJECT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold">Requesting Organization *</label>
              <input
                className="form-control form-control-sm"
                value={requestingOrganization}
                onChange={(e) => setRequestingOrganization(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Location / Site *</label>
              <input
                className="form-control form-control-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Port, yard, vessel, or field location"
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold">Project Window Start *</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={projectWindowStart}
                onChange={(e) => setProjectWindowStart(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Project Window End *</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={projectWindowEnd}
                onChange={(e) => setProjectWindowEnd(e.target.value)}
              />
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold">Description / Scope of Work</label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What needs to happen — cleaning, rental, crew provision, charter scope..."
              />
            </div>

            {showCharterFields && (
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Primary Operator / Charterer</label>
                <input
                  className="form-control form-control-sm"
                  value={charterer}
                  onChange={(e) => setCharterer(e.target.value)}
                />
              </div>
            )}

            {showRoute && (
              <div className="col-12">
                <label className="form-label small fw-semibold">Route / Transit Description *</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                />
              </div>
            )}

            {showRiskProfile && (
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Risk Profile (optional)</label>
                <select
                  className="form-select form-select-sm"
                  value={riskProfile}
                  onChange={(e) => setRiskProfile(e.target.value as ProjectRiskProfile | '')}
                >
                  <option value="">Not Applicable</option>
                  <option value="Standard">Standard</option>
                  <option value="Elevated">Elevated</option>
                  <option value="High-Risk">High-Risk</option>
                  <option value="Armed Escort Required">Armed Escort Required</option>
                </select>
              </div>
            )}

            {showServiceFields && (
              <>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Service Provider Organization</label>
                  <input
                    className="form-control form-control-sm"
                    value={serviceProvider}
                    onChange={(e) => setServiceProvider(e.target.value)}
                    placeholder="External org supplying crew, equipment, or service"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Work Order / PO Reference</label>
                  <input
                    className="form-control form-control-sm"
                    value={workOrderRef}
                    onChange={(e) => setWorkOrderRef(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Work Location Type</label>
                  <select
                    className="form-select form-select-sm"
                    value={workLocationType}
                    onChange={(e) => setWorkLocationType(e.target.value as WorkLocationType)}
                  >
                    {WORK_LOCATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Primary Vessel (optional)</label>
                  <select
                    className="form-select form-select-sm"
                    value={primaryVesselId}
                    onChange={(e) => setPrimaryVesselId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {composableVessels.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {error && <div className="col-12 alert alert-danger py-2 small mb-0">{error}</div>}

            <div className="col-12 d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
              >
                Next: Compose Assets
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            <div className="d-flex flex-wrap align-items-center justify-between gap-2 mb-3">
              <div className="text-muted small">
                Showing assets for <strong>{requestingOrganization}</strong>
                {!includeExternalProviders && ' (your organization only)'}
              </div>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="includeExternalProviders"
                  checked={includeExternalProviders}
                  onChange={(e) => setIncludeExternalProviders(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="includeExternalProviders">
                  Include external providers
                </label>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              {(['All', 'Vessel', 'Crew', 'Equipment', ...(includeExternalProviders ? (['Activity'] as const) : [])] as const).map((t) => (
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
                <h6 className="fw-bold small text-uppercase text-secondary">Available Assets &amp; Services</h6>
                <div className="border rounded" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {filteredAvailable.length === 0 ? (
                    <div className="p-3 text-muted small text-center">
                      No assets available.
                      {!includeExternalProviders && ' Enable external providers to add cross-org assets.'}
                    </div>
                  ) : (
                    filteredAvailable.map((a) => {
                      const isOwnOrg = isOrganizationMatch(requestingOrganization, a.providerOrganization);
                      return (
                        <div
                          key={`${a.assetType}-${a.assetId}`}
                          className="d-flex align-items-center justify-between p-2 border-bottom small"
                        >
                          <div>
                            <div className="fw-semibold d-flex align-items-center gap-1 flex-wrap">
                              {a.assetName}
                              <span className={`badge ${isOwnOrg ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '0.6rem' }}>
                                {isOwnOrg ? 'Your org' : 'External'}
                              </span>
                            </div>
                            <div className="text-muted">
                              {a.assetType} · {a.providerOrganization}
                            </div>
                          </div>
                          <button type="button" className="btn btn-xs btn-outline-primary btn-sm" onClick={() => handleAddAsset(a)}>
                            Add
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="col-md-7">
                <h6 className="fw-bold small text-uppercase text-secondary">Project Asset Roster</h6>
                {draftLinks.length === 0 ? (
                  <div className="p-4 border rounded text-center text-muted small">
                    Add your organization&apos;s assets first. Enable external providers for cross-org crew, equipment, or services — assurance sets are required for external assets.
                  </div>
                ) : (
                  <div className="table-responsive border rounded">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Organization</th>
                          <th>Role</th>
                          <th>Assurance Set</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {draftLinks.map((link) => {
                          const sets = assuranceSetOptions(
                            link.assetType,
                            link.assetId,
                            link.providerOrganization,
                          );
                          const needsAssurance = requiresAssuranceSetForAssetLink(
                            requestingOrganization,
                            link.providerOrganization,
                          );
                          return (
                            <tr key={`${link.assetType}-${link.assetId}`}>
                              <td>
                                <div className="fw-semibold">{link.assetName}</div>
                                <div className="text-muted">{link.assetType}</div>
                              </td>
                              <td className="small">{link.providerOrganization}</td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={link.roleInProject}
                                  onChange={(e) =>
                                    setDraftLinks((prev) =>
                                      prev.map((l) =>
                                        l.assetId === link.assetId && l.assetType === link.assetType
                                          ? { ...l, roleInProject: e.target.value }
                                          : l,
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <select
                                  className={`form-select form-select-sm ${needsAssurance && !link.assuranceSetId ? 'border-danger' : ''}`}
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
                                  <option value="">
                                    {needsAssurance ? 'Required for cross-org' : 'Optional (same org)'}
                                  </option>
                                  {sets.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.id}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    setDraftLinks((prev) =>
                                      prev.filter(
                                        (l) => !(l.assetId === link.assetId && l.assetType === link.assetType),
                                      ),
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
                Back
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
