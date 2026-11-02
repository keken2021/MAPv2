import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, Trash2, Plus, FolderPlus, Send, Link2 } from "lucide-react";
import { ListToolbar } from "../components/common/ListToolbar";
import { DetailHeader } from "../components/common/DetailHeader";
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
import { getDemoSessionContext, getSessionUserForPersona } from "../utils/userRoleHelpers";
import { summarizeTaskSections } from "../utils/readinessHelpers";
import TaskSectionCards from "../components/common/TaskSectionCards";
import { ProjectAddAssetModal } from "../components/modals/ProjectAddAssetModal";
import { AttachAssuranceSetPreviewModal } from "../components/modals/AttachAssuranceSetPreviewModal";
import { RequestAssuranceSetModal } from "../components/modals/RequestAssuranceSetModal";
import { usePagination } from "../utils/usePagination";
import { TablePagination } from "../components/common/TablePagination";
import { ProjectAssuranceStatusTable } from "../components/tables/ProjectAssuranceStatusTable";

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
    activeSessionUserId,
    documents,
    capaItems,
  } = useMapStore();

  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );

  const [activeTab, setActiveTab] = useState<"roster" | "assurance">(
    "assurance",
  );
  const [assetFilter, setAssetFilter] = useState<"All" | ProjectAssetType>(
    "All",
  );
  const [objectSearchTerm, setObjectSearchTerm] = useState("");
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
        sessionUser,
      ),
    [projects, activePersona, activeDemoOrganization, users, assuranceSets, sessionUser],
  );

  const project = visibleProjects.find((p) => p.id === projectId);

  const projectAssuranceSets = useMemo(() => {
    if (!project) return [];
    const sets = getProjectAssuranceSets(project, assuranceSets);
    if (activePersona === "Administrator" || activePersona === "C Admin" || !sessionUser) {
      return sets;
    }
    return sets.filter((set) =>
      isAssuranceSetAssignedToPersona(set, activePersona, activeDemoOrganization, sessionUser),
    );
  }, [project, assuranceSets, activePersona, activeDemoOrganization, sessionUser]);

  const filteredLinks = useMemo(() => {
    if (!project) return [];
    const q = objectSearchTerm.trim().toLowerCase();
    return project.assetLinks.filter((l) => {
      if (assetFilter !== "All" && l.assetType !== assetFilter) return false;
      if (!q) return true;
      const activeSet = assuranceSets.find((s) => s.id === l.assuranceSetId);
      const haystack = [
        l.assetName,
        l.assetId,
        l.assetType,
        l.providerOrganization,
        l.assuranceSetId,
        l.roleInProject,
        l.notes,
        activeSet?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [project, assetFilter, objectSearchTerm, assuranceSets]);

  const canManage =
    activePersona === "Administrator" || activePersona === "C Admin";
  const isReadOnly = !canManage;

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

  const assetsPagination = usePagination(filteredLinks, [assetFilter, objectSearchTerm]);

  const statusViewer = useMemo(
    () => ({
      organization: activeDemoOrganization || sessionUser?.organization,
      name: sessionUser?.name,
    }),
    [activeDemoOrganization, sessionUser],
  );

  if (!project) {
    return (
      <div className="alert alert-warning">
        Project not found.
      </div>
    );
  }

  const openCreateAssuranceSet = () => {
    setReturnToProjectId(project.id);
    setLockedProjectId(project.id);
    setCurrentHashView("create-assurance-set");
  };

  const canOpenSet = (set: AssuranceSet) =>
    canManage || isAssuranceSetAssignedToPersona(set, activePersona, activeDemoOrganization, sessionUser);

  const headerClient =
    project.ownerOrganization || project.charterer || project.requestingOrganization || "";
  const sameOrganization = (left?: string, right?: string) => {
    if (!left?.trim() || !right?.trim()) return false;
    const a = left.trim().toLowerCase();
    const b = right.trim().toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  };
  const chainParties = (["client", "head_contractor", "vendor"] as ContractChainRole[])
    .map((role) => ({ role, party: contractPartyByRole(project.contractParties, role) }))
    .filter(({ role, party }) => {
      if (!party?.organization?.trim()) return false;
      if (role === "client" && sameOrganization(party.organization, headerClient)) return false;
      return true;
    });
  const otherParties = (project.contractParties ?? []).filter((party) => !party.chainRole);
  const projectValueLabel = formatProjectValue(project.projectValue, project.currency);
  const multiYearLabel =
    project.multiYearStart && project.multiYearEnd
      ? `${project.multiYearStart} → ${project.multiYearEnd}`
      : "";
  const showOnHire = Boolean(project.onHireDate) && project.onHireDate !== project.charterWindowStart;
  const showContractParties = chainParties.length > 0 || otherParties.length > 0;
  const showContractFacts = Boolean(projectValueLabel) || Boolean(multiYearLabel) || showOnHire;
  const showContract = showContractParties || showContractFacts;

  return (
    <div className="d-flex flex-column gap-3">
      {toast && <div className="alert alert-success py-2 mb-0">{toast}</div>}

      {isReadOnly && (
        <div className="alert alert-info py-2 mb-0 small">
          Read-only. You can open assurance sets assigned to you.
        </div>
      )}

      <DetailHeader
        title={project.name}
        status={project.status}
        metaItems={[
          project.id,
          `Client: ${
            project.ownerOrganization ||
            project.charterer ||
            project.requestingOrganization
          }${
            project.charterer &&
            project.charterer !== project.requestingOrganization
              ? ` · ${project.charterer}`
              : ""
          }`,
          project.serviceProvider ? `Service Provider: ${project.serviceProvider}` : "",
          `${project.charterWindowStart} → ${project.charterWindowEnd}`,
        ].filter(Boolean)}
        mainAction={
          canManage ? (
            <div className="d-flex flex-wrap gap-2">
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
          ) : undefined
        }
      />

      <div className="card map-card-custom p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            {(project.projectType || project.riskProfile) && (
              <div className="text-secondary small mb-1">
                {[
                  project.projectType,
                  project.riskProfile
                    ? project.riskProfile.charAt(0).toUpperCase() + project.riskProfile.slice(1).toLowerCase()
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {project.description && (
              <div className="text-muted small">{project.description}</div>
            )}
            {project.routeDescription && (
              <div className="text-muted small mt-1">{project.routeDescription}</div>
            )}
            <div className="d-flex flex-wrap gap-3 font-mono-code small mt-1">
              {project.workLocationType && <span>{project.workLocationType}</span>}
              {project.workOrderRef && (
                <span className="text-secondary">WO: {project.workOrderRef}</span>
              )}
            </div>
          </div>
          <div style={{ minWidth: '220px' }}>
            <ReadinessGauge
              score={calculateProjectReadiness(project, assuranceSets)}
              size="md"
            />
          </div>
        </div>
      </div>

      {showContract && (
        <div className="card map-card-custom p-3">
          <h3 className="h6 fw-bold text-dark mb-1">Contract</h3>
          {showContractParties && (
            <p className="text-muted small mb-3">
              The chain and each organization's group. This is a party list, not a directory of accounts.
            </p>
          )}
          {chainParties.length > 0 && (
            <div className="d-flex flex-wrap align-items-stretch gap-2 mb-3">
              {chainParties.map(({ role, party }, index) => (
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
                    <div className="fw-semibold text-dark">{party?.organization}</div>
                    {party?.group && (
                      <span className="badge bg-light text-dark border">{party.group}</span>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          {otherParties.length > 0 && (
            <div className="mb-3">
              <div className="text-secondary small mb-1">Other parties</div>
              <ul className="list-group list-group-flush">
                {otherParties.map((party) => (
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
          {showContractFacts && (
            <div className={`d-flex flex-wrap gap-4 small ${showContractParties ? "border-top pt-3" : ""}`}>
              {projectValueLabel && (
                <div>
                  <div className="text-secondary">Project value</div>
                  <div className="fw-semibold">{projectValueLabel}</div>
                </div>
              )}
              {multiYearLabel && (
                <div>
                  <div className="text-secondary">Multi-year term</div>
                  <div className="fw-semibold font-mono-code">{multiYearLabel}</div>
                </div>
              )}
              {showOnHire && (
                <div>
                  <div className="text-secondary">On-hire date</div>
                  <div className="fw-semibold font-mono-code">{project.onHireDate}</div>
                </div>
              )}
            </div>
          )}
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
              {tab === "roster" ? "Objects" : "Assurance Sets"}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === "roster" && (
        <div className="card map-card-custom">
          <ListToolbar
            searchValue={objectSearchTerm}
            onSearchChange={setObjectSearchTerm}
            searchPlaceholder="Search objects..."
          >
            <div className="d-flex gap-2 flex-wrap">
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
          </ListToolbar>
          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Service Provider</th>
                  <th>Assurance Set</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      {objectSearchTerm || assetFilter !== "All"
                        ? "No objects match these filters."
                        : "No objects yet."}
                      {canManage &&
                        !objectSearchTerm &&
                        assetFilter === "All" &&
                        " Use Add Asset to compose this charter."}
                    </td>
                  </tr>
                ) : (
                  assetsPagination.pageItems.map((link) => {
                    const activeSet = assuranceSets.find(
                      (s) => s.id === link.assuranceSetId,
                    );
                    return (
                      <tr key={link.id}>
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
          <ProjectAssuranceStatusTable
            sets={projectAssuranceSets}
            allSets={assuranceSets}
            documents={documents}
            capaItems={capaItems}
            viewer={statusViewer}
            canOpenSet={canOpenSet}
            onOpenSet={(set) => setCurrentHashView("assurance-sets", set.id)}
          />
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
                  <Link2 size={14} />
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
