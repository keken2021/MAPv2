import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, Trash2, Plus, FolderPlus, Send } from "lucide-react";
import { ReadinessGauge } from "../components/common/ReadinessGauge";
import { useMapStore } from "../store/useMapStore";
import { ProjectAssetType } from "../types/project";
import { AssuranceSet } from "../types/assurance";
import {
  CONTRACT_CHAIN_LABELS,
  calculateProjectReadiness,
  contractPartyByRole,
  filterProjectsForPersona,
  formatProjectValue,
  getProjectAssuranceSets,
  getStandaloneAssuranceSetsForAttach,
} from "../utils/projectHelpers";
import { ContractChainRole } from "../types/project";
import { isAssuranceSetAssignedToPersona } from "../utils/rbacHelpers";
import { calculateAssuranceSetReadiness, summarizeTaskSections } from "../utils/readinessHelpers";
import TaskSectionCards from "../components/common/TaskSectionCards";
import { listCertificatesShortOfContract } from "../utils/documentRenewalHelpers";
import { ProjectAddAssetModal } from "../components/modals/ProjectAddAssetModal";
import { AttachAssuranceSetPreviewModal } from "../components/modals/AttachAssuranceSetPreviewModal";
import { RequestAssuranceSetModal } from "../components/modals/RequestAssuranceSetModal";
import { usePagination } from "../utils/usePagination";
import { TablePagination } from "../components/common/TablePagination";

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
    activeDemoOrganization,
    documents,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<"roster" | "assurance">(
    "assurance",
  );
  const [assetFilter, setAssetFilter] = useState<"All" | ProjectAssetType>(
    "All",
  );
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [attachSetId, setAttachSetId] = useState("");
  const [previewAssuranceSet, setPreviewAssuranceSet] =
    useState<AssuranceSet | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openSectionSetId, setOpenSectionSetId] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () =>
      filterProjectsForPersona(
        projects,
        activePersona,
        users,
        assuranceSets,
        activeDemoOrganization,
      ),
    [projects, activePersona, activeDemoOrganization, users, assuranceSets],
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

  const assetsPagination = usePagination(filteredLinks, [assetFilter]);
  const setsPagination = usePagination(projectAssuranceSets, []);

  if (!project) {
    return (
      <div className="alert alert-warning">
        Project not found.
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
    canManage || isAssuranceSetAssignedToPersona(set, activePersona, activeDemoOrganization);

  return (
    <div className="d-flex flex-column gap-3">
      {toast && <div className="alert alert-success py-2 mb-0">{toast}</div>}

      {isReadOnly && (
        <div className="alert alert-info py-2 mb-0 small">
          Read-only. You can open assurance sets assigned to you.
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
                Provider: {project.serviceProvider}
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
                  <span>Create Assurance Set</span>
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

      {(project.contractParties?.length ||
        project.projectValue != null ||
        project.multiYearStart ||
        project.onHireDate) && (
        <div className="card map-card-custom p-3">
          <h3 className="h6 fw-bold text-dark mb-1">Contract</h3>
          <p className="text-muted small mb-3">
            The chain and each organization's group. This is a party list, not a directory of accounts.
          </p>
          <div className="d-flex flex-wrap align-items-stretch gap-2 mb-3">
            {(["client", "head_contractor", "vendor"] as ContractChainRole[]).map((role, index) => {
              const party = contractPartyByRole(project.contractParties, role);
              return (
                <React.Fragment key={role}>
                  {index > 0 && (
                    <span className="d-flex align-items-center text-secondary" aria-hidden="true">
                      <ChevronRight size={18} />
                    </span>
                  )}
                  <div className="border rounded px-3 py-2 flex-grow-1" style={{ minWidth: "12rem", flexBasis: 0 }}>
                    <div className="text-secondary" style={{ fontSize: "0.725rem" }}>
                      {CONTRACT_CHAIN_LABELS[role]}
                    </div>
                    {party ? (
                      <>
                        <div className="fw-semibold text-dark">{party.organization}</div>
                        <span className="badge bg-light text-dark border">{party.group}</span>
                      </>
                    ) : (
                      <div className="text-muted fst-italic">Not recorded</div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          {(project.contractParties ?? []).some((party) => !party.chainRole) && (
            <div className="mb-3">
              <div className="text-secondary small mb-1">Other parties</div>
              <ul className="list-group list-group-flush">
                {(project.contractParties ?? [])
                  .filter((party) => !party.chainRole)
                  .map((party) => (
                    <li
                      key={`${party.organization}-${party.group}`}
                      className="list-group-item px-0 py-2 d-flex justify-content-between align-items-center"
                    >
                      <span className="fw-semibold">{party.organization}</span>
                      <span className="badge bg-light text-dark border">{party.group}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="d-flex flex-wrap gap-4 small border-top pt-3">
            <div>
              <div className="text-secondary">Project value</div>
              <div className="fw-semibold">
                {formatProjectValue(project.projectValue, project.currency) || "Not recorded"}
              </div>
            </div>
            <div>
              <div className="text-secondary">Multi-year term</div>
              <div className="fw-semibold font-mono-code">
                {project.multiYearStart && project.multiYearEnd
                  ? `${project.multiYearStart} → ${project.multiYearEnd}`
                  : "Not recorded"}
              </div>
            </div>
            <div>
              <div className="text-secondary">
                On-hire date <span className="badge bg-warning text-dark ms-1">Pending</span>
              </div>
              <div className="fw-semibold font-mono-code">{project.onHireDate || "Not set"}</div>
              <div className="text-muted">Not confirmed with the client. Not applied to the project's sets.</div>
            </div>
          </div>
        </div>
      )}

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
                  <th>Name</th>
                  <th>Type</th>
                  <th>Provider</th>
                  <th>Assurance Set</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No assets yet.
                      {canManage && " Use Add Asset to compose this charter."}
                    </td>
                  </tr>
                ) : (
                  assetsPagination.pageItems.map((link) => {
                    const activeSet = assuranceSets.find(
                      (s) => s.id === link.assuranceSetId,
                    );
                    return (
                      <tr key={link.id}>
                        <td className="font-mono-code fw-semibold text-primary">
                          {link.assetId}
                        </td>
                        <td className="fw-semibold text-dark">
                          {link.assetName}
                        </td>
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
                            <div className="text-muted small">
                              {activeSet.title}
                            </div>
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
                              title="View"
                              aria-label="View"
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
                                title="Remove"
                                aria-label="Remove"
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
          <TablePagination {...assetsPagination.controls} />
        </div>
      )}

      {activeTab === "assurance" && (
        <div className="d-flex flex-column gap-3">
          {projectAssuranceSets.some((set) => (set.sections?.length ?? 0) > 0) && (
            <div className="card map-card-custom">
              <div className="card-header border-bottom p-3">
                <div className="fw-bold text-dark">Task sections</div>
                <div className="small text-secondary">
                  Open a set to see its sections. A heavy section has three or more tasks still open.
                </div>
              </div>
              <div className="list-group list-group-flush">
                {projectAssuranceSets
                  .filter((set) => (set.sections?.length ?? 0) > 0)
                  .map((set) => {
                    const sections = summarizeTaskSections(set);
                    const open = openSectionSetId === set.id;
                    const heavyCount = sections.filter((section) => section.heavy).length;
                    return (
                      <div key={set.id} className="list-group-item p-0">
                        <button
                          type="button"
                          className="btn btn-link text-decoration-none text-dark w-100 d-flex align-items-center gap-2 p-3 text-start"
                          aria-expanded={open}
                          onClick={() => setOpenSectionSetId(open ? null : set.id)}
                        >
                          <ChevronDown
                            size={16}
                            className="flex-shrink-0"
                            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                          />
                          <span className="font-mono-code text-primary">{set.id}</span>
                          <span className="fw-semibold">{set.title}</span>
                          <span className="small text-secondary">
                            {sections.length} {sections.length === 1 ? "section" : "sections"}
                            {" · "}
                            {heavyCount} heavy
                          </span>
                        </button>
                        {open && (
                          <div className="px-3 pb-3">
                            <TaskSectionCards set={set} />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
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
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projectAssuranceSets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      No assurance sets yet.
                    </td>
                  </tr>
                ) : (
                  setsPagination.pageItems.map((s) => {
                    const openable = canOpenSet(s);
                    const shortCount = listCertificatesShortOfContract(
                      s,
                      documents,
                      s.charterWindowEnd,
                    ).length;
                    return (
                      <tr key={s.id}>
                        <td className="font-mono-code text-primary">{s.id}</td>
                        <td>
                          {s.title}
                          {shortCount > 0 && (
                            <span className="badge bg-warning text-dark ms-2">
                              {shortCount} expire before contract end
                            </span>
                          )}
                        </td>
                        <td>{s.assuranceType || "Asset"}</td>
                        <td>
                          <span className="badge bg-secondary">{s.stage}</span>
                        </td>
                        <td>
                          <ReadinessGauge
                            score={calculateAssuranceSetReadiness(
                              s,
                              assuranceSets,
                            )}
                            size="sm"
                          />
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
                              title="View"
                              aria-label="View"
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
          <TablePagination {...setsPagination.controls} />
          {canManage && standaloneSetsForAttach.length > 0 && (
            <div className="p-3 border-top">
              <div className="fw-semibold small mb-2">
                Attach Existing Assurance Set
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
                  <option value="">Select assurance set</option>
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
                  Attach
                </button>
              </div>
            </div>
          )}
        </div>
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
              `Attached ${selected.id} with configured Contract Period (${charterStart} to ${charterEnd}).`,
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
