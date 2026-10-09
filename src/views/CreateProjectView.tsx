/*
  file summary: three-step create project wizard — project info, optional assurance sets, optional assets.
  responsibilities: captures project header, optionally attaches assurance sets and external assets.
  role in system: rendered when hash route is #/project/new.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Trash2, Eye } from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import { AttachAssuranceSetPreviewModal } from "../components/drawers/AttachAssuranceSetPreviewModal";
import { AssuranceSet } from "../types/assurance";
import {
  PROJECT_TYPE_OPTIONS,
  ProjectAssetType,
  ProjectRiskProfile,
  ProjectType,
  WORK_LOCATION_OPTIONS,
  WorkLocationType,
} from "../types/project";
import {
  buildDraftAssetLinksFromAssuranceSets,
  DraftProjectAssetLink,
  getAssuranceSetsForProjectCreation,
  getLinkableProjectAssets,
  getProjectOrganizationForPersona,
  LinkableProjectAsset,
  PROJECT_ASSET_LINK_HINT,
  projectTypeRequiresRiskProfile,
  projectTypeRequiresRoute,
  projectTypeShowsServiceFields,
} from "../utils/projectHelpers";
import { calculateAssuranceSetReadiness } from "../utils/readinessHelpers";

const DEFAULT_ROLES: Partial<Record<ProjectAssetType, string>> = {
  Vessel: "Subject vessel",
  Crew: "Service crew",
  Equipment: "Rented equipment",
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
  const [projectType, setProjectType] =
    useState<ProjectType>("Service Engagement");
  const [name, setName] = useState(
    "Pacific Endeavour — Subsea Maintenance Campaign",
  );
  const [requestingOrganization, setRequestingOrganization] =
    useState(defaultOrg);
  const [location, setLocation] = useState("Timor Sea — Offshore Sector 4");
  const [projectWindowStart, setProjectWindowStart] = useState("2026-11-01");
  const [projectWindowEnd, setProjectWindowEnd] = useState("2027-02-28");
  const [description, setDescription] = useState(
    "Subsea equipment inspection, statutory assurance verification, and offshore charter mobilization.",
  );
  const [charterer, setCharterer] = useState(defaultOrg);
  const [routeDescription, setRouteDescription] = useState(
    "Dampier Port to Browse Basin Field Corridor",
  );
  const [riskProfile, setRiskProfile] = useState<ProjectRiskProfile | "">(
    "Standard",
  );
  const [serviceProvider, setServiceProvider] = useState(
    "Oceanic Subsea Services",
  );
  const [workOrderRef, setWorkOrderRef] = useState("WO-2026-MAR-0412");
  const [workLocationType, setWorkLocationType] =
    useState<WorkLocationType>("Onboard");
  const [primaryVesselId, setPrimaryVesselId] = useState("");
  const [selectedAssuranceSetIds, setSelectedAssuranceSetIds] = useState<
    string[]
  >([]);
  const [previewSet, setPreviewSet] = useState<AssuranceSet | null>(null);
  const [draftLinks, setDraftLinks] = useState<DraftProjectAssetLink[]>([]);
  const [assetTypeFilter, setAssetTypeFilter] = useState<
    "All" | ProjectAssetType
  >("All");
  const [pickAssuranceSetByKey, setPickAssuranceSetByKey] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState("");

  const showCharterFields =
    projectType === "Charter / Voyage" || projectType === "Mixed / Composite";
  const showRiskProfile = projectTypeRequiresRiskProfile(projectType);
  const showRoute = projectTypeRequiresRoute(projectType);
  const showServiceFields = projectTypeShowsServiceFields(projectType);

  const selectableAssuranceSets = useMemo(
    () =>
      getAssuranceSetsForProjectCreation(assuranceSets, requestingOrganization),
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
      prev.includes(setId)
        ? prev.filter((id) => id !== setId)
        : [...prev, setId],
    );
  };

  const linkableAssets = useMemo(
    () =>
      getLinkableProjectAssets({
        vessels,
        crew,
        equipment,
        assuranceSets,
        requestingOrganization,
        excludeAssetKeys: draftLinks.map((l) => `${l.assetType}:${l.assetId}`),
      }),
    [vessels, crew, equipment, assuranceSets, requestingOrganization, draftLinks],
  );

  useEffect(() => {
    setPickAssuranceSetByKey((prev) => {
      const next = { ...prev };
      linkableAssets.forEach((asset) => {
        const key = `${asset.assetType}:${asset.assetId}`;
        if (!next[key] && asset.eligibleAssuranceSets[0]) {
          next[key] = asset.eligibleAssuranceSets[0].id;
        }
      });
      return next;
    });
  }, [linkableAssets]);

  const filteredAvailable = useMemo(() => {
    return linkableAssets.filter((a) => {
      if (assetTypeFilter !== "All" && a.assetType !== assetTypeFilter)
        return false;
      return true;
    });
  }, [linkableAssets, assetTypeFilter]);

  const validateStep1 = (): boolean => {
    if (!name.trim()) {
      setError("Project name is required.");
      return false;
    }
    if (!requestingOrganization.trim()) {
      setError("Requesting organization is required.");
      return false;
    }
    if (!location.trim()) {
      setError("Location / site is required.");
      return false;
    }
    if (!projectWindowStart || !projectWindowEnd) {
      setError("Project window start and end dates are required.");
      return false;
    }
    if (showRoute && !routeDescription.trim()) {
      setError(
        "Route / transit description is required for charter / voyage projects.",
      );
      return false;
    }
    setError("");
    return true;
  };

  const proceedToStep3 = (skipAssuranceSets = false) => {
    if (skipAssuranceSets || selectedAssuranceSetIds.length === 0) {
      setDraftLinks([]);
      setError("");
      setStep(3);
      return;
    }

    const { links, unresolvedSetIds } = buildDraftAssetLinksFromAssuranceSets(
      selectedAssuranceSetIds,
      assuranceSets,
      vessels,
      crew,
      equipment,
    );
    if (unresolvedSetIds.length > 0) {
      setError(`Could not resolve assets for: ${unresolvedSetIds.join(", ")}.`);
      return;
    }
    setDraftLinks(links);
    setError("");
    setStep(3);
  };

  const handleAddAsset = (asset: LinkableProjectAsset) => {
    const key = `${asset.assetType}:${asset.assetId}`;
    const assuranceSetId =
      pickAssuranceSetByKey[key] || asset.eligibleAssuranceSets[0]?.id;
    if (!assuranceSetId) {
      setError("Select an assurance set for this asset.");
      return;
    }

    setDraftLinks((prev) => [
      ...prev,
      {
        assetType: asset.assetType,
        assetId: asset.assetId,
        assetName: asset.assetName,
        providerOrganization: asset.providerOrganization,
        assuranceSetId,
        roleInProject: DEFAULT_ROLES[asset.assetType] || "",
      },
    ]);
    setError("");
  };

  const handleRemoveAsset = (assetType: ProjectAssetType, assetId: string) => {
    setDraftLinks((prev) =>
      prev.filter((l) => !(l.assetType === assetType && l.assetId === assetId)),
    );
  };

  const handleUpdateRole = (
    assetType: ProjectAssetType,
    assetId: string,
    roleInProject: string,
  ) => {
    setDraftLinks((prev) =>
      prev.map((l) =>
        l.assetType === assetType && l.assetId === assetId
          ? { ...l, roleInProject }
          : l,
      ),
    );
  };

  const assuranceSetCards = useMemo(() => {
    const cards = selectedAssuranceSets.map((set) => ({
      set,
      assets: draftLinks.filter((l) => l.assuranceSetId === set.id),
    }));

    const selectedIds = new Set(selectedAssuranceSetIds);
    draftLinks.forEach((link) => {
      if (selectedIds.has(link.assuranceSetId)) return;
      const set = assuranceSets.find((s) => s.id === link.assuranceSetId);
      if (!set) return;
      if (cards.some((c) => c.set.id === set.id)) return;
      cards.push({
        set,
        assets: draftLinks.filter((l) => l.assuranceSetId === set.id),
      });
    });

    return cards;
  }, [
    selectedAssuranceSets,
    selectedAssuranceSetIds,
    draftLinks,
    assuranceSets,
  ]);

  const handleSave = () => {
    if (!validateStep1()) {
      setStep(1);
      return;
    }

    const missingAssurance = draftLinks.filter((l) => !l.assuranceSetId);
    if (missingAssurance.length > 0) {
      setError("Every external asset requires an assurance set.");
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
      charterer: showCharterFields
        ? charterer.trim() || requestingOrganization.trim()
        : undefined,
      routeDescription: showRoute ? routeDescription.trim() : undefined,
      riskProfile: showRiskProfile && riskProfile ? riskProfile : null,
      serviceProvider: showServiceFields
        ? serviceProvider.trim() || undefined
        : undefined,
      workOrderRef: showServiceFields
        ? workOrderRef.trim() || undefined
        : undefined,
      workLocationType: showServiceFields ? workLocationType : undefined,
      primaryVesselId: primaryVesselId || undefined,
      assetLinks: draftLinks.map(
        ({
          assetType,
          assetId,
          assetName,
          providerOrganization,
          assuranceSetId,
          roleInProject,
          notes,
        }) => ({
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
      setCurrentHashView("project", result.projectId);
    } else {
      setError(result.message || "Failed to create project.");
    }
  };

  const stepLabels = [
    "Details",
    "Assurance Sets (optional)",
    "Assets (optional)",
  ];

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
          Enter the project details. Assurance sets and assets are optional.
        </p>

        {step === 1 && (
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label small fw-semibold">
                Name <span className="text-danger">*</span>
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
                Type <span className="text-danger">*</span>
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
                Client <span className="text-danger">*</span>
              </label>
              <input
                className="form-control form-control-sm"
                value={requestingOrganization}
                onChange={(e) => setRequestingOrganization(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">
                Location <span className="text-danger">*</span>
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
                Project Period Start <span className="text-danger">*</span>
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
                Project Period End <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={projectWindowEnd}
                onChange={(e) => setProjectWindowEnd(e.target.value)}
              />
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold">
                Description
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the project covers"
              />
            </div>

            {showCharterFields && (
              <div className="col-md-6">
                <label className="form-label small fw-semibold">
                  Charterer
                </label>
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
                  Route{" "}
                  <span className="text-danger">*</span>
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
                <label className="form-label small fw-semibold">
                  Risk Profile (optional)
                </label>
                <select
                  className="form-select form-select-sm"
                  value={riskProfile}
                  onChange={(e) =>
                    setRiskProfile(e.target.value as ProjectRiskProfile | "")
                  }
                >
                  <option value="">Not Applicable</option>
                  <option value="Standard">Standard</option>
                  <option value="Elevated">Elevated</option>
                  <option value="High-Risk">High-Risk</option>
                  <option value="Armed Escort Required">
                    Armed Escort Required
                  </option>
                </select>
              </div>
            )}

            {showServiceFields && (
              <>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    PO Reference
                  </label>
                  <input
                    className="form-control form-control-sm"
                    value={workOrderRef}
                    onChange={(e) => setWorkOrderRef(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    Work Location
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={workLocationType}
                    onChange={(e) =>
                      setWorkLocationType(e.target.value as WorkLocationType)
                    }
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

            {error && (
              <div className="col-12 alert alert-danger py-2 small mb-0">
                {error}
              </div>
            )}

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
              Select assurance sets for{" "}
              <strong>{requestingOrganization}</strong>. Their assets are
              added to the project in the next step.
            </p>

            {selectableAssuranceSets.length === 0 ? (
              <div className="alert alert-warning small">
                No assurance sets available. Create one first.
              </div>
            ) : (
              <div className="list-group mb-3">
                {selectableAssuranceSets.map((s) => {
                  const isSelected = selectedAssuranceSetIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`list-group-item list-group-item-action d-flex align-items-center gap-3 ${
                        isSelected ? "active" : ""
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
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleAssuranceSet(s.id)}
                      >
                        <div className="fw-semibold font-mono-code">{s.id}</div>
                        <div className={isSelected ? "" : "text-dark"}>
                          {s.title}
                        </div>
                        <div
                          className={`small ${isSelected ? "text-white-50" : "text-muted"}`}
                        >
                          {s.assuranceType || "Asset"} · {s.stage}
                          {s.vesselName ? ` · ${s.vesselName}` : ""}
                          {s.crewName ? ` · ${s.crewName}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${isSelected ? "btn-light text-dark" : "btn-outline-primary"} p-0 d-inline-flex align-items-center justify-content-center`}
                        style={{ width: "32px", height: "32px" }}
                        title="Preview"
                        aria-label="Preview"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPreviewSet(s);
                        }}
                      >
                        <Eye size={16} />
                      </button>
                      <span
                        className={`badge ${isSelected ? "bg-light text-dark" : "bg-secondary"}`}
                      >
                        {calculateAssuranceSetReadiness(s, assuranceSets)}% ready
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
                  {selectedAssuranceSetIds.length !== 1 ? "s" : ""} selected ·{" "}
                  {seedPreviewLinks.length} seed asset
                  {seedPreviewLinks.length !== 1 ? "s" : ""}
                </div>
                <ul className="mb-0 ps-3">
                  {seedPreviewLinks.map((link) => (
                    <li key={`${link.assetType}-${link.assetId}`}>
                      {link.assetName} ({link.assetType}) ·{" "}
                      <span className="font-mono-code">
                        {link.assuranceSetId}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="alert alert-danger py-2 small">{error}</div>
            )}

            <div className="d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => proceedToStep3(true)}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-semibold"
                  onClick={() => proceedToStep3(false)}
                >
                  Next: Compose Assets
                </button>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-muted small mb-3">
              Add assets for{" "}
              <strong>{requestingOrganization}</strong>. Assets from the selected
              assurance sets are already listed. Add more from the right.
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <h6 className="fw-bold small text-uppercase text-secondary">
                  Available Assets
                </h6>
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {(["All", "Vessel", "Crew", "Equipment"] as const).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        className={`btn btn-sm ${assetTypeFilter === t ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setAssetTypeFilter(t)}
                      >
                        {t}
                      </button>
                    ),
                  )}
                </div>
                <div
                  className="border rounded"
                  style={{ maxHeight: "320px", overflowY: "auto" }}
                >
                  {filteredAvailable.length === 0 ? (
                    <div className="p-3 text-muted small text-center">
                      <p className="mb-1">No assets available.</p>
                      <p className="mb-0 fst-italic">{PROJECT_ASSET_LINK_HINT}</p>
                    </div>
                  ) : (
                    filteredAvailable.map((a) => {
                      const assetKey = `${a.assetType}:${a.assetId}`;
                      const selectedSetId =
                        pickAssuranceSetByKey[assetKey] ||
                        a.eligibleAssuranceSets[0]?.id ||
                        "";
                      return (
                        <div
                          key={assetKey}
                          className="d-flex align-items-center justify-content-between gap-2 p-2 border-bottom small"
                        >
                          <div className="flex-grow-1 min-w-0">
                            <div className="fw-semibold d-flex align-items-center gap-1 flex-wrap">
                              {a.assetName}
                              <span
                                className="badge bg-warning text-dark"
                                style={{ fontSize: "0.6rem" }}
                              >
                                External
                              </span>
                            </div>
                            <div className="text-muted">
                              {a.assetType} · {a.providerOrganization}
                            </div>
                            {a.eligibleAssuranceSets.length > 1 ? (
                              <select
                                className="form-select form-select-sm mt-1 font-mono-code"
                                style={{ fontSize: "0.7rem", maxWidth: "280px" }}
                                value={selectedSetId}
                                onChange={(e) =>
                                  setPickAssuranceSetByKey((prev) => ({
                                    ...prev,
                                    [assetKey]: e.target.value,
                                  }))
                                }
                              >
                                {a.eligibleAssuranceSets.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.id} — {s.title}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div
                                className="font-mono-code text-primary"
                                style={{ fontSize: "0.7rem" }}
                              >
                                {selectedSetId}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary flex-shrink-0"
                            disabled={!selectedSetId}
                            onClick={() => handleAddAsset(a)}
                          >
                            Add
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              <div className="col-md-6">
                <h6 className="fw-bold small text-uppercase text-secondary">
                  Selected Assurance Sets
                </h6>
                <div
                  className="d-flex flex-column gap-2"
                  style={{ maxHeight: "360px", overflowY: "auto" }}
                >
                  {assuranceSetCards.length === 0 ? (
                    <div className="p-4 border rounded text-center text-muted small">
                      No assurance sets selected.
                    </div>
                  ) : (
                    assuranceSetCards.map(({ set, assets }) => (
                      <div key={set.id} className="border rounded p-3">
                        <div className="fw-semibold font-mono-code text-primary">
                          {set.id}
                        </div>
                        <div className="fw-semibold text-dark">{set.title}</div>
                        <div className="text-muted small mb-2">{set.stage}</div>
                        {assets.length === 0 ? (
                          <div className="text-muted small fst-italic">
                            No assets yet.
                          </div>
                        ) : (
                          <div className="d-flex flex-column gap-2 mt-2">
                            {assets.map((link) => (
                              <div
                                key={`${link.assetType}-${link.assetId}`}
                                className="border rounded p-2 bg-light small"
                              >
                                <div className="d-flex align-items-start justify-content-between gap-2">
                                  <div>
                                    <div className="fw-semibold">
                                      {link.assetName}
                                    </div>
                                    <div className="text-muted">
                                      {link.assetType} ·{" "}
                                      {link.providerOrganization}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0 flex-shrink-0"
                                    style={{ width: "28px", height: "28px" }}
                                    onClick={() =>
                                      handleRemoveAsset(
                                        link.assetType,
                                        link.assetId,
                                      )
                                    }
                                    title="Remove asset"
                                    aria-label="Remove asset"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <label className="form-label small mb-1 mt-2">
                                  Role in Project
                                </label>
                                <input
                                  className="form-control form-control-sm"
                                  value={link.roleInProject}
                                  placeholder="e.g. Lead Towing Tug"
                                  onChange={(e) =>
                                    handleUpdateRole(
                                      link.assetType,
                                      link.assetId,
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger py-2 small">{error}</div>
            )}

            <div className="d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleSave}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-semibold"
                  onClick={handleSave}
                >
                  Create Project
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <AttachAssuranceSetPreviewModal
        isOpen={Boolean(previewSet)}
        onClose={() => setPreviewSet(null)}
        assuranceSet={previewSet}
        project={{
          id: "MAP-PROJ-DRAFT",
          name: name || "Draft Project",
          clientOperator: requestingOrganization || defaultOrg,
          location: location || "Offshore",
          projectType,
          status: "Draft",
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
