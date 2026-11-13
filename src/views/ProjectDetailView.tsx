import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, Trash2, Plus, FolderPlus, Send, Link2, Edit2 } from "lucide-react";
import { ListToolbar } from "../components/common/ListToolbar";
import { CountTab, CountTabs } from "../components/common/CountTabs";
import { ActiveFilterChips, FilterChip } from "../components/common/ActiveFilterChips";
import { DetailHeader } from "../components/common/DetailHeader";
import { Tabs } from "../components/common/Tabs";
import { useMapStore } from "../store/useMapStore";
import {
  ContractChainRole,
  ContractParty,
  ProjectAssetType,
} from "../types/project";
import { AssuranceSet } from "../types/assurance";
import {
  CONTRACT_CHAIN_LABELS,
  contractPartyByRole,
  filterProjectsForPersona,
  getProjectAssuranceSets,
  getStandaloneAssuranceSetsForAttach,
  syncInvitedOrganizationsToParties,
} from "../utils/projectHelpers";
import { isAssuranceSetAssignedToPersona, orgFieldMatches } from "../utils/rbacHelpers";
import { getDemoSessionContext, getSessionUserForPersona } from "../utils/userRoleHelpers";
import { summarizeTaskSections } from "../utils/readinessHelpers";
import TaskSectionCards from "../components/common/TaskSectionCards";
import { ProjectAddAssetModal } from "../components/modals/ProjectAddAssetModal";
import { AttachAssuranceSetPreviewModal } from "../components/modals/AttachAssuranceSetPreviewModal";
import { RequestAssuranceSetModal } from "../components/modals/RequestAssuranceSetModal";
import { EditParticipatingOrganizationsModal } from "../components/modals/EditParticipatingOrganizationsModal";
import { usePagination } from "../utils/usePagination";
import { TablePagination } from "../components/common/TablePagination";
import { ProjectAssuranceStatusTable } from "../components/tables/ProjectAssuranceStatusTable";
import { ProjectTasksTable } from "../components/tables/ProjectTasksTable";
import { ProjectOverviewTab } from "../components/projects/ProjectOverviewTab";

