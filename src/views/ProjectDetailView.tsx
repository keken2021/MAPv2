/*
  file summary: project detail with asset roster and assurance sets tabs.
  responsibilities: displays project summary, asset roster, assurance set list, and attach-existing-set flow.
  role in system: rendered for #/project/{id}.
*/

import React, { useEffect, useMemo, useState } from "react";
import { ReadinessGauge } from "../components/common/ReadinessGauge";
import { useMapStore } from "../store/useMapStore";
import { ProjectAssetLink, ProjectAssetType } from "../types/project";
import {
  filterCrewForProjectComposition,
  filterEquipmentForProjectComposition,
  filterProjectsForPersona,
  filterVesselsForProjectComposition,
  getEligibleAssuranceSetsForAsset,
  getStandaloneAssuranceSetsForAttach,
  isOrganizationMatch,
  requiresAssuranceSetForAssetLink,
} from "../utils/projectHelpers";
import { EXISTING_ACTIVITIES } from "../utils/assuranceTemplates";

interface ProjectDetailViewProps {
  projectId: string;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  projectId,
}) => {
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
    removeAssetFromProject,
    addAssetToProject,
    syncProjectMasterAssurance,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<"roster" | "assurance">("roster");
  const [assetFilter, setAssetFilter] = useState<"All" | ProjectAssetType>(
    "All",
  );
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [attachSetId, setAttachSetId] = useState("");
  const [includeExternalProviders, setIncludeExternalProviders] =
    useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () =>
      filterProjectsForPersona(projects, activePersona, users, assuranceSets),
    [projects, activePersona, users, assuranceSets],
  );

  const project = visibleProjects.find((p) => p.id === projectId);
  const masterSet = assuranceSets.find(
    (s) => s.id === project?.masterAssuranceSetId,
  );

  const filteredLinks = useMemo(() => {
    if (!project) return [];
    if (assetFilter === "All") return project.assetLinks;
    return project.assetLinks.filter((l) => l.assetType === assetFilter);
  }, [project, assetFilter]);

  const canManage =
    activePersona === "Administrator" || activePersona === "C Admin";
  const isCAdmin = activePersona === "C Admin";

  useEffect(() => {
    setActiveTab("roster");
  }, [projectId]);

  const availableToAdd = useMemo(() => {
    if (!project) return [];
    const linked = new Set(
      project.assetLinks.map((l) => `${l.assetType}:${l.assetId}`),
    );
    const items: Omit<
      ProjectAssetLink,
      "id" | "projectId" | "addedAt" | "addedByPersona"
    >[] = [];
    const asOptions = (
      assetType: ProjectAssetLink["assetType"],
      assetId: string,
      providerOrganization: string,
    ) =>
      getEligibleAssuranceSetsForAsset(assetType, assetId, assuranceSets, {
        requestingOrganization: project.requestingOrganization,
        providerOrganization,
      });

    filterVesselsForProjectComposition(
      vessels,
      activePersona,
      project.requestingOrganization,
      assuranceSets,
      includeExternalProviders,
    ).forEach((v) => {
      if (linked.has(`Vessel:${v.id}`)) return;
      const providerOrganization = v.registeredOwner;
      items.push({
        assetType: "Vessel",
        assetId: v.id,
        assetName: v.name,
        providerOrganization,
        assuranceSetId:
          asOptions("Vessel", v.id, providerOrganization)[0]?.id || "",
      });
    });

    filterCrewForProjectComposition(
      crew,
      project.requestingOrganization,
      includeExternalProviders,
    ).forEach((c) => {
      if (linked.has(`Crew:${c.id}`)) return;
      const providerOrganization =
        c.organization || project.requestingOrganization;
      items.push({
        assetType: "Crew",
        assetId: c.id,
        assetName: c.fullName,
        providerOrganization,
        assuranceSetId:
          asOptions("Crew", c.id, providerOrganization)[0]?.id || "",
      });
    });

    filterEquipmentForProjectComposition(
      equipment,
      project.requestingOrganization,
      includeExternalProviders,
    ).forEach((e) => {
      if (linked.has(`Equipment:${e.id}`)) return;
      items.push({
        assetType: "Equipment",
        assetId: e.id,
        assetName: e.name,
        providerOrganization: e.owningOrganization,
        assuranceSetId:
          asOptions("Equipment", e.id, e.owningOrganization)[0]?.id || "",
      });
    });

    if (includeExternalProviders) {
      EXISTING_ACTIVITIES.forEach((a) => {
        if (linked.has(`Activity:${a.id}`)) return;
        items.push({
          assetType: "Activity",
          assetId: a.id,
          assetName: a.name,
          providerOrganization: project.requestingOrganization,
          assuranceSetId:
            asOptions("Activity", a.id, project.requestingOrganization)[0]
              ?.id || "",
          roleInProject: "Service / activity",
        });
      });
    }

    return items.filter(
      (a) => assetFilter === "All" || a.assetType === assetFilter,
    );
  }, [
    project,
    vessels,
    crew,
    equipment,
    assuranceSets,
    assetFilter,
    activePersona,
    includeExternalProviders,
  ]);

  if (!project) {
    return (
      <div className="alert alert-warning">
        Project not found or not accessible.
        <button
          type="button"
          className="btn btn-sm btn-link"
          onClick={() => setCurrentHashView("project")}
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const handleRefreshMaster = () => {
    syncProjectMasterAssurance(project.id);
    setToast("Project master assurance set refreshed.");
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddAsset = (item: (typeof availableToAdd)[0]) => {
    const needsAssurance = requiresAssuranceSetForAssetLink(
      project.requestingOrganization,
      item.providerOrganization,
    );
    if (needsAssurance && !item.assuranceSetId) {
      setToast("Cross-organization assets require an assurance set.");
      return;
    }
    const result = addAssetToProject(project.id, item);
    if (result.success) {
      setToast(`${item.assetName} added to project.`);
      setShowAddPanel(false);
    } else {
      setToast(result.message || "Could not add asset.");
    }
    setTimeout(() => setToast(null), 3500);
  };

  const standaloneSetsForAttach = useMemo(
    () => getStandaloneAssuranceSetsForAttach(assuranceSets, project),
    [assuranceSets, project],
  );

  return (
    <div className="d-flex flex-column gap-3">
      {toast && <div className="alert alert-success py-2 mb-0">{toast}</div>}

      {isCAdmin && project && (
        <div className="alert alert-info py-2 mb-0 small">
          Client-owned project — open a linked sub-set from the Assurance Sets
          tab to review documents (read-only).
        </div>
      )}

      <div className="card map-card-custom p-3">
        <div className="d-flex flex-wrap justify-between align-items-start gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
              <span className="badge bg-primary font-mono-code">
                {project.id}
              </span>
              <span className="badge bg-info text-dark">
                {project.projectType}
              </span>
              {project.riskProfile && (
                <span
                  className={`badge ${
                    project.riskProfile.includes("High") ||
                    project.riskProfile.includes("Armed")
                      ? "bg-danger"
                      : "bg-warning text-dark"
                  }`}
                >
                  {project.riskProfile}
                </span>
              )}
              <span className="badge bg-secondary">{project.status}</span>
            </div>
            <h2 className="h4 fw-bold text-dark mb-1">{project.name}</h2>
            <div className="text-muted small">
              Client owner:{" "}
              {project.ownerOrganization ||
                project.charterer ||
                project.requestingOrganization}
              {project.charterer &&
                project.charterer !== project.requestingOrganization && (
                  <> · Charterer: {project.charterer}</>
                )}
            </div>
            {project.serviceProvider && (
              <div className="text-muted small mt-1">
                Service Provider: {project.serviceProvider}
              </div>
            )}
            {project.description && (
              <div className="text-muted small mt-1">{project.description}</div>
            )}
            {project.routeDescription && (
              <div className="text-muted small mt-1">
                {project.routeDescription}
              </div>
            )}
            <div className="d-flex flex-wrap gap-3 font-mono-code small mt-1">
              <span>
                {project.charterWindowStart} → {project.charterWindowEnd}
              </span>
              {project.workLocationType && (
                <span className="text-secondary">
                  · {project.workLocationType}
                </span>
              )}
              {project.workOrderRef && (
                <span className="text-secondary">
                  · WO: {project.workOrderRef}
                </span>
              )}
            </div>
          </div>
          <div className="text-end">
            <div className="small text-secondary mb-1">
              Master AS: {project.masterAssuranceSetId}
            </div>
            <ReadinessGauge
              score={project.readinessScore ?? masterSet?.readinessScore ?? 0}
              size="md"
            />
            {canManage && (
              <div className="d-flex flex-wrap gap-2 justify-content-end mt-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setShowAddPanel((p) => !p)}
                >
                  Add Asset
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleRefreshMaster}
                >
                  Refresh Project Assurance
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() =>
                    setCurrentHashView(
                      "assurance-sets",
                      project.masterAssuranceSetId,
                    )
                  }
                >
                  Open Master Set
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs">
        {(["roster", "assurance"] as const).map((tab) => (
          <li className="nav-item" key={tab}>
            <button
              type="button"
              className={`nav-link ${activeTab === tab ? "active fw-semibold" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "roster" ? "Asset Roster" : "Assurance Sets"}
            </button>
          </li>
        ))}
      </ul>

      {showAddPanel && canManage && (
        <div className="card map-card-custom p-3">
          <div className="d-flex flex-wrap align-items-center justify-between gap-2 mb-2">
            <h6 className="fw-bold mb-0">Add Asset to Project</h6>
            <div className="form-check form-switch mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="projectDetailIncludeExternal"
                checked={includeExternalProviders}
                onChange={(e) => setIncludeExternalProviders(e.target.checked)}
              />
              <label
                className="form-check-label small"
                htmlFor="projectDetailIncludeExternal"
              >
                Include external providers
              </label>
            </div>
          </div>
          <div className="d-flex gap-2 mb-2">
            {(
              [
                "All",
                "Vessel",
                "Crew",
                "Equipment",
                ...(includeExternalProviders ? (["Activity"] as const) : []),
              ] as const
            ).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn btn-sm ${assetFilter === t ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setAssetFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            className="border rounded"
            style={{ maxHeight: "200px", overflowY: "auto" }}
          >
            {availableToAdd.length === 0 ? (
              <div className="p-3 text-muted small text-center">
                No additional assets available.
              </div>
            ) : (
              availableToAdd.map((a) => {
                const isOwnOrg = project
                  ? isOrganizationMatch(
                      project.requestingOrganization,
                      a.providerOrganization,
                    )
                  : false;
                return (
                  <div
                    key={`${a.assetType}-${a.assetId}`}
                    className="d-flex justify-between align-items-center p-2 border-bottom small"
                  >
                    <div>
                      <strong>{a.assetName}</strong>
                      <span
                        className={`badge ms-1 ${isOwnOrg ? "bg-success" : "bg-warning text-dark"}`}
                        style={{ fontSize: "0.6rem" }}
                      >
                        {isOwnOrg ? "Your org" : "External"}
                      </span>
                      <div className="text-muted">
                        {a.assetType} · {a.providerOrganization}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
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
      )}

      {activeTab === "roster" && (
        <div className="card map-card-custom">
          <div className="card-header d-flex gap-2 p-3">
            {(["All", "Vessel", "Crew", "Equipment", "Activity"] as const).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn btn-sm ${assetFilter === t ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setAssetFilter(t)}
                >
                  {t}
                </button>
              ),
            )}
          </div>
          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Role</th>
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
                      No assets linked yet. Use Add Asset to compose this
                      charter.
                    </td>
                  </tr>
                ) : (
                  filteredLinks.map((link) => {
                    const activeSet = assuranceSets.find(
                      (s) => s.id === link.assuranceSetId,
                    );
                    return (
                      <tr key={link.id}>
                        <td className="fw-semibold">{link.assetName}</td>
                        <td>{link.assetType}</td>
                        <td className="small text-secondary">
                          {link.roleInProject || "—"}
                        </td>
                        <td className="small">{link.providerOrganization}</td>
                        <td>
                          <div className="font-mono-code small text-primary">
                            {link.assuranceSetId}
                          </div>
                          {activeSet && (
                            <div className="text-muted small">{activeSet.title}</div>
                          )}
                        </td>
                        <td className="small">
                          {activeSet?.requirements
                            .map((r) => r.title)
                            .join(", ") || "—"}
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => {
                              if (link.assetType === "Vessel")
                                setCurrentHashView("vessels", link.assetId);
                              else if (link.assetType === "Crew")
                                setCurrentHashView("crew", link.assetId);
                              else if (link.assetType === "Equipment")
                                setCurrentHashView("equipment", link.assetId);
                            }}
                          >
                            Open Asset
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                removeAssetFromProject(project.id, link.id)
                              }
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

      {activeTab === "assurance" && (
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
                {[
                  masterSet,
                  ...project.assetLinks
                    .map((l) =>
                      assuranceSets.find((s) => s.id === l.assuranceSetId),
                    )
                    .filter(Boolean),
                ]
                  .filter(
                    (s, i, arr) =>
                      s && arr.findIndex((x) => x?.id === s.id) === i,
                  )
                  .map(
                    (s) =>
                      s && (
                        <tr key={s.id}>
                          <td className="font-mono-code text-primary">
                            {s.id}
                          </td>
                          <td>{s.title}</td>
                          <td>
                            {s.isProjectMaster
                              ? "Project Master"
                              : s.assuranceType || "Asset"}
                          </td>
                          <td>
                            <span className="badge bg-secondary">
                              {s.stage}
                            </span>
                          </td>
                          <td>
                            <ReadinessGauge
                              score={s.readinessScore}
                              size="sm"
                            />
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className={`btn btn-sm ${isCAdmin && !s.isProjectMaster ? "btn-primary" : "btn-outline-primary"}`}
                              onClick={() =>
                                setCurrentHashView("assurance-sets", s.id)
                              }
                            >
                              {isCAdmin && !s.isProjectMaster
                                ? "Review"
                                : "Open"}
                            </button>
                          </td>
                        </tr>
                      ),
                  )}
              </tbody>
            </table>
          </div>
          {canManage && standaloneSetsForAttach.length > 0 && (
            <div className="p-3 border-top">
              <div className="fw-semibold small mb-2">
                Attach existing assurance set
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: "420px" }}
                  value={attachSetId}
                  onChange={(e) => setAttachSetId(e.target.value)}
                >
                  <option value="">Select standalone set…</option>
                  {standaloneSetsForAttach.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} — {s.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!attachSetId}
                  onClick={() => {
                    const selected = assuranceSets.find(
                      (s) => s.id === attachSetId,
                    );
                    if (!selected) return;
                    const assetType =
                      selected.assuranceType === "Crew"
                        ? "Crew"
                        : selected.assuranceType === "Equipment"
                          ? "Equipment"
                          : selected.assuranceType === "Activity"
                            ? "Activity"
                            : "Vessel";
                    const result = addAssetToProject(project.id, {
                      assetType,
                      assetId:
                        selected.vesselId ||
                        selected.crewId ||
                        selected.equipmentId ||
                        selected.activityId ||
                        selected.id,
                      assetName:
                        selected.vesselName ||
                        selected.crewName ||
                        selected.equipmentName ||
                        selected.activityName ||
                        selected.title,
                      providerOrganization: selected.initiatorOrg,
                      assuranceSetId: selected.id,
                      roleInProject: "Attached standalone set",
                    });
                    if (result.success) {
                      setToast(`Attached ${selected.id} to project.`);
                      setAttachSetId("");
                      handleRefreshMaster();
                    } else {
                      setToast(result.message || "Could not attach set.");
                    }
                    setTimeout(() => setToast(null), 3500);
                  }}
                >
                  Attach to Project
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
