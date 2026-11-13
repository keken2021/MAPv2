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
  TenantCustomSection,
  SetMemberExclusion,
} from "../types/assurance";
import { MasterDocument } from "../types/document";
import {
  canEditOwnedEvidence,
  canOfferEvidenceReuse,
  isReusableLibraryDocument,
  EVIDENCE_NOT_OWNED_EDIT,
  EVIDENCE_REUSE_VENDOR_ONLY,
} from "../utils/documentOwnershipHelpers";
import {
  MOCK_VESSELS,
  MOCK_ASSURANCE_SETS,
  MOCK_ASSURANCE_TEMPLATES,
  MOCK_DOCUMENTS,
  MOCK_AUDIT_TRAIL,
  MOCK_USERS,
} from "./mockData";
import { SEEDED_AUDIT_EVENTS } from "./auditMockData";
import { MOCK_EQUIPMENT } from "./equipmentMockData";
import { MOCK_CREW, MOCK_CREW_GROUPS } from "./crewMockData";
import { OIL_CO_PILOT_ASSURANCE_OBJECTS } from "./oilCoLngPilotMockData";
import {
  isDuplicateVessel,
  isDuplicateEquipment,
  isDuplicateCampaignTitle,
  generateUniqueAssuranceSetId,
} from "../utils/validation";
import { isInspectionDue } from "../utils/inspectionTask";
import {
  canEditAssuranceSetStakeholders,
  getAssuranceSetCreator,
  findAssuranceSetCreatorUser,
  getAssuranceSetRoleActions,
  getAssuranceSetStakeholderLockReason,
  isAssuranceSetAssignedToPersona,
  isVesselOwnedByClientOrg,
  isViewAccessibleToPersona,
  isClientUser,
  orgFieldMatches,
} from "../utils/rbacHelpers";
import { UserProfile } from "../types/user";
import { CrewMember, CrewGroup, STCWDocumentItem } from "../types/crew";
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
  canAssignStakeholderRole,
  getDemoSessionContext,
  getSessionUserForPersona,
  getStakeholderRoleOrganization,
  PENDING_ASSIGNMENT,
  setSubmitters,
  StakeholderRole,
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
  canRequestDocumentReupload,
  findDocumentRenewalsDue,
  getComplianceStateForExpiry,
  getRenewalMessage,
  getRenewalSubject,
  getRenewalSubmitterLabel,
} from "../utils/documentRenewalHelpers";
import { withDocumentChecks } from "../utils/documentChecks";
import {
  findDuplicateObjectDocumentTitle,
  getEntityTypeForObjectType,
  getNextVersionLabel,
  resolveDocumentTargetObject,
} from "../utils/documentObjectHelpers";
import {
  getAssuranceSetCrewIds,
  toSingleAssetSet,
  vesselToAssuranceObject,
  crewToAssuranceObject,
  personObjectAssignments,
  equipmentToAssuranceObject,
  getAssuranceSetObjects,
} from "../utils/assuranceTemplates";
import { SEEDED_OPERATIONAL_OBJECTS } from "./assuranceObjectMockData";
import { MOCK_NOTIFICATIONS } from "./notificationMockData";
import {
  assuranceInvitationSubject,
  buildTargetDateNoticeDrafts,
  canOpenAssuranceRequestWizard,
  generateNotificationId,
  isNotificationActionedOnOpen,
  resolveNotificationRecipient,
  seedTargetDateNotices,
  seedAssignmentNotices,
  assignmentNoticeContent,
} from "../utils/notificationHelpers";
import { getRequestDirection } from "../utils/assuranceRequestHelpers";
import {
  buildDraftAssetLinkFromAssuranceSet,
  generateUniqueProjectId,
  getProjectClientOrganization,
  getProjectOrganizationForPersona,
  getProjectEffectiveCharterer,
  getProjectForAssuranceSet,
  isCrewOwnedByOrganization,
  isEquipmentOwnedByOrganization,
  isProjectAccessibleToUser,
  isAssuranceSetWithinProjectWindow,
  recalculateSetReadiness,
  requiresAssuranceSetForAssetLink,
  syncAllAffectedProjectRollups,
  syncProjectFromAssuranceSets,
  taskProvider,
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
  navigationSource?: "sidebar" | "in-screen";
  setCurrentHashView: (
    view: string,
    entityId?: string,
    options?: { source?: "sidebar" | "in-screen" },
  ) => void;

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
    createdByUserId?: string;
    createdByName?: string;
    createdByPersona?: string;
    stakeholderUserIds?: string[];
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
    invitedOrganizations?: string[];
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

  // Tenant Custom Sections (5b-02, ADR 0034)
  tenantCustomSections: TenantCustomSection[];
  addTenantCustomSection: (
    section: Omit<TenantCustomSection, 'id' | 'createdAt'> & { id?: string },
  ) => TenantCustomSection | null;
  getTenantCustomSections: (organization: string) => TenantCustomSection[];

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
  excludeGroupMember: (setId: string, memberId: string, reason: string, excludedBy: string) => void;
  restoreGroupMember: (setId: string, memberId: string, restoredBy: string) => void;
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
  recordObjectStatusChange: (
    objectId: string,
    newStatus: import("../types/assurance").ObjectVerificationStatus,
    changedBy: string,
    options?: { note?: string; clientOrganization?: string },
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
    submitterOrganization?: string,
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
  /** checks whether all party upload tasks for a requirement are done (finding 5c-02) */
  isRequirementDone: (setId: string, requirementIdentifier: string) => boolean;
  /** returns task completion breakdown across responsible parties for a requirement (finding 5c-02) */
  getRequirementCompletionStatus: (
    setId: string,
    requirementIdentifier: string,
  ) => {
    isDone: boolean;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    partyStatuses: { party: string; taskId: string; status: string; isDone: boolean }[];
  };
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
  linkDocumentToObject: (
    docId: string,
    objectType: AssuranceObjectType,
    objectId: string,
    objectName?: string,
  ) => { success: boolean; message?: string };
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
  crewGroups: CrewGroup[];
  addCrewGroup: (group: CrewGroup) => void;
  updateCrewGroup: (group: Partial<CrewGroup> & { id: string }) => void;
  setCrewGroupMembers: (groupId: string, memberIds: string[]) => void;
  addMemberToCrewGroup: (groupId: string, memberId: string) => void;
  removeMemberFromCrewGroup: (groupId: string, memberId: string) => void;

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
  submitCapaResponse: (capaId: string, responseNotes: string) => void;
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
  what: logs an automated system stage transition when an assurance set meets readiness conditions.
  how: writes a structured audit event with target kind stage, field delta, and session actor attribution (Approach A).
  with what file: src/store/useMapStore.ts, called when stage movements occur.
*/
function logStageTransitionAudit(
  get: () => MapStoreState,
  set: { id: string; title: string },
  prevStage: string,
  nextStage: string,
) {
  if (!prevStage || !nextStage || prevStage === nextStage) return;
  get().logAuditEvent({
    action: `System Transition: ${prevStage} -> ${nextStage}`,
    targetAsset: `${set.id} (${set.title})`,
    target: { kind: "stage", setId: set.id, stage: nextStage },
    fieldDelta: {
      fieldName: "Stage",
      oldValue: prevStage,
      newValue: nextStage,
    },
    justificationNotes: `Pipeline stage advanced automatically from ${prevStage} to ${nextStage} upon meeting readiness criteria.`,
  });

  if (nextStage === "Inspection") {
    notifyInspectionDueIfNeeded(get, set.id);
  }

  if (nextStage === "Approval") {
    const current = get().assuranceSets.find((s) => s.id === set.id);
    if (current && current.approverDecision === 'Returned for Correction') {
      useMapStore.setState((state) => ({
        assuranceSets: state.assuranceSets.map((s) =>
          s.id === set.id ? { ...s, approverDecision: 'Pending' } : s,
        ),
      }));
    }
  }
}

/**
  what: raises a "Start Inspection" notification for the assigned inspector upon entering Inspection stage.
  how: checks if inspection is due and not yet notified; notifies assigned inspector and skips duplicates.
*/
function notifyInspectionDueIfNeeded(
  get: () => MapStoreState,
  setId: string,
) {
  const state = get();
  const set = state.assuranceSets.find((s) => s.id === setId);
  if (!set || !isInspectionDue(set)) return;
  if (!set.assignedInspector?.trim()) return;

  const existingNotification = state.notifications.find(
    (n) =>
      n.assuranceSetId === set.id &&
      (n.assignedRole === "Inspector" || n.subject.toLowerCase().includes("inspect")) &&
      n.subject.includes("Start Inspection"),
  );
  if (existingNotification) return;

  notifyAssuranceSetUser(
    get,
    set,
    set.assignedInspector,
    {
      type: "stakeholder_assigned",
      assignedRole: "Inspector",
      subject: `Start Inspection: ${set.title}`,
      message: "Inspection is required. Open the Tasks tab to inspect.",
    },
    { systemSent: true },
  );
}

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
        fieldName: field === "targetDate" ? "Target date" : auditDateFieldLabel(field),
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
        fieldDelta: {
          fieldName: "Task",
          oldValue: "—",
          newValue: task.title,
        },
        justificationNotes: `Added task ${task.title}.`,
      });
      notifyVendorOfTaskChange(get, nextSet, "added", task.title);
      continue;
    }
    const targetDateChanged = (previous.targetDate ?? "") !== (task.targetDate ?? "");
    if (targetDateChanged) {
      get().logAuditEvent({
        action: "Changed date",
        targetAsset: `${nextSet.id} · ${task.title}`,
        target: { kind: "date", setId: nextSet.id, dateField: "targetDate", taskId },
        fieldDelta: {
          fieldName: "Target date",
          oldValue: previous.targetDate || "—",
          newValue: task.targetDate || "—",
        },
      });
    }
    if (taskEditSnapshot({ ...previous, targetDate: task.targetDate }) === taskEditSnapshot(task)) {
      if (targetDateChanged) notifyVendorOfTaskChange(get, nextSet, "edited", task.title);
      continue;
    }
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
      fieldDelta: {
        fieldName: "Task",
        oldValue: task.title,
        newValue: "—",
      },
      justificationNotes: `Removed task ${task.title}.`,
    });
    notifyVendorOfTaskChange(get, previousSet, "removed", task.title);
  }

  const stakeholderRoles: Array<{ key: keyof AssuranceSet; role: string }> = [
    { key: "assignedSubmitter", role: "Submitter" },
    { key: "assignedVerifier", role: "Verifier" },
    { key: "assignedInspector", role: "Inspector" },
    { key: "assignedApprover", role: "Approver" },
  ];

  for (const { key, role } of stakeholderRoles) {
    const oldAssignee = (previousSet[key] as string) || "";
    const newAssignee = (nextSet[key] as string) || "";
    if (oldAssignee !== newAssignee) {
      get().logAuditEvent({
        action: oldAssignee ? "Reassigned stakeholder" : "Assigned stakeholder",
        targetAsset: `${nextSet.id} · ${role}`,
        target: {
          kind: "stakeholder",
          setId: nextSet.id,
          role,
          userId: newAssignee || undefined,
        },
        fieldDelta: {
          fieldName: role,
          oldValue: oldAssignee || "Unassigned",
          newValue: newAssignee || "Unassigned",
        },
        justificationNotes: `${role} changed from ${oldAssignee || "unassigned"} to ${newAssignee || "unassigned"}.`,
      });
    }
  }

  if (previousSet.requestingParty !== nextSet.requestingParty) {
    const oldParty = previousSet.requestingParty || "";
    const newParty = nextSet.requestingParty || "";
    get().logAuditEvent({
      action: "Changed party",
      targetAsset: `${nextSet.id} · Requesting Party`,
      target: {
        kind: "party",
        setId: nextSet.id,
        organization: newParty || undefined,
        partyRole: "Requesting Party",
      },
      fieldDelta: {
        fieldName: "Requesting Party",
        oldValue: oldParty || "—",
        newValue: newParty || "—",
      },
      justificationNotes: `Requesting party changed from ${oldParty || "—"} to ${newParty || "—"}.`,
    });
  }

  if (previousSet.respondingParty !== nextSet.respondingParty) {
    const oldParty = previousSet.respondingParty || "";
    const newParty = nextSet.respondingParty || "";
    get().logAuditEvent({
      action: "Changed party",
      targetAsset: `${nextSet.id} · Responding Party`,
      target: {
        kind: "party",
        setId: nextSet.id,
        organization: newParty || undefined,
        partyRole: "Responding Party",
      },
      fieldDelta: {
        fieldName: "Responding Party",
        oldValue: oldParty || "—",
        newValue: newParty || "—",
      },
      justificationNotes: `Responding party changed from ${oldParty || "—"} to ${newParty || "—"}.`,
    });
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

  const creatorUser =
    (assuranceSet.createdByUserId &&
      state.users.find((u) => u.id === assuranceSet.createdByUserId)) ||
    findAssuranceSetCreatorUser(assuranceSet, state.users);
  if (
    creatorUser &&
    creatorUser.status === "Active" &&
    (creatorUser.roles.includes("Administrator") || creatorUser.roles.includes("Submitter")) &&
    !notifiedUserIds.has(creatorUser.id)
  ) {
    notifiedUserIds.add(creatorUser.id);
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

  const creatorUser = findAssuranceSetCreatorUser(assuranceSet, users);
  if (creatorUser && !labelsByUserId.has(creatorUser.id)) {
    labelsByUserId.set(creatorUser.id, creatorUser.name);
  }

  return Array.from(labelsByUserId.values());
}

function getStoreSessionActor(state: MapStoreState) {
  const sessionUser = getSessionUserForPersona(
    state.activePersona,
    state.users,
    getDemoSessionContext(state),
  );
  return {
    sessionUser,
    activePersona: state.activePersona,
    activeDemoOrganization: state.activeDemoOrganization,
  };
}

function canAccessCapaInSession(
  state: MapStoreState,
  capa: Pick<CapaItem, "assuranceSetId" | "vesselId" | "vesselName"> | undefined,
): boolean {
  if (!capa) return false;
  const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
  if (!sessionUser) return false;
  if (capa.assuranceSetId) {
    const exactSet = state.assuranceSets.find((s) => s.id === capa.assuranceSetId);
    if (!exactSet) return false;
    if (!isAssuranceSetAssignedToPersona(exactSet, activePersona, activeDemoOrganization, sessionUser, state.users)) {
      return false;
    }
    return activePersona !== "Inspector" || Boolean(exactSet.mandatoryInspectionRequired);
  }
  return state.assuranceSets.some((s) => {
    const matchesVessel =
      (Boolean(capa.vesselId) && s.vesselId === capa.vesselId) ||
      (Boolean(capa.vesselName) &&
        Boolean(s.vesselName) &&
        s.vesselName!.trim().toLowerCase() === capa.vesselName!.trim().toLowerCase());
    if (!matchesVessel) return false;
    if (!isAssuranceSetAssignedToPersona(s, activePersona, activeDemoOrganization, sessionUser, state.users)) {
      return false;
    }
    return activePersona !== "Inspector" || Boolean(s.mandatoryInspectionRequired);
  });
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
    ...setSubmitters(assuranceSet).map((submitter) => ({
      role: "Submitter" as UserRolePersona,
      label: submitter.assignee,
    })),
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
    const content = assignmentNoticeContent(role, assuranceSet.title, "assigned");
    notifyAssuranceSetUser(get, assuranceSet, label, {
      type: "stakeholder_assigned",
      subject: content.subject,
      message: content.message,
      assignedRole: role,
    });
  });

  const creatorUser = findAssuranceSetCreatorUser(assuranceSet, state.users);
  if (creatorUser && !notifiedUserIds.has(creatorUser.id)) {
    notifiedUserIds.add(creatorUser.id);
    const creatorRole: UserRolePersona = creatorUser.roles.includes("C Admin")
      ? "C Admin"
      : "Administrator";
    const content = assignmentNoticeContent(creatorRole, assuranceSet.title, "created");
    notifyAssuranceSetUser(get, assuranceSet, `${creatorUser.name} (${creatorUser.organization})`, {
      type: "stakeholder_assigned",
      subject: content.subject,
      message: content.message,
      assignedRole: creatorRole,
    });
  }
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
      previousHashView: undefined,
      currentEntityId: undefined,
      previousEntityId: undefined,
      navigationSource: undefined,
    });
  },
  logout: () => {
    window.location.hash = "#/login";
    set({
      isAuthenticated: false,
      currentHashView: "login",
      previousHashView: undefined,
      currentEntityId: undefined,
      previousEntityId: undefined,
      navigationSource: undefined,
    });
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
    /* the same person stays signed in when they also hold a membership in the new organization (ADR 0037) */
    const currentPersonId = users.find((u) => u.id === get().activeSessionUserId)?.personId;
    const sessionUser = pickSessionUserForOrgPersona(users, organization, nextPersona, currentPersonId);

    const state = get();
    const currentView = state.currentHashView;
    const currentId = state.currentEntityId;
    const viewAllowed = isViewAccessibleToPersona(
      currentView,
      currentId,
      nextPersona,
      undefined,
      undefined,
      sessionUser ?? null,
    );
    const entityBlocked =
      (currentView === "assurance-sets" &&
        currentId &&
        (() => {
          const targetSet = state.assuranceSets.find((s) => s.id === currentId);
          return Boolean(
            targetSet &&
              !isAssuranceSetAssignedToPersona(targetSet, nextPersona, organization, sessionUser, users),
          );
        })()) ||
      (currentView === "project" &&
        currentId &&
        currentId !== "new" &&
        (() => {
          const targetProject = state.projects.find((p) => p.id === currentId);
          return Boolean(
            targetProject &&
              !isProjectAccessibleToUser(
                targetProject,
                nextPersona,
                users,
                state.assuranceSets,
                organization,
                sessionUser,
                state.notifications,
              ),
          );
        })());
    if (!viewAllowed || entityBlocked) {
      get().setCurrentHashView("dashboard");
    }

    set({
      activeDemoOrganization: organization,
      activePersona: nextPersona,
      activeSessionUserId: sessionUser?.id,
    });
  },
  setActivePersona: (persona) => {
    const organization = get().activeDemoOrganization;
    const users = get().users;
    const personas = getPersonasForOrganization(users, organization);
    if (!personas.includes(persona)) return;

    const sessionUser = pickSessionUserForOrgPersona(users, organization, persona);

    /* default to dashboard if active view or entity is not accessible to newly selected persona */
    const state = get();
    const currentView = state.currentHashView;
    const currentId = state.currentEntityId;
    const viewAllowed = isViewAccessibleToPersona(
      currentView,
      currentId,
      persona,
      undefined,
      undefined,
      sessionUser ?? null,
    );
    const entityBlocked =
      (currentView === "assurance-sets" &&
        currentId &&
        (() => {
          const targetSet = state.assuranceSets.find((s) => s.id === currentId);
          return Boolean(
            targetSet &&
              !isAssuranceSetAssignedToPersona(targetSet, persona, organization, sessionUser, users),
          );
        })()) ||
      (currentView === "project" &&
        currentId &&
        currentId !== "new" &&
        (() => {
          const targetProject = state.projects.find((p) => p.id === currentId);
          return Boolean(
            targetProject &&
              !isProjectAccessibleToUser(
                targetProject,
                persona,
                users,
                state.assuranceSets,
                organization,
                sessionUser,
                state.notifications,
              ),
          );
        })());

    if (!viewAllowed || entityBlocked) {
      get().setCurrentHashView("dashboard");
    }

    set({ activePersona: persona, activeSessionUserId: sessionUser?.id });
  },

  currentHashView: "login",
  previousHashView: undefined,
  currentEntityId: undefined,
  previousEntityId: undefined,
  navigationSource: undefined,
  setCurrentHashView: (view, entityId, options) => {
    const source = options?.source ?? "in-screen";
    const currentView = get().currentHashView;
    const currentId = get().currentEntityId;

    let prevView = source === "sidebar" ? undefined : get().previousHashView;
    let prevId = source === "sidebar" ? undefined : get().previousEntityId;

    if (source !== "sidebar" && (currentView !== view || currentId !== entityId)) {
      prevView = currentView;
      prevId = currentId;
    }

    const targetHash = entityId ? `#/${view}/${entityId}` : `#/${view}`;
    if (typeof window !== "undefined" && window.location.hash.split("?")[0] !== targetHash) {
      window.location.hash = targetHash;
    }
    set({
      previousHashView: prevView,
      previousEntityId: prevId,
      navigationSource: source,
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

  notifications: seedAssignmentNotices(
    seedTargetDateNotices(
      MOCK_NOTIFICATIONS,
      [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS],
      MOCK_USERS,
      new Date().toISOString().slice(0, 10),
    ),
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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    if (!sessionUser) return 0;

    const document = state.documents.find((d) => d.id === docId);
    const note = reason.trim();
    if (!document || !note) return 0;
    /* A11: reviewers may request re-upload only for Exception or Expired documents */
    if (!canRequestDocumentReupload(document)) return 0;

    const authorizedSetIds = new Set(
      state.assuranceSets
        .filter((s) => {
          const refsDoc = s.requirements.some((r) => r.documentId === docId || r.linkedDocumentId === docId);
          if (!refsDoc) return false;
          if (!isAssuranceSetAssignedToPersona(s, activePersona, activeDemoOrganization, sessionUser, state.users)) {
            return false;
          }
          const actions = getAssuranceSetRoleActions(s, activePersona, activeDemoOrganization, sessionUser);
          return actions.canVerify || actions.canInspect || actions.canApprove || actions.canManage;
        })
        .map((s) => s.id),
    );
    if (authorizedSetIds.size === 0) return 0;

    const now = new Date().toISOString();
    set((curr) => ({
      assuranceSets: curr.assuranceSets.map((s) => {
        if (!authorizedSetIds.has(s.id)) return s;
        let hasMatched = false;
        const updatedReqs = s.requirements.map((r) => {
          if (r.documentId === docId || r.linkedDocumentId === docId) {
            hasMatched = true;
            return {
              ...r,
              reuploadRequested: {
                reason: note,
                date: now,
                requestedAt: now,
              },
            };
          }
          return r;
        });
        if (!hasMatched) return s;
        return {
          ...s,
          requirements: updatedReqs,
        };
      }),
    }));

    let raised = 0;
    get().assuranceSets.forEach((s) => {
      if (!authorizedSetIds.has(s.id)) return;
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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const project = state.projects.find((p) => p.id === input.projectId);
    if (!project) {
      return { success: false, message: "Project not found." };
    }
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isProjectAccessibleToUser(
        project,
        activePersona,
        state.users,
        state.assuranceSets,
        activeDemoOrganization,
        sessionUser,
        state.notifications,
      )
    ) {
      return { success: false, message: "You are not authorized to request assurance sets for this project." };
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

    const sender = get().users.find((u) => u.id === input.senderUserId);
    const senderOrganization =
      sender?.organization ||
      getProjectOrganizationForPersona(get().activePersona, get().users, get().activeDemoOrganization) ||
      getProjectClientOrganization(project);
    const { requestingParty, respondingParty } = getRequestDirection(senderOrganization, assignee);

    const partyRoles = {
      requestingParty,
      respondingParty,
      [requestingParty]: 'Requesting party',
      [respondingParty]: 'Responding party',
    };

    const notificationId = get().pushNotification({
      type: "assurance_set_request",
      subject: assuranceInvitationSubject(project.name),
      message: input.message?.trim() || undefined,
      recipientUserId: assignee.id,
      senderUserId: input.senderUserId,
      senderName: input.senderName,
      projectId: project.id,
      projectName: project.name,
      requestingParty,
      respondingParty,
      partyRoles,
      request: {
        assigneeUserId: assignee.id,
        assigneeName: assignee.name,
        clientOrganization: getProjectClientOrganization(project),
        requestingParty,
        respondingParty,
        partyRoles,
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
    const state = get();
    const { sessionUser, activePersona: persona } = getStoreSessionActor(state);
    if (!sessionUser || (persona !== "Administrator" && persona !== "C Admin")) {
      return { success: false, message: "Only administrators can create projects." };
    }
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
      createdByUserId: input.createdByUserId ?? sessionUser?.id ?? state.activeSessionUserId,
      createdByName: input.createdByName ?? sessionUser?.name,
      createdByPersona: input.createdByPersona ?? persona,
      stakeholderUserIds: input.stakeholderUserIds,
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
      invitedOrganizations: input.invitedOrganizations,
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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const existingProject = state.projects.find((p) => p.id === updatedProject.id);
    if (
      !existingProject ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isProjectAccessibleToUser(
        existingProject,
        activePersona,
        state.users,
        state.assuranceSets,
        activeDemoOrganization,
        sessionUser,
        state.notifications,
      )
    ) {
      return;
    }
    set((curr) => ({
      projects: curr.projects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p,
      ),
    }));
  },

  addAssetToProject: (projectId, linkInput) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return { success: false, message: "Project not found." };
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isProjectAccessibleToUser(
        project,
        activePersona,
        state.users,
        state.assuranceSets,
        activeDemoOrganization,
        sessionUser,
        state.notifications,
      )
    ) {
      return { success: false, message: "You are not authorized to modify this project." };
    }

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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const target = state.assuranceSets.find((s) => s.id === assuranceSetId);
    if (!target) return { success: false, message: "Assurance set not found." };

    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return { success: false, message: "Project not found." };

    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isAssuranceSetAssignedToPersona(target, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !isProjectAccessibleToUser(
        project,
        activePersona,
        state.users,
        state.assuranceSets,
        activeDemoOrganization,
        sessionUser,
        state.notifications,
      )
    ) {
      return { success: false, message: "You are not authorized to attach this assurance set to this project." };
    }

    if (
      project.charterWindowStart &&
      project.charterWindowEnd &&
      !isAssuranceSetWithinProjectWindow(
        target,
        project.charterWindowStart,
        project.charterWindowEnd,
      )
    ) {
      return {
        success: false,
        message: `Contract Period must be inside the project window (${project.charterWindowStart} to ${project.charterWindowEnd}).`,
      };
    }

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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isProjectAccessibleToUser(
        project,
        activePersona,
        state.users,
        state.assuranceSets,
        activeDemoOrganization,
        sessionUser,
        state.notifications,
      )
    ) {
      return;
    }

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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const linkedSet = state.assuranceSets.find((s) => s.id === assuranceSetId);
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isProjectAccessibleToUser(
        project,
        activePersona,
        state.users,
        state.assuranceSets,
        activeDemoOrganization,
        sessionUser,
        state.notifications,
      ) ||
      (linkedSet &&
        !isAssuranceSetAssignedToPersona(linkedSet, activePersona, activeDemoOrganization, sessionUser, state.users))
    ) {
      return;
    }
    const owner =
      linkedSet && getProjectForAssuranceSet(linkedSet, state.projects);
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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || "";
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isVesselOwnedByClientOrg(newVessel, effectiveOrg)
    ) {
      return {
        success: false,
        message: "Only administrators of the owning organization can register vessels.",
      };
    }

    const dupCheck = isDuplicateVessel(
      newVessel.imoNumber,
      newVessel.officialRegNumber,
      state.vessels,
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

    set((curr) => ({
      vessels: [...curr.vessels, newVessel],
      assuranceObjects: [...curr.assuranceObjects, vesselToAssuranceObject(newVessel)],
      vesselStatusHistory: [...curr.vesselStatusHistory, ...initialHistory],
    }));

    get().logAuditEvent({
      action: "Registered Unique Vessel Record",
      targetAsset: `${newVessel.name} (IMO ${newVessel.imoNumber})`,
      justificationNotes: `Registered vessel under ${newVessel.flagState} flag.`,
    });

    return { success: true, vesselId: newVessel.id };
  },

  updateVessel: (updatedVessel) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const previousVessel = state.vessels.find((v) => v.id === updatedVessel.id);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || "";
    if (
      !previousVessel ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isVesselOwnedByClientOrg(previousVessel, effectiveOrg)
    ) {
      return;
    }
    const statusChanges = diffVesselStatusChanges(previousVessel, updatedVessel);

    set((curr) => ({
      vessels: curr.vessels.map((v) =>
        v.id === updatedVessel.id ? updatedVessel : v,
      ),
      /* synchronize vessel name and imo across all linked assurance sets */
      assuranceSets: curr.assuranceSets.map((s) =>
        s.vesselId === updatedVessel.id
          ? {
              ...s,
              vesselName: updatedVessel.name,
              imoNumber: updatedVessel.imoNumber,
            }
          : s,
      ),
      /* synchronize vessel attributes in linked master documents */
      documents: curr.documents.map((d) =>
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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const previousVessel = state.vessels.find((v) => v.id === vesselId);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || "";
    if (
      !previousVessel ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin" && activePersona !== "Submitter") ||
      !isVesselOwnedByClientOrg(previousVessel, effectiveOrg)
    ) {
      return;
    }

    const nextVessel = { ...previousVessel, status };
    const statusChanges = diffVesselStatusChanges(previousVessel, nextVessel);

    set((curr) => ({
      vessels: curr.vessels.map((v) => (v.id === vesselId ? nextVessel : v)),
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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const previousVessel = state.vessels.find((v) => v.id === vesselId);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || "";
    if (
      !previousVessel ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin" && activePersona !== "Submitter") ||
      !isVesselOwnedByClientOrg(previousVessel, effectiveOrg)
    ) {
      return;
    }

    const previousAvailability =
      previousVessel.availabilityStatus ??
      getTrackedVesselStatusValues(previousVessel).availability;

    if (previousAvailability === availabilityStatus) return;

    const now = new Date().toISOString();
    set((curr) => ({
      vessels: curr.vessels.map((v) =>
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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || "";
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isEquipmentOwnedByOrganization(newEquipment, effectiveOrg)
    ) {
      return {
        success: false,
        message: "Only administrators of the owning organization can register equipment.",
      };
    }

    const dupCheck = isDuplicateEquipment(
      newEquipment.equipmentIdentifier,
      state.equipment,
    );
    if (dupCheck.isDuplicate) {
      return { success: false, message: dupCheck.reason };
    }
    set((curr) => ({
      equipment: [...curr.equipment, newEquipment],
      assuranceObjects: [...curr.assuranceObjects, equipmentToAssuranceObject(newEquipment)],
    }));
    get().logAuditEvent({
      action: "Registered Equipment Asset",
      targetAsset: `${newEquipment.name} (${newEquipment.equipmentIdentifier})`,
      justificationNotes: `Registered equipment under category ${newEquipment.category}.`,
    });
    return { success: true, equipmentId: newEquipment.id };
  },

  updateEquipment: (updatedEquipment) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const existing = state.equipment.find((e) => e.id === updatedEquipment.id);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || "";
    if (
      !existing ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin") ||
      !isEquipmentOwnedByOrganization(existing, effectiveOrg)
    ) {
      return;
    }
    set((curr) => ({
      equipment: curr.equipment.map((e) =>
        e.id === updatedEquipment.id ? updatedEquipment : e,
      ),
    }));
  },

  updateEquipmentAvailability: (equipmentId, availabilityStatus) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const existing = state.equipment.find((e) => e.id === equipmentId);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || "";
    if (
      !existing ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "C Admin" && activePersona !== "Submitter") ||
      !isEquipmentOwnedByOrganization(existing, effectiveOrg)
    ) {
      return;
    }
    const now = new Date().toISOString();
    set((curr) => ({
      equipment: curr.equipment.map((e) =>
        e.id === equipmentId
          ? { ...e, availabilityStatus, availabilityUpdatedAt: now }
          : e,
      ),
    }));
  },

  // Assurance Templates State (Dedicated Public Templates Slice)
  assuranceTemplates: MOCK_ASSURANCE_TEMPLATES,
  addAssuranceTemplate: (template) => {
    const stateBefore = get();
    const { sessionUser, activePersona } = getStoreSessionActor(stateBefore);
    if (!sessionUser || (activePersona !== "Administrator" && activePersona !== "C Admin")) {
      return;
    }
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
    const stateBefore = get();
    const { sessionUser, activePersona } = getStoreSessionActor(stateBefore);
    if (!sessionUser || (activePersona !== "Administrator" && activePersona !== "C Admin")) {
      return;
    }
    set((state) => ({
      assuranceTemplates: state.assuranceTemplates.map((t) =>
        t.id === template.id ? template : t,
      ),
    }));
  },

  // Tenant Custom Sections (5b-02, ADR 0034)
  tenantCustomSections: [],
  addTenantCustomSection: (sectionInput) => {
    const state = get();
    const { sessionUser, activePersona } = getStoreSessionActor(state);
    const requestNotification = state.pendingAssuranceRequestNotificationId
      ? state.notifications.find((n) => n.id === state.pendingAssuranceRequestNotificationId)
      : undefined;
    const isAuthorizedRequest = Boolean(
      sessionUser &&
        requestNotification &&
        canOpenAssuranceRequestWizard(requestNotification, sessionUser),
    );
    if (
      !sessionUser ||
      (!isAuthorizedRequest && activePersona !== "Administrator" && activePersona !== "C Admin")
    ) {
      return null;
    }
    const cleanName = sectionInput.name.trim();
    const cleanOrg = sectionInput.organization.trim();
    const id =
      sectionInput.id ||
      `sec-tenant-${Date.now().toString().slice(-6)}-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const newSection: TenantCustomSection = {
      id,
      name: cleanName,
      organization: cleanOrg,
      description: sectionInput.description?.trim(),
      createdAt: new Date().toISOString(),
    };
    const existingIndex = state.tenantCustomSections.findIndex(
      (s) =>
        s.id === id ||
        (s.name.toLowerCase() === cleanName.toLowerCase() &&
          orgFieldMatches(s.organization, cleanOrg)),
    );
    if (existingIndex >= 0) {
      const updated = [...state.tenantCustomSections];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...newSection,
        id: updated[existingIndex].id,
      };
      set({ tenantCustomSections: updated });
      return updated[existingIndex];
    } else {
      set({ tenantCustomSections: [...state.tenantCustomSections, newSection] });
      return newSection;
    }
  },
  getTenantCustomSections: (organization: string) => {
    if (!organization || !organization.trim()) return [];
    return get().tenantCustomSections.filter((s) =>
      orgFieldMatches(s.organization, organization),
    );
  },

  // Assurance Objects State (ADR 0029)
  assuranceObjects: [
    ...MOCK_VESSELS.map(vesselToAssuranceObject),
    ...MOCK_CREW.map(crewToAssuranceObject),
    ...MOCK_EQUIPMENT.map(equipmentToAssuranceObject),
    ...SEEDED_OPERATIONAL_OBJECTS,
    ...OIL_CO_PILOT_ASSURANCE_OBJECTS,
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
    const state = get();
    const sessionCreator = getSessionUserForPersona(
      state.activePersona,
      state.users,
      getDemoSessionContext(state),
    );
    const requestNotification = state.pendingAssuranceRequestNotificationId
      ? state.notifications.find((n) => n.id === state.pendingAssuranceRequestNotificationId)
      : undefined;
    const isAuthorizedRequestCreation = Boolean(
      sessionCreator &&
        requestNotification &&
        canOpenAssuranceRequestWizard(requestNotification, sessionCreator) &&
        newSet.projectId &&
        requestNotification.projectId === newSet.projectId,
    );
    if (
      !sessionCreator ||
      (!isAuthorizedRequestCreation &&
        state.activePersona !== "Administrator" &&
        state.activePersona !== "C Admin")
    ) {
      return;
    }

    const existingSets = state.assuranceSets;
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
        targetSubtype: newSet.assuranceType,
      },
    );

    const sanitizedRequirements = autoAttachedRequirements.map((r) => ({
      ...r,
      ocrConfidence:
        r.documentId || r.linkedDocumentId ? r.ocrConfidence || 95 : 0,
    }));

    /* normalizes set assets and assurance objects via toSingleAssetSet (ADR 0029: multi-object sets preserve all objects) */

    const matchesCreatorOrg =
      (!newSet.initiatorOrg || orgFieldMatches(sessionCreator.organization, newSet.initiatorOrg)) &&
      (!newSet.createdByPersona || newSet.createdByPersona === state.activePersona);

    const computedSet = recalculateSetReadiness(
      toSingleAssetSet({
        ...newSet,
        id: uniqueId,
        stage: newSet.stage || "Initiated",
        createdByUserId:
          newSet.createdByUserId ??
          (matchesCreatorOrg ? sessionCreator?.id : undefined),
        createdByName:
          newSet.createdByName ??
          (matchesCreatorOrg ? sessionCreator?.name : undefined),
        createdByPersona:
          newSet.createdByPersona ??
          (matchesCreatorOrg ? state.activePersona : newSet.createdByPersona),
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
    const prevSet = state.assuranceSets.find((s) => s.id === updatedSet.id);
    if (!prevSet) return;
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(prevSet, activePersona, activeDemoOrganization, sessionUser, state.users)
    ) {
      return;
    }
    const roleActions = getAssuranceSetRoleActions(prevSet, activePersona, activeDemoOrganization, sessionUser);
    const canSubmitSectionsOnly =
      roleActions.canUpload && !isClosedAssuranceSet(prevSet) && prevSet.stage !== "Cancelled";
    if (!roleActions.canManage && !roleActions.canChangeDates && !canSubmitSectionsOnly) {
      return;
    }
    const targetInputSet: AssuranceSet =
      roleActions.canManage || roleActions.canChangeDates
        ? updatedSet
        : { ...prevSet, sections: updatedSet.sections };

    const matchingVessel = state.vessels.find(
      (v) => v.id === targetInputSet.vesselId || v.name === targetInputSet.vesselName,
    );
    const autoAttachedRequirements = autoAttachDocumentsToRequirements(
      targetInputSet.requirements || [],
      {
        documents: state.documents,
        vessel: matchingVessel,
        vessels: state.vessels,
        crew: state.crew,
        selectedCrewId: targetInputSet.crewId,
        selectedCrewIds: getAssuranceSetCrewIds(targetInputSet),
        equipment: state.equipment,
        selectedEquipmentId: targetInputSet.equipmentId,
        selectedVesselId: targetInputSet.vesselId,
        targetSubtype: targetInputSet.assuranceType,
      },
    );

    const sanitizedRequirements = autoAttachedRequirements.map((r) => ({
      ...r,
      ocrConfidence:
        r.documentId || r.linkedDocumentId ? r.ocrConfidence || 95 : 0,
    }));

    const computedSet = recalculateSetReadiness(
      toSingleAssetSet({
        ...targetInputSet,
        targetDate: targetInputSet.targetDate || targetInputSet.complianceDeadline,
        datePermissionGrants: targetInputSet.datePermissionGrants ?? state.assuranceSets.find((s) => s.id === targetInputSet.id)?.datePermissionGrants ?? [],
        targetDateHistory: (() => {
          const prev = state.assuranceSets.find((s) => s.id === targetInputSet.id);
          const resolved = targetInputSet.targetDate || targetInputSet.complianceDeadline;
          const prevDate = prev?.targetDate || prev?.complianceDeadline;
          let ledger = targetInputSet.targetDateHistory ?? prev?.targetDateHistory ?? [];
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
                setId: targetInputSet.id,
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
      s.id === targetInputSet.id ? computedSet : s,
    );

    const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
      syncAllAffectedProjectRollups(state.projects, updatedSets, [computedSet.id]);

    set({
      assuranceSets: syncedSets,
      projects: syncedProjects,
    });

    const previousSet = prevSet;

    /* a draft that is initiated notifies its stakeholders for the first time */
    if (previousSet?.visibility === "draft" && computedSet.visibility !== "draft") {
      notifyAssignedStakeholders(get, computedSet);
      get().raiseDocumentRenewalNotifications([computedSet.id]);
    }

    /* date changes and task edits are recorded against the set the caller submitted */
    if (previousSet) {
      logAssuranceSetAuditDiff(get, previousSet, targetInputSet);
      if (previousSet.stage !== computedSet.stage) {
        logStageTransitionAudit(get, computedSet, previousSet.stage, computedSet.stage);
      }
    }
  },
  grantDatePermission: (setId, grantInput) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const target = state.assuranceSets.find((s) => s.id === setId);
    if (
      !target ||
      !sessionUser ||
      activePersona !== "C Admin" ||
      !isAssuranceSetAssignedToPersona(target, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(target, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return;
    }
    set((curr) => {
      const currentTarget = curr.assuranceSets.find((s) => s.id === setId);
      if (!currentTarget) return curr;
      const newGrant: DatePermissionGrant = {
        ...grantInput,
        id: `DPG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        grantedAt: new Date().toISOString(),
      };
      const updatedGrants = [...(currentTarget.datePermissionGrants || []), newGrant];
      const updatedSet: AssuranceSet = { ...currentTarget, datePermissionGrants: updatedGrants };
      return {
        assuranceSets: curr.assuranceSets.map((s) => (s.id === setId ? updatedSet : s)),
      };
    });
    get().logAuditEvent({
      action: "Granted Date Permission",
      targetAsset: setId,
      justificationNotes: `Granted target date change permission to ${grantInput.userName}.`,
    });
  },
  revokeDatePermission: (setId, grantId) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const target = state.assuranceSets.find((s) => s.id === setId);
    if (
      !target ||
      !sessionUser ||
      activePersona !== "C Admin" ||
      !isAssuranceSetAssignedToPersona(target, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(target, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return;
    }
    set((curr) => {
      const currentTarget = curr.assuranceSets.find((s) => s.id === setId);
      if (!currentTarget) return curr;
      const updatedGrants = (currentTarget.datePermissionGrants || []).filter(
        (g) => g.id !== grantId && g.userId !== grantId,
      );
      const updatedSet: AssuranceSet = { ...currentTarget, datePermissionGrants: updatedGrants };
      return {
        assuranceSets: curr.assuranceSets.map((s) => (s.id === setId ? updatedSet : s)),
      };
    });
    get().logAuditEvent({
      action: "Revoked Date Permission",
      targetAsset: setId,
      justificationNotes: `Revoked target date change permission ${grantId}.`,
    });
  },
  excludeGroupMember: (setId, memberId, reason, excludedBy) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const target = state.assuranceSets.find((s) => s.id === setId);
    if (
      !target ||
      !sessionUser ||
      activePersona !== "Administrator" ||
      !isAssuranceSetAssignedToPersona(target, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(target, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return;
    }
    set((curr) => {
      const currentTarget = curr.assuranceSets.find((s) => s.id === setId);
      if (!currentTarget) return curr;
      const existingExclusions = currentTarget.memberExclusions || [];
      const newExclusion: SetMemberExclusion = {
        memberId,
        reason,
        excludedBy,
        excludedAt: new Date().toISOString(),
        restored: false,
      };
      const updatedExclusions = [
        ...existingExclusions.filter((e) => e.memberId !== memberId),
        newExclusion,
      ];
      const updatedSet: AssuranceSet = { ...currentTarget, memberExclusions: updatedExclusions };
      return {
        assuranceSets: curr.assuranceSets.map((s) => (s.id === setId ? updatedSet : s)),
      };
    });
    get().logAuditEvent({
      action: "Excluded Group Member",
      targetAsset: setId,
      justificationNotes: `Excluded member ${memberId} from set: ${reason}`,
    });
  },
  restoreGroupMember: (setId, memberId, restoredBy) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const target = state.assuranceSets.find((s) => s.id === setId);
    if (
      !target ||
      !target.memberExclusions ||
      !sessionUser ||
      activePersona !== "Administrator" ||
      !isAssuranceSetAssignedToPersona(target, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(target, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return;
    }
    set((curr) => {
      const currentTarget = curr.assuranceSets.find((s) => s.id === setId);
      if (!currentTarget || !currentTarget.memberExclusions) return curr;
      const updatedExclusions = currentTarget.memberExclusions.map((e) => {
        if (e.memberId === memberId && !e.restored) {
          return {
            ...e,
            restored: true,
            restoredAt: new Date().toISOString(),
            restoredBy,
          };
        }
        return e;
      });
      const updatedSet: AssuranceSet = { ...currentTarget, memberExclusions: updatedExclusions };
      return {
        assuranceSets: curr.assuranceSets.map((s) => (s.id === setId ? updatedSet : s)),
      };
    });
    get().logAuditEvent({
      action: "Restored Group Member",
      targetAsset: setId,
      justificationNotes: `Restored member ${memberId} to set by ${restoredBy}`,
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
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(setTarget, state.activePersona, state.activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(setTarget, state.activePersona, state.activeDemoOrganization, sessionUser).canManage
    ) {
      return { success: false, message: "Only assigned set managers can edit tasks." };
    }

    if (isClosedAssuranceSet(setTarget) || setTarget.stage === "Cancelled") {
      return { success: false, message: "Tasks cannot be modified on a closed or cancelled assurance set." };
    }

    if (!taskInput.title?.trim() || !taskInput.category?.trim()) {
      return { success: false, message: "Task title and category are required." };
    }

    const newTaskId = taskInput.id || `REQ-TASK-${Date.now().toString().slice(-6)}`;
    const parties = taskInput.responsibleParties;
    if (parties && parties.length > 1) {
      const groupId = taskInput.requirementGroupId || `REQ-GRP-${Date.now().toString().slice(-6)}`;
      const newRequirements: AssuranceRequirement[] = parties.map((party, pIdx) => ({
        id: `${newTaskId}-${pIdx + 1}`,
        category: taskInput.category,
        title: taskInput.title.trim(),
        description: taskInput.description?.trim() || "",
        isMandatory: taskInput.isMandatory !== undefined ? taskInput.isMandatory : true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: "Pending",
        targetDate: taskInput.targetDate || setTarget.targetDate || setTarget.complianceDeadline,
        assignedSubmitter: party,
        responsibleParty: party,
        responsibleParties: parties,
        requirementGroupId: groupId,
        assignedVerifier: taskInput.assignedVerifier || setTarget.assignedVerifier,
        isSpecialized: taskInput.isSpecialized,
        isOtherDocument: taskInput.isOtherDocument,
        sectionId: taskInput.sectionId,
        predecessorId: taskInput.predecessorId,
        notes: taskInput.notes,
      }));

      const updatedSet: AssuranceSet = {
        ...setTarget,
        requirements: [...setTarget.requirements, ...newRequirements],
      };

      get().updateAssuranceSet(updatedSet);

      return { success: true, requirement: newRequirements[0] };
    }

    const singleParty = parties?.[0] || taskInput.responsibleParty || taskInput.assignedSubmitter || setTarget.assignedSubmitter;
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
      assignedSubmitter: singleParty,
      responsibleParty: singleParty,
      responsibleParties: parties || (singleParty ? [singleParty] : undefined),
      requirementGroupId: taskInput.requirementGroupId || newTaskId,
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
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(setTarget, state.activePersona, state.activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(setTarget, state.activePersona, state.activeDemoOrganization, sessionUser).canManage
    ) {
      return { success: false, message: "Only assigned set managers can edit tasks." };
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
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(setTarget, state.activePersona, state.activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(setTarget, state.activePersona, state.activeDemoOrganization, sessionUser).canManage
    ) {
      return { success: false, message: "Only assigned set managers can edit tasks." };
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
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(setTarget, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(setTarget, activePersona, activeDemoOrganization, sessionUser).canChangeDates
    ) {
      return { success: false, message: "Date change permission is required." };
    }
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
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(setTarget, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(setTarget, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return { success: false, message: "Only assigned set managers can revise completion dates." };
    }
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
      target: { kind: "date", setId, dateField: "targetDate" },
      fieldDelta: {
        fieldName: "Target date",
        oldValue: oldDeadline,
        newValue: revisedDate,
      },
      justificationNotes: `Revised completion date from ${oldDeadline} to ${revisedDate} by ${actorName}.${reason ? ` Reason: ${reason}` : ""}`,
    });
    return { success: true };
  },
  exemptAssuranceTasks: (setId, taskIds, reason, grantedBy, newDate) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(setTarget, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(setTarget, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return { success: false, message: "Only assigned set managers can exempt tasks." };
    }
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
    for (const taskId of taskIds) {
      const task = setTarget.requirements.find((r) => r.id === taskId);
      get().logAuditEvent({
        action: "Exempted task",
        targetAsset: `${setId} · ${task?.title || taskId}`,
        target: { kind: "task", setId, taskId },
        fieldDelta: {
          fieldName: "Exemption",
          oldValue: "Active",
          newValue: `Exempted until ${newDate}`,
        },
        justificationNotes: `Exempted task ${task?.title || taskId} until ${newDate} by ${grantedBy}. Reason: ${reason}`,
      });
    }
    get().logAuditEvent({
      action: "Exempted Tasks",
      targetAsset: setId,
      target: { kind: "set", setId },
      justificationNotes: `Exempted ${taskIds.length} task(s) until ${newDate} by ${grantedBy}. Reason: ${reason}`,
    });
    return { success: true };
  },
  partiallyCloseAssuranceSet: (setId, actorName, notes) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(setTarget, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(setTarget, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return { success: false, message: "Only assigned set managers can partially close this assurance set." };
    }
    const openRequired = (setTarget.requirements || []).filter(
      (requirement) =>
        requirement.isMandatory &&
        !requirement.exemption &&
        requirement.verifierStatus !== "Verified",
    );
    if (openRequired.length > 0) {
      return {
        success: false,
        message: `Partial close blocked: ${openRequired.length} required task(s) are neither verified nor exempted (${openRequired
          .map((requirement) => requirement.id)
          .join(", ")}).`,
      };
    }
    const now = new Date().toISOString();
    const closedOptionalTasks = (setTarget.requirements || []).filter(
      (r) => !r.isMandatory && r.verifierStatus !== "Verified" && r.verifierStatus !== "Waived" && r.verifierStatus !== "Not Done",
    );
    const updatedRequirements = (setTarget.requirements || []).map((r) => {
      if (!r.isMandatory && r.verifierStatus !== "Verified" && r.verifierStatus !== "Waived" && r.verifierStatus !== "Not Done") {
        return {
          ...r,
          verifierStatus: "Not Done" as const,
          isFulfilled: false,
          notes: "Closed as not done upon set closure.",
        };
      }
      return r;
    });
    const updatedSet: AssuranceSet = {
      ...setTarget,
      requirements: updatedRequirements,
      stage: "Approved",
      closureType: "partial",
      lockedAt: setTarget.lockedAt || now,
      partiallyClosedAt: now,
      approverDecision: "Approved",
      approverNotes: notes || `Partially closed by ${actorName}. Exempted tasks remain open.`,
    };
    get().updateAssuranceSet(updatedSet);
    for (const r of closedOptionalTasks) {
      get().logAuditEvent({
        action: "Task Closed - Not Done",
        targetAsset: `${setId} / ${r.title}`,
        target: { kind: "set", setId, requirementId: r.id },
        justificationNotes: "Closed as not done upon set closure.",
      });
    }
    get().logAuditEvent({
      action: "Partial Closure",
      targetAsset: setId,
      justificationNotes: notes || `Assurance set ${setId} partially closed by ${actorName}. Exempted tasks remain open.`,
    });
    return { success: true };
  },
  recordObjectStatusChange: (objectId, newStatus, changedBy, options) => {
    const state = get();
    const target = state.assuranceObjects.find((object) => object.id === objectId);
    if (!target) return { success: false, message: "Assurance object not found." };
    const history = [...(target.statusHistory || [])];
    const previousStatus = history.length > 0 ? history[history.length - 1].newStatus : null;
    if (previousStatus === newStatus) {
      return { success: true };
    }
    const entry = {
      id: `OSH-${objectId}-${Date.now().toString().slice(-6)}`,
      previousStatus,
      newStatus,
      changedBy,
      changedAt: new Date().toISOString(),
      note: options?.note,
      clientOrganization: options?.clientOrganization,
    };
    set((current) => ({
      assuranceObjects: current.assuranceObjects.map((object) =>
        object.id === objectId
          ? { ...object, statusHistory: [...(object.statusHistory || []), entry] }
          : object,
      ),
    }));
    get().logAuditEvent({
      action: "Object Status Changed",
      targetAsset: objectId,
      justificationNotes: `${previousStatus || "none"} → ${newStatus} by ${changedBy}`,
    });
    return { success: true };
  },
  cancelAssuranceSet: (setId, actorName, reason) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const setTarget = state.assuranceSets.find((s) => s.id === setId);
    if (!setTarget) return { success: false, message: "Assurance set not found." };
    if (
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(setTarget, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(setTarget, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return { success: false, message: "Only assigned set managers can cancel this assurance set." };
    }
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
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    const target = state.assuranceSets.find((s) => s.id === setId);
    if (
      !target ||
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(target, activePersona, activeDemoOrganization, sessionUser, state.users) ||
      !getAssuranceSetRoleActions(target, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return;
    }
    /* explicit manual override: the chosen stage is kept and only the readiness index is recalculated */
    const updatedSets = state.assuranceSets.map((s) => {
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
  updateAssuranceStakeholder: (setId, role, assigneeName, submitterOrganization) => {
    const state = get();
    const { sessionUser, activePersona: persona, activeDemoOrganization: adminOrganization } =
      getStoreSessionActor(state);
    const assuranceSet = state.assuranceSets.find((s) => s.id === setId);
    if (!assuranceSet) {
      return { success: false, message: "Assurance set not found." };
    }

    if (!canEditAssuranceSetStakeholders(assuranceSet, persona, adminOrganization, sessionUser)) {
      return {
        success: false,
        message:
          getAssuranceSetStakeholderLockReason(assuranceSet) ||
          "Stakeholder assignments cannot be changed for this campaign.",
      };
    }

    /* only the admin of the role's organization can choose its person */
    if (!canAssignStakeholderRole(assuranceSet, role, adminOrganization, submitterOrganization)) {
      const roleOrganization =
        (role === "Submitter" && submitterOrganization) || getStakeholderRoleOrganization(assuranceSet, role);
      return {
        success: false,
        message: `Only the administrator of ${roleOrganization} can assign its ${role.toLowerCase()}.`,
      };
    }

    const validation = validateStakeholderAssignmentForSet(
      assuranceSet,
      role,
      assigneeName,
      get().users,
      submitterOrganization,
    );
    if (!validation.ok) {
      return { success: false, message: validation.message };
    }

    const submitters = setSubmitters(assuranceSet);
    const objects = assuranceSet.assuranceObjects ?? [];
    const providers = submitters.map((submitter) => submitter.organization);
    const isOwnTask = (r: AssuranceRequirement) =>
      !submitterOrganization ||
      taskProvider(objects, providers, r.subtype, r.targetObjectId)?.toLowerCase() === submitterOrganization.toLowerCase();
    const fillPendingTasks = (requirements: AssuranceRequirement[]) =>
      role === "Submitter"
        ? requirements.map((r) =>
            r.assignedSubmitter === PENDING_ASSIGNMENT && isOwnTask(r) ? { ...r, assignedSubmitter: assigneeName } : r,
          )
        : role === "Verifier"
          ? requirements.map((r) =>
              r.assignedVerifier === PENDING_ASSIGNMENT ? { ...r, assignedVerifier: assigneeName } : r,
            )
          : requirements;

    set((state) => ({
      assuranceSets: state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        if (role === "Submitter") {
          /* the first submitter is the one older views read */
          const named = s.submitters?.map((submitter, index) =>
            (submitterOrganization
              ? submitter.organization.toLowerCase() === submitterOrganization.toLowerCase()
              : index === 0)
              ? { ...submitter, assignee: assigneeName }
              : submitter,
          );
          return {
            ...s,
            submitters: named,
            assignedSubmitter: named?.[0]?.assignee ?? assigneeName,
            requirements: fillPendingTasks(s.requirements),
          };
        }
        if (role === "Verifier") {
          return {
            ...s,
            assignedVerifier: assigneeName,
            verificationRequired: true,
            requirements: fillPendingTasks(s.requirements),
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
    const previousAssignee =
      role === "Submitter"
        ? submitters.find((submitter) => submitter.organization === submitterOrganization)?.assignee ??
          assuranceSet.assignedSubmitter
        : role === "Verifier"
          ? assuranceSet.assignedVerifier
          : role === "Inspector"
            ? assuranceSet.assignedInspector
            : role === "Approver"
              ? assuranceSet.assignedApprover
              : undefined;
    get().logAuditEvent({
      action: `Assigned Vessel ${role}`,
      targetAsset: `${setId} · ${assigneeName}`,
      target: { kind: "set", setId },
      fieldDelta: {
        fieldName: role,
        oldValue: previousAssignee || "—",
        newValue: assigneeName,
      },
      justificationNotes: `Assigned ${role.toLowerCase()} ${assigneeName} to assurance campaign ${setId}`,
    });
    const assignedContent = assignmentNoticeContent(role, assuranceSet.title, "assigned");
    notifyAssuranceSetUser(get, assuranceSet, assigneeName, {
      type: "stakeholder_assigned",
      subject: assignedContent.subject,
      message: assignedContent.message,
      assignedRole: role,
    });
    return { success: true };
  },
  updateAssuranceInspector: (setId, inspectorName) => {
    get().updateAssuranceStakeholder(setId, "Inspector", inspectorName);
  },
  completeVesselInspection: (vesselName, outcome) => {
    const state = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(state);
    if (!sessionUser || activePersona !== "Inspector") return [];

    const name = vesselName.trim().toLowerCase();
    /* only sets waiting on the inspection and assigned to this inspector move on */
    const completedIds = state.assuranceSets
      .filter(
        (s) =>
          s.vesselName?.trim().toLowerCase() === name &&
          s.mandatoryInspectionRequired &&
          !s.inspectionCompleted &&
          s.stage === "Inspection" &&
          isAssuranceSetAssignedToPersona(s, activePersona, activeDemoOrganization, sessionUser, state.users) &&
          getAssuranceSetRoleActions(s, activePersona, activeDemoOrganization, sessionUser).canInspect,
      )
      .map((s) => s.id);
    if (completedIds.length === 0) return [];

    /* a failed inspection completes nothing; the sets stay at the inspection stage, but records failure timestamp */
    if (outcome === "Fail") {
      const failedAtIso = new Date().toISOString();
      set((state) => ({
        assuranceSets: state.assuranceSets.map((s) =>
          completedIds.includes(s.id)
            ? { ...s, inspectionFailedAt: failedAtIso }
            : s,
        ),
      }));
      return [];
    }

    const prevSets = get().assuranceSets.filter((s) => completedIds.includes(s.id));

    set((state) => {
      const updatedSets = state.assuranceSets.map((s) =>
        completedIds.includes(s.id)
          ? recalculateSetReadiness({ ...s, inspectionCompleted: true, inspectionFailedAt: undefined })
          : s,
      );
      const { updatedProjects, updatedAssuranceSets } =
        syncAllAffectedProjectRollups(state.projects, updatedSets, completedIds);
      return { assuranceSets: updatedAssuranceSets, projects: updatedProjects };
    });

    prevSets.forEach((prev) => {
      const updated = get().assuranceSets.find((s) => s.id === prev.id);
      if (updated && prev.stage !== updated.stage) {
        logStageTransitionAudit(get, updated, prev.stage, updated.stage);
      }
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const previousSet = stateBefore.assuranceSets.find((set) => set.id === setId);
    if (
      !previousSet ||
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(previousSet, activePersona, activeDemoOrganization, sessionUser, stateBefore.users)
    ) {
      return;
    }
    const roleActions = getAssuranceSetRoleActions(previousSet, activePersona, activeDemoOrganization, sessionUser);
    const isDenialDecision = status === "Correction Requested" || status === "Rejected";
    if (!roleActions.canVerify && !(isDenialDecision && roleActions.canApprove)) {
      return;
    }

    const reviewedAt = new Date().toISOString();
    const reviewerId = getSessionActor(get).userId;
    const previousStatus = previousSet?.requirements.find((requirement) => requirement.id === reqId)?.verifierStatus;

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
                decisionTime: reviewedAt,
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
      target: { kind: "task", setId, taskId: reqId },
      fieldDelta: {
        fieldName: "Status",
        oldValue: previousStatus || "—",
        newValue: status,
      },
      justificationNotes:
        notes ||
        `Verifier status set to ${status}${isDenial ? " — Submitter revision required." : ""}`,
    });

    const updatedSet = get().assuranceSets.find((s) => s.id === setId);
    if (isDenial && updatedSet?.assignedApprover) {
      const requirement = updatedSet.requirements.find((r) => r.id === reqId);
      notifyAssuranceSetUser(
        get,
        updatedSet,
        updatedSet.assignedApprover,
        {
          type: "document_correction",
          subject: `Task sent back for review: ${requirement?.title || reqId}`,
          message: notes?.trim() || undefined,
          documentId: requirement?.documentId || requirement?.linkedDocumentId,
        },
        { systemSent: get().activePersona === "Approver" },
      );
    }
    if (previousSet && updatedSet && previousSet.stage !== updatedSet.stage) {
      logStageTransitionAudit(get, updatedSet, previousSet.stage, updatedSet.stage);
    }
  },
  isRequirementDone: (setId, requirementIdentifier) => {
    const s = get().assuranceSets.find((set) => set.id === setId);
    if (!s) return false;
    const identifier = requirementIdentifier.trim().toLowerCase();
    const matchingTasks = s.requirements.filter((r) =>
      r.id.toLowerCase() === identifier ||
      (r.requirementGroupId && r.requirementGroupId.toLowerCase() === identifier) ||
      (r.requirementGroupId && s.requirements.find((x) => x.id.toLowerCase() === identifier)?.requirementGroupId === r.requirementGroupId) ||
      r.title.trim().toLowerCase() === identifier
    );
    if (matchingTasks.length === 0) return false;
    return matchingTasks.every((t) =>
      t.isFulfilled ||
      t.verifierStatus === "Verified" ||
      (s.verificationRequired === false && Boolean(t.documentId || t.linkedDocumentId))
    );
  },
  getRequirementCompletionStatus: (setId, requirementIdentifier) => {
    const s = get().assuranceSets.find((set) => set.id === setId);
    if (!s) {
      return { isDone: false, totalTasks: 0, completedTasks: 0, pendingTasks: 0, partyStatuses: [] };
    }
    const identifier = requirementIdentifier.trim().toLowerCase();
    const matchingTasks = s.requirements.filter((r) =>
      r.id.toLowerCase() === identifier ||
      (r.requirementGroupId && r.requirementGroupId.toLowerCase() === identifier) ||
      (r.requirementGroupId && s.requirements.find((x) => x.id.toLowerCase() === identifier)?.requirementGroupId === r.requirementGroupId) ||
      r.title.trim().toLowerCase() === identifier
    );
    const totalTasks = matchingTasks.length;
    const completedTasks = matchingTasks.filter((t) =>
      t.isFulfilled ||
      t.verifierStatus === "Verified" ||
      (s.verificationRequired === false && Boolean(t.documentId || t.linkedDocumentId))
    ).length;
    const pendingTasks = totalTasks - completedTasks;
    const isDone = totalTasks > 0 && completedTasks === totalTasks;
    const partyStatuses = matchingTasks.map((t) => ({
      party: t.responsibleParty || t.assignedSubmitter || "Unassigned",
      taskId: t.id,
      status: t.verifierStatus || "Pending",
      isDone: t.isFulfilled || t.verifierStatus === "Verified" || (s.verificationRequired === false && Boolean(t.documentId || t.linkedDocumentId)),
    }));
    return { isDone, totalTasks, completedTasks, pendingTasks, partyStatuses };
  },
  denyRequirementByApprover: (setId, reqId, decision, notes) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const previousSet = stateBefore.assuranceSets.find((s) => s.id === setId);
    if (
      !previousSet ||
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(previousSet, activePersona, activeDemoOrganization, sessionUser, stateBefore.users) ||
      !getAssuranceSetRoleActions(previousSet, activePersona, activeDemoOrganization, sessionUser).canApprove
    ) {
      return;
    }
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
              decisionTime: new Date().toISOString(),
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

    const updatedSet = get().assuranceSets.find((s) => s.id === setId);
    if (updatedSet?.assignedApprover) {
      const requirement = updatedSet.requirements.find((r) => r.id === reqId);
      notifyAssuranceSetUser(
        get,
        updatedSet,
        updatedSet.assignedApprover,
        {
          type: "document_correction",
          subject: `Task sent back for review: ${requirement?.title || requirementTitle}`,
          message: notes?.trim() || undefined,
          documentId: requirement?.documentId || requirement?.linkedDocumentId,
        },
        { systemSent: get().activePersona === "Approver" },
      );
    }
    if (previousSet && updatedSet && previousSet.stage !== updatedSet.stage) {
      logStageTransitionAudit(get, updatedSet, previousSet.stage, updatedSet.stage);
    }
  },
  setApproverDecision: (setId, decision, notes) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const previousSet = stateBefore.assuranceSets.find((s) => s.id === setId);
    if (
      !previousSet ||
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(previousSet, activePersona, activeDemoOrganization, sessionUser, stateBefore.users)
    ) {
      return;
    }
    const roleActions = getAssuranceSetRoleActions(previousSet, activePersona, activeDemoOrganization, sessionUser);
    if (!roleActions.canApprove && !(activePersona === "C Admin" && roleActions.canManage)) {
      return;
    }

    const isDenial =
      decision === "Returned for Correction" || decision === "Rejected";
    const mappedStatus: "Correction Requested" | "Rejected" =
      decision === "Returned for Correction"
        ? "Correction Requested"
        : "Rejected";
    if (decision === "Approved" && previousSet) {
      const openMandatory = (previousSet.requirements || []).filter(
        (r) =>
          r.isMandatory &&
          !r.exemption &&
          !r.isFulfilled &&
          r.verifierStatus !== "Verified" &&
          r.verifierStatus !== "Waived" &&
          previousSet.verificationRequired !== false,
      );
      if (openMandatory.length > 0) {
        return;
      }
    }
    const closedOptionalTasks: AssuranceRequirement[] = [];

    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        const updatedReqs: AssuranceRequirement[] = isDenial
          ? s.requirements.map((r) => {
              return {
                ...r,
                verifierStatus: mappedStatus,
                decisionTime: new Date().toISOString(),
                isFulfilled: false,
                verifiedVersion: undefined,
                notes:
                  notes ||
                  `Campaign returned to verification stage by Executive Approver.`,
              };
            })
          : decision === "Approved"
            ? s.requirements.map((r) => {
                if (!r.isMandatory && r.verifierStatus !== "Verified" && r.verifierStatus !== "Waived" && r.verifierStatus !== "Not Done") {
                  closedOptionalTasks.push(r);
                  return {
                    ...r,
                    verifierStatus: "Not Done" as const,
                    isFulfilled: false,
                    notes: "Closed as not done upon set closure.",
                  };
                }
                return r;
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

    for (const r of closedOptionalTasks) {
      get().logAuditEvent({
        action: "Task Closed - Not Done",
        targetAsset: `${setId} / ${r.title}`,
        target: { kind: "set", setId, requirementId: r.id },
        justificationNotes: "Closed as not done upon set closure.",
      });
    }

    const pingTag = isDenial ? " [PING: SUBMITTER ACTION REQUIRED]" : "";
    get().logAuditEvent({
      action: `Approver Final Decision: ${decision}${pingTag}`,
      targetAsset: `Assurance Set ${setId}`,
      justificationNotes:
        notes ||
        `Executive decision: ${decision}${isDenial ? " — Submitter revision ping dispatched." : ""}`,
    });

    const decidedSet = get().assuranceSets.find((s) => s.id === setId);
    if (previousSet && decidedSet && previousSet.stage !== decidedSet.stage) {
      logStageTransitionAudit(get, decidedSet, previousSet.stage, decidedSet.stage);
    }
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const previousSet = stateBefore.assuranceSets.find((s) => s.id === setId);
    if (
      !previousSet ||
      !sessionUser ||
      activePersona !== "C Admin" ||
      !isAssuranceSetAssignedToPersona(previousSet, activePersona, activeDemoOrganization, sessionUser, stateBefore.users) ||
      !getAssuranceSetRoleActions(previousSet, activePersona, activeDemoOrganization, sessionUser).canManage
    ) {
      return;
    }
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

    const updatedSet = get().assuranceSets.find((s) => s.id === setId);
    if (previousSet && updatedSet && previousSet.stage !== updatedSet.stage) {
      logStageTransitionAudit(get, updatedSet, previousSet.stage, updatedSet.stage);
    }

    const reviewSet = get().assuranceSets.find((s) => s.id === setId);
    if (reviewSet) {
      notifyAssuranceSetUser(get, reviewSet, reviewSet.assignedVerifier, {
        type: "review_requested",
        subject: `Review requested: ${reviewSet.title}`,
      });
    }
  },

  setClientApproval: (setId, decision, notes) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const previousSet = stateBefore.assuranceSets.find((s) => s.id === setId);
    if (
      !previousSet ||
      !sessionUser ||
      !isAssuranceSetAssignedToPersona(previousSet, activePersona, activeDemoOrganization, sessionUser, stateBefore.users)
    ) {
      return;
    }
    const roleActions = getAssuranceSetRoleActions(previousSet, activePersona, activeDemoOrganization, sessionUser);
    if (!(activePersona === "C Admin" && roleActions.canManage) && !roleActions.canApprove) {
      return;
    }
    /* try the full approver path first; it may no-op when mandatory tasks are still open */
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
          /* always record the client decision even when setApproverDecision gated out */
          approverDecision: decision,
          approverNotes: notes,
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    if (!sessionUser || (activePersona !== "Administrator" && activePersona !== "Submitter")) {
      return;
    }
    const lookupContext = {
      vessels: stateBefore.vessels,
      crew: stateBefore.crew,
      equipment: stateBefore.equipment,
      assuranceObjects: stateBefore.assuranceObjects,
      assuranceSets: stateBefore.assuranceSets,
    };
    const resolvedTarget = resolveDocumentTargetObject(doc, lookupContext);
    if (resolvedTarget) {
      const duplicate = findDuplicateObjectDocumentTitle(
        stateBefore.documents,
        resolvedTarget,
        doc.title,
        {
          ...lookupContext,
          excludeDocId: doc.id,
        },
      );
      if (duplicate) {
        get().logAuditEvent({
          action: "Blocked Duplicate Document Title",
          targetAsset: `${resolvedTarget.name} (${resolvedTarget.id})`,
          justificationNotes: `A document titled "${doc.title}" already exists on ${resolvedTarget.name}. Upload a new version of ${duplicate.id} instead.`,
        });
        return;
      }
    }
    /* stamp owning org when missing so FR-16 / A16 can resolve ownership later */
    const ownerOrganization =
      doc.ownerOrganization?.trim() ||
      activeDemoOrganization?.trim() ||
      sessionUser.organization?.trim() ||
      undefined;
    const prepared: MasterDocument = {
      ...doc,
      ...(ownerOrganization ? { ownerOrganization } : {}),
      ...(resolvedTarget
        ? {
            targetObjectType: doc.targetObjectType || resolvedTarget.type,
            targetObjectId: doc.targetObjectId || resolvedTarget.id,
            targetObjectName: doc.targetObjectName || resolvedTarget.name,
            entityType: doc.entityType || getEntityTypeForObjectType(resolvedTarget.type),
            vesselId:
              resolvedTarget.type === "vessel"
                ? doc.vesselId || resolvedTarget.id
                : doc.vesselId,
          }
        : {}),
    };
    /* the validation rules run on upload, so the reviewer sees results, not "not checked" */
    set((state) => ({ documents: [...state.documents, withDocumentChecks(prepared, state.vessels)] }));
    get().logAuditEvent({
      action: "Uploaded New Master Document",
      targetAsset: resolvedTarget
        ? `${prepared.id} (${prepared.title}) -> ${resolvedTarget.name}`
        : `${prepared.id} (${prepared.title})`,
      justificationNotes: `Uploaded certificate ${prepared.certificateNo}`,
    });
  },
  linkDocumentToVessel: (docId, vesselId, vesselName, imoNumber) => {
    const stateBefore = get();
    const { sessionUser, activePersona } = getStoreSessionActor(stateBefore);
    if (!sessionUser || (activePersona !== "Administrator" && activePersona !== "Submitter")) {
      return;
    }
    const matchedVessel = stateBefore.vessels.find((v) => v.id === vesselId);
    const resolvedName = vesselName || matchedVessel?.name || vesselId;
    set((state) => ({
      documents: state.documents.map((d) => {
        if (d.id !== docId) return d;
        return {
          ...d,
          vesselId,
          targetObjectType: "vessel" as const,
          targetObjectId: vesselId,
          targetObjectName: resolvedName,
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
  linkDocumentToObject: (docId, objectType, objectId, objectName) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || undefined;
    const targetDoc = stateBefore.documents.find((d) => d.id === docId);
    if (!sessionUser || (activePersona !== "Administrator" && activePersona !== "Submitter")) {
      return { success: false, message: "Only Administrators and Submitters can link documents to objects." };
    }
    if (!targetDoc) {
      return { success: false, message: "Document not found." };
    }
    if (
      !canEditOwnedEvidence(targetDoc, effectiveOrg, {
        persona: activePersona,
        vessels: stateBefore.vessels,
        users: stateBefore.users,
        equipment: stateBefore.equipment,
        crew: stateBefore.crew,
        assuranceObjects: stateBefore.assuranceObjects,
      })
    ) {
      return { success: false, message: EVIDENCE_NOT_OWNED_EDIT };
    }
    const lookupContext = {
      vessels: stateBefore.vessels,
      crew: stateBefore.crew,
      equipment: stateBefore.equipment,
      assuranceObjects: stateBefore.assuranceObjects,
      assuranceSets: stateBefore.assuranceSets,
    };
    const resolvedTarget = resolveDocumentTargetObject(
      {
        ...targetDoc,
        targetObjectType: objectType,
        targetObjectId: objectId,
        targetObjectName: objectName,
        vesselId: objectType === "vessel" ? objectId : "",
      },
      lookupContext,
    ) || { type: objectType, id: objectId, name: objectName || objectId };

    const duplicate = findDuplicateObjectDocumentTitle(
      stateBefore.documents,
      resolvedTarget,
      targetDoc.title,
      { ...lookupContext, excludeDocId: docId },
    );
    if (duplicate) {
      const message = `A document titled "${targetDoc.title}" already exists on ${resolvedTarget.name}.`;
      get().logAuditEvent({
        action: "Blocked Duplicate Document Title",
        targetAsset: `${resolvedTarget.name} (${resolvedTarget.id})`,
        justificationNotes: message,
      });
      return { success: false, message };
    }

    set((state) => ({
      documents: state.documents.map((d) => {
        if (d.id !== docId) return d;
        return withDocumentChecks(
          {
            ...d,
            targetObjectType: objectType,
            targetObjectId: objectId,
            targetObjectName: resolvedTarget.name,
            vesselId: objectType === "vessel" ? objectId : d.vesselId,
          },
          state.vessels,
        );
      }),
    }));

    get().logAuditEvent({
      action: "Linked Document to Object",
      targetAsset: `${docId} -> ${resolvedTarget.name} (${resolvedTarget.id})`,
      justificationNotes: `Referenced object set to ${resolvedTarget.name}.`,
    });
    return { success: true };
  },
  uploadDocumentForRequirement: (setId, requirementId, doc, inspectionReport) => {
    /* the document this upload replaces on the requirement, if any */
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const previousSet = stateBefore.assuranceSets.find((s) => s.id === setId);
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !previousSet ||
      isClosedAssuranceSet(previousSet) ||
      previousSet.stage === "Cancelled" ||
      !isAssuranceSetAssignedToPersona(previousSet, activePersona, activeDemoOrganization, sessionUser, stateBefore.users) ||
      !getAssuranceSetRoleActions(previousSet, activePersona, activeDemoOrganization, sessionUser).canUpload
    ) {
      return;
    }
    const replacedDocumentId = previousSet.requirements.find((r) => r.id === requirementId)?.documentId;
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser.organization?.trim() || undefined;
    const lookupContext = {
      vessels: stateBefore.vessels,
      crew: stateBefore.crew,
      equipment: stateBefore.equipment,
      assuranceObjects: stateBefore.assuranceObjects,
      assuranceSets: stateBefore.assuranceSets,
    };
    const targetReq = requirementId
      ? previousSet.requirements.find((r) => r.id === requirementId)
      : undefined;
    /* A16: linking an existing library document is reuse — Vendor-owned evidence only */
    const alreadyInLibrary = stateBefore.documents.some((d) => d.id === doc.id);
    if (alreadyInLibrary && previousSet) {
      if (
        !canOfferEvidenceReuse(previousSet, effectiveOrg) ||
        !isReusableLibraryDocument(doc, previousSet, stateBefore.vessels, stateBefore.users)
      ) {
        get().logAuditEvent({
          action: "Blocked evidence reuse [A16]",
          targetAsset: `${doc.id} -> ${setId} / ${requirementId || "Other Documents"}`,
          justificationNotes: EVIDENCE_REUSE_VENDOR_ONLY,
        });
        return;
      }
    }

    let resolvedTarget = resolveDocumentTargetObject(doc, lookupContext);
    if (!resolvedTarget && previousSet) {
      if (targetReq?.targetObjectId) {
        const reqObj = getAssuranceSetObjects(previousSet).find((o) => o.id === targetReq.targetObjectId) ||
          stateBefore.assuranceObjects.find((o) => o.id === targetReq.targetObjectId);
        if (reqObj) {
          resolvedTarget = {
            type: reqObj.type,
            id: reqObj.id,
            name: reqObj.name,
            identifier: reqObj.identifier,
            ownerOrganization: reqObj.ownerOrganization,
          };
        }
      } else if (previousSet.equipmentId) {
        resolvedTarget = {
          type: "equipment",
          id: previousSet.equipmentId,
          name: previousSet.equipmentName || previousSet.equipmentId,
        };
      } else if (previousSet.crewId) {
        resolvedTarget = {
          type: "person",
          id: previousSet.crewId,
          name: previousSet.crewName || previousSet.crewId,
        };
      } else if (previousSet.vesselId) {
        resolvedTarget = {
          type: "vessel",
          id: previousSet.vesselId,
          name: previousSet.vesselName || previousSet.vesselId,
        };
      }
    }

    if (!alreadyInLibrary && resolvedTarget) {
      const duplicate = findDuplicateObjectDocumentTitle(
        stateBefore.documents,
        resolvedTarget,
        doc.title,
        { ...lookupContext, excludeDocId: doc.id },
      );
      if (duplicate) {
        get().logAuditEvent({
          action: "Blocked Duplicate Document Title",
          targetAsset: `${resolvedTarget.name} (${resolvedTarget.id})`,
          justificationNotes: `A document titled "${doc.title}" already exists on ${resolvedTarget.name}. Upload a new version of ${duplicate.id} instead.`,
        });
        return;
      }
    }

    const preparedDoc: MasterDocument = {
      ...doc,
      ownerOrganization: doc.ownerOrganization?.trim() || effectiveOrg,
      ...(resolvedTarget
        ? {
            targetObjectType: doc.targetObjectType || resolvedTarget.type,
            targetObjectId: doc.targetObjectId || resolvedTarget.id,
            targetObjectName: doc.targetObjectName || resolvedTarget.name,
            vesselId:
              resolvedTarget.type === "vessel"
                ? doc.vesselId || resolvedTarget.id
                : doc.vesselId,
          }
        : {}),
    };
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
            const isResubmission = Boolean(r.documentId || r.linkedDocumentId || r.attemptNumber);
            const nextAttempt = isResubmission ? (r.attemptNumber || 1) + 1 : (r.attemptNumber || 1);
            return {
              ...r,
              documentId: preparedDoc.id,
              documentVersion: preparedDoc.currentVersion,
              verifierStatus: "Pending" as const,
              decisionTime: undefined,
              attemptNumber: nextAttempt,
              isFulfilled: false,
              ocrConfidence: preparedDoc.ocrConfidence,
              inspectionReport: inspectionReport ?? r.inspectionReport,
              reuploadRequested: undefined,
              notes: `Upload linked to requirement (${preparedDoc.versions[0]?.fileName || preparedDoc.title}).`,
            };
          });
        } else {
          const newReq: AssuranceRequirement = {
            id: `req-other-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            category:
              preparedDoc.entityType === "Crew Certificate"
                ? "Crew Credential"
                : "Statutory Certificate",
            title: preparedDoc.title,
            isMandatory: false,
            isFulfilled: false,
            ocrConfidence: preparedDoc.ocrConfidence || 99,
            documentId: preparedDoc.id,
            documentVersion: preparedDoc.currentVersion || "v1.0",
            verifierStatus: "Pending",
            decisionTime: undefined,
            attemptNumber: 1,
            isOtherDocument: true,
            notes: `Uploaded additional document (${preparedDoc.versions?.[0]?.fileName || preparedDoc.title}).`,
          };
          updatedReqs.push(newReq);
        }

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
        };

        return recalculateSetReadiness(candidateSet);
      });

      const updatedDocs = state.documents.some((d) => d.id === preparedDoc.id)
        ? state.documents
        : [...state.documents, withDocumentChecks(preparedDoc, state.vessels)];

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
      targetAsset: `${preparedDoc.id} -> ${setId} / ${requirementId || "Other Documents"}`,
      justificationNotes: `Upload: ${preparedDoc.title} (${preparedDoc.certificateNo}) queued for verifier review.`,
    });

    const updatedSet = get().assuranceSets.find((s) => s.id === setId);
    if (previousSet && updatedSet && previousSet.stage !== updatedSet.stage) {
      logStageTransitionAudit(get, updatedSet, previousSet.stage, updatedSet.stage);
    }

    /* a submitted document goes straight to the set's verifier, when one is appointed */
    notifySubmittedForReview(get, setId, requirementId, preparedDoc.id);

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
    const stateForGuard = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateForGuard);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || undefined;
    const matchingDoc = stateForGuard.documents.find((d) => d.id === docId);
    if (!matchingDoc) return;
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !canEditOwnedEvidence(matchingDoc, effectiveOrg, {
        persona: activePersona,
        vessels: stateForGuard.vessels,
        users: stateForGuard.users,
        equipment: stateForGuard.equipment,
        crew: stateForGuard.crew,
        assuranceObjects: stateForGuard.assuranceObjects,
      })
    ) {
      get().logAuditEvent({
        action: "Blocked evidence edit [FR-16]",
        targetAsset: `${matchingDoc.id} (${matchingDoc.title})`,
        justificationNotes: EVIDENCE_NOT_OWNED_EDIT,
      });
      return;
    }
    const prevVersionLabel =
      matchingDoc?.versions?.[0]?.versionLabel ||
      matchingDoc?.currentVersion ||
      "v1.0";
    const prevMatchingSets = stateForGuard.assuranceSets.filter((s) =>
      s.requirements.some((r) => r.documentId === docId || r.linkedDocumentId === docId),
    );
    if (scope?.assuranceSetId) {
      const scopedSet = stateForGuard.assuranceSets.find((s) => s.id === scope.assuranceSetId);
      if (
        !scopedSet ||
        isClosedAssuranceSet(scopedSet) ||
        scopedSet.stage === "Cancelled" ||
        !isAssuranceSetAssignedToPersona(scopedSet, activePersona, effectiveOrg, sessionUser, stateForGuard.users) ||
        !getAssuranceSetRoleActions(scopedSet, activePersona, effectiveOrg, sessionUser).canUpload
      ) {
        return;
      }
    } else {
      const openMatchingSets = prevMatchingSets.filter(
        (s) => !isClosedAssuranceSet(s) && s.stage !== "Cancelled",
      );
      if (
        openMatchingSets.length > 0 &&
        !openMatchingSets.some(
          (s) =>
            isAssuranceSetAssignedToPersona(s, activePersona, effectiveOrg, sessionUser, stateForGuard.users) &&
            getAssuranceSetRoleActions(s, activePersona, effectiveOrg, sessionUser).canUpload,
        )
      ) {
        return;
      }
    }
    const targetSet = scope
      ? stateForGuard.assuranceSets.find((s) => s.id === scope.assuranceSetId)
      : prevMatchingSets[0];

    /* open sets that use the document but were not the one the version was submitted for */
    const noticeSetIds: string[] = [];
    set((state) => {
      const updatedDocs = state.documents.map((d) => {
        if (d.id !== docId) return d;
        const newVersionObj = {
          versionLabel: newVersionLabel,
          uploadedAt: new Date().toISOString(),
          uploadedBy: getSessionActor(get).userId,
          uploadedByUserId: getSessionActor(get).userId,
          fileSizeBytes,
          fileName,
          changeSummary,
          attemptNumber: (d.versions[0]?.attemptNumber || d.versions.length) + 1,
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
      const changedSetIds: string[] = [];
      const updatedSets = state.assuranceSets.map((s) => {
        /* a new version of a shared library document must not reopen a set that is already approved */
        if (isClosedAssuranceSet(s) || s.stage === "Cancelled") return s;
        const setCanUpload =
          isAssuranceSetAssignedToPersona(s, activePersona, effectiveOrg, sessionUser, state.users) &&
          getAssuranceSetRoleActions(s, activePersona, effectiveOrg, sessionUser).canUpload;
        if (!setCanUpload) {
          const usesDocument = s.requirements.some((r) => r.documentId === docId || r.linkedDocumentId === docId);
          if (usesDocument && !noticeSetIds.includes(s.id)) {
            noticeSetIds.push(s.id);
          }
          return s;
        }
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
            const nextAttempt = (r.attemptNumber || 1) + 1;
            return {
              ...r,
              documentId: docId,
              documentVersion: newVersionLabel,
              verifiedVersion: undefined,
              verifierStatus: "Pending" as const,
              decisionTime: undefined,
              attemptNumber: nextAttempt,
              isFulfilled: false,
              ocrConfidence: 98,
              reuploadRequested: undefined,
              notes:
                changeSummary ||
                `Replacement revision ${newVersionLabel} uploaded by submitter.`,
            };
          }
          return r;
        });

        if (!hasMatchedReq) return s;

        changedSetIds.push(s.id);
        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
        };

        return recalculateSetReadiness(candidateSet);
      });

      const { updatedProjects: syncedProjects, updatedAssuranceSets: syncedSets } =
        changedSetIds.length > 0
          ? syncAllAffectedProjectRollups(state.projects, updatedSets, changedSetIds)
          : { updatedProjects: state.projects, updatedAssuranceSets: updatedSets };

      return {
        documents: updatedDocs,
        assuranceSets: syncedSets,
        projects: syncedProjects,
      };
    });

    get().logAuditEvent({
      action: `Uploaded Document Revision ${newVersionLabel}`,
      targetAsset: `${targetSet ? `${targetSet.id} · ` : ""}Document ${docId} (${matchingDoc?.title || "Document"})`,
      target: {
        kind: "document",
        setId: targetSet?.id || "unscoped",
        documentId: docId,
        version: newVersionLabel,
      },
      fieldDelta: {
        fieldName: "Version",
        oldValue: prevVersionLabel,
        newValue: newVersionLabel,
      },
      documentStatusDelta: {
        documentId: docId,
        oldStatus: matchingDoc?.verificationStatus || "Correction Requested",
        newStatus: "Pending Verification",
      },
      justificationNotes: changeSummary,
    });

    prevMatchingSets.forEach((prev) => {
      const updated = get().assuranceSets.find((s) => s.id === prev.id);
      if (updated && prev.stage !== updated.stage) {
        logStageTransitionAudit(get, updated, prev.stage, updated.stage);
      }
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
    const stateBefore = get();
    const { sessionUser, activePersona: sessionPersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    if (!sessionUser) return;
    const setsBeforeVerification = stateBefore.assuranceSets;
    const reviewedAt = new Date().toISOString();
    const reviewerId = getSessionActor(get).userId;
    /* a decision belongs to one requirement on one set; without a requirement nothing on any set changes */
    const reviewedSetId = requirementId
      ? assuranceSetId ||
        setsBeforeVerification.find((s) => s.requirements.some((r) => r.id === requirementId))?.id
      : undefined;
    const isDenialDecision = status === "Correction Requested" || status === "Rejected";
    if (reviewedSetId) {
      const reviewedSet = setsBeforeVerification.find((s) => s.id === reviewedSetId);
      if (
        !reviewedSet ||
        !isAssuranceSetAssignedToPersona(reviewedSet, sessionPersona, activeDemoOrganization, sessionUser, stateBefore.users)
      ) {
        return;
      }
      const roleActions = getAssuranceSetRoleActions(reviewedSet, sessionPersona, activeDemoOrganization, sessionUser);
      if (!roleActions.canVerify && !(isDenialDecision && roleActions.canApprove)) {
        return;
      }
    } else if (
      sessionPersona !== "Verifier" &&
      sessionPersona !== "C Admin" &&
      !(isDenialDecision && sessionPersona === "Approver")
    ) {
      return;
    }
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
                decisionTime: reviewedAt,
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
        if (s.assignedApprover) {
          const req = s.requirements.find((r) => r.id === requirementId);
          notifyAssuranceSetUser(
            get,
            s,
            s.assignedApprover,
            {
              type: "document_correction",
              subject: `Task sent back for review: ${req?.title || verifiedDoc?.title || docId}`,
              message: notes?.trim() || undefined,
              documentId: docId,
            },
            { systemSent: get().activePersona === "Approver" },
          );
        }
      }

      /* a set that has just reached the approval stage goes to its approver */
      const previousStage = setsBeforeVerification.find((prev) => prev.id === s.id)?.stage;
      if (previousStage && previousStage !== s.stage) {
        logStageTransitionAudit(get, s, previousStage, s.stage);
      }
      if (s.stage === "Approval" && previousStage !== "Approval") {
        notifyAssuranceSetUser(get, s, s.assignedApprover, {
          type: "approval_requested",
          subject: `Approval requested: ${s.title}`,
        });
      }
    });
  },

  // Audit Events
  auditEvents: [...SEEDED_AUDIT_EVENTS, ...MOCK_AUDIT_TRAIL],
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    if (!sessionUser || (activePersona !== "Administrator" && activePersona !== "Submitter")) {
      return;
    }
    const effectiveOrg = sessionUser.organization || activeDemoOrganization;
    if (newCrew.organization?.trim() && !orgFieldMatches(effectiveOrg, newCrew.organization)) {
      return;
    }
    const storedCrew: CrewMember = newCrew.organization?.trim()
      ? newCrew
      : { ...newCrew, organization: effectiveOrg };
    /* convert all layer 1 and layer 2 certificates attached to new crew into MasterDocument entries */
    const allCrewDocs = [
      ...storedCrew.layer1CoreDocuments,
      ...storedCrew.layer2Endorsements,
    ];
    const newMasterDocs: MasterDocument[] = allCrewDocs.map((doc) => {
      const isExpired =
        doc.verificationStatus === "Expired" ||
        new Date(doc.expiryDate).getTime() < Date.now();
      return {
        id: doc.id,
        title: `${doc.title} — ${storedCrew.fullName}`,
        entityType: "Crew Certificate",
        vesselId: storedCrew.currentVesselId || "",
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
          crewName: storedCrew.fullName,
          passportId: storedCrew.passportNo,
          rank: storedCrew.rank,
          certType: doc.stcwRegulation || doc.title,
          issuingCenter: doc.issuingAuthority,
          issueDate: doc.issueDate,
          expiryDate: doc.expiryDate,
          assignedVessel: storedCrew.currentVesselName || "",
          nationality: storedCrew.nationality,
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
        crew: [storedCrew, ...state.crew],
        assuranceObjects: [...state.assuranceObjects, crewToAssuranceObject(storedCrew)],
        documents: [...filteredNewDocs, ...state.documents],
      };
    });

    get().logAuditEvent({
      action: "Registered Crew Member",
      targetAsset: `${storedCrew.fullName} (${storedCrew.rank})`,
      justificationNotes: `Registered crew member with Seaman's Book ${storedCrew.seamansBookNo}`,
    });
  },
  updateCrewMember: (updatedCrew) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = sessionUser?.organization || activeDemoOrganization;
    const existingCrew = stateBefore.crew.find((c) => c.id === updatedCrew.id);
    if (
      !existingCrew ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !isCrewOwnedByOrganization(existingCrew, effectiveOrg)
    ) {
      return;
    }
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = sessionUser?.organization || activeDemoOrganization;
    const targetCrewRecord = stateBefore.crew.find((c) => c.id === crewId);
    if (
      !targetCrewRecord ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !isCrewOwnedByOrganization(targetCrewRecord, effectiveOrg)
    ) {
      return;
    }
    const vessel = vesselId ? stateBefore.vessels.find((v) => v.id === vesselId) : undefined;
    if (vesselId && (!vessel || !isVesselOwnedByClientOrg(vessel, effectiveOrg))) {
      return;
    }
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
    const stateBefore = get();
    const person = stateBefore.assuranceObjects.find((object) => object.id === personId && object.type === "person");
    if (!person) return { success: false, message: "That person is not an assurance object." };
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = sessionUser?.organization || activeDemoOrganization;
    if (!sessionUser || (activePersona !== "Administrator" && activePersona !== "Submitter")) {
      return { success: false, message: "Only authorized staff of the owning organization can update crew assignments." };
    }
    const targetCrew = stateBefore.crew.find((c) => c.id === personId);
    const ownsPerson = targetCrew
      ? isCrewOwnedByOrganization(targetCrew, effectiveOrg)
      : Boolean(person.ownerOrganization) && orgFieldMatches(effectiveOrg, person.ownerOrganization);
    if (!ownsPerson) {
      return { success: false, message: "Only authorized staff of the owning organization can update crew assignments." };
    }
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim();
    const targetCrew = stateBefore.crew.find((c) => c.id === crewId);
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !targetCrew ||
      !isCrewOwnedByOrganization(targetCrew, effectiveOrg || "")
    ) {
      return;
    }
    const duplicateCrewDoc = findDuplicateObjectDocumentTitle(
      stateBefore.documents,
      { type: "person", id: targetCrew.id, name: targetCrew.fullName },
      doc.title,
      {
        excludeDocId: doc.id,
        vessels: stateBefore.vessels,
        crew: stateBefore.crew,
        equipment: stateBefore.equipment,
        assuranceObjects: stateBefore.assuranceObjects,
        assuranceSets: stateBefore.assuranceSets,
      },
    );
    if (duplicateCrewDoc) {
      get().logAuditEvent({
        action: "Blocked Duplicate Document Title",
        targetAsset: `Crew ${targetCrew.fullName} (${targetCrew.id})`,
        justificationNotes: `A certificate titled "${doc.title}" already exists for ${targetCrew.fullName}. Upload a new version instead.`,
      });
      return;
    }
    const isExpired =
      doc.verificationStatus === "Expired" ||
      new Date(doc.expiryDate).getTime() < Date.now();
    const newMasterDoc: MasterDocument = {
      id: doc.id,
      title: `${doc.title} — ${targetCrew.fullName}`,
      entityType: "Crew Certificate",
      vesselId: targetCrew.currentVesselId || "",
      ownerOrganization: effectiveOrg || targetCrew.organization || targetCrew.manningAgency,
      targetObjectType: "person",
      targetObjectId: targetCrew.id,
      targetObjectName: targetCrew.fullName,
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim();
    const targetCrew = stateBefore.crew.find((c) => c.id === crewId);
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !targetCrew ||
      !isCrewOwnedByOrganization(targetCrew, effectiveOrg || "")
    ) {
      return;
    }
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
            const nextVer = getNextVersionLabel(d.versions, d.currentVersion);
            return {
              ...d,
              title: `${doc.title} — ${targetCrew.fullName}`,
              targetObjectType: "person" as const,
              targetObjectId: targetCrew.id,
              targetObjectName: targetCrew.fullName,
              ownerOrganization: d.ownerOrganization || effectiveOrg || targetCrew.organization,
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
              currentVersion: nextVer,
              versions: [
                {
                  versionLabel: nextVer,
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
              title: `${doc.title} — ${targetCrew.fullName}`,
              entityType: "Crew Certificate" as const,
              vesselId: targetCrew.currentVesselId || "",
              ownerOrganization: effectiveOrg || targetCrew.organization || targetCrew.manningAgency,
              targetObjectType: "person" as const,
              targetObjectId: targetCrew.id,
              targetObjectName: targetCrew.fullName,
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
              crewAttributes: {
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
              },
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = sessionUser?.organization || activeDemoOrganization;
    const targetCrew = stateBefore.crew.find((c) => c.id === crewId);
    if (
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !targetCrew ||
      !isCrewOwnedByOrganization(targetCrew, effectiveOrg || "")
    ) {
      return;
    }
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

  // Crew Groups
  crewGroups: MOCK_CREW_GROUPS,
  addCrewGroup: (newGroup) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    if (!sessionUser || (activePersona !== "Administrator" && activePersona !== "Submitter")) {
      return;
    }
    const effectiveOrg = sessionUser.organization || activeDemoOrganization;
    if (newGroup.organization?.trim() && !orgFieldMatches(effectiveOrg, newGroup.organization)) {
      return;
    }
    const storedGroup: CrewGroup = newGroup.organization?.trim()
      ? newGroup
      : { ...newGroup, organization: effectiveOrg };
    set((state) => ({
      crewGroups: [...state.crewGroups, storedGroup],
    }));
    get().logAuditEvent({
      action: "Created Crew Group",
      targetAsset: `${storedGroup.name} (${storedGroup.id})`,
      justificationNotes: `Created crew group with ${storedGroup.memberIds.length} initial member(s).`,
    });
  },
  updateCrewGroup: (updatedGroup) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = sessionUser?.organization || activeDemoOrganization;
    const existingGroup = stateBefore.crewGroups.find((g) => g.id === updatedGroup.id);
    if (
      !existingGroup ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !existingGroup.organization ||
      !orgFieldMatches(effectiveOrg, existingGroup.organization)
    ) {
      return;
    }
    set((state) => ({
      crewGroups: state.crewGroups.map((g) =>
        g.id === updatedGroup.id
          ? { ...g, ...updatedGroup, updatedAt: new Date().toISOString() }
          : g
      ),
    }));
    get().logAuditEvent({
      action: "Updated Crew Group",
      targetAsset: `Crew Group ${updatedGroup.id}`,
      justificationNotes: `Updated details for crew group ${updatedGroup.id}.`,
    });
  },
  setCrewGroupMembers: (groupId, memberIds) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = sessionUser?.organization || activeDemoOrganization;
    const existingGroup = stateBefore.crewGroups.find((g) => g.id === groupId);
    if (
      !existingGroup ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !existingGroup.organization ||
      !orgFieldMatches(effectiveOrg, existingGroup.organization)
    ) {
      return;
    }
    set((state) => ({
      crewGroups: state.crewGroups.map((g) =>
        g.id === groupId
          ? { ...g, memberIds, updatedAt: new Date().toISOString() }
          : g
      ),
    }));
    get().logAuditEvent({
      action: "Updated Crew Group Roster",
      targetAsset: `Crew Group ${groupId}`,
      justificationNotes: `Updated roster for crew group ${groupId} (${memberIds.length} members).`,
    });
  },
  addMemberToCrewGroup: (groupId, memberId) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = sessionUser?.organization || activeDemoOrganization;
    const existingGroup = stateBefore.crewGroups.find((g) => g.id === groupId);
    if (
      !existingGroup ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !existingGroup.organization ||
      !orgFieldMatches(effectiveOrg, existingGroup.organization)
    ) {
      return;
    }
    set((state) => ({
      crewGroups: state.crewGroups.map((g) => {
        if (g.id !== groupId) return g;
        if (g.memberIds.includes(memberId)) return g;
        return {
          ...g,
          memberIds: [...g.memberIds, memberId],
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },
  removeMemberFromCrewGroup: (groupId, memberId) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const effectiveOrg = sessionUser?.organization || activeDemoOrganization;
    const existingGroup = stateBefore.crewGroups.find((g) => g.id === groupId);
    if (
      !existingGroup ||
      !sessionUser ||
      (activePersona !== "Administrator" && activePersona !== "Submitter") ||
      !existingGroup.organization ||
      !orgFieldMatches(effectiveOrg, existingGroup.organization)
    ) {
      return;
    }
    set((state) => ({
      crewGroups: state.crewGroups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          memberIds: g.memberIds.filter((id) => id !== memberId),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },

  isAuditDrawerOpen: false,
  setAuditDrawerOpen: (open) => set({ isAuditDrawerOpen: open }),

  // CAPA Management Store Implementation
  capaItems: MOCK_CAPA_ITEMS,
  addCapaItem: (capa) => {
    const stateBefore = get();
    const { sessionUser, activePersona } = getStoreSessionActor(stateBefore);
    if (!sessionUser || activePersona !== "Inspector" || !canAccessCapaInSession(stateBefore, capa)) {
      return;
    }
    set((state) => ({ capaItems: [capa, ...state.capaItems] }));
  },
  updateCapaStatus: (capaId, status, inspectorNotes) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const current = stateBefore.capaItems.find((item) => item.id === capaId);
    if (!current || !sessionUser || activePersona !== "Inspector" || !canAccessCapaInSession(stateBefore, current)) {
      return;
    }
    const closing = status === "Verified & Closed" && current.status !== "Verified & Closed";
    const closedDate =
      status === "Verified & Closed"
        ? closing
          ? new Date().toISOString()
          : current.closedDate || new Date().toISOString()
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
      const stateAfter = get();
      const relatedSet = stateAfter.assuranceSets.find(
        (s) =>
          (current.assuranceSetId
            ? s.id === current.assuranceSetId
            : (Boolean(current.vesselId) && s.vesselId === current.vesselId) ||
              (Boolean(current.vesselName) &&
                Boolean(s.vesselName) &&
                s.vesselName.trim().toLowerCase() === current.vesselName.trim().toLowerCase())) &&
          isAssuranceSetAssignedToPersona(
            s,
            activePersona,
            activeDemoOrganization,
            sessionUser,
            stateAfter.users,
          ) &&
          Boolean(s.mandatoryInspectionRequired),
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
    const stateBefore = get();
    const { sessionUser, activePersona } = getStoreSessionActor(stateBefore);
    const current = stateBefore.capaItems.find((item) => item.id === capaId);
    const allowedPersona =
      activePersona === "Inspector" ||
      activePersona === "Submitter" ||
      activePersona === "Administrator";
    if (!current || !sessionUser || !allowedPersona || !canAccessCapaInSession(stateBefore, current)) {
      return;
    }
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? { ...item, evidences: [...item.evidences, evidence] }
          : item,
      ),
    }));
  },
  removeCapaEvidence: (capaId, evidenceId) => {
    const stateBefore = get();
    const { sessionUser, activePersona } = getStoreSessionActor(stateBefore);
    const current = stateBefore.capaItems.find((item) => item.id === capaId);
    const allowedPersona =
      activePersona === "Inspector" ||
      activePersona === "Submitter" ||
      activePersona === "Administrator";
    if (!current || !sessionUser || !allowedPersona || !canAccessCapaInSession(stateBefore, current)) {
      return;
    }
    const targetEv = current.evidences.find((ev) => ev.id === evidenceId);
    if (
      activePersona !== "Inspector" &&
      targetEv &&
      targetEv.uploadedBy !== sessionUser.name
    ) {
      return;
    }
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
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const current = stateBefore.capaItems.find((item) => item.id === capaId);
    if (
      !current ||
      !sessionUser ||
      (activePersona !== "C Admin" && activePersona !== "Administrator") ||
      !canAccessCapaInSession(stateBefore, current)
    ) {
      return;
    }
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

    const stateAfter = get();
    const capa = stateAfter.capaItems.find((item) => item.id === capaId);
    if (capa) {
      /* the inspector is the one assigned on an accessible assurance set for the same vessel */
      const inspectedSet = stateAfter.assuranceSets.find(
        (s) =>
          (capa.assuranceSetId
            ? s.id === capa.assuranceSetId
            : (Boolean(capa.vesselId) && s.vesselId === capa.vesselId) ||
              (Boolean(capa.vesselName) &&
                Boolean(s.vesselName) &&
                s.vesselName.trim().toLowerCase() === capa.vesselName.trim().toLowerCase())) &&
          isAssuranceSetAssignedToPersona(
            s,
            activePersona,
            activeDemoOrganization,
            sessionUser,
            stateAfter.users,
          ) &&
          Boolean(resolveNotificationRecipient(s.assignedInspector, stateAfter.users)),
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
  submitCapaResponse: (capaId, responseNotes) => {
    const stateBefore = get();
    const { sessionUser, activePersona, activeDemoOrganization } = getStoreSessionActor(stateBefore);
    const current = stateBefore.capaItems.find((item) => item.id === capaId);
    const allowedResponder =
      activePersona === "Submitter" ||
      activePersona === "Administrator" ||
      activePersona === "C Admin";
    if (
      !current ||
      !sessionUser ||
      !allowedResponder ||
      !canAccessCapaInSession(stateBefore, current)
    ) {
      return;
    }
    const cleanNotes = responseNotes.trim();
    const formattedDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? {
              ...item,
              status: "Under Re-Inspection",
              closedDate: undefined,
              flaggedForReinspection: true,
              submitterResponse: cleanNotes || "Corrective action submitted for verification.",
              respondedBy: sessionUser.name,
              respondedAt: formattedDate,
            }
          : item,
      ),
    }));
    get().logAuditEvent({
      action: `Submitted CAPA remediation response (${capaId})`,
      targetAsset: `${current.vesselName} · ${current.title}`,
      justificationNotes:
        cleanNotes || "Submitter marked finding addressed and requested re-inspection.",
    });

    const stateAfter = get();
    const capa = stateAfter.capaItems.find((item) => item.id === capaId);
    if (capa) {
      const inspectedSet = stateAfter.assuranceSets.find(
        (s) =>
          (capa.assuranceSetId
            ? s.id === capa.assuranceSetId
            : (Boolean(capa.vesselId) && s.vesselId === capa.vesselId) ||
              (Boolean(capa.vesselName) &&
                Boolean(s.vesselName) &&
                s.vesselName.trim().toLowerCase() === capa.vesselName.trim().toLowerCase())) &&
          isAssuranceSetAssignedToPersona(
            s,
            activePersona,
            activeDemoOrganization,
            sessionUser,
            stateAfter.users,
          ) &&
          Boolean(resolveNotificationRecipient(s.assignedInspector, stateAfter.users)),
      );
      if (inspectedSet) {
        notifyAssuranceSetUser(get, inspectedSet, inspectedSet.assignedInspector, {
          type: "capa_reinspection",
          subject: `Remediation submitted: ${capa.id}`,
          message: cleanNotes || undefined,
          capaId: capa.id,
          vesselName: capa.vesselName,
        });
      }
    }
  },
}));
