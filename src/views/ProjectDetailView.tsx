import React, { useEffect, useMemo, useState } from "react";
import { Eye, Trash2, Plus, FolderPlus, Send } from "lucide-react";
import { ReadinessGauge } from "../components/common/ReadinessGauge";
import { useMapStore } from "../store/useMapStore";
import { ProjectAssetType } from "../types/project";
import { AssuranceSet } from "../types/assurance";
import {
  calculateProjectReadiness,
  filterProjectsForPersona,
  getProjectAssuranceSets,
  getStandaloneAssuranceSetsForAttach,
} from "../utils/projectHelpers";
import { isAssuranceSetAssignedToPersona } from "../utils/rbacHelpers";
import { calculateAssuranceSetReadiness } from "../utils/readinessHelpers";
import { ProjectAddAssetModal } from "../components/drawers/ProjectAddAssetModal";
import { AttachAssuranceSetPreviewModal } from "../components/drawers/AttachAssuranceSetPreviewModal";
import { RequestAssuranceSetModal } from "../components/drawers/RequestAssuranceSetModal";

interface ProjectDetailViewProps {
  projectId: string;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  projectId,
}) => {
  const {
    projects,
    assuranceSets,
    activePersona,
    users,
    setCurrentHashView,
    setReturnToProjectId,
    setLockedProjectId,
    removeAssetFromProject,
    addAssetToProject,
    updateAssuranceSet,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<"roster" | "assurance">("assurance");
  const [assetFilter, setAssetFilter] = useState<"All" | ProjectAssetType>(
    "All",
  );
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
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

  const projectAssuranceSets = useMemo(
    () => (project ? getProjectAssuranceSets(project, assuranceSets) : []),
    [project, assuranceSets],
  );

  const filteredLinks = useMemo(() => {
    if (!project) return [];
    if (assetFilter === "All") return project.assetLinks;
    return project.assetLinks.filter((l) => l.assetType === assetFilter);
  }, [project, assetFilter]);

  const canManage =
    activePersona === "Administrator" || activePersona === "C Admin";
  const isReadOnly = !canManage;
  const isCAdmin = activePersona === "C Admin";

  const standaloneSetsForAttach = useMemo(
    () =>
      project
        ? getStandaloneAssuranceSetsForAttach(assuranceSets, project, projects)
        : [],
    [assuranceSets, project, projects],
  );

  useEffect(() => {
    setActiveTab("assurance");
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

  const openCreateAssuranceSet = () => {
    setReturnToProjectId(project.id);
    setLockedProjectId(project.id);
    setCurrentHashView("create-assurance-set");
  };

  const canOpenSet = (set: AssuranceSet) =>
    canManage || isAssuranceSetAssignedToPersona(set, activePersona);

  return (
    <div className="d-flex flex-column gap-3">
      {toast && <div className="alert alert-success py-2 mb-0">{toast}</div>}

      {isReadOnly && (
        <div className="alert alert-info py-2 mb-0 small">
          Read-only project view — you can open assurance sets assigned to you
          for work.
        </div>
      )}

      {isCAdmin && (
        <div className="alert alert-info py-2 mb-0 small">
          Client-owned project — open linked assurance sets to review documents
          (read-only).
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
            <ReadinessGauge
              score={calculateProjectReadiness(project, assuranceSets)}
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
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5"
                  onClick={openCreateAssuranceSet}
                >
                  <FolderPlus size={15} />
                  <span>Add Assurance Set</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5"
                  onClick={() => setIsRequestModalOpen(true)}
                >
                  <Send size={15} />
                  <span>Request Assurance Set</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs">
        {(["assurance", "roster"] as const).map((tab) => (
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
                      No assets linked yet.
                      {canManage && " Use Add Asset to compose this charter."}
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
                {projectAssuranceSets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No assurance sets linked to this project yet.
                    </td>
                  </tr>
                ) : (
                  projectAssuranceSets.map((s) => {
                    const openable = canOpenSet(s);
                    return (
                      <tr key={s.id}>
                        <td className="font-mono-code text-primary">{s.id}</td>
                        <td>{s.title}</td>
                        <td>{s.assuranceType || "Asset"}</td>
                        <td>
                          <span className="badge bg-secondary">{s.stage}</span>
                        </td>
                        <td>
                          <ReadinessGauge score={calculateAssuranceSetReadiness(s, assuranceSets)} size="sm" />
                        </td>
                        <td className="text-end">
                          {openable ? (
                            <button
                              type="button"
                              className={`btn btn-sm ${isCAdmin ? "btn-primary text-white" : "btn-outline-primary"} d-inline-flex align-items-center justify-content-center p-0`}
                              style={{ width: "32px", height: "32px" }}
                              onClick={() =>
                                setCurrentHashView("assurance-sets", s.id)
                              }
                              title="Open Assurance Set"
                              aria-label="Open Assurance Set"
                            >
                              <Eye size={16} />
                            </button>
                          ) : (
                            <span className="badge bg-light text-muted border">
                              Read-only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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

      <RequestAssuranceSetModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        project={project}
        onSuccess={(message) => {
          setToast(message);
          setTimeout(() => setToast(null), 3500);
        }}
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

          updateAssuranceSet({
            ...selected,
            charterWindowStart: charterStart,
            charterWindowEnd: charterEnd,
            projectId: project.id,
            projectName: project.name,
            charterer: project.clientOperator || project.requestingOrganization,
          });

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
            setToast(
              `Attached ${selected.id} with configured charter period (${charterStart} to ${charterEnd}).`,
            );
            setAttachSetId("");
            setPreviewAssuranceSet(null);
          } else {
            setToast(result.message || "Could not attach set.");
          }
          setTimeout(() => setToast(null), 3500);
        }}
      />
    </div>
  );
};