interface ProjectDetailViewProps {
  projectId: string;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  projectId,
}) => {
  const {
    projects,
    updateProject,
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
    notifications,
    setPendingAssuranceRequestNotificationId,
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

  const [activeTab, setActiveTab] = useState<"overview" | "details" | "assurance" | "roster" | "tasks">(
    "overview",
  );
  const [assetFilter, setAssetFilter] = useState<"All" | ProjectAssetType>(
    "All",
  );
  const [objectSearchTerm, setObjectSearchTerm] = useState("");
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditPartiesModalOpen, setIsEditPartiesModalOpen] = useState(false);
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
        notifications,
      ),
    [projects, activePersona, activeDemoOrganization, users, assuranceSets, sessionUser, notifications],
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

  /* only the client admin of the project owner can add assets or create and request sets;
     a third party assigned as verifier, inspector or approver only views the project */
  const viewingOrganization = activeDemoOrganization || sessionUser?.organization || "";
  const projectOwnerOrganization =
    project?.ownerOrganization || project?.requestingOrganization || project?.charterer || "";
  const isProjectOwnerOrganization =
    !viewingOrganization ||
    !projectOwnerOrganization ||
    orgFieldMatches(projectOwnerOrganization, viewingOrganization);
  const canManage =
    (activePersona === "Administrator" || activePersona === "C Admin") && isProjectOwnerOrganization;
  const isReadOnly = !canManage;

  /* an organization asked to create a set for this project (a Responding party), or a named
     recipient whose organization is the request's Requesting party (an Administrator recipient),
     can create it even though they do not own the project */
  const openRequestForViewer = useMemo(
    () =>
      project
        ? notifications.find(
          (n) =>
            n.type === "assurance_set_request" &&
            n.projectId === project.id &&
            n.request &&
            !n.request.createdAssuranceSetId &&
            ((viewingOrganization && orgFieldMatches(n.request.respondingParty || "", viewingOrganization)) ||
              (n.recipientUserId === sessionUser?.id &&
                Boolean(
                  viewingOrganization &&
                    orgFieldMatches(n.request.requestingParty || "", viewingOrganization),
                )) ||
              n.recipientUserId === sessionUser?.id),
        )
        : undefined,
    [notifications, project, sessionUser, viewingOrganization],
  );
  const canCreateFromRequest = !canManage && Boolean(openRequestForViewer);

  const standaloneSetsForAttach = useMemo(
    () =>
      project
        ? getStandaloneAssuranceSetsForAttach(assuranceSets, project, projects)
        : [],
    [assuranceSets, project, projects],
  );

  useEffect(() => {
    setActiveTab("overview");
  }, [projectId]);

  const effectiveProject = useMemo(
    () => (project ? syncInvitedOrganizationsToParties(project) : undefined),
    [project],
  );

  const assetsPagination = usePagination(filteredLinks, [assetFilter, objectSearchTerm]);

  const objectTabs: CountTab[] = useMemo(() => {
    const links = project?.assetLinks ?? [];
    return [
      { key: "All", label: "All", count: links.length },
      { key: "Vessel", label: "Vessel", count: links.filter((l) => l.assetType === "Vessel").length },
      { key: "Crew", label: "Crew", count: links.filter((l) => l.assetType === "Crew").length },
      { key: "Equipment", label: "Equipment", count: links.filter((l) => l.assetType === "Equipment").length },
    ];
  }, [project]);

  const objectChips: FilterChip[] = useMemo(
    () => [
      ...(assetFilter !== "All"
        ? [{ id: "type", label: "Type", value: assetFilter, onRemove: () => setAssetFilter("All") }]
        : []),
      ...(objectSearchTerm.trim()
        ? [{ id: "search", label: "Search", value: objectSearchTerm.trim(), onRemove: () => setObjectSearchTerm("") }]
        : []),
    ],
    [assetFilter, objectSearchTerm],
  );

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

  /* the recipient creates the set from the request, so the wizard locks the project and the requesting party */
  const openCreateFromRequest = () => {
    if (!openRequestForViewer) return;
    setReturnToProjectId(project.id);
    setLockedProjectId(project.id);
    setPendingAssuranceRequestNotificationId(openRequestForViewer.id);
    setCurrentHashView("create-assurance-set");
  };

  const canOpenSet = (set: AssuranceSet) =>
    canManage || isProjectOwnerOrganization || isAssuranceSetAssignedToPersona(set, activePersona, activeDemoOrganization, sessionUser);

  const headerClient =
    project.ownerOrganization || project.charterer || project.requestingOrganization || "";
  const sameOrganization = (left?: string, right?: string) => {
    if (!left?.trim() || !right?.trim()) return false;
    const a = left.trim().toLowerCase();
    const b = right.trim().toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  };
  const allChainParties = (["client", "head_contractor", "vendor"] as ContractChainRole[])
    .map((role) => ({ role, party: contractPartyByRole(effectiveProject?.contractParties, role) }))
    .filter(
      (entry): entry is { role: ContractChainRole; party: ContractParty } =>
        Boolean(entry.party?.organization?.trim()),
    );
  const showChain = allChainParties.some(
    ({ role, party }) => role !== "client" || !sameOrganization(party.organization, headerClient),
  );
  const visibleChainParties = showChain ? allChainParties : [];
  const otherParties = (effectiveProject?.contractParties ?? []).filter((party) => !party.chainRole);
  const showOrganizationsCard = visibleChainParties.length > 0 || otherParties.length > 0;
  const organizationCount = visibleChainParties.length + otherParties.length;
  const workLocationLabel =
    project.workLocationType && project.location
      ? `${project.workLocationType} · ${project.location}`
      : project.workLocationType || project.location || "";
  const riskProfileLabel = project.riskProfile
    ? project.riskProfile.charAt(0).toUpperCase() + project.riskProfile.slice(1).toLowerCase()
    : "";
  const multiYearLabel =
    project.multiYearStart && project.multiYearEnd
      ? `${project.multiYearStart} → ${project.multiYearEnd}`
      : "";
  const showOnHire = Boolean(project.onHireDate) && project.onHireDate !== project.charterWindowStart;
  const hasParticulars = Boolean(
    project.projectType ||
      workLocationLabel ||
      riskProfileLabel ||
      project.workOrderRef ||
      multiYearLabel ||
      showOnHire,
  );

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
          `Client: ${project.ownerOrganization ||
          project.charterer ||
          project.requestingOrganization
          }${project.charterer &&
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
          ) : canCreateFromRequest ? (
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5"
                data-testid="create-set-from-request"
                onClick={openCreateFromRequest}
              >
                <FolderPlus size={15} />
                <span>Create Assurance Set</span>
              </button>
            </div>
          ) : undefined
        }
      />

      <Tabs
        variant="section"
        aria-label="Project detail tabs"
        active={activeTab}
        onChange={(key) =>
          setActiveTab(key as "overview" | "details" | "assurance" | "roster" | "tasks")
        }
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "details", label: "Details" },
          { key: "assurance", label: "Assurance Sets" },
          { key: "roster", label: "Objects" },
          { key: "tasks", label: "Tasks" },
        ]}
      />

      {activeTab === "overview" && <ProjectOverviewTab project={effectiveProject || project} sets={projectAssuranceSets} allSets={assuranceSets} documents={documents} capaItems={capaItems} canOpenSet={canOpenSet} onOpenSet={(set) => setCurrentHashView("assurance-sets", set.id)} />}

      {activeTab === "details" && (
        <div className="d-flex flex-column gap-3" data-testid="project-details-tab">
          <div className="card map-card-custom" data-testid="project-scope-particulars-card">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h2 className="h6 fw-semibold mb-0 text-dark">Scope &amp; Particulars</h2>
            </div>
            <div className="card-body d-flex flex-column gap-3">
              {project.description && (
                <div>
                  <div className="text-secondary small fw-medium mb-1">Project Scope</div>
                  <div className="text-dark small">{project.description}</div>
                </div>
              )}
              {project.routeDescription && (
                <div>
                  <div className="text-secondary small fw-medium mb-1">Route</div>
                  <div className="text-dark small">{project.routeDescription}</div>
                </div>
              )}
              {hasParticulars && (
                <div
                  className={`row g-3${
                    project.description || project.routeDescription ? " border-top pt-3" : ""
                  }`}
                >
                  {project.projectType && (
                    <div className="col-12 col-sm-6 col-lg-4">
                      <div className="text-secondary small fw-medium mb-1">Project Type</div>
                      <div className="fw-semibold text-dark small">{project.projectType}</div>
                    </div>
                  )}
                  {workLocationLabel && (
                    <div className="col-12 col-sm-6 col-lg-4">
                      <div className="text-secondary small fw-medium mb-1">Work Location</div>
                      <div className="fw-semibold text-dark small">{workLocationLabel}</div>
                    </div>
                  )}
                  {riskProfileLabel && (
                    <div className="col-12 col-sm-6 col-lg-4">
                      <div className="text-secondary small fw-medium mb-1">Risk Profile</div>
                      <div className="fw-semibold text-dark small">{riskProfileLabel}</div>
                    </div>
                  )}
                  {project.workOrderRef && (
                    <div className="col-12 col-sm-6 col-lg-4">
                      <div className="text-secondary small fw-medium mb-1">Work Order Ref</div>
                      <div className="fw-semibold text-dark small font-mono-code">
                        {project.workOrderRef}
                      </div>
                    </div>
                  )}
                  {multiYearLabel && (
                    <div className="col-12 col-sm-6 col-lg-4">
                      <div className="text-secondary small fw-medium mb-1">Multi-Year Term</div>
                      <div className="fw-semibold text-dark small font-mono-code">
                        {multiYearLabel}
                      </div>
                    </div>
                  )}
                  {showOnHire && (
                    <div className="col-12 col-sm-6 col-lg-4">
                      <div className="text-secondary small fw-medium mb-1">On-Hire Date</div>
                      <div className="fw-semibold text-dark small font-mono-code">
                        {project.onHireDate}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {showOrganizationsCard && (
            <div className="card map-card-custom" data-testid="project-organizations-card">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h2 className="h6 fw-semibold mb-0 text-dark">
                  Organizations &amp; Contract Chain
                </h2>
                <div className="d-flex align-items-center gap-2">
                  <span className="font-mono-code small text-secondary">
                    {organizationCount}{" "}
                    {organizationCount === 1 ? "Organization" : "Organizations"}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5"
                      onClick={() => setIsEditPartiesModalOpen(true)}
                      data-testid="btn-edit-participating-orgs"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="card-body d-flex flex-column gap-3">
                {visibleChainParties.length > 0 && (
                  <div>
                    <div className="text-secondary small fw-semibold mb-2">Contract Chain</div>
                    <div className="row g-3">
                      {visibleChainParties.map(({ role, party }, index) => (
                        <div key={role} className="col-12 col-md-4">
                          <div className="d-flex align-items-start gap-2">
                            <span
                              className="d-inline-flex align-items-center justify-content-center rounded-circle fw-semibold font-mono-code flex-shrink-0 mt-1"
                              style={{
                                width: "22px",
                                height: "22px",
                                fontSize: "0.75rem",
                                backgroundColor: "#f1f5f9",
                                color: "#334155",
                              }}
                              aria-hidden="true"
                            >
                              {index + 1}
                            </span>
                            <div>
                              <div className="text-secondary small fw-medium">
                                {CONTRACT_CHAIN_LABELS[role]}
                              </div>
                              <div className="fw-semibold text-dark small">
                                {party.organization}
                              </div>
                              {party.group && (
                                <div className="text-secondary small">{party.group}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(otherParties.length > 0 || canManage) && (
                  <div className={visibleChainParties.length > 0 ? "border-top pt-3" : ""}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="text-secondary small fw-semibold">
                        Participating Organizations
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none small"
                          onClick={() => setIsEditPartiesModalOpen(true)}
                          data-testid="btn-edit-participating-orgs-section"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {otherParties.length > 0 ? (
                      <div className="row g-3">
                        {otherParties.map((party) => (
                          <div
                            key={`${party.organization}-${party.group}`}
                            className="col-12 col-sm-6 col-lg-3"
                          >
                            <div className="fw-semibold text-dark small">{party.organization}</div>
                            {party.group && (
                              <div className="text-secondary small">{party.group}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small">No participating organizations listed.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === "roster" && (
        <div className="card map-card-custom">
          <div className="p-3 border-bottom">
            <CountTabs
              tabs={objectTabs}
              active={assetFilter}
              onChange={(key) => setAssetFilter(key as "All" | ProjectAssetType)}
              aria-label="Filter by object type"
            />
          </div>

          <ListToolbar
            searchValue={objectSearchTerm}
            onSearchChange={setObjectSearchTerm}
            searchPlaceholder="Search objects..."
          />

          {objectChips.length > 0 && (
            <div className="px-3 py-2 bg-light border-bottom">
              <ActiveFilterChips
                chips={objectChips}
                onClearAll={() => {
                  setAssetFilter("All");
                  setObjectSearchTerm("");
                }}
              />
            </div>
          )}

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

      {activeTab === "tasks" && (
        <ProjectTasksTable
          sets={projectAssuranceSets}
          documents={documents}
          assuranceObjects={project.assetLinks?.map((l) => ({
            id: l.assetId,
            name: l.assetName,
            type: l.assetType as any,
            ownerOrganization: l.providerOrganization,
          }))}
          users={users}
          activeDemoOrganization={activeDemoOrganization}
          sessionUser={sessionUser}
          onOpenSet={(set) => setCurrentHashView("assurance-sets", set.id)}
        />
      )}

      <ProjectAddAssetModal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        project={project}
      />

      <RequestAssuranceSetModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        project={effectiveProject || project}
        onSuccess={(message) => {
          setToast(message);
          setTimeout(() => setToast(null), 3500);
        }}
      />

      <EditParticipatingOrganizationsModal
        isOpen={isEditPartiesModalOpen}
        onClose={() => setIsEditPartiesModalOpen(false)}
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
