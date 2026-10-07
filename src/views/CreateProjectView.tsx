/*
  file summary: three-step create project wizard — project info, assurance set, external assets.
  responsibilities: captures project header, seeds roster from selected assurance sets, adds external assets.
  role in system: rendered when hash route is #/project/new.
*/

import React, { useMemo, useState } from 'react';
import { Trash2, Eye } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { AttachAssuranceSetPreviewModal } from '../components/drawers/AttachAssuranceSetPreviewModal';
import { AssuranceSet } from '../types/assurance';
import {
  PROJECT_TYPE_OPTIONS,
  ProjectAssetType,
  ProjectRiskProfile,
  ProjectType,
  WORK_LOCATION_OPTIONS,
  WorkLocationType,
} from '../types/project';
import {
  buildDraftAssetLinksFromAssuranceSets,
  DraftProjectAssetLink,
  filterExternalCrewForProjectComposition,
  filterExternalEquipmentForProjectComposition,
  filterExternalVesselsForProjectComposition,
  getAssuranceSetsForProjectCreation,
  getEligibleAssuranceSetsForAsset,
  getProjectOrganizationForPersona,
  projectTypeRequiresRiskProfile,
  projectTypeRequiresRoute,
  projectTypeShowsServiceFields,
  requiresAssuranceSetForAssetLink,
} from '../utils/projectHelpers';

