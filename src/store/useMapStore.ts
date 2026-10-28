/* 
  file summary: unified zustand global state management store for the marine assurance platform (map).
  responsibilities: manages state for active persona rbac, vessel fleet, assurance sets, document vault, audit logs, hash route tracking, and compliance workflows.
  role in system: central state store consumed by all header, sidebar, table, view, drawer, and modal components.
*/

import { create } from "zustand";
import {
  UserRolePersona,
  AuditTrailEvent,
  AuditTrailEventDraft,
  auditDateFieldLabel,
  withStructuredAuditTarget,
} from "../types/audit";
import {
  VesselInformation,
  VesselStatusDimension,
  VesselStatusHistoryEntry,
} from "../types/vessel";
import { EquipmentAsset } from "../types/equipment";
import { AvailabilityStatus } from "../types/asset";
import {
  AssuranceSet,
  AssuranceTemplate,
  DatePermissionGrant,
  TargetDateChangeRecord,
  AssuranceStage,
  AssuranceRequirement,
  VerificationMethod,
  InspectionReportEvidence,
  AssuranceObject,
  AssuranceObjectType,
} from "../types/assurance";
import { MasterDocument } from "../types/document";
import {
  MOCK_VESSELS,
  MOCK_ASSURANCE_SETS,
  MOCK_ASSURANCE_TEMPLATES,
  MOCK_DOCUMENTS,
  MOCK_AUDIT_TRAIL,
  MOCK_USERS,
} from "./mockData";
import { MOCK_EQUIPMENT } from "./equipmentMockData";
import { MOCK_CREW } from "./crewMockData";
import {
  isDuplicateVessel,
  isDuplicateEquipment,
  isDuplicateCampaignTitle,
  generateUniqueAssuranceSetId,
} from "../utils/validation";
import {
  canEditAssuranceSetStakeholders,
  getAssuranceSetCreator,
  getAssuranceSetStakeholderLockReason,
  isViewAccessibleToPersona,
  isClientUser,
  orgFieldMatches,
} from "../utils/rbacHelpers";
import { UserProfile } from "../types/user";
import { CrewMember, STCWDocumentItem } from "../types/crew";
import { CapaItem, CapaStatus, CapaEvidenceItem } from "../types/capa";
import { MOCK_CAPA_ITEMS } from "./capaMockData";
import {
  CrudAction,
  PermissionCategory,
  PermissionScopeDefinition,
  RolePermissionMatrix,
  UserPermissionOverrides,
  emptyCrud,
  slugifyPermissionKey,
  ALL_ROLE_PERSONAS,
  BUILTIN_PERMISSION_CATEGORIES,
} from "../types/permissions";
import {
  PERMISSION_SCOPE_CATALOG,
  buildBrdRolePermissionDefaults,
  buildEmptyFlagsForCatalog,
} from "../utils/permissionDefaults";
import { applyPermissionGuards } from "../utils/permissionHelpers";
import {
  getDemoSessionContext,
  getSessionUserForPersona,
  validateStakeholderAssignmentForSet,
} from "../utils/userRoleHelpers";
import {
  DEFAULT_DEMO_ORGANIZATION,
  getPersonasForOrganization,
  pickSessionUserForOrgPersona,
  resolveDefaultPersonaForOrganization,
} from "../utils/demoSessionHelpers";
import { calculateAssuranceSetReadiness } from "../utils/readinessHelpers";
import {
  ContractParty,
  Project,
  ProjectAssetLink,
  ProjectAssetType,
  ProjectRiskProfile,
  ProjectType,
  WorkLocationType,
} from "../types/project";
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from "./projectMockData";
import { AppNotification, NotificationDraft, SuggestedAssuranceAsset } from "../types/notification";
import {
  findDocumentRenewalsDue,
  getComplianceStateForExpiry,
  getRenewalMessage,
  getRenewalSubject,
  getRenewalSubmitterLabel,
} from "../utils/documentRenewalHelpers";
import { withDocumentChecks } from "../utils/documentChecks";
import {
  getAssuranceSetCrewIds,
  toSingleAssetSet,
  vesselToAssuranceObject,
  crewToAssuranceObject,
  personObjectAssignments,
  equipmentToAssuranceObject,
  SEEDED_OPERATIONAL_OBJECTS,
  getAssuranceSetObjects,
} from "../utils/assuranceTemplates";
import { MOCK_NOTIFICATIONS } from "./notificationMockData";
import {
  assuranceInvitationSubject,
  buildTargetDateNoticeDrafts,
  generateNotificationId,
  isNotificationActionedOnOpen,
  resolveNotificationRecipient,
  seedTargetDateNotices,
} from "../utils/notificationHelpers";
import {
  buildDraftAssetLinkFromAssuranceSet,
  generateUniqueProjectId,
  getProjectClientOrganization,
  getProjectEffectiveCharterer,
  getProjectForAssuranceSet,
  recalculateSetReadiness,
  requiresAssuranceSetForAssetLink,
  syncAllAffectedProjectRollups,
  syncProjectFromAssuranceSets,
} from "../utils/projectHelpers";
import { MOCK_VESSEL_STATUS_HISTORY } from "./vesselStatusHistoryMockData";
import {
  buildInitialVesselStatusHistoryEntries,
  diffVesselStatusChanges,
  generateVesselStatusHistoryId,
  getTrackedVesselStatusValues,
} from "../utils/vesselStatusHistoryHelpers";
import { autoAttachDocumentsToRequirements } from "../utils/documentMatchingHelpers";
import {
  findRequirementDocument,
  freezeClosedSetDocuments,
  isClosedAssuranceSet,
  stampReviewedVersion,
  syncDocumentVersionLock,
} from "../utils/documentVersionSnapshot";

export interface MapStoreState {
  // Authentication State
  isAuthenticated: boolean;
  login: (role: UserRolePersona) => void;
  logout: () => void;

  // Persona & RBAC State
  activePersona: UserRolePersona;
  setActivePersona: (persona: UserRolePersona) => void;
  /** mock demo tenant selected in the sidebar */
  activeDemoOrganization: string;
  /** mock user id for the active org + persona session */
  activeSessionUserId?: string;
  setActiveDemoOrganization: (organization: string) => void;

  // Hash Navigation State
  currentHashView: string;
  previousHashView?: string;
  currentEntityId?: string;
  previousEntityId?: string;
  setCurrentHashView: (view: string, entityId?: string) => void;

  // Active Asset Context
  activeVesselId: string;
  setActiveVesselId: (id: string) => void;

  /** When set, Create Assurance Set pre-selects this vessel and returns there after save/cancel */
  createAssuranceForVesselId?: string;
  setCreateAssuranceForVesselId: (vesselId?: string) => void;

  /** When set by a charter action, Create Assurance Set opens with this scope and asset preselected and locked */
  createAssuranceForAsset?: {
    scope: "Vessel" | "Crew" | "Equipment";
    assetId: string;
  };
  setCreateAssuranceForAsset: (
    target?: { scope: "Vessel" | "Crew" | "Equipment"; assetId: string },
  ) => void;

  /** When set, returning navigation targets this project after add-to-project flows */
  returnToProjectId?: string;
  setReturnToProjectId: (projectId?: string) => void;

  /** When set, Create Assurance Set wizard locks project selection to this project */
  lockedProjectId?: string;
  setLockedProjectId: (projectId?: string) => void;

  /** Notification id to mark actioned when the next assurance set is created for its project */
  pendingAssuranceRequestNotificationId?: string;
  setPendingAssuranceRequestNotificationId: (id?: string) => void;

  notifications: AppNotification[];
  focusedRequirementId?: string;
  setFocusedRequirementId: (requirementId: string | undefined) => void;
  /** raises a notification; returns its id, or undefined when there is no recipient or the recipient is the sender */
  pushNotification: (draft: NotificationDraft) => string | undefined;
  /** raises a document renewal notification for each expired, expiring or charter-short document on the given sets, or on every set; returns how many were raised */
  raiseDocumentRenewalNotifications: (assuranceSetIds?: string[]) => number;
  /** a reviewer asks the submitter for a new version of a document; returns how many notifications were raised */
  requestDocumentReupload: (docId: string, reason: string) => number;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (recipientUserId: string) => void;
  /** records that the recipient used the row action: read for an open request, actioned for every other type */
  openNotification: (notificationId: string) => void;
  requestAssuranceSet: (input: {
    projectId: string;
    recipientUserId: string;
    suggestedScope?: ProjectAssetType;
    suggestedScopes?: ProjectAssetType[];
    suggestedAssets?: SuggestedAssuranceAsset[];
    message?: string;
    senderUserId: string;
    senderName: string;
  }) => { success: boolean; message?: string };
  markNotificationActioned: (
    notificationId: string,
    assuranceSetId: string,
  ) => void;

  // Project Charter State
  projects: Project[];
  addProject: (input: {
    name: string;
    projectType: ProjectType;
    clientOperator: string;
    requestingOrganization: string;
    location: string;
    description?: string;
    charterWindowStart: string;
    charterWindowEnd: string;
    operatorOrganization: string;
    charterer?: string;
    routeDescription?: string;
    riskProfile?: ProjectRiskProfile | null;
    serviceProvider?: string;
    workOrderRef?: string;
    workLocationType?: WorkLocationType;
    primaryVesselId?: string;
    contractParties?: ContractParty[];
    projectValue?: number | null;
    currency?: string;
    multiYearStart?: string;
    multiYearEnd?: string;
    onHireDate?: string;
    assetLinks?: Omit<
      ProjectAssetLink,
      "id" | "projectId" | "addedAt" | "addedByPersona"
    >[];
  }) => { success: boolean; projectId?: string; message?: string };
  updateProject: (project: Project) => void;
  addAssetToProject: (
    projectId: string,
    link: Omit<
      ProjectAssetLink,
      "id" | "projectId" | "addedAt" | "addedByPersona"
    >,
  ) => { success: boolean; message?: string };
  removeAssetFromProject: (projectId: string, linkId: string) => void;
  /** adds an orphaned assurance set to a project roster; a set belongs to at most one project */
  attachAssuranceSetToProject: (
    assuranceSetId: string,
    projectId: string,
  ) => { success: boolean; message?: string };
  linkAssuranceSetToProjectAsset: (
    projectId: string,
    linkId: string,
    assuranceSetId: string,
  ) => void;
  syncProjectFromSets: (projectId: string) => void;

  // Vessel Fleet State
  vessels: VesselInformation[];
  addVessel: (vessel: VesselInformation) => {
    success: boolean;
    message?: string;
    vesselId?: string;
  };
  updateVessel: (vessel: VesselInformation) => void;
  updateVesselStatus: (
    vesselId: string,
    status: VesselInformation["status"],
  ) => void;
  updateVesselAvailability: (
    vesselId: string,
    availabilityStatus: AvailabilityStatus,
  ) => void;

  // Vessel Status History
  vesselStatusHistory: VesselStatusHistoryEntry[];
  recordVesselStatusChange: (params: {
    vesselId: string;
    dimension: VesselStatusDimension;
    previousValue: string | null;
    newValue: string;
    changedBy?: string;
    changedByRole?: UserRolePersona;
    notes?: string;
    source?: VesselStatusHistoryEntry["source"];
    effectiveFrom?: string;
  }) => void;

  // Equipment Assets State
  equipment: EquipmentAsset[];
  addEquipment: (item: EquipmentAsset) => {
    success: boolean;
    message?: string;
    equipmentId?: string;
  };
  updateEquipment: (item: EquipmentAsset) => void;
  updateEquipmentAvailability: (
    equipmentId: string,
    availabilityStatus: AvailabilityStatus,
  ) => void;

  // Assurance Objects State (ADR 0029)
  assuranceObjects: AssuranceObject[];
  registerAssuranceObject: (object: AssuranceObject) => { success: boolean; objectId: string; message?: string };
  addAssuranceObject: (object: AssuranceObject) => { success: boolean; objectId: string; message?: string };

  // Assurance Sets State
  assuranceSets: AssuranceSet[];
  addAssuranceSet: (set: AssuranceSet) => void;
  updateAssuranceSet: (set: AssuranceSet) => void;
  grantDatePermission: (setId: string, grant: Omit<DatePermissionGrant, 'id' | 'grantedAt'>) => void;
  revokeDatePermission: (setId: string, grantId: string) => void;
  reviseAssuranceSetDeadline: (
    setId: string,
    revisedDate: string,
    actorName: string,
    reason?: string,
  ) => { success: boolean; message?: string };
  exemptAssuranceTasks: (
    setId: string,
    taskIds: string[],
    reason: string,
    grantedBy: string,
    newDate: string,
  ) => { success: boolean; message?: string };
  partiallyCloseAssuranceSet: (
    setId: string,
    actorName: string,
    notes?: string,
  ) => { success: boolean; message?: string };
  cancelAssuranceSet: (
    setId: string,
    actorName: string,
    reason?: string,
  ) => { success: boolean; message?: string };
  addAssuranceTask: (
    setId: string,
    task: Partial<AssuranceRequirement> & Pick<AssuranceRequirement, "title" | "category">,
  ) => { success: boolean; message?: string; requirement?: AssuranceRequirement };
  editAssuranceTask: (
    setId: string,
    taskId: string,
    taskUpdates: Partial<AssuranceRequirement>,
  ) => { success: boolean; message?: string };
  removeAssuranceTask: (
    setId: string,
    taskId: string,
  ) => { success: boolean; message?: string };
  updateTaskTargetDate: (
    setId: string,
    taskId: string,
    targetDate: string,
    actorName: string,
    reason?: string,
  ) => { success: boolean; message?: string };

  // Assurance Templates State (Dedicated Public Templates Slice)
  assuranceTemplates: AssuranceTemplate[];
  addAssuranceTemplate: (template: AssuranceTemplate) => void;
  updateAssuranceTemplate: (template: AssuranceTemplate) => void;
  updateAssuranceStage: (setId: string, stage: AssuranceStage) => void;
  updateAssuranceStakeholder: (
    setId: string,
    role: "Submitter" | "Verifier" | "Inspector" | "Approver",
    assigneeName: string,
  ) => { success: boolean; message?: string };
  updateAssuranceInspector: (setId: string, inspectorName: string) => void;
  /** records a submitted inspection outcome for a vessel; returns the ids of the sets whose inspection it completed */
  completeVesselInspection: (
    vesselName: string,
    outcome: "Pass" | "Pass with observations" | "Fail",
  ) => string[];
  updateRequirementStatus: (
    setId: string,
    reqId: string,
    status: "Verified" | "Correction Requested" | "Rejected",
    notes?: string,
  ) => void;
  denyRequirementByApprover: (
    setId: string,
    reqId: string,
    decision: "Correction Requested" | "Rejected",
    notes: string,
  ) => void;
  setApproverDecision: (
    setId: string,
    decision: "Approved" | "Returned for Correction" | "Rejected",
    notes?: string,
  ) => void;
  sendAssuranceForReview: (setId: string) => void;
  setClientApproval: (
    setId: string,
    decision: "Approved" | "Returned for Correction" | "Rejected",
    notes?: string,
  ) => void;

  // Document Library State
  documents: MasterDocument[];
  addDocument: (doc: MasterDocument) => void;
  linkDocumentToVessel: (
    docId: string,
    vesselId: string,
    vesselName?: string,
    imoNumber?: string,
  ) => void;
  uploadDocumentForRequirement: (
    setId: string,
    requirementId: string | undefined,
    doc: MasterDocument,
    /* the report facts, when the requirement asks for an inspection report */
    inspectionReport?: InspectionReportEvidence,
  ) => void;
  addDocumentVersion: (
    docId: string,
    newVersionLabel: string,
    fileName: string,
    fileSizeBytes: number,
    changeSummary: string,
    /* expiry date read from the new version; the compliance state follows it */
    expiryDate?: string,
    /* the one requirement the version was submitted for; other sets using the document keep their decision and get a notice */
    scope?: { assuranceSetId: string; requirementId: string },
  ) => void;
  verifyDocument: (
    docId: string,
    status: "Pending" | "Verified" | "Correction Requested" | "Rejected",
    notes?: string,
    routeTarget?: "Inspector" | "Approver",
    /* the requirement opened for review; a decision applies to this one requirement only */
    requirementId?: string,
    /* the set the requirement belongs to; requirement ids repeat across sets */
    assuranceSetId?: string,
    /* how the document was confirmed, and why it was verified although a check failed (gap review G1, E6) */
    review?: {
      verificationMethod?: VerificationMethod;
      overrideReason?: string;
      verificationReference?: string;
      verificationResultSummary?: string;
    },
  ) => void;

  // Audit Trail State
  auditEvents: AuditTrailEvent[];
  /* the actor (user id, role, organization) is always the signed-in session user; callers give only what happened */
  logAuditEvent: (
    event: Omit<
      AuditTrailEventDraft,
      "id" | "timestampUtc" | "userId" | "userRole" | "organization"
    >,
  ) => void;
  /* an export of a screen; the target is the set when the export is about one set */
  logExport: (input: {
    screen: string;
    format: "CSV" | "PDF";
    setId?: string;
    detail: string;
  }) => void;

