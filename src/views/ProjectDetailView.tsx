import React, { useEffect, useMemo, useState } from "react";
import { Eye, Trash2, Plus } from "lucide-react";
import { ReadinessGauge } from "../components/common/ReadinessGauge";
import { useMapStore } from "../store/useMapStore";
import { ProjectAssetLink, ProjectAssetType } from "../types/project";
import { AssuranceSet } from "../types/assurance";
import {
  filterProjectsForPersona,
  getStandaloneAssuranceSetsForAttach,
} from "../utils/projectHelpers";
import { ProjectAddAssetModal } from "../components/drawers/ProjectAddAssetModal";
import { AttachAssuranceSetPreviewModal } from "../components/drawers/AttachAssuranceSetPreviewModal";

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
    updateAssuranceSet,
    syncProjectMasterAssurance,
    setReturnToProjectId,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<"roster" | "assurance">("roster");
  const [assetFilter, setAssetFilter] = useState<"All" | ProjectAssetType>(
    "All",
  );
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [attachSetId, setAttachSetId] = useState("");
  const [previewAssuranceSet, setPreviewAssuranceSet] =
    useState<AssuranceSet | null>(null);
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

  const standaloneSetsForAttach = useMemo(
    () => getStandaloneAssuranceSetsForAttach(assuranceSets, project, projects),
    [assuranceSets, project, projects],
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
              Client:{" "}
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
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5"
                  onClick={() => setIsAddAssetModalOpen(true)}
                >
                  <Plus size={15} />
                  <span>Add Asset</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    /* opens the wizard with this project preselected and locked */
                    setReturnToProjectId(project.id);
                    setCurrentHashView("create-assurance-set");
                  }}
                >
                  Create Assurance Set
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

      {activeTab === "roster" && (
        <div className="card map-card-custom">
          <div className="card-header d-flex gap-2 p-3">
            {(["All", "Vessel", "Crew", "Equipment"] as const).map((t) => (
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
          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Asset Name</th>
                  <th>Type & Role</th>
                  <th>Organization</th>
                  <th>Assurance Set</th>
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
                        <td className="font-mono-code fw-semibold text-primary">
                          {link.assetId}
                        </td>
                        <td className="fw-semibold text-dark">{link.assetName}</td>
                        <td>
                          <div className="d-flex align-items-center gap-1.5 flex-wrap">
                            <span className="badge bg-light text-dark border">
                              {link.assetType}
                            </span>
                            {link.roleInProject && (
                              <span className="text-secondary small">
                                {link.roleInProject}
                              </span>
                            )}
                          </div>
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
                        <td className="text-end">
                          <div className="d-flex align-items-center justify-content-end gap-1.5">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                              style={{ width: "32px", height: "32px" }}
                              onClick={() => {
                                if (link.assetType === "Vessel")
                                  setCurrentHashView("vessels", link.assetId);
                                else if (link.assetType === "Crew")
                                  setCurrentHashView("crew", link.assetId);
                                else if (link.assetType === "Equipment")
                                  setCurrentHashView("equipment", link.assetId);
                              }}
                              title="Open Linked Asset"
                              aria-label="Open Linked Asset"
                            >
                              <Eye size={16} />
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: "32px", height: "32px" }}
                                onClick={() =>
                                  removeAssetFromProject(project.id, link.id)
                                }
                                title="Remove Asset from Project"
                                aria-label="Remove Asset from Project"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
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
                              className={`btn btn-sm ${isCAdmin && !s.isProjectMaster ? "btn-primary text-white" : "btn-outline-primary"} d-inline-flex align-items-center justify-content-center p-0`}
                              style={{ width: "32px", height: "32px" }}
                              onClick={() =>
                                setCurrentHashView("assurance-sets", s.id)
                              }
                              title={isCAdmin && !s.isProjectMaster ? "Review Assurance Set" : "Open Assurance Set"}
                              aria-label={isCAdmin && !s.isProjectMaster ? "Review Assurance Set" : "Open Assurance Set"}
                            >
                              <Eye size={16} />
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
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setAttachSetId(nextId);
                    if (nextId) {
                      const selected = assuranceSets.find(
                        (s) => s.id === nextId,
                      );
                      if (selected) {
                        setPreviewAssuranceSet(selected);
                      }
                    }
                  }}
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
                  className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                  disabled={!attachSetId}
                  onClick={() => {
                    const selected = assuranceSets.find(
                      (s) => s.id === attachSetId,
                    );
                    if (selected) {
                      setPreviewAssuranceSet(selected);
                    }
                  }}
                >
                  <Eye size={14} />
                  Preview & Attach
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ProjectAddAssetModal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        project={project}
      />

      <AttachAssuranceSetPreviewModal
        isOpen={Boolean(previewAssuranceSet)}
        onClose={() => setPreviewAssuranceSet(null)}
        assuranceSet={previewAssuranceSet}
        project={project}
        onConfirm={(roleInProject, charterStart, charterEnd, notes) => {
          if (!previewAssuranceSet || !project) return;
          const selected = previewAssuranceSet;
          const assetType =
            selected.assuranceType === "Crew"
              ? "Crew"
              : selected.assuranceType === "Equipment"
                ? "Equipment"
                : "Vessel";

          const result = addAssetToProject(project.id, {
            assetType,
            assetId:
              selected.vesselId ||
              selected.crewId ||
              selected.equipmentId ||
              selected.id,
            assetName:
              selected.vesselName ||
              selected.crewName ||
              selected.equipmentName ||
              selected.title,
            providerOrganization:
              selected.initiatorOrg || selected.serviceProviderOrg || "",
            assuranceSetId: selected.id,
            roleInProject: roleInProject || "Attached standalone set",
            notes: notes || undefined,
          });
          if (result.success) {
            /* apply the configured charter period only once the set has joined the project */
            const attached = useMapStore.getState().assuranceSets.find((s) => s.id === selected.id);
            if (attached) {
              updateAssuranceSet({
                ...attached,
                charterWindowStart: charterStart,
                charterWindowEnd: charterEnd,
                /* client and charterer are the same organization on a set */
                charterer: project.clientOperator || project.requestingOrganization,
                clientOrg: project.clientOperator || project.requestingOrganization,
              });
            }
            setToast(`Attached ${selected.id} with configured charter period (${charterStart} to ${charterEnd}).`);
            setAttachSetId("");
            setPreviewAssuranceSet(null);
            handleRefreshMaster();
          } else {
            setToast(result.message || "Could not attach set.");
          }
          setTimeout(() => setToast(null), 3500);
        }}
      />
    </div>
  );
};