const DEFAULT_ROLES: Partial<Record<ProjectAssetType, string>> = {
  Vessel: 'Subject vessel',
  Crew: 'Service crew',
  Equipment: 'Rented equipment',
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
  } = useMapStore();

  const defaultOrg = getProjectOrganizationForPersona(activePersona, users);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [projectType, setProjectType] = useState<ProjectType>('Service Engagement');
  const [name, setName] = useState('Pacific Endeavour — Subsea Maintenance Campaign');
  const [requestingOrganization, setRequestingOrganization] = useState(defaultOrg);
  const [location, setLocation] = useState('Timor Sea — Offshore Sector 4');
  const [projectWindowStart, setProjectWindowStart] = useState('2026-11-01');
  const [projectWindowEnd, setProjectWindowEnd] = useState('2027-02-28');
  const [description, setDescription] = useState('Subsea equipment inspection, statutory assurance verification, and offshore charter mobilization.');
  const [charterer, setCharterer] = useState(defaultOrg);
  const [routeDescription, setRouteDescription] = useState('Dampier Port to Browse Basin Field Corridor');
  const [riskProfile, setRiskProfile] = useState<ProjectRiskProfile | ''>('Standard');
  const [serviceProvider, setServiceProvider] = useState('Oceanic Subsea Services');
  const [workOrderRef, setWorkOrderRef] = useState('WO-2026-MAR-0412');
  const [workLocationType, setWorkLocationType] = useState<WorkLocationType>('Onboard');
  const [primaryVesselId, setPrimaryVesselId] = useState('');
  const [selectedAssuranceSetIds, setSelectedAssuranceSetIds] = useState<string[]>([]);
  const [previewSet, setPreviewSet] = useState<AssuranceSet | null>(null);
  const [draftLinks, setDraftLinks] = useState<DraftProjectAssetLink[]>([]);
  const [assetTypeFilter, setAssetTypeFilter] = useState<'All' | ProjectAssetType>('All');
  const [error, setError] = useState('');

  const showCharterFields = projectType === 'Charter / Voyage' || projectType === 'Mixed / Composite';
  const showRiskProfile = projectTypeRequiresRiskProfile(projectType);
  const showRoute = projectTypeRequiresRoute(projectType);
  const showServiceFields = projectTypeShowsServiceFields(projectType);

  const externalVessels = useMemo(
    () => filterExternalVesselsForProjectComposition(vessels, requestingOrganization),
    [vessels, requestingOrganization],
  );

  const selectableAssuranceSets = useMemo(
    () => getAssuranceSetsForProjectCreation(assuranceSets, requestingOrganization),
    [assuranceSets, requestingOrganization],
  );

  const selectedAssuranceSets = useMemo(
    () =>
      selectedAssuranceSetIds
        .map((id) => assuranceSets.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [assuranceSets, selectedAssuranceSetIds],
  );

  const seedPreviewLinks = useMemo(
    () =>
      buildDraftAssetLinksFromAssuranceSets(
        selectedAssuranceSetIds,
        assuranceSets,
        vessels,
        crew,
        equipment,
      ).links,
    [selectedAssuranceSetIds, assuranceSets, vessels, crew, equipment],
  );

  const toggleAssuranceSet = (setId: string) => {
    setSelectedAssuranceSetIds((prev) =>
      prev.includes(setId) ? prev.filter((id) => id !== setId) : [...prev, setId],
    );
  };

  const assuranceSetOptions = (
    assetType: ProjectAssetType,
    assetId: string,
    providerOrganization: string,
  ) =>
    getEligibleAssuranceSetsForAsset(assetType, assetId, assuranceSets, {
      requestingOrganization,
      providerOrganization,
    });

  const externalAssetsWithSets = useMemo(() => {
    const list: DraftProjectAssetLink[] = [];

    externalVessels.forEach((v) => {
      const sets = assuranceSetOptions('Vessel', v.id, v.registeredOwner);
      if (sets.length === 0) return;
      list.push({
        assetType: 'Vessel',
        assetId: v.id,
        assetName: v.name,
        providerOrganization: v.registeredOwner,
        assuranceSetId: sets[0].id,
        roleInProject: DEFAULT_ROLES.Vessel || '',
      });
    });

    filterExternalCrewForProjectComposition(crew, requestingOrganization).forEach((c) => {
      const providerOrganization = c.organization || '';
      const sets = assuranceSetOptions('Crew', c.id, providerOrganization);
      if (sets.length === 0) return;
      list.push({
        assetType: 'Crew',
        assetId: c.id,
        assetName: c.fullName,
        providerOrganization,
        assuranceSetId: sets[0].id,
        roleInProject: DEFAULT_ROLES.Crew || '',
      });
    });

    filterExternalEquipmentForProjectComposition(equipment, requestingOrganization).forEach((e) => {
      const sets = assuranceSetOptions('Equipment', e.id, e.owningOrganization);
      if (sets.length === 0) return;
      list.push({
        assetType: 'Equipment',
        assetId: e.id,
        assetName: e.name,
        providerOrganization: e.owningOrganization,
        assuranceSetId: sets[0].id,
        roleInProject: DEFAULT_ROLES.Equipment || '',
      });
    });

    return list;
  }, [externalVessels, crew, equipment, assuranceSets, requestingOrganization]);

  const filteredAvailable = useMemo(() => {
    const linked = new Set(draftLinks.map((l) => `${l.assetType}:${l.assetId}`));
    return externalAssetsWithSets.filter((a) => {
      if (linked.has(`${a.assetType}:${a.assetId}`)) return false;
      if (assetTypeFilter !== 'All' && a.assetType !== assetTypeFilter) return false;
      return true;
    });
  }, [externalAssetsWithSets, draftLinks, assetTypeFilter]);

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

  const validateStep2 = (): boolean => {
    if (selectedAssuranceSetIds.length === 0) {
      setError('Select at least one assurance set to continue.');
      return false;
    }
    const { links, unresolvedSetIds } = buildDraftAssetLinksFromAssuranceSets(
      selectedAssuranceSetIds,
      assuranceSets,
      vessels,
      crew,
      equipment,
    );
    if (unresolvedSetIds.length > 0) {
      setError(
        `Could not resolve assets for: ${unresolvedSetIds.join(', ')}.`,
      );
      return false;
    }
    if (links.length === 0) {
      setError('Selected assurance sets do not resolve to any project assets.');
      return false;
    }
    setDraftLinks(links);
    setError('');
    return true;
  };

  const handleAddAsset = (asset: DraftProjectAssetLink) => {
    setDraftLinks((prev) => [...prev, asset]);
  };

  const handleSave = () => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }

    const missingAssurance = draftLinks.filter((l) => !l.assuranceSetId);
    if (missingAssurance.length > 0) {
      setError('Every external asset requires an assurance set.');
      return;
    }

    if (draftLinks.length === 0) {
      setError('Add at least one external asset to the project roster.');
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

  const stepLabels = ['Project Info', 'Assurance Set', 'Assets'];

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-end">
        <span className="badge bg-primary-subtle text-primary font-mono-code">
          Step {step} of 3 — {stepLabels[step - 1]}
        </span>
      </div>

      <div className="card map-card-custom p-4">
        <h2 className="h4 fw-bold text-dark mb-1">Create Project</h2>
        <p className="text-muted small mb-4">
          Define project details, choose one or more seed assurance sets, then compose external-provider assets.
        </p>

        {step === 1 && (
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label small fw-semibold">
                Project Name <span className="text-danger">*</span>
              </label>
              <input
                className="form-control form-control-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pacific Endeavour — Hull Fouling Removal"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">
                Project Type <span className="text-danger">*</span>
              </label>
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
              <label className="form-label small fw-semibold">
                Requesting Organization <span className="text-danger">*</span>
              </label>
              <input
                className="form-control form-control-sm"
                value={requestingOrganization}
                onChange={(e) => setRequestingOrganization(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">
                Location / Site <span className="text-danger">*</span>
              </label>
              <input
                className="form-control form-control-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Port, yard, vessel, or field location"
              />
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold">
                Project Window Start <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={projectWindowStart}
                onChange={(e) => setProjectWindowStart(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">
                Project Window End <span className="text-danger">*</span>
              </label>
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
                <label className="form-label small fw-semibold">
                  Route / Transit Description <span className="text-danger">*</span>
                </label>
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
                Next: Choose Assurance Set
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            <p className="text-muted small mb-3">
              Select one or more existing assurance sets for <strong>{requestingOrganization}</strong>.
              Their linked assets will prefill the project roster in the next step.
            </p>

            {selectableAssuranceSets.length === 0 ? (
              <div className="alert alert-warning small">
                No eligible assurance sets found for this organization. Create an assurance set first, then
                return to compose a project.
              </div>
            ) : (
              <div className="list-group mb-3">
                {selectableAssuranceSets.map((s) => {
                  const isSelected = selectedAssuranceSetIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`list-group-item list-group-item-action d-flex align-items-center gap-3 ${isSelected ? 'active' : ''
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={isSelected}
                        onChange={() => toggleAssuranceSet(s.id)}
                      />
                      <div
                        className="flex-grow-1"
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleAssuranceSet(s.id)}
                      >
                        <div className="fw-semibold font-mono-code">{s.id}</div>
                        <div className={isSelected ? '' : 'text-dark'}>{s.title}</div>
                        <div className={`small ${isSelected ? 'text-white-50' : 'text-muted'}`}>
                          {s.assuranceType || 'Asset'} · {s.stage}
                          {s.vesselName ? ` · ${s.vesselName}` : ''}
                          {s.crewName ? ` · ${s.crewName}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-light text-dark' : 'btn-outline-primary'} p-0 d-inline-flex align-items-center justify-content-center`}
                        style={{ width: '32px', height: '32px' }}
                        title="Preview Documents & Requirements"
                        aria-label="Preview Documents & Requirements"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPreviewSet(s);
                        }}
                      >
                        <Eye size={16} />
                      </button>
                      <span className={`badge ${isSelected ? 'bg-light text-dark' : 'bg-secondary'}`}>
                        {s.readinessScore}% ready
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedAssuranceSets.length > 0 && (
              <div className="alert alert-info py-2 small mb-3">
                <div className="fw-semibold mb-1">
                  {selectedAssuranceSetIds.length} assurance set
                  {selectedAssuranceSetIds.length !== 1 ? 's' : ''} selected ·{' '}
                  {seedPreviewLinks.length} seed asset
                  {seedPreviewLinks.length !== 1 ? 's' : ''}
                </div>
                <ul className="mb-0 ps-3">
                  {seedPreviewLinks.map((link) => (
                    <li key={`${link.assetType}-${link.assetId}`}>
                      {link.assetName} ({link.assetType}) ·{' '}
                      <span className="font-mono-code">{link.assuranceSetId}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            <div className="d-flex justify-content-between">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold"
                disabled={selectableAssuranceSets.length === 0 || selectedAssuranceSetIds.length === 0}
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
              >
                Next: Compose Assets
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-muted small mb-3">
              External-provider assets only for <strong>{requestingOrganization}</strong>. Seed assets from{' '}
              {selectedAssuranceSetIds.length} selected assurance set
              {selectedAssuranceSetIds.length !== 1 ? 's' : ''} are already on the roster — add more from the
              left panel.
            </div>

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
                <h6 className="fw-bold small text-uppercase text-secondary">
                  Available External Assets
                </h6>
                <div className="border rounded" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {filteredAvailable.length === 0 ? (
                    <div className="p-3 text-muted small text-center">
                      No additional external assets with assurance sets available.
                    </div>
                  ) : (
                    filteredAvailable.map((a) => (
                      <div
                        key={`${a.assetType}-${a.assetId}`}
                        className="d-flex align-items-center justify-between p-2 border-bottom small"
                      >
                        <div>
                          <div className="fw-semibold d-flex align-items-center gap-1 flex-wrap">
                            {a.assetName}
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.6rem' }}>
                              External
                            </span>
                          </div>
                          <div className="text-muted">
                            {a.assetType} · {a.providerOrganization}
                          </div>
                          <div className="font-mono-code text-primary" style={{ fontSize: '0.7rem' }}>
                            {a.assuranceSetId}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary btn-sm"
                          onClick={() => handleAddAsset(a)}
                        >
                          Add
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
                    No assets on the roster. Go back and select assurance sets to seed the roster.
                  </div>
                ) : (
                  <div className="table-responsive border rounded">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Asset ID</th>
                          <th>Asset Name</th>
                          <th>Organization</th>
                          <th>Project Role</th>
                          <th>Assurance Set</th>
                          <th className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftLinks.map((link) => {
                          const linkedSet = assuranceSets.find((s) => s.id === link.assuranceSetId);
                          const isSeedAsset = selectedAssuranceSetIds.includes(link.assuranceSetId);
                          return (
                            <tr key={`${link.assetType}-${link.assetId}`}>
                              <td className="font-mono-code fw-semibold text-primary">
                                {link.assetId}
                              </td>
                              <td>
                                <div className="fw-semibold text-dark">{link.assetName}</div>
                                <div className="text-muted small">{link.assetType}</div>
                              </td>
                              <td className="small">{link.providerOrganization}</td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={link.roleInProject}
                                  placeholder="e.g. Lead Towing Tug"
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
                                <div className="font-mono-code small text-primary">
                                  {link.assuranceSetId}
                                </div>
                                {linkedSet && (
                                  <div className="text-muted small">{linkedSet.title}</div>
                                )}
                                {isSeedAsset && (
                                  <span className="badge bg-info text-dark mt-1" style={{ fontSize: '0.6rem' }}>
                                    Seed set
                                  </span>
                                )}
                              </td>
                              <td className="text-end">
                                {!isSeedAsset && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                                    style={{ width: '32px', height: '32px' }}
                                    onClick={() =>
                                      setDraftLinks((prev) =>
                                        prev.filter(
                                          (l) =>
                                            !(l.assetId === link.assetId && l.assetType === link.assetType),
                                        ),
                                      )
                                    }
                                    title="Remove Asset from Roster"
                                    aria-label="Remove Asset from Roster"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
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
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setDraftLinks([]);
                  setStep(2);
                }}
              >
                Back
              </button>
              <button type="button" className="btn btn-sm btn-primary fw-semibold" onClick={handleSave}>
                Create Project
              </button>
            </div>
          </>
        )}
      </div>

      <AttachAssuranceSetPreviewModal
        isOpen={Boolean(previewSet)}
        onClose={() => setPreviewSet(null)}
        assuranceSet={previewSet}
        project={{
          id: 'MAP-PROJ-DRAFT',
          name: name || 'Draft Project',
          clientOperator: requestingOrganization || defaultOrg,
          location: location || 'Offshore',
          projectType,
          status: 'Draft',
          charterWindowStart: projectWindowStart,
          charterWindowEnd: projectWindowEnd,
          requestingOrganization: requestingOrganization || defaultOrg,
          operatorOrganization: requestingOrganization || defaultOrg,
          assetLinks: [],
        }}
        onConfirm={() => {
          if (previewSet && !selectedAssuranceSetIds.includes(previewSet.id)) {
            setSelectedAssuranceSetIds((prev) => [...prev, previewSet.id]);
          }
          setPreviewSet(null);
        }}
      />
    </div>
  );
};