  // User Management State
  users: UserProfile[];
  addUser: (user: UserProfile) => void;
  updateUser: (user: UserProfile) => void;
  updateUserStatus: (userId: string, status: UserProfile["status"]) => void;

  // Roles & Permissions State (BRD defaults + admin overrides)
  rolePermissionDefaults: RolePermissionMatrix;
  userPermissionOverrides: UserPermissionOverrides;
  customRoles: string[];
  customScopes: PermissionScopeDefinition[];
  customCategories: string[];
  setRolePermissionFlag: (
    role: string,
    scopeKey: string,
    action: CrudAction,
    value: boolean,
  ) => void;
  commitRolePermissionDefaults: (matrix: RolePermissionMatrix) => void;
  commitUserPermissionOverrides: (overrides: UserPermissionOverrides) => void;
  resetRolePermissionsToBrd: () => void;
  setUserPermissionOverride: (
    userId: string,
    scopeKey: string,
    action: CrudAction,
    value: boolean,
  ) => void;
  clearUserPermissionOverrides: (userId: string) => void;
  addCustomRole: (roleName: string) => { success: boolean; message?: string };
  addCustomCategory: (categoryName: string) => {
    success: boolean;
    message?: string;
  };
  addCustomScope: (input: {
    label: string;
    description: string;
    category: string;
  }) => { success: boolean; message?: string; key?: string };

  // Crew Directory State
  crew: CrewMember[];
  addCrewMember: (crew: CrewMember) => void;
  updateCrewMember: (updatedCrew: CrewMember) => void;
  assignCrewToVessel: (crewId: string, vesselId: string | undefined) => void;
  assignPersonToObject: (
    personId: string,
    input: {
      targetObjectId: string;
      targetObjectType: AssuranceObjectType;
      targetName: string;
      startDate: string;
      endDate?: string;
      role?: string;
    },
  ) => { success: boolean; message?: string };
  addCrewDocument: (crewId: string, doc: STCWDocumentItem) => void;
  updateCrewDocument: (crewId: string, doc: STCWDocumentItem) => void;
  deleteCrewDocument: (crewId: string, docId: string) => void;

  // Global Drawers State
  isAuditDrawerOpen: boolean;
  setAuditDrawerOpen: (open: boolean) => void;

  // CAPA Management State
  capaItems: CapaItem[];
  addCapaItem: (capa: CapaItem) => void;
  updateCapaStatus: (
    capaId: string,
    status: CapaStatus,
    inspectorNotes?: string,
  ) => void;
  addCapaEvidence: (capaId: string, evidence: CapaEvidenceItem) => void;
  removeCapaEvidence: (capaId: string, evidenceId: string) => void;
  flagCapaForReinspection: (capaId: string, reason?: string) => void;
}

const BRD_PERMISSION_DEFAULTS = buildBrdRolePermissionDefaults();

const ASSURANCE_DATE_FIELDS = [
  "charterWindowStart",
  "charterWindowEnd",
  "complianceDeadline",
  "targetDate",
  "projectWindowStart",
  "projectWindowEnd",
] as const;

/**
  what: writes one audit event for each date or task that changed on an assurance set.
  how: compares the stored set with the set the caller submitted, and logs a date target or a task target for each difference.
  with what file: src/store/useMapStore.ts, called by updateAssuranceSet.
*/
function logAssuranceSetAuditDiff(
  get: () => MapStoreState,
  previousSet: AssuranceSet,
  nextSet: AssuranceSet,
) {
  for (const field of ASSURANCE_DATE_FIELDS) {
    const oldValue = previousSet[field] ?? "";
    const newValue = nextSet[field] ?? "";
    if (oldValue === newValue) continue;
    get().logAuditEvent({
      action: "Changed date",
      targetAsset: `${nextSet.id} (${nextSet.title})`,
      target: { kind: "date", setId: nextSet.id, dateField: field },
      fieldDelta: {
        fieldName: auditDateFieldLabel(field),
        oldValue: oldValue || "—",
        newValue: newValue || "—",
      },
    });
  }

  const previousTasks = new Map(previousSet.requirements.map((task) => [task.id, task]));
  const nextTasks = new Map((nextSet.requirements || []).map((task) => [task.id, task]));

  for (const [taskId, task] of nextTasks) {
    const previous = previousTasks.get(taskId);
    if (!previous) {
      get().logAuditEvent({
        action: "Added task",
        targetAsset: `${nextSet.id} · ${task.title}`,
        target: { kind: "task", setId: nextSet.id, taskId },
        justificationNotes: `Added task ${task.title}.`,
      });
      notifyVendorOfTaskChange(get, nextSet, "added", task.title);
      continue;
    }
    if (taskEditSnapshot(previous) === taskEditSnapshot(task)) continue;
    get().logAuditEvent({
      action: "Edited task",
      targetAsset: `${nextSet.id} · ${task.title}`,
      target: { kind: "task", setId: nextSet.id, taskId },
      fieldDelta: {
        fieldName: "Task",
        oldValue: previous.title,
        newValue: task.title,
      },
      justificationNotes: `Edited task ${task.title}.`,
    });
    notifyVendorOfTaskChange(get, nextSet, "edited", task.title);
  }

  for (const [taskId, task] of previousTasks) {
    if (nextTasks.has(taskId)) continue;
    get().logAuditEvent({
      action: "Removed task",
      targetAsset: `${previousSet.id} · ${task.title}`,
      target: { kind: "task", setId: previousSet.id, taskId },
      justificationNotes: `Removed task ${task.title}.`,
    });
    notifyVendorOfTaskChange(get, previousSet, "removed", task.title);
  }
}

/**
  what: returns the task fields an edit should record.
  how: joins the title, description, category and whether the task is mandatory.
  with what file: src/store/useMapStore.ts, called by logAssuranceSetAuditDiff.
*/
function taskEditSnapshot(task: AssuranceRequirement): string {
  return [
    task.title,
    task.description ?? "",
    task.category,
    task.isMandatory ? "mandatory" : "optional",
    task.targetDate ?? "",
  ].join("\u001f");
}

/**
  what: raises a notification about an assurance set to the user a stakeholder label names; inputs are the store getter, the set, the label and the notification content.
  how: resolves the label to a user, fills sender from the signed-in persona user and project from the set, then calls pushNotification; does nothing when the label names no user.
  with what file: src/store/useMapStore.ts, called by the assurance, document and capa actions below.
*/
function notifyAssuranceSetUser(
  get: () => MapStoreState,
  assuranceSet: AssuranceSet,
  recipientLabel: string | undefined,
  content: Pick<NotificationDraft, "type" | "subject"> &
    Partial<
      Pick<
        NotificationDraft,
        "message" | "assignedRole" | "documentId" | "capaId" | "vesselName" | "renewalReason"
      >
    >,
  /* systemSent: raised by the platform, not by the signed-in user, so it also reaches that user */
  options: { systemSent?: boolean } = {},
): string | undefined {
  const state = get();
  const recipient = resolveNotificationRecipient(recipientLabel, state.users);
  if (!recipient) return undefined;

  const sender = options.systemSent
    ? undefined
    : getSessionUserForPersona(
        state.activePersona,
        state.users,
        getDemoSessionContext(state),
      );
  const project = getProjectForAssuranceSet(assuranceSet, state.projects);
  return state.pushNotification({
    vesselName: assuranceSet.vesselName || undefined,
    ...content,
    recipientUserId: recipient.id,
    senderUserId: sender?.id,
    senderName: options.systemSent
      ? SYSTEM_NOTIFICATION_SENDER
      : sender?.name || state.activePersona,
    projectId: project?.id,
    projectName: project?.name,
    assuranceSetId: assuranceSet.id,
  });
}

/* sender name of a notification the platform raises on its own */
const SYSTEM_NOTIFICATION_SENDER = "MAP System";

/**
  what: notifies the vendor of a task change on an assurance set.
  how: sends a review_requested notification to the assigned submitter and provider admins.
  with what file: src/store/useMapStore.ts, called by logAssuranceSetAuditDiff.
*/
function notifyVendorOfTaskChange(
  get: () => MapStoreState,
  assuranceSet: AssuranceSet,
  action: "added" | "edited" | "removed",
  taskTitle: string,
): void {
  const state = get();
  const notifiedUserIds = new Set<string>();

  const submitterRecipient = resolveNotificationRecipient(assuranceSet.assignedSubmitter, state.users);
  if (submitterRecipient) {
    notifiedUserIds.add(submitterRecipient.id);
    notifyAssuranceSetUser(get, assuranceSet, assuranceSet.assignedSubmitter, {
      type: "review_requested",
      subject: `Task ${action}: ${taskTitle} · ${assuranceSet.id}`,
      message: `A task on assurance set ${assuranceSet.title} was ${action}: ${taskTitle}.`,
    });
  }

  const providerOrg = assuranceSet.serviceProviderOrg;
  if (providerOrg) {
    state.users
      .filter(
        (u) =>
          u.status === "Active" &&
          (u.roles.includes("Administrator") || u.roles.includes("Submitter")) &&
          orgFieldMatches(u.organization, providerOrg) &&
          !notifiedUserIds.has(u.id),
      )
      .forEach((user) => {
        notifiedUserIds.add(user.id);
        state.pushNotification({
          type: "review_requested",
          subject: `Task ${action}: ${taskTitle} · ${assuranceSet.id}`,
          message: `A task on assurance set ${assuranceSet.title} was ${action}: ${taskTitle}.`,
          recipientUserId: user.id,
          senderName: state.activePersona,
          assuranceSetId: assuranceSet.id,
          vesselName: assuranceSet.vesselName || undefined,
        });
      });
  }

  if (notifiedUserIds.size === 0) {
    const creator = getAssuranceSetCreator(assuranceSet, state.users);
    const creatorUser = creator.name ? state.users.find((u) => u.name === creator.name) : undefined;
    if (creatorUser && (creatorUser.roles.includes("Administrator") || creatorUser.roles.includes("Submitter"))) {
      state.pushNotification({
        type: "review_requested",
        subject: `Task ${action}: ${taskTitle} · ${assuranceSet.id}`,
        message: `A task on assurance set ${assuranceSet.title} was ${action}: ${taskTitle}.`,
        recipientUserId: creatorUser.id,
        senderName: state.activePersona,
        assuranceSetId: assuranceSet.id,
        vesselName: assuranceSet.vesselName || undefined,
      });
    }
  }
}

/**
  what: stakeholder label a document renewal goes to; inputs are the store getter, the set and the requirement the document meets.
  how: the requirement's submitter, then the set's submitter, when the label names a real user; otherwise the set creator.
  with what file: src/store/useMapStore.ts, called by the document renewal actions below.
*/
function resolveRenewalRecipientLabel(
  get: () => MapStoreState,
  assuranceSet: AssuranceSet,
  requirement?: AssuranceRequirement,
): string | undefined {
  const users = get().users;
  const labels = [
    getRenewalSubmitterLabel({ assignedSubmitter: undefined }, requirement),
    getRenewalSubmitterLabel(assuranceSet),
  ];
  return (
    labels.find((label) => resolveNotificationRecipient(label, users)) ||
    getAssuranceSetCreator(assuranceSet, users).name
  );
}

/**
  what: stakeholder labels an expired document goes to; inputs are the store getter, the set and the requirement the document meets.
  how: the recipient of resolveRenewalRecipientLabel, plus every active administrator of the provider organization (the set's provider, otherwise the submitter's organization); each user appears once.
  with what file: src/store/useMapStore.ts, called by raiseDocumentRenewalNotifications.
*/
function resolveExpiredRenewalRecipientLabels(
  get: () => MapStoreState,
  assuranceSet: AssuranceSet,
  requirement?: AssuranceRequirement,
): string[] {
  const users = get().users;
  const labelsByUserId = new Map<string, string>();

  const primaryLabel = resolveRenewalRecipientLabel(get, assuranceSet, requirement);
  const primary = resolveNotificationRecipient(primaryLabel, users);
  if (primary && primaryLabel) labelsByUserId.set(primary.id, primaryLabel);

  const submitter = [
    getRenewalSubmitterLabel({ assignedSubmitter: undefined }, requirement),
    getRenewalSubmitterLabel(assuranceSet),
  ]
    .map((label) => resolveNotificationRecipient(label, users))
    .find(Boolean);
  const providerOrg = assuranceSet.serviceProviderOrg || submitter?.organization;
  if (providerOrg) {
    users
      .filter(
        (u) =>
          u.status === "Active" &&
          u.roles.includes("Administrator") &&
          orgFieldMatches(providerOrg, u.organization),
      )
      .forEach((u) => {
        if (!labelsByUserId.has(u.id)) labelsByUserId.set(u.id, u.name);
      });
  }

  return Array.from(labelsByUserId.values());
}

/**
  what: the person an audit event or a review stamp is recorded against; input is the store getter.
  how: the signed-in session user for the active persona and demo organization, with that persona as the role (gap review E8).
  with what file: src/store/useMapStore.ts, called by logAuditEvent, verifyDocument and updateRequirementStatus.
*/
function getSessionActor(
  get: () => MapStoreState,
): { userId: string; userRole: UserRolePersona; organization: string } {
  const state = get();
  const sessionUser = getSessionUserForPersona(
    state.activePersona,
    state.users,
    getDemoSessionContext(state),
  );
  return {
    userId: sessionUser?.id || `${state.activePersona} (no user record)`,
    userRole: state.activePersona,
    organization: sessionUser?.organization || state.activeDemoOrganization,
  };
}

/**
  what: tells a set's verifier that a document was submitted for review; inputs are the store getter, the set, the requirement and the document.
  how: one review_requested notification to the assigned verifier naming the requirement; nothing when the set has no verifier who resolves to a user.
  with what file: src/store/useMapStore.ts, called by uploadDocumentForRequirement and addDocumentVersion.
*/
function notifySubmittedForReview(
  get: () => MapStoreState,
  assuranceSetId: string,
  requirementId: string | undefined,
  documentId: string,
): void {
  const set = get().assuranceSets.find((s) => s.id === assuranceSetId);
  if (!set) return;
  const requirement = set.requirements.find((r) => r.id === requirementId);
  const document = get().documents.find((d) => d.id === documentId);
  notifyAssuranceSetUser(get, set, set.assignedVerifier, {
    type: "review_requested",
    subject: `Document submitted: ${requirement?.title || document?.title || documentId}`,
    documentId,
  });
}

/**
  what: closes the renewal notifications a new upload answers; inputs are the store setter, the document id and, optionally, the one set the upload was made on.
  how: marks every renewal notification of that document that is not yet actioned as actioned.
  with what file: src/store/useMapStore.ts, called by uploadDocumentForRequirement and addDocumentVersion.
*/
function closeDocumentRenewalNotifications(
  set: (fn: (state: MapStoreState) => Partial<MapStoreState>) => void,
  documentId: string | undefined,
  assuranceSetId?: string,
): void {
  if (!documentId) return;
  const now = new Date().toISOString();
  set((state) => ({
    notifications: state.notifications.map((n) =>
      n.type === "document_renewal" &&
      n.status !== "actioned" &&
      n.documentId === documentId &&
      (!assuranceSetId || n.assuranceSetId === assuranceSetId)
        ? { ...n, status: "actioned" as const, readAt: n.readAt || now, actionedAt: now }
        : n,
    ),
  }));
}


/**
  what: notifies every person assigned on an assurance set, and the client admins of its client and project; inputs are the store getter and the set.
  how: sends one stakeholder_assigned notification to the submitter, verifier, inspector and approver, then to each active client admin of the client organization and the project owner; each person is notified once.
  with what file: src/store/useMapStore.ts, called by addAssuranceSet and updateAssuranceSet.
*/
function notifyAssignedStakeholders(
  get: () => MapStoreState,
  assuranceSet: AssuranceSet,
): void {
  const state = get();
  const notifiedUserIds = new Set<string>();
  const assignments: { role: UserRolePersona; label?: string }[] = [
    { role: "Submitter", label: assuranceSet.assignedSubmitter },
    { role: "Verifier", label: assuranceSet.assignedVerifier },
    {
      role: "Inspector",
      label: assuranceSet.mandatoryInspectionRequired
        ? assuranceSet.assignedInspector
        : undefined,
    },
    { role: "Approver", label: assuranceSet.assignedApprover },
  ];

  const remember = (label: string | undefined) => {
    const recipient = resolveNotificationRecipient(label, state.users);
    if (recipient) notifiedUserIds.add(recipient.id);
    return recipient;
  };

  assignments.forEach(({ role, label }) => {
    if (!remember(label)) return;
    notifyAssuranceSetUser(get, assuranceSet, label, {
      type: "stakeholder_assigned",
      subject: assuranceInvitationSubject(assuranceSet.title),
      assignedRole: role,
    });
  });

  const project = getProjectForAssuranceSet(assuranceSet, state.projects);
  const organizations = [
    assuranceSet.clientOrg,
    assuranceSet.charterer,
    project?.ownerOrganization,
  ].filter((org): org is string => Boolean(org && org.trim()));
  const sameOrganization = (left: string, right: string) =>
    left.trim().toLowerCase() === right.trim().toLowerCase();

  state.users
    .filter(
      (user) =>
        user.status === "Active" &&
        user.roles.includes("C Admin") &&
        organizations.some((org) => sameOrganization(org, user.organization)) &&
        !notifiedUserIds.has(user.id),
    )
    .forEach((user) => {
      notifiedUserIds.add(user.id);
      notifyAssuranceSetUser(get, assuranceSet, `${user.name} (${user.organization})`, {
        type: "stakeholder_assigned",
        subject: assuranceInvitationSubject(assuranceSet.title),
        assignedRole: "C Admin",
      });
    });
}

function raiseTargetDateNotices(
  get: () => {
    users: UserProfile[];
    activeSessionUserId?: string;
    notifications: AppNotification[];
    pushNotification: (draft: NotificationDraft) => string | undefined;
  },
  setRecord: AssuranceSet,
  changed?: {
    scope: "set" | "task";
    taskId?: string;
    taskTitle?: string;
    oldDate?: string;
    newDate: string;
  },
) {
  const today = new Date().toISOString().slice(0, 10);
  buildTargetDateNoticeDrafts({
    set: setRecord,
    users: get().users,
    today,
    actorUserId: get().activeSessionUserId,
    changed,
  }).forEach((draft) => {
    const duplicate = get().notifications.some(
      (notice) =>
        notice.type === "target_date" &&
        notice.targetDateKind === draft.targetDateKind &&
        notice.assuranceSetId === draft.assuranceSetId &&
        (notice.taskId || "") === (draft.taskId || "") &&
        notice.targetDate === draft.targetDate &&
        notice.recipientUserId === draft.recipientUserId &&
        notice.status !== "actioned",
    );
    if (!duplicate) get().pushNotification(draft);
  });
}

export const useMapStore = create<MapStoreState>((set, get) => ({
  isAuthenticated: false,
  login: (role) => {
    const users = get().users;
    const sessionUser = getSessionUserForPersona(role, users);
    const organization = sessionUser?.organization ?? DEFAULT_DEMO_ORGANIZATION;
    const targetView =
      role === "Verifier"
        ? "verifier"
        : role === "Inspector"
          ? "inspector"
          : "dashboard";
    window.location.hash = `#/${targetView}`;
    set({
      isAuthenticated: true,
      activePersona: role,
      activeDemoOrganization: organization,
      activeSessionUserId: sessionUser?.id,
      currentHashView: targetView,
    });
    get().logAuditEvent({
      action: "Authenticated User Session",
      targetAsset: "Authentication Gateway",
      justificationNotes: `Logged in as ${role}`,
    });
  },
  logout: () => {
    get().logAuditEvent({
      action: "Terminated User Session",
      targetAsset: "Authentication Gateway",
      justificationNotes: "User signed out.",
    });
    window.location.hash = "#/login";
    set({ isAuthenticated: false, currentHashView: "login" });
  },

  activePersona: "Administrator",
  activeDemoOrganization: DEFAULT_DEMO_ORGANIZATION,
  activeSessionUserId: "USR-101",
  setActiveDemoOrganization: (organization) => {
    const users = get().users;
    const personas = getPersonasForOrganization(users, organization);
    if (personas.length === 0) return;

    const nextPersona =
      resolveDefaultPersonaForOrganization(users, organization, get().activePersona) ??
      personas[0];
    const sessionUser = pickSessionUserForOrgPersona(users, organization, nextPersona);


    const currentView = get().currentHashView;
    const currentId = get().currentEntityId;
    if (!isViewAccessibleToPersona(currentView, currentId, nextPersona)) {
      get().setCurrentHashView("dashboard");
    }

    set({
      activeDemoOrganization: organization,
      activePersona: nextPersona,
      activeSessionUserId: sessionUser?.id,
    });
    get().logAuditEvent({
      action: "Switched Demo Organization",
      targetAsset: "Global System Context",
      justificationNotes: `Demo organization set to ${organization}`,
    });
  },
  setActivePersona: (persona) => {
    const organization = get().activeDemoOrganization;
    const users = get().users;
    const personas = getPersonasForOrganization(users, organization);
    if (!personas.includes(persona)) return;

    const sessionUser = pickSessionUserForOrgPersona(users, organization, persona);


    /* default to dashboard if active view is not accessible to newly selected persona */
    const currentView = get().currentHashView;
    const currentId = get().currentEntityId;

    if (!isViewAccessibleToPersona(currentView, currentId, persona)) {
      get().setCurrentHashView("dashboard");
    }

    set({ activePersona: persona, activeSessionUserId: sessionUser?.id });
    get().logAuditEvent({
      action: "Switched Active User Persona",
      targetAsset: "Global System Context",
      justificationNotes: `Persona set to ${persona}`,
    });
  },

  currentHashView: "login",
  previousHashView: undefined,
  currentEntityId: undefined,
  previousEntityId: undefined,
  setCurrentHashView: (view, entityId) => {
    const currentView = get().currentHashView;
    const currentId = get().currentEntityId;

    let prevView = get().previousHashView;
    let prevId = get().previousEntityId;

    if (currentView !== view || currentId !== entityId) {
      prevView = currentView;
      prevId = currentId;
    }

    window.location.hash = entityId ? `#/${view}/${entityId}` : `#/${view}`;
    set({
      previousHashView: prevView,
      previousEntityId: prevId,
      currentHashView: view,
      currentEntityId: entityId,
    });
  },

  activeVesselId: "VESSEL-001",
  setActiveVesselId: (id) => set({ activeVesselId: id }),

  createAssuranceForVesselId: undefined,
  setCreateAssuranceForVesselId: (vesselId) =>
    set({ createAssuranceForVesselId: vesselId }),

  createAssuranceForAsset: undefined,
  setCreateAssuranceForAsset: (target) =>
    set({ createAssuranceForAsset: target }),

  returnToProjectId: undefined,
  setReturnToProjectId: (projectId) => set({ returnToProjectId: projectId }),

  lockedProjectId: undefined,
  setLockedProjectId: (projectId) => set({ lockedProjectId: projectId }),

  pendingAssuranceRequestNotificationId: undefined,
  setPendingAssuranceRequestNotificationId: (id) =>
    set({ pendingAssuranceRequestNotificationId: id }),

  notifications: seedTargetDateNotices(
    MOCK_NOTIFICATIONS,
    [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS],
    MOCK_USERS,
    new Date().toISOString().slice(0, 10),
  ),
  focusedRequirementId: undefined as string | undefined,
  setFocusedRequirementId: (requirementId: string | undefined) =>
    set({ focusedRequirementId: requirementId }),

  pushNotification: (draft) => {
    if (!draft.recipientUserId || draft.recipientUserId === draft.senderUserId) {
      return undefined;
    }
    const notification: AppNotification = {
      ...draft,
      id: generateNotificationId(get().notifications, draft.type),
      status: "unread",
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      notifications: [notification, ...state.notifications],
    }));
    return notification.id;
  },

  raiseDocumentRenewalNotifications: (assuranceSetIds) => {
    const state = get();
    const sets = assuranceSetIds
      ? state.assuranceSets.filter((s) => assuranceSetIds.includes(s.id))
      : state.assuranceSets;
    const today = new Date();
    let raised = 0;
    findDocumentRenewalsDue(
      sets.filter((s) => s.visibility !== "draft"),
      state.documents,
      state.notifications,
      today,
    ).forEach(({ set: dueSet, requirement, document, reason }) => {
      /* an expired document goes to the submitter and to the administrators of the provider; every other reason to the submitter only */
      const recipientLabels =
        reason === "expired"
          ? resolveExpiredRenewalRecipientLabels(get, dueSet, requirement)
          : [resolveRenewalRecipientLabel(get, dueSet, requirement)];
      recipientLabels.forEach((recipientLabel) => {
        const id = notifyAssuranceSetUser(
          get,
          dueSet,
          recipientLabel,
          {
            type: "document_renewal",
            renewalReason: reason,
            subject: getRenewalSubject(reason, document, dueSet, today),
            message: getRenewalMessage(reason, document, dueSet),
            documentId: document.id,
          },
          { systemSent: true },
        );
        if (id) raised += 1;
      });
    });
    return raised;
  },

  requestDocumentReupload: (docId, reason) => {
    const document = get().documents.find((d) => d.id === docId);
    const note = reason.trim();
    if (!document || !note) return 0;

    let raised = 0;
    get().assuranceSets.forEach((s) => {
      const requirement = s.requirements.find(
        (r) => r.documentId === docId || r.linkedDocumentId === docId,
      );
      if (!requirement) return;
      const id = notifyAssuranceSetUser(
        get,
        s,
        resolveRenewalRecipientLabel(get, s, requirement),
        {
          type: "document_renewal",
          renewalReason: "reupload_requested",
          subject: getRenewalSubject("reupload_requested", document, s),
          message: note,
          documentId: docId,
        },
      );
      if (id) raised += 1;
    });

    const activePersona = get().activePersona;
    get().logAuditEvent({
      action: "Requested Document Reupload [PING: SUBMITTER ACTION REQUIRED]",
      targetAsset: `Document ${docId}`,
      justificationNotes: note,
    });
    return raised;
  },

  markNotificationRead: (notificationId) => {
    const now = new Date().toISOString();
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId && n.status === "unread"
          ? { ...n, status: "read" as const, readAt: now }
          : n,
      ),
    }));
  },

  markAllNotificationsRead: (recipientUserId) => {
    const now = new Date().toISOString();
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.recipientUserId === recipientUserId && n.status === "unread"
          ? { ...n, status: "read" as const, readAt: now }
          : n,
      ),
    }));
  },

  openNotification: (notificationId) => {
    const now = new Date().toISOString();
    set((state) => ({
      notifications: state.notifications.map((n) => {
        if (n.id !== notificationId || n.status === "actioned") return n;
        if (isNotificationActionedOnOpen(n)) {
          return {
            ...n,
            status: "actioned" as const,
            readAt: n.readAt || now,
            actionedAt: now,
          };
        }
        return n.status === "unread"
          ? { ...n, status: "read" as const, readAt: now }
          : n;
      }),
    }));
  },

  requestAssuranceSet: (input) => {
    const project = get().projects.find((p) => p.id === input.projectId);
    if (!project) {
      return { success: false, message: "Project not found." };
    }

    const assignee = get().users.find((u) => u.id === input.recipientUserId);
    if (!assignee) {
      return { success: false, message: "Recipient not found." };
    }

    const scopeOptions: ProjectAssetType[] = ['Vessel', 'Crew', 'Equipment'];
    const suggestedScopes = [
      ...new Set(
        (input.suggestedScopes ?? []).filter((scope): scope is ProjectAssetType =>
          scopeOptions.includes(scope),
        ),
      ),
    ];
    const suggestedAssets = (input.suggestedAssets ?? []).filter((asset) =>
      project.assetLinks.some(
        (link) => link.assetId === asset.assetId && link.assetType === asset.assetType,
      ),
    );
    const assetScopeTypes = [...new Set(suggestedAssets.map((asset) => asset.assetType))];
    const suggestedScope =
      suggestedScopes.length === 1
        ? suggestedScopes[0]
        : input.suggestedScope ||
          (assetScopeTypes.length === 1 ? assetScopeTypes[0] : undefined);

    const notificationId = get().pushNotification({
      type: "assurance_set_request",
      subject: assuranceInvitationSubject(project.name),
      message: input.message?.trim() || undefined,
      recipientUserId: assignee.id,
      senderUserId: input.senderUserId,
      senderName: input.senderName,
      projectId: project.id,
      projectName: project.name,
      request: {
        assigneeUserId: assignee.id,
        assigneeName: assignee.name,
        clientOrganization: getProjectClientOrganization(project),
        suggestedScope,
        suggestedScopes: suggestedScopes.length > 0 ? suggestedScopes : undefined,
        suggestedAssets: suggestedAssets.length > 0 ? suggestedAssets : undefined,
      },
    });
    if (!notificationId) {
      return { success: false, message: "Select a recipient other than yourself." };
    }

    get().logAuditEvent({
      action: "Requested Assurance Set",
      targetAsset: `${input.projectId} → ${input.recipientUserId}`,
      justificationNotes: input.message || "Assurance set request sent.",
    });

    return { success: true };
  },

  markNotificationActioned: (notificationId, assuranceSetId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId
          ? {
              ...n,
              status: "actioned" as const,
              readAt: n.readAt || new Date().toISOString(),
              actionedAt: new Date().toISOString(),
              request: n.request
                ? { ...n.request, createdAssuranceSetId: assuranceSetId }
                : n.request,
            }
          : n,
      ),
    }));
  },

  projects: MOCK_PROJECTS,
  addProject: (input) => {
    const existing = get().projects;
    const projectId = generateUniqueProjectId(existing);
    const persona = get().activePersona;
    const effectiveCharterer =
      input.charterer?.trim() || input.requestingOrganization;

    const crossOrgMissingAssurance = (input.assetLinks ?? []).filter(
      (link) =>
        requiresAssuranceSetForAssetLink(
          input.requestingOrganization,
          link.providerOrganization,
        ) && !link.assuranceSetId,
    );
    if (crossOrgMissingAssurance.length > 0) {
      return {
        success: false,
        message:
          "Cross-organization assets require an assurance set to be selected.",
      };
    }

    for (const link of input.assetLinks ?? []) {
      const linkedSet = get().assuranceSets.find(
        (s) => s.id === link.assuranceSetId,
      );
      const owner = linkedSet && getProjectForAssuranceSet(linkedSet, existing);
      if (owner) {
        return {
          success: false,
          message: `Assurance set ${link.assuranceSetId} already belongs to project ${owner.name}.`,
        };
      }
    }

    const assetLinks: ProjectAssetLink[] = (input.assetLinks ?? []).map(
      (link, idx) => ({
        ...link,
        id: `PAL-${Date.now()}-${idx}`,
        projectId,
        addedAt: new Date().toISOString(),
        addedByPersona: persona,
      }),
    );

    const clientOwnerOrg = effectiveCharterer;

    const projectDraft: Project = {
      id: projectId,
      name: input.name,
      projectType: input.projectType,
      requestingOrganization: input.requestingOrganization,
      clientOperator: input.clientOperator || clientOwnerOrg,
      ownerOrganization: clientOwnerOrg,
      location: input.location,
      description: input.description || "",
      charterer: input.charterer,
      routeDescription: input.routeDescription,
      riskProfile: input.riskProfile ?? null,
      charterWindowStart: input.charterWindowStart,
      charterWindowEnd: input.charterWindowEnd,
      status: "Composing",
      operatorOrganization: input.operatorOrganization,
      assetLinks,
      contractParties: input.contractParties,
      projectValue: input.projectValue ?? null,
      currency: input.currency,
      multiYearStart: input.multiYearStart,
      multiYearEnd: input.multiYearEnd,
      onHireDate: input.onHireDate,
      serviceProvider: input.serviceProvider,
      workOrderRef: input.workOrderRef,
      workLocationType: input.workLocationType,
      primaryVesselId: input.primaryVesselId,
    };

    const initialProjects = [...get().projects, projectDraft];
    const childSetIds = new Set(assetLinks.map((l) => l.assuranceSetId));
    const stampedSets = get().assuranceSets.map((s) =>
      childSetIds.has(s.id)
        ? { ...s, projectId, projectName: input.name }
        : s,
    );
    const syncedProjects = syncProjectFromAssuranceSets(
      projectId,
      initialProjects,
      stampedSets,
    );

    set({ projects: syncedProjects, assuranceSets: stampedSets });

    get().logAuditEvent({
      action: "Created Project Charter",
      targetAsset: `${projectId} (${input.name})`,
      justificationNotes: "Project charter created.",
    });

    return { success: true, projectId };
  },

  updateProject: (updatedProject) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p,
      ),
    }));
  },

  addAssetToProject: (projectId, linkInput) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return { success: false, message: "Project not found." };

    const duplicate = project.assetLinks.some(
      (l) =>
        l.assetType === linkInput.assetType && l.assetId === linkInput.assetId,
    );
    if (duplicate) {
      return {
        success: false,
        message: "This asset is already linked to the project.",
      };
    }

    const linkedSet = get().assuranceSets.find(
      (s) => s.id === linkInput.assuranceSetId,
    );
    const owner =
      linkedSet && getProjectForAssuranceSet(linkedSet, get().projects);
    if (owner && owner.id !== projectId) {
      return {
        success: false,
        message: `Assurance set ${linkInput.assuranceSetId} already belongs to project ${owner.name}.`,
      };
    }

    const link: ProjectAssetLink = {
      ...linkInput,
      id: `PAL-${Date.now()}`,
      projectId,
      addedAt: new Date().toISOString(),
      addedByPersona: get().activePersona,
    };

    const updatedProject: Project = {
      ...project,
      assetLinks: [...project.assetLinks.filter((l) => !(l.assetType === linkInput.assetType && l.assetId === linkInput.assetId)), link],
    };

    const updatedProjects = get().projects.map((p) =>
      p.id === projectId ? updatedProject : p,
    );

    const stampedSets = get().assuranceSets.map((s) =>
      s.id === link.assuranceSetId
        ? { ...s, projectId, projectName: project.name }
        : s,
    );

    const syncedProjects = syncProjectFromAssuranceSets(
      projectId,
      updatedProjects,
      stampedSets,
    );

    set({ projects: syncedProjects, assuranceSets: stampedSets });

    get().logAuditEvent({
      action: "Linked Asset to Project",
      targetAsset: `${projectId} ← ${link.assetName}`,
      justificationNotes: `Attached ${link.assuranceSetId} for ${link.assetType} asset.`,
    });

    return { success: true };
  },

  attachAssuranceSetToProject: (assuranceSetId, projectId) => {
    const target = get().assuranceSets.find((s) => s.id === assuranceSetId);
    if (!target) return { success: false, message: "Assurance set not found." };

    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return { success: false, message: "Project not found." };

    if (project.assetLinks.some((l) => l.assuranceSetId === assuranceSetId)) {
      return { success: true };
    }

    const draftLink = buildDraftAssetLinkFromAssuranceSet(
      target,
      get().vessels,
      get().crew,
      get().equipment,
    );
    if (!draftLink) {
      return {
        success: false,
        message: "This assurance set has no asset to add to the project.",
      };
    }

    /* Aurora and Endeavour are already on the LNG project for SS-01 and SS-02. A later set for the same vessel joins the project without a second asset row. */
    const assetAlreadyOnProject = project.assetLinks.some(
      (l) => l.assetType === draftLink.assetType && l.assetId === draftLink.assetId,
    );
    if (assetAlreadyOnProject) {
      const stampedSets = get().assuranceSets.map((s) =>
        s.id === assuranceSetId
          ? { ...s, projectId, projectName: project.name }
          : s,
      );
      const syncedProjects = syncProjectFromAssuranceSets(
        projectId,
        get().projects,
        stampedSets,
      );
      set({ projects: syncedProjects, assuranceSets: stampedSets });
      return { success: true };
    }

    return get().addAssetToProject(projectId, draftLink);
  },

  removeAssetFromProject: (projectId, linkId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;

    const removedSetId = project.assetLinks.find(
      (l) => l.id === linkId,
    )?.assuranceSetId;

    const updatedProject: Project = {
      ...project,
      assetLinks: project.assetLinks.filter((l) => l.id !== linkId),
    };

    const updatedProjects = get().projects.map((p) =>
      p.id === projectId ? updatedProject : p,
    );

    const releasedSets = get().assuranceSets.map((s) =>
      s.id === removedSetId && s.projectId === projectId
        ? { ...s, projectId: undefined, projectName: undefined }
        : s,
    );

    const syncedProjects = syncProjectFromAssuranceSets(
      projectId,
      updatedProjects,
      releasedSets,
    );

    set({ projects: syncedProjects, assuranceSets: releasedSets });
  },

  linkAssuranceSetToProjectAsset: (projectId, linkId, assuranceSetId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;

    const linkedSet = get().assuranceSets.find((s) => s.id === assuranceSetId);
    const owner =
      linkedSet && getProjectForAssuranceSet(linkedSet, get().projects);
    if (owner && owner.id !== projectId) return;

    const replacedSetId = project.assetLinks.find(
      (l) => l.id === linkId,
    )?.assuranceSetId;

    const updatedProject: Project = {
      ...project,
      assetLinks: project.assetLinks.map((l) =>
        l.id === linkId ? { ...l, assuranceSetId } : l,
      ),
    };

    const updatedProjects = get().projects.map((p) =>
      p.id === projectId ? updatedProject : p,
    );

    const restampedSets = get().assuranceSets.map((s) => {
      if (s.id === assuranceSetId) {
        return { ...s, projectId, projectName: project.name };
      }
      if (s.id === replacedSetId && s.projectId === projectId) {
        return { ...s, projectId: undefined, projectName: undefined };
      }
      return s;
    });

    const syncedProjects = syncProjectFromAssuranceSets(
      projectId,
      updatedProjects,
      restampedSets,
    );

    set({ projects: syncedProjects, assuranceSets: restampedSets });
  },

  syncProjectFromSets: (projectId) => {
    set({
      projects: syncProjectFromAssuranceSets(
        projectId,
        get().projects,
        get().assuranceSets,
      ),
    });
  },

  // Fleet Vessels
  vessels: MOCK_VESSELS,

  vesselStatusHistory: MOCK_VESSEL_STATUS_HISTORY,
  recordVesselStatusChange: (params) => {
    const now = params.effectiveFrom ?? new Date().toISOString();
    const activePersona = get().activePersona;
    const newEntry: VesselStatusHistoryEntry = {
      id: generateVesselStatusHistoryId(),
      vesselId: params.vesselId,
      dimension: params.dimension,
      previousValue: params.previousValue,
      newValue: params.newValue,
      effectiveFrom: now,
      changedAt: now,
      changedBy: params.changedBy ?? getSessionActor(get).userId,
      changedByRole: params.changedByRole ?? activePersona,
      notes: params.notes,
      source: params.source ?? "manual",
    };

    set((state) => ({
      vesselStatusHistory: [
        ...state.vesselStatusHistory.map((entry) =>
          entry.vesselId === params.vesselId &&
          entry.dimension === params.dimension &&
          !entry.effectiveTo
            ? { ...entry, effectiveTo: now }
            : entry,
        ),
        newEntry,
      ],
    }));
  },

  addVessel: (newVessel) => {
    const dupCheck = isDuplicateVessel(
      newVessel.imoNumber,
      newVessel.officialRegNumber,
      get().vessels,
    );
    if (dupCheck.isDuplicate) {
      return { success: false, message: dupCheck.reason };
    }

    const registeredAt = new Date().toISOString();
    const initialHistory = buildInitialVesselStatusHistoryEntries(
      newVessel,
      getSessionActor(get).userId,
      get().activePersona,
      registeredAt,
    );

    set((state) => ({
      vessels: [...state.vessels, newVessel],
      assuranceObjects: [...state.assuranceObjects, vesselToAssuranceObject(newVessel)],
      vesselStatusHistory: [...state.vesselStatusHistory, ...initialHistory],
    }));

    get().logAuditEvent({
      action: "Registered Unique Vessel Record",
      targetAsset: `${newVessel.name} (IMO ${newVessel.imoNumber})`,
      justificationNotes: `Registered vessel under ${newVessel.flagState} flag.`,
    });

    return { success: true, vesselId: newVessel.id };
  },

  updateVessel: (updatedVessel) => {
    const previousVessel = get().vessels.find((v) => v.id === updatedVessel.id);
    const statusChanges = previousVessel
      ? diffVesselStatusChanges(previousVessel, updatedVessel)
      : [];

    set((state) => ({
      vessels: state.vessels.map((v) =>
        v.id === updatedVessel.id ? updatedVessel : v,
      ),
      /* synchronize vessel name and imo across all linked assurance sets */
      assuranceSets: state.assuranceSets.map((s) =>
        s.vesselId === updatedVessel.id
          ? {
              ...s,
              vesselName: updatedVessel.name,
              imoNumber: updatedVessel.imoNumber,
            }
          : s,
      ),
      /* synchronize vessel attributes in linked master documents */
      documents: state.documents.map((d) =>
        d.vesselId === updatedVessel.id && d.vesselAttributes
          ? {
              ...d,
              vesselAttributes: {
                ...d.vesselAttributes,
                vesselName: updatedVessel.name,
                imoNumber: updatedVessel.imoNumber,
              },
            }
          : d,
      ),
    }));

    statusChanges.forEach((change) => {
      get().recordVesselStatusChange({
        vesselId: updatedVessel.id,
        dimension: change.dimension,
        previousValue: change.previousValue,
        newValue: change.newValue,
        source: "manual",
      });
    });

    get().logAuditEvent({
      action: "Updated Vessel Specifications",
      targetAsset: `${updatedVessel.name} (IMO ${updatedVessel.imoNumber})`,
      justificationNotes: `Updated vessel Information for ${updatedVessel.name}`,
    });
  },

  updateVesselStatus: (vesselId, status) => {
    const previousVessel = get().vessels.find((v) => v.id === vesselId);
    if (!previousVessel) return;

    const nextVessel = { ...previousVessel, status };
    const statusChanges = diffVesselStatusChanges(previousVessel, nextVessel);

    set((state) => ({
      vessels: state.vessels.map((v) => (v.id === vesselId ? nextVessel : v)),
    }));

    statusChanges.forEach((change) => {
      get().recordVesselStatusChange({
        vesselId,
        dimension: change.dimension,
        previousValue: change.previousValue,
        newValue: change.newValue,
        source: "manual",
      });
    });
  },

  updateVesselAvailability: (vesselId, availabilityStatus) => {
    const previousVessel = get().vessels.find((v) => v.id === vesselId);
    if (!previousVessel) return;

    const previousAvailability =
      previousVessel.availabilityStatus ??
      getTrackedVesselStatusValues(previousVessel).availability;

    if (previousAvailability === availabilityStatus) return;

    const now = new Date().toISOString();
    set((state) => ({
      vessels: state.vessels.map((v) =>
        v.id === vesselId
          ? { ...v, availabilityStatus, availabilityUpdatedAt: now }
          : v,
      ),
    }));

    get().recordVesselStatusChange({
      vesselId,
      dimension: "availability",
      previousValue: previousAvailability,
      newValue: availabilityStatus,
      source: "manual",
      effectiveFrom: now,
    });
  },

  equipment: MOCK_EQUIPMENT,
  addEquipment: (newEquipment) => {
    const dupCheck = isDuplicateEquipment(
      newEquipment.equipmentIdentifier,
      get().equipment,
    );
    if (dupCheck.isDuplicate) {
      return { success: false, message: dupCheck.reason };
    }
    set((state) => ({
      equipment: [...state.equipment, newEquipment],
      assuranceObjects: [...state.assuranceObjects, equipmentToAssuranceObject(newEquipment)],
    }));
    get().logAuditEvent({
      action: "Registered Equipment Asset",
      targetAsset: `${newEquipment.name} (${newEquipment.equipmentIdentifier})`,
      justificationNotes: `Registered equipment under category ${newEquipment.category}.`,
    });
    return { success: true, equipmentId: newEquipment.id };
  },

  updateEquipment: (updatedEquipment) => {
    set((state) => ({
      equipment: state.equipment.map((e) =>
        e.id === updatedEquipment.id ? updatedEquipment : e,
      ),
    }));
  },

  updateEquipmentAvailability: (equipmentId, availabilityStatus) => {
    const now = new Date().toISOString();
    set((state) => ({
      equipment: state.equipment.map((e) =>
        e.id === equipmentId
          ? { ...e, availabilityStatus, availabilityUpdatedAt: now }
          : e,
      ),
    }));
  },

  // Assurance Templates State (Dedicated Public Templates Slice)
  assuranceTemplates: MOCK_ASSURANCE_TEMPLATES,
  addAssuranceTemplate: (template) => {
    set((state) => {
      if (state.assuranceTemplates.some((t) => t.id === template.id)) {
        return {
          assuranceTemplates: state.assuranceTemplates.map((t) =>
            t.id === template.id ? template : t,
          ),
        };
      }
      return {
        assuranceTemplates: [template, ...state.assuranceTemplates],
      };
    });
  },
  updateAssuranceTemplate: (template) => {
    set((state) => ({
      assuranceTemplates: state.assuranceTemplates.map((t) =>
        t.id === template.id ? template : t,
      ),
    }));
  },

  // Assurance Objects State (ADR 0029)
  assuranceObjects: [
    ...MOCK_VESSELS.map(vesselToAssuranceObject),
    ...MOCK_CREW.map(crewToAssuranceObject),
    ...MOCK_EQUIPMENT.map(equipmentToAssuranceObject),
    ...SEEDED_OPERATIONAL_OBJECTS,
  ],
  registerAssuranceObject: (newObject: AssuranceObject) => {
    const existing = get().assuranceObjects;
    if (existing.some((o) => o.id === newObject.id)) {
      return { success: false, message: `Object with ID ${newObject.id} already exists.`, objectId: newObject.id };
    }
    set((state) => ({ assuranceObjects: [...state.assuranceObjects, newObject] }));
    get().logAuditEvent({
      action: "Registered Assurance Object",
      targetAsset: `${newObject.name} (${newObject.type})`,
      justificationNotes: `Registered assurance object owned by ${newObject.ownerOrganization}.`,
    });
    return { success: true, objectId: newObject.id };
  },
  addAssuranceObject: (newObject: AssuranceObject) => get().registerAssuranceObject(newObject),

  // Assurance Sets
  /* seeded approved and certified sets start with their document versions locked */
  assuranceSets: freezeClosedSetDocuments([...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS], MOCK_DOCUMENTS),
  addAssuranceSet: (newSet) => {
    const existingSets = get().assuranceSets;
    const titleCheck = isDuplicateCampaignTitle(
      newSet.title,
      existingSets,
      newSet.id,
    );
    if (titleCheck.isDuplicate) {
      console.warn(`[MAP Duplicate Guard] ${titleCheck.reason}`);
      return;
    }

    const uniqueId = existingSets.some((s) => s.id === newSet.id)
      ? generateUniqueAssuranceSetId(existingSets)
      : newSet.id || generateUniqueAssuranceSetId(existingSets);

    const state = get();
    const matchingVessel = state.vessels.find(
      (v) => v.id === newSet.vesselId || v.name === newSet.vesselName,
    );
    const autoAttachedRequirements = autoAttachDocumentsToRequirements(
      newSet.requirements || [],
      {
        documents: state.documents,
        vessel: matchingVessel,
        vessels: state.vessels,
        crew: state.crew,
        selectedCrewId: newSet.crewId,
        selectedCrewIds: getAssuranceSetCrewIds(newSet),
        equipment: state.equipment,
        selectedEquipmentId: newSet.equipmentId,
        selectedVesselId: newSet.vesselId,
        selectedActivityId: newSet.activityId,
        targetSubtype: newSet.assuranceType,
      },
    );

    const sanitizedRequirements = autoAttachedRequirements.map((r) => ({
      ...r,
      ocrConfidence:
        r.documentId || r.linkedDocumentId ? r.ocrConfidence || 95 : 0,
    }));

    /* a set covers exactly one asset: links and requirements of any other scope are dropped here */

    const computedSet = recalculateSetReadiness(
      toSingleAssetSet({
        ...newSet,
        id: uniqueId,
        stage: newSet.stage || "Initiated",
        requirements: sanitizedRequirements,
      }),
    );

    const allSets = [...get().assuranceSets, computedSet];
    const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
      syncAllAffectedProjectRollups(get().projects, allSets, [computedSet.id]);

    const pendingNotificationId =
      get().pendingAssuranceRequestNotificationId;
    if (
      pendingNotificationId &&
      computedSet.projectId &&
      get().notifications.some(
        (n) =>
          n.id === pendingNotificationId &&
          n.projectId === computedSet.projectId &&
          n.status !== "actioned",
      )
    ) {
      get().markNotificationActioned(pendingNotificationId, computedSet.id);
      set({ pendingAssuranceRequestNotificationId: undefined });
    }

    set({
      assuranceSets: syncedSets,
      projects: syncedProjects,
    });

    if (computedSet.visibility !== "draft") {
      notifyAssignedStakeholders(get, computedSet);
      get().raiseDocumentRenewalNotifications([computedSet.id]);
    }

    get().logAuditEvent({
      action: "Initiated Assurance Set",
      targetAsset: `${computedSet.id} (${computedSet.title})`,
      justificationNotes: `Created assurance set for vessel ${computedSet.vesselName}`,
    });
  },
  updateAssuranceSet: (updatedSet) => {
    const state = get();
    const matchingVessel = state.vessels.find(
      (v) => v.id === updatedSet.vesselId || v.name === updatedSet.vesselName,
    );
    const autoAttachedRequirements = autoAttachDocumentsToRequirements(
      updatedSet.requirements || [],
      {
        documents: state.documents,
        vessel: matchingVessel,
        vessels: state.vessels,
        crew: state.crew,
        selectedCrewId: updatedSet.crewId,
        selectedCrewIds: getAssuranceSetCrewIds(updatedSet),
        equipment: state.equipment,
        selectedEquipmentId: updatedSet.equipmentId,
        selectedVesselId: updatedSet.vesselId,
        selectedActivityId: updatedSet.activityId,
        targetSubtype: updatedSet.assuranceType,
      },
    );

    const sanitizedRequirements = autoAttachedRequirements.map((r) => ({
      ...r,
      ocrConfidence:
        r.documentId || r.linkedDocumentId ? r.ocrConfidence || 95 : 0,
    }));

    const computedSet = recalculateSetReadiness(
      toSingleAssetSet({
        ...updatedSet,
        targetDate: updatedSet.targetDate || updatedSet.complianceDeadline,
        datePermissionGrants: updatedSet.datePermissionGrants ?? state.assuranceSets.find((s) => s.id === updatedSet.id)?.datePermissionGrants ?? [],
        targetDateHistory: (() => {
          const prev = state.assuranceSets.find((s) => s.id === updatedSet.id);
          const resolved = updatedSet.targetDate || updatedSet.complianceDeadline;
          const prevDate = prev?.targetDate || prev?.complianceDeadline;
          let ledger = updatedSet.targetDateHistory ?? prev?.targetDateHistory ?? [];
          if (
            prev &&
            resolved &&
            prevDate &&
            prevDate !== resolved &&
            !ledger.some((h) => h.scope === "set" && h.newDate === resolved)
          ) {
            ledger = [
              ...ledger,
              {
                id: `TDC-${Date.now()}-set`,
                setId: updatedSet.id,
                scope: "set",
                targetType: "set",
                oldDate: prevDate,
                newDate: resolved,
                changedBy:
                  state.users.find((u) => u.id === state.activeSessionUserId)?.name ||
                  state.activePersona ||
                  "Client Admin",
                changedAt: new Date().toISOString(),
              },
            ];
          }
          return ledger;
        })(),
        requirements: sanitizedRequirements,
      }),
    );

    const updatedSets = state.assuranceSets.map((s) =>
      s.id === updatedSet.id ? computedSet : s,
    );

    const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
      syncAllAffectedProjectRollups(state.projects, updatedSets, [computedSet.id]);

    set({
      assuranceSets: syncedSets,
      projects: syncedProjects,
    });

    const previousSet = state.assuranceSets.find((s) => s.id === updatedSet.id);

    /* a draft that is initiated notifies its stakeholders for the first time */
    if (previousSet?.visibility === "draft" && computedSet.visibility !== "draft") {
      notifyAssignedStakeholders(get, computedSet);
      get().raiseDocumentRenewalNotifications([computedSet.id]);
    }

    /* date changes and task edits are recorded against the set the caller submitted */
    if (previousSet) {
      logAssuranceSetAuditDiff(get, previousSet, updatedSet);
    }
  },
  grantDatePermission: (setId, grantInput) => {
    set((state) => {
      const target = state.assuranceSets.find((s) => s.id === setId);
      if (!target) return state;
      const newGrant: DatePermissionGrant = {
        ...grantInput,
        id: `DPG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        grantedAt: new Date().toISOString(),
      };
      const updatedGrants = [...(target.datePermissionGrants || []), newGrant];
      const updatedSet: AssuranceSet = { ...target, datePermissionGrants: updatedGrants };
      return {
        assuranceSets: state.assuranceSets.map((s) => (s.id === setId ? updatedSet : s)),
      };
    });
    get().logAuditEvent({
      action: "Granted Date Permission",
      targetAsset: setId,
      justificationNotes: `Granted target date change permission to ${grantInput.userName}.`,
    });
  },
  revokeDatePermission: (setId, grantId) => {
    set((state) => {
      const target = state.assuranceSets.find((s) => s.id === setId);
      if (!target) return state;
      const updatedGrants = (target.datePermissionGrants || []).filter(
        (g) => g.id !== grantId && g.userId !== grantId,
      );
      const updatedSet: AssuranceSet = { ...target, datePermissionGrants: updatedGrants };
      return {
        assuranceSets: state.assuranceSets.map((s) => (s.id === setId ? updatedSet : s)),
      };
    });
    get().logAuditEvent({
      action: "Revoked Date Permission",
      targetAsset: setId,
      justificationNotes: `Revoked target date change permission ${grantId}.`,
    });
  },
  addAssuranceTask: (setId, taskInput) => {
    const state = get();
    const sessionUser = getSessionUserForPersona(
      state.activePersona,
      state.users,
      getDemoSessionContext(state),
    );
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) {
      return { success: false, message: "Assurance set not found." };
    }

    if (!isClientUser(sessionUser, setTarget, state.activePersona)) {
      return { success: false, message: "Vendor users cannot edit tasks. Only client users are authorized." };
    }

    if (isClosedAssuranceSet(setTarget) || setTarget.stage === "Cancelled") {
      return { success: false, message: "Tasks cannot be modified on a closed or cancelled assurance set." };
    }

    if (!taskInput.title?.trim() || !taskInput.category?.trim()) {
      return { success: false, message: "Task title and category are required." };
    }

    const newTaskId = taskInput.id || `REQ-TASK-${Date.now().toString().slice(-6)}`;
    const newRequirement: AssuranceRequirement = {
      id: newTaskId,
      category: taskInput.category,
      title: taskInput.title.trim(),
      description: taskInput.description?.trim() || "",
      isMandatory: taskInput.isMandatory !== undefined ? taskInput.isMandatory : true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: "Pending",
      targetDate: taskInput.targetDate || setTarget.targetDate || setTarget.complianceDeadline,
      assignedSubmitter: taskInput.assignedSubmitter || setTarget.assignedSubmitter,
      assignedVerifier: taskInput.assignedVerifier || setTarget.assignedVerifier,
      isSpecialized: taskInput.isSpecialized,
      isOtherDocument: taskInput.isOtherDocument,
      sectionId: taskInput.sectionId,
      predecessorId: taskInput.predecessorId,
      notes: taskInput.notes,
    };

    const updatedSet: AssuranceSet = {
      ...setTarget,
      requirements: [...setTarget.requirements, newRequirement],
    };

    get().updateAssuranceSet(updatedSet);

    return { success: true, requirement: newRequirement };
  },
  editAssuranceTask: (setId, taskId, taskUpdates) => {
    const state = get();
    const sessionUser = getSessionUserForPersona(
      state.activePersona,
      state.users,
      getDemoSessionContext(state),
    );
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) {
      return { success: false, message: "Assurance set not found." };
    }

    if (!isClientUser(sessionUser, setTarget, state.activePersona)) {
      return { success: false, message: "Vendor users cannot edit tasks. Only client users are authorized." };
    }

    if (isClosedAssuranceSet(setTarget) || setTarget.stage === "Cancelled") {
      return { success: false, message: "Tasks cannot be modified on a closed or cancelled assurance set." };
    }

    const taskIndex = setTarget.requirements.findIndex((r) => r.id === taskId);
    if (taskIndex === -1) {
      return { success: false, message: "Task not found on this assurance set." };
    }

    const previousTask = setTarget.requirements[taskIndex];
    const updatedTask: AssuranceRequirement = {
      ...previousTask,
      ...taskUpdates,
      id: taskId,
    };

    const updatedReqs = [...setTarget.requirements];
    updatedReqs[taskIndex] = updatedTask;

    const updatedSet: AssuranceSet = {
      ...setTarget,
      requirements: updatedReqs,
    };

    get().updateAssuranceSet(updatedSet);

    return { success: true };
  },
  removeAssuranceTask: (setId, taskId) => {
    const state = get();
    const sessionUser = getSessionUserForPersona(
      state.activePersona,
      state.users,
      getDemoSessionContext(state),
    );
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) {
      return { success: false, message: "Assurance set not found." };
    }

    if (!isClientUser(sessionUser, setTarget, state.activePersona)) {
      return { success: false, message: "Vendor users cannot edit tasks. Only client users are authorized." };
    }

    if (isClosedAssuranceSet(setTarget) || setTarget.stage === "Cancelled") {
      return { success: false, message: "Tasks cannot be modified on a closed or cancelled assurance set." };
    }

    const exists = setTarget.requirements.some((r) => r.id === taskId);
    if (!exists) {
      return { success: false, message: "Task not found on this assurance set." };
    }

    const updatedReqs = setTarget.requirements.filter((r) => r.id !== taskId);
    const updatedSet: AssuranceSet = {
      ...setTarget,
      requirements: updatedReqs,
    };

    get().updateAssuranceSet(updatedSet);

    return { success: true };
  },
  updateTaskTargetDate: (setId, taskId, targetDate, actorName, reason) => {
    const state = get();
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    const setDeadline = setTarget.targetDate || setTarget.complianceDeadline || "";
    if (setDeadline && targetDate > setDeadline) {
      return { success: false, message: "Task target date cannot be after the assurance set target date." };
    }
    const task = setTarget.requirements.find((r) => r.id === taskId);
    if (!task) return { success: false, message: "Task requirement not found." };

    const oldDate = task.targetDate || "—";
    const updatedRequirements = setTarget.requirements.map((r) =>
      r.id === taskId ? { ...r, targetDate } : r,
    );
    const historyRow: TargetDateChangeRecord = {
      id: `TDC-${Date.now()}-${taskId}`,
      setId,
      taskId,
      taskTitle: task.title,
      scope: "task",
      targetType: "task",
      requirementId: taskId,
      oldDate,
      newDate: targetDate,
      changedBy: actorName,
      changedAt: new Date().toISOString(),
      reason: reason || undefined,
    };
    const updatedSet: AssuranceSet = {
      ...setTarget,
      requirements: updatedRequirements,
      targetDateHistory: [...(setTarget.targetDateHistory || []), historyRow],
    };
    get().updateAssuranceSet(updatedSet);
    raiseTargetDateNotices(get, updatedSet, {
      scope: "task",
      taskId,
      taskTitle: task.title,
      oldDate,
      newDate: targetDate,
    });
    return { success: true };
  },
  reviseAssuranceSetDeadline: (setId, revisedDate, actorName, reason) => {
    const state = get();
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    const oldDeadline = setTarget.revisedCompletionDate || setTarget.targetDate || setTarget.complianceDeadline || "—";
    const historyRow: TargetDateChangeRecord = {
      id: `TDC-${Date.now()}-set`,
      setId,
      scope: "set",
      targetType: "set",
      oldDate: oldDeadline,
      newDate: revisedDate,
      changedBy: actorName,
      changedAt: new Date().toISOString(),
      reason: reason || undefined,
    };
    const updatedSet: AssuranceSet = {
      ...setTarget,
      revisedCompletionDate: revisedDate,
      targetDate: revisedDate,
      targetDateHistory: [...(setTarget.targetDateHistory || []), historyRow],
    };
    get().updateAssuranceSet(updatedSet);
    raiseTargetDateNotices(get, updatedSet, {
      scope: "set",
      oldDate: oldDeadline,
      newDate: revisedDate,
    });
    get().logAuditEvent({
      action: "Revised Completion Date",
      targetAsset: setId,
      justificationNotes: `Revised completion date from ${oldDeadline} to ${revisedDate} by ${actorName}.${reason ? ` Reason: ${reason}` : ""}`,
    });
    return { success: true };
  },
  exemptAssuranceTasks: (setId, taskIds, reason, grantedBy, newDate) => {
    const state = get();
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    const now = new Date().toISOString();
    const historyRows: TargetDateChangeRecord[] = [];
    const updatedRequirements = setTarget.requirements.map((r) => {
      if (!taskIds.includes(r.id)) return r;
      const oldDate = r.targetDate || "—";
      historyRows.push({
        id: `TDC-${Date.now()}-${r.id}`,
        setId,
        taskId: r.id,
        taskTitle: r.title,
        scope: "task",
        targetType: "task",
        requirementId: r.id,
        oldDate,
        newDate,
        changedBy: grantedBy,
        changedAt: now,
        reason: `Exemption: ${reason}`,
      });
      return {
        ...r,
        targetDate: newDate,
        exemption: {
          reason,
          grantedBy,
          newDate,
          grantedAt: now,
        },
      };
    });
    const updatedSet: AssuranceSet = {
      ...setTarget,
      requirements: updatedRequirements,
      targetDateHistory: [...(setTarget.targetDateHistory || []), ...historyRows],
    };
    get().updateAssuranceSet(updatedSet);
    get().logAuditEvent({
      action: "Exempted Tasks",
      targetAsset: setId,
      justificationNotes: `Exempted ${taskIds.length} task(s) until ${newDate} by ${grantedBy}. Reason: ${reason}`,
    });
    return { success: true };
  },
  partiallyCloseAssuranceSet: (setId, actorName, notes) => {
    const state = get();
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    const now = new Date().toISOString();
    const updatedSet: AssuranceSet = {
      ...setTarget,
      stage: "Approved",
      closureType: "partial",
      lockedAt: setTarget.lockedAt || now,
      partiallyClosedAt: now,
      approverDecision: "Approved",
      approverNotes: notes || `Partially closed by ${actorName}. Exempted tasks remain open.`,
    };
    get().updateAssuranceSet(updatedSet);
    get().logAuditEvent({
      action: "Partial Closure",
      targetAsset: setId,
      justificationNotes: notes || `Assurance set ${setId} partially closed by ${actorName}. Exempted tasks remain open.`,
    });
    return { success: true };
  },
  cancelAssuranceSet: (setId, actorName, reason) => {
    const state = get();
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    const now = new Date().toISOString();
    const updatedSet: AssuranceSet = {
      ...setTarget,
      stage: "Cancelled",
      cancelledAt: now,
      cancellationReason: reason,
    };
    get().updateAssuranceSet(updatedSet);
    get().logAuditEvent({
      action: "Cancelled Assurance Set",
      targetAsset: setId,
      justificationNotes: `Assurance set ${setId} cancelled by ${actorName}.${reason ? ` Reason: ${reason}` : ""}`,
    });
    return { success: true };
  },
  updateAssuranceStage: (setId, stage) => {
    /* explicit manual override: the chosen stage is kept and only the readiness index is recalculated */
    const updatedSets = get().assuranceSets.map((s) => {
      if (s.id !== setId) return s;
      const staged: AssuranceSet = { ...s, stage };
      return { ...staged, readinessScore: calculateAssuranceSetReadiness(staged) };
    });

    const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
      syncAllAffectedProjectRollups(get().projects, updatedSets, [setId]);

    set({
      assuranceSets: syncedSets,
      projects: syncedProjects,
    });
  },
  updateAssuranceStakeholder: (setId, role, assigneeName) => {
    const assuranceSet = get().assuranceSets.find((s) => s.id === setId);
    if (!assuranceSet) {
      return { success: false, message: "Assurance set not found." };
    }

    const persona = get().activePersona;
    if (!canEditAssuranceSetStakeholders(assuranceSet, persona)) {
      return {
        success: false,
        message:
          getAssuranceSetStakeholderLockReason(assuranceSet) ||
          "Stakeholder assignments cannot be changed for this campaign.",
      };
    }

    const validation = validateStakeholderAssignmentForSet(
      assuranceSet,
      role,
      assigneeName,
      get().users,
    );
    if (!validation.ok) {
      return { success: false, message: validation.message };
    }

    set((state) => ({
      assuranceSets: state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        if (role === "Submitter") {
          return { ...s, assignedSubmitter: assigneeName };
        }
        if (role === "Verifier") {
          return {
            ...s,
            assignedVerifier: assigneeName,
            verificationRequired: true,
          };
        }
        if (role === "Inspector") {
          return {
            ...s,
            assignedInspector: assigneeName,
            mandatoryInspectionRequired: true,
          };
        }
        if (role === "Approver") {
          return {
            ...s,
            assignedApprover: assigneeName,
            formalApprovalRequired: true,
          };
        }
        return s;
      }),
    }));
    get().logAuditEvent({
      action: `Assigned Vessel ${role}`,
      targetAsset: `${setId} · ${assigneeName}`,
      justificationNotes: `Assigned ${role.toLowerCase()} ${assigneeName} to assurance campaign ${setId}`,
    });
    notifyAssuranceSetUser(get, assuranceSet, assigneeName, {
      type: "stakeholder_assigned",
      subject: assuranceInvitationSubject(assuranceSet.title),
      assignedRole: role,
    });
    return { success: true };
  },
  updateAssuranceInspector: (setId, inspectorName) => {
    get().updateAssuranceStakeholder(setId, "Inspector", inspectorName);
  },
  completeVesselInspection: (vesselName, outcome) => {
    /* a failed inspection completes nothing; the sets stay at the inspection stage */
    if (outcome === "Fail") return [];

    const name = vesselName.trim().toLowerCase();
    /* only sets waiting on the inspection move on: inspection required, not yet completed, every document verified */
    const completedIds = get()
      .assuranceSets.filter(
        (s) =>
          s.vesselName?.trim().toLowerCase() === name &&
          s.mandatoryInspectionRequired &&
          !s.inspectionCompleted &&
          s.stage === "Inspection",
      )
      .map((s) => s.id);
    if (completedIds.length === 0) return [];

    set((state) => {
      const updatedSets = state.assuranceSets.map((s) =>
        completedIds.includes(s.id)
          ? recalculateSetReadiness({ ...s, inspectionCompleted: true })
          : s,
      );
      const { updatedProjects, updatedAssuranceSets } =
        syncAllAffectedProjectRollups(state.projects, updatedSets, completedIds);
      return { assuranceSets: updatedAssuranceSets, projects: updatedProjects };
    });

    /* a set that has just reached the approval stage goes to its approver */
    get()
      .assuranceSets.filter((s) => completedIds.includes(s.id) && s.stage === "Approval")
      .forEach((s) => {
        notifyAssuranceSetUser(get, s, s.assignedApprover, {
          type: "approval_requested",
          subject: `Approval requested: ${s.title}`,
        });
      });

    return completedIds;
  },
  updateRequirementStatus: (setId, reqId, status, notes) => {
    const reviewedAt = new Date().toISOString();
    const reviewerId = getSessionActor(get).userId;

    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        const updatedReqs = s.requirements.map((r) => {
          if (r.id === reqId) {
            /* a verified requirement records the exact version it was verified against */
            return stampReviewedVersion(
              {
                ...r,
                verifierStatus: status,
                notes: notes || r.notes,
                isFulfilled: status === "Verified",
              },
              s,
              findRequirementDocument(r, state.documents),
              reviewedAt,
              reviewerId,
            );
          }
          return r;
        });
        const allVerified =
          updatedReqs.length > 0 &&
          updatedReqs.every(
            (r) =>
              Boolean(r.documentId || r.linkedDocumentId || r.isFulfilled) &&
              (r.verifierStatus === "Verified" ||
                s.verificationRequired === false ||
                r.isFulfilled),
          );

        /* a verifier routing a requirement to the inspector makes the inspection mandatory; the stage itself is derived */
        const routedToInspector = updatedReqs.some((r) => r.verificationRoute === "Inspector");
        const denial = status === "Correction Requested" || status === "Rejected";
        const keepClosed = isClosedAssuranceSet(s) && !denial;

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          mandatoryInspectionRequired: s.mandatoryInspectionRequired || routedToInspector,
          inspectionCompleted: keepClosed ? s.inspectionCompleted : routedToInspector ? false : s.inspectionCompleted,
          approverDecision: keepClosed
            ? s.approverDecision
            : allVerified
              ? s.formalApprovalRequired !== false
                ? "Pending"
                : "Approved"
              : status === "Verified"
                ? s.approverDecision
                : status === "Correction Requested"
                  ? "Returned for Correction"
                  : "Rejected",
        };

        return syncDocumentVersionLock(recalculateSetReadiness(candidateSet), state.documents, reviewedAt);
      });

      /* the decision stays on this requirement; the shared library document keeps no verification status */
      const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
        syncAllAffectedProjectRollups(state.projects, updatedSets, [setId]);

      return {
        assuranceSets: syncedSets,
        projects: syncedProjects,
      };
    });

    const isDenial = status === "Correction Requested" || status === "Rejected";
    const actionTag = isDenial ? " [PING: SUBMITTER ACTION REQUIRED]" : "";
    get().logAuditEvent({
      action: `Requirement Verification: ${status}${actionTag}`,
      targetAsset: `${setId} / Requirement ${reqId}`,
      justificationNotes:
        notes ||
        `Verifier status set to ${status}${isDenial ? " — Submitter revision required." : ""}`,
    });
  },
  denyRequirementByApprover: (setId, reqId, decision, notes) => {
    let requirementTitle = reqId;

    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;

        const updatedReqs = s.requirements.map((r) => {
          if (r.id === reqId) {
            requirementTitle = r.title;
            return {
              ...r,
              verifierStatus: decision,
              isFulfilled: false,
              notes:
                notes || `Executive Approver returned document as ${decision}.`,
            };
          }
          return r;
        });

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          approverDecision:
            decision === "Correction Requested"
              ? "Returned for Correction"
              : "Rejected",
          approverNotes: notes,
        };

        return recalculateSetReadiness(candidateSet);
      });

      /* the denial stays on this requirement; the shared library document and other sets are not touched */
      const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
        syncAllAffectedProjectRollups(state.projects, updatedSets, [setId]);

      return {
        assuranceSets: syncedSets,
        projects: syncedProjects,
      };
    });

    get().logAuditEvent({
      action: `Approver Denied Verified Document [PING: SUBMITTER ACTION REQUIRED]`,
      targetAsset: `${setId} / ${requirementTitle}`,
      justificationNotes: `Approver denied verified document (${decision}): ${notes || "Revision requested from submitter."}`,
    });
  },
  setApproverDecision: (setId, decision, notes) => {
    const isDenial =
      decision === "Returned for Correction" || decision === "Rejected";
    const mappedStatus: "Correction Requested" | "Rejected" =
      decision === "Returned for Correction"
        ? "Correction Requested"
        : "Rejected";

    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        const updatedReqs: AssuranceRequirement[] = isDenial
          ? s.requirements.map((r) => {
              return {
                ...r,
                verifierStatus: mappedStatus,
                isFulfilled: false,
                verifiedVersion: undefined,
                notes:
                  notes ||
                  `Campaign returned to verification stage by Executive Approver.`,
              };
            })
          : s.requirements;

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          approverDecision: decision,
          approverNotes: notes,
        };
        /* an approval locks the exact document versions the set was approved against */
        return syncDocumentVersionLock(recalculateSetReadiness(candidateSet), state.documents, new Date().toISOString());
      });

      /* a denial stays on this set's requirements; shared library documents and other sets keep their own decisions */
      const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
        syncAllAffectedProjectRollups(state.projects, updatedSets, [setId]);

      return {
        assuranceSets: syncedSets,
        projects: syncedProjects,
      };
    });

    const pingTag = isDenial ? " [PING: SUBMITTER ACTION REQUIRED]" : "";
    get().logAuditEvent({
      action: `Approver Final Decision: ${decision}${pingTag}`,
      targetAsset: `Assurance Set ${setId}`,
      justificationNotes:
        notes ||
        `Executive decision: ${decision}${isDenial ? " — Submitter revision ping dispatched." : ""}`,
    });

    const decidedSet = get().assuranceSets.find((s) => s.id === setId);
    if (decidedSet) {
      notifyAssuranceSetUser(
        get,
        decidedSet,
        getAssuranceSetCreator(decidedSet, get().users).name,
        {
          type: "approval_decision",
          subject: `${decision === "Returned for Correction" ? "Returned for correction" : decision}: ${decidedSet.title}`,
          message: notes?.trim() || undefined,
        },
      );
    }
  },

  sendAssuranceForReview: (setId) => {
    const now = new Date().toISOString();
    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        /* sending for review records the client workflow state; the pipeline stage follows the evidence */
        return recalculateSetReadiness({
          ...s,
          clientWorkflowStage: "in_review" as const,
          sentForReviewAt: now,
        });
      });

      const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
        syncAllAffectedProjectRollups(state.projects, updatedSets, [setId]);

      return {
        assuranceSets: syncedSets,
        projects: syncedProjects,
      };
    });
    get().logAuditEvent({
      action: "Client Sent Campaign for Review",
      targetAsset: `Assurance Set ${setId}`,
      justificationNotes:
        "Campaign submitted to verification / review workflow. Documents are read-only for client.",
    });

    const reviewSet = get().assuranceSets.find((s) => s.id === setId);
    if (reviewSet) {
      notifyAssuranceSetUser(get, reviewSet, reviewSet.assignedVerifier, {
        type: "review_requested",
        subject: `Review requested: ${reviewSet.title}`,
      });
    }
  },

  setClientApproval: (setId, decision, notes) => {
    get().setApproverDecision(setId, decision, notes);
    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        const workflowStage =
          decision === "Approved"
            ? ("approved" as const)
            : decision === "Returned for Correction"
              ? ("in_review" as const)
              : ("pending_approval" as const);
        return {
          ...s,
          clientWorkflowStage: workflowStage,
        };
      });

      const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
        syncAllAffectedProjectRollups(state.projects, updatedSets, [setId]);

      return {
        assuranceSets: syncedSets,
        projects: syncedProjects,
      };
    });
    get().logAuditEvent({
      action: `Client Campaign Decision: ${decision}`,
      targetAsset: `Assurance Set ${setId}`,
      justificationNotes: notes || `Client sign-off: ${decision}`,
    });
  },

  // Documents
  documents: MOCK_DOCUMENTS,
  addDocument: (doc) => {
    /* the validation rules run on upload, so the reviewer sees results, not "not checked" */
    set((state) => ({ documents: [...state.documents, withDocumentChecks(doc, state.vessels)] }));
    get().logAuditEvent({
      action: "Uploaded New Master Document",
      targetAsset: `${doc.id} (${doc.title})`,
      justificationNotes: `Uploaded certificate ${doc.certificateNo}`,
    });
  },
  linkDocumentToVessel: (docId, vesselId, vesselName, imoNumber) => {
    set((state) => ({
      documents: state.documents.map((d) => {
        if (d.id !== docId) return d;
        return {
          ...d,
          vesselId,
          vesselAttributes: d.vesselAttributes
            ? {
                ...d.vesselAttributes,
                vesselName: vesselName || d.vesselAttributes.vesselName,
                imoNumber: imoNumber || d.vesselAttributes.imoNumber,
              }
            : undefined,
        };
      }),
    }));
  },
  uploadDocumentForRequirement: (setId, requirementId, doc, inspectionReport) => {
    /* the document this upload replaces on the requirement, if any */
    const replacedDocumentId = get()
      .assuranceSets.find((s) => s.id === setId)
      ?.requirements.find((r) => r.id === requirementId)?.documentId;
    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;

        let updatedReqs = [...s.requirements];
        const targetReqExists = requirementId
          ? updatedReqs.some((r) => r.id === requirementId)
          : false;

        if (targetReqExists) {
          updatedReqs = updatedReqs.map((r) => {
            if (r.id !== requirementId) return r;
            return {
              ...r,
              documentId: doc.id,
              documentVersion: doc.currentVersion,
              verifierStatus: "Pending" as const,
              isFulfilled: false,
              ocrConfidence: doc.ocrConfidence,
              inspectionReport: inspectionReport ?? r.inspectionReport,
              notes: `Upload linked to requirement (${doc.versions[0]?.fileName || doc.title}).`,
            };
          });
        } else {
          const newReq: AssuranceRequirement = {
            id: `req-other-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            category:
              doc.entityType === "Crew Certificate"
                ? "Crew Credential"
                : "Statutory Certificate",
            title: doc.title,
            isMandatory: false,
            isFulfilled: false,
            ocrConfidence: doc.ocrConfidence || 99,
            documentId: doc.id,
            documentVersion: doc.currentVersion || "v1.0",
            verifierStatus: "Pending",
            isOtherDocument: true,
            notes: `Uploaded additional document (${doc.versions?.[0]?.fileName || doc.title}).`,
          };
          updatedReqs.push(newReq);
        }

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
        };

        return recalculateSetReadiness(candidateSet);
      });

      const updatedDocs = state.documents.some((d) => d.id === doc.id)
        ? state.documents
        : [...state.documents, withDocumentChecks(doc, state.vessels)];

      const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
        syncAllAffectedProjectRollups(state.projects, updatedSets, [setId]);

      return {
        documents: updatedDocs,
        assuranceSets: syncedSets,
        projects: syncedProjects,
      };
    });

    get().logAuditEvent({
      action: "Uploaded Document for Assurance Requirement",
      targetAsset: `${doc.id} -> ${setId} / ${requirementId || "Other Documents"}`,
      justificationNotes: `Upload: ${doc.title} (${doc.certificateNo}) queued for verifier review.`,
    });

    /* a submitted document goes straight to the set's verifier, when one is appointed */
    notifySubmittedForReview(get, setId, requirementId, doc.id);

    /* the upload answers the renewals of the document it replaces; the new document is then checked in turn */
    closeDocumentRenewalNotifications(set, replacedDocumentId, setId);
    get().raiseDocumentRenewalNotifications([setId]);
  },
  addDocumentVersion: (
    docId,
    newVersionLabel,
    fileName,
    fileSizeBytes,
    changeSummary,
    expiryDate,
    scope,
  ) => {
    /* open sets that use the document but were not the one the version was submitted for */
    const noticeSetIds: string[] = [];
    set((state) => {
      const updatedDocs = state.documents.map((d) => {
        if (d.id !== docId) return d;
        const newVersionObj = {
          versionLabel: newVersionLabel,
          uploadedAt: new Date().toISOString(),
          uploadedBy: getSessionActor(get).userId,
          fileSizeBytes,
          fileName,
          changeSummary,
        };
        /* the new version's expiry replaces the old one everywhere it is shown, and the rules run again on it */
        return withDocumentChecks(
          {
            ...d,
            ...(expiryDate
              ? {
                expiryDate,
                complianceState: getComplianceStateForExpiry(expiryDate),
                vesselAttributes: d.vesselAttributes
                  ? { ...d.vesselAttributes, expiryDate, status: getComplianceStateForExpiry(expiryDate) }
                  : undefined,
                crewAttributes: d.crewAttributes ? { ...d.crewAttributes, expiryDate } : undefined,
              }
              : {}),
            currentVersion: newVersionLabel,
            ocrConfidence: 98,
            verificationStatus: "Pending" as const,
            versions: [newVersionObj, ...d.versions],
          },
          state.vessels,
        );
      });
      const updatedSets = state.assuranceSets.map((s) => {
        /* a new version of a shared library document must not reopen a set that is already approved */
        if (isClosedAssuranceSet(s)) return s;
        let hasMatchedReq = false;
        const updatedReqs = s.requirements.map((r) => {
          const usesDocument = r.documentId === docId || r.linkedDocumentId === docId;
          /* only the requirement the version was submitted for goes back to Pending; with no scope, every open use does */
          const isSubmittedRequirement = scope
            ? s.id === scope.assuranceSetId && r.id === scope.requirementId
            : usesDocument;
          if (!isSubmittedRequirement && usesDocument && !noticeSetIds.includes(s.id)) {
            noticeSetIds.push(s.id);
          }
          if (isSubmittedRequirement) {
            hasMatchedReq = true;
            return {
              ...r,
              documentId: docId,
              documentVersion: newVersionLabel,
              verifiedVersion: undefined,
              verifierStatus: "Pending" as const,
              isFulfilled: false,
              ocrConfidence: 98,
              notes:
                changeSummary ||
                `Replacement revision ${newVersionLabel} uploaded by submitter.`,
            };
          }
          return r;
        });

        if (!hasMatchedReq) return s;

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
        };

        return recalculateSetReadiness(candidateSet);
      });

      return {
        documents: updatedDocs,
        assuranceSets: updatedSets,
      };
    });

    get().logAuditEvent({
      action: `Uploaded Document Revision ${newVersionLabel}`,
      targetAsset: `Document ${docId}`,
      justificationNotes: changeSummary,
    });

    /* the version submitted for one requirement goes back to that set's verifier */
    if (scope) notifySubmittedForReview(get, scope.assuranceSetId, scope.requirementId, docId);

    /* other open sets keep the version they reviewed; their verifier is told a newer one exists */
    const versionedDoc = get().documents.find((d) => d.id === docId);
    noticeSetIds.forEach((noticeSetId) => {
      const noticeSet = get().assuranceSets.find((s) => s.id === noticeSetId);
      if (!noticeSet) return;
      notifyAssuranceSetUser(get, noticeSet, noticeSet.assignedVerifier, {
        type: "document_new_version",
        subject: `New version ${newVersionLabel} available: ${versionedDoc?.title || docId}`,
        message: "This set keeps its own decision on the version it reviewed.",
        documentId: docId,
      });
    });

    /* a new version answers every open renewal of the document */
    closeDocumentRenewalNotifications(set, docId);

    /* a new expiry date is checked in turn on the sets that hold the document */
    if (expiryDate) {
      const setIds = get()
        .assuranceSets.filter((s) =>
          s.requirements.some((r) => r.documentId === docId || r.linkedDocumentId === docId),
        )
        .map((s) => s.id);
      if (setIds.length > 0) get().raiseDocumentRenewalNotifications(setIds);
    }
  },
  verifyDocument: (docId, status, notes, routeTarget, requirementId, assuranceSetId, review) => {
    const setsBeforeVerification = get().assuranceSets;
    const reviewedAt = new Date().toISOString();
    const reviewerId = getSessionActor(get).userId;
    /* a decision belongs to one requirement on one set; without a requirement nothing on any set changes */
    const reviewedSetId = requirementId
      ? assuranceSetId ||
        setsBeforeVerification.find((s) => s.requirements.some((r) => r.id === requirementId))?.id
      : undefined;
    set((state) => {
      /* the library document is only "on file"; its status is not a verification decision */
      const updatedDocs = state.documents;
      const targetDoc = updatedDocs.find((d) => d.id === docId);

      const updatedSets = state.assuranceSets.map((s) => {
        const denial = status === "Correction Requested" || status === "Rejected";
        if (!reviewedSetId || s.id !== reviewedSetId) return s;

        let hasMatchedReq = false;

        const updatedReqs = s.requirements.map((r) => {
          if (r.id === requirementId) {
            hasMatchedReq = true;
            /* a verified requirement records the exact version it was verified against */
            return stampReviewedVersion(
              {
                ...r,
                documentId: docId,
                verifierStatus: status,
                isFulfilled: status === "Verified",
                ocrConfidence: targetDoc?.ocrConfidence || 98,
                notes: notes || r.notes,
                verificationRoute:
                  status === "Verified" && routeTarget
                    ? routeTarget
                    : r.verificationRoute,
                /* the method and any override belong to a verification; a return or rejection clears them */
                verificationMethod: status === "Verified" ? review?.verificationMethod : undefined,
                overrideReason: status === "Verified" ? review?.overrideReason?.trim() || undefined : undefined,
                verificationReference: status === "Verified" ? review?.verificationReference?.trim() || undefined : undefined,
                verificationResultSummary: status === "Verified" ? review?.verificationResultSummary?.trim() || undefined : undefined,
              },
              s,
              targetDoc,
              reviewedAt,
              reviewerId,
            );
          }
          return r;
        });

        if (!hasMatchedReq) return s;

        const allVerified =
          updatedReqs.length > 0 &&
          updatedReqs.every(
            (r) =>
              r.verifierStatus === "Verified" ||
              s.verificationRequired === false,
          );

        /* a verifier routing a requirement to the inspector makes the inspection mandatory; the stage itself is derived */
        const routedToInspector = updatedReqs.some((r) => r.verificationRoute === "Inspector");
        const keepClosed = isClosedAssuranceSet(s) && !denial;

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          mandatoryInspectionRequired: keepClosed
            ? s.mandatoryInspectionRequired
            : s.mandatoryInspectionRequired || routedToInspector,
          inspectionCompleted: keepClosed
            ? s.inspectionCompleted
            : routedToInspector
              ? false
              : s.inspectionCompleted,
          approverDecision: keepClosed
            ? s.approverDecision
            : allVerified
              ? s.formalApprovalRequired !== false
                ? "Pending"
                : "Approved"
              : status === "Verified"
                ? s.approverDecision
                : status === "Correction Requested"
                  ? "Returned for Correction"
                  : "Rejected",
        };

        return syncDocumentVersionLock(recalculateSetReadiness(candidateSet), updatedDocs, reviewedAt);
      });

      return {
        documents: updatedDocs,
        assuranceSets: updatedSets,
      };
    });

    const isDenial = status === "Correction Requested" || status === "Rejected";
    const pingTag = isDenial ? " [PING: SUBMITTER ACTION REQUIRED]" : "";
    const routeNote = routeTarget ? ` | Routed to ${routeTarget}` : "";
    const methodNote = status === "Verified" && review?.verificationMethod ? ` | Method: ${review.verificationMethod}` : "";
    const overrideNote = status === "Verified" && review?.overrideReason?.trim() ? ` | Override: ${review.overrideReason.trim()}` : "";
    const activePersona = get().activePersona;
    get().logAuditEvent({
      action: `${activePersona === "Approver" ? "Approver" : "Verifier"} Document Action: ${status}${pingTag}`,
      targetAsset: reviewedSetId ? `Document ${docId} -> ${reviewedSetId} / ${requirementId}` : `Document ${docId}`,
      justificationNotes: `${notes || `Verification status updated to ${status}`}${routeNote}${methodNote}${overrideNote}${isDenial ? " — Submitter revision required." : ""}`,
    });

    const verifiedDoc = get().documents.find((d) => d.id === docId);
    get().assuranceSets.forEach((s) => {
      if (s.id !== reviewedSetId) return;

      /* a denied document goes back to the submitter, or to the set creator when no submitter is named */
      if (isDenial) {
        const submitter = resolveNotificationRecipient(s.assignedSubmitter, get().users);
        notifyAssuranceSetUser(
          get,
          s,
          submitter ? s.assignedSubmitter : getAssuranceSetCreator(s, get().users).name,
          {
            type: "document_correction",
            subject: `${status === "Rejected" ? "Rejected" : "Correction requested"}: ${verifiedDoc?.title || docId}`,
            message: notes?.trim() || undefined,
            documentId: docId,
          },
        );
      }

      /* a set that has just reached the approval stage goes to its approver */
      const previousStage = setsBeforeVerification.find((prev) => prev.id === s.id)?.stage;
      if (s.stage === "Approval" && previousStage !== "Approval") {
        notifyAssuranceSetUser(get, s, s.assignedApprover, {
          type: "approval_requested",
          subject: `Approval requested: ${s.title}`,
        });
      }
    });
  },

  // Audit Events
  auditEvents: MOCK_AUDIT_TRAIL,
  logAuditEvent: (eventData) => {
    const actor = getSessionActor(get);
    const newEvent = withStructuredAuditTarget({
      id: `MAP-AUD-2026-EVNT-${String(Math.floor(100 + Math.random() * 90000)).padStart(5, "0")}`,
      timestampUtc: new Date().toISOString(),
      ...eventData,
      ...actor,
    });
    set((state) => ({ auditEvents: [newEvent, ...state.auditEvents] }));
  },
  logExport: ({ screen, format, setId, detail }) => {
    get().logAuditEvent({
      action: "Exported data",
      targetAsset: screen,
      target: { kind: "set", setId: setId || "multiple" },
      justificationNotes: `${format} export. ${detail}`,
    });
  },

  /* user management store state and actions */
  users: MOCK_USERS,
  addUser: (newUser) => {
    const activePersona = get().activePersona;
    const preparedUser: UserProfile = {
      ...newUser,
      createdBy: newUser.createdBy || activePersona,
      invitedBy:
        newUser.invitedBy ||
        (newUser.status === "Pending Invitation" ? activePersona : undefined),
    };
    set((state) => ({ users: [preparedUser, ...state.users] }));
    get().logAuditEvent({
      action: `Provisioned New User Profile (${preparedUser.userType})`,
      targetAsset: `${preparedUser.name} (${preparedUser.email})`,
      justificationNotes: `Added ${preparedUser.userType} user assigned as ${preparedUser.roles.join(", ")} for ${preparedUser.organization}.`,
    });
  },
  updateUser: (updatedUser) => {
    set((state) => ({
      users: state.users.map((u) =>
        u.id === updatedUser.id ? updatedUser : u,
      ),
    }));
    get().logAuditEvent({
      action: "Updated User Profile",
      targetAsset: `${updatedUser.name} (${updatedUser.email})`,
      justificationNotes: `Updated user profile for ${updatedUser.name} (${updatedUser.roles.join(", ")}, ${updatedUser.userType}).`,
    });
  },
  updateUserStatus: (userId, status) => {
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, status } : u)),
    }));
  },

  rolePermissionDefaults: BRD_PERMISSION_DEFAULTS,
  userPermissionOverrides: {},
  customRoles: [],
  customScopes: [],
  customCategories: [],
  setRolePermissionFlag: (role, scopeKey, action, value) => {
    const guarded = applyPermissionGuards(
      scopeKey,
      role,
      {
        ...(get().rolePermissionDefaults[role]?.[scopeKey] ?? emptyCrud()),
        [action]: value,
      },
      get().customScopes,
    );
    set((state) => ({
      rolePermissionDefaults: {
        ...state.rolePermissionDefaults,
        [role]: {
          ...state.rolePermissionDefaults[role],
          [scopeKey]: guarded,
        },
      },
    }));
    const scopeLabel =
      [...PERMISSION_SCOPE_CATALOG, ...get().customScopes].find(
        (s) => s.key === scopeKey,
      )?.label ?? scopeKey;
    get().logAuditEvent({
      action: "Updated Role Permission Default",
      targetAsset: `${role} · ${scopeLabel} · ${action}`,
      justificationNotes: `Set ${action} to ${value ? "allowed" : "denied"} for role ${role} on "${scopeLabel}".`,
    });
  },
  commitRolePermissionDefaults: (matrix) => {
    set({ rolePermissionDefaults: matrix });
    get().logAuditEvent({
      action: "Saved Role Permission Defaults",
      targetAsset: "Role Rights Matrix",
      justificationNotes:
        "Administrator committed role-default permission changes.",
    });
  },
  commitUserPermissionOverrides: (overrides) => {
    set({ userPermissionOverrides: overrides });
    get().logAuditEvent({
      action: "Saved User Permission Overrides",
      targetAsset: "User Rights Matrix",
      justificationNotes:
        "Administrator committed per-user permission overrides.",
    });
  },
  resetRolePermissionsToBrd: () => {
    set({
      rolePermissionDefaults: buildBrdRolePermissionDefaults(),
      userPermissionOverrides: {},
      customRoles: [],
      customScopes: [],
      customCategories: [],
    });
    get().logAuditEvent({
      action: "Reset Role Permissions to BRD Defaults",
      targetAsset: "Role Rights Matrix",
      justificationNotes:
        "Restored BRD-seeded CRUD defaults and cleared custom roles/scopes/categories/overrides.",
    });
  },
  setUserPermissionOverride: (userId, scopeKey, action, value) => {
    set((state) => {
      const userOverrides = {
        ...(state.userPermissionOverrides[userId] || {}),
      };
      const scopePatch = {
        ...(userOverrides[scopeKey] || {}),
        [action]: value,
      };
      userOverrides[scopeKey] = scopePatch;
      return {
        userPermissionOverrides: {
          ...state.userPermissionOverrides,
          [userId]: userOverrides,
        },
      };
    });
    const scopeLabel =
      [...PERMISSION_SCOPE_CATALOG, ...get().customScopes].find(
        (s) => s.key === scopeKey,
      )?.label ?? scopeKey;
    const userName = get().users.find((u) => u.id === userId)?.name ?? userId;
    get().logAuditEvent({
      action: "Updated User Permission Override",
      targetAsset: `${userName} · ${scopeLabel} · ${action}`,
      justificationNotes: `Override ${action}=${value} for ${userName} on "${scopeLabel}".`,
    });
  },
  clearUserPermissionOverrides: (userId) => {
    set((state) => {
      const next = { ...state.userPermissionOverrides };
      delete next[userId];
      return { userPermissionOverrides: next };
    });
    get().logAuditEvent({
      action: "Cleared User Permission Overrides",
      targetAsset: userId,
      justificationNotes: `Restored user ${userId} to role-default permissions.`,
    });
  },
  addCustomRole: (roleName) => {
    const name = roleName.trim();
    if (!name) return { success: false, message: "Role name is required." };
    const existing = [...ALL_ROLE_PERSONAS, ...get().customRoles];
    if (existing.some((r) => r.toLowerCase() === name.toLowerCase())) {
      return {
        success: false,
        message: "A role with this name already exists.",
      };
    }
    const catalog = [...PERMISSION_SCOPE_CATALOG, ...get().customScopes];
    set((state) => ({
      customRoles: [...state.customRoles, name],
      rolePermissionDefaults: {
        ...state.rolePermissionDefaults,
        [name]: buildEmptyFlagsForCatalog(catalog),
      },
    }));
    get().logAuditEvent({
      action: "Created Custom Role",
      targetAsset: name,
      justificationNotes: `Added custom role "${name}" with empty CRUD defaults.`,
    });
    return { success: true };
  },
  addCustomCategory: (categoryName) => {
    const name = categoryName.trim();
    if (!name) return { success: false, message: "Category name is required." };
    const existing = [
      ...BUILTIN_PERMISSION_CATEGORIES,
      ...get().customCategories,
    ];
    if (existing.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return {
        success: false,
        message: "A category with this name already exists.",
      };
    }
    set((state) => ({
      customCategories: [...state.customCategories, name],
    }));
    get().logAuditEvent({
      action: "Created Permission Category",
      targetAsset: name,
      justificationNotes: `Added permission category "${name}".`,
    });
    return { success: true };
  },
  addCustomScope: ({ label, description, category }) => {
    const trimmed = label.trim();
    if (!trimmed)
      return { success: false, message: "Name is required." };
    const categoryName = category.trim();
    if (!categoryName)
      return { success: false, message: "Category is required." };

    let key = `custom_${slugifyPermissionKey(trimmed)}`;
    const allKeys = new Set([
      ...PERMISSION_SCOPE_CATALOG.map((s) => s.key),
      ...get().customScopes.map((s) => s.key),
    ]);
    if (allKeys.has(key)) key = `${key}_${Date.now()}`;

    const def: PermissionScopeDefinition = {
      key,
      label: trimmed,
      description:
        description.trim() || "Feature scope added by administrator.",
      category: categoryName,
      isCustom: true,
    };

    set((state) => {
      const nextMatrix: RolePermissionMatrix = {
        ...state.rolePermissionDefaults,
      };
      for (const role of Object.keys(nextMatrix)) {
        nextMatrix[role] = {
          ...nextMatrix[role],
          [key]: emptyCrud(),
        };
      }
      const cats = state.customCategories;
      const known =
        BUILTIN_PERMISSION_CATEGORIES.some(
          (c) => c.toLowerCase() === categoryName.toLowerCase(),
        ) || cats.some((c) => c.toLowerCase() === categoryName.toLowerCase());
      return {
        customScopes: [...state.customScopes, def],
        rolePermissionDefaults: nextMatrix,
        customCategories: known ? cats : [...cats, categoryName],
      };
    });
    get().logAuditEvent({
      action: "Created Custom Permission Scope",
      targetAsset: trimmed,
      justificationNotes: `Added permission "${trimmed}" under category "${categoryName}".`,
    });
    return { success: true, key };
  },

  // Crew Directory
  crew: MOCK_CREW,
  addCrewMember: (newCrew) => {
    const activePersona = get().activePersona;
    /* convert all layer 1 and layer 2 certificates attached to new crew into MasterDocument entries */
    const allCrewDocs = [
      ...newCrew.layer1CoreDocuments,
      ...newCrew.layer2Endorsements,
    ];
    const newMasterDocs: MasterDocument[] = allCrewDocs.map((doc) => {
      const isExpired =
        doc.verificationStatus === "Expired" ||
        new Date(doc.expiryDate).getTime() < Date.now();
      return {
        id: doc.id,
        title: `${doc.title} — ${newCrew.fullName}`,
        entityType: "Crew Certificate",
        vesselId: newCrew.currentVesselId || "",
        certificateNo: doc.certificateNo,
        issuingAuthority: doc.issuingAuthority,
        expiryDate: doc.expiryDate,
        ocrConfidence: 98.5,
        complianceState: isExpired
          ? "Expired"
          : doc.verificationStatus === "Expiring"
            ? "Expiring < 6 Mos"
            : "Valid",
        currentVersion: "v1.0",
        versions: [
          {
            versionLabel: "v1.0",
            uploadedAt: new Date().toISOString(),
            uploadedBy: activePersona || "Crewing Administrator",
            fileSizeBytes: doc.fileSizeBytes || 1500000,
            fileName:
              doc.fileName ||
              `${doc.title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
            changeSummary: `Uploaded ${doc.layer} certificate for STCW compliance tracking.`,
          },
        ],
        crewAttributes: {
          crewName: newCrew.fullName,
          passportId: newCrew.passportNo,
          rank: newCrew.rank,
          certType: doc.stcwRegulation || doc.title,
          issuingCenter: doc.issuingAuthority,
          issueDate: doc.issueDate,
          expiryDate: doc.expiryDate,
          assignedVessel: newCrew.currentVesselName || "",
          nationality: newCrew.nationality,
          trainingDate: doc.issueDate,
          ocrConfidence: 98.5,
        },
        validationRules: {
          charterBufferPassed: !isExpired,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: !isExpired,
          exceptionDetails: isExpired
            ? `Certificate expired on ${doc.expiryDate}. Immediate renewal required.`
            : undefined,
        },
        /* an uploaded crew document waits for a verifier; it is never verified on upload (gap review E3) */
        verificationStatus: isExpired ? "Correction Requested" : "Pending",
        verificationNotes: isExpired
          ? "Expired certificate. Please upload updated renewal scan."
          : undefined,
      };
    });

    set((state) => {
      const existingDocIds = new Set(state.documents.map((d) => d.id));
      const filteredNewDocs = newMasterDocs.filter(
        (d) => !existingDocIds.has(d.id),
      );
      return {
        crew: [newCrew, ...state.crew],
        assuranceObjects: [...state.assuranceObjects, crewToAssuranceObject(newCrew)],
        documents: [...filteredNewDocs, ...state.documents],
      };
    });

    get().logAuditEvent({
      action: "Registered Crew Member",
      targetAsset: `${newCrew.fullName} (${newCrew.rank})`,
      justificationNotes: `Registered crew member with Seaman's Book ${newCrew.seamansBookNo}`,
    });
  },
  updateCrewMember: (updatedCrew) => {
    set((state) => ({
      crew: state.crew.map((c) => (c.id === updatedCrew.id ? updatedCrew : c)),
    }));
    get().logAuditEvent({
      action: "Updated Seafarer Profile",
      targetAsset: `${updatedCrew.fullName} (${updatedCrew.id})`,
      justificationNotes: `Updated profile details and photo gallery for ${updatedCrew.fullName}.`,
    });
  },
  assignCrewToVessel: (crewId, vesselId) => {
    const vessel = get().vessels.find((v) => v.id === vesselId);
    set((state) => {
      const targetCrew = state.crew.find((c) => c.id === crewId);
      const crewName = targetCrew?.fullName;
      const updatedCrew = state.crew.map((c) => {
        if (c.id !== crewId) return c;
        const today = new Date().toISOString().split("T")[0];
        if (!vesselId) {
          return {
            ...c,
            currentVesselId: undefined,
            currentVesselName: undefined,
            assignments: (c.assignments || []).map((assignment) =>
              assignment.isCurrent
                ? { ...assignment, isCurrent: false, disembarkDate: assignment.disembarkDate || today }
                : assignment,
            ),
          };
        }
        const existingAssignments = c.assignments || [];
        const newAssignment = {
          id: `MAP-ASG-2026-ASGN-${String(Math.floor(100 + Math.random() * 90000)).padStart(5, "0")}`,
          vesselId: vessel!.id,
          vesselName: vessel!.name,
          imoNumber: vessel!.imoNumber,
          vesselType: vessel!.classificationSociety
            ? `${vessel!.classificationSociety} Vessel`
            : "Offshore Support Vessel",
          rankHeld: c.rank,
          embarkDate: today,
          isCurrent: true,
        };
        const updatedAssignments = [
          newAssignment,
          ...existingAssignments.map((assignment) =>
            assignment.isCurrent
              ? { ...assignment, isCurrent: false, disembarkDate: assignment.disembarkDate || today }
              : assignment,
          ),
        ];
        return {
          ...c,
          currentVesselId: vessel!.id,
          currentVesselName: `${vessel!.name} (IMO ${vessel!.imoNumber})`,
          assignments: updatedAssignments,
        };
      });

      /* update corresponding documents in document library with new vessel association */
      const updatedDocuments = state.documents.map((d) => {
        if (
          d.entityType === "Crew Certificate" &&
          d.crewAttributes?.crewName === crewName
        ) {
          return {
            ...d,
            vesselId: vesselId || "",
            crewAttributes: d.crewAttributes
              ? {
                  ...d.crewAttributes,
                  assignedVessel: vessel
                    ? `${vessel.name} (IMO ${vessel.imoNumber})`
                    : "",
                }
              : undefined,
          };
        }
        return d;
      });

      return {
        crew: updatedCrew,
        documents: updatedDocuments,
        assuranceObjects: state.assuranceObjects.map((object) => {
          const member = updatedCrew.find((person) => person.id === object.id);
          if (!member || object.type !== "person") return object;
          return { ...object, assignments: personObjectAssignments(member) };
        }),
      };
    });

    get().logAuditEvent({
      action: "Updated Crew Vessel Assignment",
      targetAsset: `Crew ${crewId}`,
      justificationNotes: vesselId
        ? `Assigned crew ${crewId} to vessel ${vessel?.name}`
        : `Unassigned crew ${crewId}`,
    });
  },
  assignPersonToObject: (personId, input) => {
    const startDate = input.startDate.trim();
    const endDate = input.endDate?.trim() || undefined;
    if (!startDate) return { success: false, message: "A start date is required." };
    if (endDate && endDate < startDate) {
      return { success: false, message: "The end date must be on or after the start date." };
    }
    const person = get().assuranceObjects.find((object) => object.id === personId && object.type === "person");
    if (!person) return { success: false, message: "That person is not an assurance object." };
    const today = new Date().toISOString().split("T")[0];
    const isCurrent = !endDate || endDate >= today;
    const assignmentId = `ASG-OBJ-${Date.now()}`;
    const nextAssignment = {
      id: assignmentId,
      targetObjectId: input.targetObjectId,
      targetObjectType: input.targetObjectType,
      targetName: input.targetName,
      startDate,
      endDate,
      isCurrent,
      role: input.role,
    };
    const vessel = input.targetObjectType === "vessel"
      ? get().vessels.find((item) => item.id === input.targetObjectId)
      : undefined;

    set((state) => {
      const crew = state.crew.map((member) => {
        if (member.id !== personId) return member;
        const closed = (member.assignments || []).map((assignment) =>
          assignment.isCurrent && isCurrent
            ? { ...assignment, isCurrent: false, disembarkDate: assignment.disembarkDate || startDate }
            : assignment,
        );
        const objectAssignments = [
          nextAssignment,
          ...(member.objectAssignments ?? []).map((assignment) =>
            assignment.isCurrent && isCurrent ? { ...assignment, isCurrent: false, endDate: assignment.endDate || startDate } : assignment,
          ),
        ];
        if (input.targetObjectType !== "vessel" || !vessel) {
          return {
            ...member,
            currentVesselId: isCurrent ? undefined : member.currentVesselId,
            currentVesselName: isCurrent ? undefined : member.currentVesselName,
            assignments: isCurrent ? closed : member.assignments,
            objectAssignments,
          };
        }
        return {
          ...member,
          currentVesselId: isCurrent ? vessel.id : member.currentVesselId,
          currentVesselName: isCurrent ? `${vessel.name} (IMO ${vessel.imoNumber})` : member.currentVesselName,
          assignments: [
            {
              id: assignmentId,
              vesselId: vessel.id,
              vesselName: vessel.name,
              imoNumber: vessel.imoNumber,
              vesselType: vessel.vesselType || "Vessel",
              rankHeld: input.role || member.rank,
              embarkDate: startDate,
              disembarkDate: endDate,
              isCurrent,
            },
            ...closed,
          ],
          objectAssignments: (member.objectAssignments ?? []).map((assignment) =>
            assignment.isCurrent && isCurrent ? { ...assignment, isCurrent: false, endDate: assignment.endDate || startDate } : assignment,
          ),
        };
      });
      return {
        crew,
        assuranceObjects: state.assuranceObjects.map((object) => {
          if (object.id !== personId) return object;
          const member = crew.find((person) => person.id === personId);
          return member
            ? { ...object, assignments: personObjectAssignments(member) }
            : object;
        }),
      };
    });

    get().logAuditEvent({
      action: "Updated Crew Vessel Assignment",
      targetAsset: `${person.name} → ${input.targetName}`,
      justificationNotes: `Assigned ${person.name} to ${input.targetName} from ${startDate}${endDate ? ` to ${endDate}` : ""}.`,
    });
    return { success: true };
  },
  addCrewDocument: (crewId, doc) => {
    const targetCrew = get().crew.find((c) => c.id === crewId);
    const activePersona = get().activePersona;
    const isExpired =
      doc.verificationStatus === "Expired" ||
      new Date(doc.expiryDate).getTime() < Date.now();
    const newMasterDoc: MasterDocument = {
      id: doc.id,
      title: targetCrew ? `${doc.title} — ${targetCrew.fullName}` : doc.title,
      entityType: "Crew Certificate",
      vesselId: targetCrew?.currentVesselId || "",
      certificateNo: doc.certificateNo,
      issuingAuthority: doc.issuingAuthority,
      expiryDate: doc.expiryDate,
      ocrConfidence: 98.5,
      complianceState: isExpired
        ? "Expired"
        : doc.verificationStatus === "Expiring"
          ? "Expiring < 6 Mos"
          : "Valid",
      currentVersion: "v1.0",
      versions: [
        {
          versionLabel: "v1.0",
          uploadedAt: new Date().toISOString(),
          uploadedBy: activePersona || "Crewing Administrator",
          fileSizeBytes: doc.fileSizeBytes || 1500000,
          fileName:
            doc.fileName ||
            `${doc.title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
          changeSummary: `Uploaded ${doc.layer} certificate for STCW compliance tracking.`,
        },
      ],
      crewAttributes: targetCrew
        ? {
            crewName: targetCrew.fullName,
            passportId: targetCrew.passportNo,
            rank: targetCrew.rank,
            certType: doc.stcwRegulation || doc.title,
            issuingCenter: doc.issuingAuthority,
            issueDate: doc.issueDate,
            expiryDate: doc.expiryDate,
            assignedVessel: targetCrew.currentVesselName || "",
            nationality: targetCrew.nationality,
            trainingDate: doc.issueDate,
            ocrConfidence: 98.5,
          }
        : undefined,
      validationRules: {
        charterBufferPassed: !isExpired,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: !isExpired,
        exceptionDetails: isExpired
          ? `Certificate expired on ${doc.expiryDate}. Immediate renewal required.`
          : undefined,
      },
      /* an uploaded crew document waits for a verifier; it is never verified on upload (gap review E3) */
      verificationStatus: isExpired ? "Correction Requested" : "Pending",
      verificationNotes: isExpired
        ? "Expired certificate. Please upload updated renewal scan."
        : undefined,
    };

    /* an upload is never a verification: a document sent in as Verified is stored as Pending */
    const storedDoc: STCWDocumentItem =
      doc.verificationStatus === "Verified" ? { ...doc, verificationStatus: "Pending" } : doc;

    set((state) => ({
      crew: state.crew.map((c) => {
        if (c.id !== crewId) return c;
        const isLayer1 = doc.layer === "Layer 1 - Universal Core";
        const updatedL1 = isLayer1
          ? [storedDoc, ...c.layer1CoreDocuments]
          : c.layer1CoreDocuments;
        const updatedL2 = !isLayer1
          ? [storedDoc, ...c.layer2Endorsements]
          : c.layer2Endorsements;
        return {
          ...c,
          layer1CoreDocuments: updatedL1,
          layer2Endorsements: updatedL2,
          lastAuditedDate: new Date().toISOString().split("T")[0],
        };
      }),
      documents: [
        newMasterDoc,
        ...state.documents.filter((d) => d.id !== doc.id),
      ],
    }));

    get().logAuditEvent({
      action: `Uploaded Crew STCW Document (${doc.title})`,
      targetAsset: `Crew ${crewId} / ${doc.certificateNo}`,
      justificationNotes: `Uploaded ${doc.layer} certificate for STCW compliance tracking.`,
    });
  },
  updateCrewDocument: (crewId, doc) => {
    const targetCrew = get().crew.find((c) => c.id === crewId);
    const activePersona = get().activePersona;
    const isExpired =
      doc.verificationStatus === "Expired" ||
      new Date(doc.expiryDate).getTime() < Date.now();

    set((state) => {
      const updatedCrew = state.crew.map((c) => {
        if (c.id !== crewId) return c;
        const filteredL1 = c.layer1CoreDocuments.filter((d) => d.id !== doc.id);
        const filteredL2 = c.layer2Endorsements.filter((d) => d.id !== doc.id);
        const isLayer1 = doc.layer === "Layer 1 - Universal Core";
        const updatedL1 = isLayer1 ? [doc, ...filteredL1] : filteredL1;
        const updatedL2 = !isLayer1 ? [doc, ...filteredL2] : filteredL2;
        return {
          ...c,
          layer1CoreDocuments: updatedL1,
          layer2Endorsements: updatedL2,
          lastAuditedDate: new Date().toISOString().split("T")[0],
        };
      });

      const existingDoc = state.documents.find((d) => d.id === doc.id);
      const updatedDocuments = existingDoc
        ? state.documents.map((d) => {
            if (d.id !== doc.id) return d;
            return {
              ...d,
              title: targetCrew
                ? `${doc.title} — ${targetCrew.fullName}`
                : doc.title,
              certificateNo: doc.certificateNo,
              issuingAuthority: doc.issuingAuthority,
              expiryDate: doc.expiryDate,
              complianceState: isExpired
                ? ("Expired" as const)
                : doc.verificationStatus === "Expiring"
                  ? ("Expiring < 6 Mos" as const)
                  : ("Valid" as const),
              verificationStatus: isExpired
                ? ("Correction Requested" as const)
                : ("Pending" as const),
              versions: [
                {
                  versionLabel: `v${d.versions.length + 1}.0`,
                  uploadedAt: new Date().toISOString(),
                  uploadedBy: activePersona || "Crewing Administrator",
                  fileSizeBytes: doc.fileSizeBytes || 1500000,
                  fileName:
                    doc.fileName ||
                    d.versions[0]?.fileName ||
                    "updated_cert.pdf",
                  changeSummary: `Reuploaded / updated ${doc.layer} certificate.`,
                },
                ...d.versions,
              ],
            };
          })
        : [
            {
              id: doc.id,
              title: targetCrew
                ? `${doc.title} — ${targetCrew.fullName}`
                : doc.title,
              entityType: "Crew Certificate" as const,
              vesselId: targetCrew?.currentVesselId || "",
              certificateNo: doc.certificateNo,
              issuingAuthority: doc.issuingAuthority,
              expiryDate: doc.expiryDate,
              ocrConfidence: 98.5,
              complianceState: isExpired
                ? ("Expired" as const)
                : ("Valid" as const),
              currentVersion: "v1.0",
              versions: [
                {
                  versionLabel: "v1.0",
                  uploadedAt: new Date().toISOString(),
                  uploadedBy: activePersona || "Crewing Administrator",
                  fileSizeBytes: doc.fileSizeBytes || 1500000,
                  fileName: doc.fileName || "cert.pdf",
                  changeSummary: `Uploaded ${doc.layer} certificate.`,
                },
              ],
              crewAttributes: targetCrew
                ? {
                    crewName: targetCrew.fullName,
                    passportId: targetCrew.passportNo,
                    rank: targetCrew.rank,
                    certType: doc.stcwRegulation || doc.title,
                    issuingCenter: doc.issuingAuthority,
                    issueDate: doc.issueDate,
                    expiryDate: doc.expiryDate,
                    assignedVessel: targetCrew.currentVesselName || "",
                    nationality: targetCrew.nationality,
                    trainingDate: doc.issueDate,
                    ocrConfidence: 98.5,
                  }
                : undefined,
              validationRules: {
                charterBufferPassed: !isExpired,
                assetMatch100Percent: true,
                iacsAuthorityValid: true,
                overallValid: !isExpired,
              },
              verificationStatus: isExpired
                ? ("Correction Requested" as const)
                : ("Pending" as const),
            },
            ...state.documents,
          ];

      return {
        crew: updatedCrew,
        documents: updatedDocuments,
      };
    });

    get().logAuditEvent({
      action: `Updated / Reuploaded Crew STCW Document (${doc.title})`,
      targetAsset: `Crew ${crewId} / ${doc.certificateNo}`,
      justificationNotes: `Reuploaded / updated ${doc.layer} certificate status (${doc.verificationStatus}), expiry date ${doc.expiryDate}.`,
    });
  },
  deleteCrewDocument: (crewId, docId) => {
    set((state) => ({
      crew: state.crew.map((c) => {
        if (c.id !== crewId) return c;
        const updatedL1 = c.layer1CoreDocuments.filter((d) => d.id !== docId);
        const updatedL2 = c.layer2Endorsements.filter((d) => d.id !== docId);
        return {
          ...c,
          layer1CoreDocuments: updatedL1,
          layer2Endorsements: updatedL2,
          lastAuditedDate: new Date().toISOString().split("T")[0],
        };
      }),
      documents: state.documents.filter((d) => d.id !== docId),
    }));
    get().logAuditEvent({
      action: "Deleted Crew STCW Document",
      targetAsset: `Crew ${crewId} / Doc ${docId}`,
      justificationNotes: "Removed STCW certificate record from crew profile.",
    });
  },

  isAuditDrawerOpen: false,
  setAuditDrawerOpen: (open) => set({ isAuditDrawerOpen: open }),

  // CAPA Management Store Implementation
  capaItems: MOCK_CAPA_ITEMS,
  addCapaItem: (capa) =>
    set((state) => ({ capaItems: [capa, ...state.capaItems] })),
  updateCapaStatus: (capaId, status, inspectorNotes) => {
    const current = get().capaItems.find((item) => item.id === capaId);
    if (!current) return;
    const closing = status === "Verified & Closed" && current.status !== "Verified & Closed";
    const closedDate =
      status === "Verified & Closed"
        ? closing
          ? new Date().toISOString()
          : current.closedDate
        : undefined;
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? {
              ...item,
              status,
              closedDate,
              inspectorNotes:
                inspectorNotes !== undefined
                  ? inspectorNotes
                  : item.inspectorNotes,
              lastInspectedDate: new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
            }
          : item,
      ),
    }));
    if (closing && closedDate) {
      const relatedSet = get().assuranceSets.find(
        (s) => s.vesselId === current.vesselId || s.vesselName === current.vesselName,
      );
      get().logAuditEvent({
        action: "Closed finding",
        targetAsset: `${current.id} · ${current.title}`,
        target: {
          kind: "date",
          setId: relatedSet?.id || "unscoped",
          dateField: "closedDate",
        },
        fieldDelta: {
          fieldName: auditDateFieldLabel("closedDate"),
          oldValue: "—",
          newValue: closedDate,
        },
        justificationNotes: `Finding ${current.id} was closed.`,
      });
    }
  },
  addCapaEvidence: (capaId, evidence) => {
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? { ...item, evidences: [...item.evidences, evidence] }
          : item,
      ),
    }));
  },
  removeCapaEvidence: (capaId, evidenceId) => {
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? {
              ...item,
              evidences: item.evidences.filter((ev) => ev.id !== evidenceId),
            }
          : item,
      ),
    }));
  },
  flagCapaForReinspection: (capaId, reason) => {
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? {
              ...item,
              status: "Under Re-Inspection",
              closedDate: undefined,
              flaggedForReinspection: true,
              cadminFlagReason:
                reason?.trim() ||
                "Re-inspection requested by C Admin charterer",
              flaggedByCAdminDate: new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
            }
          : item,
      ),
    }));
    get().logAuditEvent({
      action: `Flagged CAPA (${capaId}) for Re-Inspection`,
      targetAsset: `CAPA ${capaId}`,
      justificationNotes:
        reason || "C Admin requested re-inspection verification by inspector",
    });

    const capa = get().capaItems.find((item) => item.id === capaId);
    if (capa) {
      /* the inspector is the one assigned on an assurance set for the same vessel */
      const inspectedSet = get().assuranceSets.find(
        (s) =>
          (s.vesselId === capa.vesselId || s.vesselName === capa.vesselName) &&
          Boolean(resolveNotificationRecipient(s.assignedInspector, get().users)),
      );
      if (inspectedSet) {
        notifyAssuranceSetUser(get, inspectedSet, inspectedSet.assignedInspector, {
          type: "capa_reinspection",
          subject: `Re-inspection requested: ${capa.id}`,
          message: reason?.trim() || undefined,
          capaId: capa.id,
          vesselName: capa.vesselName,
        });
      }
    }
  },
}));
